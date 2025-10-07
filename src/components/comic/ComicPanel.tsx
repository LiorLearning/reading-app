import React from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { playClickSound } from "@/lib/sounds";
import SpellBox from "./SpellBox";
import { useFirebaseImage, useCurrentAdventureId } from "@/hooks/use-firebase-image";

interface ComicPanelProps {
  image: string;
  className?: string;
  isNew?: boolean;
  isGenerating?: boolean;
  shouldZoom?: boolean;
  onPreviousPanel?: () => void;
  onNextPanel?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  // Notifies parent when the current image is actually displayed (after load)
  onImageDisplayed?: () => void;
  // Soft focus when left chat bubble is visible
  softFocus?: boolean;
  // Spell box props
  spellWord?: string;
  spellSentence?: string;
  onSpellComplete?: (isCorrect: boolean, userAnswer?: string, attemptCount?: number) => void;
  onSpellSkip?: () => void;
  onSpellNext?: () => void;
  showSpellBox?: boolean;
  spellQuestion?: {
    id: number;
    word: string;
    questionText: string;
    correctAnswer: string;
    audio: string;
    explanation: string;
  };
  showProgress?: boolean;
  totalQuestions?: number;
  currentQuestionIndex?: number;
  showHints?: boolean;
  showExplanation?: boolean;
  // Realtime session integration
  sendMessage?: (text: string) => void;
  interruptRealtimeSession?: () => void;
}

const ComicPanel: React.FC<ComicPanelProps> = ({ 
  image, 
  className, 
  isNew,
  isGenerating = false,
  shouldZoom = false,
  onPreviousPanel,
  onNextPanel,
  hasPrevious = false,
  hasNext = false,
  onImageDisplayed,
  softFocus = false,
  spellWord,
  spellSentence,
  onSpellComplete,
  onSpellSkip,
  onSpellNext,
  showSpellBox,
  spellQuestion,
  showProgress = false,
  totalQuestions = 1,
  currentQuestionIndex = 0,
  showHints = true,
  showExplanation = true,
  // Realtime session integration
  sendMessage,
  interruptRealtimeSession
}) => {
  // Get current adventure ID for Firebase image resolution
  const currentAdventureId = useCurrentAdventureId();
  
  // Resolve Firebase image if needed
  const { url: resolvedImageUrl, isLoading: isResolvingImage, isExpiredUrl } = useFirebaseImage(image, currentAdventureId || undefined);
  
  const [showImageAfterLoad, setShowImageAfterLoad] = React.useState(false);
  const [previousLoadingState, setPreviousLoadingState] = React.useState(isGenerating);
  const [currentImage, setCurrentImage] = React.useState(resolvedImageUrl);
  const [isImageLoading, setIsImageLoading] = React.useState(false);
  const fadeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const hasNotifiedImageDisplayedRef = React.useRef(false);
  const hasInitializedNewPanelRef = React.useRef(false);
  const isCurrentImageDataUrl = React.useMemo(() => typeof currentImage === 'string' && currentImage.startsWith('data:image'), [currentImage]);
  const incomingImageIsDataUrl = React.useMemo(() => typeof image === 'string' && image.startsWith('data:image'), [image]);
  
  // Update current image when resolved URL changes
  React.useEffect(() => {
    if (incomingImageIsDataUrl) {
      setCurrentImage(image);
      setShowImageAfterLoad(true);
      setIsImageLoading(false);
      return;
    }

    if (resolvedImageUrl !== currentImage) {
      console.log(`🔄 ComicPanel: Image resolved from ${isExpiredUrl ? 'expired DALL-E URL' : 'original'} to: ${resolvedImageUrl.substring(0, 50)}...`);
      setCurrentImage(resolvedImageUrl);
    }
  }, [resolvedImageUrl, currentImage, isExpiredUrl, incomingImageIsDataUrl, image]);

  // Preload image and wait for it to fully load before showing
  const preloadImage = React.useCallback((imageUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image failed to load'));
      img.src = imageUrl;
    });
  }, []);

  // Track when loading completes to trigger image fade-in with proper image loading
  React.useEffect(() => {
    // Clear any existing timeout
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }

    // When isGenerating changes from true to false, preload the new image first
    if (previousLoadingState && !isGenerating) {
      if (incomingImageIsDataUrl || isCurrentImageDataUrl) {
        setShowImageAfterLoad(true);
        setIsImageLoading(false);
        setPreviousLoadingState(isGenerating);
        return;
      }

      setIsImageLoading(true);
      setCurrentImage(image);
      preloadImage(image)
        .then(() => {
          if (!isGenerating) {
            setShowImageAfterLoad(true);
            setIsImageLoading(false);
          }
        })
        .catch((error) => {
          console.warn('Failed to preload image, showing anyway:', error);
          fadeTimeoutRef.current = setTimeout(() => {
            if (!isGenerating) {
              setShowImageAfterLoad(true);
              setIsImageLoading(false);
            }
          }, 300);
        });
    }
    
    // When loading starts again, immediately hide the image
    if (isGenerating && !previousLoadingState && !isCurrentImageDataUrl) {
      setShowImageAfterLoad(false);
      setIsImageLoading(false);
    }
    
    setPreviousLoadingState(isGenerating);
  }, [isGenerating, previousLoadingState, image, preloadImage, incomingImageIsDataUrl, isCurrentImageDataUrl]);

  // Reset state when it's a new panel or image changes
  React.useEffect(() => {
    if (isNew) {
      if (!hasInitializedNewPanelRef.current) {
        setShowImageAfterLoad(false);
        setCurrentImage(image);
        setIsImageLoading(false);
        hasInitializedNewPanelRef.current = true;
      }
    } else if (hasInitializedNewPanelRef.current) {
      hasInitializedNewPanelRef.current = false;
    }
  }, [isNew, image]);

  // Handle image changes during non-loading states
  React.useEffect(() => {
    if (!isGenerating && !isNew && !isImageLoading && image !== currentImage) {
      setIsImageLoading(true);
      
      // Preload the new image before showing it
      preloadImage(image)
        .then(() => {
          setCurrentImage(image);
          setShowImageAfterLoad(true);
          setIsImageLoading(false);
        })
        .catch((error) => {
          console.warn('Failed to preload image during update, showing anyway:', error);
          setCurrentImage(image);
          setShowImageAfterLoad(true);
          setIsImageLoading(false);
        });
    }
  }, [image, currentImage, isGenerating, isNew, isImageLoading, preloadImage]);

  // Handle image changes during fade timeout - preload and update the image
  React.useEffect(() => {
    if (fadeTimeoutRef.current && image !== currentImage && !isGenerating && !isImageLoading) {
      // Clear the existing timeout and preload the new image
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
      
      setIsImageLoading(true);
      
      preloadImage(image)
        .then(() => {
          setCurrentImage(image);
          setShowImageAfterLoad(true);
          setIsImageLoading(false);
        })
        .catch((error) => {
          console.warn('Failed to preload image during timeout handling, showing anyway:', error);
          setCurrentImage(image);
          setShowImageAfterLoad(true);
          setIsImageLoading(false);
        });
    }
  }, [image, currentImage, isGenerating, isImageLoading, preloadImage]);

  // Notify parent exactly once per image display
  React.useEffect(() => {
    if (showImageAfterLoad && !hasNotifiedImageDisplayedRef.current) {
      hasNotifiedImageDisplayedRef.current = true;
      onImageDisplayed?.();
    }
    if (!showImageAfterLoad) {
      hasNotifiedImageDisplayedRef.current = false;
    }
  }, [showImageAfterLoad, onImageDisplayed]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (
      !incomingImageIsDataUrl &&
      !isCurrentImageDataUrl &&
      !isGenerating &&
      !isImageLoading &&
      image === currentImage &&
      !showImageAfterLoad
    ) {
      setShowImageAfterLoad(true);
    }
  }, [incomingImageIsDataUrl, isCurrentImageDataUrl, isGenerating, isImageLoading, image, currentImage, showImageAfterLoad]);
  return (
    <div className={cn(
      "relative w-full h-full flex flex-col overflow-hidden",
      shouldZoom && "animate-comic-panel-zoom",
      className
    )}>
      <div className="flex-1 min-h-0 relative">
        {(() => {
          const isInlineData = incomingImageIsDataUrl || isCurrentImageDataUrl;
          const shouldShowLoader = !isInlineData && !showImageAfterLoad && (isNew || isGenerating || isImageLoading);
          return shouldShowLoader;
        })() ? (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-purple-400 via-pink-300 to-blue-400 flex items-center justify-center">
            {/* Loading Animation Container */}
            <div 
                className={cn(
                  "bg-white/90 rounded-3xl p-8 border-4 border-white shadow-2xl relative overflow-hidden max-w-md w-full mx-4 transition-opacity duration-500",
                showImageAfterLoad && "opacity-0 pointer-events-none"
              )}
            >
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
                    {isImageLoading ? 'Finalizing your adventure image...' : 'Your adventure image is being crafted...'}
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
            
            {/* Image with synchronized fade-in - only shows when loading is complete */}
            <div 
              className={cn(
                "absolute inset-0 w-full h-full overflow-hidden transition-opacity duration-700 ease-out",
                showImageAfterLoad ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >
              {/* Background image with soft blur */}
              <img 
                src={currentImage} 
                alt=""
                className="absolute inset-0 w-full h-full object-cover object-center"
                loading="lazy"
                style={{
                  filter: 'blur(20px) brightness(0.75) contrast(1.1) saturate(1.1)',
                  transform: 'scale(1.08)'
                }}
              />
              {/* Main image - original size, centered */}
              <div className="relative w-full h-full flex items-center justify-center z-10">
                <img 
                  src={currentImage} 
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
            {/* Background image with soft blur */}
            <img 
              src={currentImage} 
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-center"
              loading="lazy"
              style={{
                filter: 'blur(20px) brightness(0.75) contrast(1.1) saturate(1.1)',
                transform: 'scale(1.08)'
              }}
            />
            {/* Main image - original size, centered */}
            <div className="relative w-full h-full flex items-center justify-center z-10">
              <img 
                src={currentImage} 
                alt="Current comic scene" 
                className="max-w-full max-h-full transition-opacity duration-300"
                loading="lazy"
                style={{
                  filter: `brightness(1.05) contrast(1.1) saturate(1.1)`,
                  opacity: showSpellBox ? 0.25 : 1
                }}
              />
            </div>
          </div>
        )}
        
          <SpellBox
            word={spellWord}
            sentence={spellSentence}
            question={spellQuestion}
            onComplete={onSpellComplete}
            onSkip={onSpellSkip}
            onNext={onSpellNext}
            isVisible={showSpellBox}
            showProgress={showProgress}
            totalQuestions={totalQuestions}
            currentQuestionIndex={currentQuestionIndex}
            sendMessage={sendMessage}
            interruptRealtimeSession={interruptRealtimeSession}
            showHints={showHints}
            showExplanation={showExplanation}
          />
        
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
                         border-2 border-white/20 hover:border-white/40"
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
                         border-2 border-white/20 hover:border-white/40"
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
