const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const util = require('util');

// Convert fs functions to Promises
const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

/**
 * Context Manager
 * Responsible for collecting and managing code context
 */
class ContextManager {
    /**
     * Initialize context manager
     * @param {vscode.ExtensionContext} context Extension context
     */
    constructor(context) {
        this.context = context;
        this.cachedContext = null;
        this.lastUpdateTime = null;
        this.cacheValidityTime = 5 * 60 * 1000; // 5 minutes cache validity period
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
     * Get current file context
     * @returns {Promise<Object|null>} Current file context
     */
    async getCurrentFileContext() {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return null;
            }

            const document = editor.document;
            const selection = editor.selection;
            const workspaceRoot = this.getWorkspaceRoot();

            // Basic file information
            const fileContext = {
                fileName: path.basename(document.fileName),
                filePath: workspaceRoot
                    ? path.relative(workspaceRoot, document.fileName)
                    : document.fileName,
                language: document.languageId,
                lineCount: document.lineCount
            };

            // Selected text
            if (!selection.isEmpty) {
                fileContext.selection = {
                    text: document.getText(selection),
                    startLine: selection.start.line + 1,
                    startColumn: selection.start.character + 1,
                    endLine: selection.end.line + 1,
                    endColumn: selection.end.character + 1
                };
            }

            // File content
            fileContext.content = document.getText();

            // Get file symbols
            try {
                const symbols = await vscode.commands.executeCommand(
                    'vscode.executeDocumentSymbolProvider',
                    document.uri
                );

                if (symbols && symbols.length > 0) {
                    fileContext.symbols = this._formatSymbols(symbols);
                }
            } catch (error) {
                console.error('Error getting document symbols:', error);
            }

            return fileContext;
        } catch (error) {
            console.error('Error getting current file context:', error);
            return null;
        }
    }

    /**
     * Get project structure context
     * @param {number} [maxDepth=3] Maximum depth
     * @param {number} [maxFiles=100] Maximum number of files
     * @returns {Promise<Object|null>} Project structure context
     */
    async getProjectStructureContext(maxDepth = 3, maxFiles = 100) {
        try {
            const workspaceRoot = this.getWorkspaceRoot();
            if (!workspaceRoot) {
                return null;
            }

            // Check if cache is valid
            const now = Date.now();
            if (
                this.cachedContext &&
                this.lastUpdateTime &&
                (now - this.lastUpdateTime) < this.cacheValidityTime
            ) {
                return this.cachedContext;
            }

            // Recursively get directory structure
            let fileCount = 0;
            const structure = await this._getDirectoryStructure(
                workspaceRoot,
                workspaceRoot,
                0,
                maxDepth,
                maxFiles,
                fileCount
            );

            // Get project information
            const projectContext = {
                name: path.basename(workspaceRoot),
                root: workspaceRoot,
                structure
            };

            // Try to get package.json
            try {
                const packageJsonPath = path.join(workspaceRoot, 'package.json');
                const packageJsonStat = await stat(packageJsonPath);

                if (packageJsonStat.isFile()) {
                    const packageJsonContent = await readFile(packageJsonPath, 'utf8');
                    const packageJson = JSON.parse(packageJsonContent);

                    projectContext.packageJson = {
                        name: packageJson.name,
                        version: packageJson.version,
                        description: packageJson.description,
                        dependencies: packageJson.dependencies,
                        devDependencies: packageJson.devDependencies
                    };
                }
            } catch (error) {
                // package.json might not exist, ignore error
            }

            // Cache result
            this.cachedContext = projectContext;
            this.lastUpdateTime = now;

            return projectContext;
        } catch (error) {
            console.error('Error getting project structure context:', error);
            return null;
        }
    }

    /**
     * Get related files context
     * @param {string} filePath File path
     * @param {number} [maxFiles=5] Maximum number of files
     * @returns {Promise<Array>} Related files context
     */
    async getRelatedFilesContext(filePath, maxFiles = 5) {
        try {
            if (!filePath) {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    return [];
                }
                filePath = editor.document.fileName;
            }

            const workspaceRoot = this.getWorkspaceRoot();
            if (!workspaceRoot) {
                return [];
            }

            // Get file extension and base name
            const ext = path.extname(filePath);
            const baseName = path.basename(filePath, ext);
            const dirName = path.dirname(filePath);

            // Find related files
            const relatedFiles = [];

            // 1. Files with same name but different extension in the same directory
            const dirEntries = await readdir(dirName);
            for (const entry of dirEntries) {
                const entryPath = path.join(dirName, entry);
                const entryStat = await stat(entryPath);

                if (entryStat.isFile() && entry.startsWith(baseName) && entryPath !== filePath) {
                    relatedFiles.push(entryPath);
                }
            }

            // 2. Use VS Code API to find files that reference this file
            // This requires opening the file and using the symbol provider
            try {
                const uri = vscode.Uri.file(filePath);
                const document = await vscode.workspace.openTextDocument(uri);

                // Get all symbols in the document
                const symbols = await vscode.commands.executeCommand(
                    'vscode.executeDocumentSymbolProvider',
                    uri
                );

                if (symbols && symbols.length > 0) {
                    // For each symbol, find references
                    for (const symbol of symbols) {
                        if (relatedFiles.length >= maxFiles) {
                            break;
                        }

                        const position = new vscode.Position(
                            symbol.range.start.line,
                            symbol.range.start.character
                        );

                        const references = await vscode.commands.executeCommand(
                            'vscode.executeReferenceProvider',
                            uri,
                            position
                        );

                        if (references && references.length > 0) {
                            for (const ref of references) {
                                if (ref.uri.fsPath !== filePath && !relatedFiles.includes(ref.uri.fsPath)) {
                                    relatedFiles.push(ref.uri.fsPath);

                                    if (relatedFiles.length >= maxFiles) {
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error finding references:', error);
            }

            // Read related file content
            const relatedFilesContext = [];
            for (let i = 0; i < Math.min(relatedFiles.length, maxFiles); i++) {
                const relatedFilePath = relatedFiles[i];
                try {
                    const content = await readFile(relatedFilePath, 'utf8');
                    const relativePath = workspaceRoot
                        ? path.relative(workspaceRoot, relatedFilePath)
                        : relatedFilePath;

                    relatedFilesContext.push({
                        fileName: path.basename(relatedFilePath),
                        filePath: relativePath,
                        content
                    });
                } catch (error) {
                    console.error(`Error reading related file ${relatedFilePath}:`, error);
                }
            }

            return relatedFilesContext;
        } catch (error) {
            console.error('Error getting related files context:', error);
            return [];
        }
    }

    /**
     * Get full context
     * @returns {Promise<Object>} Full context
     */
    async getFullContext() {
        const currentFileContext = await this.getCurrentFileContext();
        const projectStructureContext = await this.getProjectStructureContext();

        let relatedFilesContext = [];
        if (currentFileContext) {
            relatedFilesContext = await this.getRelatedFilesContext(
                currentFileContext.filePath
            );
        }

        return {
            currentFile: currentFileContext,
            projectStructure: projectStructureContext,
            relatedFiles: relatedFilesContext,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Recursively get directory structure
     * @param {string} rootPath Root path
     * @param {string} dirPath Directory path
     * @param {number} depth Current depth
     * @param {number} maxDepth Maximum depth
     * @param {number} maxFiles Maximum number of files
     * @param {number} fileCount Current file count
     * @returns {Promise<Array>} Directory structure
     * @private
     */
    async _getDirectoryStructure(rootPath, dirPath, depth, maxDepth, maxFiles, fileCount) {
        if (depth > maxDepth || fileCount >= maxFiles) {
            return [];
        }

        try {
            const entries = await readdir(dirPath);
            const result = [];

            // Exclude hidden files and common ignored directories
            const filteredEntries = entries.filter(entry =>
                !entry.startsWith('.') &&
                entry !== 'node_modules' &&
                entry !== 'dist' &&
                entry !== 'build'
            );

            for (const entry of filteredEntries) {
                if (fileCount >= maxFiles) {
                    break;
                }

                const entryPath = path.join(dirPath, entry);
                const entryStat = await stat(entryPath);

                if (entryStat.isDirectory()) {
                    // Recursively process subdirectories
                    const children = await this._getDirectoryStructure(
                        rootPath,
                        entryPath,
                        depth + 1,
                        maxDepth,
                        maxFiles,
                        fileCount
                    );

                    result.push({
                        name: entry,
                        path: path.relative(rootPath, entryPath),
                        type: 'directory',
                        children
                    });
                } else if (entryStat.isFile()) {
                    // Process file
                    fileCount++;

                    result.push({
                        name: entry,
                        path: path.relative(rootPath, entryPath),
                        type: 'file',
                        size: entryStat.size,
                        extension: path.extname(entry)
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
     * Format symbols
     * @param {Array} symbols Symbol list
     * @returns {Array} Formatted symbol list
     * @private
     */
    _formatSymbols(symbols) {
        return symbols.map(symbol => {
            const result = {
                name: symbol.name,
                kind: vscode.SymbolKind[symbol.kind],
                range: {
                    startLine: symbol.range.start.line + 1,
                    startColumn: symbol.range.start.character + 1,
                    endLine: symbol.range.end.line + 1,
                    endColumn: symbol.range.end.character + 1
                },
                detail: symbol.detail || null
            };

            if (symbol.children && symbol.children.length > 0) {
                result.children = this._formatSymbols(symbol.children);
            }

            return result;
        });
    }
}

module.exports = ContextManager;
