/**
 * Tutorial Service - Manages first-time user tutorial states
 * Tracks various tutorial completions using localStorage
 */

export interface TutorialState {
  adventureTutorialCompleted: boolean;
  fillInBlanksTutorialCompleted: boolean;
  mcqTutorialCompleted: boolean;
  chatTutorialCompleted: boolean;
  // New: one-time intro before first pet speech on home page
  petDailyCheckIntroCompleted?: boolean;
  // New: one-time Step 5 intro shown on Adventure screen after pet-page button
  adventureStep5IntroCompleted?: boolean;
  // New: one-time Step 6 congrats overlay after progress bar fills on Adventure
  adventureStep6IntroCompleted?: boolean;
  // Step 7: Home page after first quest - show hand to More and Krafty line
  adventureStep7HomeMoreIntroCompleted?: boolean;
  // Step 8: Next step after closing More
  adventureStep8Started?: boolean;
  // Step 9: Sleep intro started
  adventureStep9SleepIntroStarted?: boolean;
  // Step 9: Sleep intro completed so it doesn't reappear
  adventureStep9SleepIntroCompleted?: boolean;
}

class TutorialService {
  private readonly STORAGE_KEY = 'reading-app-tutorial-state';
  
  /**
   * Get the current tutorial state from localStorage
   */
  getTutorialState(): TutorialState {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          adventureTutorialCompleted: parsed.adventureTutorialCompleted || false,
          fillInBlanksTutorialCompleted: parsed.fillInBlanksTutorialCompleted || false,
          mcqTutorialCompleted: parsed.mcqTutorialCompleted || false,
          chatTutorialCompleted: parsed.chatTutorialCompleted || false,
          petDailyCheckIntroCompleted: parsed.petDailyCheckIntroCompleted || false,
          adventureStep5IntroCompleted: parsed.adventureStep5IntroCompleted || false,
          adventureStep6IntroCompleted: parsed.adventureStep6IntroCompleted || false,
          adventureStep7HomeMoreIntroCompleted: parsed.adventureStep7HomeMoreIntroCompleted || false,
          adventureStep8Started: parsed.adventureStep8Started || false,
          adventureStep9SleepIntroStarted: parsed.adventureStep9SleepIntroStarted || false,
          adventureStep9SleepIntroCompleted: parsed.adventureStep9SleepIntroCompleted || false,
        };
      }
    } catch (error) {
      console.warn('Failed to parse tutorial state from localStorage:', error);
    }
    
    // Return default state for first-time users
    return {
      adventureTutorialCompleted: false,
      fillInBlanksTutorialCompleted: false,
      mcqTutorialCompleted: false,
      chatTutorialCompleted: false,
      petDailyCheckIntroCompleted: false,
        adventureStep5IntroCompleted: false,
        adventureStep6IntroCompleted: false,
        adventureStep7HomeMoreIntroCompleted: false,
        adventureStep8Started: false,
        adventureStep9SleepIntroStarted: false,
        adventureStep9SleepIntroCompleted: false,
    };
  }
  
  /**
   * Update tutorial state in localStorage
   */
  updateTutorialState(updates: Partial<TutorialState>): void {
    try {
      const currentState = this.getTutorialState();
      const newState = { ...currentState, ...updates };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newState));
      console.log('📚 Tutorial state updated:', newState);
    } catch (error) {
      console.error('Failed to update tutorial state:', error);
    }
  }
  
  /**
   * Check if user is experiencing their first adventure ever
   */
  isFirstTimeAdventurer(): boolean {
    const state = this.getTutorialState();
    return !state.adventureTutorialCompleted;
  }
  
  /**
   * Check if user needs fill-in-the-blanks tutorial
   */
  needsFillInBlanksTutorial(): boolean {
    const state = this.getTutorialState();
    return !state.fillInBlanksTutorialCompleted;
  }
  
  /**
   * Check if user needs MCQ tutorial
   */
  needsMCQTutorial(): boolean {
    const state = this.getTutorialState();
    return !state.mcqTutorialCompleted;
  }
  
  /**
   * Check if user needs chat tutorial
   */
  needsChatTutorial(): boolean {
    const state = this.getTutorialState();
    return !state.chatTutorialCompleted;
  }
  
  /**
   * Whether to show the one-time "daily check" intro on the pet home page
   */
  needsPetDailyCheckIntro(): boolean {
    const state = this.getTutorialState();
    return !state.petDailyCheckIntroCompleted;
  }

  /**
   * Whether to show the one-time Step 5 Adventure intro
   */
  needsAdventureStep5Intro(): boolean {
    const state = this.getTutorialState();
    return !state.adventureStep5IntroCompleted;
  }
  
  /**
   * Whether to show the one-time Step 6 Adventure congrats/next-hint
   */
  needsAdventureStep6Intro(): boolean {
    const state = this.getTutorialState();
    return !state.adventureStep6IntroCompleted;
  }
  
  /** Whether to show Step 7 on Home after first quest */
  needsAdventureStep7HomeMoreIntro(): boolean {
    const state = this.getTutorialState();
    return !state.adventureStep7HomeMoreIntroCompleted;
  }
  
  /** Whether Step 8 has started */
  hasAdventureStep8Started(): boolean {
    const state = this.getTutorialState();
    return !!state.adventureStep8Started;
  }
  
  hasAdventureStep9SleepIntroStarted(): boolean {
    const state = this.getTutorialState();
    return !!state.adventureStep9SleepIntroStarted;
  }
  hasAdventureStep9SleepIntroCompleted(): boolean {
    const state = this.getTutorialState();
    return !!state.adventureStep9SleepIntroCompleted;
  }
  
  /**
   * Mark adventure tutorial as completed
   */
  completeAdventureTutorial(): void {
    this.updateTutorialState({ adventureTutorialCompleted: true });
  }
  
  /**
   * Mark fill-in-the-blanks tutorial as completed
   */
  completeFillInBlanksTutorial(): void {
    this.updateTutorialState({ fillInBlanksTutorialCompleted: true });
  }
  
  /**
   * Mark MCQ tutorial as completed
   */
  completeMCQTutorial(): void {
    this.updateTutorialState({ mcqTutorialCompleted: true });
  }
  
  /**
   * Mark chat tutorial as completed
   */
  completeChatTutorial(): void {
    this.updateTutorialState({ chatTutorialCompleted: true });
  }
  
  /**
   * Mark the pet daily check intro as completed so it won't show again
   */
  completePetDailyCheckIntro(): void {
    this.updateTutorialState({ petDailyCheckIntroCompleted: true });
  }
  
  /**
   * Mark the Step 5 Adventure intro as completed
   */
  completeAdventureStep5Intro(): void {
    this.updateTutorialState({ adventureStep5IntroCompleted: true });
  }
  
  /**
   * Mark the Step 6 Adventure intro as completed
   */
  completeAdventureStep6Intro(): void {
    this.updateTutorialState({ adventureStep6IntroCompleted: true });
  }
  /** Mark Step 7 as completed */
  completeAdventureStep7HomeMoreIntro(): void {
    this.updateTutorialState({ adventureStep7HomeMoreIntroCompleted: true });
  }
  /** Start Step 8 */
  startAdventureStep8(): void {
    this.updateTutorialState({ adventureStep8Started: true });
  }
  startAdventureStep9(): void {
    this.updateTutorialState({ adventureStep9SleepIntroStarted: true });
  }
  completeAdventureStep9(): void {
    this.updateTutorialState({ adventureStep9SleepIntroCompleted: true });
  }
  
  /**
   * Reset all tutorials (for testing or user preference)
   */
  resetAllTutorials(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('📚 All tutorials reset');
    } catch (error) {
      console.error('Failed to reset tutorials:', error);
    }
  }
  
  /**
   * Legacy support - check old SpellBox tutorial key
   */
  hasSeenLegacySpellBoxTutorial(): boolean {
    try {
      return localStorage.getItem('spellbox-first-time-instruction-seen') === 'true';
    } catch {
      return false;
    }
  }
  
  /**
   * Migrate legacy tutorial states to new system
   */
  migrateLegacyTutorials(): void {
    const state = this.getTutorialState();
    
    // If new system is already initialized, don't migrate
    if (state.adventureTutorialCompleted || state.fillInBlanksTutorialCompleted) {
      return;
    }
    
    // Check legacy SpellBox tutorial
    if (this.hasSeenLegacySpellBoxTutorial()) {
      this.updateTutorialState({ 
        fillInBlanksTutorialCompleted: true,
        adventureTutorialCompleted: true // If they've seen spellbox, they've done an adventure
      });
      console.log('📚 Migrated legacy SpellBox tutorial state');
    }
  }
}

// Export singleton instance
export const tutorialService = new TutorialService();

// Export for React hooks
export default tutorialService;
