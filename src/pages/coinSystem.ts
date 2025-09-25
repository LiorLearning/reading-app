// Shared coin management system for the application - now using Firebase
import { PetProgressStorage } from '@/lib/pet-progress-storage';
import { firebasePetStateService } from '@/lib/firebase-pet-state-service';
import { firebaseUnifiedPetService } from '@/lib/firebase-unified-pet-service';
import { auth } from '@/lib/firebase';

export class CoinSystem {
  private static readonly STORAGE_KEY = 'litkraft_coins'
  private static readonly MINIMUM_COINS = 0 // No minimum coins needed since feeding is free;
    private static readonly DEFAULT_COINS = 0; // Start with 0 coins for new users
  
  // Get current coin count from Firebase (with localStorage fallback)
  static async getCoins(): Promise<number> {
    try {
      // Try Firebase first if user is authenticated
      if (auth.currentUser) {
        const firebaseData = await firebaseUnifiedPetService.getPetData();
        if (firebaseData?.coins) {
          return firebaseData.coins.current;
        }
        // If user is authenticated but no Firebase data exists, return fresh default coins
        // This ensures new users start with clean state instead of inheriting localStorage coins
        console.log('🆕 Authenticated user with no Firebase coin data - returning fresh defaults');
        return this.DEFAULT_COINS;
      }

      // Fallback to localStorage only for unauthenticated users
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const coins = stored ? parseInt(stored, 10) : this.DEFAULT_COINS;
      
      return coins;
    } catch (error) {
      console.warn('Failed to get coins from Firebase/localStorage:', error);
      return this.DEFAULT_COINS; // Return default coins
    }
  }

  // Synchronous version for backward compatibility
  static getCoinsSync(): number {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? parseInt(stored, 10) : this.DEFAULT_COINS;
    } catch (error) {
      console.warn('Failed to get coins from localStorage:', error);
      return this.DEFAULT_COINS;
    }
  }
  
  // Set coin count in Firebase (with localStorage fallback)
  static async setCoins(amount: number): Promise<void> {
    try {
      // Try Firebase first if user is authenticated
      if (auth.currentUser) {
        const currentData = await firebaseUnifiedPetService.getPetData();
        const success = await firebaseUnifiedPetService.setPetData({
          coins: {
            current: amount,
            cumulativeEarned: currentData?.coins?.cumulativeEarned || amount,
            lastUpdated: Date.now()
          }
        });
        
        if (success) {
          // Also update localStorage as backup
          localStorage.setItem(this.STORAGE_KEY, amount.toString());
          // Dispatch custom event to notify other components
          window.dispatchEvent(new CustomEvent('coinsChanged', { detail: { coins: amount } }));
          return;
        }
      }

      // Fallback to localStorage
      localStorage.setItem(this.STORAGE_KEY, amount.toString());
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('coinsChanged', { detail: { coins: amount } }));
    } catch (error) {
      console.warn('Failed to save coins to Firebase/localStorage:', error);
    }
  }
  
  // Add coins (for correct answers)
  static async addCoins(amount: number): Promise<number> {
    const currentCoins = await this.getCoins();
    const newCoins = currentCoins + amount;
    await this.setCoins(newCoins);
    
    // Also update cumulative coins earned
    await this.addToCumulativeCoins(amount);
    
    return newCoins;
  }

  // Synchronous version for backward compatibility
  static addCoinsSync(amount: number): number {
    const currentCoins = this.getCoinsSync();
    const newCoins = currentCoins + amount;
    
    // Update localStorage immediately for sync operation
    localStorage.setItem(this.STORAGE_KEY, newCoins.toString());
    window.dispatchEvent(new CustomEvent('coinsChanged', { detail: { coins: newCoins } }));
    
    // Update cumulative coins
    this.addToCumulativeCoinsSync(amount);
    
    // Update Firebase in background
    this.setCoins(newCoins).catch(error => 
      console.warn('Background Firebase coin update failed:', error)
    );
    
    return newCoins;
  }

  // Update cumulative coins earned (for level progression)
  static async addToCumulativeCoins(amount: number): Promise<number> {
    try {
      // Try Firebase first if user is authenticated
      if (auth.currentUser) {
        const currentData = await firebaseUnifiedPetService.getPetData();
        const currentCumulative = currentData?.coins?.cumulativeEarned || 0;
        const newCumulative = currentCumulative + amount;
        
        await firebaseUnifiedPetService.setPetData({
          coins: {
            current: currentData?.coins?.current || this.DEFAULT_COINS,
            cumulativeEarned: newCumulative,
            lastUpdated: Date.now()
          }
        });
        
        // Also update localStorage as backup
        localStorage.setItem('litkraft_cumulative_coins_earned', newCumulative.toString());
        return newCumulative;
      }

      // Fallback to localStorage
      const stored = localStorage.getItem('litkraft_cumulative_coins_earned');
      const currentCumulative = stored ? parseInt(stored, 10) : await this.getCoins(); // Initialize with current coins for existing users
      const newCumulative = currentCumulative + amount;
      localStorage.setItem('litkraft_cumulative_coins_earned', newCumulative.toString());
      return newCumulative;
    } catch (error) {
      console.warn('Failed to update cumulative coins:', error);
      return 0;
    }
  }

  // Synchronous version for backward compatibility
  static addToCumulativeCoinsSync(amount: number): number {
    try {
      const stored = localStorage.getItem('litkraft_cumulative_coins_earned');
      const currentCumulative = stored ? parseInt(stored, 10) : this.getCoinsSync();
      const newCumulative = currentCumulative + amount;
      localStorage.setItem('litkraft_cumulative_coins_earned', newCumulative.toString());
      return newCumulative;
    } catch (error) {
      console.warn('Failed to update cumulative coins:', error);
      return 0;
    }
  }

  // Get cumulative coins earned (for level progression)
  static async getCumulativeCoinsEarned(): Promise<number> {
    try {
      // Try Firebase first if user is authenticated
      if (auth.currentUser) {
        const firebaseData = await firebaseUnifiedPetService.getPetData();
        if (firebaseData?.coins) {
          return firebaseData.coins.cumulativeEarned;
        }
      }

      // Fallback to localStorage
      const stored = localStorage.getItem('litkraft_cumulative_coins_earned');
      if (stored) {
        return parseInt(stored, 10);
      }
      
      // For existing users, initialize with current coins as a starting point
      const currentCoins = await this.getCoins();
      localStorage.setItem('litkraft_cumulative_coins_earned', currentCoins.toString());
      return currentCoins;
    } catch (error) {
      console.warn('Failed to get cumulative coins:', error);
      const coins = await this.getCoins();
      return coins; // Fallback to current coins
    }
  }

  // Add adventure coins (tracks both regular coins and adventure coins for pet care)
  static async addAdventureCoins(amount: number, adventureType?: string): Promise<number> {
    // Add to regular coins
    const newCoins = await this.addCoins(amount);
    
    // Track for cumulative pet care level using Firebase unified service
    try {
      // Try Firebase first if user is authenticated
      if (auth.currentUser) {
        const currentData = await firebaseUnifiedPetService.getPetData();
        if (currentData) {
          const currentAdventureCoins = currentData.cumulativeCareLevel?.adventureCoins || 0;
          const newAdventureCoins = currentAdventureCoins + amount;
          
          await firebaseUnifiedPetService.setPetData({
            cumulativeCareLevel: {
              ...currentData.cumulativeCareLevel,
              adventureCoins: newAdventureCoins
            }
          });
          
          // Also update localStorage as backup for other components
          const stored = localStorage.getItem('litkraft_pet_data');
          let petData;
          
          if (stored) {
            petData = JSON.parse(stored);
          } else {
            petData = {
              careLevel: 0,
              ownedPets: ['dog'],
              audioEnabled: true,
              lastUpdated: Date.now(),
              coinsSpentPerStage: { smallPup: 0, mediumDog: 0, largeDog: 0 },
              lastStreakLevel: 0,
              petCoinsSpent: {},
              cumulativeCareLevel: { feedingCount: 0, adventureCoins: 0, sleepCompleted: false, adventureCoinsAtLastSleep: 0 }
            };
          }
          
          if (!petData.cumulativeCareLevel) {
            petData.cumulativeCareLevel = { feedingCount: 0, adventureCoins: 0, sleepCompleted: false, adventureCoinsAtLastSleep: 0 };
          }
          
          petData.cumulativeCareLevel.adventureCoins = newAdventureCoins;
          petData.lastUpdated = Date.now();
          localStorage.setItem('litkraft_pet_data', JSON.stringify(petData));
          
          // Dispatch custom event to notify components
          window.dispatchEvent(new CustomEvent('petDataChanged', { detail: petData }));
          
          console.log(`🪙 Added ${amount} adventure coins. Total: ${newAdventureCoins}`);
        }
      } else {
        // Fallback to localStorage for unauthenticated users
        const stored = localStorage.getItem('litkraft_pet_data');
        let petData;
        
        if (stored) {
          petData = JSON.parse(stored);
        } else {
          petData = {
            careLevel: 0,
            ownedPets: ['dog'],
            audioEnabled: true,
            lastUpdated: Date.now(),
            coinsSpentPerStage: { smallPup: 0, mediumDog: 0, largeDog: 0 },
            lastStreakLevel: 0,
            petCoinsSpent: {},
            cumulativeCareLevel: { feedingCount: 0, adventureCoins: 0, sleepCompleted: false, adventureCoinsAtLastSleep: 0 }
          };
        }
        
        if (!petData.cumulativeCareLevel) {
          petData.cumulativeCareLevel = { feedingCount: 0, adventureCoins: 0, sleepCompleted: false, adventureCoinsAtLastSleep: 0 };
        }
        
        petData.cumulativeCareLevel.adventureCoins += amount;
        petData.lastUpdated = Date.now();
        localStorage.setItem('litkraft_pet_data', JSON.stringify(petData));
        
        // Dispatch custom event to notify components
        window.dispatchEvent(new CustomEvent('petDataChanged', { detail: petData }));
        
        console.log(`🪙 Added ${amount} adventure coins. Total: ${petData.cumulativeCareLevel.adventureCoins}`);
      }
      
      // Dispatch event for session coin tracking
      window.dispatchEvent(new CustomEvent('adventureCoinsAdded', { detail: { amount, adventureType } }));
    } catch (error) {
      console.warn('Failed to track adventure coins for pet care:', error);
    }
    
    // Mirror to per-pet progress storage with adventure type attribution
    try {
      const currentPet = PetProgressStorage.getCurrentSelectedPet();
      if (currentPet) {
        PetProgressStorage.addAdventureCoins(currentPet, amount, adventureType || 'food');

        // Also sync to Firestore when authenticated
        const user = auth.currentUser;
        if (user) {
          firebasePetStateService.initPetState(user.uid, currentPet).catch(() => {});
          firebasePetStateService.addAdventureCoins(user.uid, currentPet, amount, adventureType || 'food').catch(() => {});
        }
      }
    } catch (error) {
      console.warn('Failed to mirror adventure coins to PetProgressStorage:', error);
    }

    return newCoins;
  }

  // Synchronous version for backward compatibility
  static addAdventureCoinsSync(amount: number, adventureType?: string): number {
    // Add to regular coins synchronously
    const newCoins = this.addCoinsSync(amount);
    
    // Update localStorage immediately for pet data
    try {
      const stored = localStorage.getItem('litkraft_pet_data');
      let petData;
      
      if (stored) {
        petData = JSON.parse(stored);
      } else {
        petData = {
          careLevel: 0,
          ownedPets: ['dog'],
          audioEnabled: true,
          lastUpdated: Date.now(),
          coinsSpentPerStage: { smallPup: 0, mediumDog: 0, largeDog: 0 },
          lastStreakLevel: 0,
          petCoinsSpent: {},
          cumulativeCareLevel: { feedingCount: 0, adventureCoins: 0, sleepCompleted: false, adventureCoinsAtLastSleep: 0 }
        };
      }
      
      if (!petData.cumulativeCareLevel) {
        petData.cumulativeCareLevel = { feedingCount: 0, adventureCoins: 0, sleepCompleted: false, adventureCoinsAtLastSleep: 0 };
      }
      
      petData.cumulativeCareLevel.adventureCoins += amount;
      petData.lastUpdated = Date.now();
      localStorage.setItem('litkraft_pet_data', JSON.stringify(petData));
      
      // Dispatch events
      window.dispatchEvent(new CustomEvent('petDataChanged', { detail: petData }));
      window.dispatchEvent(new CustomEvent('adventureCoinsAdded', { detail: { amount, adventureType } }));
      
      // Update Firebase in background
      if (auth.currentUser) {
        this.addAdventureCoins(amount, adventureType).catch(error => 
          console.warn('Background Firebase adventure coins update failed:', error)
        );
      }
      
      console.log(`🪙 Added ${amount} adventure coins. Total: ${petData.cumulativeCareLevel.adventureCoins}`);
    } catch (error) {
      console.warn('Failed to track adventure coins for pet care:', error);
    }
    
    return newCoins;
  }
  
  // Spend coins (for pet purchases, feeding, etc.)
  static async spendCoins(amount: number): Promise<boolean> {
    const currentCoins = await this.getCoins();
    if (currentCoins >= amount) {
      const newAmount = currentCoins - amount;
      await this.setCoins(newAmount);
      return true;
    }
    return false;
  }

  // Synchronous version for backward compatibility
  static spendCoinsSync(amount: number): boolean {
    const currentCoins = this.getCoinsSync();
    if (currentCoins >= amount) {
      const newAmount = currentCoins - amount;
      localStorage.setItem(this.STORAGE_KEY, newAmount.toString());
      window.dispatchEvent(new CustomEvent('coinsChanged', { detail: { coins: newAmount } }));
      
      // Update Firebase in background
      this.setCoins(newAmount).catch(error => 
        console.warn('Background Firebase coin spend update failed:', error)
      );
      
      return true;
    }
    return false;
  }

  // Check if user can spend coins while maintaining minimum for feeding
  static async canSpendForFeeding(amount: number): Promise<boolean> {
    const currentCoins = await this.getCoins();
    
    // Feeding is now free, so normal spending rules apply
    return currentCoins >= amount;
  }
  
    // Check if user has enough coins
    static async hasEnoughCoins(amount: number): Promise<boolean> {
      const coins = await this.getCoins();
      return coins >= amount;
    }

    // Synchronous versions for backward compatibility
    static hasEnoughCoinsSync(amount: number): boolean {
      return this.getCoinsSync() >= amount;
    }
  
    // Subscribe to coin changes
    static onCoinsChanged(callback: (coins: number) => void): () => void {
      const handler = (event: CustomEvent) => {
        callback(event.detail.coins);
      };
      
      window.addEventListener('coinsChanged', handler as EventListener);
      
      // Return unsubscribe function
      return () => {
        window.removeEventListener('coinsChanged', handler as EventListener);
      };
    }
  }
  
// React hook for using coins in components
import { useState, useEffect } from 'react';

export function useCoins() {
  const [coins, setCoins] = useState(CoinSystem.getCoinsSync()); // Start with sync version for immediate display
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Initialize coins from Firebase
    const initializeCoins = async () => {
      try {
        setIsLoading(true);
        const currentCoins = await CoinSystem.getCoins();
        if (mounted) {
          setCoins(currentCoins);
        }
      } catch (error) {
        console.error('Error initializing coins:', error);
        // Fallback to sync version
        if (mounted) {
          setCoins(CoinSystem.getCoinsSync());
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeCoins();

    // Subscribe to coin changes
    const unsubscribe = CoinSystem.onCoinsChanged((newCoins) => {
      if (mounted) {
        setCoins(newCoins);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return {
    coins,
    isLoading,
    // Async methods
    addCoins: (amount: number) => CoinSystem.addCoins(amount),
    addAdventureCoins: (amount: number, adventureType?: string) => CoinSystem.addAdventureCoins(amount, adventureType),
    spendCoins: (amount: number) => CoinSystem.spendCoins(amount),
    hasEnoughCoins: (amount: number) => CoinSystem.hasEnoughCoins(amount),
    canSpendForFeeding: (amount: number) => CoinSystem.canSpendForFeeding(amount),
    setCoins: (amount: number) => CoinSystem.setCoins(amount),
    // Synchronous methods for backward compatibility
    addCoinsSync: (amount: number) => CoinSystem.addCoinsSync(amount),
    addAdventureCoinsSync: (amount: number, adventureType?: string) => CoinSystem.addAdventureCoinsSync(amount, adventureType),
    spendCoinsSync: (amount: number) => CoinSystem.spendCoinsSync(amount),
    hasEnoughCoinsSync: (amount: number) => CoinSystem.hasEnoughCoinsSync(amount),
    getCoinsSync: () => CoinSystem.getCoinsSync()
  };
}
  