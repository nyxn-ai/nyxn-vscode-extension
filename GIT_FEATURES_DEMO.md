# Git集成功能演示

Nyxn AI Assistant现在支持完整的Git版本控制操作！以下是一些使用示例：

## 基础Git操作

### 1. 检查Git状态
```
请检查当前Git仓库的状态
```
AI会使用 `git-status` 工具显示：
- 当前分支
- 修改的文件
- 新增的文件
- 删除的文件
- 未跟踪的文件

### 2. 查看分支列表
```
显示所有Git分支
```
AI会使用 `git-branches` 工具显示：
- 当前分支
- 本地分支列表
- 远程分支列表（如果指定）

### 3. 查看提交历史
```
显示最近5次提交记录
```
AI会使用 `git-log` 工具显示提交历史。

## 分支管理

### 4. 创建新分支
```
创建一个名为 'feature/new-login' 的新分支并切换到该分支
```
AI会使用 `git-create-branch` 工具创建并切换分支。

### 5. 切换分支
```
切换到 main 分支
```
AI会使用 `git-checkout` 工具切换分支。

### 6. 删除分支
```
删除 'feature/old-feature' 分支
```
AI会使用 `git-delete-branch` 工具删除指定分支。

## 提交和推送

### 7. 添加文件到暂存区
```
将所有修改的文件添加到Git暂存区
```
AI会使用 `git-add` 工具添加文件。

### 8. 提交变更
```
提交所有暂存的变更，提交消息为 "Add Git integration features"
```
AI会使用 `git-commit` 工具提交变更。

### 9. 推送到远程仓库
```
将当前分支推送到origin远程仓库
```
AI会使用 `git-push` 工具推送代码。

### 10. 从远程仓库拉取
```
从origin远程仓库拉取最新代码
```
AI会使用 `git-pull` 工具拉取代码。

## 高级操作

### 11. 查看文件差异
```
显示当前工作目录中所有文件的差异
```
或者查看特定文件：
```
显示 src/webviewProvider.js 文件的差异
```
AI会使用 `git-diff` 工具显示差异。

### 12. 查看暂存区差异
```
显示暂存区中的文件差异
```
AI会使用 `git-diff` 工具的 `staged` 参数。

## 组合操作示例

### 13. 完整的功能开发流程
```
我想开发一个新功能，请帮我：
1. 创建一个名为 'feature/user-profile' 的新分支
2. 检查当前状态
3. 完成开发后，添加所有文件到暂存区
4. 提交变更，消息为 "Add user profile feature"
5. 推送到远程仓库
```

### 14. 代码审查准备
```
我需要准备代码审查，请帮我：
1. 检查当前Git状态
2. 显示与main分支的差异
3. 显示最近3次提交记录
```

## 工具参数说明

所有Git工具都支持相应的参数：

- `git-status`: 无参数
- `git-branches`: `include_remote` (布尔值)
- `git-log`: `limit` (数字), `branch` (字符串)
- `git-diff`: `file_path` (字符串), `staged` (布尔值)
- `git-create-branch`: `branch_name` (必需), `checkout` (布尔值)
- `git-checkout`: `branch_name` (必需)
- `git-delete-branch`: `branch_name` (必需), `force` (布尔值)
- `git-add`: `files` (字符串或数组，必需)
- `git-commit`: `message` (必需), `add_all` (布尔值)
- `git-push`: `remote` (字符串), `branch` (字符串)
- `git-pull`: `remote` (字符串), `branch` (字符串)

## 注意事项

1. 确保您的项目是一个Git仓库
2. 某些操作需要适当的Git权限
3. 推送和拉取操作需要配置远程仓库
4. AI会自动处理错误并提供有用的错误信息

现在您可以通过自然语言与AI交互来执行所有这些Git操作！
