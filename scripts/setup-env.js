/**
 * This script sets up the environment variables needed for the app to function.
 * Run with: node scripts/setup-env.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ENV_FILE_PATH = path.join(__dirname, '..', '.env');

// API keys from the existing configuration
const DEFAULT_KEYS = {
  GROQ_API_KEY: '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',
  FIREBASE_API_KEY: 'AIzaSyAmZsxmyIa0U30p6sPnpk5WkhEJ4jMEV14',
  FIREBASE_AUTH_DOMAIN: 'paidapp-fc087.firebaseapp.com',
  FIREBASE_PROJECT_ID: 'paidapp-fc087',
  FIREBASE_STORAGE_BUCKET: 'paidapp-fc087.firebasestorage.app',
  FIREBASE_MESSAGING_SENDER_ID: '507201982948',
  FIREBASE_APP_ID: '1:507201982948:web:25d626013ee52d91c8f7f1'
};

// Check if the .env file already exists
if (fs.existsSync(ENV_FILE_PATH)) {
  console.log('\n.env file already exists. Do you want to overwrite it? (y/n)');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('> ', (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      createEnvFile();
      rl.close();
    } else {
      console.log('Operation cancelled. The existing .env file was not modified.');
      rl.close();
    }
  });
} else {
  createEnvFile();
}

function createEnvFile() {
  const envFileContent = `# Environment variables for Paid app
# IMPORTANT: Do not commit this file to version control

# Groq API Key
GROQ_API_KEY=${DEFAULT_KEYS.GROQ_API_KEY}

# Firebase Configuration
FIREBASE_API_KEY=${DEFAULT_KEYS.FIREBASE_API_KEY}
FIREBASE_AUTH_DOMAIN=${DEFAULT_KEYS.FIREBASE_AUTH_DOMAIN}
FIREBASE_PROJECT_ID=${DEFAULT_KEYS.FIREBASE_PROJECT_ID}
FIREBASE_STORAGE_BUCKET=${DEFAULT_KEYS.FIREBASE_STORAGE_BUCKET}
FIREBASE_MESSAGING_SENDER_ID=${DEFAULT_KEYS.FIREBASE_MESSAGING_SENDER_ID}
FIREBASE_APP_ID=${DEFAULT_KEYS.FIREBASE_APP_ID}
`;

  try {
    fs.writeFileSync(ENV_FILE_PATH, envFileContent);
    console.log('\n✅ .env file created successfully!');
    console.log('\n⚠️  WARNING: This file contains sensitive API keys. Do not commit it to version control.');
    console.log('\n📋 Next steps:');
    console.log('  1. For local development, you can use these keys.');
    console.log('  2. For production builds, consider using secure environment variables from EAS.');
    console.log('     Learn more: https://docs.expo.dev/build-reference/variables/');
  } catch (error) {
    console.error('\n❌ Error creating .env file:', error.message);
  }
} 