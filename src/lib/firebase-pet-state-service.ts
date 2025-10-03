import { 
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  collection
} from 'firebase/firestore';
import { db } from './firebase';

export interface FirebasePetState {
  userId: string;
  petId: string;
  // Coins aggregated per adventure type
  adventureCoinsByType?: { [adventureType: string]: number };
  totalAdventureCoins?: number;
  // Sleep timers (server authoritative)
  sleepStartAt?: Timestamp;
  sleepEndAt?: Timestamp;
  lastResetAt?: Timestamp;
  // Cumulative care snapshot (for cross-device emotion)
  feedingCount?: number;
  sleepCompleted?: boolean;
  adventureCoinsAtLastSleep?: number;
  // Emotion/heart system
  emotionActive?: boolean; // whether the heart is half (a need is active)
  emotionRequiredAction?: 'water' | 'pat' | 'feed'; // action needed to fill heart
  emotionNextAction?: 'water' | 'pat' | 'feed'; // rotation pointer for next trigger
  emotionActivatedAtMs?: number; // client timestamp when need activated (for UX/timers)
  // bookkeeping
  updatedAt: Timestamp;
  createdAt: Timestamp;
}

class FirebasePetStateService {
  private getPetDocRef(userId: string, petId: string) {
    return doc(collection(db, 'users'), userId, 'pets', petId);
  }

  private getTodayDateString(): string {
    try { return new Date().toISOString().slice(0, 10); } catch {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    }
  }

  async initPetState(userId: string, petId: string): Promise<void> {
    const ref = this.getPetDocRef(userId, petId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        userId,
        petId,
        adventureCoinsByType: {},
        totalAdventureCoins: 0,
        feedingCount: 0,
        sleepCompleted: false,
        adventureCoinsAtLastSleep: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      } as Partial<FirebasePetState>);
    }
  }

  async addAdventureCoins(userId: string, petId: string, amount: number, adventureType: string): Promise<void> {
    const ref = this.getPetDocRef(userId, petId);
    const snap = await getDoc(ref);
    const data = snap.exists() ? (snap.data() as FirebasePetState) : ({} as FirebasePetState);
    const currentMap = { ...(data.adventureCoinsByType || {}) };
    const prev = currentMap[adventureType] || 0;
    currentMap[adventureType] = prev + amount;
    const total = (data.totalAdventureCoins || 0) + amount;

    await setDoc(ref, {
      adventureCoinsByType: currentMap,
      totalAdventureCoins: total,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  async setSleepWindow(userId: string, petId: string, start: boolean, durationMs: number = 8 * 60 * 60 * 1000): Promise<void> {
    const ref = this.getPetDocRef(userId, petId);
    if (start) {
      const end = new Date(Date.now() + durationMs);
      await setDoc(ref, {
        sleepStartAt: serverTimestamp(),
        sleepEndAt: new Date(end),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } else {
      await setDoc(ref, {
        sleepStartAt: null,
        sleepEndAt: null,
        updatedAt: serverTimestamp()
      } as any, { merge: true });
    }
  }

  async markReset(userId: string, petId: string): Promise<void> {
    const ref = this.getPetDocRef(userId, petId);
    await updateDoc(ref, { lastResetAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }

  async updateCumulativeCare(userId: string, petId: string, updates: Partial<Pick<FirebasePetState,
    'feedingCount' | 'sleepCompleted' | 'adventureCoinsAtLastSleep'>>): Promise<void> {
    const ref = this.getPetDocRef(userId, petId);
    await setDoc(ref, { ...updates, updatedAt: serverTimestamp() }, { merge: true });
  }

  // ----- Emotion helpers -----
  private rotateAction(current: 'water' | 'pat' | 'feed'): 'water' | 'pat' | 'feed' {
    if (current === 'water') return 'pat';
    if (current === 'pat') return 'feed';
    return 'water';
  }

  async getEmotionState(userId: string, petId: string): Promise<{
    emotionActive: boolean;
    emotionRequiredAction: 'water' | 'pat' | 'feed' | null;
    emotionNextAction: 'water' | 'pat' | 'feed';
    emotionActivatedAtMs: number | null;
  }> {
    const ref = this.getPetDocRef(userId, petId);
    const snap = await getDoc(ref);
    const data = (snap.exists() ? (snap.data() as FirebasePetState) : undefined);
    return {
      emotionActive: Boolean(data?.emotionActive),
      emotionRequiredAction: (data?.emotionRequiredAction as any) || null,
      emotionNextAction: (data?.emotionNextAction as any) || 'water',
      emotionActivatedAtMs: (data?.emotionActivatedAtMs as any) || null
    };
  }

  async activateEmotionNeed(userId: string, petId: string, requiredAction?: 'water' | 'pat' | 'feed'): Promise<'water' | 'pat' | 'feed'> {
    // Respect daily sadness assignment cap using dailyQuests/_sadness
    try {
      const dqRef = doc(db, 'dailyQuests', userId);
      const dqSnap = await getDoc(dqRef);
      const today = this.getTodayDateString();
      const s = (dqSnap.exists() ? (dqSnap.data() as any)?._sadness : null) as any;
      const assigned: string[] = (s && s.date === today && Array.isArray(s.assignedPets)) ? s.assignedPets : [];
      if (!assigned.includes(petId)) {
        // Not assigned to be sad today; do not activate emotion need
        const refNoop = this.getPetDocRef(userId, petId);
        const snapNoop = await getDoc(refNoop);
        const dataNoop = (snapNoop.exists() ? (snapNoop.data() as FirebasePetState) : undefined);
        const nextPtr = (dataNoop?.emotionNextAction as any) || 'water';
        return requiredAction || nextPtr;
      }
    } catch {}

    const ref = this.getPetDocRef(userId, petId);
    const snap = await getDoc(ref);
    const data = (snap.exists() ? (snap.data() as FirebasePetState) : undefined);
    const nextPointer = (data?.emotionNextAction as any) || 'water';
    const action = requiredAction || nextPointer;
    await setDoc(ref, {
      emotionActive: true,
      emotionRequiredAction: action,
      // Keep the nextAction as-is; it will be advanced on fulfillment
      emotionNextAction: nextPointer,
      emotionActivatedAtMs: Date.now(),
      updatedAt: serverTimestamp()
    } as Partial<FirebasePetState>, { merge: true });
    return action;
  }

  async fulfillEmotionNeed(userId: string, petId: string): Promise<'water' | 'pat' | 'feed'> {
    const ref = this.getPetDocRef(userId, petId);
    const snap = await getDoc(ref);
    const data = (snap.exists() ? (snap.data() as FirebasePetState) : undefined);
    const prevRequired = (data?.emotionRequiredAction as any) || 'water';
    const nextPointer = this.rotateAction(prevRequired);
    await setDoc(ref, {
      emotionActive: false,
      emotionRequiredAction: null,
      emotionNextAction: nextPointer,
      updatedAt: serverTimestamp()
    } as any, { merge: true });
    return nextPointer;
  }
}

export const firebasePetStateService = new FirebasePetStateService();


