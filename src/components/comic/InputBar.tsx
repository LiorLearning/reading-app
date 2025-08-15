import React, { useCallback, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mic, Send, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { playClickSound } from "@/lib/sounds";

interface InputBarProps {
  onGenerate: (text: string) => void;
  onGenerateImage: () => void;
}

const InputBar: React.FC<InputBarProps> = ({ onGenerate, onGenerateImage }) => {
  const [text, setText] = useState("");
  const recognitionRef = useRef<any | null>(null);

  const startVoice = useCallback(() => {
    playClickSound();
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
      if (transcript) setText(transcript);
    };
    rec.onerror = () => toast.error("Microphone error – please try again.");
    rec.start();
    recognitionRef.current = rec;
  }, []);

  const submit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!text.trim()) return;
      playClickSound();
      onGenerate(text.trim());
      setText("");
    },
    [onGenerate, text]
  );

  return (
    <section aria-label="Create next panel">
      <form onSubmit={submit} className="flex items-stretch gap-2">
        <Button
          type="button"
          variant="comic"
          size="icon"
          onClick={startVoice}
          aria-label="Voice input"
          className="flex-shrink-0 btn-animate"
        >
          <Mic className="h-5 w-5" />
        </Button>
        <Input
          aria-label="What happens next?"
          placeholder="What happens next?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="rounded-xl border-2 flex-1 bg-white"
        />
        <Button 
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            playClickSound();
            onGenerateImage();
          }}
          aria-label="Generate new image"
          className="h-10 w-10 border-2 border-foreground shadow-solid bg-white flex-shrink-0 btn-animate"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Button type="submit" variant="outline" size="icon" className="h-10 w-10 border-2 border-foreground shadow-solid bg-white flex-shrink-0 btn-animate">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </section>
  );
};

export default InputBar;
