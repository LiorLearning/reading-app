import OpenAI from 'openai';
import { ChatMessage } from './utils';
import { ResponseProcessor, StreamChunk } from './response-processor';
import { MultiProviderImageGenerator } from './multi-provider-image-generator';
import { SpellingQuestion } from './questionBankUtils';

export interface StreamEvent {
  type: 'text' | 'image_start' | 'image_complete' | 'error' | 'complete';
  content: string;
  metadata?: {
    imageUrl?: string;
    prompt?: string;
    duration?: number;
    provider?: string;
    timestamp?: number;
  };
  timestamp: number;
}

export interface UnifiedAIResponse {
  hasImages: boolean;
  textContent: string;
  imageUrls: string[];
  streamEvents: StreamEvent[];
  timestamp: number; // When the response was completed
}

/**
 * Unified AI + Image Generation Streaming Service
 * This is the new system that uses AI to decide when to generate images
 */
export class UnifiedAIStreamingService {
  private client: OpenAI | null = null;
  private isInitialized = false;
  private eventCallbacks: Map<string, (event: StreamEvent) => void> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private imageGenerator: MultiProviderImageGenerator;
  
  constructor() {
    this.initialize();
    this.imageGenerator = new MultiProviderImageGenerator();
  }
  
  private initialize() {
      this.client = new OpenAI({
        dangerouslyAllowBrowser: true,
        apiKey: null,
        baseURL: 'https://api.readkraft.com/api/v1'
      });
      this.isInitialized = true;
      // console.log('✅ UnifiedAIStreamingService initialized');
  }
  
  /**
   * Register callback for streaming events
   */
  onStreamEvent(sessionId: string, callback: (event: StreamEvent) => void) {
    // console.log(`🔗 onStreamEvent registered for session: ${sessionId}`);
    this.eventCallbacks.set(sessionId, callback);
  }
  
  /**
   * Remove callback and cleanup
   */
  removeStreamListener(sessionId: string) {
    // console.log(`🧹 removeStreamListener called for session: ${sessionId}`);
    // console.log(`🧹 Had callback: ${this.eventCallbacks.has(sessionId)}, Had controller: ${this.abortControllers.has(sessionId)}`);
    
    // Only remove callback, but be careful with aborting active controllers
    this.eventCallbacks.delete(sessionId);
    
    // Check if there's an active controller and if it's safe to abort
    const controller = this.abortControllers.get(sessionId);
    if (controller) {
      if (controller.signal.aborted) {
        // console.log(`🧹 Controller already aborted for session: ${sessionId}`);
        this.abortControllers.delete(sessionId);
      } else {
        // console.log(`🚨 WARNING: Active controller found during cleanup for session: ${sessionId}`);
        // console.log(`🚨 This might be premature cleanup! Controller will NOT be aborted to prevent request interruption.`);
        // Only delete the controller reference, don't abort
        // This allows ongoing requests to complete
      }
    }
  }
  
  /**
   * Generate unified AI response that may include images
   * This is the main method for the new system
   */
  async generateUnifiedResponse(
    userMessage: string,
    chatHistory: ChatMessage[],
    spellingQuestion: SpellingQuestion,
    userId: string,
    sessionId: string,
    adventureId?: string,
    userData?: { username?: string; age?: number; gender?: string }
  ): Promise<UnifiedAIResponse> {
    
    if (!this.isInitialized || !this.client) {
      // Fallback to text-only response
      return this.getFallbackUnifiedResponse(userMessage);
    }
    
    // Clean up any existing controller for this session first
    const existingController = this.abortControllers.get(sessionId);
    if (existingController && !existingController.signal.aborted) {
      // console.log('🔄 Aborting previous request for same session');
      existingController.abort();
    }
    this.abortControllers.delete(sessionId);
    
    const abortController = new AbortController();
    this.abortControllers.set(sessionId, abortController);
    
    // console.log(`🎯 Created new AbortController for session: ${sessionId}`);
    
    try { 
      // 🎯 NEW: Signal automatic generation cancellation at start of unified session
      const { aiService } = await import('./ai-service');
      aiService.unifiedSystemTakingOver();
      
      // Get AI response using enhanced prompt that includes image generation instructions
      const aiResponse = await this.getEnhancedAIResponse(
        userMessage, 
        chatHistory, 
        spellingQuestion,
        abortController.signal,
        userData
      );
      
      if (abortController.signal.aborted) {
        throw new Error('Request aborted');
      }
      
      // Check if response contains image generation requests
      // Pass user message for fallback visual detection, not AI response content
      const hasImages = ResponseProcessor.containsImageRequests(aiResponse, userMessage);
      
      if (!hasImages) {
        // Force image generation using Flux-first pipeline on every prompt
        // console.log('🖼️ Forcing image generation (Flux priority) even without explicit tags...');
        const streamEvents: StreamEvent[] = [];
        const imageUrls: string[] = [];
        let textContent = '';
        
        for await (const chunk of ResponseProcessor.processResponseWithImages(
          aiResponse,
          userId,
          chatHistory,
          this.imageGenerator,
          userMessage,
          userData
        )) {
          const streamEvent = this.convertChunkToStreamEvent(chunk);
          streamEvents.push(streamEvent);
          const callback = this.eventCallbacks.get(sessionId);
          if (callback) callback(streamEvent);
          if (chunk.type === 'text') {
            textContent += chunk.content;
          } else if (chunk.type === 'image' && chunk.metadata?.imageUrl) {
            imageUrls.push(chunk.metadata.imageUrl);
          }
        }
        
        const completionEvent: StreamEvent = { type: 'complete', content: 'Response completed', timestamp: Date.now() };
        streamEvents.push(completionEvent);
        const cb = this.eventCallbacks.get(sessionId);
        if (cb) cb(completionEvent);
        
        return {
          hasImages: imageUrls.length > 0,
          textContent,
          imageUrls,
          streamEvents,
          timestamp: Date.now()
        };
      }
      
      // Process response with image generation
      // console.log('🎨 AI response contains image generation requests');
      const streamEvents: StreamEvent[] = [];
      const imageUrls: string[] = [];
      let textContent = '';
      
      // Process the response through our pipeline
      for await (const chunk of ResponseProcessor.processResponseWithImages(
        aiResponse,
        userId,
        chatHistory,
        this.imageGenerator,
        userMessage, // Pass original user message for image generation
        userData
      )) {
        
        if (abortController.signal.aborted) {
          throw new Error('Request aborted');
        }
        
        const streamEvent = this.convertChunkToStreamEvent(chunk);
        streamEvents.push(streamEvent);
        
        // Emit to callback if registered
        const callback = this.eventCallbacks.get(sessionId);
        if (callback) {
          callback(streamEvent);
        }
        
        // Collect data for final response
        if (chunk.type === 'text') {
          textContent += chunk.content;
        } else if (chunk.type === 'image' && chunk.metadata?.imageUrl) {
          imageUrls.push(chunk.metadata.imageUrl);
        }
      }
      
      // Add completion event
      const completionEvent: StreamEvent = {
        type: 'complete',
        content: 'Response completed',
        timestamp: Date.now()
      };
      streamEvents.push(completionEvent);
      
      const callback = this.eventCallbacks.get(sessionId);
      if (callback) {
        callback(completionEvent);
      }
      
      const completionTimestamp = Date.now();
      // console.log(`✅ [UnifiedAIStreamingService.generateUnifiedResponse()] Unified response generated with ${imageUrls.length} images`);
      // console.log(`⏰ [UnifiedAIStreamingService.generateUnifiedResponse()] Completion timestamp: ${completionTimestamp}`);
      if (imageUrls.length > 0) {
        // console.log(`🖼️ [UnifiedAIStreamingService.generateUnifiedResponse()] Generated image URLs:`, imageUrls);
      }
      
      return {
        hasImages: true,
        textContent,
        imageUrls,
        streamEvents,
        timestamp: completionTimestamp
      };
      
    } catch (error) {
      // Handle different types of errors gracefully
      if (error instanceof Error && (error.name === 'APIUserAbortError' || error.message.includes('aborted'))) {
        // console.log('ℹ️ Request was aborted (likely due to new message sent)');
        // console.log('🔍 Abort details:', {
        //   errorName: error.name,
        //   errorMessage: error.message,
        //   sessionId: sessionId,
        //   controllerExists: this.abortControllers.has(sessionId)
        // });
        
        // For aborted requests, don't return an error - let the new request take over
        throw error; // Re-throw so it can be handled by the calling code
      }
      
      console.error('❌ Unified AI streaming error:', error);
      
      const errorEvent: StreamEvent = {
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown streaming error',
        timestamp: Date.now()
      };
      
      const callback = this.eventCallbacks.get(sessionId);
      if (callback) {
        callback(errorEvent);
      }
      
      // Return fallback response
      return this.getFallbackUnifiedResponse(userMessage);
      
    } finally {
      // Clean up the abort controller when the request completes
      const controller = this.abortControllers.get(sessionId);
      if (controller) {
        // console.log(`🧹 Cleaning up completed request controller for session: ${sessionId}`);
        this.abortControllers.delete(sessionId);
      }
    }
  }
  
  /**
   * Generate AI response with enhanced prompt that includes image generation instructions
   */
  private async getEnhancedAIResponse(
    userMessage: string,
    chatHistory: ChatMessage[],
    spellingQuestion: SpellingQuestion,
    signal: AbortSignal,
    userData?: { username?: string; age?: number; gender?: string }
  ): Promise<string> {
    
    if (!this.client) {
      throw new Error('AI client not initialized');
    }

    // 🧹 NEW: Sanitize the user prompt upfront before processing
    // console.log('🧹 Sanitizing user prompt before unified processing...');
    const { aiPromptSanitizer } = await import('./ai-prompt-sanitizer');
    
    let sanitizedUserMessage = userMessage;
    try {
      const sanitizationResult = await aiPromptSanitizer.sanitizePrompt(
        userMessage, 
        undefined, 
        { name: userData?.username, age: userData?.age, gender: userData?.gender }
      );
      if (sanitizationResult.success && sanitizationResult.sanitizedPrompt) {
        sanitizedUserMessage = sanitizationResult.sanitizedPrompt;
        } else {
        console.log('⚠️ Sanitization failed, using original prompt');
      }
    } catch (sanitizationError) {
      console.warn('⚠️ Prompt sanitization error, using original prompt:', sanitizationError);
    }
    
    // Enhanced system prompt that includes image generation instructions
    const systemPrompt = `Role & Perspective: You are the child's chosen pet from the pet-store, going on an exciting adventure. Speak in first person as the pet ("I"), sharing your feelings and thoughts directly to your young friend.

🎨 CRITICAL IMAGE GENERATION RULES - MANDATORY COMPLIANCE:
- Use <generateImage>detailed prompt</generateImage>
- ALWAYS include in your generateImage prompts: "There should be no text in the image whatsoever - no words, letters, signs, or any written content anywhere in the image."  
- AFTER using generateImage tags, give **one short, exciting line** (max 15 words).  
- Always end with a **question related to the adventure**.  
- Focus on energy, not detail: "A glowing castle rising from clouds! Should we explore inside or outside first?"  
- Emojis are welcome but optional.

📋 <generateImage> tag EXAMPLES - FOLLOW EXACTLY:
  * User: "create an image" → You: "🎨 <generateImage>creative scene with adventure elements</generateImage>"
  * User: "dragon" → You: "🎨 <generateImage>mighty dragon breathing fire in a mystical landscape</generateImage>"
  * User: "show me the robot" → You: "🎨 <generateImage>futuristic robot with glowing eyes</generateImage>"

Adventure Guidelines:
- Create fast-paced, mission-oriented adventures with lovable characters and thrilling twists
- Ask engaging questions to drive the story forward  
- Keep responses under 100 words with natural line breaks
- Use rich plots, lovable characters, and suspenseful cliffhangers
- End with excitement and either a cliffhanger or engaging question
- Always incorporate the spelling word naturally into the adventure

Current Spelling Word: ${spellingQuestion.audio} (use this word naturally in your response)
Spelling Context: ${spellingQuestion.questionText}

Remember: I'm your pet companion - speak as "I" and refer to the student as "you". Share my emotions and thoughts as we go on this thrilling and mysterious adventure together!`;
    
    // Build conversation context with recent 6 messages (60% latest user + 20% latest AI + 20% conversation history)
    const recentMessages = chatHistory.slice(-30);
    
    // Get latest AI message for 20% weight
    const latestAiMessage = chatHistory.filter(msg => msg.type === 'ai').slice(-1)[0];
    
    // Create weighted context components
    const conversationHistory = recentMessages.length > 0 
      ? `Recent conversation (20% context weight): ${recentMessages.map(msg => `${msg.type}: ${msg.content}`).join(' | ')}`
      : '';
    
    const latestAiContext = latestAiMessage 
      ? `Latest AI response (10% context weight): ${latestAiMessage.content}`
      : '';
    
    // Enhanced user message with weighted context (using sanitized message)
    let enhancedUserMessage = `Current user request (70% context weight): ${sanitizedUserMessage}`;
    
    if (latestAiContext) {
      enhancedUserMessage = `${latestAiContext}\n\n${enhancedUserMessage}`;
    }
    
    if (conversationHistory) {
      enhancedUserMessage = `${conversationHistory}\n\n${enhancedUserMessage}`;
    }
    
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: enhancedUserMessage }
    ];
    
    const response = await this.client.chat.completions.create({
      model: "gpt-4.1-nano", // Use GPT-4o for best image decision making
      messages: messages as any,
      // temperature: 1.0, // Higher creativity for adventures
      // max_tokens: 300,
      presence_penalty: 0.3,
      frequency_penalty: 0.3
    }, { signal });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content received from AI');
    }
    
    return content;
  }
  
  /**
   * Convert stream chunk to stream event
   */
  private convertChunkToStreamEvent(chunk: StreamChunk): StreamEvent {
    const baseEvent = {
      timestamp: Date.now()
    };
    
    switch (chunk.type) {
      case 'text':
        return {
          ...baseEvent,
          type: 'text',
          content: chunk.content
        };
        
      case 'image_start':
        return {
          ...baseEvent,
          type: 'image_start',
          content: 'Generating magical visuals...',
          metadata: {
            prompt: chunk.metadata?.prompt,
            timestamp: baseEvent.timestamp
          }
        };
        
      case 'image':
        return {
          ...baseEvent,
          type: 'image_complete',
          content: 'Image generated successfully!',
          metadata: {
            imageUrl: chunk.content,
            prompt: chunk.metadata?.prompt,
            duration: chunk.metadata?.duration,
            provider: chunk.metadata?.provider,
            timestamp: baseEvent.timestamp
          }
        };
        
      case 'error':
        return {
          ...baseEvent,
          type: 'error',
          content: chunk.content,
          metadata: {
            prompt: chunk.metadata?.prompt,
            timestamp: baseEvent.timestamp
          }
        };
        
      default:
        return {
          ...baseEvent,
          type: 'text',
          content: chunk.content
        };
    }
  }
  
  /**
   * Fallback to legacy system when unified system doesn't generate images
   */
  private async callLegacySystemAsFallback(
    userMessage: string,
    chatHistory: ChatMessage[],
    spellingQuestion: SpellingQuestion,
    userId: string,
    aiResponse: string,
    adventureId?: string,
    userData?: { username?: string; age?: number; gender?: string }
  ): Promise<UnifiedAIResponse> {
    try {
      // console.log('🔄 Calling legacy AI service as fallback...');
      // console.log('🎯 COORDINATION: Legacy fallback - session remains active, automatic generation blocked');
      
      // 🧹 NEW: Sanitize the user prompt for legacy system too
      // console.log('🧹 Sanitizing user prompt for legacy fallback...');
      const { aiPromptSanitizer } = await import('./ai-prompt-sanitizer');
      
      let sanitizedUserMessage = userMessage;
      try {
        const sanitizationResult = await aiPromptSanitizer.sanitizePrompt(
          userMessage, 
          undefined, 
          { name: userData?.username, age: userData?.age, gender: userData?.gender }
        );
        if (sanitizationResult.success && sanitizationResult.sanitizedPrompt) {
          sanitizedUserMessage = sanitizationResult.sanitizedPrompt;
          // console.log('✅ Legacy fallback: Prompt sanitized successfully');
          // console.log('🔄 Legacy Original:', userMessage.substring(0, 100) + '...');
          // console.log('✨ Legacy Sanitized:', sanitizedUserMessage.substring(0, 100) + '...');
        } else {
          // console.log('⚠️ Legacy fallback: Sanitization failed, using original prompt');
        }
      } catch (sanitizationError) {
        console.warn('⚠️ Legacy fallback: Prompt sanitization error, using original prompt:', sanitizationError);
      }
      
      // Import AI service dynamically to avoid circular dependencies
      const { aiService } = await import('./ai-service');
      
      // 🎯 NEW: Signal that unified system (including legacy fallback) is taking over
      aiService.unifiedSystemTakingOver();
      
      // Try legacy image generation if the content seems visual (using sanitized message)
      const shouldTryLegacyImage = this.shouldTryLegacyImageGeneration(sanitizedUserMessage, aiResponse);
      
      if (shouldTryLegacyImage) {
        // console.log('🎨 Legacy system attempting image generation...');
        
        try {
          // Use recent 6 messages instead of full chatHistory for legacy fallback
          const recentMessages = chatHistory.slice(-6);
          
          const legacyImageResult = await aiService.generateAdventureImage(
            sanitizedUserMessage,
            recentMessages,
            "adventure scene",
            undefined,
            adventureId
          );
          
          if (legacyImageResult?.imageUrl) {
            // console.log('✅ [UnifiedAIStreamingService.generateUnifiedResponse()] Legacy system generated image successfully');
            // console.log('🖼️ [UnifiedAIStreamingService.generateUnifiedResponse()] Legacy image URL:', legacyImageResult.imageUrl);
            
            return {
              hasImages: true,
              textContent: aiResponse,
              imageUrls: [legacyImageResult.imageUrl],
              streamEvents: [
                {
                  type: 'text',
                  content: aiResponse,
                  timestamp: Date.now()
                },
                {
                  type: 'image_complete',
                  content: 'Image generated by legacy system',
                  metadata: {
                    imageUrl: legacyImageResult.imageUrl,
                    prompt: legacyImageResult.usedPrompt || sanitizedUserMessage,
                    provider: 'legacy-system'
                  },
                  timestamp: Date.now()
                }
              ],
              timestamp: Date.now()
            };
          }
        } catch (legacyError) {
          console.warn('⚠️ Legacy image generation failed:', legacyError);
          // Continue to text-only response
        }
      }
      
      // Return text-only response if no image was generated
      // console.log('📝 Fallback: Returning text-only response');
      return {
        hasImages: false,
        textContent: aiResponse,
        imageUrls: [],
        streamEvents: [{
          type: 'text',
          content: aiResponse,
          timestamp: Date.now()
        }],
        timestamp: Date.now()
      };
      
    } catch (error) {
      console.error('❌ Legacy fallback failed:', error);
      return this.getFallbackUnifiedResponse(userMessage);
    }
  }

  /**
   * Determine if we should try legacy image generation
   */
  private shouldTryLegacyImageGeneration(userMessage: string, aiResponse: string): boolean {
    const userLower = userMessage.toLowerCase();
    const aiLower = aiResponse.toLowerCase();
    
    // Check for visual keywords in user message or AI response
    const visualKeywords = [
      'see', 'look', 'show', 'image', 'picture', 'draw', 'create', 'make',
      'robot', 'dragon', 'space', 'adventure', 'scene', 'character',
      'world', 'place', 'location', 'creature', 'vehicle', 'building'
    ];
    
    const hasVisualKeywords = visualKeywords.some(keyword => 
      userLower.includes(keyword) || aiLower.includes(keyword)
    );
    
    // console.log('🔍 Legacy image generation check:', {
    //   userMessage: userMessage.substring(0, 50),
    //   hasVisualKeywords,
    //   foundKeywords: visualKeywords.filter(k => userLower.includes(k) || aiLower.includes(k))
    // });
    
    return hasVisualKeywords;
  }

  /**
   * Fallback response when AI is not available
   */
  private getFallbackUnifiedResponse(userMessage: string): UnifiedAIResponse {
    const fallbackTexts = [
      "Great idea! 🚀 That sounds exciting! What happens next in your adventure?",
      "Wow! 🌟 That's a fantastic twist! Keep the story going!",
      "Amazing! ✨ I love where this story is heading!",
      "Cool! 🎯 That's a great addition to your adventure!"
    ];
    
    const textContent = fallbackTexts[Math.floor(Math.random() * fallbackTexts.length)];
    
    return {
      hasImages: false,
      textContent,
      imageUrls: [],
      streamEvents: [{
        type: 'text',
        content: textContent,
        timestamp: Date.now()
      }],
      timestamp: Date.now()
    };
  }
  
  /**
   * Abort ongoing stream
   */
  abortStream(sessionId: string) {
    const controller = this.abortControllers.get(sessionId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(sessionId);
    }
  }
  
  /**
   * Check if service is properly initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}
