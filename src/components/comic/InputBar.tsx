import React, { useCallback, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";
import { toast } from "sonner";

interface InputBarProps {
  onGenerate: (text: string) => void;
}

const InputBar: React.FC<InputBarProps> = ({ onGenerate }) => {
  const [text, setText] = useState("");
  const recognitionRef = useRef<any | null>(null);

  const startVoice = useCallback(() => {
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
      onGenerate(text.trim());
      setText("");
    },
    [onGenerate, text]
  );

  return (
    <form onSubmit={submit} className="mt-4 flex items-center gap-2">
      <button
        type="button"
        onClick={startVoice}
        aria-label="Voice input"
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border-2 border-foreground bg-secondary text-foreground shadow-sm transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Mic className="h-5 w-5" />
      </button>
      <Input
        aria-label="What happens next?"
        placeholder="What happens next?"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button type="submit" className="font-bold">Generate</Button>
    </form>
  );
};

export default InputBar;
