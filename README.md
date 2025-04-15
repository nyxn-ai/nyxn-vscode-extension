# Nyxn AI Assistant

A powerful VS Code extension that integrates Google's Gemini AI to provide intelligent code assistance, similar to Augment Agent. This extension leverages the Gemini API to help developers write, understand, and optimize code more efficiently.

<p align="center">
  <img src="https://img.shields.io/badge/VS%20Code-Extension-blue" alt="VS Code Extension">
  <img src="https://img.shields.io/badge/Gemini-AI-green" alt="Gemini AI">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</p>

## Features

- **AI-Powered Code Assistance**: Get intelligent suggestions, explanations, and optimizations for your code
- **Context-Aware Responses**: The AI understands your current code context for more relevant assistance
- **Code Generation**: Generate code snippets based on natural language descriptions
- **Code Explanation**: Get detailed explanations of complex code segments
- **Seamless Integration**: Conveniently accessible from the VS Code sidebar

## Requirements

- Visual Studio Code 1.60.0 or higher
- Google Gemini API key

## Installation

1. Install the extension from the VS Code Marketplace or download the VSIX file from the [releases page](https://github.com/nyxn-ai/nyxn-vscode-extension/releases)
2. Configure your Gemini API key in the extension settings
3. Restart VS Code to activate the extension

## Configuration

This extension contributes the following settings:

- `nyxn-ai-assistant.apiKey`: Your Gemini API key
- `nyxn-ai-assistant.model`: The Gemini model to use (default: `gemini-2.0-flash`)
  - Available options: `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`

## Usage

1. Click the Nyxn AI icon in the activity bar to open the sidebar
2. Type your question or request in the input field
3. Press Enter or click the Send button to submit your query
4. View the AI's response in the chat interface
5. Use the "Copy" button to copy code snippets to your clipboard
6. Use the "Insert to Editor" button to insert code directly into your active editor

## Examples

Here are some examples of what you can ask the Nyxn AI Assistant:

- "Explain how this function works"
- "Optimize this code for better performance"
- "Generate a React component for a login form"
- "Convert this JavaScript code to TypeScript"
- "Find bugs in this code"
- "Suggest unit tests for this function"

## Development

To contribute to this extension:

```bash
# Clone the repository
git clone https://github.com/nyxn-ai/nyxn-vscode-extension.git

# Navigate to the project directory
cd nyxn-vscode-extension

# Install dependencies
npm install

# Open in VS Code
code .
```

## Building the Extension

To build the extension:

```bash
# Install vsce if you haven't already
npm install -g @vscode/vsce

# Package the extension
vsce package
```

This will generate a `.vsix` file that can be installed in VS Code.

## Privacy and Security

- Your code and queries are sent to the Gemini API for processing
- API keys are stored securely in your VS Code settings
- No data is stored on our servers

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- Google Gemini API for providing the AI capabilities
- Visual Studio Code team for the excellent extension API

---

Made with ❤️ by [Nyxn AI](https://github.com/nyxn-ai)
