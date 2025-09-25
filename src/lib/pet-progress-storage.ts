// Pet-wise local storage service for persistent progress tracking - now with Firebase integration
import { firebaseUnifiedPetService } from '@/lib/firebase-unified-pet-service';
import { auth } from '@/lib/firebase';

export interface PetProgressData {
  // Pet identification
  petId: string;
  petType: 'dog' | 'bobo' | 'feather' | string;
  petName?: string; // Custom pet name chosen by user
  
  // Cumulative coins spent tracking (for level upgrades)
  cumulativeCoinsSpent: number;
  
  // Heart/care system with 8-hour reset cycle
  heartData: {
    feedingCount: number;
    adventureCoins: number;
    sleepCompleted: boolean;
    lastHeartResetTime: number; // Timestamp of last 8-hour reset
    nextHeartResetTime: number; // When the next reset will occur
  };
  
  // Per-adventure coin tracking (does not reset with 8-hour cycle)
  adventureCoinsByType?: { [adventureType: string]: number };

  // Sequenced "to-do" progression tracking across adventures
  todoData?: {
    currentType: string; // Which item is currently featured in the bottom bar
    lastSwitchTime: number; // When it last switched (or was set on completion)
  };
  
  // Daily coins for image/emotion (per pet, resets by calendar day)
  dailyCoins?: {
    todayDate: string; // e.g., '2025-09-22' (US date if desired)
    todayCoins: number;
  };
  
  // Sleep timer system
  sleepData: {
    isAsleep: boolean;
    sleepStartTime: number; // When pet was put to sleep
    sleepEndTime: number; // When pet will wake up (sleepStartTime + sleep duration)
    sleepClicks: number; // Progress towards full sleep
    sleepDuration: number; // How long the pet sleeps (in milliseconds)
    willBeSadOnWakeup: boolean; // Whether pet will be sad when it wakes up
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
    totalAdventureCoinsEarned: number; // For level calculation
    levelUpTimestamp: number; // When last level up occurred
    previousLevel: number; // For level up detection
  };
  
  // Pet customization and unlocks
  customizationData: {
    unlockedImages: string[]; // Unlocked pet images/skins
    unlockedAccessories: string[]; // Unlocked accessories
    currentAccessory?: string; // Currently equipped accessory
    specialStates: string[]; // Special states unlocked (e.g., 'golden', 'rainbow')
  };
  
  // Achievement and milestone tracking
  achievementData: {
    totalFeedingsSinceOwned: number;
    totalAdventuresSinceOwned: number;
    totalSleepsSinceOwned: number;
    longestStreak: number;
    firstFeedingDate?: number;
    firstAdventureDate?: number;
    firstSleepDate?: number;
    milestones: string[]; // Achieved milestones
  };
  
  // General pet state
  generalData: {
    isOwned: boolean;
    audioEnabled: boolean;
    lastUpdated: number;
    isCurrentlySelected: boolean;
  };
}

export interface GlobalPetSettings {
  currentSelectedPet: string;
  globalAudioEnabled: boolean;
  lastGlobalUpdate: number;
}

export class PetProgressStorage {
  private static readonly PET_PROGRESS_KEY_PREFIX = 'litkraft_pet_progress_';
  private static readonly GLOBAL_SETTINGS_KEY = 'litkraft_global_pet_settings';
  private static readonly EIGHT_HOURS_MS = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
  private static readonly DEFAULT_SLEEP_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours default sleep
  private static isLoadingFromFirebase = false; // Flag to prevent sync loops
  private static readonly PENDING_SYNC_KEY = 'litkraft_pending_pet_syncs'; // Key for storing pending syncs
  private static isOnline = navigator.onLine; // Track online status

  // Get the storage key for a specific pet
  private static getPetStorageKey(petId: string): string {
    return `${this.PET_PROGRESS_KEY_PREFIX}${petId}`;
  }

  // Get default pet progress data
  private static getDefaultPetProgress(petId: string, petType: string): PetProgressData {
    const now = Date.now();
    return {
      petId,
      petType,
      petName: undefined, // Will be set when user chooses name
      cumulativeCoinsSpent: 0,
      heartData: {
        feedingCount: 0,
        adventureCoins: 0,
        sleepCompleted: false,
        lastHeartResetTime: now,
        nextHeartResetTime: now + this.EIGHT_HOURS_MS,
      },
      adventureCoinsByType: {
        'house': 0,
        'friend': 0,
        'food': 0,
        'travel': 0,
        'story': 0,
        'plant-dreams': 0,
      },
      todoData: {
        currentType: 'house',
        lastSwitchTime: now
      },
      dailyCoins: {
        todayDate: new Date().toISOString().slice(0, 10),
        todayCoins: 0,
      },
      sleepData: {
        isAsleep: false,
        sleepStartTime: 0,
        sleepEndTime: 0,
        sleepClicks: 0,
        sleepDuration: this.DEFAULT_SLEEP_DURATION_MS,
        willBeSadOnWakeup: false,
      },
      evolutionData: {
        currentStreak: 0,
        evolutionStage: 'smallPup',
        lastStreakUpdate: now,
      },
      levelData: {
        currentLevel: 1,
        totalAdventureCoinsEarned: 0,
        levelUpTimestamp: now,
        previousLevel: 1,
      },
      customizationData: {
        unlockedImages: [],
        unlockedAccessories: [],
        currentAccessory: undefined,
        specialStates: [],
      },
      achievementData: {
        totalFeedingsSinceOwned: 0,
        totalAdventuresSinceOwned: 0,
        totalSleepsSinceOwned: 0,
        longestStreak: 0,
        firstFeedingDate: undefined,
        firstAdventureDate: undefined,
        firstSleepDate: undefined,
        milestones: [],
      },
      generalData: {
        isOwned: false, // Start with no pets owned by default
        audioEnabled: true,
        lastUpdated: now,
        isCurrentlySelected: false,
      },
    };
  }

  // Get pet progress data (with Firebase integration for important pets)
  static getPetProgress(petId: string, petType: string = petId): PetProgressData {
    try {
      // If user is authenticated, prioritize fresh data over localStorage to prevent data leakage
      if (auth.currentUser) {
        // For authenticated users, only use localStorage if it exists and is recent
        // This prevents new users from inheriting old localStorage data
        const stored = localStorage.getItem(this.getPetStorageKey(petId));
        if (stored) {
          const parsed: PetProgressData = JSON.parse(stored);
          
          // Check if this data is from the current user session (within last hour)
          const dataAge = Date.now() - (parsed.generalData?.lastUpdated || 0);
          const oneHour = 60 * 60 * 1000;
          
          if (dataAge < oneHour) {
            // Validate and migrate data structure if needed
            const migrated = this.migratePetData(parsed, petId, petType);
            
            // Check for 8-hour heart reset
            this.checkAndPerformHeartReset(migrated);
            
            // Check sleep status
            this.updateSleepStatus(migrated);
            
            return migrated;
          } else {
            console.log(`🆕 Authenticated user: pet ${petId} localStorage data is stale, using fresh defaults`);
          }
        } else {
          console.log(`🆕 Authenticated user: no localStorage data for pet ${petId}, using fresh defaults`);
        }
        
        // Return fresh defaults for authenticated users without recent data
        return this.getDefaultPetProgress(petId, petType);
      }

      // For unauthenticated users, fall back to localStorage
      const stored = localStorage.getItem(this.getPetStorageKey(petId));
      if (stored) {
        const parsed: PetProgressData = JSON.parse(stored);
        
        // Validate and migrate data structure if needed
        const migrated = this.migratePetData(parsed, petId, petType);
        
        // Check for 8-hour heart reset
        this.checkAndPerformHeartReset(migrated);
        
        // Check sleep status
        this.updateSleepStatus(migrated);
        
        return migrated;
      }
    } catch (error) {
      console.warn(`Failed to get pet progress for ${petId}:`, error);
    }
    
    return this.getDefaultPetProgress(petId, petType);
  }

  // Save pet progress data
  static setPetProgress(petData: PetProgressData): void {
    try {
      petData.generalData.lastUpdated = Date.now();
      localStorage.setItem(this.getPetStorageKey(petData.petId), JSON.stringify(petData));
      
      // Sync to Firebase in background if user is authenticated
      this.syncPetProgressToFirebase(petData);
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('petProgressChanged', { 
        detail: { petId: petData.petId, data: petData } 
      }));
    } catch (error) {
      console.warn(`Failed to save pet progress for ${petData.petId}:`, error);
    }
  }

  // Migrate old data structure to new format
  private static migratePetData(data: any, petId: string, petType: string): PetProgressData {
    const defaultData = this.getDefaultPetProgress(petId, petType);
    
    // Ensure all required fields exist
    // Resolve and correct petType mismatches from older data
    const knownPetIds = ['dog', 'cat', 'hamster', 'bobo', 'feather'];
    let resolvedPetType = data.petType || petType || petId;
    if (knownPetIds.includes(petId) && resolvedPetType !== petId) {
      resolvedPetType = petId;
    }

    return {
      petId: data.petId || petId,
      petType: resolvedPetType,
      petName: data.petName || undefined, // Preserve existing pet name
      cumulativeCoinsSpent: data.cumulativeCoinsSpent || 0,
      heartData: {
        feedingCount: data.heartData?.feedingCount || data.feedingCount || 0,
        adventureCoins: data.heartData?.adventureCoins || data.adventureCoins || 0,
        sleepCompleted: data.heartData?.sleepCompleted || data.sleepCompleted || false,
        lastHeartResetTime: data.heartData?.lastHeartResetTime || Date.now(),
        nextHeartResetTime: data.heartData?.nextHeartResetTime || Date.now() + this.EIGHT_HOURS_MS,
      },
      adventureCoinsByType: {
        'house': data.adventureCoinsByType?.['house'] || 0,
        'friend': data.adventureCoinsByType?.['friend'] || 0,
        'food': data.adventureCoinsByType?.['food'] || 0,
        'travel': data.adventureCoinsByType?.['travel'] || 0,
        'story': data.adventureCoinsByType?.['story'] || 0,
        'plant-dreams': data.adventureCoinsByType?.['plant-dreams'] || 0,
      },
      todoData: {
        currentType: data.todoData?.currentType || 'house',
        lastSwitchTime: data.todoData?.lastSwitchTime || Date.now()
      },
      dailyCoins: {
        todayDate: data.dailyCoins?.todayDate || new Date().toISOString().slice(0, 10),
        todayCoins: data.dailyCoins?.todayCoins || 0,
      },
      sleepData: {
        isAsleep: data.sleepData?.isAsleep || false,
        sleepStartTime: data.sleepData?.sleepStartTime || 0,
        sleepEndTime: data.sleepData?.sleepEndTime || 0,
        sleepClicks: data.sleepData?.sleepClicks || data.sleepClicks || 0,
        sleepDuration: data.sleepData?.sleepDuration || this.DEFAULT_SLEEP_DURATION_MS,
        willBeSadOnWakeup: data.sleepData?.willBeSadOnWakeup || false,
      },
      evolutionData: {
        currentStreak: data.evolutionData?.currentStreak || data.currentStreak || 0,
        evolutionStage: data.evolutionData?.evolutionStage || this.getEvolutionStage(data.currentStreak || 0),
        lastStreakUpdate: data.evolutionData?.lastStreakUpdate || Date.now(),
      },
      levelData: {
        currentLevel: data.levelData?.currentLevel || 1,
        totalAdventureCoinsEarned: data.levelData?.totalAdventureCoinsEarned || data.heartData?.adventureCoins || 0,
        levelUpTimestamp: data.levelData?.levelUpTimestamp || Date.now(),
        previousLevel: data.levelData?.previousLevel || 1,
      },
      customizationData: {
        unlockedImages: data.customizationData?.unlockedImages || [],
        unlockedAccessories: data.customizationData?.unlockedAccessories || [],
        currentAccessory: data.customizationData?.currentAccessory,
        specialStates: data.customizationData?.specialStates || [],
      },
      achievementData: {
        totalFeedingsSinceOwned: data.achievementData?.totalFeedingsSinceOwned || data.heartData?.feedingCount || 0,
        totalAdventuresSinceOwned: data.achievementData?.totalAdventuresSinceOwned || 0,
        totalSleepsSinceOwned: data.achievementData?.totalSleepsSinceOwned || 0,
        longestStreak: data.achievementData?.longestStreak || data.evolutionData?.currentStreak || 0,
        firstFeedingDate: data.achievementData?.firstFeedingDate,
        firstAdventureDate: data.achievementData?.firstAdventureDate,
        firstSleepDate: data.achievementData?.firstSleepDate,
        milestones: data.achievementData?.milestones || [],
      },
      generalData: {
        isOwned: data.generalData?.isOwned !== undefined ? data.generalData.isOwned : (petId === 'dog'),
        audioEnabled: data.generalData?.audioEnabled !== undefined ? data.generalData.audioEnabled : true,
        lastUpdated: Date.now(),
        isCurrentlySelected: data.generalData?.isCurrentlySelected || false,
      },
    };
  }

  // Check and perform 8-hour heart reset
  private static checkAndPerformHeartReset(petData: PetProgressData): boolean {
    const now = Date.now();
    
    if (now >= petData.heartData.nextHeartResetTime) {
      console.log(`🕐 Performing 8-hour heart reset for pet ${petData.petId}`);
      
      // Reset heart data to initial state (sad and hungry)
      petData.heartData = {
        feedingCount: 0,
        adventureCoins: 0,
        sleepCompleted: false,
        lastHeartResetTime: now,
        nextHeartResetTime: now + this.EIGHT_HOURS_MS,
      };
      // NOTE: Per-adventure coins do NOT reset here by design
      
      // Reset sleep data if pet was sleeping
      if (petData.sleepData.isAsleep) {
        petData.sleepData = {
          isAsleep: false,
          sleepStartTime: 0,
          sleepEndTime: 0,
          sleepClicks: 0,
          sleepDuration: this.DEFAULT_SLEEP_DURATION_MS,
          willBeSadOnWakeup: true, // Pet will be sad after the reset
        };
      }
      
      // Save the updated data
      this.setPetProgress(petData);
      return true;
    }
    
    return false;
  }

  // Update sleep status based on current time
  private static updateSleepStatus(petData: PetProgressData): void {
    if (petData.sleepData.isAsleep) {
      const now = Date.now();
      
      // Check if sleep duration has ended
      if (now >= petData.sleepData.sleepEndTime) {
        console.log(`😴 Pet ${petData.petId} has finished sleeping`);
        
        petData.sleepData.isAsleep = false;
        petData.sleepData.willBeSadOnWakeup = true; // Pet will be sad when it wakes up
        
        // Save the updated data
        this.setPetProgress(petData);
      }
    }
  }

  // Get evolution stage based on streak
  private static getEvolutionStage(streak: number): 'smallPup' | 'mediumDog' | 'largeDog' {
    if (streak >= 3) return 'largeDog';
    if (streak >= 2) return 'mediumDog';
    return 'smallPup';
  }

  // Add coins spent for a specific pet
  static addCoinsSpent(petId: string, amount: number): void {
    const petData = this.getPetProgress(petId);
    petData.cumulativeCoinsSpent += amount;
    this.setPetProgress(petData);
  }

  // Get cumulative coins spent for a pet
  static getCumulativeCoinsSpent(petId: string): number {
    const petData = this.getPetProgress(petId);
    return petData.cumulativeCoinsSpent;
  }

  // Feed pet (increment feeding count)
  static feedPet(petId: string): void {
    const petData = this.getPetProgress(petId);
    const now = Date.now();
    
    petData.heartData.feedingCount += 1;
    petData.sleepData.willBeSadOnWakeup = false; // Feeding makes pet happy
    
    // Update achievement data
    petData.achievementData.totalFeedingsSinceOwned += 1;
    if (!petData.achievementData.firstFeedingDate) {
      petData.achievementData.firstFeedingDate = now;
    }
    
    // Check for milestones
    this.checkFeedingMilestones(petData);
    
    this.setPetProgress(petData);
  }

  // Add adventure coins for a pet
  static addAdventureCoins(petId: string, amount: number, adventureType: string = 'food'): void {
    const petData = this.getPetProgress(petId);
    const now = Date.now();
    
    petData.heartData.adventureCoins += amount;
    petData.levelData.totalAdventureCoinsEarned += amount;
    
    // Track per-adventure coins (persistent cumulative)
    if (!petData.adventureCoinsByType) {
      petData.adventureCoinsByType = {};
    }
    const prev = petData.adventureCoinsByType[adventureType] || 0;
    const updated = prev + amount;
    petData.adventureCoinsByType[adventureType] = updated;

    // If this adventure just crossed the completion threshold (50), pin the todo pointer here
    const COMPLETION_THRESHOLD = 50;
    if (prev < COMPLETION_THRESHOLD && updated >= COMPLETION_THRESHOLD) {
      petData.todoData = petData.todoData || { currentType: adventureType, lastSwitchTime: now };
      petData.todoData.currentType = adventureType;
      petData.todoData.lastSwitchTime = now; // Start 8-hour window showing the completed item
    }
    
    // Update achievement data
    petData.achievementData.totalAdventuresSinceOwned += 1;
    if (!petData.achievementData.firstAdventureDate) {
      petData.achievementData.firstAdventureDate = now;
    }
    
    // Check for level up
    const oldLevel = petData.levelData.currentLevel;
    const newLevel = this.calculateLevel(petData.levelData.totalAdventureCoinsEarned);
    
    if (newLevel > oldLevel) {
      petData.levelData.previousLevel = oldLevel;
      petData.levelData.currentLevel = newLevel;
      petData.levelData.levelUpTimestamp = now;
      
      // Unlock new features based on level
      this.checkLevelUnlocks(petData, newLevel);
    }
    
    // Check for adventure milestones
    this.checkAdventureMilestones(petData);
    
    // Update daily coins (date-based reset)
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (!petData.dailyCoins) {
        petData.dailyCoins = { todayDate: today, todayCoins: 0 };
      }
      if (petData.dailyCoins.todayDate !== today) {
        petData.dailyCoins.todayDate = today;
        petData.dailyCoins.todayCoins = 0;
      }
      petData.dailyCoins.todayCoins += amount;
    } catch {}
    
    this.setPetProgress(petData);
  }

  // Get per-pet daily coins for image/emotion selection
  static getTodayCoins(petId: string): number {
    const petData = this.getPetProgress(petId);
    const today = new Date().toISOString().slice(0, 10);
    if (!petData.dailyCoins || petData.dailyCoins.todayDate !== today) {
      return 0;
    }
    return petData.dailyCoins.todayCoins || 0;
  }

  // Get per-adventure coin totals map
  static getAdventureCoinsByType(petId: string): { [adventureType: string]: number } {
    const petData = this.getPetProgress(petId);
    return petData.adventureCoinsByType || {};
  }

  // Get coins for a specific adventure type
  static getAdventureCoinsForType(petId: string, adventureType: string): number {
    const map = this.getAdventureCoinsByType(petId);
    return map[adventureType] || 0;
  }

  // Check if a specific adventure type is completed (>= threshold coins)
  static isAdventureTypeCompleted(petId: string, adventureType: string, threshold: number = 50): boolean {
    return this.getAdventureCoinsForType(petId, adventureType) >= threshold;
  }

  // Given a fixed sequence, return the current "sad" adventure type
  static getCurrentSadAdventureType(petId: string, sequence: string[], threshold: number = 50): string {
    for (const type of sequence) {
      if (!this.isAdventureTypeCompleted(petId, type, threshold)) {
        return type;
      }
    }
    // If all are complete, keep the last item sad as per spec
    return sequence[sequence.length - 1];
  }

  // Determine which item to show in the bottom bar respecting 8-hour hold after completion
  static getCurrentTodoDisplayType(petId: string, sequence: string[], threshold: number = 50): string {
    const petData = this.getPetProgress(petId);
    const now = Date.now();
    const todo = petData.todoData || { currentType: sequence[0], lastSwitchTime: now };

    // Rollover rules:
    // - If calendar day changed since lastSwitchTime, update today's activity:
    //   - If currentType is completed, advance to the next in order
    //   - If not completed, keep the same
    // - If an 8-hour sleep just ended (wake-up event happened after lastSwitchTime), do the same rollover
    try {
      const lastDate = new Date(todo.lastSwitchTime).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);

      const { sleepData } = petData;
      const sleepEndedAfterLastSwitch =
        !!sleepData && !sleepData.isAsleep && sleepData.sleepEndTime > 0 && sleepData.sleepEndTime <= now && todo.lastSwitchTime < sleepData.sleepEndTime;

      const dayChanged = lastDate !== today;
      const shouldRollover = dayChanged || sleepEndedAfterLastSwitch;

      if (shouldRollover) {
        const currentIsDone = this.isAdventureTypeCompleted(petId, todo.currentType, threshold);
        let nextType = todo.currentType;
        if (currentIsDone) {
          const idx = Math.max(0, sequence.indexOf(todo.currentType));
          nextType = sequence[(idx + 1) < sequence.length ? (idx + 1) : idx];
        }
        petData.todoData = { currentType: nextType, lastSwitchTime: now };
        this.setPetProgress(petData);
        return nextType;
      }
    } catch {}

    // If within 8 hours of last switch, keep showing the pinned item
    if (now - todo.lastSwitchTime < this.EIGHT_HOURS_MS) {
      return todo.currentType || sequence[0];
    }

    // After 8 hours (and no rollover), apply simple rule:
    // - If currentType is completed, move to the next in order
    // - If not completed, keep the same
    const currentIsDone = this.isAdventureTypeCompleted(petId, todo.currentType, threshold);
    const idx = Math.max(0, sequence.indexOf(todo.currentType));
    const nextType = currentIsDone ? (sequence[(idx + 1) < sequence.length ? (idx + 1) : idx]) : todo.currentType;
    petData.todoData = { currentType: nextType, lastSwitchTime: now };
    this.setPetProgress(petData);
    return nextType;
  }

  // Put pet to sleep
  static putPetToSleep(petId: string, sleepDurationMs: number = this.DEFAULT_SLEEP_DURATION_MS): void {
    const petData = this.getPetProgress(petId);
    const now = Date.now();
    
    petData.sleepData = {
      isAsleep: true,
      sleepStartTime: now,
      sleepEndTime: now + sleepDurationMs,
      sleepClicks: petData.sleepData.sleepClicks + 1, // Increment sleep progress
      sleepDuration: sleepDurationMs,
      willBeSadOnWakeup: false, // Pet won't be sad immediately after being put to sleep
    };
    
    // Mark sleep as completed if enough clicks
    if (petData.sleepData.sleepClicks >= 5) {
      petData.heartData.sleepCompleted = true;
      
      // Update achievement data
      petData.achievementData.totalSleepsSinceOwned += 1;
      if (!petData.achievementData.firstSleepDate) {
        petData.achievementData.firstSleepDate = now;
      }
      
      // Check for sleep milestones
      this.checkSleepMilestones(petData);
    }
    
    this.setPetProgress(petData);
  }

  // Wake up pet (manually or automatically)
  static wakePet(petId: string): void {
    const petData = this.getPetProgress(petId);
    
    petData.sleepData.isAsleep = false;
    petData.sleepData.willBeSadOnWakeup = true; // Pet will be sad when woken up
    
    this.setPetProgress(petData);
  }

  // Get sleep time remaining in milliseconds
  static getSleepTimeRemaining(petId: string): number {
    const petData = this.getPetProgress(petId);
    
    if (!petData.sleepData.isAsleep) {
      return 0;
    }
    
    const now = Date.now();
    const remaining = petData.sleepData.sleepEndTime - now;
    return Math.max(0, remaining);
  }

  // Get time until next heart reset
  static getTimeUntilHeartReset(petId: string): number {
    const petData = this.getPetProgress(petId);
    const now = Date.now();
    return Math.max(0, petData.heartData.nextHeartResetTime - now);
  }

  // Check if pet is available for sleep (has enough adventure coins)
  static isPetReadyForSleep(petId: string): boolean {
    const petData = this.getPetProgress(petId);
    return petData.heartData.adventureCoins >= 50 && !petData.sleepData.isAsleep;
  }

  // Get heart fill percentage (0-100)
  static getHeartFillPercentage(petId: string): number {
    const petData = this.getPetProgress(petId);
    const { feedingCount, adventureCoins, sleepCompleted } = petData.heartData;
    
    let percentage = 0;
    
    // Feeding progression: 0 → 20% → 40%
    if (feedingCount >= 2) {
      percentage = 40;
    } else if (feedingCount >= 1) {
      percentage = 20;
    }
    
    // Adventure progression: 40% → 50% → 60% → 70% → 80% → 90% (capped at 90%)
    if (adventureCoins >= 100) {
      percentage = 90;
    } else if (adventureCoins >= 75) {
      percentage = 80;
    } else if (adventureCoins >= 50) {
      percentage = 70;
    } else if (adventureCoins >= 25) {
      percentage = 60;
    } else if (adventureCoins > 0 && percentage < 40) {
      percentage = Math.max(percentage, 30);
    }
    
    // Sleep provides the final 10%: 90% → 100%
    if (sleepCompleted) {
      percentage = 100;
    }
    
    return Math.min(100, percentage);
  }

  // Set pet ownership
  static setPetOwnership(petId: string, isOwned: boolean): void {
    const petData = this.getPetProgress(petId);
    petData.generalData.isOwned = isOwned;
    this.setPetProgress(petData);
  }

  // Set pet name
  static setPetName(petId: string, name: string): void {
    const petData = this.getPetProgress(petId);
    petData.petName = name.trim();
    this.setPetProgress(petData);
  }

  // Get pet name
  static getPetName(petId: string): string | undefined {
    const petData = this.getPetProgress(petId);
    return petData.petName;
  }

  // Get pet display name (custom name or default)
  static getPetDisplayName(petId: string): string {
    const petData = this.getPetProgress(petId);
    if (petData.petName) {
      return petData.petName;
    }
    
    // Return default names based on pet type
    const defaultNames: { [key: string]: string } = {
      'dog': 'Buddy',
      'cat': 'Whiskers', 
      'hamster': 'Peanut',
      'bobo': 'Bobo',
      'feather': 'Feather'
    };
    
    return defaultNames[petId] || petId;
  }

  // Get pet type from pet ID
  static getPetType(petId: string): string {
    const petData = this.getPetProgress(petId);
    return petData.petType || petId; // fallback to petId if petType is not set
  }

  // Check if pet is owned
  static isPetOwned(petId: string): boolean {
    const petData = this.getPetProgress(petId);
    return petData.generalData.isOwned;
  }

  // Global settings management
  static getGlobalSettings(): GlobalPetSettings {
    try {
      const stored = localStorage.getItem(this.GLOBAL_SETTINGS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to get global pet settings:', error);
    }
    
    return {
      currentSelectedPet: '', // No pet selected by default
      globalAudioEnabled: true,
      lastGlobalUpdate: Date.now(),
    };
  }

  static setGlobalSettings(settings: Partial<GlobalPetSettings>): void {
    try {
      const currentSettings = this.getGlobalSettings();
      const updatedSettings = {
        ...currentSettings,
        ...settings,
        lastGlobalUpdate: Date.now(),
      };
      
      localStorage.setItem(this.GLOBAL_SETTINGS_KEY, JSON.stringify(updatedSettings));
      
      // Dispatch custom event
      window.dispatchEvent(new CustomEvent('globalPetSettingsChanged', { detail: updatedSettings }));
    } catch (error) {
      console.warn('Failed to save global pet settings:', error);
    }
  }

  // Get currently selected pet (with Firebase integration)
  static getCurrentSelectedPet(): string {
    try {
      // For now, keep using localStorage for immediate synchronous access
      // Firebase sync happens in the background via the unified service
      return this.getGlobalSettings().currentSelectedPet;
    } catch (error) {
      console.warn('Failed to get current selected pet:', error);
      return 'dog'; // Default fallback
    }
  }

  // Async version for Firebase integration
  static async getCurrentSelectedPetAsync(): Promise<string> {
    try {
      // Try Firebase first if user is authenticated
      if (auth.currentUser) {
        const firebaseData = await firebaseUnifiedPetService.getPetData();
        if (firebaseData?.currentSelectedPet) {
          // Also update localStorage cache
          this.setCurrentSelectedPet(firebaseData.currentSelectedPet);
          return firebaseData.currentSelectedPet;
        }
      }

      // Fallback to localStorage
      return this.getCurrentSelectedPet();
    } catch (error) {
      console.warn('Failed to get current selected pet from Firebase:', error);
      return this.getCurrentSelectedPet(); // Fall back to sync version
    }
  }

  // Set currently selected pet (with Firebase integration)
  static setCurrentSelectedPet(petId: string): void {
    console.log(`🐾 Setting current selected pet to: ${petId}`);
    
    // Update global settings in localStorage immediately
    this.setGlobalSettings({ currentSelectedPet: petId });
    
    // Sync to Firebase in background if user is authenticated
    if (auth.currentUser) {
      console.log(`🔄 Syncing selected pet ${petId} to Firebase...`);
      firebaseUnifiedPetService.setPetData({
        currentSelectedPet: petId
      }).catch(error => {
        console.warn('Failed to sync current selected pet to Firebase:', error);
      });
    }
    
    // Update all pets' selection status (pet-wise updates)
    const allPetIds = this.getAllPetIds();
    console.log(`🔄 Updating selection status for all pets: ${allPetIds.join(', ')}`);
    allPetIds.forEach(id => {
      const petData = this.getPetProgress(id);
      const wasSelected = petData.generalData.isCurrentlySelected;
      petData.generalData.isCurrentlySelected = (id === petId);
      if (wasSelected !== petData.generalData.isCurrentlySelected) {
        console.log(`Pet ${id} selection changed: ${wasSelected} -> ${petData.generalData.isCurrentlySelected}`);
      }
      this.setPetProgress(petData);
    });
  }

  // Get all pet IDs that have been stored
  static getAllPetIds(): string[] {
    const petIds: string[] = [];
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.PET_PROGRESS_KEY_PREFIX)) {
          const petId = key.replace(this.PET_PROGRESS_KEY_PREFIX, '');
          petIds.push(petId);
        }
      }
    } catch (error) {
      console.warn('Failed to get all pet IDs:', error);
    }
    
    return petIds;
  }

  // Get all owned pets
  static getAllOwnedPets(): PetProgressData[] {
    const allPetIds = this.getAllPetIds();
    return allPetIds
      .map(petId => this.getPetProgress(petId))
      .filter(petData => petData.generalData.isOwned);
  }

  // Subscribe to pet progress changes
  static onPetProgressChanged(callback: (petId: string, data: PetProgressData) => void): () => void {
    const handler = (event: CustomEvent) => {
      callback(event.detail.petId, event.detail.data);
    };
    
    window.addEventListener('petProgressChanged', handler as EventListener);
    
    return () => {
      window.removeEventListener('petProgressChanged', handler as EventListener);
    };
  }

  // Subscribe to global settings changes
  static onGlobalSettingsChanged(callback: (settings: GlobalPetSettings) => void): () => void {
    const handler = (event: CustomEvent) => {
      callback(event.detail);
    };
    
    window.addEventListener('globalPetSettingsChanged', handler as EventListener);
    
    return () => {
      window.removeEventListener('globalPetSettingsChanged', handler as EventListener);
    };
  }

  // Reset all pet data (for testing or complete reset)
  static resetAllPetData(): void {
    const allPetIds = this.getAllPetIds();
    allPetIds.forEach(petId => {
      localStorage.removeItem(this.getPetStorageKey(petId));
    });
    localStorage.removeItem(this.GLOBAL_SETTINGS_KEY);
    
    // Dispatch reset event
    window.dispatchEvent(new CustomEvent('allPetDataReset'));
  }

  // Reset specific pet data
  static resetPetData(petId: string): void {
    localStorage.removeItem(this.getPetStorageKey(petId));
    
    // Dispatch reset event
    window.dispatchEvent(new CustomEvent('petDataReset', { detail: { petId } }));
  }

  // Level calculation based on adventure coins (updated progression system)
  private static calculateLevel(totalAdventureCoins: number): number {
    // New level progression:
    // Level 1: 0 coins (start)
    // Level 2: 50 coins (5 questions answered)
    // Level 3: 120 coins (12 questions answered)
    // Level 4: 200 coins (20 questions answered)
    // Level 5: 300 coins (30 questions answered)
    const levelThresholds = [0, 50, 120, 200, 300]; // Level thresholds
    
    for (let i = levelThresholds.length - 1; i >= 0; i--) {
      if (totalAdventureCoins >= levelThresholds[i]) {
        return i + 1;
      }
    }
    
    return 1; // Default to level 1
  }

  // Get level info for a pet
  static getLevelInfo(petId: string): { currentLevel: number; nextLevelThreshold: number; progress: number } {
    const petData = this.getPetProgress(petId);
    const currentLevel = petData.levelData.currentLevel;
    const totalCoins = petData.levelData.totalAdventureCoinsEarned;
    
    const levelThresholds = [0, 50, 120, 200, 300];
    const nextLevelThreshold = levelThresholds[currentLevel] || 300; // Cap at level 5
    
    let progress = 0;
    if (currentLevel < levelThresholds.length) {
      const currentThreshold = levelThresholds[currentLevel - 1] || 0;
      progress = ((totalCoins - currentThreshold) / (nextLevelThreshold - currentThreshold)) * 100;
    } else {
      progress = 100; // Max level reached
    }
    
    return {
      currentLevel,
      nextLevelThreshold,
      progress: Math.max(0, Math.min(100, progress))
    };
  }

  // Check for feeding milestones
  private static checkFeedingMilestones(petData: PetProgressData): void {
    const totalFeedings = petData.achievementData.totalFeedingsSinceOwned;
    const milestones = petData.achievementData.milestones;
    
    // Define feeding milestones
    const feedingMilestones = [
      { count: 1, milestone: 'first_feeding' },
      { count: 10, milestone: 'feeding_enthusiast' },
      { count: 50, milestone: 'feeding_master' },
      { count: 100, milestone: 'feeding_legend' },
    ];
    
    feedingMilestones.forEach(({ count, milestone }) => {
      if (totalFeedings >= count && !milestones.includes(milestone)) {
        milestones.push(milestone);
        console.log(`🏆 Milestone achieved: ${milestone}`);
      }
    });
  }

  // Check for adventure milestones
  private static checkAdventureMilestones(petData: PetProgressData): void {
    const totalAdventures = petData.achievementData.totalAdventuresSinceOwned;
    const totalCoins = petData.levelData.totalAdventureCoinsEarned;
    const milestones = petData.achievementData.milestones;
    
    // Define adventure milestones
    const adventureMilestones = [
      { count: 1, milestone: 'first_adventure' },
      { count: 10, milestone: 'adventure_seeker' },
      { count: 50, milestone: 'adventure_master' },
      { count: 100, milestone: 'adventure_legend' },
    ];
    
    const coinMilestones = [
      { coins: 100, milestone: 'coin_collector' },
      { coins: 500, milestone: 'coin_hoarder' },
      { coins: 1000, milestone: 'coin_master' },
    ];
    
    adventureMilestones.forEach(({ count, milestone }) => {
      if (totalAdventures >= count && !milestones.includes(milestone)) {
        milestones.push(milestone);
        console.log(`🏆 Milestone achieved: ${milestone}`);
      }
    });
    
    coinMilestones.forEach(({ coins, milestone }) => {
      if (totalCoins >= coins && !milestones.includes(milestone)) {
        milestones.push(milestone);
        console.log(`🏆 Milestone achieved: ${milestone}`);
      }
    });
  }

  // Check for sleep milestones
  private static checkSleepMilestones(petData: PetProgressData): void {
    const totalSleeps = petData.achievementData.totalSleepsSinceOwned;
    const milestones = petData.achievementData.milestones;
    
    // Define sleep milestones
    const sleepMilestones = [
      { count: 1, milestone: 'first_sleep' },
      { count: 10, milestone: 'sleep_lover' },
      { count: 50, milestone: 'sleep_master' },
    ];
    
    sleepMilestones.forEach(({ count, milestone }) => {
      if (totalSleeps >= count && !milestones.includes(milestone)) {
        milestones.push(milestone);
        console.log(`🏆 Milestone achieved: ${milestone}`);
      }
    });
  }

  // Check for level unlocks
  private static checkLevelUnlocks(petData: PetProgressData, newLevel: number): void {
    const customization = petData.customizationData;
    
    // Define level unlocks
    const levelUnlocks: { [level: number]: { images?: string[]; accessories?: string[]; states?: string[] } } = {
      2: {
        images: ['level2_variant1'],
        accessories: ['basic_collar'],
      },
      3: {
        images: ['level3_variant1', 'level3_variant2'],
        accessories: ['fancy_collar', 'bow_tie'],
        states: ['happy_glow'],
      },
      4: {
        images: ['level4_variant1', 'level4_variant2', 'level4_special'],
        accessories: ['crown', 'cape'],
        states: ['golden', 'rainbow'],
      },
    };
    
    const unlocks = levelUnlocks[newLevel];
    if (unlocks) {
      if (unlocks.images) {
        unlocks.images.forEach(image => {
          if (!customization.unlockedImages.includes(image)) {
            customization.unlockedImages.push(image);
          }
        });
      }
      
      if (unlocks.accessories) {
        unlocks.accessories.forEach(accessory => {
          if (!customization.unlockedAccessories.includes(accessory)) {
            customization.unlockedAccessories.push(accessory);
          }
        });
      }
      
      if (unlocks.states) {
        unlocks.states.forEach(state => {
          if (!customization.specialStates.includes(state)) {
            customization.specialStates.push(state);
          }
        });
      }
      
      console.log(`🎉 Level ${newLevel} unlocks:`, unlocks);
    }
  }

  // Customization methods
  static unlockImage(petId: string, imageId: string): void {
    const petData = this.getPetProgress(petId);
    if (!petData.customizationData.unlockedImages.includes(imageId)) {
      petData.customizationData.unlockedImages.push(imageId);
      this.setPetProgress(petData);
    }
  }

  static unlockAccessory(petId: string, accessoryId: string): void {
    const petData = this.getPetProgress(petId);
    if (!petData.customizationData.unlockedAccessories.includes(accessoryId)) {
      petData.customizationData.unlockedAccessories.push(accessoryId);
      this.setPetProgress(petData);
    }
  }

  static equipAccessory(petId: string, accessoryId: string): void {
    const petData = this.getPetProgress(petId);
    if (petData.customizationData.unlockedAccessories.includes(accessoryId)) {
      petData.customizationData.currentAccessory = accessoryId;
      this.setPetProgress(petData);
    }
  }

  static unequipAccessory(petId: string): void {
    const petData = this.getPetProgress(petId);
    petData.customizationData.currentAccessory = undefined;
    this.setPetProgress(petData);
  }

  // Achievement getters
  static getMilestones(petId: string): string[] {
    const petData = this.getPetProgress(petId);
    return petData.achievementData.milestones;
  }

  static getAchievementStats(petId: string): {
    totalFeedings: number;
    totalAdventures: number;
    totalSleeps: number;
    longestStreak: number;
    daysSinceFirstFeeding?: number;
  } {
    const petData = this.getPetProgress(petId);
    const achievements = petData.achievementData;
    
    let daysSinceFirstFeeding: number | undefined;
    if (achievements.firstFeedingDate) {
      const daysDiff = (Date.now() - achievements.firstFeedingDate) / (1000 * 60 * 60 * 24);
      daysSinceFirstFeeding = Math.floor(daysDiff);
    }
    
    return {
      totalFeedings: achievements.totalFeedingsSinceOwned,
      totalAdventures: achievements.totalAdventuresSinceOwned,
      totalSleeps: achievements.totalSleepsSinceOwned,
      longestStreak: achievements.longestStreak,
      daysSinceFirstFeeding,
    };
  }

  // Migration from old pet data service
  static migrateFromOldPetDataService(): void {
    try {
      // Get old pet data
      const oldPetData = localStorage.getItem('litkraft_pet_data');
      if (oldPetData) {
        const parsed = JSON.parse(oldPetData);
        
        // Migrate to new system for 'dog' pet
        const dogData = this.getDefaultPetProgress('dog', 'dog');
        
        // Map old data to new structure
        dogData.heartData.feedingCount = parsed.cumulativeCareLevel?.feedingCount || 0;
        dogData.heartData.adventureCoins = parsed.cumulativeCareLevel?.adventureCoins || 0;
        dogData.heartData.sleepCompleted = parsed.cumulativeCareLevel?.sleepCompleted || false;
        dogData.evolutionData.currentStreak = parsed.lastStreakLevel || 0;
        dogData.evolutionData.evolutionStage = this.getEvolutionStage(parsed.lastStreakLevel || 0);
        dogData.generalData.audioEnabled = parsed.audioEnabled !== undefined ? parsed.audioEnabled : true;
        
        // Migrate owned pets
        if (parsed.ownedPets && Array.isArray(parsed.ownedPets)) {
          parsed.ownedPets.forEach((petId: string) => {
            if (petId !== 'dog') {
              const petData = this.getDefaultPetProgress(petId, petId);
              petData.generalData.isOwned = true;
              petData.cumulativeCoinsSpent = parsed.petCoinsSpent?.[petId] || 0;
              this.setPetProgress(petData);
            }
          });
        }
        
        // Save migrated dog data
        this.setPetProgress(dogData);
        
        // Migrate sleep data
        const oldSleepData = localStorage.getItem('pet_sleep_data');
        if (oldSleepData) {
          const sleepParsed = JSON.parse(oldSleepData);
          dogData.sleepData.sleepClicks = sleepParsed.clicks || 0;
          dogData.sleepData.sleepStartTime = sleepParsed.timestamp || 0;
          this.setPetProgress(dogData);
        }
        
        console.log('🔄 Successfully migrated from old pet data service');
      }
    } catch (error) {
      console.warn('Failed to migrate from old pet data service:', error);
    }
  }

  // === FIREBASE SYNC METHODS ===
  
  // Sync pet progress to Firebase in background
  private static syncPetProgressToFirebase(petData: PetProgressData): void {
    if (!auth.currentUser || this.isLoadingFromFirebase) {
      return; // No user authenticated or loading from Firebase, skip sync
    }
    
    // Check if online
    if (!this.isOnline) {
      // Queue for later sync when online
      this.addToPendingSync(petData);
      return;
    }
    
    // Convert local data format to Firebase format
    const firebaseData = this.convertToFirebaseFormat(petData);
    
    // Sync in background without blocking
    firebaseUnifiedPetService.setPetProgress(firebaseData).catch(error => {
      console.warn(`Failed to sync pet ${petData.petId} to Firebase:`, error);
      // Add to pending sync queue for retry
      this.addToPendingSync(petData);
    });
  }
  
  // Load pet progress from Firebase with localStorage fallback
  static async getPetProgressFromFirebase(petId: string, petType: string = petId): Promise<PetProgressData> {
    try {
      if (auth.currentUser) {
        this.isLoadingFromFirebase = true;
        const firebaseData = await firebaseUnifiedPetService.getPetProgress(petId);
        if (firebaseData) {
          // Convert Firebase format to local format
          const localData = this.convertFromFirebaseFormat(firebaseData);
          
          // Update localStorage cache (without triggering Firebase sync)
          this.setPetProgress(localData);
          
          return localData;
        }
      }
    } catch (error) {
      console.warn(`Failed to load pet ${petId} from Firebase:`, error);
    } finally {
      this.isLoadingFromFirebase = false;
    }
    
    // Fallback to localStorage
    return this.getPetProgress(petId, petType);
  }
  
  // Convert local PetProgressData to Firebase format
  static convertToFirebaseFormat(petData: PetProgressData): any {
    return {
      petId: petData.petId,
      petType: petData.petType,
      petName: petData.petName,
      cumulativeCoinsSpent: petData.cumulativeCoinsSpent,
      heartData: petData.heartData,
      adventureCoinsByType: petData.adventureCoinsByType,
      todoData: petData.todoData,
      dailyCoins: petData.dailyCoins,
      sleepData: petData.sleepData,
      evolutionData: petData.evolutionData,
      levelData: petData.levelData,
      customizationData: {
        unlockedFeatures: petData.customizationData.unlockedImages || [],
        purchasedItems: petData.customizationData.unlockedAccessories || [],
        equippedItems: {
          accessory: petData.customizationData.currentAccessory || ''
        }
      },
      generalData: {
        isOwned: petData.generalData.isOwned,
        purchaseDate: petData.generalData.lastUpdated,
        lastInteractionTime: petData.generalData.lastUpdated,
        audioEnabled: petData.generalData.audioEnabled
      }
    };
  }
  
  // Convert Firebase format to local PetProgressData
  static convertFromFirebaseFormat(firebaseData: any): PetProgressData {
    const defaultData = this.getDefaultPetProgress(firebaseData.petId, firebaseData.petType);
    
    return {
      ...defaultData,
      petId: firebaseData.petId,
      petType: firebaseData.petType,
      petName: firebaseData.petName,
      cumulativeCoinsSpent: firebaseData.cumulativeCoinsSpent || 0,
      heartData: firebaseData.heartData || defaultData.heartData,
      adventureCoinsByType: firebaseData.adventureCoinsByType || defaultData.adventureCoinsByType,
      todoData: firebaseData.todoData || defaultData.todoData,
      dailyCoins: firebaseData.dailyCoins || defaultData.dailyCoins,
      sleepData: firebaseData.sleepData || defaultData.sleepData,
      evolutionData: firebaseData.evolutionData || defaultData.evolutionData,
      levelData: firebaseData.levelData || defaultData.levelData,
      customizationData: {
        unlockedImages: firebaseData.customizationData?.unlockedFeatures || [],
        unlockedAccessories: firebaseData.customizationData?.purchasedItems || [],
        currentAccessory: firebaseData.customizationData?.equippedItems?.accessory,
        specialStates: defaultData.customizationData.specialStates
      },
      achievementData: defaultData.achievementData, // Not in Firebase yet, keep local
      generalData: {
        isOwned: firebaseData.generalData?.isOwned || false,
        audioEnabled: firebaseData.generalData?.audioEnabled || true,
        lastUpdated: firebaseData.generalData?.lastInteractionTime || Date.now(),
        isCurrentlySelected: defaultData.generalData.isCurrentlySelected
      }
    };
  }

  // === OFFLINE SUPPORT METHODS ===
  
  // Initialize offline support
  static initializeOfflineSupport(): void {
    // Listen to online/offline events
    window.addEventListener('online', () => {
      console.log('🌐 Coming back online - syncing pending pet data...');
      this.isOnline = true;
      this.processPendingSync();
      this.refreshAllPetDataFromFirebase(); // Refresh data when coming online
    });

    window.addEventListener('offline', () => {
      console.log('📴 Gone offline - queuing pet data syncs...');
      this.isOnline = false;
    });

    // Listen to page visibility changes to refresh data when user switches tabs
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline && auth.currentUser) {
        console.log('👁️ Page became visible - refreshing pet data from Firebase...');
        this.refreshAllPetDataFromFirebase();
      }
    });

    // Listen to window focus events for additional tab switching detection
    window.addEventListener('focus', () => {
      if (this.isOnline && auth.currentUser) {
        console.log('🎯 Window gained focus - refreshing pet data from Firebase...');
        this.refreshAllPetDataFromFirebase();
      }
    });

    // Update initial online status
    this.isOnline = navigator.onLine;

    // Process any existing pending syncs on initialization
    this.processPendingSync();
  }
  
  // Add pet data to pending sync queue
  private static addToPendingSync(petData: PetProgressData): void {
    try {
      const pendingSyncs = this.getPendingSyncs();
      
      // Remove any existing entry for this pet (replace with latest data)
      const filtered = pendingSyncs.filter(p => p.petId !== petData.petId);
      
      // Add the new data with timestamp
      filtered.push({
        ...petData,
        pendingSyncTimestamp: Date.now()
      });
      
      localStorage.setItem(this.PENDING_SYNC_KEY, JSON.stringify(filtered));
      console.log(`📋 Added pet ${petData.petId} to pending sync queue`);
    } catch (error) {
      console.warn('Failed to add to pending sync queue:', error);
    }
  }
  
  // Get pending syncs from localStorage
  private static getPendingSyncs(): (PetProgressData & { pendingSyncTimestamp: number })[] {
    try {
      const stored = localStorage.getItem(this.PENDING_SYNC_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to get pending syncs:', error);
      return [];
    }
  }
  
  // Process all pending syncs
  private static async processPendingSync(): Promise<void> {
    if (!this.isOnline || !auth.currentUser) {
      return;
    }
    
    const pendingSyncs = this.getPendingSyncs();
    if (pendingSyncs.length === 0) {
      return;
    }
    
    console.log(`🔄 Processing ${pendingSyncs.length} pending pet syncs...`);
    
    const successful: string[] = [];
    
    // Process each pending sync
    for (const pendingData of pendingSyncs) {
      try {
        const firebaseData = this.convertToFirebaseFormat(pendingData);
        await firebaseUnifiedPetService.setPetProgress(firebaseData);
        successful.push(pendingData.petId);
        console.log(`✅ Synced pet ${pendingData.petId} successfully`);
      } catch (error) {
        console.warn(`❌ Failed to sync pet ${pendingData.petId}:`, error);
      }
    }
    
    // Remove successful syncs from queue
    if (successful.length > 0) {
      const remaining = pendingSyncs.filter(p => !successful.includes(p.petId));
      if (remaining.length === 0) {
        localStorage.removeItem(this.PENDING_SYNC_KEY);
      } else {
        localStorage.setItem(this.PENDING_SYNC_KEY, JSON.stringify(remaining));
      }
      
      console.log(`🎉 Successfully synced ${successful.length} pets, ${remaining.length} remaining`);
    }
  }
  
  // Get count of pending syncs (for debugging)
  static getPendingSyncCount(): number {
    return this.getPendingSyncs().length;
  }
  
  // Clear all pending syncs (for debugging)
  static clearPendingSyncs(): void {
    localStorage.removeItem(this.PENDING_SYNC_KEY);
    console.log('🗑️ Cleared all pending pet syncs');
  }

  // Manual refresh from Firebase (can be called by UI components)
  static async manualRefreshFromFirebase(): Promise<void> {
    if (!auth.currentUser) {
      console.warn('Cannot refresh from Firebase - user not authenticated');
      return;
    }
    
    console.log('🔄 Manual refresh from Firebase requested...');
    await this.refreshAllPetDataFromFirebase();
  }

  // Refresh all pet data from Firebase (for real-time sync between browser sessions)
  private static async refreshAllPetDataFromFirebase(): Promise<void> {
    if (!auth.currentUser || !this.isOnline) {
      return;
    }

    try {
      console.log('🔄 Starting comprehensive pet-wise Firebase refresh...');
      
      // First, get ALL pets from Firebase (authoritative source)
      const firebasePets = await firebaseUnifiedPetService.getAllPetProgress();
      const firebasePetIds = firebasePets.map(pet => pet.petId);
      
      // Get local pet IDs
      const localPetIds = this.getAllPetIds();
      
      // Combine both sets to ensure we have all pets
      const allPetIds = [...new Set([...firebasePetIds, ...localPetIds])];
      
      console.log(`🐾 Found pets - Firebase: [${firebasePetIds.join(', ')}], Local: [${localPetIds.join(', ')}], Combined: [${allPetIds.join(', ')}]`);

      // Refresh data for each pet (pet-wise processing)
      for (const petId of allPetIds) {
        try {
          console.log(`🔄 Processing pet: ${petId}`);
          
          const firebaseData = await firebaseUnifiedPetService.getPetProgress(petId);
          if (firebaseData) {
            const localData = this.convertFromFirebaseFormat(firebaseData);
            
            // Check if data has actually changed before updating
            const currentLocalData = this.getPetProgress(petId);
            if (this.hasDataChanged(currentLocalData, localData)) {
              // Temporarily set loading flag to prevent sync loop
              this.isLoadingFromFirebase = true;
              this.setPetProgress(localData);
              
              // Log what specifically changed for debugging
              const sleepChanged = currentLocalData.sleepData.isAsleep !== localData.sleepData.isAsleep || 
                                 currentLocalData.heartData.sleepCompleted !== localData.heartData.sleepCompleted;
              if (sleepChanged) {
                console.log(`😴 Sleep sync update for pet ${petId}:`, {
                  wasAsleep: currentLocalData.sleepData.isAsleep,
                  nowAsleep: localData.sleepData.isAsleep,
                  wasSleepCompleted: currentLocalData.heartData.sleepCompleted,
                  nowSleepCompleted: localData.heartData.sleepCompleted,
                  sleepClicks: localData.sleepData.sleepClicks
                });
              }
              
              console.log(`✅ Refreshed pet ${petId} from Firebase - data was updated in another session`);
            } else {
              console.log(`⚪ Pet ${petId} data unchanged, skipping update`);
            }
          } else if (localPetIds.includes(petId)) {
            console.log(`⚠️ Pet ${petId} exists locally but not in Firebase - will sync up on next change`);
          }
        } catch (error) {
          console.warn(`Failed to refresh pet ${petId} from Firebase:`, error);
        } finally {
          this.isLoadingFromFirebase = false;
        }
      }

      // Refresh global pet settings
      try {
        const firebasePetData = await firebaseUnifiedPetService.getPetData();
        if (firebasePetData?.currentSelectedPet) {
          const localSelectedPet = this.getCurrentSelectedPet();
          if (firebasePetData.currentSelectedPet !== localSelectedPet) {
            this.setCurrentSelectedPet(firebasePetData.currentSelectedPet);
            console.log(`🔄 Updated current selected pet from Firebase: ${firebasePetData.currentSelectedPet}`);
          }
        }
      } catch (error) {
        console.warn('Failed to refresh current selected pet from Firebase:', error);
      }

    } catch (error) {
      console.warn('Failed to refresh pet data from Firebase:', error);
    }
  }

  // Check if pet data has meaningfully changed (to avoid unnecessary updates)
  static hasDataChanged(oldData: PetProgressData, newData: PetProgressData): boolean {
    // Check key fields that would indicate meaningful changes including sleep data
    const oldSleepKey = `${oldData.sleepData.isAsleep}-${oldData.sleepData.sleepStartTime}-${oldData.sleepData.sleepEndTime}-${oldData.sleepData.sleepClicks}-${oldData.heartData.sleepCompleted}`;
    const newSleepKey = `${newData.sleepData.isAsleep}-${newData.sleepData.sleepStartTime}-${newData.sleepData.sleepEndTime}-${newData.sleepData.sleepClicks}-${newData.heartData.sleepCompleted}`;
    
    const oldKey = `${oldData.levelData.currentLevel}-${oldData.levelData.totalAdventureCoinsEarned}-${oldData.todoData?.currentType}-${JSON.stringify(oldData.adventureCoinsByType)}-${oldData.heartData.feedingCount}-${oldData.cumulativeCoinsSpent}-${oldSleepKey}`;
    const newKey = `${newData.levelData.currentLevel}-${newData.levelData.totalAdventureCoinsEarned}-${newData.todoData?.currentType}-${JSON.stringify(newData.adventureCoinsByType)}-${newData.heartData.feedingCount}-${newData.cumulativeCoinsSpent}-${newSleepKey}`;
    
    return oldKey !== newKey;
  }
}

// React hook for using pet progress in components
import { useState, useEffect } from 'react';

export function usePetProgress(petId: string, petType: string = 'dog') {
  const [petProgress, setPetProgress] = useState(() => PetProgressStorage.getPetProgress(petId, petType));
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());

  useEffect(() => {
    // Load from Firebase first if user is authenticated, then fallback to localStorage
    const loadPetData = async () => {
      try {
        console.log(`🐾 Loading pet-specific data for ${petId}...`);
        const data = await PetProgressStorage.getPetProgressFromFirebase(petId, petType);
        setPetProgress(data);
        setLastRefreshTime(Date.now());
        console.log(`✅ Loaded pet ${petId} data:`, { 
          level: data.levelData.currentLevel, 
          sleepStatus: data.sleepData.isAsleep,
          questType: data.todoData?.currentType 
        });
      } catch (error) {
        console.warn(`Failed to load pet ${petId} from Firebase, using localStorage:`, error);
        setPetProgress(PetProgressStorage.getPetProgress(petId, petType));
      }
    };

    loadPetData();

    // Subscribe to pet progress changes
    const unsubscribe = PetProgressStorage.onPetProgressChanged((changedPetId, newData) => {
      if (changedPetId === petId) {
        setPetProgress(newData);
        setLastRefreshTime(Date.now());
      }
    });

    // Set up periodic refresh to catch changes from other browser sessions (pet-specific)
    const refreshInterval = setInterval(async () => {
      // Only refresh if it's been more than 30 seconds since last refresh
      // and user is authenticated and online
      if (Date.now() - lastRefreshTime > 30000 && auth.currentUser && navigator.onLine) {
        try {
          console.log(`🔄 Periodic refresh check for specific pet: ${petId}`);
          const data = await PetProgressStorage.getPetProgressFromFirebase(petId, petType);
          
          // Check if data has actually changed before updating
          const hasChanged = PetProgressStorage.hasDataChanged(petProgress, data);
          if (hasChanged) {
            // Log what specifically changed for debugging
            const sleepChanged = petProgress.sleepData.isAsleep !== data.sleepData.isAsleep || 
                               petProgress.heartData.sleepCompleted !== data.heartData.sleepCompleted;
            const questChanged = petProgress.todoData?.currentType !== data.todoData?.currentType;
            const levelChanged = petProgress.levelData.currentLevel !== data.levelData.currentLevel;
            
            if (sleepChanged) {
              console.log(`😴 Pet ${petId} sleep sync:`, {
                wasAsleep: petProgress.sleepData.isAsleep,
                nowAsleep: data.sleepData.isAsleep,
                wasSleepCompleted: petProgress.heartData.sleepCompleted,
                nowSleepCompleted: data.heartData.sleepCompleted
              });
            }
            if (questChanged) {
              console.log(`🎯 Pet ${petId} quest sync:`, {
                wasQuest: petProgress.todoData?.currentType,
                nowQuest: data.todoData?.currentType
              });
            }
            if (levelChanged) {
              console.log(`📈 Pet ${petId} level sync:`, {
                wasLevel: petProgress.levelData.currentLevel,
                nowLevel: data.levelData.currentLevel
              });
            }
            
            setPetProgress(data);
            setLastRefreshTime(Date.now());
            console.log(`✅ Periodic refresh: Updated pet ${petId} data from Firebase`);
          } else {
            console.log(`⚪ Periodic refresh: Pet ${petId} data unchanged`);
          }
        } catch (error) {
          console.warn(`Periodic refresh failed for pet ${petId}:`, error);
        }
      }
    }, 15000); // Check every 15 seconds

    return () => {
      unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [petId, petType, petProgress, lastRefreshTime]);

  return {
    petProgress,
    // Convenience getters
    cumulativeCoinsSpent: petProgress.cumulativeCoinsSpent,
    heartFillPercentage: PetProgressStorage.getHeartFillPercentage(petId),
    isAsleep: petProgress.sleepData.isAsleep,
    sleepTimeRemaining: PetProgressStorage.getSleepTimeRemaining(petId),
    timeUntilHeartReset: PetProgressStorage.getTimeUntilHeartReset(petId),
    isReadyForSleep: PetProgressStorage.isPetReadyForSleep(petId),
    isOwned: petProgress.generalData.isOwned,
    
    // Level system
    levelInfo: PetProgressStorage.getLevelInfo(petId),
    currentLevel: petProgress.levelData.currentLevel,
    totalAdventureCoinsEarned: petProgress.levelData.totalAdventureCoinsEarned,
    
    // Achievements and milestones
    milestones: PetProgressStorage.getMilestones(petId),
    achievementStats: PetProgressStorage.getAchievementStats(petId),
    
    // Customization
    unlockedImages: petProgress.customizationData.unlockedImages,
    unlockedAccessories: petProgress.customizationData.unlockedAccessories,
    currentAccessory: petProgress.customizationData.currentAccessory,
    specialStates: petProgress.customizationData.specialStates,
    
    // Actions
    feedPet: () => PetProgressStorage.feedPet(petId),
    addAdventureCoins: (amount: number) => PetProgressStorage.addAdventureCoins(petId, amount),
    addCoinsSpent: (amount: number) => PetProgressStorage.addCoinsSpent(petId, amount),
    putToSleep: (duration?: number) => PetProgressStorage.putPetToSleep(petId, duration),
    wakePet: () => PetProgressStorage.wakePet(petId),
    setPetOwnership: (isOwned: boolean) => PetProgressStorage.setPetOwnership(petId, isOwned),
    setPetName: (name: string) => PetProgressStorage.setPetName(petId, name),
    getPetName: () => PetProgressStorage.getPetName(petId),
    getPetDisplayName: () => PetProgressStorage.getPetDisplayName(petId),
    
    // Customization actions
    unlockImage: (imageId: string) => PetProgressStorage.unlockImage(petId, imageId),
    unlockAccessory: (accessoryId: string) => PetProgressStorage.unlockAccessory(petId, accessoryId),
    equipAccessory: (accessoryId: string) => PetProgressStorage.equipAccessory(petId, accessoryId),
    unequipAccessory: () => PetProgressStorage.unequipAccessory(petId),
  };
}

// Hook for global pet settings
export function useGlobalPetSettings() {
  const [globalSettings, setGlobalSettings] = useState(() => PetProgressStorage.getGlobalSettings());

  useEffect(() => {
    // Update global settings from localStorage on mount
    setGlobalSettings(PetProgressStorage.getGlobalSettings());

    // Subscribe to global settings changes
    const unsubscribe = PetProgressStorage.onGlobalSettingsChanged((newSettings) => {
      setGlobalSettings(newSettings);
    });

    return unsubscribe;
  }, []);

  return {
    globalSettings,
    currentSelectedPet: globalSettings.currentSelectedPet,
    globalAudioEnabled: globalSettings.globalAudioEnabled,
    
    // Actions
    setCurrentSelectedPet: (petId: string) => PetProgressStorage.setCurrentSelectedPet(petId),
    setGlobalAudioEnabled: (enabled: boolean) => PetProgressStorage.setGlobalSettings({ globalAudioEnabled: enabled }),
  };
}
