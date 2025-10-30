// Pet Adventure Tracker - manages ongoing adventures per pet and activity type
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface PetAdventureState {
  petId: string;
  userId: string;
  // Map of adventure type to adventure ID and metadata
  adventures: {
    [adventureType: string]: {
      adventureId: string;
      topicId: string;
      createdAt: number;
      lastPlayedAt: number;
      messageCount: number; // Track how many messages in this adventure
      isCompleted?: boolean; // Mark if adventure is considered "finished"
    }
  };
  updatedAt: number;
}

export class PetAdventureTracker {
  private static readonly COLLECTION_NAME = 'petAdventureStates';
  
  // Get the document reference for a pet's adventure state
  private static getDocRef(userId: string, petId: string) {
    return doc(db, this.COLLECTION_NAME, `${userId}_${petId}`);
  }

  // Get local storage key for pet adventure state
  private static getLocalStorageKey(userId: string, petId: string): string {
    return `litkraft_pet_adventures_${userId}_${petId}`;
  }

  // Load pet adventure state from Firebase with localStorage fallback
  static async loadPetAdventureState(userId: string, petId: string): Promise<PetAdventureState> {
    try {
      // Try Firebase first
      const docRef = this.getDocRef(userId, petId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          petId,
          userId,
          adventures: data.adventures || {},
          updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || Date.now()
        };
      }
    } catch (error) {
      console.warn('Failed to load pet adventure state from Firebase, using localStorage:', error);
    }

    // Fallback to localStorage
    try {
      const localKey = this.getLocalStorageKey(userId, petId);
      const stored = localStorage.getItem(localKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          petId,
          userId,
          adventures: parsed.adventures || {},
          updatedAt: parsed.updatedAt || Date.now()
        };
      }
    } catch (error) {
      console.warn('Failed to load pet adventure state from localStorage:', error);
    }

    // Return default state
    return {
      petId,
      userId,
      adventures: {},
      updatedAt: Date.now()
    };
  }

  // Save pet adventure state to both Firebase and localStorage
  static async savePetAdventureState(state: PetAdventureState): Promise<void> {
    const updatedState = {
      ...state,
      updatedAt: Date.now()
    };

    // Save to localStorage immediately (synchronous)
    try {
      const localKey = this.getLocalStorageKey(state.userId, state.petId);
      localStorage.setItem(localKey, JSON.stringify(updatedState));
    } catch (error) {
      console.warn('Failed to save pet adventure state to localStorage:', error);
    }

    // Save to Firebase (async, non-blocking)
    try {
      const docRef = this.getDocRef(state.userId, state.petId);
      await setDoc(docRef, {
        adventures: updatedState.adventures,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.warn('Failed to save pet adventure state to Firebase:', error);
    }
  }

  // Check if an adventure exists for a specific pet and adventure type
  static async hasExistingAdventure(userId: string, petId: string, adventureType: string): Promise<{
    exists: boolean;
    adventureId?: string;
    topicId?: string;
    messageCount?: number;
    chatHistory?: any[]; // Chat messages from the adventure
    adventureName?: string; // Name/summary for context
    comicPanels?: any[]; // Comic panels with images
    cachedImages?: any[]; // Cached images for this adventure
  }> {
    const state = await this.loadPetAdventureState(userId, petId);
    const adventure = state.adventures[adventureType];
    
    // Treat any existing mapped adventure as resumable (no completion concept, perpetual session)
    if (adventure && !adventure.isCompleted) {
      // Try to load the chat history and comic panels from saved adventures
      let chatHistory: any[] = [];
      let adventureName = '';
      let comicPanels: any[] = [];
      let cachedImages: any[] = [];
      
      try {
        // Import the adventure loading functions
        const { loadAdventuresHybrid } = await import('./firebase-adventure-cache');
        const savedAdventures = await loadAdventuresHybrid(userId);
        const savedAdventure = savedAdventures.find(adv => adv.id === adventure.adventureId);
        
        if (savedAdventure) {
          chatHistory = savedAdventure.messages || [];
          adventureName = savedAdventure.name || `${adventureType} adventure`;
          comicPanels = savedAdventure.comicPanels || [];
          console.log(`🔄 Found saved adventure with ${chatHistory.length} messages and ${comicPanels.length} panels:`, adventureName);
          console.log(`🔄 Adventure details:`, {
            id: savedAdventure.id,
            adventureType: (savedAdventure as any).adventureType,
            totalPanels: comicPanels.length,
            comicPanels: comicPanels.map((p, index) => ({ 
              index,
              id: p.id, 
              image: p.image?.substring(0, 50) + '...',
              text: p.text?.substring(0, 30) + '...',
              isFirebase: p.image?.includes('firebasestorage.googleapis.com'),
              isDalle: p.image?.includes('oaidalleapiprodscus.blob.core.windows.net')
            }))
          });
        } else {
          console.warn(`🚨 No saved adventure found for ID: ${adventure.adventureId}`);
          console.log(`🚨 Available adventures:`, savedAdventures.map(adv => ({ 
            id: adv.id, 
            name: adv.name,
            adventureType: (adv as any).adventureType 
          })));

          // Fallback: choose most recent saved adventure, preferring same adventureType
          try {
            const sorted = [...savedAdventures].sort((a: any, b: any) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));
            const sameType = sorted.filter((adv: any) => (adv as any).adventureType === adventureType);
            const fallbackAdv: any | undefined = (sameType.length > 0 ? sameType[0] : sorted[0]);

            if (fallbackAdv) {
              console.log(`🔁 Fallback to latest ${(fallbackAdv as any).adventureType || 'unknown'} adventure:`, fallbackAdv.id);
              chatHistory = fallbackAdv.messages || [];
              adventureName = fallbackAdv.name || `${adventureType} adventure`;
              comicPanels = fallbackAdv.comicPanels || [];

              // Update tracker mapping to self-heal
              try {
                const stateForUpdate = await this.loadPetAdventureState(userId, petId);
                stateForUpdate.adventures[adventureType] = {
                  adventureId: fallbackAdv.id,
                  topicId: fallbackAdv.topicId || stateForUpdate.adventures[adventureType]?.topicId || 'K-F.2',
                  createdAt: fallbackAdv.createdAt || Date.now(),
                  lastPlayedAt: fallbackAdv.lastPlayedAt || Date.now(),
                  messageCount: Array.isArray(fallbackAdv.messages) ? fallbackAdv.messages.length : 0,
                  isCompleted: false
                } as any;
                await this.savePetAdventureState(stateForUpdate);
                // Use fallback adventure for return values
                return {
                  exists: true,
                  adventureId: fallbackAdv.id,
                  topicId: stateForUpdate.adventures[adventureType].topicId,
                  messageCount: stateForUpdate.adventures[adventureType].messageCount,
                  chatHistory,
                  adventureName,
                  comicPanels,
                  cachedImages: [] // will be loaded below if possible
                };
              } catch (healError) {
                console.warn('Failed to update tracker during fallback:', healError);
              }
            }
          } catch (fallbackError) {
            console.warn('Fallback selection failed:', fallbackError);
          }
        }
        
        // Load cached images for this adventure
        try {
          const { getCachedImagesForAdventureFirebase } = await import('./firebase-image-cache');
          cachedImages = await getCachedImagesForAdventureFirebase(userId, adventure.adventureId);
          console.log(`🖼️ Found ${cachedImages.length} cached images for adventure:`, adventure.adventureId);
        } catch (imageError) {
          console.warn('Could not load cached images for existing adventure:', imageError);
        }
        
      } catch (error) {
        console.warn('Could not load adventure data for existing adventure:', error);
      }
      
      return {
        exists: true,
        adventureId: adventure.adventureId,
        topicId: adventure.topicId,
        messageCount: adventure.messageCount || 0,
        chatHistory,
        adventureName,
        comicPanels,
        cachedImages
      };
    }
    
    return { exists: false };
  }

  // Start a new adventure for a pet and adventure type
  static async startNewAdventure(
    userId: string, 
    petId: string, 
    adventureType: string, 
    adventureId: string, 
    topicId: string
  ): Promise<void> {
    const state = await this.loadPetAdventureState(userId, petId);
    
    // Add or update the adventure
    state.adventures[adventureType] = {
      adventureId,
      topicId,
      createdAt: Date.now(),
      lastPlayedAt: Date.now(),
      messageCount: 0,
      isCompleted: false
    };
    
    await this.savePetAdventureState(state);
    console.log(`🚀 Started new ${adventureType} adventure for pet ${petId}: ${adventureId}`);
    console.log(`🚀 Adventure state:`, {
      petId,
      adventureType,
      adventureId,
      topicId,
      totalAdventures: Object.keys(state.adventures).length
    });
  }

  // Update adventure activity (when messages are sent)
  static async updateAdventureActivity(
    userId: string, 
    petId: string, 
    adventureType: string, 
    messageCount?: number
  ): Promise<void> {
    const state = await this.loadPetAdventureState(userId, petId);
    const adventure = state.adventures[adventureType];
    
    if (adventure) {
      adventure.lastPlayedAt = Date.now();
      if (messageCount !== undefined) {
        adventure.messageCount = messageCount;
      }
      
      await this.savePetAdventureState(state);
    }
  }

  // Mark an adventure as completed
  static async completeAdventure(
    userId: string, 
    petId: string, 
    adventureType: string
  ): Promise<void> {
    const state = await this.loadPetAdventureState(userId, petId);
    const adventure = state.adventures[adventureType];
    
    if (adventure) {
      adventure.isCompleted = true;
      adventure.lastPlayedAt = Date.now();
      
      await this.savePetAdventureState(state);
      console.log(`✅ Completed ${adventureType} adventure for pet ${petId}: ${adventure.adventureId}`);
    }
  }

  // Get all active adventures for a pet
  static async getActiveAdventures(userId: string, petId: string): Promise<{
    [adventureType: string]: {
      adventureId: string;
      topicId: string;
      createdAt: number;
      lastPlayedAt: number;
      messageCount: number;
    }
  }> {
    const state = await this.loadPetAdventureState(userId, petId);
    const activeAdventures: any = {};
    
    Object.entries(state.adventures).forEach(([type, adventure]) => {
      if (!adventure.isCompleted) {
        activeAdventures[type] = adventure;
      }
    });
    
    return activeAdventures;
  }

  // Clear old completed adventures (cleanup)
  static async clearOldAdventures(userId: string, petId: string, olderThanDays: number = 7): Promise<void> {
    const state = await this.loadPetAdventureState(userId, petId);
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    
    let hasChanges = false;
    Object.entries(state.adventures).forEach(([type, adventure]) => {
      if (adventure.isCompleted && adventure.lastPlayedAt < cutoffTime) {
        delete state.adventures[type];
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      await this.savePetAdventureState(state);
      console.log(`🧹 Cleaned up old adventures for pet ${petId}`);
    }
  }
}
