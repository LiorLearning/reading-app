import React from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';
import { getLessonScript } from '@/data/lesson-scripts';
import SpellBox from '@/components/comic/SpellBox';
import { trackEvent } from '@/lib/feedback-service';
import { useRealtimeSession } from '@/hooks/useRealtimeSession';
import { ttsService, AVAILABLE_VOICES } from '@/lib/tts-service';
import { getGlobalSpellingLessonNumber } from '@/lib/questionBankUtils';

interface WhiteboardLessonProps {
  topicId: string;
  onCompleted: () => void;
  sendMessage?: (text: string) => void;
  interruptRealtimeSession?: () => void;
}

// A minimal whiteboard surface with model-then-practice flow.
// v0 keeps visuals simple; we can enhance animations later.
const WhiteboardLesson: React.FC<WhiteboardLessonProps> = ({ topicId, onCompleted, sendMessage: parentSendMessage, interruptRealtimeSession }) => {
  const script = getLessonScript(topicId);
  const [segmentIndex, setSegmentIndex] = React.useState(0);
  const hasSegments = !!(script?.segments && script.segments.length > 0);
  const segment = hasSegments ? script!.segments![segmentIndex] : null;
  const modelWord = hasSegments ? segment!.modelWord : (script?.modelWord || script?.model?.word);
  const steps = hasSegments ? (segment?.modelSteps || []) : (script?.modelSteps || []);
  const hasMultiSteps = !!(steps && steps.length > 0 && modelWord);
  const [phase, setPhase] = React.useState<'intro' | 'model' | 'practice' | 'done'>('intro');
  const [modelStepIndex, setModelStepIndex] = React.useState(0);
  const [practiceIndex, setPracticeIndex] = React.useState(0);
  const [canContinue, setCanContinue] = React.useState(false);
  const hasSpokenIntroRef = React.useRef(false);
  const hasSpokenModelRef = React.useRef(false);
  const hasSpokenPracticeRef = React.useRef<Record<number, boolean>>({});

  // Dedicated realtime narrator for whiteboard to avoid cross-talk with pet agent
  const { status: rtStatus, sendMessage: narratorSpeak } = useRealtimeSession({
    isAudioPlaybackEnabled: true,
    enabled: true,
    agentName: 'whiteboardNarrator',
    agentVoice: 'sage',
    agentInstructions:
      `You are a non-interactive narrator for a kids whiteboard lesson. 
Speak exactly the provided user text verbatim. Do not add extra words, questions, or commentary. 
If the text contains phoneme slashes like /g/ /r/, articulate them as phoneme sounds. 
Never initiate conversation; only speak the text you receive.`,
  });
  const speak = narratorSpeak; // Keep realtime only for phoneme playback

  // Resolve Jessica voice ID once (for verbatim ElevenLabs narration)
  const jessicaVoiceId = React.useMemo(() => {
    const v = AVAILABLE_VOICES.find(v => v.name === 'Jessica');
    return v?.id || 'cgSgspJ2msm6clMCkdW9';
  }, []);

  // Deterministic numeric id from a string (to keep compatibility with SpellBox's numeric id)
  const computeNumericId = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0; // Convert to 32-bit int
    }
    return Math.abs(hash);
  };

  React.useEffect(() => {
    // Start lesson; remain on intro until user taps Next
    trackEvent('lesson_whiteboard_start', { topicId });
  }, [topicId]);

  // Speak scripted lines. For exact phrasing, intro and practice use ElevenLabs; model steps use narrator.
  React.useEffect(() => {
    if (!script) return;
    if (phase === 'intro' && !hasSpokenIntroRef.current) {
      hasSpokenIntroRef.current = true;
      try { ttsService.stop(); } catch {}
      ttsService.speak(script.intro.join(' '), {
        messageId: 'krafty-whiteboard-intro',
        voice: jessicaVoiceId,
        stability: 0.7,
        similarity_boost: 0.9,
        speed: 0.7,
      }).catch(() => {});
    }
    if (phase === 'model') {
      // speak each step on entry or when index changes; keep short
      try { ttsService.stop(); } catch {}
      if (hasMultiSteps) {
        if (rtStatus === 'CONNECTED' && steps[modelStepIndex]) {
          speak(steps[modelStepIndex].say);
        }
      } else if (!hasSpokenModelRef.current) {
        hasSpokenModelRef.current = true;
        const line = script.model!.voice.join(' ');
        ttsService.speak(line, {
          messageId: 'krafty-whiteboard-model',
          voice: jessicaVoiceId,
          stability: 0.7,
          similarity_boost: 0.9,
          speed: 0.7,
        }).catch(() => {});
      }
    }
    // Speak the practice prompt verbatim once via ElevenLabs
    const practiceKey = hasSegments ? segmentIndex : practiceIndex;
    if (phase === 'practice' && !hasSpokenPracticeRef.current[practiceKey]) {
      hasSpokenPracticeRef.current[practiceKey] = true;
      const p = hasSegments ? segment!.practice : script!.practice![practiceIndex];
      try { ttsService.stop(); } catch {}
      ttsService.speak(p.prompt, {
        messageId: 'krafty-whiteboard-practice',
        voice: jessicaVoiceId,
        stability: 0.7,
        similarity_boost: 0.9,
        speed: 0.7,
      }).catch(() => {});
    }
  }, [phase, practiceIndex, script, rtStatus, modelStepIndex, hasMultiSteps, hasSegments, segmentIndex, steps, jessicaVoiceId]);

  if (!script) return null;

  const currentPractice = hasSegments ? segment!.practice : script!.practice![practiceIndex];

  return (
    <div className="absolute inset-y-0 right-0 w-1/2 bg-transparent flex flex-col" style={{ zIndex: 20 }}>

      {/* Board */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 overflow-hidden bg-white">
          {/* Soft brand gradient + vignette backdrop inside board */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, hsl(var(--book-page-light)), hsl(var(--book-page-main)))' }} />
            <div className="absolute inset-0" style={{ background: 'radial-gradient(100% 60% at 50% 0%, hsl(var(--primary)/0.08), transparent 70%)' }} />
            <>
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: 'url(/backgrounds/random2.png)',
                  backgroundRepeat: 'repeat',
                  backgroundSize: '260px 260px',
                  opacity: phase === 'intro' ? 0.3 : 0.15
                }}
              />
              {/* Subtle theme-colored film over pattern */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: 'hsl(var(--primary) / 0.10)',
                  mixBlendMode: 'multiply'
                }}
              />
            </>
          </div>
          {/* Context chip now shown in top header; removed from whiteboard panel */}
          {/* Content area */}
          <div className="relative z-10 h-full w-full p-6 flex flex-col items-center justify-center gap-6">
            {phase === 'intro' && (
              <div className="w-full max-w-2xl mx-auto">
                <div className="rounded-3xl p-6 sm:p-8 bg-white ring-1 ring-[hsl(var(--border))] shadow-xl">
                  {/* Lesson header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-3xl sm:text-4xl font-extrabold tracking-tight font-kids leading-tight">Lesson {(() => { const n = getGlobalSpellingLessonNumber(topicId); return n || 1; })()}</div>
                  </div>
                  {/* What you will learn */}
                  <div className="text-xl sm:text-2xl leading-relaxed text-gray-900" style={{fontFamily:'system-ui, -apple-system, sans-serif'}}>
                    You will learn <span className="font-semibold text-[hsl(var(--primary))]">{script.title.toLowerCase()}</span> in words like <span className="font-semibold text-[hsl(var(--primary))]">{modelWord}</span>.
                  </div>
                  {/* Actions */}
                  <div className="mt-6 flex justify-end">
                    <button
                      className="px-5 py-2 rounded-xl border-2 border-black bg-primary text-primary-foreground shadow-md"
                      onClick={() => setPhase('model')} 
                    >
                      Start
                    </button>
                  </div>
                </div>
              </div>
            )}

            {phase === 'model' && hasMultiSteps && (
              <div className="flex flex-col items-center gap-3">
                <div className="text-4xl md:text-5xl font-bold tracking-wider">
                  {modelWord!.split('').map((ch, idx) => {
                    const highlights = steps[modelStepIndex].highlights;
                    const isHighlighted = highlights.some(([s,e]) => idx >= s && idx < e);
                    return (
                      <span
                        key={idx}
                        className={isHighlighted ? 'px-1 rounded-md bg-[hsl(var(--primary)/0.25)] text-[hsl(var(--primary))] shadow-[0_0_0_2px_hsl(var(--primary)/0.2)_inset]' : ''}
                        onClick={() => {
                          if (isHighlighted) {
                            try { ttsService.stop(); } catch {}
                            speak(steps[modelStepIndex].say);
                          }
                        }}
                      >
                        {ch}
                      </span>
                    );
                  })}
                </div>
                <div className="text-center text-base max-w-xl">
                  <div className="mb-1">{steps[modelStepIndex].say}</div>
                </div>
                <div className="flex gap-3">
                  <button
                    className="mt-2 rounded-full p-3 border-2 border-black bg-black text-white transition-transform duration-150 hover:scale-110"
                    onClick={() => {
                      try { ttsService.stop(); } catch {}
                      speak(steps[modelStepIndex].say);
                    }}
                    aria-label="Replay step"
                  >
                    <RotateCcw className="h-5 w-5" />
                  </button>
                  <button
                    className="mt-2 rounded-full p-3 border-2 border-black bg-primary text-primary-foreground shadow-[0_4px_0_rgba(0,0,0,0.6)] ring-2 ring-[hsl(var(--primary)/0.35)] transition-transform duration-150 hover:scale-110"
                    onClick={() => {
                      const next = modelStepIndex + 1;
                      if (next < steps.length) {
                        setModelStepIndex(next);
                        // speak next line automatically when rt connected (effect will handle)
                      } else {
                        setPhase('practice');
                      }
                    }}
                    aria-label="Next"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
            {phase === 'model' && !hasMultiSteps && (
              <div className="flex flex-col items-center gap-3">
                <div className="text-4xl md:text-5xl font-bold tracking-wider">
                  {script!.model!.word.split('').map((ch, idx) => {
                    const [s, e] = script!.model!.highlight;
                    const isBlend = idx >= s && idx < e;
                    return (
                      <span key={idx} className={isBlend ? 'px-1 rounded-md bg-[hsl(var(--primary)/0.25)] text-[hsl(var(--primary))]' : ''}>{ch}</span>
                    );
                  })}
                </div>
                <div className="text-center text-base max-w-xl">
                  {script!.model!.voice.map((line, i) => (
                    <div key={i} className="mb-1">{line}</div>
                  ))}
                </div>
                <button
                  className="mt-2 rounded-full p-3 border-2 border-black bg-primary text-primary-foreground shadow-[0_4px_0_rgba(0,0,0,0.6)] ring-2 ring-[hsl(var(--primary)/0.35)] transition-transform duration-150 hover:scale-110"
                  onClick={() => setPhase('practice')}
                  aria-label="Next"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}

            {phase === 'practice' && currentPractice && (
              <div className="w-full max-w-xl flex flex-col items-center gap-4">
                <div className="text-base">{currentPractice.prompt}</div>
                <SpellBox
                  variant="overlay"
                  isVisible={true}
                  question={{
                    id: computeNumericId(`${modelWord || ''}|${currentPractice.word}`),
                    word: currentPractice.word,
                    questionText: currentPractice.prompt,
                    correctAnswer: currentPractice.word.toUpperCase(),
                    audio: currentPractice.word,
                    explanation: '',
                    isPrefilled: (currentPractice as any).isPrefilled,
                    prefilledIndexes: (currentPractice as any).prefilledIndexes,
                  }}
                  showHints={true}
                  showExplanation={false}
                  nextUnlockDelayMs={4500}
                  onComplete={(ok) => {
                    if (ok) {
                      trackEvent('lesson_practice_completed', { topicId, word: currentPractice.word, index: practiceIndex });
                      setCanContinue(true);
                      // Reinforce with realtime phoneme playback
                      try { ttsService.stop(); } catch {}
                      if (rtStatus === 'CONNECTED') {
                        const scripted = (currentPractice as any).reinforce as string | undefined;
                        if (scripted && scripted.trim().length > 0) {
                          speak(scripted);
                        } else {
                          const baseWord = ((modelWord as string) || currentPractice.word || '').toLowerCase();
                          let spoken = 'Great,';
                          if (baseWord) {
                            // Try to use the first multi-letter highlight across steps; fallback to first two letters
                            let blend = '';
                            if (hasMultiSteps) {
                              const currentSteps = hasSegments ? script!.segments![segmentIndex].modelSteps : (script!.modelSteps || []);
                              let found: [number, number] | null = null;
                              for (const st of currentSteps) {
                                const multi = (st.highlights || []).find(([s,e]) => (e - s) >= 2);
                                if (multi) { found = multi; break; }
                              }
                              if (found) {
                                const [s,e] = found;
                                blend = baseWord.slice(s, e);
                              } else {
                                blend = baseWord.slice(0, Math.min(2, baseWord.length));
                              }
                            } else {
                              blend = baseWord.slice(0, Math.min(2, baseWord.length));
                            }
                            const remainder = baseWord.slice(blend.length).split('');
                            const phonemes = [`/${blend}/`, ...remainder.map(ch => `/${ch}/`)];
                            spoken = `Great, ${phonemes.join(' ')}, ${baseWord}.`;
                          }
                          speak(spoken);
                        }
                      }
                    }
                  }}
                  onNext={() => {
                    // For segmented lessons, advance to next segment; otherwise exit
                    if (hasSegments) {
                      const nextSeg = segmentIndex + 1;
                      if (nextSeg < (script!.segments!.length)) {
                        setSegmentIndex(nextSeg);
                        setModelStepIndex(0);
                        setPhase('model');
                        return;
                      }
                    }
                    // Exit whiteboard after the final segment or non-segment lesson
                    trackEvent('lesson_completed', { topicId });
                    onCompleted();
                  }}
                  sendMessage={parentSendMessage}
                  interruptRealtimeSession={interruptRealtimeSession}
                  />
                {/* Continue CTA aligned to bottom via outer layout; here as a fallback */}
              </div>
            )}

            {phase === 'done' && (
              <div className="text-center text-base max-w-xl">
                {script.completion.map((line, i) => (
                  <div key={i} className="mb-1">{line}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* No sticky footer in lesson mode; navigation happens via SpellBox Next chevron */}
    </div>
  );
};

export default WhiteboardLesson;


