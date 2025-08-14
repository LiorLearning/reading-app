import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Send, MessageCircle, Minimize2, X, Plus } from "lucide-react";
import { toast } from "sonner";

interface ChatMessage {
  type: 'user' | 'ai';
  content: string;
  timestamp: number;
}

interface MessengerChatProps {
  messages: ChatMessage[];
  onGenerate: (text: string) => void;
}

const MessengerChat: React.FC<MessengerChatProps> = ({ messages, onGenerate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [text, setText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any | null>(null);

  // Update message count when messages change
  useEffect(() => {
    setLastMessageCount(messages.length);
  }, [messages.length]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isExpanded]);

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
        // Auto-expand when voice input is detected
        setIsExpanded(true);
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
    // Auto-expand when message is sent
    setIsExpanded(true);
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

  if (!isExpanded) {
    // Compact messenger tab with direct input
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-roll-up">
        <div className="bg-chat-container border-2 border-foreground rounded-2xl shadow-solid overflow-hidden">
          {/* Header with expand and hide options */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-chat-container">
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  onClick={() => setIsExpanded(true)}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MessageCircle className="h-3 w-3" />
                  <span>{messages.length} message{messages.length !== 1 ? 's' : ''}</span>
                </button>
              )}
              {messages.length === 0 && (
                <span className="text-xs text-muted-foreground">Ask me anything!</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsHidden(true)}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground btn-animate"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <form onSubmit={submit} className="flex items-center gap-2 p-3">
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
            <Input
              aria-label="Ask your doubts"
              placeholder="Doubts? Ask me!"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="rounded-xl border-2 flex-1 min-w-48 bg-white"
            />
            <Button type="submit" variant="comic" size="icon" className="flex-shrink-0 btn-animate">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Expanded messenger interface
  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-chat-container border-2 border-foreground rounded-2xl shadow-solid overflow-hidden animate-roll-up">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b-2 border-foreground bg-chat-container">
        <div className="flex items-center gap-2">
          <div className="bg-accent text-accent-foreground rounded-lg p-1.5">
            <MessageCircle className="h-4 w-4" />
          </div>
          <span className="font-semibold text-sm">Krafty</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsHidden(true)}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground btn-animate"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(false)}
            className="h-7 w-7 p-0 btn-animate"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="h-64 overflow-y-auto p-4 space-y-3 bg-chat-panel"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            <p>💬 Start a conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={`${message.timestamp}-${index}`}
                className={cn(
                  "flex animate-slide-up-smooth items-start gap-2",
                  message.type === 'user' ? "justify-end flex-row-reverse" : "justify-start"
                )}
                style={{ 
                  animationDelay: index < lastMessageCount - 1 ? `${Math.min(index * 0.05, 0.3)}s` : "0s"
                }}
              >
                {/* Avatar for AI messages */}
                {message.type === 'ai' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-foreground bg-white flex items-center justify-center text-sm">
                    👨‍🚀
                  </div>
                )}
                
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-3 py-2 text-sm transition-all duration-200",
                    message.type === 'user' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-card border-2 border-foreground"
                  )}
                >
                  <div className="font-medium text-xs mb-1 opacity-70">
                    {message.type === 'user' ? 'You' : 'Krafty'}
                  </div>
                  <div>{message.content}</div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start animate-slide-up-smooth items-start gap-2">
                {/* Avatar for typing indicator */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-foreground bg-white flex items-center justify-center text-sm">
                  👨‍🚀
                </div>
                
                <div className="bg-card border-2 border-foreground rounded-lg px-3 py-2 text-sm">
                  <div className="font-medium text-xs mb-1 opacity-70">Krafty</div>
                  <div className="flex items-center gap-1">
                    <div className="typing-dot w-2 h-2 bg-muted-foreground rounded-full"></div>
                    <div className="typing-dot w-2 h-2 bg-muted-foreground rounded-full"></div>
                    <div className="typing-dot w-2 h-2 bg-muted-foreground rounded-full"></div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t-2 border-foreground bg-chat-container">
        <form onSubmit={submit} className="flex items-stretch gap-2">
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
      </div>
    </div>
  );
};

export default MessengerChat;
