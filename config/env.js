// This file contains environment variables that can be used throughout the app
// For security, in a real app, these values should be stored in a secure way
// like using environment variables and not committed to version control

import Constants from 'expo-constants';

// Try to get API keys from environment variables, or use placeholders for development
const envKeys = Constants.expoConfig?.extra || {};

// NOTE: The Groq API key is invalid/expired. You need to replace it with a valid key.
// Get a new API key from https://console.groq.com/
export default {
  // Groq API Key - Use environment variable or a placeholder
  // Replace this with your own API key from Groq Console
  GROQ_API_KEY: envKeys.GROQ_API_KEY || process.env.GROQ_API_KEY || "YOUR_GROQ_API_KEY"
}; 