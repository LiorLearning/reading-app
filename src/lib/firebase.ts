import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Debug Firebase config in incognito mode
console.log('🔍 Firebase Config Debug:', {
  hasApiKey: !!firebaseConfig.apiKey,
  hasAuthDomain: !!firebaseConfig.authDomain,
  hasProjectId: !!firebaseConfig.projectId,
  hasStorageBucket: !!firebaseConfig.storageBucket,
  hasMessagingSenderId: !!firebaseConfig.messagingSenderId,
  hasAppId: !!firebaseConfig.appId,
  isIncognito: checkIfIncognito()
});

function checkIfIncognito(): boolean {
  try {
    // Check if localStorage quota is restricted (common in incognito)
    localStorage.setItem('__test__', 'test');
    localStorage.removeItem('__test__');
    return false;
  } catch (e) {
    return true;
  }
}

let app: any;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

try {
  // Initialize Firebase
  console.log('🔍 Initializing Firebase app...');
  app = initializeApp(firebaseConfig);
  console.log('✅ Firebase app initialized successfully');

  // Initialize Firebase Authentication and get a reference to the service
  console.log('🔍 Initializing Firebase Auth...');
  auth = getAuth(app);
  console.log('✅ Firebase Auth initialized successfully');

  // Initialize Cloud Firestore and get a reference to the service
  console.log('🔍 Initializing Firestore...');
  db = getFirestore(app);
  console.log('✅ Firestore initialized successfully');

  // Initialize Firebase Storage and get a reference to the service
  console.log('🔍 Initializing Firebase Storage...');
  storage = getStorage(app);
  console.log('✅ Firebase Storage initialized successfully');

} catch (error) {
  console.error('🚨 Firebase initialization error:', error);
  throw error;
}

export { auth, db, storage };
export default app;
