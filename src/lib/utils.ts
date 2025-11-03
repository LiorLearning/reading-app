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
  hiddenInChat?: boolean;
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

// Utility to remove undefined values from objects (Firebase doesn't support undefined)
export function sanitizeForFirebase<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Preserve Firebase special objects (serverTimestamp, Timestamp, etc.)
  if (typeof obj === 'object' && obj !== null) {
    // Check if this is a Firebase serverTimestamp or Timestamp object
    if (
      (obj as any).constructor?.name === 'FirestoreDataConverter' ||
      (obj as any).isEqual ||  // Timestamp objects have isEqual method
      (obj as any).toMillis || // Timestamp objects have toMillis method  
      (obj as any)._methodName === 'FieldValue.serverTimestamp' || // serverTimestamp check
      typeof (obj as any).toString === 'function' && (obj as any).toString().includes('ServerTimestamp')
    ) {
      return obj; // Return Firebase objects as-is
    }
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirebase(item)) as T;
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    Object.entries(obj).forEach(([key, value]) => {
      if (value !== undefined) {
        sanitized[key] = sanitizeForFirebase(value);
      }
    });
    return sanitized;
  }

  return obj;
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
    if (!Array.isArray(parsed)) {
      return [];
    }
    
    // Sort by lastPlayedAt in descending order (newest first) to match Firebase behavior
    return parsed.sort((a, b) => {
      const aLastPlayed = a.lastPlayedAt || 0;
      const bLastPlayed = b.lastPlayedAt || 0;
      return bLastPlayed - aLastPlayed;
    });
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
    if (!Array.isArray(parsed)) {
      return [];
    }
    
    // Sort by lastPlayedAt in descending order (newest first) to match Firebase behavior
    return parsed.sort((a, b) => {
      const aLastPlayed = a.lastPlayedAt || 0;
      const bLastPlayed = b.lastPlayedAt || 0;
      return bLastPlayed - aLastPlayed;
    });
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
  try {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({
      dangerouslyAllowBrowser: true,
        apiKey: null,
      baseURL: 'https://api.readkraft.com/api/v1'
    });

    // Get a sample of the conversation for AI analysis
    const conversationSample = messages
      .slice(-10) // Last 10 messages to understand current state
      .map(msg => `${msg.type === 'user' ? 'Child' : 'Assistant'}: ${msg.content}`)
      .join('\n');

    const systemPrompt = `You are creating a brief, engaging description for a child's adventure story. 

Based on the conversation below, create a short description (30-50 words) that captures:
- The main characters or hero
- The setting or world
- The central conflict or adventure theme
- The child-friendly, exciting tone

Rules:
- Keep it under 50 words
- Use simple, exciting language for ages 6-11
- Focus on the adventure elements, not the conversation
- Make it sound like a book description that would excite a child

Conversation:
${conversationSample}

Generate a short, exciting adventure description:`;

    const response = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt }
      ],
      max_tokens: 100,
      temperature: 0.7
    });

    const aiDescription = response.choices[0]?.message?.content?.trim();
    
    if (aiDescription && aiDescription.length > 10) {
      // console.log('✨ AI-generated adventure description:', aiDescription);
      return aiDescription;
    } else {
      console.warn('⚠️ AI description too short or empty, using fallback');
      return generateAdventureSummaryFallback(messages);
    }

  } catch (error) {
    console.warn('⚠️ Failed to generate AI description, using fallback:', error);
    return generateAdventureSummaryFallback(messages);
  }
};

// Fallback function for when AI is not available
const generateAdventureSummaryFallback = (messages: ChatMessage[]): string => {
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
 * Generate adventure name from messages using AI
 */
export const generateAdventureName = async (messages: ChatMessage[]): Promise<string> => {
  if (messages.length === 0) return "Untitled Adventure";
  try {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({
      dangerouslyAllowBrowser: true,
        apiKey: null,
      baseURL: 'https://api.readkraft.com/api/v1'
    });

    // Get key conversation elements for AI analysis
    const conversationSample = messages
      .slice(0, 8) // First 8 messages to understand the adventure beginning
      .map(msg => `${msg.type === 'user' ? 'Child' : 'Assistant'}: ${msg.content}`)
      .join('\n');

    const systemPrompt = `You are creating a catchy, exciting title for a child's adventure story.

Based on the conversation below, create a short title (2-4 words) that captures:
- The main character or hero type
- The key setting or theme
- An adventure-focused feeling

Rules:
- Keep it 2-4 words maximum
- Use exciting, child-friendly language
- Make it sound like a cool book title
- Avoid generic words like "story" or "tale"
- Focus on action words or exciting nouns
- Examples of good titles: "Dragon Riders", "Space Heroes", "Magic Forest Quest", "Robot Battle"

Conversation:
${conversationSample}

Generate an exciting adventure title (2-4 words):`;

    const response = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt }
      ],
      max_tokens: 50,
      temperature: 0.8
    });

    const aiTitle = response.choices[0]?.message?.content?.trim();
    
    if (aiTitle && aiTitle.length > 3 && aiTitle.length < 50) {
      // Clean up the title (remove quotes if AI added them)
      const cleanTitle = aiTitle.replace(/^["']|["']$/g, '');
      // console.log('✨ AI-generated adventure title:', cleanTitle);
      return cleanTitle;
    } else {
      console.warn('⚠️ AI title invalid length, using fallback');
      return generateAdventureNameFallback(messages);
    }

  } catch (error) {
    console.warn('⚠️ Failed to generate AI title, using fallback:', error);
    return generateAdventureNameFallback(messages);
  }
};

// Fallback function for when AI is not available
const generateAdventureNameFallback = (messages: ChatMessage[]): string => {
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
  // console.log(`Topic ${topicId} attempted with score ${score}/10. ${isPassingGrade ? 'PASSED' : 'NEEDS PRACTICE'} - Total completed: ${currentProgress.totalTopicsCompleted}`);
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
const GRADE_SELECTION_KEY = 'readingapp_grade_selection';

export interface TopicPreference {
  level: 'start' | 'middle';
  lastSelected: number;
}

export interface GradeSelection {
  gradeDisplayName: string;
  lastSelected: number;
}

/**
 * Map selected grade to content grade based on new requirements
 */
export const mapSelectedGradeToContentGrade = (gradeDisplayName: string): string => {
  const name = (gradeDisplayName || '').trim().toLowerCase();
  // Normalize common variants (including stored codes like grade3)
  const isGrade = (n: string, targets: Array<string | number>) =>
    targets.some(t => (typeof t === 'number' ? n.includes(`${t}`) : n.includes(t.toLowerCase())));

  // 4th/5th behave like grade 4 content
  if (isGrade(name, ['5th', 'fifth', 'grade 5', 'grade5', '5'])) return '4';
  if (isGrade(name, ['4th', 'fourth', 'grade 4', 'grade4', '4'])) return '4';
  if (isGrade(name, ['3rd', 'third', 'grade 3', 'grade3', '3'])) return '3';
  if (isGrade(name, ['2nd', 'second', 'grade 2', 'grade2', '2'])) return '2';
  if (isGrade(name, ['1st', 'first', 'grade 1', 'grade1', '1'])) return '1';
  if (isGrade(name, ['kindergarten', 'k', 'gradek'])) return 'K';
  // Default to grade 1 content
  return '1';
};

/**
 * Save user's topic level preference and determine the specific topic
 */
export const saveTopicPreference = (level: 'start' | 'middle', allTopicIds: string[], gradeDisplayName?: string): string | null => {
  try {
    const preference: TopicPreference = {
      level,
      lastSelected: Date.now()
    };
    localStorage.setItem(TOPIC_PREFERENCE_KEY, JSON.stringify(preference));
    
    // Immediately determine the specific topic and save it as current topic
    const specificTopic = getNextTopicByPreference(allTopicIds, level, gradeDisplayName);
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
 * Save user's grade selection preference
 */
export const saveGradeSelection = (gradeDisplayName: string): void => {
  try {
    const gradeSelection: GradeSelection = {
      gradeDisplayName,
      lastSelected: Date.now()
    };
    localStorage.setItem(GRADE_SELECTION_KEY, JSON.stringify(gradeSelection));
    // console.log(`💾 Saved grade selection: ${gradeDisplayName}`);
    
    // Dispatch custom event for same-window real-time updates (like progress tracking page)
    window.dispatchEvent(new CustomEvent('gradeSelectionChanged', {
      detail: { gradeDisplayName, timestamp: Date.now() }
    }));
  } catch (error) {
    console.warn('Failed to save grade selection to local storage:', error);
  }
};

/**
 * Load user's grade selection preference
 */
export const loadGradeSelection = (): GradeSelection | null => {
  try {
    const stored = localStorage.getItem(GRADE_SELECTION_KEY);
    if (!stored) {
      return null;
    }
    
    const parsed = JSON.parse(stored);
    
    if (
      typeof parsed === 'object' && 
      parsed !== null &&
      typeof parsed.gradeDisplayName === 'string' &&
      typeof parsed.lastSelected === 'number'
    ) {
      // console.log(`📖 Loaded grade selection: ${parsed.gradeDisplayName}`);
      return parsed as GradeSelection;
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to load grade selection from local storage:', error);
    return null;
  }
};

/**
 * Get the next available topic based on user's preference level, selected grade, and completed topics
 * Uses the actual ordering from mcq-questions.tsx data file
 */
export const getNextTopicByPreference = (allTopicIds: string[], level: 'start' | 'middle', gradeDisplayName?: string): string | null => {
  const progress = loadUserProgress();
  
  // Special-case: assignment grade always routes to A- topic only
  if ((gradeDisplayName || '').toLowerCase() === 'assignment') {
    return 'A-';
  }
  
  // Map selected grade to content grade
  const contentGrade = gradeDisplayName ? mapSelectedGradeToContentGrade(gradeDisplayName) : '1';
  // console.log(`🎯 Grade mapping - Selected: ${gradeDisplayName} → Content Grade: ${contentGrade}, Level: ${level}`);
  // console.log(`📚 Available topic IDs (first 10):`, allTopicIds.slice(0, 10));
  
  // Filter topics by grade first to see what's available (kept for future logic; not used below directly)
  const gradeTopics = allTopicIds.filter(id => {
    if (contentGrade === 'K') return id.startsWith('K-');
    if (contentGrade === '1') return id.startsWith('1-');
    if (contentGrade === '2') return id.startsWith('2-');
    if (contentGrade === '3') return id.startsWith('3-');
    if (contentGrade === '4') return id.startsWith('4-');
    return false;
  });
  
  // console.log(`📖 Found ${gradeTopics.length} topics for grade ${contentGrade}:`, gradeTopics.slice(0, 5));
  
  // Find starting index based on content grade and level
  let startIndex = 0;
  
  // Find the first topic that matches the content grade
  if (contentGrade === 'K') {
    // Start with Kindergarten topics (K- prefix)
    startIndex = allTopicIds.findIndex(id => id.startsWith('K-'));
    if (startIndex === -1) startIndex = 0;
  } else if (contentGrade === '1') {
    if (level === 'start') {
      // Grade 1 start level - find first 1- topic or use K- if 1- not found
      startIndex = allTopicIds.findIndex(id => id.startsWith('1-'));
      if (startIndex === -1) {
        startIndex = allTopicIds.findIndex(id => id.startsWith('K-'));
        if (startIndex === -1) startIndex = 0;
      }
    } else {
      // Grade 1 middle level - find 1-Q.4 or first 1- topic
      startIndex = allTopicIds.findIndex(id => id === '1-Q.4');
      if (startIndex === -1) {
        startIndex = allTopicIds.findIndex(id => id.startsWith('1-'));
        if (startIndex === -1) startIndex = 0;
      }
    }
  } else if (contentGrade === '2') {
    // Grade 2 content - find first 2- topic
    startIndex = allTopicIds.findIndex(id => id.startsWith('2-'));
    if (startIndex === -1) {
      // console.log(`⚠️ No Grade 2 topics found, falling back to Grade 1`);
      // Fallback to grade 1 if grade 2 topics not found
      startIndex = allTopicIds.findIndex(id => id.startsWith('1-'));
      if (startIndex === -1) startIndex = 0;
    }
  } else if (contentGrade === '3') {
    // Grade 3 content - find first 3- topic
    startIndex = allTopicIds.findIndex(id => id.startsWith('3-'));
    if (startIndex === -1) {
      // console.log(`⚠️ No Grade 3 topics found, falling back to Grade 2`);
      // Fallback to grade 2 if grade 3 topics not found
      startIndex = allTopicIds.findIndex(id => id.startsWith('2-'));
      if (startIndex === -1) {
        // console.log(`⚠️ No Grade 2 topics found, falling back to Grade 1`);
        startIndex = allTopicIds.findIndex(id => id.startsWith('1-'));
        if (startIndex === -1) startIndex = 0;
      }
    }
  } else if (contentGrade === '4') {
    // Grade 4 content - find first 4- topic
    startIndex = allTopicIds.findIndex(id => id.startsWith('4-'));
    if (startIndex === -1) {
      // Fallback to grade 3 → grade 2 → grade 1
      startIndex = allTopicIds.findIndex(id => id.startsWith('3-'));
      if (startIndex === -1) {
        startIndex = allTopicIds.findIndex(id => id.startsWith('2-'));
        if (startIndex === -1) {
          startIndex = allTopicIds.findIndex(id => id.startsWith('1-'));
          if (startIndex === -1) startIndex = 0;
        }
      }
    }
  }
  
  // console.log(`📍 Starting search from index ${startIndex}, topic: ${allTopicIds[startIndex] || 'none'}`);
  
  if (!progress) {
    // First time playing, return first topic from preferred starting point
    const selectedTopic = allTopicIds[startIndex] || null;
    // console.log(`🚀 First time playing - Starting with topic: ${selectedTopic} at index ${startIndex}`);
    return selectedTopic;
  }
  
  // console.log(`👤 User has progress data with ${progress.completedTopics.length} completed topics`);
  
  // Find first uncompleted topic starting from the preferred level and grade
  for (let i = startIndex; i < allTopicIds.length; i++) {
    const topicId = allTopicIds[i];
    const topicProgress = progress.completedTopics.find(
      t => t.topicId === topicId
    );
    
    // Topic is available if:
    // 1. Never attempted (not in completedTopics)
    // 2. Attempted but not completed with passing grade
    if (!topicProgress || !topicProgress.completed) {
      // console.log(`✅ Found available topic: ${topicId} at index ${i} (${topicProgress ? 'attempted but not completed' : 'never attempted'})`);
      return topicId;
    }
  }
  
  // console.log(`🔄 All topics from ${startIndex} onwards are completed, checking earlier topics`);
  
  // All topics from preferred starting point completed, check from beginning
  if (startIndex > 0) {
    for (let i = 0; i < startIndex; i++) {
      const topicId = allTopicIds[i];
      const topicProgress = progress.completedTopics.find(
        t => t.topicId === topicId
      );
      
      if (!topicProgress || !topicProgress.completed) {
        // console.log(`✅ Found available earlier topic: ${topicId} at index ${i}`);
        return topicId;
      }
    }
  }
  
  // All topics completed, return first topic for replay
  // console.log(`🔁 All topics completed, returning first topic for replay: ${allTopicIds[0]}`);
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
    
    // console.log(`🖼️ Cached adventure image: ${prompt.substring(0, 50)}...`);
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
    // console.log('🗑️ Cleared all cached adventure images');
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
    // console.log(`💾 Saved question progress: Topic ${topicId}, Question ${questionIndex + 1}`);
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
    // console.log('🗑️ Cleared question progress');
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
    // console.log(`🔄 Resuming topic ${topicId} from question ${progress.questionIndex + 1}`);
    return progress.questionIndex;
  }
  
  // Otherwise start from the beginning
  return 0;
};

// Spelling Progress persistence - sequential spelling question tracking
const SPELLING_PROGRESS_KEY = 'readingapp_spelling_progress';

export interface SpellingProgress {
  gradeDisplayName: string;
  currentSpellingIndex: number; // Track current position in sequential order
  completedSpellingIds: number[]; // Track completed questions to avoid repeats
  timestamp: number;
}

/**
 * Save current spelling progress for a grade
 */
export const saveSpellingProgress = (gradeDisplayName: string, currentIndex: number, completedIds: number[] = []): void => {
  try {
    const progress: SpellingProgress = {
      gradeDisplayName,
      currentSpellingIndex: currentIndex,
      completedSpellingIds: completedIds,
      timestamp: Date.now()
    };
    
    // Store progress per grade using a composite key
    const key = `${SPELLING_PROGRESS_KEY}_${gradeDisplayName}`;
    localStorage.setItem(key, JSON.stringify(progress));
    // console.log(`📝 Saved spelling progress: Grade ${gradeDisplayName}, Index ${currentIndex}, Completed: ${completedIds.length}`);
  } catch (error) {
    console.warn('Failed to save spelling progress to localStorage:', error);
  }
};

/**
 * Load spelling progress for a specific grade
 */
export const loadSpellingProgress = (gradeDisplayName?: string): SpellingProgress | null => {
  if (!gradeDisplayName) {
    return null;
  }
  
  try {
    const key = `${SPELLING_PROGRESS_KEY}_${gradeDisplayName}`;
    const stored = localStorage.getItem(key);
    if (!stored) {
      return null;
    }
    
    const progress = JSON.parse(stored) as SpellingProgress;
    
    // Only return progress if it's less than 7 days old to avoid stale progress
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - progress.timestamp < oneWeek) {
      return progress;
    }
    
    // Clear stale progress
    clearSpellingProgress(gradeDisplayName);
    return null;
  } catch (error) {
    console.warn('Failed to load spelling progress from localStorage:', error);
    return null;
  }
};

/**
 * Clear spelling progress for a specific grade
 */
export const clearSpellingProgress = (gradeDisplayName: string): void => {
  try {
    const key = `${SPELLING_PROGRESS_KEY}_${gradeDisplayName}`;
    localStorage.removeItem(key);
    // console.log(`🗑️ Cleared spelling progress for grade ${gradeDisplayName}`);
  } catch (error) {
    console.warn('Failed to clear spelling progress from localStorage:', error);
  }
};

/**
 * Reset spelling progress for a grade (start over)
 */
export const resetSpellingProgress = (gradeDisplayName: string): void => {
  saveSpellingProgress(gradeDisplayName, 0, []);
  // console.log(`🔄 Reset spelling progress for grade ${gradeDisplayName}`);
};

// Spellbox Topic Progress System - separate from main topic progress
const SPELLBOX_TOPIC_PROGRESS_KEY = 'readingapp_spellbox_topic_progress';

export interface SpellboxTopicProgress {
  topicId: string;
  questionsAttempted: number;
  firstAttemptCorrect: number;
  totalQuestions: number;
  isCompleted: boolean;
  completedAt?: number;
  successRate: number; // Calculated field for convenience
  // Mark that the whiteboard lesson for this topic has been completed at least once
  whiteboardSeen?: boolean;
  // IDs of questions mastered with a first-try correct on their latest showing (persisted across sessions)
  masteredQuestionIds?: number[];
  // The exact 10 questions presented in the first pass (locked order)
  firstPassQuestionIds?: number[];
  // Current round's pool (subset of the 10), iterated in order
  roundPoolQuestionIds?: number[];
  // Cursor within the current round pool
  roundPoolCursor?: number;
  // The next round's pool being built from current round's first-try incorrects
  nextRoundQuestionIds?: number[];
}

export interface SpellboxGradeProgress {
  gradeDisplayName: string;
  currentTopicId: string | null;
  topicProgress: Record<string, SpellboxTopicProgress>;
  timestamp: number;
}

/**
 * Save Spellbox topic progress for a specific grade
 */
export const saveSpellboxTopicProgress = (gradeDisplayName: string, progress: SpellboxGradeProgress): void => {
  try {
    const key = `${SPELLBOX_TOPIC_PROGRESS_KEY}_${gradeDisplayName}`;
    localStorage.setItem(key, JSON.stringify(progress));
    // console.log(`📝 Saved Spellbox topic progress: Grade ${gradeDisplayName}, Current Topic: ${progress.currentTopicId}`);
  } catch (error) {
    console.warn('Failed to save Spellbox topic progress to localStorage:', error);
  }
};

/**
 * Load Spellbox topic progress for a specific grade
 * Now supports Firebase loading for authenticated users
 */
export const loadSpellboxTopicProgress = (gradeDisplayName?: string, userId?: string): SpellboxGradeProgress | null => {
  if (!gradeDisplayName) {
    return null;
  }
  
  // For authenticated users, we'll load from Firebase in the background
  // but return localStorage data immediately for performance
  if (userId) {
    // Async load from Firebase (don't block UI)
    import('./firebase-spellbox-cache').then(({ loadSpellboxProgressHybrid }) => {
      loadSpellboxProgressHybrid(userId, gradeDisplayName).catch(error => {
        console.warn('Background Firebase load failed:', error);
      });
    }).catch(error => {
      console.warn('Failed to import Firebase cache:', error);
    });
  }
  
  // Always return localStorage data immediately for UI responsiveness
  try {
    const key = `${SPELLBOX_TOPIC_PROGRESS_KEY}_${gradeDisplayName}`;
    const stored = localStorage.getItem(key);
    if (!stored) {
      return null;
    }
    
    const progress = JSON.parse(stored) as SpellboxGradeProgress;
    
    // Only return progress if it's less than 30 days old to avoid stale progress
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - progress.timestamp < thirtyDays) {
      return progress;
    }
    
    // Clear stale progress
    clearSpellboxTopicProgress(gradeDisplayName);
    return null;
  } catch (error) {
    console.warn('Failed to load Spellbox topic progress from localStorage:', error);
    return null;
  }
};

/**
 * Load Spellbox topic progress for a specific grade with Firebase priority
 * This is the async version that waits for Firebase data
 */
export const loadSpellboxTopicProgressAsync = async (
  gradeDisplayName: string, 
  userId?: string
): Promise<SpellboxGradeProgress | null> => {
  if (userId) {
    try {
      const { loadSpellboxProgressHybrid } = await import('./firebase-spellbox-cache');
      return await loadSpellboxProgressHybrid(userId, gradeDisplayName);
    } catch (error) {
      console.warn('Failed to load from Firebase, falling back to localStorage:', error);
    }
  }
  
  // Fallback to localStorage
  return loadSpellboxTopicProgress(gradeDisplayName);
};

/**
 * Clear Spellbox topic progress for a specific grade
 */
export const clearSpellboxTopicProgress = (gradeDisplayName: string): void => {
  try {
    const key = `${SPELLBOX_TOPIC_PROGRESS_KEY}_${gradeDisplayName}`;
    localStorage.removeItem(key);
    // console.log(`🗑️ Cleared Spellbox topic progress for grade ${gradeDisplayName}`);
  } catch (error) {
    console.warn('Failed to clear Spellbox topic progress from localStorage:', error);
  }
};

/**
 * Get Spellbox topic progress for a specific topic
 */
export const getSpellboxTopicProgress = (gradeDisplayName: string, topicId: string): SpellboxTopicProgress | null => {
  const gradeProgress = loadSpellboxTopicProgress(gradeDisplayName);
  if (!gradeProgress) return null;
  
  return gradeProgress.topicProgress[topicId] || null;
};

/**
 * Update Spellbox topic progress when a question is attempted
 * Now supports Firebase sync for authenticated users
 */
export const updateSpellboxTopicProgress = async (
  gradeDisplayName: string, 
  topicId: string, 
  isFirstAttemptCorrect: boolean,
  userId?: string,
  questionId?: number
): Promise<SpellboxTopicProgress> => {
  let gradeProgress = loadSpellboxTopicProgress(gradeDisplayName);
  
  // Initialize grade progress if it doesn't exist
  if (!gradeProgress) {
    gradeProgress = {
      gradeDisplayName,
      currentTopicId: topicId,
      topicProgress: {},
      timestamp: Date.now()
    };
  }
  
  // Initialize topic progress if it doesn't exist (no reset on fail; we persist mastery across repeats)
  const existingProgress = gradeProgress.topicProgress[topicId];
  if (!existingProgress) {
    gradeProgress.topicProgress[topicId] = {
      topicId,
      questionsAttempted: 0,
      firstAttemptCorrect: 0,
      totalQuestions: 10, // Fixed at 10 questions per topic
      isCompleted: false,
      successRate: 0,
      masteredQuestionIds: [],
      firstPassQuestionIds: [],
      roundPoolQuestionIds: [],
      roundPoolCursor: 0,
      nextRoundQuestionIds: []
    };
  } else if (!Array.isArray(existingProgress.masteredQuestionIds)) {
    existingProgress.masteredQuestionIds = [];
    if (!Array.isArray(existingProgress.firstPassQuestionIds)) existingProgress.firstPassQuestionIds = [];
    if (!Array.isArray(existingProgress.roundPoolQuestionIds)) existingProgress.roundPoolQuestionIds = [];
    if (typeof existingProgress.roundPoolCursor !== 'number') existingProgress.roundPoolCursor = 0;
    if (!Array.isArray(existingProgress.nextRoundQuestionIds)) existingProgress.nextRoundQuestionIds = [];
  }
  
  const topicProgress = gradeProgress.topicProgress[topicId];
  
  // Update progress
  topicProgress.questionsAttempted++;
  if (isFirstAttemptCorrect) {
    topicProgress.firstAttemptCorrect++;
  }
  
  // Calculate success rate
  topicProgress.successRate = (topicProgress.firstAttemptCorrect / topicProgress.questionsAttempted) * 100;
  
  // Track mastery by question ID when provided
  if (typeof questionId === 'number' && isFirstAttemptCorrect) {
    const set = new Set<number>(topicProgress.masteredQuestionIds || []);
    set.add(questionId);
    topicProgress.masteredQuestionIds = Array.from(set);
  }
  
  // Seed first pass (lock first 10 shown) incrementally as questions are attempted
  if (typeof questionId === 'number') {
    const fp = topicProgress.firstPassQuestionIds || [];
    if (fp.length < 10 && !fp.includes(questionId)) {
      fp.push(questionId);
      topicProgress.firstPassQuestionIds = fp;
      try { console.log('[Spellbox][FirstPass] Added question to first pass', { gradeDisplayName, topicId, questionId, firstPassCount: fp.length }); } catch {}
    }
  }

  // Build next round list incrementally whenever a word is NOT first-try correct
  if (typeof questionId === 'number' && !isFirstAttemptCorrect) {
    const nextPool = topicProgress.nextRoundQuestionIds || [];
    if (!nextPool.includes(questionId)) {
      nextPool.push(questionId);
      topicProgress.nextRoundQuestionIds = nextPool;
      try { console.log('[Spellbox][RoundBuild] Added to next round (not first-try correct)', { gradeDisplayName, topicId, questionId, nextRoundCount: nextPool.length }); } catch {}
    }
  }

  // If first pass just finished (10 collected) and round pool is not seeded yet, seed it now
  if ((topicProgress.firstPassQuestionIds?.length || 0) >= 10) {
    if ((topicProgress.roundPoolQuestionIds?.length || 0) === 0) {
      topicProgress.roundPoolQuestionIds = [...(topicProgress.nextRoundQuestionIds || [])];
      topicProgress.roundPoolCursor = 0;
      topicProgress.nextRoundQuestionIds = [];
      try { console.log('[Spellbox][Rounds] Seeded round pool from first pass incorrects', { gradeDisplayName, topicId, pool: topicProgress.roundPoolQuestionIds }); } catch {}
    }
  }

  // During rounds, update cursor and pools based on correctness
  const masteredCountForRound = (topicProgress.masteredQuestionIds || []).length;
  const inRounds = (topicProgress.firstPassQuestionIds?.length || 0) >= 10 && masteredCountForRound < 10;
  if (inRounds && typeof questionId === 'number') {
    const pool = topicProgress.roundPoolQuestionIds || [];
    let cursor = typeof topicProgress.roundPoolCursor === 'number' ? topicProgress.roundPoolCursor : 0;
    // Ensure cursor targets current question; if mismatch, try to locate
    if (cursor < 0) cursor = 0;
    if (cursor >= pool.length) cursor = pool.length; // will trigger rotation below if at end

    const idxAtCursor = pool[cursor];
    const actualIndex = pool.indexOf(questionId);
    try { console.log('[Spellbox][Rounds] Before update', { gradeDisplayName, topicId, questionId, isFirstAttemptCorrect, pool: [...pool], cursor, idxAtCursor, actualIndex, nextRoundCount: (topicProgress.nextRoundQuestionIds || []).length }); } catch {}

    if (isFirstAttemptCorrect) {
      // Remove from current pool if present
      const removeIndex = actualIndex >= 0 ? actualIndex : -1;
      if (removeIndex >= 0) {
        pool.splice(removeIndex, 1);
        // If we removed an item before the cursor, adjust cursor back by one to keep position stable
        if (removeIndex < cursor) {
          cursor = Math.max(0, cursor - 1);
        }
      }
      // Do not add to nextRound
    } else {
      // Append to next round if not already there (done above too, but ensure order)
      const nextPool = topicProgress.nextRoundQuestionIds || [];
      if (!nextPool.includes(questionId)) nextPool.push(questionId);
      topicProgress.nextRoundQuestionIds = nextPool;
      // Advance cursor to next item in the current pool
      if (cursor < pool.length) cursor = cursor + 1;
    }

    // If we reached end of current pool and still not mastered, rotate pools
    if (cursor >= pool.length) {
      if ((topicProgress.masteredQuestionIds?.length || 0) >= 10) {
        // mastery reached; nothing to rotate
      } else {
        const nextPool = topicProgress.nextRoundQuestionIds || [];
        topicProgress.roundPoolQuestionIds = [...nextPool];
        topicProgress.roundPoolCursor = 0;
        topicProgress.nextRoundQuestionIds = [];
        // Reset local vars for clarity (not strictly necessary)
        cursor = 0;
        try { console.log('[Spellbox][Rounds] Rotated to next round pool', { gradeDisplayName, topicId, newPool: topicProgress.roundPoolQuestionIds }); } catch {}
      }
    }

    topicProgress.roundPoolQuestionIds = pool;
    topicProgress.roundPoolCursor = cursor;
    try { console.log('[Spellbox][Rounds] After update', { gradeDisplayName, topicId, pool: [...(topicProgress.roundPoolQuestionIds || [])], cursor: topicProgress.roundPoolCursor, nextRoundCount: (topicProgress.nextRoundQuestionIds || []).length }); } catch {}
  }

  // New completion criteria: 10 unique words mastered first-try (aggregate over time)
  const masteredCount = (topicProgress.masteredQuestionIds || []).length;
  if (masteredCount >= 10 && !topicProgress.isCompleted) {
    topicProgress.isCompleted = true;
    topicProgress.completedAt = Date.now();
    try { console.log('[Spellbox][Mastery] Topic mastered', { gradeDisplayName, topicId, masteredCount }); } catch {}
  }
  
  // Update current topic
  gradeProgress.currentTopicId = topicId;
  gradeProgress.timestamp = Date.now();
  
  // Save progress with Firebase sync if user is authenticated
  if (userId) {
    try {
      const { saveSpellboxProgressHybrid } = await import('./firebase-spellbox-cache');
      await saveSpellboxProgressHybrid(userId, gradeProgress);
    } catch (error) {
      console.warn('Failed to sync to Firebase, saving locally only:', error);
      saveSpellboxTopicProgress(gradeDisplayName, gradeProgress);
    }
  } else {
    // Save to localStorage only
    saveSpellboxTopicProgress(gradeDisplayName, gradeProgress);
  }
  
  // console.log(`📊 Spellbox Topic Progress Updated: ${topicId} - ${topicProgress.questionsAttempted}/10 questions, ${topicProgress.firstAttemptCorrect} first-attempt correct (${topicProgress.successRate.toFixed(1)}%)`);
  
  return topicProgress;
};

/**
 * Check if the whiteboard lesson for a topic has been seen (completed) at least once.
 * Reads from locally cached grade progress (kept in sync with Firebase via hybrid loader).
 */
export const hasSeenWhiteboard = (gradeDisplayName: string, topicId: string): boolean => {
  if (!gradeDisplayName || !topicId) return false;
  const gradeProgress = loadSpellboxTopicProgress(gradeDisplayName);
  if (!gradeProgress) return false;
  const topic = gradeProgress.topicProgress[topicId];
  return !!topic?.whiteboardSeen;
};

/**
 * Mark the whiteboard lesson for a topic as seen (on completion only).
 * Persists via Firebase when userId is provided, otherwise local only.
 */
export const markWhiteboardSeen = async (
  gradeDisplayName: string,
  topicId: string,
  userId?: string
): Promise<void> => {
  if (!gradeDisplayName || !topicId) return;
  let gradeProgress = loadSpellboxTopicProgress(gradeDisplayName);
  if (!gradeProgress) {
    gradeProgress = {
      gradeDisplayName,
      currentTopicId: topicId,
      topicProgress: {},
      timestamp: Date.now()
    };
  }

  if (!gradeProgress.topicProgress[topicId]) {
    gradeProgress.topicProgress[topicId] = {
      topicId,
      questionsAttempted: 0,
      firstAttemptCorrect: 0,
      totalQuestions: 10,
      isCompleted: false,
      successRate: 0,
      whiteboardSeen: true
    };
  } else {
    gradeProgress.topicProgress[topicId].whiteboardSeen = true;
  }

  gradeProgress.timestamp = Date.now();

  if (userId) {
    try {
      const { saveSpellboxProgressHybrid } = await import('./firebase-spellbox-cache');
      await saveSpellboxProgressHybrid(userId, gradeProgress);
    } catch (error) {
      console.warn('Failed to sync whiteboardSeen to Firebase; saving locally:', error);
      saveSpellboxTopicProgress(gradeDisplayName, gradeProgress);
    }
  } else {
    saveSpellboxTopicProgress(gradeDisplayName, gradeProgress);
  }
};

/**
 * Check if a Spellbox topic meets the 70% success criteria
 */
export const isSpellboxTopicPassingGrade = (topicProgress: SpellboxTopicProgress): boolean => {
  const masteredCount = Array.isArray(topicProgress.masteredQuestionIds)
    ? topicProgress.masteredQuestionIds.length
    : 0;
  return masteredCount >= 10;
};

/**
 * Get the next Spellbox topic for a grade
 */
export const getNextSpellboxTopic = (gradeDisplayName: string, allTopicIds: string[], preferredLevel?: 'start' | 'middle'): string | null => {
  // Special-case: assignment always stays on assignment topic list (e.g., 'A-')
  if ((gradeDisplayName || '').toLowerCase() === 'assignment') {
    // Prefer 'A-' if available in the provided list; fallback to first
    const hasAssignment = allTopicIds.includes('A-');
    return hasAssignment ? 'A-' : (allTopicIds[0] || null);
  }

  const gradeProgress = loadSpellboxTopicProgress(gradeDisplayName);
  
  if (!gradeProgress) {
    // Respect current level anchor when no progress exists
    if (preferredLevel === 'middle') {
      const contentGrade = mapSelectedGradeToContentGrade(gradeDisplayName);
      const middleAnchors: Record<string, string> = { K: 'K-T.1.2', '1': '1-T.2.1', '2': '2-P.2', '3': '3-A.5' };
      const desired = middleAnchors[contentGrade];
      if (desired && allTopicIds.includes(desired)) {
        return desired;
      }
    }
    // Fallback to first in-grade topic
    return allTopicIds[0] || null;
  }
  
  // SAFETY: If stored currentTopicId is no longer present (e.g., schema changed from 3-A.3 → 3-A.3.1),
  // remap it to a valid topic to avoid selecting an empty topic with no questions.
  if (gradeProgress.currentTopicId) {
    const topicIdSet = new Set(allTopicIds);
    if (!topicIdSet.has(gradeProgress.currentTopicId)) {
      // Try mapping base ID to first matching subtopic (e.g., '3-A.3' → '3-A.3.1')
      const prefix = `${gradeProgress.currentTopicId}.`;
      const fallback = allTopicIds.find(id => id.startsWith(prefix)) || allTopicIds[0] || null;
      gradeProgress.currentTopicId = fallback;
      gradeProgress.timestamp = Date.now();
      if (fallback) {
        saveSpellboxTopicProgress(gradeDisplayName, gradeProgress);
      }
    }
  }
  
  // If current topic exists and is not completed or not passing, continue with it
  if (gradeProgress.currentTopicId) {
    const currentTopicProgress = gradeProgress.topicProgress[gradeProgress.currentTopicId];
    if (!currentTopicProgress || !isSpellboxTopicPassingGrade(currentTopicProgress)) {
      return gradeProgress.currentTopicId;
    }
  }
  
  // Determine scan order: for 'middle' level, rotate so the middle anchor is first
  let scanTopicIds = allTopicIds;
  if (preferredLevel === 'middle') {
    try {
      const contentGrade = mapSelectedGradeToContentGrade(gradeDisplayName);
      const middleAnchors: Record<string, string> = { K: 'K-T.1.2', '1': '1-T.2.1', '2': '2-P.2', '3': '3-A.5' };
      const anchor = middleAnchors[contentGrade];
      const anchorIdx = anchor ? scanTopicIds.indexOf(anchor) : -1;
      if (anchorIdx >= 0) {
        scanTopicIds = [...scanTopicIds.slice(anchorIdx), ...scanTopicIds.slice(0, anchorIdx)];
      }
    } catch {}
  }

  // Find first topic that hasn't passed the 70% criteria
  for (const topicId of scanTopicIds) {
    const topicProgress = gradeProgress.topicProgress[topicId];
    
    // Topic is available if:
    // 1. Never attempted (not in topicProgress)
    // 2. Attempted but not completed or not passing 70%
    if (!topicProgress || !isSpellboxTopicPassingGrade(topicProgress)) {
      return topicId;
    }
  }
  
  // All topics passed, return first topic for replay
  return scanTopicIds[0] || null;
};

/**
 * Reset Spellbox topic progress for a grade (start over)
 */
export const resetSpellboxTopicProgress = (gradeDisplayName: string): void => {
  clearSpellboxTopicProgress(gradeDisplayName);
  // console.log(`🔄 Reset Spellbox topic progress for grade ${gradeDisplayName}`);
};

/**
 * Format AI messages by converting markdown-style formatting to HTML
 * Returns HTML that can be safely rendered using dangerouslySetInnerHTML
 */
export const formatAIMessage = (content: string, spellingWord?: string): string => {
  let formatted = content;
  
  // First, extract and convert all images (existing HTML and markdown) to final HTML
  const allImages: string[] = [];
  const placeholderMap = new Map<string, string>();
  
  // Extract existing HTML image tags
  const imageTagRegex = /<img[^>]*>/gi;
  formatted = formatted.replace(imageTagRegex, (match) => {
    const placeholder = `XIMGPLACEHOLDERX${allImages.length}XENDX`;
    allImages.push(match);
    placeholderMap.set(placeholder, match);
    return placeholder;
  });
  
  // Convert markdown image syntax to HTML and extract
  formatted = formatted.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, altText, url) => {
    // Validate that the URL looks like a proper image URL
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i;
    const isValidImageUrl = url.startsWith('http') || url.startsWith('data:') || imageExtensions.test(url);
    
    if (isValidImageUrl) {
      const placeholder = `XIMGPLACEHOLDERX${allImages.length}XENDX`;
      // Create styled image HTML with download button
      const imageHTML = `<div class="adventure-image-container" style="margin: 8px 0; text-align: center; position: relative;">
        <img src="${url}" alt="${altText || 'Generated adventure image'}" 
             class="adventure-image" 
             style="max-width: 100%; max-height: 200px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); border: 2px solid #000;" 
             loading="lazy" />
        <button onclick="window.open('${url}', '_blank')" 
                style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 6px; padding: 6px 8px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 4px; transition: background 0.2s;"
                onmouseover="this.style.background='rgba(0,0,0,0.9)'" 
                onmouseout="this.style.background='rgba(0,0,0,0.7)'"
                title="Open image in new tab">
          📥 Download
        </button>
      </div>`;
      
      allImages.push(imageHTML);
      placeholderMap.set(placeholder, imageHTML);
      return placeholder;
    }
    
    // If not a valid image URL, remove it completely to avoid display issues
    return '';
  });
  
  // Function to escape HTML characters to prevent XSS
  const escapeHtml = (text: string) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };
  
  // Now escape HTML for everything except our image placeholders
  formatted = escapeHtml(formatted);
  
  // Convert newlines to <br> tags (handle multiple formats)
  // 1. Convert literal \n characters (escaped backslash + n)
  formatted = formatted.replace(/\\n/g, '<br>');
  
  // 2. Convert actual newline characters to <br> tags
  formatted = formatted.replace(/\n/g, '<br>');
  
  // 3. Handle numbered lists by ensuring they're on separate lines with extra spacing
  // Convert patterns like "1. text 2. text 3. text" to "1. text<br><br>2. text<br><br>3. text"
  // Use a loop to catch all consecutive numbered items
  let previousLength = 0;
  while (formatted.length !== previousLength) {
    previousLength = formatted.length;
    formatted = formatted.replace(/(\d+\.\s+[^0-9]*?)(\s+)(\d+\.\s)/g, '$1<br><br>$3');
  }
  
  // 4. Handle dash/bullet lists with extra spacing
  formatted = formatted.replace(/(-\s+[^-]*?)(\s+)(-\s)/g, '$1<br><br>$3');
  
  // 5. Add spacing after "Choose one:" or similar prompts before numbered lists
  formatted = formatted.replace(/(choose one:|pick one:|select:|options?:)(\s*<br>\s*)(\d+\.)/gi, '$1<br><br>$3');
  
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

  // Note: Don't remove spelling word here - SpellBox needs it to create input boxes
  // The SpellBox component will handle replacing the word with interactive blanks
  
  // Clean up multiple consecutive <br> tags
  formatted = formatted.replace(/(<br\s*\/?>){3,}/g, '<br><br>');
  
  // Restore all image HTML using the placeholder map
  placeholderMap.forEach((imageHTML, placeholder) => {
    formatted = formatted.replace(new RegExp(placeholder, 'g'), imageHTML);
  });
  
  // Clean up any remaining broken placeholders that might have been missed
  formatted = formatted.replace(/_MARKDOWNIMAGEPLACEHOLDER\d+/g, '');
  formatted = formatted.replace(/__[A-Z_]*PLACEHOLDER[^_]*__/g, '');
  formatted = formatted.replace(/_PRESERVEDIMAGE_\d+_/g, '');
  formatted = formatted.replace(/XIMGPLACEHOLDERX\d+XENDX/g, '');
  
  return formatted;
};

// Profanity moderation utility
import profanityListRaw from "@/lib/profanity.txt?raw";
import OpenAI from 'openai';

// Build a Set of profane words on first import for O(1) lookups
const PROFANITY_SET: Set<string> = (() => {
  // Normalize lines: trim, lowercase, drop blanks
  const lines = profanityListRaw
    .split(/\r?\n/)
    .map(l => l.trim().toLowerCase())
    .filter(l => l.length > 0);
  return new Set(lines);
})();

/**
 * Check if the given text contains any profane word.
 * - Case-insensitive
 * - Ignores punctuation and special characters
 * - Treats dots/slashes/hyphens as separators
 * Returns true if any word matches; otherwise false.
 */

export function openaiClient() {
  return new OpenAI({
    dangerouslyAllowBrowser: true,
    apiKey: null,
    baseURL: 'https://api.readkraft.com/api/v1'
  });
}

export async function moderation(userName: string, text: string | null | undefined): Promise<boolean> {
  if (!text) return false;

  // const response = await openaiClient().responses.create({
  //   prompt: {
  //     id: "pmpt_68fd89ceb3ac81949d993547421cd434082fd0c40ffb90e3"
  //   },
  //   store: false,
  //   input: [
  //     {
  //       role: "user",
  //       content: [
  //         {
  //           type: "input_text",
  //           text
  //         }
  //       ]
  //     }]
  // });
  // if (response.output_text.includes("true")) {
  //   return true;
  // }
  


  //Lowercase and replace any non-alphanumeric (unicode letters/digits) with spaces
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

  if (!normalized) return false;

  const tokens = normalized.split(/\s+/);

  // Early exit on direct token matches
  for (const token of tokens) {
    if (PROFANITY_SET.has(token)) {
      return true;
    }
  }

  fetch('https://api.readkraft.com/api/discord', {
    method: 'POST',
    body: JSON.stringify({
      content: text,
      username: userName,
      "type": "user_input",
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return false;

  // Additionally check common adjacent joins that appear in list (e.g., "shithead")
  // for (let i = 0; i < tokens.length - 1; i++) {
  //   const joined = tokens[i] + tokens[i + 1];
  //   if (PROFANITY_SET.has(joined)) {
  //     return true;
  //   }
  // }
}
