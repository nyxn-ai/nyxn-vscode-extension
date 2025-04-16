const vscode = require('vscode');
const path = require('path');

/**
 * 代码搜索工具集
 * 提供代码搜索、符号查找等功能
 */
class CodeSearchTools {
    /**
     * 初始化代码搜索工具
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
     * 搜索代码
     * @param {Object} params 参数对象
     * @param {string} params.query 搜索查询
     * @param {string} [params.include] 包含模式
     * @param {string} [params.exclude] 排除模式
     * @param {boolean} [params.case_sensitive=false] 是否区分大小写
     * @param {boolean} [params.whole_word=false] 是否全字匹配
     * @param {boolean} [params.regex=false] 是否使用正则表达式
     * @returns {Promise<Array>} 搜索结果
     */
    async searchCode(params) {
        try {
            const { 
                query, 
                include, 
                exclude, 
                case_sensitive = false, 
                whole_word = false, 
                regex = false 
            } = params;
            
            if (!query) {
                throw new Error('Search query is required');
            }
            
            // 创建搜索选项
            const searchOptions = {
                pattern: query,
                isCaseSensitive: case_sensitive,
                isWordMatch: whole_word,
                isRegExp: regex,
            };
            
            if (include) {
                searchOptions.includes = [include];
            }
            
            if (exclude) {
                searchOptions.excludes = [exclude];
            }
            
            // 执行搜索
            const results = await vscode.workspace.findTextInFiles(searchOptions);
            
            // 格式化结果
            const formattedResults = [];
            results.forEach((fileResults, uri) => {
                const filePath = uri.fsPath;
                const workspaceRoot = this.getWorkspaceRoot();
                const relativePath = workspaceRoot 
                    ? path.relative(workspaceRoot, filePath)
                    : filePath;
                
                fileResults.matches.forEach(match => {
                    formattedResults.push({
                        file: relativePath,
                        line: match.lineNumber,
                        preview: match.lineText.trim(),
                        range: {
                            start: match.range.start,
                            end: match.range.end
                        }
                    });
                });
            });
            
            return formattedResults;
        } catch (error) {
            throw new Error(`Failed to search code: ${error.message}`);
        }
    }

    /**
     * 查找符号
     * @param {Object} params 参数对象
     * @param {string} params.query 符号查询
     * @param {string} [params.kind] 符号类型
     * @returns {Promise<Array>} 符号列表
     */
    async findSymbols(params) {
        try {
            const { query, kind } = params;
            
            if (!query) {
                throw new Error('Symbol query is required');
            }
            
            // 执行符号搜索
            const symbols = await vscode.commands.executeCommand(
                'vscode.executeWorkspaceSymbolProvider',
                query
            );
            
            if (!symbols || symbols.length === 0) {
                return [];
            }
            
            // 过滤符号类型（如果指定）
            let filteredSymbols = symbols;
            if (kind) {
                const kindMap = {
                    'class': vscode.SymbolKind.Class,
                    'function': vscode.SymbolKind.Function,
                    'method': vscode.SymbolKind.Method,
                    'variable': vscode.SymbolKind.Variable,
                    'interface': vscode.SymbolKind.Interface,
                    'enum': vscode.SymbolKind.Enum,
                    'property': vscode.SymbolKind.Property,
                    'constructor': vscode.SymbolKind.Constructor
                };
                
                const kindValue = kindMap[kind.toLowerCase()];
                if (kindValue) {
                    filteredSymbols = symbols.filter(symbol => symbol.kind === kindValue);
                }
            }
            
            // 格式化结果
            const workspaceRoot = this.getWorkspaceRoot();
            return filteredSymbols.map(symbol => {
                const filePath = symbol.location.uri.fsPath;
                const relativePath = workspaceRoot 
                    ? path.relative(workspaceRoot, filePath)
                    : filePath;
                
                return {
                    name: symbol.name,
                    kind: vscode.SymbolKind[symbol.kind],
                    file: relativePath,
                    line: symbol.location.range.start.line + 1,
                    range: {
                        start: {
                            line: symbol.location.range.start.line,
                            character: symbol.location.range.start.character
                        },
                        end: {
                            line: symbol.location.range.end.line,
                            character: symbol.location.range.end.character
                        }
                    }
                };
            });
        } catch (error) {
            throw new Error(`Failed to find symbols: ${error.message}`);
        }
    }

    /**
     * 获取文件中的符号
     * @param {Object} params 参数对象
     * @param {string} params.file_path 文件路径
     * @returns {Promise<Array>} 符号列表
     */
    async getDocumentSymbols(params) {
        try {
            const { file_path } = params;
            
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
            
            // 获取文档符号
            const symbols = await vscode.commands.executeCommand(
                'vscode.executeDocumentSymbolProvider',
                uri
            );
            
            if (!symbols || symbols.length === 0) {
                return [];
            }
            
            // 递归格式化符号
            function formatSymbol(symbol) {
                const result = {
                    name: symbol.name,
                    kind: vscode.SymbolKind[symbol.kind],
                    range: {
                        start: {
                            line: symbol.range.start.line,
                            character: symbol.range.start.character
                        },
                        end: {
                            line: symbol.range.end.line,
                            character: symbol.range.end.character
                        }
                    },
                    detail: symbol.detail || null
                };
                
                if (symbol.children && symbol.children.length > 0) {
                    result.children = symbol.children.map(formatSymbol);
                }
                
                return result;
            }
            
            return symbols.map(formatSymbol);
        } catch (error) {
            throw new Error(`Failed to get document symbols: ${error.message}`);
        }
    }

    /**
     * 注册所有代码搜索工具
     * @param {ToolManager} toolManager 工具管理器
     */
    registerTools(toolManager) {
        // 搜索代码
        toolManager.registerTool('search-code', this.searchCode.bind(this), {
            description: '在工作区中搜索代码',
            parameters: {
                query: {
                    type: 'string',
                    description: '搜索查询'
                },
                include: {
                    type: 'string',
                    description: '包含模式，例如 "**/*.js"'
                },
                exclude: {
                    type: 'string',
                    description: '排除模式，例如 "**/node_modules/**"'
                },
                case_sensitive: {
                    type: 'boolean',
                    description: '是否区分大小写'
                },
                whole_word: {
                    type: 'boolean',
                    description: '是否全字匹配'
                },
                regex: {
                    type: 'boolean',
                    description: '是否使用正则表达式'
                }
            },
            required: ['query']
        });
        
        // 查找符号
        toolManager.registerTool('find-symbols', this.findSymbols.bind(this), {
            description: '在工作区中查找符号',
            parameters: {
                query: {
                    type: 'string',
                    description: '符号查询'
                },
                kind: {
                    type: 'string',
                    description: '符号类型，例如 "class", "function", "method", "variable"'
                }
            },
            required: ['query']
        });
        
        // 获取文档符号
        toolManager.registerTool('get-document-symbols', this.getDocumentSymbols.bind(this), {
            description: '获取文件中的符号',
            parameters: {
                file_path: {
                    type: 'string',
                    description: '文件路径，可以是相对于工作区根目录的路径'
                }
            },
            required: ['file_path']
        });
    }
}

module.exports = CodeSearchTools;
