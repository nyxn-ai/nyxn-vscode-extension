// Test if Gemini API is working properly
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGeminiAPI() {
    try {
        console.log('Starting Gemini API test...');

        // Get API key
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('Error: GEMINI_API_KEY environment variable not set');
            return;
        }
        console.log('API key is set');

        // Get model name
        const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        console.log(`Using model: ${modelName}`);

        // Initialize API
        const genAI = new GoogleGenerativeAI(apiKey);
        console.log('GoogleGenerativeAI instance created');

        // Get model
        const model = genAI.getGenerativeModel({ model: modelName });
        console.log('Model instance obtained');

        // Create chat session
        const chat = model.startChat();
        console.log('Chat session created');

        // Send test message
        console.log('Sending test message...');
        const result = await chat.sendMessage('Hello, this is a test message');

        // Get response
        const response = result.response;
        const responseText = response.text();

        console.log('Response received successfully:');
        console.log(responseText);

        console.log('Gemini API test successful!');
    } catch (error) {
        console.error('Error testing Gemini API:', error);
    }
}

// Run the test
testGeminiAPI();
