import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Try to get Firebase config from environment variables
const envConfig = Constants.expoConfig?.extra?.firebase || {};

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: envConfig.apiKey || "AIzaSyAmZsxmyIa0U30p6sPnpk5WkhEJ4jMEV14",
  authDomain: envConfig.authDomain || "paidapp-fc087.firebaseapp.com", 
  projectId: envConfig.projectId || "paidapp-fc087",
  storageBucket: envConfig.storageBucket || "paidapp-fc087.firebasestorage.app", 
  messagingSenderId: envConfig.messagingSenderId || "507201982948",
  appId: envConfig.appId || "1:507201982948:web:25d626013ee52d91c8f7f1",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore
const db = getFirestore(app);

// Initialize Storage
const storage = getStorage(app);

export { app, auth, db, storage }; 