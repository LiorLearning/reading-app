import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, MessageCircle, Volume2, Square } from "lucide-react";
import { ttsService } from "@/lib/tts-service";
import { playClickSound } from "@/lib/sounds";
import { useTTSSpeaking } from "@/hooks/use-tts-speaking";

interface ChatMessage {
  type: 'user' | 'ai';
  content: string;
  timestamp: number;
}

interface ChatHistoryProps {
  messages: ChatMessage[];
}

// Component for individual speaker button
const SpeakerButton: React.FC<{ message: ChatMessage; index: number }> = ({ message, index }) => {
  const messageId = `chat-history-${message.timestamp}-${index}`;
  const isSpeaking = useTTSSpeaking(messageId);

  const handleClick = async () => {
    playClickSound();
    
    if (isSpeaking) {
      // Stop current speech
      ttsService.stop();
    } else {
      // Start speaking this message
      await ttsService.speakAIMessage(message.content, messageId);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className="absolute bottom-1 right-1 h-5 w-5 p-0 hover:bg-black/10 rounded-full"
      aria-label={isSpeaking ? "Stop message" : "Play message"}
    >
      {isSpeaking ? (
        <Square className="h-3 w-3 fill-current" />
      ) : (
        <Volume2 className="h-3 w-3" />
      )}
    </Button>
  );
};

const ChatHistory: React.FC<ChatHistoryProps> = ({ messages }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isCollapsed]);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className="flex flex-col h-full max-h-full min-h-0">
      {/* Chat Header with Collapse Button */}
      <div className="flex items-center justify-between p-3 bg-card border-2 border-foreground rounded-t-xl flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          <span className="font-semibold text-sm">Chat History</span>
          {messages.length > 0 && (
            <span className="text-xs text-muted-foreground">({messages.length})</span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCollapse}
          className="h-6 w-6 p-0"
        >
          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </Button>
      </div>

      {/* Chat Content */}
      {!isCollapsed && (
        <div className="flex-1 min-h-0 max-h-full overflow-hidden">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center text-muted-foreground text-sm h-24 border border-t-0 border-foreground/20 rounded-b-xl bg-chat-panel shadow-sm">
              <p>💬 Your chat history will appear here!</p>
            </div>
          ) : (
            <div 
              ref={scrollRef}
              className="h-full max-h-40 overflow-y-auto border border-t-0 border-foreground/20 rounded-b-xl bg-chat-panel p-2 space-y-1 shadow-sm"
            >
              {messages.map((message, index) => (
                <div
                  key={`${message.timestamp}-${index}`}
                  className={cn(
                    "flex",
                    message.type === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm relative",
                      message.type === 'user' 
                        ? "bg-primary text-primary-foreground ml-4" 
                        : "bg-card border border-foreground/20 mr-4"
                    )}
                  >
                    <div className="font-medium text-xs mb-1 opacity-70">
                      {message.type === 'user' ? 'You' : '🤖 AI Helper'}
                    </div>
                    <div className={message.type === 'ai' ? 'pr-6' : ''}>{message.content}</div>
                    {/* Speaker button for AI messages only */}
                    {message.type === 'ai' && (
                      <SpeakerButton message={message} index={index} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Collapsed state indicator */}
      {isCollapsed && (
        <div className="flex-shrink-0 p-2 text-center text-xs text-muted-foreground border border-t-0 border-foreground/20 rounded-b-xl bg-chat-panel shadow-sm">
          Chat collapsed
        </div>
      )}
    </div>
  );
};

export default ChatHistory;
