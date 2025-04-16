/**
 * Tool Manager - Manages and executes various tools
 * Similar to Claude Agent's tool framework
 */
class ToolManager {
    constructor() {
        this.tools = new Map();
        this.toolResults = new Map();
    }

    /**
     * Register tool
     * @param {string} toolName Tool name
     * @param {Function} toolFunction Tool function
     * @param {Object} toolMetadata Tool metadata
     */
    registerTool(toolName, toolFunction, toolMetadata = {}) {
        this.tools.set(toolName, {
            function: toolFunction,
            metadata: {
                name: toolName,
                description: toolMetadata.description || '',
                parameters: toolMetadata.parameters || {},
                required: toolMetadata.required || []
            }
        });
    }

    /**
     * Get descriptions of all available tools
     * @returns {Array} List of tool descriptions
     */
    getAvailableTools() {
        const tools = [];
        for (const [name, tool] of this.tools.entries()) {
            tools.push({
                name,
                description: tool.metadata.description,
                parameters: tool.metadata.parameters,
                required: tool.metadata.required
            });
        }
        return tools;
    }

    /**
     * Execute tool
     * @param {string} toolName Tool name
     * @param {Object} parameters Parameters
     * @returns {Promise<any>} Tool execution result
     */
    async executeTool(toolName, parameters = {}) {
        if (!this.tools.has(toolName)) {
            throw new Error(`Tool '${toolName}' not found`);
        }

        const tool = this.tools.get(toolName);

        try {
            // Validate required parameters
            const missingParams = tool.metadata.required.filter(param => !parameters.hasOwnProperty(param));
            if (missingParams.length > 0) {
                throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
            }

            // Execute tool
            const result = await tool.function(parameters);

            // Store result for later use
            this.toolResults.set(toolName, {
                parameters,
                result,
                timestamp: new Date()
            });

            return result;
        } catch (error) {
            console.error(`Error executing tool '${toolName}':`, error);
            throw error;
        }
    }

    /**
     * Parse tool calls
     * Extract tool calls from AI response
     * @param {string} text AI response text
     * @returns {Array} List of tool calls
     */
    parseToolCalls(text) {
        // Match tool calls in <tool>...</tool> format
        const toolCallRegex = /<tool[^>]*>([\s\S]*?)<\/tool>/g;
        const toolCalls = [];

        let match;
        while ((match = toolCallRegex.exec(text)) !== null) {
            try {
                const toolCallContent = match[1].trim();

                // Parse tool name and parameters
                const nameMatch = /<name>(.*?)<\/name>/s.exec(toolCallContent);
                const paramsMatch = /<parameters>([\s\S]*?)<\/parameters>/s.exec(toolCallContent);

                if (nameMatch && paramsMatch) {
                    const toolName = nameMatch[1].trim();
                    const paramsContent = paramsMatch[1].trim();

                    // Parse parameters
                    const params = {};
                    const paramRegex = /<param\s+name="([^"]+)">([\s\S]*?)<\/param>/g;
                    let paramMatch;

                    while ((paramMatch = paramRegex.exec(paramsContent)) !== null) {
                        const paramName = paramMatch[1];
                        const paramValue = paramMatch[2].trim();
                        params[paramName] = paramValue;
                    }

                    toolCalls.push({
                        name: toolName,
                        parameters: params,
                        originalText: match[0]
                    });
                }
            } catch (error) {
                console.error('Error parsing tool call:', error);
            }
        }

        return toolCalls;
    }

    /**
     * Execute tool calls parsed from AI response
     * @param {string} text AI response text
     * @returns {Promise<{text: string, results: Array}>} Processed text and tool execution results
     */
    async executeToolCalls(text) {
        const toolCalls = this.parseToolCalls(text);
        const results = [];
        let processedText = text;

        for (const toolCall of toolCalls) {
            try {
                const result = await this.executeTool(toolCall.name, toolCall.parameters);
                results.push({
                    name: toolCall.name,
                    parameters: toolCall.parameters,
                    result
                });

                // Replace original tool call text with result
                const resultText = typeof result === 'object'
                    ? JSON.stringify(result, null, 2)
                    : String(result);

                const replacementText = `<tool-result name="${toolCall.name}">
${resultText}
</tool-result>`;

                processedText = processedText.replace(toolCall.originalText, replacementText);
            } catch (error) {
                console.error(`Error executing tool '${toolCall.name}':`, error);

                // Replace with error message
                const errorText = `<tool-error name="${toolCall.name}">
Error: ${error.message}
</tool-error>`;

                processedText = processedText.replace(toolCall.originalText, errorText);

                results.push({
                    name: toolCall.name,
                    parameters: toolCall.parameters,
                    error: error.message
                });
            }
        }

        return {
            text: processedText,
            results
        };
    }
}

module.exports = ToolManager;
