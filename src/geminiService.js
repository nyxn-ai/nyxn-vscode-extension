const { GoogleGenerativeAI } = require('@google/generative-ai');
const vscode = require('vscode');
require('dotenv').config();

/**
 * Gemini Service
 * Handles interaction with Gemini API, supports tool usage and context management
 */
class GeminiService {
    /**
     * Initialize Gemini Service
     * @param {ToolManager} [toolManager] Tool manager
     * @param {ContextManager} [contextManager] Context manager
     */
    constructor(toolManager = null, contextManager = null) {
        this.toolManager = toolManager;
        this.contextManager = contextManager;
        this.chatHistory = [];
        this.initialize();
    }

    /**
     * Initialize Gemini API
     */
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

        // 设置系统提示
        this.systemPrompt = config.get('systemPrompt') || this.getDefaultSystemPrompt();
    }

    /**
     * Get default system prompt
     * @returns {string} Default system prompt
     */
    getDefaultSystemPrompt() {
        return `You are Nyxn AI Assistant, an AI assistant in a VS Code extension, based on the Gemini model.
You can help users write code, explain code, answer questions, and perform various tasks.
You can use tools to perform various operations, such as reading files, searching code, getting diagnostic information, etc.

When using tools, please use the following format:
<tool>
<name>tool_name</name>
<parameters>
<param name="parameter_name">parameter_value</param>
</parameters>
</tool>

For example, to read a file, you can use:
<tool>
<name>read-file</name>
<parameters>
<param name="file_path">path/to/file.js</param>
</parameters>
</tool>

Please keep your answers concise, professional, and provide useful information as much as possible.`;
    }

    /**
     * Generate content
     * @param {string} prompt User prompt
     * @param {Object} [context=null] Context
     * @param {boolean} [useTools=true] Whether to use tools
     * @returns {Promise<Object>} Generation result
     */
    async generateContent(prompt, context = null, useTools = true) {
        try {
            if (!this.model) {
                this.initialize();
                if (!this.model) {
                    return { error: 'API key not set or initialization failed' };
                }
            }

            // Build complete prompt, including context (if available)
            let fullPrompt = prompt;

            // Add code context
            if (context) {
                if (typeof context === 'string') {
                    // Simple string context
                    fullPrompt = `Here is the current code context:
\`\`\`
${context}
\`\`\`

${prompt}`;
                } else {
                    // Structured context
                    fullPrompt = this._buildStructuredPrompt(prompt, context);
                }
            }

            // Add system prompt and available tools information
            let systemContext = this.systemPrompt;

            // If tools are enabled, add tools information
            if (useTools && this.toolManager) {
                const availableTools = this.toolManager.getAvailableTools();
                systemContext += `\n\nAvailable tools:\n${JSON.stringify(availableTools, null, 2)}`;
            }

            // Add chat history
            const history = this._buildChatHistory();

            // Create chat session
            const chat = this.model.startChat({
                history: history,
                systemInstruction: systemContext,
            });

            // Send message
            const result = await chat.sendMessage(fullPrompt);
            const response = result.response;
            const responseText = response.text();

            // Add to chat history
            this.chatHistory.push({ role: 'user', parts: [{ text: fullPrompt }] });
            this.chatHistory.push({ role: 'model', parts: [{ text: responseText }] });

            // If tools are enabled, process tool calls
            let processedResponse = responseText;
            let toolResults = [];

            if (useTools && this.toolManager) {
                const toolResponse = await this.toolManager.executeToolCalls(responseText);
                processedResponse = toolResponse.text;
                toolResults = toolResponse.results;

                // If there are tool call results, add the results to chat history
                if (toolResults.length > 0) {
                    this.chatHistory.push({ role: 'model', parts: [{ text: processedResponse }] });
                }
            }

            return {
                text: processedResponse,
                originalText: responseText,
                promptFeedback: response.promptFeedback,
                toolResults: toolResults
            };
        } catch (error) {
            console.error('Gemini API error:', error);
            return { error: `Error calling Gemini API: ${error.message}` };
        }
    }

    /**
     * Get code context
     * @returns {Promise<string|null>} Code context
     */
    async getCodeContext() {
        // If there is a context manager, use it to get context
        if (this.contextManager) {
            const currentFileContext = await this.contextManager.getCurrentFileContext();
            if (currentFileContext) {
                return currentFileContext.content;
            }
        }

        // Otherwise use simple method to get context
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

    /**
     * Get full context
     * @returns {Promise<Object|null>} Full context
     */
    async getFullContext() {
        if (this.contextManager) {
            return await this.contextManager.getFullContext();
        }

        // If there is no context manager, return simple context
        const codeContext = await this.getCodeContext();
        return codeContext ? { currentFile: { content: codeContext } } : null;
    }

    /**
     * Clear chat history
     */
    clearChatHistory() {
        this.chatHistory = [];
    }

    /**
     * Build structured prompt
     * @param {string} prompt User prompt
     * @param {Object} context Context object
     * @returns {string} Structured prompt
     * @private
     */
    _buildStructuredPrompt(prompt, context) {
        let structuredPrompt = '';

        // Add current file context
        if (context.currentFile) {
            structuredPrompt += `Current file: ${context.currentFile.filePath || 'unknown'}\n`;

            if (context.currentFile.selection) {
                structuredPrompt += `Selected code (lines ${context.currentFile.selection.startLine}-${context.currentFile.selection.endLine}):\n\`\`\`\n${context.currentFile.selection.text}\n\`\`\`\n\n`;
            } else if (context.currentFile.content) {
                structuredPrompt += `File content:\n\`\`\`\n${context.currentFile.content}\n\`\`\`\n\n`;
            }
        }

        // Add related files context (if any)
        if (context.relatedFiles && context.relatedFiles.length > 0) {
            structuredPrompt += `Related files:\n`;
            context.relatedFiles.forEach(file => {
                structuredPrompt += `- ${file.filePath}\n`;
            });
            structuredPrompt += '\n';
        }

        // Add project structure context (if any)
        if (context.projectStructure) {
            structuredPrompt += `Project: ${context.projectStructure.name}\n`;

            if (context.projectStructure.packageJson) {
                structuredPrompt += `Project info: ${context.projectStructure.packageJson.name} v${context.projectStructure.packageJson.version}\n`;
                structuredPrompt += `Description: ${context.projectStructure.packageJson.description || 'No description'}\n\n`;
            }
        }

        // Add user prompt
        structuredPrompt += `User request: ${prompt}\n`;

        return structuredPrompt;
    }

    /**
     * Build chat history
     * @returns {Array} Chat history
     * @private
     */
    _buildChatHistory() {
        // Limit history length to prevent exceeding model context window
        const maxHistoryLength = 10; // Keep at most 5 rounds of conversation (10 messages)
        if (this.chatHistory.length > maxHistoryLength) {
            this.chatHistory = this.chatHistory.slice(this.chatHistory.length - maxHistoryLength);
        }

        return this.chatHistory;
    }
}

module.exports = GeminiService;
