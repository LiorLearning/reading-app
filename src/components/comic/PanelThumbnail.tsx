import React from "react";
import { cn } from "@/lib/utils";
import { playClickSound } from "@/lib/sounds";
import { useFirebaseImage, useCurrentAdventureId } from "@/hooks/use-firebase-image";

interface PanelThumbnailProps {
  index: number;
  image: string;
  active?: boolean;
  onClick?: () => void;
}

const PanelThumbnail: React.FC<PanelThumbnailProps> = ({ index, image, active, onClick }) => {
  // Get current adventure ID for Firebase image resolution
  const currentAdventureId = useCurrentAdventureId();
  
  // Resolve Firebase image if needed
  const { url: resolvedImageUrl, isExpiredUrl } = useFirebaseImage(image, currentAdventureId || undefined);
  
  React.useEffect(() => {
    if (isExpiredUrl && resolvedImageUrl !== image) {
      console.log(`🔄 PanelThumbnail ${index + 1}: Resolved expired image to Firebase URL: ${resolvedImageUrl.substring(0, 50)}...`);
    }
  }, [resolvedImageUrl, image, index, isExpiredUrl]);

  return (
    <button
      onClick={() => {
        playClickSound();
        onClick?.();
      }}
      aria-label={`Go to panel ${index + 1}`}
      className={cn(
        "relative aspect-[4/3] w-full overflow-hidden rounded-md border-2 bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring btn-animate",
        active ? "border-foreground border-4" : "border-border"
      )}
    >
      <img 
        src={resolvedImageUrl} 
        alt={`Panel ${index + 1} thumbnail`} 
        className="h-full w-full object-cover" 
        loading="lazy"
        onError={(e) => {
          // If Firebase image also fails, show a fallback
          const target = e.target as HTMLImageElement;
          if (!target.src.includes('placeholder')) {
            console.warn(`⚠️ Failed to load thumbnail image for panel ${index + 1}, using placeholder`);
            target.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            target.alt = `Panel ${index + 1} (image unavailable)`;
          }
        }}
      />
      <span className="absolute left-1 top-1 rounded-md bg-secondary px-1 text-xs font-bold text-secondary-foreground">
        {index + 1}
      </span>
    </button>
  );
};

export default PanelThumbnail;
