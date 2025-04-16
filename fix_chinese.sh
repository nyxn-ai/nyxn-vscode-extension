#!/bin/bash

# Fix contextManager.js
sed -i 's/\/\/ 将 fs 函数转换为 Promise/\/\/ Convert fs functions to Promises/g' src/contextManager.js
sed -i 's/@param {vscode.ExtensionContext} context 扩展上下文/@param {vscode.ExtensionContext} context Extension context/g' src/contextManager.js
sed -i 's/this.cacheValidityTime = 5 \* 60 \* 1000; \/\/ 5分钟缓存有效期/this.cacheValidityTime = 5 \* 60 \* 1000; \/\/ 5 minutes cache validity period/g' src/contextManager.js
sed -i 's/@returns {string|null} 工作区根路径/@returns {string|null} Workspace root path/g' src/contextManager.js
sed -i 's/@returns {Promise<Object|null>} 当前文件上下文/@returns {Promise<Object|null>} Current file context/g' src/contextManager.js
sed -i 's/@param {number} \[maxDepth=3\] 最大深度/@param {number} \[maxDepth=3\] Maximum depth/g' src/contextManager.js
sed -i 's/@param {number} \[maxFiles=100\] 最大文件数/@param {number} \[maxFiles=100\] Maximum number of files/g' src/contextManager.js
sed -i 's/@returns {Promise<Object|null>} 项目结构上下文/@returns {Promise<Object|null>} Project structure context/g' src/contextManager.js
sed -i 's/\/\/ 尝试获取 package.json/\/\/ Try to get package.json/g' src/contextManager.js
sed -i 's/\/\/ package.json 可能不存在，忽略错误/\/\/ package.json may not exist, ignore error/g' src/contextManager.js
sed -i 's/@param {string} filePath 文件路径/@param {string} filePath File path/g' src/contextManager.js
sed -i 's/@param {number} \[maxFiles=5\] 最大文件数/@param {number} \[maxFiles=5\] Maximum number of files/g' src/contextManager.js
sed -i 's/@returns {Promise<Array>} 相关文件上下文/@returns {Promise<Array>} Related files context/g' src/contextManager.js
sed -i 's/\/\/ 1. 同目录下的同名不同扩展名文件/\/\/ 1. Files with the same name but different extensions in the same directory/g' src/contextManager.js
sed -i 's/\/\/ 2. 使用 VS Code API 查找引用该文件的文件/\/\/ 2. Use VS Code API to find files that reference this file/g' src/contextManager.js

# Make the script executable
chmod +x fix_chinese.sh
