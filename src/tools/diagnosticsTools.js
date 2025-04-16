const vscode = require('vscode');
const path = require('path');

/**
 * Diagnostics tools
 * Provides code diagnostics, suggestions, and other functionality
 */
class DiagnosticsTools {
    /**
     * Initialize diagnostics tools
     * @param {vscode.ExtensionContext} context Extension context
     */
    constructor(context) {
        this.context = context;
    }

    /**
     * Get workspace root path
     * @returns {string|null} Workspace root path
     */
    getWorkspaceRoot() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }
        return workspaceFolders[0].uri.fsPath;
    }

    /**
     * Get diagnostics
     * @param {Object} params Parameters object
     * @param {string} [params.file_path] File path
     * @returns {Promise<Array>} List of diagnostics
     */
    async getDiagnostics(params) {
        try {
            const { file_path } = params;
            const workspaceRoot = this.getWorkspaceRoot();

            // Get all diagnostics
            const allDiagnostics = [];

            if (file_path) {
                // Get diagnostics for specific file
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
                // Get diagnostics for all files
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
     * Get code actions
     * @param {Object} params Parameters object
     * @param {string} params.file_path File path
     * @param {number} [params.line] Line number
     * @param {number} [params.column] Column number
     * @returns {Promise<Array>} List of code actions
     */
    async getCodeActions(params) {
        try {
            const { file_path, line, column } = params;

            if (!file_path) {
                throw new Error('File path is required');
            }

            // Resolve file path
            const workspaceRoot = this.getWorkspaceRoot();
            const fullPath = path.isAbsolute(file_path)
                ? file_path
                : path.join(workspaceRoot || '', file_path);

            // Open document
            const uri = vscode.Uri.file(fullPath);
            const document = await vscode.workspace.openTextDocument(uri);

            // Create range
            let range;
            if (typeof line === 'number' && typeof column === 'number') {
                const position = new vscode.Position(line - 1, column - 1);
                range = new vscode.Range(position, position);
            } else {
                // Use entire document range
                range = new vscode.Range(
                    new vscode.Position(0, 0),
                    new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length)
                );
            }

            // Get diagnostics
            const diagnostics = vscode.languages.getDiagnostics(uri).filter(
                diagnostic => diagnostic.range.intersection(range)
            );

            // Get code actions
            const codeActions = await vscode.commands.executeCommand(
                'vscode.executeCodeActionProvider',
                uri,
                range,
                vscode.CodeActionKind.QuickFix.value
            );

            if (!codeActions || codeActions.length === 0) {
                return [];
            }

            // Format results
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
     * Apply code action
     * @param {Object} params Parameters object
     * @param {string} params.file_path File path
     * @param {number} params.line Line number
     * @param {number} params.column Column number
     * @param {string} params.action_title Action title
     * @returns {Promise<string>} Success message
     */
    async applyCodeAction(params) {
        try {
            const { file_path, line, column, action_title } = params;

            if (!file_path || !line || !column || !action_title) {
                throw new Error('File path, line, column, and action title are required');
            }

            // Resolve file path
            const workspaceRoot = this.getWorkspaceRoot();
            const fullPath = path.isAbsolute(file_path)
                ? file_path
                : path.join(workspaceRoot || '', file_path);

            // Open document
            const uri = vscode.Uri.file(fullPath);
            const document = await vscode.workspace.openTextDocument(uri);

            // Create position
            const position = new vscode.Position(line - 1, column - 1);
            const range = new vscode.Range(position, position);

            // Get code actions
            const codeActions = await vscode.commands.executeCommand(
                'vscode.executeCodeActionProvider',
                uri,
                range
            );

            if (!codeActions || codeActions.length === 0) {
                throw new Error('No code actions available');
            }

            // Find matching action
            const action = codeActions.find(a => a.title === action_title);
            if (!action) {
                throw new Error(`Code action "${action_title}" not found`);
            }

            // Apply code action
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
     * Convert diagnostic severity to string
     * @param {vscode.DiagnosticSeverity} severity Severity
     * @returns {string} Severity string
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
     * Register all diagnostic tools
     * @param {ToolManager} toolManager Tool manager
     */
    registerTools(toolManager) {
        // Get diagnostics
        toolManager.registerTool('get-diagnostics', this.getDiagnostics.bind(this), {
            description: 'Get code diagnostics',
            parameters: {
                file_path: {
                    type: 'string',
                    description: 'File path, can be relative to workspace root'
                }
            },
            required: []
        });

        // Get code actions
        toolManager.registerTool('get-code-actions', this.getCodeActions.bind(this), {
            description: 'Get code actions',
            parameters: {
                file_path: {
                    type: 'string',
                    description: 'File path, can be relative to workspace root'
                },
                line: {
                    type: 'number',
                    description: 'Line number'
                },
                column: {
                    type: 'number',
                    description: 'Column number'
                }
            },
            required: ['file_path']
        });

        // Apply code action
        toolManager.registerTool('apply-code-action', this.applyCodeAction.bind(this), {
            description: 'Apply code action',
            parameters: {
                file_path: {
                    type: 'string',
                    description: 'File path, can be relative to workspace root'
                },
                line: {
                    type: 'number',
                    description: 'Line number'
                },
                column: {
                    type: 'number',
                    description: 'Column number'
                },
                action_title: {
                    type: 'string',
                    description: 'Action title'
                }
            },
            required: ['file_path', 'line', 'column', 'action_title']
        });
    }
}

module.exports = DiagnosticsTools;
