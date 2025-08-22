import React, { useCallback, useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Mic, Volume2 } from "lucide-react";
import { playClickSound } from "@/lib/sounds";
import ChatAvatar from "@/components/comic/ChatAvatar";
import InputBar from "@/components/comic/InputBar";
import { X } from "lucide-react";

// TypeScript declarations for Speech Recognition API
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: any) => void;
  onend: () => void;
  onerror: (event: any) => void;
}

interface QuestionScreenTypeAProps {
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

const QuestionScreenTypeA: React.FC<QuestionScreenTypeAProps> = ({
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
  const resizeRef = React.useRef<HTMLDivElement>(null);
  
  // Story icons data
  const storyIcons = [
    { icon: "🗺️", label: "Map" },
    { icon: "📦", label: "Chest" },
    { icon: "✨", label: "Stars" },
    { icon: "🌙", label: "Moon" },
    { icon: "🌴", label: "Palm Tree" }
  ];
  
  // Sample story text
  const storyText = "Map, please! Captain Asher and Clay were in the moon jungle. Shrocker zipped overhead. The boss ran at Asher. Asher slid aside—WHOOSH! The boss fell into a spinning hole. A bright gate glowed. 'Map, please,' said Asher. The gate gave him a map.";
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);
  
  // Text-to-speech state
  const [isReading, setIsReading] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  
  // Speech recognition state
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [userTranscript, setUserTranscript] = useState("");
  const [accuracy, setAccuracy] = useState(0);

  // Spacing variables for vertical positioning
  const iconStripToTextCardGap = "mb-1"; // Gap between icon strip and text card
  const textCardToMicGap = "mb-1"; // Gap between text card and mic button section

  const checkAccuracy = useCallback((transcript: string) => {
    const originalWords = storyText.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    const spokenWords = transcript.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    
    let correctWords = 0;
    const maxLength = Math.max(originalWords.length, spokenWords.length);
    
    for (let i = 0; i < Math.min(originalWords.length, spokenWords.length); i++) {
      if (originalWords[i] === spokenWords[i]) {
        correctWords++;
      }
    }
    
    const accuracyScore = Math.round((correctWords / originalWords.length) * 100);
    setAccuracy(accuracyScore);
    setHasRecorded(true);
    setSidebarCollapsed(false);
    
    // Add user's transcript as a user message
    const userMessage = {
      type: 'user' as const,
      content: transcript,
      timestamp: Date.now()
    };
    
    // Add Krafty's feedback as AI message
    const feedbackMessage = {
      type: 'ai' as const,
      content: `Great job! You read with ${accuracyScore}% accuracy. ${
        accuracyScore >= 90 ? 'Excellent reading!' :
        accuracyScore >= 75 ? 'Very good! Keep practicing!' :
        accuracyScore >= 50 ? 'Good effort! Try reading slower next time.' :
        'Keep practicing! You\'re doing great!'
      }`,
      timestamp: Date.now() + 1 // Ensure AI message comes after user message
    };
    
    // Add both messages to chat
    setChatMessages((prev: any) => [...prev, userMessage, feedbackMessage]);
  }, [storyText, setSidebarCollapsed, setChatMessages]);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      recognitionInstance.maxAlternatives = 1;
      
      recognitionInstance.onresult = (event) => {
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
        
        if (finalTranscript) {
          setUserTranscript(finalTranscript.trim());
          setTimeout(() => {
            recognitionInstance.stop();
            checkAccuracy(finalTranscript.trim());
          }, 500);
        }
      };
      
      recognitionInstance.onstart = () => {
        console.log('Speech recognition started');
      };
      
      recognitionInstance.onend = () => {
        setIsRecording(false);
        console.log('Speech recognition ended');
      };
      
      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        alert(`Speech recognition error: ${event.error}. Please try again.`);
      };
      
      setRecognition(recognitionInstance);
    } else {
      console.log('Speech recognition not supported');
    }
  }, [checkAccuracy]);

  const handleMicClick = useCallback(() => {
    playClickSound();
    
    if (!recognition) {
      // Fallback for browsers without speech recognition
      const transcript = prompt("Speech recognition not available. Please type what you read:");
      if (transcript) {
        setUserTranscript(transcript);
        checkAccuracy(transcript);
      }
      return;
    }
    
    if (!isRecording) {
      setIsRecording(true);
      setUserTranscript("");
      try {
        recognition.start();
      } catch (error) {
        console.error('Speech recognition error:', error);
        setIsRecording(false);
      }
    } else {
      setIsRecording(false);
      recognition.stop();
    }
  }, [isRecording, recognition, checkAccuracy]);

  const handleSpeakerClick = useCallback(() => {
    playClickSound();
    
    if (isReading) {
      // Stop current reading
      window.speechSynthesis.cancel();
      setIsReading(false);
      setCurrentWordIndex(-1);
      return;
    }
    
    // Start reading the story
    setIsReading(true);
    setCurrentWordIndex(0);
    
    const words = storyText.split(' ');
    const utterance = new SpeechSynthesisUtterance(storyText);
    utterance.rate = 0.8; // Moderate pace
    utterance.pitch = 1.1; // Slightly higher pitch
    
    // Much faster highlight timing - 400ms per word
    let wordIndex = 0;
    const wordDuration = 400;
    
    const highlightInterval = setInterval(() => {
      if (wordIndex < words.length) {
        setCurrentWordIndex(wordIndex);
        wordIndex++;
      } else {
        clearInterval(highlightInterval);
        setCurrentWordIndex(-1);
        setIsReading(false);
      }
    }, wordDuration);
    
    utterance.onend = () => {
      clearInterval(highlightInterval);
      setCurrentWordIndex(-1);
      setIsReading(false);
    };
    
    utterance.onerror = () => {
      clearInterval(highlightInterval);
      setCurrentWordIndex(-1);
      setIsReading(false);
    };
    
    window.speechSynthesis.speak(utterance);
  }, [isReading, storyText]);

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
          {/* Main Content Panel - Left Side (Icon Strip + Text Card + Mic) */}
          <section 
            aria-label="Main content panel" 
            className="flex flex-col min-h-0 relative flex-1 transition-all duration-300 ease-in-out"
            style={{ marginRight: sidebarCollapsed ? '0px' : '5px' }}
          >
            {/* Icon Strip */}
            <div className={`flex justify-center ${iconStripToTextCardGap} mt-10`}>
            <div 
              className="flex items-center gap-0 px-6 py-3 rounded-2xl max-w-2xl w-full"
              style={{
                background: 'linear-gradient(to bottom, hsl(from hsl(var(--primary)) h s 15%) 0%, hsl(from hsl(var(--primary)) h s 25%) 100%)',
                border: '3px solid white',
                boxShadow: '0 4px 0 black'
              }}
            >
              {storyIcons.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center gap-1 flex-1 relative"
                >
                  <div 
                    className="text-4xl cursor-pointer transition-transform duration-200 ease-out hover:scale-125 select-none"
                    style={{
                      textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3), 0 0 8px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    {item.icon}
                  </div>
                  {index < storyIcons.length - 1 && (
                    <div 
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-8 bg-white"
                      style={{ 
                        opacity: 0.8
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Story Text Area */}
          <div className={`flex-1 flex items-center justify-center ${textCardToMicGap} relative`}>
            <div 
              className="relative bg-white rounded-3xl p-8 max-w-2xl w-full"
              style={{
                border: '4px solid black',
                boxShadow: '0 8px 0 black',
                borderRadius: '24px'
              }}
            >
              {/* Speaker button - positioned at bottom right inside card */}
              <Button
                variant="outline"
                size="icon"
                onClick={handleSpeakerClick}
                className="absolute bottom-4 right-4 h-12 w-12 rounded-lg border-2 border-black bg-white hover:bg-primary hover:text-primary-foreground z-10 transition-all duration-200 hover:scale-110"
                style={{ boxShadow: '0 4px 0 black' }}
              >
                <Volume2 className="h-5 w-5" />
              </Button>
              {/* Notebook spiral binding - improved design */}
              <div className="absolute top-0 left-0 right-0 h-6 flex justify-evenly items-center px-4">
                {[...Array(20)].map((_, i) => (
                  <div
                    key={i}
                    className="relative"
                  >
                    {/* Spiral ring */}
                    <div 
                      className="w-4 h-4 border-2 border-black rounded-full bg-gray-300"
                      style={{
                        marginTop: '-12px',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)'
                      }}
                    />
                    {/* Spiral hole */}
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
              
              {/* Story text with ruled lines */}
              <div 
                className="mt-4 text-lg font-medium text-gray-800 relative"
                style={{
                  lineHeight: '2.5rem', // Increased line spacing
                  backgroundImage: 'repeating-linear-gradient(transparent, transparent 2.4rem, #e5e7eb 2.4rem, #e5e7eb 2.5rem)',
                  paddingTop: '0.1rem'
                }}
              >
                {storyText.split(' ').map((word, index) => {
                  const isCurrentWord = currentWordIndex === index;
                  
                  return (
                    <span
                      key={index}
                      className="inline-block px-1 mx-0.5 rounded transition-all duration-200"
                      style={{
                        backgroundColor: isCurrentWord ? 'yellow' : 'transparent',
                        color: 'black',
                        transform: isCurrentWord ? 'scale(1.05)' : 'scale(1)'
                      }}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Reading Prompt and Mic Button */}
          <div className="flex flex-col items-center gap-4 mb-5">
            <p className="text-white text-xl font-medium">
              Now, read the story back to me
            </p>
            
            <Button
              variant="ghost"
              size="lg"
              onClick={handleMicClick}
              className={cn(
                "h-20 w-20 rounded-full border-4 border-black transition-all duration-200 relative hover:scale-110",
                isRecording 
                  ? "bg-red-600 hover:bg-red-600 animate-pulse" 
                  : "bg-white hover:bg-primary hover:text-primary-foreground"
              )}
              style={{ boxShadow: '0 6px 0 black' }}
            >
              <Mic className={cn("transition-colors duration-200", isRecording ? "text-white" : "text-current")} style={{ width: '32px', height: '32px' }} />
              {isRecording && (
                <div className="absolute -top-2 -right-2 h-4 w-4 bg-red-600 rounded-full animate-ping"></div>
              )}
            </Button>
            
            {isRecording && (
              <p className="text-white text-sm mt-2 animate-pulse">
                🎤 Recording... Speak now!
              </p>
            )}
            

          </div>
          </section>

          {/* Right Sidebar - Appears when not collapsed */}
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
                          <p>🚀 Welcome to Screen 2! Chat with Krafty!</p>
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

export default QuestionScreenTypeA;
