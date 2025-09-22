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
  // bookkeeping
  updatedAt: Timestamp;
  createdAt: Timestamp;
}

class FirebasePetStateService {
  private getPetDocRef(userId: string, petId: string) {
    return doc(collection(db, 'users'), userId, 'pets', petId);
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
}

export const firebasePetStateService = new FirebasePetStateService();


