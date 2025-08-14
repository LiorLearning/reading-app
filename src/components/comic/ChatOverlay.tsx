import React, { useState, useRef, useEffect } from "react";
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

  // Scroll ref for chat area
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current && isVisible) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isVisible]);

  return (
    <>
      {/* Semi-transparent film/backdrop - only show when input is visible */}
      {isVisible && (
        <div 
          className="absolute inset-0 bg-black bg-opacity-20 transition-opacity duration-300 ease-in-out z-10"
          style={{ backdropFilter: 'blur(1px)' }}
        />
      )}

      {/* Scrollable Chat Area - only show when input is visible */}
      {isVisible && (
        <div className="absolute inset-0 bottom-16 z-20">
          <div 
            ref={scrollRef}
            className="h-full overflow-y-auto p-4 space-y-3 bg-black bg-opacity-10 backdrop-blur-sm"
          >
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-white text-sm">
                <p>💬 Start your adventure!</p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={message.timestamp}
                  className={cn(
                    "flex items-start gap-2 animate-slide-up-smooth",
                    message.type === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {/* Avatar for AI messages - only on left side */}
                  {message.type === 'ai' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-foreground bg-white flex items-center justify-center text-sm">
                      👨‍🚀
                    </div>
                  )}
                  
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-3 text-sm font-medium border-2 border-foreground shadow-solid",
                      message.type === 'user' 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-white text-foreground"
                    )}
                  >
                    <div className="font-bold text-xs mb-1 opacity-70">
                      {message.type === 'user' ? 'You' : 'Krafty'}
                    </div>
                    <div>{message.content}</div>
                  </div>

                  {/* Avatar for user messages - only on right side */}
                  {message.type === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-foreground bg-primary flex items-center justify-center text-sm text-primary-foreground font-bold">
                      U
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

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
            <Button type="submit" variant="comic" size="icon" className="flex-shrink-0 btn-animate" disableClickSound={true}>
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
            disableClickSound={true}
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