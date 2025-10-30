import React from "react";
import { Button } from "@/components/ui/button";
import { ttsService } from "@/lib/tts-service";

export type SpellReviewItem = {
  word: string;
  emoji?: string;
  firstTryCorrect: boolean;
};

interface SpellReviewModalProps {
  open: boolean;
  items: SpellReviewItem[];
  onCompleted: () => void; // Called after finishing rights stage
}

const SpellReviewModal: React.FC<SpellReviewModalProps> = ({ open, items, onCompleted }) => {
  const [stage, setStage] = React.useState<'wrongs' | 'rights'>('wrongs');
  const wrongItems = React.useMemo(() => items.filter(i => !i.firstTryCorrect), [items]);
  const rightItems = React.useMemo(() => items.filter(i => i.firstTryCorrect), [items]);
  const [wrongIndex, setWrongIndex] = React.useState<number>(0);

  // Reset stage and index whenever items change/open toggles
  React.useEffect(() => {
    if (!open) return;
    // Start at wrongs if any, else jump to rights
    if (wrongItems.length > 0) {
      setStage('wrongs');
      setWrongIndex(0);
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
    try { ttsService.stop(); } catch {}
    ttsService.speak(current.word).catch(() => {});
    return () => {
      try { ttsService.stop(); } catch {}
    };
  }, [open, stage, wrongIndex, wrongItems]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/60" />
      <div className="absolute inset-0 flex flex-col">
        {/* Header */}
        <div className="shrink-0 px-4 py-3 sm:px-6 sm:py-4 bg-white/95 border-b border-black/10 backdrop-blur-md">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="text-lg sm:text-xl font-bold">
              {stage === 'wrongs' ? 'Let’s review tricky words' : 'Great job! Words you got right'}
            </div>
            <div className="text-sm text-black/60">
              {stage === 'wrongs' && wrongItems.length > 0 ? `${wrongIndex + 1} of ${wrongItems.length}` : `${rightItems.length} words`}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
            {stage === 'wrongs' ? (
              <div className="w-full flex flex-col items-center gap-4">
                {wrongItems[wrongIndex] && (
                  <div className="w-full max-w-md rounded-3xl border-2 border-foreground bg-white p-6 shadow-[0_10px_0_rgba(0,0,0,0.6)] text-center">
                    <div className="text-4xl md:text-5xl font-extrabold tracking-wider">{wrongItems[wrongIndex].word}</div>
                    {wrongItems[wrongIndex].emoji && (
                      <div className="mt-2 text-4xl" aria-hidden>{wrongItems[wrongIndex].emoji}</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {rightItems.map((it, idx) => (
                  <div key={`${it.word}-${idx}`} className="rounded-2xl border-2 border-foreground bg-white p-4 shadow-[0_6px_0_rgba(0,0,0,0.6)] text-center">
                    <div className="text-xl font-bold tracking-wide break-words">{it.word}</div>
                    {!!it.emoji && <div className="mt-1 text-2xl" aria-hidden>{it.emoji}</div>}
                  </div>
                ))}
                {rightItems.length === 0 && (
                  <div className="col-span-full text-center text-black/70">No right-on-first-try words this time.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-3 sm:px-6 sm:py-4 bg-white/95 border-t border-black/10 backdrop-blur-md">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
            {stage === 'wrongs' ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (wrongIndex > 0) {
                      setWrongIndex(wrongIndex - 1);
                    } else {
                      // No-op at start
                    }
                  }}
                  className="btn-animate"
                  disabled={wrongIndex <= 0}
                >
                  Back
                </Button>
                <div className="flex-1" />
                <Button
                  variant="default"
                  onClick={() => {
                    if (wrongIndex < wrongItems.length - 1) {
                      setWrongIndex(wrongIndex + 1);
                    } else {
                      // Move to rights stage
                      try { ttsService.stop(); } catch {}
                      setStage('rights');
                    }
                  }}
                  className="btn-animate"
                >
                  Next
                </Button>
              </>
            ) : (
              <>
                <div className="flex-1" />
                <Button
                  variant="default"
                  onClick={() => {
                    try { ttsService.stop(); } catch {}
                    onCompleted();
                  }}
                  className="btn-animate"
                >
                  Done
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpellReviewModal;


