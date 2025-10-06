import { useState, useEffect, useCallback } from 'react';
import { tutorialService, TutorialState } from '@/lib/tutorial-service';

/**
 * Custom hook for managing tutorial states
 * Provides reactive tutorial state management with localStorage persistence
 */
export const useTutorial = () => {
  const [tutorialState, setTutorialState] = useState<TutorialState>(() => 
    tutorialService.getTutorialState()
  );

  // Refresh tutorial state from localStorage
  const refreshTutorialState = useCallback(() => {
    const newState = tutorialService.getTutorialState();
    setTutorialState(newState);
  }, []);

  // Initialize and migrate legacy tutorials on mount
  useEffect(() => {
    tutorialService.migrateLegacyTutorials();
    refreshTutorialState();
  }, [refreshTutorialState]);

  // Tutorial completion handlers
  const completeAdventureTutorial = useCallback(() => {
    tutorialService.completeAdventureTutorial();
    refreshTutorialState();
  }, [refreshTutorialState]);

  const completeFillInBlanksTutorial = useCallback(() => {
    tutorialService.completeFillInBlanksTutorial();
    refreshTutorialState();
  }, [refreshTutorialState]);

  const completeMCQTutorial = useCallback(() => {
    tutorialService.completeMCQTutorial();
    refreshTutorialState();
  }, [refreshTutorialState]);

  const completeChatTutorial = useCallback(() => {
    tutorialService.completeChatTutorial();
    refreshTutorialState();
  }, [refreshTutorialState]);

  const completePetDailyCheckIntro = useCallback(() => {
    tutorialService.completePetDailyCheckIntro();
    refreshTutorialState();
  }, [refreshTutorialState]);

  const completeAdventureStep5Intro = useCallback(() => {
    tutorialService.completeAdventureStep5Intro();
    refreshTutorialState();
  }, [refreshTutorialState]);

  const completeAdventureStep6Intro = useCallback(() => {
    tutorialService.completeAdventureStep6Intro();
    refreshTutorialState();
  }, [refreshTutorialState]);

  const completeAdventureStep7HomeMoreIntro = useCallback(() => {
    tutorialService.completeAdventureStep7HomeMoreIntro();
    refreshTutorialState();
  }, [refreshTutorialState]);

  const startAdventureStep8 = useCallback(() => {
    tutorialService.startAdventureStep8();
    refreshTutorialState();
  }, [refreshTutorialState]);

  const startAdventureStep9 = useCallback(() => {
    tutorialService.startAdventureStep9();
    refreshTutorialState();
  }, [refreshTutorialState]);
  const completeAdventureStep9 = useCallback(() => {
    tutorialService.completeAdventureStep9();
    refreshTutorialState();
  }, [refreshTutorialState]);

  const resetAllTutorials = useCallback(() => {
    tutorialService.resetAllTutorials();
    refreshTutorialState();
  }, [refreshTutorialState]);

  // Convenience getters
  const isFirstTimeAdventurer = tutorialService.isFirstTimeAdventurer();
  const needsFillInBlanksTutorial = tutorialService.needsFillInBlanksTutorial();
  const needsMCQTutorial = tutorialService.needsMCQTutorial();
  const needsChatTutorial = tutorialService.needsChatTutorial();
  const needsPetDailyCheckIntro = tutorialService.needsPetDailyCheckIntro();
  const needsAdventureStep5Intro = tutorialService.needsAdventureStep5Intro();
  const needsAdventureStep6Intro = tutorialService.needsAdventureStep6Intro();
  const needsAdventureStep7HomeMoreIntro = tutorialService.needsAdventureStep7HomeMoreIntro();
  const hasAdventureStep8Started = tutorialService.hasAdventureStep8Started();
  const hasAdventureStep9SleepIntroStarted = tutorialService.hasAdventureStep9SleepIntroStarted();
  const hasAdventureStep9SleepIntroCompleted = tutorialService.hasAdventureStep9SleepIntroCompleted();

  return {
    // State
    tutorialState,
    
    // Convenience flags
    isFirstTimeAdventurer,
    needsPetDailyCheckIntro,
    needsFillInBlanksTutorial,
    needsMCQTutorial,
    needsChatTutorial,
    
    // Actions
    completeAdventureTutorial,
    completeFillInBlanksTutorial,
    completeMCQTutorial,
    completeChatTutorial,
    completePetDailyCheckIntro,
    completeAdventureStep5Intro,
    completeAdventureStep6Intro,
    completeAdventureStep7HomeMoreIntro,
    startAdventureStep8,
    startAdventureStep9,
    completeAdventureStep9,
    resetAllTutorials,
    refreshTutorialState,
    needsAdventureStep5Intro,
    needsAdventureStep6Intro,
    needsAdventureStep7HomeMoreIntro,
    hasAdventureStep8Started,
    hasAdventureStep9SleepIntroStarted,
    hasAdventureStep9SleepIntroCompleted,
  };
};

/**
 * Hook specifically for fill-in-the-blanks tutorial management
 * Provides enhanced tutorial state for SpellBox components
 */
export const useFillInBlanksTutorial = () => {
  const {
    needsFillInBlanksTutorial,
    completeFillInBlanksTutorial,
    isFirstTimeAdventurer,
  } = useTutorial();

  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<'expand' | 'glow' | 'complete'>('expand');

  // Show tutorial if user needs it and it's their first adventure
  useEffect(() => {
    if (needsFillInBlanksTutorial && isFirstTimeAdventurer) {
      setShowTutorial(true);
      setTutorialStep('expand');
    }
  }, [needsFillInBlanksTutorial, isFirstTimeAdventurer]);

  const startTutorial = useCallback(() => {
    setShowTutorial(true);
    setTutorialStep('expand');
  }, []);

  const nextTutorialStep = useCallback(() => {
    if (tutorialStep === 'expand') {
      setTutorialStep('glow');
      // Complete the tutorial after a brief glow effect
      setTimeout(() => {
        completeFillInBlanksTutorial();
        setShowTutorial(false);
        setTutorialStep('expand'); // Reset for next time
      }, 1500);
    }
  }, [tutorialStep, completeFillInBlanksTutorial]);

  const skipTutorial = useCallback(() => {
    completeFillInBlanksTutorial();
    setShowTutorial(false);
  }, [completeFillInBlanksTutorial]);

  return {
    showTutorial,
    tutorialStep,
    needsFillInBlanksTutorial,
    isFirstTimeAdventurer,
    startTutorial,
    nextTutorialStep,
    skipTutorial,
  };
};

export default useTutorial;
