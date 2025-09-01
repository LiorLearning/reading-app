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
   * Upload generated image to Firebase Storage and save metadata
   */
  async uploadGeneratedImage(
    userId: string,
    adventureId: string,
    imageUrl: string,
    prompt: string,
    adventureContext: string = ''
  ): Promise<StoredImage | null> {
    try {
      // Download the generated image from DALL-E URL
      console.log('📥 Downloading generated image from DALL-E...');
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const imageBlob = await response.blob();
      const fileSize = imageBlob.size;

      // Create unique filename with timestamp
      const timestamp = Date.now();
      const filename = `${adventureId}_${timestamp}.jpg`;
      const storagePath = `${this.STORAGE_PATH}/${userId}/${adventureId}/${filename}`;

      // Upload to Firebase Storage
      console.log('☁️ Uploading to Firebase Storage...');
      const storageRef = ref(storage, storagePath);
      const uploadResult = await uploadBytes(storageRef, imageBlob);

      // Get download URL
      const firebaseImageUrl = await getDownloadURL(uploadResult.ref);

      // Save metadata to Firestore
      const imageMetadata: Omit<StoredImage, 'id'> = {
        userId,
        adventureId,
        imageUrl: firebaseImageUrl,
        storagePath,
        prompt,
        adventureContext,
        timestamp: serverTimestamp() as Timestamp,
        fileSize
      };

      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), imageMetadata);

      const storedImage: StoredImage = {
        id: docRef.id,
        ...imageMetadata,
        timestamp: Timestamp.now() // Use current time for local representation
      };

      console.log(`✅ Image uploaded successfully: ${filename}`);

      // Clean up old images after successful upload
      await this.cleanupOldImages(userId, adventureId);

      return storedImage;
    } catch (error) {
      console.error('❌ Failed to upload image to Firebase:', error);
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
   * Clean up old images to maintain limits
   */
  private async cleanupOldImages(userId: string, adventureId: string): Promise<void> {
    try {
      // Clean up images for this specific adventure (keep only 5 most recent)
      await this.cleanupAdventureImages(userId, adventureId);

      // Clean up total user images (keep only 50 most recent)
      await this.cleanupUserImages(userId);
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
