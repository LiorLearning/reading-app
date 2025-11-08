import React from 'react';

type CenteredLevelProgressBarProps = {
  percent: number; // 0..100
  currentLevel: number;
  nextLevel: number;
  className?: string;
};

export function CenteredLevelProgressBar({
  percent,
  currentLevel,
  nextLevel,
  className,
}: CenteredLevelProgressBarProps): JSX.Element {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className={`fixed top-0 left-1/2 -translate-x-1/2 z-30 pointer-events-none ${className || ''}`} style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="rounded-xl px-2 py-1 pointer-events-auto backdrop-blur-sm bg-white/10">
        <div className="relative h-9 w-72 md:w-80 lg:w-96" style={{ height: 'clamp(32px, 4vw, 36px)', width: 'clamp(288px, 40vw, 384px)' }}>
          {/* Track */}
          <div className="absolute inset-y-0 left-0 right-0 bg-white/30 rounded-full border border-white/40 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-white text-sm font-extrabold drop-shadow-md">
              {pct}%
            </div>
          </div>

          {/* Left badge: current level */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-teal-500 text-white border border-white/40 shadow-md flex items-center justify-center text-sm font-extrabold select-none">
            {currentLevel}
          </div>

          {/* Right badge: next level */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/70 text-gray-800 border border-white/60 shadow-md flex items-center justify-center text-sm font-extrabold select-none">
            {nextLevel}
          </div>
        </div>
      </div>
    </div>
  );
}

type TopRightHeartsAndCoinsProps = {
  streak: number;
  coins: number;
  onStreakClick?: () => void;
  className?: string;
};

export function TopRightHeartsAndCoins({
  streak,
  coins,
  onStreakClick,
  className,
  style,
}: TopRightHeartsAndCoinsProps & { style?: React.CSSProperties }): JSX.Element {
  return (
    <div className={`fixed z-30 flex items-center gap-3 md:gap-5 ${className || ''}`} style={style || { top: '24px', right: '24px' }}>
      {/* Streak */}
      <div
        className="rounded-xl px-4 py-2 cursor-pointer hover:bg-white/5"
        role="button"
        aria-label="Open weekly hearts"
        onClick={onStreakClick}
      >
        <div className="flex items-center gap-2 text-white font-bold text-xl drop-shadow-md">
          <span className="text-2xl">❤️</span>
          <span>{streak}</span>
        </div>
      </div>

      {/* Coins */}
      <div className="rounded-xl px-3 py-2">
        <div className="flex items-center gap-2 text-white font-bold text-xl drop-shadow-md">
          <span className="text-2xl">🪙</span>
          <span>{coins}</span>
        </div>
      </div>
    </div>
  );
}

export default {
  CenteredLevelProgressBar,
  TopRightHeartsAndCoins,
};


