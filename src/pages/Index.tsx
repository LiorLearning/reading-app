import React, { useCallback, useMemo, useState, useEffect } from "react";
import ComicPanel from "@/components/comic/ComicPanel";
import InputBar from "@/components/comic/InputBar";
import MessengerChat from "@/components/comic/MessengerChat";
import ChatAvatar from "@/components/comic/ChatAvatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, Palette, HelpCircle, BookOpen, Image as ImageIcon, MessageCircle, ChevronLeft, ChevronRight, GraduationCap, ChevronDown, Volume2, Square, LogOut } from "lucide-react";
import { cn, formatAIMessage, ChatMessage, loadUserAdventure, saveUserAdventure, getNextTopic, saveAdventure, loadSavedAdventures, saveAdventureSummaries, loadAdventureSummaries, generateAdventureName, generateAdventureSummary, SavedAdventure, AdventureSummary, loadUserProgress, hasUserProgress, UserProgress, saveTopicPreference, loadTopicPreference, getNextTopicByPreference, saveCurrentAdventureId, loadCurrentAdventureId, saveQuestionProgress, loadQuestionProgress, clearQuestionProgress, getStartingQuestionIndex } from "@/lib/utils";
import { sampleMCQData } from "../data/mcq-questions";
import { playMessageSound, playClickSound, playImageLoadingSound, stopImageLoadingSound, playImageCompleteSound } from "@/lib/sounds";

import { useComic } from "@/hooks/use-comic";
import { aiService } from "@/lib/ai-service";
import { ttsService } from "@/lib/tts-service";
import VoiceSelector from "@/components/ui/voice-selector";
import { useTTSSpeaking } from "@/hooks/use-tts-speaking";
import { useAuth } from "@/hooks/use-auth";
import rocket1 from "@/assets/comic-rocket-1.jpg";
import spaceport2 from "@/assets/comic-spaceport-2.jpg";
import alien3 from "@/assets/comic-alienland-3.jpg";
import cockpit4 from "@/assets/comic-cockpit-4.jpg";

import MCQScreenTypeA from "./MCQScreenTypeA";
import TopicSelection from "./TopicSelection";
  import UserOnboarding from "./UserOnboarding";
  import HomePage from "./HomePage";
  import { 
    cacheAdventureImage, 
    loadCachedAdventureImages, 
    getRecentCachedAdventureImages,
    getCachedImagesForAdventure 
  } from "@/lib/utils";

// Legacy user data interface for backwards compatibility
interface LegacyUserData {
  username: string;
  grade: string;
  gradeDisplayName: string;
  level: string;
  levelDisplayName: string;
  isFirstTime: boolean;
}

// Component for individual speaker button
const SpeakerButton: React.FC<{ message: ChatMessage; index: number }> = ({ message, index }) => {
  const messageId = `index-chat-${message.timestamp}-${index}`;
  const isSpeaking = useTTSSpeaking(messageId);

  const handleClick = async () => {
    playClickSound();
    
    if (isSpeaking) {
      // Stop current speech
      ttsService.stop();
    } else {
      // Start speaking this message
      await ttsService.speakAIMessage(message.content, messageId);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className="absolute bottom-1 right-1 h-5 w-5 p-0 hover:bg-black/10 rounded-full"
      aria-label={isSpeaking ? "Stop message" : "Play message"}
    >
      {isSpeaking ? (
        <Square className="h-3 w-3 fill-red-500" />
      ) : (
        <Volume2 className="h-3 w-3" />
      )}
    </Button>
  );
};

// Component for handling async one-liner loading in the comic panel modal
const PanelOneLinerFigure: React.FC<{
  panel: { id: string; image: string; text: string };
  index: number;
}> = ({ panel, index }) => {
  const [oneLiner, setOneLiner] = React.useState<string>('Loading...');

  React.useEffect(() => {
    const generateOneLiner = async () => {
      try {
        const result = await aiService.generateOneLiner(panel.text);
        setOneLiner(result);
      } catch (error) {
        console.error('Failed to generate one-liner:', error);
        // Fallback to simple truncation
        const firstSentence = panel.text.match(/^[^.!?]*[.!?]/);
        if (firstSentence && firstSentence[0].length <= 60) {
          setOneLiner(firstSentence[0].trim());
        } else {
          const truncated = panel.text.substring(0, 50).trim();
          setOneLiner(truncated + (panel.text.length > 50 ? "..." : ""));
        }
      }
    };

    generateOneLiner();
  }, [panel.text]);

  return (
    <figure className="rounded-lg border-2 bg-card" style={{ borderColor: 'hsla(var(--primary), 0.9)' }}>
      <img src={panel.image} alt={`Panel ${index + 1}`} className="w-full h-auto object-cover border-2 rounded-t-lg" style={{ borderColor: 'hsla(var(--primary), 0.9)' }} />
      <figcaption className="px-2 py-1 text-sm font-semibold">{index + 1}. {oneLiner}</figcaption>
    </figure>
  );
};

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
  
  // Background images for dynamic background selection
  const backgroundImages = useMemo(() => [
    '/backgrounds/cats.png',
    '/backgrounds/random.png', 
    '/backgrounds/random2.png'
  ], []);
  
  // Set random background on component mount
  useEffect(() => {
    const randomBg = backgroundImages[Math.floor(Math.random() * backgroundImages.length)];
    document.documentElement.style.setProperty('--dynamic-background', `url('${randomBg}')`);
  }, [backgroundImages]);

  const initialPanels = useMemo(
    () => [
      { id: crypto.randomUUID(), image: rocket1, text: "The brave astronaut climbs into ROCKET!" },
    ],
    []
  );

  const { panels, currentIndex, setCurrent, addPanel, redo, reset } = useComic(initialPanels);
  
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>(() => {
    // Load messages from local storage on component initialization
    return loadUserAdventure();
  });
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [newlyCreatedPanelId, setNewlyCreatedPanelId] = React.useState<string | null>(null);
  const [zoomingPanelId, setZoomingPanelId] = React.useState<string | null>(null);
  const [lastMessageCount, setLastMessageCount] = React.useState(0);
  const [isAIResponding, setIsAIResponding] = React.useState(false);
  const [isGeneratingAdventureImage, setIsGeneratingAdventureImage] = React.useState(false);
  const [isExplicitImageRequest, setIsExplicitImageRequest] = React.useState(false);
  const messagesScrollRef = React.useRef<HTMLDivElement>(null);
  
  // Track ongoing image generation for cleanup
  const imageGenerationController = React.useRef<AbortController | null>(null);
  
  // Firebase auth integration
  const { user, userData, signOut } = useAuth();
  
  // Show onboarding if user is authenticated but hasn't completed setup
  const showOnboarding = user && userData && (userData.isFirstTime || !userData.grade);

  
  // Dev tools state
  const [devToolsVisible, setDevToolsVisible] = React.useState(false);
  const [currentScreen, setCurrentScreen] = React.useState<-1 | 0 | 1 | 2 | 3>(() => userData ? -1 : 0);
  const [selectedTopicId, setSelectedTopicId] = React.useState<string>("");
  const [pressedKeys, setPressedKeys] = React.useState<Set<string>>(new Set());
  
  // Adventure mode state to track whether it's a new or continuing adventure
  const [adventureMode, setAdventureMode] = React.useState<'new' | 'continue'>('new');
  
  // Track if initial AI response has been sent for current session
  const initialResponseSentRef = React.useRef<string | null>(null);
  
  // Current adventure tracking - initialize from localStorage on refresh
  const [currentAdventureId, setCurrentAdventureId] = React.useState<string | null>(() => loadCurrentAdventureId());
  const [adventureSummaries, setAdventureSummaries] = React.useState<AdventureSummary[]>([]);
  
  // Grade selection state (for HomePage only)
  const [selectedPreference, setSelectedPreference] = React.useState<'start' | 'middle' | null>(null);
  const [selectedTopicFromPreference, setSelectedTopicFromPreference] = React.useState<string | null>(null);
  const [selectedGradeFromDropdown, setSelectedGradeFromDropdown] = React.useState<string | null>(null);
  const [selectedGradeAndLevel, setSelectedGradeAndLevel] = React.useState<{grade: string, level: 'start' | 'middle'} | null>(null);
  
  // Automatic Flow Control System
  const ADVENTURE_PROMPT_THRESHOLD = 3; // Configurable threshold for when user can access questions
  const [adventurePromptCount, setAdventurePromptCount] = React.useState<number>(0); // Track adventure prompts
  const [topicQuestionIndex, setTopicQuestionIndex] = React.useState<number>(() => {
    // Initialize with saved progress if available - this allows seamless resume after page refresh
    const savedProgress = loadQuestionProgress();
    if (savedProgress && selectedTopicId && savedProgress.topicId === selectedTopicId) {
      console.log(`🔄 Initializing with saved progress: Topic ${savedProgress.topicId}, Question ${savedProgress.questionIndex + 1}`);
      return savedProgress.questionIndex;
    }
    return 0;
  }); // Current question in topic (0-9)
  const [isInQuestionMode, setIsInQuestionMode] = React.useState<boolean>(false); // Track if currently in question mode
  const [canAccessQuestions, setCanAccessQuestions] = React.useState<boolean>(false); // Track if user has met threshold
  
  // New variables for retry functionality - to fix the "try again" bug
  const [retryQuestionIndex, setRetryQuestionIndex] = React.useState<number>(0); // Track question index for retry scenarios
  const [isRetryMode, setIsRetryMode] = React.useState<boolean>(false); // Track if we're in a retry scenario
  
  // Computed value for the correct starting question index - fixes the try again bug
  const computedStartingQuestionIndex = React.useMemo(() => {
    if (isRetryMode) {
      return retryQuestionIndex; // Use retry index when in retry mode (should be 0 for full retry)
    }
    return topicQuestionIndex; // Use normal topic question index for regular flow
  }, [isRetryMode, retryQuestionIndex, topicQuestionIndex]);
  
  // Responsive aspect ratio management
  const [screenSize, setScreenSize] = React.useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  
  // Auto-collapse sidebar when switching to Screen 3 (MCQ)
  React.useEffect(() => {
    if (currentScreen === 3) {
      setSidebarCollapsed(true);
    }
  }, [currentScreen]);

  // Stop all ElevenLabs TTS when switching between screens
  React.useEffect(() => {
    // Stop any playing TTS audio to prevent overlap when switching screens
    console.log('🔧 Screen change cleanup: Stopping TTS for screen', currentScreen);
    ttsService.stop();
    // Stop image loading sound when navigating away from screens where it might be playing
    stopImageLoadingSound();
    
    // Clean up any ongoing image generation when navigating to home page
    if (currentScreen === -1 && imageGenerationController.current) {
      console.log('🏠 Navigating to home page - cleaning up image generation');
      imageGenerationController.current = null;
      setIsGeneratingAdventureImage(false);
      setIsExplicitImageRequest(false);
    }
    
    // Add a small delay to ensure TTS is fully stopped
    const timeoutId = setTimeout(() => {
      console.log('🔧 TTS cleanup completed for screen transition');
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [currentScreen]);

  // Save current adventure ID whenever it changes
  React.useEffect(() => {
    saveCurrentAdventureId(currentAdventureId);
  }, [currentAdventureId]);

  // Cleanup TTS on component unmount
  React.useEffect(() => {
    return () => {
      console.log('🔧 Index component cleanup: Stopping TTS');
      ttsService.stop();
    };
  }, []);

  // Restore latest image for current adventure ONLY on app initialization/refresh (not during same session)
  React.useEffect(() => {
    // Only restore if we have both an adventure ID and chat messages from localStorage (indicating page refresh)
    const storedMessages = loadUserAdventure();
    const storedAdventureId = loadCurrentAdventureId();
    
    if (storedAdventureId && storedMessages.length > 0 && currentAdventureId === storedAdventureId) {
      // Get cached images for the current adventure
      const cachedImages = getCachedImagesForAdventure(storedAdventureId);
      const latestCachedImage = cachedImages.length > 0 ? cachedImages[0] : null;
      
      if (latestCachedImage && panels.length > 0) {
        // Update the first panel to show the latest generated image
        const updatedPanels = [...panels];
        updatedPanels[0] = {
          ...updatedPanels[0],
          image: latestCachedImage.url,
          text: updatedPanels[0].text // Keep original text
        };
        
        reset(updatedPanels);
        console.log(`📸 Restored latest image for adventure on page refresh: ${storedAdventureId}`);
      }
    }
  }, []); // Run only once on mount

  // Generate initial AI response when entering adventure screen
  React.useEffect(() => {
    if (currentScreen === 1 && selectedTopicId && adventureMode) {
      // Create unique session key to prevent duplicate messages
      const sessionKey = `${selectedTopicId}-${adventureMode}`;
      
      // Check if we've already sent an initial response for this session
      if (initialResponseSentRef.current === sessionKey) {
        return;
      }
      
      // Generate initial AI message using real-time AI generation
      const generateInitialResponse = async () => {
        try {
          // Generate initial message using AI service with adventure prompt
          const initialMessage = await aiService.generateInitialMessage(
            adventureMode,
            chatMessages,
            undefined, // currentAdventure - can be added later if needed
            undefined, // storyEventsContext - can be added later if needed
            undefined  // summary - can be added later if needed
          );

          // Mark that we've sent the initial response for this session
          initialResponseSentRef.current = sessionKey;

          // Add the initial AI message
          const aiMessage: ChatMessage = {
            type: 'ai',
            content: initialMessage,
            timestamp: Date.now()
          };

          setChatMessages(prev => {
            setLastMessageCount(prev.length + 1);
            playMessageSound();
            // Auto-speak the initial AI message and wait for completion
            const messageId = `index-chat-${aiMessage.timestamp}-${prev.length}`;
            ttsService.speakAIMessage(initialMessage, messageId).catch(error => 
              console.error('TTS error for initial message:', error)
            );
            return [...prev, aiMessage];
          });
        } catch (error) {
          console.error('Error generating initial AI message:', error);
          
          // Fallback to a simple message if AI generation fails
          const fallbackMessage = adventureMode === 'new' 
            ? "🌟 Welcome, brave adventurer! I'm Krafty, your adventure companion! What kind of amazing adventure would you like to create today? 🚀"
            : "🎯 Welcome back, adventurer! I'm excited to continue our journey together! What amazing direction should we take our adventure today? 🌟";
          
          // Mark that we've sent the initial response for this session
          initialResponseSentRef.current = sessionKey;

          // Add the fallback AI message
          const aiMessage: ChatMessage = {
            type: 'ai',
            content: fallbackMessage,
            timestamp: Date.now()
          };

          setChatMessages(prev => {
            setLastMessageCount(prev.length + 1);
            playMessageSound();
            // Auto-speak the fallback message
            const messageId = `index-chat-${aiMessage.timestamp}-${prev.length}`;
            ttsService.speakAIMessage(fallbackMessage, messageId).catch(error => 
              console.error('TTS error for fallback message:', error)
            );
            return [...prev, aiMessage];
          });
        }
      };

      generateInitialResponse();
    }
  }, [currentScreen, selectedTopicId, adventureMode]);
  
  React.useEffect(() => {
    const updateScreenSize = () => {
      if (window.innerWidth <= 640) {
        setScreenSize('mobile');
      } else if (window.innerWidth <= 1024) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };
    
    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);
  
  // Dev tools keyboard listener for A+S+D combination
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      setPressedKeys(prev => new Set([...prev, key]));
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      setPressedKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  // Check for A+S+D combination
  React.useEffect(() => {
    if (pressedKeys.has('a') && pressedKeys.has('s') && pressedKeys.has('d')) {
      setDevToolsVisible(prev => !prev);
      playClickSound();
    }
  }, [pressedKeys]);
  
  const getAspectRatio = React.useMemo(() => {
    // Consistent height across both states - both give 1000px height at 1600px width
    if (sidebarCollapsed) {
      return screenSize === 'mobile' ? '4/3' : '16/10'; // 1600px width = 1000px height
    } else {
      return screenSize === 'mobile' ? '4/3' : '16/10'; // Same height as collapsed for consistency
    }
  }, [screenSize, sidebarCollapsed]);

  
  // Color theme options
  const colorThemes = [
    { name: "Purple", primary: "262 73% 60%", background: "262 30% 97%", accent: "262 73% 60%", hue: "262" },
    { name: "Pink", primary: "350 81% 55%", background: "350 30% 97%", accent: "350 81% 55%", hue: "350" },
    { name: "Blue", primary: "220 91% 55%", background: "220 30% 97%", accent: "220 91% 55%", hue: "220" },
    { name: "Green", primary: "142 76% 36%", background: "142 30% 97%", accent: "142 76% 36%", hue: "142" },
    { name: "Orange", primary: "25 85% 45%", background: "25 30% 97%", accent: "25 85% 45%", hue: "25" },
    { name: "Teal", primary: "180 83% 35%", background: "180 30% 97%", accent: "180 83% 35%", hue: "180" },
    { name: "Red", primary: "0 84% 55%", background: "0 30% 97%", accent: "0 84% 55%", hue: "0" },
    { name: "Indigo", primary: "240 85% 55%", background: "240 30% 97%", accent: "240 85% 55%", hue: "240" },
    { name: "Navy", primary: "210 100% 40%", background: "210 30% 97%", accent: "210 100% 40%", hue: "210" },
    { name: "Emerald", primary: "160 84% 39%", background: "160 30% 97%", accent: "160 84% 39%", hue: "160" },
  ];
  
  const [selectedTheme, setSelectedTheme] = useState(colorThemes[0]);
  
  const changeTheme = useCallback((theme: typeof colorThemes[0]) => {
    playClickSound();
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
  }, [selectedTheme, changeTheme]);
  
  // Grade selection logic (for HomePage only)
  useEffect(() => {
    if (userData && currentScreen === -1) { // Only on HomePage
      // Load user progress to check for current topic
      const userProgress = loadUserProgress();
      
      // Use saved preference first, then fallback to userData level
      let preferenceLevel: 'start' | 'middle' | null = null;
      
      // First check localStorage for user's manual selection
      const preference = loadTopicPreference();
      console.log('Loaded preference from localStorage:', preference);
      
      if (preference?.level) {
        preferenceLevel = preference.level;
        console.log('Using saved preference:', preferenceLevel);
      } else if (userData?.level) {
        // Fallback to userData level only if no saved preference
        preferenceLevel = userData.level === 'mid' ? 'middle' : userData.level as 'start' | 'middle';
        console.log('Using userData.level:', userData.level, 'converted to:', preferenceLevel);
      }
      
      console.log('Setting selectedPreference to:', preferenceLevel);
      setSelectedPreference(preferenceLevel);
      
      // Initialize the combined grade and level selection for proper highlighting
      if (preferenceLevel && userData?.gradeDisplayName) {
        setSelectedGradeAndLevel({ 
          grade: userData.gradeDisplayName, 
          level: preferenceLevel 
        });
        console.log('Initialized selectedGradeAndLevel:', { grade: userData.gradeDisplayName, level: preferenceLevel });
      }
      
      // First, check if there's a current topic saved from previous selection
      if (userProgress?.currentTopicId) {
        console.log('Loading saved current topic from progress:', userProgress.currentTopicId);
        setSelectedTopicFromPreference(userProgress.currentTopicId);
      } else if (preferenceLevel) {
        // If no saved current topic, generate one based on preference level
        console.log('Generating new topic for preference level:', preferenceLevel);
        const allTopicIds = Object.keys(sampleMCQData.topics);
        const preferredTopic = getNextTopicByPreference(allTopicIds, preferenceLevel);
        if (preferredTopic) {
          console.log('Generated preferred topic:', preferredTopic);
          setSelectedTopicFromPreference(preferredTopic);
        }
      } else {
        console.log('No preference level or current topic found');
      }
    }
  }, [userData, currentScreen]);
  
  // Ensure chat panel is always open when adventure mode starts
  useEffect(() => {
    if (currentScreen === 1) {
      // Always open chat panel when entering adventure mode
      setSidebarCollapsed(false);
      console.log('🗨️ Adventure mode started - opening chat panel by default');
    }
  }, [currentScreen]);
  
  // Chat panel resize functionality - now proportional
  const [chatPanelWidthPercent, setChatPanelWidthPercent] = React.useState(20); // 20% of container width (smaller default)
  const [isResizing, setIsResizing] = React.useState(false);
  const resizeRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current || !resizeRef.current || sidebarCollapsed) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const relativeX = e.clientX - containerRect.left;
    const newWidthPercent = ((containerRect.width - relativeX) / containerRect.width) * 100;
    
    // Constrain between 20% and 40% of container width
    const minPercent = 20;
    const maxPercent = 40;
    
    if (newWidthPercent >= minPercent && newWidthPercent <= maxPercent) {
      setChatPanelWidthPercent(newWidthPercent);
    }
  }, [isResizing, sidebarCollapsed]);

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

  const generateAIResponse = useCallback(async (userText: string, messageHistory: ChatMessage[]): Promise<string> => {
    try {
      return await aiService.generateResponse(userText, messageHistory);
    } catch (error) {
      console.error('Error generating AI response:', error);
      // Fallback response on error
      return "That's interesting! 🤔 Tell me more about what happens next in your adventure!";
    }
  }, []);



  // Generate new image panel based on context
  const onGenerateImage = useCallback(async (prompt?: string) => {
    try {
      // Set loading state and start loading sound
      setIsGeneratingAdventureImage(true);
      
      // Create AbortController for this generation
      imageGenerationController.current = new AbortController();
      
      playImageLoadingSound();
      
      // Use the prompt or generate from recent context
      const imagePrompt = prompt || 
          chatMessages.slice(-3).map(msg => msg.content).join(" ") || 
          "space adventure with rocket";
        
        // Extract adventure context for caching
        const adventureContext = chatMessages.slice(-5).map(msg => msg.content).join(" ");
        
        // Generate adventure image using AI service with user_adventure context
        const generatedImageResult = await aiService.generateAdventureImage(
          imagePrompt,
          chatMessages,
          "space adventure scene"
        );
        
        let image: string;
        let panelText: string;
        
        // Cache the generated adventure image if it was successfully created
        if (generatedImageResult) {
          cacheAdventureImage(
            generatedImageResult.imageUrl,
            imagePrompt,
            adventureContext,
            currentAdventureId || undefined
          );
          
          image = generatedImageResult.imageUrl;
          
          // Generate contextual response text based on actual generated content
          const contextualResponse = await aiService.generateAdventureImageResponse(
            imagePrompt,
            generatedImageResult.usedPrompt,
            chatMessages
          );
          
          panelText = contextualResponse;
        } else {
          // Use fallback image and text
          image = images[Math.floor(Math.random() * images.length)];
          panelText = prompt ? `Generated: ${prompt}` : "New adventure continues...";
        }
      
      const newPanelId = crypto.randomUUID();
      
      addPanel({ 
        id: newPanelId, 
        image, 
        text: panelText
      });
      setNewlyCreatedPanelId(newPanelId);
      
      // Stop loading sound and play completion sound when image is ready
      stopImageLoadingSound();
      playImageCompleteSound();
      // Stop loading animation only for automatic generation, not explicit requests
      if (!isExplicitImageRequest) {
        setIsGeneratingAdventureImage(false);
      }
      
      // Clear the controller since generation completed successfully
      imageGenerationController.current = null;
      
      // Trigger zoom animation after 2 seconds
      setTimeout(() => {
        setZoomingPanelId(newPanelId); // Trigger zoom animation
        setNewlyCreatedPanelId(null);
        
        // Clear zoom animation after it completes (0.6s duration)
        setTimeout(() => {
          setZoomingPanelId(null);
        }, 600);
      }, 2000);
    } catch (error) {
      console.error('Error generating image:', error);
      
      // Stop loading sound on error
      stopImageLoadingSound();
      // Stop loading animation only for automatic generation, not explicit requests
      if (!isExplicitImageRequest) {
        setIsGeneratingAdventureImage(false);
      }
      
      // Clear the controller on error
      imageGenerationController.current = null;
      
      // Fallback to random image on error
      const image = images[Math.floor(Math.random() * images.length)];
      const newPanelId = crypto.randomUUID();
      addPanel({ id: newPanelId, image, text: "New adventure continues..." });
      setNewlyCreatedPanelId(newPanelId);
      
      setTimeout(() => {
        setZoomingPanelId(newPanelId);
        setNewlyCreatedPanelId(null);
        
        setTimeout(() => {
          setZoomingPanelId(null);
        }, 600);
      }, 2000);
          }
    }, [addPanel, images, chatMessages, currentAdventureId, isExplicitImageRequest]);

  // Handle text messages and detect image generation requests
  const onGenerate = useCallback(
    async (text: string) => {
      // Check if user is asking for image generation
      const imageKeywords = [
        'image', 'picture', 'pic', 'draw', 'paint', 'sketch', 'show', 'illustrate', 
        'generate', 'create image', 'make picture', 'visual', 'artwork', 'art',
        'render', 'design', 'visualization', 'make image', 'photo', 'drawing'
      ];
      const isImageRequest = imageKeywords.some(keyword => 
        text.toLowerCase().includes(keyword)
      );
      
      // Add user message
      const userMessage: ChatMessage = {
        type: 'user',
        content: text,
        timestamp: Date.now()
      };
      
      // Add user message immediately with sound
      setChatMessages(prev => {
        setLastMessageCount(prev.length + 1);
        playMessageSound();
        return [...prev, userMessage];
      });

      // Track adventure prompt count and implement automatic flow
      console.log(`🔍 DEBUG: Message sent - currentScreen: ${currentScreen}, isImageRequest: ${isImageRequest}, isInQuestionMode: ${isInQuestionMode}`);
      
      if (currentScreen === 1 && !isImageRequest) {
        const newAdventurePromptCount = adventurePromptCount + 1;
        console.log(`🔍 DEBUG: Adventure prompt sent. Count: ${adventurePromptCount} -> ${newAdventurePromptCount}, Threshold: ${ADVENTURE_PROMPT_THRESHOLD}`);
        setAdventurePromptCount(newAdventurePromptCount);
        
        // Check if user has met the threshold for accessing questions
        if (newAdventurePromptCount >= ADVENTURE_PROMPT_THRESHOLD && !canAccessQuestions) {
          console.log(`🔍 DEBUG: Threshold reached! Setting canAccessQuestions to true`);
          setCanAccessQuestions(true);
        }
        
        // Implement automatic flow: adventure->q1->q2->q3->adventure->q4->q5->q6->adventure->q7->q8->q9->q10
        // Only trigger automatic transitions if user has met the prompt threshold
        const hasMetThreshold = canAccessQuestions || newAdventurePromptCount >= ADVENTURE_PROMPT_THRESHOLD;
        console.log(`🔍 DEBUG: Threshold check - canAccessQuestions: ${canAccessQuestions}, newCount >= threshold: ${newAdventurePromptCount >= ADVENTURE_PROMPT_THRESHOLD}, hasMetThreshold: ${hasMetThreshold}`);
        
        // COMMENTED OUT: Adventure to Questions Auto-move
        /*
        if (hasMetThreshold) {
          // Determine when to transition to questions based on the flow pattern
          let shouldTransitionToQuestions = false;
          
          if (topicQuestionIndex === 0) {
            // Start with questions after initial adventure phase (Q1-Q3)
            console.log(`🔍 DEBUG: Starting Q1-Q3 sequence`);
            shouldTransitionToQuestions = true;
          } else if (topicQuestionIndex === 3) {
            // After Q1->Q2->Q3->adventure, now go to Q4->Q5->Q6
            console.log(`🔍 DEBUG: Starting Q4-Q6 sequence`);
            shouldTransitionToQuestions = true;
          } else if (topicQuestionIndex === 6) {
            // After Q4->Q5->Q6->adventure, now go to Q7->Q8->Q9
            console.log(`🔍 DEBUG: Starting Q7-Q9 sequence`);
            shouldTransitionToQuestions = true;
          } else if (topicQuestionIndex === 9) {
            // After Q7->Q8->Q9->adventure, now go to Q10
            console.log(`🔍 DEBUG: Starting Q10 sequence`);
            shouldTransitionToQuestions = true;
          }
          
          if (shouldTransitionToQuestions) {
            // Add a transition message from AI and wait for speech to complete
            setTimeout(async () => {
              const transitionMessage: ChatMessage = {
                type: 'ai',
                content: `🎯 Great adventure building! Now let's test your reading skills with some questions. Ready for the challenge? 📚✨`,
                timestamp: Date.now()
              };
              
              setChatMessages(prev => {
                playMessageSound();
                return [...prev, transitionMessage];
              });
              
              // Wait for the AI speech to complete before transitioning
              const messageId = `index-chat-${transitionMessage.timestamp}-${chatMessages.length}`;
              await ttsService.speakAIMessage(transitionMessage.content, messageId);
              
              // Add a small buffer after speech completes
              setTimeout(() => {
                setIsInQuestionMode(true);
                setCurrentScreen(3); // Go to MCQ screen
              }, 500);
            }, 1000);
            
            // Don't process the text further, just handle the transition
            return;
          }
        }
        */
      } else {
        console.log(`🔍 DEBUG: Skipping adventure prompt tracking - currentScreen: ${currentScreen}, isImageRequest: ${isImageRequest}`);
      }
      
      // If user is asking for an image, generate one
      if (isImageRequest) {
        try {
          // Extract the subject from the user's request for better image generation
          const imageSubject = text.replace(/\b(image|picture|pic|draw|paint|sketch|show|illustrate|generate|create image|make picture|visual|artwork|art|render|design|visualization|make image|photo|drawing)\b/gi, '').replace(/\b(of|for|with|about)\b/gi, '').trim();
          
          // Set loading state and start loading sound immediately
          setIsGeneratingAdventureImage(true);
          setIsExplicitImageRequest(true);
          
          // Create AbortController for this generation
          imageGenerationController.current = new AbortController();
          
          playImageLoadingSound();
          
          // Add immediate "generating image" chat message
          const generatingMessage: ChatMessage = {
            type: 'ai',
            content: `🎨 Generating image... ✨`,
            timestamp: Date.now()
          };
          
          setChatMessages(prev => {
            setLastMessageCount(prev.length + 1);
            playMessageSound();
            return [...prev, generatingMessage];
          });
          
          // Generate image and get contextual response
          const generatedImageResult = await aiService.generateAdventureImage(
            imageSubject || text,
            chatMessages,
            "space adventure scene"
          );
          
          let imageAIResponse: string;
          
          if (generatedImageResult) {
            // Generate contextual response based on actual generated content
            imageAIResponse = await aiService.generateAdventureImageResponse(
              imageSubject || text,
              generatedImageResult.usedPrompt,
              chatMessages
            );
          } else {
            // Fallback response if image generation failed
            const fallbackResponses = [
              `🎨 I tried to create an image for your adventure, but let's keep the story going with our imagination! ✨`,
              `🌟 Your adventure idea is amazing! Let's continue the story and maybe try creating an image again later! 🚀`,
              `✨ Great concept for your adventure! I'll keep working on bringing your visions to life! 🎭`
            ];
            imageAIResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
          }
          
          await onGenerateImage(imageSubject || text);
          
          // Proceed with AI response if generation completed successfully
          
          const aiMessage: ChatMessage = {
            type: 'ai',
            content: imageAIResponse,
            timestamp: Date.now()
          };
          
          setChatMessages(prev => {
            setLastMessageCount(prev.length + 1);
            playMessageSound();
            // Stop loading animation and reset explicit request flag
            setIsGeneratingAdventureImage(false);
            setIsExplicitImageRequest(false);
            // Auto-speak the AI message
            const messageId = `index-chat-${aiMessage.timestamp}-${prev.length}`;
            ttsService.speakAIMessage(aiMessage.content, messageId);
            return [...prev, aiMessage];
          });
          
          // Clear the controller since generation completed successfully
          imageGenerationController.current = null;
        
          // Don't generate additional AI response for image requests
          return;
        } catch (error) {
          console.error('Error in image request handling:', error);
          // Stop loading animation and sound on error, reset explicit request flag
          setIsGeneratingAdventureImage(false);
          setIsExplicitImageRequest(false);
          stopImageLoadingSound();
          
          // Clear the controller on error
          imageGenerationController.current = null;
          
          // Add error message to chat
          const errorMessage: ChatMessage = {
            type: 'ai',
            content: `🎨 Oops! I had trouble creating your image, but let's keep the adventure going! ✨`,
            timestamp: Date.now()
          };
          
          setChatMessages(prev => {
            setLastMessageCount(prev.length + 1);
            playMessageSound();
            return [...prev, errorMessage];
          });
          
          return;
        }
      }
      
      // Set loading state for regular text responses
      setIsAIResponding(true);
      
      try {
        // Generate AI response using the current message history
        const currentMessages = [...chatMessages, userMessage];
        const aiResponse = await generateAIResponse(text, currentMessages);
        
        const aiMessage: ChatMessage = {
          type: 'ai',
          content: aiResponse,
          timestamp: Date.now()
        };
        
        setChatMessages(prev => {
          setLastMessageCount(prev.length + 1);
          playMessageSound();
          // Auto-speak the AI message and wait for completion
          const messageId = `index-chat-${aiMessage.timestamp}-${prev.length}`;
          ttsService.speakAIMessage(aiMessage.content, messageId).catch(error => 
            console.error('TTS error for AI message:', error)
          );
          return [...prev, aiMessage];
        });
      } catch (error) {
        console.error('Error generating AI response:', error);
        // Show error message to user
        const errorMessage: ChatMessage = {
          type: 'ai',
          content: "Sorry, I'm having trouble thinking right now! 😅 Try again in a moment!",
          timestamp: Date.now()
        };
        
        setChatMessages(prev => {
          setLastMessageCount(prev.length + 1);
          playMessageSound();
          // Auto-speak the error message and wait for completion
          const messageId = `index-chat-${errorMessage.timestamp}-${prev.length}`;
          ttsService.speakAIMessage(errorMessage.content, messageId).catch(error => 
            console.error('TTS error for error message:', error)
          );
          return [...prev, errorMessage];
        });
      } finally {
        setIsAIResponding(false);
      }
    },
    [generateAIResponse, chatMessages, currentScreen, adventurePromptCount, canAccessQuestions, topicQuestionIndex, isInQuestionMode]
  );

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (messagesScrollRef.current) {
      messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Save messages to local storage whenever they change
  React.useEffect(() => {
    saveUserAdventure(chatMessages);
  }, [chatMessages]);

  // Load adventure summaries on component mount
  React.useEffect(() => {
    const summaries = loadAdventureSummaries();
    setAdventureSummaries(summaries);
  }, []);

  // Auto-assign topic based on level and navigate
  const autoAssignTopicAndNavigate = React.useCallback((level: 'start' | 'middle') => {
    const topicId = level === 'start' ? 'K-F.2' : '1-Q.4';
    setSelectedTopicId(topicId);
    // Load saved question progress for this topic
    const startingIndex = getStartingQuestionIndex(topicId);
    setTopicQuestionIndex(startingIndex);
    setCurrentScreen(3); // Go directly to MCQ screen
  }, []);

  // Handle topic selection
  const handleTopicSelect = React.useCallback((topicId: string) => {
    setSelectedTopicId(topicId);
    // Load saved question progress for this topic
    const startingIndex = getStartingQuestionIndex(topicId);
    setTopicQuestionIndex(startingIndex);
    setCurrentScreen(1); // Go to adventure screen
  }, []);

  // Load question progress when selectedTopicId changes (handles all topic change scenarios)
  React.useEffect(() => {
    if (selectedTopicId) {
      const startingIndex = getStartingQuestionIndex(selectedTopicId);
      // Only update if different from current to avoid unnecessary re-renders
      if (startingIndex !== topicQuestionIndex) {
        console.log(`🔄 Topic changed to ${selectedTopicId}, loading progress: Question ${startingIndex + 1}`);
        setTopicQuestionIndex(startingIndex);
      }
    }
  }, [selectedTopicId]); // Don't include topicQuestionIndex in deps to avoid loops

  // Handle onboarding completion
  const handleOnboardingComplete = React.useCallback(() => {
    setCurrentScreen(-1); // Redirect to home page
    playClickSound();
  }, []);

  // Handle homepage navigation
  const handleHomeNavigation = React.useCallback((path: 'start' | 'middle' | 'topics') => {
    playClickSound();
    
    // Stop any ongoing TTS before navigation
    console.log('🔧 Home navigation cleanup: Stopping TTS');
    ttsService.stop();
    
    if (path === 'topics') {
      setCurrentScreen(0); // Go to topic selection
    } else {
      // For start/middle, automatically assign topic and go to questions
      autoAssignTopicAndNavigate(path);
    }
  }, [autoAssignTopicAndNavigate]);

  // Save current adventure when user creates significant content
  const saveCurrentAdventure = React.useCallback(async () => {
    if (!currentAdventureId || chatMessages.length < 3) return;
    
    try {
      const adventureName = await generateAdventureName(chatMessages);
      const adventureSummary = await generateAdventureSummary(chatMessages);
      
      // Get the current comic panel image if available
      const currentPanelImage = panels[currentIndex]?.image;
      
      const adventure: SavedAdventure = {
        id: currentAdventureId,
        name: adventureName,
        summary: adventureSummary,
        messages: chatMessages,
        createdAt: Date.now(),
        lastPlayedAt: Date.now(),
        comicPanelImage: currentPanelImage,
        topicId: selectedTopicId,
        comicPanels: panels // Save the comic panels
      };
      
      saveAdventure(adventure);
      
      // // Create a new comic panel for this adventure every 10 messages
      // console.log(`🖼️ AUTO IMAGE CHECK: Total messages: ${chatMessages.length}, Multiple of 10: ${chatMessages.length % 10 === 0}, Meets threshold: ${chatMessages.length >= 10}`);
      
      // if (chatMessages.length >= 10 && chatMessages.length % 10 === 0) { // Generate every 10 messages regularly
      //   const userMessages = chatMessages.filter(msg => msg.type === 'user');
      //   console.log(`🖼️ AUTO IMAGE: Conditions met! User messages: ${userMessages.length}, Required: >= 2`);
        
      //   if (userMessages.length >= 2) {
      //     const adventureContext = userMessages.slice(-6).map(msg => msg.content).join(' '); // Use recent user messages for context
      //     console.log(`🖼️ AUTO IMAGE: Generating image with context: "${adventureContext}"`);
      //     // Generate new panel based on adventure content
      //     onGenerateImage(adventureContext);
      //   } else {
      //     console.log(`🖼️ AUTO IMAGE: Skipped - not enough user messages (${userMessages.length} < 2)`);
      //   }
      // } else {
      //   console.log(`🖼️ AUTO IMAGE: Not triggered - need ${10 - (chatMessages.length % 10)} more messages to reach next multiple of 10`);
      // }
      
      // Update adventure summaries
      const summaries = loadAdventureSummaries();
      const updatedSummaries = summaries.filter(s => s.id !== currentAdventureId);
      updatedSummaries.push({
        id: currentAdventureId,
        name: adventureName,
        summary: adventureSummary,
        lastPlayedAt: Date.now(),
        comicPanelImage: currentPanelImage
      });
      
      saveAdventureSummaries(updatedSummaries.slice(-10)); // Keep last 10
      setAdventureSummaries(updatedSummaries);
    } catch (error) {
      console.error('Failed to save adventure:', error);
    }
  }, [currentAdventureId, chatMessages, panels, currentIndex, selectedTopicId, onGenerateImage]);

  // Auto-save adventure when significant content is created
  React.useEffect(() => {
    if (chatMessages.length >= 3 && currentAdventureId) {
      // Debounce saving to avoid too frequent saves
      const timeoutId = setTimeout(async () => {
        await saveCurrentAdventure();
      }, 3000); // Save 3 seconds after last message
      
      return () => clearTimeout(timeoutId);
    }
  }, [chatMessages.length, currentAdventureId, saveCurrentAdventure]);

  // Handle continuing a specific saved adventure
  const handleContinueSpecificAdventure = React.useCallback((adventureId: string) => {
    playClickSound();
    
    // Load the specific adventure
    const savedAdventures = loadSavedAdventures();
    const targetAdventure = savedAdventures.find(adv => adv.id === adventureId);
    
    if (targetAdventure) {
      // Get cached images for this adventure to find the latest generated image
      const cachedImages = getCachedImagesForAdventure(adventureId);
      const latestCachedImage = cachedImages.length > 0 ? cachedImages[0] : null; // First item is most recent (sorted by timestamp)
      
      // Restore comic panels from saved adventure if available
      if (targetAdventure.comicPanels && targetAdventure.comicPanels.length > 0) {
        // Check if we have cached images and restore them if the URLs are no longer available
        const restoredPanels = targetAdventure.comicPanels.map(panel => {
          // Try to use original image first
          let imageToUse = panel.image;
          
          // If image URL is not available or is a remote URL that might expire, try to find cached version
          if (panel.image.startsWith('https://')) {
            const cachedImage = cachedImages.find(cached => 
              cached.prompt && panel.text.includes(cached.prompt.split(' ').slice(0, 3).join(' '))
            );
            if (cachedImage && cachedImage.url !== panel.image) {
              imageToUse = cachedImage.url;
              console.log(`🔄 Restored cached image for panel: ${panel.text.substring(0, 30)}...`);
            }
          }
          
          return {
            ...panel,
            image: imageToUse
          };
        });
        
        // If we have a latest cached image and generated images, update the first panel to show it as default
        if (latestCachedImage && restoredPanels.length > 0) {
          restoredPanels[0] = {
            ...restoredPanels[0],
            image: latestCachedImage.url,
            text: restoredPanels[0].text // Keep the original text
          };
          console.log(`📸 Set latest generated image as default for adventure: ${targetAdventure.name}`);
        }
        
        reset(restoredPanels);
        console.log(`✅ Restored ${restoredPanels.length} comic panels for adventure: ${targetAdventure.name}`);
      } else {
        // No saved panels - create initial panel with latest generated image or default
        let initialPanelImage = rocket1; // default
        let initialPanelText = "The brave astronaut climbs into ROCKET!"; // default text
        
        if (latestCachedImage) {
          initialPanelImage = latestCachedImage.url;
          initialPanelText = "Your adventure continues...";
          console.log(`📸 Using latest generated image as default for adventure without saved panels: ${targetAdventure.name}`);
        }
        
        const defaultPanels = [
          { 
            id: crypto.randomUUID(), 
            image: initialPanelImage, 
            text: initialPanelText 
          }
        ];
        
        reset(defaultPanels);
      }
      
      // Load the adventure's messages and state
      setChatMessages(targetAdventure.messages);
      setCurrentAdventureId(targetAdventure.id);
      setSelectedTopicId(targetAdventure.topicId || getNextTopic(Object.keys(sampleMCQData.topics)) || '');
      setAdventureMode('continue');
      // Reset the initial response ref when starting a new adventure
      initialResponseSentRef.current = null;
      setCurrentScreen(1); // Go to adventure screen
    } else {
      // Fallback if adventure not found
      handleStartAdventure(getNextTopic(Object.keys(sampleMCQData.topics)) || '', 'continue');
    }
  }, [reset, initialPanels]);

  // Handle start adventure from progress tracking
  const handleStartAdventure = React.useCallback((topicId: string, mode: 'new' | 'continue' = 'new') => {
    playClickSound();
    setSelectedTopicId(topicId);
    setAdventureMode(mode);
    // Reset the initial response ref when starting a new adventure
    initialResponseSentRef.current = null;
    
    if (mode === 'new') {
      // Clear chat messages for new adventures to provide clean slate
      setChatMessages([]);
      // Generate new adventure ID
      setCurrentAdventureId(crypto.randomUUID());
      // Reset comic panels to default image for new adventures
      reset(initialPanels);
      console.log('🚀 Started new adventure with default rocket image');
    } else {
      // For continuing, keep existing adventure ID or create new one
      if (!currentAdventureId) {
        setCurrentAdventureId(crypto.randomUUID());
      }
    }
    
    setCurrentScreen(1); // Go to adventure screen first to show AI response
  }, [currentAdventureId, reset, initialPanels]);

  // Handle grade selection (for HomePage dropdown display)
  const handleGradeSelection = React.useCallback((gradeDisplayName: string) => {
    playClickSound();
    setSelectedGradeFromDropdown(gradeDisplayName);
  }, []);

  // Handle preference selection (for HomePage only)
  const handlePreferenceSelection = React.useCallback((level: 'start' | 'middle', gradeDisplayName?: string) => {
    playClickSound();
    
    // Update selected grade if provided
    if (gradeDisplayName) {
      setSelectedGradeFromDropdown(gradeDisplayName);
      // Track the combined grade and level selection for highlighting
      setSelectedGradeAndLevel({ grade: gradeDisplayName, level });
    }
    
    // Get all available topic IDs from MCQ data in order
    const allTopicIds = Object.keys(sampleMCQData.topics);
    
    // Save preference and get the specific topic immediately
    const specificTopic = saveTopicPreference(level, allTopicIds);
    
    console.log(`Preference selection - Level: ${level}, Grade: ${gradeDisplayName}, Topic: ${specificTopic}`);
    
    setSelectedPreference(level);
    setSelectedTopicFromPreference(specificTopic);
    
    console.log(`State updated - selectedPreference: ${level}, selectedTopicFromPreference: ${specificTopic}, selectedGrade: ${gradeDisplayName}`);
  }, []);

  // Handle sequential back navigation from MCQ screen
  const handleBackFromMCQ = React.useCallback((currentQuestionIndex: number): string | void => {
    playClickSound();
    
    // Determine if we should go to previous question or back to adventure based on the flow pattern
    // Adventure → q1→q2→q3 → Adventure → q4→q5→q6 → Adventure → q7→q8→q9→q10
    // Use topicQuestionIndex instead of currentQuestionIndex for the logic
    // because topicQuestionIndex represents the actual position in the overall flow
    
    const isFirstInSequence = 
      topicQuestionIndex === 0 || // q1 (first question in first batch)
      topicQuestionIndex === 3 || // q4 (first question in second batch)
      topicQuestionIndex === 6 || // q7 (first question in third batch)
      topicQuestionIndex === 9;   // q10 (first question in fourth batch)
    
    if (isFirstInSequence) {
      // Go back to adventure mode
      setIsInQuestionMode(false);
      setCurrentScreen(1); // Return to adventure screen
      
      // Add transition message
      setTimeout(async () => {
        const backToAdventureMessage: ChatMessage = {
          type: 'ai',
          content: `🏠 Back to your adventure! Let's continue building your amazing story! What exciting direction should we explore now? ✨`,
          timestamp: Date.now()
        };
        
        setChatMessages(prev => {
          playMessageSound();
          return [...prev, backToAdventureMessage];
        });
        
        // Wait for the AI speech to complete
        const messageId = `index-chat-${backToAdventureMessage.timestamp}-${chatMessages.length}`;
        await ttsService.speakAIMessage(backToAdventureMessage.content, messageId);
      }, 500);
      
      return; // Return void for adventure mode navigation
    } else {
      // Go to previous question - update topicQuestionIndex and return action type
      const newTopicQuestionIndex = topicQuestionIndex - 1;
      console.log(`🔍 DEBUG MCQ Back: Going from topicQuestionIndex ${topicQuestionIndex} to ${newTopicQuestionIndex}`);
      setTopicQuestionIndex(newTopicQuestionIndex);
      
      return 'previous_question';
    }
  }, [setChatMessages, ttsService, topicQuestionIndex]);

  // Handle session closing and save current adventure
  const handleCloseSession = React.useCallback(async () => {
    if (chatMessages.length >= 3 && currentAdventureId) {
      await saveCurrentAdventure();
    }
  }, [chatMessages.length, currentAdventureId, saveCurrentAdventure]);



  // Handle page unload - save adventure before closing
  React.useEffect(() => {
    const handleBeforeUnload = () => {
      if (chatMessages.length >= 3 && currentAdventureId) {
        // Save synchronously on page unload
        try {
          // Generate names and summaries synchronously for page unload
          const userMessages = chatMessages.filter(msg => msg.type === 'user').map(msg => msg.content).join(' ');
          const themes = ['space', 'magic', 'dragon', 'superhero', 'ocean', 'forest'];
          const foundTheme = themes.find(theme => userMessages.toLowerCase().includes(theme));
          const adventureName = foundTheme ? `${foundTheme.charAt(0).toUpperCase() + foundTheme.slice(1)} Adventure` : 'Epic Adventure';
          
          const words = userMessages.split(' ').filter(word => word.length > 3);
          const uniqueWords = [...new Set(words)];
          const keyWords = uniqueWords.slice(0, 8).join(' ');
          const adventureSummary = keyWords ? `An adventure involving ${keyWords}...`.substring(0, 100) : 'Amazing adventure';
          
          const adventure: SavedAdventure = {
            id: currentAdventureId,
            name: adventureName,
            summary: adventureSummary,
            messages: chatMessages,
            createdAt: Date.now(),
            lastPlayedAt: Date.now(),
            comicPanelImage: panels[currentIndex]?.image,
            topicId: selectedTopicId,
            comicPanels: panels // Save the comic panels in page unload handler too
          };
          
          saveAdventure(adventure);
        } catch (error) {
          console.warn('Failed to save adventure on unload:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [chatMessages, currentAdventureId, panels, currentIndex, selectedTopicId]);



  const current = panels[currentIndex] ?? initialPanels[0];

  // Auto-generate images every 5 user messages (immediate trigger)
  React.useEffect(() => {
    const userMessages = chatMessages.filter(msg => msg.type === 'user');
    
    if (userMessages.length >= 5 && userMessages.length % 5 === 0 && currentAdventureId) {
      console.log(`🖼️ AUTO IMAGE CHECK: User messages: ${userMessages.length}, Multiple of 5: ${userMessages.length % 5 === 0}, Meets threshold: ${userMessages.length >= 5}`);
      
      console.log(`🖼️ AUTO IMAGE: Conditions met! User messages: ${userMessages.length}, Required: >= 5`);
      
      const adventureContext = userMessages.slice(-6).map(msg => msg.content).join(' ');
      console.log(`🖼️ AUTO IMAGE: Generating image with context: "${adventureContext}"`);
      
      // Small delay to ensure message rendering is complete
      setTimeout(() => {
        onGenerateImage(adventureContext);
      }, 500);
    } else if (userMessages.length > 0) {
      console.log(`🖼️ AUTO IMAGE: Not triggered - need ${5 - (userMessages.length % 5)} more user messages to reach next multiple of 5 (current: ${userMessages.length})`);
    }
  }, [chatMessages.filter(msg => msg.type === 'user').length, currentAdventureId, onGenerateImage]);

  return (
    <div className="h-screen bg-pattern flex flex-col overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="w-full flex-1 flex flex-col min-h-0">
        {/* Header Panel */}
        <header 
          className="flex items-center justify-center py-3 lg:py-4 border-b-2 border-foreground/10 bg-white/30 backdrop-blur-md relative"
          style={{
            boxShadow: '0 4px 8px -2px rgba(0, 0, 0, 0.1)'
          }}
        >
          {/* Top Left Home Button - Show on all screens except home (-1) when user is logged in */}
          <div 
            className="absolute left-0 flex items-center gap-1 lg:gap-2"
            style={{
              marginLeft: `calc((100% - 92%) / 2)`, // Align with left edge of purple container
              top: '50%',
              transform: 'translateY(-50%)' // Center vertically to match right buttons
            }}
          >
            {userData && currentScreen !== -1 && (
              <Button 
                variant="default" 
                onClick={async () => {
                  playClickSound();
                  await handleCloseSession(); // Save current adventure before going home
                  
                  // Trigger a re-render by briefly updating screen state to refresh homepage data
                  setCurrentScreen(0);
                  setTimeout(() => setCurrentScreen(-1), 100);
                }}
                className="border-2 bg-primary hover:bg-primary/90 text-white btn-animate px-4"
                style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)', boxShadow: '0 4px 0 black' }}
              >
                🏠 Home
              </Button>
            )}
            
            {/* Grade Selection Button - Only show on HomePage */}
            {userData && currentScreen === -1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="default"
                    className={`border-2 ${selectedPreference ? 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700' : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'} text-white rounded-xl px-4 py-3 font-semibold btn-animate flex items-center gap-2 shadow-lg transition-all duration-300`}
                    style={{ boxShadow: selectedPreference ? '0 4px 0 #15803d' : '0 4px 0 #1d4ed8' }}
                    onClick={() => playClickSound()}
                  >
                    <GraduationCap className="h-5 w-5" />
                    {(() => {
                      const currentGrade = selectedGradeFromDropdown || userData?.gradeDisplayName || 'Grade';
                      const buttonText = selectedTopicFromPreference 
                        ? `Next: ${selectedTopicFromPreference}` 
                        : selectedPreference 
                          ? `${currentGrade} ${selectedPreference === 'start' ? 'Start' : 'Middle'} Level` 
                          : 'Grade Selection';
                      console.log('Button render - selectedGradeFromDropdown:', selectedGradeFromDropdown, 'selectedTopicFromPreference:', selectedTopicFromPreference, 'selectedPreference:', selectedPreference, 'buttonText:', buttonText);
                      return buttonText;
                    })()}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className="w-64 border-2 border-gray-300 bg-white shadow-xl rounded-xl"
                  align="start"
                >
                  {/* Kindergarten */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === 'Kindergarten' ? 'bg-blue-100' : ''}`}>
                      <span className="text-lg">🎓</span>
                      <span className="font-semibold">Kindergarten</span>
                      {selectedGradeAndLevel?.grade === 'Kindergarten' && (
                        <span className="ml-auto text-blue-600 text-sm">✓</span>
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent 
                      className="w-48 border-2 border-gray-300 bg-white shadow-xl rounded-xl"
                    >
                      <DropdownMenuItem 
                        className={`flex items-center gap-2 px-4 py-3 hover:bg-green-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === 'Kindergarten' && selectedGradeAndLevel?.level === 'start' ? 'bg-green-100' : ''}`}
                        onClick={() => handlePreferenceSelection('start', 'Kindergarten')}
                      >
                        <span className="text-lg">🌱</span>
                        <div>
                          <div className="font-semibold">Start</div>
                          <div className="text-sm text-gray-500">Beginning level</div>
                        </div>
                        {selectedGradeAndLevel?.grade === 'Kindergarten' && selectedGradeAndLevel?.level === 'start' ? <span className="ml-auto text-green-600">✓</span> : null}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === 'Kindergarten' && selectedGradeAndLevel?.level === 'middle' ? 'bg-blue-100' : ''}`}
                        onClick={() => handlePreferenceSelection('middle', 'Kindergarten')}
                      >
                        <span className="text-lg">🚀</span>
                        <div>
                          <div className="font-semibold">Middle</div>
                          <div className="text-sm text-gray-500">Intermediate level</div>
                        </div>
                        {selectedGradeAndLevel?.grade === 'Kindergarten' && selectedGradeAndLevel?.level === 'middle' ? <span className="ml-auto text-blue-600">✓</span> : null}
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  {/* 1st Grade */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '1st Grade' ? 'bg-blue-100' : ''}`}>
                      <span className="text-lg">🎓</span>
                      <span className="font-semibold">1st Grade</span>
                      {selectedGradeAndLevel?.grade === '1st Grade' && (
                        <span className="ml-auto text-blue-600 text-sm">✓</span>
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent 
                      className="w-48 border-2 border-gray-300 bg-white shadow-xl rounded-xl"
                    >
                      <DropdownMenuItem 
                        className={`flex items-center gap-2 px-4 py-3 hover:bg-green-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '1st Grade' && selectedGradeAndLevel?.level === 'start' ? 'bg-green-100' : ''}`}
                        onClick={() => handlePreferenceSelection('start', '1st Grade')}
                      >
                        <span className="text-lg">🌱</span>
                        <div>
                          <div className="font-semibold">Start</div>
                          <div className="text-sm text-gray-500">Beginning level</div>
                        </div>
                        {selectedGradeAndLevel?.grade === '1st Grade' && selectedGradeAndLevel?.level === 'start' ? <span className="ml-auto text-green-600">✓</span> : null}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '1st Grade' && selectedGradeAndLevel?.level === 'middle' ? 'bg-blue-100' : ''}`}
                        onClick={() => handlePreferenceSelection('middle', '1st Grade')}
                      >
                        <span className="text-lg">🚀</span>
                        <div>
                          <div className="font-semibold">Middle</div>
                          <div className="text-sm text-gray-500">Intermediate level</div>
                        </div>
                        {selectedGradeAndLevel?.grade === '1st Grade' && selectedGradeAndLevel?.level === 'middle' ? <span className="ml-auto text-blue-600">✓</span> : null}
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  {/* 2nd Grade */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '2nd Grade' ? 'bg-blue-100' : ''}`}>
                      <span className="text-lg">🎓</span>
                      <span className="font-semibold">2nd Grade</span>
                      {selectedGradeAndLevel?.grade === '2nd Grade' && (
                        <span className="ml-auto text-blue-600 text-sm">✓</span>
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent 
                      className="w-48 border-2 border-gray-300 bg-white shadow-xl rounded-xl"
                    >
                      <DropdownMenuItem 
                        className={`flex items-center gap-2 px-4 py-3 hover:bg-green-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '2nd Grade' && selectedGradeAndLevel?.level === 'start' ? 'bg-green-100' : ''}`}
                        onClick={() => handlePreferenceSelection('start', '2nd Grade')}
                      >
                        <span className="text-lg">🌱</span>
                        <div>
                          <div className="font-semibold">Start</div>
                          <div className="text-sm text-gray-500">Beginning level</div>
                        </div>
                        {selectedGradeAndLevel?.grade === '2nd Grade' && selectedGradeAndLevel?.level === 'start' ? <span className="ml-auto text-green-600">✓</span> : null}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '2nd Grade' && selectedGradeAndLevel?.level === 'middle' ? 'bg-blue-100' : ''}`}
                        onClick={() => handlePreferenceSelection('middle', '2nd Grade')}
                      >
                        <span className="text-lg">🚀</span>
                        <div>
                          <div className="font-semibold">Middle</div>
                          <div className="text-sm text-gray-500">Intermediate level</div>
                        </div>
                        {selectedGradeAndLevel?.grade === '2nd Grade' && selectedGradeAndLevel?.level === 'middle' ? <span className="ml-auto text-blue-600">✓</span> : null}
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  {/* 3rd Grade */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '3rd Grade' ? 'bg-blue-100' : ''}`}>
                      <span className="text-lg">🎓</span>
                      <span className="font-semibold">3rd Grade</span>
                      {selectedGradeAndLevel?.grade === '3rd Grade' && (
                        <span className="ml-auto text-blue-600 text-sm">✓</span>
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent 
                      className="w-48 border-2 border-gray-300 bg-white shadow-xl rounded-xl"
                    >
                      <DropdownMenuItem 
                        className={`flex items-center gap-2 px-4 py-3 hover:bg-green-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '3rd Grade' && selectedGradeAndLevel?.level === 'start' ? 'bg-green-100' : ''}`}
                        onClick={() => handlePreferenceSelection('start', '3rd Grade')}
                      >
                        <span className="text-lg">🌱</span>
                        <div>
                          <div className="font-semibold">Start</div>
                          <div className="text-sm text-gray-500">Beginning level</div>
                        </div>
                        {selectedGradeAndLevel?.grade === '3rd Grade' && selectedGradeAndLevel?.level === 'start' ? <span className="ml-auto text-green-600">✓</span> : null}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '3rd Grade' && selectedGradeAndLevel?.level === 'middle' ? 'bg-blue-100' : ''}`}
                        onClick={() => handlePreferenceSelection('middle', '3rd Grade')}
                      >
                        <span className="text-lg">🚀</span>
                        <div>
                          <div className="font-semibold">Middle</div>
                          <div className="text-sm text-gray-500">Intermediate level</div>
                        </div>
                        {selectedGradeAndLevel?.grade === '3rd Grade' && selectedGradeAndLevel?.level === 'middle' ? <span className="ml-auto text-blue-600">✓</span> : null}
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  {/* 4th Grade */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '4th Grade' ? 'bg-blue-100' : ''}`}>
                      <span className="text-lg">🎓</span>
                      <span className="font-semibold">4th Grade</span>
                      {selectedGradeAndLevel?.grade === '4th Grade' && (
                        <span className="ml-auto text-blue-600 text-sm">✓</span>
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent 
                      className="w-48 border-2 border-gray-300 bg-white shadow-xl rounded-xl"
                    >
                      <DropdownMenuItem 
                        className={`flex items-center gap-2 px-4 py-3 hover:bg-green-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '4th Grade' && selectedGradeAndLevel?.level === 'start' ? 'bg-green-100' : ''}`}
                        onClick={() => handlePreferenceSelection('start', '4th Grade')}
                      >
                        <span className="text-lg">🌱</span>
                        <div>
                          <div className="font-semibold">Start</div>
                          <div className="text-sm text-gray-500">Beginning level</div>
                        </div>
                        {selectedGradeAndLevel?.grade === '4th Grade' && selectedGradeAndLevel?.level === 'start' ? <span className="ml-auto text-green-600">✓</span> : null}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '4th Grade' && selectedGradeAndLevel?.level === 'middle' ? 'bg-blue-100' : ''}`}
                        onClick={() => handlePreferenceSelection('middle', '4th Grade')}
                      >
                        <span className="text-lg">🚀</span>
                        <div>
                          <div className="font-semibold">Middle</div>
                          <div className="text-sm text-gray-500">Intermediate level</div>
                        </div>
                        {selectedGradeAndLevel?.grade === '4th Grade' && selectedGradeAndLevel?.level === 'middle' ? <span className="ml-auto text-blue-600">✓</span> : null}
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  {/* 5th Grade */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '5th Grade' ? 'bg-blue-100' : ''}`}>
                      <span className="text-lg">🎓</span>
                      <span className="font-semibold">5th Grade</span>
                      {selectedGradeAndLevel?.grade === '5th Grade' && (
                        <span className="ml-auto text-blue-600 text-sm">✓</span>
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent 
                      className="w-48 border-2 border-gray-300 bg-white shadow-xl rounded-xl"
                    >
                      <DropdownMenuItem 
                        className={`flex items-center gap-2 px-4 py-3 hover:bg-green-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '5th Grade' && selectedGradeAndLevel?.level === 'start' ? 'bg-green-100' : ''}`}
                        onClick={() => handlePreferenceSelection('start', '5th Grade')}
                      >
                        <span className="text-lg">🌱</span>
                        <div>
                          <div className="font-semibold">Start</div>
                          <div className="text-sm text-gray-500">Beginning level</div>
                        </div>
                        {selectedGradeAndLevel?.grade === '5th Grade' && selectedGradeAndLevel?.level === 'start' ? <span className="ml-auto text-green-600">✓</span> : null}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '5th Grade' && selectedGradeAndLevel?.level === 'middle' ? 'bg-blue-100' : ''}`}
                        onClick={() => handlePreferenceSelection('middle', '5th Grade')}
                      >
                        <span className="text-lg">🚀</span>
                        <div>
                          <div className="font-semibold">Middle</div>
                          <div className="text-sm text-gray-500">Intermediate level</div>
                        </div>
                        {selectedGradeAndLevel?.grade === '5th Grade' && selectedGradeAndLevel?.level === 'middle' ? <span className="ml-auto text-blue-600">✓</span> : null}
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  {/* Choose Topic Option */}
                      <DropdownMenuItem 
                    className="flex items-center gap-2 px-4 py-3 hover:bg-purple-50 cursor-pointer rounded-lg border-t"
                        onClick={() => {
                          playClickSound();
                          setCurrentScreen(0); // Navigate to topics screen
                        }}
                      >
                        <span className="text-lg">📚</span>
                        <div>
                          <div className="font-semibold">Choose Topic</div>
                          <div className="text-sm text-gray-500">Pick your adventure</div>
                        </div>
                      </DropdownMenuItem>

                  {/* Sign Out Option */}
                  <DropdownMenuItem 
                    className="flex items-center gap-2 px-4 py-3 hover:bg-red-50 cursor-pointer rounded-lg border-t"
                    onClick={async () => {
                      playClickSound();
                      try {
                        await signOut();
                      } catch (error) {
                        console.error('Error signing out:', error);
                      }
                    }}
                  >
                    <LogOut className="h-4 w-4 text-red-600" />
                    <div>
                      <div className="font-semibold text-red-600">Sign Out</div>
                      <div className="text-sm text-gray-500">Return to login</div>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          
          {/* Center Title */}
          <div className="flex-1 flex justify-center items-center gap-4">
            {/* Screen Navigation Buttons - Only visible when dev tools are active */}
            {devToolsVisible && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    playClickSound();
                    setCurrentScreen(-1);
                  }}
                  disabled={currentScreen === -1}
                  className="border-2 bg-white btn-animate"
                  style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)', boxShadow: '0 4px 0 black' }}
                >
                  Home
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    playClickSound();
                    setCurrentScreen(0);
                  }}
                  disabled={currentScreen === 0}
                  className="border-2 bg-white btn-animate"
                  style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)', boxShadow: '0 4px 0 black' }}
                >
                  Topics
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    playClickSound();
                    setCurrentScreen(1);
                  }}
                  disabled={currentScreen === 1}
                  className="border-2 bg-white btn-animate"
                  style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)', boxShadow: '0 4px 0 black' }}
                >
                  Adventure
                </Button>
              </>
            )}
            
            <div className="text-center">
              <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent drop-shadow-lg font-kids tracking-wide">
                {devToolsVisible ? `YOUR ADVENTURE - Screen ${currentScreen}` : 
                 userData && currentScreen === -1 ? `Welcome back, ${userData.username}!` :
                 currentScreen === 0 ? 'CHOOSE YOUR ADVENTURE' :
                 currentScreen === 1 ? 'YOUR ADVENTURE' : 
                 'QUIZ TIME'}
              </h1>
              {userData && !devToolsVisible && (
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-sm lg:text-base font-semibold text-primary/80">
                    🎓 {selectedGradeFromDropdown || userData.gradeDisplayName}
                  </span>
                </div>
              )}
            </div>
            
            {devToolsVisible && (
              <>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    playClickSound();
                    setCurrentScreen(3);
                  }}
                  disabled={currentScreen === 3}
                  className="border-2 bg-white btn-animate"
                  style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)', boxShadow: '0 4px 0 black' }}
                >
                  MCQ Screen
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            )}
          </div>
          
          {/* Right Buttons Group - Positioned to align with purple container */}
          <div 
            className="absolute right-0 flex items-center gap-2"
            style={{
              marginRight: `calc((100% - 92%) / 2)` // Align with right edge of purple container
            }}
          >

            
            {/* Voice Selector - Show on Screen 1 */}
            {(currentScreen === 1 || currentScreen === 3) && selectedTopicId && (
              <VoiceSelector />
            )}
            
            {/* Theme Changer and How To buttons - Show on all screens */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Change theme color" className="border-2 bg-white btn-animate" style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)', boxShadow: '0 4px 0 black' }} onClick={() => playClickSound()}>
                  <Palette className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="grid grid-cols-5 gap-2">
                  {colorThemes.map((theme) => (
                    <Button
                      key={theme.name}
                      variant="comic"
                      size="sm"
                      onClick={() => changeTheme(theme)}
                      className={`h-8 w-8 btn-animate rounded-full ${
                        selectedTheme.name === theme.name ? 'ring-2 ring-foreground ring-offset-2' : ''
                      }`}
                      aria-label={`Change theme to ${theme.name}`}
                      style={{
                        backgroundColor: `hsl(${theme.primary})`
                      }}
                    >
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Help" className="border-2 bg-white btn-animate" style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)', boxShadow: '0 4px 0 black' }} onClick={() => playClickSound()}>
                  <HelpCircle className="h-4 w-4" />
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
            
            <Dialog>
              <DialogTrigger asChild>
                                <Button variant="default" aria-label="View whole comic" className="border-2 bg-primary text-primary-foreground btn-animate px-4 hover:bg-primary/90" style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)', boxShadow: '0 4px 0 black' }} onClick={() => playClickSound()}>
                  View Whole Comic
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Your Adventure (All Panels)</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-auto pr-2">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 pb-4">
                    {panels
                      .filter(p => p.text !== "The brave astronaut climbs into ROCKET!") // Exclude the default starting panel
                      .map((p, i) => (
                        <PanelOneLinerFigure key={p.id} panel={p} index={i} />
                      ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>



        {/* Conditional Screen Rendering */}
        {showOnboarding ? (
          <UserOnboarding onComplete={handleOnboardingComplete} />
        ) : currentScreen === -1 ? (
                    <HomePage 
            userData={userData!} 
            onNavigate={handleHomeNavigation} 
            onStartAdventure={handleStartAdventure} 
            onContinueSpecificAdventure={handleContinueSpecificAdventure}
            selectedTopicFromPreference={selectedTopicFromPreference}
          />
        ) : currentScreen === 0 ? (
          <TopicSelection onTopicSelect={handleTopicSelect} />
        ) : currentScreen === 1 ? (
          <main 
            className="flex-1 flex flex-col min-h-0 overflow-y-auto px-4 py-4 lg:px-6 bg-primary/60 relative" 
            style={{
              backgroundImage: `url('/backgrounds/random.png')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundBlendMode: 'multiply'
            }}
            role="main"
          >
            {/* Glass blur overlay to soften the background */}
            <div className="absolute inset-0 backdrop-blur-sm bg-primary/10"></div>
            
            {/* Left Arrow Navigation - Outside the main container */}
            {currentScreen === 1 && isInQuestionMode === false && (
              <>
                {/* Back Button - Only show if we have previous questions */}
                {(() => {
                  const shouldShowBackButton = topicQuestionIndex > 0;
                  console.log('🔍 Back button debug:', { 
                    currentScreen, 
                    topicQuestionIndex, 
                    isInQuestionMode, 
                    shouldShowBackButton,
                    adventurePromptCount,
                    canAccessQuestions 
                  });
                  return shouldShowBackButton;
                })() && (
                  <div 
                    className="fixed left-4 top-1/2 transform -translate-y-1/2 z-40 lg:absolute lg:left-8"
                    style={{
                      // Ensure button stays within viewport on all screen sizes
                      left: 'max(16px, min(32px, calc((100vw - 1280px) / 2 + 16px)))'
                    }}
                  >
                    <Button
                      variant="default"
                      size="lg"
                      onClick={() => {
                        playClickSound();
                        
                        // Navigate back in the question sequence
                        const newQuestionIndex = topicQuestionIndex - 1;
                        console.log(`🔍 DEBUG Adventure: Going back from question ${topicQuestionIndex + 1} to ${newQuestionIndex + 1}`);
                        
                        setTopicQuestionIndex(newQuestionIndex);
                        
                        // Check if we should go back to MCQ mode or stay in adventure
                        // Go to MCQ if we're going back to a question that should be answered
                        if (newQuestionIndex >= 0) {
                          // Switch to MCQ mode to show the previous question
                          setCurrentScreen(3);
                          setIsInQuestionMode(true);
                          
                          // Add transition message
                          setTimeout(async () => {
                            const backToQuestionMessage: ChatMessage = {
                              type: 'ai',
                              content: `🔙 Let's go back to question ${newQuestionIndex + 1}! Take your time to review or change your answer. ✨`,
                              timestamp: Date.now()
                            };
                            
                            setChatMessages(prev => {
                              playMessageSound();
                              return [...prev, backToQuestionMessage];
                            });
                            
                            // Wait for the AI speech to complete
                            const messageId = `index-chat-${backToQuestionMessage.timestamp}-${chatMessages.length}`;
                            await ttsService.speakAIMessage(backToQuestionMessage.content, messageId);
                          }, 500);
                        }
                      }}
                      className="border-2 bg-purple-600 hover:bg-purple-700 text-white btn-animate h-16 w-16 p-0 rounded-full flex items-center justify-center shadow-lg"
                      style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)', boxShadow: '0 4px 0 black' }}
                      aria-label={`Back to Question ${topicQuestionIndex}`}
                    >
                      <ChevronLeft className="h-8 w-8" />
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Right Arrow Navigation - Outside the main container */}
            {currentScreen === 1 && isInQuestionMode === false && (
              <div 
                className="fixed right-4 top-1/2 transform -translate-y-1/2 z-40 lg:absolute lg:right-8"
                style={{
                  // Ensure button stays within viewport on all screen sizes
                  right: 'max(16px, min(32px, calc((100vw - 1280px) / 2 + 16px)))'
                }}
              >
                <Button
                  variant="default"
                  size="lg"
                  onClick={() => {
                    playClickSound();
                    
                    console.log(`🔍 DEBUG Adventure: Going to next question ${topicQuestionIndex + 1}`);
                    
                    // Switch to MCQ mode to show the next question
                    setCurrentScreen(3);
                    setIsInQuestionMode(true);
                    
                    // Add transition message
                    setTimeout(async () => {
                      const toQuestionMessage: ChatMessage = {
                        type: 'ai',
                        content: `🎯 Time for question ${topicQuestionIndex + 1}! Let's test your reading skills. Ready for the challenge? 📚✨`,
                        timestamp: Date.now()
                      };
                      
                      setChatMessages(prev => {
                        playMessageSound();
                        return [...prev, toQuestionMessage];
                      });
                      
                      // Wait for the AI speech to complete
                      const messageId = `index-chat-${toQuestionMessage.timestamp}-${chatMessages.length}`;
                      await ttsService.speakAIMessage(toQuestionMessage.content, messageId);
                    }, 500);
                  }}
                  className="border-2 bg-green-600 hover:bg-green-700 text-white btn-animate h-16 w-16 p-0 rounded-full flex items-center justify-center shadow-lg"
                  style={{ borderColor: 'hsl(from hsl(142 76% 36%) h s 25%)', boxShadow: '0 4px 0 black' }}
                  aria-label="Answer Questions"
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              </div>
            )}
            
            {/* Wrapper for both background and content to scale together */}
            <div 
              className="relative responsive-max-width mx-auto my-4 flex-shrink-0"
              style={{ 
                width: '95%', // 5% reduction from full width
                maxWidth: '1520px',
                aspectRatio: getAspectRatio,
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
              {/* Main Comic Panel - Center */}
              <section 
                aria-label="Main comic panel" 
                className="flex flex-col min-h-0 relative flex-1 bg-white rounded-3xl overflow-hidden border-2 border-black transition-all duration-300 ease-in-out"
                style={{ marginRight: sidebarCollapsed ? '0px' : '5px' }}
              >
                <div className="flex-1 min-h-0 relative">
                  <ComicPanel
                    image={current.image}
                    className="h-full w-full"
                    isNew={current.id === newlyCreatedPanelId}
                    isGenerating={isGeneratingAdventureImage}
                    shouldZoom={current.id === zoomingPanelId}
                    onPreviousPanel={() => {
                      if (currentIndex > 0) {
                        setCurrent(currentIndex - 1);
                      }
                    }}
                    onNextPanel={() => {
                      if (currentIndex < panels.length - 1) {
                        setCurrent(currentIndex + 1);
                      }
                    }}
                    hasPrevious={currentIndex > 0}
                    hasNext={currentIndex < panels.length - 1}
                  />
                </div>
              </section>

                            {/* No separator needed with rounded design */}

                {/* Right Sidebar with Avatar, Messages and Input */}
                <aside 
                  ref={resizeRef}
                  className={`flex flex-col min-h-0 z-10 relative rounded-3xl overflow-hidden border-2 border-black transition-all duration-300 ease-in-out ${isResizing ? 'chat-panel-resizing' : ''}`}
                  style={{ 
                    width: sidebarCollapsed ? '0%' : `${chatPanelWidthPercent}%`,
                    minWidth: sidebarCollapsed ? '0px' : '320px',
                    maxWidth: sidebarCollapsed ? '0px' : '450px',
                    opacity: sidebarCollapsed ? 0 : 1,
                    height: '100%',
                    backgroundImage: `url('/backgrounds/random.png')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                                       marginLeft: sidebarCollapsed ? '0px' : '5px',
                    pointerEvents: sidebarCollapsed ? 'none' : 'auto'
                  }}
                  >
                  {/* Glass Film Overlay - Between pattern and content */}
                  <div 
                    className="absolute inset-0 backdrop-blur-sm bg-gradient-to-b from-primary/15 via-white/40 to-primary/10"
                    style={{ zIndex: 1 }}
                  ></div>
                  
                  {/* Content Container - Above the glass film */}
                  <div className="relative z-10 flex flex-col h-full">
                                {/* Close Button - Top Right */}
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
                
                                {/* Content only shown when not collapsed */}
                  {!sidebarCollapsed && (
                    <>
                      {/* Avatar Section */}
                      <div className="flex-shrink-0 relative">
                        {/* Darker theme film for avatar section */}
                        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/20 to-primary/25 backdrop-blur-sm"></div>
                        <div className="relative z-10">
                          <ChatAvatar />
                        </div>
                      </div>
                    
                      {/* Messages */}
                      <div className="flex-1 min-h-0 relative">
                        {/* Messages Container */}
                        <div 
                          ref={messagesScrollRef}
                          className="h-full overflow-y-auto space-y-3 p-3 bg-white/95 backdrop-blur-sm"
                        >
                          {chatMessages.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                              <p>💬 Start chatting with Krafty!</p>
                            </div>
                          ) : (
                            <>
                              {chatMessages.map((message, index) => (
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
                                      "max-w-[80%] rounded-lg px-3 py-2 text-sm transition-all duration-200 relative",
                                      message.type === 'user' 
                                        ? "bg-primary text-primary-foreground" 
                                        : "bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5"
                                    )}
                                    style={{}}
                                  >
                                    <div className="font-medium text-xs mb-1 opacity-70">
                                      {message.type === 'user' ? 'You' : '🤖 Krafty'}
                                    </div>
                                    <div className={message.type === 'ai' ? 'pr-6' : ''}>
                                      {message.type === 'ai' ? (
                                        <div dangerouslySetInnerHTML={{ __html: formatAIMessage(message.content) }} />
                                      ) : (
                                        message.content
                                      )}
                                    </div>
                                    {/* Speaker button for AI messages only */}
                                    {message.type === 'ai' && (
                                      <SpeakerButton message={message} index={index} />
                                    )}
                                  </div>
                                </div>
                              ))}
                              
                              {/* AI Typing Indicator */}
                              {isAIResponding && (
                                <div className="flex justify-start animate-slide-up-smooth">
                                  <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-card border-2"
                                       style={{ borderColor: 'hsla(var(--primary), 0.9)' }}>
                                    <div className="font-medium text-xs mb-1 opacity-70">
                                      🤖 Krafty
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span>Krafty is thinking</span>
                                      <div className="flex gap-1">
                                        {[...Array(3)].map((_, i) => (
                                          <div
                                            key={i}
                                            className="w-1 h-1 bg-primary rounded-full animate-pulse"
                                            style={{
                                              animationDelay: `${i * 0.2}s`,
                                              animationDuration: '1s'
                                            }}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Input Bar */}
                      <div className="flex-shrink-0 p-3 border-t border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
                        <InputBar onGenerate={onGenerate} onGenerateImage={onGenerateImage} />
                      </div>
                    </>
                  )}
                
                {/* Resize Handle - Hidden on mobile and when collapsed */}
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
        ) : (
          <MCQScreenTypeA
            getAspectRatio={getAspectRatio}
            sidebarCollapsed={sidebarCollapsed}
            setSidebarCollapsed={setSidebarCollapsed}
            chatMessages={chatMessages}
            setChatMessages={setChatMessages}
            onGenerate={onGenerate}
            onGenerateImage={onGenerateImage}
            chatPanelWidthPercent={chatPanelWidthPercent}
            setChatPanelWidthPercent={setChatPanelWidthPercent}
            isResizing={isResizing}
            setIsResizing={setIsResizing}
            messagesScrollRef={messagesScrollRef}
            lastMessageCount={lastMessageCount}
            handleResizeStart={handleResizeStart}
            selectedTopicId={selectedTopicId}
            startingQuestionIndex={computedStartingQuestionIndex} // Pass the computed question index - fixes try again bug
            key={`mcq-${selectedTopicId}-${topicQuestionIndex}`} // Force re-render when question index changes
            onBackToTopics={() => {
              playClickSound();
              setCurrentScreen(0); // Go back to topic selection
            }}
            onRetryTopic={() => {
              playClickSound();
              // New retry logic - fix for try again going to q10 instead of q1
              setIsRetryMode(true); // Enter retry mode
              setRetryQuestionIndex(0); // Start from question 1 (index 0)
              setTopicQuestionIndex(0); // Reset the main topic question index as well
              setIsInQuestionMode(true); // Ensure we're in question mode
              setAdventurePromptCount(0); // Reset adventure prompt count for clean retry
              setCanAccessQuestions(true); // Allow questions immediately on retry
              // Clear saved question progress for clean restart
              clearQuestionProgress();
              console.log('🔄 RETRY: Reset to question 1, retry mode enabled, progress cleared');
            }}
            onBack={handleBackFromMCQ}
            onQuestionChange={(questionIndex: number) => {
              // Save progress whenever question changes
              if (selectedTopicId) {
                saveQuestionProgress(selectedTopicId, questionIndex);
                setTopicQuestionIndex(questionIndex);
              }
            }}
            onNextTopic={(nextTopicId) => {
              playClickSound();
              
              console.log(`🔍 DEBUG: Question completed. Current topicQuestionIndex: ${topicQuestionIndex}`);
              
              // Handle question progression in the automatic flow
              if (isInQuestionMode) {
                let newQuestionIndex;
                // New logic to handle retry mode properly
                if (isRetryMode) {
                  newQuestionIndex = retryQuestionIndex + 1;
                  setRetryQuestionIndex(newQuestionIndex);
                  console.log(`🔍 DEBUG RETRY: Setting retryQuestionIndex to: ${newQuestionIndex}`);
                  // Exit retry mode after first question progression to return to normal flow
                  if (newQuestionIndex > 0) {
                    setIsRetryMode(false);
                    setTopicQuestionIndex(newQuestionIndex);
                    console.log(`🔍 DEBUG RETRY: Exiting retry mode, setting topicQuestionIndex to: ${newQuestionIndex}`);
                  }
                } else {
                  newQuestionIndex = topicQuestionIndex + 1;
                  setTopicQuestionIndex(newQuestionIndex);
                  console.log(`🔍 DEBUG: Setting topicQuestionIndex to: ${newQuestionIndex}`);
                }
                
                // Check if we should return to adventure mode based on the flow pattern
                // After completing Q3 (index 2), newQuestionIndex becomes 3
                // After completing Q6 (index 5), newQuestionIndex becomes 6
                // After completing Q9 (index 8), newQuestionIndex becomes 9
                if (newQuestionIndex === 3 || newQuestionIndex === 6 || newQuestionIndex === 9) {
                  console.log(`🔍 DEBUG: Adventure break after question ${newQuestionIndex}. Going to adventure mode.`);
                  // After q3, q6, or q9, return to adventure mode
                  setIsInQuestionMode(false);
                  setCurrentScreen(1); // Return to adventure screen
                  
                  // Reset adventure threshold for next sequence - user needs to send prompts again
                  setAdventurePromptCount(0);
                  setCanAccessQuestions(false);
                  console.log(`🔍 DEBUG: Reset adventure threshold for next sequence`);
                  
                  // Add transition message and wait for speech to complete
                  setTimeout(async () => {
                    const backToAdventureMessage: ChatMessage = {
                      type: 'ai',
                      content: `🚀 Excellent work on those questions! Now let's continue building your amazing adventure! What happens next in your story? ✨`,
                      timestamp: Date.now()
                    };
                    
                    setChatMessages(prev => {
                      playMessageSound();
                      return [...prev, backToAdventureMessage];
                    });
                    
                    // Wait for the AI speech to complete
                    const messageId = `index-chat-${backToAdventureMessage.timestamp}-${chatMessages.length}`;
                    await ttsService.speakAIMessage(backToAdventureMessage.content, messageId);
                  }, 500);
                  return;
                } else if (newQuestionIndex === 10) {
                  console.log(`🔍 DEBUG: All 10 questions completed! Starting new adventure for next topic.`);
                  
                  // Topic completed - create completely new adventure (same as Create New Adventure button)
                  // Determine the next topic
                  const topicToNavigateTo = nextTopicId || getNextTopic(Object.keys(sampleMCQData.topics));
                  
                  if (topicToNavigateTo) {
                    // Start a completely new adventure
                    setSelectedTopicId(topicToNavigateTo);
                    setAdventureMode('new');
                    
                    // Reset everything for new adventure (same as handleStartAdventure with mode='new')
                    setChatMessages([]);                    // Clear chat history
                    setCurrentAdventureId(crypto.randomUUID()); // New adventure ID
                    reset(initialPanels);                   // Reset comic panels to default
                    
                    // Reset question flow state
                    setTopicQuestionIndex(0);
                    setIsInQuestionMode(false);
                    setAdventurePromptCount(0);
                    setCanAccessQuestions(false);
                    setIsRetryMode(false);
                    setRetryQuestionIndex(0);
                    
                    // Reset initial response ref
                    initialResponseSentRef.current = null;
                    
                    console.log('🚀 Started completely new adventure for next topic');
                    
                    // Go to adventure screen to start fresh
                    setCurrentScreen(1);
                    return; // Exit early - don't execute the topic navigation logic below
                  } else {
                    // No more topics, go back to topic selection
                    setCurrentScreen(0);
                    return; // Exit early
                  }
                }
                
                console.log(`🔍 DEBUG: Continuing to next question. New index will be: ${newQuestionIndex}`);
              }
              
              // If a specific next topic is provided, use it
              // Otherwise, determine the next topic from progress tracking
              const topicToNavigateTo = nextTopicId || getNextTopic(Object.keys(sampleMCQData.topics));
              
              if (topicToNavigateTo) {
                // Navigate to the next topic
                setSelectedTopicId(topicToNavigateTo);
                // Stay on MCQ screen (currentScreen = 3)
              } else {
                // No more topics, go back to topic selection
                setCurrentScreen(0);
              }
            }}
          />
        )}

        {/* Messenger Chat when sidebar is collapsed */}
        {sidebarCollapsed && (
          <MessengerChat 
            messages={chatMessages} 
            onGenerate={onGenerate}
            onGenerateImage={onGenerateImage}
            onExpandChat={() => {
              playClickSound();
              setSidebarCollapsed(false);
            }}
          />
        )}



        {/* Bottom Left Back to Adventure Button - Show on Screen 3 */}
        {/* Note: The back button functionality is now handled by the onBack prop in MCQScreenTypeA */}
        {/* MCQScreenTypeA component will render its own back button with the sequential navigation logic */}

        {/* Dev Tools Indicator */}
        {devToolsVisible && (
          <div className="fixed bottom-4 right-4 z-50 bg-primary text-primary-foreground px-3 py-2 rounded-lg shadow-lg border-2 border-black font-bold text-sm">
            🛠️ DEV MODE ACTIVE (A+S+D to toggle)
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
