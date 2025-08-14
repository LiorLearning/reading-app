import React, { useCallback, useMemo, useState, useEffect } from "react";
import ComicHeader from "@/components/comic/ComicHeader";
import ComicPanel from "@/components/comic/ComicPanel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Undo2, Palette, HelpCircle, BookOpen, Eye, EyeOff } from "lucide-react";
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
  const [newlyCreatedPanelId, setNewlyCreatedPanelId] = React.useState<string | null>(null);
  const [isInputVisible, setIsInputVisible] = React.useState(true);
  const [buttonsVisible, setButtonsVisible] = React.useState(true);
  
  // Comic panel resize functionality
  const [comicPanelWidth, setComicPanelWidth] = React.useState(70); // 70% of screen width to make room for buttons
  const [isResizing, setIsResizing] = React.useState(false);

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps



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
      // Add user message first
      const userMessage: ChatMessage = {
        type: 'user',
        content: text,
        timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, userMessage]);
      
      // Check if user wants to generate an image
      const shouldGenerateImage = text.toLowerCase().includes('generate image');
      
      if (shouldGenerateImage) {
        // Generate new panel
        const image = images[Math.floor(Math.random() * images.length)];
        const newPanelId = crypto.randomUUID();
        addPanel({ id: newPanelId, image, text });
        setNewlyCreatedPanelId(newPanelId);
        
        // Auto-hide input bar to show full image
        setIsInputVisible(false);
        
        // Clear the new panel indicator after animation
        setTimeout(() => setNewlyCreatedPanelId(null), 2000);
      }
      
      // Generate AI response with delay for natural feel
      setTimeout(() => {
        const aiResponse = shouldGenerateImage 
          ? "Amazing! 🎨 I've created a new scene for your adventure. Check out that beautiful image!"
          : generateAIResponse(text);
        const aiMessage: ChatMessage = {
          type: 'ai',
          content: aiResponse,
          timestamp: Date.now()
        };
        setChatMessages(prev => [...prev, aiMessage]);
      }, 800);
    },
    [addPanel, images, generateAIResponse, setIsInputVisible]
  );

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const newWidthPercent = (e.clientX / window.innerWidth) * 100;
    const minWidth = 30; // Minimum 30% of screen width
    const maxWidth = 80; // Maximum 80% of screen width to leave room for buttons
    
    if (newWidthPercent >= minWidth && newWidthPercent <= maxWidth) {
      setComicPanelWidth(newWidthPercent);
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
            <ComicHeader />
          </div>
        </div>

        <main className="flex-1 flex items-center justify-center min-h-0 overflow-hidden p-1" role="main">
          <div className="flex items-center gap-4 max-w-full max-h-full">
            {/* Main Comic Panel with Chat Overlay - Resizable */}
            <section 
              aria-label="Main comic panel" 
              className="flex flex-col min-h-0 relative"
              style={{ 
                width: `${Math.min(comicPanelWidth, 85)}vw`,
                height: '80vh',
                maxHeight: 'calc(100vh - 120px)',
                transition: isResizing ? 'none' : 'width 0.2s ease-out'
              }}
            >
              <div className="flex-1 min-h-0 relative">
                <ComicPanel
                  image={current.image}
                  className="h-full w-full"
                  isNew={current.id === newlyCreatedPanelId}
                  chatMessages={chatMessages}
                  onGenerate={onGenerate}
                  isInputVisible={isInputVisible}
                  onToggleInput={() => setIsInputVisible(!isInputVisible)}
                />
                
                {/* Resize Handle */}
                <div
                  className="absolute top-0 right-0 w-2 h-full cursor-ew-resize bg-transparent hover:bg-foreground/20 transition-colors duration-200 group z-40"
                  onMouseDown={handleResizeStart}
                  title="Drag to resize comic panel"
                >
                  <div className="absolute top-1/2 -translate-y-1/2 right-0 w-1 h-16 bg-foreground/30 group-hover:bg-foreground/60 transition-colors duration-200 rounded-l" />
                </div>
              </div>
            </section>

            {/* Control Buttons Panel - positioned to the right of the comic */}
            <aside className="flex flex-col gap-3 p-4">
              {/* Toggle Button - Always Visible */}
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setButtonsVisible(!buttonsVisible)}
                aria-label={buttonsVisible ? "Hide controls" : "Show controls"}
                className="border-2 border-foreground shadow-solid bg-white btn-animate"
              >
                {buttonsVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>

              {/* Control Buttons - Conditionally Visible */}
              {buttonsVisible && (
                <>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon" aria-label="View whole comic" className="border-2 border-foreground shadow-solid bg-white btn-animate">
                        <BookOpen className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>Your Adventure (All Panels)</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                        {panels.map((p, i) => (
                          <figure key={p.id} className="rounded-lg border-2 border-foreground bg-card">
                            <img src={p.image} alt={`Panel ${i + 1}`} className="w-full h-auto object-cover border-2 border-foreground rounded-t-lg" />
                            <figcaption className="px-2 py-1 text-sm font-semibold">{i + 1}. {p.text}</figcaption>
                          </figure>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={undo} 
                    aria-label="Undo" 
                    className="border-2 border-foreground shadow-solid bg-white btn-animate"
                  >
                    <Undo2 />
                  </Button>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" aria-label="Change theme color" className="border-2 border-foreground shadow-solid bg-white btn-animate">
                        <Palette className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2" align="end">
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
                      <Button variant="outline" size="icon" aria-label="Help" className="border-2 border-foreground shadow-solid bg-white btn-animate">
                        <HelpCircle />
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
                </>
              )}
            </aside>


          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
