import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { playClickSound } from '@/lib/sounds';
import { ttsService, AVAILABLE_VOICES } from '@/lib/tts-service';
import { useTTSSpeaking } from '@/hooks/use-tts-speaking';
import { aiService } from '@/lib/ai-service';
import { useFillInBlanksTutorial } from '@/hooks/use-tutorial';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { Volume2, Square, ChevronRight } from 'lucide-react';

interface WordPart {
  type: 'text' | 'blank';
  content?: string;
  answer?: string;
}

interface SpellBoxProps {
  // Basic props
  word?: string;
  sentence?: string;
  onComplete?: (isCorrect: boolean, userAnswer?: string, attemptCount?: number) => void;
  onSkip?: () => void;
  onNext?: () => void;
  /** Visually highlight the Next chevron with a little finger pointer cue */
  highlightNext?: boolean;
  className?: string;
  isVisible?: boolean;
  /**
   * Render mode for the component. "overlay" keeps the existing full-screen
   * centered experience. "inline" renders only the interactive content so it
   * can be embedded inside other UI (e.g., pet message bubble).
   */
  variant?: 'overlay' | 'inline';
  
  // Enhanced props
  question?: {
    id: number;
    word: string;
    questionText: string;
    correctAnswer: string;
    audio: string;
    explanation: string;
    isPrefilled?: boolean;
    prefilledIndexes?: number[];
  };
  
  // UI options
  showProgress?: boolean;
  totalQuestions?: number;
  currentQuestionIndex?: number;
  showHints?: boolean;
  showExplanation?: boolean;
  
  // Realtime session integration
  sendMessage?: (text: string) => void;
  interruptRealtimeSession?: () => void;

  // Optional delay to enable the Next chevron after a correct answer (ms)
  nextUnlockDelayMs?: number;
  /** When true, enable realtime speech hinting on incorrect attempts (assignment-only) */
  isAssignmentFlow?: boolean;
}

const SpellBox: React.FC<SpellBoxProps> = ({
  // Basic props
  word,
  sentence,
  onComplete,
  onSkip,
  onNext,
  highlightNext = false,
  className,
  isVisible = true,
  variant = 'overlay',
  
  // Enhanced props
  question,
  
  // UI options
  showProgress = false,
  totalQuestions = 1,
  currentQuestionIndex = 0,
  showHints = true,
  showExplanation = true,
  
  // Realtime session integration
  sendMessage,
  interruptRealtimeSession,
  nextUnlockDelayMs = 0
  , isAssignmentFlow = false
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [showHint, setShowHint] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [aiHint, setAiHint] = useState<string>('');
  const [isGeneratingHint, setIsGeneratingHint] = useState(false);
  const [canClickNext, setCanClickNext] = useState(false);
  
  // Tutorial system integration
  const {
    showTutorial,
    tutorialStep,
    needsFillInBlanksTutorial,
    isFirstTimeAdventurer,
    nextTutorialStep,
    skipTutorial,
  } = useFillInBlanksTutorial();

  // Legacy first-time instruction state (for backward compatibility)
  const [showFirstTimeInstruction, setShowFirstTimeInstruction] = useState(false);
  const [hasShownFirstTimeInstruction, setHasShownFirstTimeInstruction] = useState(false);

  // Determine which word to use (question takes precedence)
  const targetWord = question?.word || word || '';
  const questionText = question?.questionText;
  const questionId = question?.id;
  
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
      // // console.log('🔍 SpellBox: Processing long passage for word:', word);
      // First try strict matching
      if (containsWord(sentence, true)) {
        // // console.log('✅ SpellBox: Found word with strict matching in long passage');
        return sentence;
      }
      // Then try lenient matching for longer passages
      if (containsWord(sentence, false)) {
        // // console.log('✅ SpellBox: Found word with lenient matching in long passage');
        return sentence;
      }
      // Last attempt: extract sentence containing the word
      const sentences = sentence.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
      for (const sent of sentences) {
        if (containsWord(sent, false)) {
          // // console.log('✅ SpellBox: Found word in extracted sentence:', sent);
          return sent;
        }
      }
      // // console.log('❌ SpellBox: Could not find word in long passage');
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
  
  // // console.log('🎯 SpellBox Debug:', { 
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
  // // console.log(`🔍 SpellBox: Target word "${targetWord}" found in sentence: ${wordFoundInSentence}`);
  
  if (!wordFoundInSentence && targetWord && workingSentence) {
    console.error(`❌ SpellBox CRITICAL: Target word "${targetWord}" NOT found in sentence: "${workingSentence}"`);
  }
  
  // Get audio text - just the target word for spelling
  const audioText = targetWord;

  
  const explanation = question?.explanation;

  // Parse the word into parts (text and blanks)
  const parseWord = useCallback((word: string): WordPart[] => {
    // console.log('🔤 SPELLBOX parseWord called:', {
    //   word,
    //   isPrefilled: question?.isPrefilled,
    //   prefilledIndexes: question?.prefilledIndexes
    // });
    
    // Check if this question has prefilled characters
    if (question?.isPrefilled && question?.prefilledIndexes && question.prefilledIndexes.length > 0) {
      // console.log('🔤 SPELLBOX: Using prefilled mode');
      const parts: WordPart[] = [];
      const upperWord = word.toUpperCase();
      const prefilledSet = new Set(question.prefilledIndexes);
      
      let currentTextPart = '';
      let currentBlankPart = '';
      
      for (let i = 0; i < upperWord.length; i++) {
        const char = upperWord[i];
        const isPrefilled = prefilledSet.has(i);
        
        // console.log(`🔤 SPELLBOX: Processing char ${i}: "${char}" (prefilled: ${isPrefilled})`);
        
        if (isPrefilled) {
          // If we have accumulated blank characters, add them as a blank part
          if (currentBlankPart) {
            parts.push({ type: 'blank', answer: currentBlankPart });
            // console.log(`🔤 SPELLBOX: Added blank part: "${currentBlankPart}"`);
            currentBlankPart = '';
          }
          // Add this character to the text part
          currentTextPart += char;
        } else {
          // If we have accumulated text characters, add them as a text part
          if (currentTextPart) {
            parts.push({ type: 'text', content: currentTextPart });
            // console.log(`🔤 SPELLBOX: Added text part: "${currentTextPart}"`);
            currentTextPart = '';
          }
          // Add this character to the blank part
          currentBlankPart += char;
        }
      }
      
      // Add any remaining parts
      if (currentTextPart) {
        parts.push({ type: 'text', content: currentTextPart });
        // console.log(`🔤 SPELLBOX: Added final text part: "${currentTextPart}"`);
      }
      if (currentBlankPart) {
        parts.push({ type: 'blank', answer: currentBlankPart });
        // console.log(`🔤 SPELLBOX: Added final blank part: "${currentBlankPart}"`);
      }
      
      // console.log('🔤 SPELLBOX: Final parts array:', parts);
      // console.log('🔤 SPELLBOX: Expected display:', parts.map(p => 
      //   p.type === 'text' ? p.content : '_'.repeat(p.answer?.length || 0)
      // ).join(''));
      
      return parts;
    }
    
    // console.log('🔤 SPELLBOX: Using default mode (all blanks)');
    // Default behavior: make the entire word a blank to spell
    return [
      { type: 'blank', answer: word.toUpperCase() }
    ];
  }, [question]);

  // Helper function to get the expected length for user input (excluding prefilled characters)
  const getExpectedUserInputLength = useCallback((): number => {
    const expectedLength = question?.isPrefilled && question?.prefilledIndexes 
      ? targetWord.length - question.prefilledIndexes.length 
      : targetWord.length;
    
    // console.log('🔤 SPELLBOX getExpectedUserInputLength:', {
    //   targetWordLength: targetWord.length,
    //   prefilledCount: question?.prefilledIndexes?.length || 0,
    //   expectedUserInputLength: expectedLength,
    //   isPrefilled: question?.isPrefilled
    // });
    
    return expectedLength;
  }, [question, targetWord]);

  const parts = parseWord(targetWord);
  const totalBlanks = parts.filter(part => part.type === 'blank').length;
  const correctlySpelledWords = isCorrect ? totalBlanks : 0;
  
  // console.log('🧩 SpellBox Parts Debug:', {
  //   targetWord,
  //   parts,
  //   totalBlanks,
  //   partsLength: parts.length
  // });

  // Debug: Log component initialization with prefilled info
  React.useEffect(() => {
    if (question) {
      // console.log('🔤 SPELLBOX COMPONENT INITIALIZED:', {
      //   targetWord,
      //   isPrefilled: question.isPrefilled,
      //   prefilledIndexes: question.prefilledIndexes,
      //   questionId: question.id,
      //   expectedUserInputLength: getExpectedUserInputLength(),
      //   totalParts: parts.length,
      //   textParts: parts.filter(p => p.type === 'text').length,
      //   blankParts: parts.filter(p => p.type === 'blank').length
      // });
    }
  }, [question, targetWord, parts, getExpectedUserInputLength]);

  // Compute the cumulative blank offset up to a given blank part index
  const getBlankBaseIndexForPart = useCallback((allParts: WordPart[], targetPartIndex: number): number => {
    let offset = 0;
    for (let i = 0; i < targetPartIndex; i++) {
      const p = allParts[i] as any;
      if (p && p.type === 'blank') {
        offset += (p.answer?.length || 0);
      }
    }
    return offset;
  }, []);

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

  // Helper function to reconstruct the complete word from user input and prefilled characters
  const reconstructCompleteWord = useCallback((userInput: string): string => {
    if (!question?.isPrefilled || !question?.prefilledIndexes) {
      // console.log('🔤 SPELLBOX reconstructCompleteWord: Using default mode, returning userInput as-is:', userInput);
      return userInput;
    }
    
    const upperWord = targetWord.toUpperCase();
    const prefilledSet = new Set(question.prefilledIndexes);
    let result = '';
    let userInputIndex = 0;
    
    // console.log('🔤 SPELLBOX reconstructCompleteWord: Starting reconstruction:', {
    //   userInput,
    //   targetWord: upperWord,
    //   prefilledIndexes: question.prefilledIndexes
    // });
    
    for (let i = 0; i < upperWord.length; i++) {
      if (prefilledSet.has(i)) {
        // Use prefilled character
        result += upperWord[i];
        // console.log(`🔤 SPELLBOX: Position ${i}: Using prefilled "${upperWord[i]}"`);
      } else {
        // Use user input character (or empty if not provided). Treat space as empty.
        const rawChar = userInput[userInputIndex] || '';
        const userChar = rawChar === ' ' ? '' : rawChar;
        result += userChar;
        // console.log(`🔤 SPELLBOX: Position ${i}: Using user input "${userChar}" (userInputIndex: ${userInputIndex})`);
        userInputIndex++;
      }
    }
    
    // console.log('🔤 SPELLBOX reconstructCompleteWord: Final result:', result);
    return result;
  }, [question, targetWord]);

  // Helper function to check if user input is complete (all blank positions filled)
  const isUserInputComplete = useCallback((userInput: string): boolean => {
    const expectedLength = getExpectedUserInputLength();
    const isComplete = userInput.length === expectedLength && !userInput.includes(' ');
    
    // console.log('🔤 SPELLBOX isUserInputComplete:', {
    //   userInput,
    //   userInputLength: userInput.length,
    //   expectedLength,
    //   isComplete,
    //   hasSpaces: userInput.includes(' ')
    // });
    
    return isComplete;
  }, [getExpectedUserInputLength]);

  // Helper function to get user input character at a specific blank position
  const getUserInputAtBlankIndex = useCallback((blankIndex: number): string => {
    const ch = userAnswer[blankIndex];
    return ch === ' ' ? '' : (ch || '');
  }, [userAnswer]);

  // Helper function to update user input at a specific blank position
  const updateUserInputAtBlankIndex = useCallback((blankIndex: number, newValue: string): string => {
    const expectedLength = getExpectedUserInputLength();
    const baseArray = Array.from({ length: expectedLength }, (_, i) => {
      const existing = userAnswer[i];
      return existing === undefined || existing === '' ? ' ' : existing;
    });
    baseArray[blankIndex] = newValue === '' ? ' ' : newValue;
    return baseArray.join('');
  }, [userAnswer, getExpectedUserInputLength]);

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
    `krafty-spellbox-audio-${targetWord}-${Date.now()}`, 
    [targetWord]
  );
  const isSpeaking = useTTSSpeaking(messageId);

  // TTS message ID for first-time instruction
  const instructionMessageId = useMemo(() => 
    'spellbox-first-time-instruction',
    []
  );
  const isInstructionSpeaking = useTTSSpeaking(instructionMessageId);

  // Resolve Jessica's voice id once
  const jessicaVoiceId = useMemo(() => {
    const jessica = AVAILABLE_VOICES.find(v => v.name === 'Jessica');
    return jessica?.id || 'cgSgspJ2msm6clMCkdW9';
  }, []);

  // Calculate speaker button position dynamically
  // const calculateSpeakerButtonPosition = useCallback(() => {
  //   const speakerButton = document.getElementById('spellbox-speaker-button');
  //   const spellBoxContainer = document.querySelector('.spellbox-container');
  //   
  //   if (speakerButton && spellBoxContainer) {
  //     const buttonRect = speakerButton.getBoundingClientRect();
  //     const containerRect = spellBoxContainer.getBoundingClientRect();
  //     
  //     const relativeX = buttonRect.left - containerRect.left + (buttonRect.width / 2);
  //     const relativeY = buttonRect.top - containerRect.top + (buttonRect.height / 2);
  //     
  //     setSpeakerButtonPosition({ x: relativeX, y: relativeY });
  //     // console.log('📍 Speaker button position calculated:', { 
  //       x: relativeX, 
  //       y: relativeY,
  //       buttonRect: {
  //         left: buttonRect.left,
  //         top: buttonRect.top,
  //         width: buttonRect.width,
  //         height: buttonRect.height
  //       },
  //       containerRect: {
  //         left: containerRect.left,
  //         top: containerRect.top,
  //         width: containerRect.width,
  //         height: containerRect.height
  //       }
  //     });
  //   } else {
  //     console.warn('⚠️ Speaker button or container not found for positioning');
  //     // Fallback to center-based positioning
  //     setSpeakerButtonPosition({ x: 300, y: 200 }); // Default fallback
  //   }
  // }, []);

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
      colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
      zIndex: 2147483647
    });
    
    // Add a second burst with different settings
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#FF6B6B', '#4ECDC4', '#45B7D1'],
        zIndex: 2147483647
      });
    }, 250);
    
    // Add a third burst from the other side
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#FFD700', '#96CEB4', '#FFEAA7'],
        zIndex: 2147483647
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
    // console.log('🎵 INSTRUCTION AUDIO: Checking if TTS is currently speaking...');
    
    // Check if TTS is currently speaking
    if (ttsService.getIsSpeaking()) {
      // console.log('🎵 INSTRUCTION AUDIO: TTS is speaking, waiting for completion...');
      const currentMessageId = ttsService.getCurrentSpeakingMessageId();
      // console.log('🎵 INSTRUCTION AUDIO: Current speaking message ID:', currentMessageId);
      
      // Create a promise that resolves when current TTS finishes (with timeout)
      const waitForTTSComplete = new Promise<void>((resolve) => {
        let attempts = 0;
        const maxAttempts = 50; // 10 seconds maximum wait (50 * 200ms)
        
        const checkTTSStatus = () => {
          attempts++;
          
          if (!ttsService.getIsSpeaking()) {
            // console.log('🎵 INSTRUCTION AUDIO: TTS completed, ready to play instruction');
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
      // console.log('🎵 INSTRUCTION AUDIO: New TTS started while waiting, skipping instruction audio');
      return;
    }
    
    // console.log('🎵 INSTRUCTION AUDIO: Playing instruction audio');
    const instructionText = "Fill in the blank with the correct spelling using the audio";
    
    try {
      await ttsService.speak(instructionText, {
        stability: 0.7,
        similarity_boost: 0.9,
        speed: 0.8,
        messageId: instructionMessageId,
        voice: jessicaVoiceId
      });
    } catch (error) {
      console.error('🎵 INSTRUCTION AUDIO: Error playing instruction audio:', error);
    }
  }, [instructionMessageId]);

  // Play word audio using ElevenLabs TTS
  const playWordAudio = useCallback(async () => {
    // console.log('🎵 SPELLBOX SPEAKER BUTTON: Click detected', {
    //   audioText,
    //   targetWord,
    //   messageId,
    //   isSpeaking
    // });
    
    playClickSound();
    
    if (isSpeaking) {
      // console.log('🎵 SPELLBOX SPEAKER BUTTON: Stopping current speech');
      ttsService.stop();
    } else {
      // console.log('🎵 SPELLBOX SPEAKER BUTTON: Starting speech with ElevenLabs TTS at 0.7x speed');
      await ttsService.speak(audioText, {
        stability: 0.7,
        similarity_boost: 0.9,
        speed: 0.7,  // Set speed to 0.7x for SpellBox words
        messageId: messageId,
        voice: jessicaVoiceId
      });
    }
  }, [audioText, targetWord, messageId, isSpeaking]);

  // Gate the Next chevron after a correct answer if a delay is requested
  useEffect(() => {
    let timer: number | undefined;
    if (isCorrect) {
      if (nextUnlockDelayMs > 0) {
        setCanClickNext(false);
        timer = window.setTimeout(() => setCanClickNext(true), nextUnlockDelayMs);
      } else {
        setCanClickNext(true);
      }
    } else {
      setCanClickNext(false);
    }
    return () => { if (timer) window.clearTimeout(timer); };
  }, [isCorrect, nextUnlockDelayMs]);

  // Handle answer change
  const handleAnswerChange = useCallback((newAnswer: string) => {
    // console.log('🔤 SPELLBOX handleAnswerChange called:', {
    //   newAnswer,
    //   previousUserAnswer: userAnswer,
    //   targetWord
    // });
    
    setUserAnswer(newAnswer);
    
    if (isUserInputComplete(newAnswer)) {
      const completeWord = reconstructCompleteWord(newAnswer);
      const correct = isWordCorrect(completeWord, targetWord);
      
      // console.log('🔤 SPELLBOX: User input complete!', {
      //   userInput: newAnswer,
      //   reconstructedWord: completeWord,
      //   targetWord,
      //   isCorrect: correct
      // });
      
      setIsCorrect(correct);
      setIsComplete(true);
      
      if (correct) {
        // console.log('🎉 SPELLBOX: CORRECT ANSWER! Triggering celebration');
        
        // Stop any ongoing realtime session speech since it's no longer relevant
        if (interruptRealtimeSession) {
          interruptRealtimeSession();
        }
        
        // Trigger confetti celebration for correct answer
        triggerConfetti();
        
        // Complete tutorial if this is the first time
        if (showTutorial) {
          nextTutorialStep();
        }
        
        if (onComplete) {
          // Delay advancing slightly to ensure confetti is visible on screen
          const ADVANCE_DELAY_MS = 500;
          setTimeout(() => {
            // Enhanced callback includes complete word and attempt count
            onComplete(true, completeWord, attempts + 1);
          }, ADVANCE_DELAY_MS);
        }
      } else {
        // console.log('❌ SPELLBOX: Incorrect answer, generating hint');
        // Increment attempts for incorrect answer
        setAttempts(prev => prev + 1);
        // Notify parent on first incorrect attempt so callers can react (e.g., assignment switch)
        try {
          if (onComplete && attempts === 0) {
            // attempts is current count before increment; first incorrect means attempts === 0
            onComplete(false, completeWord, 1);
          }
        } catch {}
        // In assignment mode, the adventure restarts and grade changes on first incorrect.
        // Do not generate hints or send realtime messages; the context will reset.
        if (isAssignmentFlow) {
          return;
        }
        // Generate AI hint for incorrect answer (non-assignment flows only)
        generateAIHint(completeWord);
        // Trigger realtime pronunciation coach prompt (non-assignment flows)
        if (sendMessage && targetWord) {
          try {
            sendMessage(`correct answer is ${targetWord}, student response is ${completeWord}`);
          } catch {}
        }
      }
    } else {
      // console.log('🔤 SPELLBOX: User input not complete yet');
      setIsComplete(false);
      setIsCorrect(false);
    }
  }, [targetWord, onComplete, isUserInputComplete, reconstructCompleteWord, isWordCorrect, triggerConfetti, generateAIHint, userAnswer, sendMessage, isAssignmentFlow]);

  // Focus next empty box (scoped to this component)
  const focusNextEmptyBox = useCallback(() => {
    const scope = containerRef.current;
    if (!scope) return false;
    const inputs = scope.querySelectorAll('input[data-letter]') as NodeListOf<HTMLInputElement>;
    for (let i = 0; i < inputs.length; i++) {
      if (!inputs[i].value.trim()) {
        inputs[i].focus();
        return true;
      }
    }
    return false;
  }, []);

  // Ensure a box is focused on mount and when target word changes
  useEffect(() => {
    setTimeout(() => { focusNextEmptyBox(); }, 0);
  }, []);

  // Reset state only when the actual question changes (stable id),
  // not on incidental re-renders, to avoid clearing correct answers prematurely.
  const prevQuestionIdRef = useRef<number | undefined>(undefined);
  const prevTargetWordRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const idChanged = questionId !== prevQuestionIdRef.current && typeof questionId === 'number';
    const wordChangedWithoutId = (typeof questionId !== 'number') && targetWord !== prevTargetWordRef.current;
    if (idChanged || wordChangedWithoutId) {
      setUserAnswer('');
      setIsCorrect(false);
      setIsComplete(false);
      setShowHint(false);
      setAttempts(0);
      setAiHint('');
      setIsGeneratingHint(false);
      setTimeout(() => { focusNextEmptyBox(); }, 0);
    }
    prevQuestionIdRef.current = questionId;
    prevTargetWordRef.current = targetWord;
  }, [questionId, targetWord, focusNextEmptyBox]);

  // Play instruction audio when first-time instruction shows
  // useEffect(() => {
  //   if (showFirstTimeInstruction) {
  //     // Calculate speaker button position first
  //     const positionTimer = setTimeout(() => {
  //       calculateSpeakerButtonPosition();
  //     }, 100);
  //     
  //     // Wait longer before trying to play audio to allow chat TTS to complete
  //     const audioTimer = setTimeout(() => {
  //       playInstructionAudio();
  //     }, 1500); // Increased delay to allow chat audio to complete
  //     
  //     return () => {
  //       clearTimeout(positionTimer);
  //       clearTimeout(audioTimer);
  //     };
  //   }
  // }, [showFirstTimeInstruction, playInstructionAudio, calculateSpeakerButtonPosition]);

  // Retry position calculation if not found initially
  // useEffect(() => {
  //   if (showFirstTimeInstruction && !speakerButtonPosition) {
  //     const retryTimer = setTimeout(() => {
  //       calculateSpeakerButtonPosition();
  //     }, 200);
  //     return () => clearTimeout(retryTimer);
  //   }
  // }, [showFirstTimeInstruction, speakerButtonPosition, calculateSpeakerButtonPosition]);

  // Recalculate position on window resize
  // useEffect(() => {
  //   if (showFirstTimeInstruction) {
  //     const handleResize = () => {
  //       calculateSpeakerButtonPosition();
  //     };
  //     
  //     window.addEventListener('resize', handleResize);
  //     return () => window.removeEventListener('resize', handleResize);
  //   }
  // }, [showFirstTimeInstruction, calculateSpeakerButtonPosition]);


  // Don't render if we don't have the basic requirements, but be more lenient about sentence
  // In inline mode, respect isVisible but default is true
  if (!isVisible || !targetWord) return null;

  return (
    <>
      {/* Tutorial overlay for first-time users (overlay mode only) */}
      {variant === 'overlay' && showTutorial && (
        <div className="tutorial-overlay" />
      )}
      
      {variant === 'overlay' ? (
      <div className={cn(
        "absolute inset-0 w-full h-full flex items-center justify-center z-20 pointer-events-none",
        className
      )}>
        <div
          ref={containerRef}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (!target.closest('input[data-letter]')) {
              focusNextEmptyBox();
            }
          }}
          className={cn(
          "spellbox-container pointer-events-auto bg-white rounded-2xl p-8 border border-black/20 shadow-[0_4px_0_black] max-w-lg w-full mx-4 relative",
          showTutorial && "tutorial-spotlight",
          showTutorial && tutorialStep === 'expand' && "tutorial-expand",
          showTutorial && tutorialStep === 'glow' && "tutorial-glow tutorial-highlight"
        )}
        >
        <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 20, fontWeight: 500, lineHeight: 1.6 }}>
            { /* CONTENT START */ }

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
                  
                  // Enhanced matching: check if the target word appears at the start or end of the normalized word
                  // This handles cases like:
                  // - "notebook—I" where target is "notebook" (suffix case)
                  // - "nervously—minus" where target is "minus" (prefix case)
                  const isTargetWord = normalizedWord === normalizedTarget || 
                                     (normalizedTarget.length >= 3 && (
                                       normalizedWord.startsWith(normalizedTarget) || // suffix case: "notebook—I"
                                       normalizedWord.endsWith(normalizedTarget)      // prefix case: "nervously—minus"
                                     ));
                  
                  // console.log(`🔤 Word comparison: "${word}" (normalized: "${normalizedWord}") vs target "${targetWord}" (normalized: "${normalizedTarget}") = ${isTargetWord}`);
                  
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
                          // console.log('🎨 Rendering part:', { partIndex, part, type: part.type });
                          
                          // Debug: Log current state for this part
                          // console.log('🔤 SPELLBOX RENDER STATE:', {
                          //   partIndex,
                          //   partType: part.type,
                          //   partContent: part.content,
                          //   partAnswer: part.answer,
                          //   currentUserAnswer: userAnswer,
                          //   isComplete,
                          //   isCorrect,
                          //   targetWord
                          // });
                          
                          if (part.type === 'text') {
                            // Render each prefilled character in its own dotted box
                            return (
                              <React.Fragment key={partIndex}>
                                {part.content?.split('').map((char, charIndex) => (
                                  <div
                                    key={`${partIndex}-${charIndex}`}
                                    style={{
                                      width: '36px',
                                      height: '44px',
                                      borderRadius: '8px',
                                      fontSize: '22px',
                                      fontFamily: 'system-ui, -apple-system, sans-serif',
                                      fontWeight: '700',
                                      textAlign: 'center',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      textTransform: 'uppercase',
                                      color: '#1F2937',
                                      background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
                                      border: '2px dashed #9CA3AF',
                                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                                      transition: 'all 0.15s ease-out'
                                    }}
                                  >
                                    {char}
                                  </div>
                                ))}
                              </React.Fragment>
                            );
                          } else {
                            const expectedLength = part.answer?.length || 5;
                            const baseIndex = getBlankBaseIndexForPart(parts, partIndex);
                            return (
                              <div key={partIndex} className="flex items-center gap-2">
                                {Array.from({ length: expectedLength }, (_, letterIndex) => {
                                  const globalIndex = baseIndex + letterIndex;
                                  const letterValue = getUserInputAtBlankIndex(globalIndex);
                                  const completeWord = reconstructCompleteWord(userAnswer);
                                  const isWordCompleteNow = isUserInputComplete(userAnswer);
                                  const isWordCorrectNow = isWordCompleteNow && isWordCorrect(completeWord, targetWord);
                                  const isWordIncorrectNow = isWordCompleteNow && !isWordCorrectNow;
                                  
                                  // Check if this specific letter is correct in its position
                                  const correctLetter = part.answer?.[letterIndex]?.toUpperCase() || '';
                                  const isLetterCorrect = letterValue && letterValue.toUpperCase() === correctLetter;
                                  
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
                                    // Entire word is correct - green
                                    boxStyle = {
                                      ...boxStyle,
                                      background: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)',
                                      border: '3px solid #22C55E',
                                      color: '#15803D',
                                      boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)',
                                      cursor: 'not-allowed',
                                      transform: 'translateY(-2px)'
                                    };
                                  } else if (isWordCompleteNow && isLetterCorrect) {
                                    // Word is complete and this letter is in correct position - green
                                    boxStyle = {
                                      ...boxStyle,
                                      background: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)',
                                      border: '3px solid #22C55E',
                                      color: '#15803D',
                                      boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)'
                                    };
                                  } else if (isWordIncorrectNow && letterValue) {
                                    // Word is complete but this letter is incorrect - red
                                    boxStyle = {
                                      ...boxStyle,
                                      background: 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)',
                                      border: '3px solid #EF4444',
                                      color: '#B91C1C',
                                      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
                                    };
                                  } else if (letterValue) {
                                    // Letter has value but word not complete yet - blue
                                    boxStyle = {
                                      ...boxStyle,
                                      background: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)',
                                      border: '3px solid #0EA5E9',
                                      color: '#0369A1',
                                      boxShadow: '0 4px 12px rgba(14, 165, 233, 0.2)'
                                    };
                                  } else {
                                    // Empty letter - gray
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
                                      onCompositionStart={() => {
                                        // During IME composition, defer validation until compositionend
                                      }}
                                      onCompositionEnd={(e) => {
                                        const composed = (e.target as HTMLInputElement).value || '';
                                        const finalChar = composed.slice(-1).toUpperCase();
                                        if (finalChar.match(/[A-Z]/)) {
                                          const newUserAnswer = updateUserInputAtBlankIndex(globalIndex, finalChar);
                                          handleAnswerChange(newUserAnswer);
                                          playClickSound();
                                          const nextBox = containerRef.current?.querySelector(`input[data-letter="${globalIndex + 1}"]`) as HTMLInputElement | null;
                                          if (nextBox) setTimeout(() => nextBox.focus(), 10);
                                        }
                                      }}
                                      onChange={(e) => {
                                        if (isWordCorrectNow) return;
                                        
                                        const newValue = e.target.value.toUpperCase();
                                        // console.log(`🔤 SPELLBOX INPUT onChange: letterIndex=${letterIndex}, newValue="${newValue}"`);
                                        
                                        if (newValue.match(/[A-Z]/) || newValue === '') {
                                          const newUserAnswer = updateUserInputAtBlankIndex(globalIndex, newValue);
                                          // console.log(`🔤 SPELLBOX INPUT: Updated user answer from "${userAnswer}" to "${newUserAnswer}"`);
                                          
                                          handleAnswerChange(newUserAnswer);
                                          playClickSound();
                                          
                                          if (newValue) {
                                            const nextBox = containerRef.current?.querySelector(`input[data-letter="${globalIndex + 1}"]`) as HTMLInputElement | null;
                                            if (nextBox) {
                                              // console.log(`🔤 SPELLBOX INPUT: Moving focus to next box (${letterIndex + 1})`);
                                              setTimeout(() => nextBox.focus(), 10);
                                            }
                                          }
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Backspace') {
                                          if (letterValue) {
                                            e.preventDefault();
                                              const newUserAnswer = updateUserInputAtBlankIndex(globalIndex, '');
                                            handleAnswerChange(newUserAnswer);
                                          } else if (globalIndex > 0 && containerRef.current) {
                                            const prevBox = containerRef.current.querySelector(`input[data-letter="${globalIndex - 1}"]`) as HTMLInputElement | null;
                                            if (prevBox) prevBox.focus();
                                          }
                                        } else if (e.key === 'ArrowLeft' && globalIndex > 0 && containerRef.current) {
                                          const prevBox = containerRef.current.querySelector(`input[data-letter="${globalIndex - 1}"]`) as HTMLInputElement | null;
                                          if (prevBox) prevBox.focus();
                                        } else if (e.key === 'ArrowRight') {
                                          const nextBox = containerRef.current?.querySelector(`input[data-letter="${globalIndex + 1}"]`) as HTMLInputElement | null;
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
                                        const completeWordNow = reconstructCompleteWord(userAnswer);
                                        const isCorrectNow = isUserInputComplete(userAnswer) && isWordCorrect(completeWordNow, targetWord);
                                        const isIncorrectNow = isUserInputComplete(userAnswer) && !isCorrectNow;
                                        
                                        // Check if this specific letter is correct in its position
                                        const correctLetterBlur = part.answer?.[letterIndex]?.toUpperCase() || '';
                                        const isLetterCorrectBlur = hasValue && e.target.value.toUpperCase() === correctLetterBlur;
                                        
                                        e.target.style.transform = 'scale(1)';
                                        e.target.style.borderStyle = hasValue ? 'solid' : 'dashed';
                                        
                                        if (isCorrectNow) {
                                          // Entire word is correct
                                          e.target.style.borderColor = '#22C55E';
                                          e.target.style.boxShadow = '0 2px 4px rgba(34, 197, 94, 0.2)';
                                        } else if (isWordCompleteNow && isLetterCorrectBlur) {
                                          // Word is complete and this letter is in correct position
                                          e.target.style.borderColor = '#22C55E';
                                          e.target.style.boxShadow = '0 2px 4px rgba(34, 197, 94, 0.2)';
                                        } else if (isIncorrectNow && hasValue) {
                                          // Word is complete but this letter is incorrect
                                          e.target.style.borderColor = '#EF4444';
                                          e.target.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.2)';
                                        } else if (hasValue) {
                                          // Letter has value but word not complete yet
                                          e.target.style.borderColor = '#0EA5E9';
                                          e.target.style.boxShadow = '0 2px 4px rgba(14, 165, 233, 0.2)';
                                        } else {
                                          // Empty letter
                                          e.target.style.borderColor = '#94A3B8';
                                          e.target.style.boxShadow = '0 1px 2px rgba(148, 163, 184, 0.1)';
                                        }
                                      }}
                                      data-letter={globalIndex}
                                    />
                                  );
                                })}
                              </div>
                            );
                          }
                        })}
                        
                        {/* Audio button with ElevenLabs TTS - positioned after the complete word */}
                        <Button
                          id="spellbox-speaker-button"
                          variant="comic"
                          size="icon"
                          onClick={playWordAudio}
                          className={cn(
                            'ml-2 h-11 w-11 rounded-lg border-2 border-black bg-white text-foreground shadow-[0_4px_0_rgba(0,0,0,0.6)] transition-transform hover:scale-105',
                            isSpeaking && 'bg-red-500 text-white hover:bg-red-600'
                          )}
                          title={isSpeaking ? 'Stop audio' : 'Listen to this word'}
                          aria-label={isSpeaking ? 'Stop audio' : 'Play audio'}
                        >
                          {isSpeaking ? (
                            <Square className="h-5 w-5" />
                          ) : (
                            <Volume2 className="h-5 w-5" />
                          )}
                        </Button>
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
                  {false && isComplete && !isCorrect && showHints && (
            <div style={{
              padding: '12px 0',
              marginBottom: '20px',
              position: 'relative',
              animation: 'fadeSlideIn 0.3s ease-out'
            }}>
               <div style={{
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 gap: '12px'
               }}>
                 <div style={{ 
                   fontSize: '14px', 
                   fontWeight: 400, 
                   color: '#6B7280', 
                   fontFamily: 'system-ui, -apple-system, sans-serif',
                   letterSpacing: '0.5px'
                 }}>
                   Need help? Try listening again
                 </div>
                 
                 {/* Hint button */}
                 <button
                   onClick={() => {
                     playClickSound();
                     if (sendMessage && targetWord) {
                       sendMessage(`correct answer is ${targetWord} , student response is ${reconstructCompleteWord(userAnswer)}`)
                     }
                   }}
                   style={{
                     width: '32px',
                     height: '32px',
                     borderRadius: '50%',
                     border: '2px solid #4B5563',
                     background: 'transparent',
                     color: '#6B7280',
                     cursor: 'pointer',
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     fontSize: '14px',
                     transition: 'all 0.2s ease-out',
                     flexShrink: 0,
                     filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
                   }}
                   title="Get pronunciation help"
                   onMouseEnter={(e) => {
                     e.currentTarget.style.borderColor = '#374151';
                     e.currentTarget.style.color = '#374151';
                     e.currentTarget.style.transform = 'scale(1.05)';
                     e.currentTarget.style.filter = 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15))';
                   }}
                   onMouseLeave={(e) => {
                     e.currentTarget.style.borderColor = '#4B5563';
                     e.currentTarget.style.color = '#6B7280';
                     e.currentTarget.style.transform = 'scale(1)';
                     e.currentTarget.style.filter = 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))';
                   }}
                 >
                   🎤
                 </button>
               </div>
            </div>
          )}

          {/* Next chevron - circular, positioned on the right of the spellbox */}
          {isCorrect && onNext && canClickNext && (
            <div className="absolute top-1/2 -translate-y-1/2 -right-[24px] z-20">
              <Button
                variant="comic"
                size="icon"
                aria-label="Next question"
                onClick={() => { playClickSound(); onNext(); }}
                className={cn('h-12 w-12 rounded-full shadow-[0_4px_0_rgba(0,0,0,0.6)] hover:scale-105', highlightNext && 'animate-[wiggle_1s_ease-in-out_infinite] ring-4 ring-yellow-300')}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
              {highlightNext && (
                <div className="ml-2 text-2xl select-none" aria-hidden="true">👉</div>
              )}
            </div>
          )}

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

            @keyframes bounceIn { 0% { opacity: 0; transform: scale(0.3);} 50% { opacity: 0.9; transform: scale(1.1);} 80% { opacity: 1; transform: scale(0.89);} 100% { opacity: 1; transform: scale(1);} }


            @keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }

            @keyframes wiggle { 0%,100% { transform: rotate(0deg);} 25% { transform: rotate(6deg);} 75% { transform: rotate(-6deg);} }

          `}</style>
            { /* CONTENT END */ }
        </div>

        {/* Tutorial message for first-time users */}
        {showTutorial && tutorialStep === 'expand' && (
          <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg z-50">
            <div className="text-center">
              <div className="text-xs opacity-90 mb-1">✨ First Adventure Tutorial ✨</div>
              <div>Fill in the blanks to spell the word!</div>
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-purple-600"></div>
          </div>
        )}
            </div>
            {/* Close outer container for overlay mode */}
          </div>
      ) : (
        // Inline variant for embedding inside other UI (e.g., pet bubble)
        <div ref={containerRef} className={cn("spellbox-inline-container", className)}>
          <div className="rounded-xl" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            { /* CONTENT START */ }
            
            {/* Question text and interactive inputs reused as-is */}
            {workingSentence && (
              <div className="text-center">
                <div className="text-base text-gray-800" style={{ lineHeight: 1.5 }}>
                  {workingSentence.split(' ').map((word, idx) => {
                    const normalizedWord = word.toLowerCase().replace(/[^\w]/g, '');
                    const normalizedTarget = targetWord.toLowerCase().replace(/[^\w]/g, '');
                    const isTargetWord = normalizedWord === normalizedTarget || 
                      (normalizedTarget.length >= 3 && (normalizedWord.startsWith(normalizedTarget) || normalizedWord.endsWith(normalizedTarget)));
                    return (
                      <React.Fragment key={idx}>
                        {isTargetWord ? (
                          <div style={{ display: 'inline-flex', gap: '6px', padding: '6px', background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)', borderRadius: '10px', border: '2px solid rgba(109,40,217,0.2)', margin: '0 2px' }}>
                            {parts.map((part, partIndex) => {
                              if (part.type === 'text') {
                                return (
                                  <React.Fragment key={partIndex}>
                                    {part.content?.split('').map((char, charIndex) => (
                                      <div key={`${partIndex}-${charIndex}`} style={{ width: '28px', height: '36px', borderRadius: '8px', fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', textTransform: 'uppercase', color: '#1F2937', background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)', border: '2px dashed #9CA3AF' }}>{char}</div>
                                    ))}
                                  </React.Fragment>
                                );
                              } else {
                                const expectedLength = part.answer?.length || 5;
                                const baseIndex = getBlankBaseIndexForPart(parts, partIndex);
                                return (
                                  <div key={partIndex} className="flex items-center gap-1">
                                    {Array.from({ length: expectedLength }, (_, letterIndex) => {
                                      const globalIndex = baseIndex + letterIndex;
                                      const letterValue = getUserInputAtBlankIndex(globalIndex);
                                      const completeWord = reconstructCompleteWord(userAnswer);
                                      const isWordCompleteNow = isUserInputComplete(userAnswer);
                                      const isWordCorrectNow = isWordCompleteNow && isWordCorrect(completeWord, targetWord);
                                      const isWordIncorrectNow = isWordCompleteNow && !isWordCorrectNow;
                                      const correctLetter = part.answer?.[letterIndex]?.toUpperCase() || '';
                                      const isLetterCorrect = letterValue && letterValue.toUpperCase() === correctLetter;
                                      let boxStyle: React.CSSProperties = { width: '28px', height: '36px', borderRadius: '8px', fontSize: '18px', fontWeight: 600, textAlign: 'center', outline: 'none', textTransform: 'uppercase', cursor: 'pointer' };
                                      if (isWordCorrectNow) {
                                        boxStyle = { ...boxStyle, background: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)', border: '2px solid #22C55E', color: '#15803D', cursor: 'not-allowed' };
                                      } else if (isWordCompleteNow && isLetterCorrect) {
                                        boxStyle = { ...boxStyle, background: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)', border: '2px solid #22C55E', color: '#15803D' };
                                      } else if (isWordIncorrectNow && letterValue) {
                                        boxStyle = { ...boxStyle, background: 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)', border: '2px solid #EF4444', color: '#B91C1C' };
                                      } else if (letterValue) {
                                        boxStyle = { ...boxStyle, background: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)', border: '2px solid #0EA5E9', color: '#0369A1' };
                                      } else {
                                        boxStyle = { ...boxStyle, background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)', border: '2px dashed #94A3B8', color: '#64748B' };
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
                                              const newUserAnswer = updateUserInputAtBlankIndex(globalIndex, newValue);
                                              handleAnswerChange(newUserAnswer);
                                              playClickSound();
                                              if (newValue && letterIndex < expectedLength - 1) {
                                                const nextBox = containerRef.current?.querySelector(`input[data-letter="${globalIndex + 1}"]`) as HTMLInputElement | null;
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
                                                const newUserAnswer = updateUserInputAtBlankIndex(globalIndex, '');
                                                handleAnswerChange(newUserAnswer);
                                              } else if (globalIndex > 0) {
                                                const prevBox = containerRef.current?.querySelector(`input[data-letter="${globalIndex - 1}"]`) as HTMLInputElement | null;
                                                if (prevBox) prevBox.focus();
                                              }
                                            } else if (e.key === 'ArrowLeft' && globalIndex > 0) {
                                              const prevBox = containerRef.current?.querySelector(`input[data-letter="${globalIndex - 1}"]`) as HTMLInputElement | null;
                                              if (prevBox) prevBox.focus();
                                            } else if (e.key === 'ArrowRight') {
                                              const nextBox = containerRef.current?.querySelector(`input[data-letter="${globalIndex + 1}"]`) as HTMLInputElement | null;
                                              if (nextBox) nextBox.focus();
                                            }
                                          }}
                                          style={boxStyle}
                                          data-letter={globalIndex}
                                        />
                                      );
                                    })}
                                  </div>
                                );
                              }
                            })}
                            {/* Inline mode speaker button - after the full word cluster */}
                            <Button
                              variant="comic"
                              size="icon"
                              onClick={playWordAudio}
                              className={cn(
                                'ml-1 h-8 w-8 rounded-md border-2 border-black bg-white text-foreground shadow-[0_3px_0_rgba(0,0,0,0.6)]',
                                isSpeaking ? 'bg-red-500 text-white hover:bg-red-600' : 'hover:bg-primary hover:text-primary-foreground'
                              )}
                              title={isSpeaking ? 'Stop audio' : 'Listen to this word'}
                              aria-label={isSpeaking ? 'Stop audio' : 'Play audio'}
                            >
                              {isSpeaking ? (
                                <Square className="h-4 w-4" />
                              ) : (
                                <Volume2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <span className="inline-block" style={{ fontWeight: 400 }}>{word}</span>
                        )}
                        {idx < workingSentence.split(' ').length - 1 && ' '}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Inline hints */}
            {isComplete && !isCorrect && showHints && (
              <div style={{ padding: '8px 0' }}>
                <button onClick={() => { playClickSound(); if (sendMessage && targetWord) { sendMessage(`correct answer is ${targetWord} , student response is ${reconstructCompleteWord(userAnswer)}`) } }} title="Get pronunciation help" style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px solid #4B5563', background: 'transparent', color: '#6B7280' }}>🎤</button>
          </div>
            )}

             {isCorrect && onNext && (
               <div className="absolute top-1/2 -translate-y-1/2 -right-[18px] z-20">
                <Button
                  variant="comic"
                  size="icon"
                  aria-label="Next question"
                  onClick={() => { playClickSound(); onNext(); }}
                  className={cn('h-9 w-9 rounded-full shadow-[0_3px_0_rgba(0,0,0,0.6)] hover:scale-105')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

    </div>
        </div>
      )}
    </>
  );
};

export default SpellBox; 