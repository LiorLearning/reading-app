import React from "react";
import SpeechBubble from "./SpeechBubble";
import { cn } from "@/lib/utils";

interface ComicPanelProps {
  image: string;
  text: string;
  onSpeak: () => void;
  className?: string;
}

const ComicPanel: React.FC<ComicPanelProps> = ({ image, text, onSpeak, className }) => {
  return (
    <div className={cn("relative w-full overflow-hidden rounded-xl border-4 border-foreground bg-card shadow-sm", className)}>
      <img src={image} alt="Current comic scene" className="h-auto w-full object-cover" loading="lazy" />
      <div className="pointer-events-none absolute inset-0 flex items-start justify-end p-4 sm:p-6">
        <div className="pointer-events-auto">
          <SpeechBubble text={text} onSpeak={onSpeak} />
        </div>
      </div>
    </div>
  );
};

export default ComicPanel;
