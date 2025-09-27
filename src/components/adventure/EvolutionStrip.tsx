import React from 'react';

type EvolutionStripProps = {
  currentLevel: number;
  stageLevels?: number[]; // e.g., [1, 5, 10]
  stageImages?: string[]; // optional image URLs if available
  size?: 'sm' | 'md';
  orientation?: 'horizontal' | 'vertical';
  petType?: string; // to derive default emojis if images are not provided
  stageEmojis?: string[]; // optional explicit emojis per stage
  unlockedImage?: string; // neutral pet image for the currently unlocked stage
  ringProgressPct?: number; // 0-100 progress for current level -> next level
};

/**
 * Small presentational strip that shows 3 evolution stages.
 * Locked stages appear grayscaled with a lock and level badge.
 */
export const EvolutionStrip: React.FC<EvolutionStripProps> = ({
  currentLevel,
  stageLevels = [1, 5, 10],
  stageImages,
  size = 'sm',
  orientation = 'horizontal',
  petType,
  stageEmojis,
  unlockedImage,
  ringProgressPct = 0,
}) => {
  const itemSize = size === 'sm' ? 40 : 56;
  const ringSize = itemSize + 6;
  const ringThickness = size === 'sm' ? 4 : 5;

  const getDefaultEmojis = (type?: string): string[] => {
    const t = (type || '').toLowerCase();
    if (t.includes('dog') || t.includes('april')) return ['🐶', '🐕', '🐺'];
    if (t.includes('cat')) return ['🐱', '🐈', '🦁'];
    if (t.includes('hamster')) return ['🐹', '🐹', '🐹'];
    if (t.includes('bird') || t.includes('feather')) return ['🐣', '🐥', '🦅'];
    if (t.includes('bobo') || t.includes('robot')) return ['🤖', '🤖✨', '🤖🚀'];
    return ['🐾', '🐾', '🐾'];
  };
  const defaultEmojis = stageEmojis && stageEmojis.length === 3 ? stageEmojis : getDefaultEmojis(petType);

  const currentStageIndex = currentLevel < (stageLevels[1] ?? 5)
    ? 0
    : currentLevel < (stageLevels[2] ?? 10)
    ? 1
    : 2;

  const stages = [0, 1, 2].map((i) => {
    const requiredLevel = stageLevels[i] ?? (i === 0 ? 1 : i === 1 ? 5 : 10);
    const unlocked = currentLevel >= requiredLevel;
    const isCurrent = (() => {
      if (i === 2) return currentLevel >= requiredLevel;
      const nextReq = stageLevels[i + 1] ?? (i === 0 ? 5 : 10);
      return currentLevel >= requiredLevel && currentLevel < nextReq;
    })();

    const preferentialImage = i === currentStageIndex && unlocked && unlockedImage ? unlockedImage : undefined;
    const imgSrc = preferentialImage || stageImages?.[i];

    // For the current stage, draw a thicker progress ring using a conic gradient
    const showProgressRing = isCurrent;
    const ringContainerSize = showProgressRing ? ringSize + ringThickness * 2 : ringSize;

    return (
      <div key={i} className="flex flex-col items-center gap-1">
        <div
          className="relative flex items-center justify-center"
          style={{ width: ringContainerSize, height: ringContainerSize }}
          aria-label={unlocked ? `Stage ${i + 1}` : `Stage ${i + 1} — unlocks at Level ${requiredLevel}`}
          title={unlocked ? `Stage ${i + 1}` : `Unlocks at Level ${requiredLevel}`}
        >
          {showProgressRing && (
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(rgb(16 185 129) ${Math.max(0, Math.min(100, ringProgressPct))}%, rgba(16,185,129,0.2) ${Math.max(0, Math.min(100, ringProgressPct))}% 100%)`,
                boxShadow: '0 0 0 1px rgba(0,0,0,0.6) inset',
              }}
            />
          )}

          <div
            className={`relative rounded-full border-2 shadow-md bg-white/70 backdrop-blur-sm ${
              isCurrent ? 'border-emerald-500' : 'border-black'
            }`}
            style={{ width: ringSize, height: ringSize }}
          >
            <div
              className={`rounded-full overflow-hidden flex items-center justify-center ${
                unlocked ? '' : 'grayscale opacity-60'
              }`}
              style={{ width: itemSize, height: itemSize }}
            >
              {imgSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imgSrc} alt={`Stage ${i + 1}`} className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">
                  {defaultEmojis[i] || '🐾'}
                </div>
              )}
            </div>

            {!unlocked && (
              <div className="absolute -bottom-1 -right-1 bg-black text-white text-[10px] px-1 py-[1px] rounded">
                L{requiredLevel}
              </div>
            )}
          </div>
          {isCurrent && unlocked && (
            <div className="absolute -bottom-1 -right-0 bg-black text-white text-[10px] px-1 py-[1px] rounded">
              L{currentLevel}
            </div>
          )}
        </div>
      </div>
    );
  });

  // Determine progress toward next unlock
  const nextLevel = currentLevel < 5 ? 5 : currentLevel < 10 ? 10 : 10;
  const prevLevel = currentLevel < 5 ? 1 : currentLevel < 10 ? 5 : 10;
  const denom = Math.max(1, nextLevel - prevLevel);
  const numer = Math.max(0, Math.min(currentLevel - prevLevel, denom));
  const pct = currentLevel >= 10 ? 100 : Math.round((numer / denom) * 100);

  if (orientation === 'vertical') {
    return (
      <div className="flex items-center gap-2 select-none">
        <div className="flex flex-col items-center gap-2">{stages}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div className="flex items-center gap-2">{stages}</div>
      <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden" style={{ maxWidth: ringSize * 3 + 24 }}>
        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export default EvolutionStrip;


