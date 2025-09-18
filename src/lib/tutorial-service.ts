/**
 * Tutorial Service - Manages first-time user tutorial states
 * Tracks various tutorial completions using localStorage
 */

export interface TutorialState {
  adventureTutorialCompleted: boolean;
  fillInBlanksTutorialCompleted: boolean;
  mcqTutorialCompleted: boolean;
  chatTutorialCompleted: boolean;
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
