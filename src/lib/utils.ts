import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Local storage key for user adventure messages
const USER_ADVENTURE_KEY = "user_adventure";
// Local storage key for current adventure ID
const CURRENT_ADVENTURE_ID_KEY = "current_adventure_id";

// Chat message type for local storage
export interface ChatMessage {
  type: 'user' | 'ai';
  content: string;
  timestamp: number;
  spelling_sentence?: string;
  spelling_word?: string;
  content_after_spelling?: string;
}

/**
 * Save the last 20 chat messages to local storage
 */
export const saveUserAdventure = (messages: ChatMessage[]): void => {
  try {
    // Keep only the last 20 messages to manage storage size
    const recentMessages = messages.slice(-20);
    const serialized = JSON.stringify(recentMessages);
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

/**
 * Save current adventure ID to local storage
 */
export const saveCurrentAdventureId = (adventureId: string | null): void => {
  try {
    if (adventureId) {
      localStorage.setItem(CURRENT_ADVENTURE_ID_KEY, adventureId);
    } else {
      localStorage.removeItem(CURRENT_ADVENTURE_ID_KEY);
    }
  } catch (error) {
    console.warn('Failed to save current adventure ID to local storage:', error);
  }
};

/**
 * Load current adventure ID from local storage
 */
export const loadCurrentAdventureId = (): string | null => {
  try {
    return localStorage.getItem(CURRENT_ADVENTURE_ID_KEY);
  } catch (error) {
    console.warn('Failed to load current adventure ID from local storage:', error);
    return null;
  }
};

// Comic panel type for saved adventures
export interface ComicPanel {
  id: string;
  image: string;
  text: string;
}

// Adventure storage types and utilities
export interface SavedAdventure {
  id: string;
  name: string;
  summary: string;
  messages: ChatMessage[];
  createdAt: number;
  lastPlayedAt: number;
  comicPanelImage?: string;
  topicId?: string;
  comicPanels?: ComicPanel[]; // Store the comic panels
}

export interface AdventureSummary {
  id: string;
  name: string;
  summary: string;
  lastPlayedAt: number;
  comicPanelImage?: string;
}

const SAVED_ADVENTURES_KEY = 'readingapp_saved_adventures';
const ADVENTURE_SUMMARIES_KEY = 'readingapp_adventure_summaries';

/**
 * Save an adventure with AI-generated name and summary
 */
export const saveAdventure = (adventure: SavedAdventure): void => {
  try {
    const stored = localStorage.getItem(SAVED_ADVENTURES_KEY);
    const adventures: SavedAdventure[] = stored ? JSON.parse(stored) : [];
    
    // Remove existing adventure with same ID
    const filteredAdventures = adventures.filter(a => a.id !== adventure.id);
    
    // Add the new/updated adventure
    filteredAdventures.push(adventure);
    
    // Keep only last 10 adventures to manage storage
    const recentAdventures = filteredAdventures.slice(-10);
    
    localStorage.setItem(SAVED_ADVENTURES_KEY, JSON.stringify(recentAdventures));
  } catch (error) {
    console.warn('Failed to save adventure to local storage:', error);
  }
};

/**
 * Load all saved adventures
 */
export const loadSavedAdventures = (): SavedAdventure[] => {
  try {
    const stored = localStorage.getItem(SAVED_ADVENTURES_KEY);
    if (!stored) {
      return [];
    }
    
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to load saved adventures from local storage:', error);
    return [];
  }
};

/**
 * Save adventure summaries for quick loading
 */
export const saveAdventureSummaries = (summaries: AdventureSummary[]): void => {
  try {
    localStorage.setItem(ADVENTURE_SUMMARIES_KEY, JSON.stringify(summaries));
  } catch (error) {
    console.warn('Failed to save adventure summaries to local storage:', error);
  }
};

/**
 * Load adventure summaries
 */
export const loadAdventureSummaries = (): AdventureSummary[] => {
  try {
    const stored = localStorage.getItem(ADVENTURE_SUMMARIES_KEY);
    if (!stored) {
      return [];
    }
    
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to load adventure summaries from local storage:', error);
    return [];
  }
};

/**
 * Generate adventure summary from messages using AI
 */
export const generateAdventureSummary = async (messages: ChatMessage[]): Promise<string> => {
  if (messages.length === 0) return "An empty adventure waiting to be filled with excitement!";
  
  // Get user messages to understand the adventure content
  const userMessages = messages
    .filter(msg => msg.type === 'user')
    .map(msg => msg.content)
    .join(' ');
  
  if (!userMessages.trim()) return "A mysterious adventure yet to unfold...";
  
  // Create a simple extractive summary from user messages
  const words = userMessages.split(' ').filter(word => word.length > 3);
  const uniqueWords = [...new Set(words)];
  const keyWords = uniqueWords.slice(0, 10).join(' ');
  
  return `An adventure involving ${keyWords}...`.substring(0, 100);
};

/**
 * Generate adventure name from messages
 */
export const generateAdventureName = async (messages: ChatMessage[]): Promise<string> => {
  if (messages.length === 0) return "Untitled Adventure";
  
  // Get first few user messages for naming
  const firstMessages = messages
    .filter(msg => msg.type === 'user')
    .slice(0, 3)
    .map(msg => msg.content)
    .join(' ');
  
  if (!firstMessages.trim()) return "Mystery Adventure";
  
  // Extract key themes for naming
  const themes = ['space', 'magic', 'dragon', 'superhero', 'ocean', 'forest', 'castle', 'robot', 'ninja', 'pirate'];
  const foundTheme = themes.find(theme => 
    firstMessages.toLowerCase().includes(theme)
  );
  
  if (foundTheme) {
    const adventureTypes = ['Quest', 'Journey', 'Adventure', 'Mission', 'Story'];
    const randomType = adventureTypes[Math.floor(Math.random() * adventureTypes.length)];
    return `${foundTheme.charAt(0).toUpperCase() + foundTheme.slice(1)} ${randomType}`;
  }
  
  // Fallback names
  const fallbackNames = [
    'Epic Adventure', 'Magical Journey', 'Hero Quest', 'Amazing Story',
    'Great Adventure', 'Fantastic Tale', 'Wonder Quest', 'Dream Journey'
  ];
  
  return fallbackNames[Math.floor(Math.random() * fallbackNames.length)];
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
 * Update progress when a topic is attempted (and mark as completed only with passing grade)
 */
export const markTopicCompleted = (topicId: string, score: number): void => {
  const currentProgress = loadUserProgress() || {
    completedTopics: [],
    totalTopicsCompleted: 0,
    lastPlayedAt: Date.now()
  };

  const PASSING_GRADE = 7; // Minimum score to consider topic completed
  const isPassingGrade = score >= PASSING_GRADE;

  // Check if topic was already completed
  const existingIndex = currentProgress.completedTopics.findIndex(t => t.topicId === topicId);
  
  if (existingIndex >= 0) {
    const wasAlreadyCompleted = currentProgress.completedTopics[existingIndex].completed;
    
    // Update existing attempt
    currentProgress.completedTopics[existingIndex] = {
      topicId,
      completed: isPassingGrade, // Only mark as completed if passing grade
      score,
      completedAt: Date.now()
    };
    
    // If this is first time passing (wasn't completed before but is now)
    if (!wasAlreadyCompleted && isPassingGrade) {
      currentProgress.totalTopicsCompleted++;
    }
    // If was completed before but now failing (shouldn't happen in normal flow but just in case)
    else if (wasAlreadyCompleted && !isPassingGrade) {
      currentProgress.totalTopicsCompleted = Math.max(0, currentProgress.totalTopicsCompleted - 1);
    }
  } else {
    // Add new attempt
    currentProgress.completedTopics.push({
      topicId,
      completed: isPassingGrade, // Only mark as completed if passing grade
      score,
      completedAt: Date.now()
    });
    
    // Only increment total if it's a passing grade
    if (isPassingGrade) {
      currentProgress.totalTopicsCompleted++;
    }
  }

  currentProgress.lastPlayedAt = Date.now();
  saveUserProgress(currentProgress);
  
  // Log progress update for debugging
  console.log(`Topic ${topicId} attempted with score ${score}/10. ${isPassingGrade ? 'PASSED' : 'NEEDS PRACTICE'} - Total completed: ${currentProgress.totalTopicsCompleted}`);
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

  // If user has a current topic and it's not completed with passing grade, continue with it
  if (progress.currentTopicId) {
    const currentTopicProgress = progress.completedTopics.find(
      t => t.topicId === progress.currentTopicId
    );
    
    // Continue with current topic if it's not completed with passing grade
    if (!currentTopicProgress || !currentTopicProgress.completed) {
      return progress.currentTopicId;
    }
  }

  // Find first uncompleted topic (not completed with passing grade)
  for (const topicId of allTopicIds) {
    const topicProgress = progress.completedTopics.find(
      t => t.topicId === topicId
    );
    
    // Topic is available if:
    // 1. Never attempted (not in completedTopics)
    // 2. Attempted but not completed with passing grade
    if (!topicProgress || !topicProgress.completed) {
      return topicId;
    }
  }

  // All topics completed with passing grades, return first topic for replay
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
 * Check if user has made progress (completed at least one topic with passing grade)
 */
export const hasUserProgress = (): boolean => {
  const progress = loadUserProgress();
  return progress ? progress.totalTopicsCompleted > 0 : false;
};

/**
 * Get topic progress including score and completion status
 */
export const getTopicProgress = (topicId: string): TopicProgress | null => {
  const progress = loadUserProgress();
  if (!progress) return null;
  
  return progress.completedTopics.find(t => t.topicId === topicId) || null;
};

/**
 * Check if a topic is completed with passing grade
 */
export const isTopicCompleted = (topicId: string): boolean => {
  const topicProgress = getTopicProgress(topicId);
  return topicProgress ? topicProgress.completed : false;
};

/**
 * Get user's score for a specific topic
 */
export const getTopicScore = (topicId: string): number | null => {
  const topicProgress = getTopicProgress(topicId);
  return topicProgress ? (topicProgress.score || null) : null;
};

// Topic preference storage for grade level selection
const TOPIC_PREFERENCE_KEY = 'readingapp_topic_preference';

export interface TopicPreference {
  level: 'start' | 'middle';
  lastSelected: number;
}

/**
 * Save user's topic level preference and determine the specific topic
 */
export const saveTopicPreference = (level: 'start' | 'middle', allTopicIds: string[]): string | null => {
  try {
    const preference: TopicPreference = {
      level,
      lastSelected: Date.now()
    };
    localStorage.setItem(TOPIC_PREFERENCE_KEY, JSON.stringify(preference));
    
    // Immediately determine the specific topic and save it as current topic
    const specificTopic = getNextTopicByPreference(allTopicIds, level);
    if (specificTopic) {
      setCurrentTopic(specificTopic);
      return specificTopic;
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to save topic preference to local storage:', error);
    return null;
  }
};

/**
 * Load user's topic level preference
 */
export const loadTopicPreference = (): TopicPreference | null => {
  try {
    const stored = localStorage.getItem(TOPIC_PREFERENCE_KEY);
    if (!stored) {
      return null;
    }
    
    const parsed = JSON.parse(stored);
    
    if (
      typeof parsed === 'object' && 
      parsed !== null &&
      (parsed.level === 'start' || parsed.level === 'middle') &&
      typeof parsed.lastSelected === 'number'
    ) {
      return parsed as TopicPreference;
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to load topic preference from local storage:', error);
    return null;
  }
};

/**
 * Get the next available topic based on user's preference level and completed topics
 * Uses the actual ordering from mcq-questions.tsx data file
 */
export const getNextTopicByPreference = (allTopicIds: string[], level: 'start' | 'middle'): string | null => {
  const progress = loadUserProgress();
  
  // Topics are already ordered in the data file, use that exact order
  // Start level begins with K-F.2, middle level begins with 1-Q.4
  let startIndex = 0;
  
  if (level === 'middle') {
    // Find 1-Q.4 topic index to start from middle level
    startIndex = allTopicIds.findIndex(id => id === '1-Q.4');
    if (startIndex === -1) {
      // Fallback if 1-Q.4 not found - find first 1- topic
      startIndex = allTopicIds.findIndex(id => id.startsWith('1-'));
      if (startIndex === -1) startIndex = 0;
    }
  }
  
  if (!progress) {
    // First time playing, return first topic from preferred starting point
    return allTopicIds[startIndex] || null;
  }
  
  // Find first uncompleted topic starting from the preferred level
  for (let i = startIndex; i < allTopicIds.length; i++) {
    const topicId = allTopicIds[i];
    const topicProgress = progress.completedTopics.find(
      t => t.topicId === topicId
    );
    
    // Topic is available if:
    // 1. Never attempted (not in completedTopics)
    // 2. Attempted but not completed with passing grade
    if (!topicProgress || !topicProgress.completed) {
      return topicId;
    }
  }
  
  // All topics from preferred starting point completed, check from beginning
  if (startIndex > 0) {
    for (let i = 0; i < startIndex; i++) {
      const topicId = allTopicIds[i];
      const topicProgress = progress.completedTopics.find(
        t => t.topicId === topicId
      );
      
      if (!topicProgress || !topicProgress.completed) {
        return topicId;
      }
    }
  }
  
  // All topics completed, return first topic for replay
  return allTopicIds[0] || null;
};

// Local storage key for cached adventure images
const CACHED_ADVENTURE_IMAGES_KEY = 'readingapp_cached_adventure_images';

// Interface for cached adventure images
export interface CachedAdventureImage {
  id: string;
  url: string;
  prompt: string;
  adventureContext: string;
  timestamp: number;
  adventureId?: string;
}

/**
 * Save a generated adventure image to local cache
 */
export const cacheAdventureImage = (
  url: string, 
  prompt: string, 
  adventureContext: string = '',
  adventureId?: string
): void => {
  try {
    // Don't cache if URL is null, empty, or a local asset
    if (!url || url.startsWith('/') || url.startsWith('data:')) {
      return;
    }

    const cached = loadCachedAdventureImages();
    
    // Create new cached image entry
    const newImage: CachedAdventureImage = {
      id: crypto.randomUUID(),
      url,
      prompt,
      adventureContext,
      timestamp: Date.now(),
      adventureId
    };

    // Remove any existing image with the same URL to avoid duplicates
    const filteredImages = cached.filter(img => img.url !== url);
    
    // Add new image and keep only the last 10 adventure images (sorted by timestamp)
    const updatedImages = [...filteredImages, newImage]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    localStorage.setItem(CACHED_ADVENTURE_IMAGES_KEY, JSON.stringify(updatedImages));
    
    console.log(`🖼️ Cached adventure image: ${prompt.substring(0, 50)}...`);
  } catch (error) {
    console.warn('Failed to cache adventure image:', error);
  }
};

/**
 * Load all cached adventure images (most recent first)
 */
export const loadCachedAdventureImages = (): CachedAdventureImage[] => {
  try {
    const stored = localStorage.getItem(CACHED_ADVENTURE_IMAGES_KEY);
    if (!stored) {
      return [];
    }
    
    const parsed = JSON.parse(stored);
    
    // Validate the structure
    if (Array.isArray(parsed)) {
      return parsed
        .filter((img): img is CachedAdventureImage => 
          typeof img === 'object' && 
          img !== null &&
          typeof img.id === 'string' &&
          typeof img.url === 'string' &&
          typeof img.prompt === 'string' &&
          typeof img.adventureContext === 'string' &&
          typeof img.timestamp === 'number'
        )
        .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
    }
    
    return [];
  } catch (error) {
    console.warn('Failed to load cached adventure images from local storage:', error);
    return [];
  }
};

/**
 * Get cached adventure images for a specific adventure
 */
export const getCachedImagesForAdventure = (adventureId: string): CachedAdventureImage[] => {
  const allCached = loadCachedAdventureImages();
  return allCached.filter(img => img.adventureId === adventureId);
};

/**
 * Get recent cached adventure images (last 5 by default)
 */
export const getRecentCachedAdventureImages = (limit: number = 5): CachedAdventureImage[] => {
  const allCached = loadCachedAdventureImages();
  return allCached.slice(0, limit);
};

/**
 * Clear all cached adventure images
 */
export const clearCachedAdventureImages = (): void => {
  try {
    localStorage.removeItem(CACHED_ADVENTURE_IMAGES_KEY);
    console.log('🗑️ Cleared all cached adventure images');
  } catch (error) {
    console.warn('Failed to clear cached adventure images:', error);
  }
};

/**
 * Get adventure image cache statistics
 */
export const getAdventureImageCacheStats = (): { totalImages: number, totalSize: string, oldestImage: number, newestImage: number } => {
  const cached = loadCachedAdventureImages();
  const totalSize = localStorage.getItem(CACHED_ADVENTURE_IMAGES_KEY)?.length || 0;
  
  return {
    totalImages: cached.length,
    totalSize: `${(totalSize / 1024).toFixed(2)} KB`,
    oldestImage: cached.length > 0 ? Math.min(...cached.map(img => img.timestamp)) : 0,
    newestImage: cached.length > 0 ? Math.max(...cached.map(img => img.timestamp)) : 0
  };
};

// Question Progress persistence - add after cached adventure images section
const QUESTION_PROGRESS_KEY = 'readingapp_question_progress';

export interface QuestionProgress {
  topicId: string;
  questionIndex: number;
  timestamp: number;
}

/**
 * Save current question progress for a topic
 */
export const saveQuestionProgress = (topicId: string, questionIndex: number): void => {
  try {
    const progress: QuestionProgress = {
      topicId,
      questionIndex,
      timestamp: Date.now()
    };
    localStorage.setItem(QUESTION_PROGRESS_KEY, JSON.stringify(progress));
    console.log(`💾 Saved question progress: Topic ${topicId}, Question ${questionIndex + 1}`);
  } catch (error) {
    console.warn('Failed to save question progress to localStorage:', error);
  }
};

/**
 * Load question progress for current session
 */
export const loadQuestionProgress = (): QuestionProgress | null => {
  try {
    const stored = localStorage.getItem(QUESTION_PROGRESS_KEY);
    if (!stored) {
      return null;
    }
    
    const progress = JSON.parse(stored) as QuestionProgress;
    
    // Only return progress if it's less than 24 hours old to avoid stale progress
    const oneDay = 24 * 60 * 60 * 1000;
    if (Date.now() - progress.timestamp < oneDay) {
      return progress;
    }
    
    // Clear stale progress
    clearQuestionProgress();
    return null;
  } catch (error) {
    console.warn('Failed to load question progress from localStorage:', error);
    return null;
  }
};

/**
 * Clear question progress (called when topic is completed or abandoned)
 */
export const clearQuestionProgress = (): void => {
  try {
    localStorage.removeItem(QUESTION_PROGRESS_KEY);
    console.log('🗑️ Cleared question progress');
  } catch (error) {
    console.warn('Failed to clear question progress from localStorage:', error);
  }
};

/**
 * Get starting question index for a topic, considering saved progress
 */
export const getStartingQuestionIndex = (topicId: string): number => {
  const progress = loadQuestionProgress();
  
  // If there's saved progress for the same topic, resume from there
  if (progress && progress.topicId === topicId) {
    console.log(`🔄 Resuming topic ${topicId} from question ${progress.questionIndex + 1}`);
    return progress.questionIndex;
  }
  
  // Otherwise start from the beginning
  return 0;
};

/**
 * Format AI messages by converting markdown-style formatting to HTML
 * Returns HTML that can be safely rendered using dangerouslySetInnerHTML
 */
export const formatAIMessage = (content: string, spellingWord?: string): string => {
  // First, escape any HTML characters to prevent XSS
  const escapeHtml = (text: string) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };
  
  // Escape HTML first
  let formatted = escapeHtml(content);
  
  // Convert literal \n characters to <br> tags
  formatted = formatted.replace(/\\n/g, '<br>');
  
  // Apply formatting in order of complexity (most specific first)
  
  // Convert ___text___ to <strong><em>text</em></strong> (bold italic)
  formatted = formatted.replace(/___([^_]+?)___/g, '<strong><em>$1</em></strong>');
  
  // Convert __text__ to <strong>text</strong> (alternative bold syntax)
  formatted = formatted.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
  
  // Convert **text** to <strong>text</strong> (bold)
  formatted = formatted.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  
  // Convert remaining _text_ to <em>text</em> (italic/emphasis)
  formatted = formatted.replace(/_([^_]+?)_/g, '<em>$1</em>');
  
  // Convert remaining *text* to <em>text</em> (italic)
  formatted = formatted.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
  
  // Clean up any weird spacing patterns like "_ _" 
  formatted = formatted.replace(/<\/em>\s+<em>/g, ' ');

  if (spellingWord) {
    formatted = formatted.replace(spellingWord, '');
  }
  
  return formatted;
};
