import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { 
  User, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signInWithCredential,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

// Google Identity Services types
declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (callback?: (notification: any) => void) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          cancel: () => void;
        };
      };
    };
  }
}

// Enhanced user data interface that includes Firebase user info
export interface UserData {
  uid: string;
  username: string;
  email: string;
  grade: string;
  gradeDisplayName: string;
  level: string;
  levelDisplayName: string;
  isFirstTime: boolean;
  createdAt: Date;
  lastLoginAt: Date;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserData: (data: Partial<UserData>) => Promise<void>;
  initializeOneTapSignIn: () => void;
  hasGoogleAccount: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasGoogleAccount, setHasGoogleAccount] = useState(false);

  // Debug logging for incognito mode issues
  useEffect(() => {
    console.log('🔍 Auth Provider Debug Info:');
    console.log('🔍 User Agent:', navigator.userAgent);
    console.log('🔍 Local Storage Available:', typeof Storage !== 'undefined' && localStorage);
    console.log('🔍 Session Storage Available:', typeof Storage !== 'undefined' && sessionStorage);
    console.log('🔍 Firebase Auth Available:', !!auth);
    console.log('🔍 Environment:', {
      NODE_ENV: import.meta.env.NODE_ENV,
      VITE_FIREBASE_API_KEY: !!import.meta.env.VITE_FIREBASE_API_KEY,
      VITE_GOOGLE_CLIENT_ID: !!import.meta.env.VITE_GOOGLE_CLIENT_ID
    });

    // Set appropriate persistence based on browser capabilities
    const setupPersistence = async () => {
      try {
        // Check if localStorage is available
        const testKey = '__test_storage__';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        
        // Use local persistence if localStorage is available
        console.log('🔍 Setting Firebase Auth persistence to LOCAL');
        await setPersistence(auth, browserLocalPersistence);
      } catch (e) {
        // Fall back to session persistence in incognito mode
        console.log('🔍 LocalStorage not available, using SESSION persistence');
        try {
          await setPersistence(auth, browserSessionPersistence);
        } catch (sessionError) {
          console.error('🚨 Could not set any persistence:', sessionError);
        }
      }
    };

    setupPersistence();
  }, []);

  useEffect(() => {
    console.log('🔍 Setting up Firebase Auth state listener...');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔍 Firebase Auth state changed:', user ? 'User logged in' : 'User logged out');
      setUser(user);
      
      if (user) {
        console.log('🔍 Loading user data for:', user.uid);
        // Load user data from Firestore
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data() as UserData;
            console.log('🔍 User data loaded successfully:', data);
            setUserData(data);
            
            // Check if user signed in with Google
            const isGoogleUser = user.providerData.some(provider => provider.providerId === 'google.com');
            setHasGoogleAccount(isGoogleUser);
            console.log('🔍 Is Google user:', isGoogleUser);
            
            // Update last login
            await updateDoc(userDocRef, {
              lastLoginAt: new Date()
            });
          } else {
            // New user, set initial data
            const newUserData: UserData = {
              uid: user.uid,
              username: user.displayName || '',
              email: user.email || '',
              grade: '',
              gradeDisplayName: '',
              level: '',
              levelDisplayName: '',
              isFirstTime: true,
              createdAt: new Date(),
              lastLoginAt: new Date()
            };
            
            await setDoc(userDocRef, newUserData);
            setUserData(newUserData);
            
            // Check if user signed in with Google
            const isGoogleUser = user.providerData.some(provider => provider.providerId === 'google.com');
            setHasGoogleAccount(isGoogleUser);
          }
        } catch (error) {
          console.error('🚨 Error loading user data:', error);
          // Don't throw the error, but set loading to false so the app doesn't hang
          setLoading(false);
          return;
        }
      } else {
        console.log('🔍 No user, clearing user data');
        setUserData(null);
        setHasGoogleAccount(false);
      }
      
      console.log('🔍 Auth loading complete');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Error signing in with email:', error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, username: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update the user's profile with the username
      await updateProfile(userCredential.user, {
        displayName: username
      });
      
    } catch (error) {
      console.error('Error signing up with email:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      
      // Clear all user-specific localStorage data to prevent data leakage between users
      clearUserSpecificLocalStorageData();
      
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  // Helper function to clear all user-specific localStorage data on logout
  const clearUserSpecificLocalStorageData = () => {
    try {
      console.log('🧹 Clearing user-specific localStorage data on logout...');
      
      // Clear pet-related data
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (
          // Pet data service keys
          key === 'litkraft_pet_data' ||
          key === 'litkraft_coins' ||
          key === 'litkraft_cumulative_coins_earned' ||
          key === 'current_pet' ||
          key === 'pet_sleep_data' ||
          key === 'pet_last_reset_time' ||
          key === 'pet_feeding_streak_data' ||
          key === 'previous_care_stage' ||
          key === 'owned_dens' ||
          key === 'owned_accessories' ||
          
          // Pet progress storage keys
          key.startsWith('litkraft_pet_progress_') ||
          key === 'litkraft_global_pet_settings' ||
          key === 'litkraft_pending_pet_syncs' ||
          
          // Adventure and quest data
          key.startsWith('litkraft_user_adventures_') ||
          key === 'current_adventure_id' ||
          key === 'cached_adventure_images' ||
          key === 'litkraft_question_progress' ||
          
          // Tutorial and user progress data
          key === 'litkraft_tutorial_data' ||
          
          // Any other litkraft user-specific keys
          key.startsWith('litkraft_') ||
          key.startsWith('user_') ||
          key.startsWith('pet_')
        ) {
          console.log(`🗑️ Clearing localStorage key: ${key}`);
          localStorage.removeItem(key);
        }
      });
      
      console.log('✅ Successfully cleared user-specific localStorage data');
    } catch (error) {
      console.warn('⚠️ Error clearing localStorage data on logout:', error);
    }
  };

  const updateUserData = async (data: Partial<UserData>) => {
    if (!user) throw new Error('No user authenticated');
    
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, data);
      
      // Update local state
      setUserData(prev => prev ? { ...prev, ...data } : null);
    } catch (error) {
      console.error('Error updating user data:', error);
      throw error;
    }
  };

  // Handle One Tap Sign-in credential response
  const handleOneTapSignIn = async (response: any) => {
    try {
      // Create Google Auth Provider credential from the One Tap response
      const credential = GoogleAuthProvider.credential(response.credential);
      
      // Sign in with the credential
      await signInWithCredential(auth, credential);
    } catch (error) {
      console.error('Error with One Tap sign-in:', error);
      throw error;
    }
  };

  // Initialize Google One Tap Sign-in
  const initializeOneTapSignIn = () => {
    if (!window.google || !import.meta.env.VITE_FIREBASE_API_KEY) {
      console.warn('Google Identity Services not available or Firebase config missing');
      return;
    }

    try {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_FIREBASE_API_KEY;
      
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleOneTapSignIn,
        auto_select: hasGoogleAccount, // Auto-select if user has Google account
        context: 'signin',
        ux_mode: 'popup',
        cancel_on_tap_outside: false
      });

      // Only show the prompt if user is not already signed in
      if (!user) {
        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            console.log('One Tap prompt was not displayed or skipped');
          }
        });
      }
    } catch (error) {
      console.error('Error initializing One Tap Sign-in:', error);
    }
  };

  const value: AuthContextType = {
    user,
    userData,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    updateUserData,
    initializeOneTapSignIn,
    hasGoogleAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
