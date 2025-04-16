// Test Gemini chat functionality
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGeminiChat() {
    try {
        console.log('Starting Gemini chat test...');
        
        // Get API key
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('Error: GEMINI_API_KEY environment variable not set');
            return;
        }
        
        // Get model name
        const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        console.log(`Using model: ${modelName}`);
        
        // Initialize API
        const genAI = new GoogleGenerativeAI(apiKey);
        
        // Get model
        const model = genAI.getGenerativeModel({ model: modelName });
        
        // Create chat session with history
        const chat = model.startChat({
            history: [
                { role: 'user', parts: [{ text: 'Hello, how are you?' }] },
                { role: 'model', parts: [{ text: 'I\'m doing well, thank you for asking! How can I help you today?' }] }
            ],
            systemInstruction: 'You are a helpful assistant that provides concise responses.'
        });
        
        console.log('Chat session created with history');
        
        // Send a message that references the history
        console.log('Sending message that references history...');
        const result = await chat.sendMessage('What was my previous message to you?');
        
        // Get response
        const response = result.response;
        const responseText = response.text();
        
        console.log('Response received:');
        console.log(responseText);
        
        // Test chat history management
        console.log('Testing chat history management...');
        // Send another message
        const result2 = await chat.sendMessage('Can you summarize our conversation so far?');
        const responseText2 = result2.response.text();
        
        console.log('Summary response:');
        console.log(responseText2);
        
        console.log('Gemini chat test completed successfully!');
    } catch (error) {
        console.error('Error testing Gemini chat:', error);
    }
}

// Run the test
testGeminiChat();
