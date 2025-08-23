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
