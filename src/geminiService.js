const { GoogleGenerativeAI } = require('@google/generative-ai');
const vscode = require('vscode');
require('dotenv').config();

class GeminiService {
    constructor() {
        this.initialize();
    }

    initialize() {
        // Prioritize API key from configuration, fallback to environment variable
        const config = vscode.workspace.getConfiguration('nyxn-ai-assistant');
        const apiKey = config.get('apiKey') || process.env.GEMINI_API_KEY;

        if (!apiKey) {
            vscode.window.showErrorMessage('Please set Gemini API key');
            return;
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
        this.modelName = config.get('model') || 'gemini-2.0-flash';
        this.model = this.genAI.getGenerativeModel({ model: this.modelName });
    }

    async generateContent(prompt, codeContext = null) {
        try {
            if (!this.model) {
                this.initialize();
                if (!this.model) {
                    return { error: 'API key not set or initialization failed' };
                }
            }

            // Build complete prompt, including code context (if available)
            let fullPrompt = prompt;
            if (codeContext) {
                fullPrompt = `Here is the current code context:
\`\`\`
${codeContext}
\`\`\`

${prompt}`;
            }

            const result = await this.model.generateContent(fullPrompt);
            const response = result.response;
            return {
                text: response.text(),
                promptFeedback: response.promptFeedback
            };
        } catch (error) {
            console.error('Gemini API error:', error);
            return { error: `Error calling Gemini API: ${error.message}` };
        }
    }

    // Get code context from current editor
    async getCodeContext() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return null;
        }

        const document = editor.document;
        const selection = editor.selection;

        // If text is selected, use it as context
        if (!selection.isEmpty) {
            return document.getText(selection);
        }

        // Otherwise use the entire file as context
        return document.getText();
    }
}

module.exports = GeminiService;
