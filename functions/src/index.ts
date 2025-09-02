import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin
initializeApp();

const storage = getStorage();
const firestore = getFirestore();
const auth = getAuth();

export const uploadImage = onRequest(
  {
    cors: true,
    region: 'us-central1',
  },
  async (request, response) => {
    try {
      // Verify authentication
      const authToken = request.headers.authorization?.replace('Bearer ', '');
      if (!authToken) {
        response.status(401).json({ success: false, error: 'No auth token provided' });
        return;
      }

      const decodedToken = await auth.verifyIdToken(authToken);
      const userId = decodedToken.uid;

      // Parse request body
      const { adventureId, imageUrl, prompt, adventureContext } = request.body;

      if (!adventureId || !imageUrl || !prompt) {
        response.status(400).json({ 
          success: false, 
          error: 'Missing required fields: adventureId, imageUrl, prompt' 
        });
        return;
      }

      console.log(`📥 Downloading image from DALL-E for user ${userId}...`);

      // Download image from DALL-E URL (server-side, no CORS issues)
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
      }

      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const fileSize = imageBuffer.length;

      // Create unique filename
      const timestamp = Date.now();
      const filename = `${adventureId}_${timestamp}.jpg`;
      const storagePath = `adventure-images/${userId}/${adventureId}/${filename}`;

      // Upload to Firebase Storage
      console.log(`☁️ Uploading to Firebase Storage: ${storagePath}`);
      const bucket = storage.bucket();
      const file = bucket.file(storagePath);

      await file.save(imageBuffer, {
        metadata: {
          contentType: 'image/jpeg',
          metadata: {
            userId,
            adventureId,
            prompt,
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      // Make file publicly readable
      await file.makePublic();

      // Get download URL
      const firebaseImageUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

      // Save metadata to Firestore
      const imageMetadata = {
        userId,
        adventureId,
        imageUrl: firebaseImageUrl,
        storagePath,
        prompt,
        adventureContext: adventureContext || '',
        timestamp: Timestamp.now(),
        fileSize,
      };

      const docRef = await firestore.collection('adventureImages').add(imageMetadata);

      const storedImage = {
        id: docRef.id,
        ...imageMetadata,
      };

      console.log(`✅ Successfully uploaded image: ${filename}`);

      response.json({
        success: true,
        storedImage,
        filename,
        firebaseUrl: firebaseImageUrl,
      });

    } catch (error) {
      console.error('❌ Error in uploadImage function:', error);
      response.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);
