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
  signInWithCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { stateStoreReader } from '@/lib/state-store-api';
import { CoinSystem } from '@/pages/coinSystem';
import { PetProgressStorage } from '@/lib/pet-progress-storage';
import { PetDataService } from '@/lib/pet-data-service';

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

  useEffect(() => {
    let unsubscribeUserState: (() => void) | null = null;
    let unsubscribeDailyQuests: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        // Load user data from Firestore
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data() as UserData;
            setUserData(data);
            
            // Check if user signed in with Google
            const isGoogleUser = user.providerData.some(provider => provider.providerId === 'google.com');
            setHasGoogleAccount(isGoogleUser);
            
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

          // Daily quest bootstrap removed per product requirement to avoid writes on refresh
        } catch (error) {
          console.error('Error loading user data:', error);
        }

        // Read-only hydration from Firestore to local UI stores (no writes to Firestore)
        try {
          const overview = await stateStoreReader.fetchUserOverview(user.uid);
          if (overview) {
            // Coins and streak
            CoinSystem.setCoins(overview.coins);

            // Pets: mark owned and hydrate progress/levels from total correct answers
            const petIds = Object.keys(overview.pets || {});
            const ensureLevelFromCoins = (coins: number): number => {
              if (coins >= 300) return 5;
              if (coins >= 200) return 4;
              if (coins >= 120) return 3;
              if (coins >= 50) return 2;
              return 1;
            };
            for (const petId of petIds) {
              const info = overview.pets[petId];
              const petCoins = (info?.totalCorrect || 0) * 10; // 10 coins per question
              const petData = PetProgressStorage.getPetProgress(petId, petId);
              petData.generalData.isOwned = true;
              petData.levelData.totalAdventureCoinsEarned = petCoins;
              const newLevel = ensureLevelFromCoins(petCoins);
              petData.levelData.currentLevel = newLevel;
              try {
                const today = new Date().toISOString().slice(0, 10);
                petData.dailyCoins = petData.dailyCoins || { todayDate: today, todayCoins: 0 };
                petData.dailyCoins.todayDate = today;
                petData.dailyCoins.todayCoins = petCoins; // reflect Firestore-derived coins for consistent avatar
              } catch {}
              PetProgressStorage.setPetProgress(petData);
              // Ensure local owned pets list is hydrated for UI selectors
              try { PetDataService.addOwnedPet(petId); } catch {}
            }

            // Select first owned pet if none selected
            try {
              const currentSelected = PetProgressStorage.getCurrentSelectedPet();
              if (!currentSelected && petIds.length > 0) {
                PetProgressStorage.setCurrentSelectedPet(petIds[0]);
              }
            } catch {}
          }

          // Daily quest pet-wise states (read-only)
          try {
            const questStates = await stateStoreReader.fetchDailyQuestCompletionStates(user.uid);
            // Store locally for UI consumers; fire an event as well
            localStorage.setItem('litkraft_daily_quests_state', JSON.stringify(questStates));
            // Seed sleep window from server on initial sign-in
            try {
              const now = Date.now();
              // Prefer current pet, else any active sleep
              const currentPet = PetProgressStorage.getCurrentSelectedPet();
              let s = currentPet ? questStates.find(x => x.pet === currentPet) : null;
              if (!s) s = questStates.find(x => (x as any).sleepEndAt);
              const endAny = s?.sleepEndAt as any;
              const startAny = s?.sleepStartAt as any;
              const endMs = endAny?.toMillis ? endAny.toMillis() : (endAny ? new Date(endAny).getTime() : 0);
              const startMs = startAny?.toMillis ? startAny.toMillis() : (startAny ? new Date(startAny).getTime() : 0);
              if (endMs && now < endMs) {
                localStorage.setItem('pet_sleep_data', JSON.stringify({ clicks: 3, timestamp: startMs || now, sleepStartTime: startMs || now, sleepEndTime: endMs }));
              }
            } catch {}
            window.dispatchEvent(new CustomEvent('dailyQuestsUpdated', { detail: questStates }));
          } catch (e) {
            console.warn('Failed fetching daily quest states:', e);
          }
        } catch (e) {
          console.warn('Hydration from Firestore failed:', e);
        }

        // Live listeners (real-time updates)
        try {
          const seq = ['house','friend','travel','food','plant-dreams','story'];
          const target = 5;
          let ownedPets: string[] = [];

          // UserState live: coins + owned pets + per-pet levels
          unsubscribeUserState = onSnapshot(doc(db, 'userStates', user.uid), (snap) => {
            const d = snap.data() as any;
            if (!d) return;
            // Coins
            CoinSystem.setCoins(Number(d.coins ?? 0));
            // Owned pets
            ownedPets = Object.keys(d.pets ?? {});
            // Hydrate levels
            for (const petId of ownedPets) {
              const totalCorrect = Number(d.pets?.[petId] ?? 0);
              const petCoins = totalCorrect * 10;
              const petData = PetProgressStorage.getPetProgress(petId, petId);
              petData.generalData.isOwned = true;
              petData.levelData.totalAdventureCoinsEarned = petCoins;
              if (petCoins >= 300) petData.levelData.currentLevel = 5; else if (petCoins >= 200) petData.levelData.currentLevel = 4; else if (petCoins >= 120) petData.levelData.currentLevel = 3; else if (petCoins >= 50) petData.levelData.currentLevel = 2; else petData.levelData.currentLevel = 1;
              try {
                const today = new Date().toISOString().slice(0, 10);
                petData.dailyCoins = petData.dailyCoins || { todayDate: today, todayCoins: 0 };
                petData.dailyCoins.todayDate = today;
                petData.dailyCoins.todayCoins = petCoins; // keep avatar emotion in sync globally
              } catch {}
              PetProgressStorage.setPetProgress(petData);
              // Keep local pet list in sync for selector
              try { PetDataService.addOwnedPet(petId); } catch {}
            }
          });

          // DailyQuests live: quest progress bar
          unsubscribeDailyQuests = onSnapshot(doc(db, 'dailyQuests', user.uid), (snap) => {
            const d = (snap.data() as any) || {};
            if (!ownedPets || ownedPets.length === 0) {
              ownedPets = Object.keys((d || {})).filter((k) => k !== 'createdAt' && k !== 'updatedAt');
            }
            const states = ownedPets.map((pet) => {
              const petObj = (d?.[pet] ?? {}) as any;
              const index = Number(petObj?._activityIndex ?? 0) % seq.length;
              const key = seq[index];
              const prog = Number(petObj?.[key] ?? 0);
              const sleepStartAt = petObj?._sleepStartAt || null;
              const sleepEndAt = petObj?._sleepEndAt || null;
              return { pet, activity: key, progress: prog, target, completed: prog >= target, activityIndex: index, cooldownUntil: petObj?._cooldownUntil ?? null, sleepStartAt, sleepEndAt };
            });
            try {
              localStorage.setItem('litkraft_daily_quests_state', JSON.stringify(states));
              // If server has a live sleep window for the current pet, mirror to local sleep store for timer
              try {
                const currentPet = PetProgressStorage.getCurrentSelectedPet() || ownedPets[0];
                const s = states.find(x => x.pet === currentPet);
                if (s?.sleepStartAt && s?.sleepEndAt) {
                  const startMs = (s.sleepStartAt as any).toMillis ? (s.sleepStartAt as any).toMillis() : new Date(s.sleepStartAt as any).getTime();
                  const endMs = (s.sleepEndAt as any).toMillis ? (s.sleepEndAt as any).toMillis() : new Date(s.sleepEndAt as any).getTime();
                  if (Date.now() < endMs) {
                    localStorage.setItem('pet_sleep_data', JSON.stringify({ clicks: 3, timestamp: startMs, sleepStartTime: startMs, sleepEndTime: endMs }));
                  } else {
                    localStorage.removeItem('pet_sleep_data');
                  }
                }
              } catch {}
            } catch {}
            window.dispatchEvent(new CustomEvent('dailyQuestsUpdated', { detail: states }));

            // Enable sleep when the CURRENT pet's daily quest progress >= 5
            try {
              const currentPet = PetProgressStorage.getCurrentSelectedPet() || ownedPets[0];
              const currentState = states.find(s => s.pet === currentPet);
              if (currentState && currentState.progress >= target) {
                const data = PetDataService.getPetData();
                const { adventureCoinsAtLastSleep } = data.cumulativeCareLevel;
                // Ensure coins since last sleep >= 50 so isSleepAvailable() becomes true
                PetDataService.setPetData({
                  cumulativeCareLevel: {
                    ...data.cumulativeCareLevel,
                    adventureCoins: Math.max(data.cumulativeCareLevel.adventureCoins, adventureCoinsAtLastSleep + 50)
                  }
                });
              }
            } catch {}
          });
        } catch (e) {
          console.warn('Failed to attach realtime listeners:', e);
        }
      } else {
        setUserData(null);
        setHasGoogleAccount(false);
        // Cleanup live listeners on sign-out
        try {
          if (unsubscribeUserState) { unsubscribeUserState(); unsubscribeUserState = null; }
          if (unsubscribeDailyQuests) { unsubscribeDailyQuests(); unsubscribeDailyQuests = null; }
        } catch {}
      }
      
      setLoading(false);
    });

    return () => {
      try { if (unsubscribeUserState) unsubscribeUserState(); } catch {}
      try { if (unsubscribeDailyQuests) unsubscribeDailyQuests(); } catch {}
      unsubscribe();
    };
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
      // Local cleanup to avoid showing previous user's state
      try {
        // Reset local pet progress storage and selection
        PetProgressStorage.resetAllPetData();
        try { localStorage.removeItem('current_pet'); } catch {}
        try { localStorage.removeItem('pet_sleep_data'); } catch {}
        try { localStorage.removeItem('litkraft_daily_quests_state'); } catch {}
        try { localStorage.removeItem('litkraft_coins'); } catch {}
        try { localStorage.removeItem('litkraft_cumulative_coins_earned'); } catch {}
        try { localStorage.removeItem('litkraft_pet_data'); } catch {}
        // Notify listeners
        window.dispatchEvent(new CustomEvent('coinsChanged', { detail: { coins: 0 } }));
        window.dispatchEvent(new CustomEvent('dailyQuestsUpdated', { detail: [] }));
        window.dispatchEvent(new CustomEvent('currentPetChanged'));
      } catch {}
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
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
