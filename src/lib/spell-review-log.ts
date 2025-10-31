// Lightweight client-side log for spelling review items by local calendar date
// Used to power the pet page word-list count and date-scoped review modal

export type SpellReviewLogItem = {
  word: string;
  firstTryCorrect: boolean;
  prefilledIndexes?: number[];
  // future-ready: allow emojis or metadata if needed
  emoji?: string;
};

type DateKey = string; // YYYY-MM-DD in local timezone

type SpellReviewLog = Record<DateKey, Record<string, SpellReviewLogItem>>; // de-duped by lowercased word

const STORAGE_KEY = 'readingapp_spell_review_log_v1';

export function getLocalDateKey(date: Date = new Date()): DateKey {
  // Format YYYY-MM-DD in local timezone without relying on locale quirks
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function loadLog(): SpellReviewLog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as SpellReviewLog;
  } catch {}
  return {};
}

function saveLog(log: SpellReviewLog): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {}
}

export function addSpellReviewEntry(item: SpellReviewLogItem, when: Date = new Date()): void {
  const key = getLocalDateKey(when);
  const log = loadLog();
  const bucket = log[key] || {};
  const normalized = item.word.trim().toLowerCase();

  // De-duplicate by word per day; if an entry exists, merge to keep firstTryCorrect=true if any attempt was first-try correct
  const existing = bucket[normalized];
  const merged: SpellReviewLogItem = existing
    ? {
        ...existing,
        firstTryCorrect: Boolean(existing.firstTryCorrect || item.firstTryCorrect),
        prefilledIndexes: existing.prefilledIndexes ?? item.prefilledIndexes,
        emoji: existing.emoji ?? item.emoji,
      }
    : { ...item };

  bucket[normalized] = merged;
  log[key] = bucket;
  saveLog(log);
}

export function getEntriesForDate(key: DateKey): SpellReviewLogItem[] {
  const log = loadLog();
  const bucket = log[key] || {};
  return Object.values(bucket);
}

export function getUniqueFirstTryCountForDate(key: DateKey): number {
  const entries = getEntriesForDate(key);
  return entries.filter(e => e.firstTryCorrect).length;
}

export function getMostRecentDates(limit: number = 7): DateKey[] {
  const log = loadLog();
  const keys = Object.keys(log);
  // sort descending by date string (YYYY-MM-DD lexicographic matches chronological)
  return keys.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)).slice(0, limit);
}


