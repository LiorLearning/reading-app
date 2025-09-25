// Pet data persistence service - now using Firebase with localStorage fallback
import { firebaseUnifiedPetService, FirebasePetData } from '@/lib/firebase-unified-pet-service';
import { auth } from '@/lib/firebase';

export interface PetData {
  careLevel: number;
  ownedPets: string[];
  audioEnabled: boolean;
  lastUpdated: number;
  // Track coins spent per evolution stage
  coinsSpentPerStage: {
    smallPup: number;    // streak < 2
    mediumDog: number;   // streak >= 2
    largeDog: number;    // streak >= 3
  };
  lastStreakLevel: number; // Track when evolution stage changed
  // Track coins spent per pet type
  petCoinsSpent: {
    [petId: string]: number; // e.g., 'bobo': 30, 'feather': 20
  };
  // Cumulative care level system
  cumulativeCareLevel: {
    feedingCount: number;     // Number of times fed (1 feeding = 20%, 2 feedings = 40%)
    adventureCoins: number;   // Total coins earned from adventures
    sleepCompleted: boolean;  // Whether sleep has been completed
    adventureCoinsAtLastSleep: number; // Adventure coins when last sleep was completed
  };
}

export class PetDataService {
  private static readonly STORAGE_KEY = 'litkraft_pet_data';
  private static readonly DEFAULT_DATA: PetData = {
    careLevel: 0,
    ownedPets: [], // Start with no pets - user must choose/buy them
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
    }
  };

  // Get current pet data from Firebase (with localStorage fallback)
  static async getPetData(): Promise<PetData> {
    try {
      // Try Firebase first if user is authenticated
      if (auth.currentUser) {
        const firebaseData = await firebaseUnifiedPetService.getPetData();
        if (firebaseData) {
          return this.convertFirebaseToPetData(firebaseData);
        }
        // If user is authenticated but no Firebase data exists, return fresh default data
        // This ensures new users start with clean state instead of inheriting localStorage data
        console.log('🆕 Authenticated user with no Firebase data - returning fresh defaults');
        return { ...this.DEFAULT_DATA };
      }

      // Fallback to localStorage only for unauthenticated users
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate the structure
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          typeof parsed.careLevel === 'number' &&
          Array.isArray(parsed.ownedPets) &&
          typeof parsed.audioEnabled === 'boolean'
        ) {
          // Ensure coinsSpentPerStage exists (for backward compatibility)
          if (!parsed.coinsSpentPerStage) {
            parsed.coinsSpentPerStage = {
              smallPup: 0,
              mediumDog: 0,
              largeDog: 0
            };
          }
          if (typeof parsed.lastStreakLevel !== 'number') {
            parsed.lastStreakLevel = 0;
          }
          // Ensure petCoinsSpent exists (for backward compatibility)
          if (!parsed.petCoinsSpent) {
            parsed.petCoinsSpent = {};
          }
          // Ensure cumulativeCareLevel exists (for backward compatibility)
          if (!parsed.cumulativeCareLevel) {
            parsed.cumulativeCareLevel = {
              feedingCount: 0,
              adventureCoins: 0,
              sleepCompleted: false,
              adventureCoinsAtLastSleep: 0
            };
          }
          // Ensure adventureCoinsAtLastSleep exists (for backward compatibility)
          if (typeof parsed.cumulativeCareLevel.adventureCoinsAtLastSleep !== 'number') {
            parsed.cumulativeCareLevel.adventureCoinsAtLastSleep = 0;
          }
          return {
            ...this.DEFAULT_DATA,
            ...parsed,
            lastUpdated: parsed.lastUpdated || Date.now()
          };
        }
      }
    } catch (error) {
      console.warn('Failed to get pet data from Firebase/localStorage:', error);
    }
    return { ...this.DEFAULT_DATA };
  }

  // Set pet data in Firebase (with localStorage fallback)
  static async setPetData(data: Partial<PetData>): Promise<void> {
    try {
      const currentData = await this.getPetData();
      const updatedData: PetData = {
        ...currentData,
        ...data,
        lastUpdated: Date.now()
      };

      // Try Firebase first if user is authenticated
      if (auth.currentUser) {
        const firebaseData = this.convertPetDataToFirebase(updatedData);
        const success = await firebaseUnifiedPetService.setPetData(firebaseData);
        
        if (success) {
          // Also update localStorage as backup
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedData));
          // Dispatch custom event to notify other components
          window.dispatchEvent(new CustomEvent('petDataChanged', { detail: updatedData }));
          return;
        }
      }

      // Fallback to localStorage
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedData));
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('petDataChanged', { detail: updatedData }));
    } catch (error) {
      console.warn('Failed to save pet data to Firebase/localStorage:', error);
    }
  }

  // Convert Firebase data format to PetData format
  private static convertFirebaseToPetData(firebaseData: FirebasePetData): PetData {
    return {
      careLevel: firebaseData.careLevel,
      ownedPets: firebaseData.ownedPets,
      audioEnabled: firebaseData.audioEnabled,
      lastUpdated: firebaseData.lastUpdated,
      coinsSpentPerStage: firebaseData.coinsSpentPerStage,
      lastStreakLevel: firebaseData.lastStreakLevel,
      petCoinsSpent: firebaseData.petCoinsSpent,
      cumulativeCareLevel: firebaseData.cumulativeCareLevel
    };
  }

  // Convert PetData format to Firebase data format
  private static convertPetDataToFirebase(petData: PetData): Partial<FirebasePetData> {
    return {
      careLevel: petData.careLevel,
      ownedPets: petData.ownedPets,
      audioEnabled: petData.audioEnabled,
      lastUpdated: petData.lastUpdated,
      coinsSpentPerStage: petData.coinsSpentPerStage,
      lastStreakLevel: petData.lastStreakLevel,
      petCoinsSpent: petData.petCoinsSpent,
      cumulativeCareLevel: petData.cumulativeCareLevel
    };
  }

  // Update care level and track coins spent per stage
  static async setCareLevel(careLevel: number, currentStreak: number): Promise<void> {
    const currentData = await this.getPetData();
    const newCareLevel = Math.max(0, Math.min(careLevel, 6)); // Clamp between 0-6
    
    // Determine current evolution stage
    const currentStage = this.getEvolutionStage(currentStreak);
    
    // Check if evolution stage changed (streak increased)
    if (currentStreak > currentData.lastStreakLevel) {
      // Reset care level and coins for new stage
      await this.setPetData({ 
        careLevel: 1, // Start with 1 feeding in new stage
        lastStreakLevel: currentStreak,
        coinsSpentPerStage: {
          ...currentData.coinsSpentPerStage,
          [currentStage]: 0 // First feeding in new stage (free)
        }
      });
    } else {
      // Normal feeding in current stage (free feeding)
      const coinsToAdd = (newCareLevel - currentData.careLevel) * 0; // Free feeding
      await this.setPetData({ 
        careLevel: newCareLevel,
        coinsSpentPerStage: {
          ...currentData.coinsSpentPerStage,
          [currentStage]: currentData.coinsSpentPerStage[currentStage] + coinsToAdd
        }
      });
    }
  }

  // Add a pet to owned pets
  static async addOwnedPet(petId: string): Promise<void> {
    const currentData = await this.getPetData();
    if (!currentData.ownedPets.includes(petId)) {
      await this.setPetData({ 
        ownedPets: [...currentData.ownedPets, petId] 
      });
    }
  }

  // Set audio enabled state
  static async setAudioEnabled(enabled: boolean): Promise<void> {
    await this.setPetData({ audioEnabled: enabled });
  }

  // Get evolution stage based on streak
  static getEvolutionStage(streak: number): 'smallPup' | 'mediumDog' | 'largeDog' {
    if (streak >= 3) return 'largeDog';
    if (streak >= 2) return 'mediumDog';
    return 'smallPup';
  }

  // Get coins spent for current evolution stage
  static async getCoinsSpentForCurrentStage(streak: number): Promise<number> {
    const data = await this.getPetData();
    const stage = this.getEvolutionStage(streak);
    return data.coinsSpentPerStage[stage] || 0;
  }

  // Get specific values
  static async getCareLevel(): Promise<number> {
    const data = await this.getPetData();
    return data.careLevel;
  }

  static async getOwnedPets(): Promise<string[]> {
    const data = await this.getPetData();
    return data.ownedPets;
  }

  static async getAudioEnabled(): Promise<boolean> {
    const data = await this.getPetData();
    return data.audioEnabled;
  }

  // Check if a pet is owned
  static async isPetOwned(petId: string): Promise<boolean> {
    const ownedPets = await this.getOwnedPets();
    return ownedPets.includes(petId);
  }

  // Get coins spent on a specific pet
  static async getPetCoinsSpent(petId: string): Promise<number> {
    const data = await this.getPetData();
    return data.petCoinsSpent[petId] || 0;
  }

  // Add coins spent on a specific pet
  static async addPetCoinsSpent(petId: string, coins: number): Promise<void> {
    const currentData = await this.getPetData();
    const currentSpent = currentData.petCoinsSpent[petId] || 0;
    await this.setPetData({
      petCoinsSpent: {
        ...currentData.petCoinsSpent,
        [petId]: currentSpent + coins
      }
    });
  }

  // Cumulative care level methods
  static async incrementFeedingCount(): Promise<void> {
    const currentData = await this.getPetData();
    await this.setPetData({
      cumulativeCareLevel: {
        ...currentData.cumulativeCareLevel,
        feedingCount: currentData.cumulativeCareLevel.feedingCount + 1
      }
    });
  }

  static async addAdventureCoins(coins: number): Promise<void> {
    const currentData = await this.getPetData();
    await this.setPetData({
      cumulativeCareLevel: {
        ...currentData.cumulativeCareLevel,
        adventureCoins: currentData.cumulativeCareLevel.adventureCoins + coins
      }
    });
  }

  static async setSleepCompleted(completed: boolean): Promise<void> {
    const currentData = await this.getPetData();
    await this.setPetData({
      cumulativeCareLevel: {
        ...currentData.cumulativeCareLevel,
        sleepCompleted: completed,
        // When sleep is completed, record current adventure coins
        adventureCoinsAtLastSleep: completed ? currentData.cumulativeCareLevel.adventureCoins : currentData.cumulativeCareLevel.adventureCoinsAtLastSleep
      }
    });
  }

  static async getCumulativeCarePercentage(): Promise<number> {
    const data = await this.getPetData();
    const { feedingCount, adventureCoins, sleepCompleted } = data.cumulativeCareLevel;
    
    let percentage = 0;
    
    // Feeding progression: 0 → 20% → 40%
    if (feedingCount >= 2) {
      percentage = 40;
    } else if (feedingCount >= 1) {
      percentage = 20;
    }
    
    // Adventure progression: 40% → 50% → 60% → 70% → 80% → 90% (capped at 90%)
    if (adventureCoins >= 100) {
      percentage = 90; // Cap at 90% - changed from 80% to 90%
    } else if (adventureCoins >= 75) {
      percentage = 80; // Changed from 70% to 80%
    } else if (adventureCoins >= 50) {
      percentage = 70; // Changed from 60% to 70%
    } else if (adventureCoins >= 25) {
      percentage = 60; // Changed from 50% to 60%
    } else if (adventureCoins > 0 && percentage < 40) {
      // If they have some adventure coins but haven't fed enough, show at least some progress
      percentage = Math.max(percentage, 30);
    }
    
    // Sleep provides the final 10%: 90% → 100%
    if (sleepCompleted) {
      percentage = 100; // Only sleep completion gives the final 10%
    }
    // Remove gradual sleep progression - only completed sleep gives the final 10%
    
    return Math.min(100, percentage); // Cap at 100%
  }

  static async getCumulativeCareLevel(): Promise<{ feedingCount: number; adventureCoins: number; sleepCompleted: boolean; adventureCoinsAtLastSleep: number }> {
    const data = await this.getPetData();
    return data.cumulativeCareLevel;
  }

  // Check if sleep is available (50 adventure coins since last sleep or first time)
  static async isSleepAvailable(): Promise<boolean> {
    const data = await this.getPetData();
    const { adventureCoins, adventureCoinsAtLastSleep } = data.cumulativeCareLevel;
    const coinsSinceLastSleep = adventureCoins - adventureCoinsAtLastSleep;
    return coinsSinceLastSleep >= 50;
  }

  static async resetCumulativeCareLevel(): Promise<void> {
    await this.setPetData({
      cumulativeCareLevel: {
        feedingCount: 0,
        adventureCoins: 0,
        sleepCompleted: false,
        adventureCoinsAtLastSleep: 0
      }
    });
  }

  // 8-hour time-based reset functionality for heart fill and pet state
  static async checkAndPerform8HourReset(): Promise<boolean> {
    try {
      // Try Firebase first if user is authenticated
      if (auth.currentUser) {
        const firebaseData = await firebaseUnifiedPetService.getPetData();
        if (firebaseData) {
          const lastResetTime = firebaseData.resetData?.lastResetTime || Date.now();
          const now = Date.now();
          const eightHours = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
          
          const timeSinceLastReset = now - lastResetTime;
          
          // If 8 hours have passed, perform reset
          if (timeSinceLastReset >= eightHours) {
            console.log('🕐 Performing 8-hour pet reset to initial state (heart fill and pet image)');
            
            // Reset cumulative care level to initial state (sad and hungry)
            await this.resetCumulativeCareLevel();
            
            // Reset sleep data in Firebase
            await firebaseUnifiedPetService.setPetData({
              sleepData: {
                clicks: 0,
                timestamp: 0,
                sleepStartTime: 0,
                sleepEndTime: 0,
                lastUpdated: now
              },
              resetData: {
                ...firebaseData.resetData,
                lastResetTime: now
              }
            });
            
            // Also update localStorage for fallback
            localStorage.removeItem('pet_sleep_data');
            localStorage.setItem('pet_last_reset_time', now.toString());
            
            return true; // Reset was performed
          }
          
          return false; // No reset needed
        }
      }

      // Fallback to localStorage
      const lastResetTime = localStorage.getItem('pet_last_reset_time');
      const now = Date.now();
      const eightHours = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
      
      // If no reset time recorded, set it to now and don't reset
      if (!lastResetTime) {
        localStorage.setItem('pet_last_reset_time', now.toString());
        return false;
      }
      
      const timeSinceLastReset = now - parseInt(lastResetTime);
      
      // If 8 hours have passed, perform reset
      if (timeSinceLastReset >= eightHours) {
        console.log('🕐 Performing 8-hour pet reset to initial state (heart fill and pet image)');
        
        // Reset cumulative care level to initial state (sad and hungry)
        await this.resetCumulativeCareLevel();
        
        // Reset sleep data
        localStorage.removeItem('pet_sleep_data');
        
        // Update last reset time
        localStorage.setItem('pet_last_reset_time', now.toString());
        
        return true; // Reset was performed
      }
      
      return false; // No reset needed
    } catch (error) {
      console.warn('Error checking 8-hour reset:', error);
      return false;
    }
  }

  // Keep the 24-hour reset for backward compatibility, but now it just calls 8-hour reset
  static async checkAndPerform24HourReset(): Promise<boolean> {
    return await this.checkAndPerform8HourReset();
  }

  // Migration logic for existing users
  static async migrateToCumulativeCareSystem(): Promise<void> {
    const currentData = await this.getPetData();
    
    // Check if migration is needed (if cumulative care level is at default values)
    if (currentData.cumulativeCareLevel.feedingCount === 0 && 
        currentData.cumulativeCareLevel.adventureCoins === 0 && 
        !currentData.cumulativeCareLevel.sleepCompleted) {
      
      // Estimate feeding count based on care level (each feeding was +1 care level, cost 10 coins)
      const estimatedFeedings = Math.min(currentData.careLevel, 6);
      
      // Try to get total coins from localStorage to estimate adventure coins
      let estimatedAdventureCoins = 0;
      try {
        const totalCoins = localStorage.getItem('litkraft_coins');
        if (totalCoins) {
          const coins = parseInt(totalCoins);
          // Estimate that some portion of coins came from adventures
          // This is a rough estimate - we'll be conservative
          estimatedAdventureCoins = Math.max(0, Math.min(coins * 0.3, 150)); // Max 150 to be safe
        }
      } catch (error) {
        console.warn('Could not estimate adventure coins during migration:', error);
      }
      
      // Check if sleep was completed (if care level is at max and sleep data exists)
      let sleepWasCompleted = false;
      try {
        const sleepData = localStorage.getItem('pet_sleep_data');
        if (sleepData) {
          const parsed = JSON.parse(sleepData);
          sleepWasCompleted = (parsed.clicks >= 5);
        }
      } catch (error) {
        console.warn('Could not check sleep data during migration:', error);
      }
      
      // Apply migration
      await this.setPetData({
        cumulativeCareLevel: {
          feedingCount: estimatedFeedings,
          adventureCoins: estimatedAdventureCoins,
          sleepCompleted: sleepWasCompleted,
          adventureCoinsAtLastSleep: sleepWasCompleted ? estimatedAdventureCoins : 0
        }
      });
      
      console.log('🔄 Migrated to cumulative care system:', {
        feedingCount: estimatedFeedings,
        adventureCoins: estimatedAdventureCoins,
        sleepCompleted: sleepWasCompleted
      });
    }
  }

  // Subscribe to pet data changes
  static onPetDataChanged(callback: (data: PetData) => void): () => void {
    const handler = (event: CustomEvent) => {
      callback(event.detail);
    };
    
    window.addEventListener('petDataChanged', handler as EventListener);
    
    // Return unsubscribe function
    return () => {
      window.removeEventListener('petDataChanged', handler as EventListener);
    };
  }

  // Reset all pet data (for testing or user reset)
  static async resetPetData(): Promise<void> {
    await this.setPetData(this.DEFAULT_DATA);
  }

  // Initialize Firebase migration on user auth
  static async initializeForUser(): Promise<void> {
    if (auth.currentUser) {
      try {
        // Try to migrate from localStorage to Firebase if needed
        await firebaseUnifiedPetService.migrateFromLocalStorage();
        console.log('✅ Pet data migration check completed');
      } catch (error) {
        console.warn('Migration check failed:', error);
      }
    }
  }
}

// React hook for using pet data in components
import { useState, useEffect } from 'react';

export function usePetData() {
  const [petData, setPetData] = useState<PetData>(() => ({
    careLevel: 0,
    ownedPets: [],
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
    }
  }));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Initialize pet data and migration
    const initializePetData = async () => {
      try {
        setIsLoading(true);
        
        // Initialize Firebase migration if user is authenticated
        await PetDataService.initializeForUser();
        
        // Load pet data
        const data = await PetDataService.getPetData();
        if (mounted) {
          setPetData(data);
        }
      } catch (error) {
        console.error('Error initializing pet data:', error);
        // Fallback to default data
        if (mounted) {
          setPetData(await PetDataService.getPetData());
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializePetData();

    // Subscribe to pet data changes
    const unsubscribe = PetDataService.onPetDataChanged((newData) => {
      if (mounted) {
        setPetData(newData);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return {
    petData,
    isLoading,
    careLevel: petData.careLevel,
    ownedPets: petData.ownedPets,
    audioEnabled: petData.audioEnabled,
    setCareLevel: (level: number, streak: number) => PetDataService.setCareLevel(level, streak),
    getCoinsSpentForCurrentStage: (streak: number) => PetDataService.getCoinsSpentForCurrentStage(streak),
    addOwnedPet: (petId: string) => PetDataService.addOwnedPet(petId),
    setAudioEnabled: (enabled: boolean) => PetDataService.setAudioEnabled(enabled),
    isPetOwned: (petId: string) => PetDataService.isPetOwned(petId),
    getPetCoinsSpent: (petId: string) => PetDataService.getPetCoinsSpent(petId),
    addPetCoinsSpent: (petId: string, coins: number) => PetDataService.addPetCoinsSpent(petId, coins),
    resetPetData: () => PetDataService.resetPetData(),
    // Cumulative care level methods
    incrementFeedingCount: () => PetDataService.incrementFeedingCount(),
    addAdventureCoins: (coins: number) => PetDataService.addAdventureCoins(coins),
    setSleepCompleted: (completed: boolean) => PetDataService.setSleepCompleted(completed),
    getCumulativeCarePercentage: () => PetDataService.getCumulativeCarePercentage(),
    getCumulativeCareLevel: () => PetDataService.getCumulativeCareLevel(),
    isSleepAvailable: () => PetDataService.isSleepAvailable(),
    resetCumulativeCareLevel: () => PetDataService.resetCumulativeCareLevel(),
    migrateToCumulativeCareSystem: () => PetDataService.migrateToCumulativeCareSystem(),
    checkAndPerform24HourReset: () => PetDataService.checkAndPerform24HourReset(),
    checkAndPerform8HourReset: () => PetDataService.checkAndPerform8HourReset()
  };
}
