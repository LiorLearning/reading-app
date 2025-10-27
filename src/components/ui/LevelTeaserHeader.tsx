import React from 'react';

type LevelTeaserHeaderProps = {
  currentLevel: number;
  progressPercent: number; // 0..100 toward next
  bottomText?: string; // e.g., "75%" or "X/Y"
  className?: string;
};

/**
 * Displays a centered current-level circular badge with small previous and next
 * level bubbles flanking it. The next-level bubble is emphasized as a "tease".
 */
export const LevelTeaserHeader: React.FC<LevelTeaserHeaderProps> = ({
  currentLevel,
  progressPercent,
  bottomText,
  className,
}) => {
  const pct = Math.max(0, Math.min(100, Math.round(progressPercent)));
  const prev = Math.max(1, currentLevel - 1);
  const next = currentLevel + 1;

  const sideSize = 42; // tightened
  const sideFont = 15;

  const SideBubble = ({ n, variant, completed }: { n: number; variant: 'prev' | 'next'; completed?: boolean }) => (
    <div
      className={`relative rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center select-none ${
        variant === 'prev' ? 'opacity-85' : 'opacity-95'
      }`}
      style={{
        width: sideSize,
        height: sideSize,
        boxShadow:
          completed
            ? '0 0 0 2px rgba(16,185,129,0.95), 0 6px 14px rgba(0,0,0,0.25)'
            : variant === 'next'
            ? '0 0 0 2px rgba(250,204,21,0.9), 0 6px 14px rgba(0,0,0,0.25)'
            : '0 0 0 1px rgba(0,0,0,0.45), 0 4px 10px rgba(0,0,0,0.2)',
        filter: completed ? 'saturate(1)' : variant === 'prev' ? 'saturate(0.6)' : 'saturate(1)'
      }}
      aria-label={`Level ${n}${completed ? ' completed' : ''}`}
      title={`Level ${n}${completed ? ' • completed' : ''}`}
    >
      <div
        className="font-extrabold text-black"
        style={{
          fontSize: sideFont,
          textShadow:
            '0 1px 0 rgba(255,255,255,0.8), 0 -1px 0 rgba(0,0,0,0.15), 1px 0 0 rgba(0,0,0,0.1), -1px 0 0 rgba(0,0,0,0.1)'
        }}
      >
        {n}
      </div>
    </div>
  );

  return (
    <div className={`relative flex items-end justify-center ${className || ''}`}>
      <div className="relative flex items-center justify-center gap-0">
        <div className="translate-x-3 mr-1">
          <SideBubble n={prev} variant="prev" completed={prev < currentLevel} />
        </div>

        {/* <div className="relative z-10 -mt-1">
          <CircularLevelBadge
            level={currentLevel}
            progressPercent={pct}
            bottomText={bottomText || `${pct}%`}
            size="md"
          />
        </div> */}

        <div className="-translate-x-3 -ml-0">
          <SideBubble n={next} variant="next" completed={false} />
        </div>
      </div>
    </div>
  );
};

export default LevelTeaserHeader;


