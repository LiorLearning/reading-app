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
      { id: "panel-1", image: rocket1, text: "The brave astronaut climbs into ROCKET!" },
      { id: "panel-2", image: alien3, text: "Clouds drift by as the engines warm up." },
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







  const current = panels[currentIndex] ?? initialPanels[0];

  return (
    <div className="h-screen bg-pattern flex flex-col overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="w-full px-4 py-2 flex-1 flex flex-col min-h-0">
        <div className="flex-shrink-0 pb-1 pt-1 flex justify-center">
          <div className="w-full max-w-7xl px-4">
            <ComicHeader 
              onUndo={undo} 
              panels={panels}
            />
          </div>
        </div>

        <main className="flex-1 flex justify-center items-center min-h-0 overflow-hidden p-1" role="main">
          {/* Main Comic Panel with Chat Overlay - Centered */}
          <section 
            aria-label="Main comic panel" 
            className="flex flex-col min-h-0 relative w-full max-w-7xl"
            style={{ 
              height: 'calc(100vh - 100px)'
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
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default Index;
