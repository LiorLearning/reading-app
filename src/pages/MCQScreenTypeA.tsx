import React, { useCallback, useState, useEffect } from "react";
import { cn, loadUserAdventure } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Volume2, Check, X, Loader2, VolumeX } from "lucide-react";
import { playClickSound, playMessageSound } from "@/lib/sounds";
import ChatAvatar from "@/components/comic/ChatAvatar";
import InputBar from "@/components/comic/InputBar";
import { aiService } from "@/lib/ai-service";
import { ttsService } from "@/lib/tts-service";

// TypeScript interfaces for MCQ data structure
interface AIHook {
  targetWord: string;
  intent: string;
  questionLine: string;
  imagePrompt: string;
}

interface MCQQuestion {
  id: number;
  topicId: string;
  topicName: string;
  questionElements: string;
  answerElements: string;
  templateType: string;
  word: string;
  imageUrl: string | null;
  explanation: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  template: string;
  isSpacing: boolean;
  isSorting: boolean;
  isSpelling: boolean;
  aiHook: AIHook;
}

interface TopicInfo {
  topicId: string;
  topicName: string;
  questionElements: string;
  answerElements: string;
  templateType: string;
}

interface Topic {
  topicInfo: TopicInfo;
  questions: MCQQuestion[];
}

interface MCQData {
  topics: Record<string, Topic>;
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
}

// Sample MCQ data - this would normally come from an API or JSON file
const sampleMCQData: MCQData = {
  "topics": {
    "K-F.2": {
      "topicInfo": {
        "topicId": "K-F.2",
        "topicName": "Choose_the_sentence_that_is_spaced_correctly",
        "questionElements": "audio + text+image",
        "answerElements": "text",
        "templateType": "mcq"
      },
      "questions": [
        {
          "id": 1,
          "topicId": "K-F.2",
          "topicName": "Choose_the_sentence_that_is_spaced_correctly",
          "questionElements": "audio + text+image",
          "answerElements": "text",
          "templateType": "mcq",
          "word": "sentence spacing",
          "imageUrl": null,
          "explanation": "Great job! That sentence is spaced correctly. Proper spacing between words makes reading easier.",
          "questionText": "Which sentence is spaced correctly?",
          "options": [
            "Myname is John.",
            "My nameis John.", 
            "My name is John.",
            "MynameisJohn."
          ],
          "correctAnswer": 2,
          "template": "mcq",
          "isSpacing": true,
          "isSorting": false,
          "isSpelling": false,
          "aiHook": {
            "targetWord": "sentence spacing",
            "intent": "mcq",
            "questionLine": "Which sentence is spaced correctly?",
            "imagePrompt": "Educational scene showing choose_the_sentence_that_is_spaced_correctly concepts"
          }
        },
        {
          "id": 2,
          "topicId": "K-F.2", 
          "topicName": "Adventure_Reading_Comprehension",
          "questionElements": "audio + text+image",
          "answerElements": "text",
          "templateType": "mcq",
          "word": "adventure comprehension",
          "imageUrl": null,
          "explanation": "Excellent! Captain Asher found a map in the story. Maps help adventurers navigate new places.",
          "questionText": "What did Captain Asher find in the moon jungle?",
          "options": [
            "A treasure chest",
            "A magical map", 
            "A friendly alien",
            "A spaceship"
          ],
          "correctAnswer": 1,
          "template": "mcq",
          "isSpacing": false,
          "isSorting": false,
          "isSpelling": false,
          "aiHook": {
            "targetWord": "adventure comprehension",
            "intent": "mcq",
            "questionLine": "What did Captain Asher find in the moon jungle?",
            "imagePrompt": "Adventure scene with Captain Asher discovering a map in a mystical moon jungle"
          }
        }
      ]
    }
  }
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
  handleResizeStart
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const resizeRef = React.useRef<HTMLDivElement>(null);
  
  // MCQ state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  
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

  // Get current topic and questions
  const currentTopic = sampleMCQData.topics["K-F.2"];
  const currentQuestion = currentTopic.questions[currentQuestionIndex];
  
  // Get the contextual question text or fall back to original
  const displayQuestionText = contextualQuestions[currentQuestionIndex] || currentQuestion.questionText;
  


  const handleAnswerClick = useCallback(async (answerIndex: number) => {
    if (hasAnswered || isGeneratingQuestion) return;
    
    playClickSound();
    setSelectedAnswer(answerIndex);
    setHasAnswered(true);
    
    const correct = answerIndex === currentQuestion.correctAnswer;
    setIsCorrect(correct);
    
    if (correct) {
      // Correct answer - show celebration immediately
      setShowFeedback(true);
      const feedbackMessage = {
        type: 'ai' as const,
        content: `🎉 ${currentQuestion.explanation}`,
        timestamp: Date.now()
      };
      
      setChatMessages((prev: any) => [...prev, feedbackMessage]);
      playMessageSound();
      
      // Auto-speak the AI feedback message
      ttsService.speakAIMessage(feedbackMessage.content);
    } else {
      // Wrong answer - enter reflection mode instead of showing correct answer
      setIsInReflectionMode(true);
      
      try {
        // Generate reflection prompt using AI
        const reflectionPrompt = await aiService.generateReflectionPrompt(
          currentQuestion.questionText,
          currentQuestion.options,
          answerIndex,
          currentQuestion.correctAnswer
        );
        
        const reflectionMessage = {
          type: 'ai' as const,
          content: reflectionPrompt,
          timestamp: Date.now()
        };
        
        setChatMessages((prev: any) => [...prev, reflectionMessage]);
        playMessageSound();
        
        // Auto-speak the reflection prompt
        ttsService.speakAIMessage(reflectionMessage.content);
      } catch (error) {
        // Fallback reflection message if AI fails
        const fallbackMessage = {
          type: 'ai' as const,
          content: `🤔 Hmm, that's not quite right! Can you think about why "${currentQuestion.options[answerIndex]}" might not be the best answer? What clues in the question might help you?`,
          timestamp: Date.now()
        };
        
        setChatMessages((prev: any) => [...prev, fallbackMessage]);
        playMessageSound();
        
        // Auto-speak the fallback reflection message
        ttsService.speakAIMessage(fallbackMessage.content);
      }
    }
    
    // Auto-expand chat to show feedback
    setSidebarCollapsed(false);
  }, [hasAnswered, isGeneratingQuestion, currentQuestion, setChatMessages, setSidebarCollapsed]);

  // Handle student reflection response
  const handleReflectionResponse = useCallback((studentReflection: string) => {
    if (!isInReflectionMode) return;
    
    // Student has provided their reflection, now reveal the correct answer
    setHasReflected(true);
    setIsInReflectionMode(false);
    setShowFeedback(true);
    
    // Generate response acknowledging their thinking and revealing the correct answer
    const correctAnswer = currentQuestion.options[currentQuestion.correctAnswer];
    const encouragementMessage = {
      type: 'ai' as const,
      content: `Thank you for thinking about it! 🤗 The correct answer is: "${correctAnswer}". ${currentQuestion.explanation} You're doing great by thinking through the question!`,
      timestamp: Date.now()
    };
    
    setChatMessages((prev: any) => [...prev, encouragementMessage]);
    playMessageSound();
    
    // Auto-speak the encouragement message
    ttsService.speakAIMessage(encouragementMessage.content);
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

  const handleNextQuestion = useCallback(() => {
    playClickSound();
    if (currentQuestionIndex < currentTopic.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setIsCorrect(false);
      setHasAnswered(false);
      setIsInReflectionMode(false);
      setHasReflected(false);
      setHasAutoSpokenQuestion(false); // Reset auto-speech state for new question
    } else {
      // All questions completed
      const completionMessage = {
        type: 'ai' as const,
        content: `🌟 Congratulations! You've completed all the questions in this adventure. Great job learning about ${currentTopic.topicInfo.topicName.replace(/_/g, ' ')}!`,
        timestamp: Date.now()
      };
      setChatMessages((prev: any) => [...prev, completionMessage]);
      playMessageSound();
      
      // Auto-speak the completion message
      ttsService.speakAIMessage(completionMessage.content);
    }
  }, [currentQuestionIndex, currentTopic, setChatMessages]);

  const handleSpeakerClick = useCallback(() => {
    playClickSound();
    
    // Toggle speech - stop if currently speaking, otherwise start
    if (ttsService.getIsSpeaking()) {
      ttsService.stop();
      setIsSpeaking(false);
    } else {
      // Read the question aloud (use contextual question if available)
      setIsSpeaking(true);
      ttsService.speakQuestion(displayQuestionText).finally(() => {
        setIsSpeaking(false);
      });
    }
  }, [displayQuestionText]);

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
        
        const contextualQuestionText = await aiService.generateContextualQuestion(
          currentQuestion.questionText,
          currentQuestion.options,
          currentQuestion.correctAnswer,
          userAdventure
        );

        // Only update if we got a different question (AI successfully generated one)
        if (contextualQuestionText !== currentQuestion.questionText) {
          setContextualQuestions(prev => ({
            ...prev,
            [currentQuestionIndex]: contextualQuestionText
          }));
        }
      } catch (error) {
        console.error('Error generating contextual question:', error);
        // If generation fails, we'll use the original question (which is the fallback)
      } finally {
        setIsGeneratingQuestion(false);
      }
    };

    generateContextualQuestion();
  }, [currentQuestionIndex, currentQuestion.questionText, currentQuestion.options, currentQuestion.correctAnswer]);

  // Generate contextual image when component mounts or question changes
  useEffect(() => {
    const generateContextualImage = async () => {
      // Skip if we already have an image for this index
      if (generatedImages[currentQuestionIndex]) {
        return;
      }

      setIsGeneratingImage(true);
      
      try {
        // Load user adventure context
        const userAdventure = loadUserAdventure();
        
        const imageUrl = await aiService.generateContextualImage(
          currentQuestion.word,
          userAdventure,
          currentQuestion.aiHook.imagePrompt
        );

        // Only update if we got a valid image URL
        if (imageUrl) {
          setGeneratedImages(prev => ({
            ...prev,
            [currentQuestionIndex]: imageUrl
          }));
        }
      } catch (error) {
        console.error('Error generating contextual image:', error);
        // If generation fails, we'll show the placeholder
      } finally {
        setIsGeneratingImage(false);
      }
    };

    generateContextualImage();
  }, [currentQuestionIndex, currentQuestion.word, currentQuestion.aiHook.imagePrompt]);

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

  // Handle speaking the correct answer
  const handleSpeakAnswer = useCallback(() => {
    playClickSound();
    
    // Stop any current speech and speak the correct answer
    ttsService.stop();
    const correctAnswerText = currentQuestion.options[currentQuestion.correctAnswer];
    
    setIsSpeaking(true);
    ttsService.speakAnswer(`The correct answer is: ${correctAnswerText}`).finally(() => {
      setIsSpeaking(false);
    });
  }, [currentQuestion]);

  return (
    <main 
      className="flex-1 flex items-center justify-center min-h-0 overflow-hidden px-4 py-4 lg:px-6 bg-primary/60 relative" 
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
      
      {/* Main container */}
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
            paddingTop: '8px',
            paddingBottom: '8px',
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
            <div className="flex-1 flex items-center justify-center mb-2 relative z-10">
              <div 
                className="relative bg-white rounded-3xl p-8 max-w-3xl w-full"
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
                  onClick={handleSpeakerClick}
                  className={cn(
                    "absolute top-4 right-4 h-12 w-12 rounded-lg border-2 border-black bg-white hover:bg-primary hover:text-primary-foreground z-10 transition-all duration-200 hover:scale-110",
                    isSpeaking && "bg-primary text-primary-foreground animate-pulse"
                  )}
                  style={{ boxShadow: '0 4px 0 black' }}
                  title={isSpeaking ? "Stop speaking" : "Read question aloud"}
                >
                  {isSpeaking ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
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
                
                {/* Question content */}
                <div className="mt-4">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                    Question {currentQuestionIndex + 1} of {currentTopic.questions.length}
                  </h2>
                  
                  <div className="text-xl font-medium text-gray-800 mb-8 text-center leading-relaxed">
                    {isGeneratingQuestion ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Creating your adventure question...</span>
                      </div>
                    ) : (
                      <p>{displayQuestionText}</p>
                    )}
                  </div>
                  
                  {/* Dynamic Image Section */}
                  <div className="mb-8 flex justify-center">
                    <div className="relative">
                      <div 
                        className="w-64 h-48 border-2 border-gray-300 rounded-xl overflow-hidden"
                        style={{
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
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
                          <img 
                            src={generatedImages[currentQuestionIndex]} 
                            alt={`Illustration for ${currentQuestion.word}`}
                            className="w-full h-full object-cover"
                            style={{
                              filter: 'brightness(1.05) contrast(1.1) saturate(1.1)'
                            }}
                            onError={(e) => {
                              // If image fails to load, show placeholder
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const placeholder = target.nextElementSibling as HTMLElement;
                              if (placeholder) placeholder.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        
                        {/* Fallback placeholder (hidden by default, shown on image error or no image) */}
                        <div 
                          className={cn(
                            "w-full h-full bg-gray-100 flex items-center justify-center",
                            !isGeneratingImage && !generatedImages[currentQuestionIndex] ? 'flex' : 'hidden'
                          )}
                        >
                          <div className="text-center text-gray-400">
                            <div className="text-4xl mb-2">🎨</div>
                            <p className="text-sm font-medium">Adventure image</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Answer Speaker Button - only show when answered and correct */}
                      {showFeedback && isCorrect && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleSpeakAnswer}
                          className={cn(
                            "absolute -bottom-3 -right-3 h-10 w-10 rounded-full border-2 border-green-600 bg-green-100 hover:bg-green-200 z-10 transition-all duration-200 hover:scale-110",
                            isSpeaking && "animate-pulse"
                          )}
                          style={{ boxShadow: '0 3px 0 #16a34a' }}
                          title="Read the correct answer aloud"
                        >
                          <Volume2 className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Answer Options */}
                  <div className="space-y-4">
                    {currentQuestion.options.map((option, index) => (
                      <button
                        key={index}
                        onClick={() => handleAnswerClick(index)}
                        disabled={hasAnswered || isGeneratingQuestion}
                        className={cn(
                          "w-full p-4 text-left rounded-xl border-3 border-black transition-all duration-200 hover:scale-[1.02] font-medium text-lg",
                          hasAnswered && index === currentQuestion.correctAnswer && "bg-green-200 border-green-600",
                          hasAnswered && index === selectedAnswer && index !== currentQuestion.correctAnswer && "bg-red-200 border-red-600",
                          !hasAnswered && !isGeneratingQuestion && "bg-white hover:bg-primary/10 cursor-pointer",
                          (hasAnswered || isGeneratingQuestion) && "cursor-not-allowed",
                          isGeneratingQuestion && "opacity-50"
                        )}
                        style={{ 
                          boxShadow: hasAnswered 
                            ? (index === currentQuestion.correctAnswer ? '0 4px 0 #16a34a' : 
                               index === selectedAnswer ? '0 4px 0 #dc2626' : '0 4px 0 black')
                            : '0 4px 0 black'
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span>{option}</span>
                          {hasAnswered && index === currentQuestion.correctAnswer && (
                            <Check className="h-6 w-6 text-green-600" />
                          )}
                          {hasAnswered && index === selectedAnswer && index !== currentQuestion.correctAnswer && (
                            <X className="h-6 w-6 text-red-600" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  
                  {/* Next Question Button */}
                  {showFeedback && !isInReflectionMode && (
                    <div className="flex justify-center mt-8">
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
                  
                  {/* Reflection mode indicator */}
                  {isInReflectionMode && (
                    <div className="flex justify-center mt-8">
                      <div className="bg-yellow-100 border-2 border-yellow-400 rounded-xl px-6 py-3 text-center">
                        <p className="text-lg font-medium text-yellow-800">
                          💭 Think about it and share your thoughts in the chat!
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
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
