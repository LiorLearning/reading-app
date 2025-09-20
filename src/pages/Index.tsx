import React, { useCallback, useMemo, useState, useEffect } from "react";
import ComicPanelComponent from "@/components/comic/ComicPanel";
import InputBar from "@/components/comic/InputBar";
import MessengerChat from "@/components/comic/MessengerChat";
import ChatAvatar from "@/components/comic/ChatAvatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, Palette, HelpCircle, BookOpen, Image as ImageIcon, MessageCircle, ChevronLeft, ChevronRight, GraduationCap, ChevronDown, Volume2, Square, LogOut } from "lucide-react";
import { cn, formatAIMessage, ChatMessage, loadUserAdventure, saveUserAdventure, getNextTopic, saveAdventure, loadSavedAdventures, saveAdventureSummaries, loadAdventureSummaries, generateAdventureName, generateAdventureSummary, SavedAdventure, AdventureSummary, loadUserProgress, hasUserProgress, UserProgress, saveTopicPreference, loadTopicPreference, getNextTopicByPreference, mapSelectedGradeToContentGrade, saveCurrentAdventureId, loadCurrentAdventureId, saveQuestionProgress, loadQuestionProgress, clearQuestionProgress, getStartingQuestionIndex, saveGradeSelection, loadGradeSelection, SpellingProgress, saveSpellingProgress, loadSpellingProgress, clearSpellingProgress, resetSpellingProgress, SpellboxTopicProgress, SpellboxGradeProgress, updateSpellboxTopicProgress, getSpellboxTopicProgress, isSpellboxTopicPassingGrade, getNextSpellboxTopic } from "@/lib/utils";
import { saveAdventureHybrid, loadAdventuresHybrid, loadAdventureSummariesHybrid, getAdventureHybrid, updateLastPlayedHybrid } from "@/lib/firebase-adventure-cache";
import { sampleMCQData } from "../data/mcq-questions";
import { playMessageSound, playClickSound, playImageLoadingSound, stopImageLoadingSound, playImageCompleteSound } from "@/lib/sounds";

import { useComic, ComicPanel } from "@/hooks/use-comic";
import { AdventureResponse, aiService } from "@/lib/ai-service";
import { ttsService } from "@/lib/tts-service";
import VoiceSelector from "@/components/ui/voice-selector";
import { useTTSSpeaking } from "@/hooks/use-tts-speaking";
import { useAuth } from "@/hooks/use-auth";
import { useUnifiedAIStreaming, useUnifiedAIStatus } from "@/hooks/use-unified-ai-streaming";
import { adventureSessionService } from "@/lib/adventure-session-service";
import { chatSummaryService } from "@/lib/chat-summary-service";
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

import { cacheAdventureImageHybrid, getCachedImagesForAdventureFirebase } from "@/lib/firebase-image-cache";
import { useFirebaseImage, useCurrentAdventureId } from "@/hooks/use-firebase-image";

import { testFirebaseStorage } from "@/lib/firebase-test";
import { debugFirebaseAdventures, debugSaveTestAdventure, debugFirebaseConnection } from "@/lib/firebase-debug-adventures";
import { autoMigrateOnLogin, forceMigrateUserData } from "@/lib/firebase-data-migration";

import { getRandomSpellingQuestion, getSequentialSpellingQuestion, getSpellingQuestionCount, getSpellingTopicIds, getSpellingQuestionsByTopic, getNextSpellboxQuestion, SpellingQuestion } from "@/lib/questionBankUtils";
import FeedbackModal from "@/components/FeedbackModal";
import { aiPromptSanitizer, SanitizedPromptResult } from "@/lib/ai-prompt-sanitizer";
import { useTutorial } from "@/hooks/use-tutorial";
import { useRealtimeSession } from "@/hooks/useRealtimeSession";


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

// Component for panel image figure with Firebase image resolution (Index.tsx version)
const IndexPanelImageFigure: React.FC<{
  panel: { id: string; image: string; text: string };
  index: number;
  oneLiner: string;
}> = ({ panel, index, oneLiner }) => {
  // Get current adventure ID for Firebase image resolution
  const currentAdventureId = useCurrentAdventureId();
  
  // Resolve Firebase image if needed
  const { url: resolvedImageUrl, isExpiredUrl } = useFirebaseImage(panel.image, currentAdventureId || undefined);
  
  React.useEffect(() => {
    if (isExpiredUrl && resolvedImageUrl !== panel.image) {
      console.log(`🔄 Index Panel ${index + 1}: Resolved expired image to Firebase URL: ${resolvedImageUrl.substring(0, 50)}...`);
    }
  }, [resolvedImageUrl, panel.image, index, isExpiredUrl]);

  return (
    <figure className="rounded-lg border-2 bg-card" style={{ borderColor: 'hsla(var(--primary), 0.9)' }}>
      <img 
        src={resolvedImageUrl} 
        alt={`Panel ${index + 1}`} 
        className="w-full h-auto object-cover border-2 rounded-t-lg" 
        style={{ borderColor: 'hsla(var(--primary), 0.9)' }}
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          if (!target.src.includes('placeholder')) {
            console.warn(`⚠️ Failed to load index panel image ${index + 1}, using fallback`);
            target.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            target.style.minHeight = '200px';
            target.alt = `Panel ${index + 1} (image unavailable)`;
          }
        }}
      />
      <figcaption className="px-2 py-1 text-sm font-semibold">{index + 1}. {oneLiner}</figcaption>
    </figure>
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
    <IndexPanelImageFigure panel={panel} index={index} oneLiner={oneLiner} />
  );
};

const Index = () => {
  // Firebase auth integration - must be at the top
  const { user, userData, signOut } = useAuth();
  
  // Tutorial system integration
  const { isFirstTimeAdventurer, completeAdventureTutorial } = useTutorial();
  
  // NEW: Unified AI streaming system status
  const { isUnifiedSystemReady, hasImageGeneration } = useUnifiedAIStatus();

  // Auto-migrate localStorage data to Firebase when user authenticates
  React.useEffect(() => {
    if (user?.uid) {
      autoMigrateOnLogin(user.uid).catch(error => {
        console.warn('Auto-migration failed:', error);
      });
    }
  }, [user?.uid]);

  React.useEffect(() => {
    document.title = "AI Reading Learning App — Your Adventure";
    
    // Add Firebase test and debug functions to window for debugging
    if (typeof window !== 'undefined') {
      (window as any).testFirebaseStorage = testFirebaseStorage;
      (window as any).debugFirebaseAdventures = () => debugFirebaseAdventures(user?.uid || null);
      (window as any).debugSaveTestAdventure = () => debugSaveTestAdventure(user?.uid || null);
      (window as any).debugFirebaseConnection = debugFirebaseConnection;
      (window as any).migrateToFirebase = () => forceMigrateUserData(user?.uid || 'anonymous');
      (window as any).autoMigrateOnLogin = () => autoMigrateOnLogin(user?.uid || 'anonymous');
    }
  }, [user]);

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
  
  // AI Sanitized Prompt for legacy fallback
  const [aiSanitizedPrompt, setAiSanitizedPrompt] = React.useState<SanitizedPromptResult | null>(null);
  const [sanitizationInProgress, setSanitizationInProgress] = React.useState<boolean>(false);
  
  // Optional session tracking for Firebase (won't break existing functionality)
  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(null);
  
  // Track message cycle for 3-3 pattern (3 pure adventure, then 3 with spelling)
  const [messageCycleCount, setMessageCycleCount] = React.useState(0);

  const {
    status,
    sendMessage,
    onToggleConnection,
    downloadRecording,
  } = useRealtimeSession({
    isAudioPlaybackEnabled: true,
    enabled: true,
  });

  // Centralized function to increment message cycle count for all user interactions
  const incrementMessageCycle = useCallback(() => {
    setMessageCycleCount(prev => {
      const newCount = (prev + 1) % 6;
      console.log(`🔄 Message cycle incremented: ${prev} → ${newCount} (${newCount < 3 ? 'Pure Adventure' : 'Spelling Phase'})`);
      return newCount;
    });
  }, []);
  
  // Initialize message cycle count based on existing messages
  React.useEffect(() => {
    // Count AI messages to determine current cycle position
    const aiMessageCount = chatMessages.filter(msg => msg.type === 'ai').length;
    setMessageCycleCount(aiMessageCount % 6);
  }, []); // Only run on mount

  // Console log when realtime session starts
  useEffect(() => {
    if (status === "CONNECTED") {
      console.log("OPENAI REALTIME STARTED:");
    }
  }, [status]);
  
  // Show onboarding if user is authenticated but hasn't completed setup
  const showOnboarding = user && userData && (userData.isFirstTime || !userData.grade);

  // If user is authenticated but we're still loading userData, we should wait
  const isLoadingUserData = user && !userData;
  
  // Dev tools state
  const [devToolsVisible, setDevToolsVisible] = React.useState(false);
    const [currentScreen, setCurrentScreen] = React.useState<-1 | 0 | 1 | 2 | 3>(() => {
    // If user exists but no userData yet, start at loading state (don't show topic selection)
    if (user && !userData) return -1;
    // If userData exists and user is already setup, go to home
    if (userData && userData.grade && !userData.isFirstTime) return -1;
    // If user needs onboarding, the onboarding component will handle it
    // Start at home screen to avoid topic selection flash
    return -1;
  });
  const [selectedTopicId, setSelectedTopicId] = React.useState<string>("");
  const [pressedKeys, setPressedKeys] = React.useState<Set<string>>(new Set());
  
  // Adventure mode state to track whether it's a new or continuing adventure
  const [adventureMode, setAdventureMode] = React.useState<'new' | 'continue'>('new');
  
  // Track current adventure context for contextual AI responses
  const [currentAdventureContext, setCurrentAdventureContext] = React.useState<{name: string, summary: string} | null>(null);
  
  // Track if initial AI response has been sent for current session
  const initialResponseSentRef = React.useRef<string | null>(null);
  
  // Current adventure tracking - initialize from localStorage on refresh
  const [currentAdventureId, setCurrentAdventureId] = React.useState<string | null>(() => loadCurrentAdventureId());
  const [adventureSummaries, setAdventureSummaries] = React.useState<AdventureSummary[]>([]);
  
  // Grade selection state (for HomePage only)
  const [selectedPreference, setSelectedPreference] = React.useState<'start' | 'middle' | null>(null);
  const [selectedTopicFromPreference, setSelectedTopicFromPreference] = React.useState<string | null>(null);
  const [selectedGradeFromDropdown, setSelectedGradeFromDropdown] = React.useState<string | null>(() => {
    // Load saved grade selection on initialization
    const savedGrade = loadGradeSelection();
    return savedGrade?.gradeDisplayName || null;
  });
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
  
  // SpellBox state management
  const [showSpellBox, setShowSpellBox] = React.useState<boolean>(false);
  const [currentSpellQuestion, setCurrentSpellQuestion] = React.useState<SpellingQuestion | null>(null);
  // Store the original spelling question from question bank (with prefilled data)
  const [originalSpellingQuestion, setOriginalSpellingQuestion] = React.useState<SpellingQuestion | null>(null);
  
  // Sequential spelling progress tracking
  const [spellingProgressIndex, setSpellingProgressIndex] = React.useState<number>(() => {
    // Initialize with saved progress for current grade
    const currentGrade = selectedGradeFromDropdown || userData?.gradeDisplayName;
    const savedProgress = loadSpellingProgress(currentGrade);
    return savedProgress?.currentSpellingIndex || 0;
  });
  
  const [completedSpellingIds, setCompletedSpellingIds] = React.useState<number[]>(() => {
    // Initialize with saved completed IDs for current grade
    const currentGrade = selectedGradeFromDropdown || userData?.gradeDisplayName;
    const savedProgress = loadSpellingProgress(currentGrade);
    return savedProgress?.completedSpellingIds || [];
  });
  
  // Legacy spell progress for backward compatibility (can be removed later)
  const [spellProgress, setSpellProgress] = React.useState<{totalQuestions: number, currentIndex: number}>({
    totalQuestions: 10,
    currentIndex: 0
  });
  
  // Feedback modal state
  const [showFeedbackModal, setShowFeedbackModal] = React.useState<boolean>(false);
  
  // Helper function to build image context for AI sanitizer
  const buildImageContext = useCallback(() => {
    const recentMessages = chatMessages.slice(-4).map(msg => 
      `${msg.type}: ${msg.content.substring(0, 100)}...`
    ).join('; ');
    
    const userInfo = userData ? `Grade ${userData.grade}, Level ${userData.level}` : 'Elementary student';
    
    return `Context for ${userInfo}: Recent conversation: ${recentMessages}`;
  }, [chatMessages, userData]);

  // Handle feedback submission
  const handleFeedbackSubmit = async (feedbackData: {enjoymentAnswer: string}) => {
    // Close modal immediately regardless of API success/failure
    setShowFeedbackModal(false);
    setCurrentScreen(-1);
    
    try {
      console.log('Feedback submitted:', feedbackData);
      
      // Only save if user is authenticated (required by security rules)
      if (!user?.uid) {
        console.warn('Cannot save feedback: User not authenticated');
        return;
      }
      
      // Import feedback service dynamically to avoid circular dependencies
      const { feedbackService } = await import('@/lib/feedback-service');
      
      // Save to Firestore - userId must match authenticated user for security rules
      await feedbackService.saveFeedback(
        currentAdventureId,
        user.uid, // Use authenticated user's UID
        feedbackData.enjoymentAnswer
      );
      
      console.log('Feedback saved successfully to Firestore');
      
    } catch (error) {
      console.error('Error saving feedback:', error);
      // Don't re-throw - modal is already closed
    }
  };
  
  // Get the current spelling word from the latest AI message
  const currentSpellingWord = chatMessages.filter(message => message.type === 'ai').slice(-1)[0]?.spelling_word;
  const currentSpellingSentence = chatMessages.filter(message => message.type === 'ai').slice(-1)[0]?.spelling_sentence || null;

  // Auto-trigger SpellBox when there's a spelling word
  React.useEffect(() => {
    if (currentSpellingWord && currentScreen === 1) {
      console.log('🔤 SPELLBOX TRIGGER DEBUG:', {
        currentSpellingWord,
        hasOriginalQuestion: !!originalSpellingQuestion,
        originalQuestionWord: originalSpellingQuestion?.word,
        originalQuestionAudio: originalSpellingQuestion?.audio,
        actualSpellingWord: originalSpellingQuestion?.audio,
        originalQuestionIsPrefilled: originalSpellingQuestion?.isPrefilled,
        originalQuestionPrefilledIndexes: originalSpellingQuestion?.prefilledIndexes,
        wordsMatch: originalSpellingQuestion?.audio.toLowerCase() === currentSpellingWord.toLowerCase(),
        messageCycleCount
      });
      
      // Use the original spelling question (with prefilled data) if available and matches
      // Compare against the audio field (actual spelling word), not the word field
      if (originalSpellingQuestion && originalSpellingQuestion.audio.toLowerCase() === currentSpellingWord.toLowerCase()) {
        console.log('🔤 USING ORIGINAL SPELLING QUESTION WITH PREFILLED DATA:', {
          id: originalSpellingQuestion.id,
          word: originalSpellingQuestion.word,
          audio: originalSpellingQuestion.audio,
          actualSpellingWord: originalSpellingQuestion.audio,
          isPrefilled: originalSpellingQuestion.isPrefilled,
          prefilledIndexes: originalSpellingQuestion.prefilledIndexes
        });
        
        // Update the question text with the AI-generated sentence but keep all other data
        // IMPORTANT: Use the audio field (actual spelling word) as the word field for SpellBox
        const enhancedQuestion: SpellingQuestion = {
          ...originalSpellingQuestion,
          word: originalSpellingQuestion.audio, // Use actual spelling word for SpellBox
          questionText: currentSpellingSentence || originalSpellingQuestion.questionText
        };
        
        setCurrentSpellQuestion(enhancedQuestion);
      } else {
        // Fallback: Convert the spelling word to a SpellingQuestion format (no prefilled data)
        console.log('🔤 FALLBACK: Creating new spelling question without prefilled data', {
          reason: !originalSpellingQuestion ? 'No original question stored' : 'Word mismatch',
          currentSpellingWord,
          originalQuestionWord: originalSpellingQuestion?.word,
          originalQuestionAudio: originalSpellingQuestion?.audio,
          actualSpellingWord: originalSpellingQuestion?.audio
        });
        const spellQuestion: SpellingQuestion = {
          id: Date.now(),
          topicId: selectedTopicId,
          topicName: selectedTopicId,
          templateType: 'spelling',
          word: currentSpellingWord,
          questionText: currentSpellingSentence,
          correctAnswer: currentSpellingWord.toUpperCase(),
          audio: currentSpellingWord,
          explanation: `Great job! "${currentSpellingWord}" is spelled correctly.`
        };
        
        setCurrentSpellQuestion(spellQuestion);
      }
      
      setShowSpellBox(true);
    } else {
      setShowSpellBox(false);
      setCurrentSpellQuestion(null);
    }
  }, [currentSpellingWord, currentScreen, originalSpellingQuestion, messageCycleCount]);
  
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
      // Only reset loading state if unified system is not actively generating
      if (!unifiedAIStreaming.isGeneratingImage) {
        setIsGeneratingAdventureImage(false);
      }
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
            currentAdventureContext, // Pass adventure context for specific adventures
            undefined, // storyEventsContext - can be added later if needed
            currentAdventureContext?.summary, // Pass adventure summary
            userData   // user data from Firebase
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
  }, [currentScreen, selectedTopicId, adventureMode, currentAdventureContext, userData]);
  
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
  
  // Handle spelling progress reset when grade changes
  React.useEffect(() => {
    const currentGrade = selectedGradeFromDropdown || userData?.gradeDisplayName;
    
    // Only reset if we have a grade and it's different from what we initialized with
    if (currentGrade) {
      const savedProgress = loadSpellingProgress(currentGrade);
      const expectedIndex = savedProgress?.currentSpellingIndex || 0;
      const expectedCompletedIds = savedProgress?.completedSpellingIds || [];
      
      // If current state doesn't match saved progress for this grade, update it
      if (spellingProgressIndex !== expectedIndex || completedSpellingIds.length !== expectedCompletedIds.length) {
        console.log(`🔄 Grade changed to ${currentGrade}, updating spelling progress from index ${spellingProgressIndex} to ${expectedIndex}`);
        setSpellingProgressIndex(expectedIndex);
        setCompletedSpellingIds(expectedCompletedIds);
      }
    }
  }, [selectedGradeFromDropdown, userData?.gradeDisplayName, spellingProgressIndex, completedSpellingIds]);
  
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
  
  // Ensure grade selection is loaded from localStorage on mount
  useEffect(() => {
    const savedGrade = loadGradeSelection();
    if (savedGrade && !selectedGradeFromDropdown) {
      console.log(`🔄 Loading saved grade selection on mount: ${savedGrade.gradeDisplayName}`);
      setSelectedGradeFromDropdown(savedGrade.gradeDisplayName);
    }
  }, []); // Run once on mount

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
      // Use saved grade selection if available, otherwise fall back to userData
      const savedGrade = loadGradeSelection();
      const gradeToUse = savedGrade?.gradeDisplayName || userData?.gradeDisplayName;
      
      if (preferenceLevel && gradeToUse) {
        setSelectedGradeAndLevel({ 
          grade: gradeToUse, 
          level: preferenceLevel 
        });
        console.log('Initialized selectedGradeAndLevel:', { grade: gradeToUse, level: preferenceLevel, source: savedGrade ? 'localStorage' : 'Firebase' });
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

  //   // Update currentScreen when userData loads to prevent flashing TopicSelection before onboarding
  // useEffect(() => {
  //   if (loading) return;
  //   if (user && userData) {
  //     // If user needs onboarding, ensure we don't show TopicSelection briefly
  //     const needsOnboarding = userData.isFirstTime || !userData.grade;
  //     if (needsOnboarding && currentScreen === 0) {
  //       // User needs onboarding but currentScreen is on TopicSelection
  //       // Don't change currentScreen - let showOnboarding take precedence
  //       return;
  //     } else if (!needsOnboarding && (currentScreen === 0 || currentScreen === -1)) {
  //       // User doesn't need onboarding, ensure we go to HomePage
  //       setCurrentScreen(-1);
  //     }
  //   } else if (!user && currentScreen !== 0) {
  //     // User is not authenticated, should be on TopicSelection
  //     setCurrentScreen(0);
  //   }
  // }, [user, userData, currentScreen, loading]);
  
  
  // Ensure chat panel is always open when adventure mode starts
  useEffect(() => {
    if (currentScreen === 1) {
      // Always open chat panel when entering adventure mode
      setSidebarCollapsed(false);
      console.log('🗨️ Adventure mode started - opening chat panel by default');
    }
  }, [currentScreen]);
  
  // Chat panel resize functionality - now proportional
  const [chatPanelWidthPercent, setChatPanelWidthPercent] = React.useState(30); // 30% of container width for 70:30 split
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


  // NEW: Unified AI streaming with automatic image generation
  const unifiedAIStreaming = useUnifiedAIStreaming({
    userId: user?.uid || 'anonymous',
    adventureId: currentAdventureId || undefined,
    onNewImage: async (imageUrl: string, prompt: string) => {
      console.log('🎨 NEW: Image generated by unified AI system:', imageUrl);
      
      // 🎯 NEW: Reset counter to 0 when unified system generates image
      setLastAutoImageMessageCount(prev => {
        const currentUserCount = chatMessages.filter(msg => msg.type === 'user').length;
        // Reset to 0, so auto-generation waits for full 4-message interval from now
        const newCount = 0;
        const nextAutoTriggerAt = currentUserCount + AUTO_IMAGE_TRIGGER_INTERVAL;
        
        console.log('📉 COMMUNICATION: Unified system generated image → resetting auto-generation counter:', {
          previousAutoCount: prev,
          currentUserMessageCount: currentUserCount,
          newAutoCount: newCount,
          nextAutoTriggerAt,
          messagesUntilNextAuto: AUTO_IMAGE_TRIGGER_INTERVAL,
          reason: 'unified_system_coordination',
          message: `Auto-gen will now trigger after ${AUTO_IMAGE_TRIGGER_INTERVAL} more user messages`
        });
        
        return newCount;
      });
      
      // Cache the unified AI image to Firebase/localStorage
      try {
        await cacheAdventureImageHybrid(
          user?.uid || null,
          imageUrl,
          prompt,
          prompt, // Use prompt as context
          currentAdventureId || undefined
        );
        console.log('🔄 NEW: Unified AI image cached successfully');
      } catch (error) {
        console.warn('⚠️ NEW: Failed to cache unified AI image:', error);
      }
      
      // Add new comic panel with the generated image  
      const newPanel = {
        id: crypto.randomUUID(),
        image: imageUrl,
        text: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
        timestamp: Date.now()
      };
      
      console.log(`🎨 PANEL DEBUG: Adding new panel with image: ${imageUrl.substring(0, 60)}...`);
      addPanel(newPanel);
      
      // Completion sound is now handled by the unified streaming hook timeout
    },
    onResponseComplete: (response) => {
      console.log('✅ NEW: Unified AI response completed:', response);
    }
  });
  
  // Track when legacy system is running independently to avoid sync conflicts
  const [isLegacySystemRunning, setIsLegacySystemRunning] = React.useState(false);
  
  // Sync legacy loading state with unified system for UI consistency
  React.useEffect(() => {
    // 🛠️ CRITICAL FIX: Don't sync when legacy system is running independently
    if (isLegacySystemRunning) {
      console.log('🚫 SYNC BLOCKED: Legacy system is running independently, skipping sync');
      return;
    }
    
    console.log('🎯 🚨 CRITICAL SYNC: unifiedAIStreaming.isGeneratingImage changed from', isGeneratingAdventureImage, 'to', unifiedAIStreaming.isGeneratingImage);
    setIsGeneratingAdventureImage(unifiedAIStreaming.isGeneratingImage);
  }, [unifiedAIStreaming.isGeneratingImage, isGeneratingAdventureImage, isLegacySystemRunning]);

  // 🚨 CRITICAL SYNC: Monitor unified AI streaming state changes with detailed logging
  React.useEffect(() => {
    console.log('🚨 CRITICAL SYNC: unifiedAIStreaming.isGeneratingImage changed to:', unifiedAIStreaming.isGeneratingImage);
    if (unifiedAIStreaming.isGeneratingImage) {
      console.log('🎯 NEW MESSAGE: Current isGeneratingImage state: true');
    }
  }, [unifiedAIStreaming.isGeneratingImage]);

  const generateAIResponse = useCallback(async (userText: string, messageHistory: ChatMessage[], spellingQuestion: SpellingQuestion | null): Promise<AdventureResponse> => {

    try {
      // Load current chat summary from session (if available)
      let currentSummary: string | undefined = undefined;
      if (currentSessionId) {
        try {
          const sessionData = await adventureSessionService.getAdventureSession(currentSessionId);
          currentSummary = sessionData?.chatSummary?.summary;
          
          if (currentSummary) {
            console.log('🧠 Using chat summary for AI context:', currentSummary.substring(0, 100) + '...');
          }
        } catch (summaryError) {
          console.warn('⚠️ Could not load chat summary, continuing without it:', summaryError);
        }
      }

      console.log('🔍 Calling AI service with:', { userText, spellingQuestion, hasUserData: !!userData });
      
      const result = await aiService.generateResponse(
        userText, 
        messageHistory, 
        spellingQuestion, 
        userData,
        undefined, // adventureState
        undefined, // currentAdventure  
        undefined, // storyEventsContext
        currentSummary // summary
      );
      
      console.log('✅ AI service returned:', result);
      return result;
    } catch (error) {
      console.error('Error generating AI response:', error);
      // Fallback response on error
      return {
        spelling_sentence: spellingQuestion ? "Let's continue our amazing adventure!" : null,
        adventure_story: "That's interesting! 🤔 Tell me more about what happens next in your adventure!"
      };
    }
  }, [userData, currentSessionId]);

  // Legacy image generation fallback when unified system fails
  const handleLegacyImageFallback = useCallback(async (text: string, imageSubject?: string) => {
    console.log('🔄 LEGACY FALLBACK: Starting legacy image generation for failed unified request');
    
    // Double-check with keyword detection - only proceed if this is truly an image request
    const imageKeywords = ['create', 'make', 'generate', 'build', 'design', 'show me', 'what does', 'look like', 'i want to see', 'draw', 'picture', 'image'];
    const lowerText = text.toLowerCase();
    const hasImageKeywords = imageKeywords.some(keyword => lowerText.includes(keyword));
    
    if (!hasImageKeywords) {
      console.log('🚫 LEGACY FALLBACK: No image keywords detected, skipping legacy generation');
      return;
    }
    
    console.log('✅ LEGACY FALLBACK: Image keywords detected, proceeding with legacy generation');
    
    // 🧹 START AI SANITIZATION WITH TIMEOUT
    const originalPrompt = imageSubject || text;
    console.log('🧹 LEGACY FALLBACK: Starting AI prompt sanitization for:', originalPrompt.substring(0, 50) + '...');
    setSanitizationInProgress(true);
    
    // Extract adventure context for full sanitization
    const adventureContext = chatMessages.slice(-5).map(msg => `${msg.type}: ${msg.content}`).join('; ');
    
    // Start sanitization but with timeout - WAIT for result before proceeding 
    let sanitizationResult: any = null;
    try {
      console.log('🧹 LEGACY FALLBACK: Waiting for AI sanitization (max 8 seconds)...');
      const startTime = Date.now();
      
      sanitizationResult = await Promise.race([
        aiPromptSanitizer.sanitizePromptAndContext(originalPrompt, adventureContext),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('AI sanitization timeout')), 8000))
      ]);
      
      const elapsed = Date.now() - startTime;
      if (sanitizationResult) {
        console.log(`✅ AI Full Sanitization completed in ${elapsed}ms:`, sanitizationResult.sanitizedPrompt?.substring(0, 80) + '...');
        if (sanitizationResult.sanitizedContext) {
          console.log('✅ Adventure context also sanitized:', sanitizationResult.sanitizedContext.substring(0, 80) + '...');
        }
        setAiSanitizedPrompt(sanitizationResult);
      }
    } catch (error: any) {
      if (error.message === 'AI sanitization timeout') {
        console.error('⏰ AI sanitization timed out after 8 seconds - proceeding with legacy only');
      } else {
        console.error('❌ AI Full Sanitization failed:', error.message);
      }
      setAiSanitizedPrompt(null);
    } finally {
      setSanitizationInProgress(false);
    }
    
    try {
      // 🛠️ CRITICAL FIX: Mark legacy system as running to prevent sync interference
      setIsLegacySystemRunning(true);
      
      // Set loading state
      setIsGeneratingAdventureImage(true);
      
      // Use the imageSubject or the original text for image generation
      const imagePrompt = imageSubject || text;
      
      // Extract adventure context for caching
      const adventureContext = chatMessages.slice(-5).map(msg => msg.content).join(" ");
      
      console.log('🎨 LEGACY FALLBACK: Calling legacy aiService.generateAdventureImage()');
      
      // Use the fresh sanitizationResult instead of state (which might be stale)
      const finalSanitizedResult = sanitizationResult || aiSanitizedPrompt;
      
      // Debug sanitization state
      console.log('🧹 LEGACY DEBUG: finalSanitizedResult state:', finalSanitizedResult ? 'PRESENT' : 'NULL');
      if (finalSanitizedResult) {
        console.log('🧹 LEGACY DEBUG: sanitizedPrompt preview:', finalSanitizedResult.sanitizedPrompt?.substring(0, 100) + '...');
        console.log('🧹 LEGACY DEBUG: sanitizedContext preview:', finalSanitizedResult.sanitizedContext?.substring(0, 100) + '...');
        console.log('🧹 LEGACY DEBUG: sanitization success:', finalSanitizedResult.success);
      }
      
      const sanitizedResult = finalSanitizedResult ? {
        sanitizedPrompt: finalSanitizedResult.sanitizedPrompt,
        sanitizedContext: finalSanitizedResult.sanitizedContext
      } : undefined;
      
      console.log('🧹 LEGACY DEBUG: Passing sanitizedResult to generateAdventureImage:', sanitizedResult ? 'PRESENT' : 'UNDEFINED');
      
      const generatedImageResult = await aiService.generateAdventureImage(
        imagePrompt,
        chatMessages,
        "adventure scene",
        sanitizedResult,
        currentAdventureId || undefined
      );
      
      if (generatedImageResult) {
        // 🛡️ RACE CONDITION PREVENTION: Validate that this image is for the current adventure
        if (generatedImageResult.adventureId && generatedImageResult.adventureId !== currentAdventureId) {
          console.log(`🚫 IMAGE VALIDATION: Ignoring image from wrong adventure`, {
            imageAdventureId: generatedImageResult.adventureId,
            currentAdventureId: currentAdventureId,
            reason: 'adventure_mismatch'
          });
          return;
        }
        
        // Cache the generated adventure image
        await cacheAdventureImageHybrid(
          user?.uid || null,
          generatedImageResult.imageUrl,
          imagePrompt,
          adventureContext,
          currentAdventureId || undefined
        );
        
        // Generate contextual response text
        const contextualResponse = await aiService.generateAdventureImageResponse(
          imagePrompt,
          generatedImageResult.usedPrompt,
          chatMessages
        );
        
        // Create new panel with generated image
        const newPanelId = crypto.randomUUID();
        addPanel({ 
          id: newPanelId, 
          image: generatedImageResult.imageUrl, 
          text: contextualResponse
        });
        setNewlyCreatedPanelId(newPanelId);
        
        // Completion sound will be handled by individual systems (not unified)
        // For legacy fallback, this generates images immediately without loading delay
        playImageCompleteSound();
        
        console.log('✅ LEGACY FALLBACK: Successfully generated image and added panel');
        
        // Add AI message to chat with proper side effects (TTS, sounds, etc.)
        const userMessage: ChatMessage = {
          type: 'user',
          content: text,
          timestamp: Date.now()
        };
        
        const aiMessage: ChatMessage = {
          type: 'ai',
          content: `![Legacy Image](${generatedImageResult.imageUrl})\n\n${contextualResponse}`,
          timestamp: Date.now()
        };
        
        setChatMessages(prev => {
          const updatedMessages = [...prev, userMessage, aiMessage];
          
          // Trigger all the same side effects as regular AI messages
          setLastMessageCount(updatedMessages.length);
          playMessageSound();
          
          // Auto-speak the AI message (TTS)
          const messageId = `index-chat-${aiMessage.timestamp}-${prev.length + 1}`;
          ttsService.speakAIMessage(aiMessage.content, messageId).catch(error => 
            console.error('TTS error for legacy AI message:', error)
          );
          
          console.log('🔊 LEGACY FALLBACK: Triggered TTS for AI message');
          
          // Optional: Save AI message to Firebase session
          if (currentSessionId) {
            adventureSessionService.addChatMessage(currentSessionId, userMessage);
            adventureSessionService.addChatMessage(currentSessionId, aiMessage);
            
            // Check if we should generate a chat summary
            handleSummaryGeneration(currentSessionId, updatedMessages);
          }
          
          return updatedMessages;
        });
        
      } else {
        console.log('⚠️ LEGACY FALLBACK: Image generation failed, using fallback image');
        
        // Use fallback image
        const fallbackImage = images[Math.floor(Math.random() * images.length)];
        const newPanelId = crypto.randomUUID();
        
        addPanel({ 
          id: newPanelId, 
          image: fallbackImage, 
          text: "Your adventure continues with new mysteries..."
        });
        setNewlyCreatedPanelId(newPanelId);
      }
      
    } catch (error) {
      console.error('❌ LEGACY FALLBACK: Error in legacy image generation:', error);
      
      // Final fallback to random image
      const fallbackImage = images[Math.floor(Math.random() * images.length)];
      const newPanelId = crypto.randomUUID();
      
      addPanel({ 
        id: newPanelId, 
        image: fallbackImage, 
        text: "New adventure continues..."
      });
      setNewlyCreatedPanelId(newPanelId);
      
    } finally {
      // 🛠️ CRITICAL FIX: Always stop loading state in legacy fallback
      // The unified system has already failed, so we need to clear the loading state
      console.log('🔄 LEGACY FALLBACK: Clearing loading state in finally block');
      setIsGeneratingAdventureImage(false);
      
      // 🛠️ CRITICAL FIX: Mark legacy system as no longer running to re-enable sync
      setIsLegacySystemRunning(false);
    }
  }, [incrementMessageCycle, chatMessages, aiService, user?.uid, currentAdventureId, addPanel, images, playImageCompleteSound, setIsLegacySystemRunning]);



  // Generate new image panel based on context
  const onGenerateImage = useCallback(async (prompt?: string) => {
    try {
      // Count this as a user interaction for spellbox cycle
      incrementMessageCycle();
      
      // Set loading state and start loading sound
      setIsGeneratingAdventureImage(true);
      
      // Create AbortController for this generation
      imageGenerationController.current = new AbortController();
      
      playImageLoadingSound();
      
      // Use the prompt or generate from recent context
      const imagePrompt = prompt || 
          chatMessages.slice(-3).map(msg => msg.content).join(" ") || 
          "adventure with rocket";
        
        // Extract adventure context for caching
        const adventureContext = chatMessages.slice(-5).map(msg => msg.content).join(" ");
        
        // 🚫 DISABLED: Legacy image generation to prevent duplicates with unified system
        console.log('🚫 [Index.onGenerateImage()] Skipping legacy manual image generation - unified system handles this now');
        console.log('📝 [Index.onGenerateImage()] Requested prompt:', imagePrompt);
        const generatedImageResult = null;
        
        // ORIGINAL CODE (DISABLED):
        // const generatedImageResult = await aiService.generateAdventureImage(
        //   imagePrompt,
        //   chatMessages,
        //   "space adventure scene"
        // );
        
        let image: string;
        let panelText: string;
        
        // Cache the generated adventure image if it was successfully created
        if (generatedImageResult) {
          // Use Firebase caching if user is authenticated, fallback to localStorage
          await cacheAdventureImageHybrid(
            user?.uid || null,
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
      
      // Stop loading sound - completion sound handled by unified system timeout
      stopImageLoadingSound();
      // playImageCompleteSound(); // Removed - now handled by unified streaming hook
      // Stop loading animation only for automatic generation, not explicit requests
      // Also check that unified system is not actively generating
      if (!isExplicitImageRequest && !unifiedAIStreaming.isGeneratingImage) {
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
      // Also check that unified system is not actively generating
      if (!isExplicitImageRequest && !unifiedAIStreaming.isGeneratingImage) {
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
    }, [incrementMessageCycle, addPanel, images, chatMessages, currentAdventureId, isExplicitImageRequest]);

  // Add message directly to chat (for immediate feedback during transcription)
  const onAddMessage = useCallback((message: { type: 'user' | 'ai'; content: string; timestamp: number }) => {
    setChatMessages(prev => [...prev, message]);
  }, []);

  // Handle text messages and detect image generation requests
  const onGenerate = useCallback(
    async (text: string) => {
      
      // Check if the last message is "transcribing..." and replace it with actual transcription
      const lastMessage = chatMessages[chatMessages.length - 1];
      const shouldReplaceTranscribingMessage = lastMessage && 
        lastMessage.type === 'user' && 
        lastMessage.content === 'transcribing...';
      
      // NEW: Try unified AI system first (if available and ready)
      console.log('🔧 Unified system check:', {
        isUnifiedSystemReady,
        streamingIsReady: unifiedAIStreaming.isReady(),
        streamingState: {
          isStreaming: unifiedAIStreaming.isStreaming,
          error: unifiedAIStreaming.error
        }
      });
      
      // 🛠️ IMPROVED: Better handling of stuck streaming state
      if (unifiedAIStreaming.isStreaming) {
        console.log('⚠️ Unified system appears to be streaming');
        
        // 🔧 Check if this is a stuck state by looking for suspicious conditions
        const streamingTimeout = 30000; // 30 seconds max streaming time
        const lastMessageTime = chatMessages.length > 0 ? chatMessages[chatMessages.length - 1].timestamp : Date.now();
        const timeSinceLastMessage = Date.now() - lastMessageTime;
        
        if (timeSinceLastMessage > streamingTimeout) {
          console.log('🚨 STUCK STATE DETECTED: Streaming for too long, forcing reset');
          
          // Force abort the stuck stream
          try {
            unifiedAIStreaming.abortStream();
          } catch (abortError) {
            console.warn('Failed to abort stuck stream:', abortError);
          }
          
          // Small delay to let abort complete, then continue with new request
          await new Promise(resolve => setTimeout(resolve, 200));
          
          console.log('✅ Stuck state cleared, proceeding with new request');
        } else {
          // Normal case - actually streaming, ignore duplicate request
          console.log('⚠️ Valid streaming in progress - ignoring duplicate request');
          return;
        }
      }
      
      // Check if user is asking for image generation using intent-based detection
      const detectImageIntent = (text: string): boolean => {
        const lowerText = text.toLowerCase().trim();
        
        // 🛠️ CRITICAL: Always detect "create image:" format from button clicks
        if (lowerText.startsWith('create image:')) {
          console.log('✅ Detected "create image:" format from button click');
          return true;
        }
        
        // Direct image request patterns
        const directImagePatterns = [
          /\b(create|generate|make|draw|paint|sketch|show me|give me)\s+(an?\s+)?(image|picture|pic|photo|drawing|artwork|visual|illustration)/,
          /\b(can you|could you|please)\s+(create|generate|make|draw|show|give me)\s+(an?\s+)?(image|picture|pic)/,
          /\bi want\s+(an?\s+)?(image|picture|pic|photo|drawing)/,
          /\bshow me\s+(what|how)/,
          /\billustrate\s+(this|that|it)/,
          /\bvisualize\s+(this|that|it)/
        ];
        
        // Check for direct patterns first
        if (directImagePatterns.some(pattern => pattern.test(lowerText))) {
          return true;
        }
        
        // Standalone image-related words (only when they're the main intent)
        const standaloneImageWords = ['image', 'picture', 'pic', 'photo', 'drawing', 'artwork', 'illustration'];
        const isStandaloneImageRequest = standaloneImageWords.some(word => {
          const wordRegex = new RegExp(`\\b${word}\\b`);
          return wordRegex.test(lowerText) && lowerText.split(/\s+/).length <= 3; // Short requests only
        });
        
        if (isStandaloneImageRequest) {
          return true;
        }
        
        return false;
      };

      // Only use unified AI system for explicit image generation requests
      const isImageRequest = detectImageIntent(text);
      
      if (isImageRequest && isUnifiedSystemReady && unifiedAIStreaming.isReady()) {
        console.log('🎨 Using unified AI system for image generation request');
        console.log('📝 Image request message:', text);
        
        // Count this image request as a user interaction for spellbox cycle
        incrementMessageCycle();
        
        try {
          // Get current spelling question for context
          // Use selectedGradeFromDropdown if available, otherwise fall back to userData.gradeDisplayName
          const currentGrade = selectedGradeFromDropdown || userData?.gradeDisplayName;
          // NEW: Use topic-based question selection for Spellbox progression
          const currentSpellingQuestion = getNextSpellboxQuestion(currentGrade, completedSpellingIds);
          
          // Store the original spelling question (with prefilled data) for later use
          if (currentSpellingQuestion) {
            console.log('🔤 STORING ORIGINAL SPELLING QUESTION (UNIFIED):', {
              id: currentSpellingQuestion.id,
              word: currentSpellingQuestion.word,
              audio: currentSpellingQuestion.audio,
              actualSpellingWord: currentSpellingQuestion.audio,
              isPrefilled: currentSpellingQuestion.isPrefilled,
              prefilledIndexes: currentSpellingQuestion.prefilledIndexes
            });
            setOriginalSpellingQuestion(currentSpellingQuestion);
          }
          
          // Send message through unified system for image generation
          const unifiedResponse = await unifiedAIStreaming.sendMessage(
            text,
            chatMessages,
            currentSpellingQuestion
          );
          
          if (unifiedResponse && unifiedResponse.textContent) {
            console.log(`✅ Unified AI image response: ${unifiedResponse.hasImages ? 'with images' : 'text only'}`);
            
            // 🛠️ CRITICAL FIX: For image requests, only accept responses that actually contain images
            if (unifiedResponse.hasImages && unifiedResponse.imageUrls.length > 0) {
              // Add or replace user message
              const userMessage: ChatMessage = {
                type: 'user',
                content: text,
                timestamp: Date.now()
              };
              
              // Add AI message (no spelling properties for image responses)
              const aiMessage: ChatMessage = {
                type: 'ai', 
                content: unifiedResponse.textContent,
                timestamp: Date.now()
              };
              
              setChatMessages(prev => {
                if (shouldReplaceTranscribingMessage) {
                  // Replace the last "transcribing..." message with actual content
                  const newMessages = [...prev.slice(0, -1), userMessage, aiMessage];
                  setLastMessageCount(newMessages.length);
                  playMessageSound();
                  
                  // Auto-speak the AI message - delay for image responses to wait for loading to complete
                  const messageId = `index-chat-${aiMessage.timestamp}-${newMessages.length - 1}`;
                  // For image responses, delay TTS until after the 10-second loading period
                  setTimeout(() => {
                    ttsService.speakAIMessage(aiMessage.content, messageId);
                  }, 5000); // Match the delay timeout in unified streaming hook
                  
                  return newMessages;
                } else {
                  // Normal flow - add both messages
                  setLastMessageCount(prev.length + 2);
                  playMessageSound();
                  
                  // Auto-speak the AI message - delay for image responses to wait for loading to complete
                  const messageId = `index-chat-${aiMessage.timestamp}-${prev.length + 1}`;
                  // For image responses, delay TTS until after the 10-second loading period
                  setTimeout(() => {
                    ttsService.speakAIMessage(aiMessage.content, messageId);
                  }, 5000); // Match the delay timeout in unified streaming hook
                  
                  return [...prev, userMessage, aiMessage];
                }
              });
              
              // Save updated adventure
              saveUserAdventure([...chatMessages, userMessage, aiMessage]);
              
              // Note: Images are automatically handled by the onNewImage callback
              return; // Exit early - unified system handled image request WITH images
            } else {
              // Unified system returned text but NO IMAGES for an image request - fall back to legacy
              console.log('⚠️ Unified system returned text-only response for image request - falling back to legacy image generation');
              
              // Call legacy image generation with keyword detection
              await handleLegacyImageFallback(text);
              return; // Exit after legacy fallback
            }
          } else {
            // Unified system returned null - fall back to legacy image generation
            console.log('⚠️ Unified system returned null for image request - falling back to legacy image generation');
            
            // Call legacy image generation with keyword detection
            await handleLegacyImageFallback(text);
            return; // Exit after legacy fallback
          }
          
        } catch (unifiedError) {
          // Handle aborted requests gracefully (don't show as errors)
          if (unifiedError instanceof Error && unifiedError.name === 'APIUserAbortError') {
            console.log('ℹ️ Image request was aborted (new message sent)');
            return; // Exit quietly, don't fall through to legacy system
          }
          
          console.error('❌ Unified system failed for image request, falling back to legacy:', unifiedError);
          
          // Call legacy image generation with keyword detection
          await handleLegacyImageFallback(text);
          return; // Exit after legacy fallback
        }
      }
      
      // REGULAR AI SYSTEM: Use legacy system for all non-image requests (including spelling)
      console.log('📝 Using regular AI system for text/spelling responses');
      
      // Note: isImageRequest is already declared above
      
      // Add user message
      const userMessage: ChatMessage = {
        type: 'user',
        content: text,
        timestamp: Date.now()
      };
      
      // Add user message immediately with sound (or replace transcribing message)
      setChatMessages(prev => {
        if (shouldReplaceTranscribingMessage) {
          // Replace the last "transcribing..." message with actual content
          const newMessages = [...prev.slice(0, -1), userMessage];
          setLastMessageCount(newMessages.length);
          playMessageSound();
          return newMessages;
        } else {
          // Normal flow - add user message
          setLastMessageCount(prev.length + 1);
          playMessageSound();
          return [...prev, userMessage];
        }
      });

      // Optional: Save user message to Firebase session (non-blocking)
      if (currentSessionId) {
        adventureSessionService.addChatMessage(currentSessionId, userMessage);
      }

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
          // NOTE: Old automatic generation pause logic removed - now handled by unified AI system
          
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
          
          // 🚫 DISABLED: Legacy user-based image generation to prevent duplicates with unified system
          console.log('🚫 Skipping legacy user-based image generation - unified system handles this now');
          const generatedImageResult = null;
          
          // ORIGINAL CODE (DISABLED):
          // const generatedImageResult = await aiService.generateAdventureImage(
          //   imageSubject || text,
          //   chatMessages,
          //   "space adventure scene"
          // );
          
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
            // Only stop if unified system is not actively generating
            if (!unifiedAIStreaming.isGeneratingImage) {
              setIsGeneratingAdventureImage(false);
            }
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
          // Only stop if unified system is not actively generating
          if (!unifiedAIStreaming.isGeneratingImage) {
            setIsGeneratingAdventureImage(false);
          }
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
        
        // Implement 3-3 pattern: 3 pure adventure messages, then 3 with spelling questions
        const isSpellingPhase = messageCycleCount >= 3; // Messages 3, 4, 5 have spelling
        // Use selectedGradeFromDropdown if available, otherwise fall back to userData.gradeDisplayName
        const currentGrade = selectedGradeFromDropdown || userData?.gradeDisplayName;
        console.log(`🎓 Spelling question grade selection - selectedGradeFromDropdown: ${selectedGradeFromDropdown}, userData.gradeDisplayName: ${userData?.gradeDisplayName}, using: ${currentGrade}`);
        
        // Additional debug info
        const savedGradeFromStorage = loadGradeSelection();
        console.log(`💾 Grade from localStorage: ${savedGradeFromStorage?.gradeDisplayName || 'none'}`);
        console.log(`🔥 Grade from Firebase: ${userData?.gradeDisplayName || 'none'}`);
        // NEW: Use topic-based question selection for Spellbox progression
        const spellingQuestion = isSpellingPhase ? getNextSpellboxQuestion(currentGrade, completedSpellingIds) : null;
        
        // Store the original spelling question (with prefilled data) for later use
        if (spellingQuestion) {
          console.log('🔤 STORING ORIGINAL SPELLING QUESTION:', {
            id: spellingQuestion.id,
            word: spellingQuestion.word,
            audio: spellingQuestion.audio,
            actualSpellingWord: spellingQuestion.audio,
            isPrefilled: spellingQuestion.isPrefilled,
            prefilledIndexes: spellingQuestion.prefilledIndexes
          });
          setOriginalSpellingQuestion(spellingQuestion);
        }
        
        console.log(`🔄 Message cycle: ${messageCycleCount}/6, Phase: ${isSpellingPhase ? '📝 SPELLING' : '🏰 ADVENTURE'} (${messageCycleCount < 3 ? 'Pure Adventure' : 'Spelling Questions'})`);
        
        const aiResponse = await generateAIResponse(text, currentMessages, spellingQuestion);
        
        // Update cycle count and reset after 6 messages (3 adventure + 3 spelling)
        // Note: We increment AFTER storing the original question and generating AI response
        incrementMessageCycle();
        
        // First, add the spelling sentence message if we have one
        if (aiResponse.spelling_sentence && spellingQuestion) {
          console.log('📝 Creating spelling message:', {
            spellingWord: spellingQuestion.audio,
            spellingSentence: aiResponse.spelling_sentence,
            adventureStory: aiResponse.adventure_story,
            wordInSentence: aiResponse.spelling_sentence.toLowerCase().includes(spellingQuestion.audio.toLowerCase())
          });
          
          const spellingSentenceMessage: ChatMessage = {
            type: 'ai',
            content: aiResponse.spelling_sentence,
            timestamp: Date.now(),
            spelling_word: spellingQuestion.audio,
            spelling_sentence: aiResponse.spelling_sentence,
            content_after_spelling: aiResponse.adventure_story, // Store the adventure story for later
            hiddenInChat: true
          };
          
          setChatMessages(prev => {
            setLastMessageCount(prev.length + 1);
            playMessageSound();
            // Auto-speak the spelling sentence
            const messageId = `index-chat-${spellingSentenceMessage.timestamp}-${prev.length}`;
            ttsService.speakAIMessage(spellingSentenceMessage.content, messageId).catch(error => 
              console.error('TTS error for spelling sentence:', error)
            );
            return [...prev, spellingSentenceMessage];
          });

          // The SpellBox will automatically appear due to the useEffect hook that watches for spelling_word
          // After successful completion, handleSpellComplete will be called

          // Save message to Firebase session if available
          if (currentSessionId) {
            adventureSessionService.addChatMessage(currentSessionId, spellingSentenceMessage);
          }
          return;
        }
        
        // For pure adventure messages (no spelling), just add the adventure story
        const aiMessage: ChatMessage = {
          type: 'ai',
          content: aiResponse.adventure_story,
          timestamp: Date.now(),
          spelling_sentence: null,
          spelling_word: undefined
        };
        
        setChatMessages(prev => {
          const updatedMessages = [...prev, aiMessage];
          
          setLastMessageCount(prev.length + 1);
          playMessageSound();
          // Auto-speak the AI message and wait for completion
          const messageId = `index-chat-${aiMessage.timestamp}-${prev.length}`;
          ttsService.speakAIMessage(aiMessage.content, messageId).catch(error => 
            console.error('TTS error for AI message:', error)
          );
          
          // Optional: Save AI message to Firebase session and check for summary generation (non-blocking)
          if (currentSessionId) {
            adventureSessionService.addChatMessage(currentSessionId, aiMessage);
            
            // Check if we should generate a chat summary (every 2 messages)
            handleSummaryGeneration(currentSessionId, updatedMessages);
          }
          
          return updatedMessages;
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
    [incrementMessageCycle, generateAIResponse, chatMessages, currentScreen, adventurePromptCount, topicQuestionIndex, isInQuestionMode, currentSessionId, messageCycleCount]
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

  // Optional: Sync adventure state changes to Firebase session (non-blocking)
  React.useEffect(() => {
    if (currentSessionId && user) {
      adventureSessionService.updateAdventureState(currentSessionId, {
        isInQuestionMode,
        adventurePromptCount
      });
    }
  }, [currentSessionId, isInQuestionMode, adventurePromptCount, user]);

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

  // Handle chat summary generation (every 2 messages)
  const handleSummaryGeneration = useCallback(async (sessionId: string, currentMessages: ChatMessage[]) => {
    try {
      // Get current session data to check summary state
      const sessionData = await adventureSessionService.getAdventureSession(sessionId);
      if (!sessionData) {
        console.warn('No session data found for summary generation');
        return;
      }

      // Check if we should generate a summary
      const shouldGenerate = chatSummaryService.shouldGenerateSummary(
        currentMessages.length,
        sessionData.lastSummaryMessageCount
      );

      if (!shouldGenerate) {
        return; // Not time for summary yet
      }

      console.log(`🧠 Generating chat summary (${currentMessages.length} messages total)`);

      // Get recent messages for summarization (typically last 2-4 messages)
      const messagesToSummarize = currentMessages.slice(-4); // Last 4 messages for context
      
      // Get previous summary if it exists
      const previousSummary = sessionData.chatSummary?.summary;
      
      // Generate new summary
      const newSummaryText = await chatSummaryService.generateChatSummary(
        messagesToSummarize,
        previousSummary,
        { 
          adventureMode: sessionData.adventureMode,
          topicId: sessionData.topicId,
          isInQuestionMode: sessionData.isInQuestionMode
        }
      );

      // Create summary object with metadata
      const summaryObject = chatSummaryService.createSummaryObject(
        newSummaryText,
        currentMessages.length,
        currentMessages[currentMessages.length - 1]?.timestamp || Date.now()
      );

      // Save summary to Firebase (non-blocking)
      adventureSessionService.updateChatSummary(sessionId, summaryObject);
      
      console.log('✅ Chat summary generated and saved');
      
    } catch (error) {
      console.warn('⚠️ Failed to generate chat summary (continuing normally):', error);
      // Don't throw - summary generation is non-critical
    }
  }, []);

  // Save current adventure when user creates significant content
  const saveCurrentAdventure = React.useCallback(async () => {
    if (!currentAdventureId || chatMessages.length < 3) return;
    
    try {
      const adventureName = await generateAdventureName(chatMessages);
      const adventureSummary = await generateAdventureSummary(chatMessages);
      
      // Get the current comic panel image if available (but don't use default images)
      let currentPanelImage = panels[currentIndex]?.image;
      
      // Helper function to check if image is default/local (defined here for reuse below)
      const isDefaultOrLocalImage = (imageUrl: string): boolean => {
        // Check for local asset paths
        if (imageUrl.startsWith('/src/assets/') || imageUrl.includes('comic-rocket-1.jpg') || 
            imageUrl.includes('comic-spaceport-2.jpg') || imageUrl.includes('comic-alienland-3.jpg') || 
            imageUrl.includes('comic-cockpit-4.jpg')) {
          return true;
        }
        
        // Check for relative paths or paths without http/https (local assets)
        if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://') && 
            !imageUrl.startsWith('data:')) {
          return true;
        }
        
        return false;
      };
      
      // Don't use default images for comicPanelImage
      if (currentPanelImage && isDefaultOrLocalImage(currentPanelImage)) {
        currentPanelImage = undefined;
      }
      
      // Only save panels with generated images (not default local assets)
      const generatedPanels = panels.filter(panel => !isDefaultOrLocalImage(panel.image));
      
      console.log(`💾 SAVE DEBUG: Saving adventure with ${panels.length} total panels, ${generatedPanels.length} generated panels`);
      panels.forEach((panel, index) => {
        const isDefault = isDefaultOrLocalImage(panel.image);
        console.log(`💾 Panel ${index} ${isDefault ? '[SKIPPED - DEFAULT]' : '[SAVING]'}: ${panel.image.substring(0, 60)}...`);
      });
      
      const adventure: SavedAdventure = {
        id: currentAdventureId,
        name: adventureName,
        summary: adventureSummary,
        messages: chatMessages,
        createdAt: Date.now(),
        lastPlayedAt: Date.now(),
        comicPanelImage: currentPanelImage,
        topicId: selectedTopicId,
        comicPanels: generatedPanels // Only save generated panels, not default images
      };
      
      // Save to Firebase (with localStorage fallback) if user is authenticated
      if (user?.uid) {
        await saveAdventureHybrid(user.uid, adventure);
      } else {
        saveAdventure(adventure);
      }
      
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
      
      // Note: Adventure summaries are automatically updated when the full adventure is saved to Firebase
      // Only update localStorage summaries as a backup
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
  const handleContinueSpecificAdventure = React.useCallback(async (adventureId: string) => {
    playClickSound();
    
    // Load the specific adventure from Firebase (with localStorage fallback)
    const savedAdventures = await loadAdventuresHybrid(user?.uid || null);
    const targetAdventure = savedAdventures.find(adv => adv.id === adventureId);
    
    if (targetAdventure) {
      console.log(`🔄 RESTORATION DEBUG: Loading adventure "${targetAdventure.name}" with ID: ${adventureId}`);
      
      // Get cached images for this adventure to find the latest generated image from Firebase
      const cachedImages = user ? await getCachedImagesForAdventureFirebase(user.uid, adventureId) : getCachedImagesForAdventure(adventureId);
      const latestCachedImage = cachedImages.length > 0 ? cachedImages[0] : null; // First item is most recent (sorted by timestamp)
      
      console.log(`🔄 RESTORATION DEBUG: Found ${cachedImages.length} cached images for this adventure`);
      if (cachedImages.length > 0) {
        console.log('🔄 RESTORATION DEBUG: Cached images:', cachedImages.map(img => ({
          url: img.url.substring(0, 50) + '...',
          prompt: img.prompt?.substring(0, 30) + '...',
          adventureId: img.adventureId
        })));
      }
      
      // Restore comic panels from saved adventure if available
      if (targetAdventure.comicPanels && targetAdventure.comicPanels.length > 0) {
        console.log(`🔄 RESTORATION DEBUG: Found ${targetAdventure.comicPanels.length} saved comic panels`);
        targetAdventure.comicPanels.forEach((panel, index) => {
          console.log(`🔄 PANEL ${index}:`, {
            image: panel.image.substring(0, 50) + '...',
            text: panel.text.substring(0, 30) + '...',
            isExpiredDalle: panel.image.includes('oaidalleapiprodscus.blob.core.windows.net'),
            isHttps: panel.image.startsWith('https://'),
            isLocal: panel.image.startsWith('/') || !panel.image.includes('http')
          });
        });
        // Helper function to check if a URL is an expired DALL-E URL
        const isExpiredDalleUrl = (url: string): boolean => {
          return url.includes('oaidalleapiprodscus.blob.core.windows.net') && 
                 (url.includes('st=') || url.includes('se=') || url.includes('sig='));
        };

        // Default fallback images in order of preference
        const defaultImages = [
          rocket1, // imported at top of file
          spaceport2, // imported at top of file
          alien3, // imported at top of file
          '/src/assets/comic-cockpit-4.jpg' // TODO: import this one too
        ];

        // SIMPLIFIED: Check if we have cached images and restore them if the URLs are no longer available
        const restoredPanels = targetAdventure.comicPanels.map((panel, index) => {
          let imageToUse = panel.image;
          let restorationMethod = 'original';
          
          console.log(`🔄 RESTORING PANEL ${index}: ${panel.text.substring(0, 30)}...`);
          console.log(`🔄 Original image URL: ${panel.image.substring(0, 60)}...`);
          
          // If image is an expired DALL-E URL or looks like a temporary URL, try to find better alternatives
          // BUT KEEP Firebase URLs as they are permanent
          const isFirebaseUrl = panel.image.includes('firebasestorage.googleapis.com');
          const isLocalUrl = panel.image.startsWith('/') || !panel.image.includes('http');
          const needsRestoration = !isFirebaseUrl && !isLocalUrl && (
            isExpiredDalleUrl(panel.image) || 
            panel.image.includes('oaidalleapiprodscus.blob.core.windows.net') ||
            (panel.image.startsWith('https://') && panel.image.includes('dalle'))
          );
          
          console.log(`🔄 URL Analysis: Firebase=${isFirebaseUrl}, Local=${isLocalUrl}, NeedsRestoration=${needsRestoration}`);
          
          if (needsRestoration) {
            console.log(`🔄 Panel ${index} needs restoration (expired/temporary URL)`);
            
            // Method 1: Try to find any cached Firebase image for this adventure (simplified matching)
            if (cachedImages.length > 0) {
              // Use the most recent cached image if we have any
              const cachedImage = cachedImages[Math.min(index, cachedImages.length - 1)];
              
              if (cachedImage && cachedImage.url !== panel.image) {
                imageToUse = cachedImage.url;
                restorationMethod = 'firebase_cached';
                console.log(`✅ Restored cached image for panel ${index}: ${cachedImage.url.substring(0, 60)}...`);
              } else {
                // Method 2: Use default fallback
                const fallbackIndex = index % defaultImages.length;
                imageToUse = defaultImages[fallbackIndex];
                restorationMethod = 'default_fallback';
                console.log(`📸 Using default fallback image for panel ${index}: ${imageToUse}`);
              }
            } else {
              // Method 2: Use default fallback
              const fallbackIndex = index % defaultImages.length;
              imageToUse = defaultImages[fallbackIndex];
              restorationMethod = 'default_fallback';
              console.log(`📸 No cached images found, using default fallback for panel ${index}: ${imageToUse}`);
            }
          } else {
            console.log(`✅ Panel ${index} keeping original image (valid URL)`);
          }
          
          return {
            ...panel,
            image: imageToUse,
            restorationMethod // For debugging
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
        
        console.log('🔄 FINAL RESTORATION SUMMARY:');
        restoredPanels.forEach((panel, index) => {
          console.log(`📋 Panel ${index}: ${panel.restorationMethod} - Image: ${panel.image.substring(0, 60)}...`);
        });
        
        reset(restoredPanels);
        console.log(`✅ Restored ${restoredPanels.length} comic panels for adventure: ${targetAdventure.name}`);
      } else {
        // No saved panels - create initial panel with latest generated image or default
        let initialPanelImage = rocket1; // default
        let initialPanelText = "The brave astronaut climbs into ROCKET!"; // default text
        
        if (latestCachedImage) {
          initialPanelImage = latestCachedImage.url;
          initialPanelText = "Your adventure continues...";

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
      const topicId = targetAdventure.topicId || getNextTopic(Object.keys(sampleMCQData.topics)) || '';
      setSelectedTopicId(topicId);
      setAdventureMode('continue');
      
      // Set adventure context for contextual AI responses
      setCurrentAdventureContext({
        name: targetAdventure.name,
        summary: targetAdventure.summary
      });
      
      // Reset the initial response ref when starting a new adventure
      initialResponseSentRef.current = null;
      
      // Optional Firebase session creation for specific adventure with existing messages (non-blocking)
      if (user) {
        const sessionId = await adventureSessionService.createAdventureSession(
          user.uid,
          'continue_specific',
          targetAdventure.id,
          topicId,
          'continue',
          targetAdventure.name,
          targetAdventure.messages // Pass existing messages for AI context
        );
        setCurrentSessionId(sessionId);
      }
      
      setCurrentScreen(1); // Go to adventure screen
    } else {
      // Fallback if adventure not found
      handleStartAdventure(getNextTopic(Object.keys(sampleMCQData.topics)) || '', 'continue');
    }
  }, [reset, initialPanels, user]);

  // Handle start adventure from progress tracking
  const handleStartAdventure = React.useCallback(async (topicId: string, mode: 'new' | 'continue' = 'new') => {
    playClickSound();
    setSelectedTopicId(topicId);
    setAdventureMode(mode);
    // Reset the initial response ref when starting a new adventure
    initialResponseSentRef.current = null;
    
    let adventureId: string;
    
    if (mode === 'new') {
      // Clear chat messages for new adventures to provide clean slate
      setChatMessages([]);
      // Reset message cycle count for new adventure
      setMessageCycleCount(0);
      // Generate new adventure ID
      adventureId = crypto.randomUUID();
      setCurrentAdventureId(adventureId);
      // Reset comic panels to default image for new adventures
      reset(initialPanels);
      
      // Clear adventure context for new adventures
      setCurrentAdventureContext(null);
      
      // Reset question flow state for new adventures
      setTopicQuestionIndex(0);
      setIsInQuestionMode(false);
      setAdventurePromptCount(0);
      setCanAccessQuestions(false);
      setIsRetryMode(false);
      setRetryQuestionIndex(0);
      
      // Complete adventure tutorial for first-time users
      if (isFirstTimeAdventurer) {
        completeAdventureTutorial();
        console.log('🎓 Completed adventure tutorial for first-time user');
      }
      
      console.log('🚀 Started new adventure with default rocket image and reset all flow states');
    } else {
      // For continuing, keep existing adventure ID or create new one
      adventureId = currentAdventureId || crypto.randomUUID();
      if (!currentAdventureId) {
        setCurrentAdventureId(adventureId);
      }
    }
    
    // Optional Firebase session creation (non-blocking)
    if (user) {
      const sessionId = await adventureSessionService.createAdventureSession(
        user.uid,
        mode === 'new' ? 'new_adventure' : 'continue_adventure',
        adventureId,
        topicId,
        mode
      );
      setCurrentSessionId(sessionId);
    }
    
    setCurrentScreen(1); // Go to adventure screen first to show AI response
  }, [currentAdventureId, reset, initialPanels, user]);

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
      // Save grade selection to localStorage for persistence
      saveGradeSelection(gradeDisplayName);
      // Track the combined grade and level selection for highlighting
      setSelectedGradeAndLevel({ grade: gradeDisplayName, level });
    }
    
    // Get all available topic IDs from MCQ data in order
    const allTopicIds = Object.keys(sampleMCQData.topics);
    
    // Save preference and get the specific topic immediately
    const specificTopic = saveTopicPreference(level, allTopicIds, gradeDisplayName);
    
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
          
          // Save to Firebase (with localStorage fallback) if user is authenticated
          if (user?.uid) {
            // Don't await in beforeunload handler - just trigger the save
            saveAdventureHybrid(user.uid, adventure);
          } else {
            saveAdventure(adventure);
          }
        } catch (error) {
          console.warn('Failed to save adventure on unload:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [chatMessages, currentAdventureId, panels, currentIndex, selectedTopicId]);



  const current = panels[currentIndex] ?? initialPanels[0];

  // Auto image generation based on adventure summary + last 3 messages
  const [isAutoImageGenerationActive, setIsAutoImageGenerationActive] = useState(true);
  const [lastAutoImageMessageCount, setLastAutoImageMessageCount] = useState(0);
  const AUTO_IMAGE_TRIGGER_INTERVAL = 4; // Generate image every 4 user messages
  
  

  // Reset auto image counter when adventure changes - smart reset based on adventure mode
  React.useEffect(() => {
    console.log(`🔄 ADVENTURE CHANGE DETECTED - Smart counter reset`);
    console.log(`🔄 Previous lastAutoImageMessageCount:`, lastAutoImageMessageCount);
    console.log(`🔄 New currentAdventureId:`, currentAdventureId);
    console.log(`🔄 Adventure mode:`, adventureMode);
    
    // Smart reset: only reset to 0 for new adventures, for loaded adventures set to current user message count
    const currentUserMessageCount = chatMessages.filter(msg => msg.type === 'user').length;
    
    // 🧹 CLEANUP: Clear any ongoing image generation from previous adventure
    if (imageGenerationController.current) {
      console.log('🔄 ADVENTURE SWITCH CLEANUP: Clearing previous image generation');
      imageGenerationController.current = null;
    }
    // Reset image generation state unless unified system is active
    if (!unifiedAIStreaming.isGeneratingImage) {
      setIsGeneratingAdventureImage(false);
    }
    setIsExplicitImageRequest(false);
    
    if (adventureMode === 'new') {
      console.log(`🔄 NEW ADVENTURE: Setting counter to current user message count (${currentUserMessageCount}) to prevent immediate auto-generation`);
      setLastAutoImageMessageCount(currentUserMessageCount);
    } else if (adventureMode === 'continue') {
      console.log(`🔄 LOADED ADVENTURE: Setting counter to current user message count (${currentUserMessageCount}) to prevent immediate auto-generation`);
      setLastAutoImageMessageCount(currentUserMessageCount);
    } else {
      // Fallback to current behavior for undefined modes
      console.log(`🔄 UNKNOWN MODE: Using fallback reset to 0`);
      setLastAutoImageMessageCount(0);
    }
  }, [currentAdventureId, adventureMode]); // Reset when adventure ID or mode changes


   // Get recent AI messages for auto image generation
   const getRecentAIMessages = useCallback(() => {
    const aiMessages = chatMessages
      .filter(msg => msg.type === 'ai')
      .slice(-5)
      .map(msg => msg.content.substring(0, 150))
      .join(' | ');
    return aiMessages;
  }, [chatMessages]);

  // Additional reset when chat is cleared or screen changes (safety net)
  React.useEffect(() => {
    const userMessageCount = chatMessages.filter(msg => msg.type === 'user').length;
    
    // If we have very few messages but high counter, something went wrong - reset
    // Also reset if counter is higher than total user messages (stale state)
    if ((userMessageCount < 3 && lastAutoImageMessageCount > 0) || 
        (lastAutoImageMessageCount > userMessageCount)) {
      console.log(`🔄 SAFETY RESET - ${lastAutoImageMessageCount > userMessageCount ? 'Stale counter detected' : 'Chat cleared or new adventure started'}`);
      console.log(`🔄 userMessageCount: ${userMessageCount}, lastAutoImageMessageCount: ${lastAutoImageMessageCount}`);
      setLastAutoImageMessageCount(0);
    }
  }, [chatMessages.length, currentScreen]); // Reset when messages or screen change

 

  // Auto image generation function using adventure summary + last 3 messages
  const generateAutoImage = useCallback(async () => {
    try {
      console.log(`🎨 [generateAutoImage()] === STARTING GENERATION PROCESS ===`);
      console.log(`🎨 [generateAutoImage()] Function called at:`, new Date().toISOString());
      
      // 🔍 CRITICAL: Add stack trace to see where this is being called from
      console.log(`🔍 [generateAutoImage()] CALL STACK:`, new Error().stack?.split('\n').slice(1, 4).join('\n'));
      
      // 🛡️ ABSOLUTE OVERRIDE: Block ALL auto generation if unified/legacy system has recent activity
      const hasRecentUnifiedActivity = unifiedAIStreaming.lastResponse && 
        (Date.now() - unifiedAIStreaming.lastResponse.timestamp < 10000); // 10 seconds
      
      const hasRecentLegacyImage = chatMessages.some(msg => 
        msg.type === 'ai' && 
        msg.content?.includes('![Legacy Image]') &&
        (Date.now() - (msg.timestamp || 0)) < 5000 // Within last 5 seconds
      );
      
      console.log(`🔍 [generateAutoImage()] ABSOLUTE COORDINATION CHECK:`, {
        isUnifiedSessionActive: unifiedAIStreaming.isUnifiedSessionActive,
        isStreaming: unifiedAIStreaming.isStreaming,
        isGeneratingImage: unifiedAIStreaming.isGeneratingImage,
        hasRecentUnifiedActivity: hasRecentUnifiedActivity,
        hasRecentLegacyImage: hasRecentLegacyImage,
        lastResponseTimestamp: unifiedAIStreaming.lastResponse?.timestamp,
        timeSinceLastResponse: unifiedAIStreaming.lastResponse ? Date.now() - unifiedAIStreaming.lastResponse.timestamp : 'N/A',
        currentAdventureId: currentAdventureId,
        chatMessagesLength: chatMessages.length
      });
      
      // 🚫 ABSOLUTE BLOCK: If unified system is active OR legacy system recently ran, don't generate
      if (unifiedAIStreaming.isUnifiedSessionActive || 
          unifiedAIStreaming.isStreaming || 
          unifiedAIStreaming.isGeneratingImage || 
          hasRecentUnifiedActivity ||
          hasRecentLegacyImage) {
        console.log(`🚫 [generateAutoImage()] ABSOLUTE BLOCK - Unified/Legacy system active or recent activity detected`);
        console.log(`🚫 [generateAutoImage()] Blocking reason:`, {
          isUnifiedSessionActive: unifiedAIStreaming.isUnifiedSessionActive,
          isStreaming: unifiedAIStreaming.isStreaming,
          isGeneratingImage: unifiedAIStreaming.isGeneratingImage,
          hasRecentUnifiedActivity: hasRecentUnifiedActivity,
          hasRecentLegacyImage: hasRecentLegacyImage,
          blockingSystem: hasRecentLegacyImage ? 'legacy' : 'unified'
        });
        return; // Exit without generating
      }
      
      console.log(`✅ [generateAutoImage()] ABSOLUTE COORDINATION PASSED - Safe to proceed with generation`);
      
      // Get current adventure summary from session
      let adventureSummary = '';
      console.log(`🎨 AUTO IMAGE: Current session ID:`, currentSessionId);
      
      if (currentSessionId) {
        try {
          console.log(`🎨 AUTO IMAGE: Fetching session data...`);
          const sessionData = await adventureSessionService.getAdventureSession(currentSessionId);
          adventureSummary = sessionData?.chatSummary?.summary || '';
          
          console.log(`🎨 AUTO IMAGE: Session data retrieved:`, {
            hasSessionData: !!sessionData,
            hasSummary: !!sessionData?.chatSummary?.summary,
            summaryLength: adventureSummary.length,
            summaryPreview: adventureSummary.substring(0, 100) + '...'
          });
        } catch (error) {
          console.warn('⚠️ AUTO IMAGE: Could not load adventure summary for auto image generation:', error);
        }
      } else {
        console.log(`❌ AUTO IMAGE: No currentSessionId available`);
      }
      
      // Get last 30 user messages for recent context
      const userMessages = chatMessages.filter(msg => msg.type === 'user');
      const lastThirtyMessages = userMessages.slice(-30).map(msg => msg.content).join(' ');
      
      // Get recent AI messages
      const recentAIMessages = getRecentAIMessages();
      
      console.log(`🎨 AUTO IMAGE: Message analysis:`, {
        totalChatMessages: chatMessages.length,
        totalUserMessages: userMessages.length,
        lastThirtyUserMessages: userMessages.slice(-30).map(msg => msg.content),
        combinedLastThirty: lastThirtyMessages,
        recentAIMessages: recentAIMessages.substring(0, 100) + '...'
      });
      
      // Create enhanced prompt combining all contexts
      const combinedContext = adventureSummary 
        ? `Adventure so far: ${adventureSummary}. Recent user events: ${lastThirtyMessages}. Recent AI responses: ${recentAIMessages}`
        : `Recent user events: ${lastThirtyMessages}. Recent AI responses: ${recentAIMessages}`;
      
      console.log(`🎨 AUTO IMAGE: Final combined context:`, {
        length: combinedContext.length,
        hasAdventureSummary: !!adventureSummary,
        preview: combinedContext.substring(0, 200) + '...',
        fullContext: combinedContext
      });
      
      // 🎯 NEW: Final check before generation - unified system might have become active
      if (unifiedAIStreaming.isUnifiedSessionActive) {
        console.log('🚫 AUTO IMAGE: CANCELLED - Unified session became active during setup, aborting automatic generation');
        console.log('🔍 AUTO IMAGE COORDINATION: Session state at cancellation:', {
          isUnifiedSessionActive: unifiedAIStreaming.isUnifiedSessionActive,
          isStreaming: unifiedAIStreaming.isStreaming,
          isGeneratingImage: unifiedAIStreaming.isGeneratingImage,
          reason: 'unified_session_took_priority_during_setup'
        });
        return;
      }
      
      // Re-enabled legacy auto image generation since unified system is not integrated yet
      console.log(`🎨 AUTO IMAGE: Calling aiService.generateAdventureImage()...`);
      console.log(`🎨 AUTO IMAGE: Parameters:`, {
        prompt: combinedContext,
        chatMessagesLength: chatMessages.length,
        fallbackPrompt: "adventure scene"
      });
      
      const generatedImageResult = await aiService.generateAdventureImage(
        combinedContext,
        chatMessages,
        "adventure scene",
        undefined,
        currentAdventureId || undefined
      );
      
      console.log(`🎨 AUTO IMAGE: Generation result:`, {
        hasResult: !!generatedImageResult,
        imageUrl: generatedImageResult?.imageUrl?.substring(0, 50) + '...',
        usedPrompt: generatedImageResult?.usedPrompt?.substring(0, 100) + '...'
      });
      
      if (!generatedImageResult) {
        console.log('❌ AUTO IMAGE: Generation failed, skipping this cycle');
        return;
      }
      
      // 🛡️ RACE CONDITION PREVENTION: Validate that this image is for the current adventure
      if (generatedImageResult.adventureId && generatedImageResult.adventureId !== currentAdventureId) {
        console.log(`🚫 AUTO IMAGE VALIDATION: Ignoring image from wrong adventure`, {
          imageAdventureId: generatedImageResult.adventureId,
          currentAdventureId: currentAdventureId,
          reason: 'adventure_mismatch'
        });
        return;
      }
      
      let image: string;
      let panelText: string;
      
      // Use Firebase caching if user is authenticated and wait for permanent URL
      if (user?.uid) {
        try {
          const permanentUrl = await cacheAdventureImageHybrid(
            user.uid,
            generatedImageResult.imageUrl,
            combinedContext,
            combinedContext,
            currentAdventureId || undefined
          );
          
          // Use the permanent Firebase URL if caching succeeded
          if (permanentUrl && permanentUrl !== generatedImageResult.imageUrl) {
            image = permanentUrl;
            console.log(`🔄 Using permanent Firebase URL instead of temporary DALL-E URL`);
          } else {
            image = generatedImageResult.imageUrl;
            console.log(`⚠️ Using temporary DALL-E URL (Firebase caching may have failed)`);
          }
        } catch (cacheError) {
          console.warn('⚠️ Failed to cache auto-generated image:', cacheError);
          image = generatedImageResult.imageUrl; // Fallback to original URL
        }
      } else {
        // User not authenticated, use temporary URL
        image = generatedImageResult.imageUrl;
        console.log(`⚠️ Using temporary DALL-E URL (user not authenticated)`);
      }
      
      // Generate contextual response text based on actual generated content
      try {
        const contextualResponse = await aiService.generateAdventureImageResponse(
          combinedContext,
          generatedImageResult.usedPrompt,
          chatMessages
        );
        panelText = contextualResponse;
      } catch (responseError) {
        console.warn('⚠️ Failed to generate contextual response, using fallback:', responseError);
        panelText = "A new scene unfolds in your adventure...";
      }
      
      // 🎯 ENHANCED: Final check before displaying - unified/legacy systems take priority
      const hasLegacyImageInChat = chatMessages.some(msg => 
        msg.type === 'ai' && 
        msg.content?.includes('![Legacy Image]') &&
        (Date.now() - (msg.timestamp || 0)) < 5000 // Within last 30 seconds
      );

      if (unifiedAIStreaming.isGeneratingImage || unifiedAIStreaming.isUnifiedSessionActive || hasLegacyImageInChat) {
        console.log('🚫 AUTO IMAGE: RESULT DISCARDED - Unified/Legacy system has priority, discarding automatic image');
        console.log('🔍 AUTO IMAGE COORDINATION: Session state at discard:', {
          isUnifiedSessionActive: unifiedAIStreaming.isUnifiedSessionActive,
          isStreaming: unifiedAIStreaming.isStreaming,
          isGeneratingImage: unifiedAIStreaming.isGeneratingImage,
          hasLegacyImageInChat: hasLegacyImageInChat,
          generatedImageUrl: image.substring(0, 50) + '...',
          reason: hasLegacyImageInChat ? 'legacy_system_priority_discard' : 'unified_system_priority_discard'
        });
        
        // 🧹 CRITICAL: Clear loading states when discarding to prevent infinite loading
        setIsGeneratingAdventureImage(false);
        console.log('🧹 AUTO IMAGE: Cleared loading states after discard');
        
        return; // Discard the result completely - unified/legacy system has priority
      }
      
      const newPanelId = crypto.randomUUID();
      
      console.log(`🎨 AUTO IMAGE DEBUG: Adding auto-generated panel with image: ${image.substring(0, 60)}...`);
      addPanel({ 
        id: newPanelId, 
        image, 
        text: panelText
      });
      setNewlyCreatedPanelId(newPanelId);
      
      // Silent generation - no sounds
      console.log(`✅ AUTO IMAGE: Generated successfully based on summary + recent messages`);
      console.log(`🎨 AUTO IMAGE: Created panel:`, {
        panelId: newPanelId,
        imageUrl: image.substring(0, 50) + '...',
        text: panelText,
        timestamp: Date.now()
      });
      
      // Trigger zoom animation after 2 seconds
      setTimeout(() => {
        console.log(`🎨 AUTO IMAGE: Starting zoom animation for panel:`, newPanelId);
        setZoomingPanelId(newPanelId);
        setNewlyCreatedPanelId(null);
        
        setTimeout(() => {
          console.log(`🎨 AUTO IMAGE: Ending zoom animation for panel:`, newPanelId);
          setZoomingPanelId(null);
        }, 600);
      }, 2000);
      
    } catch (error) {
      console.error('🎨 AUTO IMAGE ERROR:', error);
      console.error('🎨 AUTO IMAGE ERROR DETAILS:', {
        errorMessage: error.message,
        errorStack: error.stack,
        timestamp: Date.now()
      });
      
      // Fallback to random image on error (still silent)
      const fallbackImage = images[Math.floor(Math.random() * images.length)];
      const newPanelId = crypto.randomUUID();
      
      console.log(`🎨 AUTO IMAGE: Using fallback image:`, {
        fallbackImage,
        newPanelId,
        availableImagesCount: images.length
      });
      
      addPanel({ 
        id: newPanelId, 
        image: fallbackImage, 
        text: "Your adventure continues with new mysteries..."
      });
      setNewlyCreatedPanelId(newPanelId);
      
      setTimeout(() => {
        console.log(`🎨 AUTO IMAGE: Starting fallback zoom animation for panel:`, newPanelId);
        setZoomingPanelId(newPanelId);
        setNewlyCreatedPanelId(null);
        setTimeout(() => {
          console.log(`🎨 AUTO IMAGE: Ending fallback zoom animation for panel:`, newPanelId);
          setZoomingPanelId(null);
        }, 600);
      }, 2000);
    }
  }, [addPanel, images, chatMessages, currentSessionId, currentAdventureId, user?.uid, unifiedAIStreaming]);

  // DISABLED: Helper functions for old automatic image generation system
  // const detectSceneChange = useCallback((messages: ChatMessage[]) => {
  //   if (messages.length < 2) return false;
  //   
  //   const sceneKeywords = [
  //     // Movement/location changes
  //     'go to', 'went to', 'arrive', 'reached', 'enter', 'entered', 'exit', 'left', 'move to', 'walk to', 'run to', 'fly to', 'travel', 'journey',
  //     // New environments
  //     'room', 'building', 'house', 'forest', 'mountain', 'ocean', 'space', 'planet', 'ship', 'cave', 'city', 'town', 'village', 'island',
  //     // New characters/encounters
  //     'meet', 'met', 'see', 'saw', 'found', 'discover', 'encounter', 'appear', 'appeared', 'approach', 'arrived',
  //     // Action changes
  //     'suddenly', 'then', 'next', 'after', 'meanwhile', 'later', 'now', 'finally'
  //   ];
  //   
  //   const recent2Messages = messages.slice(-2).map(msg => msg.content.toLowerCase()).join(' ');
  //   const recent3Messages = messages.slice(-3).map(msg => msg.content.toLowerCase()).join(' ');
  //   
  //   return sceneKeywords.some(keyword => 
  //     recent2Messages.includes(keyword) || recent3Messages.includes(keyword)
  //   );
  // }, []);

  // const isDescriptiveMessage = useCallback((messageContent: string) => {
  //   const descriptiveKeywords = [
  //     // Visual descriptors
  //     'looks like', 'appears', 'seems', 'bright', 'dark', 'colorful', 'shiny', 'glowing', 'sparkling',
  //     'beautiful', 'amazing', 'incredible', 'stunning', 'magnificent', 'gigantic', 'tiny', 'huge', 'massive',
  //     // Physical descriptions
  //     'covered in', 'filled with', 'surrounded by', 'made of', 'built from', 'decorated with',
  //     'tall', 'short', 'wide', 'narrow', 'thick', 'thin', 'round', 'square', 'triangular',
  //     // Colors
  //     'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'black', 'white', 'silver', 'gold',
  //     // Textures/materials
  //     'smooth', 'rough', 'soft', 'hard', 'metal', 'wood', 'stone', 'glass', 'crystal', 'fabric',
  //     // Atmospheric
  //     'misty', 'foggy', 'cloudy', 'sunny', 'stormy', 'peaceful', 'chaotic', 'mysterious', 'eerie'
  //   ];
  //   
  //   const lowerContent = messageContent.toLowerCase();
  //   return descriptiveKeywords.some(keyword => lowerContent.includes(keyword));
  // }, []);

  // Auto image generation trigger - based on adventure summary + last 3 messages
  React.useEffect(() => {
    const userMessages = chatMessages.filter(msg => msg.type === 'user');
    const currentMessageCount = userMessages.length;
    
    // COMPREHENSIVE DEBUG LOGGING
    console.log(`🔍 AUTO IMAGE DEBUG:`, {
      totalChatMessages: chatMessages.length,
      userMessageCount: currentMessageCount,
      userMessages: userMessages.map(msg => msg.content.substring(0, 30) + '...'),
      isAutoImageGenerationActive,
      currentAdventureId,
      currentScreen,
      isInAdventureMode: currentScreen === 1,
      lastAutoImageMessageCount,
      AUTO_IMAGE_TRIGGER_INTERVAL,
      messagesSinceLastAuto: currentMessageCount - lastAutoImageMessageCount
    });
    
    // Don't trigger if disabled, no adventure ID, no messages, or not enough messages
    if (!isAutoImageGenerationActive) {
      console.log(`❌ AUTO IMAGE BLOCKED: isAutoImageGenerationActive = false`);
      return;
    }
    
    // Don't trigger if not in adventure mode
    if (currentScreen !== 1) {
      console.log(`❌ AUTO IMAGE BLOCKED: Not in adventure mode (currentScreen = ${currentScreen})`);
      return;
    }
    
    if (!currentAdventureId) {
      console.log(`❌ AUTO IMAGE BLOCKED: No currentAdventureId`);
      return;
    }
    
    if (currentMessageCount < 3) {
      console.log(`❌ AUTO IMAGE BLOCKED: Not enough user messages (${currentMessageCount} < 3)`);
      return;
    }
    
    // 🎯 IMPROVED LOGIC: Only generate when message count is exactly divisible by interval
    // and we haven't already generated for this count (prevents duplicate triggers)
    const isExactInterval = currentMessageCount > 0 && currentMessageCount % AUTO_IMAGE_TRIGGER_INTERVAL === 0;
    const notAlreadyGenerated = lastAutoImageMessageCount !== currentMessageCount;
    
    // 🚫 CLASH DETECTION: Check if unified system was called for the current message cycle
    // Get the latest user message (the one that would trigger auto generation)
    const filteredUserMessages = chatMessages.filter(msg => msg.type === 'user');
    const latestUserMessage = filteredUserMessages[filteredUserMessages.length - 1];
    
    // Check if there's an AI response to this latest user message that contains an image
    // This includes both unified system success AND legacy fallback success
    const unifiedCalledForCurrentMessage = latestUserMessage && chatMessages.some(msg => 
      msg.type === 'ai' && 
      msg.timestamp && latestUserMessage.timestamp &&
      msg.timestamp > latestUserMessage.timestamp && // AI message came after user message
      (msg.content?.includes('![Generated Image]') || // Unified system success
       msg.content?.includes('![Legacy Image]')) // Legacy fallback success
    );
    
    const shouldGenerate = isExactInterval && notAlreadyGenerated && !unifiedCalledForCurrentMessage;

    const messagesSinceLastAuto = currentMessageCount - lastAutoImageMessageCount;
    
    console.log(`🎨 AUTO IMAGE CALCULATION (IMPROVED):`, {
      currentMessageCount,
      lastAutoImageMessageCount,
      messagesSinceLastAuto,
      AUTO_IMAGE_TRIGGER_INTERVAL,
      isExactInterval,
      notAlreadyGenerated,
      unifiedCalledForCurrentMessage,
      latestUserMessageId: latestUserMessage?.timestamp,
      shouldGenerate,
      explanation: shouldGenerate ? 'EXACT_INTERVAL_MATCH' : unifiedCalledForCurrentMessage ? 'SKIPPED_DUE_TO_UNIFIED_CLASH' : 'NOT_INTERVAL_OR_ALREADY_GENERATED'
    });
    
    // 🛡️ LAYER 1 COORDINATION: Check if unified session is active before scheduling
    console.log('🔍 [AUTO IMAGE COORDINATION] LAYER 1 - Checking unified system state before scheduling:', {
      isUnifiedSessionActive: unifiedAIStreaming.isUnifiedSessionActive,
      isStreaming: unifiedAIStreaming.isStreaming,
      isGeneratingImage: unifiedAIStreaming.isGeneratingImage,
      shouldGenerate: shouldGenerate,
      currentSessionId: unifiedAIStreaming.sessionId
    });
    
    if (unifiedAIStreaming.isUnifiedSessionActive) {
      console.log('🚫 [AUTO IMAGE COORDINATION] LAYER 1 BLOCKED - Unified session is active, skipping scheduling');
      console.log('🔍 [AUTO IMAGE COORDINATION] LAYER 1 - Unified session state:', {
        isUnifiedSessionActive: unifiedAIStreaming.isUnifiedSessionActive,
        isStreaming: unifiedAIStreaming.isStreaming,
        isGeneratingImage: unifiedAIStreaming.isGeneratingImage,
        reason: 'unified_system_priority'
      });
      return; // Exit early - don't schedule generation
    }
    
    if (unifiedAIStreaming.isStreaming || unifiedAIStreaming.isGeneratingImage) {
      console.log('🚫 [AUTO IMAGE COORDINATION] LAYER 1 BLOCKED - Unified system is busy, skipping scheduling');
      return; // Exit early - don't schedule generation
    }
    
    if (shouldGenerate) {
      console.log(`✅ [AUTO IMAGE COORDINATION] LAYER 1 PASSED - Scheduling generation for message count ${currentMessageCount}`);
      console.log(`🎨 [AUTO IMAGE COORDINATION] Setting lastAutoImageMessageCount from ${lastAutoImageMessageCount} to ${currentMessageCount}`);
      
      // Update the counter IMMEDIATELY to prevent duplicate triggers
      setLastAutoImageMessageCount(currentMessageCount);
      
      // Small delay to ensure message rendering is complete, then run Layer 2 check
      setTimeout(() => {
        console.log(`🎨 [AUTO IMAGE COORDINATION] 1-second delay complete, executing generateAutoImage() with Layer 2 check...`);
        generateAutoImage();
      }, 1000);
    } else {
      if (unifiedCalledForCurrentMessage && isExactInterval) {
        // Skip this cycle due to clash, wait for next cycle
        const nextTrigger = currentMessageCount + AUTO_IMAGE_TRIGGER_INTERVAL;
        console.log(`🚫 AUTO IMAGE: UNIFIED CLASH DETECTED - Skipping cycle ${currentMessageCount}, will generate at message ${nextTrigger} instead`);
        console.log(`🔍 AUTO IMAGE: Unified system already generated image for message ${currentMessageCount}, avoiding duplicate generation`);
      } else {
        const nextTrigger = Math.ceil(currentMessageCount / AUTO_IMAGE_TRIGGER_INTERVAL) * AUTO_IMAGE_TRIGGER_INTERVAL;
        const remaining = nextTrigger - currentMessageCount;
        console.log(`⏳ AUTO IMAGE: Waiting for next interval. Current: ${currentMessageCount}, Next trigger: ${nextTrigger}, Remaining: ${remaining} messages`);
      }
    }
  }, [
    chatMessages.filter(msg => msg.type === 'user').length, 
    currentAdventureId, 
    isAutoImageGenerationActive, 
    lastAutoImageMessageCount, 
    generateAutoImage,
    currentScreen,
    unifiedAIStreaming.isUnifiedSessionActive // NEW: Re-check when unified session state changes
  ]);

  // SpellBox event handlers
  const handleSpellComplete = useCallback((isCorrect: boolean, userAnswer?: string, attemptCount: number = 1) => {
    playClickSound();
    
    if (isCorrect) {
      // Update sequential spelling progress (keep existing system intact)
      const currentGrade = selectedGradeFromDropdown || userData?.gradeDisplayName;
      const nextIndex = spellingProgressIndex + 1;
      const updatedCompletedIds = currentSpellQuestion ? [...completedSpellingIds, currentSpellQuestion.id] : completedSpellingIds;
      
      // Update local state
      setSpellingProgressIndex(nextIndex);
      setCompletedSpellingIds(updatedCompletedIds);
      
      // Save progress to localStorage
      if (currentGrade) {
        saveSpellingProgress(currentGrade, nextIndex, updatedCompletedIds);
        console.log(`📝 Spelling progress saved: Grade ${currentGrade}, Index ${nextIndex}, Completed IDs: ${updatedCompletedIds.length}`);
      }
      
      // NEW: Update Spellbox topic progress with Firebase sync
      if (currentGrade && currentSpellQuestion) {
        const isFirstAttempt = attemptCount === 1;
        
        // Use async update with Firebase sync for authenticated users
        updateSpellboxTopicProgress(currentGrade, currentSpellQuestion.topicId, isFirstAttempt, user?.uid)
          .then((topicProgress) => {
            // Check if topic is completed and show appropriate message
            if (topicProgress.isCompleted) {
              const passedTopic = isSpellboxTopicPassingGrade(topicProgress);
              if (passedTopic) {
                // Topic completed with 70%+ success rate
                const congratsMessage: ChatMessage = {
                  type: 'ai',
                  content: `🎉 Fantastic! You've completed the topic! You're ready for the next challenge! ✨`,
                  timestamp: Date.now()
                };
                
                setChatMessages(prev => {
                  playMessageSound();
                  const messageId = `index-chat-${congratsMessage.timestamp}-${prev.length}`;
                  ttsService.speakAIMessage(congratsMessage.content, messageId)
                    .catch(error => console.error('TTS error:', error));
                  return [...prev, congratsMessage];
                });
              } else {
                // Topic completed but below 70%
                const encouragementMessage: ChatMessage = {
                  type: 'ai',
                  content: `Good effort! You completed the "${currentSpellQuestion.topicName}" topic with ${topicProgress.successRate.toFixed(1)}% first-attempt accuracy. Let's practice more to reach 70% and unlock the next topic! 💪`,
                  timestamp: Date.now()
                };
                
                setChatMessages(prev => {
                  playMessageSound();
                  const messageId = `index-chat-${encouragementMessage.timestamp}-${prev.length}`;
                  ttsService.speakAIMessage(encouragementMessage.content, messageId)
                    .catch(error => console.error('TTS error:', error));
                  return [...prev, encouragementMessage];
                });
              }
            }
          })
          .catch(error => {
            console.error('Failed to update Spellbox topic progress:', error);
          });
      }
      
      // Update legacy progress for backward compatibility
      setSpellProgress(prev => ({
        ...prev,
        currentIndex: prev.currentIndex + 1
      }));
      
      // Get the latest AI response that has the stored adventure story
      const latestAIResponse = chatMessages
        .filter(msg => msg.type === 'ai' && msg.content_after_spelling)
        .slice(-1)[0];

      if (latestAIResponse?.content_after_spelling) {
        // Add adventure story
        setChatMessages(prev => {
          
          // Create the adventure story message
          const adventureStoryMessage: ChatMessage = {
            type: 'ai',
            content: latestAIResponse.content_after_spelling,
            timestamp: Date.now() + 1 // Ensure it comes after success message
          };
          
          playMessageSound();
          
          // Auto-speak both messages in sequence
          const adventureMessageId = `index-chat-${adventureStoryMessage.timestamp}-${prev.length + 1}`;
          
          ttsService.speakAIMessage(adventureStoryMessage.content, adventureMessageId)
            .catch(error => console.error('TTS error:', error));
          
          // Save message to Firebase if available
          if (currentSessionId) {
            adventureSessionService.addChatMessage(currentSessionId, adventureStoryMessage);
          }
          
          return [...prev, adventureStoryMessage];
        });
      }
      
      // Hide spell box after success
      setShowSpellBox(false);
      setCurrentSpellQuestion(null);
    } else {
      // Provide encouragement for incorrect answers
      const encouragementMessage: ChatMessage = {
        type: 'ai',
        content: `Good try! Let's keep working on spelling "${currentSpellQuestion?.word}". You're getting better! 💪`,
        timestamp: Date.now()
      };
      
      setChatMessages(prev => {
        playMessageSound();
        // Auto-speak the encouragement
        const messageId = `index-chat-${encouragementMessage.timestamp}-${prev.length}`;
        ttsService.speakAIMessage(encouragementMessage.content, messageId)
          .catch(error => console.error('TTS error for encouragement:', error));
        return [...prev, encouragementMessage];
      });
    }
  }, [currentSpellQuestion, setChatMessages, currentSessionId, chatMessages, ttsService, spellingProgressIndex, completedSpellingIds, selectedGradeFromDropdown, userData?.gradeDisplayName]);

  const handleSpellSkip = useCallback(() => {
    playClickSound();
    
    // Add skip message to chat
    const skipMessage: ChatMessage = {
      type: 'ai',
      content: `No worries! We can practice spelling "${currentSpellQuestion?.word}" another time. Let's continue our adventure! ✨`,
      timestamp: Date.now()
    };
    
    setChatMessages(prev => {
      playMessageSound();
      return [...prev, skipMessage];
    });
    
    // Hide spell box
    setShowSpellBox(false);
    setCurrentSpellQuestion(null);
  }, [currentSpellQuestion, setChatMessages]);

  const handleSpellNext = useCallback(() => {
    playClickSound();
    
    // For automatic system, just hide the current spell box
    // The next one will appear automatically when the AI generates a new spelling word
    setShowSpellBox(false);
    setCurrentSpellQuestion(null);
    
    // Add transition message
    const nextMessage: ChatMessage = {
      type: 'ai',
      content: `Great job! Let's continue our adventure! ✨`,
      timestamp: Date.now()
    };
    
    setChatMessages(prev => {
      playMessageSound();
      return [...prev, nextMessage];
    });
  }, [setChatMessages]);

  return (
    <div className="h-full w-full mobile-keyboard-aware bg-pattern flex flex-col overflow-hidden">
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
            
            {/* End Session Button - only show when adventure is active */}
            {currentScreen === 1 && (
              <Button 
                variant="destructive" 
                size="icon"
                aria-label="End Session" 
                className="border-2 bg-red-500 text-white btn-animate hover:bg-red-600 rounded-full w-12 h-12" 
                style={{ borderColor: 'hsl(from hsl(0 84% 55%) h s 25%)', boxShadow: '0 4px 0 black' }} 
                onClick={() => {
                  playClickSound();
                  setShowFeedbackModal(true);
                }}
              >
                <X className="h-6 w-6" />
              </Button>
            )}
          </div>
        </header>



        {/* Conditional Screen Rendering */}
          {isLoadingUserData ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-lg text-gray-600">Loading your profile...</p>
            </div>
          </div>
        ) : showOnboarding ? (
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
            {false && (
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
                    
                    // COMMENTED OUT: Add transition message
                    /*
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
                    */
                  }}
                  className="border-2 bg-green-600 hover:bg-green-700 text-white btn-animate h-16 w-16 p-0 rounded-full flex items-center justify-center shadow-lg"
                  style={{ borderColor: 'hsl(from hsl(142 76% 36%) h s 25%)', boxShadow: '0 4px 0 black' }}
                  aria-label="Answer Questions"
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              </div>
            )}
            
            {/* Full-height content container */}
            <div 
              className="relative flex-1 min-h-0 w-full"
              style={{ 
                padding: '8px',
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
                  padding: '8px'
                }}
              >
              {/* Main Comic Panel - Center */}
              <section 
                aria-label="Main comic panel" 
                className="flex flex-col min-h-0 relative flex-1 bg-white rounded-3xl overflow-hidden border-2 border-black transition-all duration-300 ease-in-out"
                style={{ marginRight: sidebarCollapsed ? '0px' : '5px' }}
              >
                <div className="flex-1 min-h-0 relative">
                  <ComicPanelComponent
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
                    spellWord={chatMessages.filter(message => message.type === 'ai').slice(-1)[0]?.spelling_word}
                    spellSentence={
                      // Get the full adventure story passage instead of just the spelling sentence
                      chatMessages.filter(message => message.type === 'ai').slice(-1)[0]?.content_after_spelling ||
                      // Fallback to the main content if content_after_spelling is not available
                      chatMessages.filter(message => message.type === 'ai').slice(-1)[0]?.content ||
                      // Last resort: use the spelling sentence
                      chatMessages.filter(message => message.type === 'ai').slice(-1)[0]?.spelling_sentence
                    }
                    // SpellBox props
                    onSpellComplete={handleSpellComplete}
                    onSpellSkip={handleSpellSkip}
                    onSpellNext={handleSpellNext}
                    showSpellBox={showSpellBox}
                    spellQuestion={currentSpellQuestion}
                    showProgress={true}
                    totalQuestions={spellProgress.totalQuestions}
                    currentQuestionIndex={spellProgress.currentIndex}
                    showHints={true}
                    showExplanation={true}
                    // Realtime session integration
                    sendMessage={sendMessage}
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
                            <div className="flex items-center justify-center h-full text-muted-foreground text-lg">
                              <p>💬 Start chatting with Krafty!</p>
                            </div>
                          ) : (
                            <>
                              {chatMessages.filter(m => !m.hiddenInChat).map((message, index) => (
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
                                      "max-w-[80%] rounded-lg px-3 py-2 text-xl transition-all duration-200 relative",
                                      message.type === 'user' 
                                        ? "bg-primary text-primary-foreground" 
                                        : "bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5"
                                    )}
                                    style={{}}
                                  >
                                    <div className="font-medium text-lg mb-1 opacity-70">
                                      {message.type === 'user' ? 'You' : '🤖 Krafty'}
                                    </div>
                                    <div className={message.type === 'ai' ? 'pr-6' : ''}>
                                      {message.type === 'ai' ? (
                                        <div dangerouslySetInnerHTML={{ __html: formatAIMessage(message.content, message.spelling_word) }} />
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
                                  <div className="max-w-[80%] rounded-lg px-3 py-2 text-xl bg-card border-2"
                                       style={{ borderColor: 'hsla(var(--primary), 0.9)' }}>
                                    <div className="font-medium text-lg mb-1 opacity-70">
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
                        {/* NEW: Unified AI System Status Indicator */}
                        {/* {isUnifiedSystemReady && (
                          <div className="mb-2 flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded-full px-3 py-1 animate-pulse">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span>🤖 Smart AI with Auto-Images Active</span>
                          </div>
                        )} */}
                        
                                {/* Loading indicator for unified system */}
        {unifiedAIStreaming.isStreaming && (
          <div className="mb-2 flex items-center gap-2 text-xs text-blue-600 bg-blue-50 rounded-full px-3 py-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
            <span>{unifiedAIStreaming.isGeneratingImage ? '🎨 Creating magical visuals...' : '💭 Thinking...'}</span>
          </div>
        )}
        
        {/* Show legacy loading state if unified system is generating images */}
        {/* {unifiedAIStreaming.isGeneratingImage && (
          <div className="mb-2 flex items-center gap-2 text-xs text-orange-600 bg-orange-50 rounded-full px-3 py-1">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-spin"></div>
            <span>🎵 Loading sounds active</span>
          </div>
        )} */}
                        
                        <InputBar onGenerate={onGenerate} onGenerateImage={onGenerateImage} onAddMessage={onAddMessage} />
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
                    setMessageCycleCount(0);                // Reset message cycle count
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
            currentSessionId={currentSessionId}
          />
        )}

        {/* Messenger Chat when sidebar is collapsed */}
        {sidebarCollapsed && (
          <MessengerChat 
            messages={chatMessages} 
            onGenerate={onGenerate}
            onGenerateImage={onGenerateImage}
            onAddMessage={onAddMessage}
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

        {/* Feedback Modal */}
        <FeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          onSubmit={handleFeedbackSubmit}
        />
      </div>
    </div>
  );
};

export default Index;
