import 'dotenv/config';

export default ({ config }) => {
  // Get environment variables with fallbacks
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
  const FIREBASE_AUTH_DOMAIN = process.env.FIREBASE_AUTH_DOMAIN;
  const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
  const FIREBASE_STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET;
  const FIREBASE_MESSAGING_SENDER_ID = process.env.FIREBASE_MESSAGING_SENDER_ID;
  const FIREBASE_APP_ID = process.env.FIREBASE_APP_ID;
  
  return {
    ...config,
    extra: {
      GROQ_API_KEY,
      firebase: {
        apiKey: FIREBASE_API_KEY,
        authDomain: FIREBASE_AUTH_DOMAIN,
        projectId: FIREBASE_PROJECT_ID,
        storageBucket: FIREBASE_STORAGE_BUCKET,
        messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
        appId: FIREBASE_APP_ID,
      },
      eas: {
        projectId: "0102a36c-2fdf-4a48-896c-7e5964d19c0d"
      }
    },
  };
}; 