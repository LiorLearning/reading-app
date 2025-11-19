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

const FLUX_SCHNELL_PREDICTION_URL = 'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions';

async function pollFluxSchnellPrediction(statusUrl: string, replicateToken: string, timeoutMs = 120000, intervalMs = 2000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const statusResponse = await fetch(statusUrl, {
      headers: {
        Authorization: `Bearer ${replicateToken}`,
      },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      throw new Error(`Flux Schnell status polling failed (${statusResponse.status}): ${errorText}`);
    }

    const statusData = await statusResponse.json();

    if (statusData?.status === 'succeeded') {
      return statusData;
    }

    if (statusData?.status === 'failed' || statusData?.status === 'canceled') {
      throw new Error(`Flux Schnell prediction ${statusData?.status || 'failed'}`);
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('Flux Schnell prediction timed out');
}

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
      // Add headers to avoid being blocked by image hosting services
      const imageResponse = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.google.com/',
        },
      });
      if (!imageResponse.ok) {
        const errorText = await imageResponse.text().catch(() => imageResponse.statusText);
        throw new Error(`Failed to fetch image (${imageResponse.status}): ${errorText}`);
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

      // Get public URL (works with uniform bucket-level access)
      // Note: With uniform bucket-level access, public access is controlled via bucket IAM policy
      // Ensure your bucket has public read access configured in IAM
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

export const uploadImagen = onRequest(
  {
    cors: true,
    region: 'us-central1',
  },
  async (request, response) => {
    try {
      const authToken = request.headers.authorization?.replace('Bearer ', '');
      if (!authToken) {
        response.status(401).json({ success: false, error: 'No auth token provided' });
        return;
      }

      const decodedToken = await auth.verifyIdToken(authToken);
      const userId = decodedToken.uid;

      const { adventureId, imageData, prompt, adventureContext, mimeType } = request.body || {};

      if (!adventureId || !imageData || !prompt) {
        response.status(400).json({
          success: false,
          error: 'Missing required fields: adventureId, imageData, prompt'
        });
        return;
      }

      // imageData can be pure base64 or data URL (e.g., data:image/png;base64,AAAA)
      let base64String: string = imageData;
      let detectedMime = mimeType as string | undefined;
      if (imageData.startsWith('data:')) {
        const commaIndex = imageData.indexOf(',');
        const header = imageData.substring(0, commaIndex);
        base64String = imageData.substring(commaIndex + 1);
        const match = /data:(.*?);base64/.exec(header);
        if (match && match[1]) {
          detectedMime = detectedMime || match[1];
        }
      }

      const buffer = Buffer.from(base64String, 'base64');
      const fileSize = buffer.length;
      const timestamp = Date.now();
      const safeMime = detectedMime || 'image/png';
      const extension = safeMime.includes('jpeg') || safeMime.includes('jpg') ? 'jpg' : safeMime.includes('webp') ? 'webp' : 'png';
      const filename = `${adventureId}_${timestamp}.${extension}`;
      const storagePath = `adventure-images/${userId}/${adventureId}/${filename}`;

      const bucket = storage.bucket();
      const file = bucket.file(storagePath);
      await file.save(buffer, {
        metadata: {
          contentType: safeMime,
          metadata: {
            userId,
            adventureId,
            prompt,
            uploadedAt: new Date().toISOString(),
            source: 'imagen-data-string'
          },
        },
      });

      // Get public URL (works with uniform bucket-level access)
      // Note: With uniform bucket-level access, public access is controlled via bucket IAM policy
      // Ensure your bucket has public read access configured in IAM
      const firebaseImageUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

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
      const storedImage = { id: docRef.id, ...imageMetadata };

      response.json({
        success: true,
        storedImage,
        filename,
        firebaseUrl: firebaseImageUrl,
      });
    } catch (error) {
      console.error('❌ Error in uploadImagen function:', error);
      response.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export const generateFluxSchnell = onRequest(
  {
    cors: true,
    region: 'us-central1',
    secrets: ['VITE_REPLICATE_TOKEN'],
  },
  async (request, response) => {
    response.set('Access-Control-Allow-Origin', '*');
    response.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }

    if (request.method !== 'POST') {
      response.status(405).json({ success: false, error: 'Method not allowed' });
      return;
    }

    try {
      const authToken = request.headers.authorization?.replace('Bearer ', '');

      if (!authToken) {
        response.status(401).json({ success: false, error: 'No auth token provided' });
        return;
      }

      await auth.verifyIdToken(authToken);

      const { prompt, options } = request.body || {};

      if (!prompt || typeof prompt !== 'string') {
        response.status(400).json({ success: false, error: 'Missing or invalid prompt' });
        return;
      }

      const replicateToken = process.env.VITE_REPLICATE_TOKEN;
      if (!replicateToken) {
        response.status(500).json({ success: false, error: 'Replicate API token not configured' });
        return;
      }

      const payload = {
        input: {
          prompt,
          go_fast: options?.go_fast !== undefined ? options.go_fast : true,
          output_quality: options?.output_quality ?? 80,
          num_inference_steps: options?.num_inference_steps ?? 4,
          aspect_ratio: "5:4"
        },
      };

      const initialResponse = await fetch(FLUX_SCHNELL_PREDICTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${replicateToken}`,
          Prefer: 'wait',
        },
        body: JSON.stringify(payload),
      });

      if (!initialResponse.ok) {
        const errorText = await initialResponse.text();
        response.status(initialResponse.status).json({
          success: false,
          error: `Flux Schnell API request failed (${initialResponse.status}): ${errorText}`,
        });
        return;
      }

      let prediction = await initialResponse.json();

      if (!prediction?.output?.[0] || prediction?.status !== 'succeeded') {
        const statusUrl = prediction?.urls?.get;

        if (!statusUrl) {
          response.status(500).json({ success: false, error: 'Flux Schnell prediction missing status URL' });
          return;
        }

        prediction = await pollFluxSchnellPrediction(statusUrl, replicateToken);
      }

      const outputUrl = prediction?.output?.[0];

      if (!outputUrl || typeof outputUrl !== 'string') {
        response.status(500).json({ success: false, error: 'Flux Schnell prediction returned invalid output' });
        return;
      }

      response.json({
        success: true,
        imageUrl: outputUrl,
        predictionId: prediction?.id,
        status: prediction?.status,
      });
    } catch (error) {
      console.error('❌ Error in generateFluxSchnell function:', error);
      response.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);
