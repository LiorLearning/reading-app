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
import { firebaseUnifiedPetService } from './firebase-unified-pet-service';
import { PetProgressStorage } from './pet-progress-storage';

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

    // 7. Migrate pet progress data
    try {
      const petMigrationResult = await migratePetProgressToFirebase(userId);
      if (petMigrationResult.migratedCount > 0) {
        console.log(`✅ Pet progress migration completed: ${petMigrationResult.migratedCount} pets migrated`);
        migratedCount += petMigrationResult.migratedCount;
      }
    } catch (error) {
      console.warn('Pet progress migration failed, continuing with other migrations:', error);
    }

    // Verify migration by loading from Firebase
    const firebaseAdventures = await loadAdventureSummariesHybrid(userId);

    console.log(`✅ Migration completed: ${migratedCount} items migrated to Firebase`);
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

    // Check for pet progress data
    const hasLocalPetData = PetProgressStorage.getAllPetIds().some(petId => {
      const petData = PetProgressStorage.getPetProgress(petId);
      return petData.generalData.isOwned || 
             petData.cumulativeCoinsSpent > 0 || 
             petData.levelData.currentLevel > 1 ||
             petData.heartData.feedingCount > 0;
    });

    const hasLocalData = !!(
      loadUserProgress() ||
      loadSavedAdventures().length > 0 ||
      loadTopicPreference() ||
      loadCurrentAdventureId() ||
      hasLocalPetData
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
 * Migrate pet progress data from localStorage to Firebase
 */
export const migratePetProgressToFirebase = async (userId: string): Promise<{ migratedCount: number }> => {
  try {
    console.log('🐾 Starting pet progress migration from localStorage to Firebase...');
    
    let migratedCount = 0;
    
    // Get all pet IDs that have data in localStorage
    const allPetIds = PetProgressStorage.getAllPetIds();
    
    if (allPetIds.length === 0) {
      console.log('No pet progress data found in localStorage to migrate');
      return { migratedCount: 0 };
    }
    
    // Check if pet data already exists in Firebase to avoid overwriting
    const existingFirebaseData = await firebaseUnifiedPetService.getPetData(userId);
    
    if (existingFirebaseData) {
      console.log('Pet data already exists in Firebase, checking for missing pets...');
    }
    
    // Migrate each pet's progress data
    for (const petId of allPetIds) {
      try {
        // Check if this pet already exists in Firebase
        const existingPetData = await firebaseUnifiedPetService.getPetProgress(petId, userId);
        
        if (existingPetData) {
          console.log(`Pet ${petId} already exists in Firebase, skipping migration`);
          continue;
        }
        
        // Get pet data from localStorage
        const localPetData = PetProgressStorage.getPetProgress(petId);
        
        // Only migrate pets that have meaningful data (owned, or have progress)
        const hasMeaningfulData = localPetData.generalData.isOwned || 
                                  localPetData.cumulativeCoinsSpent > 0 || 
                                  localPetData.levelData.currentLevel > 1 ||
                                  localPetData.heartData.feedingCount > 0 ||
                                  localPetData.achievementData.totalFeedingsSinceOwned > 0;
        
        if (!hasMeaningfulData) {
          console.log(`Pet ${petId} has no meaningful data, skipping migration`);
          continue;
        }
        
        // Convert to Firebase format and save
        const firebaseData = PetProgressStorage.convertToFirebaseFormat(localPetData);
        await firebaseUnifiedPetService.setPetProgress(firebaseData, userId);
        
        console.log(`✅ Successfully migrated pet ${petId} to Firebase`);
        migratedCount++;
        
      } catch (error) {
        console.warn(`Failed to migrate pet ${petId}:`, error);
      }
    }
    
    // Migrate global pet settings (current selected pet)
    try {
      const currentSelectedPet = PetProgressStorage.getCurrentSelectedPet();
      if (currentSelectedPet) {
        await firebaseUnifiedPetService.setPetData({ 
          currentSelectedPet: currentSelectedPet 
        }, userId);
        console.log(`✅ Migrated current selected pet: ${currentSelectedPet}`);
      }
    } catch (error) {
      console.warn('Failed to migrate current selected pet:', error);
    }
    
    console.log(`🎉 Pet migration completed: ${migratedCount} pets migrated to Firebase`);
    return { migratedCount };
    
  } catch (error) {
    console.error('❌ Pet progress migration failed:', error);
    throw error;
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

/**
 * Manual pet progress migration trigger (for debugging/testing)
 */
export const forceMigratePetProgress = async (userId: string): Promise<void> => {
  const result = await migratePetProgressToFirebase(userId);
  console.log(`Migration completed: ${result.migratedCount} pets migrated`);
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
