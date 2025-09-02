import { 
  collection, 
  addDoc, 
  doc, 
  setDoc,
  getDoc,
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { ChatMessage, SavedAdventure, AdventureSummary, ComicPanel } from './utils';

export interface FirebaseSavedAdventure {
  id: string;
  userId: string;
  name: string;
  summary: string;
  messages: ChatMessage[];
  createdAt: Timestamp;
  lastPlayedAt: Timestamp;
  comicPanelImage?: string;
  topicId?: string;
  comicPanels?: ComicPanel[];
}

class FirebaseAdventureService {
  private readonly COLLECTION_NAME = 'savedAdventures';

  /**
   * Save adventure to Firebase (syncs across devices)
   */
  async saveAdventureFirebase(userId: string, adventure: SavedAdventure): Promise<void> {
    try {
      // Create base adventure data with required fields only
      const firebaseAdventure: any = {
        userId,
        name: adventure.name,
        summary: adventure.summary,
        messages: adventure.messages,
        createdAt: serverTimestamp(),
        lastPlayedAt: serverTimestamp()
      };

      // Only add optional fields if they have values (not undefined)
      if (adventure.comicPanelImage !== undefined) {
        firebaseAdventure.comicPanelImage = adventure.comicPanelImage;
      }
      
      if (adventure.topicId !== undefined) {
        firebaseAdventure.topicId = adventure.topicId;
      }
      
      if (adventure.comicPanels !== undefined) {
        firebaseAdventure.comicPanels = adventure.comicPanels;
      }

      // Use adventure.id as document ID for consistent syncing
      await setDoc(doc(db, this.COLLECTION_NAME, adventure.id), firebaseAdventure);
    } catch (error) {
      console.error('Failed to save adventure to Firebase:', error);
      // Fallback to localStorage
      const { saveAdventure } = await import('./utils');
      saveAdventure(adventure);
    }
  }

  /**
   * Load user adventures from Firebase (synced across devices)
   */
  async loadUserAdventuresFirebase(userId: string): Promise<SavedAdventure[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', userId),
        orderBy('lastPlayedAt', 'desc'),
        limit(50)
      );

      const querySnapshot = await getDocs(q);
      const adventures: SavedAdventure[] = [];

      querySnapshot.docs.forEach(doc => {
        const data = doc.data() as any; // Use any to handle optional fields
        adventures.push({
          id: doc.id,
          name: data.name,
          summary: data.summary,
          messages: data.messages,
          createdAt: data.createdAt.toMillis(),
          lastPlayedAt: data.lastPlayedAt.toMillis(),
          comicPanelImage: data.comicPanelImage || undefined,
          topicId: data.topicId || undefined,
          comicPanels: data.comicPanels || undefined
        });
      });

      return adventures;
    } catch (error) {
      console.error('Failed to load adventures from Firebase:', error);
      // Fallback to localStorage
      const { loadSavedAdventures } = await import('./utils');
      return loadSavedAdventures();
    }
  }

  /**
   * Get adventure summaries for quick display
   */
  async getAdventureSummariesFirebase(userId: string): Promise<AdventureSummary[]> {
    try {
      const adventures = await this.loadUserAdventuresFirebase(userId);
      
      return adventures.map(adventure => ({
        id: adventure.id,
        name: adventure.name,
        summary: adventure.summary,
        lastPlayedAt: adventure.lastPlayedAt,
        comicPanelImage: adventure.comicPanelImage
      }));
    } catch (error) {
      console.error('❌ Failed to get adventure summaries from Firebase:', error);
      return [];
    }
  }

  /**
   * Get specific adventure by ID
   */
  async getAdventureFirebase(userId: string, adventureId: string): Promise<SavedAdventure | null> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, adventureId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as any; // Use any to handle optional fields
        
        // Verify user owns this adventure
        if (data.userId !== userId) {
          console.warn('User attempting to access adventure they do not own');
          return null;
        }

        return {
          id: docSnap.id,
          name: data.name,
          summary: data.summary,
          messages: data.messages,
          createdAt: data.createdAt.toMillis(),
          lastPlayedAt: data.lastPlayedAt.toMillis(),
          comicPanelImage: data.comicPanelImage || undefined,
          topicId: data.topicId || undefined,
          comicPanels: data.comicPanels || undefined
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to get adventure from Firebase:', error);
      return null;
    }
  }

  /**
   * Update adventure's last played time
   */
  async updateLastPlayedFirebase(userId: string, adventureId: string): Promise<void> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, adventureId);
      await setDoc(docRef, {
        lastPlayedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Failed to update last played time:', error);
    }
  }
}

export const firebaseAdventureService = new FirebaseAdventureService();
