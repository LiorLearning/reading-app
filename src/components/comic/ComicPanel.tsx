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
  // Generate random colors for boxes each time
  const boxColors = React.useMemo(() => [
    ['bg-red-500', 'bg-blue-500', 'bg-green-500'][Math.floor(Math.random() * 3)],
    ['bg-purple-500', 'bg-pink-500', 'bg-indigo-500'][Math.floor(Math.random() * 3)],
    ['bg-orange-500', 'bg-teal-500', 'bg-cyan-500'][Math.floor(Math.random() * 3)]
  ], [isNew]);
  return (
    <div className={cn(
      "relative w-full h-full flex flex-col overflow-hidden",
      shouldZoom && "animate-comic-panel-zoom",
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
        ) : (
          <img 
            src={image} 
            alt="Current comic scene" 
            className="absolute inset-0 w-full h-full object-cover" 
            loading="lazy" 
          />
        )}
        
        {/* Navigation Hover Zones - Only visible on edge hover */}
        {/* Left Edge Hover Zone */}
        {hasPrevious && onPreviousPanel && (
          <div className="absolute left-0 top-0 w-20 h-full z-20 flex items-center justify-start pl-4 group">
            <ChevronLeft 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                playClickSound();
                onPreviousPanel();
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-300
                       h-12 w-12 text-white drop-shadow-lg cursor-pointer
                       hover:scale-110 hover:text-gray-200 transition-all duration-200"
              aria-label="Previous panel"
            />
          </div>
        )}
        
        {/* Right Edge Hover Zone */}
        {hasNext && onNextPanel && (
          <div className="absolute right-0 top-0 w-20 h-full z-20 flex items-center justify-end pr-4 group">
            <ChevronRight 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                playClickSound();
                onNextPanel();
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-300
                       h-12 w-12 text-white drop-shadow-lg cursor-pointer
                       hover:scale-110 hover:text-gray-200 transition-all duration-200"
              aria-label="Next panel"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ComicPanel;
