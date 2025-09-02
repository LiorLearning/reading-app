import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject, 
  listAll,
  getMetadata 
} from 'firebase/storage';
import { 
  collection, 
  addDoc, 
  updateDoc, 
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
import { storage, db } from './firebase';

export interface StoredImage {
  id?: string;
  userId: string;
  adventureId: string;
  imageUrl: string;
  storagePath: string;
  prompt: string;
  adventureContext: string;
  timestamp: Timestamp;
  fileSize: number;
}

class FirebaseImageService {
  private readonly COLLECTION_NAME = 'adventureImages';
  private readonly STORAGE_PATH = 'adventure-images';
  private readonly MAX_IMAGES_PER_ADVENTURE = 5;
  private readonly MAX_TOTAL_IMAGES = 50;

  /**
   * Upload generated image to Firebase Storage via Cloud Function
   */
  async uploadGeneratedImage(
    userId: string,
    adventureId: string,
    imageUrl: string,
    prompt: string,
    adventureContext: string = ''
  ): Promise<StoredImage | null> {
    try {

      
      // Call Firebase Cloud Function to download and store the image
      const functionUrl = `https://us-central1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/uploadImage`;
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({
          userId,
          adventureId,
          imageUrl,
          prompt,
          adventureContext
        })
      });

      if (!response.ok) {
        console.log('❌ Cloud function failed, falling back to metadata-only storage...');
        // Fallback: Store metadata with original URL (will expire but at least tracks the image)
        return await this.storeImageMetadata(userId, adventureId, imageUrl, prompt, adventureContext, 0);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Image uploaded successfully via Cloud Function: ${result.filename}`);
        
        // Clean up old images after successful upload
        await this.cleanupOldImages(userId, adventureId);
        
        return result.storedImage;
      } else {
        throw new Error(result.error || 'Cloud function returned failure');
      }

    } catch (error) {
      console.error('❌ Failed to upload via Cloud Function:', error);
      console.log('📝 Storing metadata only (URL will expire)...');
      
      // Final fallback: Store just the metadata
      return await this.storeImageMetadata(userId, adventureId, imageUrl, prompt, adventureContext, 0);
    }
  }

  /**
   * Get authentication token for Cloud Function
   */
  private async getAuthToken(): Promise<string> {
    // Import auth here to avoid circular dependencies
    const { auth } = await import('./firebase');
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    return await user.getIdToken();
  }

  /**
   * Fallback: Store image metadata only (URL will expire)
   */
  private async storeImageMetadata(
    userId: string,
    adventureId: string,
    imageUrl: string,
    prompt: string,
    adventureContext: string,
    fileSize: number
  ): Promise<StoredImage | null> {
    try {
      const timestamp = Date.now();
      const filename = `${adventureId}_${timestamp}_metadata_only.jpg`;
      
      const imageMetadata: Omit<StoredImage, 'id'> = {
        userId,
        adventureId,
        imageUrl, // Original DALL-E URL (will expire)
        storagePath: `metadata-only/${filename}`,
        prompt,
        adventureContext,
        timestamp: serverTimestamp() as Timestamp,
        fileSize
      };

      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), imageMetadata);

      const storedImage: StoredImage = {
        id: docRef.id,
        ...imageMetadata,
        timestamp: Timestamp.now()
      };

      console.log(`📝 Stored image metadata: ${prompt.substring(0, 30)}... (URL will expire)`);
      return storedImage;
    } catch (error) {
      console.error('❌ Failed to store image metadata:', error);
      return null;
    }
  }

  /**
   * Get images for a specific adventure
   */
  async getAdventureImages(userId: string, adventureId: string): Promise<StoredImage[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', userId),
        where('adventureId', '==', adventureId),
        orderBy('timestamp', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StoredImage));
    } catch (error) {
      console.error('⚠️ Failed to fetch adventure images:', error);
      return [];
    }
  }

  /**
   * Get all images for a user
   */
  async getUserImages(userId: string, limitCount: number = 50): Promise<StoredImage[]> {
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
      } as StoredImage));
    } catch (error) {
      console.error('⚠️ Failed to fetch user images:', error);
      return [];
    }
  }

  /**
   * Clean up old images to maintain limits (temporarily disabled until indexes are ready)
   */
  private async cleanupOldImages(userId: string, adventureId: string): Promise<void> {
    try {
      console.log('🧹 Cleanup temporarily disabled until Firestore indexes are created');
      console.log('📝 Current storage: unlimited until indexes are ready');
      
      // TODO: Re-enable after creating Firestore indexes:
      // 1. Go to Firebase Console → Firestore → Indexes
      // 2. Create composite indexes for cleanup queries
      // 3. Uncomment cleanup functions below
      
      // await this.cleanupAdventureImages(userId, adventureId);
      // await this.cleanupUserImages(userId);
    } catch (error) {
      console.warn('⚠️ Failed to cleanup old images (continuing normally):', error);
    }
  }

  /**
   * Clean up images for a specific adventure (keep only MAX_IMAGES_PER_ADVENTURE)
   */
  private async cleanupAdventureImages(userId: string, adventureId: string): Promise<void> {
    const adventureImages = await this.getAdventureImages(userId, adventureId);
    
    if (adventureImages.length > this.MAX_IMAGES_PER_ADVENTURE) {
      const imagesToDelete = adventureImages.slice(this.MAX_IMAGES_PER_ADVENTURE);
      
      for (const image of imagesToDelete) {
        await this.deleteImage(image);
      }
      
      console.log(`🗑️ Cleaned up ${imagesToDelete.length} old images for adventure ${adventureId}`);
    }
  }

  /**
   * Clean up total user images (keep only MAX_TOTAL_IMAGES)
   */
  private async cleanupUserImages(userId: string): Promise<void> {
    const userImages = await this.getUserImages(userId, this.MAX_TOTAL_IMAGES + 10); // Get a few extra to clean up
    
    if (userImages.length > this.MAX_TOTAL_IMAGES) {
      const imagesToDelete = userImages.slice(this.MAX_TOTAL_IMAGES);
      
      for (const image of imagesToDelete) {
        await this.deleteImage(image);
      }
      
      console.log(`🗑️ Cleaned up ${imagesToDelete.length} old images for user ${userId}`);
    }
  }

  /**
   * Delete an image from both Storage and Firestore
   */
  private async deleteImage(image: StoredImage): Promise<void> {
    try {
      // Delete from Storage
      if (image.storagePath) {
        const storageRef = ref(storage, image.storagePath);
        await deleteObject(storageRef);
      }

      // Delete from Firestore
      if (image.id) {
        await deleteDoc(doc(db, this.COLLECTION_NAME, image.id));
      }

      console.log(`🗑️ Deleted image: ${image.storagePath}`);
    } catch (error) {
      console.warn(`⚠️ Failed to delete image ${image.storagePath}:`, error);
    }
  }

  /**
   * Get recent images across all adventures (for UI display)
   */
  async getRecentImages(userId: string, limitCount: number = 10): Promise<StoredImage[]> {
    return this.getUserImages(userId, limitCount);
  }

  /**
   * Get storage statistics for a user
   */
  async getStorageStats(userId: string): Promise<{
    totalImages: number;
    totalSize: number;
    oldestImage: Date | null;
    newestImage: Date | null;
    imagesByAdventure: { [adventureId: string]: number };
  }> {
    try {
      const userImages = await this.getUserImages(userId);
      
      const totalSize = userImages.reduce((sum, img) => sum + (img.fileSize || 0), 0);
      const imagesByAdventure = userImages.reduce((acc, img) => {
        acc[img.adventureId] = (acc[img.adventureId] || 0) + 1;
        return acc;
      }, {} as { [adventureId: string]: number });

      return {
        totalImages: userImages.length,
        totalSize,
        oldestImage: userImages.length > 0 ? userImages[userImages.length - 1].timestamp.toDate() : null,
        newestImage: userImages.length > 0 ? userImages[0].timestamp.toDate() : null,
        imagesByAdventure
      };
    } catch (error) {
      console.error('⚠️ Failed to get storage stats:', error);
      return {
        totalImages: 0,
        totalSize: 0,
        oldestImage: null,
        newestImage: null,
        imagesByAdventure: {}
      };
    }
  }

  /**
   * Clear all images for a user (for testing/cleanup)
   */
  async clearAllUserImages(userId: string): Promise<void> {
    try {
      const userImages = await this.getUserImages(userId, 1000); // Get all images
      
      for (const image of userImages) {
        await this.deleteImage(image);
      }
      
      console.log(`🗑️ Cleared all ${userImages.length} images for user ${userId}`);
    } catch (error) {
      console.error('❌ Failed to clear user images:', error);
    }
  }
}

export const firebaseImageService = new FirebaseImageService();
