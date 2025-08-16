import React, { useCallback, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mic, Send, Image as ImageIcon, Square } from "lucide-react";
import { toast } from "sonner";
import { playClickSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";

interface InputBarProps {
  onGenerate: (text: string) => void;
  onGenerateImage: () => void;
}

const InputBar: React.FC<InputBarProps> = ({ onGenerate, onGenerateImage }) => {
  const [text, setText] = useState("");
  const [isMicActive, setIsMicActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const recognitionRef = useRef<any | null>(null);

  // Waveform Visualizer Component
  const WaveformVisualizer = () => {
    return (
      <div className="flex items-center justify-center gap-1 h-10 px-4 bg-white/90 rounded-xl shadow-sm flex-1 backdrop-blur-sm">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="w-1 bg-primary rounded-full animate-pulse"
            style={{
              height: `${Math.random() * 20 + 8}px`,
              animationDelay: `${i * 0.1}s`,
              animationDuration: `${0.5 + Math.random() * 0.5}s`
            }}
          />
        ))}
      </div>
    );
  };

  const startVoice = useCallback(() => {
    playClickSound();
    if (isMicActive) {
      // Stop recording manually - user clicked cancel
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsMicActive(false);
      setIsSubmitting(false);
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
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = true;
    
    rec.onstart = () => {
      setIsMicActive(true);
    };
    
    rec.onresult = (event: any) => {
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
      
      setText(finalTranscript + interimTranscript);
    };
    
    rec.onerror = () => {
      toast.error("Microphone error – please try again.");
      setIsMicActive(false);
      setIsSubmitting(false);
    };
    
    rec.onend = () => {
      if (isMicActive) {
        setIsMicActive(false);
        setIsSubmitting(false);
      }
    };
    
    rec.start();
    recognitionRef.current = rec;
  }, [isMicActive, isSubmitting]);

  const submit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!text.trim()) return;
      
      setIsSubmitting(true);
      
      // If recording is active, stop it first
      if (isMicActive) {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
          recognitionRef.current = null;
        }
        setIsMicActive(false);
      }
      
      onGenerate(text.trim());
      setText("");
      setIsSubmitting(false);
    },
    [onGenerate, text, isMicActive]
  );

  return (
    <section aria-label="Create next panel" className="bg-transparent">
      <form onSubmit={submit} className="flex items-stretch gap-2 bg-transparent">
        <Button
          type="button"
          variant="comic"
          size="icon"
          onClick={startVoice}
          aria-label={isMicActive ? "Cancel recording" : "Voice input"}
          className={cn(
            "flex-shrink-0 btn-animate",
            isMicActive && "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
          )}
        >
          {isMicActive ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        {isMicActive ? (
          <WaveformVisualizer />
        ) : (
          <Input
            aria-label="What happens next?"
            placeholder="What happens next?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="rounded-xl flex-1 bg-white/90 border-0 shadow-sm focus:shadow-md transition-shadow backdrop-blur-sm"
          />
        )}
        <Button 
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            onGenerateImage();
          }}
          aria-label="Generate new image"
          className="h-10 w-10 bg-white/90 hover:bg-primary hover:text-primary-foreground shadow-sm hover:shadow-md flex-shrink-0 btn-animate border-0 backdrop-blur-sm"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Button type="submit" variant="outline" size="icon" className="h-10 w-10 bg-white/90 hover:bg-primary hover:text-primary-foreground shadow-sm hover:shadow-md flex-shrink-0 btn-animate border-0 backdrop-blur-sm">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </section>
  );
};

export default InputBar;
