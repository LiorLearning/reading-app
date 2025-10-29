import React from "react";
import { Button } from "@/components/ui/button";
import { Volume2, Square, X, Droplet, Hand, Utensils, ChevronRight } from "lucide-react";
import { playClickSound } from "@/lib/sounds";
import { ttsService, AVAILABLE_VOICES } from "@/lib/tts-service";
import { useTTSSpeaking } from "@/hooks/use-tts-speaking";
import SpellBox from "@/components/comic/SpellBox";
import { cn } from "@/lib/utils";
import { bubbleMessageIdFromHtml, inlineSpellboxMessageId } from "@/lib/tts-message-id";

interface LeftPetOverlayProps {
  petImageUrl: string | null | undefined;
  aiMessageHtml?: string;
  isThinking?: boolean;
  draggable?: boolean;
  /** When true, render above most overlays (e.g., tutorial dimmers) */
  forceTopLayer?: boolean;
  autoHideToken?: unknown; // any changing value triggers an auto hide (e.g., after image creation)
  onBubbleVisibilityChange?: (visible: boolean) => void;
  interruptRealtimeSession?: () => void;
  /** Optional: provide to render inline spelling UI instead of plain HTML */
  spellInline?: {
    word?: string | null;
    sentence?: string | null;
    question?: {
      id: number;
      word: string;
      questionText: string | null;
      correctAnswer: string;
      audio: string;
      explanation: string;
      isPrefilled?: boolean;
      prefilledIndexes?: number[];
      aiTutor?: {
        target_word?: string;
        question?: string;
        student_entry?: string;
        topic_to_reinforce?: string;
        spelling_pattern_or_rule?: string;
      };
    } | null;
    show?: boolean;
    showHints?: boolean;
    showExplanation?: boolean;
    onComplete?: (isCorrect: boolean, userAnswer?: string, attemptCount?: number) => void;
    onSkip?: () => void;
    onNext?: () => void;
    /** When true, visually highlight the Next chevron to guide the user */
    highlightNext?: boolean;
    sendMessage?: (text: string) => void;
    promptText?: string;
    isDisabled?: boolean;
    /** When true, treat as assignment flow to allow realtime hinting */
    isAssignmentFlow?: boolean;
  };
  // Emotion/heart UI
  emotionActive?: boolean;
  emotionRequiredAction?: 'water' | 'pat' | 'feed' | null;
  onEmotionAction?: (action: 'water' | 'pat' | 'feed') => void;
  /** Controls visibility of the attention badge independent of emotion state (e.g., yawn) */
  showAttentionBadge?: boolean;
  // Optional temporary media to overlay inside avatar (e.g., GIF/video)
  overridePetMediaUrl?: string | null;
}

export const LeftPetOverlay: React.FC<LeftPetOverlayProps> = ({
  petImageUrl,
  aiMessageHtml,
  isThinking = false,
  draggable = true,
  forceTopLayer = false,
  autoHideToken,
  onBubbleVisibilityChange,
  interruptRealtimeSession,
  spellInline,
  emotionActive = false,
  emotionRequiredAction = null,
  onEmotionAction,
  showAttentionBadge = false,
  overridePetMediaUrl = null,
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const avatarRef = React.useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = React.useState<{ left: number; top: number } | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const hasUserDraggedRef = React.useRef(false);
  const isSpeakingRef = React.useRef(false);
  const [isBubbleHidden, setIsBubbleHidden] = React.useState(false);
  const lastAiHtmlRef = React.useRef<string | undefined>(undefined);
  const [hiddenReason, setHiddenReason] = React.useState<null | 'manual' | 'auto'>(null);
  const hiddenAtHtmlRef = React.useRef<string | undefined>(undefined);
  const [isManuallyClosed, setIsManuallyClosed] = React.useState(false);
  const hasInlineQuestion = React.useMemo(() => {
    return Boolean(spellInline?.show && !!spellInline?.question);
  }, [spellInline?.show, spellInline?.question]);

  // Lightweight petting interaction state
  const [pettingActive, setPettingActive] = React.useState<boolean>(false);
  const [handPosition, setHandPosition] = React.useState<{ x: number; y: number } | null>(null);
  const pettingTimeoutRef = React.useRef<number | null>(null);
  const lastStrokePointRef = React.useRef<{ x: number; y: number } | null>(null);
  const [hearts, setHearts] = React.useState<Array<{ id: number; x: number; y: number; animate: boolean }>>([]);
  const hasTriggeredPatRef = React.useRef<boolean>(false);

  // Loading indicator for override media (e.g., GIF/video when pat/water/feed triggers)
  const [overrideMediaLoading, setOverrideMediaLoading] = React.useState<boolean>(false);
  const loadingStartRef = React.useRef<number | null>(null);
  const MIN_SPINNER_MS = 250;

  React.useEffect(() => {
    if (overridePetMediaUrl) {
      loadingStartRef.current = Date.now();
      setOverrideMediaLoading(true);
    } else {
      setOverrideMediaLoading(false);
      loadingStartRef.current = null;
    }
  }, [overridePetMediaUrl]);

  const finishOverrideLoading = React.useCallback(() => {
    if (!overrideMediaLoading) return;
    const startedAt = loadingStartRef.current || Date.now();
    const elapsed = Date.now() - startedAt;
    const wait = Math.max(0, MIN_SPINNER_MS - elapsed);
    window.setTimeout(() => {
      setOverrideMediaLoading(false);
      loadingStartRef.current = null;
    }, wait);
  }, [overrideMediaLoading]);

  // Slightly desynchronize pulses for action buttons
  const actionPulseDelays = React.useMemo(() => {
    const rand = () => `${(Math.random() * 0.35).toFixed(2)}s`;
    return { water: rand(), pat: rand(), feed: rand() } as const;
  }, []);
  const pulseClasses = 'ring-2 ring-amber-400/70 shadow-[0_0_10px_rgba(251,191,36,0.35)] motion-safe:animate-pulse hover:animate-none active:animate-none focus:animate-none hover:ring-amber-500 hover:shadow-[0_0_12px_rgba(245,158,11,0.5)]';

  // Ambient floating hearts (background) while petting is active
  const [floatHearts, setFloatHearts] = React.useState<Array<{ id: number; x: number; y: number; driftX: number; scale: number; animate: boolean }>>([]);
  const floatIntervalRef = React.useRef<number | null>(null);

  const spawnFloatHeart = React.useCallback(() => {
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    // Anchor roughly near the pet's head area inside the avatar box
    const baseX = rect.width * 0.65;
    const baseY = rect.height * 0.38;
    const jitterX = (Math.random() - 0.5) * 18; // ±9px
    const jitterY = (Math.random() - 0.5) * 14; // ±7px
    const driftX = (Math.random() - 0.5) * 40; // final sideways drift
    const scale = 0.9 + Math.random() * 0.5;
    const id = Date.now() + Math.random();
    setFloatHearts(prev => [...prev, { id, x: baseX + jitterX, y: baseY + jitterY, driftX, scale, animate: false }]);
    requestAnimationFrame(() => {
      setFloatHearts(prev => prev.map(h => (h.id === id ? { ...h, animate: true } : h)));
    });
    window.setTimeout(() => {
      setFloatHearts(prev => prev.filter(h => h.id !== id));
    }, 1100);
  }, []);

  React.useEffect(() => {
    if (pettingActive) {
      // Start gentle background hearts while petting
      if (floatIntervalRef.current) window.clearInterval(floatIntervalRef.current);
      spawnFloatHeart();
      floatIntervalRef.current = window.setInterval(spawnFloatHeart, 280);
    } else {
      if (floatIntervalRef.current) {
        window.clearInterval(floatIntervalRef.current);
        floatIntervalRef.current = null;
      }
    }
    return () => {
      if (floatIntervalRef.current) {
        window.clearInterval(floatIntervalRef.current);
        floatIntervalRef.current = null;
      }
    };
  }, [pettingActive, spawnFloatHeart]);

  // Wrong-action feedback highlights: track all wrong actions pressed during the current emotion step
  const [wrongActions, setWrongActions] = React.useState<Set<'water' | 'pat' | 'feed'>>(new Set());

  // Clear wrong highlights whenever emotion step resets/hides
  React.useEffect(() => {
    if (!emotionActive) setWrongActions(new Set());
  }, [emotionActive]);

  // Start/stop helpers
  const startPetting = React.useCallback((startX?: number, startY?: number) => {
    setPettingActive(true);
    hasTriggeredPatRef.current = false;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { (navigator as any).vibrate?.(10); } catch {}
    }
    // Initial hand position roughly center if not provided
    if (avatarRef.current) {
      const rect = avatarRef.current.getBoundingClientRect();
      const defaultX = rect.width * 0.65;
      const defaultY = rect.height * 0.45;
      const x = startX ? startX - rect.left : defaultX;
      const y = startY ? startY - rect.top : defaultY;
      setHandPosition({ x, y });
      lastStrokePointRef.current = { x, y };
    }
    // Auto end after a short time so UI doesn't get stuck
    if (pettingTimeoutRef.current) window.clearTimeout(pettingTimeoutRef.current);
    pettingTimeoutRef.current = window.setTimeout(() => setPettingActive(false), 6000);
  }, []);

  const stopPetting = React.useCallback(() => {
    setPettingActive(false);
    if (pettingTimeoutRef.current) {
      window.clearTimeout(pettingTimeoutRef.current);
      pettingTimeoutRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (pettingTimeoutRef.current) window.clearTimeout(pettingTimeoutRef.current);
    };
  }, []);

  // External trigger to force-show the bubble (e.g., after care success replay)
  React.useEffect(() => {
    const handler = () => {
      setIsManuallyClosed(false);
      setIsBubbleHidden(false);
      setHiddenReason(null);
    };
    window.addEventListener('showLeftBubble', handler as EventListener);
    return () => window.removeEventListener('showLeftBubble', handler as EventListener);
  }, []);

  const spawnHeart = React.useCallback((x: number, y: number) => {
    const id = Date.now() + Math.random();
    setHearts(prev => [...prev, { id, x, y, animate: false }]);
    // Trigger animation on next frame
    requestAnimationFrame(() => {
      setHearts(prev => prev.map(h => (h.id === id ? { ...h, animate: true } : h)));
    });
    // Cleanup after animation
    window.setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== id));
    }, 800);
  }, []);

  const onPetPointerMove = React.useCallback((clientX: number, clientY: number) => {
    if (!avatarRef.current) return;
    const rect = avatarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
    setHandPosition({ x, y });

    // Spawn hearts when moving a bit from last point
    const last = lastStrokePointRef.current;
    if (!last || Math.hypot(x - last.x, y - last.y) > 28) {
      lastStrokePointRef.current = { x, y };
      spawnHeart(x, y);
    }
  }, [spawnHeart]);

  // Resolve Jessica voice once (fallback to currently selected voice)
  const jessicaVoiceId = React.useMemo(() => {
    const v = AVAILABLE_VOICES.find(v => v.name === 'Jessica');
    try {
      return v?.id || ttsService.getSelectedVoice().id;
    } catch {
      return v?.id || undefined;
    }
  }, []);

  // Yawn-state speaker lines (rotated)
  const YAWN_NUDGE_LINES = React.useMemo(() => [
    "One-word answers make me sleepy, but I want some fun! Please add more detail?",
    "I’m snoozing on short replies… spice it up?",
    "I yawn at tiny replies. Add more ideas?",
    "Short replies make me a bit bored. Add more detail?",
  ], []);
  // Neutral motivation lines for emotion/need state (no hinting which action)
  const EMOTION_HINT_LINES = React.useMemo(() => [
    "I’m getting a bit cranky… could you try doing something for me?",
    "Hmm, I need a little care—can you do something nice for me?",
    "I’m feeling a bit fussy—try doing something nice for me?",
    "I could use a little help—maybe try doing something for me?",
  ], []);
  const lastYawnNudgeAtRef = React.useRef<number>(0);
  const [yawnNudgeAcknowledged, setYawnNudgeAcknowledged] = React.useState<boolean>(false);
  React.useEffect(() => {
    // Reset acknowledgement whenever yawn or emotion attention appears again
    if (showAttentionBadge || emotionActive) {
      setYawnNudgeAcknowledged(false);
    }
  }, [showAttentionBadge, emotionActive]);
  const handleYawnNudgeSpeak = React.useCallback(async () => {
    const now = Date.now();
    if (now - lastYawnNudgeAtRef.current < 2500) return; // debounce ~2.5s
    lastYawnNudgeAtRef.current = now;
    try {
      ttsService.stop();
      const line = YAWN_NUDGE_LINES[Math.floor(Math.random() * YAWN_NUDGE_LINES.length)];
      await ttsService.speakAnswer(line);
    } catch {}
  }, [YAWN_NUDGE_LINES]);

  // Unified top-right speaker behavior
  const handleGlobalSpeaker = React.useCallback(async () => {
    // Always allow speaking on press; do not block due to GIFs or loaders.
    ttsService.stop();
    // Prioritize emotion/need state over yawn if both are active
    if (emotionActive) {
      try {
        const line = EMOTION_HINT_LINES[Math.floor(Math.random() * EMOTION_HINT_LINES.length)];
        await ttsService.speakAnswer(line);
      } catch {}
      return;
    }
    if (showAttentionBadge) {
      await handleYawnNudgeSpeak();
      return;
    }
    // Fallback to speaking the current bubble content
    await handleSpeak();
  }, [showAttentionBadge, emotionActive, overridePetMediaUrl, overrideMediaLoading, handleYawnNudgeSpeak, EMOTION_HINT_LINES]);

  // Keep track of the last AI message so we can restore it when user taps the pet
  React.useEffect(() => {
    if (aiMessageHtml) {
      lastAiHtmlRef.current = aiMessageHtml;
    }
  }, [aiMessageHtml]);

  const displayHtml = isBubbleHidden ? undefined : (aiMessageHtml || lastAiHtmlRef.current);
  const bubbleVisible = !isBubbleHidden && (!!displayHtml || !!isThinking || hasInlineQuestion);

  React.useEffect(() => {
    if (isDragging || hasUserDraggedRef.current) return;
    if (!overlayRef.current || !overlayRef.current.parentElement) return;

    const parentRect = overlayRef.current.parentElement.getBoundingClientRect();
    const overlayRect = overlayRef.current.getBoundingClientRect();

    const targetCenterX = parentRect.width * 0.22;
    const preferredLeft = targetCenterX - overlayRect.width / 2;
    const maxLeft = Math.max(0, parentRect.width - overlayRect.width);
    const left = Math.min(Math.max(16, preferredLeft), maxLeft);

    const maxTopAllowed = Math.max(0, parentRect.height - overlayRect.height);
    const preferredTop = bubbleVisible
      ? Math.min(maxTopAllowed, 50)
      : Math.max(0, (parentRect.height - overlayRect.height) / 2);
    const top = Math.min(Math.max(16, preferredTop), maxTopAllowed);

    if (!Number.isFinite(left) || !Number.isFinite(top)) return;

    setPosition(prev => {
      if (prev && Math.abs(prev.left - left) < 0.5 && Math.abs(prev.top - top) < 0.5) {
        return prev;
      }
      return { left, top };
    });
  }, [bubbleVisible, displayHtml, isBubbleHidden, isThinking, hasInlineQuestion, isDragging]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!draggable) return;
    setIsDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggable) return;
    setIsDragging(false);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggable || !isDragging || !overlayRef.current) return;
    const parent = overlayRef.current.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const overlayRect = overlayRef.current.getBoundingClientRect();
    hasUserDraggedRef.current = true;
    const newLeft = Math.min(
      Math.max(0, e.clientX - rect.left - overlayRect.width / 2),
      Math.max(0, rect.width - overlayRect.width)
    );
    const newTop = Math.min(
      Math.max(0, e.clientY - rect.top - overlayRect.height / 2),
      Math.max(0, rect.height - overlayRect.height)
    );
    setPosition({ left: newLeft, top: newTop });
  };

  const handleSpeak = async () => {
    // If overlays have requested suppression (e.g., Step 6), do not speak
    try { if (ttsService.isNonKraftySuppressed()) return; } catch {}
    // Ensure exclusivity: stop any ongoing TTS first
    if (isSpeakingRef.current || ttsService.getIsSpeaking()) {
      ttsService.stop();
      isSpeakingRef.current = false;
      // If user tapped while something else is speaking, stop and return for a true toggle
      return;
    }

    // If inline SpellBox is active, prefer speaking the full sentence; fallback to the spelling word
    if (hasInlineQuestion) {
      const sentenceHtml = spellInline?.sentence || '';
      const sentenceText = (() => {
        if (!sentenceHtml) return '';
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sentenceHtml;
        return (tempDiv.textContent || tempDiv.innerText || '').trim();
      })();

      const wordToSpeak = spellInline?.word || '';

      // Derive exactly what SpellBox shows by extracting only the sentence that contains the target word
      const extractVisibleSentence = (fullText: string, targetWord: string): string => {
        const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const normalizedWord = targetWord?.trim();
        if (!fullText || !normalizedWord) return fullText;
        const parts = (() => {
          const segments = fullText.split(/([.!?])/);
          const out: string[] = [];
          for (let i = 0; i < segments.length; i += 2) {
            const body = (segments[i] || '').trim();
            const punct = segments[i + 1] || '';
            const combined = (body + punct).trim();
            if (combined) out.push(combined);
          }
          return out;
        })();
        const wordRegex = new RegExp(`\\b${escapeRegExp(normalizedWord)}\\b`, 'i');
        const match = parts.find(p => wordRegex.test(p));
        return match || fullText;
      };

      const visibleSentence = extractVisibleSentence(sentenceText, wordToSpeak);
      const textToSpeak = (visibleSentence || '').trim() || wordToSpeak;
      try { console.log('[Overlay][Speak] Inline SpellBox speak', { textToSpeak, wordToSpeak, sentenceText, hasInlineQuestion }); } catch {}
      if (textToSpeak) {
        // Check suppression again just before speaking
        try { if (ttsService.isNonKraftySuppressed()) return; } catch {}
        isSpeakingRef.current = true;
        try {
          await ttsService.speak(textToSpeak, {
            stability: 0.7,
            similarity_boost: 0.9,
            // Use a slightly slower speed only when we fall back to the isolated word
            speed: visibleSentence ? undefined : 0.7,
            messageId: currentMessageIdRef.current,
            voice: jessicaVoiceId,
          });
        } finally {
          isSpeakingRef.current = false;
        }
        return;
      }
    }

    // Otherwise, speak the AI bubble HTML (text-only)
    const toSpeak = aiMessageHtml || lastAiHtmlRef.current;
    if (!toSpeak) return;
    const temp = document.createElement("div");
    temp.innerHTML = toSpeak;
    const text = temp.textContent || temp.innerText || "";
    try { console.log('[Overlay][Speak] Bubble speak', { text }); } catch {}
    // Guard suppression before speaking bubble HTML
    try { if (ttsService.isNonKraftySuppressed()) return; } catch {}
    isSpeakingRef.current = true;
    try {
      await ttsService.speakAIMessage(text, currentMessageIdRef.current);
    } finally {
      isSpeakingRef.current = false;
    }
  };

  // Auto-hide trigger (e.g., after an image is created)
  // Important: only react to TOKEN CHANGES. If a token arrives while a spelling
  // question is active, we skip auto-hiding so the subsequent message remains visible.
  React.useEffect(() => {
    if (autoHideToken !== undefined) {
      if (!hasInlineQuestion) {
        setIsBubbleHidden(true);
        setHiddenReason('auto');
        hiddenAtHtmlRef.current = aiMessageHtml || lastAiHtmlRef.current;
      }
      // If a question is active, ignore this token; do not hide later when
      // the question completes. This prevents the follow-up story message from
      // being hidden immediately after a correct answer.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoHideToken]);

  // When a question becomes active, force-show the bubble
  // Questions should always show, even if manually closed
  React.useEffect(() => {
    if (hasInlineQuestion) {
      setIsBubbleHidden(false);
      setHiddenReason(null);
      // Don't reset manual close state - keep it for after question
    }
  }, [hasInlineQuestion]);

  // When question ends, hide the dialog again if it was manually closed
  React.useEffect(() => {
    if (!hasInlineQuestion && isManuallyClosed) {
      setIsBubbleHidden(true);
      setHiddenReason('manual');
    }
  }, [hasInlineQuestion, isManuallyClosed]);

  // If we were auto-hidden, show again when a new AI message arrives
  // But don't show if it was manually closed by the user
  React.useEffect(() => {
    if (hiddenReason === 'auto' && !isManuallyClosed && aiMessageHtml && aiMessageHtml !== hiddenAtHtmlRef.current) {
      setIsBubbleHidden(false);
      setHiddenReason(null);
    }
  }, [aiMessageHtml, hiddenReason, isManuallyClosed]);

  // Derive a stable messageId for the current visible content so the speaker button
  // can reflect play/stop state consistently across renders.
  const currentMessageId = React.useMemo(() => {
    if (hasInlineQuestion) {
      return inlineSpellboxMessageId(spellInline?.word, spellInline?.question?.id ?? null);
    }
    return bubbleMessageIdFromHtml(displayHtml);
  }, [hasInlineQuestion, spellInline?.question?.id, spellInline?.word, displayHtml]);
  const currentMessageIdRef = React.useRef<string>(currentMessageId);
  React.useEffect(() => { currentMessageIdRef.current = currentMessageId; }, [currentMessageId]);
  const isSpeakingThisMessage = useTTSSpeaking(currentMessageId);

  // Publish visibility changes to parent (visible when bubble not hidden and there is content, thinking, or inline question)
  React.useEffect(() => {
    const visible = !isBubbleHidden && (!!displayHtml || !!isThinking || hasInlineQuestion);
    onBubbleVisibilityChange?.(visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBubbleHidden, !!displayHtml, isThinking, hasInlineQuestion]);

  return (
    <div ref={containerRef} className={`pointer-events-none absolute inset-0 ${forceTopLayer ? 'z-[70]' : 'z-20'}`}>
      <div
        ref={overlayRef}
        className={cn(
          "absolute flex items-center gap-3 select-none",
          draggable && "cursor-grab active:cursor-grabbing"
        )}
        style={{
          left: position ? `${position.left}px` : "16px",
          top: position ? `${position.top}px` : "24px",
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerMove={onPointerMove}
      >
        {/* Pet avatar and actions */}
        <div className="pointer-events-auto flex flex-col items-center gap-2">
          {/* AI bubble above the pet */}
          {!isBubbleHidden && (
            <div className="pointer-events-auto relative">
              <div className="relative bg-white/95 border-2 border-black rounded-2xl shadow-[0_6px_0_rgba(0,0,0,0.6)] px-4 py-3 max-w-[400px]">
                {isThinking && !displayHtml ? (
                  <div className="flex items-center gap-1 text-sm">
                    <span>Krafty is thinking</span>
                    <div className="flex gap-1 ml-1">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s`, animationDuration: "1s" }} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-base leading-relaxed pr-7" style={{ fontFamily: 'Fredoka, sniglet, "Comic Sans MS", system-ui, -apple-system, sans-serif' }}>
                    {spellInline?.show && spellInline?.promptText ? (
                      <SpellBoxPromptInline
                        text={spellInline.promptText}
                        onNext={spellInline.onNext}
                        highlightNext={spellInline.highlightNext}
                        isDisabled={spellInline.isDisabled}
                      />
                    ) : spellInline?.show && spellInline?.word ? (
                      <SpellBox
                        variant="inline"
                        isVisible={true}
                        word={spellInline.word || undefined}
                        sentence={spellInline.sentence || undefined}
                        question={spellInline.question || undefined}
                        onComplete={spellInline.onComplete}
                        onSkip={spellInline.onSkip}
                        onNext={spellInline.onNext}
                        highlightNext={spellInline.highlightNext}
                        showHints={spellInline.showHints}
                        showExplanation={spellInline.showExplanation}
                        sendMessage={spellInline.sendMessage}
                        interruptRealtimeSession={interruptRealtimeSession}
                        isAssignmentFlow={!!spellInline.isAssignmentFlow}
                      />
                    ) : displayHtml ? (
                      <div dangerouslySetInnerHTML={{ __html: displayHtml }} />
                    ) : (
                      <span className="opacity-60">Say hi to start your adventure!</span>
                    )}
                  </div>
                )}
                {/* Close button (hidden while a question is active) */}
                {!hasInlineQuestion && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      ttsService.stop();
                      setIsBubbleHidden(true);
                      setHiddenReason('manual');
                      setIsManuallyClosed(true);
                    }}
                    className="absolute top-1 right-1 h-6 w-6 p-0 rounded-full hover:bg-black/10"
                    aria-label="Hide message"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
                {/* Speaker control (available for AI HTML or inline SpellBox) */}
                {(displayHtml || hasInlineQuestion) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpeak();
                    }}
                    className="absolute bottom-1 right-1 h-6 w-6 p-0 rounded-full hover:bg-black/10"
                    aria-label={isSpeakingThisMessage ? 'Stop message' : 'Play message'}
                  >
                    {isSpeakingThisMessage ? <Square className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                  </Button>
                )}
              </div>
              {/* Tail pointing down toward the pet avatar */}
              <div className="absolute left-1/2 bottom-[-10px] -translate-x-1/2 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[10px] border-l-transparent border-r-transparent border-t-black" />
              <div className="absolute left-1/2 bottom-[-8px] -translate-x-1/2 w-0 h-0 border-l-[9px] border-r-[9px] border-t-[9px] border-l-transparent border-r-transparent border-t-white" />
            </div>
          )}

          <div
          ref={avatarRef}
          className="relative w-[210px] h-[210px] rounded-xl overflow-hidden shadow-[0_6px_0_rgba(0,0,0,0.6)] border-2 border-black bg-white/70 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            // Single click always (re)opens and resets manual-close state
            setIsManuallyClosed(false);
            setIsBubbleHidden(false);
            setHiddenReason(null);
          }}
        >
          {/* Top-right unified speaker visible only for yawn or emotion attention. */}
          {(emotionActive || showAttentionBadge) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleGlobalSpeaker();
              }}
              aria-label={showAttentionBadge ? 'Play tip' : (emotionActive ? 'Play hint' : 'Play message')}
              className={`absolute top-2 right-2 z-10 w-9 h-9 rounded-full border-2 border-black grid place-items-center shadow-[0_2px_0_rgba(0,0,0,0.4)] ${
                (showAttentionBadge || emotionActive) ? 'bg-amber-400' : 'bg-amber-300'
              }`}
            >
              <Volume2 className="w-5 h-5 text-black" />
            </button>
          )}

          {/* Avatar image or temporary override media (force remount on URL change) */}
          {overridePetMediaUrl ? (
            /\.(mp4|webm|mov)$/i.test(overridePetMediaUrl) ? (
              <video
                key={overridePetMediaUrl}
                src={overridePetMediaUrl}
                autoPlay
                muted
                playsInline
                onLoadedData={finishOverrideLoading}
                className="w-full h-full object-contain"
              />
            ) : (
              <img
                key={overridePetMediaUrl}
                src={overridePetMediaUrl}
                alt="Pet action"
                onLoad={finishOverrideLoading}
                className="w-full h-full object-contain"
              />
            )
          ) : petImageUrl ? (
            <img key={petImageUrl} src={petImageUrl} alt="Pet" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-100" />
          )}

          {/* Brief spinner while override media loads */}
          {overridePetMediaUrl && overrideMediaLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/10">
              <div className="w-9 h-9 rounded-full border-4 border-black/20 border-t-black animate-spin" />
            </div>
          )}

          {/* Petting interaction overlay */}
          {pettingActive && (
            <div
              className="absolute inset-0 pointer-events-auto"
              style={{ cursor: 'none' }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                startPetting(e.clientX, e.clientY);
                onPetPointerMove(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (!pettingActive) return;
                onPetPointerMove(e.clientX, e.clientY);
              }}
              onPointerUp={() => {
                if (!hasTriggeredPatRef.current) {
                  hasTriggeredPatRef.current = true;
                  onEmotionAction?.('pat');
                }
                stopPetting();
              }}
            >
              {/* Floating background hearts (behind the hand) */}
              <div className="absolute inset-0 pointer-events-none">
                {floatHearts.map(h => (
                  <div
                    key={h.id}
                    className="absolute transition-all duration-1000 ease-out"
                    style={{
                      left: Math.max(0, (h.x - 8)),
                      top: Math.max(0, (h.y - 8)),
                      transform: h.animate
                        ? `translate(${h.driftX}px, -90px) scale(${h.scale})`
                        : `translate(0px, 0px) scale(${Math.max(0.7, h.scale - 0.2)})`,
                      opacity: h.animate ? 0 : 0.9,
                    }}
                  >
                    <span className="text-pink-500">❤</span>
                  </div>
                ))}
              </div>

              {/* Hearts */}
              {hearts.map(h => (
                <div
                  key={h.id}
                  className={`absolute select-none transition-all duration-700 ease-out`}
                  style={{ left: Math.max(0, (h.x - 8)), top: Math.max(0, (h.y - 8)), transform: h.animate ? 'translateY(-28px) scale(1.1)' : 'translateY(0px) scale(0.8)', opacity: h.animate ? 0 : 0.95 }}
                >
                  <span className="text-red-500">❤️</span>
                </div>
              ))}

              {/* Hand */}
              {handPosition && (
                <div
                  className="absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-300 border-2 border-black shadow-[0_4px_0_rgba(0,0,0,0.5)] flex items-center justify-center"
                  style={{ left: handPosition.x, top: handPosition.y, transform: 'translate(-50%, -50%) rotate(-18deg)' }}
                >
                  <span className="text-3xl">🤚</span>
                </div>
              )}
            </div>
          )}
          {/* Chevron indicator to hint message is hidden - positioned inside the avatar box */}
          {isBubbleHidden && (
            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
              <ChevronRight className="w-6 h-6 text-black/70" />
            </div>
          )}
        </div>

        {/* Actions row below avatar - emotion actions OR yawn nudge (mutually exclusive) */}
        {emotionActive && (
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              className={`h-9 w-9 rounded-full border-2 border-black ${wrongActions.has('water') ? 'bg-red-500 text-black hover:bg-red-500 active:bg-red-500 focus:bg-red-500 focus-visible:bg-red-500' : `bg-white/80 ${pulseClasses}`}`}
              style={{ animationDelay: actionPulseDelays.water }}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (emotionActive && emotionRequiredAction && emotionRequiredAction !== 'water') {
                  setWrongActions(prev => new Set(prev).add('water'));
                }
              }}
              onClick={(e) => { 
                e.stopPropagation(); 
                if (emotionActive && emotionRequiredAction && emotionRequiredAction !== 'water') {
                  setWrongActions(prev => new Set(prev).add('water'));
                }
                onEmotionAction?.('water');
              }}
              aria-label="Give water"
            >
              <Droplet className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className={`h-9 w-9 rounded-full border-2 border-black ${wrongActions.has('pat') ? 'bg-red-500 hover:bg-red-500 active:bg-red-500 focus:bg-red-500 focus-visible:bg-red-500' : `bg-white/80 ${pulseClasses}`}`}
              style={{ animationDelay: actionPulseDelays.pat }}
              onClick={(e) => { 
                e.stopPropagation(); 
                startPetting();
                if (emotionActive && emotionRequiredAction && emotionRequiredAction !== 'pat') {
                  setWrongActions(prev => new Set(prev).add('pat'));
                }
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (emotionActive && emotionRequiredAction && emotionRequiredAction !== 'pat') {
                  setWrongActions(prev => new Set(prev).add('pat'));
                }
              }}
              aria-label="Pat pet"
            >
              <Hand className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className={`h-9 w-9 rounded-full border-2 border-black ${wrongActions.has('feed') ? 'bg-red-500 text-white hover:bg-red-500 active:bg-red-500 focus:bg-red-500 focus-visible:bg-red-500' : `bg-white/80 ${pulseClasses}`}`}
              style={{ animationDelay: actionPulseDelays.feed }}
              onPointerDown={(e) => { 
                e.stopPropagation(); 
                if (emotionActive && emotionRequiredAction && emotionRequiredAction !== 'feed') {
                  setWrongActions(prev => new Set(prev).add('feed'));
                }
              }}
              onClick={(e) => { 
                e.stopPropagation(); 
                if (emotionActive && emotionRequiredAction && emotionRequiredAction !== 'feed') {
                  setWrongActions(prev => new Set(prev).add('feed'));
                }
                onEmotionAction?.('feed');
              }}
              aria-label="Feed pet"
            >
              <Utensils className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Yawn mode: no separate row; the top-right speaker handles voice */}

        {/* Close the avatar+actions wrapper */}
        </div>

        {/* AI bubble moved inside avatar wrapper when hidden */}
      </div>
    </div>
  );
};

export default LeftPetOverlay;

const SpellBoxPromptInline: React.FC<{
  text: string;
  onNext?: () => void;
  highlightNext?: boolean;
  isDisabled?: boolean;
}> = ({ text, onNext, highlightNext, isDisabled }) => {
  React.useEffect(() => {
    if (!text) return;
    // Do not stop current audio if non-Krafty is suppressed (e.g., trainer speaking)
    try { if (!ttsService.isNonKraftySuppressed?.()) { ttsService.stop(); } } catch {}
    const selectedVoice = (() => {
      try { return ttsService.getSelectedVoice?.().id; } catch { return undefined; }
    })();
    const selectedSpeed = (() => {
      try { return ttsService.getSelectedSpeed?.(); } catch { return undefined; }
    })() || 0.8;
    ttsService.speak(text, {
      // Mark as non-Krafty so it respects suppression during trainer overlays
      messageId: 'whiteboard-prompt',
      voice: selectedVoice,
      stability: 0.7,
      similarity_boost: 0.9,
      speed: selectedSpeed,
    }).catch(() => {});
  }, [text]);

  return (
    <div className="relative">
      <div
        className="pointer-events-auto whitespace-pre-wrap"
        style={{ fontFamily: 'Fredoka, sniglet, "Comic Sans MS", system-ui, -apple-system, sans-serif', fontSize: 20, lineHeight: 1.5 }}
      >
        {text}
      </div>
      {onNext && (
        <div className="absolute top-1/2 -translate-y-1/2 -right-[60px]">
          <Button
            variant="comic"
            size="icon"
            aria-label="Next"
            disabled={isDisabled}
            onClick={() => {
              if (isDisabled) return;
              playClickSound();
              onNext();
            }}
            className={`h-10 w-10 rounded-full shadow-[0_4px_0_rgba(0,0,0,0.6)] ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105'} ${highlightNext && !isDisabled ? 'animate-[wiggle_1s_ease-in-out_infinite] ring-4 ring-yellow-300' : ''}`}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  );
};


