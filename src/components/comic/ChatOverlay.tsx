import React, { useState, useRef, useEffect, memo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Send, ChevronDown, ChevronUp, Image } from "lucide-react";
import { toast } from "sonner";

interface ChatMessage {
  type: 'user' | 'ai';
  content: string;
  timestamp: number;
}

interface ChatOverlayProps {
  messages: ChatMessage[];
  onGenerate: (text: string) => void;
  isVisible: boolean;
  onToggleVisibility: () => void;
}

// Memoized Speech Bubble Component to prevent glitching
const SpeechBubble = memo(({ message, messageIndex }: { message: ChatMessage, messageIndex: number }) => {
  const isUser = message.type === 'user';

  // Simple consistent positioning: User bubbles on right, AI on left
  // Stack them vertically based on their order
  const baseTop = 15; // Start at 15% from top
  const verticalSpacing = 25; // 25% spacing between bubbles
  const topPosition = baseTop + (messageIndex * verticalSpacing);

  const position = isUser ? 
    { top: `${Math.min(topPosition, 65)}%`, right: '5%' } : // User on right
    { top: `${Math.min(topPosition, 65)}%`, left: '5%' };   // AI on left

  return (
    <div
      className={cn(
        "absolute z-20 max-w-[280px]",
        isUser ? "speech-bubble-user" : "speech-bubble-ai"
      )}
      style={position}
    >
      <div
        className={cn(
          "px-4 py-3 text-sm font-medium rounded-2xl border-2 border-foreground shadow-solid relative",
          isUser 
            ? "bg-primary text-primary-foreground" 
            : "bg-white text-foreground"
        )}
      >
        {/* Speech bubble tail */}
        <div
          className={cn(
            "absolute w-0 h-0",
            isUser 
              ? "bottom-[-8px] right-6 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-primary"
              : "bottom-[-8px] left-6 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white"
          )}
        />
        <div
          className={cn(
            "absolute w-0 h-0",
            isUser 
              ? "bottom-[-10px] right-6 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-foreground"
              : "bottom-[-10px] left-6 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-foreground"
          )}
        />
        
        <div className="font-bold text-xs mb-1 opacity-70">
          {isUser ? 'You' : '🤖 Krafty'}
        </div>
        <div>{message.content}</div>
      </div>
    </div>
  );
});

SpeechBubble.displayName = 'SpeechBubble';

const ChatOverlay: React.FC<ChatOverlayProps> = ({ 
  messages, 
  onGenerate, 
  isVisible, 
  onToggleVisibility 
}) => {
  const [text, setText] = useState("");
  const recognitionRef = useRef<any | null>(null);

  const startVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in this browser.");
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setText(transcript);
      }
    };
    rec.onerror = () => toast.error("Microphone error – please try again.");
    rec.start();
    recognitionRef.current = rec;
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    onGenerate(text.trim());
    setText("");
  };

  const generateImage = () => {
    const imageText = text.trim() || "Continue the adventure";
    onGenerate(`Generate Image: ${imageText}`);
    setText("");
  };

  // Get the most recent messages for display - memoized to prevent glitching
  const recentMessages = React.useMemo(() => {
    return messages.slice(-3); // Show only last 3 messages
  }, [messages]);

  return (
    <>
      {/* Semi-transparent film/backdrop - only show when input is visible */}
      {isVisible && (
        <div 
          className="absolute inset-0 bg-black bg-opacity-20 transition-opacity duration-300 ease-in-out z-10"
          style={{ backdropFilter: 'blur(1px)' }}
        />
      )}

      {/* Speech Bubbles - only show when input is visible */}
      {isVisible && recentMessages.map((message, index) => (
        <SpeechBubble key={message.timestamp} message={message} messageIndex={index} />
      ))}

      {/* Floating Show Chat Button - appears when input is hidden */}
      {!isVisible && (
        <div className="absolute bottom-4 right-4 z-30">
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleVisibility}
            aria-label="Show chat input"
            className="h-12 w-12 border-2 border-foreground shadow-solid bg-white btn-animate rounded-full"
          >
            <ChevronUp className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Input Bar Overlay */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-chat-container border-t-2 border-foreground transition-transform duration-300 ease-in-out z-30",
          isVisible ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="p-4 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={startVoice}
            aria-label="Voice input"
            className="h-10 w-10 border-2 border-foreground shadow-solid bg-white flex-shrink-0 btn-animate"
          >
            <Mic className="h-4 w-4" />
          </Button>
          
          <form onSubmit={submit} className="flex-1 flex items-center gap-2">
            <Input
              aria-label="What happens next?"
              placeholder="What happens next?"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="rounded-xl border-2 flex-1 bg-white"
            />
            <Button type="submit" variant="comic" size="icon" className="flex-shrink-0 btn-animate">
              <Send className="h-4 w-4" />
            </Button>
          </form>
          
          <Button
            type="button"
            variant="outline" 
            size="icon"
            onClick={generateImage}
            aria-label="Generate new image"
            className="h-10 w-10 border-2 border-foreground shadow-solid bg-white flex-shrink-0 btn-animate"
          >
            <Image className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleVisibility}
            aria-label="Hide input"
            className="h-10 w-10 border-2 border-foreground shadow-solid bg-white flex-shrink-0 btn-animate"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
};

export default ChatOverlay;