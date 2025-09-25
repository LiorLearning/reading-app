import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import InputBar from "@/components/comic/InputBar";
import { playClickSound } from "@/lib/sounds";

interface CollapsedInputDockProps {
  onGenerate: (text: string) => void;
  onGenerateImage: () => void;
  onAddMessage: (message: { type: 'user' | 'ai'; content: string; timestamp: number }) => void;
  onExpandChat: () => void;
  /**
   * Whether to center the dock horizontally on the screen.
   * When true, the dock will be centered. When false, it will be positioned from the right.
   */
  centered?: boolean;
  /**
   * Horizontal offset from the right edge when not centered.
   * Only used when centered is false.
   */
  rightOffsetPx?: number;
}

/**
 * Compact input dock for the collapsed state.
 * Sits along the bottom edge and provides a discreet "Open chat" button.
 */
const CollapsedInputDock: React.FC<CollapsedInputDockProps> = ({
  onGenerate,
  onGenerateImage,
  onAddMessage,
  onExpandChat,
  centered = true,
  rightOffsetPx = 160,
}) => {
  const positionStyles = centered
    ? {
        left: "50%",
        transform: "translateX(-50%)",
        bottom: "10px",
        width: "min(320px, 85vw)",
      }
    : {
        right: `${rightOffsetPx}px`,
        bottom: "10px",
        width: "min(320px, 85vw)",
      };

  return (
    <div
      className="fixed z-[65]"
      style={positionStyles}
    >
      {/* Framed dock matching the reference UI */}
      <div className="relative bg-[#ebebeb]/90 border-2 border-black rounded-[22px] shadow-[0_6px_0_rgba(0,0,0,0.6)] px-4 py-2 flex items-center gap-3 backdrop-blur-sm">
        {/* Mic + input + actions come from InputBar; tighten its internal spacing via wrapper class */}
        <div className="flex-1 min-w-0">
          <InputBar onGenerate={onGenerate} onGenerateImage={onGenerateImage} onAddMessage={onAddMessage} />
        </div>

        {/* Expand to full chat - top-right, arrow pointing down */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            playClickSound();
            onExpandChat();
          }}
          aria-label="Open full chat panel"
          className="absolute -top-3 -right-3 h-8 w-8 p-0 rounded-full bg-white/90 border-2 border-black shadow-[0_3px_0_rgba(0,0,0,0.5)] hover:bg-primary hover:text-primary-foreground"
        >
          <span className="rotate-180 block">⬇︎</span>
        </Button>
      </div>
    </div>
  );
};

export default CollapsedInputDock;


