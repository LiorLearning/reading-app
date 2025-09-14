import { elevenLabsVoiceAgentService } from './elevenlabs-voice-agent-service';

interface VoiceAgentOptions {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  speed?: number; // 0.25 to 4.0
  messageId?: string;
}

interface ConversationThread {
  questionId: string;
  correctAnswer: string;
  attempts: number;
  context: string;
}

interface ConversationMethods {
  startConversation: () => Promise<boolean>;
  stopConversation: () => Promise<void>;
  sendTextMessage: (message: string) => Promise<boolean>;
  getConnectionStatus: () => string;
}

class VoiceAgentService {
  private isInitialized = false;
  private conversationMethods: ConversationMethods | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    this.isInitialized = true;
    console.log('✅ VoiceAgentService initialized with ElevenLabs');
  }

  /**
   * Initialize conversation with ElevenLabs
   */
  async initializeConversation(conversationHook: any): Promise<void> {
    return elevenLabsVoiceAgentService.initializeConversation(conversationHook);
  }

  /**
   * Set the conversation hook from React component
   */
  setConversation(conversation: any): void {
    elevenLabsVoiceAgentService.setConversation(conversation);
  }

  /**
   * Set conversation methods from React component
   */
  setConversationMethods(methods: ConversationMethods): void {
    this.conversationMethods = methods;
    console.log('✅ VoiceAgentService: Conversation methods set');
  }

  /**
   * Check if conversation is initialized
   */
  isConversationInitialized(): boolean {
    return elevenLabsVoiceAgentService.isConversationInitialized();
  }

  /**
   * Stop current speech
   */
  stop(): void {
    return elevenLabsVoiceAgentService.stop();
  }

  /**
   * Speak text using ElevenLabs
   */
  async speak(text: string, options?: VoiceAgentOptions): Promise<void> {
    // Try using the new conversation methods first
    if (this.conversationMethods) {
      const success = await this.conversationMethods.sendTextMessage(text);
      if (success) {
        console.log('✅ VoiceAgentService: Message sent via conversation methods');
        return;
      }
    }
    
    // Fallback to the old method
    return elevenLabsVoiceAgentService.speak(text, options);
  }

  /**
   * Handle incorrect answer and provide voice feedback
   */
  async handleIncorrectAnswer(
    questionId: string, 
    correctAnswer: string, 
    userAnswer: string, 
    questionContext: string = ''
  ): Promise<void> {
    console.log('🎯 VoiceAgentService.handleIncorrectAnswer() called');
    console.log('🎯 Parameters:', { questionId, correctAnswer, userAnswer, questionContext });
    
    try {
      const result = await elevenLabsVoiceAgentService.handleIncorrectAnswer(questionId, correctAnswer, userAnswer, questionContext);
      console.log('✅ VoiceAgentService.handleIncorrectAnswer() completed successfully');
      return result;
    } catch (error) {
      console.error('❌ VoiceAgentService.handleIncorrectAnswer() failed:', error);
      throw error;
    }
  }

  /**
   * Check if currently speaking
   */
  isCurrentlySpeaking(): boolean {
    return elevenLabsVoiceAgentService.isCurrentlySpeaking();
  }

  /**
   * Get current speaking message ID
   */
  getCurrentSpeakingMessageId(): string | null {
    return elevenLabsVoiceAgentService.getCurrentSpeakingMessageId();
  }

  /**
   * Clear conversation thread for a question
   */
  clearThread(questionId: string): void {
    return elevenLabsVoiceAgentService.clearThread(questionId);
  }

  /**
   * Clear all conversation threads
   */
  clearAllThreads(): void {
    return elevenLabsVoiceAgentService.clearAllThreads();
  }

  /**
   * Replay the last spoken text
   */
  async replayLastSpoken(): Promise<void> {
    return elevenLabsVoiceAgentService.replayLastSpoken();
  }

  /**
   * Get the last spoken text
   */
  getLastSpokenText(): string {
    return elevenLabsVoiceAgentService.getLastSpokenText();
  }

  /**
   * Check if there's text available for replay
   */
  hasLastSpokenText(): boolean {
    return elevenLabsVoiceAgentService.hasLastSpokenText();
  }

  /**
   * Check microphone permission status
   */
  async checkMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt' | 'unavailable'> {
    return elevenLabsVoiceAgentService.checkMicrophonePermission();
  }

  /**
   * Get user-friendly message about voice feedback status
   */
  async getVoiceFeedbackStatus(): Promise<string> {
    return elevenLabsVoiceAgentService.getVoiceFeedbackStatus();
  }

  /**
   * Check if conversation hook is ready (but session may not be started yet)
   */
  isConversationHookReady(): boolean {
    return elevenLabsVoiceAgentService.isConversationHookReady();
  }

  /**
   * Start conversation session
   */
  async startConversation(): Promise<boolean> {
    if (this.conversationMethods) {
      return this.conversationMethods.startConversation();
    }
    console.warn('VoiceAgentService: Conversation methods not available');
    return false;
  }

  /**
   * Stop conversation session
   */
  async stopConversation(): Promise<void> {
    if (this.conversationMethods) {
      return this.conversationMethods.stopConversation();
    }
    console.warn('VoiceAgentService: Conversation methods not available');
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): string {
    if (this.conversationMethods) {
      return this.conversationMethods.getConnectionStatus();
    }
    return 'unavailable';
  }

  /**
   * Send text message directly
   */
  async sendTextMessage(message: string): Promise<boolean> {
    console.log('📤 VoiceAgentService.sendTextMessage() called with message:', message);
    
    if (this.conversationMethods) {
      try {
        const result = await this.conversationMethods.sendTextMessage(message);
        console.log('✅ VoiceAgentService.sendTextMessage() result:', result);
        return result;
      } catch (error) {
        console.error('❌ VoiceAgentService.sendTextMessage() failed:', error);
        return false;
      }
    }
    console.warn('⚠️ VoiceAgentService: Conversation methods not available');
    return false;
  }
}

// Export singleton instance
export const voiceAgentService = new VoiceAgentService();

// Add global access for debugging (only in development)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).voiceAgentService = voiceAgentService;
  console.log('🔧 Voice Agent Service available globally as window.voiceAgentService for debugging');
  console.log('🔧 Available methods: getConnectionStatus(), startConversation(), stopConversation(), sendTextMessage(text), getVoiceFeedbackStatus()');
}

export default VoiceAgentService;
