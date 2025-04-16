// @ts-nocheck
(function () {
    // Get VS Code API
    const vscode = acquireVsCodeApi();

    // Get DOM elements
    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const sendButtonBackup = document.getElementById('send-button-backup');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const clearButton = document.getElementById('clear-button');
    const contextButton = document.getElementById('context-button');
    const toolResults = document.getElementById('tool-results');
    const toolContent = document.getElementById('tool-content');
    const closeToolResults = document.getElementById('close-tool-results');

    console.log('DOM elements loaded:');
    console.log('- chatContainer:', !!chatContainer);
    console.log('- userInput:', !!userInput);
    console.log('- sendButton:', !!sendButton);
    console.log('- sendButtonBackup:', !!sendButtonBackup);
    console.log('- messageForm:', !!messageForm);
    console.log('- clearButton:', !!clearButton);

    // Initialize
    let isLoading = false;

    // Send message
    function sendMessage() {
        console.log('Send button clicked');
        const text = userInput.value.trim();
        console.log('User input text:', text);
        console.log('isLoading state:', isLoading);

        if (text && !isLoading) {
            try {
                console.log('Sending message to extension...');
                // Debug: Check if vscode API is available
                console.log('vscode API available:', !!vscode);

                vscode.postMessage({
                    command: 'sendMessage',
                    text: text
                });
                console.log('Message posted to extension');

                userInput.value = '';
                // Show visual feedback for successful send
                sendButton.textContent = 'Sent';
                setTimeout(() => {
                    sendButton.textContent = 'Send';
                }, 1000);
            } catch (error) {
                console.error('Error sending message:', error);
                showError(`Error sending message: ${error.message}`);
            }
        } else if (isLoading) {
            console.log('Cannot send: loading in progress');
            showError('Loading in progress, please try again later');
        } else {
            console.log('Cannot send: empty message');
            showError('Please enter a message');
        }
    }

    // Listen for Send button click
    console.log('Adding click event listener to send button');
    console.log('Send button element:', sendButton);

    // Try different ways to add the event listener
    sendButton.addEventListener('click', function(event) {
        console.log('Send button clicked (from event listener)');
        console.log('Event details:', event.type);
        sendMessage();
    });

    // Also add mousedown event as a fallback
    sendButton.addEventListener('mousedown', function(event) {
        console.log('Send button mousedown event detected');
        sendMessage();
    });

    // Add event listeners to backup button
    if (sendButtonBackup) {
        console.log('Adding event listeners to backup button');
        sendButtonBackup.addEventListener('click', function(event) {
            console.log('Backup send button clicked');
            sendMessage();
        });

        sendButtonBackup.addEventListener('mousedown', function(event) {
            console.log('Backup send button mousedown detected');
            sendMessage();
        });
    } else {
        console.error('Backup send button not found');
    }

    // Add form submit event listener
    if (messageForm) {
        console.log('Adding submit event listener to form');
        messageForm.style.display = 'block'; // Make form visible for testing

        messageForm.addEventListener('submit', function(event) {
            event.preventDefault();
            console.log('Form submitted');

            const text = messageInput.value.trim();
            if (text) {
                console.log('Sending message from form:', text);
                vscode.postMessage({
                    command: 'sendMessage',
                    text: text
                });
                messageInput.value = '';
            }
        });
    }

    // Listen for Enter key
    userInput.addEventListener('keydown', (e) => {
        console.log('Key pressed:', e.key);
        if (e.key === 'Enter' && !e.shiftKey) {
            console.log('Enter key pressed (without shift)');
            e.preventDefault();
            sendMessage();
        }
    });

    // Clear History
    clearButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all chat history?')) {
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

        // Show loading state
        contextButton.disabled = true;
        contextButton.textContent = 'Loading...';

        // Restore button state after 5 seconds
        setTimeout(() => {
            contextButton.disabled = false;
            contextButton.textContent = 'Get Context';
        }, 5000);
    });

    // Close tool results
    closeToolResults.addEventListener('click', () => {
        toolResults.classList.add('hidden');
    });

    // Handle tool call
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

                // Disable button and show loading state
                button.disabled = true;
                button.textContent = 'Executing...';

                // Send tool execute request
                vscode.postMessage({
                    command: 'executeTool',
                    toolName,
                    parameters
                });
            });
        });
    }

    // Process markdown
    function processMarkdown(text) {
        // Process tool calls
        const toolCallRegex = /<tool>\s*<name>(.*?)<\/name>\s*<parameters>([\s\S]*?)<\/parameters>\s*<\/tool>/g;
        let processedText = text.replace(toolCallRegex, (match, toolName, parametersContent) => {
            // Parse parameters
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

            // Serialize parameters to JSON string
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

        // Process tool results
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

        // Process tool errors
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

        // Convert markdown code blocks to HTML
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

        // Process regular text paragraphs
        processedText = processedText.replace(/(?:\r\n|\r|\n)/g, '<br>');

        return processedText;
    }

    // HTML escape
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Update chat interface
    function updateChat(history) {
        chatContainer.innerHTML = '';

        history.forEach(message => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${message.role}`;

            const contentDiv = document.createElement('div');
            contentDiv.className = 'content';

            if (message.role === 'assistant') {
                contentDiv.innerHTML = processMarkdown(message.content);

                // Add code block event listeners
                setTimeout(() => {
                    // Code block buttons
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

                    // Tool call buttons
                    handleToolCall(messageDiv);
                }, 0);
            } else {
                contentDiv.textContent = message.content;
            }

            messageDiv.appendChild(contentDiv);
            chatContainer.appendChild(messageDiv);
        });

        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Show tool results
    function showToolResults(results) {
        toolContent.innerHTML = '';

        results.forEach(result => {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'tool-execution-result';

            // Tool name and parameters
            const headerDiv = document.createElement('div');
            headerDiv.className = 'tool-execution-header';
            headerDiv.innerHTML = `<strong>Tool:</strong> ${escapeHtml(result.name)}`;
            resultDiv.appendChild(headerDiv);

            // Parameters
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

            // Result or Error
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

        // Show tool results panel
        toolResults.classList.remove('hidden');
    }

    // Show loading state
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

    // Hide loading state
    function hideLoading() {
        isLoading = false;
        sendButton.disabled = false;
        sendButton.textContent = 'Send';

        const loadingDiv = chatContainer.querySelector('.loading');
        if (loadingDiv) {
            chatContainer.removeChild(loadingDiv);
        }
    }

    // Show error message
    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;

        chatContainer.appendChild(errorDiv);

        // Auto remove after 3 seconds
        setTimeout(() => {
            chatContainer.removeChild(errorDiv);
        }, 3000);
    }

    // Listen for messages from extension
    window.addEventListener('message', event => {
        try {
            const message = event.data;
            console.log(`Received message from extension: ${message.command}`);

            switch (message.command) {
                case 'updateChat':
                    if (message.history) {
                        console.log(`Updating chat history, message count: ${message.history.length}`);
                        updateChat(message.history);
                    } else {
                        console.error('Failed to update chat history: no history data');
                    }
                    break;

                case 'startLoading':
                    console.log('Showing loading state');
                    showLoading();
                    break;

                case 'stopLoading':
                    console.log('Hiding loading state');
                    hideLoading();
                    break;

                case 'toolResults':
                    if (message.results) {
                        console.log(`Showing tool results, count: ${message.results.length}`);
                        showToolResults(message.results);
                    }
                    break;

                case 'toolResult':
                    // Single tool execution result
                    console.log(`Showing single tool result: ${message.toolName}`);
                    showToolResults([{
                        name: message.toolName,
                        parameters: message.parameters,
                        result: message.result
                    }]);
                    break;

                case 'error':
                    console.error(`Received error message: ${message.message}`);
                    showError(message.message);
                    break;

                case 'fullContext':
                    // Show context information
                    console.log('Received full context information');
                    // Can add UI for displaying context here
                    break;

                default:
                    console.log(`Received unknown command: ${message.command}`);
            }
        } catch (error) {
            console.error('Error processing message:', error);
            showError(`Error processing message: ${error.message}`);
        }
    });

    // Request code context
    vscode.postMessage({
        command: 'getCodeContext'
    });

    // Global error handler
    window.onerror = function(message, source, lineno, colno, error) {
        console.error('Global error caught:', message);
        console.error('Error details:', error);
        showError(`Error: ${message}`);
        return true; // Prevents the default error handling
    };

    // Add a direct test button to the DOM
    const testButton = document.createElement('button');
    testButton.textContent = 'Test Direct Send';
    testButton.style.position = 'fixed';
    testButton.style.bottom = '10px';
    testButton.style.left = '10px';
    testButton.style.zIndex = '1000';
    testButton.onclick = function() {
        console.log('Test button clicked');
        vscode.postMessage({
            command: 'sendMessage',
            text: 'This is a test message from the direct test button'
        });
    };
    document.body.appendChild(testButton);
});
