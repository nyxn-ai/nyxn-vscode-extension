// Test other features of the extension
require('dotenv').config();
const vscode = require('vscode');
const GeminiService = require('./src/geminiService');
const ToolManager = require('./src/tools/toolManager');
const ContextManager = require('./src/contextManager');

async function testFeatures() {
    try {
        console.log('Starting feature tests...');
        
        // Create instances
        const toolManager = new ToolManager();
        const contextManager = new ContextManager({ extensionPath: __dirname });
        const geminiService = new GeminiService(toolManager, contextManager);
        
        // Test 1: Initialize Gemini service
        console.log('Test 1: Initializing Gemini service...');
        geminiService.initialize();
        console.log('Gemini service initialized successfully');
        
        // Test 2: Get default system prompt
        console.log('Test 2: Getting default system prompt...');
        const systemPrompt = geminiService.getDefaultSystemPrompt();
        console.log('Default system prompt retrieved successfully');
        console.log(`System prompt length: ${systemPrompt.length} characters`);
        
        // Test 3: Clear chat history
        console.log('Test 3: Testing chat history management...');
        // Add some dummy messages
        geminiService.chatHistory.push({ role: 'user', parts: [{ text: 'Test message 1' }] });
        geminiService.chatHistory.push({ role: 'model', parts: [{ text: 'Test response 1' }] });
        console.log(`Chat history before clearing: ${geminiService.chatHistory.length} messages`);
        
        // Clear history
        geminiService.clearChatHistory();
        console.log(`Chat history after clearing: ${geminiService.chatHistory.length} messages`);
        
        // Test 4: Test tool manager
        console.log('Test 4: Testing tool manager...');
        // Register a test tool
        toolManager.registerTool('test-tool', 
            async (params) => `Test tool executed with param: ${params.test}`,
            {
                description: 'Test tool',
                parameters: {
                    test: {
                        type: 'string',
                        description: 'Test parameter'
                    }
                },
                required: ['test']
            }
        );
        
        // Get available tools
        const tools = toolManager.getAvailableTools();
        console.log(`Available tools: ${tools.length}`);
        
        // Execute tool
        try {
            const result = await toolManager.executeTool('test-tool', { test: 'test-value' });
            console.log(`Tool execution result: ${result}`);
        } catch (error) {
            console.error('Error executing tool:', error);
        }
        
        // Test 5: Parse tool calls
        console.log('Test 5: Testing tool call parsing...');
        const testText = `Here's how to use a tool:
<tool>
<n>test-tool</name>
<parameters>
<param name="test">test-value</param>
</parameters>
</tool>`;
        
        const toolCalls = toolManager.parseToolCalls(testText);
        console.log(`Parsed tool calls: ${toolCalls.length}`);
        if (toolCalls.length > 0) {
            console.log(`Tool name: ${toolCalls[0].name}`);
            console.log(`Tool parameters: ${JSON.stringify(toolCalls[0].parameters)}`);
        }
        
        console.log('All feature tests completed successfully!');
    } catch (error) {
        console.error('Error during feature tests:', error);
    }
}

// Run the tests
testFeatures();
