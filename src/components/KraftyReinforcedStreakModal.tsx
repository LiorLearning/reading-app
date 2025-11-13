import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { ttsService } from '@/lib/tts-service';
import { muteAllUISounds, unmuteAllUISounds, pauseAllUISounds } from '@/lib/sounds';
import { PetProgressStorage } from '@/lib/pet-progress-storage';
import { getPetEmotionActionMedia } from '@/lib/pet-avatar-service';

interface Props {
  open: boolean;
  onClose: () => void;
  currentStreak: number;
  celebrationUrl?: string;
}

function getLocalTodayDateString(): string {
  try {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch {
    return '';
  }
}

function getMondayOfCurrentWeek(): Date {
  const now = new Date();
  const day = now.getDay(); // 0 (Sun) .. 6 (Sat)
  const diff = (day === 0 ? -6 : 1 - day); // shift so Monday is start
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getWeekKey(d: Date): string {
  // key by Monday date
  return `week_${ymd(d)}`;
}

type WeeklyHearts = Record<string, boolean>; // YYYY-MM-DD -> filled

function loadWeeklyHearts(monday: Date): WeeklyHearts {
  try {
    const key = `litkraft_weekly_streak_hearts_${getWeekKey(monday)}`;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as WeeklyHearts) : {};
  } catch {
    return {};
  }
}

function saveWeeklyHearts(monday: Date, data: WeeklyHearts): void {
  try {
    const key = `litkraft_weekly_streak_hearts_${getWeekKey(monday)}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

export function markTodayHeartFilled(): void {
  try {
    const monday = getMondayOfCurrentWeek();
    const today = getLocalTodayDateString();
    const data = loadWeeklyHearts(monday);
    if (!today) return;
    if (!data[today]) {
      data[today] = true;
      saveWeeklyHearts(monday, data);
    }
  } catch {}
}

export default function KraftyReinforcedStreakModal(props: Props): JSX.Element | null {
  const { open, onClose, currentStreak, celebrationUrl } = props;
  const { userData } = useAuth();

  const monday = useMemo(() => getMondayOfCurrentWeek(), []);
  const labels = useMemo(() => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], []);
  const [weekly, setWeekly] = useState<WeeklyHearts>(() => loadWeeklyHearts(monday));
  const hasSpokenRef = React.useRef<boolean>(false);

  useEffect(() => {
    if (!open) return;
    // Reload weekly state when opened in case it changed elsewhere
    setWeekly(loadWeeklyHearts(monday));
  }, [open, monday]);

  // Listen for Firestore-driven weeklyHearts updates and merge into current week
  useEffect(() => {
    const handler = (e: any) => {
      try {
        const map = (e?.detail || JSON.parse(localStorage.getItem('litkraft_weekly_hearts') || '{}')) as Record<string, Record<string, boolean>>;
        const key = `week_${ymd(monday)}`;
        const week = (map && map[key]) || {};
        if (week && typeof week === 'object') {
          setWeekly((prev) => ({ ...prev, ...week }));
          // Also mirror to localStorage-backed per-week key for dev toggles/UI
          try {
            const merged = { ...loadWeeklyHearts(monday), ...week };
            saveWeeklyHearts(monday, merged);
          } catch {}
        }
      } catch {}
    };
    try { window.addEventListener('weeklyHeartsUpdated', handler as any); } catch {}
    // Also prime from localStorage cache on mount/open
    handler(null);
    return () => { try { window.removeEventListener('weeklyHeartsUpdated', handler as any); } catch {} };
  }, [monday]);

  if (!open) return null;

  const todayStr = getLocalTodayDateString();
  const userName = (userData?.username && userData.username.trim()) ? userData.username.trim() : 'friend';
  // Strict consecutive streak (no weekly fallback here)
  // Compute top 3 pets by current sleep streak for GIF showcase
  const topPetShowcase = useMemo(() => {
    try {
      const raw = localStorage.getItem('litkraft_pet_streaks');
      const perPet = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      const entries = Object.entries(perPet)
        .filter(([, v]) => Number.isFinite(Number(v)))
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 3);
      const names = ((userData as any)?.petnames || {}) as Record<string, string>;
      return entries.map(([pet, streak]) => {
        let url: string | null = null;
        try { url = getPetEmotionActionMedia(pet, 'pat'); } catch {}
        const fallback = (() => {
          try { return PetProgressStorage.getPetDisplayName?.(pet); } catch { return undefined; }
        })();
        const displayName = (names && typeof names[pet] === 'string' && names[pet]) ? names[pet] : (fallback || pet);
        return { pet, streak: Number(streak || 0), url: url || undefined, name: displayName };
      });
    } catch {
      return [] as Array<{ pet: string; streak: number; url?: string; name?: string }>;
    }
  }, [open, userData]);

  const displayStreak = useMemo(() => {
    try {
      let s = Math.max(0, Number(currentStreak || 0));
      // If today's heart is filled but streak is 0 (e.g., first day), show 1
      try {
        const today = getLocalTodayDateString();
        const isTodayFilled = !!weekly[today];
        if (s <= 0 && isTodayFilled) s = 1;
      } catch {}
      return s;
    } catch {
      return 0;
    }
  }, [currentStreak, weekly]);

  // Thoughts buckets
  const oneDayThoughts = useMemo(() => [
    `Thanks for taking care of us today, ${userName}! 💕 You just started our love streak—see you tomorrow?`,
    `You showed up for us, ${userName}! 🐾 Day 1 of our adventure together—will you come back tomorrow?`,
    `We loved our adventure today, ${userName}! 📚❤️ Our streak begins now—can't wait for Day 2, will you be there?`,
    `First pawprint on our calendar! 🐾 Thanks for starting this journey with us, ${userName}! Same time tomorrow?`,
    `You made our tail wag all day long, ${userName}! 🐶 Day 1 done—shall we continue our adventure tomorrow?`
  ], [userName]);

  const underSevenThoughts = useMemo(() => {
    const s = Math.max(2, displayStreak);
    return [
      `You're on a ${s}-heart love streak, ${userName}! 💖 Let's keep the adventures going tomorrow?`,
      `${s} hearts in a row with us? Best. Human. Ever. 🥹🐾 Will you go for the next one?`,
      `Our adventures are adding up—${s} hearts strong! ✨ See you tomorrow, ${userName}?`,
      `We're purring with pride, ${userName}! 😺 ${s}-day streak and growing—ready for tomorrow?`,
      `High paws! 🐾 ${s} hearts of care and cuddles—shall we make it ${s + 1} tomorrow?`
    ];
  }, [displayStreak, userName]);

  const sevenPlusThoughts = useMemo(() => {
    const s = Math.max(7, displayStreak);
    return [
      `A whole ${s} hearts with you, ${userName}! 🥳🎉 Love and adventures galore—coming back tomorrow?`,
      `${s} hearts strong, ${userName}! 💫 We feel so loved—shall we make it even bigger tomorrow?`,
      `We did it—${s}-heart streak! ❤️ Thanks for taking such good care of us, ${userName}! See you tomorrow?`,
      `Woof-wow! 🐶 ${s} hearts of cuddles and adventures—our hearts are full, ${userName}! Ready for day ${displayStreak + 1}?`,
      `One week and beyond! 🌟 ${s} happy hearts together—same time tomorrow, ${userName}?`
    ];
  }, [displayStreak, userName]);

  // Daily random selection with persistence (once per calendar day)
  const thoughtText = useMemo(() => {
    try {
      const key = `litkraft_streak_thought_${todayStr}`;
      const saved = localStorage.getItem(key);
      if (saved) return saved;
      let pool: string[] = [];
      if (displayStreak === 1) pool = oneDayThoughts;
      else if (displayStreak > 1 && displayStreak < 7) pool = underSevenThoughts;
      else pool = sevenPlusThoughts;
      const idx = Math.floor(Math.random() * pool.length);
      const chosen = pool[idx];
      localStorage.setItem(key, chosen);
      return chosen;
    } catch {
      // Fallback without persistence
      if (displayStreak === 1) return oneDayThoughts[0];
      if (displayStreak > 1 && displayStreak < 7) return underSevenThoughts[0];
      return sevenPlusThoughts[0];
    }
  }, [todayStr, displayStreak, oneDayThoughts, underSevenThoughts, sevenPlusThoughts]);

  // Infer pet from celebrationUrl for voice override
  function inferPetIdFromGifUrl(url?: string): string | undefined {
    if (!url) return undefined;
    const candidates = ['dog', 'cat', 'hamster', 'parrot', 'wolf', 'raccoon', 'monkey', 'dragon', 'unicorn', 'bobo', 'feather', 'pikachu', 'panda', 'deer', 'labubu'];
    const lower = url.toLowerCase();
    for (const id of candidates) {
      if (lower.includes(id)) return id;
    }
    return undefined;
  }

  // Autoplay pet voice for the selected thought (run once per open)
  useEffect(() => {
    if (!open) return;
    hasSpokenRef.current = false;
    // Ensure UI SFX do not overlap with streak TTS
    try { pauseAllUISounds(); } catch {}
    try { muteAllUISounds(); } catch {}
    try { ttsService.setExclusiveStopGuard(true); } catch {}
    try { ttsService.stop(true); } catch {}
    try { ttsService.setSuppressNonKrafty(true); } catch {}
    const petId = inferPetIdFromGifUrl(celebrationUrl) || (() => {
      try { return PetProgressStorage.getCurrentSelectedPet(); } catch { return undefined; }
    })();

    let overrideVoice: string | undefined;
    try {
      if (petId) {
        // Prefer per-pet user-selected voice
        overrideVoice = PetProgressStorage.getPreferredVoiceIdForPet(petId);
        if (!overrideVoice) {
          // Pet defaults aligned with tts-service
          const PET_DEFAULT_VOICE_ID: Record<string, string> = {
            dog: 'cgSgspJ2msm6clMCkdW9',
            cat: 'ocZQ262SsZb9RIxcQBOj',
            hamster: 'ocZQ262SsZb9RIxcQBOj',
          };
          overrideVoice = PET_DEFAULT_VOICE_ID[petId];
        }
      }
    } catch {}

    // Capture the line to speak now to avoid effect re-runs cutting it off
    const lineToSpeak = thoughtText;
    // Speak using resolved voice (if any), with a tiny delay to ensure SFX are fully paused
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled || hasSpokenRef.current) return;
      hasSpokenRef.current = true;
      try {
        ttsService.speak(lineToSpeak, {
          voice: overrideVoice,
          stability: 0.6,
          similarity_boost: 0.85,
          speed: ttsService.getSelectedSpeed?.() || 0.7,
          messageId: 'krafty-streak',
        }).catch(() => {});
      } catch {}
    }, 250);

    // Cleanup on close/unmount: stop TTS and restore SFX state
    return () => {
      cancelled = true;
      clearTimeout(timer);
      try { ttsService.stop(true); } catch {}
      try { ttsService.setSuppressNonKrafty(false); } catch {}
      try { ttsService.setExclusiveStopGuard(false); } catch {}
      try { unmuteAllUISounds(); } catch {}
    };
  }, [open]);
  const days: { date: string; label: string; isFilled: boolean; isToday: boolean }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = ymd(d);
    const isToday = dateStr === todayStr;
    const isFilled = !!weekly[dateStr];
    days.push({ date: dateStr, label: labels[i], isFilled, isToday });
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Wrapper to allow Krafty to sit outside the panel */}
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
                <div className="text-5xl sm:text-5xl font-extrabold text-white drop-shadow">{Math.max(0, Number(displayStreak || 0))}</div>
                <div className="text-xl sm:text-2xl font-semibold text-white/90 drop-shadow">
                  {Number(displayStreak || 0) === 1 ? '' : ''}
                </div>
              </div>
            </div>

            {/* Top 3 pet GIFs by current streak; fallback to single GIF if not available */}
            {topPetShowcase && topPetShowcase.length > 0 ? (
              <div className="mt-6 sm:mt-8 flex items-center justify-center gap-8">
                {topPetShowcase.map((p, i) => {
                  const centerIndex = Math.floor(Math.max(1, topPetShowcase.length) / 2);
                  const sizeClass = i === centerIndex ? 'h-36 sm:h-44' : 'h-28 sm:h-36';
                  return (
                    <div key={p.pet} className="flex flex-col items-center">
                      {p.url ? (
                        <img src={p.url} alt={p.pet} className={`${sizeClass} w-auto drop-shadow-xl`} draggable={false} />
                      ) : null}
                      <div className="mt-2 text-white/90 text-base sm:text-lg font-semibold capitalize">
                        {p.name || p.pet}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              celebrationUrl ? (
                <div className="mt-6 sm:mt-8 flex items-center justify-center">
                  <img src={celebrationUrl} alt="Celebration" className="h-32 w-auto sm:h-40 drop-shadow-xl" draggable={false} />
                </div>
              ) : null
            )}


            {/* Pet thought (daily, randomized) */}
            <div className="mt-6 sm:mt-8 px-6 sm:px-10">
              <div className="text-center text-white text-base sm:text-lg leading-relaxed drop-shadow">
                {thoughtText}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}


