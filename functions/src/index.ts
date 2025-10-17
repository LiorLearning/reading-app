import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { google } from 'googleapis';
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

      await file.makePublic();
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

// ==========================
// Analytics Export → Google Sheets (Sessions)
// ==========================

type ChatMessage = { type: 'user' | 'ai'; content: string; timestamp: number; hiddenInChat?: boolean };
type MCQAnswer = { questionId: number; selectedAnswer: number; isCorrect: boolean; timestamp: number; topicId: string };

interface AdventureSessionDoc {
  userId: string;
  petId?: string;
  adventureId: string;
  topicId?: string;
  chatMessages: ChatMessage[];
  totalChatMessages?: number;
  mcqAnswers?: MCQAnswer[];
  totalQuestionsAnswered?: number;
  correctAnswers?: number;
  adventurePromptCount?: number;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
  lastActivityAt?: FirebaseFirestore.Timestamp;
}

const SHEET_ID = process.env.SHEET_ID || process.env.GSHEET_ID || '';
const SHEET_TAB = process.env.SHEET_TAB || 'Analytics';
const TIMEZONE = process.env.TIMEZONE || 'Asia/Kolkata';

async function getSheetsClient() {
  const auth = await google.auth.getClient({ scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

function toTzString(ms: number | undefined | null): string {
  if (!ms || Number.isNaN(ms)) return '';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString();
  }
}

function countWords(text: string): number {
  const t = (text || '').trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

interface UserProfile { username: string; country?: string | null; countryCode?: string | null }

async function getUserProfile(uid: string): Promise<UserProfile> {
  try {
    const userDoc = await firestore.collection('users').doc(uid).get();
    const data = userDoc.data() as any;
    const name = (data?.username || '').trim();
    const country = (data?.country || data?.countryName || null) as string | null;
    const countryCode = (data?.countryCode || data?.country_code || null) as string | null;
    return { username: name || uid, country, countryCode };
  } catch {
    return { username: uid, country: null, countryCode: null };
  }
}

async function countImagesForSession(uid: string, adventureId: string, startMs: number, endMs: number): Promise<number> {
  let total = 0;
  // adventureImages (uploaded via CF)
  try {
    const snap = await firestore
      .collection('adventureImages')
      .where('userId', '==', uid)
      .where('adventureId', '==', adventureId)
      .get();
    snap.forEach((d) => {
      const ts = (d.get('timestamp') as FirebaseFirestore.Timestamp | null)?.toMillis?.() || 0;
      if (!startMs || !endMs || (ts >= startMs && ts <= endMs)) total += 1;
    });
  } catch {}

  // adventureImageUrls (metadata-only)
  try {
    const snap2 = await firestore
      .collection('adventureImageUrls')
      .where('userId', '==', uid)
      .where('adventureId', '==', adventureId)
      .get();
    snap2.forEach((d) => {
      const ts = (d.get('timestamp') as FirebaseFirestore.Timestamp | null)?.toMillis?.() || 0;
      if (!startMs || !endMs || (ts >= startMs && ts <= endMs)) total += 1;
    });
  } catch {}

  return total;
}

async function countDailyQuestsCompleted(uid: string): Promise<number> {
  try {
    const snap = await firestore.collection('dailyQuests').doc(uid).get();
    if (!snap.exists) return 0;
    const data = snap.data() as any;
    const petKeys = Object.keys(data || {}).filter((k) => k !== 'createdAt' && k !== 'updatedAt' && !k.startsWith('_'));
    let completed = 0;
    for (const pet of petKeys) {
      const petObj = data[pet] || {};
      // Find any numeric progress (current activity), treat >=5 as completed
      const entries = Object.entries(petObj).filter(([k, v]) => !k.startsWith('_') && typeof v === 'number');
      const prog = entries.length > 0 ? Number(entries[0][1]) : 0;
      if (prog >= 5) completed += 1;
    }
    return completed;
  } catch {
    return 0;
  }
}

function buildRow(sessionId: string, uid: string, username: string, countryLabel: string, s: AdventureSessionDoc) {
  const messages = Array.isArray(s.chatMessages) ? (s.chatMessages as ChatMessage[]) : [];
  const userMsgs = messages.filter((m) => m?.type === 'user' && !m?.hiddenInChat);
  const firstTs = messages.length > 0 ? Number(messages[0]?.timestamp || 0) : (s.createdAt?.toMillis?.() || 0);
  const lastTs = messages.length > 0 ? Number(messages[messages.length - 1]?.timestamp || 0) : (s.lastActivityAt?.toMillis?.() || s.updatedAt?.toMillis?.() || 0);
  const durationMin = firstTs && lastTs && lastTs >= firstTs ? Math.round((lastTs - firstTs) / 60000) : 0;
  const userWords = userMsgs.reduce((sum, m) => sum + countWords(m?.content || ''), 0);

  const mcq = Array.isArray(s.mcqAnswers) ? (s.mcqAnswers as MCQAnswer[]) : [];
  const attempts = mcq.length;
  const correct = mcq.filter((a) => !!a?.isCorrect).length;
  const incorrect = attempts - correct;
  const uniqueQ = new Set(mcq.map((a) => a?.questionId)).size;

  const createdStr = toTzString(s.createdAt?.toMillis?.() || firstTs || 0);
  const lastStr = toTzString(s.lastActivityAt?.toMillis?.() || lastTs || 0);
  const stamp = s.lastActivityAt?.toMillis?.() || lastTs || 0;

  const pets = s.petId ? 1 : 0;
  const petActions = Number(s.adventurePromptCount || 0);
  const petsUsed = pets; // current model supports one pet per session

  // placeholders (phase 1)
  const imagesGenerated = 0; // will be filled after async count
  const imageGenSeconds = '';

  const row: any[] = [
    username,
    createdStr,
    lastStr,
    durationMin,
    stamp,
    userMsgs.length,
    userWords,
    pets,
    petActions,
    petsUsed,
    0, // daily_quests_completed (filled later)
    '', // total_quests_completed (not tracked yet)
    imagesGenerated,
    imageGenSeconds,
    attempts,
    correct,
    incorrect,
    uniqueQ,
    countryLabel,
    sessionId, // hidden id for dedupe
  ];
  return { row, firstTs, lastTs } as const;
}

async function exportSessionsToSheet(startMs: number, endMs: number, options?: { excludeCountry?: string }): Promise<{ exported: number; lastExportedAt: number }> {
  if (!SHEET_ID) throw new Error('SHEET_ID not configured');
  const sheets = await getSheetsClient();

  const watermarkRef = firestore.collection('analyticsExports').doc('sheets');
  const watermarkSnap = await watermarkRef.get();
  const prevExportedAt = watermarkSnap.exists ? (watermarkSnap.get('lastExportedAt') as FirebaseFirestore.Timestamp | null)?.toMillis?.() || 0 : 0;

  const effectiveStart = Math.max(startMs || 0, prevExportedAt || 0);

  const results: any[][] = [];
  let lastSeen = effectiveStart;
  const PAGE = 200; // smaller page to lower memory
  const APPEND_CHUNK = 200; // append to Sheets in chunks

  let queryRef = firestore.collection('adventureSessions').orderBy('lastActivityAt').startAfter(Timestamp.fromMillis(effectiveStart)).limit(PAGE);

  while (true) {
    const snap = await queryRef.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const data = doc.data() as unknown as AdventureSessionDoc;
      const lastAt = (data.lastActivityAt || data.updatedAt || data.createdAt)?.toMillis?.() || 0;
      if (endMs && lastAt > endMs) {
        lastSeen = Math.max(lastSeen, lastAt);
        continue;
      }

      const uid = data.userId;
      const profile = await getUserProfile(uid);

      // Optional exclusion by country
      if (options?.excludeCountry) {
        const ex = options.excludeCountry.trim().toLowerCase();
        const userCountry = (profile.country || '').trim().toLowerCase();
        const userCountryCode = (profile.countryCode || '').trim().toLowerCase();
        // Treat 'India' and 'IN' as matches
        const isExcluded = userCountry === ex || userCountryCode === ex || (ex === 'india' && (userCountryCode === 'in'));
        if (isExcluded) {
          lastSeen = Math.max(lastSeen, lastAt);
          continue;
        }
      }

      const countryLabel = (profile.country || profile.countryCode || '') || '';
      const { row, firstTs, lastTs } = buildRow(doc.id, uid, profile.username, countryLabel, data);

      // Fill async counts
      try {
        const [images, dailyCompleted] = await Promise.all([
          countImagesForSession(uid, data.adventureId, firstTs, lastTs),
          countDailyQuestsCompleted(uid),
        ]);
        row[12] = images; // # Images generated
        row[10] = dailyCompleted; // #daily_quests_completed
      } catch {}

      results.push(row);
      lastSeen = Math.max(lastSeen, lastAt);
    }

    const lastDoc = snap.docs[snap.docs.length - 1];
    // Append periodically to keep memory low
    if (results.length >= APPEND_CHUNK) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_TAB}!A2`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: results.splice(0, results.length) },
      });
    }

    queryRef = firestore
      .collection('adventureSessions')
      .orderBy('lastActivityAt')
      .startAfter(lastDoc.get('lastActivityAt'))
      .limit(PAGE);
  }

  if (results.length > 0) {
    // Append in one batch
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!A2`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: results },
    });
  }

  // Update watermark
  await watermarkRef.set({ lastExportedAt: Timestamp.fromMillis(lastSeen) }, { merge: true });

  return { exported: results.length, lastExportedAt: lastSeen };
}

export const exportAnalytics = onRequest({ cors: true, region: 'us-central1', secrets: ['SHEET_ID','SHEET_TAB','TIMEZONE'], timeoutSeconds: 540, memory: '512MiB' }, async (req, res) => {
  try {
    // Optional auth: allow only signed-in; for now, accept admin-only if provided
    // If you want to enforce, uncomment verifyIdToken and check custom claims
    const mode = String(req.query.mode || 'incremental');
    const startAt = req.query.startAt ? Date.parse(String(req.query.startAt)) : 0;
    const endAt = req.query.endAt ? Date.parse(String(req.query.endAt)) : 0;

    const startMs = mode === 'backfill' ? startAt : 0;
    const endMs = endAt || 0;

    const exclude = (req.query.excludeCountry ? String(req.query.excludeCountry) : '').trim();
    const { exported, lastExportedAt } = await exportSessionsToSheet(startMs, endMs, { excludeCountry: exclude || undefined });
    res.json({ success: true, exported, lastExportedAt });
  } catch (err) {
    console.error('exportAnalytics failed:', err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

export const exportAnalyticsHourly = onSchedule({ schedule: 'every 60 minutes', timeZone: TIMEZONE, secrets: ['SHEET_ID','SHEET_TAB','TIMEZONE'] }, async () => {
  try {
    await exportSessionsToSheet(0, 0);
  } catch (err) {
    console.error('exportAnalyticsHourly failed:', err);
  }
});
