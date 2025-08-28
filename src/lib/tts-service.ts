import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

interface TTSOptions {
  voice?: string;
  model?: string;
  stability?: number;
  similarity_boost?: number;
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
  }
];

const SELECTED_VOICE_KEY = 'reading_app_selected_voice';

class TextToSpeechService {
  private client: ElevenLabsClient | null = null;
  private isInitialized = false;
  private currentAudio: HTMLAudioElement | null = null;
  private isSpeaking = false;
  private selectedVoice: Voice;
  private currentRequest: AbortController | null = null;
  private pendingRequests: Set<AbortController> = new Set();
  private lastSpeakTime = 0;
  private readonly DEBOUNCE_DELAY = 100; // 100ms debounce to prevent rapid-fire calls

  constructor() {
    // Load selected voice from localStorage or default to Jessica
    this.selectedVoice = this.loadSelectedVoice();
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

  private saveSelectedVoice(voice: Voice): void {
    try {
      localStorage.setItem(SELECTED_VOICE_KEY, JSON.stringify(voice.id));
    } catch (error) {
      console.warn('Failed to save selected voice to localStorage:', error);
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

  // Preview a voice by having it introduce itself
  async previewVoice(voice: Voice): Promise<void> {
    try {
      await this.speak(voice.previewText, { voice: voice.id });
    } catch (error) {
      console.error('Error previewing voice:', error);
      // Don't re-throw to prevent UI errors during voice preview
    }
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

  // Speak text using selected voice
  async speak(text: string, options?: TTSOptions): Promise<void> {
    // Clean the text for better speech
    const cleanText = this.cleanTextForSpeech(text);
    
    // If not initialized or no API key, skip TTS
    if (!this.isInitialized || !this.client) {
      console.warn('TTS not configured. Cannot speak text.');
      return;
    }

    // Debounce rapid calls to prevent multiple simultaneous requests
    const now = Date.now();
    if (now - this.lastSpeakTime < this.DEBOUNCE_DELAY) {
      console.log('TTS call debounced - too rapid');
      return;
    }
    this.lastSpeakTime = now;

    // Cancel all previous requests and audio
    this.cancelAllRequests();
    this.stopCurrentAudio();

    // Create new abort controller for this request
    const abortController = new AbortController();
    this.currentRequest = abortController;
    this.pendingRequests.add(abortController);

    try {
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
          },
        }
      );

      // Check if request was cancelled during API call
      if (abortController.signal.aborted) {
        console.log('TTS request was cancelled during API call');
        return;
      }

      // Convert the stream to audio blob
      const chunks: Uint8Array[] = [];
      const reader = audioStream.getReader();
      
      try {
        while (true) {
          // Check for cancellation during stream reading
          if (abortController.signal.aborted) {
            console.log('TTS request was cancelled during stream reading');
            await reader.cancel();
            return;
          }

          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      } catch (readerError) {
        // Handle reader cancellation gracefully
        if (abortController.signal.aborted) {
          console.log('TTS stream reading was cancelled');
          return;
        }
        throw readerError;
      }

      // Final check before playing
      if (abortController.signal.aborted) {
        console.log('TTS request was cancelled before audio creation');
        return;
      }

      // Create audio blob and play
      const audioBlob = new Blob(chunks, { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      this.currentAudio = new Audio(audioUrl);
      this.isSpeaking = true;

      // Return a Promise that resolves when audio finishes playing
      return new Promise<void>((resolve, reject) => {
        if (!this.currentAudio) {
          URL.revokeObjectURL(audioUrl);
          reject(new Error('Audio not initialized'));
          return;
        }

        // Handle cancellation during playback
        const handleAbort = () => {
          if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
          }
          this.isSpeaking = false;
          URL.revokeObjectURL(audioUrl);
          this.pendingRequests.delete(abortController);
          if (this.currentRequest === abortController) {
            this.currentRequest = null;
          }
          resolve(); // Resolve rather than reject for cancellation
        };

        // Check if already aborted
        if (abortController.signal.aborted) {
          handleAbort();
          return;
        }

        // Listen for abort signal
        abortController.signal.addEventListener('abort', handleAbort);

        this.currentAudio.onended = () => {
          this.isSpeaking = false;
          URL.revokeObjectURL(audioUrl);
          this.pendingRequests.delete(abortController);
          if (this.currentRequest === abortController) {
            this.currentRequest = null;
          }
          resolve();
        };

        this.currentAudio.onerror = () => {
          this.isSpeaking = false;
          URL.revokeObjectURL(audioUrl);
          this.pendingRequests.delete(abortController);
          if (this.currentRequest === abortController) {
            this.currentRequest = null;
          }
          console.error('Error playing TTS audio');
          reject(new Error('Audio playback failed'));
        };

        // Start playing the audio
        this.currentAudio.play().catch((error) => {
          this.isSpeaking = false;
          URL.revokeObjectURL(audioUrl);
          this.pendingRequests.delete(abortController);
          if (this.currentRequest === abortController) {
            this.currentRequest = null;
          }
          reject(error);
        });
      });
    } catch (error) {
      console.error('TTS error:', error);
      this.isSpeaking = false;
      this.pendingRequests.delete(abortController);
      if (this.currentRequest === abortController) {
        this.currentRequest = null;
      }
      
      // Don't throw error if it was just a cancellation
      if (abortController.signal.aborted) {
        console.log('TTS request was cancelled');
        return;
      }
      
      throw error;
    }
  }

  // Clean text for better speech synthesis
  private cleanTextForSpeech(text: string): string {
    return text
      // Remove emojis
      .replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
      // Remove markdown formatting
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      // Remove extra spaces
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Helper method to cancel all pending requests
  private cancelAllRequests(): void {
    // Cancel current request
    if (this.currentRequest) {
      this.currentRequest.abort();
      this.currentRequest = null;
    }
    
    // Cancel all pending requests
    for (const controller of this.pendingRequests) {
      controller.abort();
    }
    this.pendingRequests.clear();
  }

  // Helper method to stop current audio without cancelling requests
  private stopCurrentAudio(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.isSpeaking = false;
  }

  // Stop current speech and cancel all requests
  stop(): void {
    this.cancelAllRequests();
    this.stopCurrentAudio();
  }

  // Check if currently speaking
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  // Check if there are pending requests (useful for debugging)
  hasPendingRequests(): boolean {
    return this.pendingRequests.size > 0;
  }

  // Get number of pending requests (useful for debugging)
  getPendingRequestCount(): number {
    return this.pendingRequests.size;
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
  async speakAIMessage(message: string): Promise<void> {
    await this.speak(message, {
      stability: 0.7,
      similarity_boost: 0.9,
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
