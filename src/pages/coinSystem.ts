// Shared coin management system for the application
import { PetProgressStorage } from '@/lib/pet-progress-storage';

export class CoinSystem {
  private static readonly STORAGE_KEY = 'litkraft_coins'
  private static readonly MINIMUM_COINS = 0 // No minimum coins needed since feeding is free;
    private static readonly DEFAULT_COINS = 0;
  
  // Get current coin count from localStorage with minimum guarantee
  static getCoins(): number {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const coins = stored ? parseInt(stored, 10) : this.DEFAULT_COINS;
      
      // No minimum coins needed since feeding is free
      // if (coins < this.MINIMUM_COINS) {
      //   this.setCoins(this.MINIMUM_COINS);
      //   return this.MINIMUM_COINS;
      // }
      
      return coins;
    } catch (error) {
      console.warn('Failed to get coins from localStorage:', error);
      return this.DEFAULT_COINS; // Return default coins
    }
  }
  
    // Set coin count in localStorage
    static setCoins(amount: number): void {
      try {
        localStorage.setItem(this.STORAGE_KEY, amount.toString());
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('coinsChanged', { detail: { coins: amount } }));
      } catch (error) {
        console.warn('Failed to save coins to localStorage:', error);
      }
    }
  
  // Add coins (for correct answers)
  static addCoins(amount: number): number {
    const currentCoins = this.getCoins();
    const newCoins = currentCoins + amount;
    this.setCoins(newCoins);
    
    // Also update cumulative coins earned
    this.addToCumulativeCoins(amount);
    
    return newCoins;
  }

  // Update cumulative coins earned (for level progression)
  static addToCumulativeCoins(amount: number): number {
    try {
      const stored = localStorage.getItem('litkraft_cumulative_coins_earned');
      const currentCumulative = stored ? parseInt(stored, 10) : this.getCoins(); // Initialize with current coins for existing users
      const newCumulative = currentCumulative + amount;
      localStorage.setItem('litkraft_cumulative_coins_earned', newCumulative.toString());
      return newCumulative;
    } catch (error) {
      console.warn('Failed to update cumulative coins:', error);
      return 0;
    }
  }

  // Get cumulative coins earned (for level progression)
  static getCumulativeCoinsEarned(): number {
    try {
      const stored = localStorage.getItem('litkraft_cumulative_coins_earned');
      if (stored) {
        return parseInt(stored, 10);
      }
      
      // For existing users, initialize with current coins as a starting point
      const currentCoins = this.getCoins();
      localStorage.setItem('litkraft_cumulative_coins_earned', currentCoins.toString());
      return currentCoins;
    } catch (error) {
      console.warn('Failed to get cumulative coins:', error);
      return this.getCoins(); // Fallback to current coins
    }
  }

  // Add adventure coins (tracks both regular coins and adventure coins for pet care)
  static addAdventureCoins(amount: number, adventureType?: string): number {
    // Add to regular coins
    const newCoins = this.addCoins(amount);
    
    // Also track for cumulative pet care level - use direct localStorage access to avoid circular imports
    try {
      const stored = localStorage.getItem('litkraft_pet_data');
      let petData;
      
      if (stored) {
        petData = JSON.parse(stored);
      } else {
        // Default pet data structure
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
      
      // Ensure cumulativeCareLevel exists
      if (!petData.cumulativeCareLevel) {
        petData.cumulativeCareLevel = { feedingCount: 0, adventureCoins: 0, sleepCompleted: false, adventureCoinsAtLastSleep: 0 };
      }
      
      // Add adventure coins
      petData.cumulativeCareLevel.adventureCoins += amount;
      petData.lastUpdated = Date.now();
      
      // Save back to localStorage
      localStorage.setItem('litkraft_pet_data', JSON.stringify(petData));
      
      // Dispatch custom event to notify components
      window.dispatchEvent(new CustomEvent('petDataChanged', { detail: petData }));
      
      // Dispatch event for session coin tracking (now includes adventureType when available)
      window.dispatchEvent(new CustomEvent('adventureCoinsAdded', { detail: { amount, adventureType } }));
      
      console.log(`🪙 Added ${amount} adventure coins. Total: ${petData.cumulativeCareLevel.adventureCoins}`);
    } catch (error) {
      console.warn('Failed to track adventure coins for pet care:', error);
    }
    
    // Mirror to per-pet progress storage with adventure type attribution
    try {
      const currentPet = PetProgressStorage.getCurrentSelectedPet();
      if (currentPet) {
        PetProgressStorage.addAdventureCoins(currentPet, amount, adventureType || 'food');
      }
    } catch (error) {
      console.warn('Failed to mirror adventure coins to PetProgressStorage:', error);
    }

    return newCoins;
  }
  
  // Spend coins (for pet purchases, feeding, etc.)
  static spendCoins(amount: number): boolean {
    const currentCoins = this.getCoins();
    if (currentCoins >= amount) {
      const newAmount = currentCoins - amount;
      this.setCoins(newAmount);
      return true;
    }
    return false;
  }

  // Check if user can spend coins while maintaining minimum for feeding
  static canSpendForFeeding(amount: number): boolean {
    const currentCoins = this.getCoins();
    
    // Get current feeding count to determine if minimum should be enforced
    try {
      const petData = localStorage.getItem('litkraft_pet_data');
      if (petData) {
        const parsed = JSON.parse(petData);
        const feedingCount = parsed.cumulativeCareLevel?.feedingCount || 0;
        
        // Feeding is now free, so no need to reserve coins for feeding
        // if (feedingCount < 2) {
        //   const remainingFeedsNeeded = 2 - feedingCount;
        //   const coinsNeededForFeeds = remainingFeedsNeeded * 0; // 0 coins per feed (free)
        //   return currentCoins >= amount + coinsNeededForFeeds;
        // }
      }
    } catch (error) {
      console.warn('Failed to check feeding count:', error);
    }
    
    // After 2 feeds, normal spending rules apply
    return currentCoins >= amount;
  }
  
    // Check if user has enough coins
    static hasEnoughCoins(amount: number): boolean {
      return this.getCoins() >= amount;
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
    const [coins, setCoins] = useState(CoinSystem.getCoins());
  
    useEffect(() => {
      // Update coins from localStorage on mount
      setCoins(CoinSystem.getCoins());
  
      // Subscribe to coin changes
      const unsubscribe = CoinSystem.onCoinsChanged((newCoins) => {
        setCoins(newCoins);
      });
  
      return unsubscribe;
    }, []);
  
  return {
    coins,
    addCoins: (amount: number) => CoinSystem.addCoins(amount),
    addAdventureCoins: (amount: number, adventureType?: string) => CoinSystem.addAdventureCoins(amount, adventureType),
    spendCoins: (amount: number) => CoinSystem.spendCoins(amount),
    hasEnoughCoins: (amount: number) => CoinSystem.hasEnoughCoins(amount),
    canSpendForFeeding: (amount: number) => CoinSystem.canSpendForFeeding(amount),
    setCoins: (amount: number) => CoinSystem.setCoins(amount)
  };
  }
  