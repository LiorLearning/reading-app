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
  const [newlyCreatedPanelId, setNewlyCreatedPanelId] = React.useState<string | null>(null);
  const [zoomingPanelId, setZoomingPanelId] = React.useState<string | null>(null);
  const [lastMessageCount, setLastMessageCount] = React.useState(0);
  const messagesScrollRef = React.useRef<HTMLDivElement>(null);
  
  // Responsive aspect ratio management
  const [screenSize, setScreenSize] = React.useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  
  React.useEffect(() => {
    const updateScreenSize = () => {
      if (window.innerWidth <= 640) {
        setScreenSize('mobile');
      } else if (window.innerWidth <= 1024) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };
    
    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);
  
  const getAspectRatio = React.useMemo(() => {
    // Consistent height across both states - both give 1000px height at 1600px width
    if (sidebarCollapsed) {
      return screenSize === 'mobile' ? '4/3' : '16/10'; // 1600px width = 1000px height
    } else {
      return screenSize === 'mobile' ? '4/3' : '16/10'; // Same height as collapsed for consistency
    }
  }, [screenSize, sidebarCollapsed]);

  
  // Color theme options
  const colorThemes = [
    { name: "Purple", primary: "262 73% 60%", background: "262 30% 97%", accent: "262 73% 60%", hue: "262" },
    { name: "Pink", primary: "350 81% 55%", background: "350 30% 97%", accent: "350 81% 55%", hue: "350" },
    { name: "Blue", primary: "220 91% 55%", background: "220 30% 97%", accent: "220 91% 55%", hue: "220" },
    { name: "Green", primary: "142 76% 36%", background: "142 30% 97%", accent: "142 76% 36%", hue: "142" },
    { name: "Orange", primary: "25 85% 45%", background: "25 30% 97%", accent: "25 85% 45%", hue: "25" },
    { name: "Teal", primary: "180 83% 35%", background: "180 30% 97%", accent: "180 83% 35%", hue: "180" },
    { name: "Red", primary: "0 84% 55%", background: "0 30% 97%", accent: "0 84% 55%", hue: "0" },
    { name: "Indigo", primary: "240 85% 55%", background: "240 30% 97%", accent: "240 85% 55%", hue: "240" },
    { name: "Navy", primary: "210 100% 40%", background: "210 30% 97%", accent: "210 100% 40%", hue: "210" },
    { name: "Emerald", primary: "160 84% 39%", background: "160 30% 97%", accent: "160 84% 39%", hue: "160" },
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
  
  // Chat panel resize functionality - now proportional
  const [chatPanelWidthPercent, setChatPanelWidthPercent] = React.useState(20); // 20% of container width (smaller default)
  const [isResizing, setIsResizing] = React.useState(false);
  const resizeRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current || !resizeRef.current || sidebarCollapsed) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const relativeX = e.clientX - containerRect.left;
    const newWidthPercent = ((containerRect.width - relativeX) / containerRect.width) * 100;
    
    // Constrain between 20% and 40% of container width
    const minPercent = 20;
    const maxPercent = 40;
    
    if (newWidthPercent >= minPercent && newWidthPercent <= maxPercent) {
      setChatPanelWidthPercent(newWidthPercent);
    }
  }, [isResizing, sidebarCollapsed]);

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
          className="flex items-center justify-center py-3 lg:py-4 border-b-2 border-foreground/10 bg-white/30 backdrop-blur-md relative"
          style={{
            boxShadow: '0 4px 8px -2px rgba(0, 0, 0, 0.1)'
          }}
        >
          {/* Left Tools Group - Positioned to align with purple container */}
          <div 
            className="absolute left-0 flex items-center gap-1 lg:gap-2"
            style={{
              marginLeft: `calc((100% - 92%) / 2)` // Align with left edge of purple container
            }}
          >
            <Popover>
              <PopoverTrigger asChild>
                                  <Button variant="outline" size="icon" aria-label="Change theme color" className="border-2 bg-white btn-animate" style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)', boxShadow: '0 4px 0 black' }} onClick={() => playClickSound()}>
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
                      className={`h-8 w-8 btn-animate rounded-full ${
                        selectedTheme.name === theme.name ? 'ring-2 ring-foreground ring-offset-2' : ''
                      }`}
                      aria-label={`Change theme to ${theme.name}`}
                      style={{
                        backgroundColor: `hsl(${theme.primary})`
                      }}
                    >
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            
            <Dialog>
              <DialogTrigger asChild>
                                  <Button variant="outline" size="icon" aria-label="Help" className="border-2 bg-white btn-animate" style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)', boxShadow: '0 4px 0 black' }} onClick={() => playClickSound()}>
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
            <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent drop-shadow-lg font-kids tracking-wide">
              YOUR ADVENTURE
            </h1>
          </div>
          
          {/* View Whole Comic Button - Right - Positioned to align with purple container */}
          <div 
            className="absolute right-0 flex"
            style={{
              marginRight: `calc((100% - 92%) / 2)` // Align with right edge of purple container
            }}
          >
            <Dialog>
              <DialogTrigger asChild>
                                <Button variant="default" aria-label="View whole comic" className="border-2 bg-primary text-primary-foreground btn-animate px-4 hover:bg-primary/90" style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)', boxShadow: '0 4px 0 black' }} onClick={() => playClickSound()}>
                  View Whole Comic
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Your Adventure (All Panels)</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {panels.map((p, i) => (
                                        <figure key={p.id} className="rounded-lg border-2 bg-card" style={{ borderColor: 'hsla(var(--primary), 0.9)' }}>
                                            <img src={p.image} alt={`Panel ${i + 1}`} className="w-full h-auto object-cover border-2 rounded-t-lg" style={{ borderColor: 'hsla(var(--primary), 0.9)' }} />
                      <figcaption className="px-2 py-1 text-sm font-semibold">{i + 1}. {p.text}</figcaption>
                    </figure>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>



        <main 
          className="flex-1 flex items-center justify-center min-h-0 overflow-hidden px-4 py-4 lg:px-6 bg-primary/60 relative" 
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
          {/* Wrapper for both background and content to scale together */}
          <div 
            className="relative responsive-max-width"
            style={{ 
              width: '95%', // 5% reduction from full width
              maxWidth: '1520px',
              aspectRatio: getAspectRatio,
              maxHeight: 'calc(100vh - 100px)',
              minHeight: '500px',
              transition: 'all 0.3s ease-in-out'
            }}
          >
            {/* Background Container with Border and Fill */}
            <div 
              className="absolute inset-0 rounded-3xl z-0"
              style={{ 
                border: '4px solid hsl(var(--primary) / 0.9)',
                boxShadow: '0 0 12px 3px rgba(0, 0, 0, 0.15)',
                backgroundColor: 'hsl(var(--primary) / 0.9)'
              }}
            ></div>
            
            {/* Content Container - Comic Panel + Sidebar */}
            <div 
              ref={containerRef}
              className="flex relative z-10 h-full w-full"
              style={{ 
                paddingTop: '8px',
                paddingBottom: '8px',
                paddingLeft: '8px',
                paddingRight: '8px'
              }}
          >
            {/* Main Comic Panel - Left Side */}
            <section 
              aria-label="Main comic panel" 
              className="flex flex-col min-h-0 relative flex-1 bg-white rounded-3xl overflow-hidden border-2 border-black transition-all duration-300 ease-in-out"
              style={{ marginRight: sidebarCollapsed ? '0px' : '5px' }}
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

                          {/* No separator needed with rounded design */}

              {/* Right Sidebar with Avatar, Messages and Input */}
              <aside 
                ref={resizeRef}
                className={`flex flex-col min-h-0 z-10 relative rounded-3xl overflow-hidden border-2 border-black transition-all duration-300 ease-in-out ${isResizing ? 'chat-panel-resizing' : ''}`}
                style={{ 
                  width: sidebarCollapsed ? '0%' : `${chatPanelWidthPercent}%`,
                  minWidth: sidebarCollapsed ? '0px' : '320px',
                  maxWidth: sidebarCollapsed ? '0px' : '450px',
                  opacity: sidebarCollapsed ? 0 : 1,
                  height: '100%',
                  backgroundImage: `url('/backgrounds/random.png')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                                     marginLeft: sidebarCollapsed ? '0px' : '5px',
                  pointerEvents: sidebarCollapsed ? 'none' : 'auto'
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
                {!sidebarCollapsed && (
                  <div className="absolute top-3 right-3 z-20">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        playClickSound();
                        setSidebarCollapsed(true);
                      }}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground btn-animate bg-white/20 backdrop-blur-sm rounded-full"
                      aria-label="Close chat panel"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              
                              {/* Content only shown when not collapsed */}
                {!sidebarCollapsed && (
                  <>
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
                                style={message.type === 'ai' ? { borderColor: 'hsla(var(--primary), 0.9)' } : {}}
                              >
                                <div className="font-medium text-xs mb-1 opacity-70">
                                  {message.type === 'user' ? 'You' : '🤖 Krafty'}
                                </div>
                                <div>{message.content}</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    
                    {/* Input Bar */}
                    <div className="flex-shrink-0 p-3 border-t border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
                      <InputBar onGenerate={onGenerate} onGenerateImage={onGenerateImage} />
                    </div>
                  </>
                )}
              
              {/* Resize Handle - Hidden on mobile and when collapsed */}
              {!sidebarCollapsed && (
                <div
                  className="absolute top-0 left-0 w-1 h-full cursor-ew-resize bg-transparent hover:bg-foreground/20 transition-colors duration-200 group hidden sm:block"
                  onMouseDown={handleResizeStart}
                  title="Drag to resize chat panel"
                >
                  <div className="absolute top-1/2 -translate-y-1/2 left-0 w-1 h-12 bg-transparent group-hover:bg-foreground/50 transition-colors duration-200" />
                </div>
              )}
                </div>
                         </aside>
            </div>
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
            }}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
