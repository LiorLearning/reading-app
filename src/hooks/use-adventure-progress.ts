import { useEffect, useMemo, useState } from 'react';
import { PetProgressStorage } from '@/lib/pet-progress-storage';

interface AdventureProgressState {
  activity: string | null;
  coinsSoFar: number; // progress numerator
  targetCoins: number; // progress denominator
  progressFraction: number; // 0..1
}

/**
 * useAdventurePersistentProgress
 * Returns persistent daily quest/adventure progress for the currently selected pet.
 * Source priority:
 * 1) Firestore-hydrated localStorage `litkraft_daily_quests_state` (activity/progress/target)
 * 2) Fallback to local per-adventure coins via PetProgressStorage using the canonical sequence
 */
export function useAdventurePersistentProgress(): AdventureProgressState {
  const [tick, setTick] = useState(0);

  // Bump tick on relevant events to recompute progress
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener('dailyQuestsUpdated', bump as EventListener);
    window.addEventListener('petProgressChanged', bump as EventListener);
    window.addEventListener('adventureCoinsAdded', bump as EventListener);
    return () => {
      window.removeEventListener('dailyQuestsUpdated', bump as EventListener);
      window.removeEventListener('petProgressChanged', bump as EventListener);
      window.removeEventListener('adventureCoinsAdded', bump as EventListener);
    };
  }, []);

  const state = useMemo<AdventureProgressState>(() => {
    // Determine current pet
    const currentPet = PetProgressStorage.getCurrentSelectedPet() || 'dog';

    // Try Firestore-hydrated daily quests first
    try {
      const questStatesRaw = typeof window !== 'undefined' ? localStorage.getItem('litkraft_daily_quests_state') : null;
      if (questStatesRaw) {
        const arr = JSON.parse(questStatesRaw) as Array<{ pet: string; activity: string; progress: number; target?: number }>;
        const item = arr?.find(x => x.pet === currentPet);
        if (item && typeof item.progress === 'number') {
          const target = (item && typeof item.target === 'number' && item.target > 0) ? item.target : 50;
          const progress = Math.max(0, Math.min(1, target > 0 ? item.progress / target : 0));
          return {
            activity: item.activity || null,
            coinsSoFar: Math.max(0, Math.min(target, item.progress || 0)),
            targetCoins: target,
            progressFraction: progress,
          };
        }
      }
    } catch {}

    // Fallback: derive from local per-adventure coins using canonical sequence
    const sequence = ['house', 'friend', 'dressing-competition', 'who-made-the-pets-sick', 'travel', 'food', 'plant-dreams'];
    const type = PetProgressStorage.getCurrentTodoDisplayType(currentPet, sequence, 50);
    const coinsForType = PetProgressStorage.getAdventureCoinsForType(currentPet, type) || 0;
    const target = 50;
    const fraction = Math.max(0, Math.min(1, coinsForType / target));
    return {
      activity: type,
      coinsSoFar: Math.max(0, Math.min(target, coinsForType)),
      targetCoins: target,
      progressFraction: fraction,
    };
  }, [tick]);

  return state;
}


