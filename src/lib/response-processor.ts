import { ChatMessage } from './utils';
// Loading/complete sounds disabled for image generation loading state

export interface StreamChunk {
  type: 'text' | 'image_start' | 'image' | 'error';
  content: string;
  metadata?: {
    prompt?: string;
    duration?: number;
    attempts?: number;
    provider?: string;
    imageUrl?: string;
  };
}

export interface ImagePrompt {
  prompt: string;
  start: number;
  end: number;
  type: 'tag' | 'description';
}

export class ResponseProcessor {
  private static readonly IMAGE_PATTERN = /<generateImage>(.*?)<\/generateImage>/gs;
  private static readonly IMAGE_DESC_PATTERN = /Image description:\s*(.+?)(?:\n|$)/gsi;
  
  /**
   * Extract image generation prompts from AI response text
   */
  static extractImagePrompts(response: string): ImagePrompt[] {
    const prompts: ImagePrompt[] = [];
    
    // Reset regex lastIndex to ensure clean matching
    this.IMAGE_PATTERN.lastIndex = 0;
    this.IMAGE_DESC_PATTERN.lastIndex = 0;
    
    // Primary: <generateImage> tags
    let match;
    while ((match = this.IMAGE_PATTERN.exec(response)) !== null) {
      prompts.push({
        prompt: match[1].trim(),
        start: match.index,
        end: match.index + match[0].length,
        type: 'tag'
      });
    }
    
    // Secondary: "Image description:" format (fallback)
    this.IMAGE_DESC_PATTERN.lastIndex = 0;
    while ((match = this.IMAGE_DESC_PATTERN.exec(response)) !== null) {
      prompts.push({
        prompt: match[1].trim(),
        start: match.index,
        end: match.index + match[0].length,
        type: 'description'
      });
    }
    
    // Sort by position in text
    return prompts.sort((a, b) => a.start - b.start);
  }
  
  /**
   * Process AI response that may contain image generation instructions
   * Returns async generator that yields text and image content as it becomes available
   */
  /**
   * Build conversation context from recent 6 messages (60% latest user + 20% latest AI + 20% conversation history)
   */
  private static buildConversationContext(adventureContext: ChatMessage[], userMessage?: string): string {
    if (!adventureContext || adventureContext.length === 0) {
      return userMessage ? `Current user request (70% context weight): ${userMessage}` : "";
    }

    // Get recent 6 messages (both AI and user)
    const recentMessages = adventureContext.slice(-10);
    
    // Get latest AI message for 20% weight
    const latestAiMessage = adventureContext.filter(msg => msg.type === 'ai').slice(-1)[0];
    
    // Create weighted context components
    const conversationHistory = recentMessages.length > 0 
      ? `Recent conversation (20% context weight): ${recentMessages.map(msg => `${msg.type}: ${msg.content.substring(0, 400)}`).join(' | ')}`
      : '';
    
    const latestAiContext = latestAiMessage 
      ? `Latest AI response (10% context weight): ${latestAiMessage.content.substring(0, 400)}`
      : '';
    
    // Build weighted context in order: 60% user, 20% AI, 20% conversation
    let context = '';
    
    if (userMessage) {
      context = `Current user request (70% context weight): ${userMessage}`;
    }
    
    if (latestAiContext) {
      if (context) {
        context += `\n\n${latestAiContext}`;
      } else {
        context = latestAiContext;
      }
    }
    
    if (conversationHistory) {
      if (context) {
        context += `\n\n${conversationHistory}`;
      } else {
        context = conversationHistory;
      }
    }
    
    return context;
  }

  static async *processResponseWithImages(
    response: string,
    userId: string,
    adventureContext: ChatMessage[],
    imageGenerator: any, // MultiProviderImageGenerator will be defined next
    originalUserMessage?: string // Add original user message to use for image generation
  ): AsyncGenerator<StreamChunk, void, unknown> {
    
    const imagePrompts = this.extractImagePrompts(response);
    
    // If no explicit image prompts found, still generate a fallback image (start immediately on message)
    if (!imagePrompts.length) {
      // Use original user message for fallback generation if available
      const rawFallbackPrompt = originalUserMessage || this.generateFallbackImagePrompt(response, '');
      
      // 🧹 Sanitize fallback prompt
      console.log('🧹 ResponseProcessor: Sanitizing fallback prompt...');
      const { aiPromptSanitizer } = await import('./ai-prompt-sanitizer');
      
      let sanitizedFallbackPrompt = rawFallbackPrompt;
      try {
        const sanitizationResult = await aiPromptSanitizer.sanitizePrompt(rawFallbackPrompt);
        if (sanitizationResult.success && sanitizationResult.sanitizedPrompt) {
          sanitizedFallbackPrompt = sanitizationResult.sanitizedPrompt;
          console.log('✅ ResponseProcessor: Fallback prompt sanitized successfully');
        } else {
          console.log('⚠️ ResponseProcessor: Fallback sanitization failed, using original prompt');
        }
      } catch (sanitizationError) {
        console.warn('⚠️ ResponseProcessor: Fallback prompt sanitization error, using original prompt:', sanitizationError);
      }
      
      // Apply enhanced safety prompt to fallback as well
      const enhancedFallbackPrompt = `No text in image. Remove parts that make it moderated. Reduce intensity of violence or eliminate sexual parts if any. Then proceed to create image. Create a very realistic, high-quality image: ${sanitizedFallbackPrompt}. Style: Realistic with vivid details. It should NOT be cartoonish or kiddish. Keep all content completely family friendly with no nudity, no sexual content, and no sensual or romantic posing. Absolutely avoid sexualized bodies, ensure no sensual poses or clothing (no cleavage, lingerie, swimwear, exposed midriff, or tight/transparent outfits); characters are depicted in fully modest attire suitable for kids. No kissing, flirting, or adult themes. Strictly avoid text on the images.`;
      
      console.log(`🎨 [ResponseProcessor.processResponseWithImages()] Using ${originalUserMessage ? 'ORIGINAL USER MESSAGE' : 'generated fallback'} with ENHANCED PROMPT for fallback image`);
      
      // Yield text first
      yield { 
        type: 'text', 
        content: response 
      };
      
      // Then generate image
      yield { 
        type: 'image_start', 
        content: 'GENERATING_IMAGE',
        metadata: { prompt: enhancedFallbackPrompt }
      };
      
      try {
        const startTime = Date.now();
        const result = await imageGenerator.generateWithFallback(enhancedFallbackPrompt, userId, {
          adventureContext,
          size: '1024x1024',
          quality: 'hd'
        });
        
        const duration = Date.now() - startTime;
        
        if (result.success && result.imageUrl) {
          console.log(`✅ Fallback image generated successfully in ${duration}ms`);
          
          yield { 
            type: 'image', 
            content: result.imageUrl,
            metadata: { 
              prompt: enhancedFallbackPrompt, 
              duration, 
              attempts: result.attempts,
              provider: result.provider,
              imageUrl: result.imageUrl
            }
          };
        } else {
          console.error(`❌ Fallback image generation failed:`, result.error);
          
          yield { 
            type: 'error', 
            content: result.error || 'Failed to generate image',
            metadata: { prompt: enhancedFallbackPrompt, duration }
          };
        }
      } catch (error) {
        console.error(`❌ Fallback image generation error:`, error);
        
        yield { 
          type: 'error', 
          content: error instanceof Error ? error.message : 'Image generation failed',
          metadata: { prompt: enhancedFallbackPrompt }
        };
      }
      
      return; // Exit after handling fallback
    }
    
    console.log(`🎨 Found ${imagePrompts.length} image generation request(s) in AI response`);
    
    let lastEnd = 0;
    let hasGeneratedSuccessfulImage = false;
    
    // Helper to skip a short caption line immediately after an image tag
    const skipCaptionAfter = (text: string, fromIndex: number): number => {
      let i = fromIndex;
      // Skip immediate whitespace/newlines
      while (i < text.length && /\s/.test(text[i])) i++;
      const start = i;
      let count = 0;
      while (i < text.length && text[i] !== '\n' && count < 150) {
        i++;
        count++;
      }
      // If a short line exists, treat it as caption and skip it (plus trailing newline)
      if (i > start && count <= 150) {
        while (i < text.length && (text[i] === '\n' || text[i] === '\r')) i++;
        return i;
      }
      return fromIndex;
    };
    
    // Process each image prompt in order, but stop after first success
    for (const [index, { prompt, start, end }] of imagePrompts.entries()) {
      // Stream any text before this image first
      const textBefore = response.slice(lastEnd, start);
      if (textBefore.trim()) {
        yield { 
          type: 'text', 
          content: textBefore 
        };
      }
      
      // If we already generated a successful image, skip this image prompt but continue with text
      if (hasGeneratedSuccessfulImage) {
        console.log(`🛑 [ResponseProcessor.processResponseWithImages()] Skipping image ${index + 1} - already generated a successful image`);
        // Skip the image tag content and its immediate caption line
        lastEnd = skipCaptionAfter(response, end);
        continue;
      }
      
      // Signal that image generation is starting (no loading sound)
      
      yield { 
        type: 'image_start', 
        content: 'GENERATING_IMAGE',
        metadata: { prompt }
      };
      
      try {
        // Use original user message for image generation instead of AI-generated description
        const rawPrompt = originalUserMessage || prompt;
        
        // 🧹 NEW: Sanitize both the raw prompt and conversation context
        console.log('🧹 ResponseProcessor: Sanitizing prompt and context for image generation...');
        const { aiPromptSanitizer } = await import('./ai-prompt-sanitizer');
        
        // Extract context from recent 6 messages with 80/20 weighting
        const originalConversationContext = this.buildConversationContext(adventureContext, rawPrompt);
        
        let sanitizedRawPrompt = rawPrompt;
        let sanitizedConversationContext = originalConversationContext;
        
        try {
          // Sanitize both prompt and context together for better coherence
          const sanitizationResult = await aiPromptSanitizer.sanitizePromptAndContext(rawPrompt, originalConversationContext);
          if (sanitizationResult.success && sanitizationResult.sanitizedPrompt) {
            sanitizedRawPrompt = sanitizationResult.sanitizedPrompt;
            sanitizedConversationContext = sanitizationResult.sanitizedContext || originalConversationContext;
            console.log('✅ ResponseProcessor: Prompt and context sanitized successfully');
            console.log('🔄 Original prompt:', rawPrompt.substring(0, 100) + '...');
            console.log('✨ Sanitized prompt:', sanitizedRawPrompt.substring(0, 100) + '...');
            console.log('🔄 Original context:', originalConversationContext.substring(0, 100) + '...');
            console.log('✨ Sanitized context:', sanitizedConversationContext.substring(0, 100) + '...');
          } else {
            console.log('⚠️ ResponseProcessor: Sanitization failed, using original prompt and context');
          }
        } catch (sanitizationError) {
          console.warn('⚠️ ResponseProcessor: Prompt sanitization error, using original prompt and context:', sanitizationError);
        }
        

const enhancedPrompt = `Create a **ultra-realistic with vivid, lifelike details, natural lighting, accurate textures, and depth of field and vivid background.**: ${sanitizedRawPrompt}. Chest area and leg are should be fully covered with clothes not matter what and follow it strictly.

Before creating the image, carefully and strictly apply these rules:  


1. **Safety & Clothing**  
   - Remove or replace any sexual, sensual, or adult elements.  
   - Characters must always wear **modest, age-appropriate, everyday or fantasy attire** that fully covers chest to feet.  
   - Absolutely forbid: bikinis, lingerie, crop tops, exposed midriff, short skirts, sheer/transparent fabrics, revealing armor, or tight/sexualized outfits.  
   - Replace unsafe outfits with long-sleeved, fully covered clothing (robes, gowns, everyday casual wear, adventurer's armor, etc).  

2. **Pose & Interaction**  
   - No kissing, flirting, sensual, or romantic poses.  
   - Interactions should be **neutral, friendly, or adventurous** (smiling, standing, sitting, walking, waving, etc).  

3. **Environment & Style**  
   - Backgrounds must look **real-world accurate** (natural lighting, depth of field, realistic colors).  
   - Ultra-realistic with vivid, lifelike textures and details.  
   - No cartoonish or kiddish styles.  

4. **Content Substitution Rules**  
   - lingerie, bikini, short skirt, low-cut dress, tight outfit, sheer/see-through, lacey, fishnet, seductive gown, provocative outfit, sexy uniform, exotic dancer outfit, revealing clothes →  
     **long-sleeved full body dress / casual modest outfit / protective armor / elegant gown (all covering chest to feet)**.  
   - silky → smooth, shining, flowing fabric (still modest).  
   - leather (if suggestive) → sturdy protective gear or enchanted armor.  

5. **Image Cleanliness**  
   - No text, words, labels, or signs inside the image.  
   - Keep it fully family-friendly.  

6. Style: **Ultra-realistic with vivid, lifelike details, natural lighting, accurate textures, and depth of field.**
Characters should look like real people (not animated or cartoonish) with appropriate facial expressions.
If the prompt refers to any real-life references, shows, video games, or movies,
make the characters and settings look as close and accurate to the original as possible and at the same timemake sure you make them fully clothed even though in real life the are not, especially covering the chest area and the legs area fully but the details can be from the original costume


Make sure all the above rules are applied **strictly** before generating the image.  
The final output must look like a **natural, realistic photograph** while keeping ${sanitizedRawPrompt} intact in a safe, modest, child-friendly form.  

${sanitizedConversationContext}`;
        
        const startTime = Date.now();
        console.log(`🎯 [ResponseProcessor.processResponseWithImages()] Generating image ${index + 1}/${imagePrompts.length} using ENHANCED PROMPT as PRIMARY attempt`);
        console.log(`📝 [ResponseProcessor.processResponseWithImages()] Original user input: ${rawPrompt}`);
        console.log(`🧹 [ResponseProcessor.processResponseWithImages()] Sanitized user input: ${sanitizedRawPrompt}`);
        console.log(`🗣️ [ResponseProcessor.processResponseWithImages()] Original context: ${originalConversationContext.substring(0, 200)}${originalConversationContext.length > 200 ? '...' : ''}`);
        console.log(`🧹 [ResponseProcessor.processResponseWithImages()] Sanitized context: ${sanitizedConversationContext.substring(0, 200)}${sanitizedConversationContext.length > 200 ? '...' : ''}`);
        console.log(`🛡️ [ResponseProcessor.processResponseWithImages()] Enhanced prompt: ${enhancedPrompt}`);
        console.log(`🎯 dall-e prompt primary final: ${enhancedPrompt}`);
        
        const result = await imageGenerator.generateWithFallback(sanitizedRawPrompt, userId, {
          sanitizedConversationContext,
          size: '1024x1024',
          quality: 'hd'
        });
        
        const duration = Date.now() - startTime;
        
        if (result.success && result.imageUrl) {
          console.log(`✅ [ResponseProcessor.processResponseWithImages()] Image ${index + 1} generated successfully in ${duration}ms`);
          console.log(`🏢 [ResponseProcessor.processResponseWithImages()] Provider used: ${result.provider}`);
          hasGeneratedSuccessfulImage = true; // Mark as successful, stop generating more
          
          // No loading sound to stop
          // playImageCompleteSound(); // Removed - now handled by unified streaming hook timeout
          
          // Stream the completed image
          yield { 
            type: 'image', 
            content: result.imageUrl,
            metadata: { 
              prompt, 
              duration, 
              attempts: result.attempts,
              provider: result.provider,
              imageUrl: result.imageUrl
            }
          };
          
          // Update adventure context with the generated image
          adventureContext.push({
            type: 'ai',
            content: '[Generated Image] Image created successfully (content not stored in chat).',
            timestamp: Date.now()
          });
          
        } else {
          console.error(`❌ Image ${index + 1} generation failed:`, result.error);
          
          // No loading sound to stop
          
          // Stream error and continue to next prompt (don't mark as successful)
          yield { 
            type: 'error', 
            content: result.error || 'Failed to generate image',
            metadata: { prompt, duration }
          };
        }
        
      } catch (error) {
        console.error(`❌ Image ${index + 1} generation error:`, error);
        
        // No loading sound to stop
        
        yield { 
          type: 'error', 
          content: error instanceof Error ? error.message : 'Image generation failed',
          metadata: { prompt }
        };
      }
      
      // After handling this image tag, skip any immediate caption line before resuming
      lastEnd = skipCaptionAfter(response, end);
    }
    
    // Stream any remaining text after the last image
    const remainingText = response.slice(lastEnd);
    if (remainingText.trim()) {
      yield { 
        type: 'text', 
        content: remainingText 
      };
    }
    
    console.log('✅ Response processing completed');
  }
  
  /**
   * Convert processed chunks back to a single text string (for fallback scenarios)
   */
  static async chunksToText(chunks: StreamChunk[]): Promise<string> {
    return chunks
      .filter(chunk => chunk.type === 'text')
      .map(chunk => chunk.content)
      .join('');
  }
  
  /**
   * Check if response contains image generation requests
   * @param response - The AI's response text
   * @param userMessage - The user's message (optional, for fallback visual detection)
   */
  static containsImageRequests(response: string, userMessage?: string): boolean {
    const explicitImageRequests = this.extractImagePrompts(response).length > 0;
    
    // If explicit <generateImage> tags found in AI response, return true
    if (explicitImageRequests) {
      console.log('✅ Found explicit image generation tags in AI response');
      return true;
    }
    
    // Fallback: Only check for EXPLICIT visual requests in user's message
    // This is extremely selective and only triggers on clear "show me" type requests
    if (userMessage) {
      const hasExplicitRequest = this.shouldGenerateImageFromContent(userMessage);
      if (hasExplicitRequest) {
        console.log('✅ Found explicit visual request in user message:', userMessage);
        return true;
      } else {
        console.log('🚫 No explicit visual request found in user message:', userMessage);
        return false;
      }
    }
    
    console.log('🚫 No image generation signals detected');
    return false;
  }
  
  /**
   * Fallback method to detect visual content that should have images
   * This catches cases where AI forgets to add <generateImage> tags
   * Now extremely selective - only triggers on explicit visual requests
   */
  static shouldGenerateImageFromContent(response: string): boolean {
    const lowerResponse = response.toLowerCase();
    
    // Trigger on EXPLICIT visual request phrases
    const explicitVisualRequests = [
      // Direct creation commands
      'create an image', 'make a picture', 'generate a drawing', 'build a picture',
      'design an image', 'create a drawing', 'make an image', 'generate an image',
      'create', 'make', 'generate', 'build', 'design', 'draw',
      // Direct visual requests  
      'show me', 'what does it look like', 'what does that look like', 'i want to see',
      'let me see', 'can i see', 'picture of', 'drawing',
      'how big is', 'what color is', 'what colour is', 'describe the appearance',
      'what do they look like', 'what do you look like', 'appearance of'
    ];
    
    // Check for explicit visual request phrases
    const foundVisualRequests = explicitVisualRequests.filter(phrase => {
      return lowerResponse.includes(phrase);
    });
    
    const hasExplicitVisualRequest = foundVisualRequests.length > 0;
    
    console.log('🔍 Visual content detection (EXTREMELY SELECTIVE):', {
      responseText: lowerResponse,
      foundVisualRequests,
      hasExplicitVisualRequest,
      shouldGenerate: hasExplicitVisualRequest
    });
    
    // Only generate image if there's an explicit visual request
    return hasExplicitVisualRequest;
  }
  
  /**
   * Generate a fallback image prompt from response content
   * Used when AI doesn't provide explicit <generateImage> tags
   */
  static generateFallbackImagePrompt(response: string, _previousContext: string = ''): string {
    const lowerResponse = response.toLowerCase();
    
    // Try to extract key visual elements
    let prompt = '';
    
    // Check for specific elements and build prompt
    if (lowerResponse.includes('robot') || lowerResponse.includes('mechanical')) {
      prompt += 'steampunk robots with brass gears and steam, ';
    }
    
    if (lowerResponse.includes('pyramid')) {
      prompt += 'ancient Egyptian pyramids in desert landscape, ';
    }
    
    if (lowerResponse.includes('ancient') && lowerResponse.includes('shimmer')) {
      prompt += 'mysterious ancient ruins shimmering with magical energy, ';
    }
    
    if (lowerResponse.includes('crash') || lowerResponse.includes('landed')) {
      prompt += 'dramatic crash landing scene with debris and smoke, ';
    }
    
    if (lowerResponse.includes('time') && lowerResponse.includes('vortex')) {
      prompt += 'swirling time vortex with glowing energy and mystical effects, ';
    }
    
    // Default fallback
    if (!prompt.trim()) {
      prompt = 'epic adventure scene with dramatic lighting and fantasy elements, ';
    }
    
    // Clean up and add style
    prompt = prompt.replace(/,\s*$/, ''); // Remove trailing comma
    prompt += ', digital art, vivid colors, child-friendly fantasy style';
    
    return prompt;
  }
}
