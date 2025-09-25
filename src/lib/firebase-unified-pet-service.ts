import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection,
  getDocs,
  writeBatch,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User } from 'firebase/auth';

// ===== INTERFACES =====

export interface FirebasePetData {
  // Core pet data (from pet-data-service.ts)
  careLevel: number;
  ownedPets: string[];
  audioEnabled: boolean;
  lastUpdated: number;
  coinsSpentPerStage: {
    smallPup: number;
    mediumDog: number;
    largeDog: number;
  };
  lastStreakLevel: number;
  petCoinsSpent: {
    [petId: string]: number;
  };
  cumulativeCareLevel: {
    feedingCount: number;
    adventureCoins: number;
    sleepCompleted: boolean;
    adventureCoinsAtLastSleep: number;
  };
  
  // Current pet selection
  currentSelectedPet: string;
  
  // Coins system
  coins: {
    current: number;
    cumulativeEarned: number;
    lastUpdated: number;
  };
  
  // Sleep system data
  sleepData: {
    clicks: number;
    timestamp: number;
    sleepStartTime: number;
    sleepEndTime: number;
    lastUpdated: number;
  };
  
  // Reset timers and streaks
  resetData: {
    lastResetTime: number;
    feedingStreak: {
      streak: number;
      lastFeedDate: string;
      feedDates: string[];
    };
    previousCareStage: number;
  };
  
  // Accessories and customization
  customization: {
    ownedDens: string[];
    ownedAccessories: {
      [petType: string]: string[];
    };
  };
  
  // Firebase metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebasePetProgressData {
  // Pet identification
  petId: string;
  petType: 'dog' | 'bobo' | 'feather' | 'cat' | 'hamster' | string;
  petName?: string;
  
  // Cumulative coins spent tracking
  cumulativeCoinsSpent: number;
  
  // Heart/care system with 8-hour reset cycle
  heartData: {
    feedingCount: number;
    adventureCoins: number;
    sleepCompleted: boolean;
    lastHeartResetTime: number;
    nextHeartResetTime: number;
  };
  
  // Per-adventure coin tracking
  adventureCoinsByType?: { [adventureType: string]: number };
  
  // Sequenced "to-do" progression tracking
  todoData?: {
    currentType: string;
    lastSwitchTime: number;
  };
  
  // Daily coins for image/emotion (per pet, resets by calendar day)
  dailyCoins?: {
    todayDate: string;
    todayCoins: number;
  };
  
  // Sleep timer system
  sleepData: {
    isAsleep: boolean;
    sleepStartTime: number;
    sleepEndTime: number;
    sleepClicks: number;
    sleepDuration: number;
    willBeSadOnWakeup: boolean;
  };
  
  // Evolution and streak data
  evolutionData: {
    currentStreak: number;
    evolutionStage: 'smallPup' | 'mediumDog' | 'largeDog';
    lastStreakUpdate: number;
  };
  
  // Level system data
  levelData: {
    currentLevel: number;
    totalAdventureCoinsEarned: number;
    levelUpTimestamp: number;
    previousLevel: number;
  };
  
  // Pet customization and unlocks
  customizationData: {
    unlockedFeatures: string[];
    purchasedItems: string[];
    equippedItems: {
      [category: string]: string;
    };
  };
  
  // General pet state
  generalData: {
    isOwned: boolean;
    purchaseDate: number;
    lastInteractionTime: number;
    audioEnabled: boolean;
  };
  
  // Firebase metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ===== FIREBASE SERVICE CLASS =====

class FirebaseUnifiedPetService {
  private static instance: FirebaseUnifiedPetService;
  private userId: string | null = null;
  private unsubscribers: (() => void)[] = [];

  private constructor() {
    // Listen for auth changes
    auth.onAuthStateChanged((user) => {
      this.userId = user?.uid || null;
    });
  }

  static getInstance(): FirebaseUnifiedPetService {
    if (!FirebaseUnifiedPetService.instance) {
      FirebaseUnifiedPetService.instance = new FirebaseUnifiedPetService();
    }
    return FirebaseUnifiedPetService.instance;
  }

  private getUserPetDataRef(userId: string) {
    return doc(db, 'userPetData', userId);
  }

  private getPetProgressRef(userId: string, petId: string) {
    return doc(db, 'userPetData', userId, 'petProgress', petId);
  }

  private getPetProgressCollectionRef(userId: string) {
    return collection(db, 'userPetData', userId, 'petProgress');
  }

  // ===== MAIN PET DATA METHODS =====

  async getPetData(userId?: string): Promise<FirebasePetData | null> {
    try {
      const uid = userId || this.userId;
      if (!uid) {
        console.warn('No user ID available for getPetData');
        return null;
      }

      const docRef = this.getUserPetDataRef(uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data() as FirebasePetData;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting pet data from Firebase:', error);
      return null;
    }
  }

  async setPetData(data: Partial<FirebasePetData>, userId?: string): Promise<boolean> {
    try {
      const uid = userId || this.userId;
      if (!uid) {
        console.warn('No user ID available for setPetData');
        return false;
      }

      const docRef = this.getUserPetDataRef(uid);
      const updateData = {
        ...data,
        updatedAt: serverTimestamp(),
      };

      // Check if document exists
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        await updateDoc(docRef, updateData);
      } else {
        // Create new document with default values
        await setDoc(docRef, {
          ...this.getDefaultPetData(),
          ...updateData,
          createdAt: serverTimestamp(),
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error setting pet data in Firebase:', error);
      return false;
    }
  }

  // ===== PET PROGRESS METHODS =====

  async getPetProgress(petId: string, userId?: string): Promise<FirebasePetProgressData | null> {
    try {
      const uid = userId || this.userId;
      if (!uid) {
        console.warn('No user ID available for getPetProgress');
        return null;
      }

      const docRef = this.getPetProgressRef(uid, petId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data() as FirebasePetProgressData;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting pet progress from Firebase:', error);
      return null;
    }
  }

  async setPetProgress(petData: Partial<FirebasePetProgressData> & { petId: string }, userId?: string): Promise<boolean> {
    try {
      const uid = userId || this.userId;
      if (!uid) {
        console.warn('No user ID available for setPetProgress');
        return false;
      }

      const docRef = this.getPetProgressRef(uid, petData.petId);
      const updateData = {
        ...petData,
        updatedAt: serverTimestamp(),
      };

      // Check if document exists
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        await updateDoc(docRef, updateData);
      } else {
        // Create new document with default values
        await setDoc(docRef, {
          ...this.getDefaultPetProgress(petData.petId, petData.petType || 'dog'),
          ...updateData,
          createdAt: serverTimestamp(),
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error setting pet progress in Firebase:', error);
      return false;
    }
  }

  async getAllPetProgress(userId?: string): Promise<FirebasePetProgressData[]> {
    try {
      const uid = userId || this.userId;
      if (!uid) {
        console.warn('No user ID available for getAllPetProgress');
        return [];
      }

      const collectionRef = this.getPetProgressCollectionRef(uid);
      const querySnapshot = await getDocs(collectionRef);
      
      return querySnapshot.docs.map(doc => doc.data() as FirebasePetProgressData);
    } catch (error) {
      console.error('Error getting all pet progress from Firebase:', error);
      return [];
    }
  }

  // ===== MIGRATION METHODS =====

  async migrateFromLocalStorage(userId?: string): Promise<boolean> {
    try {
      const uid = userId || this.userId;
      if (!uid) {
        console.warn('No user ID available for migration');
        return false;
      }

      console.log('🔄 Starting migration from localStorage to Firebase...');

      // Check if already migrated
      const existingData = await this.getPetData(uid);
      if (existingData) {
        console.log('✅ User data already exists in Firebase, skipping migration');
        return true;
      }

      // Migrate main pet data
      const petData = this.migratePetDataFromLocalStorage();
      if (petData) {
        await this.setPetData(petData, uid);
        console.log('✅ Migrated main pet data to Firebase');
      }

      // Migrate individual pet progress data
      const petProgressData = this.migratePetProgressFromLocalStorage();
      for (const petProgress of petProgressData) {
        await this.setPetProgress(petProgress, uid);
        console.log(`✅ Migrated progress for pet: ${petProgress.petId}`);
      }

      console.log('🎉 Migration completed successfully');
      return true;
    } catch (error) {
      console.error('❌ Error during migration:', error);
      return false;
    }
  }

  private migratePetDataFromLocalStorage(): Partial<FirebasePetData> | null {
    try {
      // Get data from various localStorage keys
      const petDataStr = localStorage.getItem('litkraft_pet_data');
      const coinsStr = localStorage.getItem('litkraft_coins');
      const cumulativeCoinsStr = localStorage.getItem('litkraft_cumulative_coins_earned');
      const currentPetStr = localStorage.getItem('current_pet');
      const sleepDataStr = localStorage.getItem('pet_sleep_data');
      const lastResetStr = localStorage.getItem('pet_last_reset_time');
      const streakDataStr = localStorage.getItem('pet_feeding_streak_data');
      const previousStageStr = localStorage.getItem('previous_care_stage');
      const ownedDensStr = localStorage.getItem('owned_dens');
      const ownedAccessoriesStr = localStorage.getItem('owned_accessories');

      const migrationData: Partial<FirebasePetData> = {
        ...this.getDefaultPetData()
      };

      // Migrate pet data service data
      if (petDataStr) {
        const petData = JSON.parse(petDataStr);
        migrationData.careLevel = petData.careLevel || 0;
        migrationData.ownedPets = petData.ownedPets || [];
        migrationData.audioEnabled = petData.audioEnabled !== undefined ? petData.audioEnabled : true;
        migrationData.coinsSpentPerStage = petData.coinsSpentPerStage || {
          smallPup: 0,
          mediumDog: 0,
          largeDog: 0
        };
        migrationData.lastStreakLevel = petData.lastStreakLevel || 0;
        migrationData.petCoinsSpent = petData.petCoinsSpent || {};
        migrationData.cumulativeCareLevel = petData.cumulativeCareLevel || {
          feedingCount: 0,
          adventureCoins: 0,
          sleepCompleted: false,
          adventureCoinsAtLastSleep: 0
        };
        migrationData.lastUpdated = petData.lastUpdated || Date.now();
      }

      // Migrate coins
      migrationData.coins = {
        current: coinsStr ? parseInt(coinsStr, 10) : 0,
        cumulativeEarned: cumulativeCoinsStr ? parseInt(cumulativeCoinsStr, 10) : 0,
        lastUpdated: Date.now()
      };

      // Migrate current pet
      migrationData.currentSelectedPet = currentPetStr || 'dog';

      // Migrate sleep data
      if (sleepDataStr) {
        const sleepData = JSON.parse(sleepDataStr);
        migrationData.sleepData = {
          clicks: sleepData.clicks || 0,
          timestamp: sleepData.timestamp || 0,
          sleepStartTime: sleepData.sleepStartTime || 0,
          sleepEndTime: sleepData.sleepEndTime || 0,
          lastUpdated: Date.now()
        };
      } else {
        migrationData.sleepData = {
          clicks: 0,
          timestamp: 0,
          sleepStartTime: 0,
          sleepEndTime: 0,
          lastUpdated: Date.now()
        };
      }

      // Migrate reset data
      const streakData = streakDataStr ? JSON.parse(streakDataStr) : {};
      migrationData.resetData = {
        lastResetTime: lastResetStr ? parseInt(lastResetStr, 10) : Date.now(),
        feedingStreak: {
          streak: streakData.streak || 0,
          lastFeedDate: streakData.lastFeedDate || '',
          feedDates: streakData.feedDates || []
        },
        previousCareStage: previousStageStr ? parseInt(previousStageStr, 10) : 1
      };

      // Migrate customization data
      migrationData.customization = {
        ownedDens: ownedDensStr ? JSON.parse(ownedDensStr) : [],
        ownedAccessories: ownedAccessoriesStr ? JSON.parse(ownedAccessoriesStr) : {}
      };

      console.log('📦 Migrated pet data:', migrationData);
      return migrationData;
    } catch (error) {
      console.error('Error migrating pet data from localStorage:', error);
      return null;
    }
  }

  private migratePetProgressFromLocalStorage(): FirebasePetProgressData[] {
    const migrationData: FirebasePetProgressData[] = [];
    
    try {
      // Get all pet progress data from localStorage
      const petTypes = ['dog', 'cat', 'bobo', 'feather', 'hamster'];
      
      for (const petType of petTypes) {
        const key = `litkraft_pet_progress_${petType}`;
        const dataStr = localStorage.getItem(key);
        
        if (dataStr) {
          try {
            const petProgress = JSON.parse(dataStr);
            migrationData.push({
              ...this.getDefaultPetProgress(petType, petType),
              ...petProgress,
              petId: petType,
              petType: petType
            });
            console.log(`📦 Found pet progress data for: ${petType}`);
          } catch (error) {
            console.warn(`Error parsing pet progress for ${petType}:`, error);
          }
        }
      }

      return migrationData;
    } catch (error) {
      console.error('Error migrating pet progress from localStorage:', error);
      return [];
    }
  }

  // ===== DEFAULT DATA METHODS =====

  private getDefaultPetData(): FirebasePetData {
    return {
      careLevel: 0,
      ownedPets: [], // Start with no pets - users must purchase them
      audioEnabled: true,
      lastUpdated: Date.now(),
      coinsSpentPerStage: {
        smallPup: 0,
        mediumDog: 0,
        largeDog: 0
      },
      lastStreakLevel: 0,
      petCoinsSpent: {},
      cumulativeCareLevel: {
        feedingCount: 0,
        adventureCoins: 0,
        sleepCompleted: false,
        adventureCoinsAtLastSleep: 0
      },
      currentSelectedPet: 'dog',
      coins: {
        current: 0,
        cumulativeEarned: 0,
        lastUpdated: Date.now()
      },
      sleepData: {
        clicks: 0,
        timestamp: 0,
        sleepStartTime: 0,
        sleepEndTime: 0,
        lastUpdated: Date.now()
      },
      resetData: {
        lastResetTime: Date.now(),
        feedingStreak: {
          streak: 0,
          lastFeedDate: '',
          feedDates: []
        },
        previousCareStage: 1
      },
      customization: {
        ownedDens: [],
        ownedAccessories: {}
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
  }

  private getDefaultPetProgress(petId: string, petType: string): FirebasePetProgressData {
    return {
      petId,
      petType,
      cumulativeCoinsSpent: 0,
      heartData: {
        feedingCount: 0,
        adventureCoins: 0,
        sleepCompleted: false,
        lastHeartResetTime: Date.now(),
        nextHeartResetTime: Date.now() + (8 * 60 * 60 * 1000) // 8 hours
      },
      adventureCoinsByType: {},
      todoData: {
        currentType: 'feeding',
        lastSwitchTime: Date.now()
      },
      dailyCoins: {
        todayDate: new Date().toISOString().split('T')[0],
        todayCoins: 0
      },
      sleepData: {
        isAsleep: false,
        sleepStartTime: 0,
        sleepEndTime: 0,
        sleepClicks: 0,
        sleepDuration: 8 * 60 * 60 * 1000, // 8 hours
        willBeSadOnWakeup: false
      },
      evolutionData: {
        currentStreak: 0,
        evolutionStage: 'smallPup',
        lastStreakUpdate: Date.now()
      },
      levelData: {
        currentLevel: 1,
        totalAdventureCoinsEarned: 0,
        levelUpTimestamp: Date.now(),
        previousLevel: 1
      },
      customizationData: {
        unlockedFeatures: [],
        purchasedItems: [],
        equippedItems: {}
      },
      generalData: {
        isOwned: false, // No pets are owned by default - users must purchase them
        purchaseDate: Date.now(),
        lastInteractionTime: Date.now(),
        audioEnabled: true
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
  }

  // ===== REALTIME LISTENERS =====

  onPetDataChanged(callback: (data: FirebasePetData | null) => void, userId?: string): () => void {
    const uid = userId || this.userId;
    if (!uid) {
      console.warn('No user ID available for pet data listener');
      return () => {};
    }

    const docRef = this.getUserPetDataRef(uid);
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        callback(doc.data() as FirebasePetData);
      } else {
        callback(null);
      }
    });

    this.unsubscribers.push(unsubscribe);
    return unsubscribe;
  }

  onPetProgressChanged(petId: string, callback: (data: FirebasePetProgressData | null) => void, userId?: string): () => void {
    const uid = userId || this.userId;
    if (!uid) {
      console.warn('No user ID available for pet progress listener');
      return () => {};
    }

    const docRef = this.getPetProgressRef(uid, petId);
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        callback(doc.data() as FirebasePetProgressData);
      } else {
        callback(null);
      }
    });

    this.unsubscribers.push(unsubscribe);
    return unsubscribe;
  }

  // ===== CLEANUP =====

  cleanup(): void {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
  }
}

// ===== SINGLETON EXPORT =====

export const firebaseUnifiedPetService = FirebaseUnifiedPetService.getInstance();
