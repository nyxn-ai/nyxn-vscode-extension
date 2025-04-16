const vscode = require('vscode');

/**
 * 工具管理器 - 管理和执行各种工具
 * 类似Claude Agent的工具框架
 */
class ToolManager {
    constructor() {
        this.tools = new Map();
        this.toolResults = new Map();
    }

    /**
     * 注册工具
     * @param {string} toolName 工具名称
     * @param {Function} toolFunction 工具函数
     * @param {Object} toolMetadata 工具元数据
     */
    registerTool(toolName, toolFunction, toolMetadata = {}) {
        this.tools.set(toolName, {
            execute: toolFunction,
            metadata: {
                description: toolMetadata.description || '',
                parameters: toolMetadata.parameters || {},
                required: toolMetadata.required || [],
                ...toolMetadata
            }
        });
    }

    /**
     * 获取所有可用工具的描述
     * @returns {Array} 工具描述列表
     */
    getAvailableTools() {
        const toolDescriptions = [];
        this.tools.forEach((tool, name) => {
            toolDescriptions.push({
                name,
                description: tool.metadata.description,
                parameters: tool.metadata.parameters,
                required: tool.metadata.required
            });
        });
        return toolDescriptions;
    }

    /**
     * 执行工具
     * @param {string} toolName 工具名称
     * @param {Object} parameters 参数
     * @returns {Promise<any>} 工具执行结果
     */
    async executeTool(toolName, parameters = {}) {
        if (!this.tools.has(toolName)) {
            throw new Error(`Tool '${toolName}' not found`);
        }

        const tool = this.tools.get(toolName);
        
        // 验证必需参数
        for (const requiredParam of tool.metadata.required) {
            if (!(requiredParam in parameters)) {
                throw new Error(`Missing required parameter '${requiredParam}' for tool '${toolName}'`);
            }
        }

        try {
            // 执行工具
            const result = await tool.execute(parameters);
            
            // 存储结果以供后续使用
            this.toolResults.set(toolName, {
                parameters,
                result,
                timestamp: new Date().toISOString()
            });
            
            return result;
        } catch (error) {
            console.error(`Error executing tool '${toolName}':`, error);
            throw error;
        }
    }

    /**
     * 解析工具调用
     * 从AI响应中提取工具调用
     * @param {string} text AI响应文本
     * @returns {Array} 工具调用列表
     */
    parseToolCalls(text) {
        // 匹配 <tool>...</tool> 格式的工具调用
        const toolCallRegex = /<tool[^>]*>([\s\S]*?)<\/tool>/g;
        const toolCalls = [];
        
        let match;
        while ((match = toolCallRegex.exec(text)) !== null) {
            try {
                const toolCallContent = match[1].trim();
                
                // 解析工具名称和参数
                const nameMatch = /<name>(.*?)<\/name>/s.exec(toolCallContent);
                const paramsMatch = /<parameters>([\s\S]*?)<\/parameters>/s.exec(toolCallContent);
                
                if (nameMatch && paramsMatch) {
                    const toolName = nameMatch[1].trim();
                    const paramsContent = paramsMatch[1].trim();
                    
                    // 解析参数
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
     * 执行从AI响应中解析出的工具调用
     * @param {string} text AI响应文本
     * @returns {Promise<{text: string, results: Array}>} 处理后的文本和工具执行结果
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
                
                // 替换原始工具调用文本为结果
                const resultText = typeof result === 'object' 
                    ? JSON.stringify(result, null, 2) 
                    : String(result);
                
                const replacementText = `<tool-result name="${toolCall.name}">
${resultText}
</tool-result>`;
                
                processedText = processedText.replace(toolCall.originalText, replacementText);
            } catch (error) {
                console.error(`Error executing tool '${toolCall.name}':`, error);
                
                // 替换为错误信息
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
