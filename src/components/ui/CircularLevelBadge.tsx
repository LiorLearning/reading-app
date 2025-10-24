import React from 'react';

type CircularLevelBadgeProps = {
  level: number;
  progressPercent: number; // 0..100
  size?: 'sm' | 'md' | 'lg';
  bottomText?: string; // e.g., "X/Y" or "75%"
  className?: string;
};

/**
 * Circular level badge with a conic-gradient progress ring and a glossy center.
 * Designed to be compact for header use while remaining legible.
 */
export const CircularLevelBadge: React.FC<CircularLevelBadgeProps> = ({
  level,
  progressPercent,
  size = 'md',
  bottomText,
  className,
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(progressPercent)));

  const dims = (() => {
    switch (size) {
      case 'sm':
        return { outer: 52, ring: 6, inner: 38, font: 17, pillH: 16, pillPx: 8 };
      case 'lg':
        return { outer: 80, ring: 8, inner: 64, font: 28, pillH: 24, pillPx: 10 };
      case 'md':
      default:
        return { outer: 56, ring: 6, inner: 44, font: 20, pillH: 18, pillPx: 9 };
    }
  })();

  const { outer, ring, inner, font, pillH, pillPx } = dims;

  const progressBackground = `conic-gradient(rgb(16 185 129) ${clamped}%, rgba(16,185,129,0.2) ${clamped}% 100%)`;

  return (
    <div
      className={`relative select-none ${className || ''}`}
      style={{ width: outer, height: outer }}
      aria-label={`Level ${level}, ${clamped}% to next level`}
      title={`Level ${level} • ${clamped}%`}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: progressBackground,
          boxShadow: '0 1px 2px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(0,0,0,0.4)',
        }}
      />
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.65), rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.05) 60%, rgba(255,255,255,0) 70%)',
          WebkitMask:
            `radial-gradient(circle at 50% 50%, transparent calc(${inner / 2}px), black calc(${inner / 2}px))`,
          mask:
            `radial-gradient(circle at 50% 50%, transparent calc(${inner / 2}px), black calc(${inner / 2}px))`,
        }}
      />
      <div
        className="absolute rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center"
        style={{
          left: ring,
          top: ring,
          width: inner,
          height: inner,
          boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.6), inset 0 -2px 6px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.2)',
          border: '1px solid rgba(0,0,0,0.5)'
        }}
      >
        <div
          className="font-extrabold text-black drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]"
          style={{
            fontSize: font,
            textShadow:
              '0 2px 0 rgba(255,255,255,0.8), 0 -1px 0 rgba(0,0,0,0.15), 1px 0 0 rgba(0,0,0,0.15), -1px 0 0 rgba(0,0,0,0.15)'
          }}
        >
          {level}
        </div>
      </div>
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full text-white font-bold text-[11px] leading-none flex items-center justify-center"
        style={{
          bottom: -Math.max(8, Math.floor(pillH / 2)),
          height: pillH,
          paddingLeft: pillPx,
          paddingRight: pillPx,
          background: 'linear-gradient(180deg, #ff7a7a, #ea5455)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.65)'
        }}
      >
        {bottomText || `${clamped}%`}
      </div>
    </div>
  );
};

export default CircularLevelBadge;


