import React, { useCallback, useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Volume2, RotateCcw, Mic, Square, Send } from "lucide-react";
import { playClickSound } from "@/lib/sounds";
import ChatAvatar from "@/components/comic/ChatAvatar";
import InputBar from "@/components/comic/InputBar";
import SpeechBubble from "@/components/comic/SpeechBubble";

import { X } from "lucide-react";

interface QuestionScreenTypeBProps {
  getAspectRatio: string;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  chatMessages: any[];
  setChatMessages: React.Dispatch<React.SetStateAction<any[]>>;
  onGenerate: (text: string) => void;
  onGenerateImage: () => void;
  chatPanelWidthPercent: number;
  setChatPanelWidthPercent: (width: number) => void;
  isResizing: boolean;
  setIsResizing: (resizing: boolean) => void;
  messagesScrollRef: React.RefObject<HTMLDivElement>;
  lastMessageCount: number;
  handleResizeStart: (e: React.MouseEvent) => void;
}

// Game state types
type GameState = 'initial' | 'error' | 'success';

// Word data for the game
const WORD_DATA = {
  word: "ROCKET",
  audio: "/sounds/rocket-word.mp3", // You'll need to add this audio file
  storyText: `"Listen! A steady cutting sound comes from the vines," says Clay. "Here's a clue, Asher: name it and type the word," says Shracker.`,
  image: "🚀", // Using emoji for now, can be replaced with actual image
  successMessage: `Yay, "train" it is. What adventures await in this vast train? Let's include it in your story ➤`
};

const QuestionScreenTypeB: React.FC<QuestionScreenTypeBProps> = ({
  getAspectRatio,
  sidebarCollapsed,
  setSidebarCollapsed,
  chatMessages,
  setChatMessages,
  onGenerate,
  onGenerateImage,
  chatPanelWidthPercent,
  setChatPanelWidthPercent,
  isResizing,
  setIsResizing,
  messagesScrollRef,
  lastMessageCount,
  handleResizeStart
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  // Game state
  const [gameState, setGameState] = useState<GameState>('initial');
  const [userInput, setUserInput] = useState<string[]>(Array(WORD_DATA.word.length).fill(''));
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [showKraftySpeech, setShowKraftySpeech] = useState(false);
  const [storyInput, setStoryInput] = useState('');
  
  // Step 3 mic functionality state
  const [isMicActive, setIsMicActive] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  
  // Text-to-speech state for text card
  const [isReadingStory, setIsReadingStory] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);

  // Spacing variables for vertical positioning
  const textCardTopOffset = 40; // Variable to control text card vertical position (positive = lower down)
  const textCardToOPCACGap = 30; // Variable to control gap between text card and OPCAC (positive = more gap)
  const iconStripToTextCardGap = "mb-1";
  const textCardToGameAreaGap = "mb-1";

  // Overlay configuration variables (same as QuestionScreenTypeA)
  const overlayScale = 4;
  const overlayBottomOffset = -20;
  const overlayHorizontalOffset = -100;
  const overlayHeight = 200;

  // Play word audio (for image speaker - just the word)
  const playWordAudio = useCallback(() => {
    playClickSound();
    setIsAudioPlaying(true);
    
    // Create utterance for the word
    const utterance = new SpeechSynthesisUtterance(WORD_DATA.word.toLowerCase());
    utterance.rate = 0.7;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;
    
    utterance.onend = () => {
      setIsAudioPlaying(false);
    };
    
    utterance.onerror = () => {
      setIsAudioPlaying(false);
    };
    
    window.speechSynthesis.speak(utterance);
  }, []);

  // Play story text with highlighting (for text card speaker)
  const playStoryAudio = useCallback(() => {
    playClickSound();
    
    if (isReadingStory) {
      // Stop current reading
      window.speechSynthesis.cancel();
      setIsReadingStory(false);
      setCurrentWordIndex(-1);
      return;
    }
    
    // Start reading the story
    setIsReadingStory(true);
    setCurrentWordIndex(0);
    
    const words = WORD_DATA.storyText.split(' ');
    const utterance = new SpeechSynthesisUtterance(WORD_DATA.storyText);
    utterance.rate = 0.8; // Moderate pace
    utterance.pitch = 1.1; // Slightly higher pitch
    
    // Word highlighting timing - 400ms per word
    let wordIndex = 0;
    const wordDuration = 400;
    
    const highlightInterval = setInterval(() => {
      if (wordIndex < words.length) {
        setCurrentWordIndex(wordIndex);
        wordIndex++;
      } else {
        clearInterval(highlightInterval);
        setCurrentWordIndex(-1);
        setIsReadingStory(false);
      }
    }, wordDuration);
    
    utterance.onend = () => {
      clearInterval(highlightInterval);
      setCurrentWordIndex(-1);
      setIsReadingStory(false);
    };
    
    utterance.onerror = () => {
      clearInterval(highlightInterval);
      setCurrentWordIndex(-1);
      setIsReadingStory(false);
    };
    
    window.speechSynthesis.speak(utterance);
  }, [isReadingStory]);

  // Removed auto-play audio - word audio only plays when speaker icon is clicked

  // Handle letter input
  const handleLetterChange = useCallback((index: number, value: string) => {
    if (value.length > 1) return; // Only allow single character
    
    const newInput = [...userInput];
    newInput[index] = value.toUpperCase();
    setUserInput(newInput);
    
    // Auto-focus next input
    if (value && index < WORD_DATA.word.length - 1) {
      const nextInput = document.getElementById(`letter-${index + 1}`) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
      }
    }
    
    // Check answer when all letters are filled
    if (newInput.every(letter => letter !== '') && newInput.join('') === WORD_DATA.word) {
      setTimeout(() => {
        setGameState('success');
      }, 500);
    }
  }, [userInput]);

  // Handle backspace
  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && userInput[index] === '' && index > 0) {
      const prevInput = document.getElementById(`letter-${index - 1}`) as HTMLInputElement;
      if (prevInput) {
        prevInput.focus();
      }
    }
  }, [userInput]);

  // Handle try again
  const handleTryAgain = useCallback(() => {
    playClickSound();
    setGameState('initial');
    setUserInput(Array(WORD_DATA.word.length).fill(''));
    setShowKraftySpeech(false);
    
    // Clear the error message from chat
    setChatMessages((prev: any) => prev.filter((msg: any) => msg.content !== 'Do your best this time!'));
    
    // Focus first input
    setTimeout(() => {
      const firstInput = document.getElementById('letter-0') as HTMLInputElement;
      if (firstInput) {
        firstInput.focus();
      }
    }, 100);
  }, [setChatMessages]);

  // Check for wrong answer
  useEffect(() => {
    const filledLetters = userInput.filter(letter => letter !== '').length;
    const currentWord = userInput.join('');
    
    if (filledLetters === WORD_DATA.word.length && currentWord !== WORD_DATA.word) {
      setTimeout(() => {
        setGameState('error');
        setShowKraftySpeech(true);
        
        // Add error message to chat
        const errorMessage = {
          type: 'ai' as const,
          content: 'Do your best this time!',
          timestamp: Date.now()
        };
        setChatMessages((prev: any) => [...prev, errorMessage]);
      }, 500);
    }
  }, [userInput, setChatMessages]);

  // Handle story continuation
  const handleStoryContinuation = useCallback(() => {
    if (storyInput.trim()) {
      playClickSound();
      
      // Add user's story continuation to chat
      const userMessage = {
        type: 'user' as const,
        content: storyInput.trim(),
        timestamp: Date.now()
      };
      
      const aiResponse = {
        type: 'ai' as const,
        content: "Great continuation! Your story is developing wonderfully. Let's see what happens next in your adventure!",
        timestamp: Date.now() + 1
      };
      
      setChatMessages((prev: any) => [...prev, userMessage, aiResponse]);
      setSidebarCollapsed(false);
      setStoryInput('');
    }
  }, [storyInput, setChatMessages, setSidebarCollapsed]);

  // Waveform Visualizer Component (for Step 3 mic input)
  const WaveformVisualizer = () => {
    return (
      <div className="flex items-center justify-center gap-1 px-3 h-full">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="w-1 bg-primary rounded-full animate-pulse"
            style={{
              height: `${Math.random() * 12 + 4}px`,
              animationDelay: `${i * 0.1}s`,
              animationDuration: `${0.5 + Math.random() * 0.5}s`
            }}
          />
        ))}
      </div>
    );
  };

  // Step 3 mic functionality
  const handleStep3Mic = useCallback(() => {
    playClickSound();
    
    if (!isMicActive) {
      // Start recording
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        // Fallback for browsers without speech recognition
        const transcript = prompt("Speech recognition not available. Please type what you want to add to your story:");
        if (transcript) {
          setStoryInput(transcript);
        }
        return;
      }
      
      const rec = new SpeechRecognition();
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.continuous = true;
      
      rec.onstart = () => {
        setIsMicActive(true);
      };
      
      rec.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        setStoryInput(finalTranscript + interimTranscript);
      };
      
      rec.onerror = () => {
        setIsMicActive(false);
        setRecognition(null);
      };
      
      rec.onend = () => {
        setIsMicActive(false);
        setRecognition(null);
      };
      
      rec.start();
      setRecognition(rec);
    } else {
      // Stop recording
      if (recognition) {
        recognition.stop();
        setRecognition(null);
      }
      setIsMicActive(false);
    }
  }, [isMicActive, recognition]);

  // Render letter input blocks
  const renderLetterBlocks = () => {
    return (
      <div className="flex justify-center gap-2 mb-6 transition-all duration-300 ease-in-out">
        {Array(WORD_DATA.word.length).fill(null).map((_, index) => (
          <input
            key={index}
            id={`letter-${index}`}
            type="text"
            value={userInput[index]}
            onChange={(e) => handleLetterChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className="w-12 h-12 text-center text-2xl font-bold border-4 border-black rounded-lg bg-white uppercase focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            style={{ boxShadow: '0 4px 0 black' }}
            maxLength={1}
            disabled={gameState === 'success'}
          />
        ))}
      </div>
    );
  };

  return (
    <main 
      className="flex-1 flex items-center justify-center min-h-0 overflow-hidden px-4 py-4 lg:px-6 bg-primary/60 relative" 
      style={{
        backgroundImage: `url('/backgrounds/random2.png')`,
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
          width: '95%',
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
            backgroundColor: 'hsl(var(--primary) / 0.9)',
            overflow: 'hidden'
          }}
        >
          {/* Bottom overlay */}
          <div 
            className={`absolute z-5`}
            style={{
              bottom: `${overlayBottomOffset * 4}px`,
              left: '55%',
              width: `calc(100% - ${overlayHorizontalOffset * 8}px)`,
              height: `${overlayHeight}px`,
              transform: `translateX(-50%) scale(${overlayScale})`,
              transformOrigin: 'bottom center',
              backgroundImage: `url('/backgrounds/bg-overlay.png')`,
              backgroundSize: 'contain',
              backgroundPosition: 'bottom center',
              backgroundRepeat: 'no-repeat',
              mixBlendMode: 'multiply',
              borderRadius: '20px'
            }}
          />
        </div>
        
        {/* Content Container */}
        <div 
          ref={containerRef}
          className="flex relative z-10 h-full w-full overflow-hidden"
          style={{ 
            paddingTop: '8px',
            paddingBottom: '8px',
            paddingLeft: '8px',
            paddingRight: '8px'
          }}
        >
          {/* Main Content Panel */}
          <section 
            aria-label="Main content panel" 
            className="flex flex-col min-h-0 relative flex-1 transition-all duration-300 ease-in-out"
            style={{ marginRight: sidebarCollapsed ? '0px' : '5px' }}
          >
            {/* Scrollable Content Wrapper */}
            <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden">


            {/* Story Text Card */}
            <div className={`flex items-start justify-center ${textCardToGameAreaGap} relative z-10 transition-all duration-500 ease-in-out`} style={{ marginTop: `${textCardTopOffset}px` }}>
              <div 
                className={cn(
                  "relative bg-white rounded-3xl p-8 w-full transition-all duration-500 ease-in-out",
                  gameState === 'success' ? "max-w-xl" : "max-w-2xl"
                )}
                style={{
                  border: '4px solid black',
                  boxShadow: '0 8px 0 black',
                  borderRadius: '24px'
                }}
              >
                {/* Speaker button */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={playStoryAudio}
                  className="absolute bottom-4 right-4 h-12 w-12 rounded-lg border-2 border-black bg-white hover:bg-primary hover:text-primary-foreground z-10 transition-all duration-200 hover:scale-110"
                  style={{ boxShadow: '0 4px 0 black' }}
                >
                  <Volume2 className="h-5 w-5" />
                </Button>

                {/* Notebook spiral binding */}
                <div className="absolute top-0 left-0 right-0 h-6 flex justify-evenly items-center px-4">
                  {[...Array(20)].map((_, i) => (
                    <div key={i} className="relative">
                      <div 
                        className="w-4 h-4 border-2 border-black rounded-full bg-gray-300"
                        style={{
                          marginTop: '-12px',
                          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)'
                        }}
                      />
                      <div 
                        className="absolute top-1/2 left-1/2 w-2 h-2 bg-white rounded-full border border-gray-400"
                        style={{
                          transform: 'translate(-50%, -50%)',
                          marginTop: '-12px'
                        }}
                      />
                    </div>
                  ))}
                </div>
                
                {/* Story text */}
                <div 
                  className="mt-4 text-lg font-medium text-gray-800 relative"
                  style={{
                    lineHeight: '2.5rem',
                    backgroundImage: 'repeating-linear-gradient(transparent, transparent 2.4rem, #e5e7eb 2.4rem, #e5e7eb 2.5rem)',
                    paddingTop: '0.1rem'
                  }}
                >
                  {WORD_DATA.storyText.split(' ').map((word, index) => (
                    <span
                      key={index}
                      className={cn(
                        "transition-colors duration-200",
                        currentWordIndex === index && isReadingStory
                          ? "bg-yellow-300 text-black"
                          : ""
                      )}
                    >
                      {word}
                      {index < WORD_DATA.storyText.split(' ').length - 1 ? ' ' : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Game Area */}
            <div className="flex flex-col items-center gap-4 mb-4 relative z-10 px-4 transition-all duration-500 ease-in-out" style={{ marginTop: `${textCardToOPCACGap}px` }}>
              {/* Word Image and Game Elements */}
              <div className="flex flex-col items-center gap-4 w-full max-w-4xl transition-all duration-500 ease-in-out">
                {/* Word Image - Only show in initial and error states */}
                {(gameState === 'initial' || gameState === 'error') && (
                  <div 
                    className="relative w-48 h-48 rounded-3xl flex items-center justify-center text-8xl animate-in fade-in slide-in-from-bottom-4 duration-500"
                    style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: '4px solid white',
                      boxShadow: '0 8px 0 black'
                    }}
                  >
                    {WORD_DATA.image}
                    
                    {/* Speaker button inside image container */}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={playWordAudio}
                      className={cn(
                        "absolute bottom-2 right-2 h-10 w-10 rounded-lg border-2 border-black bg-white hover:bg-primary hover:text-primary-foreground z-10 transition-all duration-200",
                        isAudioPlaying ? "animate-pulse bg-yellow-200" : "hover:scale-110"
                      )}
                      style={{ boxShadow: '0 4px 0 black' }}
                    >
                      <Volume2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Game State Dependent UI */}
                {gameState === 'initial' && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                    <h2 className="text-white text-2xl font-bold text-center">
                      TYPE THE WORD YOU HEAR!
                    </h2>
                    {renderLetterBlocks()}
                  </div>
                )}

                {gameState === 'error' && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center gap-4">
                    <Button
                      onClick={handleTryAgain}
                      className="bg-red-500 hover:bg-red-600 text-white text-xl font-bold px-8 py-4 rounded-xl border-4 border-black transition-all duration-200"
                      style={{ boxShadow: '0 6px 0 black' }}
                    >
                      TRY AGAIN!
                    </Button>
                    {renderLetterBlocks()}
                  </div>
                )}

                {gameState === 'success' && (
                  <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 w-full">
                    {/* Overall Purple Correct Answer Container (OPCAC) */}
                    <div 
                      className="w-full max-w-4xl rounded-3xl transition-all duration-500 ease-in-out"
                      style={{
                        background: 'hsl(from hsl(var(--primary)) h s 85%)', // High luminosity theme color
                        boxShadow: '0 8px 0 black',
                        padding: '1.2rem', // Reduced padding for step 3
                        aspectRatio: '946 / 199', // Maintain proportions
                        marginTop: `${textCardToOPCACGap}px`
                      }}
                    >
                      <div className="flex items-stretch h-full gap-6">
                        {/* Image Container (Left - Square) */}
                        <div 
                          className="flex-shrink-0 rounded-3xl border-2 border-white flex items-center justify-center"
                          style={{
                            background: 'linear-gradient(to bottom, hsl(from hsl(var(--primary)) h s 15%) 0%, hsl(from hsl(var(--primary)) h s 25%) 100%)',
                            aspectRatio: '1 / 1', // Square
                            height: '100%',
                            maxHeight: '10.5rem', // 168px equivalent
                            width: 'auto'
                          }}
                        >
                          <div 
                            className="text-7xl"
                            style={{
                              width: '6.5rem', // 105px equivalent
                              height: '6.5rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transform: 'scale(1.2)'
                            }}
                          >
                            {WORD_DATA.image}
                          </div>
                        </div>

                        {/* Input Box (Right - Rectangular) */}
                        <div 
                          className="flex-1 rounded-3xl border-2 border-white"
                          style={{
                            background: 'linear-gradient(to bottom, hsl(from hsl(var(--primary)) h s 15%) 0%, hsl(from hsl(var(--primary)) h s 25%) 100%)',
                            padding: '1rem'
                          }}
                        >
                          {/* Text (reduced size, center-aligned) */}
                          <div className="text-white text-center font-light mb-4" style={{ fontSize: '1.25rem' }}>
                            {WORD_DATA.successMessage}
                          </div>
                          
                          {/* Input Panel with MessengerChat functionality */}
                          <div 
                            className="bg-white rounded-xl border-2 border-gray-300 flex items-center"
                            style={{
                              height: '2.3rem', // 37px equivalent
                              boxShadow: '0 2px 0 rgba(0,0,0,0.1)'
                            }}
                          >
                            {/* Mic Button (37px equivalent) */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={handleStep3Mic}
                              className={cn(
                                "h-full w-9 flex-shrink-0 rounded-xl",
                                isMicActive 
                                  ? "bg-red-500 text-white hover:bg-red-600" 
                                  : "bg-primary text-primary-foreground hover:bg-primary/90"
                              )}
                            >
                              {isMicActive ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                            </Button>
                            
                            {/* 13px gap */}
                            <div className="w-3"></div>
                            
                            {/* Input Area OR Waveform (538px equivalent - flex-1) */}
                            {isMicActive ? (
                              <WaveformVisualizer />
                            ) : (
                              <input
                                type="text"
                                value={storyInput}
                                onChange={(e) => setStoryInput(e.target.value)}
                                placeholder="Type your 1-2 sentences here"
                                className="flex-1 px-3 py-1 text-gray-800 font-normal text-sm bg-transparent border-none outline-none"
                                onKeyPress={(e) => e.key === 'Enter' && handleStoryContinuation()}
                              />
                            )}
                            
                            {/* 13px gap */}
                            <div className="w-3"></div>
                            
                            {/* Send Button (37px equivalent) */}
                            <Button
                              onClick={handleStoryContinuation}
                              className="h-full w-9 flex-shrink-0 rounded-xl hover:bg-primary hover:text-primary-foreground"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Highlighted Word at Center */}
                    <div 
                      className="text-white text-center px-6 py-3 lg:px-8 lg:py-4 rounded-xl text-2xl lg:text-4xl font-bold border-4 border-black animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 transition-all duration-500 ease-in-out max-w-xs mx-auto"
                      style={{ 
                        background: 'linear-gradient(to bottom, hsl(from hsl(var(--primary)) h s 15%) 0%, hsl(from hsl(var(--primary)) h s 25%) 100%)',
                        boxShadow: '0 6px 0 black',
                        marginTop: `${Math.max(textCardToOPCACGap - 10, 10)}px`, // Reduced gap for step 3
                        minWidth: 'fit-content'
                      }}
                    >
                      {WORD_DATA.word}
                    </div>
                  </div>
                )}
              </div>
            </div>



            </div>
          </section>

          {/* Right Sidebar - Same as QuestionScreenTypeA */}
          <aside 
            className={cn(
              "flex flex-col min-h-0 z-10 relative rounded-3xl overflow-hidden border-2 border-black transition-all duration-300 ease-in-out",
              isResizing ? 'chat-panel-resizing' : ''
            )}
            style={{ 
              width: sidebarCollapsed ? '0%' : `${chatPanelWidthPercent}%`,
              minWidth: sidebarCollapsed ? '0px' : '320px',
              maxWidth: sidebarCollapsed ? '0px' : '450px',
              opacity: sidebarCollapsed ? 0 : 1,
              height: '100%',
              backgroundImage: `url('/backgrounds/space.png')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              marginLeft: sidebarCollapsed ? '0px' : '5px',
              pointerEvents: sidebarCollapsed ? 'none' : 'auto'
            }}
          >
            {/* Glass blur overlay */}
            <div 
              className="absolute inset-0 backdrop-blur-sm bg-gradient-to-b from-primary/15 via-white/40 to-primary/10"
              style={{ zIndex: 1 }}
            />
            
            <div className="relative z-10 flex flex-col h-full">
              {/* Close Button */}
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
            
              {!sidebarCollapsed && (
                <>
                  {/* Avatar Section */}
                  <div className="flex-shrink-0 relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/20 to-primary/25 backdrop-blur-sm" />
                    <div className="relative z-10">
                      <ChatAvatar />
                    </div>
                  </div>
                
                  {/* Messages */}
                  <div className="flex-1 min-h-0 relative">
                    <div 
                      ref={messagesScrollRef}
                      className="h-full overflow-y-auto space-y-3 p-3 bg-white/95 backdrop-blur-sm"
                    >
                      {chatMessages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                          <p>🚀 Welcome to Screen 3! Chat with Krafty!</p>
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
              
              {/* Resize Handle */}
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
  );
};

export default QuestionScreenTypeB;
