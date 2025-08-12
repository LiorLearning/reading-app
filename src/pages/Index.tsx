import React, { useCallback, useMemo } from "react";
import ComicHeader from "@/components/comic/ComicHeader";
import ComicPanel from "@/components/comic/ComicPanel";
import InputBar from "@/components/comic/InputBar";
import MessengerChat from "@/components/comic/MessengerChat";
import ChatAvatar from "@/components/comic/ChatAvatar";
import { cn } from "@/lib/utils";

import { useComic } from "@/hooks/use-comic";
import rocket1 from "@/assets/comic-rocket-1.jpg";
import spaceport2 from "@/assets/comic-spaceport-2.jpg";
import alien3 from "@/assets/comic-alienland-3.jpg";
import cockpit4 from "@/assets/comic-cockpit-4.jpg";

const Index = () => {
  React.useEffect(() => {
    document.title = "AI Reading Learning App — Your Adventure";
  }, []);

  const jsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "AI Reading Learning App",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      description: "Create comic panels with narration to support early reading.",
    }),
    []
  );

  const images = useMemo(() => [rocket1, spaceport2, alien3, cockpit4], []);

  const initialPanels = useMemo(
    () => [
      { id: crypto.randomUUID(), image: rocket1, text: "The brave astronaut climbs into ROCKET!" },
      { id: crypto.randomUUID(), image: alien3, text: "Clouds drift by as the engines warm up." },
    ],
    []
  );

  const { panels, currentIndex, setCurrent, addPanel, undo, redo } = useComic(initialPanels);
  
  interface ChatMessage {
    type: 'user' | 'ai';
    content: string;
    timestamp: number;
  }
  
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [sidebarAnimatingOut, setSidebarAnimatingOut] = React.useState(false);
  const [newlyCreatedPanelId, setNewlyCreatedPanelId] = React.useState<string | null>(null);
  const [lastMessageCount, setLastMessageCount] = React.useState(0);
  const messagesScrollRef = React.useRef<HTMLDivElement>(null);
  
  // Chat panel resize functionality
  const [chatPanelWidth, setChatPanelWidth] = React.useState(320); // 320px = w-80
  const [isResizing, setIsResizing] = React.useState(false);
  const resizeRef = React.useRef<HTMLDivElement>(null);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const newWidth = e.clientX;
    const minWidth = 320; // Minimum width (w-80)
    const maxWidth = Math.min(800, window.innerWidth * 0.6); // Max 60% of screen or 800px
    
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      setChatPanelWidth(newWidth);
    }
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Add global mouse events for resize
  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  const generateAIResponse = useCallback((userText: string): string => {
    const responses = [
      "Great idea! 🚀 That sounds exciting! What happens next?",
      "Wow! 🌟 That's a fantastic twist! Keep the story going!",
      "Amazing! ✨ I love where this story is heading!",
      "Cool! 🎯 That's a great addition to your adventure!",
      "Awesome! 🎭 Your story is getting more exciting!",
      "Nice! 🌈 What a wonderful way to continue the tale!",
      "Brilliant! 💫 I can't wait to see what happens next!",
      "Super! 🎪 You're such a creative storyteller!",
      "Perfect! 🎨 That adds great action to your comic!",
      "Excellent! 🎊 Your adventure is becoming amazing!"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }, []);



  const onGenerate = useCallback(
    (text: string) => {
      const image = images[Math.floor(Math.random() * images.length)];
      const newPanelId = crypto.randomUUID();
      addPanel({ id: newPanelId, image, text });
      setNewlyCreatedPanelId(newPanelId);
      
      // Clear the new panel indicator after animation
      setTimeout(() => setNewlyCreatedPanelId(null), 2000);
      
      // Add user message
      const userMessage: ChatMessage = {
        type: 'user',
        content: text,
        timestamp: Date.now()
      };
      
      // Add user message immediately
      setChatMessages(prev => {
        setLastMessageCount(prev.length + 1);
        return [...prev, userMessage];
      });
      
      // Generate AI response with delay for natural feel
      setTimeout(() => {
        const aiResponse = generateAIResponse(text);
        const aiMessage: ChatMessage = {
          type: 'ai',
          content: aiResponse,
          timestamp: Date.now()
        };
        setChatMessages(prev => {
          setLastMessageCount(prev.length + 1);
          return [...prev, aiMessage];
        });
      }, 800);
    },
    [addPanel, images, generateAIResponse]
  );

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (messagesScrollRef.current) {
      messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);



  const current = panels[currentIndex] ?? initialPanels[0];

  return (
    <div className="h-screen bg-pattern flex flex-col overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="w-full px-4 py-2 flex-1 flex flex-col min-h-0">
        <div className="flex-shrink-0 pb-1 pt-1">
          <div className="px-4">
            <ComicHeader 
              onUndo={undo} 
              onRedo={redo} 
              panels={panels}
              sidebarCollapsed={sidebarCollapsed}
              onToggleSidebar={() => {
                if (!sidebarCollapsed) {
                  setSidebarAnimatingOut(true);
                  // Start the width transition immediately
                  setTimeout(() => {
                    setSidebarCollapsed(true);
                    setSidebarAnimatingOut(false);
                  }, 300);
                } else {
                  setSidebarCollapsed(false);
                  setSidebarAnimatingOut(false);
                }
              }}
            />
          </div>
        </div>

        <main className="flex-1 flex min-h-0 overflow-hidden gap-4 p-1" role="main">
          {/* Left Sidebar with Avatar, Messages and Input */}
          {(!sidebarCollapsed || sidebarAnimatingOut) && (
            <aside 
              ref={resizeRef}
              className={`flex flex-col bg-chat-container border-2 border-foreground rounded-3xl min-h-0 z-10 relative overflow-hidden mb-2 ${
                sidebarAnimatingOut ? 'animate-slide-out-left' : 'animate-slide-in-left'
              } ${isResizing ? 'chat-panel-resizing' : ''}`}
              style={{ 
                width: sidebarAnimatingOut ? '0px' : `${chatPanelWidth}px`,
                height: 'calc(100vh - 100px)',
                transition: isResizing ? 'none' : sidebarAnimatingOut ? 'width 0.3s ease-in' : 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                boxShadow: '0 4px 0 hsl(var(--foreground))'
              }}
            >
              {/* Avatar Section */}
              <div className="flex-shrink-0 bg-chat-container">
                <ChatAvatar />
              </div>
              
              {/* Messages */}
              <div className="flex-1 min-h-0 relative">
                {/* Messages Container */}
                <div 
                  ref={messagesScrollRef}
                  className="h-full overflow-y-auto space-y-3 p-3 bg-chat-panel"
                >
                  {chatMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      <p>💬 Start chatting with Krafty!</p>
                    </div>
                  ) : (
                    chatMessages.map((message, index) => (
                      <div
                        key={`${message.timestamp}-${index}`}
                        className={cn(
                          "flex animate-slide-up-smooth",
                          message.type === 'user' ? "justify-end" : "justify-start"
                        )}
                        style={{ 
                          animationDelay: index < lastMessageCount - 1 ? `${Math.min(index * 0.04, 0.2)}s` : "0s"
                        }}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-lg px-3 py-2 text-sm transition-all duration-200",
                            message.type === 'user' 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-card border-2 border-foreground"
                          )}
                        >
                          <div className="font-medium text-xs mb-1 opacity-70">
                            {message.type === 'user' ? 'You' : '🤖 Krafty'}
                          </div>
                          <div>{message.content}</div>
                        </div>
                      </div>
                    )                )
                  )}
                </div>
              </div>
              
              {/* Input Bar */}
              <div className="flex-shrink-0 bg-chat-container p-3">
                <InputBar onGenerate={onGenerate} />
              </div>
              
              {/* Resize Handle */}
              <div
                className="absolute top-0 right-0 w-1 h-full cursor-ew-resize bg-transparent hover:bg-foreground/20 transition-colors duration-200 group"
                onMouseDown={handleResizeStart}
                title="Drag to resize chat panel"
              >
                <div className="absolute top-1/2 -translate-y-1/2 right-0 w-1 h-12 bg-transparent group-hover:bg-foreground/50 transition-colors duration-200" />
              </div>
            </aside>
          )}
          
          {/* Main Comic Panel */}
          <section 
            aria-label="Main comic panel" 
            className="flex-1 flex flex-col min-h-0 relative"
            style={{ height: 'calc(100vh - 100px)' }}
          >
            <div className="flex-1 min-h-0">
              <ComicPanel
                image={current.image}
                className="h-full w-full"
                isNew={current.id === newlyCreatedPanelId}
              />
            </div>
          </section>
        </main>

        {/* Messenger Chat when sidebar is collapsed */}
        {sidebarCollapsed && (
          <MessengerChat 
            messages={chatMessages} 
            onGenerate={onGenerate} 
          />
        )}
      </div>
    </div>
  );
};

export default Index;
