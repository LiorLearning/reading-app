import React from "react";
import InputBar from "@/components/comic/InputBar";

interface CollapsedInputDockProps {
  onGenerate: (text: string) => void;
  onAddMessage: (message: { type: 'user' | 'ai'; content: string; timestamp: number }) => void;
  centered?: boolean;
  rightOffsetPx?: number;
  disabled?: boolean;
  onDisabledClick?: () => void;
  disabledReason?: string;
}

/**
 * Compact input dock for the collapsed state.
 * Sits along the bottom edge and provides a discreet "Open chat" button.
 */
const CollapsedInputDock: React.FC<CollapsedInputDockProps> = ({
  onGenerate,
  onAddMessage,
  centered = true,
  rightOffsetPx = 160,
  disabled = false,
  onDisabledClick,
  disabledReason,
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
          <InputBar onGenerate={onGenerate} onAddMessage={onAddMessage} disabled={disabled} onDisabledClick={onDisabledClick} disabledReason={disabledReason} />
        </div>
      </div>
    </div>
  );
};

export default CollapsedInputDock;


