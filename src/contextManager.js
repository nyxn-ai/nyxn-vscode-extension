const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const util = require('util');

// Convert fs functions to Promises
const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

/**
 * 上下文管理器
 * 负责收集和管理代码上下文
 */
class ContextManager {
    /**
     * 初始化上下文管理器
     * @param {vscode.ExtensionContext} context Extension context
     */
    constructor(context) {
        this.context = context;
        this.cachedContext = null;
        this.lastUpdateTime = null;
        this.cacheValidityTime = 5 * 60 * 1000; // 5 minutes cache validity period
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
     * 获取当前文件上下文
     * @returns {Promise<Object|null>} 当前文件上下文
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

            // 基本文件信息
            const fileContext = {
                fileName: path.basename(document.fileName),
                filePath: workspaceRoot
                    ? path.relative(workspaceRoot, document.fileName)
                    : document.fileName,
                language: document.languageId,
                lineCount: document.lineCount
            };

            // 选中的文本
            if (!selection.isEmpty) {
                fileContext.selection = {
                    text: document.getText(selection),
                    startLine: selection.start.line + 1,
                    startColumn: selection.start.character + 1,
                    endLine: selection.end.line + 1,
                    endColumn: selection.end.character + 1
                };
            }

            // 文件内容
            fileContext.content = document.getText();

            // 获取文件符号
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
     * 获取项目结构上下文
     * @param {number} [maxDepth=3] 最大深度
     * @param {number} [maxFiles=100] 最大文件数
     * @returns {Promise<Object|null>} 项目结构上下文
     */
    async getProjectStructureContext(maxDepth = 3, maxFiles = 100) {
        try {
            const workspaceRoot = this.getWorkspaceRoot();
            if (!workspaceRoot) {
                return null;
            }

            // 检查缓存是否有效
            const now = Date.now();
            if (
                this.cachedContext &&
                this.lastUpdateTime &&
                (now - this.lastUpdateTime) < this.cacheValidityTime
            ) {
                return this.cachedContext;
            }

            // 递归获取目录结构
            let fileCount = 0;
            const structure = await this._getDirectoryStructure(
                workspaceRoot,
                workspaceRoot,
                0,
                maxDepth,
                maxFiles,
                fileCount
            );

            // 获取项目信息
            const projectContext = {
                name: path.basename(workspaceRoot),
                root: workspaceRoot,
                structure
            };

            // 尝试获取 package.json
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
                // package.json 可能不存在，忽略错误
            }

            // 缓存结果
            this.cachedContext = projectContext;
            this.lastUpdateTime = now;

            return projectContext;
        } catch (error) {
            console.error('Error getting project structure context:', error);
            return null;
        }
    }

    /**
     * 获取相关文件上下文
     * @param {string} filePath 文件路径
     * @param {number} [maxFiles=5] 最大文件数
     * @returns {Promise<Array>} 相关文件上下文
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

            // 获取文件扩展名和基本名称
            const ext = path.extname(filePath);
            const baseName = path.basename(filePath, ext);
            const dirName = path.dirname(filePath);

            // 查找相关文件
            const relatedFiles = [];

            // 1. 同目录下的同名不同扩展名文件
            const dirEntries = await readdir(dirName);
            for (const entry of dirEntries) {
                const entryPath = path.join(dirName, entry);
                const entryStat = await stat(entryPath);

                if (entryStat.isFile() && entry.startsWith(baseName) && entryPath !== filePath) {
                    relatedFiles.push(entryPath);
                }
            }

            // 2. 使用 VS Code API 查找引用该文件的文件
            // 这需要打开文件并使用符号提供程序
            try {
                const uri = vscode.Uri.file(filePath);
                const document = await vscode.workspace.openTextDocument(uri);

                // 获取文档中的所有符号
                const symbols = await vscode.commands.executeCommand(
                    'vscode.executeDocumentSymbolProvider',
                    uri
                );

                if (symbols && symbols.length > 0) {
                    // 对于每个符号，查找引用
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

            // 读取相关文件内容
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
     * 获取完整上下文
     * @returns {Promise<Object>} 完整上下文
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
     * 递归获取目录结构
     * @param {string} rootPath 根路径
     * @param {string} dirPath 目录路径
     * @param {number} depth 当前深度
     * @param {number} maxDepth 最大深度
     * @param {number} maxFiles 最大文件数
     * @param {number} fileCount 当前文件计数
     * @returns {Promise<Array>} 目录结构
     * @private
     */
    async _getDirectoryStructure(rootPath, dirPath, depth, maxDepth, maxFiles, fileCount) {
        if (depth > maxDepth || fileCount >= maxFiles) {
            return [];
        }

        try {
            const entries = await readdir(dirPath);
            const result = [];

            // 排除隐藏文件和常见的忽略目录
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
                    // 递归处理子目录
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
                    // 处理文件
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
     * 格式化符号
     * @param {Array} symbols 符号列表
     * @returns {Array} 格式化后的符号列表
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
