import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
// Use Capacitor Firebase Auth on native platforms, web Firebase Auth on web
let authInstance;
try {
  // Check if we're on a native platform and Capacitor Firebase Auth is available
  const { Capacitor } = require('@capacitor/core');
  const { FirebaseAuthentication } = require('@capacitor-firebase/authentication');
  
  if (Capacitor.isNativePlatform()) {
    // On native platforms, initialize Capacitor Firebase Auth
    FirebaseAuthentication.initialize({ skipNativeAuth: false });
    authInstance = getAuth(app);
  } else {
    // On web, use standard Firebase Auth
    authInstance = getAuth(app);
  }
} catch {
  // Fallback to standard Firebase Auth if Capacitor is not available
  authInstance = getAuth(app);
}

// Export auth instance
export const auth = authInstance;

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Storage and get a reference to the service
export const storage = getStorage(app);

export default app;
