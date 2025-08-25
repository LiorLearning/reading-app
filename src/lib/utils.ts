import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Local storage key for user adventure messages
const USER_ADVENTURE_KEY = "user_adventure";

// Chat message type for local storage
export interface ChatMessage {
  type: 'user' | 'ai';
  content: string;
  timestamp: number;
}

/**
 * Save chat messages to local storage
 */
export const saveUserAdventure = (messages: ChatMessage[]): void => {
  try {
    const serialized = JSON.stringify(messages);
    localStorage.setItem(USER_ADVENTURE_KEY, serialized);
  } catch (error) {
    console.warn('Failed to save user adventure to local storage:', error);
  }
};

/**
 * Load chat messages from local storage
 */
export const loadUserAdventure = (): ChatMessage[] => {
  try {
    const stored = localStorage.getItem(USER_ADVENTURE_KEY);
    if (!stored) {
      return [];
    }
    
    const parsed = JSON.parse(stored);
    
    // Validate the structure
    if (Array.isArray(parsed)) {
      return parsed.filter((msg): msg is ChatMessage => 
        typeof msg === 'object' && 
        msg !== null &&
        typeof msg.type === 'string' &&
        (msg.type === 'user' || msg.type === 'ai') &&
        typeof msg.content === 'string' &&
        typeof msg.timestamp === 'number'
      );
    }
    
    return [];
  } catch (error) {
    console.warn('Failed to load user adventure from local storage:', error);
    return [];
  }
};

/**
 * Clear user adventure from local storage
 */
export const clearUserAdventure = (): void => {
  try {
    localStorage.removeItem(USER_ADVENTURE_KEY);
  } catch (error) {
    console.warn('Failed to clear user adventure from local storage:', error);
  }
};

// Progress tracking interfaces and utilities
export interface TopicProgress {
  topicId: string;
  completed: boolean;
  score?: number;
  completedAt?: number;
}

export interface UserProgress {
  completedTopics: TopicProgress[];
  currentTopicId?: string;
  totalTopicsCompleted: number;
  lastPlayedAt: number;
}

const USER_PROGRESS_KEY = 'readingapp_user_progress';

/**
 * Save user progress to local storage
 */
export const saveUserProgress = (progress: UserProgress): void => {
  try {
    const serialized = JSON.stringify(progress);
    localStorage.setItem(USER_PROGRESS_KEY, serialized);
  } catch (error) {
    console.warn('Failed to save user progress to local storage:', error);
  }
};

/**
 * Load user progress from local storage
 */
export const loadUserProgress = (): UserProgress | null => {
  try {
    const stored = localStorage.getItem(USER_PROGRESS_KEY);
    if (!stored) {
      return null;
    }
    
    const parsed = JSON.parse(stored);
    
    // Validate the structure
    if (
      typeof parsed === 'object' && 
      parsed !== null &&
      Array.isArray(parsed.completedTopics) &&
      typeof parsed.totalTopicsCompleted === 'number' &&
      typeof parsed.lastPlayedAt === 'number'
    ) {
      return parsed as UserProgress;
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to load user progress from local storage:', error);
    return null;
  }
};

/**
 * Update progress when a topic is completed
 */
export const markTopicCompleted = (topicId: string, score: number): void => {
  const currentProgress = loadUserProgress() || {
    completedTopics: [],
    totalTopicsCompleted: 0,
    lastPlayedAt: Date.now()
  };

  // Check if topic was already completed
  const existingIndex = currentProgress.completedTopics.findIndex(t => t.topicId === topicId);
  
  if (existingIndex >= 0) {
    // Update existing completion
    currentProgress.completedTopics[existingIndex] = {
      topicId,
      completed: true,
      score,
      completedAt: Date.now()
    };
  } else {
    // Add new completion
    currentProgress.completedTopics.push({
      topicId,
      completed: true,
      score,
      completedAt: Date.now()
    });
    currentProgress.totalTopicsCompleted++;
  }

  currentProgress.lastPlayedAt = Date.now();
  saveUserProgress(currentProgress);
};

/**
 * Set the current topic the user is working on
 */
export const setCurrentTopic = (topicId: string): void => {
  const currentProgress = loadUserProgress() || {
    completedTopics: [],
    totalTopicsCompleted: 0,
    lastPlayedAt: Date.now()
  };

  currentProgress.currentTopicId = topicId;
  currentProgress.lastPlayedAt = Date.now();
  saveUserProgress(currentProgress);
};

/**
 * Get the next topic the user should work on
 */
export const getNextTopic = (allTopicIds: string[]): string | null => {
  const progress = loadUserProgress();
  
  if (!progress) {
    // First time playing, return first topic
    return allTopicIds[0] || null;
  }

  // If user has a current topic and it's not completed, continue with it
  if (progress.currentTopicId) {
    const isCurrentTopicCompleted = progress.completedTopics.some(
      t => t.topicId === progress.currentTopicId && t.completed
    );
    
    if (!isCurrentTopicCompleted) {
      return progress.currentTopicId;
    }
  }

  // Find first uncompleted topic
  for (const topicId of allTopicIds) {
    const isCompleted = progress.completedTopics.some(
      t => t.topicId === topicId && t.completed
    );
    
    if (!isCompleted) {
      return topicId;
    }
  }

  // All topics completed, return first topic for replay
  return allTopicIds[0] || null;
};

/**
 * Get the next topic in sequence after the current topic
 */
export const getNextTopicInSequence = (allTopicIds: string[], currentTopicId: string): string | null => {
  const currentIndex = allTopicIds.indexOf(currentTopicId);
  if (currentIndex >= 0 && currentIndex < allTopicIds.length - 1) {
    return allTopicIds[currentIndex + 1];
  }
  return null; // No next topic (reached the end)
};

/**
 * Check if user has made progress (completed at least one topic)
 */
export const hasUserProgress = (): boolean => {
  const progress = loadUserProgress();
  return progress ? progress.totalTopicsCompleted > 0 : false;
};
