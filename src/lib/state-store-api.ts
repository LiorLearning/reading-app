// Firestore state store API for pets, user progress, coins, streaks, and daily quests
// This file defines schemas and CRUD logic per user requirements.

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
    writeBatch,
    runTransaction,
    Timestamp,
    increment,
    deleteField,
  } from 'firebase/firestore';
  import { getApp, initializeApp, type FirebaseApp } from 'firebase/app';
  
  // ==========================
  // Firestore initialization
  // ==========================
  // We attempt to reuse an existing app if present; otherwise initialize from Vite env vars.
  function getOrInitFirebaseApp(): FirebaseApp {
    try {
      return getApp();
    } catch {
      const config = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      } as const;
      return initializeApp(config as any);
    }
  }
  
  const app = getOrInitFirebaseApp();
  const db = getFirestore(app);
  
  // ==========================
  // Types and Schemas
  // ==========================
  
  export type PetName = 'hamster' | 'dog' | string;
  export type QuestTask = 'house' | 'friend' | 'dressing-competition' | 'who-made-the-pets-sick' | 'travel' | 'food' | 'plant-dreams' | 'pet-school' | 'pet-theme-park' | 'pet-mall' | 'pet-care' | 'story' | string;
  
  export interface UserState {
    pets: Record<PetName, number>;
    petnames?: Record<PetName, string>;
    // Per-pet per-adventure question counts (cumulative)
    // Example: { hamster: { house: 8, travel: 5 }, dog: { park: 3 } }
    petquestions?: Record<PetName, Record<string, number>>;
    coins: number;
    streak: number;
    lastStreakIncrementAt?: Timestamp | null;
    // Client-local calendar day used for streak computation in local timezone (YYYY-MM-DD)
    lastStreakLocalDate?: string | null;
    // Weekly hearts map keyed by week key (e.g., "week_2025-10-06") and then by date (YYYY-MM-DD)
    // Example: weeklyHearts: { "week_2025-10-06": { "2025-10-07": true } }
    weeklyHearts?: Record<string, Record<string, boolean>>;
    // Daily sadness rotation controller for fair assignment across pets
    sadnessRotation?: {
      date: string; // YYYY-MM-DD (client-local)
      pointer: number; // round-robin offset into owned pets list
      lastAssignedPets: PetName[]; // the pets assigned on that date
      max: number; // cap used on that date (e.g., 2)
    } | null;
    createdAt: Timestamp;
    updatedAt: Timestamp;
  }
  
  export type PetQuestProgress = Record<QuestTask, number>; // each task counts correct answers toward 5
  
  export interface DailyQuests {
    // per-pet object where each task maps to progress count (0..5)
    [pet: string]: PetQuestProgress | Timestamp;
    createdAt: Timestamp;
    updatedAt: Timestamp;
  }
  
  // Firestore collection/document paths
  const userStateDocRef = (userId: string) => doc(db, 'userStates', userId);
  const dailyQuestsDocRef = (userId: string) => doc(db, 'dailyQuests', userId);
  
  // Utility: server timestamps
  const nowServerTimestamp = () => serverTimestamp();
  
  // Constants
  const COINS_PER_QUESTION = 10;
  const QUEST_TARGET = 5;
  const QUEST_COOLDOWN_HOURS = 8; // wait 8 hours before advancing after completion
  const ACTIVITY_SEQUENCE: QuestTask[] = ['house', 'friend', 'dressing-competition', 'who-made-the-pets-sick', 'travel', 'food', 'plant-dreams', 'pet-school', 'pet-theme-park', 'pet-mall', 'pet-care', 'story'];
  const SADNESS_CAP_PER_DAY = 2;
  
  // Default generators
  function createDefaultUserState(): Omit<UserState, 'createdAt' | 'updatedAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } {
    return {
      pets: {},
      petnames: {},
      petquestions: {},
      coins: 0,
      streak: 0,
      lastStreakIncrementAt: null,
      lastStreakLocalDate: null,
      weeklyHearts: {},
      createdAt: nowServerTimestamp(),
      updatedAt: nowServerTimestamp(),
    };
  }
  
  function createInitialDailyQuests(pets: PetName[] = ['hamster', 'dog']): Record<string, any> {
    // Assign a random starting quest per pet with 0 progress
    const result: Record<string, any> = {};
    for (const pet of pets) {
      const task = ACTIVITY_SEQUENCE[0];
      result[pet] = { [task]: 0, _activityIndex: 0, _completedAt: null, _cooldownUntil: null };
    }
    // Initialize user-scoped activity pointer (shared across pets)
    result._userCurrentActivity = ACTIVITY_SEQUENCE[0];
    result._userLastSwitchAt = nowServerTimestamp();
    result._userCooldownUntil = null;
    result.createdAt = nowServerTimestamp();
    result.updatedAt = nowServerTimestamp();
    return result;
  }
  
  // ==========================
  // API: Initialization
  // ==========================
  
  export async function initializeUserStateAndDailyQuests(userId: string, initialPets: PetName[] = ['hamster', 'dog']): Promise<void> {
    const userRef = userStateDocRef(userId);
    const questsRef = dailyQuestsDocRef(userId);
  
    const [userSnap, questsSnap] = await Promise.all([getDoc(userRef), getDoc(questsRef)]);
  
    const batch = writeBatch(db);
  
    if (!userSnap.exists()) {
      batch.set(userRef, createDefaultUserState());
    } else {
      batch.update(userRef, { updatedAt: nowServerTimestamp() });
    }
  
    // Determine pets from userState if available; fallback to provided list
    const petsFromUserState = userSnap.exists() ? Object.keys((userSnap.data() as any)?.pets ?? {}) : [];
    const petsToInit = petsFromUserState.length > 0 ? petsFromUserState : initialPets;
  
    if (!questsSnap.exists()) {
      batch.set(questsRef, createInitialDailyQuests(petsToInit));
    } else {
      // Ensure only owned pets exist in dailyQuests
      const qData = questsSnap.data() as any;
      const updates: Record<string, any> = { updatedAt: nowServerTimestamp() };
      const existingPetKeys = Object.keys(qData).filter((k) => k !== 'createdAt' && k !== 'updatedAt');
      for (const key of existingPetKeys) {
        if (!petsToInit.includes(key)) updates[key] = deleteField();
      }
      for (const pet of petsToInit) {
        if (!qData[pet]) updates[pet] = { [ACTIVITY_SEQUENCE[0]]: 0, _activityIndex: 0, _completedAt: null, _cooldownUntil: null };
      }
      batch.set(questsRef, updates, { merge: true });
    }
  
    await batch.commit();
  }
  
  // ==========================
  // API: Progress update logic
  // ==========================
  
  export interface ProgressUpdateInput {
    userId: string;
    pet: PetName;
    questionsSolved: number; // number of correct questions in this event
    adventureKey?: string; // optional explicit adventure/todo key (e.g., 'house', 'travel')
  }
  
  export async function updateProgressOnQuestionSolved(input: ProgressUpdateInput): Promise<void> {
    const { userId, pet, questionsSolved, adventureKey } = input;
    if (questionsSolved <= 0) return;

    const userRef = userStateDocRef(userId);
    const questsRef = dailyQuestsDocRef(userId);

    await runTransaction(db, async (txn) => {
      const [userSnap, questsSnap] = await Promise.all([txn.get(userRef), txn.get(questsRef)]);

      if (!userSnap.exists()) {
        txn.set(userRef, createDefaultUserState());
      }
      if (!questsSnap.exists()) {
        txn.set(questsRef, createInitialDailyQuests([pet]));
      }

      const questsData = (questsSnap.exists() ? (questsSnap.data() as any) : {}) as any;
      const petObj = questsData?.[pet] ?? {};
      const index = Number(petObj?._activityIndex ?? 0) % ACTIVITY_SEQUENCE.length;
      const activeKey = ACTIVITY_SEQUENCE[index];
      const perAdventureKey = (adventureKey && typeof adventureKey === 'string' && adventureKey.trim()) ? adventureKey : activeKey;

      // Ensure pet container exists
      if (!questsData?.[pet]) {
        txn.set(questsRef, { [pet]: { [activeKey]: 0, _activityIndex: index || 0, _completedAt: null, _cooldownUntil: null, _lastCompletedActivity: null } } as any, { merge: true });
      }

      // Increment quest progress for active activity
      txn.set(
        questsRef,
        { [pet]: { [activeKey]: increment(questionsSolved) }, updatedAt: nowServerTimestamp() } as any,
        { merge: true }
      );

      // Increment user counters and coins
      txn.set(
        userRef,
        {
          pets: { [pet]: increment(questionsSolved) },
          coins: increment(questionsSolved * COINS_PER_QUESTION),
          petquestions: { [pet]: { [perAdventureKey]: increment(questionsSolved) } },
          updatedAt: nowServerTimestamp(),
        } as any,
        { merge: true }
      );

      // Completion: advance exactly once
      const currentProgress = Number(petObj?.[activeKey] ?? 0);
      const predicted = currentProgress + questionsSolved;
      const alreadyCompleted = Boolean(petObj?._completedAt);
      if (predicted >= QUEST_TARGET && !alreadyCompleted) {
        const now = Date.now();
        const cooldownMs = QUEST_COOLDOWN_HOURS * 60 * 60 * 1000;
        const cooldownUntil = Timestamp.fromMillis(now + cooldownMs);

        // Mark per-pet completion and remember which activity finished
        txn.set(
          questsRef,
          { [pet]: { _completedAt: nowServerTimestamp(), _cooldownUntil: cooldownUntil, _lastCompletedActivity: perAdventureKey }, updatedAt: nowServerTimestamp() } as any,
          { merge: true }
        );

        // Advance user-scoped pointer once, based on current pointer value in the same txn
        const currUserAct = (questsData?._userCurrentActivity || ACTIVITY_SEQUENCE[0]) as string;
        const uIdx = Math.max(0, ACTIVITY_SEQUENCE.indexOf(currUserAct));
        const nextKey = ACTIVITY_SEQUENCE[(uIdx + 1) % ACTIVITY_SEQUENCE.length];
        txn.set(
          questsRef,
          { _userCurrentActivity: nextKey, _userLastSwitchAt: nowServerTimestamp(), _userCooldownUntil: null, updatedAt: nowServerTimestamp() } as any,
          { merge: true }
        );
      } else if (alreadyCompleted) {
        // If already completed today, keep the label accurate: always set lastCompletedActivity
        try {
          const completedAtAny = petObj?._completedAt as any;
          const completedMs = completedAtAny?.toMillis ? completedAtAny.toMillis() : (completedAtAny ? new Date(completedAtAny).getTime() : 0);
          const completedDay = completedMs ? new Date(completedMs).toISOString().slice(0, 10) : '';
          const today = new Date().toISOString().slice(0, 10);
          if (completedDay === today) {
            txn.set(questsRef, { [pet]: { _lastCompletedActivity: perAdventureKey }, updatedAt: nowServerTimestamp() } as any, { merge: true });
          }
        } catch {}
      }
    });
  }
  
  // ==========================
  // API: Coin deduction logic
  // ==========================
  
  export interface DeductCoinsInput {
    userId: string;
    amount: number;
    clientCoins?: number; // optional local coins fallback when server value missing
  }
  
  export async function deductCoinsOnPurchase(input: DeductCoinsInput): Promise<void> {
    const { userId, amount, clientCoins } = input;
    if (amount <= 0) return;
  
    await runTransaction(db, async (txn) => {
      const userRef = userStateDocRef(userId);
      const userSnap = await txn.get(userRef);
  
      if (!userSnap.exists()) {
        // Initialize if missing to avoid errors
        txn.set(userRef, createDefaultUserState());
        return; // purchase can't proceed with coins this round; next call will work
      }
  
      const userData = userSnap.data() as UserState | any;
      const serverCoins = typeof userData.coins === 'number' ? userData.coins : 0;
      const localCoins = typeof clientCoins === 'number' ? clientCoins : 0;
      // Use the greater of server vs client to avoid resetting to 0 when server is stale
      const baseCoins = Math.max(serverCoins, localCoins);
      const newCoins = Math.max(0, baseCoins - amount);
  
      txn.update(userRef, {
        coins: newCoins,
        updatedAt: nowServerTimestamp(),
      });
    });
  }
  
  // ==========================
  // API: Daily quest rollover
  // ==========================
  
  export interface QuestRolloverInput {
    userId: string;
    ownedPets?: PetName[]; // only these pets are kept/initialized
  }
  
  // Helper to compute next activity index
  function getNextActivityIndex(currentIndex: number): number {
    return (currentIndex + 1) % ACTIVITY_SEQUENCE.length;
  }
  
  // Normalize per-pet object and return current active key (STRICT to sequence)
  function getActiveActivityForPet(petObj: any): { key: string; index: number } {
    if (!petObj) return { key: ACTIVITY_SEQUENCE[0], index: 0 };
    const index = Number(petObj._activityIndex ?? 0) % ACTIVITY_SEQUENCE.length;
    const expectedKey = ACTIVITY_SEQUENCE[index];
    // Always use expectedKey; ignore stray historical keys
    return { key: expectedKey, index };
  }
  
  export async function handleDailyQuestRollover(input: QuestRolloverInput): Promise<void> {
    const { userId, ownedPets } = input;
    const questsRef = dailyQuestsDocRef(userId);
    const questsSnap = await getDoc(questsRef);
  
    const batch = writeBatch(db);
  
    if (!questsSnap.exists()) {
      batch.set(questsRef, createInitialDailyQuests(ownedPets ?? []));
      await batch.commit();
      return;
    }
  
    const data = (questsSnap.data() as any) || {};
    const nowMs = Date.now();
  
    const updates: Record<string, any> = { updatedAt: nowServerTimestamp() };
  
    // Filter only owned pets if provided
    const existingPetKeys = Object.keys(data).filter((k) => k !== 'createdAt' && k !== 'updatedAt');
    if (ownedPets && ownedPets.length > 0) {
      for (const key of existingPetKeys) {
        if (!ownedPets.includes(key)) {
          updates[key] = deleteField();
        }
      }
      for (const pet of ownedPets) {
        if (!data[pet]) {
          updates[pet] = { [ACTIVITY_SEQUENCE[0]]: 0, _activityIndex: 0, _completedAt: null, _cooldownUntil: null };
        }
      }
    }
  
    const petKeys = (ownedPets && ownedPets.length > 0) ? ownedPets : existingPetKeys;
    for (const pet of petKeys) {
      const petObj = (data?.[pet] ?? {}) as any;
      const { key: activeKey, index } = getActiveActivityForPet(petObj);
      const progress = Number(petObj?.[activeKey] ?? 0);
      const cooldownUntilTs = petObj?._cooldownUntil as Timestamp | null;
      const cooldownUntilMs = cooldownUntilTs ? cooldownUntilTs.toMillis() : null;
  
      if (progress >= QUEST_TARGET) {
        if (!cooldownUntilMs) {
          // Set cooldown first time we detect completion; advance later
          const cooldownMs = QUEST_COOLDOWN_HOURS * 60 * 60 * 1000;
          updates[pet] = {
            ...(updates[pet] || {}),
            _completedAt: nowServerTimestamp(),
            _cooldownUntil: Timestamp.fromMillis(nowMs + cooldownMs),
          };
        } else if (nowMs >= cooldownUntilMs) {
          // Advance to next activity after cooldown
          const nextIndex = getNextActivityIndex(index);
          const nextKey = ACTIVITY_SEQUENCE[nextIndex];
          updates[pet] = {
            ...(updates[pet] || {}),
            [activeKey]: deleteField(),
            [nextKey]: 0,
            _activityIndex: nextIndex,
            _completedAt: null,
            _lastCompletedActivity: null,
            _cooldownUntil: null,
          };
        }
      }
    }
  
    // Advance USER-scoped pointer if cooldown passed
    try {
      const userCooldown = (data as any)?._userCooldownUntil as Timestamp | null;
      const userActivity = (data as any)?._userCurrentActivity as string | undefined;
      const idx = Math.max(0, ACTIVITY_SEQUENCE.indexOf(userActivity || ACTIVITY_SEQUENCE[0]));
      const cuMs = userCooldown?.toMillis?.() || (userCooldown ? new Date(userCooldown as any).getTime() : null);
      if (!cuMs || nowMs >= cuMs) {
        const nextIndex = (idx + 1) % ACTIVITY_SEQUENCE.length;
        updates._userCurrentActivity = ACTIVITY_SEQUENCE[nextIndex];
        updates._userLastSwitchAt = nowServerTimestamp();
        updates._userCooldownUntil = null;
      }
    } catch {}

    batch.set(questsRef, updates, { merge: true });
    await batch.commit();

    // Ensure sadness assignment exists for the day (idempotent)
    try { await ensureDailySadnessAssigned(userId); } catch {}
  }

  // ==========================
  // DEV: Simulate 8 hours elapsed and advance
  // ==========================

  export interface DevSimulateEightHoursInput {
    userId: string;
  }

  export async function devSimulateEightHoursAndRollover(input: DevSimulateEightHoursInput): Promise<void> {
    const { userId } = input;
    const questsRef = dailyQuestsDocRef(userId);
    const snap = await getDoc(questsRef);
    if (!snap.exists()) return;
    const data = (snap.data() as any) || {};
    const batch = writeBatch(db);
    const pastTs = Timestamp.fromMillis(Date.now() - 1000);

    const petKeys = Object.keys(data).filter((k) => k !== 'createdAt' && k !== 'updatedAt' && !k.startsWith('_'));
    for (const pet of petKeys) {
      const petObj = (data?.[pet] ?? {}) as any;
      const updates: Record<string, any> = {};
      // If cooldown exists or pet completed, push cooldown to past to allow next rollover
      if (petObj?._cooldownUntil) updates._cooldownUntil = pastTs; else if (typeof petObj?.[Object.keys(petObj).find((k: string) => !k.startsWith('_')) || ''] === 'number') updates._cooldownUntil = pastTs;
      // Also end any sleep immediately
      if (petObj?._sleepEndAt) updates._sleepEndAt = pastTs;
      // Cleanup stray progress keys: retain only current active key
      try {
        const { key: activeKey } = getActiveActivityForPet(petObj);
        const keys = Object.keys(petObj).filter((k) => !k.startsWith('_') && k !== 'createdAt' && k !== 'updatedAt');
        keys.forEach((k) => { if (k !== activeKey) (updates as any)[k] = deleteField(); });
      } catch {}
      if (Object.keys(updates).length > 0) {
        batch.set(questsRef, { [pet]: updates } as any, { merge: true });
      }
    }
    batch.set(questsRef, { updatedAt: nowServerTimestamp() } as any, { merge: true });
    await batch.commit();

    // Now run normal rollover to advance
    await handleDailyQuestRollover({ userId });
  }

  export interface ForceQuestAdvanceInput {
    userId: string;
    ownedPets?: PetName[];
  }

  // Dev/utility: force-expire cooldowns for completed quests and advance immediately
  export async function forceExpireCooldownsAndRollover(input: ForceQuestAdvanceInput): Promise<void> {
    const { userId, ownedPets } = input;
    const questsRef = dailyQuestsDocRef(userId);
    const questsSnap = await getDoc(questsRef);
    const batch = writeBatch(db);
    if (!questsSnap.exists()) return;
    const data = (questsSnap.data() as any) || {};
    const updates: Record<string, any> = { updatedAt: nowServerTimestamp() };
    const existingPetKeys = Object.keys(data).filter((k) => k !== 'createdAt' && k !== 'updatedAt');
    const keys = (ownedPets && ownedPets.length > 0) ? ownedPets : existingPetKeys;
    for (const pet of keys) {
      const petObj = (data?.[pet] ?? {}) as any;
      const { key: activeKey } = getActiveActivityForPet(petObj);
      const progress = Number(petObj?.[activeKey] ?? 0);
      if (progress >= QUEST_TARGET) {
        updates[pet] = {
          ...(updates[pet] || {}),
          _completedAt: nowServerTimestamp(),
          _cooldownUntil: Timestamp.fromMillis(Date.now() - 1),
        };
      }
    }
    // Also expire user-scoped cooldown so the pointer can advance
    updates._userCooldownUntil = Timestamp.fromMillis(Date.now() - 1);
    batch.set(questsRef, updates, { merge: true });
    await batch.commit();
    await handleDailyQuestRollover({ userId, ownedPets });
  }
  
  // ==========================
  // NEW API: Daily quest helpers (batch-based)
  // ==========================

  // ==========================
  // Daily sadness rotation assignment
  // ==========================

  export interface SadnessAssignment {
    date: string;
    assignedPets: PetName[];
    max: number;
  }

  function getTodayDateString(): string {
    try {
      return new Date().toISOString().slice(0, 10);
    } catch {
      // Fallback if environment lacks toISOString
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    }
  }

  function isSleepingNow(petObj: any): boolean {
    const endAny = petObj?._sleepEndAt as any;
    if (!endAny) return false;
    try {
      const now = Date.now();
      const endMs = endAny?.toMillis ? endAny.toMillis() : (endAny ? new Date(endAny).getTime() : 0);
      return Boolean(endMs && now < endMs);
    } catch {
      return false;
    }
  }

  export async function ensureDailySadnessAssigned(userId: string): Promise<SadnessAssignment> {
    const today = getTodayDateString();
    const userRef = userStateDocRef(userId);
    const questsRef = dailyQuestsDocRef(userId);
    const [userSnap, questsSnap] = await Promise.all([getDoc(userRef), getDoc(questsRef)]);

    const userData = (userSnap.exists() ? (userSnap.data() as any) : null);
    const questsData = (questsSnap.exists() ? (questsSnap.data() as any) : {});

    const cap = SADNESS_CAP_PER_DAY;

    // If already assigned for today in dailyQuests, return it (idempotent)
    const existing = questsData?._sadness as any;
    if (existing && existing.date === today && Array.isArray(existing.assignedPets)) {
      return { date: existing.date, assignedPets: existing.assignedPets as PetName[], max: Number(existing.max || cap) };
    }

    // Determine owned pets (prefer petnames keys when available for stability)
    const petsMap = (userData?.pets || {}) as Record<string, number>;
    const namesMap = (userData?.petnames || {}) as Record<string, string>;
    const ownedPets = (Object.keys(namesMap).length > 0 ? Object.keys(namesMap) : Object.keys(petsMap)).sort();

    const totalOwned = ownedPets.length;
    const k = Math.min(cap, totalOwned);

    const rot = (userData?.sadnessRotation || null) as any;
    const pointer = Number(rot?.pointer || 0) % (totalOwned || 1);

    // Compute eligibility: exclude pets actively sleeping
    const eligiblePets = ownedPets.filter((pet) => {
      const petObj = questsData?.[pet] || {};
      return !isSleepingNow(petObj);
    });

    // If fewer eligible than cap, assign as many as possible (may be 0..k)
    const pool = eligiblePets.length > 0 ? eligiblePets : ownedPets;
    const assignCount = Math.min(k, pool.length);

    const selected: PetName[] = [];
    if (assignCount > 0 && pool.length > 0) {
      for (let i = 0; i < pool.length && selected.length < assignCount; i++) {
        const idx = (pointer + i) % pool.length;
        const pet = pool[idx];
        if (!selected.includes(pet as PetName)) selected.push(pet as PetName);
      }
    }

    // Prepare updates (batch)
    const batch = writeBatch(db);
    // Quests _sadness publication for realtime UI consumption
    batch.set(questsRef, { _sadness: { date: today, assignedPets: selected, max: cap }, updatedAt: nowServerTimestamp() } as any, { merge: true });
    // UserState rotation bookkeeping
    batch.set(userRef, {
      sadnessRotation: {
        date: today,
        pointer: (totalOwned > 0 ? (pointer + assignCount) % totalOwned : 0),
        lastAssignedPets: selected,
        max: cap,
      },
      updatedAt: nowServerTimestamp(),
    } as any, { merge: true });

    await batch.commit();

    return { date: today, assignedPets: selected, max: cap };
  }

  // Force a specific pet to be sad today (used on first selection/purchase day)
  export interface EnsurePetSadTodayInput {
    userId: string;
    pet: PetName;
  }

  export async function ensurePetSadToday(input: EnsurePetSadTodayInput): Promise<void> {
    const { userId, pet } = input;
    const today = getTodayDateString();
    const userRef = userStateDocRef(userId);
    const questsRef = dailyQuestsDocRef(userId);
    const [userSnap, questsSnap] = await Promise.all([getDoc(userRef), getDoc(questsRef)]);

    const cap = SADNESS_CAP_PER_DAY;

    const batch = writeBatch(db);
    if (!questsSnap.exists()) {
      // Initialize with this pet present to avoid missing structure
      batch.set(questsRef, createInitialDailyQuests([pet] as any));
    }

    const existing = (questsSnap.exists() ? (questsSnap.data() as any)?._sadness : null) as any;
    let assigned: string[] = [];
    if (existing && existing.date === today && Array.isArray(existing.assignedPets)) {
      assigned = [...existing.assignedPets];
    }
    if (!assigned.includes(pet)) {
      if (assigned.length < cap) {
        assigned.push(pet);
      } else {
        // Ensure the new pet is included today; drop the last to keep size within cap
        assigned = [pet, ...assigned.slice(0, cap - 1)];
      }
    }

    // Publish sadness today and mirror in userState without advancing pointer (no fairness penalty)
    batch.set(questsRef, { _sadness: { date: today, assignedPets: assigned, max: cap }, updatedAt: nowServerTimestamp() } as any, { merge: true });

    // Update sadnessRotation snapshot without changing pointer
    const usr = (userSnap.exists() ? (userSnap.data() as any) : null) as any;
    const rot = usr?.sadnessRotation || {};
    batch.set(userRef, {
      sadnessRotation: {
        date: today,
        pointer: Number(rot?.pointer || 0),
        lastAssignedPets: assigned,
        max: cap,
      },
      updatedAt: nowServerTimestamp(),
    } as any, { merge: true });

    await batch.commit();
  }
  
  export interface GetDailyQuestResultPet {
    pet: string;
    activity: string;
    progress: number;
    activityIndex: number;
    cooldownUntil?: Timestamp | null;
  }
  
  export interface GetDailyQuestResult {
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    pets: GetDailyQuestResultPet[];
  }
  
  export async function getDailyQuest(userId: string, ownedPets: PetName[]): Promise<GetDailyQuestResult> {
    const questsRef = dailyQuestsDocRef(userId);
    const snap = await getDoc(questsRef);
    const batch = writeBatch(db);
  
    if (!snap.exists()) {
      batch.set(questsRef, createInitialDailyQuests(ownedPets));
      await batch.commit();
      const created = await getDoc(questsRef);
      const createdData = created.data() as any;
      const pets: GetDailyQuestResultPet[] = ownedPets.map((p) => ({ pet: p, activity: ACTIVITY_SEQUENCE[0], progress: 0, activityIndex: 0, cooldownUntil: null }));
      return { createdAt: createdData?.createdAt, updatedAt: createdData?.updatedAt, pets };
    }
  
    const data = snap.data() as any;
    const updates: Record<string, any> = {};
    const existingPetKeys = Object.keys(data).filter((k) => k !== 'createdAt' && k !== 'updatedAt');
    const resultPets: GetDailyQuestResultPet[] = [];
  
    // Remove pets not owned
    for (const key of existingPetKeys) {
      if (!ownedPets.includes(key)) {
        updates[key] = deleteField();
      }
    }
    // Add missing pets
    for (const pet of ownedPets) {
      if (!data[pet]) {
        updates[pet] = { [ACTIVITY_SEQUENCE[0]]: 0, _activityIndex: 0, _completedAt: null, _cooldownUntil: null };
      }
    }
  
    // Build output
    for (const pet of ownedPets) {
      const petObj = (data?.[pet] ?? updates?.[pet] ?? { [ACTIVITY_SEQUENCE[0]]: 0, _activityIndex: 0 }) as any;
      const { key, index } = getActiveActivityForPet(petObj);
      const progress = Number(petObj?.[key] ?? 0);
      resultPets.push({ pet, activity: key, progress, activityIndex: index, cooldownUntil: petObj?._cooldownUntil ?? null });
    }
  
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = nowServerTimestamp();
      batch.set(questsRef, updates, { merge: true });
      await batch.commit();
    }
  
    return { createdAt: data?.createdAt, updatedAt: data?.updatedAt, pets: resultPets };
  }
  
  export interface UpdateQuestProgressInput {
    userId: string;
    pet: PetName;
    questionsSolved?: number;
  adventureKey?: string;
  }
  
  export async function updateQuestProgress(input: UpdateQuestProgressInput): Promise<void> {
  const { userId, pet, questionsSolved = 1, adventureKey } = input;
  await updateProgressOnQuestionSolved({ userId, pet, questionsSolved, adventureKey });
  }
  
  // ==========================
  // Convenience getters (optional)
  // ==========================
  
  export async function getUserState(userId: string): Promise<UserState | null> {
    const snap = await getDoc(userStateDocRef(userId));
    return snap.exists() ? (snap.data() as UserState) : null;
  }
  
  export async function getDailyQuests(userId: string): Promise<DailyQuests | null> {
    const snap = await getDoc(dailyQuestsDocRef(userId));
    return snap.exists() ? (snap.data() as DailyQuests) : null;
  }

  // ==========================
  // API: Pet names (stored alongside pets counts)
  // ==========================

  export interface SetPetNameInput {
    userId: string;
    pet: PetName;
    name: string;
  }

  export async function setPetName(input: SetPetNameInput): Promise<void> {
    const { userId, pet, name } = input;
    const userRef = userStateDocRef(userId);
    await setDoc(
      userRef,
      { petnames: { [pet]: name }, updatedAt: nowServerTimestamp() } as any,
      { merge: true }
    );
  }

  export async function getPetNames(userId: string): Promise<Record<PetName, string>> {
    const snap = await getDoc(userStateDocRef(userId));
    if (!snap.exists()) return {} as Record<PetName, string>;
    const data = snap.data() as any;
    return (data?.petnames || {}) as Record<PetName, string>;
  }
  
  // ==========================
  // Exported API surface
  // ==========================
  
  export const stateStoreApi = {
    initializeUserStateAndDailyQuests,
    updateProgressOnQuestionSolved,
    deductCoinsOnPurchase,
    handleDailyQuestRollover,
    devSimulateEightHoursAndRollover,
    ensureDailySadnessAssigned,
    ensurePetSadToday,
    getUserState,
    getDailyQuests,
    startPetSleep,
    clearPetSleep,
    setPetName,
    setWeeklyHeart,
    incrementStreakIfEligible,
    fetchMoodPeriod,
    setMoodPeriod,
    forceExpireCooldownsAndRollover,
  };
  
  // ==========================
  // Read-only: Fetch overview and quest states for sign-in
  // ==========================
  
  function calculatePetLevel(totalCorrect: number): { level: 1 | 2 | 3 | 4 | 5; nextThreshold: number | null; toNext: number | null } {
    if (totalCorrect >= 30) return { level: 5, nextThreshold: null, toNext: null };
    if (totalCorrect >= 20) return { level: 4, nextThreshold: 30, toNext: Math.max(0, 30 - totalCorrect) };
    if (totalCorrect >= 12) return { level: 3, nextThreshold: 20, toNext: Math.max(0, 20 - totalCorrect) };
    if (totalCorrect >= 5) return { level: 2, nextThreshold: 12, toNext: Math.max(0, 12 - totalCorrect) };
    return { level: 1, nextThreshold: 5, toNext: Math.max(0, 5 - totalCorrect) };
  }
  
  export interface PetOverview {
    totalCorrect: number;
    level: 1 | 2 | 3 | 4 | 5;
    nextThreshold: number | null;
    toNext: number | null;
  }
  
  export interface UserOverview {
    coins: number;
    streak: number;
    pets: Record<PetName, PetOverview>;
    updatedAt?: Timestamp;
  }
  
  export async function fetchUserOverview(userId: string): Promise<UserOverview | null> {
    const snap = await getDoc(userStateDocRef(userId));
    if (!snap.exists()) return null;
    const data = snap.data() as any;
    const pets: Record<string, PetOverview> = {};
    const petCounts = (data?.pets ?? {}) as Record<string, number>;
    for (const [pet, count] of Object.entries(petCounts)) {
      const lvl = calculatePetLevel(Number(count || 0));
      pets[pet] = {
        totalCorrect: Number(count || 0),
        level: lvl.level,
        nextThreshold: lvl.nextThreshold,
        toNext: lvl.toNext,
      };
    }
    return {
      coins: Number(data?.coins ?? 0),
      streak: Number(data?.streak ?? 0),
      pets: pets as Record<PetName, PetOverview>,
      updatedAt: data?.updatedAt,
    };
  }
  
  export interface QuestCompletionState {
    pet: PetName;
    activity: QuestTask;
    progress: number;
    target: number; // always 5
    completed: boolean;
    activityIndex: number;
    cooldownUntil?: Timestamp | null;
  completedAt?: Timestamp | null;
  lastCompletedActivity?: QuestTask | null;
    sleepStartAt?: Timestamp | null;
    sleepEndAt?: Timestamp | null;
  }
  
  export async function fetchDailyQuestCompletionStates(userId: string): Promise<QuestCompletionState[]> {
    // Read owned pets from userState
    const userSnap = await getDoc(userStateDocRef(userId));
    const ownedPets = userSnap.exists() ? Object.keys((userSnap.data() as any)?.pets ?? {}) : [];
  
    const questsSnap = await getDoc(dailyQuestsDocRef(userId));
    if (!questsSnap.exists()) return ownedPets.map((p) => ({ pet: p, activity: ACTIVITY_SEQUENCE[0], progress: 0, target: QUEST_TARGET, completed: false, activityIndex: 0, cooldownUntil: null }));
  
    const data = questsSnap.data() as any;
    const result: QuestCompletionState[] = [];
    for (const pet of ownedPets) {
      const petObj = (data?.[pet] ?? {}) as any;
      const index = Number(petObj?._activityIndex ?? 0) % ACTIVITY_SEQUENCE.length;
      const key = ACTIVITY_SEQUENCE[index];
      const prog = Number(petObj?.[key] ?? 0);
      const completed = prog >= QUEST_TARGET;
      result.push({
        pet,
        activity: key,
        progress: prog,
        target: QUEST_TARGET,
        completed,
        activityIndex: index,
        cooldownUntil: petObj?._cooldownUntil ?? null,
        completedAt: petObj?._completedAt ?? null,
        // expose last completed activity for accurate Today label pinning
        lastCompletedActivity: (typeof petObj?._lastCompletedActivity === 'string') ? petObj._lastCompletedActivity : null,
        sleepStartAt: petObj?._sleepStartAt ?? null,
        sleepEndAt: petObj?._sleepEndAt ?? null,
      });
    }
    return result;
  }
  
  // ==========================
  // Sleep management persisted in dailyQuests per pet (batch-based)
  // ==========================
  
  export interface StartPetSleepInput {
    userId: string;
    pet: PetName;
    durationMs?: number; // default 8 hours
  }
  
  export async function startPetSleep(input: StartPetSleepInput): Promise<void> {
    const { userId, pet, durationMs = 8 * 60 * 60 * 1000 } = input;
    const questsRef = dailyQuestsDocRef(userId);
    const snap = await getDoc(questsRef);
    const batch = writeBatch(db);
    if (!snap.exists()) {
      batch.set(questsRef, createInitialDailyQuests([pet]));
    }
    const endTs = Timestamp.fromMillis(Date.now() + durationMs);
    batch.set(
      questsRef,
      { [pet]: { _sleepStartAt: nowServerTimestamp(), _sleepEndAt: endTs }, updatedAt: nowServerTimestamp() } as any,
      { merge: true }
    );
    await batch.commit();
  }
  
  export interface ClearPetSleepInput {
    userId: string;
    pet: PetName;
  }
  
  export async function clearPetSleep(input: ClearPetSleepInput): Promise<void> {
    const { userId, pet } = input;
    const questsRef = dailyQuestsDocRef(userId);
    const batch = writeBatch(db);
    batch.set(
      questsRef,
      { [pet]: { _sleepStartAt: null, _sleepEndAt: null }, updatedAt: nowServerTimestamp() } as any,
      { merge: true }
    );
    await batch.commit();
  }
  
  // Re-export in API surface
  export const stateStoreReader = {
    fetchUserOverview,
    fetchDailyQuestCompletionStates,
    getPetNames,
  };

  // ==========================
  // Weekly hearts helpers
  // ==========================

  export interface SetWeeklyHeartInput {
    userId: string;
    weekKey: string; // e.g., "week_2025-10-06" (Monday date)
    dateStr: string; // YYYY-MM-DD within that week
    filled?: boolean; // default true
  }

  export async function setWeeklyHeart(input: SetWeeklyHeartInput): Promise<void> {
    const { userId, weekKey, dateStr, filled = true } = input;
    if (!userId || !weekKey || !dateStr) return;
    const userRef = userStateDocRef(userId);
    await setDoc(
      userRef,
      { weeklyHearts: { [weekKey]: { [dateStr]: filled } }, updatedAt: nowServerTimestamp() } as any,
      { merge: true }
    );
  }
  
  // ==========================
  // Streak: increment only if (any quest completed today) AND (called on sleep)
  // ==========================

  export interface IncrementStreakIfEligibleInput {
    userId: string;
    localDate: string; // YYYY-MM-DD in user's local timezone
  }

  function toLocalYmd(ms: number): string {
    try {
      const d = new Date(ms);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    } catch {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    }
  }

  function isWeekendYmd(ymd: string): boolean {
    try {
      const [y, m, d] = ymd.split('-').map((s) => Number(s));
      const dt = new Date(y, (m || 1) - 1, d || 1);
      const day = dt.getDay(); // 0=Sun, 6=Sat
      return day === 0 || day === 6;
    } catch {
      return false;
    }
  }

  function daysBetweenYmd(prevYmd: string, currYmd: string): number {
    try {
      const [py, pm, pd] = prevYmd.split('-').map((s) => Number(s));
      const [cy, cm, cd] = currYmd.split('-').map((s) => Number(s));
      const prev = new Date(py, (pm || 1) - 1, pd || 1);
      const curr = new Date(cy, (cm || 1) - 1, cd || 1);
      return Math.floor((curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }

  // Weekend bonus continuity rules:
  // - Weekend usage (Sat/Sun) increments like normal
  // - Skipping weekend days doesn't break streak
  // - Skipping a weekday breaks streak
  function isContinuousWithWeekendBonus(prevYmd: string | null | undefined, currYmd: string): boolean {
    if (!prevYmd) return false;
    try {
      const [cy, cm, cd] = currYmd.split('-').map((s) => Number(s));
      const curr = new Date(cy, (cm || 1) - 1, cd || 1);
      const currDow = curr.getDay(); // 0=Sun..6=Sat
      const diff = daysBetweenYmd(prevYmd, currYmd);
      if (diff <= 0) return false;

      // Weekend days increment with previous calendar day continuity
      if (currDow === 6) { // Saturday
        return diff === 1; // must be Friday
      }
      if (currDow === 0) { // Sunday
        return diff === 1 || diff === 2; // Sat or Fri
      }

      // Weekdays (Mon..Fri)
      if (currDow === 1) { // Monday
        return diff === 1 || diff === 2 || diff === 3; // Sun, Sat, or Fri
      }
      // Tue..Fri
      return diff === 1; // strict previous day
    } catch {
      return false;
    }
  }

  export async function incrementStreakIfEligible(input: IncrementStreakIfEligibleInput): Promise<number> {
    const { userId, localDate } = input;
    if (!userId || !localDate) return 0;
    return await runTransaction(db, async (txn) => {
      const userRef = userStateDocRef(userId);
      const questsRef = dailyQuestsDocRef(userId);
      const userSnap = await txn.get(userRef);
      const questsSnap = await txn.get(questsRef);

      // Initialize user state if missing
      if (!userSnap.exists()) {
        txn.set(userRef, createDefaultUserState());
      }

      const userData = (userSnap.exists() ? (userSnap.data() as any) : {}) as any;
      const currentStreak = Number(userData?.streak ?? 0);
      const lastLocal = (userData?.lastStreakLocalDate ?? null) as string | null;

      // If already incremented for localDate, return early
      if (lastLocal === localDate) {
        return currentStreak;
      }

      // Determine if any pet's quest was completed today (based on _completedAt local day)
      let anyCompletedToday = false;
      if (questsSnap.exists()) {
        const qData = questsSnap.data() as any;
        const petKeys = Object.keys(qData).filter((k) => k !== 'createdAt' && k !== 'updatedAt' && !k.startsWith('_'));
        for (const pet of petKeys) {
          try {
            const petObj = qData[pet] || {};
            const completedAt = petObj?._completedAt as Timestamp | null;
            if (completedAt) {
              const completedYmd = toLocalYmd(completedAt.toMillis());
              if (completedYmd === localDate) {
                anyCompletedToday = true;
                break;
              }
            }
          } catch {}
        }
      }

      if (!anyCompletedToday) {
        // Not eligible: do not change streak
        return currentStreak;
      }

      // Compute next streak with weekend-bonus continuity
      const nextStreak = isContinuousWithWeekendBonus(lastLocal, localDate) ? currentStreak + 1 : 1;

      txn.set(
        userRef,
        {
          streak: nextStreak,
          lastStreakIncrementAt: Timestamp.now(),
          lastStreakLocalDate: localDate,
          updatedAt: nowServerTimestamp(),
        } as any,
        { merge: true }
      );

      return nextStreak;
    });
  }

  // ==========================
  // API: Mood Period (8-hour rotation) - server source of truth
  // Stored under dailyQuests/{userId}._moodPeriod
  // ==========================

  export interface ServerMoodPeriod {
    periodId: string;
    anchorAt: Timestamp;
    nextResetAt: Timestamp;
    sadPetIds: string[];
    baselineCoinsByPet: Record<string, number>;
    lastAssignmentReason: 'sleep_anchor' | 'elapsed_no_sleep' | 'init' | string;
  }

  export interface ClientMoodPeriod {
    periodId: string;
    anchorMs: number;
    nextResetMs: number;
    sadPetIds: string[];
    engagementBaseline: Record<string, number>;
    lastAssignmentReason: 'sleep_anchor' | 'elapsed_no_sleep' | 'init' | string;
  }

  export async function fetchMoodPeriod(userId: string): Promise<ClientMoodPeriod | null> {
    if (!userId) return null;
    const ref = dailyQuestsDocRef(userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as any;
    const mp = data?._moodPeriod as ServerMoodPeriod | undefined;
    if (!mp || !mp.anchorAt || !mp.nextResetAt) return null;
    return {
      periodId: String(mp.periodId || ''),
      anchorMs: (mp.anchorAt as Timestamp).toMillis(),
      nextResetMs: (mp.nextResetAt as Timestamp).toMillis(),
      sadPetIds: Array.isArray(mp.sadPetIds) ? mp.sadPetIds as string[] : [],
      engagementBaseline: (mp.baselineCoinsByPet || {}) as Record<string, number>,
      lastAssignmentReason: String(mp.lastAssignmentReason || 'init'),
    };
  }

  export async function setMoodPeriod(userId: string, period: ClientMoodPeriod): Promise<void> {
    if (!userId || !period) return;
    const ref = dailyQuestsDocRef(userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      // initialize with defaults so write succeeds
      await setDoc(ref, createInitialDailyQuests());
    }
    const payload: ServerMoodPeriod = {
      periodId: period.periodId,
      anchorAt: Timestamp.fromMillis(Number(period.anchorMs || Date.now())),
      nextResetAt: Timestamp.fromMillis(Number(period.nextResetMs || Date.now() + 8 * 60 * 60 * 1000)),
      sadPetIds: Array.isArray(period.sadPetIds) ? period.sadPetIds : [],
      baselineCoinsByPet: period.engagementBaseline || {},
      lastAssignmentReason: (period.lastAssignmentReason as any) || 'init',
    };
    await setDoc(ref, { _moodPeriod: payload, updatedAt: nowServerTimestamp() } as any, { merge: true });
  }

  
  