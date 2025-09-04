import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  
  // First-time instruction state
  const [showFirstTimeInstruction, setShowFirstTimeInstruction] = useState(false);
  const [hasShownFirstTimeInstruction, setHasShownFirstTimeInstruction] = useState(false);
  const [speakerButtonPosition, setSpeakerButtonPosition] = useState<{x: number, y: number} | null>(null);

  // Determine which word to use (question takes precedence)
  const targetWord = question?.word || word || '';
  const questionText = question?.questionText;
  
  // Ensure we have a valid sentence for spelling - create fallback if needed
  const ensureSpellingSentence = useCallback((word: string, sentence?: string, questionText?: string): string => {
    const normalize = (s: string) => {
      // First strip HTML tags, then normalize
      const stripped = s.replace(/<[^>]*>/g, '');
      return stripped.toLowerCase().replace(/[^\w\s]/g, '');
    };
    
    const containsWord = (s?: string, checkStrict: boolean = true) => {
      if (!s || !word) return false;
      const normSentence = normalize(s);
      const normWord = normalize(word);
      
      if (checkStrict) {
        // word-boundary style check to avoid partial matches
        const re = new RegExp(`\\b${normWord}\\b`);
        return re.test(normSentence);
      } else {
        // More lenient check for longer passages
        return normSentence.includes(normWord);
      }
    };

    // Prefer questionText only if it truly contains the target word
    if (question && questionText && containsWord(questionText)) {
      return questionText;
    }

    // For full passages (longer content), use more lenient matching
    if (sentence && sentence.length > 100) {
      // console.log('🔍 SpellBox: Processing long passage for word:', word);
      // First try strict matching
      if (containsWord(sentence, true)) {
        // console.log('✅ SpellBox: Found word with strict matching in long passage');
        return sentence;
      }
      // Then try lenient matching for longer passages
      if (containsWord(sentence, false)) {
        // console.log('✅ SpellBox: Found word with lenient matching in long passage');
        return sentence;
      }
      // Last attempt: extract sentence containing the word
      const sentences = sentence.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
      for (const sent of sentences) {
        if (containsWord(sent, false)) {
          // console.log('✅ SpellBox: Found word in extracted sentence:', sent);
          return sent;
        }
      }
      // console.log('❌ SpellBox: Could not find word in long passage');
    } else {
      // For shorter content, use strict matching
      if (sentence && containsWord(sentence, true)) {
        return sentence;
      }
    }

    // Fallback: synthesize a simple sentence that definitely includes the word
    if (word) {
      return `Let's spell this word together: ${word}`;
    }

    // Final fallback
    return "Let's spell this word together!";
  }, [question]);

  // Get the working sentence - this ensures we always have something to work with
  const workingSentence = ensureSpellingSentence(targetWord, sentence, questionText);
  
  // console.log('🎯 SpellBox Debug:', { 
  //   sentence, 
  //   sentenceLength: sentence?.length,
  //   targetWord, 
  //   questionText, 
  //   workingSentence,
  //   workingSentenceLength: workingSentence?.length,
  //   hasQuestion: !!question 
  // });
  

  // Debug: Check if target word is found in working sentence
  const wordFoundInSentence = workingSentence && targetWord && 
    workingSentence.toLowerCase().includes(targetWord.toLowerCase());
  // console.log(`🔍 SpellBox: Target word "${targetWord}" found in sentence: ${wordFoundInSentence}`);
  
  if (!wordFoundInSentence && targetWord && workingSentence) {
    console.error(`❌ SpellBox CRITICAL: Target word "${targetWord}" NOT found in sentence: "${workingSentence}"`);
  }
  
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
  
  console.log('🧩 SpellBox Parts Debug:', {
    targetWord,
    parts,
    totalBlanks,
    partsLength: parts.length
  });

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

  // Check for first-time instruction display
  const shouldShowFirstTimeInstruction = currentQuestionIndex === 0 && !hasShownFirstTimeInstruction;

  // Check localStorage for first-time instruction
  useEffect(() => {
    const hasSeenInstruction = localStorage.getItem('spellbox-first-time-instruction-seen');
    if (hasSeenInstruction) {
      setHasShownFirstTimeInstruction(true);
    } else if (currentQuestionIndex === 0 && isVisible) {
      // Show instruction for first question and first time
      setShowFirstTimeInstruction(true);
    }
  }, [currentQuestionIndex, isVisible]);

  // Generate stable messageId for TTS (only changes when targetWord changes)
  const messageId = useMemo(() => 
    `spellbox-audio-${targetWord}-${Date.now()}`, 
    [targetWord]
  );
  const isSpeaking = useTTSSpeaking(messageId);

  // TTS message ID for first-time instruction
  const instructionMessageId = useMemo(() => 
    'spellbox-first-time-instruction',
    []
  );
  const isInstructionSpeaking = useTTSSpeaking(instructionMessageId);

  // Calculate speaker button position dynamically
  const calculateSpeakerButtonPosition = useCallback(() => {
    const speakerButton = document.getElementById('spellbox-speaker-button');
    const spellBoxContainer = document.querySelector('.spellbox-container');
    
    if (speakerButton && spellBoxContainer) {
      const buttonRect = speakerButton.getBoundingClientRect();
      const containerRect = spellBoxContainer.getBoundingClientRect();
      
      const relativeX = buttonRect.left - containerRect.left + (buttonRect.width / 2);
      const relativeY = buttonRect.top - containerRect.top + (buttonRect.height / 2);
      
      setSpeakerButtonPosition({ x: relativeX, y: relativeY });
      console.log('📍 Speaker button position calculated:', { 
        x: relativeX, 
        y: relativeY,
        buttonRect: {
          left: buttonRect.left,
          top: buttonRect.top,
          width: buttonRect.width,
          height: buttonRect.height
        },
        containerRect: {
          left: containerRect.left,
          top: containerRect.top,
          width: containerRect.width,
          height: containerRect.height
        }
      });
    } else {
      console.warn('⚠️ Speaker button or container not found for positioning');
      // Fallback to center-based positioning
      setSpeakerButtonPosition({ x: 300, y: 200 }); // Default fallback
    }
  }, []);

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

  // Handle first-time instruction completion
  const handleFirstTimeInstructionComplete = useCallback(() => {
    setShowFirstTimeInstruction(false);
    setHasShownFirstTimeInstruction(true);
    localStorage.setItem('spellbox-first-time-instruction-seen', 'true');
    
    // Stop instruction audio if playing
    if (isInstructionSpeaking) {
      ttsService.stop();
    }
  }, [isInstructionSpeaking]);

  // Play instruction audio after waiting for any current TTS to complete
  const playInstructionAudio = useCallback(async () => {
    console.log('🎵 INSTRUCTION AUDIO: Checking if TTS is currently speaking...');
    
    // Check if TTS is currently speaking
    if (ttsService.getIsSpeaking()) {
      console.log('🎵 INSTRUCTION AUDIO: TTS is speaking, waiting for completion...');
      const currentMessageId = ttsService.getCurrentSpeakingMessageId();
      console.log('🎵 INSTRUCTION AUDIO: Current speaking message ID:', currentMessageId);
      
      // Create a promise that resolves when current TTS finishes (with timeout)
      const waitForTTSComplete = new Promise<void>((resolve) => {
        let attempts = 0;
        const maxAttempts = 50; // 10 seconds maximum wait (50 * 200ms)
        
        const checkTTSStatus = () => {
          attempts++;
          
          if (!ttsService.getIsSpeaking()) {
            console.log('🎵 INSTRUCTION AUDIO: TTS completed, ready to play instruction');
            resolve();
          } else if (attempts >= maxAttempts) {
            console.warn('🎵 INSTRUCTION AUDIO: Timeout waiting for TTS completion, proceeding anyway');
            resolve();
          } else {
            // Check again in 200ms
            setTimeout(checkTTSStatus, 200);
          }
        };
        checkTTSStatus();
      });
      
      await waitForTTSComplete;
    }
    
    // Final check to make sure no new TTS started while we were waiting
    if (ttsService.getIsSpeaking()) {
      console.log('🎵 INSTRUCTION AUDIO: New TTS started while waiting, skipping instruction audio');
      return;
    }
    
    console.log('🎵 INSTRUCTION AUDIO: Playing instruction audio');
    const instructionText = "Fill in the blank with the correct spelling using the audio";
    
    try {
      await ttsService.speak(instructionText, {
        stability: 0.7,
        similarity_boost: 0.9,
        speed: 0.8,
        messageId: instructionMessageId
      });
    } catch (error) {
      console.error('🎵 INSTRUCTION AUDIO: Error playing instruction audio:', error);
    }
  }, [instructionMessageId]);

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
      console.log('🎵 SPELLBOX SPEAKER BUTTON: Starting speech with ElevenLabs TTS at 0.7x speed');
      await ttsService.speak(audioText, {
        stability: 0.7,
        similarity_boost: 0.9,
        speed: 0.7,  // Set speed to 0.7x for SpellBox words
        messageId: messageId
      });
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

  // Play instruction audio when first-time instruction shows
  useEffect(() => {
    if (showFirstTimeInstruction) {
      // Calculate speaker button position first
      const positionTimer = setTimeout(() => {
        calculateSpeakerButtonPosition();
      }, 100);
      
      // Wait longer before trying to play audio to allow chat TTS to complete
      const audioTimer = setTimeout(() => {
        playInstructionAudio();
      }, 1500); // Increased delay to allow chat audio to complete
      
      return () => {
        clearTimeout(positionTimer);
        clearTimeout(audioTimer);
      };
    }
  }, [showFirstTimeInstruction, playInstructionAudio, calculateSpeakerButtonPosition]);

  // Retry position calculation if not found initially
  useEffect(() => {
    if (showFirstTimeInstruction && !speakerButtonPosition) {
      const retryTimer = setTimeout(() => {
        calculateSpeakerButtonPosition();
      }, 200);
      return () => clearTimeout(retryTimer);
    }
  }, [showFirstTimeInstruction, speakerButtonPosition, calculateSpeakerButtonPosition]);

  // Recalculate position on window resize
  useEffect(() => {
    if (showFirstTimeInstruction) {
      const handleResize = () => {
        calculateSpeakerButtonPosition();
      };
      
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [showFirstTimeInstruction, calculateSpeakerButtonPosition]);


  // Don't render if we don't have the basic requirements, but be more lenient about sentence

  if (!isVisible || !targetWord) return null;

  return (
    <div className={cn(
      "absolute inset-0 w-full h-full flex items-center justify-center z-20 pointer-events-none",
      className
    )}>
      <div className="spellbox-container pointer-events-auto bg-white rounded-2xl p-8 border border-black/20 shadow-[0_4px_0_black] max-w-lg w-full mx-4">
        <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 20, fontWeight: 500, lineHeight: 1.6 }}>

          {/* Question text */}

          {workingSentence && (

            <div className="mb-8 text-center">
              <div className="text-xl text-gray-800" style={{ 
                fontFamily: 'system-ui, -apple-system, sans-serif',
                lineHeight: 1.6,
                letterSpacing: 'normal',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>

                {workingSentence.split(' ').map((word, idx) => {
                  const normalizedWord = word.toLowerCase().replace(/[^\w]/g, '');
                  const normalizedTarget = targetWord.toLowerCase().replace(/[^\w]/g, '');
                  const isTargetWord = normalizedWord === normalizedTarget;
                  
                  console.log(`🔤 Word comparison: "${word}" (normalized: "${normalizedWord}") vs target "${targetWord}" (normalized: "${normalizedTarget}") = ${isTargetWord}`);
                  
                  return (
                  <React.Fragment key={idx}>
                    {isTargetWord ? (

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
                          console.log('🎨 Rendering part:', { partIndex, part, type: part.type });
                          
                          if (part.type === 'text') {
                            return (
                              <span key={partIndex} style={{ whiteSpace: 'pre-wrap' }}>
                                {part.content}
                              </span>
                            );
                          } else {
                            const expectedLength = part.answer?.length || 5;
                            console.log('📝 Creating input boxes:', { expectedLength, answer: part.answer });
                            return (
                              <div key={partIndex} className="flex items-center gap-2">
                                {Array.from({ length: expectedLength }, (_, letterIndex) => {
                                  const letterValue = userAnswer[letterIndex] || '';
                                  const isWordCompleteNow = isWordComplete(userAnswer, expectedLength);
                                  const isWordCorrectNow = isWordCompleteNow && isWordCorrect(userAnswer, part.answer || '');
                                  const isWordIncorrectNow = isWordIncorrect(userAnswer, part.answer || '', expectedLength);
                                  
                                  let boxStyle: React.CSSProperties = {
                                    width: '36px',
                                    height: '44px',
                                    padding: '0',
                                    borderRadius: '8px',
                                    fontSize: '22px',
                                    fontFamily: 'system-ui, -apple-system, sans-serif',
                                    fontWeight: '600',
                                    textAlign: 'center',
                                    outline: 'none',
                                    transition: 'all 0.15s ease-out',
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
                                          e.target.style.borderColor = '#8B5CF6';
                                          e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.2)';
                                          e.target.style.transform = 'scale(1.02)';
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
                                          e.target.style.boxShadow = '0 2px 4px rgba(34, 197, 94, 0.2)';
                                        } else if (isIncorrectNow) {
                                          e.target.style.borderColor = '#EF4444';
                                          e.target.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.2)';
                                        } else if (hasValue) {
                                          e.target.style.borderColor = '#0EA5E9';
                                          e.target.style.boxShadow = '0 2px 4px rgba(14, 165, 233, 0.2)';
                                        } else {
                                          e.target.style.borderColor = '#94A3B8';
                                          e.target.style.boxShadow = '0 1px 2px rgba(148, 163, 184, 0.1)';
                                        }
                                      }}
                                      data-letter={letterIndex}
                                    />
                                  );
                                })}
                                
                                {/* Audio button with ElevenLabs TTS */}
                                <button
                                  onClick={playWordAudio}
                                  id="spellbox-speaker-button"
                                  style={{
                                    width: '44px',
                                    height: '44px',
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
                                    fontSize: '24px',
                                    boxShadow: isSpeaking 
                                      ? '0 4px 12px rgba(220, 38, 38, 0.3)'
                                      : '0 4px 12px rgba(99, 102, 241, 0.3)',
                                    transition: 'all 0.15s ease-out',
                                    opacity: 1,
                                    transform: 'scale(1)',
                                    position: 'relative'
                                  }}
                                  title={isSpeaking ? "Stop audio" : "Listen to this word"}
                                  onMouseEnter={(e) => {
                                    if (!isSpeaking) {
                                      e.currentTarget.style.transform = 'scale(1.05)';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSpeaking) {
                                      e.currentTarget.style.transform = 'scale(1)';
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
                      <span className="inline-block" 
                        style={{ 
                          fontWeight: '400'
                        }}>
                        {word}
                      </span>
                    )}

                    {idx < workingSentence.split(' ').length - 1 && " "}

                  </React.Fragment>
                  );
                })}
              </div>
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
              position: 'relative',
              animation: 'bounceIn 0.5s ease-out',
              boxShadow: '0 4px 12px rgba(251, 146, 60, 0.15)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{ fontSize: '24px' }}></span>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: 500, 
                  color: '#C2410C', 
                  lineHeight: 1.5,
                  flex: 1,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '8px'
                }}>
                  <div style={{ flex: 1 }}>
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
                        <strong></strong> {aiHint}
                      </div>
                    ) : (
                      <div>
                        <strong>Friendly Hint:</strong> This word has {targetWord.length} magical letters!
                      </div>
                    )}
                  </div>
                  
                  {/* Speaker button inline with text - bottom right */}
                  {(aiHint || (!isGeneratingHint && !aiHint)) && (
                    <button
                      onClick={async () => {
                        playClickSound();
                        const hintText = aiHint || `Friendly hint: This word has ${targetWord.length} magical letters!`;
                        const hintMessageId = `spellbox-hint-${Date.now()}`;
                        
                        try {
                          await ttsService.speak(hintText, {
                            stability: 0.7,
                            similarity_boost: 0.9,
                            speed: 0.8,
                            messageId: hintMessageId
                          });
                        } catch (error) {
                          console.error('Error playing hint audio:', error);
                        }
                      }}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '4px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #FB923C 0%, #F97316 100%)',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        boxShadow: '0 2px 4px rgba(251, 146, 60, 0.3)',
                        transition: 'all 0.15s ease-out',
                        opacity: 0.8,
                        flexShrink: 0
                      }}
                      title="Listen to hint"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.1)';
                        e.currentTarget.style.opacity = '1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.opacity = '0.8';
                      }}
                    >
                      🔊
                    </button>
                  )}
                </div>
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
            

            {isCorrect && onNext && (
              <button
                onClick={() => {
                  playClickSound();
                  onNext();
                }}
                className="px-8 py-4 text-lg font-medium bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all transform hover:scale-102 hover:shadow-md"
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
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


            @keyframes spin {
              0% {
                transform: rotate(0deg);
              }
              100% {
                transform: rotate(360deg);
              }
            }

          `}</style>
        </div>

        {/* First-time instruction overlay - pointing finger only */}
        {showFirstTimeInstruction && (
          <div 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: speakerButtonPosition ? `
                radial-gradient(
                  circle at ${speakerButtonPosition.x}px ${speakerButtonPosition.y}px,
                  transparent 30px,
                  rgba(0, 0, 0, 0.2) 40px,
                  rgba(0, 0, 0, 0.7) 80px
                )
              ` : 'rgba(0, 0, 0, 0.6)',
              zIndex: 1000,
              borderRadius: '24px',
              pointerEvents: 'auto'
            }}
            onClick={handleFirstTimeInstructionComplete}
          >
            {/* Speaker button highlight circle */}
            {speakerButtonPosition && (
              <div style={{
                position: 'absolute',
                left: `${Math.max(0, speakerButtonPosition.x - 25)}px`,
                top: `${Math.max(0, speakerButtonPosition.y - 25)}px`,
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.3)',
                animation: 'speakerHighlight 2s ease-in-out infinite',
                zIndex: 999,
                pointerEvents: 'none'
              }} />
            )}

            {/* Pointing finger positioned relative to speaker button */}
            <div 
              className="pointing-finger"
              style={{
                position: 'absolute',
                fontSize: 'clamp(40px, 8vw, 52px)', // Responsive font size
                animation: 'pointToSpeaker 1.5s ease-in-out infinite',
                filter: 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.4))',
                zIndex: 1001,
                // Position relative to dynamic speaker button location (pointing towards it)
                left: speakerButtonPosition ? `${Math.max(10, speakerButtonPosition.x - 60)}px` : '50%',
                top: speakerButtonPosition ? `${speakerButtonPosition.y - 15}px` : '50%',
                transform: speakerButtonPosition ? 'none' : 'translate(70px, -10px)',
                transformOrigin: 'center',
                pointerEvents: 'none'
              }}
            >
              👉
            </div>

            {/* Pointing animation styles */}
            <style>{`
              @keyframes pointToSpeaker {
                0%, 100% {
                  transform: rotate(0deg) scale(1);
                  opacity: 0.9;
                }
                25% {
                  transform: translate(8px, 4px) rotate(10deg) scale(1.1);
                  opacity: 1;
                }
                50% {
                  transform: translate(4px, -4px) rotate(-3deg) scale(1.05);
                  opacity: 0.95;
                }
                75% {
                  transform: translate(-4px, 2px) rotate(-8deg) scale(1.08);
                  opacity: 1;
                }
              }

              @keyframes speakerHighlight {
                0%, 100% {
                  transform: scale(1);
                  opacity: 0.3;
                  background: rgba(99, 102, 241, 0.3);
                }
                50% {
                  transform: scale(1.2);
                  opacity: 0.6;
                  background: rgba(99, 102, 241, 0.5);
                }
              }

              /* Responsive adjustments for smaller screens */
              @media (max-width: 480px) {
                .pointing-finger {
                  font-size: 36px !important;
                }
              }

              @media (max-width: 320px) {
                .pointing-finger {
                  font-size: 32px !important;
                }
              }
            `}</style>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpellBox; 