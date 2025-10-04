import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { isImageLoadingSoundCurrentlyPlaying, stopImageLoadingSound } from './sounds';
import { PetProgressStorage } from './pet-progress-storage';

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
  // Pet-specific default voices
  // {
  //   id: 'CeNX9CMwmxDxUF5Q2Inm',
  //   name: 'Dog (Default)',
  //   description: 'Friendly, energetic tone fitting for a playful dog',
  //   previewText: "Woof! I'm your friendly dog, ready for fun adventures and learning together!"
  // },
  {
    id: 'UgBBYS2sOqTuMpoF3BR0',
    name: 'Professor',
    description: 'Warm, wise mentor tone for Krafty (tutorial voice)',
    previewText: "Hello! I'm your trainer, here to guide you step by step."
  },
  {
    id: 'cgSgspJ2msm6clMCkdW9',
    name: 'Jessica',
    description: 'Warm and friendly tone, perfect for children',
    previewText: "Hi there! I'm Jessica, and I love helping kids learn through stories and adventures. Let's explore together!"
  },
  {
    id: 'ocZQ262SsZb9RIxcQBOj',
    name: 'Cat',
    description: 'Calm and curious, purrfect for gentle guidance',
    previewText: "Meow! I'm a curious cat, here to guide you softly through new stories."
  },
  // {
  //   id: 'mdzEgLpu0FjTwYs5oot0',
  //   name: 'Hamster (Default)',
  //   description: 'Cheery and quick, great for lively narration',
  //   previewText: "Squeak! I'm your tiny hamster friend, excited to read and explore with you!"
  // },
 
  // {
  //   id: 'EXAVITQu4vr4xnSDxMaL',
  //   name: 'Sarah',
  //   description: 'Clear and articulate, great for educational content',
  //   previewText: "Hello! I'm Sarah. I enjoy making learning fun and easy to understand. Ready to discover something new?"
  // },
  // {
  //   id: 'ErXwobaYiN019PkySvjV',
  //   name: 'Antoni',
  //   description: 'Deep and engaging voice for storytelling',
  //   previewText: "Greetings! I'm Antoni, and I love bringing stories to life. Let me take you on an amazing journey!"
  // },
  // {
  //   id: 'VR6AewLTigWG4xSOukaG',
  //   name: 'Arnold',
  //   description: 'Strong and confident, perfect for adventure stories',
  //   previewText: "Hey there, adventurer! I'm Arnold, ready to guide you through exciting quests and challenges!"
  // },
  // {
  //   id: '21m00Tcm4TlvDq8ikWAM',
  //   name: 'Rachel',
  //   description: 'Sweet and gentle, ideal for younger learners',
  //   previewText: "Hello sweetie! I'm Rachel, and I can't wait to share wonderful stories and help you learn new things!"
  // },
  {
    id: '7fbQ7yJuEo56rYjrYaEh',
    name: 'John Doe',
    description: 'Deep, mature voice perfect for audiobooks and storytelling',
    previewText: "Hello there! I'm John Doe, and I bring stories to life with my deep, resonant voice. Let's dive into an amazing adventure together!"
  }
];

// Kept for backward compatibility but no longer used for selection
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
  private suppressNonKrafty: boolean = false; // Gate to mute non-Krafty speech during overlays
  // Track overlapping speak requests so the newest wins and earlier ones never play
  private speakRequestSeq: number = 0;
  private activeSpeakRequestSeq: number = 0;
  // Store the most recent non-Krafty message suppressed while overlays are active
  private lastSuppressedMessage: { text: string; options?: TTSOptions } | null = null;

  constructor() {
    // Load initial voice using current pet preference or pet default
    this.selectedVoice = this.loadSelectedVoice();
    // Load selected speed from localStorage or default to 0.8
    this.selectedSpeed = this.loadSelectedSpeed();
    this.initialize();
  }

  // Allow callers to suppress non-Krafty speech (used during tutorial overlays)
  setSuppressNonKrafty(suppress: boolean): void {
    this.suppressNonKrafty = suppress;
  }

  // Expose current suppression state for UI/overlays to check
  isNonKraftySuppressed(): boolean {
    return this.suppressNonKrafty;
  }

  private loadSelectedVoice(): Voice {
    // Resolve effective voice for current pet at service init
    try {
      const currentPetId = PetProgressStorage.getCurrentSelectedPet();
      if (currentPetId) {
        const preferred = PetProgressStorage.getPreferredVoiceIdForPet(currentPetId);
        if (preferred) {
          const v = AVAILABLE_VOICES.find(v => v.id === preferred);
          if (v) return v;
        }
      }
    } catch {}

    // Pet default mapping
    try {
      const currentPetId = PetProgressStorage.getCurrentSelectedPet();
      const PET_DEFAULT_VOICE_ID: Record<string, string> = {
        dog: 'cgSgspJ2msm6clMCkdW9',
        cat: 'ocZQ262SsZb9RIxcQBOj',
        hamster: 'ocZQ262SsZb9RIxcQBOj',
      };
      const defaultVoiceId = currentPetId ? PET_DEFAULT_VOICE_ID[currentPetId] : undefined;
      if (defaultVoiceId) {
        const petDefault = AVAILABLE_VOICES.find(v => v.id === defaultVoiceId);
        if (petDefault) return petDefault;
      }
    } catch {}

    // Fallback to first voice in the list
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
    // Back-compat no-op for global key; preference is saved per pet in setSelectedVoice
    try {
      localStorage.setItem(SELECTED_VOICE_KEY, JSON.stringify(voice.id));
    } catch (error) {
      // Ignore
    }
  }

  private saveSelectedSpeed(speed: number): void {
    try {
      localStorage.setItem(SELECTED_SPEED_KEY, speed.toString());
    } catch (error) {
      console.warn('Failed to save selected speed to localStorage:', error);
    }
  }

  // Get effective selected voice for the current pet
  getSelectedVoice(): Voice {
    try {
      const currentPetId = PetProgressStorage.getCurrentSelectedPet();
      if (currentPetId) {
        const preferred = PetProgressStorage.getPreferredVoiceIdForPet(currentPetId);
        if (preferred) {
          const v = AVAILABLE_VOICES.find(v => v.id === preferred);
          if (v) return v;
        }
        // Fall back to pet default mapping
        const PET_DEFAULT_VOICE_ID: Record<string, string> = {
          dog: 'cgSgspJ2msm6clMCkdW9',
          cat: 'ocZQ262SsZb9RIxcQBOj',
          hamster: 'ocZQ262SsZb9RIxcQBOj',
        };
        const defaultVoiceId = PET_DEFAULT_VOICE_ID[currentPetId];
        const petDefault = AVAILABLE_VOICES.find(v => v.id === defaultVoiceId);
        if (petDefault) return petDefault;
      }
    } catch {}
    return this.selectedVoice;
  }

  // Set selected voice for the current pet
  setSelectedVoice(voice: Voice): void {
    this.selectedVoice = voice;
    try {
      const currentPetId = PetProgressStorage.getCurrentSelectedPet();
      if (currentPetId) {
        PetProgressStorage.setPreferredVoiceIdForPet(currentPetId, voice.id);
      }
    } catch {}
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

    // Determine if this is a Krafty message (only consider explicit messageId)
    const messageId = options?.messageId || '';
    const isKrafty = typeof messageId === 'string' && /\bkrafty\b|^krafty-|krafty-/.test(messageId);

    // If non-Krafty speech is suppressed (e.g., during overlays), skip speaking
    if (this.suppressNonKrafty && !isKrafty) {
      // Save the last suppressed message so it can be replayed immediately after suppression lifts
      this.lastSuppressedMessage = { text: cleanText, options };
      return;
    }

    // If not initialized or no API key, skip TTS
    if (!this.isInitialized || !this.client) {
      console.warn('TTS not configured. Cannot speak text.');
      return;
    }

    // Ensure exclusivity with image-loading loop: stop it if playing
    if (isImageLoadingSoundCurrentlyPlaying()) {
      try { stopImageLoadingSound(); } catch {}
    }

    try {
      // Increment speak request sequence so this call becomes the active one
      const requestSeq = ++this.speakRequestSeq;
      this.activeSpeakRequestSeq = requestSeq;

      // Stop any current audio and clean up resources to prevent overlap
      this.stop();
      
      // Add a small delay to ensure previous audio is fully stopped
      await new Promise(resolve => setTimeout(resolve, 50));

      // Set current speaking message ID
      this.currentSpeakingMessageId = options?.messageId || null;
      this.notifySpeakingStateChange(this.currentSpeakingMessageId);

      // Use selected voice or override from options
      // Resolve per-pet preference first, then pet default, then fallback
      let resolvedVoiceId: string | undefined;
      if (options?.voice) {
        resolvedVoiceId = options.voice;
      } else {
        // If the message is from Krafty, force Professor voice
        const isKraftyMsg = isKrafty;
        if (isKraftyMsg) {
          const professor = AVAILABLE_VOICES.find(v => v.name === 'Professor');
          if (professor) {
            resolvedVoiceId = professor.id;
          }
        }

        if (!resolvedVoiceId) {
          try {
            const currentPetId = PetProgressStorage.getCurrentSelectedPet();
            if (currentPetId) {
              const preferred = PetProgressStorage.getPreferredVoiceIdForPet(currentPetId);
              if (preferred) {
                resolvedVoiceId = preferred;
              } else {
                const PET_DEFAULT_VOICE_ID: Record<string, string> = {
                  dog: 'cgSgspJ2msm6clMCkdW9',
                  cat: 'ocZQ262SsZb9RIxcQBOj',
                  hamster: 'ocZQ262SsZb9RIxcQBOj',
                };
                resolvedVoiceId = PET_DEFAULT_VOICE_ID[currentPetId];
              }
            }
          } catch {}

          if (!resolvedVoiceId) {
            resolvedVoiceId = this.selectedVoice.id;
          }
        }
      }

      const voiceId = resolvedVoiceId as string;

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
      const chunks: BlobPart[] = [];
      const reader = audioStream.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value as unknown as BlobPart);
      }

      // Create audio blob and play
      const audioBlob = new Blob(chunks, { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // If a newer speak request started while we were generating audio, abort this playback
      if (this.activeSpeakRequestSeq !== requestSeq) {
        URL.revokeObjectURL(audioUrl);
        return;
      }

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

  // Replay the most recently suppressed non-Krafty message, if any
  async replayLastSuppressed(): Promise<void> {
    if (!this.lastSuppressedMessage) return;
    const payload = this.lastSuppressedMessage;
    this.lastSuppressedMessage = null;
    await this.speak(payload.text, payload.options);
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
