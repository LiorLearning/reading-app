// Firebase service for user data (progress, preferences, state)
import { 
  doc, 
  setDoc,
  getDoc,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';

export interface FirebaseUserProgress {
  userId: string;
  completedTopics: Array<{
    topicId: string;
    completedAt: number;
    score: number;
    totalQuestions: number;
    correctAnswers: number;
  }>;
  totalTopicsCompleted: number;
  lastPlayedAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseTopicPreference {
  userId: string;
  preferredTopics: string[];
  selectedAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseAdventureState {
  userId: string;
  currentAdventureId?: string;
  currentQuestionProgress?: {
    topicId: string;
    questionIndex: number;
    startedAt: number;
  };
  updatedAt: Timestamp;
}

class FirebaseUserDataService {
  private readonly USER_PROGRESS_COLLECTION = 'userProgress';
  private readonly TOPIC_PREFERENCES_COLLECTION = 'topicPreferences';  
  private readonly ADVENTURE_STATE_COLLECTION = 'adventureState';

  /**
   * Save user progress to Firebase
   */
  async saveUserProgressFirebase(userId: string, progress: any): Promise<void> {
    try {
      const firebaseProgress: Omit<FirebaseUserProgress, 'userId'> = {
        completedTopics: progress.completedTopics || [],
        totalTopicsCompleted: progress.totalTopicsCompleted || 0,
        lastPlayedAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
        userId: userId
      };

      await setDoc(doc(db, this.USER_PROGRESS_COLLECTION, userId), firebaseProgress);
    } catch (error) {
      console.error('Failed to save user progress to Firebase:', error);
      throw error; // Re-throw for fallback handling
    }
  }

  /**
   * Load user progress from Firebase
   */
  async loadUserProgressFirebase(userId: string): Promise<any | null> {
    try {
      const docRef = doc(db, this.USER_PROGRESS_COLLECTION, userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as FirebaseUserProgress;
        
        // Convert Firestore timestamps back to numbers for compatibility
        let lastPlayedAt: number;
        try {
          lastPlayedAt = data.lastPlayedAt && typeof data.lastPlayedAt.toMillis === 'function'
            ? data.lastPlayedAt.toMillis()
            : (data.lastPlayedAt?.seconds ? data.lastPlayedAt.seconds * 1000 : Date.now());
        } catch {
          lastPlayedAt = Date.now();
        }
        
        return {
          completedTopics: data.completedTopics,
          totalTopicsCompleted: data.totalTopicsCompleted,
          lastPlayedAt
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to load user progress from Firebase:', error);
      return null;
    }
  }

  /**
   * Save topic preferences to Firebase
   */
  async saveTopicPreferencesFirebase(userId: string, preferences: string[]): Promise<void> {
    try {
      const firebasePreferences: Omit<FirebaseTopicPreference, 'userId'> = {
        preferredTopics: preferences,
        selectedAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
        userId: userId
      };

      await setDoc(doc(db, this.TOPIC_PREFERENCES_COLLECTION, userId), firebasePreferences);
    } catch (error) {
      console.error('Failed to save topic preferences to Firebase:', error);
      throw error;
    }
  }

  /**
   * Load topic preferences from Firebase
   */
  async loadTopicPreferencesFirebase(userId: string): Promise<string[] | null> {
    try {
      const docRef = doc(db, this.TOPIC_PREFERENCES_COLLECTION, userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as FirebaseTopicPreference;
        return data.preferredTopics;
      }

      return null;
    } catch (error) {
      console.error('Failed to load topic preferences from Firebase:', error);
      return null;
    }
  }

  /**
   * Save adventure state to Firebase
   */
  async saveAdventureStateFirebase(userId: string, state: {
    currentAdventureId?: string;
    currentQuestionProgress?: any;
  }): Promise<void> {
    try {
      const firebaseState: any = {
        userId: userId,
        updatedAt: serverTimestamp()
      };

      // Only add fields that have values
      if (state.currentAdventureId !== undefined) {
        firebaseState.currentAdventureId = state.currentAdventureId;
      }
      
      if (state.currentQuestionProgress !== undefined) {
        firebaseState.currentQuestionProgress = state.currentQuestionProgress;
      }

      await setDoc(doc(db, this.ADVENTURE_STATE_COLLECTION, userId), firebaseState, { merge: true });
    } catch (error) {
      console.error('Failed to save adventure state to Firebase:', error);
      throw error;
    }
  }

  /**
   * Load adventure state from Firebase
   */
  async loadAdventureStateFirebase(userId: string): Promise<{
    currentAdventureId?: string;
    currentQuestionProgress?: any;
  } | null> {
    try {
      const docRef = doc(db, this.ADVENTURE_STATE_COLLECTION, userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        
        return {
          currentAdventureId: data.currentAdventureId || undefined,
          currentQuestionProgress: data.currentQuestionProgress || undefined
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to load adventure state from Firebase:', error);
      return null;
    }
  }
}

export const firebaseUserDataService = new FirebaseUserDataService();
