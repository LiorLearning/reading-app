import React, { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Send, MessageCircle, X, Maximize2, Square, Image as ImageIcon } from "lucide-react";
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
  onExpandChat?: () => void; // Callback to open right sidebar panel
}

const MessengerChat: React.FC<MessengerChatProps> = ({ messages, onGenerate, onGenerateImage, onExpandChat }) => {
  const [isHidden, setIsHidden] = useState(false);
  const [text, setText] = useState("");
  const [isMicActive, setIsMicActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const recognitionRef = useRef<any | null>(null);

  // No need for message count or scroll management in hover chatbox

  // Waveform Visualizer Component
  const WaveformVisualizer = () => {
    return (
      <div className="flex items-center justify-center gap-1 h-9 px-4 bg-white rounded-xl border border-foreground/30">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="w-1 bg-red-500 rounded-full animate-pulse"
            style={{
              height: `${Math.random() * 20 + 8}px`,
              animationDelay: `${i * 0.1}s`,
              animationDuration: `${0.5 + Math.random() * 0.5}s`
            }}
          />
        ))}
        <span className="ml-2 text-sm text-muted-foreground">Recording...</span>
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
          onClick={() => setIsHidden(false)}
          className="h-12 w-12 rounded-full border-2 border-foreground shadow-solid bg-white btn-animate"
          aria-label="Show chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  // New hover chatbox layout with Krafty focus - never expands
  const lastTwoMessages = messages.slice(-2);
    
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-roll-up">
        {/* Last two messages display */}
        {lastTwoMessages.length > 0 && (
          <div className="mb-4 space-y-3 w-80">
            {lastTwoMessages.map((message, index) => (
              <div
                key={`recent-${message.timestamp}-${index}`}
                className="flex animate-slide-up-smooth gap-2"
              >
                {/* Avatar for all messages (left side) */}
                <div className="flex-shrink-0 self-end">
                  <div className={cn(
                    "w-8 h-8 rounded-full border border-foreground flex items-center justify-center text-sm",
                    message.type === 'user'
                      ? "bg-gradient-to-br from-blue-300 via-blue-400 to-blue-500"
                      : "bg-gradient-to-br from-orange-300 via-orange-400 to-orange-500"
                  )}>
                    {message.type === 'user' ? '👤' : '👨‍🚀'}
                  </div>
                </div>
                
                <div
                  className={cn(
                    "max-w-64 rounded-lg px-4 py-3 text-sm max-h-24 overflow-y-auto shadow-[0_4px_0_black]",
                    message.type === 'user' 
                      ? "bg-primary text-primary-foreground border-2 border-black" 
                      : "bg-card border-2 border-foreground"
                  )}
                >
                  <div className="break-words">{message.content}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Main chatbox with new layout */}
        <div className="bg-white/80 backdrop-blur-sm border-2 border-foreground rounded-2xl shadow-solid overflow-hidden">
          {/* Main input area with integrated controls */}
          <div className="p-2">
            <form onSubmit={submit} className="flex items-center gap-2">
              {/* Mic/Cancel Button (Primary Input) */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={startVoice}
                aria-label={isMicActive ? "Cancel recording" : "Voice input"}
                className={cn(
                  "h-9 w-9 border-2 shadow-sm flex-shrink-0 btn-animate",
                  isMicActive
                    ? "bg-red-500 text-white border-red-600 hover:bg-red-600"
                    : "border-foreground/30 bg-white hover:border-foreground/60"
                )}
              >
                {isMicActive ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              
              {/* Text Input or Waveform */}
              {isMicActive ? (
                <WaveformVisualizer />
              ) : (
                <Input
                  aria-label="What happens next?"
                  placeholder="What happens next?"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="rounded-xl border border-foreground/30 flex-1 bg-white text-sm h-9 focus:border-foreground/60"
                />
              )}
              
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
              
              {/* Send Button */}
              <Button type="submit" variant="comic" size="icon" className="flex-shrink-0 btn-animate h-9 w-9">
                <Send className="h-4 w-4" />
              </Button>
              
              {/* Expand Button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (onExpandChat) {
                    onExpandChat(); // Open right sidebar panel
                  }
                }}
                className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground btn-animate"
                title="Expand chat history"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              
              {/* Close Button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsHidden(true)}
                className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground btn-animate"
                title="Hide chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
};

export default MessengerChat;
