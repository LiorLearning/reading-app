"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportAnalyticsHourly = exports.exportAnalytics = exports.generateFluxSchnell = exports.uploadImagen = exports.uploadImage = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const googleapis_1 = require("googleapis");
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
        await file.makePublic();
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
const SHEET_ID = process.env.SHEET_ID || process.env.GSHEET_ID || '';
const SHEET_TAB = process.env.SHEET_TAB || 'Analytics';
const TIMEZONE = process.env.TIMEZONE || 'Asia/Kolkata';
async function getSheetsClient() {
    const auth = await googleapis_1.google.auth.getClient({ scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    return googleapis_1.google.sheets({ version: 'v4', auth });
}
function toTzString(ms) {
    if (!ms || Number.isNaN(ms))
        return '';
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
    }
    catch (_a) {
        return new Date(ms).toISOString();
    }
}
function countWords(text) {
    const t = (text || '').trim();
    if (!t)
        return 0;
    return t.split(/\s+/).filter(Boolean).length;
}
async function getUserProfile(uid) {
    try {
        const userDoc = await firestore.collection('users').doc(uid).get();
        const data = userDoc.data();
        const name = ((data === null || data === void 0 ? void 0 : data.username) || '').trim();
        const country = ((data === null || data === void 0 ? void 0 : data.country) || (data === null || data === void 0 ? void 0 : data.countryName) || null);
        const countryCode = ((data === null || data === void 0 ? void 0 : data.countryCode) || (data === null || data === void 0 ? void 0 : data.country_code) || null);
        return { username: name || uid, country, countryCode };
    }
    catch (_a) {
        return { username: uid, country: null, countryCode: null };
    }
}
async function countImagesForSession(uid, adventureId, startMs, endMs) {
    let total = 0;
    // adventureImages (uploaded via CF)
    try {
        const snap = await firestore
            .collection('adventureImages')
            .where('userId', '==', uid)
            .where('adventureId', '==', adventureId)
            .get();
        snap.forEach((d) => {
            var _a, _b;
            const ts = ((_b = (_a = d.get('timestamp')) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) || 0;
            if (!startMs || !endMs || (ts >= startMs && ts <= endMs))
                total += 1;
        });
    }
    catch (_a) { }
    // adventureImageUrls (metadata-only)
    try {
        const snap2 = await firestore
            .collection('adventureImageUrls')
            .where('userId', '==', uid)
            .where('adventureId', '==', adventureId)
            .get();
        snap2.forEach((d) => {
            var _a, _b;
            const ts = ((_b = (_a = d.get('timestamp')) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) || 0;
            if (!startMs || !endMs || (ts >= startMs && ts <= endMs))
                total += 1;
        });
    }
    catch (_b) { }
    return total;
}
async function countDailyQuestsCompleted(uid) {
    try {
        const snap = await firestore.collection('dailyQuests').doc(uid).get();
        if (!snap.exists)
            return 0;
        const data = snap.data();
        const petKeys = Object.keys(data || {}).filter((k) => k !== 'createdAt' && k !== 'updatedAt' && !k.startsWith('_'));
        let completed = 0;
        for (const pet of petKeys) {
            const petObj = data[pet] || {};
            // Find any numeric progress (current activity), treat >=5 as completed
            const entries = Object.entries(petObj).filter(([k, v]) => !k.startsWith('_') && typeof v === 'number');
            const prog = entries.length > 0 ? Number(entries[0][1]) : 0;
            if (prog >= 5)
                completed += 1;
        }
        return completed;
    }
    catch (_a) {
        return 0;
    }
}
function buildRow(sessionId, uid, username, countryLabel, s) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    const messages = Array.isArray(s.chatMessages) ? s.chatMessages : [];
    const userMsgs = messages.filter((m) => (m === null || m === void 0 ? void 0 : m.type) === 'user' && !(m === null || m === void 0 ? void 0 : m.hiddenInChat));
    const firstTs = messages.length > 0 ? Number(((_a = messages[0]) === null || _a === void 0 ? void 0 : _a.timestamp) || 0) : (((_c = (_b = s.createdAt) === null || _b === void 0 ? void 0 : _b.toMillis) === null || _c === void 0 ? void 0 : _c.call(_b)) || 0);
    const lastTs = messages.length > 0 ? Number(((_d = messages[messages.length - 1]) === null || _d === void 0 ? void 0 : _d.timestamp) || 0) : (((_f = (_e = s.lastActivityAt) === null || _e === void 0 ? void 0 : _e.toMillis) === null || _f === void 0 ? void 0 : _f.call(_e)) || ((_h = (_g = s.updatedAt) === null || _g === void 0 ? void 0 : _g.toMillis) === null || _h === void 0 ? void 0 : _h.call(_g)) || 0);
    const durationMin = firstTs && lastTs && lastTs >= firstTs ? Math.round((lastTs - firstTs) / 60000) : 0;
    const userWords = userMsgs.reduce((sum, m) => sum + countWords((m === null || m === void 0 ? void 0 : m.content) || ''), 0);
    const mcq = Array.isArray(s.mcqAnswers) ? s.mcqAnswers : [];
    const attempts = mcq.length;
    const correct = mcq.filter((a) => !!(a === null || a === void 0 ? void 0 : a.isCorrect)).length;
    const incorrect = attempts - correct;
    const uniqueQ = new Set(mcq.map((a) => a === null || a === void 0 ? void 0 : a.questionId)).size;
    const createdStr = toTzString(((_k = (_j = s.createdAt) === null || _j === void 0 ? void 0 : _j.toMillis) === null || _k === void 0 ? void 0 : _k.call(_j)) || firstTs || 0);
    const lastStr = toTzString(((_m = (_l = s.lastActivityAt) === null || _l === void 0 ? void 0 : _l.toMillis) === null || _m === void 0 ? void 0 : _m.call(_l)) || lastTs || 0);
    const stamp = ((_p = (_o = s.lastActivityAt) === null || _o === void 0 ? void 0 : _o.toMillis) === null || _p === void 0 ? void 0 : _p.call(_o)) || lastTs || 0;
    const pets = s.petId ? 1 : 0;
    const petActions = Number(s.adventurePromptCount || 0);
    const petsUsed = pets; // current model supports one pet per session
    // placeholders (phase 1)
    const imagesGenerated = 0; // will be filled after async count
    const imageGenSeconds = '';
    const row = [
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
    return { row, firstTs, lastTs };
}
async function exportSessionsToSheet(startMs, endMs, options) {
    var _a, _b, _c, _d;
    if (!SHEET_ID)
        throw new Error('SHEET_ID not configured');
    const sheets = await getSheetsClient();
    const watermarkRef = firestore.collection('analyticsExports').doc('sheets');
    const watermarkSnap = await watermarkRef.get();
    const prevExportedAt = watermarkSnap.exists ? ((_b = (_a = watermarkSnap.get('lastExportedAt')) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) || 0 : 0;
    const effectiveStart = Math.max(startMs || 0, prevExportedAt || 0);
    const results = [];
    let lastSeen = effectiveStart;
    const PAGE = 200; // smaller page to lower memory
    const APPEND_CHUNK = 200; // append to Sheets in chunks
    let queryRef = firestore.collection('adventureSessions').orderBy('lastActivityAt').startAfter(firestore_1.Timestamp.fromMillis(effectiveStart)).limit(PAGE);
    while (true) {
        const snap = await queryRef.get();
        if (snap.empty)
            break;
        for (const doc of snap.docs) {
            const data = doc.data();
            const lastAt = ((_d = (_c = (data.lastActivityAt || data.updatedAt || data.createdAt)) === null || _c === void 0 ? void 0 : _c.toMillis) === null || _d === void 0 ? void 0 : _d.call(_c)) || 0;
            if (endMs && lastAt > endMs) {
                lastSeen = Math.max(lastSeen, lastAt);
                continue;
            }
            const uid = data.userId;
            const profile = await getUserProfile(uid);
            // Optional exclusion by country
            if (options === null || options === void 0 ? void 0 : options.excludeCountry) {
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
            }
            catch (_e) { }
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
    await watermarkRef.set({ lastExportedAt: firestore_1.Timestamp.fromMillis(lastSeen) }, { merge: true });
    return { exported: results.length, lastExportedAt: lastSeen };
}
exports.exportAnalytics = (0, https_1.onRequest)({ cors: true, region: 'us-central1', secrets: ['SHEET_ID', 'SHEET_TAB', 'TIMEZONE'], timeoutSeconds: 540, memory: '512MiB' }, async (req, res) => {
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
    }
    catch (err) {
        console.error('exportAnalytics failed:', err);
        res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
    }
});
exports.exportAnalyticsHourly = (0, scheduler_1.onSchedule)({ schedule: 'every 60 minutes', timeZone: TIMEZONE, secrets: ['SHEET_ID', 'SHEET_TAB', 'TIMEZONE'] }, async () => {
    try {
        await exportSessionsToSheet(0, 0);
    }
    catch (err) {
        console.error('exportAnalyticsHourly failed:', err);
    }
});
//# sourceMappingURL=index.js.map