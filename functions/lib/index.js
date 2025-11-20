"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFluxSchnell = exports.uploadImagen = exports.uploadImage = void 0;
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const storage_1 = require("firebase-admin/storage");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
// Initialize Firebase Admin
(0, app_1.initializeApp)();
const storage = (0, storage_1.getStorage)();
const firestore = (0, firestore_1.getFirestore)();
const auth = (0, auth_1.getAuth)();
const FLUX_SCHNELL_PREDICTION_URL = 'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions';
async function pollFluxSchnellPrediction(statusUrl, replicateToken, timeoutMs = 120000, intervalMs = 2000) {
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
        if ((statusData === null || statusData === void 0 ? void 0 : statusData.status) === 'succeeded') {
            return statusData;
        }
        if ((statusData === null || statusData === void 0 ? void 0 : statusData.status) === 'failed' || (statusData === null || statusData === void 0 ? void 0 : statusData.status) === 'canceled') {
            throw new Error(`Flux Schnell prediction ${(statusData === null || statusData === void 0 ? void 0 : statusData.status) || 'failed'}`);
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    throw new Error('Flux Schnell prediction timed out');
}
exports.uploadImage = (0, https_1.onRequest)({
    cors: true,
    region: 'us-central1',
}, async (request, response) => {
    var _a;
    try {
        // Verify authentication
        const authToken = (_a = request.headers.authorization) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', '');
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
            timestamp: firestore_1.Timestamp.now(),
            fileSize,
        };
        const docRef = await firestore.collection('adventureImages').add(imageMetadata);
        const storedImage = Object.assign({ id: docRef.id }, imageMetadata);
        console.log(`✅ Successfully uploaded image: ${filename}`);
        response.json({
            success: true,
            storedImage,
            filename,
            firebaseUrl: firebaseImageUrl,
        });
    }
    catch (error) {
        console.error('❌ Error in uploadImage function:', error);
        response.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
exports.uploadImagen = (0, https_1.onRequest)({
    cors: true,
    region: 'us-central1',
}, async (request, response) => {
    var _a;
    try {
        const authToken = (_a = request.headers.authorization) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', '');
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
        let base64String = imageData;
        let detectedMime = mimeType;
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
            timestamp: firestore_1.Timestamp.now(),
            fileSize,
        };
        const docRef = await firestore.collection('adventureImages').add(imageMetadata);
        const storedImage = Object.assign({ id: docRef.id }, imageMetadata);
        response.json({
            success: true,
            storedImage,
            filename,
            firebaseUrl: firebaseImageUrl,
        });
    }
    catch (error) {
        console.error('❌ Error in uploadImagen function:', error);
        response.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
exports.generateFluxSchnell = (0, https_1.onRequest)({
    cors: true,
    region: 'us-central1',
    secrets: ['VITE_REPLICATE_TOKEN'],
}, async (request, response) => {
    var _a, _b, _c, _d, _e, _f;
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
        const authToken = (_a = request.headers.authorization) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', '');
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
                go_fast: (options === null || options === void 0 ? void 0 : options.go_fast) !== undefined ? options.go_fast : true,
                output_quality: (_b = options === null || options === void 0 ? void 0 : options.output_quality) !== null && _b !== void 0 ? _b : 80,
                num_inference_steps: (_c = options === null || options === void 0 ? void 0 : options.num_inference_steps) !== null && _c !== void 0 ? _c : 4,
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
        if (!((_d = prediction === null || prediction === void 0 ? void 0 : prediction.output) === null || _d === void 0 ? void 0 : _d[0]) || (prediction === null || prediction === void 0 ? void 0 : prediction.status) !== 'succeeded') {
            const statusUrl = (_e = prediction === null || prediction === void 0 ? void 0 : prediction.urls) === null || _e === void 0 ? void 0 : _e.get;
            if (!statusUrl) {
                response.status(500).json({ success: false, error: 'Flux Schnell prediction missing status URL' });
                return;
            }
            prediction = await pollFluxSchnellPrediction(statusUrl, replicateToken);
        }
        const outputUrl = (_f = prediction === null || prediction === void 0 ? void 0 : prediction.output) === null || _f === void 0 ? void 0 : _f[0];
        if (!outputUrl || typeof outputUrl !== 'string') {
            response.status(500).json({ success: false, error: 'Flux Schnell prediction returned invalid output' });
            return;
        }
        response.json({
            success: true,
            imageUrl: outputUrl,
            predictionId: prediction === null || prediction === void 0 ? void 0 : prediction.id,
            status: prediction === null || prediction === void 0 ? void 0 : prediction.status,
        });
    }
    catch (error) {
        console.error('❌ Error in generateFluxSchnell function:', error);
        response.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
//# sourceMappingURL=index.js.map