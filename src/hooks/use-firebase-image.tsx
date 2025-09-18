import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { firebaseImageService } from '@/lib/firebase-image-service';

/**
 * Hook to replace expired OpenAI/DALL-E URLs with Firebase Storage URLs
 */
export const useFirebaseImage = (originalUrl: string, adventureId?: string) => {
  const { user } = useAuth();
  const [resolvedUrl, setResolvedUrl] = useState<string>(originalUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const resolveImage = async () => {
      // If no original URL or user, return as-is
      if (!originalUrl || !user) {
        setResolvedUrl(originalUrl);
        return;
      }

      // Check if URL is an expired OpenAI/DALL-E URL
      const isExpiredDalleUrl = (url: string): boolean => {
        return url.includes('oaidalleapiprodscus.blob.core.windows.net') ||
               url.includes('dalle-api') ||
               (url.includes('dalle') && url.includes('.windows.net'));
      };

      // If it's not an expired URL, use it as-is
      if (!isExpiredDalleUrl(originalUrl)) {
        setResolvedUrl(originalUrl);
        return;
      }

      // It's an expired URL - try to find Firebase replacement
      console.log(`🔄 Resolving expired DALL-E URL for adventure ${adventureId}...`);
      
      setIsLoading(true);
      setError(null);

      try {
        if (adventureId) {
          // Try to get the latest image for this specific adventure
          const latestImage = await firebaseImageService.getLatestAdventureImage(user.uid, adventureId);
          if (latestImage) {
            console.log(`✅ Found Firebase replacement for adventure ${adventureId}: ${latestImage.substring(0, 50)}...`);
            setResolvedUrl(latestImage);
            return;
          }
        }

        // Fallback: Get all latest images and try to match by content or use most recent
        const allLatestImages = await firebaseImageService.getLatestAdventureImages(user.uid);
        
        if (adventureId && allLatestImages[adventureId]) {
          console.log(`✅ Found Firebase fallback for adventure ${adventureId}`);
          setResolvedUrl(allLatestImages[adventureId]);
          return;
        }

        // If no specific match found, warn and keep original URL (will likely 403)
        console.warn(`⚠️ No Firebase replacement found for adventure ${adventureId}, keeping original URL`);
        setResolvedUrl(originalUrl);
        setError('No Firebase replacement found');

      } catch (err) {
        console.error('❌ Failed to resolve Firebase image:', err);
        setResolvedUrl(originalUrl);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    resolveImage();
  }, [originalUrl, adventureId, user]);

  return {
    url: resolvedUrl,
    isLoading,
    error,
    isExpiredUrl: originalUrl.includes('oaidalleapiprodscus.blob.core.windows.net')
  };
};

/**
 * Hook to get the current adventure ID from context
 * This is a simple implementation - you might need to adjust based on your app structure
 */
export const useCurrentAdventureId = (): string | null => {
  // This should be replaced with your actual adventure context logic
  // For now, we'll try to extract from URL or use a default
  
  const [adventureId, setAdventureId] = useState<string | null>(null);

  useEffect(() => {
    // Try to get adventure ID from URL hash or localStorage
    const hash = window.location.hash;
    const urlAdventureId = hash.includes('adventure=') 
      ? hash.split('adventure=')[1]?.split('&')[0] 
      : null;
    
    if (urlAdventureId) {
      setAdventureId(urlAdventureId);
      return;
    }

    // Fallback: get from localStorage
    const currentAdventureId = localStorage.getItem('currentAdventureId');
    if (currentAdventureId) {
      setAdventureId(currentAdventureId);
    }
  }, []);

  return adventureId;
};
