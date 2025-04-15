const vscode = require('vscode');
const path = require('path');
const GeminiService = require('./geminiService');

class NyxnWebviewProvider {
    constructor(context) {
        this.context = context;
        this.geminiService = new GeminiService();
        this._view = null;
        this.chatHistory = [];
    }

    resolveWebviewView(webviewView) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
            ]
        };

        // Set HTML content
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from Webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'sendMessage':
                    await this._handleUserMessage(message.text);
                    break;
                case 'getCodeContext':
                    const codeContext = await this.geminiService.getCodeContext();
                    webviewView.webview.postMessage({ 
                        command: 'codeContext', 
                        context: codeContext 
                    });
                    break;
                case 'insertCode':
                    this._insertCodeToEditor(message.code);
                    break;
            }
        });
    }

    async _handleUserMessage(text) {
        if (!text.trim()) return;

        // Add user message to history
        this.chatHistory.push({ role: 'user', content: text });
        this._updateChatInWebview();

        // Show loading state
        this._view.webview.postMessage({ command: 'startLoading' });

        // Get code context
        const codeContext = await this.geminiService.getCodeContext();

        // Call Gemini API
        const response = await this.geminiService.generateContent(text, codeContext);

        // Stop loading state
        this._view.webview.postMessage({ command: 'stopLoading' });

        if (response.error) {
            // Handle error
            this.chatHistory.push({ role: 'assistant', content: `Error: ${response.error}` });
        } else {
            // Add AI response to history
            this.chatHistory.push({ role: 'assistant', content: response.text });
        }

        // Update chat interface
        this._updateChatInWebview();
    }

    _updateChatInWebview() {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'updateChat',
                history: this.chatHistory
            });
        }
    }

    _insertCodeToEditor(code) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, code);
            });
        }
    }

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

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            <link href="${styleUri}" rel="stylesheet">
            <title>Nyxn AI Assistant</title>
        </head>
        <body>
            <div class="container">
                <div id="chat-container" class="chat-container"></div>
                <div class="input-container">
                    <textarea id="user-input" placeholder="Enter your question or request..."></textarea>
                    <button id="send-button">Send</button>
                </div>
            </div>
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
