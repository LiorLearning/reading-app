import React from 'react';
import { getPetEmotionActionMedia } from '@/lib/pet-avatar-service';
import { PetProgressStorage } from '@/lib/pet-progress-storage';
import { ttsService } from '@/lib/tts-service';
import { muteAllUISounds, unmuteAllUISounds, pauseAllUISounds } from '@/lib/sounds';

interface PerPetStreakModalProps {
  open: boolean;
  onClose: () => void;
  petId: string;
  streak: number;
  slots: number[]; // length 5, values 0/1
}

export default function PerPetStreakModal(props: PerPetStreakModalProps): JSX.Element | null {
  const { open, onClose, petId, streak, slots } = props;
  if (!open) return null;

  const displayName = (() => {
    try { return PetProgressStorage.getPetDisplayName?.(petId) || petId; } catch { return petId; }
  })();

  const gifUrl = (() => {
    try { return getPetEmotionActionMedia(petId, 'pat'); } catch { return null; }
  })();

  const normSlots: number[] = Array.isArray(slots) && slots.length === 5
    ? slots.map((x) => (Number(x) ? 1 : 0))
    : [0,0,0,0,0];

  const lineText = (() => {
    const s = Math.max(0, Number(streak || 0));
    if (s <= 1) return `Day 1 with ${displayName}—see you tomorrow?`;
    if (s < 7) return `You're on a ${s}-day streak with ${displayName}! Keep it up!`;
    return `${s} days strong with ${displayName}! Amazing consistency—see you tomorrow?`;
  })();

  // Autoplay per-pet voice when opened; stop on close
  const hasSpokenRef = React.useRef<boolean>(false);
  React.useEffect(() => {
    if (!open) return;
    hasSpokenRef.current = false;
    try { pauseAllUISounds(); } catch {}
    try { muteAllUISounds(); } catch {}
    try { ttsService.setExclusiveStopGuard(true); } catch {}
    try { ttsService.stop(true); } catch {}
    try { ttsService.setSuppressNonKrafty(true); } catch {}

    // Resolve a voice for this pet
    let overrideVoice: string | undefined;
    try {
      overrideVoice = PetProgressStorage.getPreferredVoiceIdForPet?.(petId);
      if (!overrideVoice) {
        const PET_DEFAULT_VOICE_ID: Record<string, string> = {
          dog: 'cgSgspJ2msm6clMCkdW9',
          cat: 'ocZQ262SsZb9RIxcQBOj',
          hamster: 'ocZQ262SsZb9RIxcQBOj',
        };
        overrideVoice = PET_DEFAULT_VOICE_ID[petId];
      }
    } catch {}

    const lineToSpeak = lineText;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled || hasSpokenRef.current) return;
      hasSpokenRef.current = true;
      try {
        // Log start of audio playback
        console.log('[PerPetStreakModal] autoplay start', { petId, streak, message: lineToSpeak });
      } catch {}
      try {
        ttsService.speak(lineToSpeak, {
          voice: overrideVoice,
          stability: 0.6,
          similarity_boost: 0.85,
          speed: ttsService.getSelectedSpeed?.() || 0.7,
          // Mark as Krafty so it bypasses non-Krafty suppression while modal is open
          messageId: `krafty-perpet-streak-${petId}`,
        }).catch(() => {});
      } catch {}
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      try {
        // Log stop of audio playback
        console.log('[PerPetStreakModal] autoplay stop/cleanup', { petId });
      } catch {}
      try { ttsService.stop(true); } catch {}
      try { ttsService.setSuppressNonKrafty(false); } catch {}
      try { ttsService.setExclusiveStopGuard(false); } catch {}
      try { unmuteAllUISounds(); } catch {}
    };
  }, [open, petId, lineText, streak]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Wrapper to match main streak modal proportions */}
      <div className="relative mx-4 w-full max-w-[960px]">
        {/* Container */}
        <div className="relative rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-2xl min-h-[380px]">
          {/* Close */}
          <button
            aria-label="Close"
            className="absolute right-3 top-3 z-10 h-8 w-8 rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 active:scale-95"
            onClick={onClose}
          >
            ×
          </button>

          <div className="p-8 sm:p-10">
            {/* Streak large heart center */}
            <div className="flex items-center justify-center gap-4">
              <div className="text-6xl sm:text-6xl">❤️</div>
              <div className="flex items-baseline gap-2">
                <div className="text-5xl sm:text-5xl font-extrabold text-white drop-shadow">{Math.max(0, Number(streak || 0))}</div>
                <div className="text-xl sm:text-2xl font-semibold text-white/90 drop-shadow">
                  {/* placeholder for pluralization if needed */}
                </div>
              </div>
            </div>

            {/* Single pet GIF and name (centered, same spacing as main modal) */}
            {gifUrl ? (
              <div className="mt-6 sm:mt-8 flex items-center justify-center gap-8">
                <div className="flex flex-col items-center">
                  <img src={gifUrl} alt={displayName} className="h-36 sm:h-44 w-auto drop-shadow-xl" draggable={false} />
                  <div className="mt-2 text-white/90 text-base sm:text-lg font-semibold capitalize">
                    {displayName}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Five hearts row (slots) */}
            <div className="mt-6 sm:mt-8 flex items-center justify-center gap-4">
              {normSlots.map((v, idx) => (
                <div key={idx} className="text-3xl sm:text-4xl drop-shadow">{v ? '❤️' : '🤍'}</div>
              ))}
            </div>

            {/* Thought line (matches style of main modal) */}
            <div className="mt-6 sm:mt-8 px-6 sm:px-10">
              <div className="text-center text-white text-base sm:text-lg leading-relaxed drop-shadow">
                {lineText}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


