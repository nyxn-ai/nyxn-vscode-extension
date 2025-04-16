// Test tool manager functionality
require('dotenv').config();
const ToolManager = require('./src/tools/toolManager');

async function testToolManager() {
    try {
        console.log('Starting tool manager tests...');
        
        // Create tool manager instance
        const toolManager = new ToolManager();
        console.log('Tool manager created');
        
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
        console.log('Test tool registered');
        
        // Get available tools
        const tools = toolManager.getAvailableTools();
        console.log(`Available tools: ${tools.length}`);
        console.log(`Tool name: ${tools[0].name}`);
        console.log(`Tool description: ${tools[0].description}`);
        
        // Execute tool
        try {
            const result = await toolManager.executeTool('test-tool', { test: 'test-value' });
            console.log(`Tool execution result: ${result}`);
        } catch (error) {
            console.error('Error executing tool:', error);
        }
        
        // Test tool call parsing
        console.log('Testing tool call parsing...');
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
        
        // Test tool call execution
        console.log('Testing tool call execution...');
        const toolResponse = await toolManager.executeToolCalls(testText);
        console.log(`Tool response text contains result: ${toolResponse.text.includes('Test tool executed')}`);
        console.log(`Tool results count: ${toolResponse.results.length}`);
        
        console.log('All tool manager tests completed successfully!');
    } catch (error) {
        console.error('Error during tool manager tests:', error);
    }
}

// Run the tests
testToolManager();
