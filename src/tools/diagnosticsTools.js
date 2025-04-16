const vscode = require('vscode');
const path = require('path');

/**
 * 诊断工具集
 * 提供代码问题诊断、建议等功能
 */
class DiagnosticsTools {
    /**
     * 初始化诊断工具
     * @param {vscode.ExtensionContext} context 扩展上下文
     */
    constructor(context) {
        this.context = context;
    }

    /**
     * 获取工作区根路径
     * @returns {string|null} 工作区根路径
     */
    getWorkspaceRoot() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }
        return workspaceFolders[0].uri.fsPath;
    }

    /**
     * 获取诊断信息
     * @param {Object} params 参数对象
     * @param {string} [params.file_path] 文件路径
     * @returns {Promise<Array>} 诊断信息列表
     */
    async getDiagnostics(params) {
        try {
            const { file_path } = params;
            const workspaceRoot = this.getWorkspaceRoot();
            
            // 获取所有诊断信息
            const allDiagnostics = [];
            
            if (file_path) {
                // 获取特定文件的诊断信息
                const fullPath = path.isAbsolute(file_path)
                    ? file_path
                    : path.join(workspaceRoot || '', file_path);
                
                const uri = vscode.Uri.file(fullPath);
                const fileDiagnostics = vscode.languages.getDiagnostics(uri);
                
                fileDiagnostics.forEach(diagnostic => {
                    allDiagnostics.push({
                        file: file_path,
                        line: diagnostic.range.start.line + 1,
                        column: diagnostic.range.start.character + 1,
                        severity: this._getSeverityString(diagnostic.severity),
                        message: diagnostic.message,
                        source: diagnostic.source || 'unknown',
                        code: diagnostic.code ? String(diagnostic.code) : null
                    });
                });
            } else {
                // 获取所有文件的诊断信息
                vscode.languages.getDiagnostics().forEach(([uri, diagnostics]) => {
                    const filePath = uri.fsPath;
                    const relativePath = workspaceRoot 
                        ? path.relative(workspaceRoot, filePath)
                        : filePath;
                    
                    diagnostics.forEach(diagnostic => {
                        allDiagnostics.push({
                            file: relativePath,
                            line: diagnostic.range.start.line + 1,
                            column: diagnostic.range.start.character + 1,
                            severity: this._getSeverityString(diagnostic.severity),
                            message: diagnostic.message,
                            source: diagnostic.source || 'unknown',
                            code: diagnostic.code ? String(diagnostic.code) : null
                        });
                    });
                });
            }
            
            return allDiagnostics;
        } catch (error) {
            throw new Error(`Failed to get diagnostics: ${error.message}`);
        }
    }

    /**
     * 获取代码操作
     * @param {Object} params 参数对象
     * @param {string} params.file_path 文件路径
     * @param {number} [params.line] 行号
     * @param {number} [params.column] 列号
     * @returns {Promise<Array>} 代码操作列表
     */
    async getCodeActions(params) {
        try {
            const { file_path, line, column } = params;
            
            if (!file_path) {
                throw new Error('File path is required');
            }
            
            // 解析文件路径
            const workspaceRoot = this.getWorkspaceRoot();
            const fullPath = path.isAbsolute(file_path)
                ? file_path
                : path.join(workspaceRoot || '', file_path);
            
            // 打开文档
            const uri = vscode.Uri.file(fullPath);
            const document = await vscode.workspace.openTextDocument(uri);
            
            // 创建范围
            let range;
            if (typeof line === 'number' && typeof column === 'number') {
                const position = new vscode.Position(line - 1, column - 1);
                range = new vscode.Range(position, position);
            } else {
                // 使用整个文档范围
                range = new vscode.Range(
                    new vscode.Position(0, 0),
                    new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length)
                );
            }
            
            // 获取诊断信息
            const diagnostics = vscode.languages.getDiagnostics(uri).filter(
                diagnostic => diagnostic.range.intersection(range)
            );
            
            // 获取代码操作
            const codeActions = await vscode.commands.executeCommand(
                'vscode.executeCodeActionProvider',
                uri,
                range,
                vscode.CodeActionKind.QuickFix.value
            );
            
            if (!codeActions || codeActions.length === 0) {
                return [];
            }
            
            // 格式化结果
            return codeActions.map(action => ({
                title: action.title,
                kind: action.kind ? action.kind.value : null,
                isPreferred: action.isPreferred || false,
                diagnostics: action.diagnostics ? action.diagnostics.map(d => ({
                    message: d.message,
                    severity: this._getSeverityString(d.severity),
                    line: d.range.start.line + 1,
                    column: d.range.start.character + 1
                })) : []
            }));
        } catch (error) {
            throw new Error(`Failed to get code actions: ${error.message}`);
        }
    }

    /**
     * 应用代码操作
     * @param {Object} params 参数对象
     * @param {string} params.file_path 文件路径
     * @param {number} params.line 行号
     * @param {number} params.column 列号
     * @param {string} params.action_title 操作标题
     * @returns {Promise<string>} 成功消息
     */
    async applyCodeAction(params) {
        try {
            const { file_path, line, column, action_title } = params;
            
            if (!file_path || !line || !column || !action_title) {
                throw new Error('File path, line, column, and action title are required');
            }
            
            // 解析文件路径
            const workspaceRoot = this.getWorkspaceRoot();
            const fullPath = path.isAbsolute(file_path)
                ? file_path
                : path.join(workspaceRoot || '', file_path);
            
            // 打开文档
            const uri = vscode.Uri.file(fullPath);
            const document = await vscode.workspace.openTextDocument(uri);
            
            // 创建位置
            const position = new vscode.Position(line - 1, column - 1);
            const range = new vscode.Range(position, position);
            
            // 获取代码操作
            const codeActions = await vscode.commands.executeCommand(
                'vscode.executeCodeActionProvider',
                uri,
                range
            );
            
            if (!codeActions || codeActions.length === 0) {
                throw new Error('No code actions available');
            }
            
            // 查找匹配的操作
            const action = codeActions.find(a => a.title === action_title);
            if (!action) {
                throw new Error(`Code action "${action_title}" not found`);
            }
            
            // 应用代码操作
            if (action.edit) {
                await vscode.workspace.applyEdit(action.edit);
            }
            
            if (action.command) {
                await vscode.commands.executeCommand(
                    action.command.command,
                    ...(action.command.arguments || [])
                );
            }
            
            return `Applied code action: ${action_title}`;
        } catch (error) {
            throw new Error(`Failed to apply code action: ${error.message}`);
        }
    }

    /**
     * 将诊断严重性转换为字符串
     * @param {vscode.DiagnosticSeverity} severity 严重性
     * @returns {string} 严重性字符串
     * @private
     */
    _getSeverityString(severity) {
        switch (severity) {
            case vscode.DiagnosticSeverity.Error:
                return 'error';
            case vscode.DiagnosticSeverity.Warning:
                return 'warning';
            case vscode.DiagnosticSeverity.Information:
                return 'information';
            case vscode.DiagnosticSeverity.Hint:
                return 'hint';
            default:
                return 'unknown';
        }
    }

    /**
     * 注册所有诊断工具
     * @param {ToolManager} toolManager 工具管理器
     */
    registerTools(toolManager) {
        // 获取诊断信息
        toolManager.registerTool('get-diagnostics', this.getDiagnostics.bind(this), {
            description: '获取代码诊断信息',
            parameters: {
                file_path: {
                    type: 'string',
                    description: '文件路径，可以是相对于工作区根目录的路径'
                }
            },
            required: []
        });
        
        // 获取代码操作
        toolManager.registerTool('get-code-actions', this.getCodeActions.bind(this), {
            description: '获取代码操作',
            parameters: {
                file_path: {
                    type: 'string',
                    description: '文件路径，可以是相对于工作区根目录的路径'
                },
                line: {
                    type: 'number',
                    description: '行号'
                },
                column: {
                    type: 'number',
                    description: '列号'
                }
            },
            required: ['file_path']
        });
        
        // 应用代码操作
        toolManager.registerTool('apply-code-action', this.applyCodeAction.bind(this), {
            description: '应用代码操作',
            parameters: {
                file_path: {
                    type: 'string',
                    description: '文件路径，可以是相对于工作区根目录的路径'
                },
                line: {
                    type: 'number',
                    description: '行号'
                },
                column: {
                    type: 'number',
                    description: '列号'
                },
                action_title: {
                    type: 'string',
                    description: '操作标题'
                }
            },
            required: ['file_path', 'line', 'column', 'action_title']
        });
    }
}

module.exports = DiagnosticsTools;
