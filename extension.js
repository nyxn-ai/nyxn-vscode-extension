const vscode = require('vscode');
const NyxnWebviewProvider = require('./src/webviewProvider');

/**
 * Called when the extension is activated
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Nyxn AI Assistant extension is now active');

    // Register Webview provider
    const provider = new NyxnWebviewProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('nyxn-ai-assistant.chatView', provider)
    );

    // Register commands
    let startCommand = vscode.commands.registerCommand('nyxn-ai-assistant.start', function () {
        vscode.commands.executeCommand('nyxn-ai-assistant.chatView.focus');
        vscode.window.showInformationMessage('Nyxn AI Assistant is now active');
    });

    context.subscriptions.push(startCommand);
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
