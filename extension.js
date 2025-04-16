const vscode = require('vscode');
const NyxnWebviewProvider = require('./src/webviewProvider');

/**
 * Called when the extension is activated
 * @param {vscode.ExtensionContext} context Extension context
 */
function activate(context) {
    console.log('Nyxn AI Assistant extension is now active');
    console.log('Extension path:', context.extensionPath);

    // Declare provider at the top level so it's accessible to all commands
    let provider;

    try {
        // Register Webview provider
        console.log('Creating NyxnWebviewProvider...');
        provider = new NyxnWebviewProvider(context);

        console.log('Registering webview provider...');
        const registration = vscode.window.registerWebviewViewProvider('nyxn-ai-assistant.chatView', provider);
        context.subscriptions.push(registration);
        console.log('Webview provider registered successfully');

        // Show information message to confirm activation
        vscode.window.showInformationMessage('Nyxn AI Assistant has been activated');
    } catch (error) {
        console.error('Error activating extension:', error);
        vscode.window.showErrorMessage(`Error activating Nyxn AI Assistant: ${error.message}`);
        // Create a dummy provider if the real one failed
        provider = {
            clearChatHistory: () => console.log('Dummy clearChatHistory called'),
            getFullContext: async () => ({})
        };
    }

    // Register commands
    // Start assistant
    let startCommand = vscode.commands.registerCommand('nyxn-ai-assistant.start', function () {
        console.log('Start command executed');
        vscode.commands.executeCommand('nyxn-ai-assistant.chatView.focus');
        vscode.window.showInformationMessage('Nyxn AI Assistant is now active');
    });

    // Clear history
    let clearHistoryCommand = vscode.commands.registerCommand('nyxn-ai-assistant.clearHistory', function () {
        console.log('Clear history command executed');
        if (provider) {
            provider.clearChatHistory();
            vscode.window.showInformationMessage('Chat history cleared');
        } else {
            console.error('Cannot clear history: provider not available');
            vscode.window.showErrorMessage('Cannot clear history: provider not available');
        }
    });

    // Get context
    let getContextCommand = vscode.commands.registerCommand('nyxn-ai-assistant.getContext', async function () {
        console.log('Get context command executed');
        if (provider) {
            const contextData = await provider.getFullContext();
            vscode.window.showInformationMessage('Current context retrieved');
            return contextData;
        } else {
            console.error('Cannot get context: provider not available');
            vscode.window.showErrorMessage('Cannot get context: provider not available');
            return {};
        }
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
