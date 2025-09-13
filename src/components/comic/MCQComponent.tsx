import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Volume2, ChevronRight, RotateCcw } from 'lucide-react';
import { playClickSound } from '@/lib/sounds';
import { voiceAgentService } from '@/lib/voice-agent-service';

// Types for the MCQ structure
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

interface MCQComponentProps {
  onComplete?: (score: number, total: number) => void;
  onQuestionAnswered?: (questionId: number, isCorrect: boolean) => void;
}

const MCQComponent: React.FC<MCQComponentProps> = ({ onComplete, onQuestionAnswered }) => {
  // State management
  const [mcqData, setMcqData] = useState<MCQData | null>(null);
  const [currentTopicId, setCurrentTopicId] = useState<string>('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [questionsAnswered, setQuestionsAnswered] = useState<number>(0);
  const [isReading, setIsReading] = useState<boolean>(false);
  const [hasVoiceFeedback, setHasVoiceFeedback] = useState<boolean>(false);

  // Load MCQ data from JSON
  useEffect(() => {
    const loadMCQData = async () => {
      try {
        // Try importing directly from src first
        const data = await import('../../data/mcq-questions.json');
        setMcqData(data.default || data);
        const firstTopicId = Object.keys((data.default || data).topics)[0];
        setCurrentTopicId(firstTopicId);
      } catch (error) {
        console.error('Error loading MCQ data:', error);
        // Fallback - try fetching from public
        try {
          const response = await fetch('/data/mcq-questions.json');
          const data: MCQData = await response.json();
          setMcqData(data);
          const firstTopicId = Object.keys(data.topics)[0];
          setCurrentTopicId(firstTopicId);
        } catch (err) {
          console.error('Failed to load MCQ data:', err);
        }
      }
    };

    loadMCQData();
  }, []);

  // Get current question
  const currentQuestion = mcqData && currentTopicId 
    ? mcqData.topics[currentTopicId]?.questions[currentQuestionIndex]
    : null;

  const currentTopic = mcqData && currentTopicId 
    ? mcqData.topics[currentTopicId]
    : null;

  // Handle option selection
  const handleOptionSelect = useCallback(async (optionIndex: number) => {
    if (isAnswered) return;
    
    playClickSound();
    setSelectedAnswer(optionIndex);
    setIsAnswered(true);
    setShowFeedback(true);
    
    const isCorrect = optionIndex === currentQuestion?.correctAnswer;
    if (isCorrect) {
      setScore(prev => prev + 1);
    }
    
    setQuestionsAnswered(prev => prev + 1);
    
    // Trigger voice agent for incorrect answers
    if (!isCorrect && currentQuestion) {
      try {
        const correctAnswer = currentQuestion.options[currentQuestion.correctAnswer];
        const userAnswer = currentQuestion.options[optionIndex];
        const questionContext = currentQuestion.questionText;
        
        // Trigger voice agent with teaching response
        await voiceAgentService.handleIncorrectAnswer(
          currentQuestion.id.toString(),
          correctAnswer,
          userAnswer,
          questionContext
        );
        setHasVoiceFeedback(true);
      } catch (error) {
        console.error('Error triggering voice agent:', error);
      }
    }
    
    // Notify parent component
    if (onQuestionAnswered && currentQuestion) {
      onQuestionAnswered(currentQuestion.id, isCorrect);
    }
  }, [isAnswered, currentQuestion, onQuestionAnswered]);

  // Handle next question
  const handleNextQuestion = useCallback(() => {
    if (!currentTopic) return;
    
    playClickSound();
    
    const totalQuestions = currentTopic.questions.length;
    const allTopics = Object.keys(mcqData?.topics || {});
    const currentTopicIndex = allTopics.indexOf(currentTopicId);
    
    if (currentQuestionIndex < totalQuestions - 1) {
      // Next question in current topic
      setCurrentQuestionIndex(prev => prev + 1);
    } else if (currentTopicIndex < allTopics.length - 1) {
      // Next topic
      const nextTopicId = allTopics[currentTopicIndex + 1];
      setCurrentTopicId(nextTopicId);
      setCurrentQuestionIndex(0);
    } else {
      // All questions completed
      if (onComplete) {
        onComplete(score, questionsAnswered);
      }
      return;
    }
    
    // Reset state for next question
    setSelectedAnswer(null);
    setIsAnswered(false);
    setShowFeedback(false);
  }, [currentTopic, currentQuestionIndex, currentTopicId, mcqData, score, questionsAnswered, onComplete]);

  // Handle restart quiz
  const handleRestart = useCallback(() => {
    playClickSound();
    setCurrentQuestionIndex(0);
    setCurrentTopicId(Object.keys(mcqData?.topics || {})[0]);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setShowFeedback(false);
    setScore(0);
    setQuestionsAnswered(0);
  }, [mcqData]);

  // Handle text-to-speech
  const handleSpeakerClick = useCallback(() => {
    playClickSound();
    
    if (isReading) {
      window.speechSynthesis.cancel();
      setIsReading(false);
      return;
    }
    
    if (!currentQuestion) return;
    
    setIsReading(true);
    const utterance = new SpeechSynthesisUtterance(currentQuestion.questionText);
    utterance.rate = 0.8;
    utterance.pitch = 1.1;
    
    utterance.onend = () => setIsReading(false);
    utterance.onerror = () => setIsReading(false);
    
    window.speechSynthesis.speak(utterance);
  }, [isReading, currentQuestion]);

  // Loading state
  if (!mcqData || !currentQuestion) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading questions...</p>
        </div>
      </div>
    );
  }

  const totalQuestions = Object.values(mcqData.topics).reduce((total, topic) => total + topic.questions.length, 0);
  const currentQuestionNumber = Object.keys(mcqData.topics)
    .slice(0, Object.keys(mcqData.topics).indexOf(currentTopicId))
    .reduce((total, topicId) => total + mcqData.topics[topicId].questions.length, 0) + currentQuestionIndex + 1;

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto">
      {/* Story Text Card - Top */}
      <div className="mb-6 relative z-10">
        <div 
          className="relative bg-white rounded-3xl p-8 max-w-4xl w-full"
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

          {/* Notebook spiral binding */}
          <div className="absolute top-0 left-0 right-0 h-6 flex justify-evenly items-center px-4">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="relative">
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
            className="mt-4 text-lg font-medium text-gray-800 relative pr-16"
            style={{
              lineHeight: '2.5rem',
              backgroundImage: 'repeating-linear-gradient(transparent, transparent 2.4rem, #e5e7eb 2.4rem, #e5e7eb 2.5rem)',
              paddingTop: '0.1rem'
            }}
          >
            {currentQuestion.questionText}
          </div>
        </div>
      </div>

      {/* Central Image and Options Section */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        {/* Image and Speaker Section */}
        <div className="flex items-center gap-6">
          {/* Speaker button - left side */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleSpeakerClick}
            className="h-16 w-16 rounded-2xl border-2 border-black bg-white hover:bg-primary hover:text-primary-foreground transition-all duration-200 hover:scale-110"
            style={{ boxShadow: '0 4px 0 black' }}
          >
            <Volume2 className="h-6 w-6" />
          </Button>

          {/* Central Image */}
          <div 
            className="w-48 h-32 rounded-2xl flex items-center justify-center text-6xl"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: '3px solid white',
              boxShadow: '0 6px 0 black'
            }}
          >
            {currentQuestion.imageUrl || '🚀'}
          </div>
        </div>

        {/* Option Buttons */}
        <div className="flex gap-6">
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedAnswer === index;
            const isCorrect = index === currentQuestion.correctAnswer;
            const showResult = showFeedback;
            
            let buttonStyle = "border-2 border-black bg-white hover:bg-gray-100 text-gray-800";
            
            if (showResult) {
              if (isSelected && isCorrect) {
                buttonStyle = "border-2 border-green-500 bg-green-100 text-green-800";
              } else if (isSelected && !isCorrect) {
                buttonStyle = "border-2 border-red-500 bg-red-100 text-red-800";
              } else if (isCorrect) {
                buttonStyle = "border-2 border-green-500 bg-green-50 text-green-700";
              }
            } else if (isSelected) {
              buttonStyle = "border-2 border-primary bg-primary/10 text-primary";
            }

            return (
              <Button
                key={index}
                variant="ghost"
                onClick={() => handleOptionSelect(index)}
                disabled={isAnswered}
                className={cn(
                  "h-16 w-16 text-lg font-bold rounded-2xl transition-all duration-200",
                  buttonStyle
                )}
                style={{ boxShadow: isAnswered ? 'none' : '0 4px 0 black' }}
              >
                {option}
              </Button>
            );
          })}
        </div>

        {/* Feedback and Next Button */}
        {showFeedback && (
          <div className="text-center mt-6">
            <div className="mb-4">
              <p className="text-white text-xl font-bold mb-2">
                {selectedAnswer === currentQuestion.correctAnswer ? "Correct! 🎉" : "Try again! 😊"}
              </p>
              <p className="text-white text-lg">{currentQuestion.explanation}</p>
            </div>
            
            {/* Voice Agent Replay Button - only show for incorrect answers with voice feedback */}
            {selectedAnswer !== currentQuestion.correctAnswer && hasVoiceFeedback && voiceAgentService.hasLastSpokenText() && (
              <div className="mb-4">
                <Button
                  onClick={async () => {
                    playClickSound();
                    await voiceAgentService.replayLastSpoken();
                  }}
                  variant="outline"
                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300 px-4 py-2 rounded-lg border-2 border-black font-medium"
                  style={{ boxShadow: '0 2px 0 black' }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Replay AI Voice
                </Button>
              </div>
            )}
            
            {currentQuestionNumber < totalQuestions ? (
              <Button
                onClick={handleNextQuestion}
                className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white border-2 border-black rounded-xl text-lg font-semibold"
                style={{ boxShadow: '0 4px 0 black' }}
              >
                Next Question
                <ChevronRight className="h-5 w-5 ml-2" />
              </Button>
            ) : (
              <div className="text-center">
                <div className="mb-4 text-white">
                  <h3 className="text-2xl font-bold mb-2">Quiz Complete! 🎉</h3>
                  <p className="text-lg">Final Score: {score}/{questionsAnswered}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {!showFeedback && (
          <p className="text-white text-lg">Choose an answer above</p>
        )}
      </div>
    </div>
  );
};

export default MCQComponent;
