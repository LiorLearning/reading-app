import { firebaseImageService, StoredImage } from './firebase-image-service';

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
): Promise<boolean> => {
  try {
    // Don't cache if URL is null, empty, or a local asset
    if (!url || url.startsWith('/') || url.startsWith('data:')) {
      return false;
    }

    if (!adventureId) {
      console.warn('No adventureId provided for Firebase image caching');
      return false;
    }


    const storedImage = await firebaseImageService.uploadGeneratedImage(
      userId,
      adventureId,
      url,
      prompt,
      adventureContext
    );

    if (storedImage) {

      return true;
    } else {
      console.warn('Failed to cache adventure image to Firebase');
      return false;
    }
  } catch (error) {
    console.error('Error caching adventure image to Firebase:', error);
    return false;
  }
};

/**
 * Load adventure images from Firebase (replaces localStorage version)
 */
export const loadCachedAdventureImagesFirebase = async (
  userId: string
): Promise<FirebaseCachedImage[]> => {
  try {
    const storedImages = await firebaseImageService.getUserImages(userId, 50);
    
    return storedImages.map((img: StoredImage): FirebaseCachedImage => ({
      id: img.id || crypto.randomUUID(),
      url: img.imageUrl,
      prompt: img.prompt,
      adventureContext: img.adventureContext,
      timestamp: img.timestamp.toMillis(),
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
      timestamp: img.timestamp.toMillis(),
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
      timestamp: img.timestamp.toMillis(),
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
): Promise<void> => {
  // Try Firebase first if user is authenticated
  if (userId && adventureId) {
    const success = await cacheAdventureImageFirebase(
      userId, 
      url, 
      prompt, 
      adventureContext, 
      adventureId
    );
    
    if (success) {
      return; // Successfully cached to Firebase
    }
  }

  // Fallback to localStorage if Firebase fails or user not authenticated
  if (fallbackToLocalStorage) {
    const { cacheAdventureImage } = await import('./utils');
    cacheAdventureImage(url, prompt, adventureContext, adventureId);
  }
};
