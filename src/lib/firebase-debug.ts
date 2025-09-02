// Debug utility to check Firebase image storage issues

export const debugFirebaseImageStorage = async () => {
  console.log('🔍 DEBUGGING FIREBASE IMAGE STORAGE');
  
  // Check Firebase configuration
  try {
    const { storage } = await import('./firebase');
    console.log('✅ Firebase Storage configured:', !!storage);
  } catch (error) {
    console.error('❌ Firebase Storage configuration error:', error);
  }
  
  // Check adventure ID
  try {
    const { loadCurrentAdventureId } = await import('./utils');
    const adventureId = loadCurrentAdventureId();
    console.log('🎮 Current Adventure ID:', adventureId);
  } catch (error) {
    console.error('❌ Adventure ID error:', error);
  }
};

// Enhanced cacheAdventureImageHybrid with detailed logging
export const debugCacheAdventureImageHybrid = async (
  userId: string | null,
  url: string,
  prompt: string,
  adventureContext: string = '',
  adventureId?: string,
  fallbackToLocalStorage: boolean = true
): Promise<void> => {
  console.log('🚀 DEBUG: Starting image caching process');
  console.log('📊 Cache Parameters:', {
    userId,
    url: url?.substring(0, 100) + '...',
    prompt,
    adventureContext: adventureContext?.substring(0, 50) + '...',
    adventureId,
    fallbackToLocalStorage
  });

  // Check if we should try Firebase
  if (!userId) {
    console.log('❌ DEBUG: No userId provided - skipping Firebase');
  }
  
  if (!adventureId) {
    console.log('❌ DEBUG: No adventureId provided - skipping Firebase');
  }
  
  if (!url || url.startsWith('/') || url.startsWith('data:')) {
    console.log('❌ DEBUG: Invalid URL format - skipping Firebase');
  }
  
  // Try Firebase first if user is authenticated
  if (userId && adventureId) {
    console.log('✅ DEBUG: Attempting Firebase storage...');
    
    try {
      const { cacheAdventureImageFirebase } = await import('./firebase-image-cache');
      const success = await cacheAdventureImageFirebase(
        userId, 
        url, 
        prompt, 
        adventureContext, 
        adventureId
      );
      
      console.log('🔥 DEBUG: Firebase result:', success);
      
      if (success) {
        console.log('✅ DEBUG: Successfully cached to Firebase');
        return; // Successfully cached to Firebase
      } else {
        console.log('❌ DEBUG: Firebase caching failed, falling back...');
      }
    } catch (error) {
      console.error('❌ DEBUG: Firebase caching error:', error);
    }
  } else {
    console.log('⚠️ DEBUG: Skipping Firebase (userId or adventureId missing)');
  }

  // Fallback to localStorage if Firebase fails or user not authenticated
  if (fallbackToLocalStorage) {
    console.log('💾 DEBUG: Using localStorage fallback...');
    try {
      const { cacheAdventureImage } = await import('./utils');
      cacheAdventureImage(url, prompt, adventureContext, adventureId);
      console.log('✅ DEBUG: Successfully cached to localStorage');
    } catch (error) {
      console.error('❌ DEBUG: localStorage caching error:', error);
    }
  } else {
    console.log('⚠️ DEBUG: localStorage fallback disabled');
  }
};
