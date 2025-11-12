import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import OpenAI from 'openai';
import { cn } from '@/lib/utils';
import { playClickSound } from '@/lib/sounds';
import { ttsService, AVAILABLE_VOICES } from '@/lib/tts-service';
import { useTTSSpeaking } from '@/hooks/use-tts-speaking';
import { aiService } from '@/lib/ai-service';
import { useFillInBlanksTutorial } from '@/hooks/use-tutorial';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { Volume2, Square, ChevronRight, Lightbulb, Mic, Loader2 } from 'lucide-react';
import { firebaseSpellboxLogsService } from '@/lib/firebase-spellbox-logs-service';
import { useAuth } from '@/hooks/use-auth';

interface WordPart {
  type: 'text' | 'blank';
  content?: string;
  answer?: string;
}

// Lightweight mic button using the browser Web Speech API (easiest path for dev testing)
const ReadingMicButton: React.FC<{
  targetWord: string;
  onRecognized: (isCorrect: boolean) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onRecordingChange?: (isRecording: boolean, finalText?: string) => void;
  compact?: boolean;
}> = ({ targetWord, onRecognized, onTranscript, onRecordingChange, compact }) => {
  const [isRecording, setIsRecording] = React.useState(false);
  const recognitionRef = React.useRef<any>(null);
  const shouldBeRecordingRef = React.useRef<boolean>(false);
  const aggregateRef = React.useRef<string>('');
  const lastInterimRef = React.useRef<string>('');
  const isTogglingRef = React.useRef<boolean>(false); // prevent rapid double-click races
  const DEBUG_SPEECH = true;
  const debug = (...args: any[]) => { if (DEBUG_SPEECH) console.log('[ReadingMic]', ...args); };
  // OpenAI batch transcription (fallback-to-browser SR for interim/live)
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordedChunksRef = React.useRef<BlobPart[]>([]);
  const useOpenAITranscribe = React.useMemo(() => {
    try { return Boolean(import.meta.env.VITE_OPENAI_API_KEY); } catch { return false; }
  }, []);
  const openaiClient = React.useMemo(() => {
    if (!useOpenAITranscribe) return null;
    try {
      return new OpenAI({
        apiKey: import.meta.env.VITE_OPENAI_API_KEY as string,
        dangerouslyAllowBrowser: true
      });
    } catch {
      return null;
    }
  }, [useOpenAITranscribe]);

  // Fireworks (server-proxied) batch transcription toggle and backend base URL
  const useFireworksTranscribe = React.useMemo(() => {
    try { return Boolean((import.meta as any).env?.VITE_USE_FIREWORKS); } catch { return false; }
  }, []);
  const backendBaseUrl = React.useMemo(() => {
    try {
      const v = ((import.meta as any).env?.VITE_BACKEND_BASE_URL || '') as string;
      return (v && typeof v === 'string') ? v.replace(/\/+$/, '') : '';
    } catch {
      return '';
    }
  }, []);

  // Normalize text for exact comparison per spec (lowercase, keep spaces, strip punctuation)
  const normalize = React.useCallback((s: string) => (s || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim(), []);
  const tokenize = React.useCallback((s: string) => normalize(s).split(/\s+/).filter(Boolean), [normalize]);

  // Note: We intentionally avoid creating a recognizer in an effect to prevent
  // ghost recognizers that auto-restart. The toggle now owns the recognizer lifecycle.

  const handleToggle = React.useCallback(() => {
    // Debounce rapid toggles to avoid engine InvalidStateError races
    if (isTogglingRef.current) return;
    isTogglingRef.current = true;
    setTimeout(() => { isTogglingRef.current = false; }, 350);

    try { ttsService.stop(); } catch {}
    if (isRecording) {
      debug('toggle: stopping recording. recognitionRef exists=', !!recognitionRef.current);
      // If OpenAI recorder active, stop and process
      if (mediaRecorderRef.current) {
        shouldBeRecordingRef.current = false;
        try { mediaRecorderRef.current.stop(); } catch {}
        return;
      }
      const r = recognitionRef.current;
      if (!r) return;
      shouldBeRecordingRef.current = false;
      // Immediately flip UI state and force-stop recognizer; some engines delay onend
      setIsRecording(false);
      try { r.onend = null as any; } catch {}
      try { (r as any).onspeechend = null as any; } catch {}
      try { (r as any).onaudioend = null as any; } catch {}
      try { r.onresult = null as any; } catch {}
      try { r.stop(); debug('called stop()'); } catch (e) { debug('stop() error:', e); }
      try { r.abort(); debug('called abort()'); } catch (e) { debug('abort() error:', e); }
      // On manual stop, surface the full aggregate transcript immediately (include last interim)
      const finalText = `${aggregateRef.current} ${lastInterimRef.current}`.trim();
      try { onTranscript?.(finalText, true); } catch {}
      try { onRecordingChange?.(false, finalText); } catch {}
      try { recognitionRef.current = null; } catch {}
      return;
    }
    debug('toggle: starting recording. creating fresh recognizer');
    aggregateRef.current = '';
    lastInterimRef.current = '';
    shouldBeRecordingRef.current = true;
    try { onRecordingChange?.(true); } catch {}
    // Prefer Fireworks (via backend proxy) when enabled; else OpenAI if key present
    if (useFireworksTranscribe) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        recordedChunksRef.current = [];
        const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mr.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        mr.onstop = async () => {
          setIsRecording(false);
          try { stream.getTracks().forEach(t => t.stop()); } catch {}
          try {
            const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
            const file = new File([blob], 'speech.webm', { type: 'audio/webm' });
            const fd = new FormData();
            fd.append('file', file);
            fd.append('model', 'whisper-v3-turbo');
            fd.append('language', 'en');
            const base = backendBaseUrl || '';
            const url = `https://api.readkraft.com/api/fireworks/transcribe`;
            const resp = await fetch(url, { method: 'POST', body: fd });
            const json: any = await resp.json().catch(() => ({}));
            const text = (json?.text || '').toString();
            try { onTranscript?.(text, true); } catch {}
            try { onRecordingChange?.(false, text); } catch {}
            // quick correctness hint
            try {
              const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
              const words = new Set(norm(text).split(' ').filter(Boolean));
              if (words.has(norm(targetWord))) onRecognized(true);
            } catch {}
          } catch (e) {
            console.error('[ReadingMic] Fireworks transcription failed:', e);
            try { onTranscript?.('', true); } catch {}
            try { onRecordingChange?.(false, ''); } catch {}
          } finally {
            mediaRecorderRef.current = null;
          }
        };
        mr.start(100);
        mediaRecorderRef.current = mr;
        setIsRecording(true);
      }).catch(err => {
        console.warn('[ReadingMic] getUserMedia failed (Fireworks path), falling back to browser SR', err);
        // Fall through to browser SR below
        startBrowserSR();
      });
      return;
    }
    if (useOpenAITranscribe && openaiClient) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        recordedChunksRef.current = [];
        const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mr.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        mr.onstop = async () => {
          setIsRecording(false);
          try { stream.getTracks().forEach(t => t.stop()); } catch {}
          try {
            const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
            const file = new File([blob], 'speech.webm', { type: 'audio/webm' });
            const resp: any = await (openaiClient as any).audio.transcriptions.create({
              file,
              model: 'gpt-4o-mini-transcribe',
              language: 'en',
              temperature: 0
            } as any);
            const text = (resp?.text || '').toString();
            try { onTranscript?.(text, true); } catch {}
            try { onRecordingChange?.(false, text); } catch {}
            // quick correctness hint
            try {
              const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
              const words = new Set(norm(text).split(' ').filter(Boolean));
              if (words.has(norm(targetWord))) onRecognized(true);
            } catch {}
          } catch (e) {
            console.error('[ReadingMic] OpenAI transcription failed:', e);
            try { onTranscript?.('', true); } catch {}
            try { onRecordingChange?.(false, ''); } catch {}
          } finally {
            mediaRecorderRef.current = null;
          }
        };
        mr.start(100);
        mediaRecorderRef.current = mr;
        setIsRecording(true);
      }).catch(err => {
        console.warn('[ReadingMic] getUserMedia failed, falling back to browser SR', err);
        // Fall through to browser SR below
        startBrowserSR();
      });
      return;
    }
    // Otherwise, create a fresh recognizer for every start to avoid stale engine states on some browsers
    const startBrowserSR = () => {
    try {
      const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) return;
      const nr = new SR();
      nr.continuous = true;
      nr.interimResults = true;
      nr.lang = 'en-US';
      nr.onstart = () => {
        debug('nr.onstart');
        setIsRecording(true);
        try { onRecordingChange?.(true, undefined); } catch {}
      };
      const handleEngineStop = () => {
        debug('nr.onend/onspeechend/onaudioend; shouldBeRecording=', shouldBeRecordingRef.current);
        setIsRecording(false);
        // If the engine stops unexpectedly while user intends to record, try to restart
        if (shouldBeRecordingRef.current && recognitionRef.current === nr) {
          setTimeout(() => {
            try {
              debug('nr auto-restart after end');
              nr.start();
            } catch (e) {
              debug('nr auto-restart failed:', e);
            }
          }, 150);
        }
      };
      nr.onend = handleEngineStop;
      (nr as any).onspeechend = handleEngineStop;
      (nr as any).onaudioend = handleEngineStop;
      nr.onresult = (e: any) => {
        try {
          debug('nr.onresult: resultIndex=', e.resultIndex, 'len=', e.results?.length);
          let interim = '';
          let final = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const res = e.results[i];
            const txt = res[0]?.transcript || '';
            if (res.isFinal) final += txt; else interim += txt;
          }
          if (final) {
            aggregateRef.current = `${aggregateRef.current} ${final}`.trim();
          }
          lastInterimRef.current = interim;
          const live = `${aggregateRef.current} ${interim}`.trim();
          if (onTranscript) onTranscript(live, !!final && !interim);
        } catch {}
      };
      nr.onerror = (err: any) => { debug('nr.onerror:', err?.error || err); setIsRecording(false); };
      recognitionRef.current = nr;
      const tryStart = (attempt: number) => {
        try {
          debug('nr.start() attempt', attempt);
          nr.start();
        } catch (e) {
          debug('nr.start() failed attempt', attempt, e);
          if (attempt < 3) {
            const delay = [200, 400, 800][attempt] || 800;
            setTimeout(() => tryStart(attempt + 1), delay);
          }
        }
      };
      tryStart(0);
    } catch {}
    };
    startBrowserSR();
  }, [isRecording]);

  return (
    <Button
      variant="comic"
      size="icon"
      onClick={handleToggle}
      className={cn(
        compact ? 'ml-1 h-8 w-8 rounded-md' : 'ml-2 h-11 w-11 rounded-lg',
        'border-2 border-black bg-white text-foreground shadow-[0_4px_0_rgba(0,0,0,0.6)] transition-transform hover:scale-105',
        isRecording && 'bg-red-500 text-white hover:bg-red-600'
      )}
      title={isRecording ? 'Stop recording' : 'Read this word'}
      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
    >
      {isRecording ? (
        <Square className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      ) : (
        <Mic className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      )}
    </Button>
  );
};

interface SpellBoxProps {
  // Basic props
  word?: string;
  sentence?: string;
  onComplete?: (isCorrect: boolean, userAnswer?: string, attemptCount?: number) => void;
  onSkip?: () => void;
  onNext?: () => void;
  /** Visually highlight the Next chevron with a little finger pointer cue */
  highlightNext?: boolean;
  className?: string;
  isVisible?: boolean;
  /**
   * Render mode for the component. "overlay" keeps the existing full-screen
   * centered experience. "inline" renders only the interactive content so it
   * can be embedded inside other UI (e.g., pet message bubble).
   */
  variant?: 'overlay' | 'inline';
  
  // Enhanced props
  question?: {
    id: number;
    word: string;
    questionText: string;
    correctAnswer: string;
    audio: string;
    explanation: string;
    isReading?: boolean;
    isPrefilled?: boolean;
    prefilledIndexes?: number[];
    topicId?: string; // Added for logging
    aiTutor?: {
      target_word?: string;
      question?: string; // mask like "_ _ p"
      student_entry?: string; // not used from bank; computed at runtime
      topic_to_reinforce?: string;
      spelling_pattern_or_rule?: string;
    };
  };
  
  // Logging props (optional - will use auth hook if not provided)
  userId?: string;
  topicId?: string;
  grade?: string;
  
  // UI options
  showProgress?: boolean;
  totalQuestions?: number;
  currentQuestionIndex?: number;
  showHints?: boolean;
  showExplanation?: boolean;
  
  // Realtime session integration
  sendMessage?: (text: string) => void;
  interruptRealtimeSession?: () => void;

  // Optional delay to enable the Next chevron after a correct answer (ms)
  nextUnlockDelayMs?: number;
  /** When true, enable realtime speech hinting on incorrect attempts (assignment-only) */
  isAssignmentFlow?: boolean;
}

const SpellBox: React.FC<SpellBoxProps> = ({
  // Basic props
  word,
  sentence,
  onComplete,
  onSkip,
  onNext,
  highlightNext = false,
  className,
  isVisible = true,
  variant = 'overlay',
  
  // Enhanced props
  question,
  
  // UI options
  showProgress = false,
  totalQuestions = 1,
  currentQuestionIndex = 0,
  showHints = true,
  showExplanation = true,
  
  // Realtime session integration
  sendMessage,
  interruptRealtimeSession,
  nextUnlockDelayMs = 0
  , isAssignmentFlow = false,
  
  // Logging props
  userId: propUserId,
  topicId: propTopicId,
  grade: propGrade
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [showHint, setShowHint] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [attempts, setAttempts] = useState(0);
  // Unlocks after the first incorrect submit and persists until the question changes
  const [hintUnlocked, setHintUnlocked] = useState(false);
  const [aiHint, setAiHint] = useState<string>('');
  const [isGeneratingHint, setIsGeneratingHint] = useState(false);
  const [canClickNext, setCanClickNext] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [lastSubmittedAnswer, setLastSubmittedAnswer] = useState<string>('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  
  // Get auth context for logging
  const { user, userData } = useAuth();
  
  // Determine effective userId, topicId, and grade for logging
  const effectiveUserId = propUserId || user?.uid || '';
  const effectiveTopicId = propTopicId || question?.topicId || '';
  const effectiveGrade = propGrade || userData?.gradeDisplayName || '';
  
  // Tutorial system integration
  const {
    showTutorial,
    tutorialStep,
    needsFillInBlanksTutorial,
    isFirstTimeAdventurer,
    nextTutorialStep,
    skipTutorial,
  } = useFillInBlanksTutorial();

  // Legacy first-time instruction state (for backward compatibility)
  const [showFirstTimeInstruction, setShowFirstTimeInstruction] = useState(false);
  const [hasShownFirstTimeInstruction, setHasShownFirstTimeInstruction] = useState(false);

  // Determine which word to use (question takes precedence)
  const targetWord = question?.word || word || '';
  const questionText = question?.questionText;
  const questionId = question?.id;
  const isReading = !!question?.isReading;
  
  // Ensure we have a valid sentence for spelling - create fallback if needed
  const ensureSpellingSentence = useCallback((word: string, sentence?: string, questionText?: string): string => {
    const normalize = (s: string) => {
      // First strip HTML tags, then normalize
      const stripped = s.replace(/<[^>]*>/g, '');
      return stripped.toLowerCase().replace(/[^\w\s]/g, '');
    };
    
    const containsWord = (s?: string, checkStrict: boolean = true) => {
      if (!s || !word) return false;
      const normSentence = normalize(s);
      const normWord = normalize(word);
      
      if (checkStrict) {
        // word-boundary style check to avoid partial matches
        const re = new RegExp(`\\b${normWord}\\b`);
        return re.test(normSentence);
      } else {
        // More lenient check for longer passages
        return normSentence.includes(normWord);
      }
    };

    // Prefer questionText only if it truly contains the target word
    if (question && questionText && containsWord(questionText)) {
      return questionText;
    }

    // For full passages (longer content), use more lenient matching
    if (sentence && sentence.length > 100) {
      // // console.log('🔍 SpellBox: Processing long passage for word:', word);
      // First try strict matching
      if (containsWord(sentence, true)) {
        // // console.log('✅ SpellBox: Found word with strict matching in long passage');
        return sentence;
      }
      // Then try lenient matching for longer passages
      if (containsWord(sentence, false)) {
        // // console.log('✅ SpellBox: Found word with lenient matching in long passage');
        return sentence;
      }
      // Last attempt: extract sentence containing the word
      const sentences = sentence.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
      for (const sent of sentences) {
        if (containsWord(sent, false)) {
          // // console.log('✅ SpellBox: Found word in extracted sentence:', sent);
          return sent;
        }
      }
      // // console.log('❌ SpellBox: Could not find word in long passage');
    } else {
      // For shorter content, use strict matching
      if (sentence && containsWord(sentence, true)) {
        return sentence;
      }
    }

    // Fallback: synthesize a simple sentence that definitely includes the word
    if (word) {
      return `Let's spell this word together: ${word}`;
    }

    // Final fallback
    return "Let's spell this word together!";
  }, [question]);

  // Get the working sentence - this ensures we always have something to work with
  const workingSentence = ensureSpellingSentence(targetWord, sentence, questionText);
  
  // Debug: Check if target word is found in working sentence
  const wordFoundInSentence = workingSentence && targetWord && 
    workingSentence.toLowerCase().includes(targetWord.toLowerCase());
  // // console.log(`🔍 SpellBox: Target word "${targetWord}" found in sentence: ${wordFoundInSentence}`);
  
  if (!wordFoundInSentence && targetWord && workingSentence) {
    console.error(`❌ SpellBox CRITICAL: Target word "${targetWord}" NOT found in sentence: "${workingSentence}"`);
  }
  
  // Get audio text - just the target word for spelling
  const audioText = targetWord;

  
  const explanation = question?.explanation;

  // Parse the word into parts (text and blanks)
  const parseWord = useCallback((word: string): WordPart[] => {
    // console.log('🔤 SPELLBOX parseWord called:', {
    //   word,
    //   isPrefilled: question?.isPrefilled,
    //   prefilledIndexes: question?.prefilledIndexes
    // });
    
    // Reading mode: always display the full word (ignore any prefilled/blanks)
    if (isReading) {
      return [
        { type: 'text', content: word.toUpperCase() }
      ];
    }
    
    // Check if this question has prefilled characters
    if (question?.isPrefilled && question?.prefilledIndexes && question.prefilledIndexes.length > 0) {
      // console.log('🔤 SPELLBOX: Using prefilled mode');
      const parts: WordPart[] = [];
      const upperWord = word.toUpperCase();
      const prefilledSet = new Set(question.prefilledIndexes);
      
      let currentTextPart = '';
      let currentBlankPart = '';
      
      for (let i = 0; i < upperWord.length; i++) {
        const char = upperWord[i];
        const isPrefilled = prefilledSet.has(i);
        
        // console.log(`🔤 SPELLBOX: Processing char ${i}: "${char}" (prefilled: ${isPrefilled})`);
        
        if (isPrefilled) {
          // If we have accumulated blank characters, add them as a blank part
          if (currentBlankPart) {
            parts.push({ type: 'blank', answer: currentBlankPart });
            // console.log(`🔤 SPELLBOX: Added blank part: "${currentBlankPart}"`);
            currentBlankPart = '';
          }
          // Add this character to the text part
          currentTextPart += char;
        } else {
          // If we have accumulated text characters, add them as a text part
          if (currentTextPart) {
            parts.push({ type: 'text', content: currentTextPart });
            // console.log(`🔤 SPELLBOX: Added text part: "${currentTextPart}"`);
            currentTextPart = '';
          }
          // Add this character to the blank part
          currentBlankPart += char;
        }
      }
      
      // Add any remaining parts
      if (currentTextPart) {
        parts.push({ type: 'text', content: currentTextPart });
        // console.log(`🔤 SPELLBOX: Added final text part: "${currentTextPart}"`);
      }
      if (currentBlankPart) {
        parts.push({ type: 'blank', answer: currentBlankPart });
        // console.log(`🔤 SPELLBOX: Added final blank part: "${currentBlankPart}"`);
      }
      
      // console.log('🔤 SPELLBOX: Final parts array:', parts);
      // console.log('🔤 SPELLBOX: Expected display:', parts.map(p => 
      //   p.type === 'text' ? p.content : '_'.repeat(p.answer?.length || 0)
      // ).join(''));
      
      return parts;
    }
    
    // Default behavior: make the entire word a blank to spell
    return [
      { type: 'blank', answer: word.toUpperCase() }
    ];
  }, [question, isReading]);

  // Live transcription for reading mode
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [liveTranscriptFinal, setLiveTranscriptFinal] = useState<boolean>(false);
  const [isRecordingReading, setIsRecordingReading] = useState<boolean>(false);
  const [lockedTranscript, setLockedTranscript] = useState<string>('');
  const [readingMismatchedIndices, setReadingMismatchedIndices] = useState<number[]>([]);

  // Helper function to get the expected length for user input (excluding prefilled characters)
  const getExpectedUserInputLength = useCallback((): number => {
    const expectedLength = question?.isPrefilled && question?.prefilledIndexes 
      ? targetWord.length - question.prefilledIndexes.length 
      : targetWord.length;
    
    // console.log('🔤 SPELLBOX getExpectedUserInputLength:', {
    //   targetWordLength: targetWord.length,
    //   prefilledCount: question?.prefilledIndexes?.length || 0,
    //   expectedUserInputLength: expectedLength,
    //   isPrefilled: question?.isPrefilled
    // });
    
    return expectedLength;
  }, [question, targetWord]);

  const parts = parseWord(targetWord);
  const totalBlanks = parts.filter(part => part.type === 'blank').length;
  const correctlySpelledWords = isCorrect ? totalBlanks : 0;
  
  // Generate question_blank format like "_ _ T" from parts array
  const generateQuestionBlank = useCallback((parts: WordPart[]): string => {
    return parts.map(part => {
      if (part.type === 'blank') {
        // Replace each blank character with an underscore
        return '_'.repeat(part.answer?.length || 0);
      } else {
        // Show the text content as-is
        return part.content || '';
      }
    }).join(' '); // Join with spaces for readability
  }, []);
  
  // console.log('🧩 SpellBox Parts Debug:', {
  //   targetWord,
  //   parts,
  //   totalBlanks,
  //   partsLength: parts.length
  // });

  // Debug: Log component initialization with prefilled info
  React.useEffect(() => {
    if (question) {
      // console.log('🔤 SPELLBOX COMPONENT INITIALIZED:', {
      //   targetWord,
      //   isPrefilled: question.isPrefilled,
      //   prefilledIndexes: question.prefilledIndexes,
      //   questionId: question.id,
      //   expectedUserInputLength: getExpectedUserInputLength(),
      //   totalParts: parts.length,
      //   textParts: parts.filter(p => p.type === 'text').length,
      //   blankParts: parts.filter(p => p.type === 'blank').length
      // });
    }
  }, [question, targetWord, parts, getExpectedUserInputLength]);

  // Compute the cumulative blank offset up to a given blank part index
  const getBlankBaseIndexForPart = useCallback((allParts: WordPart[], targetPartIndex: number): number => {
    let offset = 0;
    for (let i = 0; i < targetPartIndex; i++) {
      const p = allParts[i] as any;
      if (p && p.type === 'blank') {
        offset += (p.answer?.length || 0);
      }
    }
    return offset;
  }, []);

  // Check if word is complete
  const isWordComplete = useCallback((answer: string, expectedLength: number): boolean => {
    return answer.length === expectedLength && !answer.includes(' ');
  }, []);

  // Check if word is correct
  const isWordCorrect = useCallback((answer: string, correctAnswer: string): boolean => {
    return answer.toUpperCase() === correctAnswer.toUpperCase();
  }, []);

  // Check if word is incorrect (complete but wrong)
  const isWordIncorrect = useCallback((answer: string, correctAnswer: string, expectedLength: number): boolean => {
    return isWordComplete(answer, expectedLength) && !isWordCorrect(answer, correctAnswer);
  }, [isWordComplete, isWordCorrect]);

  // Helper function to reconstruct the complete word from user input and prefilled characters
  const reconstructCompleteWord = useCallback((userInput: string): string => {
    if (isReading || !question?.isPrefilled || !question?.prefilledIndexes) {
      // console.log('🔤 SPELLBOX reconstructCompleteWord: Using default mode, returning userInput as-is:', userInput);
      return userInput;
    }
    
    const upperWord = targetWord.toUpperCase();
    const prefilledSet = new Set(question.prefilledIndexes);
    let result = '';
    let userInputIndex = 0;
    
    // console.log('🔤 SPELLBOX reconstructCompleteWord: Starting reconstruction:', {
    //   userInput,
    //   targetWord: upperWord,
    //   prefilledIndexes: question.prefilledIndexes
    // });
    
    for (let i = 0; i < upperWord.length; i++) {
      if (prefilledSet.has(i)) {
        // Use prefilled character
        result += upperWord[i];
        // console.log(`🔤 SPELLBOX: Position ${i}: Using prefilled "${upperWord[i]}"`);
      } else {
        // Use user input character (or empty if not provided). Treat space as empty.
        const rawChar = userInput[userInputIndex] || '';
        const userChar = rawChar === ' ' ? '' : rawChar;
        result += userChar;
        // console.log(`🔤 SPELLBOX: Position ${i}: Using user input "${userChar}" (userInputIndex: ${userInputIndex})`);
        userInputIndex++;
      }
    }
    
    // console.log('🔤 SPELLBOX reconstructCompleteWord: Final result:', result);
    return result;
  }, [question, targetWord, isReading]);

  // Helper function to check if user input is complete (all blank positions filled)
  const isUserInputComplete = useCallback((userInput: string): boolean => {
    const expectedLength = getExpectedUserInputLength();
    const isComplete = userInput.length === expectedLength && !userInput.includes(' ');
    
    // console.log('🔤 SPELLBOX isUserInputComplete:', {
    //   userInput,
    //   userInputLength: userInput.length,
    //   expectedLength,
    //   isComplete,
    //   hasSpaces: userInput.includes(' ')
    // });
    
    return isComplete;
  }, [getExpectedUserInputLength]);

  // Helper function to get user input character at a specific blank position
  const getUserInputAtBlankIndex = useCallback((blankIndex: number): string => {
    const ch = userAnswer[blankIndex];
    return ch === ' ' ? '' : (ch || '');
  }, [userAnswer]);

  // Helper function to update user input at a specific blank position
  const updateUserInputAtBlankIndex = useCallback((blankIndex: number, newValue: string): string => {
    const expectedLength = getExpectedUserInputLength();
    const baseArray = Array.from({ length: expectedLength }, (_, i) => {
      const existing = userAnswer[i];
      return existing === undefined || existing === '' ? ' ' : existing;
    });
    baseArray[blankIndex] = newValue === '' ? ' ' : newValue;
    return baseArray.join('');
  }, [userAnswer, getExpectedUserInputLength]);

  // Check for first-time instruction display
  const shouldShowFirstTimeInstruction = currentQuestionIndex === 0 && !hasShownFirstTimeInstruction;

  // Check localStorage for first-time instruction
  useEffect(() => {
    const hasSeenInstruction = localStorage.getItem('spellbox-first-time-instruction-seen');
    if (hasSeenInstruction) {
      setHasShownFirstTimeInstruction(true);
    } else if (currentQuestionIndex === 0 && isVisible) {
      // Show instruction for first question and first time
      setShowFirstTimeInstruction(true);
    }
  }, [currentQuestionIndex, isVisible]);

  // Generate stable messageId for TTS (only changes when targetWord changes)
  const messageId = useMemo(() => 
    `krafty-spellbox-audio-${targetWord}-${Date.now()}`, 
    [targetWord]
  );
  const isSpeaking = useTTSSpeaking(messageId);

  // TTS message ID for first-time instruction
  const instructionMessageId = useMemo(() => 
    'spellbox-first-time-instruction',
    []
  );
  const isInstructionSpeaking = useTTSSpeaking(instructionMessageId);

  // Resolve Jessica's voice id once
  const jessicaVoiceId = useMemo(() => {
    const jessica = AVAILABLE_VOICES.find(v => v.name === 'Jessica');
    return jessica?.id || 'cgSgspJ2msm6clMCkdW9';
  }, []);

  // Calculate speaker button position dynamically
  // const calculateSpeakerButtonPosition = useCallback(() => {
  //   const speakerButton = document.getElementById('spellbox-speaker-button');
  //   const spellBoxContainer = document.querySelector('.spellbox-container');
  //   
  //   if (speakerButton && spellBoxContainer) {
  //     const buttonRect = speakerButton.getBoundingClientRect();
  //     const containerRect = spellBoxContainer.getBoundingClientRect();
  //     
  //     const relativeX = buttonRect.left - containerRect.left + (buttonRect.width / 2);
  //     const relativeY = buttonRect.top - containerRect.top + (buttonRect.height / 2);
  //     
  //     setSpeakerButtonPosition({ x: relativeX, y: relativeY });
  //     // console.log('📍 Speaker button position calculated:', { 
  //       x: relativeX, 
  //       y: relativeY,
  //       buttonRect: {
  //         left: buttonRect.left,
  //         top: buttonRect.top,
  //         width: buttonRect.width,
  //         height: buttonRect.height
  //       },
  //       containerRect: {
  //         left: containerRect.left,
  //         top: containerRect.top,
  //         width: containerRect.width,
  //         height: containerRect.height
  //       }
  //     });
  //   } else {
  //     console.warn('⚠️ Speaker button or container not found for positioning');
  //     // Fallback to center-based positioning
  //     setSpeakerButtonPosition({ x: 300, y: 200 }); // Default fallback
  //   }
  // }, []);

  // Generate AI hint for incorrect spelling
  const generateAIHint = useCallback(async (incorrectAttempt: string) => {
    if (!targetWord || !incorrectAttempt) return;
    
    setIsGeneratingHint(true);
    try {
      const hint = await aiService.generateSpellingHint(targetWord, incorrectAttempt);
      setAiHint(hint);
    } catch (error) {
      console.error('Error generating AI hint:', error);
      setAiHint(`That's close! Try thinking about the sounds in "${targetWord}". What letters make those sounds?`);
    } finally {
      setIsGeneratingHint(false);
    }
  }, [targetWord]);

  // Compute mistake indices comparing student entry vs target word, excluding prefilled indices
  const computeMistakes = useCallback((studentEntry: string, target: string): number[] => {
    const mistakes: number[] = [];
    const maxIndex = Math.min(studentEntry.length, target.length);
    const prefilledSet = new Set<number>(question?.prefilledIndexes || []);
    for (let i = 0; i < maxIndex; i++) {
      if (prefilledSet.has(i)) continue;
      const s = (studentEntry[i] || '').toUpperCase();
      const t = (target[i] || '').toUpperCase();
      if (s && t && s !== t) {
        mistakes.push(i);
      }
    }
    return mistakes;
  }, [question?.prefilledIndexes]);

  // Confetti celebration function
  const triggerConfetti = useCallback(() => {
    // Create a burst of confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
      zIndex: 2147483647
    });
    
    // Add a second burst with different settings
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#FF6B6B', '#4ECDC4', '#45B7D1'],
        zIndex: 2147483647
      });
    }, 250);
    
    // Add a third burst from the other side
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#FFD700', '#96CEB4', '#FFEAA7'],
        zIndex: 2147483647
      });
    }, 400);
  }, []);

  // Handle first-time instruction completion
  const handleFirstTimeInstructionComplete = useCallback(() => {
    setShowFirstTimeInstruction(false);
    setHasShownFirstTimeInstruction(true);
    localStorage.setItem('spellbox-first-time-instruction-seen', 'true');
    
    // Stop instruction audio if playing
    if (isInstructionSpeaking) {
      ttsService.stop();
    }
  }, [isInstructionSpeaking]);

  // Play instruction audio after waiting for any current TTS to complete
  const playInstructionAudio = useCallback(async () => {
    // console.log('🎵 INSTRUCTION AUDIO: Checking if TTS is currently speaking...');
    
    // Check if TTS is currently speaking
    if (ttsService.getIsSpeaking()) {
      // console.log('🎵 INSTRUCTION AUDIO: TTS is speaking, waiting for completion...');
      const currentMessageId = ttsService.getCurrentSpeakingMessageId();
      // console.log('🎵 INSTRUCTION AUDIO: Current speaking message ID:', currentMessageId);
      
      // Create a promise that resolves when current TTS finishes (with timeout)
      const waitForTTSComplete = new Promise<void>((resolve) => {
        let attempts = 0;
        const maxAttempts = 50; // 10 seconds maximum wait (50 * 200ms)
        
        const checkTTSStatus = () => {
          attempts++;
          
          if (!ttsService.getIsSpeaking()) {
            // console.log('🎵 INSTRUCTION AUDIO: TTS completed, ready to play instruction');
            resolve();
          } else if (attempts >= maxAttempts) {
            console.warn('🎵 INSTRUCTION AUDIO: Timeout waiting for TTS completion, proceeding anyway');
            resolve();
          } else {
            // Check again in 200ms
            setTimeout(checkTTSStatus, 200);
          }
        };
        checkTTSStatus();
      });
      
      await waitForTTSComplete;
    }
    
    // Final check to make sure no new TTS started while we were waiting
    if (ttsService.getIsSpeaking()) {
      // console.log('🎵 INSTRUCTION AUDIO: New TTS started while waiting, skipping instruction audio');
      return;
    }
    
    // console.log('🎵 INSTRUCTION AUDIO: Playing instruction audio');
    const instructionText = "Fill in the blank with the correct spelling using the audio";
    
    try {
      await ttsService.speak(instructionText, {
        stability: 0.7,
        similarity_boost: 0.9,
        speed: 0.8,
        messageId: instructionMessageId,
        voice: jessicaVoiceId
      });
    } catch (error) {
      console.error('🎵 INSTRUCTION AUDIO: Error playing instruction audio:', error);
    }
  }, [instructionMessageId]);

  // Play word audio using ElevenLabs TTS
  const playWordAudio = useCallback(async () => {
    // console.log('🎵 SPELLBOX SPEAKER BUTTON: Click detected', {
    //   audioText,
    //   targetWord,
    //   messageId,
    //   isSpeaking
    // });
    
    playClickSound();
    
    if (isSpeaking) {
      // console.log('🎵 SPELLBOX SPEAKER BUTTON: Stopping current speech');
      ttsService.stop();
    } else {
      // console.log('🎵 SPELLBOX SPEAKER BUTTON: Starting speech with ElevenLabs TTS at 0.7x speed');
      await ttsService.speak(audioText, {
        stability: 0.7,
        similarity_boost: 0.9,
        speed: 0.7,  // Set speed to 0.7x for SpellBox words
        messageId: messageId,
        voice: jessicaVoiceId
      });
    }
  }, [audioText, targetWord, messageId, isSpeaking]);

  // Gate the Next chevron after a correct answer if a delay is requested
  useEffect(() => {
    let timer: number | undefined;
    if (isCorrect) {
      if (nextUnlockDelayMs > 0) {
        setCanClickNext(false);
        timer = window.setTimeout(() => setCanClickNext(true), nextUnlockDelayMs);
      } else {
        setCanClickNext(true);
      }
    } else {
      setCanClickNext(false);
    }
    return () => { if (timer) window.clearTimeout(timer); };
  }, [isCorrect, nextUnlockDelayMs]);

  // Handle answer change (no auto-evaluation; feedback only after submit)
  const handleAnswerChange = useCallback((newAnswer: string) => {
    // console.log('🔤 SPELLBOX handleAnswerChange called:', {
    //   newAnswer,
    //   previousUserAnswer: userAnswer,
    //   targetWord
    // });
    
    setUserAnswer(newAnswer);
    setHasSubmitted(false);
    setIsComplete(isUserInputComplete(newAnswer));
    setIsCorrect(false);
  }, [isUserInputComplete]);

  // Submit current attempt via chevron/Enter
  const handleSubmitAttempt = useCallback(async () => {
    // Enable submit once any letter is entered (non-space)
    const canSubmit = isReading
      ? ((lockedTranscript || '').trim().length > 0)
      : (userAnswer || '').split('').some(ch => ch && ch !== ' ');
    if (isReading) {
      console.log('[SpellBox] Submit clicked (reading mode). lockedTranscript.len=', (lockedTranscript || '').length, 'liveTranscript.len=', (liveTranscript || '').length, 'canSubmit=', canSubmit);
    }
    if (!canSubmit) {
      return;
    }
    setIsEvaluating(true);
    try {
      let completeWord = '';
      let correct = false;
      let latestReadingMismatches: number[] = [];
      if (isReading) {
        completeWord = (lockedTranscript || liveTranscript || '').trim();
        try {
          const evalResult = await aiService.evaluateReadingPronunciation(targetWord, completeWord);
          correct = evalResult.status === 'correct';
          latestReadingMismatches = Array.isArray(evalResult.mismatchedIndices) ? evalResult.mismatchedIndices : [];
          setReadingMismatchedIndices(latestReadingMismatches);
          console.log('[SpellBox] Evaluation (reading via AI). completeWord=', completeWord, 'result=', evalResult);
        } catch (e) {
          // Fallback: retain old behavior if AI fails
          const normalize = (s: string) => (s || '')
            .toLowerCase()
            .replace(/[^a-z\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          const tokenSet = new Set((normalize(completeWord)).split(/\s+/).filter(Boolean));
          correct = tokenSet.has(normalize(targetWord));
          latestReadingMismatches = [];
          setReadingMismatchedIndices(latestReadingMismatches);
          console.warn('[SpellBox] AI evaluation failed, fallback used. correct=', correct);
        }
      } else {
        completeWord = reconstructCompleteWord(userAnswer);
        correct = isWordCorrect(completeWord, targetWord);
      }
      setHasSubmitted(true);
      setIsCorrect(correct);
      // Record submitted answer for change detection on subsequent submits
      const changedSinceLast = completeWord !== lastSubmittedAnswer;
      setLastSubmittedAnswer(completeWord);
      
      // Log attempt to Firestore
      // Check for valid non-empty strings
      const hasValidUserId = effectiveUserId && effectiveUserId.trim() !== '';
      const hasValidTopicId = effectiveTopicId && effectiveTopicId.trim() !== '';
      const hasValidQuestion = !!question && !!question.id;
      
      if (hasValidUserId && hasValidTopicId && hasValidQuestion) {
        
        // Only log if answer changed (to avoid duplicate logs for same attempt)
        if (changedSinceLast || correct) {
          // Always use targetWord (full word) as primary source, fallback to question.correctAnswer if targetWord is empty
          // targetWord is more reliable as it contains the full word (e.g., "BAG"), not just a single letter
          const fullCorrectAnswer = (targetWord || question.correctAnswer || '').toUpperCase();
          
          // Generate question_blank format from current parts
          const currentQuestionBlank = generateQuestionBlank(parts);
          
          
          firebaseSpellboxLogsService.logSpellboxAttempt(
            effectiveUserId,
            effectiveTopicId,
            effectiveGrade,
            question.id,
            fullCorrectAnswer, // Always use full word string (e.g., "BAG", not "B")
            currentQuestionBlank, // Format like "_ _ T" where _ represents blanks
            completeWord,
            correct
          ).then(() => {
           // console.log('[SpellboxLogs] ✅ Successfully logged attempt');
          }).catch((error) => {
            console.error('[SpellboxLogs] ❌ Failed to log attempt:', error);
          });
        } else {
        //  console.log('[SpellboxLogs] Skipping log - answer unchanged since last submission');
        }
      } else {
        console.warn('[SpellboxLogs] ⚠️ Cannot log attempt - missing required data:', {
          hasUserId: !!effectiveUserId,
          hasTopicId: !!effectiveTopicId,
          hasQuestion: !!question,
          userId: effectiveUserId,
          topicId: effectiveTopicId,
          questionId: question?.id,
          propUserId,
          propTopicId,
          questionTopicId: question?.topicId,
          userUid: user?.uid
        });
      }
      
      if (correct) {
        if (interruptRealtimeSession) {
          try { interruptRealtimeSession(); } catch {}
        }
        triggerConfetti();
        if (isReading) {
          setReadingMismatchedIndices([]);
        }
        if (showTutorial) {
          try { nextTutorialStep(); } catch {}
        }
        if (onComplete) {
          const ADVANCE_DELAY_MS = 500;
          setTimeout(() => {
            onComplete(true, completeWord, attempts + 1);
          }, ADVANCE_DELAY_MS);
        }
      } else {
        // Only count as a new attempt if the answer changed
        if (!changedSinceLast) {
          return;
        }
        const nextAttempt = attempts + 1;
        setAttempts(nextAttempt);
        // Unlock the hint bulb after the first wrong checked attempt
        setHintUnlocked(true);
        try {
          if (onComplete && attempts === 0) {
            onComplete(false, completeWord, 1);
          }
        } catch {}
        if (isAssignmentFlow) {
          return;
        }
        generateAIHint(completeWord);
        if (sendMessage && targetWord) {
          try {
            const aiTutor = (question as any)?.aiTutor || {};
            const studentEntry = completeWord;
            const mistakes = computeMistakes(studentEntry, targetWord);
            let payload: any;
            if (isReading) {
              payload = {
                target_word: targetWord,
                student_response: studentEntry,
                attempt_number: nextAttempt,
                topic_to_reinforce: aiTutor?.topic_to_reinforce,
                reading_rule: aiTutor?.reading_rule,
              };
            } else {
              const ruleToUse = aiTutor?.spelling_pattern_or_rule;
              payload = {
                target_word: targetWord,
                question: aiTutor?.question,
                student_entry: studentEntry,
                mistakes,
                attempt_number: nextAttempt,
                topic_to_reinforce: aiTutor?.topic_to_reinforce,
                spelling_pattern_or_rule: ruleToUse,
              };
            }
            sendMessage(JSON.stringify(payload));
          } catch {}
        }
      }
    } finally {
      setIsEvaluating(false);
    }
  }, [userAnswer, reconstructCompleteWord, isWordCorrect, targetWord, interruptRealtimeSession, triggerConfetti, showTutorial, nextTutorialStep, onComplete, attempts, isAssignmentFlow, generateAIHint, sendMessage, question, lastSubmittedAnswer, effectiveUserId, effectiveTopicId, effectiveGrade, parts, generateQuestionBlank]);

  // Focus next empty box (scoped to this component)
  const focusNextEmptyBox = useCallback(() => {
    const scope = containerRef.current;
    if (!scope) return false;
    const inputs = scope.querySelectorAll('input[data-letter]') as NodeListOf<HTMLInputElement>;
    for (let i = 0; i < inputs.length; i++) {
      if (!inputs[i].value.trim()) {
        inputs[i].focus();
        return true;
      }
    }
    return false;
  }, []);

  // Ensure a box is focused on mount and when target word changes
  useEffect(() => {
    setTimeout(() => { focusNextEmptyBox(); }, 0);
  }, []);

  // Reset state only when the actual question changes (stable id),
  // not on incidental re-renders, to avoid clearing correct answers prematurely.
  const prevQuestionIdRef = useRef<number | undefined>(undefined);
  const prevTargetWordRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const idChanged = questionId !== prevQuestionIdRef.current && typeof questionId === 'number';
    const wordChangedWithoutId = (typeof questionId !== 'number') && targetWord !== prevTargetWordRef.current;
    if (idChanged || wordChangedWithoutId) {
      setUserAnswer('');
      setIsCorrect(false);
      setIsComplete(false);
      setHasSubmitted(false);
      setLastSubmittedAnswer('');
      setShowHint(false);
      setHintUnlocked(false);
      setAttempts(0);
      setAiHint('');
      setIsGeneratingHint(false);
      setReadingMismatchedIndices([]);
      setTimeout(() => { focusNextEmptyBox(); }, 0);
    }
    prevQuestionIdRef.current = questionId;
    prevTargetWordRef.current = targetWord;
  }, [questionId, targetWord, focusNextEmptyBox]);

  // Play instruction audio when first-time instruction shows
  // useEffect(() => {
  //   if (showFirstTimeInstruction) {
  //     // Calculate speaker button position first
  //     const positionTimer = setTimeout(() => {
  //       calculateSpeakerButtonPosition();
  //     }, 100);
  //     
  //     // Wait longer before trying to play audio to allow chat TTS to complete
  //     const audioTimer = setTimeout(() => {
  //       playInstructionAudio();
  //     }, 1500); // Increased delay to allow chat audio to complete
  //     
  //     return () => {
  //       clearTimeout(positionTimer);
  //       clearTimeout(audioTimer);
  //     };
  //   }
  // }, [showFirstTimeInstruction, playInstructionAudio, calculateSpeakerButtonPosition]);

  // Retry position calculation if not found initially
  // useEffect(() => {
  //   if (showFirstTimeInstruction && !speakerButtonPosition) {
  //     const retryTimer = setTimeout(() => {
  //       calculateSpeakerButtonPosition();
  //     }, 200);
  //     return () => clearTimeout(retryTimer);
  //   }
  // }, [showFirstTimeInstruction, speakerButtonPosition, calculateSpeakerButtonPosition]);

  // Recalculate position on window resize
  // useEffect(() => {
  //   if (showFirstTimeInstruction) {
  //     const handleResize = () => {
  //       calculateSpeakerButtonPosition();
  //     };
  //     
  //     window.addEventListener('resize', handleResize);
  //     return () => window.removeEventListener('resize', handleResize);
  //   }
  // }, [showFirstTimeInstruction, calculateSpeakerButtonPosition]);


  // Don't render if we don't have the basic requirements, but be more lenient about sentence
  // In inline mode, respect isVisible but default is true
  if (!isVisible || !targetWord) return null;

  // Derived UI states for chevron transparency/disabled behavior
  const hasAnyInput = isReading
    ? (lockedTranscript.trim().length > 0)
    : (userAnswer || '').split('').some(ch => ch && ch !== ' ');
  const isSameAsLastSubmission = hasSubmitted && reconstructCompleteWord(userAnswer) === lastSubmittedAnswer;
  const submitDisabledUnattempted = isReading
    ? (!isCorrect && !hasAnyInput)
    : (!isCorrect && (!hasAnyInput || isSameAsLastSubmission));
  const nextGateDisabled = isCorrect && !canClickNext;

  return (
    <>
      {/* Tutorial overlay for first-time users (overlay mode only) */}
      {variant === 'overlay' && showTutorial && (
        <div className="tutorial-overlay" />
      )}
      
      {variant === 'overlay' ? (
      <div className={cn(
        "absolute inset-0 w-full h-full flex items-center justify-center z-20 pointer-events-none",
        className
      )}>
        <div
          ref={containerRef}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (!target.closest('input[data-letter]')) {
              focusNextEmptyBox();
            }
          }}
          className={cn(
          "spellbox-container pointer-events-auto bg-white rounded-2xl p-8 border border-black/20 shadow-[0_4px_0_black] max-w-lg w-full mx-4 relative",
          showTutorial && "tutorial-spotlight",
          showTutorial && tutorialStep === 'expand' && "tutorial-expand",
          showTutorial && tutorialStep === 'glow' && "tutorial-glow tutorial-highlight"
        )}
        >
        <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 20, fontWeight: 500, lineHeight: 1.6 }}>
            { /* CONTENT START */ }

          {/* Question text */}

          {workingSentence && (

            <div className="mb-8 text-center">
              <div className="text-xl text-gray-800" style={{ 
                fontFamily: 'system-ui, -apple-system, sans-serif',
                lineHeight: 1.6,
                letterSpacing: 'normal',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>

                {workingSentence.split(' ').map((word, idx) => {
                  const normalizedWord = word.toLowerCase().replace(/[^\w]/g, '');
                  const normalizedTarget = targetWord.toLowerCase().replace(/[^\w]/g, '');
                  
                  // Enhanced matching: check if the target word appears at the start or end of the normalized word
                  // This handles cases like:
                  // - "notebook—I" where target is "notebook" (suffix case)
                  // - "nervously—minus" where target is "minus" (prefix case)
                  const isTargetWord = normalizedWord === normalizedTarget || 
                                     (normalizedTarget.length >= 3 && (
                                       normalizedWord.startsWith(normalizedTarget) || // suffix case: "notebook—I"
                                       normalizedWord.endsWith(normalizedTarget)      // prefix case: "nervously—minus"
                                     ));
                  
                  // console.log(`🔤 Word comparison: "${word}" (normalized: "${normalizedWord}") vs target "${targetWord}" (normalized: "${normalizedTarget}") = ${isTargetWord}`);
                  
                  return (
                  <React.Fragment key={idx}>
                    {isTargetWord ? (

                      <div style={{ 
                        display: 'inline-flex',
                        gap: '6px',
                        padding: '8px',
                        background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
                        borderRadius: '12px',
                        boxShadow: '0 4px 8px rgba(109, 40, 217, 0.1)',
                        border: '2px solid rgba(109, 40, 217, 0.2)',
                        margin: '0 4px'
                      }}>
                        {parts.map((part, partIndex) => {
                          if (part.type === 'text') {
                            // Render each prefilled character in its own dotted box
                            return (
                              <React.Fragment key={partIndex}>
                        {part.content?.split('').map((char, charIndex) => {
                          // Reading mode: after submit, color-code letters: green for correct, red for mismatches
                          let style: React.CSSProperties = {
                            width: '36px',
                            height: '44px',
                            borderRadius: '8px',
                            fontSize: '22px',
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            fontWeight: '700',
                            textAlign: 'center',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textTransform: 'uppercase',
                            transition: 'all 0.15s ease-out'
                          };
                          const baseGray: React.CSSProperties = {
                            background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
                            border: '2px dashed #9CA3AF',
                            color: '#1F2937',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                          };
                          const green: React.CSSProperties = {
                            background: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)',
                            border: '3px solid #22C55E',
                            color: '#15803D',
                            boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)'
                          };
                          const red: React.CSSProperties = {
                            background: 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)',
                            border: '3px solid #EF4444',
                            color: '#B91C1C',
                            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
                          };
                          if (isReading && hasSubmitted) {
                            if (isCorrect) {
                              style = { ...style, ...green };
                            } else {
                              const isMismatch = readingMismatchedIndices.includes(charIndex);
                              style = { ...style, ...(isMismatch ? red : green) };
                            }
                          } else {
                            style = { ...style, ...baseGray };
                          }
                          return (
                            <div key={`${partIndex}-${charIndex}`} style={style}>
                              {char}
                            </div>
                          );
                        })}
                              </React.Fragment>
                            );
                          } else {
                            const expectedLength = part.answer?.length || 5;
                            const baseIndex = getBlankBaseIndexForPart(parts, partIndex);
                            return (
                              <div key={partIndex} className="flex items-center gap-2">
                                {Array.from({ length: expectedLength }, (_, letterIndex) => {
                                  const globalIndex = baseIndex + letterIndex;
                                  const letterValue = getUserInputAtBlankIndex(globalIndex);
                                  const completeWord = reconstructCompleteWord(userAnswer);
                                  const showEvaluation = hasSubmitted;
                                  const isWordCorrectNow = showEvaluation && isCorrect;
                                  const isWordIncorrectNow = showEvaluation && !isCorrect;
                                  
                                  // Check if this specific letter is correct in its position
                                  const correctLetter = part.answer?.[letterIndex]?.toUpperCase() || '';
                                  const isLetterCorrect = letterValue && letterValue.toUpperCase() === correctLetter;
                                  
                                  let boxStyle: React.CSSProperties = {
                                    width: '36px',
                                    height: '44px',
                                    padding: '0',
                                    borderRadius: '8px',
                                    fontSize: '22px',
                                    fontFamily: 'system-ui, -apple-system, sans-serif',
                                    fontWeight: '600',
                                    textAlign: 'center',
                                    outline: 'none',
                                    transition: 'all 0.15s ease-out',
                                    textTransform: 'uppercase',
                                    cursor: 'pointer'
                                  };

                                  if (isWordCorrectNow) {
                                    // Entire word is correct - green
                                    boxStyle = {
                                      ...boxStyle,
                                      background: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)',
                                      border: '3px solid #22C55E',
                                      color: '#15803D',
                                      boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)',
                                      cursor: 'not-allowed',
                                      transform: 'translateY(-2px)'
                                    };
                                  } else if (showEvaluation && isLetterCorrect) {
                                    // Word is complete and this letter is in correct position - green
                                    boxStyle = {
                                      ...boxStyle,
                                      background: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)',
                                      border: '3px solid #22C55E',
                                      color: '#15803D',
                                      boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)'
                                    };
                                  } else if (isWordIncorrectNow && letterValue) {
                                    // Word is complete but this letter is incorrect - red
                                    boxStyle = {
                                      ...boxStyle,
                                      background: 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)',
                                      border: '3px solid #EF4444',
                                      color: '#B91C1C',
                                      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
                                    };
                                  } else if (letterValue) {
                                    // Letter has value but word not complete yet - blue
                                    boxStyle = {
                                      ...boxStyle,
                                      background: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)',
                                      border: '3px solid #0EA5E9',
                                      color: '#0369A1',
                                      boxShadow: '0 4px 12px rgba(14, 165, 233, 0.2)'
                                    };
                                  } else {
                                    // Empty letter - gray
                                    boxStyle = {
                                      ...boxStyle,
                                      background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
                                      border: '3px dashed #94A3B8',
                                      color: '#64748B',
                                      boxShadow: '0 4px 12px rgba(148, 163, 184, 0.1)'
                                    };
                                  }

                                  return (
                                    <input
                                      key={letterIndex}
                                      type="text"
                                        value={letterValue}
                                      maxLength={1}
                                      disabled={isCorrect}
                                      onCompositionStart={() => {
                                        // During IME composition, defer validation until compositionend
                                      }}
                                      onCompositionEnd={(e) => {
                                        const composed = (e.target as HTMLInputElement).value || '';
                                        const finalChar = composed.slice(-1).toUpperCase();
                                        if (finalChar.match(/[A-Z]/)) {
                                          const newUserAnswer = updateUserInputAtBlankIndex(globalIndex, finalChar);
                                          handleAnswerChange(newUserAnswer);
                                          playClickSound();
                                          const nextBox = containerRef.current?.querySelector(`input[data-letter="${globalIndex + 1}"]`) as HTMLInputElement | null;
                                          if (nextBox) setTimeout(() => nextBox.focus(), 10);
                                        }
                                      }}
                                      onChange={(e) => {
                                        if (isWordCorrectNow) return;
                                        
                                        const newValue = e.target.value.toUpperCase();
                                        // console.log(`🔤 SPELLBOX INPUT onChange: letterIndex=${letterIndex}, newValue="${newValue}"`);
                                        
                                        if (newValue.match(/[A-Z]/) || newValue === '') {
                                          const newUserAnswer = updateUserInputAtBlankIndex(globalIndex, newValue);
                                          // console.log(`🔤 SPELLBOX INPUT: Updated user answer from "${userAnswer}" to "${newUserAnswer}"`);
                                          
                                          handleAnswerChange(newUserAnswer);
                                          playClickSound();
                                          
                                          if (newValue) {
                                            const nextBox = containerRef.current?.querySelector(`input[data-letter="${globalIndex + 1}"]`) as HTMLInputElement | null;
                                            if (nextBox) {
                                              // console.log(`🔤 SPELLBOX INPUT: Moving focus to next box (${letterIndex + 1})`);
                                              setTimeout(() => nextBox.focus(), 10);
                                            }
                                          }
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Backspace') {
                                          if (letterValue) {
                                            e.preventDefault();
                                              const newUserAnswer = updateUserInputAtBlankIndex(globalIndex, '');
                                            handleAnswerChange(newUserAnswer);
                                          } else if (globalIndex > 0 && containerRef.current) {
                                            const prevBox = containerRef.current.querySelector(`input[data-letter="${globalIndex - 1}"]`) as HTMLInputElement | null;
                                            if (prevBox) prevBox.focus();
                                          }
                                        } else if (e.key === 'ArrowLeft' && globalIndex > 0 && containerRef.current) {
                                          const prevBox = containerRef.current.querySelector(`input[data-letter="${globalIndex - 1}"]`) as HTMLInputElement | null;
                                          if (prevBox) prevBox.focus();
                                        } else if (e.key === 'ArrowRight') {
                                          const nextBox = containerRef.current?.querySelector(`input[data-letter="${globalIndex + 1}"]`) as HTMLInputElement | null;
                                          if (nextBox) nextBox.focus();
                                        } else if (e.key === 'Enter') {
                                          const canSubmitNow = (userAnswer || '').split('').some(ch => ch && ch !== ' ');
                                          if (!isCorrect && canSubmitNow) {
                                            e.preventDefault();
                                            handleSubmitAttempt();
                                          }
                                        }
                                      }}
                                      style={boxStyle}
                                      onFocus={(e) => {
                                        if (isWordCorrectNow) {
                                          e.target.blur();
                                          return;
                                        }
                                        if (!isWordCorrectNow && !isWordIncorrectNow) {
                                          e.target.style.borderStyle = 'solid';
                                          e.target.style.borderColor = '#8B5CF6';
                                          e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.2)';
                                          e.target.style.transform = 'scale(1.02)';
                                        }
                                      }}
                                      onBlur={(e) => {
                                        const hasValue = e.target.value.trim() !== '';
                                        const showEvaluation = hasSubmitted;
                                        const correctLetterBlur = part.answer?.[letterIndex]?.toUpperCase() || '';
                                        const isLetterCorrectBlur = hasValue && e.target.value.toUpperCase() === correctLetterBlur;
                                        e.target.style.transform = 'scale(1)';
                                        e.target.style.borderStyle = hasValue ? 'solid' : 'dashed';
                                        if (showEvaluation && isCorrect) {
                                          e.target.style.borderColor = '#22C55E';
                                          e.target.style.boxShadow = '0 2px 4px rgba(34, 197, 94, 0.2)';
                                        } else if (showEvaluation && isLetterCorrectBlur) {
                                          e.target.style.borderColor = '#22C55E';
                                          e.target.style.boxShadow = '0 2px 4px rgba(34, 197, 94, 0.2)';
                                        } else if (showEvaluation && hasValue) {
                                          e.target.style.borderColor = '#EF4444';
                                          e.target.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.2)';
                                        } else if (hasValue) {
                                          e.target.style.borderColor = '#0EA5E9';
                                          e.target.style.boxShadow = '0 2px 4px rgba(14, 165, 233, 0.2)';
                                        } else {
                                          e.target.style.borderColor = '#94A3B8';
                                          e.target.style.boxShadow = '0 1px 2px rgba(148, 163, 184, 0.1)';
                                        }
                                      }}
                                      data-letter={globalIndex}
                                    />
                                  );
                                })}
                              </div>
                            );
                          }
                        })}
                        
                        {/* Audio/Mic button - speaker for spelling, mic for reading */}
                        {!isReading ? (
                          <Button
                            id="spellbox-speaker-button"
                            variant="comic"
                            size="icon"
                            onClick={playWordAudio}
                            className={cn(
                              'ml-2 h-11 w-11 rounded-lg border-2 border-black bg-white text-foreground shadow-[0_4px_0_rgba(0,0,0,0.6)] transition-transform hover:scale-105',
                              isSpeaking && 'bg-red-500 text-white hover:bg-red-600'
                            )}
                            title={isSpeaking ? 'Stop audio' : 'Listen to this word'}
                            aria-label={isSpeaking ? 'Stop audio' : 'Play audio'}
                          >
                            {isSpeaking ? (
                              <Square className="h-5 w-5" />
                            ) : (
                              <Volume2 className="h-5 w-5" />
                            )}
                          </Button>
                        ) : (
                          <ReadingMicButton 
                            targetWord={targetWord} 
                            onTranscript={(text, isFinal) => { setLiveTranscript(text); setLiveTranscriptFinal(isFinal); }}
                            onRecordingChange={(rec, finalText) => {
                              setIsRecordingReading(rec);
                              if (!rec) {
                                setLockedTranscript(((finalText ?? liveTranscript) || '').trim());
                                setHasSubmitted(false);
                                setIsCorrect(false);
                                setReadingMismatchedIndices([]);
                              } else {
                                setLockedTranscript('');
                                setLiveTranscript('');
                                setLiveTranscriptFinal(false);
                                setHasSubmitted(false);
                                setIsCorrect(false);
                                setReadingMismatchedIndices([]);
                              }
                            }}
                            onRecognized={(ok) => {
                              // Do not finalize here; assessment happens on chevron
                            }}
                          />
                        )}
                      </div>
                    ) : (
                      <span className="inline-block" 
                        style={{ 
                          fontWeight: '400'
                        }}>
                        {word}
                      </span>
                    )}

                    {idx < workingSentence.split(' ').length - 1 && " "}

                  </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {isReading && liveTranscript && (
            <div className="mt-3 text-sm text-center">
              <span className="opacity-60 mr-1">You said:</span>
              <span className={cn(liveTranscriptFinal ? 'font-semibold text-primary' : 'italic text-gray-600')}>{liveTranscript}</span>
            </div>
          )}

          

          {/* Hint button: appears after the first incorrect submit and persists until next question */}
          {hintUnlocked && showHints && (
            <div className="absolute top-2 right-2 z-20">
              <Button
                variant="comic"
                size="icon"
                onClick={() => {
                  playClickSound();
                  if (sendMessage && targetWord) {
                    const aiTutor = (question as any)?.aiTutor || {};
                    const studentEntry = isReading
                      ? ((lockedTranscript || lastSubmittedAnswer || liveTranscript || '').trim())
                      : reconstructCompleteWord(userAnswer);
                    const mistakes = computeMistakes(studentEntry, targetWord);
                    let payload: any;
                    if (isReading) {
                      payload = {
                        target_word: targetWord,
                        student_response: studentEntry,
                        attempt_number: attempts,
                        topic_to_reinforce: aiTutor?.topic_to_reinforce,
                        reading_rule: aiTutor?.reading_rule,
                      };
                    } else {
                      const ruleToUse = aiTutor?.spelling_pattern_or_rule;
                      payload = {
                        target_word: targetWord,
                        question: aiTutor?.question,
                        student_entry: studentEntry,
                        mistakes,
                        attempt_number: attempts,
                        topic_to_reinforce: aiTutor?.topic_to_reinforce,
                        spelling_pattern_or_rule: ruleToUse,
                      };
                    }
                    sendMessage(JSON.stringify(payload));
                  }
                }}
                className={cn('h-9 w-9 rounded-full border-2 border-black bg-yellow-300 text-yellow-900 shadow-[0_4px_0_rgba(0,0,0,0.6)] hover:scale-105 hover:bg-yellow-400')}
                title="Hint: listen again"
                aria-label="Hint: listen again"
              >
                <Lightbulb className="h-5 w-5" />
              </Button>
            </div>
          )}

          {/* Persistent chevron - acts as Submit until correct, then Next
              If a delay is configured for next unlock, hide chevron until gate opens */}
          {question && !(isCorrect && nextUnlockDelayMs > 0 && !canClickNext) && (
            <div className="absolute top-1/2 -translate-y-1/2 -right-[24px] z-20">
              <Button
                variant="comic"
                size="icon"
                aria-label={isCorrect ? 'Next question' : 'Check answer'}
                onClick={() => {
                  playClickSound();
                  if (isCorrect) {
                    if (canClickNext && onNext) onNext();
                  } else {
                    handleSubmitAttempt();
                  }
                }}
                disabled={nextGateDisabled || submitDisabledUnattempted || isEvaluating}
                className={cn(
                  'h-12 w-12 rounded-full shadow-[0_4px_0_rgba(0,0,0,0.6)] hover:scale-105 disabled:opacity-100 disabled:hover:scale-100',
                  // Keep fully opaque when delay-gated next
                  nextGateDisabled && 'disabled:saturate-100 disabled:brightness-100 disabled:contrast-100',
                  // Make slightly transparent when unattempted/unchanged
                  submitDisabledUnattempted && 'opacity-60 saturate-0 brightness-95 cursor-not-allowed',
                  highlightNext && isCorrect && 'animate-[wiggle_1s_ease-in-out_infinite] ring-4 ring-yellow-300'
                )}
              >
                {isEvaluating ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <ChevronRight className={cn('h-6 w-6', submitDisabledUnattempted && 'opacity-60')} />
                )}
              </Button>
              {highlightNext && isCorrect && (
                <div className="ml-2 text-2xl select-none" aria-hidden="true">👉</div>
              )}
            </div>
          )}

          {/* CSS animations */}
          <style>{`
            @keyframes fadeSlideIn {
              from {
                opacity: 0;
                transform: translateY(8px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }

            @keyframes bounceIn { 0% { opacity: 0; transform: scale(0.3);} 50% { opacity: 0.9; transform: scale(1.1);} 80% { opacity: 1; transform: scale(0.89);} 100% { opacity: 1; transform: scale(1);} }


            @keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }

            @keyframes wiggle { 0%,100% { transform: rotate(0deg);} 25% { transform: rotate(6deg);} 75% { transform: rotate(-6deg);} }

          `}</style>
            { /* CONTENT END */ }
        </div>

        {/* Tutorial message for first-time users */}
        {showTutorial && tutorialStep === 'expand' && (
          <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg z-50">
            <div className="text-center">
              <div className="text-xs opacity-90 mb-1">✨ First Adventure Tutorial ✨</div>
              <div>Fill in the blanks to spell the word!</div>
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-purple-600"></div>
          </div>
        )}
            </div>
            {/* Close outer container for overlay mode */}
          </div>
      ) : (
        // Inline variant for embedding inside other UI (e.g., pet bubble)
        <div ref={containerRef} className={cn("spellbox-inline-container", className)}>
          <div className="rounded-xl" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            { /* CONTENT START */ }
            
            {/* Question text and interactive inputs reused as-is */}
            {workingSentence && (
              <div className="text-center">
                <div className="text-base text-gray-800" style={{ lineHeight: 1.5 }}>
                  {workingSentence.split(' ').map((word, idx) => {
                    const normalizedWord = word.toLowerCase().replace(/[^\w]/g, '');
                    const normalizedTarget = targetWord.toLowerCase().replace(/[^\w]/g, '');
                    const isTargetWord = normalizedWord === normalizedTarget || 
                      (normalizedTarget.length >= 3 && (normalizedWord.startsWith(normalizedTarget) || normalizedWord.endsWith(normalizedTarget)));
                    return (
                      <React.Fragment key={idx}>
                        {isTargetWord ? (
                          <div style={{ display: 'inline-flex', gap: '6px', padding: '6px', background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)', borderRadius: '10px', border: '2px solid rgba(109,40,217,0.2)', margin: '0 2px' }}>
                            {parts.map((part, partIndex) => {
                              if (part.type === 'text') {
                                return (
                                  <React.Fragment key={partIndex}>
                                    {part.content?.split('').map((char, charIndex) => {
                                      let style: React.CSSProperties = { width: '28px', height: '36px', borderRadius: '8px', fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', textTransform: 'uppercase' };
                                      const baseGray: React.CSSProperties = { color: '#1F2937', background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)', border: '2px dashed #9CA3AF' };
                                      const green: React.CSSProperties = { color: '#15803D', background: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)', border: '2px solid #22C55E' };
                                      const red: React.CSSProperties = { color: '#B91C1C', background: 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)', border: '2px solid #EF4444' };
                                      if (isReading && hasSubmitted) {
                                        if (isCorrect) {
                                          style = { ...style, ...green };
                                        } else {
                                          const isMismatch = readingMismatchedIndices.includes(charIndex);
                                          style = { ...style, ...(isMismatch ? red : green) };
                                        }
                                      } else {
                                        style = { ...style, ...baseGray };
                                      }
                                      return <div key={`${partIndex}-${charIndex}`} style={style}>{char}</div>;
                                    })}
                                  </React.Fragment>
                                );
                              } else {
                                const expectedLength = part.answer?.length || 5;
                                const baseIndex = getBlankBaseIndexForPart(parts, partIndex);
                                return (
                                  <div key={partIndex} className="flex items-center gap-1">
                                    {Array.from({ length: expectedLength }, (_, letterIndex) => {
                                      const globalIndex = baseIndex + letterIndex;
                                      const letterValue = getUserInputAtBlankIndex(globalIndex);
                                      const completeWord = reconstructCompleteWord(userAnswer);
                                      const showEvaluation = hasSubmitted;
                                      const isWordCorrectNow = showEvaluation && isCorrect;
                                      const isWordIncorrectNow = showEvaluation && !isCorrect;
                                      const correctLetter = part.answer?.[letterIndex]?.toUpperCase() || '';
                                      const isLetterCorrect = letterValue && letterValue.toUpperCase() === correctLetter;
                                      let boxStyle: React.CSSProperties = { width: '28px', height: '36px', borderRadius: '8px', fontSize: '18px', fontWeight: 600, textAlign: 'center', outline: 'none', textTransform: 'uppercase', cursor: 'pointer' };
                                      if (isWordCorrectNow) {
                                        boxStyle = { ...boxStyle, background: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)', border: '2px solid #22C55E', color: '#15803D', cursor: 'not-allowed' };
                                      } else if (showEvaluation && isLetterCorrect) {
                                        boxStyle = { ...boxStyle, background: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)', border: '2px solid #22C55E', color: '#15803D' };
                                      } else if (isWordIncorrectNow && letterValue) {
                                        boxStyle = { ...boxStyle, background: 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)', border: '2px solid #EF4444', color: '#B91C1C' };
                                      } else if (letterValue) {
                                        boxStyle = { ...boxStyle, background: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)', border: '2px solid #0EA5E9', color: '#0369A1' };
                                      } else {
                                        boxStyle = { ...boxStyle, background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)', border: '2px dashed #94A3B8', color: '#64748B' };
                                      }
                                      return (
                                        <input
                                          key={letterIndex}
                                          type="text"
                                          value={letterValue}
                                          maxLength={1}
                                          disabled={isCorrect}
                                          onChange={(e) => {
                                            if (isWordCorrectNow) return;
                                            const newValue = e.target.value.toUpperCase();
                                            if (newValue.match(/[A-Z]/) || newValue === '') {
                                              const newUserAnswer = updateUserInputAtBlankIndex(globalIndex, newValue);
                                              handleAnswerChange(newUserAnswer);
                                              playClickSound();
                                              if (newValue) {
                                                const nextBox = containerRef.current?.querySelector(`input[data-letter="${globalIndex + 1}"]`) as HTMLInputElement | null;
                                                if (nextBox) {
                                                  setTimeout(() => nextBox.focus(), 10);
                                                }
                                              }
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Backspace') {
                                              if (letterValue) {
                                                e.preventDefault();
                                                const newUserAnswer = updateUserInputAtBlankIndex(globalIndex, '');
                                                handleAnswerChange(newUserAnswer);
                                              } else if (globalIndex > 0) {
                                                const prevBox = containerRef.current?.querySelector(`input[data-letter="${globalIndex - 1}"]`) as HTMLInputElement | null;
                                                if (prevBox) prevBox.focus();
                                              }
                                            } else if (e.key === 'ArrowLeft' && globalIndex > 0) {
                                              const prevBox = containerRef.current?.querySelector(`input[data-letter="${globalIndex - 1}"]`) as HTMLInputElement | null;
                                              if (prevBox) prevBox.focus();
                                            } else if (e.key === 'ArrowRight') {
                                              const nextBox = containerRef.current?.querySelector(`input[data-letter="${globalIndex + 1}"]`) as HTMLInputElement | null;
                                              if (nextBox) nextBox.focus();
                                            } else if (e.key === 'Enter') {
                                              const canSubmitNow = (userAnswer || '').split('').some(ch => ch && ch !== ' ');
                                              if (!isCorrect && canSubmitNow) {
                                                e.preventDefault();
                                                handleSubmitAttempt();
                                              }
                                            }
                                          }}
                                          style={boxStyle}
                                          data-letter={globalIndex}
                                        />
                                      );
                                    })}
                                  </div>
                                );
                              }
                            })}
                            {/* Inline mode: speaker for spelling, mic for reading */}
                            {!isReading ? (
                              <Button
                                variant="comic"
                                size="icon"
                                onClick={playWordAudio}
                                className={cn(
                                  'ml-1 h-8 w-8 rounded-md border-2 border-black bg-white text-foreground shadow-[0_3px_0_rgba(0,0,0,0.6)]',
                                  isSpeaking ? 'bg-red-500 text-white hover:bg-red-600' : 'hover:bg-primary hover:text-primary-foreground'
                                )}
                                title={isSpeaking ? 'Stop audio' : 'Listen to this word'}
                                aria-label={isSpeaking ? 'Stop audio' : 'Play audio'}
                              >
                                {isSpeaking ? (
                                  <Square className="h-4 w-4" />
                                ) : (
                                  <Volume2 className="h-4 w-4" />
                                )}
                              </Button>
                            ) : (
                              <ReadingMicButton 
                                compact
                                targetWord={targetWord}
                                onTranscript={(text, isFinal) => { setLiveTranscript(text); setLiveTranscriptFinal(isFinal); }}
                                onRecordingChange={(rec, finalText) => {
                                  setIsRecordingReading(rec);
                                  if (!rec) {
                                    setLockedTranscript(((finalText ?? liveTranscript) || '').trim());
                                    setHasSubmitted(false);
                                    setIsCorrect(false);
                                    setReadingMismatchedIndices([]);
                                  } else {
                                    setLockedTranscript('');
                                    setLiveTranscript('');
                                    setLiveTranscriptFinal(false);
                                    setHasSubmitted(false);
                                    setIsCorrect(false);
                                    setReadingMismatchedIndices([]);
                                  }
                                }}
                                onRecognized={(ok) => {
                                  // No-op for finalization in reading mode
                                }}
                              />
                            )}
                          </div>
                        ) : (
                          <span className="inline-block" style={{ fontWeight: 400 }}>{word}</span>
                        )}
                        {idx < workingSentence.split(' ').length - 1 && ' '}
                      </React.Fragment>
                    );
                  })}
                </div>
                {isReading && liveTranscript && (
                  <div className="mt-2 text-xs text-center">
                    <span className="opacity-60 mr-1">You said:</span>
                    <span className={cn(liveTranscriptFinal ? 'font-semibold text-primary' : 'italic text-gray-600')}>{liveTranscript}</span>
                  </div>
                )}
              </div>
            )}

            {/* Inline hint button: persists after first wrong submit */}
            {hintUnlocked && showHints && (
              <div style={{ padding: '8px 0' }}>
                <Button
                  variant="comic"
                  size="icon"
                  onClick={() => {
                    playClickSound();
                    if (sendMessage && targetWord) {
                      const aiTutor = (question as any)?.aiTutor || {};
                      const studentEntry = isReading
                        ? ((lockedTranscript || lastSubmittedAnswer || liveTranscript || '').trim())
                        : reconstructCompleteWord(userAnswer);
                      const mistakes = computeMistakes(studentEntry, targetWord);
                      let payload: any;
                      if (isReading) {
                        // Reading-mode: send reading-specific fields to the reading tutor
                        payload = {
                          target_word: targetWord,
                          student_response: studentEntry,
                          attempt_number: attempts,
                          topic_to_reinforce: aiTutor?.topic_to_reinforce,
                          reading_rule: aiTutor?.reading_rule,
                        };
                      } else {
                        // Spelling-mode: keep existing spelling payload shape
                        const ruleToUse = aiTutor?.spelling_pattern_or_rule;
                        payload = {
                          target_word: targetWord,
                          question: aiTutor?.question,
                          student_entry: studentEntry,
                          mistakes,
                          attempt_number: attempts,
                          topic_to_reinforce: aiTutor?.topic_to_reinforce,
                          spelling_pattern_or_rule: ruleToUse
                        };
                      }
                      sendMessage(JSON.stringify(payload));
                    }
                  }}
                  className={cn('h-7 w-7 rounded-full border-2 border-black shadow-[0_3px_0_rgba(0,0,0,0.6)] hover:scale-105 bg-yellow-300 text-yellow-900 hover:bg-yellow-400')}
                  title="Hint: listen again"
                  aria-label="Hint: listen again"
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Persistent chevron (inline) - acts as Submit until correct, then Next */}
            {question && !(isCorrect && nextUnlockDelayMs > 0 && !canClickNext) && (
              <div className="absolute top-1/2 -translate-y-1/2 -right-[18px] z-20">
                <Button
                  variant="comic"
                  size="icon"
                  aria-label={isCorrect ? 'Next question' : 'Check answer'}
                  onClick={() => {
                    playClickSound();
                    if (isCorrect) {
                      if (onNext) onNext();
                    } else {
                      handleSubmitAttempt();
                    }
                  }}
                  disabled={nextGateDisabled || submitDisabledUnattempted || isEvaluating}
                  className={cn(
                    'h-9 w-9 rounded-full shadow-[0_3px_0_rgba(0,0,0,0.6)] hover:scale-105 disabled:opacity-100 disabled:hover:scale-100',
                    nextGateDisabled && 'disabled:saturate-100 disabled:brightness-100 disabled:contrast-100',
                    submitDisabledUnattempted && 'opacity-60 saturate-0 brightness-95 cursor-not-allowed'
                  )}
                >
                  {isEvaluating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronRight className={cn('h-4 w-4', submitDisabledUnattempted && 'opacity-60')} />
                  )}
                </Button>
              </div>
            )}

    </div>
        </div>
      )}
    </>
  );
};

export default SpellBox; 