import React, { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Send, X, Square, Image as ImageIcon, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { playClickSound } from "@/lib/sounds";

interface ChatMessage {
  type: 'user' | 'ai';
  content: string;
  timestamp: number;
}

interface MessengerChatProps {
  messages: ChatMessage[];
  onGenerate: (text: string) => void;
  onGenerateImage: () => void;
  onExpandChat: () => void; // Function to expand chat to full panel
}

const MessengerChat: React.FC<MessengerChatProps> = ({ messages, onGenerate, onGenerateImage, onExpandChat }) => {
  const [isHidden, setIsHidden] = useState(true);
  const [hasBeenClicked, setHasBeenClicked] = useState(false);
  const [text, setText] = useState("");
  const [isMicActive, setIsMicActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const recognitionRef = useRef<any | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // No need for message count or scroll management in hover chatbox

  // Hover handlers for message area
  const handleMouseEnter = () => {
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsAnimatingOut(false);
    setShowMessages(true);
  };

  const handleMouseLeave = () => {
    // Set a 1-second timeout to start hide animation
    hideTimeoutRef.current = setTimeout(() => {
      setIsAnimatingOut(true);
      // After animation completes, actually hide the element
      setTimeout(() => {
        setShowMessages(false);
        setIsAnimatingOut(false);
      }, 600); // Match animation duration
      hideTimeoutRef.current = null;
    }, 1000);
  };

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Waveform Visualizer Component
  const WaveformVisualizer = () => {
    return (
      <div className="rounded-xl border border-foreground/30 w-full bg-white text-sm h-9 focus:border-foreground/60 flex items-center justify-center gap-1 px-4">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="w-1 bg-primary rounded-full animate-pulse"
            style={{
              height: `${Math.random() * 16 + 6}px`,
              animationDelay: `${i * 0.1}s`,
              animationDuration: `${0.5 + Math.random() * 0.5}s`
            }}
          />
        ))}
      </div>
    );
  };

  const startVoice = () => {
    playClickSound();
    if (isMicActive) {
      // Stop recording manually - user clicked cancel
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsMicActive(false);
      setIsSubmitting(false); // Reset submitting flag when manually stopping
      return;
    }

    // Start recording
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in this browser.");
      return;
    }
    
    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.interimResults = true; // Enable interim results for continuous recognition
    rec.maxAlternatives = 1;
    rec.continuous = true; // Keep recording until manually stopped
    
    rec.onstart = () => {
      setIsMicActive(true);
    };
    
    rec.onresult = (event: any) => {
      // Don't update text if we're in the process of submitting
      if (isSubmitting) return;
      
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Update text field with the current transcript (don't auto-send)
      setText(finalTranscript + interimTranscript);
    };
    
    rec.onerror = () => {
      toast.error("Microphone error – please try again.");
      setIsMicActive(false);
      setIsSubmitting(false); // Reset submitting flag on error
    };
    
    rec.onend = () => {
      // Only stop if not manually stopped (prevents auto-restart)
      if (isMicActive) {
        setIsMicActive(false);
        setIsSubmitting(false); // Reset submitting flag when recording ends
      }
    };
    
    rec.start();
    recognitionRef.current = rec;
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!text.trim()) return;
    
    playClickSound();
    // Set submitting flag to prevent onresult from overwriting
    setIsSubmitting(true);
    
    // If recording is active, stop it first
    if (isMicActive) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsMicActive(false);
    }
    
    // Send the message
    onGenerate(text.trim());
    
    // Clear the text field and reset submitting flag
    setText("");
    setIsSubmitting(false);
  };

  // Show floating button when hidden
  if (isHidden) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-slide-up-smooth">
        <Button
          variant="outline"
          onClick={() => {
            setIsHidden(false);
            setHasBeenClicked(true);
          }}
          className={cn(
            "h-16 w-16 rounded-full border-2 border-foreground bg-white btn-animate p-0 relative",
            !hasBeenClicked ? "krafty-highlight" : "shadow-solid"
          )}
          aria-label="Show chat"
        >
          <img 
            src="/avatars/krafty.png" 
            alt="Krafty" 
            className="absolute inset-0 w-full h-full object-cover scale-125"
          />
        </Button>
      </div>
    );
  }

  // New hover chatbox layout with Krafty focus - never expands
  const lastTwoMessages = messages.slice(-2);
    
    return (
      <div 
        className="fixed bottom-6 right-8 z-50 animate-roll-out-from-avatar"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Expand Chat Button and Close Button - Above messages */}
        {(lastTwoMessages.length === 0 || showMessages || isAnimatingOut) && (
          <div className={cn(
            "mb-2 flex justify-end gap-2",
            lastTwoMessages.length > 0 && (isAnimatingOut ? "animate-roll-down" : "animate-roll-up")
          )}>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onExpandChat}
              aria-label="Open full chat panel"
              className="bg-white/60 backdrop-blur-sm border border-foreground/30 px-2 py-1 h-7 shadow-sm hover:bg-primary hover:text-primary-foreground transition-all"
            >
              <ArrowUpRight className="h-3 w-3" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setIsHidden(true);
              }}
              aria-label="Hide chat"
              className="bg-white/60 backdrop-blur-sm border border-foreground/30 px-2 py-1 h-7 shadow-sm hover:bg-primary hover:text-primary-foreground transition-all"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        
        {/* Container with unified background */}
        <div className="relative overflow-hidden rounded-2xl">
          {/* Translucent background that extends from hover bar to cover messages */}
          {(showMessages || isAnimatingOut) && lastTwoMessages.length > 0 && (
            <div className={cn(
              "absolute inset-0 bg-black/20 backdrop-blur-sm rounded-2xl border border-foreground/20 -z-10",
              isAnimatingOut ? "animate-roll-down" : "animate-roll-up"
            )}></div>
          )}
          
          {/* Last two messages display - animated show/hide */}
          {(showMessages || isAnimatingOut) && lastTwoMessages.length > 0 && (
            <div className={cn(
              "mb-0 space-y-3 p-3 pt-3 overflow-hidden",
              isAnimatingOut ? "animate-roll-down" : "animate-roll-up"
            )}>
              {lastTwoMessages.map((message, index) => (
                <div
                  key={`recent-${message.timestamp}-${index}`}
                  className="flex animate-slide-up-smooth gap-2"
                >
                  {/* Avatar for all messages (left side) */}
                  <div className="flex-shrink-0 self-end">
                    <div className={cn(
                      "w-8 h-8 rounded-full border-2 border-black flex items-center justify-center text-sm shadow-[0_2px_0_black]",
                      message.type === 'user'
                        ? "bg-gradient-to-br from-blue-300 via-blue-400 to-blue-500"
                        : "bg-gradient-to-br from-orange-300 via-orange-400 to-orange-500"
                    )}>
                      {message.type === 'user' ? '👤' : '👨‍🚀'}
                    </div>
                  </div>
                  
                  <div
                    className={cn(
                      "max-w-56 rounded-lg px-4 py-3 text-sm max-h-24 overflow-y-auto shadow-[0_4px_0_black]",
                      message.type === 'user' 
                        ? "bg-primary text-primary-foreground border-2 border-black backdrop-blur-sm" 
                        : "bg-white/95 text-black border-2 border-black backdrop-blur-sm"
                    )}
                  >
                    <div className="break-words font-medium">{message.content}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
           
          {/* Main chatbox with new layout - always visible */}
          <div className="bg-white/60 backdrop-blur-md border-2 border-foreground rounded-2xl shadow-solid overflow-hidden relative z-10">
          {/* Main input area with integrated controls */}
          <div className="p-2">
            <form onSubmit={submit} className="flex items-center gap-2">
              {/* Mic/Cancel Button (Primary Input) */}
              <Button
                type="button"
                variant="comic"
                size="icon"
                onClick={startVoice}
                aria-label={isMicActive ? "Cancel recording" : "Voice input"}
                className={cn(
                  "h-9 w-9 flex-shrink-0 btn-animate",
                  isMicActive && "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                )}
              >
                {isMicActive ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              
              {/* Text Input or Waveform - Container with fixed flex */}
              <div className="flex-1">
                {isMicActive ? (
                  <WaveformVisualizer />
                ) : (
                  <Input
                    aria-label="What happens next?"
                    placeholder="What happens next?"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="rounded-xl border border-foreground/30 w-full bg-white text-sm h-9 focus:border-foreground/60"
                  />
                )}
              </div>
              
              {/* Send Button */}
              <Button type="submit" variant="outline" size="icon" className="h-9 w-9 border border-foreground/30 bg-white hover:border-foreground/60 flex-shrink-0 btn-animate">
                <Send className="h-4 w-4" />
              </Button>
              
              {/* Image Generation Button */}
              <Button 
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  playClickSound();
                  onGenerateImage();
                }}
                aria-label="Generate new image"
                className="h-9 w-9 border border-foreground/30 bg-white hover:border-foreground/60 flex-shrink-0 btn-animate"
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
        </div>
      </div>
    );
};

export default MessengerChat;
