import React from 'react';
import { cn } from '@/lib/utils';

interface AdventureFeedingProgressProps {
  // Deprecated: session-based coins (kept for backward compatibility)
  sessionCoins?: number;
  // Optional: when using coins-based calculation
  targetCoins?: number;
  // Preferred: pass persistent fraction 0..1 directly
  progressFraction?: number;
  // Or pass percentage directly 0..100
  progressPercent?: number;
  className?: string;
}

const AdventureFeedingProgress: React.FC<AdventureFeedingProgressProps> = ({
  sessionCoins,
  targetCoins = 50,
  progressFraction,
  progressPercent,
  className
}) => {
  // Calculate progress percentage (0-100)
  const computedFromCoins = typeof sessionCoins === 'number' && targetCoins > 0
    ? (sessionCoins / targetCoins) * 100
    : 0;
  const computedFromFraction = typeof progressFraction === 'number'
    ? (progressFraction * 100)
    : undefined;
  const basePercent = typeof progressPercent === 'number' ? progressPercent
    : (typeof computedFromFraction === 'number' ? computedFromFraction : computedFromCoins);
  const progressPercentage = Math.max(0, Math.min(100, basePercent));
  
  // Determine pet state based on progress
  const getPetState = () => {
    if (progressPercentage >= 100) return { emoji: '😋', state: 'full', message: 'Pet is well fed!' };
    if (progressPercentage >= 75) return { emoji: '😊', state: 'satisfied', message: 'Pet is getting satisfied!' };
    if (progressPercentage >= 50) return { emoji: '🙂', state: 'content', message: 'Pet is feeling better!' };
    if (progressPercentage >= 25) return { emoji: '😐', state: 'neutral', message: 'Pet is getting some food!' };
    return { emoji: '😟', state: 'hungry', message: 'Pet is hungry!' };
  };

  const petState = getPetState();

  // Generate gradient colors based on progress
  const getGradientColors = () => {
    if (progressPercentage >= 100) {
      return 'from-green-400 via-green-500 to-green-600';
    } else if (progressPercentage >= 75) {
      return 'from-yellow-400 via-green-400 to-green-500';
    } else if (progressPercentage >= 50) {
      return 'from-orange-400 via-yellow-400 to-green-400';
    } else if (progressPercentage >= 25) {
      return 'from-red-400 via-orange-400 to-yellow-400';
    } else {
      return 'from-red-500 via-red-400 to-red-300';
    }
  };

  return (
    <div className={cn("flex items-center justify-center gap-3", className)}>
      {/* Progress bar with emoji that moves to the right when full */}
      <div className="relative w-80 h-8 bg-gradient-to-r from-slate-700/80 to-slate-600/80 rounded-full border border-slate-400/30 overflow-hidden">
        {/* Progress fill with dynamic gradient */}
        <div 
          className={cn(
            "h-full bg-gradient-to-r transition-all duration-700 ease-out",
            getGradientColors()
          )}
          style={{ width: `${progressPercentage}%` }}
        />
        
        {/* Shine effect */}
        <div 
          className="absolute top-0 left-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
          style={{
            transform: `translateX(${progressPercentage - 100}%)`,
            transition: 'transform 0.7s ease-out'
          }}
        />
        
        {/* Emoji indicator - default left, slides to right when full */}
        <div
          className={cn(
            "absolute inset-y-0 flex items-center transition-all duration-700 ease-out",
            progressPercentage >= 100 ? "justify-end right-2 left-2" : "justify-start left-2 right-2"
          )}
          aria-hidden
        >
          <div className="text-2xl select-none">
            {petState.emoji}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdventureFeedingProgress;
