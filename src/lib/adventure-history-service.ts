import { firebaseUnifiedPetService } from './firebase-unified-pet-service';
import { adventureSessionService } from './adventure-session-service';
import { chatSummaryService } from './chat-summary-service';
import { loadAdventuresHybrid } from './firebase-adventure-cache';
import { auth } from './firebase';

// Interface for adventure history per pet per adventure type
export interface AdventureHistoryEntry {
  hasHistory: boolean;
  lastAdventureId?: string;
  lastSessionId?: string;
  summary?: string;
  lastPlayedAt?: number;
  totalAdventures?: number;
}

export interface PetAdventureHistory {
  [petId: string]: {
    [adventureType: string]: AdventureHistoryEntry;
  };
}

class AdventureHistoryService {
  private static instance: AdventureHistoryService;
  private readonly STORAGE_KEY = 'litkraft_adventure_history';

  private constructor() {}

  static getInstance(): AdventureHistoryService {
    if (!AdventureHistoryService.instance) {
      AdventureHistoryService.instance = new AdventureHistoryService();
    }
    return AdventureHistoryService.instance;
  }

  // ===== MAIN METHODS =====

  /**
   * Check if a pet has previous adventure history for a specific adventure type
   */
  async hasAdventureHistory(petId: string, adventureType: string): Promise<boolean> {
    try {
      const history = await this.getAdventureHistory();
      return history[petId]?.[adventureType]?.hasHistory || false;
    } catch (error) {
      console.error('Error checking adventure history:', error);
      return false;
    }
  }

  /**
   * Get adventure history entry for a pet and adventure type
   */
  async getAdventureHistoryEntry(petId: string, adventureType: string): Promise<AdventureHistoryEntry | null> {
    try {
      const history = await this.getAdventureHistory();
      return history[petId]?.[adventureType] || null;
    } catch (error) {
      console.error('Error getting adventure history entry:', error);
      return null;
    }
  }

  /**
   * Record that an adventure has been completed for a pet and adventure type
   */
  async recordAdventureHistory(
    petId: string, 
    adventureType: string, 
    adventureId: string, 
    sessionId?: string,
    summary?: string
  ): Promise<void> {
    try {
      const history = await this.getAdventureHistory();
      
      // Initialize pet history if it doesn't exist
      if (!history[petId]) {
        history[petId] = {};
      }

      // Get existing entry or create new one
      const existingEntry = history[petId][adventureType] || {
        hasHistory: false,
        totalAdventures: 0
      };

      // Update entry
      history[petId][adventureType] = {
        hasHistory: true,
        lastAdventureId: adventureId,
        lastSessionId: sessionId,
        summary: summary || existingEntry.summary,
        lastPlayedAt: Date.now(),
        totalAdventures: (existingEntry.totalAdventures || 0) + 1
      };

      await this.saveAdventureHistory(history);
      console.log(`✅ Recorded adventure history for ${petId} - ${adventureType}`);
    } catch (error) {
      console.error('Error recording adventure history:', error);
    }
  }

  /**
   * Get the last adventure context for continuing an adventure
   */
  async getLastAdventureContext(petId: string, adventureType: string): Promise<{
    adventureId?: string;
    sessionId?: string;
    summary?: string;
    messages?: any[];
    comicPanels?: any[];
    comicPanelImage?: string;
    fullAdventure?: any;
  } | null> {
    try {
      const historyEntry = await this.getAdventureHistoryEntry(petId, adventureType);
      if (!historyEntry?.hasHistory) {
        return null;
      }

      const context: any = {
        adventureId: historyEntry.lastAdventureId,
        sessionId: historyEntry.lastSessionId,
        summary: historyEntry.summary
      };

      // Try to load the full saved adventure with comic panels
      if (historyEntry.lastAdventureId) {
        try {
          const userId = auth.currentUser?.uid;
          if (userId) {
            const savedAdventures = await loadAdventuresHybrid(userId);
            const fullAdventure = savedAdventures.find(adventure => adventure.id === historyEntry.lastAdventureId);
            
            if (fullAdventure) {
              context.fullAdventure = fullAdventure;
              context.comicPanels = fullAdventure.comicPanels;
              context.comicPanelImage = fullAdventure.comicPanelImage;
              context.messages = fullAdventure.messages;
              
              // Use adventure summary if we don't have a stored summary
              if (!context.summary) {
                context.summary = fullAdventure.summary;
              }
              
              console.log(`🖼️ Loaded ${fullAdventure.comicPanels?.length || 0} comic panels for ${petId} ${adventureType} adventure`);
            }
          }
        } catch (error) {
          console.warn('Could not load full adventure with images, continuing with summary only:', error);
        }
      }

      // Try to load messages from the last session if we don't have them from full adventure
      if (!context.messages && historyEntry.lastSessionId) {
        try {
          const sessionData = await adventureSessionService.getAdventureSession(historyEntry.lastSessionId);
          if (sessionData?.chatMessages) {
            context.messages = sessionData.chatMessages;
            
            // Generate fresh summary from messages if we don't have one
            if (!context.summary && context.messages.length > 0) {
              context.summary = await chatSummaryService.generateChatSummary(
                context.messages,
                undefined,
                { adventureType, petId }
              );
            }
          }
        } catch (error) {
          console.warn('Could not load session data, using stored summary:', error);
        }
      }

      return context;
    } catch (error) {
      console.error('Error getting last adventure context:', error);
      return null;
    }
  }

  /**
   * Clear adventure history for a specific pet and adventure type
   */
  async clearAdventureHistory(petId: string, adventureType: string): Promise<void> {
    try {
      const history = await this.getAdventureHistory();
      
      if (history[petId]?.[adventureType]) {
        delete history[petId][adventureType];
        await this.saveAdventureHistory(history);
        console.log(`✅ Cleared adventure history for ${petId} - ${adventureType}`);
      }
    } catch (error) {
      console.error('Error clearing adventure history:', error);
    }
  }

  // ===== STORAGE METHODS =====

  /**
   * Get all adventure history from storage
   */
  private async getAdventureHistory(): Promise<PetAdventureHistory> {
    try {
      // Try to load from Firebase first (if user is authenticated)
      const firebaseData = await firebaseUnifiedPetService.getPetData();
      if (firebaseData && (firebaseData as any).adventureHistory) {
        return (firebaseData as any).adventureHistory;
      }

      // Fallback to localStorage
      const localData = localStorage.getItem(this.STORAGE_KEY);
      if (localData) {
        return JSON.parse(localData);
      }

      return {};
    } catch (error) {
      console.error('Error loading adventure history:', error);
      return {};
    }
  }

  /**
   * Save adventure history to storage
   */
  private async saveAdventureHistory(history: PetAdventureHistory): Promise<void> {
    try {
      // Save to Firebase if user is authenticated
      try {
        await firebaseUnifiedPetService.setPetData({
          adventureHistory: history
        } as any);
      } catch (firebaseError) {
        console.warn('Could not save to Firebase, using localStorage:', firebaseError);
      }

      // Always save to localStorage as backup
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Error saving adventure history:', error);
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Get adventure statistics for a pet
   */
  async getAdventureStats(petId: string): Promise<{
    totalAdventures: number;
    adventureTypes: string[];
    lastActivity: number;
  }> {
    try {
      const history = await this.getAdventureHistory();
      const petHistory = history[petId] || {};
      
      let totalAdventures = 0;
      let lastActivity = 0;
      const adventureTypes: string[] = [];

      for (const [adventureType, entry] of Object.entries(petHistory)) {
        if (entry.hasHistory) {
          totalAdventures += entry.totalAdventures || 0;
          adventureTypes.push(adventureType);
          if (entry.lastPlayedAt && entry.lastPlayedAt > lastActivity) {
            lastActivity = entry.lastPlayedAt;
          }
        }
      }

      return {
        totalAdventures,
        adventureTypes,
        lastActivity
      };
    } catch (error) {
      console.error('Error getting adventure stats:', error);
      return {
        totalAdventures: 0,
        adventureTypes: [],
        lastActivity: 0
      };
    }
  }

  /**
   * Debug method to log all adventure history
   */
  async debugLogHistory(): Promise<void> {
    try {
      const history = await this.getAdventureHistory();
      console.log('🏷️ Adventure History:', history);
      
      for (const [petId, petHistory] of Object.entries(history)) {
        console.log(`📱 Pet ${petId}:`);
        for (const [adventureType, entry] of Object.entries(petHistory)) {
          console.log(`  🎮 ${adventureType}:`, entry);
        }
      }
    } catch (error) {
      console.error('Error logging adventure history:', error);
    }
  }
}

// Export singleton instance
export const adventureHistoryService = AdventureHistoryService.getInstance();
