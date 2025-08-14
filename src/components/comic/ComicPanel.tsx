import React from "react";
import { cn } from "@/lib/utils";
import ChatOverlay from "./ChatOverlay";

interface ChatMessage {
  type: 'user' | 'ai';
  content: string;
  timestamp: number;
}

interface ComicPanelProps {
  image: string;
  className?: string;
  isNew?: boolean;
  chatMessages?: ChatMessage[];
  onGenerate?: (text: string) => void;
  isInputVisible?: boolean;
  onToggleInput?: () => void;
}

const ComicPanel: React.FC<ComicPanelProps> = ({ 
  image, 
  className, 
  isNew,
  chatMessages = [],
  onGenerate = () => {},
  isInputVisible = true,
  onToggleInput = () => {}
}) => {
  // State to control zoom effect timing
  const [showZoomEffect, setShowZoomEffect] = React.useState(false);
  
  // Generate stable random colors for boxes when isNew changes
  const boxColors = React.useMemo(() => {
    const colorSets = [
      ['bg-red-500', 'bg-blue-500', 'bg-green-500'],
      ['bg-purple-500', 'bg-pink-500', 'bg-indigo-500'],
      ['bg-orange-500', 'bg-teal-500', 'bg-cyan-500']
    ];
    // Use timestamp-based seed for stable randomness
    const seed = isNew ? Date.now() : 0;
    return colorSets.map((colors, index) => colors[(seed + index) % colors.length]);
  }, [isNew]);
  
  // Track previous isNew state to detect when image becomes visible
  const prevIsNew = React.useRef(isNew);
  
  React.useEffect(() => {
    // Trigger zoom effect when isNew changes from true to false (image appears)
    if (prevIsNew.current === true && isNew === false) {
      // Image appeared! Triggering zoom AND shimmer effect
      setShowZoomEffect(true);
      
      // Remove zoom effect after animation completes (0.8s)
      const removeTimer = setTimeout(() => {
        // Removing zoom and shimmer effect
        setShowZoomEffect(false);
      }, 800);
      
      return () => clearTimeout(removeTimer);
    }
    
    // Update previous state
    prevIsNew.current = isNew;
  }, [isNew]);
  return (
    <div className={cn(
      "relative w-full h-full flex flex-col overflow-hidden book-container",
      showZoomEffect && "zoom-in-effect",
      className
    )}>
      <div className="flex-1 min-h-0 relative">
        {isNew ? (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-orange-300 to-orange-400 flex items-center justify-center">
            {/* Centered Factory Loading Container */}
            <div className="bg-blue-600 rounded-2xl p-8 border-4 border-black shadow-xl relative overflow-hidden max-w-sm w-full mx-4">
              {/* Conveyor Belt Section with Moving Boxes */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4 relative overflow-hidden h-20">
                {/* Conveyor Belt Base */}
                <div className="absolute inset-x-2 bottom-2 h-6 bg-black rounded-full">
                  <div className="absolute inset-0 bg-repeating-linear-gradient-45 opacity-30"></div>
                </div>
                
                {/* Moving Boxes on Conveyor */}
                <div className="absolute inset-0">
                  <div className={`absolute top-2 w-8 h-8 ${boxColors[0]} border-2 border-black rounded animate-factory-box-1`}></div>
                  <div className={`absolute top-2 w-8 h-8 ${boxColors[1]} border-2 border-black rounded animate-factory-box-2`}></div>
                  <div className={`absolute top-2 w-8 h-8 ${boxColors[2]} border-2 border-black rounded animate-factory-box-3`}></div>
                </div>
                
                {/* Gears */}
                <div className="absolute -top-2 -left-2 w-8 h-8 bg-gray-700 rounded-full border-2 border-black animate-factory-gear">
                  <div className="absolute inset-1 bg-yellow-400 rounded-full"></div>
                </div>
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-gray-700 rounded-full border-2 border-black animate-factory-gear" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}>
                  <div className="absolute inset-1 bg-yellow-400 rounded-full"></div>
                </div>
                
                {/* Robotic Arm */}
                <div className="absolute top-0 right-4 w-16 h-4 bg-yellow-500 rounded transform -rotate-12 border-2 border-black">
                  <div className="absolute -right-2 -top-1 w-6 h-6 bg-gray-600 rounded-full border-2 border-black"></div>
                </div>
              </div>
              
              {/* Factory Chimney with Smoke */}
              <div className="absolute -top-4 right-8 w-6 h-12 bg-blue-800 border-2 border-black rounded-t-lg">
                <div className="absolute -top-2 -left-1 w-2 h-2 bg-gray-300 rounded-full animate-factory-smoke"></div>
                <div className="absolute -top-3 left-1 w-3 h-3 bg-gray-400 rounded-full animate-factory-smoke" style={{animationDelay: '0.5s'}}></div>
                <div className="absolute -top-4 -right-1 w-2 h-2 bg-gray-300 rounded-full animate-factory-smoke" style={{animationDelay: '1s'}}></div>
              </div>
              
              {/* Progress Bar with Stripes */}
              <div className="bg-gray-800 rounded-full h-8 mb-4 overflow-hidden border-2 border-black">
                <div className="h-full bg-striped-progress rounded-full animate-factory-progress"></div>
              </div>
              
              {/* Loading Text */}
              <div className="text-center">
                <div className="text-white text-lg font-bold animate-factory-blink">
                  Creating your masterpiece...
                </div>
              </div>
              
              {/* Decorative gears in corners */}
              <div className="absolute bottom-2 left-2 w-4 h-4 bg-gray-600 rounded-full animate-factory-gear" style={{animationDuration: '3s'}}></div>
              <div className="absolute bottom-2 right-2 w-3 h-3 bg-gray-600 rounded-full animate-factory-gear" style={{animationDuration: '2.5s', animationDirection: 'reverse'}}></div>
            </div>
            
            {/* Image with improved animation - starts hidden */}
            <div className={cn(
              "absolute inset-0 w-full h-full border-2 border-foreground rounded-2xl overflow-hidden",
              showZoomEffect && "shimmer-sweep"
            )}>
              <img 
                src={image} 
                alt="Current comic scene" 
                className="absolute inset-0 w-full h-full object-cover opacity-0" 
                loading="lazy" 
                style={{ 
                  animation: 'image-factory-improved 1.5s ease-out forwards',
                  animationDelay: '12s'
                }}
              />
            </div>
          </div>
        ) : (
          <div className={cn(
            "absolute inset-0 w-full h-full border-2 border-foreground rounded-2xl overflow-hidden",
            showZoomEffect && "shimmer-sweep"
          )}>
            <img 
              src={image} 
              alt="Current comic scene" 
              className="absolute inset-0 w-full h-full object-cover" 
              loading="lazy" 
            />
          </div>
        )}
        
        {/* Chat Overlay */}
        <ChatOverlay
          messages={chatMessages}
          onGenerate={onGenerate}
          isVisible={isInputVisible}
          onToggleVisibility={onToggleInput}
        />
      </div>
    </div>
  );
};

export default ComicPanel;
