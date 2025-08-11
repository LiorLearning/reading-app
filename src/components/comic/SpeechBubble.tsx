import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import React from "react";

interface SpeechBubbleProps {
  text: string;
  className?: string;
  onSpeak?: () => void;
}

const SpeechBubble: React.FC<SpeechBubbleProps> = ({ text, className, onSpeak }) => {
  return (
    <div
      className={cn(
        "relative inline-flex max-w-[80%] items-start gap-2 rounded-xl border-2 border-foreground bg-accent px-4 py-3 text-lg font-semibold text-accent-foreground",
        className
      )}
      role="note"
      aria-label="speech-bubble"
    >
      <p className="pr-1 leading-snug">{text}</p>
      <Button aria-label="Play speech" variant="comic" size="icon" onClick={onSpeak} className="btn-animate">
        <Volume2 />
      </Button>
      <span className="pointer-events-none absolute -bottom-2 left-6 h-4 w-4 rotate-45 border-b-2 border-r-2 border-foreground bg-accent" />
    </div>
  );
};

export default SpeechBubble;
