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
    previewText: "You're my favorite human, and I'll always stay by your side."
  },
  {
    id: 'ocZQ262SsZb9RIxcQBOj',
    name: 'Cat',
    description: 'Calm and curious, purrfect for gentle guidance',
    previewText: "I don't need treats… just stay close. That's enough."
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
    previewText: "You're my favorite human, and I'll always stay by your side."
  },
  {
    id: 'BlgEcC0TfWpBak7FmvHW',
    name: 'Fena',
    description: 'Amazing for parrots, unicorns, cats and other animal characters',
    previewText: "If you feel sad, curl up with me — we'll be okay together."
  },
  {
    id: 'Bj9UqZbhQsanLzgalpEG',
    name: 'Austin',
    description: 'Great for monkeys, pandas, wolves and other animal characters',
    previewText: "You're my favorite human, and I'll always stay by your side."
  },
  {
    id: 'DTKMou8ccj1ZaWGBiotd',
    name: 'Jamahal',
    description: 'Great for raccoons, pandas, monkeys and other animal characters',
    previewText: "Adventure time! I packed… zero things. But I brought loyalty."
  },
  {
    id: 'QzTKubutNn9TjrB7Xb2Q',
    name: 'Jerry B.',
    description: 'Great for wolves, dragons, dogs and other animal characters',
    previewText: "If you feel sad, curl up with me — we'll be okay together."
  },
  {
    id: 'piI8Kku0DcvcL6TTSeQt',
    name: 'Flicker',
    description: 'Great for unicorns, deer, pikachu and other animal characters',
    previewText: "You're my favorite human, and I'll always stay by your side."
  },
  {
    id: 'Z7RrOqZFTyLpIlzCgfsp',
    name: 'Creature',
    description: 'Great for labubu, fox, and other animal characters',
    previewText: "Hey there! You're my favorite human... for now."
  },
  {
    id: 'CeNX9CMwmxDxUF5Q2Inm',
    name: 'Johny D.',
    description: 'Great for raccoons, adults dogs, monkeys and other animal characters',
    previewText: "Adventure time! I packed… zero things. But I brought loyalty."
  }
];

// Fallback and pet default mapping
const JESSICA_VOICE = AVAILABLE_VOICES.find(v => v.name === 'Jessica');
const JESSICA_VOICE_ID = JESSICA_VOICE ? JESSICA_VOICE.id : 'cgSgspJ2msm6clMCkdW9';
const PET_DEFAULT_VOICE_ID: Record<string, string> = {
  raccoon: 'CeNX9CMwmxDxUF5Q2Inm', // Johny D.
  panda: 'DTKMou8ccj1ZaWGBiotd', // Jamahal
  unicorn: 'piI8Kku0DcvcL6TTSeQt', // Flicker
  pikachu: 'piI8Kku0DcvcL6TTSeQt', // Flicker
  hamster: 'piI8Kku0DcvcL6TTSeQt', // Flicker
  monkey: 'QzTKubutNn9TjrB7Xb2Q', // Jerry B.
  wolf: 'Bj9UqZbhQsanLzgalpEG', // Austin
  parrot: 'BlgEcC0TfWpBak7FmvHW', // Fena
  deer: 'BlgEcC0TfWpBak7FmvHW', // Fena
  dragon: '7fbQ7yJuEo56rYjrYaEh', // John Doe
  cat: 'ocZQ262SsZb9RIxcQBOj', // Cat
  dog: 'cgSgspJ2msm6clMCkdW9', // Jessica
};

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
  // Guard to ignore external stop() calls during exclusive playback (e.g., streak modal)
  private exclusiveStopGuard: boolean = false;

  constructor() {
    // Load initial voice using current pet preference or pet default
    this.selectedVoice = this.loadSelectedVoice();
    // Load selected speed from localStorage or default to 0.8
    this.selectedSpeed = this.loadSelectedSpeed();
    this.initialize();
  }

  // Prevent external stop() calls from interrupting critical playback
  setExclusiveStopGuard(enabled: boolean): void {
    this.exclusiveStopGuard = enabled;
  }

  // Allow callers to suppress non-Krafty speech (used during tutorial overlays)
  setSuppressNonKrafty(suppress: boolean): void {
    const wasSuppressed = this.suppressNonKrafty;
    this.suppressNonKrafty = suppress;
    if (wasSuppressed && !suppress && this.lastSuppressedMessage) {
      // Replay the most recently suppressed non-Krafty message after suppression lifts
      // Use a microtask to avoid racing with overlay teardown state updates
      Promise.resolve().then(() => {
        // Double-check still unsuppressed before replaying
        if (!this.suppressNonKrafty && this.lastSuppressedMessage) {
          this.replayLastSuppressed().catch(() => {});
        }
      });
    }
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
      const defaultVoiceId = currentPetId ? PET_DEFAULT_VOICE_ID[currentPetId] : undefined;
      const candidateId = defaultVoiceId || JESSICA_VOICE_ID;
      const petDefault = AVAILABLE_VOICES.find(v => v.id === candidateId);
      if (petDefault) return petDefault;
    } catch {}

    // Fallback to Jessica (or first voice if unavailable)
    return JESSICA_VOICE || AVAILABLE_VOICES[0];
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
        const defaultVoiceId = PET_DEFAULT_VOICE_ID[currentPetId];
        const candidateId = defaultVoiceId || JESSICA_VOICE_ID;
        const petDefault = AVAILABLE_VOICES.find(v => v.id === candidateId);
        if (petDefault) return petDefault;
        if (JESSICA_VOICE) return JESSICA_VOICE;
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
      const clientOptions: { apiKey: string; baseUrl?: string } = {
        apiKey: apiKey,
      };
      
      // Allow custom base URL (e.g., for EU data residency: https://api.eu.residency.elevenlabs.io)
      const customBaseUrl = "https://api.readkraft.com/api/elevenlabs/" //import.meta.env.VITE_ELEVENLABS_BASE_URL;
      if (customBaseUrl) {
        clientOptions.baseUrl = customBaseUrl;
      }
      
      this.client = new ElevenLabsClient(clientOptions);
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
                resolvedVoiceId = PET_DEFAULT_VOICE_ID[currentPetId];
              }
            }
          } catch {}

          if (!resolvedVoiceId) {
            resolvedVoiceId = this.selectedVoice.id;
          }
        }
      }

      // Ensure resolved voice exists, else fallback to Jessica
      if (!AVAILABLE_VOICES.some(v => v.id === resolvedVoiceId)) {
        resolvedVoiceId = JESSICA_VOICE_ID;
      }
      let voiceId = resolvedVoiceId as string;

      // Generate audio using selected voice
      let audioStream;
      try {
        audioStream = await this.client.textToSpeech.convert(
          voiceId,
          {
            text: cleanText,
            modelId: options?.model || 'eleven_flash_v2_5',
            voiceSettings: {
              stability: options?.stability || 0.5,
              similarityBoost: options?.similarity_boost || 0.75,
              speed: options?.speed || this.selectedSpeed,
            },
          }
        );
      } catch (e) {
        // Retry once with Jessica as a final fallback
        if (voiceId !== JESSICA_VOICE_ID) {
          voiceId = JESSICA_VOICE_ID;
          audioStream = await this.client.textToSpeech.convert(
            voiceId,
            {
              text: cleanText,
              modelId: options?.model || 'eleven_flash_v2_5',
              voiceSettings: {
                stability: options?.stability || 0.5,
                similarityBoost: options?.similarity_boost || 0.75,
                speed: options?.speed || this.selectedSpeed,
              },
            }
          );
        } else {
          throw e;
        }
      }

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

        // Start playing the audio with a single automatic retry on failure
        let retryAttempted = false;
        const tryPlay = () => {
          if (!this.currentAudio) {
            reject(new Error('Audio not initialized'));
            return;
          }
          this.currentAudio.play().then(() => {
            // Playback started successfully
          }).catch((error) => {
            if (!retryAttempted && this.activeSpeakRequestSeq === requestSeq) {
              retryAttempted = true;
              // Small delay before retrying; helps when a prior sound just stopped
              setTimeout(() => {
                if (this.currentAudio && this.activeSpeakRequestSeq === requestSeq) {
                  tryPlay();
                } else {
                  this.isSpeaking = false;
                  this.currentSpeakingMessageId = null;
                  this.notifySpeakingStateChange(null);
                  URL.revokeObjectURL(audioUrl);
                  reject(error);
                }
              }, 120);
            } else {
              this.isSpeaking = false;
              this.currentSpeakingMessageId = null;
              this.notifySpeakingStateChange(null);
              URL.revokeObjectURL(audioUrl);
              reject(error);
            }
          });
        };
        tryPlay();
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
  stop(force: boolean = false): void {
    if (this.exclusiveStopGuard && !force) {
      // Ignore non-forced stops while in exclusive mode
      return;
    }
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

  /**
   * Speak text but pause (silence) in place of the target word.
   * Implementation: speak the text before the word, wait pauseMs, then speak the rest.
   * If the word is not found (case-insensitive, word boundary), falls back to a single speak().
   */
  async speakWithPauseAtWord(
    fullText: string,
    targetWord: string,
    options?: TTSOptions & { pauseMs?: number; speakAfter?: boolean }
  ): Promise<void> {
    const DEBUG_TTS_MASK = true;
    const dbg = (...args: any[]) => { if (DEBUG_TTS_MASK) { try { console.log('[TTS][Mask]', ...args); } catch {} } };
    const text = this.cleanTextForSpeech(fullText || '');
    const word = (targetWord || '').trim();
    const { pauseMs: pauseOverride, speakAfter = false, ...ttsOptions } = options || {};
    dbg('inputs', { text, word, speakAfter });
    if (!text || !word) {
      dbg('fallback: empty text/word -> speak() whole');
      await this.speak(text, ttsOptions);
      return;
    }
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Word-boundary match; case-insensitive
    const re = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i');
    let start = -1;
    let end = -1;
    const m = text.match(re);
    if (m && m.index !== undefined) {
      start = m.index;
      end = start + m[0].length;
      dbg('match via regex', { match: m[0], start, end });
    } else {
      // Robust fallback: token-based search ignoring punctuation variants
      const normalize = (s: string) =>
        s
          .toLowerCase()
          .replace(/[_*~`()[\]{}"“”'’.,!?;:—–-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      const tokens = normalize(text).split(' ');
      const tw = normalize(word);
      const idx = tokens.indexOf(tw);
      dbg('token search', { tokensLen: tokens.length, target: tw, idx });
      if (idx >= 0) {
        // Reconstruct offsets by walking original cleaned text words
        let seen = -1;
        let cursor = 0;
        const words = text.split(/\s+/);
        for (let i = 0; i < words.length; i++) {
          if (normalize(words[i]).length === 0) {
            cursor += (words[i] + ' ').length;
            continue;
          }
          seen++;
          if (seen === idx) {
            start = text.indexOf(words[i], cursor);
            end = start + words[i].length;
            break;
          }
          cursor = text.indexOf(words[i], cursor) + words[i].length + 1;
        }
        dbg('reconstructed offsets', { start, end });
      }
    }
    if (start < 0 || end < 0) {
      // As a last resort, remove the word and speak the remainder (no pause) to avoid leaking the answer.
      const removed = text.replace(re, '').replace(/\s{2,}/g, ' ').trim();
      dbg('fallback: could not locate offsets; speaking with word removed', { removed });
      await this.speak(removed, ttsOptions);
      return;
    }
    const before = text.slice(0, start).trim();
    const after = text.slice(end).trim();
    const pauseMs = Math.max(150, Math.min(1500, pauseOverride ?? 450));
    dbg('segments', { before, pauseMs, after, speakAfter });
    // Speak before (if any)
    if (before) {
      await this.speak(before, ttsOptions);
    }
    // Silent pause
    await new Promise<void>(resolve => setTimeout(resolve, pauseMs));
    // Speak after (if any)
    if (speakAfter && after) {
      await this.speak(after, ttsOptions);
    }
  }
}

// Export a singleton instance
export const ttsService = new TextToSpeechService();
export default TextToSpeechService;
