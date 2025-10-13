// Firebase service for Spellbox topic progress
import { 
  doc, 
  setDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from './firebase';
import { SpellboxTopicProgress, SpellboxGradeProgress } from './utils';

export interface FirebaseSpellboxProgress {
  userId: string;
  gradeDisplayName: string;
  currentTopicId: string | null;
  topicProgress: Record<string, SpellboxTopicProgress>;
  lastUpdated: Timestamp;
  version: string;
}

class FirebaseSpellboxService {
  private readonly COLLECTION_NAME = 'spellboxProgress';

  /**
   * Save Spellbox topic progress to Firebase
   */
  async saveSpellboxProgressFirebase(userId: string, gradeProgress: SpellboxGradeProgress): Promise<void> {
    try {
      const firebaseProgress: FirebaseSpellboxProgress = {
        userId,
        gradeDisplayName: gradeProgress.gradeDisplayName,
        currentTopicId: gradeProgress.currentTopicId,
        topicProgress: gradeProgress.topicProgress,
        lastUpdated: serverTimestamp() as Timestamp,
        version: '1.0'
      };

      // Use composite key: userId_gradeDisplayName for document ID
      const docId = `${userId}_${gradeProgress.gradeDisplayName.replace(/\s+/g, '_')}`;
      await setDoc(doc(db, this.COLLECTION_NAME, docId), firebaseProgress);
      
      console.log(`🔥 Saved Spellbox progress to Firebase: ${gradeProgress.gradeDisplayName}`);
    } catch (error) {
      console.error('Failed to save Spellbox progress to Firebase:', error);
      throw error; // Re-throw for fallback handling
    }
  }

  /**
   * Load Spellbox topic progress from Firebase
   */
  async loadSpellboxProgressFirebase(userId: string, gradeDisplayName: string): Promise<SpellboxGradeProgress | null> {
    try {
      const docId = `${userId}_${gradeDisplayName.replace(/\s+/g, '_')}`;
      console.log("docId stripe: ", docId)
      const docRef = doc(db, this.COLLECTION_NAME, docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as FirebaseSpellboxProgress;
        // Convert Firebase Timestamp to number for compatibility
        const gradeProgress: SpellboxGradeProgress = {
          gradeDisplayName: data.gradeDisplayName,
          currentTopicId: data.currentTopicId,
          topicProgress: data.topicProgress,
          timestamp: data.lastUpdated instanceof Timestamp ? data.lastUpdated.toMillis() : Date.now()
        };

        console.log(`🔥 Loaded Spellbox progress from Firebase: ${gradeDisplayName}`, {
          topicCount: Object.keys(gradeProgress.topicProgress).length,
          currentTopic: gradeProgress.currentTopicId
        });

        return gradeProgress;
      }

      console.log(`🔥 No Spellbox progress found in Firebase for: ${gradeDisplayName}`);
      return null;
    } catch (error) {
      console.error('Failed to load Spellbox progress from Firebase:', error);
      return null;
    }
  }

  /**
   * Load all Spellbox progress for a user (all grades)
   */
  async loadAllSpellboxProgressFirebase(userId: string): Promise<Record<string, SpellboxGradeProgress>> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      const allProgress: Record<string, SpellboxGradeProgress> = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data() as FirebaseSpellboxProgress;
        const gradeProgress: SpellboxGradeProgress = {
          gradeDisplayName: data.gradeDisplayName,
          currentTopicId: data.currentTopicId,
          topicProgress: data.topicProgress,
          timestamp: data.lastUpdated instanceof Timestamp ? data.lastUpdated.toMillis() : Date.now()
        };
        
        allProgress[data.gradeDisplayName] = gradeProgress;
      });

      console.log(`🔥 Loaded all Spellbox progress from Firebase:`, {
        grades: Object.keys(allProgress),
        totalTopics: Object.values(allProgress).reduce((sum, grade) => sum + Object.keys(grade.topicProgress).length, 0)
      });

      return allProgress;
    } catch (error) {
      console.error('Failed to load all Spellbox progress from Firebase:', error);
      return {};
    }
  }

  /**
   * Delete Spellbox progress for a specific grade
   */
  async deleteSpellboxProgressFirebase(userId: string, gradeDisplayName: string): Promise<void> {
    try {
      const docId = `${userId}_${gradeDisplayName.replace(/\s+/g, '_')}`;
      const docRef = doc(db, this.COLLECTION_NAME, docId);
      
      // Firebase doesn't have a direct delete method in this context, so we'll set to null
      await setDoc(docRef, {
        userId,
        gradeDisplayName,
        currentTopicId: null,
        topicProgress: {},
        lastUpdated: serverTimestamp(),
        version: '1.0',
        deleted: true
      });

      console.log(`🔥 Deleted Spellbox progress from Firebase: ${gradeDisplayName}`);
    } catch (error) {
      console.error('Failed to delete Spellbox progress from Firebase:', error);
      throw error;
    }
  }

  /**
   * Migrate localStorage Spellbox progress to Firebase
   */
  async migrateLocalStorageToFirebase(userId: string): Promise<number> {
    try {
      // Import localStorage functions
      const { loadSpellboxTopicProgress } = await import('./utils');
      
      let migratedCount = 0;
      
      // Common grade names to check
      const commonGrades = [
        'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5',
        'Kindergarten', 'Pre-K', '1st Grade', '2nd Grade', '3rd Grade'
      ];

      for (const grade of commonGrades) {
        const localProgress = loadSpellboxTopicProgress(grade);
        if (localProgress) {
          await this.saveSpellboxProgressFirebase(userId, localProgress);
          migratedCount++;
          console.log(`🔄 Migrated Spellbox progress for ${grade}`);
        }
      }

      if (migratedCount > 0) {
        console.log(`✅ Successfully migrated ${migratedCount} Spellbox grade progress to Firebase`);
      }

      return migratedCount;
    } catch (error) {
      console.error('Failed to migrate Spellbox progress to Firebase:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const firebaseSpellboxService = new FirebaseSpellboxService();
export default firebaseSpellboxService;
