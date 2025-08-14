import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, MessageCircle } from "lucide-react";

interface ChatMessage {
  type: 'user' | 'ai';
  content: string;
  timestamp: number;
}

interface ChatHistoryProps {
  messages: ChatMessage[];
}

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
            <div className="flex items-center justify-center text-muted-foreground text-sm h-24 border-2 border-t-0 border-foreground rounded-b-xl bg-chat-panel">
              <p>💬 Your chat history will appear here!</p>
            </div>
          ) : (
            <div 
              ref={scrollRef}
              className="h-full max-h-40 overflow-y-auto border-2 border-t-0 border-foreground rounded-b-xl bg-chat-panel p-2 space-y-1"
            >
              {messages.map((message, index) => (
                <div
                  key={`${message.timestamp}-${index}`}
                  className={cn(
                    "flex items-start gap-2",
                    message.type === 'user' ? "justify-end flex-row-reverse" : "justify-start"
                  )}
                >
                  {/* Avatar for AI messages */}
                  {message.type === 'ai' && (
                    <div className="flex-shrink-0 w-6 h-6 rounded-full border border-foreground bg-white flex items-center justify-center text-xs">
                      👨‍🚀
                    </div>
                  )}
                  
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                      message.type === 'user' 
                        ? "bg-primary text-primary-foreground ml-4" 
                        : "bg-card border-2 border-foreground mr-4"
                    )}
                  >
                    <div className="font-medium text-xs mb-1 opacity-70">
                      {message.type === 'user' ? 'You' : 'Krafty'}
                    </div>
                    <div>{message.content}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Collapsed state indicator */}
      {isCollapsed && (
        <div className="flex-shrink-0 p-2 text-center text-xs text-muted-foreground border-2 border-t-0 border-foreground rounded-b-xl bg-chat-panel">
          Chat collapsed
        </div>
      )}
    </div>
  );
};

export default ChatHistory;
