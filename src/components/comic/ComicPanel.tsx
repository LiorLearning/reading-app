import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { playClickSound } from "@/lib/sounds";

interface ComicPanelProps {
  image: string;
  className?: string;
  isNew?: boolean;
  shouldZoom?: boolean;
  onPreviousPanel?: () => void;
  onNextPanel?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

const ComicPanel: React.FC<ComicPanelProps> = ({ 
  image, 
  className, 
  isNew,
  shouldZoom = false,
  onPreviousPanel,
  onNextPanel,
  hasPrevious = false,
  hasNext = false
}) => {
  return (
    <div className={cn(
      "relative w-full h-full flex flex-col overflow-hidden",
      shouldZoom && "animate-comic-panel-zoom",
      className
    )}>
      <div className="flex-1 min-h-0 relative">
        {isNew ? (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-purple-400 via-pink-300 to-blue-400 flex items-center justify-center">
            {/* Simple Loading Container */}
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 border-4 border-white shadow-2xl relative overflow-hidden max-w-md w-full mx-4">
              {/* Animated Magic Sparkles */}
              <div className="absolute inset-0 overflow-hidden rounded-3xl">
                <div className="absolute top-4 left-4 w-3 h-3 bg-yellow-400 rounded-full animate-ping"></div>
                <div className="absolute top-8 right-8 w-2 h-2 bg-pink-400 rounded-full animate-ping" style={{animationDelay: '0.5s'}}></div>
                <div className="absolute bottom-6 left-8 w-2 h-2 bg-blue-400 rounded-full animate-ping" style={{animationDelay: '1s'}}></div>
                <div className="absolute bottom-4 right-4 w-3 h-3 bg-purple-400 rounded-full animate-ping" style={{animationDelay: '1.5s'}}></div>
                <div className="absolute top-1/2 left-1/4 w-1 h-1 bg-green-400 rounded-full animate-ping" style={{animationDelay: '2s'}}></div>
                <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-orange-400 rounded-full animate-ping" style={{animationDelay: '2.5s'}}></div>
              </div>
              
              {/* Central Animation */}
              <div className="relative flex flex-col items-center">
                {/* Rotating Circle */}
                <div className="w-20 h-20 mb-6 relative">
                  <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 border-r-pink-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-2 border-4 border-transparent border-b-blue-500 border-l-green-500 rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full animate-pulse"></div>
                  </div>
                </div>
                
                {/* Loading Text */}
                <div className="text-center">
                  <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-2">
                    ✨ Creating Magic ✨
                  </div>
                  <div className="text-gray-600 text-sm animate-pulse">
                    Your adventure image is being crafted...
                  </div>
                </div>
                
                {/* Animated Progress Dots */}
                <div className="flex gap-2 mt-4">
                  <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce"></div>
                  <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
            
            {/* Image with fade-in animation - starts hidden */}
            <div className="absolute inset-0 w-full h-full opacity-0 overflow-hidden" style={{ 
              animation: 'fadeIn 1s ease-out forwards',
              animationDelay: '1.8s'
            }}>
              {/* Blurred background image */}
              <img 
                src={image} 
                alt=""
                className="absolute inset-0 w-full h-full object-cover object-center"
                loading="lazy"
                style={{
                  filter: 'blur(20px) brightness(0.7) contrast(1.1) saturate(1.1)',
                  transform: 'scale(1.1)' // Slightly scale to avoid blur edges
                }}
              />
              {/* Main image - original size, centered */}
              <div className="relative w-full h-full flex items-center justify-center z-10">
                <img 
                  src={image} 
                  alt="Current comic scene" 
                  className="max-w-full max-h-full"
                  loading="lazy"
                  style={{
                    filter: 'brightness(1.05) contrast(1.1) saturate(1.1)'
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full overflow-hidden">
            {/* Blurred background image */}
            <img 
              src={image} 
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-center"
              loading="lazy"
              style={{
                filter: 'blur(20px) brightness(0.7) contrast(1.1) saturate(1.1)',
                transform: 'scale(1.1)' // Slightly scale to avoid blur edges
              }}
            />
            {/* Main image - original size, centered */}
            <div className="relative w-full h-full flex items-center justify-center z-10">
              <img 
                src={image} 
                alt="Current comic scene" 
                className="max-w-full max-h-full"
                loading="lazy"
                style={{
                  filter: 'brightness(1.05) contrast(1.1) saturate(1.1)'
                }}
              />
            </div>
          </div>
        )}
        
        {/* Navigation Buttons - Always visible and positioned around the image */}
        {/* Left Navigation Button */}
        {hasPrevious && onPreviousPanel && (
          <div className="absolute left-2 top-1/2 transform -translate-y-1/2 z-30">
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                playClickSound();
                onPreviousPanel();
              }}
              className="bg-black/70 hover:bg-black/90 text-white rounded-full p-3 
                         transition-all duration-200 hover:scale-110 shadow-lg
                         border-2 border-white/20 hover:border-white/40
                         backdrop-blur-sm"
              aria-label="Previous panel"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          </div>
        )}
        
        {/* Right Navigation Button */}
        {hasNext && onNextPanel && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 z-30">
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                playClickSound();
                onNextPanel();
              }}
              className="bg-black/70 hover:bg-black/90 text-white rounded-full p-3 
                         transition-all duration-200 hover:scale-110 shadow-lg
                         border-2 border-white/20 hover:border-white/40
                         backdrop-blur-sm"
              aria-label="Next panel"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComicPanel;
