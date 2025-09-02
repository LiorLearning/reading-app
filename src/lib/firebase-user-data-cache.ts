// Hybrid user data storage - Firebase first, localStorage fallback
import { firebaseUserDataService } from './firebase-user-data-service';

/**
 * Save user progress with Firebase sync
 */
export const saveUserProgressHybrid = async (
  userId: string | null,
  progress: any
): Promise<void> => {
  if (userId) {
    try {
      await firebaseUserDataService.saveUserProgressFirebase(userId, progress);
    } catch (error) {
      console.warn('Firebase progress save failed, using localStorage fallback');
    }
  }

  // Always save to localStorage as backup/fallback
  const { saveUserProgress } = await import('./utils');
  saveUserProgress(progress);
};

/**
 * Load user progress with Firebase sync
 */
export const loadUserProgressHybrid = async (
  userId: string | null
): Promise<any | null> => {
  if (userId) {
    try {
      const firebaseProgress = await firebaseUserDataService.loadUserProgressFirebase(userId);
      if (firebaseProgress) {
        // Also update localStorage for offline access
        const { saveUserProgress } = await import('./utils');
        saveUserProgress(firebaseProgress);
        
        return firebaseProgress;
      }
    } catch (error) {
      console.warn('Firebase progress load failed, using localStorage fallback');
    }
  }

  // Fallback to localStorage
  const { loadUserProgress } = await import('./utils');
  return loadUserProgress();
};

/**
 * Save topic preferences with Firebase sync
 */
export const saveTopicPreferencesHybrid = async (
  userId: string | null,
  preferences: string[]
): Promise<void> => {
  if (userId) {
    try {
      await firebaseUserDataService.saveTopicPreferencesFirebase(userId, preferences);
    } catch (error) {
      console.warn('Firebase preferences save failed, using localStorage fallback');
    }
  }

  // Always save to localStorage as backup
  const { saveTopicPreference } = await import('./utils');
  saveTopicPreference({ preferredTopics: preferences });
};

/**
 * Load topic preferences with Firebase sync
 */
export const loadTopicPreferencesHybrid = async (
  userId: string | null
): Promise<string[] | null> => {
  if (userId) {
    try {
      const firebasePreferences = await firebaseUserDataService.loadTopicPreferencesFirebase(userId);
      if (firebasePreferences) {
        // Update localStorage for offline access
        const { saveTopicPreference } = await import('./utils');
        saveTopicPreference({ preferredTopics: firebasePreferences });
        
        return firebasePreferences;
      }
    } catch (error) {
      console.warn('Firebase preferences load failed, using localStorage fallback');
    }
  }

  // Fallback to localStorage
  const { loadTopicPreference } = await import('./utils');
  const stored = loadTopicPreference();
  return stored?.preferredTopics || null;
};

/**
 * Save current adventure ID with Firebase sync
 */
export const saveCurrentAdventureIdHybrid = async (
  userId: string | null,
  adventureId: string | null
): Promise<void> => {
  if (userId) {
    try {
      await firebaseUserDataService.saveAdventureStateFirebase(userId, {
        currentAdventureId: adventureId || undefined
      });
    } catch (error) {
      console.warn('Firebase adventure ID save failed, using localStorage fallback');
    }
  }

  // Always save to localStorage as backup
  const { saveCurrentAdventureId } = await import('./utils');
  saveCurrentAdventureId(adventureId);
};

/**
 * Load current adventure ID with Firebase sync
 */
export const loadCurrentAdventureIdHybrid = async (
  userId: string | null
): Promise<string | null> => {
  if (userId) {
    try {
      const firebaseState = await firebaseUserDataService.loadAdventureStateFirebase(userId);
      if (firebaseState?.currentAdventureId) {
        // Update localStorage for offline access
        const { saveCurrentAdventureId } = await import('./utils');
        saveCurrentAdventureId(firebaseState.currentAdventureId);
        
        return firebaseState.currentAdventureId;
      }
    } catch (error) {
      console.warn('Firebase adventure ID load failed, using localStorage fallback');
    }
  }

  // Fallback to localStorage
  const { loadCurrentAdventureId } = await import('./utils');
  return loadCurrentAdventureId();
};

/**
 * Save question progress with Firebase sync
 */
export const saveQuestionProgressHybrid = async (
  userId: string | null,
  topicId: string,
  questionIndex: number
): Promise<void> => {
  const progress = {
    topicId,
    questionIndex,
    startedAt: Date.now()
  };

  if (userId) {
    try {
      await firebaseUserDataService.saveAdventureStateFirebase(userId, {
        currentQuestionProgress: progress
      });
    } catch (error) {
      console.warn('Firebase question progress save failed, using localStorage fallback');
    }
  }

  // Always save to localStorage as backup
  const { saveQuestionProgress } = await import('./utils');
  saveQuestionProgress(topicId, questionIndex);
};

/**
 * Load question progress with Firebase sync
 */
export const loadQuestionProgressHybrid = async (
  userId: string | null
): Promise<any | null> => {
  if (userId) {
    try {
      const firebaseState = await firebaseUserDataService.loadAdventureStateFirebase(userId);
      if (firebaseState?.currentQuestionProgress) {
        // Update localStorage for offline access
        const { saveQuestionProgress } = await import('./utils');
        const progress = firebaseState.currentQuestionProgress;
        saveQuestionProgress(progress.topicId, progress.questionIndex);
        
        return progress;
      }
    } catch (error) {
      console.warn('Firebase question progress load failed, using localStorage fallback');
    }
  }

  // Fallback to localStorage
  const { loadQuestionProgress } = await import('./utils');
  return loadQuestionProgress();
};

/**
 * Clear question progress from both Firebase and localStorage
 */
export const clearQuestionProgressHybrid = async (
  userId: string | null
): Promise<void> => {
  if (userId) {
    try {
      await firebaseUserDataService.saveAdventureStateFirebase(userId, {
        currentQuestionProgress: undefined
      });
    } catch (error) {
      console.warn('Firebase question progress clear failed');
    }
  }

  // Always clear from localStorage
  const { clearQuestionProgress } = await import('./utils');
  clearQuestionProgress();
};
