const vscode = require('vscode');
const path = require('path');
const GeminiService = require('./geminiService');
const ToolManager = require('./tools/toolManager');
const FileTools = require('./tools/fileTools');
const CodeSearchTools = require('./tools/codeSearchTools');
const DiagnosticsTools = require('./tools/diagnosticsTools');
const ContextManager = require('./contextManager');

/**
 * Nyxn Webview Provider
 * Handles UI and user interaction
 */
class NyxnWebviewProvider {
    /**
     * @implements {vscode.WebviewViewProvider}
     */
    /**
     * Initialize Webview Provider
     * @param {vscode.ExtensionContext} context Extension context
     */
    constructor(context) {
        console.log('Initializing NyxnWebviewProvider...');
        this.context = context;

        // Initialize tool manager
        console.log('Creating ToolManager...');
        this.toolManager = new ToolManager();

        // Initialize context manager
        console.log('Creating ContextManager...');
        this.contextManager = new ContextManager(context);

        // Initialize tools
        console.log('Initializing tools...');
        this.initializeTools();

        // Initialize Gemini service
        console.log('Creating GeminiService...');
        this.geminiService = new GeminiService(this.toolManager, this.contextManager);

        this._view = null;
        this.chatHistory = [];
        console.log('NyxnWebviewProvider initialized successfully');
    }

    /**
     * Initialize tools
     */
    initializeTools() {
        // File tools
        const fileTools = new FileTools(this.context);
        fileTools.registerTools(this.toolManager);

        // Code search tools
        const codeSearchTools = new CodeSearchTools(this.context);
        codeSearchTools.registerTools(this.toolManager);

        // Diagnostics tools
        const diagnosticsTools = new DiagnosticsTools(this.context);
        diagnosticsTools.registerTools(this.toolManager);
    }

    resolveWebviewView(webviewView) {
        console.log('Resolving webview view...');
        this._view = webviewView;

        console.log('Setting webview options...');
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
            ]
        };

        // Set HTML content
        console.log('Setting HTML content...');
        const html = this._getHtmlForWebview(webviewView.webview);
        console.log(`Generated HTML content (length: ${html.length})`);
        webviewView.webview.html = html;
        console.log('HTML content set successfully');

        // Handle messages from Webview
        console.log('Setting up message handler for webview');
        webviewView.webview.onDidReceiveMessage(async (message) => {
            console.log('Received message from webview:', message);
            console.log('Message command:', message.command);

            switch (message.command) {
                case 'sendMessage':
                    console.log('Processing sendMessage command with text:', message.text);
                    await this._handleUserMessage(message.text);
                    break;

                case 'getCodeContext':
                    const codeContext = await this.geminiService.getCodeContext();
                    webviewView.webview.postMessage({
                        command: 'codeContext',
                        context: codeContext
                    });
                    break;

                case 'getFullContext':
                    try {
                        const fullContext = await this.geminiService.getFullContext();
                        webviewView.webview.postMessage({
                            command: 'fullContext',
                            context: fullContext
                        });
                    } catch (error) {
                        console.error('Error getting full context:', error);
                        webviewView.webview.postMessage({
                            command: 'error',
                            message: `Failed to get context: ${error.message}`
                        });
                    }
                    break;

                case 'clearHistory':
                    this.chatHistory = [];
                    this.geminiService.clearChatHistory();
                    this._updateChatInWebview();
                    break;

                case 'insertCode':
                    this._insertCodeToEditor(message.code);
                    break;

                case 'executeTool':
                    try {
                        const { toolName, parameters } = message;
                        if (!this.toolManager) {
                            throw new Error('Tool manager not initialized');
                        }

                        const result = await this.toolManager.executeTool(toolName, parameters);
                        webviewView.webview.postMessage({
                            command: 'toolResult',
                            toolName,
                            parameters,
                            result
                        });
                    } catch (error) {
                        console.error('Error executing tool:', error);
                        webviewView.webview.postMessage({
                            command: 'error',
                            message: `Failed to execute tool: ${error.message}`
                        });
                    }
                    break;
            }
        });
    }

    /**
     * Handle user message
     * @param {string} text User message
     */
    async _handleUserMessage(text) {
        if (!text.trim()) return;

        console.log(`Received user message: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);

        // Add user message to history
        this.chatHistory.push({ role: 'user', content: text });
        this._updateChatInWebview();

        // Show loading state
        console.log('Showing loading state...');
        if (this._view && this._view.webview) {
            this._view.webview.postMessage({ command: 'startLoading' });
        } else {
            console.error('Cannot show loading state: webview not available');
        }

        try {
            // Get full context
            console.log('Getting context...');
            const context = await this.geminiService.getFullContext();

            // Call Gemini API
            console.log('Calling Gemini API...');
            const response = await this.geminiService.generateContent(text, context, true);
            console.log('Received Gemini API response');

            // Stop loading state
            console.log('Stopping loading state...');
            if (this._view && this._view.webview) {
                this._view.webview.postMessage({ command: 'stopLoading' });
            }

            if (response.error) {
                // Handle error
                console.error(`Gemini API returned error: ${response.error}`);
                this.chatHistory.push({ role: 'assistant', content: `Error: ${response.error}` });
            } else {
                // Add AI response to history
                console.log('Adding AI response to history...');
                this.chatHistory.push({ role: 'assistant', content: response.text });

                // If there are tool call results, show tool information
                if (response.toolResults && response.toolResults.length > 0) {
                    console.log(`Sending ${response.toolResults.length} tool results to frontend...`);
                    // Send tool results to frontend
                    if (this._view && this._view.webview) {
                        this._view.webview.postMessage({
                            command: 'toolResults',
                            results: response.toolResults
                        });
                    }
                }
            }

            // Update chat interface
            console.log('Updating chat interface...');
            this._updateChatInWebview();
        } catch (error) {
            console.error('Error handling user message:', error);

            // Stop loading state
            if (this._view && this._view.webview) {
                this._view.webview.postMessage({ command: 'stopLoading' });
            }

            // Add error message
            this.chatHistory.push({ role: 'assistant', content: `Error: ${error.message}` });
            this._updateChatInWebview();

            // Show error message to user
            vscode.window.showErrorMessage(`Error processing message: ${error.message}`);
        }
    }

    _updateChatInWebview() {
        try {
            if (this._view && this._view.webview) {
                console.log('Sending update chat history command to webview...');
                this._view.webview.postMessage({
                    command: 'updateChat',
                    history: this.chatHistory
                });
            } else {
                console.error('Cannot update chat interface: webview not available');
            }
        } catch (error) {
            console.error('Error updating chat interface:', error);
        }
    }

    /**
     * Insert code to editor
     * @param {string} code Code
     */
    _insertCodeToEditor(code) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, code);
            });
        }
    }

    /**
     * Clear chat history
     */
    clearChatHistory() {
        this.chatHistory = [];
        if (this.geminiService) {
            this.geminiService.clearChatHistory();
        }
        this._updateChatInWebview();
    }

    /**
     * Get full context
     * @returns {Promise<Object>} Context object
     */
    async getFullContext() {
        if (this.geminiService) {
            return await this.geminiService.getFullContext();
        }
        return null;
    }

    /**
     * Update configuration
     */
    updateConfiguration() {
        if (this.geminiService) {
            this.geminiService.initialize();
        }
    }

    /**
     * Get HTML for webview
     * @param {vscode.Webview} webview Webview object
     * @returns {string} HTML content
     */
    _getHtmlForWebview(webview) {
        // Get media file paths
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'main.js'))
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'main.css'))
        );

        // Use nonce for security
        const nonce = getNonce();

        // Get available tools list
        const availableTools = this.toolManager ? this.toolManager.getAvailableTools() : [];
        const toolsJson = JSON.stringify(availableTools);

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}' 'unsafe-inline'; connect-src vscode-webview-resource:; img-src ${webview.cspSource} https:;">
            <link href="${styleUri}" rel="stylesheet">
            <title>Nyxn AI Assistant</title>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Nyxn AI Assistant</h2>
                    <div class="actions">
                        <button id="clear-button" title="Clear chat history">Clear History</button>
                        <button id="context-button" title="Get current context">Get Context</button>
                    </div>
                </div>

                <div id="chat-container" class="chat-container"></div>

                <div class="input-container">
                    <textarea id="user-input" placeholder="Enter your question or request..."></textarea>
                    <div class="button-container">
                        <button id="send-button" type="button" class="send-button-class" onclick="sendMessage()">Send</button>
                        <button id="send-button-backup" type="button" class="send-button-class" style="margin-left: 5px;">Send (Backup)</button>
                    </div>
                </div>

                <!-- Add a simple form as another fallback -->
                <form id="message-form" style="display: none;">
                    <input type="text" id="message-input" />
                    <input type="submit" value="Send Form" />
                </form>

                <div id="tool-results" class="tool-results hidden">
                    <div class="tool-header">
                        <h3>Tool Execution Results</h3>
                        <button id="close-tool-results">Close</button>
                    </div>
                    <div id="tool-content"></div>
                </div>
            </div>

            <!-- Tool data -->
            <script nonce="${nonce}">
                window.availableTools = ${toolsJson};
            </script>

            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

module.exports = NyxnWebviewProvider;
