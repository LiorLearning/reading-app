// Line Reading Service (additive, no changes to existing word-reading flow)
// Provides: deriving a 3–5 word target line around a target word, normalization/tokenization,
// correctness evaluation by reusing aiService.evaluateReadingPronunciation, and a realtime
// helper to compute the current target word index from partial transcripts.

import { aiService } from './ai-service';

export type LineWordStatus = 'correct' | 'missed';

export interface WordAlignment {
  target: string;
  status: LineWordStatus;
  // Placeholders for future ASR-rich data if/when available
  asrWord?: string;
  confidence?: number;
  startMs?: number;
  endMs?: number;
}

export interface ReadingLineSpec {
  id?: string;
  targetSentence: string;
  targetLine: string;
  targetWord?: string;
  tokens: string[];
  normalizedTokens: string[];
}

export interface LineReadingResult {
  targetLine: string;
  alignments: WordAlignment[];
  correctCount: number;
  totalTargetWords: number;
  accuracy: number; // 0..1
}

// -------------------------------
// Public API
// -------------------------------

/**
 * Build a ReadingLineSpec from a sentence and a target word by selecting a 3–5 word window
 * around the target word occurrence. If the sentence is too short, falls back to the whole sentence.
 */
export function buildReadingLineSpecFromSentence(
  sentence: string,
  targetWord: string,
  options?: {
    preferredLength?: number; // default 5
    minLength?: number; // default 3
    maxLength?: number; // default 7 (soft cap)
    occurrenceIndex?: number; // if target word appears multiple times, pick this 0-based occurrence
  }
): ReadingLineSpec {
  const preferredLength = Math.max(3, options?.preferredLength ?? 5);
  const minLength = Math.max(3, options?.minLength ?? 3);
  const maxLength = Math.max(preferredLength, options?.maxLength ?? 7);
  const occurrenceIndex = Math.max(0, options?.occurrenceIndex ?? 0);

  const originalTokens = tokenizeSentencePreservingSurface(sentence);
  const cleanedTokens = originalTokens.map(stripPunctuationForMatching);
  const lowerCleaned = cleanedTokens.map((w) => w.toLowerCase());
  const targetLower = stripPunctuationForMatching(targetWord).toLowerCase();

  // Locate the Nth occurrence of target word (clean, case-insensitive)
  let foundIndex = -1;
  let seen = 0;
  for (let i = 0; i < lowerCleaned.length; i++) {
    if (!lowerCleaned[i]) continue;
    if (lowerCleaned[i] === targetLower) {
      if (seen === occurrenceIndex) {
        foundIndex = i;
        break;
      }
      seen++;
    }
  }

  // If not found, pick a central 3–5 word slice as a fallback
  if (foundIndex === -1) {
    const sliceLen = Math.min(Math.max(minLength, Math.min(preferredLength, originalTokens.length)), maxLength);
    const start = 0;
    const end = Math.min(originalTokens.length, sliceLen);
    const targetLine = originalTokens.slice(start, end).join(' ').trim();
    const tokens = originalTokens.slice(start, end).map((t) => stripOuterPunctuation(t)).filter(Boolean);
    return {
      targetSentence: sentence,
      targetLine,
      targetWord,
      tokens,
      normalizedTokens: tokens.map(normalizeForComparison)
    };
  }

  // Compute window around found index
  const windowHalf = Math.floor((preferredLength - 1) / 2);
  let start = Math.max(0, foundIndex - windowHalf);
  let end = start + preferredLength;
  if (end > originalTokens.length) {
    end = originalTokens.length;
    start = Math.max(0, end - preferredLength);
  }
  // Ensure min length
  if (end - start < minLength) {
    end = Math.min(originalTokens.length, start + minLength);
  }
  // Soft cap
  if (end - start > maxLength) {
    end = start + maxLength;
  }

  const chosenSurfaceTokens = originalTokens.slice(start, end);
  const targetLine = chosenSurfaceTokens.join(' ').trim();
  const tokens = chosenSurfaceTokens.map((t) => stripOuterPunctuation(t)).filter(Boolean);

  return {
    targetSentence: sentence,
    targetLine,
    targetWord,
    tokens,
    normalizedTokens: tokens.map(normalizeForComparison)
  };
}

/**
 * Evaluate a student's reading of the provided target line by reusing the existing
 * word-reading pronunciation evaluator for each target token. Case and punctuation
 * are already ignored by that evaluator via its prompt; extra words in the transcript
 * are allowed and do not count as correct by themselves.
 */
export async function evaluateLineReading(
  spec: ReadingLineSpec,
  studentTranscript: string
): Promise<LineReadingResult> {
  const alignments: WordAlignment[] = [];
  let correctCount = 0;

  // Sequentially evaluate each target token against the student's full transcript
  for (const targetToken of spec.tokens) {
    // Reuse the existing evaluator which handles extra words robustly
    const result = await aiService.evaluateReadingPronunciation(targetToken, studentTranscript);
    const status: LineWordStatus = result.status === 'correct' ? 'correct' : 'missed';
    if (status === 'correct') correctCount++;

    alignments.push({
      target: targetToken,
      status
    });
  }

  const totalTargetWords = spec.tokens.length;
  const accuracy = totalTargetWords > 0 ? correctCount / totalTargetWords : 0;

  return {
    targetLine: spec.targetLine,
    alignments,
    correctCount,
    totalTargetWords,
    accuracy
  };
}

/**
 * Compute the current target word index for live highlighting given a partial transcript.
 * This is a lightweight, monotonic pointer that advances when the next target token appears
 * (case/punctuation-insensitive) in the spoken stream; filler words do not advance the pointer.
 *
 * Returns an index in [0, spec.tokens.length]. spec.tokens.length means all words are done.
 */
export function computeCurrentWordIndex(
  spec: ReadingLineSpec,
  partialTranscript: string
): number {
  const spoken = tokenizeForComparison(partialTranscript);
  if (spoken.length === 0) return 0;

  let idxInSpoken = 0;
  let currentTargetIndex = 0;

  for (let i = 0; i < spec.normalizedTokens.length; i++) {
    const target = spec.normalizedTokens[i];
    let matched = false;
    for (let j = idxInSpoken; j < spoken.length; j++) {
      if (spoken[j] === target) {
        matched = true;
        idxInSpoken = j + 1;
        currentTargetIndex = i + 1;
        break;
      }
    }
    if (!matched) {
      // Could not find this target yet in the spoken sequence; keep pointer here
      break;
    }
  }

  return currentTargetIndex;
}

// -------------------------------
// Utilities
// -------------------------------

function stripOuterPunctuation(token: string): string {
  if (!token) return '';
  // Keep inner apostrophes (don't -> dont) only if needed; per spec we ignore punctuation,
  // so we remove apostrophes as well to align with comparison.
  const trimmed = token.trim();
  // Remove leading/trailing punctuation and then remove any remaining apostrophes
  const withoutOuter = trimmed.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
  return withoutOuter.replace(/'/g, '');
}

function stripPunctuationForMatching(token: string): string {
  if (!token) return '';
  return token.replace(/[^A-Za-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeForComparison(token: string): string {
  return stripPunctuationForMatching(token).toLowerCase();
}

function tokenizeSentencePreservingSurface(sentence: string): string[] {
  if (!sentence) return [];
  // Split on whitespace to preserve approximate surface tokens, then trim
  return sentence.split(/\s+/).filter((t) => t && t.trim().length > 0);
}

function tokenizeForComparison(text: string): string[] {
  if (!text) return [];
  return normalizeForComparison(text).split(/\s+/).filter(Boolean);
}


