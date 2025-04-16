const vscode = require('vscode');
const path = require('path');

/**
 * Code search tools
 * Provides code search, symbol finding, and other functionality
 */
class CodeSearchTools {
    /**
     * Initialize code search tools
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
     * Search code
     * @param {Object} params Parameters object
     * @param {string} params.query Search query
     * @param {string} [params.include] Include pattern
     * @param {string} [params.exclude] Exclude pattern
     * @param {boolean} [params.case_sensitive=false] Whether to be case sensitive
     * @param {boolean} [params.whole_word=false] Whether to match whole words
     * @param {boolean} [params.regex=false] Whether to use regular expressions
     * @returns {Promise<Array>} Search results
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

            // Create search options
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

            // Execute search
            const results = await vscode.workspace.findTextInFiles(searchOptions);

            // Format results
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
     * Find symbols
     * @param {Object} params Parameters object
     * @param {string} params.query Symbol query
     * @param {string} [params.kind] Symbol kind
     * @returns {Promise<Array>} Symbol list
     */
    async findSymbols(params) {
        try {
            const { query, kind } = params;

            if (!query) {
                throw new Error('Symbol query is required');
            }

            // Execute symbol search
            const symbols = await vscode.commands.executeCommand(
                'vscode.executeWorkspaceSymbolProvider',
                query
            );

            if (!symbols || symbols.length === 0) {
                return [];
            }

            // Filter symbol kind (if specified)
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

            // Format results
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
     * Get symbols in a document
     * @param {Object} params Parameters object
     * @param {string} params.file_path File path
     * @returns {Promise<Array>} Symbol list
     */
    async getDocumentSymbols(params) {
        try {
            const { file_path } = params;

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

            // Get document symbols
            const symbols = await vscode.commands.executeCommand(
                'vscode.executeDocumentSymbolProvider',
                uri
            );

            if (!symbols || symbols.length === 0) {
                return [];
            }

            // Recursively format symbols
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
     * Register all code search tools
     * @param {ToolManager} toolManager Tool manager
     */
    registerTools(toolManager) {
        // Search code
        toolManager.registerTool('search-code', this.searchCode.bind(this), {
            description: 'Search code in workspace',
            parameters: {
                query: {
                    type: 'string',
                    description: 'Search query'
                },
                include: {
                    type: 'string',
                    description: 'Include pattern, e.g. "**/*.js"'
                },
                exclude: {
                    type: 'string',
                    description: 'Exclude pattern, e.g. "**/node_modules/**"'
                },
                case_sensitive: {
                    type: 'boolean',
                    description: 'Whether to be case sensitive'
                },
                whole_word: {
                    type: 'boolean',
                    description: 'Whether to match whole words'
                },
                regex: {
                    type: 'boolean',
                    description: 'Whether to use regular expressions'
                }
            },
            required: ['query']
        });

        // Find symbols
        toolManager.registerTool('find-symbols', this.findSymbols.bind(this), {
            description: 'Find symbols in workspace',
            parameters: {
                query: {
                    type: 'string',
                    description: 'Symbol query'
                },
                kind: {
                    type: 'string',
                    description: 'Symbol kind, e.g. "class", "function", "method", "variable"'
                }
            },
            required: ['query']
        });

        // Get document symbols
        toolManager.registerTool('get-document-symbols', this.getDocumentSymbols.bind(this), {
            description: 'Get symbols in a file',
            parameters: {
                file_path: {
                    type: 'string',
                    description: 'File path, can be relative to workspace root'
                }
            },
            required: ['file_path']
        });
    }
}

module.exports = CodeSearchTools;
