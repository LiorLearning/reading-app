import React, { useCallback, useMemo, useState, useEffect } from "react";
import ComicPanel from "@/components/comic/ComicPanel";
import InputBar from "@/components/comic/InputBar";
import MessengerChat from "@/components/comic/MessengerChat";
import ChatAvatar from "@/components/comic/ChatAvatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, Palette, HelpCircle, BookOpen, Image as ImageIcon, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { playImageLoadingSound, stopImageLoadingSound, playImageCompleteSound, playMessageSound, playClickSound } from "@/lib/sounds";

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
  
  // Background images for dynamic background selection
  const backgroundImages = useMemo(() => [
    '/backgrounds/cats.png',
    '/backgrounds/random.png', 
    '/backgrounds/random2.png'
  ], []);
  
  // Set random background on component mount
  useEffect(() => {
    const randomBg = backgroundImages[Math.floor(Math.random() * backgroundImages.length)];
    document.documentElement.style.setProperty('--dynamic-background', `url('${randomBg}')`);
  }, [backgroundImages]);

  const initialPanels = useMemo(
    () => [
      { id: crypto.randomUUID(), image: rocket1, text: "The brave astronaut climbs into ROCKET!" },
    ],
    []
  );

  const { panels, currentIndex, setCurrent, addPanel, redo } = useComic(initialPanels);
  
  interface ChatMessage {
    type: 'user' | 'ai';
    content: string;
    timestamp: number;
  }
  
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [sidebarAnimatingOut, setSidebarAnimatingOut] = React.useState(false);
  const [newlyCreatedPanelId, setNewlyCreatedPanelId] = React.useState<string | null>(null);
  const [zoomingPanelId, setZoomingPanelId] = React.useState<string | null>(null);
  const [lastMessageCount, setLastMessageCount] = React.useState(0);
  const messagesScrollRef = React.useRef<HTMLDivElement>(null);

  
  // Color theme options
  const colorThemes = [
    { name: "Pink", primary: "350 81% 60%", background: "350 30% 97%", accent: "350 81% 60%", hue: "350" },
    { name: "Blue", primary: "220 91% 60%", background: "220 30% 97%", accent: "220 91% 60%", hue: "220" },
    { name: "Green", primary: "142 76% 36%", background: "142 30% 97%", accent: "142 76% 36%", hue: "142" },
    { name: "Purple", primary: "262 73% 60%", background: "262 30% 97%", accent: "262 73% 60%", hue: "262" },
    { name: "Orange", primary: "25 95% 53%", background: "25 30% 97%", accent: "25 95% 53%", hue: "25" },
  ];
  
  const [selectedTheme, setSelectedTheme] = useState(colorThemes[0]);
  
  const changeTheme = useCallback((theme: typeof colorThemes[0]) => {
    playClickSound();
    setSelectedTheme(theme);
    
    // Update CSS variables on the document root
    const root = document.documentElement;
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--background', theme.background);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--ring', theme.primary);
    root.style.setProperty('--sidebar-primary', theme.primary);
    root.style.setProperty('--sidebar-ring', theme.primary);
    
    // Update book border colors to match the theme
    root.style.setProperty('--book-border', theme.primary);
    root.style.setProperty('--book-border-deep', theme.primary.replace(/60%/, '50%'));
    root.style.setProperty('--book-border-shadow', theme.primary.replace(/60%/, '40%'));
    
    // Update background pattern colors to match the theme
    // Light mode pattern colors
    root.style.setProperty('--pattern-primary', `${theme.hue} 50% 90%`);
    root.style.setProperty('--pattern-secondary', `${theme.hue} 40% 88%`);
  }, []);
  
  // Initialize theme on component mount
  useEffect(() => {
    changeTheme(selectedTheme);
  }, [selectedTheme, changeTheme]);
  
  // Chat panel resize functionality
  const [chatPanelWidth, setChatPanelWidth] = React.useState(320); // 320px more compact
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
    const minWidth = 300; // Minimum width reduced for compactness
    const maxWidth = Math.min(450, window.innerWidth * 0.4); // Max 40% of screen or 450px
    
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



  // Generate new image panel only (no text message)
  const onGenerateImage = useCallback(() => {
    // Play loading sound when generation starts
    playImageLoadingSound();
    
    const image = images[Math.floor(Math.random() * images.length)];
    const newPanelId = crypto.randomUUID();
    addPanel({ id: newPanelId, image, text: "New adventure continues..." });
    setNewlyCreatedPanelId(newPanelId);
    
    // Play completion sound and trigger zoom animation after 2 seconds
    setTimeout(() => {
      stopImageLoadingSound();
      playImageCompleteSound();
      setZoomingPanelId(newPanelId); // Trigger zoom animation
      setNewlyCreatedPanelId(null);
      
      // Clear zoom animation after it completes (0.6s duration)
      setTimeout(() => {
        setZoomingPanelId(null);
      }, 600);
    }, 2000);
  }, [addPanel, images]);

  // Handle text messages only (no image generation)
  const onGenerate = useCallback(
    (text: string) => {
      // Add user message
      const userMessage: ChatMessage = {
        type: 'user',
        content: text,
        timestamp: Date.now()
      };
      
      // Add user message immediately with sound
      setChatMessages(prev => {
        setLastMessageCount(prev.length + 1);
        playMessageSound();
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
          playMessageSound();
          return [...prev, aiMessage];
        });
      }, 800);
    },
    [generateAIResponse]
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
      <div className="w-full flex-1 flex flex-col min-h-0">
        {/* Header Panel */}
                 <header 
           className="flex items-center justify-between px-6 py-4 border-b-2 border-foreground/10 bg-white/30 backdrop-blur-md"
           style={{
             boxShadow: '0 4px 8px -2px rgba(0, 0, 0, 0.1)'
           }}
         >
          {/* Left Tools Group */}
          <div className="flex items-center gap-2 flex-1">
            <Popover>
              <PopoverTrigger asChild>
                                  <Button variant="outline" size="icon" aria-label="Change theme color" className="border-2 bg-white btn-animate" style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)', boxShadow: '0 4px 0 hsl(from hsl(var(--primary)) h s 25%)' }}>
                  <Palette className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="grid grid-cols-5 gap-2">
                  {colorThemes.map((theme) => (
                    <Button
                      key={theme.name}
                      variant="comic"
                      size="sm"
                      onClick={() => changeTheme(theme)}
                      className={`h-12 w-12 btn-animate flex flex-col items-center justify-center gap-1 ${
                        selectedTheme.name === theme.name ? 'ring-2 ring-foreground ring-offset-2' : ''
                      }`}
                      aria-label={`Change theme to ${theme.name}`}
                      style={{
                        backgroundColor: `hsl(${theme.primary})`,
                        color: 'white'
                      }}
                    >
                      <span className="text-[10px] font-bold">{theme.name}</span>
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            
            <Dialog>
              <DialogTrigger asChild>
                                  <Button variant="outline" size="icon" aria-label="Help" className="border-2 bg-white btn-animate" style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)', boxShadow: '0 4px 0 hsl(from hsl(var(--primary)) h s 25%)' }}>
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>How to use</DialogTitle>
                  <DialogDescription>
                    Type what happens next and press Generate to add a new panel. Click thumbnails to navigate. Tap the speaker icon in a bubble to hear the text.
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          </div>
          
          {/* Center Title */}
          <div className="flex-1 flex justify-center items-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent drop-shadow-lg font-kids tracking-wide">
              YOUR ADVENTURE
            </h1>
          </div>
          
          {/* View Whole Comic Button - Right */}
          <div className="flex-1 flex justify-end">
          <Dialog>
            <DialogTrigger asChild>
                              <Button variant="default" aria-label="View whole comic" className="border-2 bg-primary text-primary-foreground btn-animate px-4 hover:bg-primary/90" style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)', boxShadow: '0 4px 0 hsl(from hsl(var(--primary)) h s 25%)' }}>
                View Whole Comic
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Your Adventure (All Panels)</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {panels.map((p, i) => (
                                      <figure key={p.id} className="rounded-lg border-2 bg-card" style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)' }}>
                                          <img src={p.image} alt={`Panel ${i + 1}`} className="w-full h-auto object-cover border-2 rounded-t-lg" style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)' }} />
                    <figcaption className="px-2 py-1 text-sm font-semibold">{i + 1}. {p.text}</figcaption>
                  </figure>
                ))}
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </header>



        <main 
          className="flex-1 flex items-center justify-center min-h-0 overflow-hidden p-6 bg-primary/60 relative" 
          style={{
            backgroundImage: `url('/backgrounds/random.png')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundBlendMode: 'multiply'
          }}
          role="main"
        >
          {/* Glass blur overlay to soften the background */}
          <div className="absolute inset-0 backdrop-blur-sm bg-primary/10"></div>
          {/* Unified Container - Comic Panel + Sidebar */}
          <div 
            className="flex rounded-3xl overflow-hidden border-4 shadow-xl relative z-10"
            style={{ 
              width: sidebarCollapsed ? '88vw' : `calc(75vw + ${chatPanelWidth}px)`,
              height: 'calc(100vh - 120px)',
              maxHeight: 'calc(100vh - 120px)',
              transition: 'width 0.3s ease-in-out',
              borderColor: 'hsl(from hsl(var(--primary)) h s 25%)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px hsla(var(--primary), 0.1)'
            }}
          >
            {/* Main Comic Panel - Left Side */}
            <section 
              aria-label="Main comic panel" 
              className="flex flex-col min-h-0 relative flex-1 bg-white"
            >
              <div className="flex-1 min-h-0 relative">
                <ComicPanel
                  image={current.image}
                  className="h-full w-full"
                  isNew={current.id === newlyCreatedPanelId}
                  shouldZoom={current.id === zoomingPanelId}
                  onPreviousPanel={() => {
                    if (currentIndex > 0) {
                      setCurrent(currentIndex - 1);
                    }
                  }}
                  onNextPanel={() => {
                    if (currentIndex < panels.length - 1) {
                      setCurrent(currentIndex + 1);
                    }
                  }}
                  hasPrevious={currentIndex > 0}
                  hasNext={currentIndex < panels.length - 1}
                />
              </div>
            </section>

                          {/* Vertical Separator */}
              {(!sidebarCollapsed || sidebarAnimatingOut) && (
                <div className="w-1" style={{ backgroundColor: 'hsl(from hsl(var(--primary)) h s 25%)' }}></div>
              )}

              {/* Right Sidebar with Avatar, Messages and Input */}
              {(!sidebarCollapsed || sidebarAnimatingOut) && (
                <aside 
                  ref={resizeRef}
                  className={`flex flex-col min-h-0 z-10 relative ${
                    sidebarAnimatingOut ? 'animate-slide-out-right' : 'animate-slide-in-right'
                  } ${isResizing ? 'chat-panel-resizing' : ''}`}
                  style={{ 
                    width: sidebarAnimatingOut ? '0px' : `${chatPanelWidth}px`,
                    height: '100%',
                    backgroundImage: `url('/backgrounds/random.png')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    transition: isResizing ? 'none' : sidebarAnimatingOut ? 'width 0.3s ease-in' : 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }}
                >
                {/* Glass Film Overlay - Between pattern and content */}
                <div 
                  className="absolute inset-0 backdrop-blur-sm bg-gradient-to-b from-primary/15 via-white/40 to-primary/10"
                  style={{ zIndex: 1 }}
                ></div>
                
                {/* Content Container - Above the glass film */}
                <div className="relative z-10 flex flex-col h-full">
                              {/* Close Button - Top Right */}
                <div className="absolute top-3 right-3 z-20">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    playClickSound();
                    setSidebarAnimatingOut(true);
                    setTimeout(() => {
                      setSidebarCollapsed(true);
                      setSidebarAnimatingOut(false);
                    }, 300);
                  }}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground btn-animate bg-white/20 backdrop-blur-sm rounded-full"
                  aria-label="Close chat panel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
                              {/* Avatar Section */}
                <div className="flex-shrink-0 relative">
                  {/* Darker theme film for avatar section */}
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/20 to-primary/25 backdrop-blur-sm"></div>
                  <div className="relative z-10">
                    <ChatAvatar />
                  </div>
                </div>
              
                            {/* Messages */}
              <div className="flex-1 min-h-0 relative">
                {/* Messages Container */}
                <div 
                  ref={messagesScrollRef}
                  className="h-full overflow-y-auto space-y-3 p-3 bg-white/95 backdrop-blur-sm"
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
                              : "bg-card border-2"
                          )}
                          style={message.type === 'ai' ? { borderColor: 'hsl(from hsl(var(--primary)) h s 25%)' } : {}}
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
                <div className="flex-shrink-0 p-3 border-t border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
                <InputBar onGenerate={onGenerate} onGenerateImage={onGenerateImage} />
              </div>
              
              {/* Resize Handle */}
              <div
                className="absolute top-0 left-0 w-1 h-full cursor-ew-resize bg-transparent hover:bg-foreground/20 transition-colors duration-200 group"
                onMouseDown={handleResizeStart}
                title="Drag to resize chat panel"
              >
                <div className="absolute top-1/2 -translate-y-1/2 left-0 w-1 h-12 bg-transparent group-hover:bg-foreground/50 transition-colors duration-200" />
              </div>
                </div>
            </aside>
            )}
          </div>
        </main>

        {/* Messenger Chat when sidebar is collapsed */}
        {sidebarCollapsed && (
          <MessengerChat 
            messages={chatMessages} 
            onGenerate={onGenerate}
            onGenerateImage={onGenerateImage}
            onExpandChat={() => {
              playClickSound();
              setSidebarCollapsed(false);
              setSidebarAnimatingOut(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
