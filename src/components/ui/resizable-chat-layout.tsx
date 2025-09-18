import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ResizableChatLayoutProps {
  petContent: React.ReactNode;
  chatContent: React.ReactNode;
  className?: string;
  defaultPetRatio?: number; // 0-1, where 0.7 means pet takes 70% of space
  minPetRatio?: number;
  maxPetRatio?: number;
  onRatioChange?: (ratio: number) => void;
}

const ResizableChatLayout: React.FC<ResizableChatLayoutProps> = ({
  petContent,
  chatContent,
  className = '',
  defaultPetRatio = 0.65, // Pet takes 65% by default
  minPetRatio = 0.3,
  maxPetRatio = 0.8,
  onRatioChange
}) => {
  const [petRatio, setPetRatio] = useState(() => {
    // Try to load from localStorage first
    const saved = localStorage.getItem('chat-pet-ratio');
    return saved ? parseFloat(saved) : defaultPetRatio;
  });
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Save to localStorage whenever ratio changes
  useEffect(() => {
    localStorage.setItem('chat-pet-ratio', petRatio.toString());
    onRatioChange?.(petRatio);
  }, [petRatio, onRatioChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const newRatio = (e.clientY - rect.top) / rect.height;
    const clampedRatio = Math.max(minPetRatio, Math.min(maxPetRatio, newRatio));
    setPetRatio(clampedRatio);
  }, [isResizing, minPetRatio, maxPetRatio]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const chatRatio = 1 - petRatio;

  return (
    <div 
      ref={containerRef}
      className={cn("flex flex-col h-full relative", className)}
    >
      {/* Pet Content Area */}
      <div 
        className="relative overflow-hidden"
        style={{ height: `${petRatio * 100}%` }}
      >
        {petContent}
      </div>

      {/* Resize Handle */}
      <div
        className={cn(
          "relative h-2 cursor-ns-resize group flex items-center justify-center",
          "bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20",
          "hover:bg-gradient-to-r hover:from-primary/30 hover:via-primary/60 hover:to-primary/30",
          "transition-all duration-200",
          isResizing && "bg-primary/60"
        )}
        onMouseDown={handleMouseDown}
        title="Drag to resize pet and chat areas"
      >
        {/* Visual indicator */}
        <div className={cn(
          "w-12 h-1 rounded-full bg-white/60 group-hover:bg-white/80 transition-colors",
          isResizing && "bg-white"
        )} />
        
        {/* Invisible larger hit area for easier dragging */}
        <div className="absolute inset-0 -my-2" />
      </div>

      {/* Chat Content Area */}
      <div 
        className="relative overflow-hidden flex-1"
        style={{ height: `${chatRatio * 100}%` }}
      >
        {chatContent}
      </div>

    </div>
  );
};

export default ResizableChatLayout;
