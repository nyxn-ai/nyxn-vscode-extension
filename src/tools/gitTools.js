// Try to require vscode, fallback to global mock for testing
let vscode;
try {
    vscode = require('vscode');
} catch (error) {
    vscode = global.vscode || {
        workspace: {
            workspaceFolders: [{
                uri: {
                    fsPath: process.cwd()
                }
            }]
        }
    };
}
const { exec } = require('child_process');
const util = require('util');
const path = require('path');

// Convert exec to Promise
const execAsync = util.promisify(exec);

/**
 * Git操作工具
 * 提供Git版本控制相关的功能
 */
class GitTools {
    /**
     * 初始化Git工具
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
     * 执行Git命令
     * @param {string} command Git命令
     * @param {string} [cwd] 工作目录
     * @returns {Promise<{stdout: string, stderr: string}>} 命令执行结果
     */
    async executeGitCommand(command, cwd = null) {
        const workingDir = cwd || this.getWorkspaceRoot();
        if (!workingDir) {
            throw new Error('No workspace folder is open');
        }

        try {
            console.log(`Executing git command: ${command} in ${workingDir}`);
            const result = await execAsync(command, { cwd: workingDir });
            return result;
        } catch (error) {
            console.error(`Git command failed: ${command}`, error);
            throw new Error(`Git command failed: ${error.message}`);
        }
    }

    /**
     * 获取Git状态
     * @returns {Promise<Object>} Git状态信息
     */
    async getGitStatus() {
        try {
            const { stdout } = await this.executeGitCommand('git status --porcelain');
            const statusLines = stdout.trim().split('\n').filter(line => line.length > 0);
            
            const files = {
                modified: [],
                added: [],
                deleted: [],
                untracked: [],
                renamed: []
            };

            statusLines.forEach(line => {
                const status = line.substring(0, 2);
                const fileName = line.substring(3);

                if (status.includes('M')) {
                    files.modified.push(fileName);
                } else if (status.includes('A')) {
                    files.added.push(fileName);
                } else if (status.includes('D')) {
                    files.deleted.push(fileName);
                } else if (status.includes('??')) {
                    files.untracked.push(fileName);
                } else if (status.includes('R')) {
                    files.renamed.push(fileName);
                }
            });

            // 获取当前分支
            const { stdout: branchOutput } = await this.executeGitCommand('git branch --show-current');
            const currentBranch = branchOutput.trim();

            return {
                currentBranch,
                files,
                hasChanges: statusLines.length > 0
            };
        } catch (error) {
            throw new Error(`Failed to get git status: ${error.message}`);
        }
    }

    /**
     * 获取提交历史
     * @param {Object} params 参数对象
     * @param {number} [params.limit=10] 限制提交数量
     * @param {string} [params.branch] 指定分支
     * @returns {Promise<Array>} 提交历史列表
     */
    async getCommitHistory(params = {}) {
        try {
            const { limit = 10, branch = '' } = params;
            const branchArg = branch ? ` ${branch}` : '';
            const command = `git log --oneline -n ${limit}${branchArg}`;
            
            const { stdout } = await this.executeGitCommand(command);
            const commits = stdout.trim().split('\n').filter(line => line.length > 0);
            
            return commits.map(commit => {
                const [hash, ...messageParts] = commit.split(' ');
                return {
                    hash,
                    message: messageParts.join(' ')
                };
            });
        } catch (error) {
            throw new Error(`Failed to get commit history: ${error.message}`);
        }
    }

    /**
     * 获取文件差异
     * @param {Object} params 参数对象
     * @param {string} [params.file_path] 文件路径
     * @param {boolean} [params.staged=false] 是否查看暂存区差异
     * @returns {Promise<string>} 差异内容
     */
    async getFileDiff(params = {}) {
        try {
            const { file_path, staged = false } = params;
            let command = 'git diff';
            
            if (staged) {
                command += ' --staged';
            }
            
            if (file_path) {
                command += ` -- "${file_path}"`;
            }
            
            const { stdout } = await this.executeGitCommand(command);
            return stdout || 'No differences found';
        } catch (error) {
            throw new Error(`Failed to get file diff: ${error.message}`);
        }
    }

    /**
     * 获取分支列表
     * @param {Object} params 参数对象
     * @param {boolean} [params.include_remote=false] 是否包含远程分支
     * @returns {Promise<Object>} 分支信息
     */
    async getBranches(params = {}) {
        try {
            const { include_remote = false } = params;
            const command = include_remote ? 'git branch -a' : 'git branch';
            
            const { stdout } = await this.executeGitCommand(command);
            const branchLines = stdout.trim().split('\n').filter(line => line.length > 0);
            
            const branches = {
                current: '',
                local: [],
                remote: []
            };

            branchLines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith('*')) {
                    branches.current = trimmed.substring(2);
                    branches.local.push(trimmed.substring(2));
                } else if (trimmed.startsWith('remotes/')) {
                    branches.remote.push(trimmed.substring(8));
                } else {
                    branches.local.push(trimmed);
                }
            });

            return branches;
        } catch (error) {
            throw new Error(`Failed to get branches: ${error.message}`);
        }
    }

    /**
     * 创建新分支
     * @param {Object} params 参数对象
     * @param {string} params.branch_name 分支名称
     * @param {boolean} [params.checkout=true] 是否切换到新分支
     * @returns {Promise<string>} 操作结果
     */
    async createBranch(params) {
        try {
            const { branch_name, checkout = true } = params;
            
            if (!branch_name) {
                throw new Error('Branch name is required');
            }

            const command = checkout 
                ? `git checkout -b "${branch_name}"`
                : `git branch "${branch_name}"`;
            
            await this.executeGitCommand(command);
            
            return checkout 
                ? `Created and switched to branch '${branch_name}'`
                : `Created branch '${branch_name}'`;
        } catch (error) {
            throw new Error(`Failed to create branch: ${error.message}`);
        }
    }

    /**
     * 切换分支
     * @param {Object} params 参数对象
     * @param {string} params.branch_name 分支名称
     * @returns {Promise<string>} 操作结果
     */
    async checkoutBranch(params) {
        try {
            const { branch_name } = params;
            
            if (!branch_name) {
                throw new Error('Branch name is required');
            }

            await this.executeGitCommand(`git checkout "${branch_name}"`);
            return `Switched to branch '${branch_name}'`;
        } catch (error) {
            throw new Error(`Failed to checkout branch: ${error.message}`);
        }
    }

    /**
     * 删除分支
     * @param {Object} params 参数对象
     * @param {string} params.branch_name 分支名称
     * @param {boolean} [params.force=false] 是否强制删除
     * @returns {Promise<string>} 操作结果
     */
    async deleteBranch(params) {
        try {
            const { branch_name, force = false } = params;
            
            if (!branch_name) {
                throw new Error('Branch name is required');
            }

            const flag = force ? '-D' : '-d';
            await this.executeGitCommand(`git branch ${flag} "${branch_name}"`);
            
            return `Deleted branch '${branch_name}'`;
        } catch (error) {
            throw new Error(`Failed to delete branch: ${error.message}`);
        }
    }

    /**
     * 添加文件到暂存区
     * @param {Object} params 参数对象
     * @param {string|Array} params.files 文件路径或文件路径数组
     * @returns {Promise<string>} 操作结果
     */
    async addFiles(params) {
        try {
            const { files } = params;
            
            if (!files) {
                throw new Error('Files parameter is required');
            }

            let fileArgs;
            if (Array.isArray(files)) {
                fileArgs = files.map(f => `"${f}"`).join(' ');
            } else if (files === '.') {
                fileArgs = '.';
            } else {
                fileArgs = `"${files}"`;
            }

            await this.executeGitCommand(`git add ${fileArgs}`);
            
            const fileCount = Array.isArray(files) ? files.length : (files === '.' ? 'all' : '1');
            return `Added ${fileCount} file(s) to staging area`;
        } catch (error) {
            throw new Error(`Failed to add files: ${error.message}`);
        }
    }

    /**
     * 提交变更
     * @param {Object} params 参数对象
     * @param {string} params.message 提交消息
     * @param {boolean} [params.add_all=false] 是否添加所有变更
     * @returns {Promise<string>} 操作结果
     */
    async commit(params) {
        try {
            const { message, add_all = false } = params;
            
            if (!message) {
                throw new Error('Commit message is required');
            }

            let command = 'git commit';
            if (add_all) {
                command += ' -a';
            }
            command += ` -m "${message}"`;

            const { stdout } = await this.executeGitCommand(command);
            return `Committed successfully: ${message}`;
        } catch (error) {
            throw new Error(`Failed to commit: ${error.message}`);
        }
    }

    /**
     * 推送到远程仓库
     * @param {Object} params 参数对象
     * @param {string} [params.remote='origin'] 远程仓库名称
     * @param {string} [params.branch] 分支名称
     * @returns {Promise<string>} 操作结果
     */
    async push(params = {}) {
        try {
            const { remote = 'origin', branch } = params;
            
            let command = `git push ${remote}`;
            if (branch) {
                command += ` ${branch}`;
            }

            await this.executeGitCommand(command);
            return `Pushed to ${remote}${branch ? ` (${branch})` : ''}`;
        } catch (error) {
            throw new Error(`Failed to push: ${error.message}`);
        }
    }

    /**
     * 从远程仓库拉取
     * @param {Object} params 参数对象
     * @param {string} [params.remote='origin'] 远程仓库名称
     * @param {string} [params.branch] 分支名称
     * @returns {Promise<string>} 操作结果
     */
    async pull(params = {}) {
        try {
            const { remote = 'origin', branch } = params;
            
            let command = `git pull ${remote}`;
            if (branch) {
                command += ` ${branch}`;
            }

            const { stdout } = await this.executeGitCommand(command);
            return stdout || `Pulled from ${remote}${branch ? ` (${branch})` : ''}`;
        } catch (error) {
            throw new Error(`Failed to pull: ${error.message}`);
        }
    }

    /**
     * 注册所有Git工具
     * @param {ToolManager} toolManager 工具管理器
     */
    registerTools(toolManager) {
        // Git状态
        toolManager.registerTool('git-status', this.getGitStatus.bind(this), {
            description: 'Get current Git status including modified, added, deleted files and current branch',
            parameters: {},
            required: []
        });

        // 提交历史
        toolManager.registerTool('git-log', this.getCommitHistory.bind(this), {
            description: 'Get Git commit history',
            parameters: {
                limit: {
                    type: 'number',
                    description: 'Number of commits to retrieve (default: 10)'
                },
                branch: {
                    type: 'string',
                    description: 'Specific branch to get history from'
                }
            },
            required: []
        });

        // 文件差异
        toolManager.registerTool('git-diff', this.getFileDiff.bind(this), {
            description: 'Get file differences',
            parameters: {
                file_path: {
                    type: 'string',
                    description: 'Specific file path to get diff for'
                },
                staged: {
                    type: 'boolean',
                    description: 'Get staged differences (default: false)'
                }
            },
            required: []
        });

        // 分支列表
        toolManager.registerTool('git-branches', this.getBranches.bind(this), {
            description: 'Get list of Git branches',
            parameters: {
                include_remote: {
                    type: 'boolean',
                    description: 'Include remote branches (default: false)'
                }
            },
            required: []
        });

        // 创建分支
        toolManager.registerTool('git-create-branch', this.createBranch.bind(this), {
            description: 'Create a new Git branch',
            parameters: {
                branch_name: {
                    type: 'string',
                    description: 'Name of the new branch'
                },
                checkout: {
                    type: 'boolean',
                    description: 'Switch to the new branch after creation (default: true)'
                }
            },
            required: ['branch_name']
        });

        // 切换分支
        toolManager.registerTool('git-checkout', this.checkoutBranch.bind(this), {
            description: 'Switch to a different Git branch',
            parameters: {
                branch_name: {
                    type: 'string',
                    description: 'Name of the branch to switch to'
                }
            },
            required: ['branch_name']
        });

        // 删除分支
        toolManager.registerTool('git-delete-branch', this.deleteBranch.bind(this), {
            description: 'Delete a Git branch',
            parameters: {
                branch_name: {
                    type: 'string',
                    description: 'Name of the branch to delete'
                },
                force: {
                    type: 'boolean',
                    description: 'Force delete the branch (default: false)'
                }
            },
            required: ['branch_name']
        });

        // 添加文件
        toolManager.registerTool('git-add', this.addFiles.bind(this), {
            description: 'Add files to Git staging area',
            parameters: {
                files: {
                    type: 'string',
                    description: 'File path, array of file paths, or "." for all files'
                }
            },
            required: ['files']
        });

        // 提交
        toolManager.registerTool('git-commit', this.commit.bind(this), {
            description: 'Commit changes to Git repository',
            parameters: {
                message: {
                    type: 'string',
                    description: 'Commit message'
                },
                add_all: {
                    type: 'boolean',
                    description: 'Add all modified files before committing (default: false)'
                }
            },
            required: ['message']
        });

        // 推送
        toolManager.registerTool('git-push', this.push.bind(this), {
            description: 'Push changes to remote Git repository',
            parameters: {
                remote: {
                    type: 'string',
                    description: 'Remote repository name (default: origin)'
                },
                branch: {
                    type: 'string',
                    description: 'Branch name to push'
                }
            },
            required: []
        });

        // 拉取
        toolManager.registerTool('git-pull', this.pull.bind(this), {
            description: 'Pull changes from remote Git repository',
            parameters: {
                remote: {
                    type: 'string',
                    description: 'Remote repository name (default: origin)'
                },
                branch: {
                    type: 'string',
                    description: 'Branch name to pull'
                }
            },
            required: []
        });
    }
}

module.exports = GitTools;
