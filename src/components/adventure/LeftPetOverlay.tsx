import React from "react";
import { Button } from "@/components/ui/button";
import { Volume2, Square, X } from "lucide-react";
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
  const hasInlineQuestion = React.useMemo(() => {
    return Boolean(spellInline?.show && !!spellInline?.question);
  }, [spellInline?.show, spellInline?.question]);

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

  // When a question becomes active, force-show the bubble and clear any hidden reason
  React.useEffect(() => {
    if (hasInlineQuestion) {
      setIsBubbleHidden(false);
      setHiddenReason(null);
    }
  }, [hasInlineQuestion]);

  // If we were auto-hidden, show again when a new AI message arrives
  React.useEffect(() => {
    if (hiddenReason === 'auto' && aiMessageHtml && aiMessageHtml !== hiddenAtHtmlRef.current) {
      setIsBubbleHidden(false);
      setHiddenReason(null);
    }
  }, [aiMessageHtml, hiddenReason]);

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
        {/* Pet avatar */}
        <div
          className="pointer-events-auto w-[240px] h-[240px] rounded-xl overflow-hidden shadow-[0_6px_0_rgba(0,0,0,0.6)] border-2 border-black bg-white/70 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            setIsBubbleHidden(false);
            setHiddenReason(null);
          }}
        >
          {petImageUrl ? (
            <img src={petImageUrl} alt="Pet" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-100" />
          )}
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


