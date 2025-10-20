// Hybrid cache for Spellbox progress (Firebase + localStorage fallback)
import { firebaseSpellboxService } from './firebase-spellbox-service';
import { SpellboxGradeProgress } from './utils';

/**
 * Save Spellbox progress with Firebase sync and localStorage fallback
 */
export const saveSpellboxProgressHybrid = async (
  userId: string, 
  gradeProgress: SpellboxGradeProgress
): Promise<void> => {
  try {
    // Always save to Firebase first
    await firebaseSpellboxService.saveSpellboxProgressFirebase(userId, gradeProgress);
    
    // Also save to localStorage as backup
    const { saveSpellboxTopicProgress } = await import('./utils');
    saveSpellboxTopicProgress(gradeProgress.gradeDisplayName, gradeProgress);
    
    // console.log(`💾 Spellbox progress saved to both Firebase and localStorage: ${gradeProgress.gradeDisplayName}`);
  } catch (error) {
    console.error('Firebase save failed, falling back to localStorage only:', error);
    
    // Fallback to localStorage only
    const { saveSpellboxTopicProgress } = await import('./utils');
    saveSpellboxTopicProgress(gradeProgress.gradeDisplayName, gradeProgress);
  }
};

/**
 * Load Spellbox progress with Firebase priority and localStorage fallback
 */
export const loadSpellboxProgressHybrid = async (
  userId: string, 
  gradeDisplayName: string
): Promise<SpellboxGradeProgress | null> => {
  try {
    // Try Firebase first
    const firebaseProgress = await firebaseSpellboxService.loadSpellboxProgressFirebase(userId, gradeDisplayName);
    
    if (firebaseProgress) {
      // Also update localStorage with Firebase data for offline access
      const { saveSpellboxTopicProgress } = await import('./utils');
      saveSpellboxTopicProgress(gradeDisplayName, firebaseProgress);
      
      // console.log(`💾 Spellbox progress loaded from Firebase: ${gradeDisplayName}`);
      return firebaseProgress;
    }
    
    // Fallback to localStorage
    // console.log(`💾 No Firebase data, checking localStorage for: ${gradeDisplayName}`);
    const { loadSpellboxTopicProgress } = await import('./utils');
    const localProgress = loadSpellboxTopicProgress(gradeDisplayName);
    
    if (localProgress) {
      // Migrate localStorage data to Firebase for future sync
      try {
        await firebaseSpellboxService.saveSpellboxProgressFirebase(userId, localProgress);
        // console.log(`🔄 Migrated localStorage Spellbox progress to Firebase: ${gradeDisplayName}`);
      } catch (migrationError) {
        console.warn('Failed to migrate localStorage to Firebase:', migrationError);
      }
    }
    
    return localProgress;
  } catch (error) {
    console.error('Failed to load from Firebase, falling back to localStorage:', error);
    
    // Final fallback to localStorage only
    const { loadSpellboxTopicProgress } = await import('./utils');
    return loadSpellboxTopicProgress(gradeDisplayName);
  }
};

/**
 * Load all Spellbox progress for a user (all grades)
 */
export const loadAllSpellboxProgressHybrid = async (
  userId: string
): Promise<Record<string, SpellboxGradeProgress>> => {
  try {
    // Try Firebase first
    const firebaseProgress = await firebaseSpellboxService.loadAllSpellboxProgressFirebase(userId);
    
    if (Object.keys(firebaseProgress).length > 0) {
      // Update localStorage with Firebase data
      const { saveSpellboxTopicProgress } = await import('./utils');
      Object.values(firebaseProgress).forEach(gradeProgress => {
        saveSpellboxTopicProgress(gradeProgress.gradeDisplayName, gradeProgress);
      });
      
      // console.log(`💾 All Spellbox progress loaded from Firebase`);
      return firebaseProgress;
    }
    
    // Fallback: check localStorage for common grades
    // console.log(`💾 No Firebase data, checking localStorage for all grades`);
    const { loadSpellboxTopicProgress } = await import('./utils');
    const allProgress: Record<string, SpellboxGradeProgress> = {};
    
    const commonGrades = [
      'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5',
      'Kindergarten', 'Pre-K'
    ];
    
    for (const grade of commonGrades) {
      const localProgress = loadSpellboxTopicProgress(grade);
      if (localProgress) {
        allProgress[grade] = localProgress;
        
        // Migrate to Firebase
        try {
          await firebaseSpellboxService.saveSpellboxProgressFirebase(userId, localProgress);
        } catch (migrationError) {
          console.warn(`Failed to migrate ${grade} to Firebase:`, migrationError);
        }
      }
    }
    
    return allProgress;
  } catch (error) {
    console.error('Failed to load all progress from Firebase:', error);
    return {};
  }
};

/**
 * Clear Spellbox progress for a specific grade
 */
export const clearSpellboxProgressHybrid = async (
  userId: string, 
  gradeDisplayName: string
): Promise<void> => {
  try {
    // Clear from Firebase
    await firebaseSpellboxService.deleteSpellboxProgressFirebase(userId, gradeDisplayName);
    
    // Clear from localStorage
    const { clearSpellboxTopicProgress } = await import('./utils');
    clearSpellboxTopicProgress(gradeDisplayName);
    
    // console.log(`🗑️ Spellbox progress cleared from both Firebase and localStorage: ${gradeDisplayName}`);
  } catch (error) {
    console.error('Failed to clear from Firebase, clearing localStorage only:', error);
    
    // Fallback: clear localStorage only
    const { clearSpellboxTopicProgress } = await import('./utils');
    clearSpellboxTopicProgress(gradeDisplayName);
  }
};

/**
 * Auto-migrate localStorage Spellbox data to Firebase on login
 */
export const autoMigrateSpellboxOnLogin = async (userId: string): Promise<void> => {
  try {
    const migratedCount = await firebaseSpellboxService.migrateLocalStorageToFirebase(userId);
    
    if (migratedCount > 0) {
      // console.log(`✅ Auto-migrated ${migratedCount} Spellbox grade progress to Firebase on login`);
    }
  } catch (error) {
    console.warn('Auto-migration of Spellbox progress failed:', error);
  }
};
