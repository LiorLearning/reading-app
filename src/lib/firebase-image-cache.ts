import { firebaseImageService, StoredImage } from './firebase-image-service';
import { firebaseImageUrlService, StoredImageUrl } from './firebase-image-url-service';

// Helper function to safely convert Firebase timestamps to milliseconds
function safeTimestampToMillis(timestamp: any): number {
  try {
    if (timestamp && typeof timestamp.toMillis === 'function') {
      return timestamp.toMillis();
    }
    if (timestamp?.seconds) {
      return timestamp.seconds * 1000;
    }
    return Date.now();
  } catch {
    return Date.now();
  }
}

export interface FirebaseCachedImage {
  id: string;
  url: string;
  prompt: string;
  adventureContext: string;
  timestamp: number;
  adventureId?: string;
}

/**
 * Firebase-based adventure image caching (stores actual files with CORS bypass)
 */
export const cacheAdventureImageFirebase = async (
  userId: string,
  url: string, 
  prompt: string, 
  adventureContext: string = '',
  adventureId?: string
): Promise<string | null> => {
  try {
    // Don't cache if URL is null, empty, or a local asset
    if (!url || url.startsWith('/') || url.startsWith('data:')) {
      return null;
    }

    if (!adventureId) {
      console.warn('No adventureId provided for Firebase image caching');
      return null;
    }

    // Try to upload the actual image file to Firebase Storage
    const storedImage = await firebaseImageService.uploadGeneratedImage(
      userId,
      adventureId,
      url,
      prompt,
      adventureContext
    );

    // Always store the URL metadata for retrieval, regardless of file upload success
    let finalImageUrl = url; // Default to original URL
    if (storedImage && storedImage.imageUrl) {
      finalImageUrl = storedImage.imageUrl; // Use permanent Firebase URL if available
    }

    // Store image URL metadata in the URL service for retrieval
    const urlMetadata = await firebaseImageUrlService.storeImageUrl(
      userId,
      adventureId,
      finalImageUrl,
      prompt,
      adventureContext,
      storedImage ? 'local' : 'dalle' // Mark as 'local' if we have permanent Firebase URL, 'dalle' if temporary
    );

    if (urlMetadata) {
      // console.log(`🔄 Image cached to Firebase with metadata: ${prompt.substring(0, 30)}...`);
      return finalImageUrl;
    } else {
      console.warn('Failed to store image URL metadata to Firebase');
      return storedImage ? storedImage.imageUrl : null;
    }
  } catch (error) {
    console.error('Error caching adventure image to Firebase:', error);
    return null;
  }
};

/**
 * Load adventure images from Firebase (replaces localStorage version)
 */
export const loadCachedAdventureImagesFirebase = async (
  userId: string
): Promise<FirebaseCachedImage[]> => {
  try {
    const storedImages = await firebaseImageUrlService.getUserImageUrls(userId, 50);
    
    return storedImages.map((img: StoredImageUrl): FirebaseCachedImage => ({
      id: img.id || crypto.randomUUID(),
      url: img.imageUrl,
      prompt: img.prompt,
      adventureContext: img.adventureContext,
      timestamp: safeTimestampToMillis(img.timestamp),
      adventureId: img.adventureId
    }));
  } catch (error) {
    console.error('❌ Failed to load adventure images from Firebase:', error);
    return [];
  }
};

/**
 * Get cached adventure images for a specific adventure from Firebase
 */
export const getCachedImagesForAdventureFirebase = async (
  userId: string, 
  adventureId: string
): Promise<FirebaseCachedImage[]> => {
  try {
    const storedImages = await firebaseImageUrlService.getAdventureImageUrls(userId, adventureId);
    
    return storedImages.map((img: StoredImageUrl): FirebaseCachedImage => ({
      id: img.id || crypto.randomUUID(),
      url: img.imageUrl,
      prompt: img.prompt,
      adventureContext: img.adventureContext,
      timestamp: safeTimestampToMillis(img.timestamp),
      adventureId: img.adventureId
    }));
  } catch (error) {
    console.error('❌ Failed to load adventure images from Firebase:', error);
    return [];
  }
};

/**
 * Get recent cached adventure images from Firebase
 */
export const getRecentCachedAdventureImagesFirebase = async (
  userId: string,
  limit: number = 5
): Promise<FirebaseCachedImage[]> => {
  try {
    const storedImages = await firebaseImageUrlService.getRecentImageUrls(userId, limit);
    
    return storedImages.map((img: StoredImageUrl): FirebaseCachedImage => ({
      id: img.id || crypto.randomUUID(),
      url: img.imageUrl,
      prompt: img.prompt,
      adventureContext: img.adventureContext,
      timestamp: safeTimestampToMillis(img.timestamp),
      adventureId: img.adventureId
    }));
  } catch (error) {
    console.error('❌ Failed to load recent adventure images from Firebase:', error);
    return [];
  }
};

/**
 * Clear all cached adventure images from Firebase
 */
export const clearCachedAdventureImagesFirebase = async (
  userId: string
): Promise<void> => {
  try {
    await firebaseImageUrlService.clearAllUserImageUrls(userId);
  } catch (error) {
    console.error('Failed to clear cached adventure image URLs from Firebase:', error);
  }
};

/**
 * Get adventure image cache statistics from Firebase
 */
export const getAdventureImageCacheStatsFirebase = async (
  userId: string
): Promise<{
  totalImages: number;
  oldestImage: number;
  newestImage: number;
  imagesByAdventure: { [adventureId: string]: number };
  imagesBySource: { [source: string]: number };
}> => {
  try {
    const stats = await firebaseImageUrlService.getStorageStats(userId);
    
    return {
      totalImages: stats.totalImages,
      oldestImage: stats.oldestImage?.getTime() || 0,
      newestImage: stats.newestImage?.getTime() || 0,
      imagesByAdventure: stats.imagesByAdventure,
      imagesBySource: stats.imagesBySource
    };
  } catch (error) {
    console.error('❌ Failed to get adventure image cache stats from Firebase:', error);
    return {
      totalImages: 0,
      oldestImage: 0,
      newestImage: 0,
      imagesByAdventure: {},
      imagesBySource: {}
    };
  }
};

/**
 * Hybrid function that tries Firebase first, falls back to localStorage
 * This allows for gradual migration from localStorage to Firebase
 */
export const cacheAdventureImageHybrid = async (
  userId: string | null,
  url: string,
  prompt: string,
  adventureContext: string = '',
  adventureId?: string,
  fallbackToLocalStorage: boolean = true
): Promise<string | null> => {
  // Try Firebase first if user is authenticated
  if (userId && adventureId) {
    const permanentUrl = await cacheAdventureImageFirebase(
      userId, 
      url, 
      prompt, 
      adventureContext, 
      adventureId
    );
    
    if (permanentUrl) {
      return permanentUrl; // Return the permanent Firebase URL
    }
  }

  // Fallback to localStorage if Firebase fails or user not authenticated
  if (fallbackToLocalStorage) {
    const { cacheAdventureImage } = await import('./utils');
    cacheAdventureImage(url, prompt, adventureContext, adventureId);
  }
  
  // Return original URL if Firebase failed (will be temporary DALL-E URL)
  return url;
};
