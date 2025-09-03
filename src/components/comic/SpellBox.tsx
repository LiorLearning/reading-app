import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { playClickSound } from '@/lib/sounds';
import { ttsService } from '@/lib/tts-service';
import { useTTSSpeaking } from '@/hooks/use-tts-speaking';
import { aiService } from '@/lib/ai-service';
import confetti from 'canvas-confetti';

interface WordPart {
  type: 'text' | 'blank';
  content?: string;
  answer?: string;
}

interface SpellBoxProps {
  // Basic props
  word?: string;
  sentence?: string;
  onComplete?: (isCorrect: boolean, userAnswer?: string) => void;
  onSkip?: () => void;
  onNext?: () => void;
  className?: string;
  isVisible?: boolean;
  
  // Enhanced props
  question?: {
    id: number;
    word: string;
    questionText: string;
    correctAnswer: string;
    audio: string;
    explanation: string;
  };
  
  // UI options
  showProgress?: boolean;
  totalQuestions?: number;
  currentQuestionIndex?: number;
  showHints?: boolean;
  showExplanation?: boolean;
}

const SpellBox: React.FC<SpellBoxProps> = ({
  // Basic props
  word,
  sentence,
  onComplete,
  onSkip,
  onNext,
  className,
  isVisible = true,
  
  // Enhanced props
  question,
  
  // UI options
  showProgress = false,
  totalQuestions = 1,
  currentQuestionIndex = 0,
  showHints = true,
  showExplanation = true
}) => {
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [showHint, setShowHint] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [aiHint, setAiHint] = useState<string>('');
  const [isGeneratingHint, setIsGeneratingHint] = useState(false);

  // Determine which word to use (question takes precedence)
  const targetWord = question?.word || word || '';
  const questionText = question?.questionText;
  
  // Ensure we have a valid sentence for spelling - create fallback if needed
  const ensureSpellingSentence = useCallback((word: string, sentence?: string, questionText?: string): string => {
    // If we have a question object, prioritize using questionText as the sentence
    if (question && questionText) {
      return questionText;
    }
    
    // If we have a sentence that contains the target word, use it
    if (sentence && word && sentence.toLowerCase().includes(word.toLowerCase())) {
      return sentence;
    }
    
    // Fallback: create a simple sentence structure that works for spelling
    if (word) {
      return `Let's spell this word together: ${word}`;
    }
    
    // Final fallback
    return "Let's spell this word together!";
  }, [question]);

  // Get the working sentence - this ensures we always have something to work with
  const workingSentence = ensureSpellingSentence(targetWord, sentence, questionText);
  
  console.log('SpellBox Debug:', { 
    sentence, 
    targetWord, 
    questionText, 
    workingSentence,
    hasQuestion: !!question 
  });
  
  // Get audio text with context from working sentence
  const audioText = (() => {
    if (!workingSentence) return targetWord;
    
    const words = workingSentence.split(' ');
    // More robust word matching - remove punctuation for comparison
    const targetIndex = words.findIndex(w => 
      w.toLowerCase().replace(/[^\w]/g, '') === targetWord.toLowerCase().replace(/[^\w]/g, '')
    );
    if (targetIndex === -1) return targetWord;
    
    // Get target word and up to 2 words after it
    return words
      .slice(targetIndex, targetIndex + 3)
      .join(' ');
  })();
  
  const explanation = question?.explanation;

  // Parse the word into parts (text and blanks)
  const parseWord = useCallback((word: string): WordPart[] => {
    // For now, we'll make the entire word a blank to spell
    // You can extend this to support mixed text/blank patterns
    return [
      { type: 'blank', answer: word.toUpperCase() }
    ];
  }, []);

  const parts = parseWord(targetWord);
  const totalBlanks = parts.filter(part => part.type === 'blank').length;
  const correctlySpelledWords = isCorrect ? totalBlanks : 0;

  // Check if word is complete
  const isWordComplete = useCallback((answer: string, expectedLength: number): boolean => {
    return answer.length === expectedLength && !answer.includes(' ');
  }, []);

  // Check if word is correct
  const isWordCorrect = useCallback((answer: string, correctAnswer: string): boolean => {
    return answer.toUpperCase() === correctAnswer.toUpperCase();
  }, []);

  // Check if word is incorrect (complete but wrong)
  const isWordIncorrect = useCallback((answer: string, correctAnswer: string, expectedLength: number): boolean => {
    return isWordComplete(answer, expectedLength) && !isWordCorrect(answer, correctAnswer);
  }, [isWordComplete, isWordCorrect]);

  // Generate unique messageId for TTS
  const messageId = `spellbox-audio-${targetWord}-${Date.now()}`;
  const isSpeaking = useTTSSpeaking(messageId);

  // Generate AI hint for incorrect spelling
  const generateAIHint = useCallback(async (incorrectAttempt: string) => {
    if (!targetWord || !incorrectAttempt) return;
    
    setIsGeneratingHint(true);
    try {
      const hint = await aiService.generateSpellingHint(targetWord, incorrectAttempt);
      setAiHint(hint);
    } catch (error) {
      console.error('Error generating AI hint:', error);
      setAiHint(`That's close! Try thinking about the sounds in "${targetWord}". What letters make those sounds?`);
    } finally {
      setIsGeneratingHint(false);
    }
  }, [targetWord]);

  // Confetti celebration function
  const triggerConfetti = useCallback(() => {
    // Create a burst of confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']
    });
    
    // Add a second burst with different settings
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#FF6B6B', '#4ECDC4', '#45B7D1']
      });
    }, 250);
    
    // Add a third burst from the other side
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#FFD700', '#96CEB4', '#FFEAA7']
      });
    }, 400);
  }, []);

  // Play word audio using ElevenLabs TTS
  const playWordAudio = useCallback(async () => {
    console.log('🎵 SPELLBOX SPEAKER BUTTON: Click detected', {
      audioText,
      targetWord,
      messageId,
      isSpeaking
    });
    
    playClickSound();
    
    if (isSpeaking) {
      console.log('🎵 SPELLBOX SPEAKER BUTTON: Stopping current speech');
      ttsService.stop();
    } else {
      console.log('🎵 SPELLBOX SPEAKER BUTTON: Starting speech with ElevenLabs TTS');
      await ttsService.speakAIMessage(audioText, messageId);
    }
  }, [audioText, targetWord, messageId, isSpeaking]);

  // Handle answer change
  const handleAnswerChange = useCallback((newAnswer: string) => {
    setUserAnswer(newAnswer);
    
    if (isWordComplete(newAnswer, targetWord.length)) {
      const correct = isWordCorrect(newAnswer, targetWord);
      setIsCorrect(correct);
      setIsComplete(true);
      
      if (correct) {
        // Trigger confetti celebration for correct answer
        triggerConfetti();
        
        if (onComplete) {
          // Enhanced callback includes user answer
          onComplete(true, newAnswer);
        }
      } else {
        // Generate AI hint for incorrect answer
        generateAIHint(newAnswer);
      }
    } else {
      setIsComplete(false);
      setIsCorrect(false);
    }
  }, [targetWord, onComplete, isWordComplete, isWordCorrect, triggerConfetti, generateAIHint]);

  // Focus next empty box
  const focusNextEmptyBox = useCallback(() => {
    const inputs = document.querySelectorAll('input[data-letter]') as NodeListOf<HTMLInputElement>;
    for (let i = 0; i < inputs.length; i++) {
      if (!inputs[i].value.trim()) {
        inputs[i].focus();
        return true;
      }
    }
    return false;
  }, []);

  // Reset state when word changes
  useEffect(() => {
    setUserAnswer('');
    setIsCorrect(false);
    setIsComplete(false);
    setShowHint(false);
    setAttempts(0);
    setAiHint('');
    setIsGeneratingHint(false);
  }, [targetWord]);

  // Don't render if we don't have the basic requirements, but be more lenient about sentence
  if (!isVisible || !targetWord) return null;

  return (
    <div className={cn(
      "absolute inset-0 w-full h-full flex items-center justify-center z-20 pointer-events-none",
      className
    )}>
      <div className="pointer-events-auto bg-white/95 backdrop-blur-sm rounded-3xl p-6 border-4 border-purple-200 shadow-2xl max-w-md w-full mx-4">
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 18, fontWeight: 500, lineHeight: 1.6 }}>
          {/* Progress indicator */}
          {showProgress && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              marginBottom: '16px',
              padding: '8px 12px',
              background: 'linear-gradient(135deg, #F8F5FF 0%, #EDE9FE 100%)',
              borderRadius: '12px',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              animation: 'fadeSlideIn 0.3s ease-out'
            }}>
              <span style={{ fontSize: '16px' }}>📚</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#6B46C1' }}>
                Question {currentQuestionIndex + 1} of {totalQuestions}
              </span>
            </div>
          )}

          {/* Question text */}
          {workingSentence && (
            <div className="mb-6 text-center px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border-2 border-indigo-100 shadow-inner">
              <p className="text-lg text-gray-800" style={{ 
                fontFamily: 'Quicksand, sans-serif',
                lineHeight: 1.8,
                letterSpacing: '0.01em',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}>
                {workingSentence.split(' ').map((word, idx) => (
                  <React.Fragment key={idx}>
                    {word.toLowerCase().replace(/[^\w]/g, '') === targetWord.toLowerCase().replace(/[^\w]/g, '') ? (
                      <div style={{ 
                        display: 'inline-flex',
                        gap: '6px',
                        padding: '8px',
                        background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
                        borderRadius: '12px',
                        boxShadow: '0 4px 8px rgba(109, 40, 217, 0.1)',
                        border: '2px solid rgba(109, 40, 217, 0.2)',
                        margin: '0 4px'
                      }}>
                        {parts.map((part, partIndex) => {
                          if (part.type === 'text') {
                            return (
                              <span key={partIndex} style={{ whiteSpace: 'pre-wrap' }}>
                                {part.content}
                              </span>
                            );
                          } else {
                            const expectedLength = part.answer?.length || 5;
                            return (
                              <div key={partIndex} className="flex items-center gap-2">
                                {Array.from({ length: expectedLength }, (_, letterIndex) => {
                                  const letterValue = userAnswer[letterIndex] || '';
                                  const isWordCompleteNow = isWordComplete(userAnswer, expectedLength);
                                  const isWordCorrectNow = isWordCompleteNow && isWordCorrect(userAnswer, part.answer || '');
                                  const isWordIncorrectNow = isWordIncorrect(userAnswer, part.answer || '', expectedLength);
                                  
                                  let boxStyle: React.CSSProperties = {
                                    width: '32px',
                                    height: '40px',
                                    padding: '0',
                                    borderRadius: '8px',
                                    fontSize: '20px',
                                    fontFamily: 'Quicksand, sans-serif',
                                    fontWeight: '700',
                                    textAlign: 'center',
                                    outline: 'none',
                                    transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                    textTransform: 'uppercase',
                                    cursor: 'pointer'
                                  };

                                  if (isWordCorrectNow) {
                                    boxStyle = {
                                      ...boxStyle,
                                      background: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)',
                                      border: '3px solid #22C55E',
                                      color: '#15803D',
                                      boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)',
                                      cursor: 'not-allowed',
                                      transform: 'translateY(-2px)'
                                    };
                                  } else if (isWordIncorrectNow) {
                                    boxStyle = {
                                      ...boxStyle,
                                      background: 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)',
                                      border: '3px solid #EF4444',
                                      color: '#B91C1C',
                                      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
                                    };
                                  } else if (letterValue) {
                                    boxStyle = {
                                      ...boxStyle,
                                      background: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)',
                                      border: '3px solid #0EA5E9',
                                      color: '#0369A1',
                                      boxShadow: '0 4px 12px rgba(14, 165, 233, 0.2)'
                                    };
                                  } else {
                                    boxStyle = {
                                      ...boxStyle,
                                      background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
                                      border: '3px dashed #94A3B8',
                                      color: '#64748B',
                                      boxShadow: '0 4px 12px rgba(148, 163, 184, 0.1)'
                                    };
                                  }

                                  return (
                                    <input
                                      key={letterIndex}
                                      type="text"
                                      value={letterValue}
                                      maxLength={1}
                                      disabled={isWordCorrectNow}
                                      onChange={(e) => {
                                        if (isWordCorrectNow) return;
                                        
                                        const newValue = e.target.value.toUpperCase();
                                        if (newValue.match(/[A-Z]/) || newValue === '') {
                                          const newWord = Array.from({ length: expectedLength }, (_, i) => 
                                            i === letterIndex ? newValue : (userAnswer[i] || '')
                                          );
                                          const finalWord = newWord.join('');
                                          handleAnswerChange(finalWord);
                                          playClickSound();
                                          
                                          if (newValue && letterIndex < expectedLength - 1) {
                                            const nextBox = document.querySelector(`input[data-letter="${letterIndex + 1}"]`) as HTMLInputElement;
                                            if (nextBox) {
                                              setTimeout(() => nextBox.focus(), 10);
                                            }
                                          }
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Backspace') {
                                          if (letterValue) {
                                            e.preventDefault();
                                            const newWord = Array.from({ length: expectedLength }, (_, i) => 
                                              i === letterIndex ? '' : (userAnswer[i] || '')
                                            );
                                            const finalWord = newWord.join('');
                                            handleAnswerChange(finalWord);
                                          } else if (letterIndex > 0) {
                                            const prevBox = document.querySelector(`input[data-letter="${letterIndex - 1}"]`) as HTMLInputElement;
                                            if (prevBox) {
                                              prevBox.focus();
                                            }
                                          }
                                        } else if (e.key === 'ArrowLeft' && letterIndex > 0) {
                                          const prevBox = document.querySelector(`input[data-letter="${letterIndex - 1}"]`) as HTMLInputElement;
                                          if (prevBox) prevBox.focus();
                                        } else if (e.key === 'ArrowRight' && letterIndex < expectedLength - 1) {
                                          const nextBox = document.querySelector(`input[data-letter="${letterIndex + 1}"]`) as HTMLInputElement;
                                          if (nextBox) nextBox.focus();
                                        }
                                      }}
                                      style={boxStyle}
                                      onFocus={(e) => {
                                        if (isWordCorrectNow) {
                                          e.target.blur();
                                          return;
                                        }
                                        if (!isWordCorrectNow && !isWordIncorrectNow) {
                                          e.target.style.borderStyle = 'solid';
                                          e.target.style.borderColor = '#6366F1';
                                          e.target.style.boxShadow = '0 0 0 4px rgba(99, 102, 241, 0.2)';
                                          e.target.style.transform = 'scale(1.05)';
                                        }
                                      }}
                                      onBlur={(e) => {
                                        const hasValue = e.target.value.trim() !== '';
                                        const isCorrectNow = isWordComplete(userAnswer, expectedLength) && isWordCorrect(userAnswer, part.answer || '');
                                        const isIncorrectNow = isWordIncorrect(userAnswer, part.answer || '', expectedLength);
                                        
                                        e.target.style.transform = 'scale(1)';
                                        e.target.style.borderStyle = hasValue ? 'solid' : 'dashed';
                                        
                                        if (isCorrectNow) {
                                          e.target.style.borderColor = '#22C55E';
                                          e.target.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.2)';
                                        } else if (isIncorrectNow) {
                                          e.target.style.borderColor = '#EF4444';
                                          e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.2)';
                                        } else if (hasValue) {
                                          e.target.style.borderColor = '#0EA5E9';
                                          e.target.style.boxShadow = '0 4px 12px rgba(14, 165, 233, 0.2)';
                                        } else {
                                          e.target.style.borderColor = '#94A3B8';
                                          e.target.style.boxShadow = '0 4px 12px rgba(148, 163, 184, 0.1)';
                                        }
                                      }}
                                      data-letter={letterIndex}
                                    />
                                  );
                                })}
                                
                                {/* Audio button with ElevenLabs TTS */}
                                <button
                                  onClick={playWordAudio}
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: isSpeaking 
                                      ? 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)'
                                      : 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '20px',
                                    boxShadow: isSpeaking 
                                      ? '0 4px 12px rgba(220, 38, 38, 0.3)'
                                      : '0 4px 12px rgba(99, 102, 241, 0.3)',
                                    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                    opacity: 1,
                                    transform: 'scale(1)'
                                  }}
                                  title={isSpeaking ? "Stop audio" : "Listen to this word"}
                                  onMouseEnter={(e) => {
                                    if (!isSpeaking) {
                                      e.currentTarget.style.transform = 'scale(1.1) rotate(5deg)';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSpeaking) {
                                      e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
                                    }
                                  }}
                                >
                                  {isSpeaking ? '⏹️' : '🔊'}
                                </button>
                              </div>
                            );
                          }
                        })}
                      </div>
                    ) : (
                      <span className="inline-block animate-float" 
                        style={{ 
                          animationDelay: `${idx * 0.1}s`,
                          fontWeight: '400'
                        }}>
                        {word}
                      </span>
                    )}
                    {idx < workingSentence.split(' ').length - 1 && " "}
                  </React.Fragment>
                ))}
              </p>
            </div>
          )}

          

          {/* AI-powered hints for incorrect words */}
          {isComplete && !isCorrect && showHints && (
            <div style={{
              background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
              border: '2px solid #FB923C',
              borderRadius: '16px',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              animation: 'bounceIn 0.5s ease-out',
              boxShadow: '0 4px 12px rgba(251, 146, 60, 0.15)'
            }}>
              <span style={{ fontSize: '24px' }}>🤖</span>
              <div style={{ 
                fontSize: '15px', 
                fontWeight: 500, 
                color: '#C2410C', 
                lineHeight: 1.5,
                flex: 1,
                fontFamily: 'Quicksand, sans-serif'
              }}>
                {isGeneratingHint ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid #FB923C',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    <span>Thinking of a helpful hint...</span>
                  </div>
                ) : aiHint ? (
                  <div>
                    <strong>AI Tutor:</strong> {aiHint}
                  </div>
                ) : (
                  <div>
                    <strong>Friendly Hint:</strong> This word has {targetWord.length} magical letters!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action buttons with enhanced styling */}
          <div className="flex justify-center items-center gap-4 mt-8">
            {/* Skip button commented out - might use later
            <button
              onClick={onSkip}
              className="px-6 py-3 font-semibold text-gray-600 hover:text-gray-800 transition-colors rounded-xl hover:bg-gray-100"
              style={{ fontFamily: 'Quicksand, sans-serif' }}
            >
              Skip this one
            </button>
            */}
            
            {isComplete && !isCorrect && showHints && (
              <button
                onClick={() => {
                  setUserAnswer('');
                  setIsCorrect(false);
                  setIsComplete(false);
                  setShowHint(false);
                  setAiHint('');
                  setAttempts(prev => prev + 1);
                  playClickSound();
                }}
                className="px-6 py-3 text-base font-semibold text-indigo-600 hover:text-indigo-800 transition-all rounded-xl hover:bg-indigo-50"
                style={{ fontFamily: 'Quicksand, sans-serif' }}
              >
                Try Again 🌟
              </button>
            )}

            {isCorrect && onNext && (
              <button
                onClick={() => {
                  playClickSound();
                  onNext();
                }}
                className="px-6 py-3 text-base font-semibold bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all transform hover:scale-105 hover:shadow-lg"
                style={{ fontFamily: 'Quicksand, sans-serif' }}
              >
                Next Question ✨
              </button>
            )}
          </div>

          {/* CSS animations */}
          <style>{`
            @keyframes fadeSlideIn {
              from {
                opacity: 0;
                transform: translateY(8px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }

            @keyframes bounceIn {
              0% {
                opacity: 0;
                transform: scale(0.3);
              }
              50% {
                opacity: 0.9;
                transform: scale(1.1);
              }
              80% {
                opacity: 1;
                transform: scale(0.89);
              }
              100% {
                opacity: 1;
                transform: scale(1);
              }
            }

            @keyframes float {
              0% {
                transform: translateY(0px);
              }
              50% {
                transform: translateY(-4px);
              }
              100% {
                transform: translateY(0px);
              }
            }

            @keyframes spin {
              0% {
                transform: rotate(0deg);
              }
              100% {
                transform: rotate(360deg);
              }
            }

            .animate-float {
              animation: float 2s ease-in-out infinite;
            }
          `}</style>
        </div>
      </div>
    </div>
  );
};

export default SpellBox; 