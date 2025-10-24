// Data migration from localStorage to Firebase
import { 
  saveUserProgressHybrid,
  saveTopicPreferencesHybrid,
  saveCurrentAdventureIdHybrid,
  saveQuestionProgressHybrid
} from './firebase-user-data-cache';
import { autoMigrateSpellboxOnLogin } from './firebase-spellbox-cache';
import { 
  saveAdventureHybrid,
  loadAdventureSummariesHybrid 
} from './firebase-adventure-cache';
import { PetAdventureTracker } from './pet-adventure-tracker';
import { PetProgressStorage } from './pet-progress-storage';
import type { SavedAdventure } from './utils';

/**
 * Migrate all localStorage data to Firebase for authenticated users
 */
export const migrateLocalStorageToFirebase = async (userId: string): Promise<void> => {
  
  try {
    // Import all localStorage functions
    const {
      loadUserProgress,
      loadTopicPreference,
      loadCurrentAdventureId,
      loadQuestionProgress,
      loadSavedAdventures,
      loadAdventureSummaries
    } = await import('./utils');

    let migratedCount = 0;

    // 1. Migrate user progress
    const userProgress = loadUserProgress();
    if (userProgress) {
      await saveUserProgressHybrid(userId, userProgress);
      migratedCount++;
    }

    // 2. Migrate topic preferences
    const topicPreference = loadTopicPreference();
    if (topicPreference?.preferredTopics) {
      await saveTopicPreferencesHybrid(userId, topicPreference.preferredTopics);
      migratedCount++;
    }

    // 3. Migrate current adventure ID
    const currentAdventureId = loadCurrentAdventureId();
    if (currentAdventureId) {
      await saveCurrentAdventureIdHybrid(userId, currentAdventureId);
      migratedCount++;
    }

    // 4. Migrate question progress
    const questionProgress = loadQuestionProgress();
    if (questionProgress) {
      await saveQuestionProgressHybrid(userId, questionProgress.topicId, questionProgress.questionIndex);
      migratedCount++;
    }

    // 5. Migrate adventures
    const savedAdventures = loadSavedAdventures();
    if (savedAdventures.length > 0) {
      for (let i = 0; i < savedAdventures.length; i++) {
        const adventure = savedAdventures[i];
        try {
          await saveAdventureHybrid(userId, adventure);
          migratedCount++;
        } catch (error) {
          console.error(`Failed to migrate adventure: ${adventure.name}`, error);
        }
      }
    }

    // 6. Migrate Spellbox topic progress
    try {
      await autoMigrateSpellboxOnLogin(userId);
      console.log('✅ Spellbox progress migration completed');
    } catch (error) {
      console.warn('Spellbox migration failed, continuing with other migrations:', error);
    }

    // Verify migration by loading from Firebase
    const firebaseAdventures = await loadAdventureSummariesHybrid(userId);

    console.log(`✅ Migration completed: ${migratedCount} items migrated to Firebase`);

    // Reconcile PetAdventureTracker mapping from migrated adventures
    try {
      await reconcilePetAdventureTrackerOnLogin(userId);
    } catch (error) {
      console.warn('Tracker reconciliation after migration failed:', error);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

/**
 * Check if user needs data migration
 */
export const checkMigrationNeeded = async (userId: string): Promise<boolean> => {
  try {
    // Check if user has data in localStorage but not in Firebase
    const {
      loadUserProgress,
      loadSavedAdventures,
      loadTopicPreference,
      loadCurrentAdventureId
    } = await import('./utils');

    const hasLocalData = !!(
      loadUserProgress() ||
      loadSavedAdventures().length > 0 ||
      loadTopicPreference() ||
      loadCurrentAdventureId()
    );

    if (!hasLocalData) {
      return false; // No local data to migrate
    }

    // Check if Firebase already has data
    const firebaseAdventures = await loadAdventureSummariesHybrid(userId);
    const hasFirebaseData = firebaseAdventures.length > 0;

    // Need migration if we have local data but no Firebase data
    return hasLocalData && !hasFirebaseData;
    
  } catch (error) {
    console.error('Failed to check migration status:', error);
    return false;
  }
};

/**
 * Auto-migrate on first login
 */
export const autoMigrateOnLogin = async (userId: string): Promise<void> => {
  try {
    const needsMigration = await checkMigrationNeeded(userId);
    
    if (needsMigration) {
      await migrateLocalStorageToFirebase(userId);
      
      // Set flag to prevent future auto-migrations
      localStorage.setItem(`migration_completed_${userId}`, 'true');
    }
  } catch (error) {
    console.warn('Auto-migration failed, user can manually trigger later:', error);
  }
};

/**
 * Manual migration trigger (for debugging/testing)
 */
export const forceMigrateUserData = async (userId: string): Promise<void> => {
  await migrateLocalStorageToFirebase(userId);
};

// Make functions available globally for debugging
declare global {
  interface Window {
    migrateToFirebase: typeof forceMigrateUserData;
    checkMigrationNeeded: typeof checkMigrationNeeded;
  }
}

if (typeof window !== 'undefined') {
  window.migrateToFirebase = forceMigrateUserData;
  window.checkMigrationNeeded = checkMigrationNeeded;
}

/**
 * Reconcile PetAdventureTracker so that pet/type → adventureId points to the latest
 * migrated adventure for the current pet. This aligns resume flow after login.
 */
async function reconcilePetAdventureTrackerOnLogin(userId: string): Promise<void> {
  try {
    // Load full adventures (prefer Firebase for signed-in user)
    const { loadAdventuresHybrid } = await import('./firebase-adventure-cache');
    const adventures: SavedAdventure[] = await loadAdventuresHybrid(userId);
    if (!adventures || adventures.length === 0) return;

    // Determine current pet; default to 'dog' if unavailable
    const petId = PetProgressStorage.getCurrentSelectedPet() || 'dog';

    // Pick the most recent adventure per adventureType
    const latestByType: Record<string, SavedAdventure> = {};
    for (const adv of adventures) {
      const type = (adv as any).adventureType as string | undefined;
      if (!type) continue;
      const current = latestByType[type];
      if (!current || (adv.lastPlayedAt || 0) > (current.lastPlayedAt || 0)) {
        latestByType[type] = adv;
      }
    }

    const types = Object.keys(latestByType);
    if (types.length === 0) return;

    // Load existing tracker state and update mappings
    const state = await PetAdventureTracker.loadPetAdventureState(userId, petId);
    let changed = false;

    for (const type of types) {
      const adv = latestByType[type];
      const msgCount = Array.isArray(adv.messages) ? adv.messages.length : 0;
      const existing = state.adventures[type];
      const needsUpdate = !existing || existing.adventureId !== adv.id || (existing.messageCount || 0) < msgCount;
      if (needsUpdate) {
        state.adventures[type] = {
          adventureId: adv.id,
          topicId: adv.topicId || existing?.topicId || 'K-F.2',
          createdAt: adv.createdAt || existing?.createdAt || Date.now(),
          lastPlayedAt: adv.lastPlayedAt || Date.now(),
          messageCount: msgCount,
          isCompleted: false,
        } as any;
        changed = true;
      }
    }

    if (changed) {
      await PetAdventureTracker.savePetAdventureState(state);
    }
  } catch (error) {
    console.warn('reconcilePetAdventureTrackerOnLogin failed:', error);
  }
}
