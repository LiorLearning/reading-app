import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getEnv } from './env';

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: getEnv('VITE_FIREBASE_APP_ID') || process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  automaticDataCollectionEnabled: false
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore with memory-only cache
// This completely disables background sync and prevents /Listen/channel WebSocket calls
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
  experimentalForceLongPolling: false,
});

// Initialize Firebase Storage and get a reference to the service
export const storage = getStorage(app);

export default app;
