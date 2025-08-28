import React, { useCallback, useState, useEffect } from "react";
import { cn, formatAIMessage, loadUserAdventure, markTopicCompleted, setCurrentTopic } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Volume2, Check, X, Loader2, Mic, Square, ChevronLeft } from "lucide-react";
import { playClickSound, playMessageSound } from "@/lib/sounds";
import ChatAvatar from "@/components/comic/ChatAvatar";
import InputBar from "@/components/comic/InputBar";
import { aiService } from "@/lib/ai-service";
import { ttsService } from "@/lib/tts-service";
import { useTTSSpeaking } from "@/hooks/use-tts-speaking";
import TopicComplete from "./TopicComplete";
import PracticeNeeded from "./PracticeNeeded";
import confetti from 'canvas-confetti';
// Updated import from the correct file
import { sampleMCQData, type MCQData, type MCQQuestion, type DragDropQuestion, type FillBlankQuestion, type TopicInfo, type Topic, type AIHook } from '../data/mcq-questions';

// Remove duplicate interface definitions (lines 16-105) since they're now imported

// Add localStorage utility functions for persistent topic score tracking
const TOPIC_SCORES_KEY = 'readingapp_topic_scores';

const saveTopicScore = (topicId: string, questionIndex: number, isCorrect: boolean): void => {
  try {
    const stored = localStorage.getItem(TOPIC_SCORES_KEY);
    const topicScores = stored ? JSON.parse(stored) : {};
    
    if (!topicScores[topicId]) {
      topicScores[topicId] = {};
    }
    
    topicScores[topicId][questionIndex] = isCorrect;
    localStorage.setItem(TOPIC_SCORES_KEY, JSON.stringify(topicScores));
  } catch (error) {
    console.warn('Failed to save topic score:', error);
  }
};

const loadTopicScores = (topicId: string): Record<number, boolean> => {
  try {
    const stored = localStorage.getItem(TOPIC_SCORES_KEY);
    const topicScores = stored ? JSON.parse(stored) : {};
    return topicScores[topicId] || {};
  } catch (error) {
    console.warn('Failed to load topic scores:', error);
    return {};
  }
};

const clearTopicScores = (topicId: string): void => {
  try {
    const stored = localStorage.getItem(TOPIC_SCORES_KEY);
    const topicScores = stored ? JSON.parse(stored) : {};
    delete topicScores[topicId];
    localStorage.setItem(TOPIC_SCORES_KEY, JSON.stringify(topicScores));
  } catch (error) {
    console.warn('Failed to clear topic scores:', error);
  }
};

// Speech Recognition interfaces - keep these as they're specific to this component
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface MCQScreenTypeAProps {
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
  selectedTopicId?: string;
  onBackToTopics?: () => void;
  onRetryTopic?: () => void;
  onNextTopic?: (nextTopicId?: string) => void;
  onBack?: (currentQuestionIndex: number) => string | void; // New prop for back navigation
  startingQuestionIndex?: number; // Add this new prop
}

// Remove the empty sampleMCQData object (lines 178-180)

// Component for individual speaker button in chat messages
const SpeakerButton: React.FC<{ message: any; index: number }> = ({ message, index }) => {
  const messageId = `mcq-chat-${message.timestamp}-${index}`;
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

const MCQScreenTypeA: React.FC<MCQScreenTypeAProps> = ({
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
  handleResizeStart,
  selectedTopicId = '1-H.1',
  onBackToTopics,
  onRetryTopic,
  onNextTopic,
  onBack,
  startingQuestionIndex
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const resizeRef = React.useRef<HTMLDivElement>(null);
  
  // MCQ state - Initialize with starting index if provided
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(startingQuestionIndex || 0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  
  // Score tracking state
  const [score, setScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showCompletionPage, setShowCompletionPage] = useState<'none' | 'success' | 'practice'>('none');
  
  // Track first attempts for each question
  const [firstAttempts, setFirstAttempts] = useState<Record<number, boolean>>({});
  
  // Store the final accurate score for completion pages
  const [finalAccurateScore, setFinalAccurateScore] = useState<number>(0);
  
  // Enhanced score tracking - load scores from localStorage on component mount
  const [questionScores, setQuestionScores] = useState<Record<number, boolean>>(() => {
    return loadTopicScores(selectedTopicId);
  });
  
  // Computed accurate score - counts all questions answered correctly for this topic
  const computedAccurateScore = React.useMemo(() => {
    const correctAnswers = Object.values(questionScores).filter(Boolean).length;
    console.log('🔍 SCORE DEBUG: questionScores:', questionScores, 'correctAnswers:', correctAnswers);
    return correctAnswers;
  }, [questionScores]);
  
  // Load topic scores when topic changes
  useEffect(() => {
    console.log('🔄 Loading scores for topic:', selectedTopicId);
    const savedScores = loadTopicScores(selectedTopicId);
    setQuestionScores(savedScores);
    console.log('📊 Loaded topic scores:', savedScores);
  }, [selectedTopicId]);
  
  // Fill blank state
  const [fillBlankAnswer, setFillBlankAnswer] = useState<string>('');
  
  // Wrong answer reflection state
  const [isInReflectionMode, setIsInReflectionMode] = useState(false);
  const [hasReflected, setHasReflected] = useState(false);
  
  // AI-generated contextual questions state
  const [contextualQuestions, setContextualQuestions] = useState<Record<number, string>>({});
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  
  // AI-generated images state
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  // Text-to-speech state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasAutoSpokenQuestion, setHasAutoSpokenQuestion] = useState(false);

  // Speech-to-text state for reading comprehension
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [recordedText, setRecordedText] = useState('');

  // Drag and drop state
  const [draggedWord, setDraggedWord] = useState<string | null>(null);
  const [sortedWords, setSortedWords] = useState<Record<string, string[]>>({});
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [isDragOverBin, setIsDragOverBin] = useState<string | null>(null);

  // Reset to starting index when startingQuestionIndex changes
  React.useEffect(() => {
    if (startingQuestionIndex !== undefined) {
      console.log(`🔍 DEBUG MCQ: Received startingQuestionIndex: ${startingQuestionIndex}, setting currentQuestionIndex from ${currentQuestionIndex} to ${startingQuestionIndex}`);
      setCurrentQuestionIndex(startingQuestionIndex);
      // Also reset all question-specific state when switching to a new question
      setSelectedAnswer(null);
      setShowFeedback(false);
      setIsCorrect(false);
      setHasAnswered(false);
      setIsInReflectionMode(false);
      setHasReflected(false);
      setFillBlankAnswer('');
      setHasAutoSpokenQuestion(false);
    }
  }, [startingQuestionIndex, currentQuestionIndex]);

  // Get current topic and questions
  const currentTopic = sampleMCQData.topics[selectedTopicId];
  const currentQuestion = currentTopic.questions[currentQuestionIndex];
  
  // Helper function to extract grade level from topicId
  const getGradeLevel = (topicId: string): string => {
    const gradeMatch = topicId.match(/^([KG0-9]+)/);
    if (!gradeMatch) return "Elementary";
    
    const grade = gradeMatch[1];
    if (grade === 'K' || grade === 'G') return "Kindergarten";
    if (grade === '1') return "Grade 1";
    if (grade === '2') return "Grade 2";
    if (grade === '3') return "Grade 3";
    if (grade === '4') return "Grade 4";
    if (grade === '5') return "Grade 5";
    return `Grade ${grade}`;
  };
  
  // Set current topic in progress tracking when component mounts or topic changes
  useEffect(() => {
    setCurrentTopic(selectedTopicId);
  }, [selectedTopicId]);
  
  // Get all topic IDs in order
  const topicIds = Object.keys(sampleMCQData.topics);
  
  // Get next topic ID
  const getNextTopicId = useCallback(() => {
    const currentIndex = topicIds.indexOf(selectedTopicId);
    if (currentIndex >= 0 && currentIndex < topicIds.length - 1) {
      return topicIds[currentIndex + 1];
    }
    return null; // No next topic (reached the end)
  }, [selectedTopicId, topicIds]);

  // Confetti celebration function
  const celebrateWithConfetti = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    
    // Add more confetti bursts
    setTimeout(() => {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { x: 0.25, y: 0.7 }
      });
    }, 250);
    
    setTimeout(() => {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { x: 0.75, y: 0.7 }
      });
    }, 400);
  }, []);

  // Check if it's a reading comprehension question
  const isReadingComprehension = currentQuestion.templateType === 'reading_comprehension';
  
  // Get the contextual question text or fall back to original
  const displayQuestionText = contextualQuestions[currentQuestionIndex] || currentQuestion.questionText;
  
  // Check if current question is drag-and-drop
  const isDragDropQuestion = currentQuestion.template === 'drag_and_drop_sorting';
  
  // Type guard to check if question is drag-drop type
  const isDragDropType = (question: any): question is DragDropQuestion => {
    return question.template === 'drag_and_drop_sorting';
  };
  


  const handleAnswerClick = useCallback(async (answerIndex: number) => {
    if ((hasAnswered && isCorrect) || isGeneratingQuestion || isInReflectionMode) return;
    
    playClickSound();
    setSelectedAnswer(answerIndex);
    
    const correct = answerIndex === currentQuestion.correctAnswer;
    const isFirstAttempt = !firstAttempts[currentQuestionIndex];
    
    // Mark this question as attempted
    if (isFirstAttempt) {
      setFirstAttempts(prev => ({
        ...prev,
        [currentQuestionIndex]: true
      }));
    }
    
    setIsCorrect(correct);
    
    if (correct) {
      // Correct answer - show celebration and disable further selections
      setHasAnswered(true);
      setShowFeedback(true);
      
      // Check if this question was already answered correctly to avoid double-counting
      const wasAlreadyCorrect = questionScores[currentQuestionIndex];
      
      // Increment score for any correct answer (not just first attempts)
      // but only if it wasn't already answered correctly
      if (!wasAlreadyCorrect) {
        setScore(prev => prev + 1);
      }
      
      // Enhanced score tracking - save to localStorage and update state
      setQuestionScores(prev => {
        const updated = {
          ...prev,
          [currentQuestionIndex]: true
        };
        // Save to localStorage immediately
        saveTopicScore(selectedTopicId, currentQuestionIndex, true);
        return updated;
      });
      
      // Celebrate with confetti!
      celebrateWithConfetti();
      const feedbackMessage = {
        type: 'ai' as const,
        content: `🎉 ${currentQuestion.explanation}`,
        timestamp: Date.now()
      };
      
      setChatMessages((prev: any) => [...prev, feedbackMessage]);
      playMessageSound();
      
      // Auto-speak the AI feedback message and wait for completion
      const messageId = `mcq-chat-${feedbackMessage.timestamp}-${chatMessages.length}`;
      await ttsService.speakAIMessage(feedbackMessage.content, messageId);
    } else {
      // Wrong answer - generate AI reflection prompt
      setHasAnswered(false); // Allow trying other options
      
      try {
        // Generate AI reflection response using the question context
        const reflectionResponse = await aiService.generateReflectionPrompt(
          displayQuestionText, // Use the contextual question text
          (currentQuestion as MCQQuestion).options,
          answerIndex,
          Number(currentQuestion.correctAnswer),
          currentQuestion.topicName,
          getGradeLevel(currentQuestion.topicId),
          'mcq'
        );
        
        const hintMessage = {
          type: 'ai' as const,
          content: reflectionResponse,
          timestamp: Date.now()
        };
        
        setChatMessages((prev: any) => [...prev, hintMessage]);
        playMessageSound();
        
        // Auto-speak the hint message
        const hintMessageId = `mcq-chat-${hintMessage.timestamp}-${chatMessages.length}`;
        ttsService.speakAIMessage(hintMessage.content, hintMessageId);
      } catch (error) {
        console.error('Error generating reflection prompt:', error);
        
        // Fallback to a simple message if AI fails
        const fallbackMessage = {
          type: 'ai' as const,
          content: `🤔 Great effort on this ${currentQuestion.topicName.replace(/_/g, ' ').toLowerCase()} question! Can you tell me what made you choose "${(currentQuestion as MCQQuestion).options[answerIndex]}"? Let's look at the question again together.`,
          timestamp: Date.now()
        };
        
        setChatMessages((prev: any) => [...prev, fallbackMessage]);
        playMessageSound();
        const fallbackMessageId = `mcq-chat-${fallbackMessage.timestamp}-${chatMessages.length}`;
        await ttsService.speakAIMessage(fallbackMessage.content, fallbackMessageId);
      }
      
      // Clear the wrong answer visual feedback after a brief moment
      setTimeout(() => {
        setSelectedAnswer(null);
      }, 1500);
    }
    
    // Auto-expand chat to show feedback
    // setSidebarCollapsed(false); // Commented out - don't auto-open chat panel
  }, [hasAnswered, isCorrect, isGeneratingQuestion, isInReflectionMode, currentQuestion, displayQuestionText, firstAttempts, currentQuestionIndex, setChatMessages]); // Removed setSidebarCollapsed from dependencies

  // Handle fill blank answer submission
  const handleFillBlankSubmit = useCallback(async () => {
    if (hasAnswered || isGeneratingQuestion || isInReflectionMode || !fillBlankAnswer.trim()) return;
    
    playClickSound();
    setHasAnswered(true);
    
    const currentFillBlankQuestion = currentQuestion as FillBlankQuestion;
    const userAnswer = fillBlankAnswer.trim().toLowerCase();
    const correctAnswer = currentFillBlankQuestion.correctAnswer.toLowerCase();
    const isAnswerCorrect = userAnswer === correctAnswer;
    const isFirstAttempt = !firstAttempts[currentQuestionIndex];
    
    // Mark this question as attempted
    if (isFirstAttempt) {
      setFirstAttempts(prev => ({
        ...prev,
        [currentQuestionIndex]: true
      }));
    }
    
    setIsCorrect(isAnswerCorrect);
    
    if (isAnswerCorrect) {
      // Correct answer
      setShowFeedback(true);
      
      // Check if this question was already answered correctly to avoid double-counting
      const wasAlreadyCorrect = questionScores[currentQuestionIndex];
      
      // Increment score for any correct answer (not just first attempts)
      // but only if it wasn't already answered correctly
      if (!wasAlreadyCorrect) {
        setScore(prev => prev + 1);
      }
      
      // Enhanced score tracking - save to localStorage and update state
      setQuestionScores(prev => {
        const updated = {
          ...prev,
          [currentQuestionIndex]: true
        };
        // Save to localStorage immediately
        saveTopicScore(selectedTopicId, currentQuestionIndex, true);
        return updated;
      });
      
      // Celebrate with confetti!
      celebrateWithConfetti();
      const feedbackMessage = {
        type: 'ai' as const,
        content: `🎉 ${currentFillBlankQuestion.explanation}`,
        timestamp: Date.now()
      };
      
      setChatMessages((prev: any) => [...prev, feedbackMessage]);
      playMessageSound();
      
      // Auto-speak the AI feedback message and wait for completion
      const messageId = `mcq-chat-${feedbackMessage.timestamp}-${chatMessages.length}`;
      await ttsService.speakAIMessage(feedbackMessage.content, messageId);
    } else {
      // Wrong answer - generate AI reflection prompt
      setHasAnswered(false); // Allow trying again
      
      try {
        // Generate AI reflection response for fill-in-the-blank
        const reflectionResponse = await aiService.generateReflectionPrompt(
          displayQuestionText, // Use the contextual question text
          null, // No options for fill-in-the-blank
          fillBlankAnswer.trim(), // Student's answer
          currentFillBlankQuestion.correctAnswer, // Correct answer
          currentQuestion.topicName,
          getGradeLevel(currentQuestion.topicId),
          'fill_blank'
        );
        
        const hintMessage = {
          type: 'ai' as const,
          content: reflectionResponse,
          timestamp: Date.now()
        };
        
        setChatMessages((prev: any) => [...prev, hintMessage]);
        playMessageSound();
        
        // Auto-speak the hint message and wait for completion
        const hintMessageId = `mcq-chat-${hintMessage.timestamp}-${chatMessages.length}`;
        await ttsService.speakAIMessage(hintMessage.content, hintMessageId);
      } catch (error) {
        console.error('Error generating reflection prompt for fill-blank:', error);
        
        // Fallback to a simple message if AI fails
        const fallbackMessage = {
          type: 'ai' as const,
          content: `🌟 Nice try with your ${currentQuestion.topicName.replace(/_/g, ' ').toLowerCase()} work! Can you think about what sounds you hear when you say "${fillBlankAnswer.trim()}"? What other word might fit better here?`,
          timestamp: Date.now()
        };
        
        setChatMessages((prev: any) => [...prev, fallbackMessage]);
        playMessageSound();
        const fallbackMessageId = `mcq-chat-${fallbackMessage.timestamp}-${chatMessages.length}`;
        await ttsService.speakAIMessage(fallbackMessage.content, fallbackMessageId);
      }
      
      // Clear the wrong answer after a brief moment
      setTimeout(() => {
        setFillBlankAnswer('');
      }, 1500);
    }
    
    // Auto-expand chat to show feedback
    // setSidebarCollapsed(false); // Commented out - don't auto-open chat panel
  }, [hasAnswered, isCorrect, isGeneratingQuestion, isInReflectionMode, currentQuestion, fillBlankAnswer, setChatMessages]); // Removed setSidebarCollapsed from dependencies

  // Handle student reflection response
  const handleReflectionResponse = useCallback(async (studentReflection: string) => {
    if (!isInReflectionMode) return;
    
    // Student has provided their reflection, now let them try again
    setHasReflected(true);
    setIsInReflectionMode(false);
    
    // Reset the question state to allow another attempt
    setSelectedAnswer(null);
    setHasAnswered(false);
    setShowFeedback(false);
    setIsCorrect(false);
    setFillBlankAnswer('');
    
    // Generate response encouraging them to try again
    const encouragementMessage = {
      type: 'ai' as const,
      content: `Great thinking! 💭 Now that you've reflected on it, give the question another try. You can do this! 🌟`,
      timestamp: Date.now()
    };
    
    setChatMessages((prev: any) => [...prev, encouragementMessage]);
    playMessageSound();
    
    // Auto-speak the encouragement message and wait for completion
    const messageId = `mcq-chat-${encouragementMessage.timestamp}-${chatMessages.length}`;
    await ttsService.speakAIMessage(encouragementMessage.content, messageId);
  }, [isInReflectionMode, currentQuestion, setChatMessages]);

  // Wrapper for onGenerate to handle reflection mode
  const handleGenerate = useCallback((text: string) => {
    if (isInReflectionMode) {
      // Student is responding to reflection prompt
      handleReflectionResponse(text);
      return;
    }
    
    // Normal chat generation
    onGenerate(text);
  }, [isInReflectionMode, handleReflectionResponse, onGenerate]);

  // Handle back button - sequential navigation logic
  const handleBackButton = useCallback(() => {
    playClickSound();
    
    if (onBack) {
      const result = onBack(currentQuestionIndex);
      // If onBack returns 'previous_question', go to previous question
      if (result === 'previous_question' && currentQuestionIndex > 0) {
        setCurrentQuestionIndex(prev => prev - 1);
        setSelectedAnswer(null);
        setShowFeedback(false);
        setIsCorrect(false);
        setHasAnswered(false);
        setIsInReflectionMode(false);
        setHasReflected(false);
        setFillBlankAnswer('');
        setHasAutoSpokenQuestion(false); // Reset auto-speech state
      }
      // Otherwise, the parent component (Index.tsx) handles the navigation
    }
  }, [onBack, currentQuestionIndex]);

  const handleNextQuestion = useCallback(() => {
    playClickSound();
    
    console.log(`🔍 DEBUG MCQ: handleNextQuestion called. currentQuestionIndex: ${currentQuestionIndex}`);
    
    // Reset question state for next question
    setSelectedAnswer(null);
    setShowFeedback(false);
    setIsCorrect(false);
    setHasAnswered(false);
    setIsInReflectionMode(false);
    setHasReflected(false);
    setFillBlankAnswer('');
    setHasAutoSpokenQuestion(false); // Reset auto-speech state for new question
    // Don't reset drag-and-drop state here - let useEffect handle initialization
    
    if (currentQuestionIndex < currentTopic.questions.length - 1) {
      console.log(`🔍 DEBUG MCQ: Not last question, calling onNextTopic()`);
      // Let parent component handle the progression logic
      if (onNextTopic) {
        onNextTopic(); // Call without nextTopicId to let Index.tsx handle the flow logic
      }
    } else {
      console.log(`🔍 DEBUG MCQ: Last question completed, showing completion page`);
      
      // Stop any ongoing TTS before showing completion page
      ttsService.stop();
      
      // All questions completed - check score and show appropriate completion page
      setQuizCompleted(true);
      
      // Save progress - topic is marked as completed only with passing grade (7/10+)
      // This immediately updates readingapp_user_progress in localStorage
      // Reload scores from localStorage to ensure we have the most current data including the final question
      const currentTopicScores = loadTopicScores(selectedTopicId);
      const finalScore = Object.values(currentTopicScores).filter(Boolean).length;
      console.log('🏁 COMPLETION: Reloaded scores from localStorage:', currentTopicScores);
      console.log('🏁 COMPLETION: Using accurate final score:', finalScore, 'vs computedAccurateScore:', computedAccurateScore, 'vs original score:', score);
      
      // Store the final accurate score for completion pages
      setFinalAccurateScore(finalScore);
      markTopicCompleted(selectedTopicId, finalScore);
      
      if (finalScore >= 7) {
        setShowCompletionPage('success');
        // Trigger confetti for passing grade
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      } else {
        setShowCompletionPage('practice');
      }
    }
  }, [currentQuestionIndex, currentTopic, setChatMessages, onNextTopic]);



  // Generate contextual question when component mounts or question changes
  useEffect(() => {
    const generateContextualQuestion = async () => {
      // Skip if we already have a contextual question for this index
      if (contextualQuestions[currentQuestionIndex]) {
        return;
      }

      setIsGeneratingQuestion(true);
      
      try {
        // Load user adventure context
        const userAdventure = loadUserAdventure();
        console.log('Loading user adventure context for question generation:', {
          messageCount: userAdventure.length,
          recentMessages: userAdventure.slice(-5).map(msg => ({ type: msg.type, content: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '') }))
        });
        
        let contextualText = '';
        
        if (isReadingComprehension) {
          // For reading comprehension, generate contextual reading passage
                      contextualText = await aiService.generateContextualReadingPassage(
              currentQuestion.passage || '',
              `${currentTopic.topicInfo.topicName} - ${currentQuestion.word}`,
              userAdventure
            );
        } else if (isDragDropType(currentQuestion)) {
          // For drag-and-drop questions, pass different parameters
          contextualText = await aiService.generateContextualQuestion(
            `Topic: ${currentTopic.topicInfo.topicName} - ${currentQuestion.questionText}`,
            currentQuestion.sortingWords, // Use sorting words instead of options
            0, // Dummy value since drag-drop doesn't have a single correct answer index
            userAdventure
          );
        } else {
          // For MCQ questions
          contextualText = await aiService.generateContextualQuestion(
            `Topic: ${currentTopic.topicInfo.topicName} - ${currentQuestion.questionText}`,
            (currentQuestion as MCQQuestion).options,
            (currentQuestion as MCQQuestion).correctAnswer,
            userAdventure
          );
        }

        // Only update if we got different content (AI successfully generated one)
        const originalContent = isReadingComprehension ? currentQuestion.passage : currentQuestion.questionText;
        if (contextualText !== originalContent) {
          console.log('✅ Successfully generated contextualized content:', {
            type: isReadingComprehension ? 'reading passage' : 'question',
            original: originalContent,
            contextualized: contextualText
          });
          setContextualQuestions(prev => ({
            ...prev,
            [currentQuestionIndex]: contextualText
          }));
        } else {
          console.log('ℹ️ Using original content - AI did not generate a different contextualized version');
        }
      } catch (error) {
        console.error('Error generating contextual content:', error);
        // If generation fails, we'll use the original content (which is the fallback)
      } finally {
        setIsGeneratingQuestion(false);
      }
    };

    generateContextualQuestion();
  }, [currentQuestionIndex, currentQuestion.questionText, currentQuestion, currentTopic.topicInfo.topicName]);

  // Silent bulk generation function to create multiple images in background
  const bulkGenerateImages = useCallback(async (startIndex: number = 0, maxImages: number = 10) => {
    const questionsToGenerate = Math.min(maxImages, currentTopic.questions.length - startIndex);
    
    if (questionsToGenerate <= 0) return;
    
    console.log(`🎨 Starting silent bulk generation of ${questionsToGenerate} images from index ${startIndex}`);
    
    const userAdventure = loadUserAdventure();
    
    // Generate first image immediately (priority for current question)
    if (!generatedImages[startIndex]) {
      try {
        const firstQuestion = currentTopic.questions[startIndex];
        console.log(`🖼️ Generating priority image for question ${startIndex + 1}`);
        
        const firstImageUrl = await aiService.generateContextualImage(
          firstQuestion.audio,
          userAdventure,
          `${currentTopic.topicInfo.topicName}: ${firstQuestion.aiHook.imagePrompt}`
        );
        
        if (firstImageUrl) {
          setGeneratedImages(prev => ({
            ...prev,
            [startIndex]: firstImageUrl
          }));
          console.log(`✅ Priority image generated for question ${startIndex + 1}`);
        }
      } catch (error) {
        console.error(`❌ Failed to generate priority image for question ${startIndex + 1}:`, error);
      }
    }
    
    // Continue generating remaining images in background (silently)
    setTimeout(async () => {
      console.log(`🔄 Starting background generation of ${questionsToGenerate - 1} remaining images`);
      
      for (let i = 1; i < questionsToGenerate; i++) {
        const questionIndex = startIndex + i;
        
        // Skip if image already exists
        if (generatedImages[questionIndex]) {
          continue;
        }
        
        try {
          const question = currentTopic.questions[questionIndex];
          console.log(`🖼️ Background generating image ${i + 1}/${questionsToGenerate} for question ${questionIndex + 1}`);
          
          const imageUrl = await aiService.generateContextualImage(
            question.audio,
            userAdventure,
            `${currentTopic.topicInfo.topicName}: ${question.aiHook.imagePrompt}`
          );
          
          if (imageUrl) {
            setGeneratedImages(prev => ({
              ...prev,
              [questionIndex]: imageUrl
            }));
            console.log(`✅ Background generated image ${i + 1}/${questionsToGenerate} for question ${questionIndex + 1}`);
          }
        } catch (error) {
          console.error(`❌ Failed to background generate image ${i + 1}/${questionsToGenerate} for question ${questionIndex + 1}:`, error);
        }
        
        // Small delay between requests to avoid overwhelming the API
        if (i < questionsToGenerate - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log(`🎉 Completed silent bulk generation of ${questionsToGenerate} images`);
    }, 500); // Start background generation after 500ms
    
  }, [currentTopic.questions, currentTopic.topicInfo.topicName, generatedImages]);

  // Trigger bulk image generation when component mounts
  useEffect(() => {
    // Only run bulk generation once when component mounts
    if (currentQuestionIndex === 0 && Object.keys(generatedImages).length === 0) {
      bulkGenerateImages(0, 10);
    }
  }, [bulkGenerateImages, generatedImages]);

  // Generate current image if not already generated (fallback for images not in bulk)
  useEffect(() => {
    const generateCurrentImage = async () => {
      // Skip if we already have an image for this index
      if (generatedImages[currentQuestionIndex]) {
        return;
      }

      setIsGeneratingImage(true);
      
      try {
        // Load user adventure context
        const userAdventure = loadUserAdventure();
        console.log('Loading user adventure context for current image generation:', {
          messageCount: userAdventure.length,
          lastMessage: userAdventure.length > 0 ? userAdventure[userAdventure.length - 1].content : 'No messages'
        });
        
        const currentImageUrl = await aiService.generateContextualImage(
          currentQuestion.audio, // Use the audio field text
          userAdventure,
          `${currentTopic.topicInfo.topicName}: ${currentQuestion.aiHook.imagePrompt}`
        );

        // Only update if we got a valid image URL
        if (currentImageUrl) {
          setGeneratedImages(prev => ({
            ...prev,
            [currentQuestionIndex]: currentImageUrl
          }));
        }
      } catch (error) {
        console.error('Error generating contextual image:', error);
        // If generation fails, we'll show the placeholder
      } finally {
        setIsGeneratingImage(false);
      }
    };

    generateCurrentImage();
  }, [currentQuestionIndex, currentQuestion.audio, currentQuestion.aiHook.imagePrompt, currentTopic.topicInfo.topicName, generatedImages]);

  // Initialize drag-and-drop state when question changes
  useEffect(() => {
    console.log('🔍 Drag-drop initialization check:', {
      isDragDropQuestion,
      template: currentQuestion.template,
      hasTypeGuard: isDragDropType(currentQuestion),
      questionIndex: currentQuestionIndex
    });
    
    // Small delay to ensure state resets have completed
    const timeoutId = setTimeout(() => {
      if (isDragDropQuestion && isDragDropType(currentQuestion)) {
        const dragDropQuestion = currentQuestion as DragDropQuestion;
        console.log('✅ Initializing drag-drop with:', {
          sortingWords: dragDropQuestion.sortingWords,
          sortingBins: dragDropQuestion.sortingBins
        });
        
        // Initialize available words and empty bins
        setAvailableWords([...dragDropQuestion.sortingWords]);
        const emptyBins: Record<string, string[]> = {};
        dragDropQuestion.sortingBins.forEach(bin => {
          emptyBins[bin] = [];
        });
        setSortedWords(emptyBins);
        setDraggedWord(null);
        setIsDragOverBin(null);
        
        console.log('🎯 Set availableWords to:', dragDropQuestion.sortingWords);
      } else {
        console.log('❌ Drag-drop conditions not met, clearing state');
        // Clear drag-drop state for non-drag-drop questions
        setSortedWords({});
        setAvailableWords([]);
        setDraggedWord(null);
        setIsDragOverBin(null);
      }
    }, 10); // Small delay
    
    return () => clearTimeout(timeoutId);
  }, [currentQuestionIndex, isDragDropQuestion, currentQuestion]);

  // Auto-speak question when it loads (after contextual generation is complete)
  useEffect(() => {
    // Only auto-speak if we haven't already spoken this question
    if (!hasAutoSpokenQuestion && !isGeneratingQuestion && displayQuestionText) {
      // Wait a moment for the question to render, then speak it
      const timeoutId = setTimeout(() => {
        setHasAutoSpokenQuestion(true);
        setIsSpeaking(true);
        ttsService.speakQuestion(displayQuestionText).finally(() => {
          setIsSpeaking(false);
        });
      }, 1000); // 1 second delay to let the question render

      return () => clearTimeout(timeoutId);
    }
  }, [hasAutoSpokenQuestion, isGeneratingQuestion, displayQuestionText]);

  // Handle speaking the audio text
  const handleSpeakAnswer = useCallback(() => {
    playClickSound();
    
    // Stop any current speech and speak the audio text
    ttsService.stop();
    
    // Use the audio field from the current question
    const audioText = currentQuestion.audio;
    
    setIsSpeaking(true);
    ttsService.speakAnswer(audioText).finally(() => {
      setIsSpeaking(false);
    });
  }, [currentQuestion]);

  // Handle speaking the reading passage for reading comprehension
  const handleSpeakPassage = useCallback(() => {
    playClickSound();
    
    // Stop any current speech and speak the passage
    ttsService.stop();
    
    // Use the contextual passage if available, otherwise use the original
    const passageText = contextualQuestions[currentQuestionIndex] || currentQuestion.passage || '';
    
    setIsSpeaking(true);
    ttsService.speakAnswer(passageText).finally(() => {
      setIsSpeaking(false);
    });
  }, [currentQuestion, currentQuestionIndex, contextualQuestions]);

  // Initialize speech recognition for reading comprehension
  useEffect(() => {
    if (!isReadingComprehension) return;
    
    // Check if browser supports speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setRecordedText(transcript);
        
        // Add the recorded text to chat
        const userMessage = {
          type: 'user' as const,
          content: `📖 I read: "${transcript}"`,
          timestamp: Date.now()
        };
        setChatMessages((prev: any) => [...prev, userMessage]);
        
        // Evaluate the reading performance
        evaluateReadingComprehension(transcript);
      };
      
      recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        
        const errorMessage = {
          type: 'ai' as const,
          content: `🎤 Sorry, I couldn't hear you clearly. Please try again!`,
          timestamp: Date.now()
        };
        setChatMessages((prev: any) => [...prev, errorMessage]);
        playMessageSound();
      };
      
      recognitionInstance.onstart = () => {
        setIsRecording(true);
      };
      
      recognitionInstance.onend = () => {
        setIsRecording(false);
      };
      
      setRecognition(recognitionInstance);
    } else {
      console.warn('Speech recognition not supported in this browser');
    }
    
    return () => {
      if (recognition) {
        recognition.abort();
      }
    };
  }, [isReadingComprehension]);

  // Speech recognition handlers for reading comprehension
  const startRecording = useCallback(() => {
    if (!recognition || isRecording) return;
    
    playClickSound();
    
    // Stop any ongoing TTS when mic button is clicked
    ttsService.stop();
    
    setRecordedText('');
    recognition.start();
    
    const startMessage = {
      type: 'ai' as const,
      content: `🎤 Go ahead, read the passage aloud! I'm listening...`,
      timestamp: Date.now()
    };
    setChatMessages((prev: any) => [...prev, startMessage]);
    playMessageSound();
  }, [recognition, isRecording]);

  const stopRecording = useCallback(() => {
    if (!recognition || !isRecording) return;
    
    playClickSound();
    
    // Stop any ongoing TTS when mic button is clicked
    ttsService.stop();
    
    recognition.stop();
  }, [recognition, isRecording]);

  const evaluateReadingComprehension = useCallback(async (transcript: string) => {
    // Use the contextual passage if available, otherwise use the original
    const passageText = contextualQuestions[currentQuestionIndex] || currentQuestion.passage || '';
    const similarity = calculateReadingSimilarity(transcript, passageText);
    
    let feedbackMessage = '';
    let isCorrect = false;
    
    if (similarity >= 0.7) {
      isCorrect = true;
      feedbackMessage = `🎉 Excellent reading! You read ${Math.round(similarity * 100)}% of the passage correctly. ${currentQuestion.explanation}`;
    } else if (similarity >= 0.5) {
      feedbackMessage = `👍 Good job! You read ${Math.round(similarity * 100)}% correctly. Try reading the passage again to improve!`;
    } else {
      // Generate AI reflection for poor reading performance
      try {
        const reflectionResponse = await aiService.generateReflectionPrompt(
          passageText, // Use the passage text
          null, // No options for reading comprehension
          Math.round(similarity * 100).toString(), // Student's accuracy percentage
          '70+', // Target accuracy
          currentQuestion.topicName,
          getGradeLevel(currentQuestion.topicId),
          'reading_comprehension'
        );
        
        feedbackMessage = reflectionResponse;
      } catch (error) {
        console.error('Error generating reflection prompt for reading comprehension:', error);
        
        // Fallback to enhanced message if AI fails
        feedbackMessage = `🌟 Great effort reading! Can you tell me which words felt the trickiest? What strategies might help you read even better?`;
      }
      
      // Read the passage aloud for the user
      setTimeout(() => {
        ttsService.speakAnswer(passageText);
      }, 2000);
    }
    
    setIsCorrect(isCorrect);
    setHasAnswered(true);
    setShowFeedback(true);
    
    const aiMessage = {
      type: 'ai' as const,
      content: feedbackMessage,
      timestamp: Date.now()
    };
    setChatMessages((prev: any) => [...prev, aiMessage]);
    playMessageSound();
    const messageId = `mcq-chat-${aiMessage.timestamp}-${chatMessages.length}`;
    await ttsService.speakAIMessage(feedbackMessage, messageId);
  }, [currentQuestion]);

  // Calculate reading similarity (simple word matching)
  const calculateReadingSimilarity = useCallback((spoken: string, original: string) => {
    const spokenWords = spoken.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    const originalWords = original.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    
    if (originalWords.length === 0) return 0;
    
    let matchCount = 0;
    spokenWords.forEach(spokenWord => {
      if (originalWords.includes(spokenWord)) {
        matchCount++;
      }
    });
    
    return matchCount / originalWords.length;
  }, []);

  // Drag and drop handlers
  const handleDragStart = useCallback((word: string) => {
    setDraggedWord(word);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, binName: string) => {
    e.preventDefault();
    setIsDragOverBin(binName);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOverBin(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, binName: string) => {
    e.preventDefault();
    
    if (!draggedWord || !isDragDropQuestion) return;

    // Remove word from available words
    setAvailableWords(prev => prev.filter(w => w !== draggedWord));
    
    // Add word to the bin
    setSortedWords(prev => ({
      ...prev,
      [binName]: [...prev[binName], draggedWord]
    }));

    setDraggedWord(null);
    setIsDragOverBin(null);
  }, [draggedWord, isDragDropQuestion]);

  const handleRemoveFromBin = useCallback((word: string, binName: string) => {
    // Remove word from bin
    setSortedWords(prev => ({
      ...prev,
      [binName]: prev[binName].filter(w => w !== word)
    }));
    
    // Add word back to available words
    setAvailableWords(prev => [...prev, word]);
  }, []);

  const handleCheckDragDropAnswer = useCallback(async () => {
    if (!isDragDropType(currentQuestion)) return;

    // Check if all words are sorted
    if (availableWords.length > 0) {
      const hintMessage = {
        type: 'ai' as const,
        content: `📝 Please sort all the words into the correct bins first!`,
        timestamp: Date.now()
      };
      setChatMessages((prev: any) => [...prev, hintMessage]);
      playMessageSound();
      const hintMessageId = `mcq-chat-${hintMessage.timestamp}-${chatMessages.length}`;
      await ttsService.speakAIMessage(hintMessage.content, hintMessageId);
      return;
    }

    // Check if sorting is correct
    let isCorrect = true;
    const correctAnswer = currentQuestion.correctAnswer;
    
    for (const binName of Object.keys(correctAnswer)) {
      const expectedWords = correctAnswer[binName].sort();
      const actualWords = (sortedWords[binName] || []).sort();
      
      if (expectedWords.length !== actualWords.length || 
          !expectedWords.every((word, index) => word === actualWords[index])) {
        isCorrect = false;
        break;
      }
    }

    const isFirstAttempt = !firstAttempts[currentQuestionIndex];
    
    // Mark this question as attempted
    if (isFirstAttempt) {
      setFirstAttempts(prev => ({
        ...prev,
        [currentQuestionIndex]: true
      }));
    }

    setIsCorrect(isCorrect);
    setHasAnswered(true);
    setShowFeedback(true);

    if (isCorrect) {
      // Check if this question was already answered correctly to avoid double-counting
      const wasAlreadyCorrect = questionScores[currentQuestionIndex];
      
      // Increment score for any correct answer (not just first attempts)
      // but only if it wasn't already answered correctly
      if (!wasAlreadyCorrect) {
        setScore(prev => prev + 1);
      }
      
      // Enhanced score tracking - save to localStorage and update state
      setQuestionScores(prev => {
        const updated = {
          ...prev,
          [currentQuestionIndex]: true
        };
        // Save to localStorage immediately
        saveTopicScore(selectedTopicId, currentQuestionIndex, true);
        return updated;
      });
      
      // Celebrate with confetti!
      celebrateWithConfetti();
      const feedbackMessage = {
        type: 'ai' as const,
        content: `🎉 ${currentQuestion.explanation}`,
        timestamp: Date.now()
      };
      setChatMessages((prev: any) => [...prev, feedbackMessage]);
      playMessageSound();
      const feedbackMessageId = `mcq-chat-${feedbackMessage.timestamp}-${chatMessages.length}`;
      await ttsService.speakAIMessage(feedbackMessage.content, feedbackMessageId);
    } else {
      try {
        // Generate AI reflection response for drag-and-drop
        const reflectionResponse = await aiService.generateReflectionPrompt(
          displayQuestionText, // Use the contextual question text
          null, // No options for drag-and-drop
          'current sorting has errors', // Student's answer description
          'correct sorting needed', // Correct answer description
          currentQuestion.topicName,
          getGradeLevel(currentQuestion.topicId),
          'drag_drop'
        );
        
        const hintMessage = {
          type: 'ai' as const,
          content: reflectionResponse,
          timestamp: Date.now()
        };
        
        setChatMessages((prev: any) => [...prev, hintMessage]);
        playMessageSound();
        const hintMessageId = `mcq-chat-${hintMessage.timestamp}-${chatMessages.length}`;
        await ttsService.speakAIMessage(hintMessage.content, hintMessageId);
      } catch (error) {
        console.error('Error generating reflection prompt for drag-drop:', error);
        
        // Fallback to a simple message if AI fails
        const fallbackMessage = {
          type: 'ai' as const,
          content: `🤔 Interesting sorting work on ${currentQuestion.topicName.replace(/_/g, ' ').toLowerCase()}! Can you tell me what rule you're using to sort these words? What sounds do you hear in each word?`,
          timestamp: Date.now()
        };
        
        setChatMessages((prev: any) => [...prev, fallbackMessage]);
        playMessageSound();
        const fallbackMessageId = `mcq-chat-${fallbackMessage.timestamp}-${chatMessages.length}`;
        await ttsService.speakAIMessage(fallbackMessage.content, fallbackMessageId);
      }
      
      // Allow retry
      setHasAnswered(false);
      setShowFeedback(false);
    }

    // setSidebarCollapsed(false); // Commented out - don't auto-open chat panel
  }, [isDragDropType, currentQuestion, availableWords.length, sortedWords, setChatMessages]);

  // Reset quiz UI state only (preserves saved scores)
  const resetQuizState = useCallback(() => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setIsCorrect(false);
    setHasAnswered(false);
    setScore(0);
    setQuizCompleted(false);
    setShowCompletionPage('none');
    setFirstAttempts({});
    setFillBlankAnswer('');
    setIsInReflectionMode(false);
    setHasReflected(false);
    setSortedWords({});
    setAvailableWords([]);
    setDraggedWord(null);
    setIsDragOverBin(null);
    setFinalAccurateScore(0);
    console.log('🔄 RESET UI: Reset interface state while preserving saved scores');
  }, []);

  // Full reset including clearing persistent scores (for explicit retry only)
  const resetQuizAndClearScores = useCallback(() => {
    resetQuizState();
    // Clear persistent topic scores when explicitly retrying
    clearTopicScores(selectedTopicId);
    setQuestionScores({});
    console.log('🔄 FULL RESET: Cleared all question scores and attempt tracking for topic:', selectedTopicId);
  }, [selectedTopicId, resetQuizState]);

  // Reset quiz UI state when topic changes (preserve scores)
  useEffect(() => {
    resetQuizState();
    // Load scores for the new topic
    const savedScores = loadTopicScores(selectedTopicId);
    setQuestionScores(savedScores);
    console.log('📊 TOPIC CHANGE: Loaded scores for topic', selectedTopicId, ':', savedScores);
    
    // Clear contextual questions and images for new topic
    setContextualQuestions({});
    setGeneratedImages({});
    setIsGeneratingQuestion(false);
    setIsGeneratingImage(false);
  }, [selectedTopicId, resetQuizState]);

  // Show completion pages
  if (showCompletionPage === 'success') {
    return (
      <TopicComplete
        score={finalAccurateScore}
        totalQuestions={currentTopic.questions.length}
        topicName={currentTopic.topicInfo.topicName}
        onNextTopic={() => {
          const nextTopicId = getNextTopicId();
          if (nextTopicId && onNextTopic) {
            // Reset UI state before moving to next topic (preserve scores)
            resetQuizState();
            // Pass the next topic ID to the parent component
            onNextTopic(nextTopicId);
          } else {
            // No more topics, go back to topic selection
            resetQuizState();
            if (onBackToTopics) {
              onBackToTopics();
            }
          }
        }}
        onRetryTopic={() => {
          resetQuizAndClearScores();
          if (onRetryTopic) {
            onRetryTopic();
          }
        }}
        onBackToTopics={() => {
          resetQuizState();
          if (onBackToTopics) {
            onBackToTopics();
          }
        }}
      />
    );
  }

  if (showCompletionPage === 'practice') {
    return (
      <PracticeNeeded
        score={finalAccurateScore}
        totalQuestions={currentTopic.questions.length}
        topicName={currentTopic.topicInfo.topicName}
        onRetryTopic={() => {
          resetQuizAndClearScores();
          if (onRetryTopic) {
            onRetryTopic();
          }
        }}
        onBackToTopics={() => {
          resetQuizState();
          if (onBackToTopics) {
            onBackToTopics();
          }
        }}
      />
    );
  }

  return (
    <main 
      className="flex-1 flex flex-col min-h-0 overflow-y-auto px-4 py-4 lg:px-6 bg-primary/60 relative" 
      style={{
        backgroundImage: `url('/backgrounds/random3.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundBlendMode: 'multiply'
      }}
      role="main"
    >
      {/* Glass blur overlay */}
      <div className="absolute inset-0 backdrop-blur-sm bg-primary/10"></div>
      
      {/* Left Arrow Navigation - Outside the main container */}
      <div className="absolute left-8 top-1/2 transform -translate-y-1/2 z-30">
        <Button
          variant="default"
          size="lg"
          onClick={handleBackButton}
          className="border-2 bg-purple-600 hover:bg-purple-700 text-white btn-animate h-16 w-16 p-0 rounded-full flex items-center justify-center"
          style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)', boxShadow: '0 4px 0 black' }}
          aria-label="Back"
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      </div>

      {/* Main container */}
      <div 
        className="relative responsive-max-width mx-auto my-4 flex-shrink-0"
        style={{ 
          width: '95%',
          maxWidth: '1520px',
          aspectRatio: getAspectRatio,
          minHeight: '500px',
          transition: 'all 0.3s ease-in-out'
        }}
      >
        {/* Background Container */}
        <div 
          className="absolute inset-0 rounded-3xl z-0"
          style={{ 
            border: '4px solid hsl(var(--primary) / 0.9)',
            boxShadow: '0 0 12px 3px rgba(0, 0, 0, 0.15)',
            backgroundColor: 'hsl(var(--primary) / 0.9)',
            overflow: 'hidden'
          }}
        />
        
        {/* Content Container */}
        <div 
          ref={containerRef}
          className="flex relative z-10 h-full w-full"
          style={{ 
            paddingTop: '12px',
            paddingBottom: '12px',
            paddingLeft: '8px',
            paddingRight: '8px'
          }}
        >
          {/* Main Content Panel */}
          <section 
            aria-label="MCQ content panel" 
            className="flex flex-col min-h-0 relative flex-1 transition-all duration-300 ease-in-out"
            style={{ marginRight: sidebarCollapsed ? '0px' : '5px' }}
          >

            
            {/* Question Card */}
<div className="flex items-start justify-center mb-10 relative z-40">
              <div 
                className={cn(
                  "relative bg-white rounded-3xl p-4 w-full",
                  isReadingComprehension ? "max-w-5xl" : "max-w-3xl"
                )}
                style={{
                  border: '4px solid black',
                  boxShadow: '0 8px 0 black',
                  borderRadius: '24px'
                }}
              >


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
                
                {/* Speaker button - positioned at bottom right inside notepad */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    playClickSound();
                    // Stop any current speech and speak the question
                    ttsService.stop();
                    
                    const questionTextToSpeak = isReadingComprehension
                      ? (contextualQuestions[currentQuestionIndex] || currentQuestion.passage || '')
                      : displayQuestionText;
                    
                    setIsSpeaking(true);
                    ttsService.speakQuestion(questionTextToSpeak).finally(() => {
                      setIsSpeaking(false);
                    });
                  }}
                  className="absolute bottom-4 right-4 h-12 w-12 rounded-lg border-2 border-black bg-white hover:bg-primary hover:text-primary-foreground z-10 transition-all duration-200 hover:scale-110"
                  style={{ boxShadow: '0 4px 0 black' }}
                  title="Read the question aloud"
                >
                  <Volume2 className="h-5 w-5" />
                </Button>

                {/* Question content */}
                <div className="mt-2">
                  <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">
                    Question {currentQuestionIndex + 1} of {currentTopic.questions.length}
                  </h2>
                  {/* {process.env.NODE_ENV === 'development' && (
                    // <div className="text-xs text-gray-500 text-center">
                    //   DEBUG: currentQuestionIndex={currentQuestionIndex}, startingQuestionIndex={startingQuestionIndex}
                    // </div>
                  )} */}
                  

                  
                  {!isReadingComprehension && (
                    <div className="text-xl font-medium text-gray-800 mb-4 text-center leading-relaxed">
                      {isGeneratingQuestion ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Creating your adventure question...</span>
                        </div>
                      ) : (
                        <p>{displayQuestionText}</p>
                      )}
                    </div>
                  )}
                  
                  {/* Reading Comprehension Passage - Inside Notebook */}
                  {isReadingComprehension && (
                    <div className="text-lg text-gray-800 mb-4 leading-relaxed p-4 border border-gray-200 rounded-lg bg-gray-50">
                      {isGeneratingQuestion ? (
                        <div className="flex items-center justify-center gap-2 py-4">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Creating your adventure reading passage...</span>
                        </div>
                      ) : (
                        <p className="leading-loose">
                          {contextualQuestions[currentQuestionIndex] || currentQuestion.passage}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Dynamic Image Section - Outside Notepad */}
            {!isReadingComprehension && (
              <div className={cn("mt-4 relative flex justify-center", isDragDropQuestion ? "mb-4" : "mb-6")}>
                {/* Centered Image Container */}
                <div className="relative">
                  <div 
                    className={cn(
                      "border-2 border-gray-300 rounded-xl overflow-hidden",
                      isDragDropQuestion ? "w-[28rem] h-[20rem]" : "w-[40rem] h-[32rem]"
                    )}
                    style={{
                      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)'
                    }}
                  >
                    {isGeneratingImage ? (
                      <div className="w-full h-full bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
                        <div className="text-center text-gray-600">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
                          <p className="text-sm font-medium">Creating your adventure image...</p>
                        </div>
                      </div>
                    ) : generatedImages[currentQuestionIndex] ? (
                      <div className="relative w-full h-full overflow-hidden">
                        {/* Blurred background image */}
                        <img 
                          src={generatedImages[currentQuestionIndex]} 
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover object-center"
                          style={{
                            filter: 'blur(20px) brightness(0.7) contrast(1.1) saturate(1.1)',
                            transform: 'scale(1.1)' // Slightly scale to avoid blur edges
                          }}
                        />
                        {/* Main image - original size, centered */}
                        <div className="relative w-full h-full flex items-center justify-center z-10">
                          <img 
                            src={generatedImages[currentQuestionIndex]} 
                            alt={`Illustration for ${currentQuestion.word}`}
                            className="max-w-full max-h-full"
                            style={{
                              filter: 'brightness(1.05) contrast(1.1) saturate(1.1)'
                            }}
                            onError={(e) => {
                              // If image fails to load, show placeholder
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const placeholder = target.closest('.relative')?.closest('.relative')?.nextElementSibling as HTMLElement;
                              if (placeholder) placeholder.style.display = 'flex';
                            }}
                          />
                        </div>
                      </div>
                    ) : null}
                    
                    {/* Fallback placeholder (hidden by default, shown on image error or no image) */}
                    <div 
                      className={cn(
                        "w-full h-full bg-gray-100 flex items-center justify-center",
                        !isGeneratingImage && !generatedImages[currentQuestionIndex] ? 'flex' : 'hidden'
                      )}
                    >
                      <div className="text-center text-gray-400">
                        <div className="text-4xl mb-4">🎨</div>
                        <p className="text-sm font-medium">Adventure image</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Speaker Button - Positioned closer to the left of the centered image */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleSpeakAnswer}
                  className="absolute left-32 top-1/2 transform -translate-y-1/2 h-28 w-28 rounded-full border-2 bg-primary/5 hover:bg-primary/10 text-white transition-all duration-200 hover:scale-110"
                  style={{ 
                    borderColor: 'hsl(var(--primary))', 
                    boxShadow: '0 8px 0 rgba(0, 0, 0, 0.3)' 
                  }}
                  title="Read the question description aloud"
                >
                  <Volume2 className="h-10 w-10 text-white" style={{ minHeight: '3rem', minWidth: '3rem' }} />
                </Button>
              </div>
            )}

            {/* Answer Options - MCQ, Drag Drop, or Fill Blank - Outside Notepad */}
            {isDragDropQuestion && isDragDropType(currentQuestion) ? (
              /* Drag and Drop Interface */
              <div className="space-y-3 mb-4">
                {/* Available Words to Sort */}
                <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-3">
                        <h3 className="text-lg font-bold text-blue-800 mb-2 text-center">Words to Sort</h3>
                        <div className="flex flex-wrap justify-center gap-3 min-h-[60px] items-center">
                          {availableWords.map((word) => (
                            <div
                              key={word}
                              draggable
                              onDragStart={() => handleDragStart(word)}
                              className="bg-white border-2 border-blue-600 rounded-xl px-4 py-2 font-medium text-lg cursor-grab active:cursor-grabbing transition-all duration-200 hover:scale-105 hover:shadow-md"
                              style={{ boxShadow: '0 2px 0 #2563eb' }}
                            >
                              {word}
                            </div>
                          ))}
                          {availableWords.length === 0 && (
                            <p className="text-blue-600 font-medium italic">All words sorted! 🎉</p>
                          )}
                        </div>
                      </div>

                      {/* Sorting Bins */}
                      <div className="grid grid-cols-2 gap-4">
                        {currentQuestion.sortingBins.map((binName) => (
                          <div
                            key={binName}
                            onDragOver={(e) => handleDragOver(e, binName)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, binName)}
                            className={cn(
                              "border-2 border-dashed rounded-xl p-3 min-h-[100px] transition-all duration-200",
                              isDragOverBin === binName
                                ? "border-green-500 bg-green-50 scale-105"
                                : "border-gray-400 bg-gray-50 hover:bg-gray-100"
                            )}
                          >
                            <h3 className="text-lg font-bold text-center mb-2 text-gray-700">{binName}</h3>
                            <div className="space-y-2 min-h-[50px]">
                              {sortedWords[binName]?.map((word) => (
                                <div
                                  key={word}
                                  onClick={() => handleRemoveFromBin(word, binName)}
                                  className="bg-white border-2 border-gray-600 rounded-lg px-3 py-2 font-medium text-center cursor-pointer transition-all duration-200 hover:bg-red-50 hover:border-red-400"
                                  style={{ boxShadow: '0 2px 0 #4b5563' }}
                                  title="Click to remove from bin"
                                >
                                  {word}
                                </div>
                              )) || null}
                              {(!sortedWords[binName] || sortedWords[binName].length === 0) && (
                                <div className="text-center text-gray-400 italic py-3">
                                  Drop words here
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Check Answer Button */}
                      <div className="flex justify-center">
                        <Button
                          onClick={handleCheckDragDropAnswer}
                          disabled={hasAnswered && isCorrect}
                          className="border-2 bg-blue-600 hover:bg-blue-700 text-white btn-animate px-8 py-3 text-lg font-bold"
                          style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)', boxShadow: '0 4px 0 black' }}
                        >
                          Check My Sorting
                        </Button>
                      </div>
                    </div>
            ) : currentQuestion.templateType === 'fill_blank' ? (
              /* Fill Blank Interface */
              <div className="space-y-3 mb-4">
                <div className="flex flex-col items-center gap-3">
                  {/* TYPE THE WORD YOU HEAR heading */}
                  <h3 className="text-2xl font-bold text-white mb-2 text-center">
                    TYPE THE WORD YOU HEAR!
                  </h3>
                  
                  {/* Individual letter blanks */}
                  <div className="flex justify-center gap-2 mb-3">
                    {Array.from({ length: (currentQuestion as FillBlankQuestion).correctAnswer.length }).map((_, index) => (
                      <input
                        key={index}
                        type="text"
                        maxLength={1}
                        value={fillBlankAnswer[index] || ''}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          const newAnswer = fillBlankAnswer.split('');
                          newAnswer[index] = target.value.toUpperCase();
                          const updatedAnswer = newAnswer.join('');
                          setFillBlankAnswer(updatedAnswer);
                          
                          // Auto-focus next input if current is filled
                          if (target.value && index < (currentQuestion as FillBlankQuestion).correctAnswer.length - 1) {
                            const nextInput = target.parentElement?.children[index + 1] as HTMLInputElement;
                            nextInput?.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleFillBlankSubmit();
                          } else if (e.key === 'Backspace' && !e.currentTarget.value && index > 0) {
                            // Move to previous input on backspace if current is empty
                            const prevInput = (e.target as HTMLInputElement).parentElement?.children[index - 1] as HTMLInputElement;
                            prevInput?.focus();
                          }
                        }}
                        disabled={(hasAnswered && isCorrect) || isGeneratingQuestion || isInReflectionMode}
                        className={cn(
                          "w-12 h-12 text-center text-2xl font-bold rounded-lg border-2 transition-all duration-200",
                          "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500",
                          (hasAnswered && isCorrect) ? "bg-green-100 border-green-500 text-green-800" : "bg-white border-gray-400",
                          isGeneratingQuestion && "opacity-50 cursor-not-allowed"
                        )}
                        style={{
                          boxShadow: hasAnswered && isCorrect ? '0 3px 0 #10b981' : '0 3px 0 #9ca3af'
                        }}
                      />
                    ))}
                  </div>
                  
                  <Button
                    onClick={handleFillBlankSubmit}
                    disabled={(hasAnswered && isCorrect) || isGeneratingQuestion || isInReflectionMode || !fillBlankAnswer.trim()}
                    className={cn(
                      "border-2 text-white btn-animate px-8 py-3 text-lg font-bold transition-all duration-200",
                      hasAnswered && isCorrect 
                        ? "bg-green-600 hover:bg-green-700 border-green-700"
                        : "bg-primary/70 hover:bg-primary/80 border-primary"
                    )}
                    style={{
                      boxShadow: hasAnswered && isCorrect ? '0 4px 0 #10b981' : '0 4px 0 black'
                    }}
                  >
                    {hasAnswered && isCorrect ? (
                      <div className="flex items-center gap-2">
                        <Check className="h-5 w-5" />
                        <span>Correct!</span>
                      </div>
                    ) : (
                      'Submit Answer'
                    )}
                  </Button>
                </div>
              </div>
            ) : isReadingComprehension ? (
              /* Reading Comprehension Interface */
              <div className="space-y-4 mb-4">
                {/* Image Section with Speaker Button */}
                <div className="mt-4 relative flex justify-center mb-6">
                  {/* Centered Image Container */}
                  <div className="relative">
                    <div 
                      className="w-[28rem] h-[20rem] border-2 border-gray-300 rounded-xl overflow-hidden"
                      style={{
                        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)'
                      }}
                    >
                      {isGeneratingImage ? (
                        <div className="w-full h-full bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
                          <div className="text-center text-gray-600">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
                            <p className="text-sm font-medium">Creating your adventure image...</p>
                          </div>
                        </div>
                      ) : generatedImages[currentQuestionIndex] ? (
                        <div className="relative w-full h-full overflow-hidden">
                          {/* Blurred background image */}
                          <img 
                            src={generatedImages[currentQuestionIndex]} 
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover object-center"
                            style={{
                              filter: 'blur(20px) brightness(0.7) contrast(1.1) saturate(1.1)',
                              transform: 'scale(1.1)' // Slightly scale to avoid blur edges
                            }}
                          />
                          {/* Main image - original size, centered */}
                          <div className="relative w-full h-full flex items-center justify-center z-10">
                            <img 
                              src={generatedImages[currentQuestionIndex]} 
                              alt={`Illustration for ${currentQuestion.word}`}
                              className="max-w-full max-h-full"
                              style={{
                                filter: 'brightness(1.05) contrast(1.1) saturate(1.1)'
                              }}
                              onError={(e) => {
                                // If image fails to load, show placeholder
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const placeholder = target.closest('.relative')?.closest('.relative')?.nextElementSibling as HTMLElement;
                                if (placeholder) placeholder.style.display = 'flex';
                              }}
                            />
                          </div>
                        </div>
                      ) : null}
                      
                      {/* Fallback placeholder (hidden by default, shown on image error or no image) */}
                      <div 
                        className={cn(
                          "w-full h-full bg-gray-100 flex items-center justify-center",
                          !isGeneratingImage && !generatedImages[currentQuestionIndex] ? 'flex' : 'hidden'
                        )}
                      >
                        <div className="text-center text-gray-400">
                          <div className="text-4xl mb-4">🎨</div>
                          <p className="text-sm font-medium">Adventure image</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Speaker Button - Positioned closer to the left of the centered image */}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleSpeakPassage}
                    className="absolute left-20 top-1/2 transform -translate-y-1/2 h-24 w-24 rounded-full border-2 bg-primary/5 hover:bg-primary/10 text-white transition-all duration-200 hover:scale-110"
                    style={{ 
                      borderColor: 'hsl(var(--primary))', 
                      boxShadow: '0 8px 0 rgba(0, 0, 0, 0.3)' 
                    }}
                    title="Read the passage aloud"
                  >
                    <Volume2 className="h-8 w-8 text-white" style={{ minHeight: '2.5rem', minWidth: '2.5rem' }} />
                  </Button>
                </div>

                {/* Microphone Controls */}
                <div className="flex justify-center">
                  <div className="w-full max-w-md">
                    <h3 className="text-xl font-bold text-white mb-4 text-center">Read the passage aloud!</h3>
                    
                    {/* Microphone Button */}
                    <div className="flex justify-center mb-4">
                      <Button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={hasAnswered && isCorrect}
                        className={cn(
                          "rounded-full w-20 h-20 border-4 transition-all duration-200",
                          isRecording 
                            ? "bg-red-500 hover:bg-red-600 border-red-600 animate-pulse" 
                            : "bg-blue-500 hover:bg-blue-600 border-blue-600 hover:scale-110"
                        )}
                        style={{
                          boxShadow: isRecording ? '0 6px 0 #dc2626' : '0 6px 0 #2563eb'
                        }}
                      >
                        <Mic className={cn("text-white", isRecording && "animate-pulse")} style={{ height: '2rem', width: '2rem' }} />
                      </Button>
                    </div>
                    
                    {/* Recording Status */}
                    <div className="text-center">
                      {isRecording ? (
                        <p className="text-red-600 font-medium animate-pulse">
                          🎤 Recording... Speak clearly!
                        </p>
                      ) : recordedText ? (
                        <div className="space-y-2">
                          <p className="text-green-600 font-medium">✓ Recording complete!</p>
                          <div className="bg-gray-100 border border-gray-300 rounded-lg p-3">
                            <p className="text-sm text-gray-700 italic">"{recordedText}"</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-lg font-medium text-white">
                          Click the microphone to start reading
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* MCQ Interface - All 4 Options Side by Side with Individual Text-Based Sizing */
              <div className="flex flex-wrap justify-center items-start gap-8 mb-2 mt-8">
                {(currentQuestion as MCQQuestion).options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswerClick(index)}
                    disabled={(hasAnswered && isCorrect) || isGeneratingQuestion || isInReflectionMode}
                    className={cn(
                      "text-center rounded-xl border-3 border-black transition-all duration-200 hover:scale-[1.02] font-medium text-2xl inline-flex flex-col items-center justify-center gap-2",
                      hasAnswered && isCorrect && index === (currentQuestion as MCQQuestion).correctAnswer && "bg-green-200 border-green-600",
                      index === selectedAnswer && !isCorrect && "bg-red-100 border-red-400 animate-pulse",
                      (!hasAnswered || !isCorrect) && !isGeneratingQuestion && "bg-white hover:bg-primary/10 cursor-pointer",
                      hasAnswered && isCorrect && index !== (currentQuestion as MCQQuestion).correctAnswer && "bg-white border-black",
                      ((hasAnswered && isCorrect) || isGeneratingQuestion) && "cursor-not-allowed",
                      isGeneratingQuestion && "opacity-50"
                    )}
                    style={{ 
                      padding: '5px 20px 5px 20px', // Reduce horizontal padding
                      boxShadow: hasAnswered && isCorrect && index === (currentQuestion as MCQQuestion).correctAnswer 
                        ? '0 4px 0 #16a34a' 
                        : index === selectedAnswer && !isCorrect
                          ? '0 3px 0 #f87171' 
                          : '0 4px 0 black'
                    }}
                  >
                    <span className="text-center leading-tight whitespace-nowrap w-full flex items-center justify-center">
                      {option}
                    </span>
                    {/* {hasAnswered && isCorrect && index === (currentQuestion as MCQQuestion).correctAnswer && (
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                    )} */}
                  </button>
                ))}
              </div>
            )}
            


            {/* Next Question Button - Show after answering */}
            {showFeedback && !isInReflectionMode && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="default"
                  size="lg"
                  onClick={handleNextQuestion}
                  className="border-2 bg-green-600 hover:bg-green-700 text-white btn-animate px-8 py-3 text-lg font-bold"
                  style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)', boxShadow: '0 4px 0 black' }}
                >
                  {currentQuestionIndex < currentTopic.questions.length - 1 ? 'Next Question' : 'Finish Adventure'}
                </Button>
              </div>
            )}
            
            {/* Reflection mode indicator - Outside Notepad */}
            {isInReflectionMode && (
              <div className="flex justify-center mt-4">
                <div className="bg-yellow-100 border-2 border-yellow-400 rounded-xl px-6 py-3 text-center">
                  <p className="text-lg font-medium text-yellow-800">
                    💭 Think about it and share your thoughts in the chat!
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Right Sidebar */}
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
                          <p>📚 Answer the questions and get feedback from Krafty!</p>
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
                        ))
                      )}
                    </div>
                  </div>
                  
                  {/* Input Bar */}
                  <div className="flex-shrink-0 p-3 border-t border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
                    <InputBar onGenerate={handleGenerate} onGenerateImage={onGenerateImage} />
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

export default MCQScreenTypeA;
