import React, { useCallback, useMemo } from "react";
import ComicHeader from "@/components/comic/ComicHeader";
import ComicPanel from "@/components/comic/ComicPanel";
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
  
  // Comic panel resize functionality
  const [comicPanelWidth, setComicPanelWidth] = React.useState(80); // 80% of screen width
  const [isResizing, setIsResizing] = React.useState(false);



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
    const maxWidth = 95; // Maximum 95% of screen width
    
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
            <ComicHeader 
              onUndo={undo} 
              panels={panels}
            />
          </div>
        </div>

        <main className="flex-1 flex min-h-0 overflow-hidden p-1" role="main">
          {/* Main Comic Panel with Chat Overlay - Resizable */}
          <section 
            aria-label="Main comic panel" 
            className="flex flex-col min-h-0 relative"
            style={{ 
              width: `${comicPanelWidth}%`,
              height: 'calc(100vh - 100px)',
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

          {/* Side Info Panel - shows when comic panel is resized smaller */}
          {comicPanelWidth < 90 && (
            <aside 
              className="flex-1 min-h-0 p-4 bg-pattern-light border-l-2 border-foreground"
              style={{ height: 'calc(100vh - 100px)' }}
            >
              <div className="h-full flex flex-col items-center justify-center text-center">
                <h3 className="text-lg font-bold mb-2">Story Details</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Panel {currentIndex + 1} of {panels.length}
                </p>
                <div className="text-sm bg-card border-2 border-foreground p-3 rounded-lg">
                  <p className="font-medium mb-1">Current Scene:</p>
                  <p className="italic">"{current.text}"</p>
                </div>
                {panels.length > 1 && (
                  <div className="mt-4 text-xs text-muted-foreground">
                    <p>📖 {panels.length} panels created</p>
                    <p>💬 {chatMessages.length} messages exchanged</p>
                  </div>
                )}
              </div>
            </aside>
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;
