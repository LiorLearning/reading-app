import React from "react";
import { cn } from "@/lib/utils";
import { playClickSound } from "@/lib/sounds";

interface PanelThumbnailProps {
  index: number;
  image: string;
  active?: boolean;
  onClick?: () => void;
}

const PanelThumbnail: React.FC<PanelThumbnailProps> = ({ index, image, active, onClick }) => {
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
      <img src={image} alt={`Panel ${index + 1} thumbnail`} className="h-full w-full object-cover" loading="lazy" />
      <span className="absolute left-1 top-1 rounded-md bg-secondary px-1 text-xs font-bold text-secondary-foreground">
        {index + 1}
      </span>
    </button>
  );
};

export default PanelThumbnail;
