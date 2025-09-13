import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X, ChevronRight, Volume2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { playClickSound, playMessageSound } from '@/lib/sounds';
import { voiceAgentService } from '@/lib/voice-agent-service';

interface MCQQuestion {
  id: number;
  topicId: string;
  topicName: string;
  questionElements: string;
  answerElements: string;
  templateType: string;
  word: string;
  imageUrl?: string | null;
  explanation: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  template: string;
  isSpacing: boolean;
  isSorting: boolean;
  isSpelling: boolean;
  aiHook: {
    targetWord: string;
    intent: string;
    questionLine: string;
    imagePrompt: string;
  };
}

interface MCQComponentProps {
  question: MCQQuestion;
  onAnswerComplete?: (questionId: number, isCorrect: boolean, selectedAnswer: number) => void;
  onNextQuestion?: () => void;
  showNextButton?: boolean;
}

const MCQComponent: React.FC<MCQComponentProps> = ({ 
  question, 
  onAnswerComplete, 
  onNextQuestion,
  showNextButton = false
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isAnswered, setIsAnswered] = useState(false);
  const [hasVoiceFeedback, setHasVoiceFeedback] = useState(false);

  const handleAnswerSelect = useCallback(async (optionIndex: number) => {
    if (isAnswered) return; // Prevent changing answer after submission
    
    playClickSound();
    setSelectedAnswer(optionIndex);
    setShowFeedback(true);
    setIsAnswered(true);
    
    const isCorrect = optionIndex === question.correctAnswer;
    
    // Play feedback sound
    setTimeout(() => {
      playMessageSound();
    }, 300);
    
    // Trigger voice agent for incorrect answers
    if (!isCorrect) {
      try {
        const correctAnswer = question.options[question.correctAnswer];
        const userAnswer = question.options[optionIndex];
        const questionContext = question.questionText;
        
        // Trigger voice agent with teaching response
        await voiceAgentService.handleIncorrectAnswer(
          question.id.toString(),
          correctAnswer,
          userAnswer,
          questionContext
        );
        setHasVoiceFeedback(true);
      } catch (error) {
        console.error('Error triggering voice agent:', error);
      }
    }
    
    // Call parent callback if provided
    if (onAnswerComplete) {
      onAnswerComplete(question.id, isCorrect, optionIndex);
    }
  }, [isAnswered, question.correctAnswer, question.id, question.options, question.questionText, onAnswerComplete]);

  const handleNextQuestion = useCallback(() => {
    playClickSound();
    if (onNextQuestion) {
      onNextQuestion();
    }
  }, [onNextQuestion]);

  const getOptionStyle = (optionIndex: number) => {
    if (!showFeedback) {
      return {
        background: 'white',
        borderColor: 'hsl(var(--primary))',
        color: 'black'
      };
    }

    if (optionIndex === question.correctAnswer) {
      // Correct answer - always green
      return {
        background: 'linear-gradient(to bottom, #22c55e, #16a34a)',
        borderColor: '#15803d',
        color: 'white'
      };
    } else if (optionIndex === selectedAnswer) {
      // Selected wrong answer - red
      return {
        background: 'linear-gradient(to bottom, #ef4444, #dc2626)',
        borderColor: '#b91c1c',
        color: 'white'
      };
    } else {
      // Unselected options - dimmed
      return {
        background: '#f3f4f6',
        borderColor: '#d1d5db',
        color: '#6b7280'
      };
    }
  };

  const getOptionIcon = (optionIndex: number) => {
    if (!showFeedback) return null;
    
    if (optionIndex === question.correctAnswer) {
      return <Check className="h-5 w-5" />;
    } else if (optionIndex === selectedAnswer) {
      return <X className="h-5 w-5" />;
    }
    return null;
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Question Card - Notebook Style */}
      <div 
        className="relative bg-white rounded-3xl p-8"
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
          onClick={() => {
            playClickSound();
            // Text-to-speech for question
            const utterance = new SpeechSynthesisUtterance(question.questionText);
            utterance.rate = 0.8;
            utterance.pitch = 1.1;
            window.speechSynthesis.speak(utterance);
          }}
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
        
        {/* Question text */}
        <div 
          className="mt-4 text-lg font-medium text-gray-800 text-center"
          style={{
            lineHeight: '2.5rem',
            backgroundImage: 'repeating-linear-gradient(transparent, transparent 2.4rem, #e5e7eb 2.4rem, #e5e7eb 2.5rem)',
            paddingTop: '0.1rem',
            minHeight: '100px'
          }}
        >
          {question.questionText}
        </div>
      </div>

      {/* Image Panel */}
      <div 
        className="relative rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #6b46c1 0%, #7c3aed 50%, #8b5cf6 100%)',
          border: '4px solid black',
          boxShadow: '0 8px 0 black',
          minHeight: '300px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Sound button - top left */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            playClickSound();
            // Play sound for the word/image
            const utterance = new SpeechSynthesisUtterance(question.word);
            utterance.rate = 0.7;
            utterance.pitch = 1.2;
            window.speechSynthesis.speak(utterance);
          }}
          className="absolute top-4 left-4 h-12 w-12 rounded-lg border-2 border-black bg-white hover:bg-primary hover:text-primary-foreground z-10 transition-all duration-200 hover:scale-110"
          style={{ boxShadow: '0 4px 0 black' }}
        >
          <Volume2 className="h-5 w-5" />
        </Button>

        {/* Rocket Image - Center */}
        <div className="text-8xl">
          🚀
        </div>
      </div>

      {/* Answer Options */}
      <div className="flex justify-center gap-4">
        {question.options.map((option, index) => (
          <Button
            key={index}
            variant="outline"
            size="lg"
            onClick={() => handleAnswerSelect(index)}
            disabled={isAnswered}
            className={cn(
              "px-8 py-4 text-xl font-bold rounded-2xl border-4 border-black transition-all duration-300 min-w-[80px] h-[60px]",
              !isAnswered && "hover:scale-110 hover:shadow-lg",
              isAnswered && "cursor-default"
            )}
            style={{
              ...getOptionStyle(index),
              boxShadow: showFeedback ? '0 6px 0 black' : '0 8px 0 black'
            }}
          >
            {option}
          </Button>
        ))}
      </div>

      {/* Feedback Card */}
      {showFeedback && (
        <Card 
          className="border-4 border-black rounded-3xl overflow-hidden animate-slide-up-smooth"
          style={{ 
            boxShadow: '0 8px 0 black',
            background: selectedAnswer === question.correctAnswer 
              ? 'linear-gradient(to bottom, #dcfce7, #bbf7d0)'
              : 'linear-gradient(to bottom, #fef2f2, #fecaca)'
          }}
        >
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              {selectedAnswer === question.correctAnswer ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center">
                    <Check className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-green-800">Correct!</h3>
                    <p className="text-green-700">Well done! 🎉</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center">
                    <X className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-red-800">Try Again!</h3>
                    <p className="text-red-700">Keep learning! 📚</p>
                  </div>
                </>
              )}
            </div>
            
            <p className="text-lg text-gray-700 mb-4">
              {question.explanation}
            </p>
            
            {/* Voice Agent Replay Button - only show for incorrect answers with voice feedback */}
            {selectedAnswer !== question.correctAnswer && hasVoiceFeedback && voiceAgentService.hasLastSpokenText() && (
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
            
            {showNextButton && (
              <Button
                onClick={handleNextQuestion}
                className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl border-3 border-black font-bold text-base"
                style={{ boxShadow: '0 4px 0 black' }}
              >
                Next Question
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MCQComponent;
