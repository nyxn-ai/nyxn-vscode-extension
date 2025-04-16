const vscode = require('vscode');
const path = require('path');

/**
 * Code Generation Tools
 * Provides code generation, completion, and other functionality
 * similar to Claude and Augment
 */
class CodeGenerationTools {
    /**
     * Initialize code generation tools
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
     * Insert code at cursor position
     * @param {Object} params Parameters object
     * @param {string} params.code Code to insert
     * @returns {Promise<string>} Success message
     */
    async insertCode(params) {
        try {
            const { code } = params;

            if (!code) {
                throw new Error('Code is required');
            }

            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                throw new Error('No active editor');
            }

            // Insert code at cursor position
            await editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, code);
            });

            return 'Code inserted successfully';
        } catch (error) {
            throw new Error(`Failed to insert code: ${error.message}`);
        }
    }

    /**
     * Replace selected code
     * @param {Object} params Parameters object
     * @param {string} params.code New code
     * @returns {Promise<string>} Success message
     */
    async replaceSelectedCode(params) {
        try {
            const { code } = params;

            if (!code) {
                throw new Error('Code is required');
            }

            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                throw new Error('No active editor');
            }

            if (editor.selection.isEmpty) {
                throw new Error('No code selected');
            }

            // Replace selected code
            await editor.edit(editBuilder => {
                editBuilder.replace(editor.selection, code);
            });

            return 'Code replaced successfully';
        } catch (error) {
            throw new Error(`Failed to replace code: ${error.message}`);
        }
    }

    /**
     * Create new file
     * @param {Object} params Parameters object
     * @param {string} params.file_path File path
     * @param {string} params.content File content
     * @returns {Promise<string>} Success message
     */
    async createFile(params) {
        try {
            const { file_path, content } = params;

            if (!file_path) {
                throw new Error('File path is required');
            }

            // Resolve file path
            const workspaceRoot = this.getWorkspaceRoot();
            const fullPath = path.isAbsolute(file_path)
                ? file_path
                : path.join(workspaceRoot || '', file_path);

            // Create URI
            const uri = vscode.Uri.file(fullPath);

            // Create file
            const contentBytes = Buffer.from(content || '', 'utf8');
            await vscode.workspace.fs.writeFile(uri, contentBytes);

            // Open the file
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document);

            return `File created: ${file_path}`;
        } catch (error) {
            throw new Error(`Failed to create file: ${error.message}`);
        }
    }

    /**
     * Get project structure
     * @param {Object} params Parameters object
     * @param {number} [params.max_depth=3] Maximum depth
     * @returns {Promise<Object>} Project structure
     */
    async getProjectStructure(params) {
        try {
            const { max_depth = 3 } = params;
            const workspaceRoot = this.getWorkspaceRoot();

            if (!workspaceRoot) {
                throw new Error('No workspace folder is open');
            }

            // Get project structure recursively
            const structure = await this._getDirectoryStructure(workspaceRoot, 0, max_depth);

            return {
                name: path.basename(workspaceRoot),
                path: workspaceRoot,
                structure
            };
        } catch (error) {
            throw new Error(`Failed to get project structure: ${error.message}`);
        }
    }

    /**
     * Get directory structure recursively
     * @param {string} dirPath Directory path
     * @param {number} depth Current depth
     * @param {number} maxDepth Maximum depth
     * @returns {Promise<Array>} Directory structure
     * @private
     */
    async _getDirectoryStructure(dirPath, depth, maxDepth) {
        if (depth >= maxDepth) {
            return [];
        }

        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
            const result = [];

            for (const [name, type] of entries) {
                // Skip node_modules, .git, etc.
                if (name === 'node_modules' || name === '.git' || name === '.vscode') {
                    continue;
                }

                const entryPath = path.join(dirPath, name);

                if (type === vscode.FileType.Directory) {
                    // Process directory
                    const children = await this._getDirectoryStructure(entryPath, depth + 1, maxDepth);
                    result.push({
                        name,
                        type: 'directory',
                        children
                    });
                } else if (type === vscode.FileType.File) {
                    // Process file
                    result.push({
                        name,
                        type: 'file',
                        extension: path.extname(name)
                    });
                }
            }

            return result;
        } catch (error) {
            console.error(`Error reading directory ${dirPath}:`, error);
            return [];
        }
    }

    /**
     * Register all code generation tools
     * @param {ToolManager} toolManager Tool manager
     */
    registerTools(toolManager) {
        // Insert code
        toolManager.registerTool('insert-code', this.insertCode.bind(this), {
            description: 'Insert code at cursor position',
            parameters: {
                code: {
                    type: 'string',
                    description: 'Code to insert'
                }
            },
            required: ['code']
        });

        // Replace selected code
        toolManager.registerTool('replace-selected-code', this.replaceSelectedCode.bind(this), {
            description: 'Replace selected code',
            parameters: {
                code: {
                    type: 'string',
                    description: 'New code'
                }
            },
            required: ['code']
        });

        // Create new file
        toolManager.registerTool('create-file', this.createFile.bind(this), {
            description: 'Create new file',
            parameters: {
                file_path: {
                    type: 'string',
                    description: 'File path, can be relative to workspace root'
                },
                content: {
                    type: 'string',
                    description: 'File content'
                }
            },
            required: ['file_path']
        });

        // Get project structure
        toolManager.registerTool('get-project-structure', this.getProjectStructure.bind(this), {
            description: 'Get project structure',
            parameters: {
                max_depth: {
                    type: 'number',
                    description: 'Maximum depth'
                }
            },
            required: []
        });
    }
}

module.exports = CodeGenerationTools;
