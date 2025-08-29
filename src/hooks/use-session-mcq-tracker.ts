import { useCallback } from 'react';
import { adventureSessionService, MCQAnswer } from '@/lib/adventure-session-service';

/**
 * Optional hook to track MCQ answers in Firebase sessions
 * This hook doesn't interfere with existing MCQ functionality
 */
export const useSessionMCQTracker = (currentSessionId: string | null) => {
  
  // Optional function to save MCQ answer to Firebase session
  const trackMCQAnswer = useCallback(async (
    questionId: number,
    selectedAnswer: number,
    isCorrect: boolean,
    topicId: string
  ) => {
    if (!currentSessionId) {
      return; // Gracefully do nothing if no session
    }

    const mcqAnswer: MCQAnswer = {
      questionId,
      selectedAnswer,
      isCorrect,
      timestamp: Date.now(),
      topicId
    };

    try {
      await adventureSessionService.addMCQAnswer(currentSessionId, mcqAnswer);
      console.log(`✅ Tracked MCQ answer: Q${questionId}, Correct: ${isCorrect}`);
    } catch (error) {
      console.warn('⚠️ Failed to track MCQ answer (continuing normally):', error);
      // Don't throw - let the app continue working
    }
  }, [currentSessionId]);

  return { trackMCQAnswer };
};

