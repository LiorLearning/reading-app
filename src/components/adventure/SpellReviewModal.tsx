import React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ttsService } from "@/lib/tts-service";
import { ChevronRight, ChevronLeft, Check, X } from "lucide-react";

export type SpellReviewItem = {
  word: string;
  emoji?: string;
  firstTryCorrect: boolean;
  prefilledIndexes?: number[]; // Letters provided by the question; others were user-entered
};

interface SpellReviewModalProps {
  open: boolean;
  items: SpellReviewItem[];
  onCompleted: () => void; // Called after finishing rights stage
  onRequestClose?: () => void; // Optional red close button (e.g., from word list)
  ttsEnabled?: boolean; // Enable or disable TTS prompts (default: true)
  disableDelay?: boolean; // If true, enable controls immediately (skip 2s delay)
}

const SpellReviewModal: React.FC<SpellReviewModalProps> = ({ open, items, onCompleted, onRequestClose, ttsEnabled = true, disableDelay = false }) => {
  const [stage, setStage] = React.useState<'wrongs' | 'rights'>('wrongs');
  const wrongItems = React.useMemo(() => items.filter(i => !i.firstTryCorrect), [items]);
  const rightItems = React.useMemo(() => items.filter(i => i.firstTryCorrect), [items]);
  const [wrongIndex, setWrongIndex] = React.useState<number>(0);
  const [rightsNextEnabled, setRightsNextEnabled] = React.useState<boolean>(false);
  const [wrongsNextEnabled, setWrongsNextEnabled] = React.useState<boolean>(false);
  const jessicaVoiceId = 'cgSgspJ2msm6clMCkdW9';
  const didSpeakWrongsIntroRef = React.useRef<boolean>(false);

  // Reset stage and index whenever items change/open toggles
  React.useEffect(() => {
    if (!open) return;
    // Start at wrongs if any, else jump to rights
    if (wrongItems.length > 0) {
      setStage('wrongs');
      setWrongIndex(0);
      didSpeakWrongsIntroRef.current = false; // reset intro line for a new session
    } else {
      setStage('rights');
    }
  }, [open, wrongItems.length]);

  // Autoplay TTS for wrong items on reveal and when navigating
  React.useEffect(() => {
    if (!open) return;
    if (stage !== 'wrongs') return;
    const current = wrongItems[wrongIndex];
    if (!current) return;
    try { if (ttsEnabled) ttsService.stop(); } catch {}
    // Speak intro once on the first wrong item, then the word; otherwise just the word
    (async () => {
      if (!ttsEnabled) return;
      try {
        if (wrongIndex === 0 && !didSpeakWrongsIntroRef.current) {
          didSpeakWrongsIntroRef.current = true;
          await ttsService.speak("Here's a quick review", { voice: jessicaVoiceId });
        }
        await ttsService.speak(current.word, { voice: jessicaVoiceId });
      } catch {}
    })();
    // Delay enabling Next for focus on each wrong item
    if (disableDelay) {
      setWrongsNextEnabled(true);
      return () => { try { if (ttsEnabled) ttsService.stop(); } catch {} };
    }
    setWrongsNextEnabled(false);
    const timer = setTimeout(() => setWrongsNextEnabled(true), 2000);
    return () => {
      try { if (ttsEnabled) ttsService.stop(); } catch {}
      clearTimeout(timer);
    };
  }, [open, stage, wrongIndex, wrongItems, ttsEnabled, disableDelay]);

  // On entering rights stage: speak a short line (Jessica) and delay enabling Next by 2s
  React.useEffect(() => {
    if (!open) return;
    if (stage !== 'rights') return;
    // If there are no right items, don't speak any intro
    if ((rightItems || []).length === 0) {
      setRightsNextEnabled(true);
      try { if (ttsEnabled) ttsService.stop(); } catch {}
      return;
    }
    // Disable Next and enable after 2 seconds
    if (disableDelay) {
      setRightsNextEnabled(true);
    } else {
      setRightsNextEnabled(false);
    }
    const timer = disableDelay ? null : setTimeout(() => setRightsNextEnabled(true), 2000);
    // Speak intro line via ElevenLabs
    try { if (ttsEnabled) ttsService.stop(); } catch {}
    if (ttsEnabled) {
      ttsService.speak('and here are the ones you already knew!', { voice: jessicaVoiceId }).catch(() => {});
    }
    return () => {
      if (timer) clearTimeout(timer);
      try { if (ttsEnabled) ttsService.stop(); } catch {}
    };
  }, [open, stage, rightItems, ttsEnabled, disableDelay]);

  if (!open) return null;

  // Render in a portal to avoid clipping by transformed ancestors
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {/* Darker scrim to de-emphasize background */}
      <div className="absolute inset-0 bg-black/80" />

      {/* Centered card below header/progress bar */}
      <div className="absolute inset-x-0 top-[96px] bottom-6 flex justify-center px-4 sm:px-8">
        <div
          className="relative w-full max-w-[88vw] sm:max-w-[720px] md:max-w-[820px] lg:max-w-[900px] rounded-3xl border-2 border-foreground ring-2 ring-[hsl(var(--primary)/0.25)] overflow-hidden max-h-[72vh] sm:max-h-[74vh] lg:max-h-[70vh] backdrop-blur-[2px] bg-white"
        >
          {/* Optional red close button (only when onRequestClose is provided) */}
          {onRequestClose && (
            <div className="absolute top-3 right-3 z-[2]">
              <Button
                variant="outline"
                size="icon"
                aria-label="Close"
                className="w-9 h-9 rounded-full border-2 border-red-700 bg-red-600 text-white shadow-[0_4px_0_rgba(0,0,0,0.5)]"
                onClick={() => {
                  try { ttsService.stop(); } catch {}
                  onRequestClose();
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          {/* Lesson chip - top-left */}
          <div className="absolute top-3 left-4 z-[1]">
            <div className="px-3 py-1 rounded-full bg-white/90 text-slate-800 border border-foreground/40 text-xl sm:text-md font-semibold shadow-sm">
              Word Review <span aria-hidden>📝</span>
            </div>
          </div>
          {/* Theme tint overlay to match whiteboard */}
          <div className="pointer-events-none absolute inset-0" style={{
            background: 'linear-gradient(180deg, hsl(var(--primary) / 0.06), rgba(255,255,255,0.85))'
          }} />
          {/* Tiled pattern overlay (random2.png) */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: "url(/backgrounds/random2.png)",
              backgroundRepeat: 'repeat',
              backgroundSize: '260px 260px',
              opacity: 0.15
            }}
          />
          {/* Gentle vignette toward edges for focus */}
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.10) 100%)' }} />

          {/* Body layout: center word; buttons bottom-right */}
          <div className="relative h-full overflow-y-auto p-6 sm:p-10 flex flex-col items-center justify-center">
          {stage === 'wrongs' ? (
            <div className="w-full flex flex-col items-center justify-center flex-1">
              {wrongItems[wrongIndex] && (
                <div className="w-full text-center select-none">
                  {/* Word in boxed layout with green reinforcement for user-entered letters */}
                  <div className="inline-flex items-center gap-2 leading-none">
                    {wrongItems[wrongIndex].word.split('').map((ch, idx) => {
                      const isPrefilled = (wrongItems[wrongIndex].prefilledIndexes || []).includes(idx);
                      const base = 'text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-wider px-3 py-1 rounded-xl';
                      const style = isPrefilled
                        ? 'text-[#1F2937] border-2 border-dashed border-[#9CA3AF] bg-[linear-gradient(135deg,#F3F4F6_0%,#E5E7EB_100%)]'
                        : 'text-[#15803D] border-[3px] border-[#22C55E] shadow-[0_4px_12px_rgba(34,197,94,0.2)] bg-[linear-gradient(135deg,#DCFCE7_0%,#BBF7D0_100%)]';
                      return (
                        <span key={`${ch}-${idx}`} className={`${base} ${style}`}>{ch}</span>
                      );
                    })}
                    {wrongItems[wrongIndex].emoji && (
                      <span className="text-5xl md:text-6xl ml-1" aria-hidden>{wrongItems[wrongIndex].emoji}</span>
                    )}
                  </div>
                </div>
              )}
              {/* Bottom-right compact controls */}
              <div className="absolute right-5 bottom-5 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="w-10 h-10 rounded-full border-2 border-black bg-black text-white shadow-[0_4px_0_rgba(0,0,0,0.5)]"
                  aria-label="Back"
                  disabled={wrongIndex <= 0}
                  onClick={() => {
                    if (wrongIndex > 0) setWrongIndex(wrongIndex - 1);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="w-10 h-10 rounded-full border-2 border-foreground bg-teal-500 text-white shadow-[0_4px_0_rgba(0,0,0,0.5)]"
                  aria-label="Next"
                  disabled={!wrongsNextEnabled}
                  onClick={() => {
                    if (wrongIndex < wrongItems.length - 1) {
                      setWrongIndex(wrongIndex + 1);
                    } else {
                      try { ttsService.stop(); } catch {}
                      setStage('rights');
                    }
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col items-center justify-center">
              <div className="grid w-fit mx-auto grid-cols-[repeat(2,max-content)] sm:grid-cols-[repeat(3,max-content)] md:grid-cols-[repeat(4,max-content)] gap-4 justify-center">
                {rightItems.map((it, idx) => (
                  <div key={`${it.word}-${idx}`} className="relative w-[164px] rounded-2xl border-2 border-foreground bg-white p-4 shadow-[0_6px_0_rgba(0,0,0,0.6)] text-center">
                    <div className="text-xl font-extrabold tracking-wide break-words text-slate-800">{it.word}</div>
                    {!!it.emoji && <div className="mt-1 text-2xl" aria-hidden>{it.emoji}</div>}
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-green-500 text-white grid place-items-center border border-black/30">
                      <Check className="w-3 h-3" />
                    </div>
                  </div>
                ))}
                {rightItems.length === 0 && (
                  <div className="col-span-full text-center text-black/70">No right-on-first-try words this time.</div>
                )}
              </div>
              {/* Bottom-right compact controls (replace Done) */}
              <div className="absolute right-5 bottom-5 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="w-10 h-10 rounded-full border-2 border-black bg-black text-white shadow-[0_4px_0_rgba(0,0,0,0.5)]"
                  aria-label="Back"
                  disabled={wrongItems.length === 0}
                  onClick={() => {
                    if (wrongItems.length > 0) {
                      setWrongIndex(Math.max(0, wrongItems.length - 1));
                      setStage('wrongs');
                    }
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="w-10 h-10 rounded-full border-2 border-foreground bg-teal-500 text-white shadow-[0_4px_0_rgba(0,0,0,0.5)]"
                  aria-label="Next"
                  disabled={!rightsNextEnabled}
                  onClick={() => {
                    try { ttsService.stop(); } catch {}
                    onCompleted();
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>,
    portalTarget
  );
};

export default SpellReviewModal;


