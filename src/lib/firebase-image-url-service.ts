import { 
  collection, 
  addDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  deleteDoc,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';

export interface StoredImageUrl {
  id?: string;
  userId: string;
  adventureId: string;
  imageUrl: string;
  prompt: string;
  adventureContext: string;
  timestamp: Timestamp;
  source: 'dalle' | 'local' | 'other';
}

class FirebaseImageUrlService {
  private readonly COLLECTION_NAME = 'adventureImageUrls';
  private readonly MAX_IMAGES_PER_ADVENTURE = 5;
  private readonly MAX_TOTAL_IMAGES = 50;

  /**
   * Store generated image URL metadata (no file upload needed)
   */
  async storeImageUrl(
    userId: string,
    adventureId: string,
    imageUrl: string,
    prompt: string,
    adventureContext: string = '',
    source: 'dalle' | 'local' | 'other' = 'dalle'
  ): Promise<StoredImageUrl | null> {
    try {
      console.log('💾 Storing image URL to Firebase Firestore...');

      // Save URL metadata to Firestore (no file upload)
      const imageMetadata: Omit<StoredImageUrl, 'id'> = {
        userId,
        adventureId,
        imageUrl,
        prompt,
        adventureContext,
        timestamp: serverTimestamp() as Timestamp,
        source
      };

      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), imageMetadata);

      const storedImage: StoredImageUrl = {
        id: docRef.id,
        ...imageMetadata,
        timestamp: Timestamp.now() // Use current time for local representation
      };

      console.log(`✅ Image URL stored successfully: ${prompt.substring(0, 30)}...`);

      // Clean up old image URLs after successful storage
      await this.cleanupOldImageUrls(userId, adventureId);

      return storedImage;
    } catch (error) {
      console.error('❌ Failed to store image URL to Firebase:', error);
      return null;
    }
  }

  /**
   * Get image URLs for a specific adventure
   */
  async getAdventureImageUrls(userId: string, adventureId: string): Promise<StoredImageUrl[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', userId),
        where('adventureId', '==', adventureId),
        orderBy('timestamp', 'desc'),
        limit(this.MAX_IMAGES_PER_ADVENTURE)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StoredImageUrl));
    } catch (error) {
      console.error('⚠️ Failed to fetch adventure image URLs:', error);
      return [];
    }
  }

  /**
   * Get all image URLs for a user
   */
  async getUserImageUrls(userId: string, limitCount: number = 50): Promise<StoredImageUrl[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StoredImageUrl));
    } catch (error) {
      console.error('⚠️ Failed to fetch user image URLs:', error);
      return [];
    }
  }

  /**
   * Clean up old image URLs to maintain limits
   */
  private async cleanupOldImageUrls(userId: string, adventureId: string): Promise<void> {
    try {
      // Clean up URLs for this specific adventure (keep only 5 most recent)
      await this.cleanupAdventureImageUrls(userId, adventureId);

      // Clean up total user URLs (keep only 50 most recent)
      await this.cleanupUserImageUrls(userId);
    } catch (error) {
      console.warn('⚠️ Failed to cleanup old image URLs (continuing normally):', error);
    }
  }

  /**
   * Clean up URLs for a specific adventure
   */
  private async cleanupAdventureImageUrls(userId: string, adventureId: string): Promise<void> {
    const adventureImages = await this.getAdventureImageUrls(userId, adventureId);
    
    if (adventureImages.length > this.MAX_IMAGES_PER_ADVENTURE) {
      const imagesToDelete = adventureImages.slice(this.MAX_IMAGES_PER_ADVENTURE);
      
      for (const image of imagesToDelete) {
        if (image.id) {
          await deleteDoc(doc(db, this.COLLECTION_NAME, image.id));
        }
      }
      
      console.log(`🗑️ Cleaned up ${imagesToDelete.length} old image URLs for adventure ${adventureId}`);
    }
  }

  /**
   * Clean up total user URLs
   */
  private async cleanupUserImageUrls(userId: string): Promise<void> {
    const userImages = await this.getUserImageUrls(userId, this.MAX_TOTAL_IMAGES + 10);
    
    if (userImages.length > this.MAX_TOTAL_IMAGES) {
      const imagesToDelete = userImages.slice(this.MAX_TOTAL_IMAGES);
      
      for (const image of imagesToDelete) {
        if (image.id) {
          await deleteDoc(doc(db, this.COLLECTION_NAME, image.id));
        }
      }
      
      console.log(`🗑️ Cleaned up ${imagesToDelete.length} old image URLs for user ${userId}`);
    }
  }

  /**
   * Get recent URLs across all adventures
   */
  async getRecentImageUrls(userId: string, limitCount: number = 10): Promise<StoredImageUrl[]> {
    return this.getUserImageUrls(userId, limitCount);
  }

  /**
   * Get storage statistics for a user
   */
  async getStorageStats(userId: string): Promise<{
    totalImages: number;
    oldestImage: Date | null;
    newestImage: Date | null;
    imagesByAdventure: { [adventureId: string]: number };
    imagesBySource: { [source: string]: number };
  }> {
    try {
      const userImages = await this.getUserImageUrls(userId);
      
      const imagesByAdventure = userImages.reduce((acc, img) => {
        acc[img.adventureId] = (acc[img.adventureId] || 0) + 1;
        return acc;
      }, {} as { [adventureId: string]: number });

      const imagesBySource = userImages.reduce((acc, img) => {
        acc[img.source] = (acc[img.source] || 0) + 1;
        return acc;
      }, {} as { [source: string]: number });

      return {
        totalImages: userImages.length,
        oldestImage: userImages.length > 0 ? userImages[userImages.length - 1].timestamp.toDate() : null,
        newestImage: userImages.length > 0 ? userImages[0].timestamp.toDate() : null,
        imagesByAdventure,
        imagesBySource
      };
    } catch (error) {
      console.error('⚠️ Failed to get storage stats:', error);
      return {
        totalImages: 0,
        oldestImage: null,
        newestImage: null,
        imagesByAdventure: {},
        imagesBySource: {}
      };
    }
  }

  /**
   * Clear all URLs for a user
   */
  async clearAllUserImageUrls(userId: string): Promise<void> {
    try {
      const userImages = await this.getUserImageUrls(userId, 1000);
      
      for (const image of userImages) {
        if (image.id) {
          await deleteDoc(doc(db, this.COLLECTION_NAME, image.id));
        }
      }
      
      console.log(`🗑️ Cleared all ${userImages.length} image URLs for user ${userId}`);
    } catch (error) {
      console.error('❌ Failed to clear user image URLs:', error);
    }
  }
}

export const firebaseImageUrlService = new FirebaseImageUrlService();
