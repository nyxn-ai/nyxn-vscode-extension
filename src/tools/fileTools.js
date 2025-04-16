const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const util = require('util');

// Convert fs functions to Promises
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

/**
 * File operation tools
 * Provides functions for reading, writing, searching files, etc.
 */
class FileTools {
    /**
     * Initialize file tools
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
     * Resolve file path
     * @param {string} filePath File path
     * @returns {string} Full file path
     */
    resolvePath(filePath) {
        // If it's a relative path, resolve it relative to workspace root
        if (!path.isAbsolute(filePath)) {
            const workspaceRoot = this.getWorkspaceRoot();
            if (workspaceRoot) {
                return path.join(workspaceRoot, filePath);
            }
        }
        return filePath;
    }

    /**
     * Read file content
     * @param {Object} params Parameters object
     * @param {string} params.file_path File path
     * @returns {Promise<string>} File content
     */
    async readFile(params) {
        try {
            const { file_path } = params;
            const fullPath = this.resolvePath(file_path);

            // Check if file exists
            await stat(fullPath);

            // Read file content
            const content = await readFile(fullPath, 'utf8');
            return content;
        } catch (error) {
            throw new Error(`Failed to read file: ${error.message}`);
        }
    }

    /**
     * Write file content
     * @param {Object} params Parameters object
     * @param {string} params.file_path File path
     * @param {string} params.content File content
     * @returns {Promise<string>} Success message
     */
    async writeFile(params) {
        try {
            const { file_path, content } = params;
            const fullPath = this.resolvePath(file_path);

            // Write file content
            await writeFile(fullPath, content, 'utf8');
            return `File successfully written: ${file_path}`;
        } catch (error) {
            throw new Error(`Failed to write file: ${error.message}`);
        }
    }

    /**
     * List directory contents
     * @param {Object} params Parameters object
     * @param {string} params.directory_path Directory path
     * @returns {Promise<Array>} Directory contents list
     */
    async listDirectory(params) {
        try {
            const { directory_path } = params;
            const fullPath = this.resolvePath(directory_path);

            // Check if directory exists
            const stats = await stat(fullPath);
            if (!stats.isDirectory()) {
                throw new Error(`Not a directory: ${directory_path}`);
            }

            // Read directory contents
            const items = await readdir(fullPath);

            // Get detailed information for each item
            const detailedItems = await Promise.all(
                items.map(async (item) => {
                    const itemPath = path.join(fullPath, item);
                    const itemStat = await stat(itemPath);
                    return {
                        name: item,
                        path: path.relative(this.getWorkspaceRoot() || fullPath, itemPath),
                        isDirectory: itemStat.isDirectory(),
                        size: itemStat.size,
                        modified: itemStat.mtime.toISOString()
                    };
                })
            );

            return detailedItems;
        } catch (error) {
            throw new Error(`Failed to list directory: ${error.message}`);
        }
    }

    /**
     * Search files
     * @param {Object} params Parameters object
     * @param {string} params.pattern Search pattern
     * @param {string} [params.directory_path] Directory path
     * @param {boolean} [params.include_hidden=false] Whether to include hidden files
     * @returns {Promise<Array>} List of matching files
     */
    async searchFiles(params) {
        try {
            const { pattern, directory_path, include_hidden = false } = params;
            const rootPath = directory_path
                ? this.resolvePath(directory_path)
                : this.getWorkspaceRoot();

            if (!rootPath) {
                throw new Error('No workspace folder is open');
            }

            // Use VS Code API to search files
            const files = await vscode.workspace.findFiles(
                pattern,
                include_hidden ? undefined : '**/node_modules/**,**/.git/**'
            );

            // Filter results to only include files in the specified directory
            const filteredFiles = files.filter(file =>
                file.fsPath.startsWith(rootPath)
            );

            // Format results
            return filteredFiles.map(file => ({
                name: path.basename(file.fsPath),
                path: path.relative(this.getWorkspaceRoot() || rootPath, file.fsPath),
                uri: file.toString()
            }));
        } catch (error) {
            throw new Error(`Failed to search files: ${error.message}`);
        }
    }

    /**
     * Get current open file
     * @returns {Promise<Object>} Current file information
     */
    async getCurrentFile() {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                throw new Error('No active editor');
            }

            const document = editor.document;
            const workspaceRoot = this.getWorkspaceRoot();

            return {
                name: path.basename(document.fileName),
                path: workspaceRoot
                    ? path.relative(workspaceRoot, document.fileName)
                    : document.fileName,
                language: document.languageId,
                content: document.getText(),
                selection: editor.selection
                    ? document.getText(editor.selection)
                    : null
            };
        } catch (error) {
            throw new Error(`Failed to get current file: ${error.message}`);
        }
    }

    /**
     * Register all file tools
     * @param {ToolManager} toolManager Tool manager
     */
    registerTools(toolManager) {
        // Read file
        toolManager.registerTool('read-file', this.readFile.bind(this), {
            description: 'Read file content',
            parameters: {
                file_path: {
                    type: 'string',
                    description: 'File path, can be relative to workspace root'
                }
            },
            required: ['file_path']
        });

        // Write file
        toolManager.registerTool('write-file', this.writeFile.bind(this), {
            description: 'Write file content',
            parameters: {
                file_path: {
                    type: 'string',
                    description: 'File path, can be relative to workspace root'
                },
                content: {
                    type: 'string',
                    description: 'Content to write to the file'
                }
            },
            required: ['file_path', 'content']
        });

        // List directory
        toolManager.registerTool('list-directory', this.listDirectory.bind(this), {
            description: 'List directory contents',
            parameters: {
                directory_path: {
                    type: 'string',
                    description: 'Directory path, can be relative to workspace root'
                }
            },
            required: ['directory_path']
        });

        // Search files
        toolManager.registerTool('search-files', this.searchFiles.bind(this), {
            description: 'Search files',
            parameters: {
                pattern: {
                    type: 'string',
                    description: 'Search pattern, e.g. "**/*.js"'
                },
                directory_path: {
                    type: 'string',
                    description: 'Directory path, can be relative to workspace root'
                },
                include_hidden: {
                    type: 'boolean',
                    description: 'Whether to include hidden files'
                }
            },
            required: ['pattern']
        });

        // Get current file
        toolManager.registerTool('get-current-file', this.getCurrentFile.bind(this), {
            description: 'Get current open file',
            parameters: {},
            required: []
        });
    }
}

module.exports = FileTools;
