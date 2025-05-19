import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAmZsxmyIa0U30p6sPnpk5WkhEJ4jMEV14", // Replace with your actual API key
  authDomain: "paidapp-fc087.firebaseapp.com", // Replace with your actual auth domain
  projectId: "paidapp-fc087", // Replace with your actual project ID
  storageBucket: "paidapp-fc087.firebasestorage.app", // Replace with your actual storage bucket
  messagingSenderId: "507201982948", // Replace with your actual messaging sender ID
  appId: "1:507201982948:web:25d626013ee52d91c8f7f1", // Replace with your actual app ID
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