import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { ttsService } from '@/lib/tts-service';
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
  const labels = useMemo(() => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], []);
  const [weekly, setWeekly] = useState<WeeklyHearts>(() => loadWeeklyHearts(monday));

  useEffect(() => {
    if (!open) return;
    // Reload weekly state when opened in case it changed elsewhere
    setWeekly(loadWeeklyHearts(monday));
  }, [open, monday]);

  if (!open) return null;

  const todayStr = getLocalTodayDateString();
  const userName = (userData?.username && userData.username.trim()) ? userData.username.trim() : 'friend';

  // Thoughts buckets
  const oneDayThoughts = useMemo(() => [
    `Thanks for taking care of me today, ${userName}! 💕 You just started our love streak—see you tomorrow?`,
    `You showed up for me, ${userName}! 🐾 Day 1 of our adventure together—will you come back tomorrow?`,
    `I loved our adventure today, ${userName}! 📚❤️ Our streak begins now—can't wait for Day 2, will you be there?`,
    `First pawprint on our calendar! 🐾 Thanks for starting this journey with me, ${userName}! Same time tomorrow?`,
    `You made my tail wag all day long, ${userName}! 🐶 Day 1 done—shall we continue our adventure tomorrow?`
  ], [userName]);

  const underSevenThoughts = useMemo(() => [
    `You're on a ${Math.max(2, currentStreak)}-day love streak, ${userName}! 💖 Let's keep the adventures going tomorrow?`,
    `${Math.max(2, currentStreak)} days in a row with me? Best. Human. Ever. 🥹🐾 Will you go for the next one?`,
    `Our adventures are adding up—${Math.max(2, currentStreak)} days strong! ✨ See you tomorrow, ${userName}?`,
    `I'm purring with pride, ${userName}! 😺 ${Math.max(2, currentStreak)}-day streak and growing—ready for tomorrow?`,
    `High paws! 🐾 ${Math.max(2, currentStreak)} days of care and cuddles—shall we make it ${Math.max(2, currentStreak) + 1} tomorrow?`
  ], [currentStreak, userName]);

  const sevenPlusThoughts = useMemo(() => [
    `A whole ${Math.max(7, currentStreak)} days with you, ${userName}! 🥳🎉 Love and adventures galore—coming back tomorrow?`,
    `${Math.max(7, currentStreak)} days strong, ${userName}! 💫 I feel so loved—shall we make it even bigger tomorrow?`,
    `We did it—${Math.max(7, currentStreak)}-day streak! ❤️ Thanks for taking such good care of me, ${userName}! See you tomorrow?`,
    `Woof-wow! 🐶 ${Math.max(7, currentStreak)} days of cuddles and adventures—my heart is full, ${userName}! Ready for day ${currentStreak + 1}?`,
    `One week and beyond! 🌟 ${Math.max(7, currentStreak)} happy days together—same time tomorrow, ${userName}?`
  ], [currentStreak, userName]);

  // Daily random selection with persistence (once per calendar day)
  const thoughtText = useMemo(() => {
    try {
      const key = `litkraft_streak_thought_${todayStr}`;
      const saved = localStorage.getItem(key);
      if (saved) return saved;
      let pool: string[] = [];
      if (currentStreak === 1) pool = oneDayThoughts;
      else if (currentStreak > 1 && currentStreak < 7) pool = underSevenThoughts;
      else pool = sevenPlusThoughts;
      const idx = Math.floor(Math.random() * pool.length);
      const chosen = pool[idx];
      localStorage.setItem(key, chosen);
      return chosen;
    } catch {
      // Fallback without persistence
      if (currentStreak === 1) return oneDayThoughts[0];
      if (currentStreak > 1 && currentStreak < 7) return underSevenThoughts[0];
      return sevenPlusThoughts[0];
    }
  }, [todayStr, currentStreak, oneDayThoughts, underSevenThoughts, sevenPlusThoughts]);

  // Infer pet from celebrationUrl for voice override
  function inferPetIdFromGifUrl(url?: string): string | undefined {
    if (!url) return undefined;
    const candidates = ['dog', 'cat', 'hamster', 'parrot', 'monkey', 'dragon', 'unicorn', 'bobo', 'feather'];
    const lower = url.toLowerCase();
    for (const id of candidates) {
      if (lower.includes(id)) return id;
    }
    return undefined;
  }

  // Autoplay pet voice for the selected thought
  useEffect(() => {
    if (!open) return;
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

    // Speak using resolved voice (if any)
    try {
      ttsService.speak(thoughtText, {
        voice: overrideVoice,
        stability: 0.6,
        similarity_boost: 0.85,
        speed: ttsService.getSelectedSpeed?.() || 0.7,
        messageId: 'pet-thought-streak',
      }).catch(() => {});
    } catch {}
    // No cleanup needed; modal close button will stop if global playback is managed elsewhere
  }, [open, celebrationUrl, thoughtText]);
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
                <div className="text-5xl sm:text-5xl font-extrabold text-white drop-shadow">{Math.max(0, Number(currentStreak || 0))}</div>
                <div className="text-xl sm:text-2xl font-semibold text-white/90 drop-shadow">
                  {Number(currentStreak || 0) === 1 ? 'day' : 'days'}
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
              <div className="grid grid-cols-7 gap-3 sm:gap-3 px-6 sm:px-10">
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


