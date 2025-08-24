import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

interface TTSOptions {
  voice?: string;
  model?: string;
  stability?: number;
  similarity_boost?: number;
}

class TextToSpeechService {
  private client: ElevenLabsClient | null = null;
  private isInitialized = false;
  private currentAudio: HTMLAudioElement | null = null;
  private isSpeaking = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    // Check if ElevenLabs API key is available
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    
    if (apiKey) {
      this.client = new ElevenLabsClient({
        apiKey: apiKey,
      });
      this.isInitialized = true;
    } else {
      console.warn('VITE_ELEVENLABS_API_KEY not found. TTS service will not be available.');
      this.isInitialized = false;
    }
  }

  // Speak text using ElevenLabs API
  async speak(text: string, options?: TTSOptions): Promise<void> {
    // Clean the text for better speech
    const cleanText = this.cleanTextForSpeech(text);
    
    // If not initialized or no API key, skip TTS
    if (!this.isInitialized || !this.client) {
      console.warn('ElevenLabs TTS not configured. Cannot speak text.');
      return;
    }

    try {
      // Stop any current audio
      this.stop();

      // Default voice settings for children's content
      const voiceId = options?.voice || 'EXAVITQu4vr4xnSDxMaL'; // Bella - good for educational content

      // Generate audio using ElevenLabs API (corrected method call)
      const audioStream = await this.client.textToSpeech.convert(
        voiceId,  // First parameter: voice ID as string
        {         // Second parameter: options object
          text: cleanText,
          modelId: options?.model || 'eleven_monolingual_v1',
          voiceSettings: {
            stability: options?.stability || 0.5,
            similarityBoost: options?.similarity_boost || 0.75,
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

      this.currentAudio.onended = () => {
        this.isSpeaking = false;
        URL.revokeObjectURL(audioUrl);
      };

      this.currentAudio.onerror = () => {
        this.isSpeaking = false;
        URL.revokeObjectURL(audioUrl);
        console.error('Error playing ElevenLabs TTS audio');
      };

      await this.currentAudio.play();
    } catch (error) {
      console.error('ElevenLabs TTS error:', error);
      this.isSpeaking = false;
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

  // Stop current speech
  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    
    this.isSpeaking = false;
  }

  // Check if currently speaking
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  // Check if TTS service is properly configured
  isConfigured(): boolean {
    return this.isInitialized;
  }

  // Get configuration status
  getStatus(): { configured: boolean; message: string } {
    if (this.isInitialized) {
      return { configured: true, message: 'ElevenLabs TTS is ready!' };
    } else {
      return { 
        configured: false, 
        message: 'ElevenLabs API key required for TTS functionality.' 
      };
    }
  }

  // Speak question automatically with appropriate voice settings for educational content
  async speakQuestion(questionText: string): Promise<void> {
    await this.speak(questionText, {
      stability: 0.6,
      similarity_boost: 0.8,
    });
  }

  // Speak AI messages with friendly, encouraging tone
  async speakAIMessage(message: string): Promise<void> {
    await this.speak(message, {
      stability: 0.7,
      similarity_boost: 0.9,
    });
  }

  // Speak answer text (for the speaker button beside image)
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
