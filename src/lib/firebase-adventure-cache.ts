// Hybrid adventure storage - tries Firebase first, falls back to localStorage
import { firebaseAdventureService } from './firebase-adventure-service';
import { SavedAdventure, AdventureSummary } from './utils';

/**
 * Save adventure with Firebase sync (fallback to localStorage)
 */
export const saveAdventureHybrid = async (
  userId: string | null,
  adventure: SavedAdventure
): Promise<void> => {
  if (userId) {
    try {
      await firebaseAdventureService.saveAdventureFirebase(userId, adventure);
      return;
    } catch (error) {
      console.warn('Firebase save failed, using localStorage fallback');
    }
  }

  // Fallback to localStorage
  const { saveAdventure } = await import('./utils');
  saveAdventure(adventure);
};

/**
 * Load adventures with Firebase sync (fallback to localStorage)
 */
export const loadAdventuresHybrid = async (
  userId: string | null
): Promise<SavedAdventure[]> => {
  if (userId) {
    try {
      const firebaseAdventures = await firebaseAdventureService.loadUserAdventuresFirebase(userId);
      
      if (firebaseAdventures.length > 0) {
        return firebaseAdventures;
      }
    } catch (error) {
      console.warn('Firebase load failed, using localStorage fallback');
    }
  }

  // Fallback to localStorage
  const { loadSavedAdventures } = await import('./utils');
  return loadSavedAdventures();
};

/**
 * Load adventure summaries with Firebase sync
 */
export const loadAdventureSummariesHybrid = async (
  userId: string | null
): Promise<AdventureSummary[]> => {
  if (userId) {
    try {
      const summaries = await firebaseAdventureService.getAdventureSummariesFirebase(userId);
      
      if (summaries.length > 0) {
        return summaries;
      }
    } catch (error) {
      console.warn('Firebase summaries load failed, using localStorage fallback');
    }
  }

  // Fallback to localStorage
  const { loadAdventureSummaries } = await import('./utils');
  return loadAdventureSummaries();
};

/**
 * Get specific adventure with Firebase sync
 */
export const getAdventureHybrid = async (
  userId: string | null,
  adventureId: string
): Promise<SavedAdventure | null> => {
  if (userId) {
    try {
      const adventure = await firebaseAdventureService.getAdventureFirebase(userId, adventureId);
      if (adventure) {
        return adventure;
      }
    } catch (error) {
      console.warn('Firebase adventure load failed, checking localStorage');
    }
  }

  // Fallback: check localStorage
  const { loadSavedAdventures } = await import('./utils');
  const localAdventures = loadSavedAdventures();
  return localAdventures.find(a => a.id === adventureId) || null;
};

/**
 * Update adventure last played time
 */
export const updateLastPlayedHybrid = async (
  userId: string | null,
  adventureId: string
): Promise<void> => {
  if (userId) {
    try {
      await firebaseAdventureService.updateLastPlayedFirebase(userId, adventureId);
      return;
    } catch (error) {
      console.warn('Firebase last played update failed');
    }
  }

  // For localStorage, this is handled during save
};
