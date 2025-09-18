import { useConversation } from '@elevenlabs/react';

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

class ElevenLabsVoiceAgentService {
  private conversation: any = null;
  private isInitialized = false;
  private conversationThreads: Map<string, ConversationThread> = new Map();
  private currentSpeakingMessageId: string | null = null;
  private lastSpokenText: string = '';
  private lastSpokenOptions: VoiceAgentOptions | null = null;
  private agentId: string | null = null;
  private conversationId: string | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID;
    
    if (agentId) {
      this.agentId = agentId;
      this.isInitialized = true;
      console.log('✅ ElevenLabsVoiceAgentService initialized');
    } else {
      console.warn('⚠️ VITE_ELEVENLABS_AGENT_ID not found. Voice agent will not work.');
      this.isInitialized = false;
    }
  }

  /**
   * Initialize conversation with ElevenLabs (without requesting microphone yet)
   */
  async initializeConversation(conversationHook: any): Promise<void> {
    if (!this.isInitialized || !this.agentId) {
      console.warn('ElevenLabs voice agent not configured. Cannot initialize conversation.');
      return;
    }

    try {
      // Store the conversation hook but don't start session yet
      this.conversation = conversationHook;
      console.log('✅ ElevenLabs conversation hook stored, ready for lazy initialization');
    } catch (error) {
      console.error('❌ Error storing ElevenLabs conversation hook:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Lazy initialization - only start session when actually needed
   */
  private async ensureSessionStarted(): Promise<boolean> {
    if (this.conversationId) {
      return true; // Already started
    }

    if (!this.conversation || !this.agentId) {
      console.warn('ElevenLabs conversation not ready for session start');
      return false;
    }

    try {
      console.log('🎤 Starting ElevenLabs voice output session (no microphone needed)...');
      
      // Start conversation session for voice output only (no microphone required)
      this.conversationId = await this.conversation.startSession({
        agentId: this.agentId,
        connectionType: 'websocket', // Using websocket for voice output
        userId: 'reading-app-user'
      });
      
      console.log('✅ ElevenLabs voice output session started with ID:', this.conversationId);
      return true;
    } catch (error) {
      console.error('❌ Error starting ElevenLabs voice session:', error);
      return false;
    }
  }

  /**
   * Create or get conversation thread for a question
   */
  private getOrCreateThread(questionId: string, correctAnswer: string, questionContext: string): ConversationThread {
    if (!this.conversationThreads.has(questionId)) {
      this.conversationThreads.set(questionId, {
        questionId,
        correctAnswer,
        attempts: 0,
        context: questionContext
      });
    }
    
    const thread = this.conversationThreads.get(questionId)!;
    thread.attempts += 1;
    return thread;
  }

  /**
   * Generate teaching response for incorrect answer
   */
  private generateTeachingResponse(thread: ConversationThread, userAnswer: string): string {
    const syllables = this.breakIntoSyllables(thread.correctAnswer);
    // return thread.correctAnswer
    return `correct word:${thread.correctAnswer} incorrect attempt:${userAnswer.toLowerCase}`;
  }

  /**
   * Simple syllable breakdown for common words
   */
  private breakIntoSyllables(word: string): string[] {
    const vowels = 'aeiouAEIOU';
    const syllables: string[] = [];
    let currentSyllable = '';
    
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      currentSyllable += char;
      
      // Simple heuristic: if we have a vowel and the next char is a consonant, it might be a syllable break
      if (vowels.includes(char) && i < word.length - 1 && !vowels.includes(word[i + 1])) {
        syllables.push(currentSyllable);
        currentSyllable = '';
      }
    }
    
    if (currentSyllable) {
      syllables.push(currentSyllable);
    }
    
    return syllables.length > 1 ? syllables : [word];
  }

  /**
   * Stop current speech
   */
  stop(): void {
    // ElevenLabs handles stopping internally
    this.currentSpeakingMessageId = null;
  }

  /**
   * Speak text using ElevenLabs conversation
   */
  async speak(text: string, options?: VoiceAgentOptions): Promise<void> {
    if (!this.isInitialized) {
      console.warn('ElevenLabs voice agent not configured. Cannot speak text.');
      return;
    }

    // Try to ensure session is started (lazy initialization)
    const sessionReady = await this.ensureSessionStarted();
    if (!sessionReady) {
      console.warn('ElevenLabs session could not be started. Voice feedback disabled.');
      return;
    }

    console.log('🎤 ElevenLabs Voice Agent: Starting to speak:', text);
    
    // Store for replay functionality
    this.lastSpokenText = text;
    this.lastSpokenOptions = options || null;
    this.currentSpeakingMessageId = options?.messageId || null;

    try {
      // Send message to ElevenLabs conversation
      await this.conversation.sendUserMessage(text);
      console.log('🎤 ElevenLabs Voice Agent: Message sent to conversation');
    } catch (error) {
      console.error('❌ ElevenLabs Voice Agent: Error sending message:', error);
    }
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
    console.log('🔊 ElevenLabsVoiceAgentService.handleIncorrectAnswer() called');
    console.log('🔊 Parameters:', { questionId, correctAnswer, userAnswer, questionContext });
    console.log(`🎓 ElevenLabs Voice Agent: Handling incorrect answer for question ${questionId}`);
    console.log(`📝 Correct: "${correctAnswer}", User answered: "${userAnswer}"`);
    console.log(`📝 Question Context: "${questionContext}"`);

    // Get or create conversation thread
    const thread = this.getOrCreateThread(questionId, correctAnswer, questionContext);
    
    // Generate teaching response
    const teachingResponse = this.generateTeachingResponse(thread, userAnswer);
    console.log(`🎓 ElevenLabs Voice Agent: Generated teaching response: "${teachingResponse}"`);
    
    // Speak the response
    const messageId = `voice-agent-${questionId}-${thread.attempts}`;
    console.log(`🎓 ElevenLabs Voice Agent: Speaking with messageId: ${messageId}`);
    await this.speak(teachingResponse, {
      voice: 'nova',
      speed: 0.7, // Slower for teaching
      messageId
    });
    
    console.log('✅ ElevenLabsVoiceAgentService.handleIncorrectAnswer() completed successfully');
  }

  /**
   * Check if currently speaking
   */
  isCurrentlySpeaking(): boolean {
    // ElevenLabs handles this internally, we can't directly check
    return this.currentSpeakingMessageId !== null;
  }

  /**
   * Get current speaking message ID
   */
  getCurrentSpeakingMessageId(): string | null {
    return this.currentSpeakingMessageId;
  }

  /**
   * Clear conversation thread for a question
   */
  clearThread(questionId: string): void {
    this.conversationThreads.delete(questionId);
  }

  /**
   * Clear all conversation threads
   */
  clearAllThreads(): void {
    this.conversationThreads.clear();
  }

  /**
   * Replay the last spoken text
   */
  async replayLastSpoken(): Promise<void> {
    if (this.lastSpokenText) {
      console.log('🎤 ElevenLabs Voice Agent: Replaying last spoken text:', this.lastSpokenText);
      await this.speak(this.lastSpokenText, this.lastSpokenOptions || undefined);
    } else {
      console.warn('ElevenLabs Voice Agent: No previous text to replay');
    }
  }

  /**
   * Get the last spoken text
   */
  getLastSpokenText(): string {
    return this.lastSpokenText;
  }

  /**
   * Check if there's text available for replay
   */
  hasLastSpokenText(): boolean {
    return this.lastSpokenText.length > 0;
  }

  /**
   * Set the conversation hook from React component
   */
  setConversation(conversation: any): void {
    this.conversation = conversation;
  }

  /**
   * Check if conversation is initialized
   */
  isConversationInitialized(): boolean {
    return this.conversation !== null && this.conversationId !== null;
  }

  /**
   * Check if conversation hook is ready (but session may not be started yet)
   */
  isConversationHookReady(): boolean {
    return this.conversation !== null;
  }

  /**
   * Check microphone permission status
   */
  async checkMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt' | 'unavailable'> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return 'unavailable';
      }

      // Check permission status if available
      if (navigator.permissions && navigator.permissions.query) {
        const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        return permission.state as 'granted' | 'denied' | 'prompt';
      }

      // Fallback: try to access microphone briefly
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Clean up immediately
        return 'granted';
      } catch (error) {
        if (error.name === 'NotAllowedError') {
          return 'denied';
        }
        return 'prompt';
      }
    } catch (error) {
      console.error('Error checking microphone permission:', error);
      return 'unavailable';
    }
  }

  /**
   * Get user-friendly message about voice feedback status
   */
  async getVoiceFeedbackStatus(): Promise<string> {
    if (!this.isInitialized || !this.agentId) {
      return 'Voice output is not configured. Missing ElevenLabs Agent ID.';
    }

    if (!this.conversation) {
      return 'Voice output is initializing...';
    }

    if (this.conversationId) {
      return 'Voice output is active and ready (output-only mode).';
    }

    return 'Voice output is ready to start when needed (no microphone required).';
  }
}

// Export singleton instance
export const elevenLabsVoiceAgentService = new ElevenLabsVoiceAgentService();
export default ElevenLabsVoiceAgentService;
