// @ts-nocheck
(function () {
    // 获取VS Code API
    const vscode = acquireVsCodeApi();

    // 获取DOM元素
    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const clearButton = document.getElementById('clear-button');
    const contextButton = document.getElementById('context-button');
    const toolResults = document.getElementById('tool-results');
    const toolContent = document.getElementById('tool-content');
    const closeToolResults = document.getElementById('close-tool-results');

    // 初始化
    let isLoading = false;

    // Send消息
    function sendMessage() {
        const text = userInput.value.trim();
        if (text && !isLoading) {
            vscode.postMessage({
                command: 'sendMessage',
                text: text
            });
            userInput.value = '';
        }
    }

    // 监听Send按钮点击
    sendButton.addEventListener('click', sendMessage);

    // 监听Enter键
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Clear History
    clearButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all chat history？')) {
            vscode.postMessage({
                command: 'clearHistory'
            });
        }
    });

    // Get Context
    contextButton.addEventListener('click', () => {
        vscode.postMessage({
            command: 'getFullContext'
        });

        // 显示加载状态
        contextButton.disabled = true;
        contextButton.textContent = 'Loading...';

        // 5秒后恢复按钮状态
        setTimeout(() => {
            contextButton.disabled = false;
            contextButton.textContent = 'Get Context';
        }, 5000);
    });

    // CloseToolResult
    closeToolResults.addEventListener('click', () => {
        toolResults.classList.add('hidden');
    });

    // 处理Tool调用
    function handleToolCall(toolCallElement) {
        const toolCallButtons = toolCallElement.querySelectorAll('.tool-call-button');

        toolCallButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const toolName = button.dataset.tool;
                const parametersStr = button.dataset.parameters;
                let parameters = {};

                try {
                    parameters = JSON.parse(parametersStr);
                } catch (error) {
                    console.error('Error parsing tool parameters:', error);
                }

                // 禁用按钮并显示加载状态
                button.disabled = true;
                button.textContent = 'Executing...';

                // SendToolExecute请求
                vscode.postMessage({
                    command: 'executeTool',
                    toolName,
                    parameters
                });
            });
        });
    }

    // 处理Markdown
    function processMarkdown(text) {
        // 处理Tool调用
        const toolCallRegex = /<tool>\s*<name>(.*?)<\/name>\s*<parameters>([\s\S]*?)<\/parameters>\s*<\/tool>/g;
        let processedText = text.replace(toolCallRegex, (match, toolName, parametersContent) => {
            // 解析Param
            const paramRegex = /<param\s+name="([^"]+)">([\s\S]*?)<\/param>/g;
            let paramMatch;
            const params = {};
            let paramHtml = '';

            while ((paramMatch = paramRegex.exec(parametersContent)) !== null) {
                const paramName = paramMatch[1];
                const paramValue = paramMatch[2].trim();
                params[paramName] = paramValue;
                paramHtml += `<div class="tool-param"><span class="param-name">${escapeHtml(paramName)}</span>: <span class="param-value">${escapeHtml(paramValue)}</span></div>`;
            }

            // 将Param序列化为JSON字符串
            const paramsJson = JSON.stringify(params);

            return `<div class="tool-call">
                <div class="tool-call-header">
                    <span class="tool-name">Tool: ${escapeHtml(toolName)}</span>
                    <button class="tool-call-button" data-tool="${escapeHtml(toolName)}" data-parameters='${escapeHtml(paramsJson)}'>Execute</button>
                </div>
                <div class="tool-call-params">
                    ${paramHtml}
                </div>
            </div>`;
        });

        // 处理ToolResult
        const toolResultRegex = /<tool-result\s+name="([^"]+)">\s*([\s\S]*?)\s*<\/tool-result>/g;
        processedText = processedText.replace(toolResultRegex, (match, toolName, resultContent) => {
            return `<div class="tool-result">
                <div class="tool-result-header">
                    <span class="tool-name">ToolResult: ${escapeHtml(toolName)}</span>
                </div>
                <div class="tool-result-content">
                    <pre>${escapeHtml(resultContent)}</pre>
                </div>
            </div>`;
        });

        // 处理ToolError
        const toolErrorRegex = /<tool-error\s+name="([^"]+)">\s*([\s\S]*?)\s*<\/tool-error>/g;
        processedText = processedText.replace(toolErrorRegex, (match, toolName, errorContent) => {
            return `<div class="tool-error">
                <div class="tool-error-header">
                    <span class="tool-name">ToolError: ${escapeHtml(toolName)}</span>
                </div>
                <div class="tool-error-content">
                    <pre>${escapeHtml(errorContent)}</pre>
                </div>
            </div>`;
        });

        // 转换Markdown代码块为HTML
        const codeBlockRegex = /```([\w-]*)\n([\s\S]*?)```/g;
        processedText = processedText.replace(codeBlockRegex, (match, language, code) => {
            return `<div class="code-block">
                <div class="code-header">
                    <span class="code-language">${language || 'code'}</span>
                    <button class="copy-button">Copy</button>
                    <button class="insert-button">Insert to Editor</button>
                </div>
                <pre><code class="${language}">${escapeHtml(code)}</code></pre>
            </div>`;
        });

        // 处理普通文本段落
        processedText = processedText.replace(/(?:\r\n|\r|\n)/g, '<br>');

        return processedText;
    }

    // HTML转义
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // 更新聊天界面
    function updateChat(history) {
        chatContainer.innerHTML = '';

        history.forEach(message => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${message.role}`;

            const contentDiv = document.createElement('div');
            contentDiv.className = 'content';

            if (message.role === 'assistant') {
                contentDiv.innerHTML = processMarkdown(message.content);

                // 添加代码块事件监听器
                setTimeout(() => {
                    // 代码块按钮
                    const copyButtons = messageDiv.querySelectorAll('.copy-button');
                    const insertButtons = messageDiv.querySelectorAll('.insert-button');

                    copyButtons.forEach(button => {
                        button.addEventListener('click', (e) => {
                            const codeBlock = e.target.closest('.code-block');
                            const code = codeBlock.querySelector('code').textContent;
                            navigator.clipboard.writeText(code);
                            button.textContent = 'Copied';
                            setTimeout(() => {
                                button.textContent = 'Copy';
                            }, 2000);
                        });
                    });

                    insertButtons.forEach(button => {
                        button.addEventListener('click', (e) => {
                            const codeBlock = e.target.closest('.code-block');
                            const code = codeBlock.querySelector('code').textContent;
                            vscode.postMessage({
                                command: 'insertCode',
                                code: code
                            });
                        });
                    });

                    // Tool调用按钮
                    handleToolCall(messageDiv);
                }, 0);
            } else {
                contentDiv.textContent = message.content;
            }

            messageDiv.appendChild(contentDiv);
            chatContainer.appendChild(messageDiv);
        });

        // 滚动到底部
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // 显示ToolResult
    function showToolResults(results) {
        toolContent.innerHTML = '';

        results.forEach(result => {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'tool-execution-result';

            // Tool名称和Param
            const headerDiv = document.createElement('div');
            headerDiv.className = 'tool-execution-header';
            headerDiv.innerHTML = `<strong>Tool:</strong> ${escapeHtml(result.name)}`;
            resultDiv.appendChild(headerDiv);

            // Param
            if (result.parameters) {
                const paramsDiv = document.createElement('div');
                paramsDiv.className = 'tool-execution-params';
                paramsDiv.innerHTML = '<strong>Param:</strong>';

                const paramsList = document.createElement('ul');
                for (const [key, value] of Object.entries(result.parameters)) {
                    const paramItem = document.createElement('li');
                    paramItem.innerHTML = `<span class="param-name">${escapeHtml(key)}</span>: <span class="param-value">${escapeHtml(String(value))}</span>`;
                    paramsList.appendChild(paramItem);
                }

                paramsDiv.appendChild(paramsList);
                resultDiv.appendChild(paramsDiv);
            }

            // Result或Error
            const contentDiv = document.createElement('div');
            contentDiv.className = result.error ? 'tool-execution-error' : 'tool-execution-content';

            if (result.error) {
                contentDiv.innerHTML = `<strong>Error:</strong> <pre>${escapeHtml(result.error)}</pre>`;
            } else {
                contentDiv.innerHTML = `<strong>Result:</strong> <pre>${escapeHtml(typeof result.result === 'object' ? JSON.stringify(result.result, null, 2) : String(result.result))}</pre>`;
            }

            resultDiv.appendChild(contentDiv);
            toolContent.appendChild(resultDiv);
        });

        // 显示ToolResult面板
        toolResults.classList.remove('hidden');
    }

    // 显示加载状态
    function showLoading() {
        isLoading = true;
        sendButton.disabled = true;
        sendButton.textContent = 'Thinking...';

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message assistant loading';
        loadingDiv.innerHTML = '<div class="loading-indicator"><div></div><div></div><div></div></div>';
        chatContainer.appendChild(loadingDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // 隐藏加载状态
    function hideLoading() {
        isLoading = false;
        sendButton.disabled = false;
        sendButton.textContent = 'Send';

        const loadingDiv = chatContainer.querySelector('.loading');
        if (loadingDiv) {
            chatContainer.removeChild(loadingDiv);
        }
    }

    // 显示Error消息
    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;

        chatContainer.appendChild(errorDiv);

        // 3秒后自动移除
        setTimeout(() => {
            chatContainer.removeChild(errorDiv);
        }, 3000);
    }

    // 监听来自扩展的消息
    window.addEventListener('message', event => {
        const message = event.data;

        switch (message.command) {
            case 'updateChat':
                updateChat(message.history);
                break;

            case 'startLoading':
                showLoading();
                break;

            case 'stopLoading':
                hideLoading();
                break;

            case 'toolResults':
                showToolResults(message.results);
                break;

            case 'toolResult':
                // 单个ToolExecuteResult
                showToolResults([{
                    name: message.toolName,
                    parameters: message.parameters,
                    result: message.result
                }]);
                break;

            case 'error':
                showError(message.message);
                break;

            case 'fullContext':
                // 显示上下文信息
                console.log('Full context:', message.context);
                // 可以在这里添加显示上下文的UI
                break;
        }
    });

    // 请求代码上下文
    vscode.postMessage({
        command: 'getCodeContext'
    });
});
