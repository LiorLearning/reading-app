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
  signInAnonymously,
  linkWithCredential,
  EmailAuthProvider,
  linkWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, onSnapshot, runTransaction, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { stateStoreReader, stateStoreApi } from '@/lib/state-store-api';
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
    let unsubscribeUserState: (() => void) | null = null;
    let unsubscribeDailyQuests: (() => void) | null = null;
    let lastRolloverAttempt = 0; // throttle rollover writes
    let initialAuthResolved = false;
    let focusListener: ((this: Window, ev: Event) => any) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      // Mark initial auth resolution
      if (!initialAuthResolved) {
        initialAuthResolved = true;
        // If still no user after restoration, start anonymous session now
        if (!user) {
          try { await signInAnonymously(auth); } catch {}
          // onAuthStateChanged will fire again after anon sign-in
          return;
        }
      }
      
      if (user) {
        // Mark that this device has previously signed in with a real account
        try {
          if (!user.isAnonymous) {
            localStorage.setItem('previouslysignedin', '1');
          }
        } catch {}
        // Load user data from Firestore
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data() as UserData;
            // Backfill email if Auth has it and doc is missing/different
            try {
              const authEmail = user.email || '';
              const docEmail = (data?.email || '').trim();
              if (!user.isAnonymous && authEmail && authEmail !== docEmail) {
                await updateDoc(userDocRef, { email: authEmail });
                data.email = authEmail;
              }
            } catch {}
            setUserData(data);
            
            // Check if user signed in with Google
            const isGoogleUser = user.providerData.some(provider => provider.providerId === 'google.com');
            setHasGoogleAccount(isGoogleUser);
            
            // Transaction: update streak in userStates and lastLoginAt in users atomically
            try {
              await runTransaction(db, async (txn) => {
                const usersRef = userDocRef;
                const userStateRef = doc(db, 'userStates', user.uid);
                const usersSnap = await txn.get(usersRef);
                const userStateSnap = await txn.get(userStateRef);

                const now = new Date();
                const nowTs = Timestamp.fromDate(now);

                // previous lastLoginAt from users/{uid}
                let prevLoginMs: number | null = null;
                try {
                  const prev = (usersSnap.data() as any)?.lastLoginAt;
                  if (prev?.toMillis) prevLoginMs = prev.toMillis();
                  else if (prev) prevLoginMs = new Date(prev).getTime();
                } catch {}

                // current streak and lastStreakIncrementAt from userStates/{uid}
                const stateData = (userStateSnap.exists() ? userStateSnap.data() : null) as any;
                const currentStreak = Number(stateData?.streak ?? 0);
                const lastInc = stateData?.lastStreakIncrementAt;
                let lastIncMs: number | null = null;
                try {
                  if (lastInc?.toMillis) lastIncMs = lastInc.toMillis();
                  else if (lastInc) lastIncMs = new Date(lastInc).getTime();
                } catch {}

                const nowMs = now.getTime();
                const diffMs = prevLoginMs ? (nowMs - prevLoginMs) : null;

                // Apply rule: within 24h -> +1, else reset to 0
                let newStreak = 0;
                const within24h = diffMs !== null && diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000;

                if (within24h) {
                  // Optional guard: only increment once per 24h window
                  const guardOk = !lastIncMs || (nowMs - lastIncMs) > 24 * 60 * 60 * 1000;
                  newStreak = guardOk ? currentStreak + 1 : currentStreak;
                } else {
                  newStreak = 0;
                }

                // Initialize userState doc if missing
                if (!userStateSnap.exists()) {
                  txn.set(userStateRef, {
                    pets: {},
                    petnames: {},
                    petquestions: {},
                    coins: 0,
                    streak: newStreak,
                    lastStreakIncrementAt: within24h ? nowTs : (stateData?.lastStreakIncrementAt ?? null),
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                  });
                } else {
                  txn.update(userStateRef, {
                    streak: newStreak,
                    ...(within24h ? { lastStreakIncrementAt: nowTs } : {}),
                    updatedAt: Timestamp.now(),
                  });
                }

                // Always set users/{uid}.lastLoginAt to now
                txn.update(usersRef, { lastLoginAt: now });
              });
            } catch (e) {
              console.warn('Streak transaction failed:', e);
              // Fallback: still update lastLoginAt non-transactionally to avoid blocking sign in
              try { await updateDoc(userDocRef, { lastLoginAt: new Date() }); } catch {}
            }
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
            try {
              const streakVal = Number(overview.streak || 0);
              localStorage.setItem('litkraft_streak', String(streakVal));
              window.dispatchEvent(new CustomEvent('streakChanged', { detail: { streak: streakVal } }));
            } catch {}

            // Pets: mark owned and hydrate progress/levels from total correct answers
            const petIds = Object.keys(overview.pets || {});
            const ensureLevelFromCoins = (coins: number): number => {
              if (coins >= 300) return 5;
              if (coins >= 200) return 4;
              if (coins >= 120) return 3;
              if (coins >= 50) return 2;
              return 1;
            };
            // Load pet names map and apply to local storage
            let petNamesMap: Record<string, string> = {};
            try { petNamesMap = await stateStoreReader.getPetNames(user.uid) as any; } catch {}
            for (const petId of petIds) {
              const info = overview.pets[petId];
              const petCoins = (info?.totalCorrect || 0) * 10; // 10 coins per question
              const petData = PetProgressStorage.getPetProgress(petId, petId);
              petData.generalData.isOwned = true;
              petData.levelData.totalAdventureCoinsEarned = petCoins;
              const newLevel = ensureLevelFromCoins(petCoins);
              petData.levelData.currentLevel = newLevel;
              // Apply name from Firestore if available
              try {
                const nm = (petNamesMap && typeof petNamesMap[petId] === 'string') ? petNamesMap[petId] : undefined;
                if (nm && nm.trim()) {
                  petData.petName = nm.trim();
                } else {
                  // Backfill: if local has name and Firestore missing, persist once
                  const localName = petData.petName;
                  if (localName && localName.trim()) {
                    try { await stateStoreApi.setPetName({ userId: user.uid, pet: petId, name: localName.trim() }); } catch {}
                  }
                }
              } catch {}
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
            // Eagerly reflect completed daily quests in todayCoins for emotion rendering
            try {
              const today = new Date().toISOString().slice(0, 10);
              const targetCoins = 50; // 5 correct * 10 coins
              questStates.forEach((s: any) => {
                const prog = Number(s?.progress || 0);
                const petId = (s as any)?.pet;
                if (!petId) return;
                if (prog >= 5) {
                  const pd = PetProgressStorage.getPetProgress(petId, petId);
                  pd.dailyCoins = pd.dailyCoins || { todayDate: today, todayCoins: 0 };
                  if (pd.dailyCoins.todayDate !== today) {
                    pd.dailyCoins.todayDate = today;
                    pd.dailyCoins.todayCoins = 0;
                  }
                  if ((pd.dailyCoins.todayCoins || 0) < targetCoins) {
                    pd.dailyCoins.todayCoins = targetCoins;
                    PetProgressStorage.setPetProgress(pd);
                  }
                }
              });
            } catch {}
            // Seed sleep window from server on initial sign-in (per-pet keys)
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
                const petId = (s as any)?.pet || currentPet;
                if (petId) {
                  localStorage.setItem(`pet_sleep_data_${petId}`, JSON.stringify({ clicks: 3, timestamp: startMs || now, sleepStartTime: startMs || now, sleepEndTime: endMs }));
                }
              }
            } catch {}
            window.dispatchEvent(new CustomEvent('dailyQuestsUpdated', { detail: questStates }));

            // Ensure daily sadness assignment exists for today (progress-agnostic)
            try {
              const sad = await stateStoreApi.ensureDailySadnessAssigned(user.uid);
              // Mirror a compact local flag for UI gating without extra reads
              try { localStorage.setItem('litkraft_daily_sadness', JSON.stringify(sad)); } catch {}
              window.dispatchEvent(new CustomEvent('dailySadnessUpdated', { detail: sad }));
            } catch {}

            // Rollover on sign-in hydration if any pet completed and cooldown passed or missing
            try {
              const nowMs = Date.now();
              const needsRollover = questStates.some((s: any) => {
                const completed = Number(s?.progress || 0) >= 5;
                const cu: any = s?.cooldownUntil || null;
                const cuMs = cu?.toMillis ? cu.toMillis() : (cu ? new Date(cu).getTime() : null);
                return completed && (!cuMs || nowMs >= cuMs);
              });
              if (needsRollover) {
                lastRolloverAttempt = nowMs;
                const owned = questStates.map((x: any) => x.pet).filter(Boolean);
                await stateStoreApi.handleDailyQuestRollover({ userId: user.uid, ownedPets: owned });
              }
            } catch {}
          } catch (e) {
            console.warn('Failed fetching daily quest states:', e);
          }
        } catch (e) {
          console.warn('Hydration from Firestore failed:', e);
        }

        // Live listeners (real-time updates)
        try {
          const seq = ['house', 'friend', 'dressing-competition', 'who-made-the-pets-sick', 'travel', 'food', 'plant-dreams', 'story'];
          const target = 5;
          let ownedPets: string[] = [];

          // UserState live: coins + owned pets + per-pet levels
          unsubscribeUserState = onSnapshot(doc(db, 'userStates', user.uid), (snap) => {
            const d = snap.data() as any;
            if (!d) return;
            // Coins
            CoinSystem.setCoins(Number(d.coins ?? 0));
            // Derive lifetime user coins for top-right level bar from per-pet question counts (SpellBox-only)
            try {
              const petsMap = (d?.pets || {}) as Record<string, number>;
              const totalQuestions = Object.values(petsMap).reduce((acc, v) => acc + Number(v || 0), 0);
              const derivedLifetimeCoins = totalQuestions * 10; // 10 coins per question

              // Persist to localStorage where PetPage reads cumulative coins for level calc
              localStorage.setItem('litkraft_cumulative_coins_earned', String(derivedLifetimeCoins));

              // Nudge UI to refresh level bar (PetPage listens to this)
              window.dispatchEvent(new CustomEvent('coinsChanged', { detail: { coins: Number(d.coins ?? 0) } }));
            } catch (e) {
              console.warn('Failed to hydrate lifetime coins from pets map', e);
            }
            // Streak broadcast for UI
            try {
              const streakVal = Number(d.streak ?? 0);
              localStorage.setItem('litkraft_streak', String(streakVal));
              window.dispatchEvent(new CustomEvent('streakChanged', { detail: { streak: streakVal } }));
            } catch {}
            // Weekly hearts broadcast for UI (modal and others)
            try {
              const map = (d?.weeklyHearts || {}) as Record<string, Record<string, boolean>>;
              localStorage.setItem('litkraft_weekly_hearts', JSON.stringify(map));
              window.dispatchEvent(new CustomEvent('weeklyHeartsUpdated', { detail: map }));
            } catch {}

            // Sync pet names to local storage
            const names = (d?.petnames || {}) as Record<string, string>;
            // Owned pets (prefer petnames keys; fallback to pets counts)
            ownedPets = Object.keys((Object.keys(names).length > 0 ? names : (d.pets ?? {})));
            // Hydrate levels
            for (const petId of ownedPets) {
              const totalCorrect = Number(d.pets?.[petId] ?? 0);
              const petCoins = totalCorrect * 10;
              const petData = PetProgressStorage.getPetProgress(petId, petId);
              petData.generalData.isOwned = true;
              petData.levelData.totalAdventureCoinsEarned = petCoins;
              if (petCoins >= 300) petData.levelData.currentLevel = 5; else if (petCoins >= 200) petData.levelData.currentLevel = 4; else if (petCoins >= 120) petData.levelData.currentLevel = 3; else if (petCoins >= 50) petData.levelData.currentLevel = 2; else petData.levelData.currentLevel = 1;
              try {
                const nm = (names && typeof names[petId] === 'string') ? names[petId] : undefined;
                if (nm && nm.trim()) {
                  petData.petName = nm.trim();
                }
              } catch {}
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
              // Also expose sadness assignment if present
              try {
                const sad = (d?._sadness || null);
                if (sad && sad.date) {
                  localStorage.setItem('litkraft_daily_sadness', JSON.stringify(sad));
                  window.dispatchEvent(new CustomEvent('dailySadnessUpdated', { detail: sad }));
                }
              } catch {}
              // Mirror live sleep windows per-pet for the timer
              try {
                states.forEach((s) => {
                  const petId = (s as any)?.pet;
                  if (!petId) return;
                  const startMs = (s as any)?.sleepStartAt?.toMillis ? (s as any).sleepStartAt.toMillis() : (s as any)?.sleepStartAt ? new Date((s as any).sleepStartAt).getTime() : 0;
                  const endMs = (s as any)?.sleepEndAt?.toMillis ? (s as any).sleepEndAt.toMillis() : (s as any)?.sleepEndAt ? new Date((s as any).sleepEndAt).getTime() : 0;
                  if (endMs && Date.now() < endMs) {
                    localStorage.setItem(`pet_sleep_data_${petId}`, JSON.stringify({ clicks: 3, timestamp: startMs, sleepStartTime: startMs, sleepEndTime: endMs }));
                  } else {
                    localStorage.removeItem(`pet_sleep_data_${petId}`);
                  }
                });
              } catch {}
              // Reflect partial daily quest progress in todayCoins for emotion rendering (realtime)
              try {
                const today = new Date().toISOString().slice(0, 10);
                const targetCoins = 50; // 5 correct * 10 coins
                states.forEach((s: any) => {
                  const prog = Number(s?.progress || 0);
                  const petId = (s as any)?.pet;
                  if (!petId) return;
                  const desiredCoins = Math.min(prog * 10, targetCoins);
                  const pd = PetProgressStorage.getPetProgress(petId, petId);
                  pd.dailyCoins = pd.dailyCoins || { todayDate: today, todayCoins: 0 };
                  if (pd.dailyCoins.todayDate !== today) {
                    pd.dailyCoins.todayDate = today;
                    pd.dailyCoins.todayCoins = 0;
                  }
                  // Only increase to avoid clobbering increments from adventure flow in this session
                  if ((pd.dailyCoins.todayCoins || 0) < desiredCoins) {
                    pd.dailyCoins.todayCoins = desiredCoins;
                    PetProgressStorage.setPetProgress(pd);
                  }
                });
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

            // Throttled rollover in realtime when cooldown has passed
            try {
              const nowMs = Date.now();
              const needsRollover = states.some((s: any) => {
                const completed = Number(s?.progress || 0) >= 5;
                const cu: any = s?.cooldownUntil || null;
                const cuMs = cu?.toMillis ? cu.toMillis() : (cu ? new Date(cu).getTime() : null);
                return completed && (!cuMs || nowMs >= cuMs);
              });
              if (needsRollover && nowMs - lastRolloverAttempt > 60000) {
                lastRolloverAttempt = nowMs;
                stateStoreApi.handleDailyQuestRollover({ userId: user.uid, ownedPets });
              }
            } catch {}
          });

          // Resume handler: attempt rollover on window focus (debounced via lastRolloverAttempt)
          const onFocus = async () => {
            try {
              const nowMs = Date.now();
              if (nowMs - lastRolloverAttempt < 60000) return;
              const questStates = await stateStoreReader.fetchDailyQuestCompletionStates(user.uid);
              const needsRollover = questStates.some((s: any) => {
                const completed = Number(s?.progress || 0) >= 5;
                const cu: any = (s as any)?.cooldownUntil || null;
                const cuMs = cu?.toMillis ? cu.toMillis() : (cu ? new Date(cu).getTime() : null);
                return completed && (!cuMs || nowMs >= cuMs);
              });
              if (needsRollover) {
                lastRolloverAttempt = nowMs;
                const owned = questStates.map((x: any) => x.pet).filter(Boolean);
                await stateStoreApi.handleDailyQuestRollover({ userId: user.uid, ownedPets: owned });
              }
            } catch {}
          };
          try { window.addEventListener('focus', onFocus); focusListener = onFocus; } catch {}
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
        // Detach window focus listener on sign-out
        try {
          if (focusListener) { window.removeEventListener('focus', focusListener); focusListener = null; }
        } catch {}
      }
      
      setLoading(false);
    });

    return () => {
      try { if (unsubscribeUserState) unsubscribeUserState(); } catch {}
      try { if (unsubscribeDailyQuests) unsubscribeDailyQuests(); } catch {}
      try { if (focusListener) { window.removeEventListener('focus', focusListener); focusListener = null; } } catch {}
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const isUpgradeMode = typeof window !== 'undefined' && window.location && window.location.search.includes('mode=upgrade');
      const current = auth.currentUser;
      if (current && current.isAnonymous && isUpgradeMode) {
        // Link Google to the current anonymous user to preserve UID
        await linkWithPopup(current, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
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

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      const current = auth.currentUser;
      if (current && current.isAnonymous) {
        // Upgrade anonymous user to email/password while preserving UID
        const credential = EmailAuthProvider.credential(email, password);
        const linkedUser = await linkWithCredential(current, credential);
      } else {
        // No anonymous session: fall back to normal sign-up
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      }
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
    signInWithEmail,
    signUpWithEmail,
    signOut,
    updateUserData,
    initializeOneTapSignIn,
    hasGoogleAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
