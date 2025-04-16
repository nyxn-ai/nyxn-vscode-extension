const vscode = require('vscode');
const NyxnWebviewProvider = require('./src/webviewProvider');

/**
 * Called when the extension is activated
 * @param {vscode.ExtensionContext} context Extension context
 */
function activate(context) {
    console.log('Nyxn AI Assistant extension is now active');

    // Register Webview provider
    const provider = new NyxnWebviewProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('nyxn-ai-assistant.chatView', provider)
    );

    // Register commands
    // Start assistant
    let startCommand = vscode.commands.registerCommand('nyxn-ai-assistant.start', function () {
        vscode.commands.executeCommand('nyxn-ai-assistant.chatView.focus');
        vscode.window.showInformationMessage('Nyxn AI Assistant is now active');
    });

    // Clear history
    let clearHistoryCommand = vscode.commands.registerCommand('nyxn-ai-assistant.clearHistory', function () {
        provider.clearChatHistory();
        vscode.window.showInformationMessage('Chat history cleared');
    });

    // Get context
    let getContextCommand = vscode.commands.registerCommand('nyxn-ai-assistant.getContext', async function () {
        const context = await provider.getFullContext();
        vscode.window.showInformationMessage('Current context retrieved');
        return context;
    });

    context.subscriptions.push(startCommand);
    context.subscriptions.push(clearHistoryCommand);
    context.subscriptions.push(getContextCommand);

    // Listen for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('nyxn-ai-assistant')) {
                provider.updateConfiguration();
            }
        })
    );
}

/**
 * Called when the extension is deactivated
 */
function deactivate() {
    console.log('Nyxn AI Assistant extension has been deactivated');
}

module.exports = {
    activate,
    deactivate
};
