import React, { useCallback, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mic, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

interface InputBarProps {
  onGenerate: (text: string) => void;
  history?: string[];
}

const InputBar: React.FC<InputBarProps> = ({ onGenerate, history = [] }) => {
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(false);
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
    <section aria-label="Create next panel" className="mt-4">
      <form onSubmit={submit} className="flex items-stretch gap-2">
        <Button
          type="button"
          variant="comic"
          size="icon"
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? "Collapse history" : "Expand to show history"}
        >
          <ChevronsUpDown />
        </Button>
        <button
          type="button"
          onClick={startVoice}
          aria-label="Voice input"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-foreground bg-accent text-accent-foreground shadow-solid active:translate-y-0.5 active:shadow-none"
        >
          <Mic className="h-5 w-5" />
        </button>
        <Input
          aria-label="What happens next?"
          placeholder="What happens next?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="rounded-xl border-2"
        />
        <Button type="submit" variant="comic" className="font-extrabold px-6">Generate</Button>
      </form>

      {expanded && (
        <div className="mt-3 max-h-40 overflow-auto rounded-xl border-2 border-foreground bg-secondary p-3">
          {history.length === 0 ? (
            <p className="text-sm text-foreground/80">No messages yet. Try saying or typing what happens next.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {history.map((h, i) => (
                <li key={`${i}-${h.slice(0,6)}`} className="rounded-md bg-card p-2">{i + 1}. {h}</li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
};

export default InputBar;
