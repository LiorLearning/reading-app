import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to track coins earned during the current adventure session
 * Separate from total coins - resets when adventure starts
 */
export const useSessionCoins = () => {
  const [sessionCoins, setSessionCoins] = useState(0);

  // Reset session coins (call when starting new adventure)
  const resetSessionCoins = useCallback(() => {
    setSessionCoins(0);
  }, []);

  // Add coins to current session
  const addSessionCoins = useCallback((amount: number) => {
    setSessionCoins(prev => prev + amount);
  }, []);

  // Listen for coin events from the global coin system
  useEffect(() => {
    const handleCoinsAdded = (event: CustomEvent) => {
      // When adventure coins are added, also add to session
      if (event.detail?.amount) {
        addSessionCoins(event.detail.amount);
      }
    };

    // Listen for custom coin events
    window.addEventListener('adventureCoinsAdded', handleCoinsAdded as EventListener);

    return () => {
      window.removeEventListener('adventureCoinsAdded', handleCoinsAdded as EventListener);
    };
  }, [addSessionCoins]);

  return {
    sessionCoins,
    addSessionCoins,
    resetSessionCoins
  };
};
