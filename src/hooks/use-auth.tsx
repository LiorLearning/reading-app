import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { 
  User, 
  signInWithPopup, 
  GoogleAuthProvider, 
  OAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signInWithCredential,
  signInAnonymously,
  linkWithCredential,
  EmailAuthProvider,
  linkWithPopup,
  reload
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, runTransaction, Timestamp, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { stateStoreApi } from '@/lib/state-store-api';
import { CoinSystem } from '@/pages/coinSystem';
import { PetProgressStorage } from '@/lib/pet-progress-storage';
import { PetDataService } from '@/lib/pet-data-service';
import analytics from '@/lib/analytics';
import { autoMigrateOnLogin } from '@/lib/firebase-data-migration';

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
  age?: number;
  gender?: 'male' | 'female';
  grade: string;
  gradeDisplayName: string;
  level: string;
  levelDisplayName: string;
  isFirstTime: boolean;
  createdAt: Date;
  lastLoginAt: Date;
  country?: string;
  countryCode?: string;
  schoolCode?: number;
  schoolCodeSetAt?: Date;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
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
    let initialAuthResolved = false;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);

      // Mark initial auth resolution
      if (!initialAuthResolved) {
        initialAuthResolved = true;
        // If still no user after restoration, start anonymous session now
        if (!user) {
          try { await signInAnonymously(auth); } catch {}
          return;
        }
      }

      if (user) {
        // Identify in analytics
        try { analytics.identify(user.uid, { is_anonymous: user.isAnonymous }); } catch {}
        try {
          if (!user.isAnonymous) localStorage.setItem('previouslysignedin', '1');
        } catch {}

        setHasGoogleAccount(user.providerData.some(provider => provider.providerId === 'google.com'));

        // 1. Profile Load & Throttled Updates
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const data = userDoc.data() as UserData;
            const updates: Record<string, any> = {};
            const now = new Date();

            // Throttled lastLoginAt update (once per hour)
            const lastLogin = data.lastLoginAt ? (data.lastLoginAt as any).toDate() : new Date(0);
            if (now.getTime() - lastLogin.getTime() > 3600 * 1000) {
               updates.lastLoginAt = serverTimestamp();
            }

            // Backfill email if needed
            try {
              const authEmail = user.email || '';
              const docEmail = (data?.email || '').trim();
              if (!user.isAnonymous && authEmail && authEmail !== docEmail) {
                updates.email = authEmail;
                data.email = authEmail;
              }
            } catch {}

            if (Object.keys(updates).length > 0) {
               try { await updateDoc(userDocRef, updates); } catch (e) { console.warn('Profile update failed', e); }
            }
            setUserData(data);
            try { autoMigrateOnLogin(user.uid); } catch {}
          } else {
             // New User Creation
            const newUserData: UserData = {
              uid: user.uid,
              username: user.displayName || '',
              email: user.email || '',
              grade: 'assignment',
              gradeDisplayName: 'assignment',
              level: 'start',
              levelDisplayName: 'Start Level',
              isFirstTime: true,
              createdAt: new Date(),
              lastLoginAt: serverTimestamp() as any
            };
            await setDoc(userDocRef, newUserData);
            setUserData(newUserData);
            try { autoMigrateOnLogin(user.uid); } catch {}
          }
        } catch (error) {
          console.error('Error loading user profile:', error);
        }

        // 2. Fetch State & Quests (Single Fetch)
        try {
            const [userStateSnap, dailyQuestsSnap] = await Promise.all([
                getDoc(doc(db, 'userStates', user.uid)),
                getDoc(doc(db, 'dailyQuests', user.uid))
            ]);

            const userStateData = userStateSnap.exists() ? userStateSnap.data() : {};
            const dailyQuestsData = dailyQuestsSnap.exists() ? dailyQuestsSnap.data() : {};

            // --- Process User State ---
            const coins = Number(userStateData.coins ?? 0);
            CoinSystem.setCoins(coins);
            window.dispatchEvent(new CustomEvent('coinsChanged', { detail: { coins } }));

            // Lifetime coins
             try {
                const petsMap = (userStateData?.pets || {}) as Record<string, number>;
                const totalQuestions = Object.values(petsMap).reduce((acc, v) => acc + Number(v || 0), 0);
                localStorage.setItem('litkraft_cumulative_coins_earned', String(totalQuestions * 10));
             } catch {}

            // Streak
            const streakVal = Number(userStateData.streak ?? 0);
            localStorage.setItem('litkraft_streak', String(streakVal));
            window.dispatchEvent(new CustomEvent('streakChanged', { detail: { streak: streakVal } }));

            // Weekly Hearts
            const weeklyHearts = (userStateData?.weeklyHearts || {}) as Record<string, Record<string, boolean>>;
            localStorage.setItem('litkraft_weekly_hearts', JSON.stringify(weeklyHearts));
            window.dispatchEvent(new CustomEvent('weeklyHeartsUpdated', { detail: weeklyHearts }));

            // Pets Ownership & Levels
            const names = (userStateData?.petnames || {}) as Record<string, string>;
            const ownedPets = Object.keys((Object.keys(names).length > 0 ? names : (userStateData.pets ?? {})));

            ownedPets.forEach(petId => {
                const totalCorrect = Number(userStateData.pets?.[petId] ?? 0);
                const petCoins = totalCorrect * 10;
                const petData = PetProgressStorage.getPetProgress(petId, petId);
                petData.generalData.isOwned = true;
                petData.levelData.totalAdventureCoinsEarned = petCoins;

                if (petCoins >= 300) petData.levelData.currentLevel = 5;
                else if (petCoins >= 200) petData.levelData.currentLevel = 4;
                else if (petCoins >= 120) petData.levelData.currentLevel = 3;
                else if (petCoins >= 50) petData.levelData.currentLevel = 2;
                else petData.levelData.currentLevel = 1;

                const nm = names[petId];
                if (nm && nm.trim()) petData.petName = nm.trim();

                // Sync daily coins
                try {
                    const today = new Date().toISOString().slice(0, 10);
                    petData.dailyCoins = petData.dailyCoins || { todayDate: today, todayCoins: 0 };
                    petData.dailyCoins.todayDate = today;
                    petData.dailyCoins.todayCoins = petCoins;
                } catch {}

                PetProgressStorage.setPetProgress(petData);
                PetDataService.addOwnedPet(petId);
            });

            // Ensure selection
             try {
                if (!PetProgressStorage.getCurrentSelectedPet() && ownedPets.length > 0) {
                    PetProgressStorage.setCurrentSelectedPet(ownedPets[0]);
                }
            } catch {}

            // --- Process Daily Quests ---
            const seq = ['house', 'friend', 'dressing-competition', 'who-made-the-pets-sick', 'travel', 'food', 'plant-dreams', 'pet-school', 'pet-theme-park', 'pet-mall', 'pet-care', 'story'];
            const target = 5;

            // Use ownedPets derived from userState to filter/map dailyQuests
            const states = ownedPets.map((pet) => {
                const petObj = (dailyQuestsData?.[pet] ?? {}) as any;
                const index = Number(petObj?._activityIndex ?? 0) % seq.length;
                const indexKey = seq[index];

                const cuAny: any = petObj?._cooldownUntil || null;
                const cuMs = cuAny?.toMillis ? cuAny.toMillis() : (cuAny ? new Date(cuAny).getTime() : 0);
                const petHasActiveCooldown = Boolean(cuMs && Date.now() < cuMs);

                const userAct = (dailyQuestsData?._userCurrentActivity || seq[0]) as string;
                const pointerKey = (userAct) ? userAct : indexKey;
                const lastCompleted = (petObj?._lastCompletedActivity) ? petObj._lastCompletedActivity : indexKey;

                const effectiveKey = petHasActiveCooldown ? lastCompleted : pointerKey;
                const prog = Number(petObj?.[effectiveKey] ?? 0);

                return {
                    pet,
                    activity: effectiveKey,
                    progress: prog,
                    target,
                    completed: prog >= target,
                    activityIndex: index,
                    cooldownUntil: petObj?._cooldownUntil ?? null,
                    sleepStartAt: petObj?._sleepStartAt || null,
                    sleepEndAt: petObj?._sleepEndAt || null
                };
            });

            localStorage.setItem('litkraft_daily_quests_state', JSON.stringify(states));
            window.dispatchEvent(new CustomEvent('dailyQuestsUpdated', { detail: states }));

             // Derived data (Streaks, User Todo, Sadness) from DailyQuests
            try {
                // Streaks
                const perPet: Record<string, number> = {};
                const perPetSlots: Record<string, number[]> = {};
                ownedPets.forEach(p => {
                    const v = Number(((dailyQuestsData?.[p] || {}) as any)?.streak || 0);
                    perPet[p] = v;
                    const slots = ((dailyQuestsData?.[p] || {}) as any)?.streakSlots;
                    if (Array.isArray(slots) && slots.length === 5) perPetSlots[p] = slots.map((x: any) => Number(x) ? 1 : 0);
                });
                localStorage.setItem('litkraft_pet_streaks', JSON.stringify(perPet));
                localStorage.setItem('litkraft_pet_streak_slots', JSON.stringify(perPetSlots));
            } catch {}

             // User Todo
            try {
               const userAct = (dailyQuestsData?._userCurrentActivity || seq[0]) as string;
               const lastSwitchAny = dailyQuestsData?._userLastSwitchAt;
               const lastSwitchMs = lastSwitchAny?.toMillis ? lastSwitchAny.toMillis() : Date.now();
               const todoData = { activity: userAct, lastSwitchTime: lastSwitchMs };
               localStorage.setItem('litkraft_user_todo', JSON.stringify(todoData));
               window.dispatchEvent(new CustomEvent('userTodoUpdated', { detail: todoData }));
            } catch {}

            // Sadness
            try {
               const today = new Date().toISOString().slice(0, 10);
               if (dailyQuestsData?._sadness?.date) {
                  localStorage.setItem('litkraft_daily_sadness', JSON.stringify(dailyQuestsData._sadness));
                  window.dispatchEvent(new CustomEvent('dailySadnessUpdated', { detail: dailyQuestsData._sadness }));
               }
                // Check assignment needed?
               if (dailyQuestsData?._sadness?.date !== today) {
                   stateStoreApi.ensureDailySadnessAssigned(user.uid).catch(() => {});
               }
               if (dailyQuestsData?._sadForce?.date) {
                  const forcedList = Array.isArray(dailyQuestsData._sadForce.pets) ? dailyQuestsData._sadForce.pets : Object.keys(dailyQuestsData._sadForce.pets || {});
                  localStorage.setItem('litkraft_forced_sad_pets', JSON.stringify({ date: dailyQuestsData._sadForce.date, pets: forcedList }));
                  window.dispatchEvent(new CustomEvent('dailyForcedSadUpdated', { detail: { date: dailyQuestsData._sadForce.date, pets: forcedList } }));
               }
            } catch {}

             // Sleep Data
            try {
                states.forEach(s => {
                   const endMs = s.sleepEndAt?.toMillis ? s.sleepEndAt.toMillis() : (s.sleepEndAt ? new Date(s.sleepEndAt).getTime() : 0);
                   const startMs = s.sleepStartAt?.toMillis ? s.sleepStartAt.toMillis() : (s.sleepStartAt ? new Date(s.sleepStartAt).getTime() : 0);
                   if (endMs && Date.now() < endMs) {
                       localStorage.setItem(`pet_sleep_data_${s.pet}`, JSON.stringify({ clicks: 3, timestamp: startMs, sleepStartTime: startMs, sleepEndTime: endMs }));
                   } else {
                       localStorage.removeItem(`pet_sleep_data_${s.pet}`);
                   }
                });
            } catch {}

            // Rollover Check
            try {
               const nowMs = Date.now();
               const needsRollover = states.some(s => {
                   const completed = s.completed;
                   const cuMs = s.cooldownUntil?.toMillis ? s.cooldownUntil.toMillis() : 0;
                   return completed && (!cuMs || nowMs >= cuMs);
               });
               if (needsRollover) {
                   stateStoreApi.handleDailyQuestRollover({ userId: user.uid, ownedPets });
               }
            } catch {}

        } catch (e) {
             console.error("Failed to load initial game state", e);
        }
        
        // Fire-and-forget streak normalization
        stateStoreApi.updateVisitAndNormalizeStreaks(user.uid).catch(() => {});

      } else {
        setUserData(null);
        setHasGoogleAccount(false);
      }

      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const current = auth.currentUser;
      if (current && current.isAnonymous) {
        try {
          // Link Google to the current anonymous user to preserve UID
          const linkedCred = await linkWithPopup(current, provider);
          // Ensure email is persisted to Firestore immediately on upgrade
          try {
            await reload(linkedCred.user);
          } catch {}
          try {
            const userDocRef = doc(db, 'users', linkedCred.user.uid);
            const emailNow = (linkedCred.user.email || '').trim();
            if (emailNow) {
              await updateDoc(userDocRef, { email: emailNow, lastLoginAt: serverTimestamp() });
            }
          } catch (e) {
            console.warn('Failed to persist email after Google link:', e);
          }
        } catch (error: any) {
          // If the Google credential already belongs to an existing account, just sign into it
          const code = (error && (error.code || error?.message)) || '';
          if (
            String(code).includes('auth/credential-already-in-use') ||
            String(code).includes('auth/email-already-in-use') ||
            String(code).includes('auth/account-exists-with-different-credential')
          ) {
            const cred = GoogleAuthProvider.credentialFromError?.(error);
            if (cred) {
              await signInWithCredential(auth, cred);
              return;
            }
          }
          throw error;
        }
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signInWithApple = async () => {
    const provider = new OAuthProvider('apple.com');
    
    // Add scopes for name and email
    provider.addScope('email');
    provider.addScope('name');
    
    try {
      const current = auth.currentUser;
      if (current && current.isAnonymous) {
        try {
          // Link Apple to the current anonymous user to preserve UID
          const linkedCred = await linkWithPopup(current, provider);
          
          // Ensure email is persisted to Firestore immediately on upgrade
          try {
            await reload(linkedCred.user);
          } catch {}
          try {
            const userDocRef = doc(db, 'users', linkedCred.user.uid);
            const emailNow = (linkedCred.user.email || '').trim();
            if (emailNow) {
              await updateDoc(userDocRef, { email: emailNow, lastLoginAt: serverTimestamp() });
            }
          } catch (e) {
            console.warn('Failed to persist email after Apple link:', e);
          }
        } catch (error: any) {
          // If the Apple credential already belongs to an existing account, just sign into it
          const code = (error && (error.code || error?.message)) || '';
          if (
            String(code).includes('auth/credential-already-in-use') ||
            String(code).includes('auth/email-already-in-use') ||
            String(code).includes('auth/account-exists-with-different-credential')
          ) {
            // Sign out the anonymous user first, then sign in with Apple
            try {
              await firebaseSignOut(auth);
            } catch {}
            await signInWithPopup(auth, provider);
            return;
          }
          // Handle popup closed by user or other cancellations
          if (
            String(code).includes('auth/popup-closed-by-user') ||
            String(code).includes('auth/cancelled-popup-request') ||
            String(code).includes('auth/popup-blocked')
          ) {
            throw new Error('Sign-in cancelled');
          }
          throw error;
        }
      } else {
        // Sign in normally if not anonymous
        await signInWithPopup(auth, provider);
      }
    } catch (error: any) {
      // Handle popup closed by user or other cancellations
      const code = (error && (error.code || error?.message)) || '';
      if (
        String(code).includes('auth/popup-closed-by-user') ||
        String(code).includes('auth/cancelled-popup-request') ||
        String(code).includes('auth/popup-blocked')
      ) {
        throw new Error('Sign-in cancelled');
      }
      console.error('Error signing in with Apple:', error);
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

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      const current = auth.currentUser;
      if (current && current.isAnonymous) {
        // Upgrade anonymous user to email/password while preserving UID
        const credential = EmailAuthProvider.credential(email, password);
        const linkedUser = await linkWithCredential(current, credential);
        // Immediately reflect email on the user's Firestore document
        try {
          await reload(linkedUser.user);
        } catch {}
        try {
          const userDocRef = doc(db, 'users', linkedUser.user.uid);
          const emailNow = (linkedUser.user.email || email || '').trim();
          if (emailNow) {
            await updateDoc(userDocRef, { email: emailNow, lastLoginAt: serverTimestamp() });
          }
        } catch (e) {
          console.warn('Failed to persist email after linkWithCredential:', e);
        }
        // Clear guest gating flags after successful upgrade
        try {
          localStorage.removeItem('guest_signup_gate_open');
          localStorage.removeItem('guest_prompt_count');
        } catch {}
      } else {
        // No anonymous session: fall back to normal sign-up
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Clear guest gating flags after successful sign-up
        try {
          localStorage.removeItem('guest_signup_gate_open');
          localStorage.removeItem('guest_prompt_count');
        } catch {}
      }
    } catch (error) {
      console.error('Error signing up with email:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      try { analytics.reset(); } catch {}
      // Local cleanup to avoid showing previous user's state
      try {
        // Preserve previouslysignedin flag across clears
        let preservePrevSignedIn = '0';
        try {
          const current = auth.currentUser;
          const existing = (typeof localStorage !== 'undefined') ? (localStorage.getItem('previouslysignedin') || '0') : '0';
          // If there is an existing real account marker or current user wasn't anonymous, keep it
          preservePrevSignedIn = (!current || current.isAnonymous) ? existing : '1';
        } catch {}
        // Reset local pet progress storage and selection
        PetProgressStorage.resetAllPetData();
        // Clear all local and session storage to prevent leaking prior user state
        try { localStorage.clear(); } catch {}
        // Restore the preserved flag
        try { localStorage.setItem('previouslysignedin', preservePrevSignedIn); } catch {}
        try { sessionStorage.clear(); } catch {}
        // Clear Cache Storage and unregister any service workers
        try {
          if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map((name) => caches.delete(name)));
          }
        } catch {}
        try {
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
          }
        } catch {}
        // Notify listeners
        window.dispatchEvent(new CustomEvent('coinsChanged', { detail: { coins: 0 } }));
        window.dispatchEvent(new CustomEvent('dailyQuestsUpdated', { detail: [] }));
        window.dispatchEvent(new CustomEvent('streakChanged', { detail: { streak: 0 } }));
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
      const current = auth.currentUser;
      if (current && current.isAnonymous) {
        try {
          // Link One Tap Google credential to the current anonymous user to preserve UID
          const linkedUser = await linkWithCredential(current, credential);
          // Ensure email is persisted to Firestore immediately on upgrade
          try {
            await reload(linkedUser.user);
          } catch {}
          try {
            const userDocRef = doc(db, 'users', linkedUser.user.uid);
            const emailNow = (linkedUser.user.email || '').trim();
            if (emailNow) {
              await updateDoc(userDocRef, { email: emailNow, lastLoginAt: serverTimestamp() });
            }
          } catch (e) {
            console.warn('Failed to persist email after One Tap link:', e);
          }
        } catch (error: any) {
          // If the credential is already attached to another account, just sign into that account
          const code = (error && (error.code || error?.message)) || '';
          if (
            String(code).includes('auth/credential-already-in-use') ||
            String(code).includes('auth/email-already-in-use') ||
            String(code).includes('auth/account-exists-with-different-credential')
          ) {
            // For One Tap we already have the credential; sign in with it
            await signInWithCredential(auth, credential);
            return;
          }
          throw error;
        }
      } else {
        // Sign in normally if not anonymous
        await signInWithCredential(auth, credential);
      }
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
        use_fedcm_for_prompt: true,
        auto_select: hasGoogleAccount, // Auto-select if user has Google account
        context: 'signin',
        ux_mode: 'popup',
        cancel_on_tap_outside: false
      });

      // Only show the prompt if user is not already signed in
      if (!user) {
        window.google.accounts.id.prompt();
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
    signInWithApple,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    updateUserData,
    initializeOneTapSignIn,
    hasGoogleAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
