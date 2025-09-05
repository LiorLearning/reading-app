// Shared coin management system for the application
export class CoinSystem {
    private static readonly STORAGE_KEY = 'litkraft_coins';
    private static readonly DEFAULT_COINS = 0;
  
    // Get current coin count from localStorage
    static getCoins(): number {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        return stored ? parseInt(stored, 10) : this.DEFAULT_COINS;
      } catch (error) {
        console.warn('Failed to get coins from localStorage:', error);
        return this.DEFAULT_COINS;
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
      return newCoins;
    }
  
    // Spend coins (for pet purchases, feeding, etc.)
    static spendCoins(amount: number): boolean {
      const currentCoins = this.getCoins();
      if (currentCoins >= amount) {
        this.setCoins(currentCoins - amount);
        return true;
      }
      return false;
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
      spendCoins: (amount: number) => CoinSystem.spendCoins(amount),
      hasEnoughCoins: (amount: number) => CoinSystem.hasEnoughCoins(amount),
      setCoins: (amount: number) => CoinSystem.setCoins(amount)
    };
  }
  