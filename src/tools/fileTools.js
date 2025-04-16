const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const util = require('util');

// 将 fs 函数转换为 Promise
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

/**
 * 文件操作工具集
 * 提供读取、写入、搜索文件等功能
 */
class FileTools {
    /**
     * 初始化文件工具
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
     * 解析文件路径
     * @param {string} filePath 文件路径
     * @returns {string} 完整文件路径
     */
    resolvePath(filePath) {
        // 如果是相对路径，则相对于工作区根目录
        if (!path.isAbsolute(filePath)) {
            const workspaceRoot = this.getWorkspaceRoot();
            if (workspaceRoot) {
                return path.join(workspaceRoot, filePath);
            }
        }
        return filePath;
    }

    /**
     * 读取文件内容
     * @param {Object} params 参数对象
     * @param {string} params.file_path 文件路径
     * @returns {Promise<string>} 文件内容
     */
    async readFile(params) {
        try {
            const { file_path } = params;
            const fullPath = this.resolvePath(file_path);
            
            // 检查文件是否存在
            await stat(fullPath);
            
            // 读取文件内容
            const content = await readFile(fullPath, 'utf8');
            return content;
        } catch (error) {
            throw new Error(`Failed to read file: ${error.message}`);
        }
    }

    /**
     * 写入文件内容
     * @param {Object} params 参数对象
     * @param {string} params.file_path 文件路径
     * @param {string} params.content 文件内容
     * @returns {Promise<string>} 成功消息
     */
    async writeFile(params) {
        try {
            const { file_path, content } = params;
            const fullPath = this.resolvePath(file_path);
            
            // 写入文件内容
            await writeFile(fullPath, content, 'utf8');
            return `File successfully written: ${file_path}`;
        } catch (error) {
            throw new Error(`Failed to write file: ${error.message}`);
        }
    }

    /**
     * 列出目录内容
     * @param {Object} params 参数对象
     * @param {string} params.directory_path 目录路径
     * @returns {Promise<Array>} 目录内容列表
     */
    async listDirectory(params) {
        try {
            const { directory_path } = params;
            const fullPath = this.resolvePath(directory_path);
            
            // 检查目录是否存在
            const stats = await stat(fullPath);
            if (!stats.isDirectory()) {
                throw new Error(`Not a directory: ${directory_path}`);
            }
            
            // 读取目录内容
            const items = await readdir(fullPath);
            
            // 获取每个项目的详细信息
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
     * 搜索文件
     * @param {Object} params 参数对象
     * @param {string} params.pattern 搜索模式
     * @param {string} [params.directory_path] 目录路径
     * @param {boolean} [params.include_hidden=false] 是否包含隐藏文件
     * @returns {Promise<Array>} 匹配的文件列表
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
            
            // 使用 VS Code API 搜索文件
            const files = await vscode.workspace.findFiles(
                pattern,
                include_hidden ? undefined : '**/node_modules/**,**/.git/**'
            );
            
            // 过滤结果，只包含指定目录下的文件
            const filteredFiles = files.filter(file => 
                file.fsPath.startsWith(rootPath)
            );
            
            // 格式化结果
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
     * 获取当前打开的文件
     * @returns {Promise<Object>} 当前文件信息
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
     * 注册所有文件工具
     * @param {ToolManager} toolManager 工具管理器
     */
    registerTools(toolManager) {
        // 读取文件
        toolManager.registerTool('read-file', this.readFile.bind(this), {
            description: '读取文件内容',
            parameters: {
                file_path: {
                    type: 'string',
                    description: '文件路径，可以是相对于工作区根目录的路径'
                }
            },
            required: ['file_path']
        });
        
        // 写入文件
        toolManager.registerTool('write-file', this.writeFile.bind(this), {
            description: '写入文件内容',
            parameters: {
                file_path: {
                    type: 'string',
                    description: '文件路径，可以是相对于工作区根目录的路径'
                },
                content: {
                    type: 'string',
                    description: '要写入的文件内容'
                }
            },
            required: ['file_path', 'content']
        });
        
        // 列出目录
        toolManager.registerTool('list-directory', this.listDirectory.bind(this), {
            description: '列出目录内容',
            parameters: {
                directory_path: {
                    type: 'string',
                    description: '目录路径，可以是相对于工作区根目录的路径'
                }
            },
            required: ['directory_path']
        });
        
        // 搜索文件
        toolManager.registerTool('search-files', this.searchFiles.bind(this), {
            description: '搜索文件',
            parameters: {
                pattern: {
                    type: 'string',
                    description: '搜索模式，例如 "**/*.js"'
                },
                directory_path: {
                    type: 'string',
                    description: '目录路径，可以是相对于工作区根目录的路径'
                },
                include_hidden: {
                    type: 'boolean',
                    description: '是否包含隐藏文件'
                }
            },
            required: ['pattern']
        });
        
        // 获取当前文件
        toolManager.registerTool('get-current-file', this.getCurrentFile.bind(this), {
            description: '获取当前打开的文件',
            parameters: {},
            required: []
        });
    }
}

module.exports = FileTools;
