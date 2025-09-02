// Service to handle image downloads and uploads bypassing CORS
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export class ImageProxyService {
  /**
   * Download image using CORS proxy and upload to Firebase Storage
   */
  async downloadAndStoreImage(
    imageUrl: string,
    userId: string,
    adventureId: string,
    prompt: string
  ): Promise<{ firebaseUrl: string; storagePath: string } | null> {
    try {
      console.log('📥 Downloading image via proxy...');
      
      // Method 1: Try using a CORS proxy
      const proxyUrl = `https://cors-anywhere.herokuapp.com/${imageUrl}`;
      
      let imageBlob: Blob;
      
      try {
        // Try direct fetch first
        console.log('🔄 Attempting direct fetch...');
        const directResponse = await fetch(imageUrl, {
          mode: 'cors',
          headers: {
            'Origin': window.location.origin,
          }
        });
        
        if (directResponse.ok) {
          imageBlob = await directResponse.blob();
          console.log('✅ Direct fetch successful');
        } else {
          throw new Error('Direct fetch failed');
        }
      } catch (directError) {
        console.log('⚠️ Direct fetch failed, trying proxy...');
        
        // Try with CORS proxy
        try {
          const proxyResponse = await fetch(proxyUrl, {
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
            }
          });
          
          if (!proxyResponse.ok) {
            throw new Error(`Proxy fetch failed: ${proxyResponse.statusText}`);
          }
          
          imageBlob = await proxyResponse.blob();
          console.log('✅ Proxy fetch successful');
        } catch (proxyError) {
          console.log('⚠️ Proxy fetch failed, trying alternative method...');
          
          // Method 2: Try using img element and canvas conversion
          try {
            imageBlob = await this.downloadViaCanvas(imageUrl);
            console.log('✅ Canvas method successful');
          } catch (canvasError) {
            console.error('❌ All download methods failed:', canvasError);
            throw new Error('Unable to download image');
          }
        }
      }

      // Upload to Firebase Storage
      console.log('☁️ Uploading to Firebase Storage...');
      const timestamp = Date.now();
      const filename = `${adventureId}_${timestamp}.jpg`;
      const storagePath = `adventure-images/${userId}/${adventureId}/${filename}`;

      const storageRef = ref(storage, storagePath);
      const uploadResult = await uploadBytes(storageRef, imageBlob);
      const firebaseUrl = await getDownloadURL(uploadResult.ref);

      console.log(`✅ Image successfully stored: ${filename}`);
      
      return {
        firebaseUrl,
        storagePath
      };

    } catch (error) {
      console.error('❌ Failed to download and store image:', error);
      return null;
    }
  }

  /**
   * Alternative method: Download via canvas (works for some CORS scenarios)
   */
  private async downloadViaCanvas(imageUrl: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // This might help with some CORS issues
      
      img.onload = () => {
        try {
          // Create canvas and draw image
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            throw new Error('Could not get canvas context');
          }

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          // Convert to blob
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Could not convert canvas to blob'));
            }
          }, 'image/jpeg', 0.9);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Could not load image for canvas conversion'));
      };

      img.src = imageUrl;
    });
  }

  /**
   * Method 3: Use our own proxy server (if we create one)
   */
  private async downloadViaOurProxy(imageUrl: string): Promise<Blob> {
    // If you deploy a simple proxy server, use this
    const ourProxyUrl = `https://your-proxy-server.com/proxy?url=${encodeURIComponent(imageUrl)}`;
    
    const response = await fetch(ourProxyUrl);
    if (!response.ok) {
      throw new Error(`Our proxy failed: ${response.statusText}`);
    }
    
    return await response.blob();
  }
}

export const imageProxyService = new ImageProxyService();
