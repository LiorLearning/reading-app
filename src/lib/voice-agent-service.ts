import OpenAI from 'openai';

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

class VoiceAgentService {
  private client: OpenAI | null = null;
  private isInitialized = false;
  private currentAudio: HTMLAudioElement | null = null;
  private isSpeaking = false;
  private conversationThreads: Map<string, ConversationThread> = new Map();
  private currentSpeakingMessageId: string | null = null;
  private lastSpokenText: string = '';
  private lastSpokenOptions: VoiceAgentOptions | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    if (apiKey) {
      this.client = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      });
      this.isInitialized = true;
      console.log('✅ VoiceAgentService initialized with OpenAI TTS');
    } else {
      console.warn('⚠️ VITE_OPENAI_API_KEY not found. Voice agent will not work.');
      this.isInitialized = false;
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
  private async generateTeachingResponse(thread: ConversationThread, userAnswer: string): Promise<string> {
    if (!this.isInitialized || !this.client) {
      return this.getFallbackResponse(thread.correctAnswer);
    }

    const systemPrompt = `You are a grade 1 English teacher. When a student spells a word incorrectly, simply:

1. Pronounce the correct word clearly
2. Break it into ARPABET/CMU
3. Say the word again

Keep it very simple and short. Be polite and very friendly. No examples, no long explanations.`;

    try {
      const userMessage = `Student spelled "${userAnswer}" but correct answer is "${thread.correctAnswer}".`;
      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 150,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content?.trim();
      console.log('🎓 Voice   :', response);
      return response || this.getFallbackResponse(thread.correctAnswer);
    } catch (error) {
      console.error('Error generating teaching response:', error);
      return this.getFallbackResponse(thread.correctAnswer);
    }
  }

  /**
   * Fallback response when AI is not available
   */
  private getFallbackResponse(correctAnswer: string): string {
    const syllables = this.breakIntoSyllables(correctAnswer);
    return `The correct word is "${correctAnswer}". ${syllables.join('-')}. ${correctAnswer}.`;
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
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.isSpeaking = false;
    this.currentSpeakingMessageId = null;
  }

  /**
   * Speak text using OpenAI Realtime API
   */
  async speak(text: string, options?: VoiceAgentOptions): Promise<void> {
    if (!this.isInitialized || !this.client) {
      console.warn('Voice agent not configured. Cannot speak text.');
      return;
    }

    console.log('🎤 Voice Agent: Starting to speak:', text);
    console.log('🎤 Voice Agent: Text length:', text.length, 'characters');

    // Stop any current speech
    this.stop();
    
    // Add a small delay to ensure previous audio is fully stopped
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      this.isSpeaking = true;
      this.currentSpeakingMessageId = options?.messageId || null;
      
      // Store for replay functionality
      this.lastSpokenText = text;
      this.lastSpokenOptions = options || null;

      console.log('🎤 Voice Agent: Calling OpenAI Realtime API...');
      console.log('🎤 Voice Agent: Realtime Input text:', JSON.stringify(text));
      
      // Create realtime session
      const sessionResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1'
        },
        body: JSON.stringify({
          prompt: {
            id: "pmpt_68c5d5d5d96c8195b05accb47d91009a02b1f492695756dd",
            version: "1"
          }
        })
      });

      if (!sessionResponse.ok) {
        throw new Error(`Realtime API error: ${sessionResponse.status} ${sessionResponse.statusText}`);
      }

      const sessionData = await sessionResponse.json();
      console.log('🎤 Voice Agent: Realtime session created:', sessionData);

      // Connect to WebSocket
      const wsUrl = sessionData.websocket_url;
      console.log('🎤 Voice Agent: Connecting to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('🎤 Voice Agent: WebSocket connected');
        
        // Send the text to be spoken
        const message = {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: text
              }
            ]
          }
        };
        
        ws.send(JSON.stringify(message));
        console.log('🎤 Voice Agent: Sent text to realtime API:', text);
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('🎤 Voice Agent: Received WebSocket message:', data);
        
        if (data.type === "conversation.item.input_audio_buffer.committed") {
          // Audio is ready to play
          const audioBuffer = data.audio_buffer;
          if (audioBuffer) {
            this.playAudioFromBuffer(audioBuffer);
          }
        }
      };
      
      ws.onerror = (error) => {
        console.error('❌ Voice Agent: WebSocket error:', error);
        this.isSpeaking = false;
        this.currentSpeakingMessageId = null;
        this.fallbackToBrowserTTS(text);
      };
      
      ws.onclose = () => {
        console.log('🎤 Voice Agent: WebSocket closed');
        this.isSpeaking = false;
        this.currentSpeakingMessageId = null;
      };
      
    } catch (error) {
      console.error('❌ Voice Agent: Error with realtime API:', error);
      this.isSpeaking = false;
      this.currentSpeakingMessageId = null;
      
      // Fallback to browser TTS if realtime API fails
      console.log('🎤 Voice Agent: Falling back to browser TTS...');
      this.fallbackToBrowserTTS(text);
    }
  }

  /**
   * Play audio from buffer
   */
  private playAudioFromBuffer(audioBuffer: ArrayBuffer): void {
    try {
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.volume = 1.0;
      
      this.currentAudio.onended = () => {
        console.log('🎤 Voice Agent: Audio playback ended');
        this.isSpeaking = false;
        this.currentSpeakingMessageId = null;
        URL.revokeObjectURL(audioUrl);
      };

      this.currentAudio.onerror = (error) => {
        console.error('❌ Voice Agent: Error playing audio:', error);
        this.isSpeaking = false;
        this.currentSpeakingMessageId = null;
        URL.revokeObjectURL(audioUrl);
      };

      this.currentAudio.play();
      console.log('🎤 Voice Agent: Playing audio from realtime API');
    } catch (error) {
      console.error('❌ Voice Agent: Error playing audio from buffer:', error);
      this.isSpeaking = false;
      this.currentSpeakingMessageId = null;
    }
  }

  /**
   * Fallback to browser TTS if OpenAI fails
   */
  private fallbackToBrowserTTS(text: string): void {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.7; // Slower for teaching (cheerful guide)
      utterance.pitch = 1.1; // Slightly higher pitch (friendly tone)
      utterance.volume = 1.0; // Clear and steady
      
      utterance.onend = () => {
        this.isSpeaking = false;
        this.currentSpeakingMessageId = null;
      };
      
      utterance.onerror = (error) => {
        console.error('❌ Voice Agent: Browser TTS error:', error);
        this.isSpeaking = false;
        this.currentSpeakingMessageId = null;
      };
      
      window.speechSynthesis.speak(utterance);
      this.isSpeaking = true;
      console.log('🎤 Voice Agent: Using browser TTS fallback with cheerful guide settings');
    } catch (error) {
      console.error('❌ Voice Agent: Browser TTS fallback failed:', error);
      this.isSpeaking = false;
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
    console.log(`🎓 Voice Agent: Handling incorrect answer for question ${questionId}`);
    console.log(`📝 Correct: "${correctAnswer}", User answered: "${userAnswer}"`);
    console.log(`📝 Question Context: "${questionContext}"`);

    // Get or create conversation thread
    const thread = this.getOrCreateThread(questionId, correctAnswer, questionContext);
    
    // Generate teaching response
    const teachingResponse = await this.generateTeachingResponse(thread, userAnswer);
    console.log(`🎓 Voice Agent: Generated teaching response: "${teachingResponse}"`);
    
    // Speak the response
    const messageId = `voice-agent-${questionId}-${thread.attempts}`;
    console.log(`🎓 Voice Agent: Speaking with messageId: ${messageId}`);
    await this.speak(teachingResponse, {
      voice: 'nova',
      speed: 0.7, // Slower for teaching
      messageId
    });
  }

  /**
   * Check if currently speaking
   */
  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
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
      console.log('🎤 Voice Agent: Replaying last spoken text:', this.lastSpokenText);
      await this.speak(this.lastSpokenText, this.lastSpokenOptions || undefined);
    } else {
      console.warn('Voice Agent: No previous text to replay');
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
}

// Export singleton instance
export const voiceAgentService = new VoiceAgentService();
export default VoiceAgentService;
