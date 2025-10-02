import React from "react";
import { Button } from "@/components/ui/button";
import { Volume2, Square, X, Droplet, Hand, Utensils } from "lucide-react";
import { ttsService, AVAILABLE_VOICES } from "@/lib/tts-service";
import SpellBox from "@/components/comic/SpellBox";
import { cn } from "@/lib/utils";

interface LeftPetOverlayProps {
  petImageUrl: string | null | undefined;
  aiMessageHtml?: string;
  isThinking?: boolean;
  draggable?: boolean;
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
    } | null;
    show?: boolean;
    showHints?: boolean;
    showExplanation?: boolean;
    onComplete?: (isCorrect: boolean, userAnswer?: string, attemptCount?: number) => void;
    onSkip?: () => void;
    onNext?: () => void;
    sendMessage?: (text: string) => void;
  };
  // Emotion/heart UI
  emotionActive?: boolean;
  emotionRequiredAction?: 'water' | 'pat' | 'feed' | null;
  onEmotionAction?: (action: 'water' | 'pat' | 'feed') => void;
  // Optional temporary media to overlay inside avatar (e.g., GIF/video)
  overridePetMediaUrl?: string | null;
}

export const LeftPetOverlay: React.FC<LeftPetOverlayProps> = ({
  petImageUrl,
  aiMessageHtml,
  isThinking = false,
  draggable = true,
  autoHideToken,
  onBubbleVisibilityChange,
  interruptRealtimeSession,
  spellInline,
  emotionActive = false,
  emotionRequiredAction = null,
  onEmotionAction,
  overridePetMediaUrl = null,
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = React.useState<{ left: number; top: number } | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
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

  // Start/stop helpers
  const startPetting = React.useCallback((startX?: number, startY?: number) => {
    setPettingActive(true);
    hasTriggeredPatRef.current = false;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { (navigator as any).vibrate?.(10); } catch {}
    }
    // Initial hand position roughly center if not provided
    if (overlayRef.current) {
      const rect = overlayRef.current.getBoundingClientRect();
      setHandPosition({ x: startX ?? rect.width / 2, y: startY ?? rect.height / 2 });
      lastStrokePointRef.current = { x: startX ?? rect.width / 2, y: startY ?? rect.height / 2 };
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
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
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

  // Keep track of the last AI message so we can restore it when user taps the pet
  React.useEffect(() => {
    if (aiMessageHtml) {
      lastAiHtmlRef.current = aiMessageHtml;
    }
  }, [aiMessageHtml]);

  React.useEffect(() => {
    // On mount, place near top-left with small inset
    if (!position && overlayRef.current && overlayRef.current.parentElement) {
      setPosition({ left: 16, top: 16 });
    }
  }, [position]);

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
    const newLeft = Math.min(Math.max(0, e.clientX - rect.left - 40), rect.width - 120);
    const newTop = Math.min(Math.max(0, e.clientY - rect.top - 40), rect.height - 120);
    setPosition({ left: newLeft, top: newTop });
  };

  const handleSpeak = async () => {
    if (isSpeakingRef.current) {
      ttsService.stop();
      isSpeakingRef.current = false;
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
        const parts = fullText
          .split(/(?<=[.!?])\s+/) // split but keep punctuation with previous chunk
          .map(p => p.trim())
          .filter(p => p.length > 0);
        const wordRegex = new RegExp(`\\b${escapeRegExp(normalizedWord)}\\b`, 'i');
        const match = parts.find(p => wordRegex.test(p));
        return match || fullText;
      };

      const visibleSentence = extractVisibleSentence(sentenceText, wordToSpeak);
      const textToSpeak = (visibleSentence || '').trim() || wordToSpeak;
      if (textToSpeak) {
        isSpeakingRef.current = true;
        try {
          await ttsService.speak(textToSpeak, {
            stability: 0.7,
            similarity_boost: 0.9,
            // Use a slightly slower speed only when we fall back to the isolated word
            speed: visibleSentence ? undefined : 0.7,
            messageId: visibleSentence
              ? `left-pet-inline-spellbox-sentence-${Date.now()}`
              : `left-pet-inline-spellbox-${wordToSpeak}`,
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
    isSpeakingRef.current = true;
    try {
      await ttsService.speakAIMessage(text, `left-pet-overlay-${Date.now()}`);
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

  const displayHtml = isBubbleHidden ? undefined : (aiMessageHtml || lastAiHtmlRef.current);

  // Publish visibility changes to parent (visible when bubble not hidden and there is content, thinking, or inline question)
  React.useEffect(() => {
    const visible = !isBubbleHidden && (!!displayHtml || !!isThinking || hasInlineQuestion);
    onBubbleVisibilityChange?.(visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBubbleHidden, !!displayHtml, isThinking, hasInlineQuestion]);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-20">
      <div
        ref={overlayRef}
        className={cn(
          "absolute flex items-center gap-3 select-none",
          draggable && "cursor-grab active:cursor-grabbing"
        )}
        style={{
          left: position ? `${position.left}px` : 16,
          top: position ? `${position.top}px` : "50%",
          transform: position ? undefined : "translateY(-50%)",
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerMove={onPointerMove}
      >
        {/* Pet avatar and actions */}
        <div className="pointer-events-auto flex flex-col items-center">
          <div
          className="relative w-[240px] h-[240px] rounded-xl overflow-hidden shadow-[0_6px_0_rgba(0,0,0,0.6)] border-2 border-black bg-white/70 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            // Only show bubble if it wasn't manually closed by the user
            if (!isManuallyClosed) {
              setIsBubbleHidden(false);
              setHiddenReason(null);
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            // Double-click to reset manual close state and show bubble
            setIsManuallyClosed(false);
            setIsBubbleHidden(false);
            setHiddenReason(null);
          }}
        >
          {/* Heart badge - top-right inside avatar */}
          <div className="absolute top-2 right-2 z-10">
            <div className="relative w-8 h-8">
              <svg viewBox="0 0 24 24" className="absolute inset-0 w-full h-full text-red-600">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <svg viewBox="0 0 24 24" className="absolute inset-0 w-full h-full">
                <defs>
                  <clipPath id="half-heart-clip">
                    <rect x="12" y="0" width="12" height="24" />
                  </clipPath>
                </defs>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" 
                  className="text-red-600" fill="currentColor" 
                  clipPath={emotionActive ? "url(#half-heart-clip)" : undefined} opacity={0.9} />
              </svg>
            </div>
          </div>

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
        </div>

        {/* Actions row below avatar - visible only when emotion active */}
        {emotionActive && (
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              className={`h-9 w-9 rounded-full border-2 border-black bg-white/80`}
              onClick={(e) => { e.stopPropagation(); onEmotionAction?.('water'); }}
              aria-label="Give water"
            >
              <Droplet className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className={`h-9 w-9 rounded-full border-2 border-black bg-white/80`}
              onClick={(e) => { 
                e.stopPropagation(); 
                startPetting();
              }}
              aria-label="Pat pet"
            >
              <Hand className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className={`h-9 w-9 rounded-full border-2 border-black bg-white/80`}
              onClick={(e) => { e.stopPropagation(); onEmotionAction?.('feed'); }}
              aria-label="Feed pet"
            >
              <Utensils className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Close the avatar+actions wrapper */}
        </div>

        {/* AI bubble to the right of pet */}
        {!isBubbleHidden && (
        <div className="pointer-events-auto relative">
          <div className="bg-white/95 border-2 border-black rounded-2xl shadow-[0_6px_0_rgba(0,0,0,0.6)] px-4 py-3 max-w-[360px]">
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
              <div className="text-base leading-relaxed">
                {spellInline?.show && spellInline?.word ? (
                  <SpellBox
                    variant="inline"
                    isVisible={true}
                    word={spellInline.word || undefined}
                    sentence={spellInline.sentence || undefined}
                    question={spellInline.question || undefined}
                    onComplete={spellInline.onComplete}
                    onSkip={spellInline.onSkip}
                    onNext={spellInline.onNext}
                    showHints={spellInline.showHints}
                    showExplanation={spellInline.showExplanation}
                    sendMessage={spellInline.sendMessage}
                    interruptRealtimeSession={interruptRealtimeSession}
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
                aria-label="Play audio"
              >
                {isSpeakingRef.current ? <Square className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
              </Button>
            )}
          </div>
          {/* Tail pointing to pet */}
          <div className="absolute left-[-10px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[10px] border-b-[10px] border-r-[10px] border-t-transparent border-b-transparent border-r-black" />
          <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[9px] border-b-[9px] border-r-[9px] border-t-transparent border-b-transparent border-r-white" />
        </div>
        )}
      </div>
    </div>
  );
};

export default LeftPetOverlay;


