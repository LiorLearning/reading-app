// Pet data persistence service for local storage
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
}

export class PetDataService {
  private static readonly STORAGE_KEY = 'litkraft_pet_data';
  private static readonly DEFAULT_DATA: PetData = {
    careLevel: 0,
    ownedPets: ['dog'], // Start with dog
    audioEnabled: true,
    lastUpdated: Date.now(),
    coinsSpentPerStage: {
      smallPup: 0,
      mediumDog: 0,
      largeDog: 0
    },
    lastStreakLevel: 0,
    petCoinsSpent: {}
  };

  // Get current pet data from localStorage
  static getPetData(): PetData {
    try {
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
          return {
            ...this.DEFAULT_DATA,
            ...parsed,
            lastUpdated: parsed.lastUpdated || Date.now()
          };
        }
      }
    } catch (error) {
      console.warn('Failed to get pet data from localStorage:', error);
    }
    return { ...this.DEFAULT_DATA };
  }

  // Set pet data in localStorage
  static setPetData(data: Partial<PetData>): void {
    try {
      const currentData = this.getPetData();
      const updatedData: PetData = {
        ...currentData,
        ...data,
        lastUpdated: Date.now()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedData));
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('petDataChanged', { detail: updatedData }));
    } catch (error) {
      console.warn('Failed to save pet data to localStorage:', error);
    }
  }

  // Update care level and track coins spent per stage
  static setCareLevel(careLevel: number, currentStreak: number): void {
    const currentData = this.getPetData();
    const newCareLevel = Math.max(0, Math.min(careLevel, 6)); // Clamp between 0-6
    
    // Determine current evolution stage
    const currentStage = this.getEvolutionStage(currentStreak);
    
    // Check if evolution stage changed (streak increased)
    if (currentStreak > currentData.lastStreakLevel) {
      // Reset care level and coins for new stage
      this.setPetData({ 
        careLevel: 1, // Start with 1 feeding in new stage
        lastStreakLevel: currentStreak,
        coinsSpentPerStage: {
          ...currentData.coinsSpentPerStage,
          [currentStage]: 10 // First feeding in new stage
        }
      });
    } else {
      // Normal feeding in current stage
      const coinsToAdd = (newCareLevel - currentData.careLevel) * 10;
      this.setPetData({ 
        careLevel: newCareLevel,
        coinsSpentPerStage: {
          ...currentData.coinsSpentPerStage,
          [currentStage]: currentData.coinsSpentPerStage[currentStage] + coinsToAdd
        }
      });
    }
  }

  // Add a pet to owned pets
  static addOwnedPet(petId: string): void {
    const currentData = this.getPetData();
    if (!currentData.ownedPets.includes(petId)) {
      this.setPetData({ 
        ownedPets: [...currentData.ownedPets, petId] 
      });
    }
  }

  // Set audio enabled state
  static setAudioEnabled(enabled: boolean): void {
    this.setPetData({ audioEnabled: enabled });
  }

  // Get evolution stage based on streak
  static getEvolutionStage(streak: number): 'smallPup' | 'mediumDog' | 'largeDog' {
    if (streak >= 3) return 'largeDog';
    if (streak >= 2) return 'mediumDog';
    return 'smallPup';
  }

  // Get coins spent for current evolution stage
  static getCoinsSpentForCurrentStage(streak: number): number {
    const data = this.getPetData();
    const stage = this.getEvolutionStage(streak);
    return data.coinsSpentPerStage[stage] || 0;
  }

  // Get specific values
  static getCareLevel(): number {
    return this.getPetData().careLevel;
  }

  static getOwnedPets(): string[] {
    return this.getPetData().ownedPets;
  }

  static getAudioEnabled(): boolean {
    return this.getPetData().audioEnabled;
  }

  // Check if a pet is owned
  static isPetOwned(petId: string): boolean {
    return this.getOwnedPets().includes(petId);
  }

  // Get coins spent on a specific pet
  static getPetCoinsSpent(petId: string): number {
    const data = this.getPetData();
    return data.petCoinsSpent[petId] || 0;
  }

  // Add coins spent on a specific pet
  static addPetCoinsSpent(petId: string, coins: number): void {
    const currentData = this.getPetData();
    const currentSpent = currentData.petCoinsSpent[petId] || 0;
    this.setPetData({
      petCoinsSpent: {
        ...currentData.petCoinsSpent,
        [petId]: currentSpent + coins
      }
    });
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
  static resetPetData(): void {
    this.setPetData(this.DEFAULT_DATA);
  }
}

// React hook for using pet data in components
import { useState, useEffect } from 'react';

export function usePetData() {
  const [petData, setPetData] = useState(PetDataService.getPetData());

  useEffect(() => {
    // Update pet data from localStorage on mount
    setPetData(PetDataService.getPetData());

    // Subscribe to pet data changes
    const unsubscribe = PetDataService.onPetDataChanged((newData) => {
      setPetData(newData);
    });

    return unsubscribe;
  }, []);

  return {
    petData,
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
    resetPetData: () => PetDataService.resetPetData()
  };
}
