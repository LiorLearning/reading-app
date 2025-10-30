import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { ttsService } from '@/lib/tts-service';
import { muteAllUISounds, unmuteAllUISounds, pauseAllUISounds } from '@/lib/sounds';
import { PetProgressStorage } from '@/lib/pet-progress-storage';

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
  // Show only weekdays in the modal per new streak UX
  const labels = useMemo(() => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], []);
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

  // Thoughts buckets as templates; store only the selected index, not the rendered text
  type ThoughtTemplate = (s: number, name: string) => string;

  const oneDayTemplates = useMemo<ThoughtTemplate[]>(() => [
    (s, name) => `Thanks for taking care of me today, ${name}! 💕 You just started our love streak—see you tomorrow?`,
    (s, name) => `You showed up for me, ${name}! 🐾 Day 1 of our adventure together—will you come back tomorrow?`,
    (s, name) => `I loved our adventure today, ${name}! 📚❤️ Our streak begins now—can't wait for Day 2, will you be there?`,
    (s, name) => `First pawprint on our calendar! 🐾 Thanks for starting this journey with me, ${name}! Same time tomorrow?`,
    (s, name) => `You made my tail wag all day long, ${name}! 🐶 Day 1 done—shall we continue our adventure tomorrow?`
  ], []);

  const underSevenTemplates = useMemo<ThoughtTemplate[]>(() => [
    (s, name) => `You're on a ${Math.max(2, s)}-day love streak, ${name}! 💖 Let's keep the adventures going tomorrow?`,
    (s, name) => `${Math.max(2, s)} days in a row with me? Best. Human. Ever. 🥹🐾 Will you go for the next one?`,
    (s, name) => `Our adventures are adding up—${Math.max(2, s)} days strong! ✨ See you tomorrow, ${name}?`,
    (s, name) => `I'm purring with pride, ${name}! 😺 ${Math.max(2, s)}-day streak and growing—ready for tomorrow?`,
    (s, name) => `High paws! 🐾 ${Math.max(2, s)} days of care and cuddles—shall we make it ${Math.max(2, s) + 1} tomorrow?`
  ], []);

  const sevenPlusTemplates = useMemo<ThoughtTemplate[]>(() => [
    (s, name) => `A whole ${Math.max(7, s)} days with you, ${name}! 🥳🎉 Love and adventures galore—coming back tomorrow?`,
    (s, name) => `${Math.max(7, s)} days strong, ${name}! 💫 I feel so loved—shall we make it even bigger tomorrow?`,
    (s, name) => `We did it—${Math.max(7, s)}-day streak! ❤️ Thanks for taking such good care of me, ${name}! See you tomorrow?`,
    (s, name) => `Woof-wow! 🐶 ${Math.max(7, s)} days of cuddles and adventures—my heart is full, ${name}! Ready for day ${Math.max(7, s) + 1}?`,
    (s, name) => `One week and beyond! 🌟 ${Math.max(7, s)} happy days together—same time tomorrow, ${name}?`
  ], []);

  // Daily random selection with persistence (once per calendar day)
  const thoughtText = useMemo(() => {
    try {
      const bucket = (displayStreak === 1) ? 'd1' : (displayStreak > 1 && displayStreak < 7) ? 'u7' : '7p';
      const key = `litkraft_streak_thought_${todayStr}_${bucket}_idx`;

      let pool: ThoughtTemplate[];
      if (displayStreak === 1) pool = oneDayTemplates;
      else if (displayStreak > 1 && displayStreak < 7) pool = underSevenTemplates;
      else pool = sevenPlusTemplates;

      // Read or assign a persistent index for the pool
      let idx = -1;
      try {
        const savedIdxStr = localStorage.getItem(key);
        const parsed = Number(savedIdxStr);
        if (!Number.isNaN(parsed) && parsed >= 0 && parsed < pool.length) idx = parsed;
      } catch {}
      if (idx === -1) {
        idx = Math.floor(Math.random() * pool.length);
        try { localStorage.setItem(key, String(idx)); } catch {}
      }

      const tpl = pool[idx] || pool[0];
      return tpl(Math.max(1, Number(displayStreak || 0)), userName);
    } catch {
      // Fallback without persistence
      const tpl = (displayStreak === 1 ? oneDayTemplates[0] : (displayStreak > 1 && displayStreak < 7) ? underSevenTemplates[0] : sevenPlusTemplates[0]);
      return tpl(Math.max(1, Number(displayStreak || 0)), userName);
    }
  }, [todayStr, displayStreak, userName, oneDayTemplates, underSevenTemplates, sevenPlusTemplates]);

  // Infer pet from celebrationUrl for voice override
  function inferPetIdFromGifUrl(url?: string): string | undefined {
    if (!url) return undefined;
    const candidates = ['dog', 'cat', 'hamster', 'parrot', 'monkey', 'dragon', 'unicorn', 'bobo', 'feather','pikachu','panda','deer'];
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
  for (let i = 0; i < 5; i++) { // Monday..Friday only
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
                  {Number(displayStreak || 0) === 1 ? 'day' : 'days'}
                </div>
              </div>
            </div>

            {/* Celebration GIF (optional) */}
            {celebrationUrl && (
              <div className="mt-6 sm:mt-8 flex items-center justify-center">
                <img src={celebrationUrl} alt="Celebration" className="h-32 w-auto sm:h-40 drop-shadow-xl" draggable={false} />
              </div>
            )}

            {/* Week hearts */}
            <div className="mt-8 sm:mt-10">
              <div className="grid grid-cols-5 gap-3 sm:gap-3 px-6 sm:px-10">
                {days.map((d) => (
                  <div key={d.date} className="relative flex flex-col items-center">
                    {/* Dev toggle button above each heart */}
                    <button
                      aria-label={`dev-toggle-${d.date}`}
                      onClick={() => {
                        try {
                          const data = loadWeeklyHearts(monday);
                          data[d.date] = !data[d.date];
                          saveWeeklyHearts(monday, data);
                          setWeekly({ ...data });
                        } catch {}
                      }}
                      className="absolute -top-4 h-4 w-6 opacity-0 z-10"
                    >
                      dev
                    </button>
                    <div className="text-[12px] sm:text-sm text-white/80 mb-2">{d.label}</div>
                    <span
                      className={
                        `text-4xl sm:text-5xl leading-none ` +
                        (d.isFilled ? 'text-white' : 'text-white/60')
                      }
                      title={d.date}
                    >
                      {d.isFilled ? '❤️' : '🤍'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

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


