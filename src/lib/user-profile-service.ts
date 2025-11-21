import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { normalizeInterests } from '@/lib/interest-extractor';

const MAX_INTERESTS = 20;
const WRITE_THROTTLE_MS = 3 * 60 * 1000; // 3 minutes

function dedupeAndCap(existing: string[] = [], incoming: string[] = []): string[] {
  const set = new Set<string>([...existing, ...incoming].map(s => s.toLowerCase().trim()).filter(Boolean));
  return Array.from(set).slice(0, MAX_INTERESTS);
}

function computeUpdatedWeights(
  prev: Record<string, number> = {},
  added: string[],
  increment: number
): Record<string, number> {
  const next = { ...prev };
  for (const k of added) {
    next[k] = Math.max(0, Math.round((next[k] || 0) + increment));
  }
  return next;
}

export async function upsertUserInterests(params: {
  userId: string;
  newInterests: string[];
  weightIncrement?: number;
  force?: boolean; // bypass local throttle
}): Promise<void> {
  const { userId, newInterests, weightIncrement = 1, force = false } = params;
  if (!userId || !Array.isArray(newInterests) || newInterests.length === 0) return;

  // Local throttle to avoid excessive writes
  try {
    if (!force) {
      const key = 'litkraft_last_interest_write_ms';
      const last = Number(localStorage.getItem(key) || '0');
      const now = Date.now();
      if (now - last < WRITE_THROTTLE_MS) {
        return;
      }
      localStorage.setItem(key, String(now));
    }
  } catch {}

  const normalized = normalizeInterests(newInterests);
  if (normalized.length === 0) return;

  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    // Create minimal doc with interests
    const interests = dedupeAndCap([], normalized);
    const weights = computeUpdatedWeights({}, interests, weightIncrement);
    await setDoc(userRef, { interests, interestWeights: weights }, { merge: true });
    return;
  }

  const data = snap.data() as any;
  const existing: string[] = Array.isArray(data?.interests) ? data.interests : [];
  const merged = dedupeAndCap(existing, normalized);
  const added = merged.filter(x => !existing.includes(x));
  if (added.length === 0) return;

  const weightsPrev = (data?.interestWeights || {}) as Record<string, number>;
  const weightsNext = computeUpdatedWeights(weightsPrev, added, weightIncrement);

  await updateDoc(userRef, {
    interests: merged,
    interestWeights: weightsNext,
  });
}


