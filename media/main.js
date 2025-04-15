// @ts-nocheck
(function () {
    // Get VS Code API
    const vscode = acquireVsCodeApi();
    
    // Get DOM elements
    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    
    // Initialize
    let isLoading = false;
    
    // Send message
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
    
    // Listen for send button click
    sendButton.addEventListener('click', sendMessage);
    
    // Listen for Enter key
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Process code blocks
    function processMarkdown(text) {
        // Convert Markdown code blocks to HTML
        const codeBlockRegex = /```([\w-]*)\n([\s\S]*?)```/g;
        let processedText = text.replace(codeBlockRegex, (match, language, code) => {
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
                
                // Add event listeners for code blocks
                setTimeout(() => {
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
    
    // Listen for messages from extension
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
        }
    });
    
    // Request code context
    vscode.postMessage({
        command: 'getCodeContext'
    });
})();
