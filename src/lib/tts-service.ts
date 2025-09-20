import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { isImageLoadingSoundCurrentlyPlaying } from './sounds';

interface TTSOptions {
  voice?: string;
  model?: string;
  stability?: number;
  similarity_boost?: number;
  speed?: number; // Voice speed control (0.25-4.0, default 1.0)
  messageId?: string; // Add message ID for tracking
}

export interface Voice {
  id: string;
  name: string;
  description: string;
  previewText: string;
}

// Available voices for selection
export const AVAILABLE_VOICES: Voice[] = [
  {
    id: 'cgSgspJ2msm6clMCkdW9',
    name: 'Jessica',
    description: 'Warm and friendly tone, perfect for children',
    previewText: "Hi there! I'm Jessica, and I love helping kids learn through stories and adventures. Let's explore together!"
  },
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Sarah',
    description: 'Clear and articulate, great for educational content',
    previewText: "Hello! I'm Sarah. I enjoy making learning fun and easy to understand. Ready to discover something new?"
  },
  {
    id: 'ErXwobaYiN019PkySvjV',
    name: 'Antoni',
    description: 'Deep and engaging voice for storytelling',
    previewText: "Greetings! I'm Antoni, and I love bringing stories to life. Let me take you on an amazing journey!"
  },
  {
    id: 'VR6AewLTigWG4xSOukaG',
    name: 'Arnold',
    description: 'Strong and confident, perfect for adventure stories',
    previewText: "Hey there, adventurer! I'm Arnold, ready to guide you through exciting quests and challenges!"
  },
  {
    id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
    description: 'Sweet and gentle, ideal for younger learners',
    previewText: "Hello sweetie! I'm Rachel, and I can't wait to share wonderful stories and help you learn new things!"
  },
  {
    id: '7fbQ7yJuEo56rYjrYaEh',
    name: 'John Doe',
    description: 'Deep, mature voice perfect for audiobooks and storytelling',
    previewText: "Hello there! I'm John Doe, and I bring stories to life with my deep, resonant voice. Let's dive into an amazing adventure together!"
  }
];

const SELECTED_VOICE_KEY = 'reading_app_selected_voice';
const SELECTED_SPEED_KEY = 'reading_app_voice_speed';

class TextToSpeechService {
  private client: ElevenLabsClient | null = null;
  private isInitialized = false;
  private currentAudio: HTMLAudioElement | null = null;
  private isSpeaking = false;
  private selectedVoice: Voice;
  private selectedSpeed: number; // Voice speed (0.25-4.0, default 0.8)
  private currentSpeakingMessageId: string | null = null; // Track which message is speaking
  private speakingStateListeners: Set<(messageId: string | null) => void> = new Set(); // Listeners for speaking state changes

  constructor() {
    // Load selected voice from localStorage or default to Jessica
    this.selectedVoice = this.loadSelectedVoice();
    // Load selected speed from localStorage or default to 0.8
    this.selectedSpeed = this.loadSelectedSpeed();
    this.initialize();
  }

  private loadSelectedVoice(): Voice {
    try {
      const stored = localStorage.getItem(SELECTED_VOICE_KEY);
      if (stored) {
        const voiceId = JSON.parse(stored);
        const voice = AVAILABLE_VOICES.find(v => v.id === voiceId);
        if (voice) return voice;
      }
    } catch (error) {
      console.warn('Failed to load selected voice from localStorage:', error);
    }
    
    // Default to Jessica
    return AVAILABLE_VOICES[0];
  }

  private loadSelectedSpeed(): number {
    try {
      const stored = localStorage.getItem(SELECTED_SPEED_KEY);
      if (stored) {
        const speed = parseFloat(stored);
        // Validate speed is within acceptable range (0.7-1.2)
        if (speed >= 0.7 && speed <= 1.2) {
          return speed;
        }
      }
    } catch (error) {
      console.warn('Failed to load selected speed from localStorage:', error);
    }
    
    // Default to 0.8 as requested
    return 0.8;
  }

  private saveSelectedVoice(voice: Voice): void {
    try {
      localStorage.setItem(SELECTED_VOICE_KEY, JSON.stringify(voice.id));
    } catch (error) {
      console.warn('Failed to save selected voice to localStorage:', error);
    }
  }

  private saveSelectedSpeed(speed: number): void {
    try {
      localStorage.setItem(SELECTED_SPEED_KEY, speed.toString());
    } catch (error) {
      console.warn('Failed to save selected speed to localStorage:', error);
    }
  }

  // Get current selected voice
  getSelectedVoice(): Voice {
    return this.selectedVoice;
  }

  // Set selected voice
  setSelectedVoice(voice: Voice): void {
    this.selectedVoice = voice;
    this.saveSelectedVoice(voice);
  }

  // Get all available voices
  getAvailableVoices(): Voice[] {
    return AVAILABLE_VOICES;
  }

  // Get current selected speed
  getSelectedSpeed(): number {
    return this.selectedSpeed;
  }

  // Set selected speed (0.7-1.2)
  setSelectedSpeed(speed: number): void {
    // Validate speed is within acceptable range
    if (speed < 0.7 || speed > 1.2) {
      console.warn('Speed must be between 0.7 and 1.2, using default 0.8');
      speed = 0.8;
    }
    
    this.selectedSpeed = speed;
    this.saveSelectedSpeed(speed);
  }

  // Preview a voice by having it introduce itself
  async previewVoice(voice: Voice): Promise<void> {
    await this.speak(voice.previewText, { voice: voice.id });
  }

  private initialize() {
    // Check if TTS API key is available
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    
    if (apiKey) {
      this.client = new ElevenLabsClient({
        apiKey: apiKey,
      });
      this.isInitialized = true;
    } else {
      console.warn('TTS API key not found. TTS service will not be available.');
      this.isInitialized = false;
    }
  }

  // Add listener for speaking state changes
  addSpeakingStateListener(listener: (messageId: string | null) => void): void {
    this.speakingStateListeners.add(listener);
  }

  // Remove listener for speaking state changes
  removeSpeakingStateListener(listener: (messageId: string | null) => void): void {
    this.speakingStateListeners.delete(listener);
  }

  // Notify all listeners of speaking state change
  private notifySpeakingStateChange(messageId: string | null): void {
    this.speakingStateListeners.forEach(listener => listener(messageId));
  }

  // Speak text using selected voice
  async speak(text: string, options?: TTSOptions): Promise<void> {
    // Clean the text for better speech
    const cleanText = this.cleanTextForSpeech(text);
    
    // If not initialized or no API key, skip TTS
    if (!this.isInitialized || !this.client) {
      console.warn('TTS not configured. Cannot speak text.');
      return;
    }

    // Check if image loading sound is playing - if so, don't speak
    if (isImageLoadingSoundCurrentlyPlaying()) {
      console.debug('Image loading sound is playing, skipping TTS');
      return;
    }

    try {
      // Stop any current audio and clean up resources
      this.stop();
      
      // Add a small delay to ensure previous audio is fully stopped
      await new Promise(resolve => setTimeout(resolve, 50));

      // Set current speaking message ID
      this.currentSpeakingMessageId = options?.messageId || null;
      this.notifySpeakingStateChange(this.currentSpeakingMessageId);

      // Use selected voice or override from options
      const voiceId = options?.voice || this.selectedVoice.id;

      // Generate audio using selected voice
      const audioStream = await this.client.textToSpeech.convert(
        voiceId,  // First parameter: voice ID as string
        {         // Second parameter: options object
          text: cleanText,
          modelId: options?.model || 'eleven_turbo_v2_5',
          voiceSettings: {
            stability: options?.stability || 0.5,
            similarityBoost: options?.similarity_boost || 0.75,
            speed: options?.speed || this.selectedSpeed,
          },
        }
      );

      // Convert the stream to audio blob
      const chunks: Uint8Array[] = [];
      const reader = audioStream.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // Create audio blob and play
      const audioBlob = new Blob(chunks, { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      this.currentAudio = new Audio(audioUrl);
      this.isSpeaking = true;

      // Return a Promise that resolves when audio finishes playing
      return new Promise<void>((resolve, reject) => {
        if (!this.currentAudio) {
          reject(new Error('Audio not initialized'));
          return;
        }

        this.currentAudio.onended = () => {
          this.isSpeaking = false;
          this.currentSpeakingMessageId = null;
          this.notifySpeakingStateChange(null);
          URL.revokeObjectURL(audioUrl);
          resolve();
        };

        this.currentAudio.onerror = () => {
          this.isSpeaking = false;
          this.currentSpeakingMessageId = null;
          this.notifySpeakingStateChange(null);
          URL.revokeObjectURL(audioUrl);
          console.error('Error playing TTS audio');
          reject(new Error('Audio playback failed'));
        };

        // Start playing the audio
        this.currentAudio.play().catch((error) => {
          this.isSpeaking = false;
          this.currentSpeakingMessageId = null;
          this.notifySpeakingStateChange(null);
          URL.revokeObjectURL(audioUrl);
          reject(error);
        });
      });
    } catch (error) {
      console.error('TTS error:', error);
      this.isSpeaking = false;
      this.currentSpeakingMessageId = null;
      this.notifySpeakingStateChange(null);
      throw error;
    }
  }

  // Clean text for better speech synthesis
  private cleanTextForSpeech(text: string): string {
    return text
      // Remove emojis
      .replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
      // Remove markdown image syntax (![alt text](url) or ![alt text](url "title"))
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      // Remove standalone URLs (http/https)
      .replace(/https?:\/\/[^\s]+/g, '')
      // Remove markdown formatting
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      // Remove extra spaces and newlines
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Stop current speech
  stop(): void {
    const wasPlaying = this.isSpeaking || this.currentAudio;
    
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        
        // Clean up event listeners to prevent memory leaks
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
        
        this.currentAudio = null;
      } catch (error) {
        console.warn('Error stopping TTS audio:', error);
      }
    }
    
    this.isSpeaking = false;
    const wasPlayingMessageId = this.currentSpeakingMessageId;
    this.currentSpeakingMessageId = null;
    
    // Only notify if there was actually something playing
    if (wasPlayingMessageId) {
      this.notifySpeakingStateChange(null);
    }
    
    if (wasPlaying) {
      console.debug('🔧 TTS stopped successfully');
    }
  }

  // Check if currently speaking
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  // Check if a specific message is currently speaking
  isMessageSpeaking(messageId: string): boolean {
    return this.currentSpeakingMessageId === messageId;
  }

  // Get the currently speaking message ID
  getCurrentSpeakingMessageId(): string | null {
    return this.currentSpeakingMessageId;
  }

  // Check if TTS service is properly configured
  isConfigured(): boolean {
    return this.isInitialized;
  }

  // Get configuration status
  getStatus(): { configured: boolean; message: string } {
    if (this.isInitialized) {
      return { configured: true, message: `TTS is ready with ${this.selectedVoice.name}'s voice!` };
    } else {
      return { 
        configured: false, 
        message: 'TTS API key required for TTS functionality.' 
      };
    }
  }

  // Speak question automatically with selected voice for educational content
  async speakQuestion(questionText: string): Promise<void> {
    await this.speak(questionText, {
      stability: 0.6,
      similarity_boost: 0.8,
    });
  }

  // Speak AI messages with selected voice
  async speakAIMessage(message: string, messageId?: string): Promise<void> {
    await this.speak(message, {
      stability: 0.7,
      similarity_boost: 0.9,
      messageId: messageId,
    });
  }

  // Speak answer text with selected voice (for the speaker button beside image)
  async speakAnswer(answerText: string): Promise<void> {
    await this.speak(answerText, {
      stability: 0.5,
      similarity_boost: 0.75,
    });
  }
}

// Export a singleton instance
export const ttsService = new TextToSpeechService();
export default TextToSpeechService;
