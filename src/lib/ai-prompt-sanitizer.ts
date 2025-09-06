import OpenAI from 'openai';

interface SanitizedPromptResult {
  sanitizedPrompt: string;
  sanitizedContext?: string;
  success: boolean;
  originalPrompt: string;
  processingTimeMs: number;
}

class AIPromptSanitizer {
  private client: OpenAI | null = null;
  private isInitialized = false;
  private sanitizationCache = new Map<string, SanitizedPromptResult>();

  constructor() {
    this.initialize();
  }

  private initialize() {
    const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('❌ AI Sanitizer: OpenAI API key not found');
      return;
    }

    try {
      this.client = new OpenAI({
        apiKey: openaiApiKey,
        dangerouslyAllowBrowser: true
      });
      this.isInitialized = true;
      console.log('✅ AI Sanitizer: Initialized successfully');
    } catch (error) {
      console.error('❌ AI Sanitizer: Failed to initialize:', error);
    }
  }

  async sanitizePromptAndContext(originalPrompt: string, adventureContext?: string): Promise<SanitizedPromptResult> {
    const startTime = Date.now();
    
    console.log('🧹 AI Sanitizer: Starting FULL sanitization (prompt + context) for:', originalPrompt.substring(0, 100) + '...');

    // Check cache first
    const cacheKey = `full_${originalPrompt}_${adventureContext || ''}`;
    if (this.sanitizationCache.has(cacheKey)) {
      console.log('💾 AI Sanitizer: Using cached full sanitization result');
      return this.sanitizationCache.get(cacheKey)!;
    }

    if (!this.isInitialized || !this.client) {
      console.log('❌ AI Sanitizer: Not initialized, using fallback sanitization');
      return this.fallbackFullSanitization(originalPrompt, adventureContext, startTime);
    }

    try {
      const systemPrompt = `You are a content sanitizer for a children's adventure app. Your job is to take image generation prompts AND their adventure context and make them 100% safe for DALL-E while preserving the visual excitement.

CRITICAL RULES:
1. Remove ALL violent language (fighting → competing, battle → contest, violent → intense, fury → energy)
2. Keep the visual excitement and epic nature  
3. Make it completely family-friendly for ages 8-14
4. Preserve character names and main visual elements
5. Use heroic, adventurous, and magical language instead
6. Clean BOTH the main prompt AND the adventure context
7. Return ONLY the cleaned prompt on the first line, then "---" then the cleaned context

EXAMPLES:
- "violently fighting" → "in an epic heroic pose"
- "sword still burns with fury" → "sword glows with magical energy"
- "slicing through enemies" → "demonstrating sword skills"
- "fierce battle" → "exciting adventure scene"

Clean this content and return in format:
CLEANED_PROMPT
---
CLEANED_CONTEXT`;

      const userMessage = `Main Prompt: ${originalPrompt}

Adventure Context: ${adventureContext || 'No additional context provided'}`;

      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 400,
        temperature: 0.7,
      });

      const responseText = completion.choices[0]?.message?.content?.trim() || '';
      
      let sanitizedPrompt = '';
      let sanitizedContext = '';
      
      // Parse the simple format: PROMPT\n---\nCONTEXT
      try {
        const parts = responseText.split('---');
        if (parts.length >= 2) {
          sanitizedPrompt = parts[0].trim();
          sanitizedContext = parts[1].trim();
          console.log('🧹 Successfully parsed prompt and context using simple format');
        } else {
          // Fallback: treat entire response as prompt
          sanitizedPrompt = responseText;
          sanitizedContext = adventureContext || '';
          console.log('🔧 No separator found, using entire response as prompt');
        }
      } catch (parseError) {
        console.warn('⚠️ Simple parsing failed:', parseError);
        sanitizedPrompt = responseText || originalPrompt;
        sanitizedContext = adventureContext || '';
      }

      if (!sanitizedPrompt) {
        throw new Error('Empty response from AI sanitizer');
      }

      const result: SanitizedPromptResult = {
        sanitizedPrompt,
        sanitizedContext,
        success: true,
        originalPrompt,
        processingTimeMs: Date.now() - startTime
      };

      // Cache the result
      this.sanitizationCache.set(cacheKey, result);
      
      console.log('✅ AI Sanitizer: Successfully sanitized prompt + context');
      console.log('🔄 Original prompt:', originalPrompt.substring(0, 80) + '...');
      console.log('✨ Sanitized prompt:', sanitizedPrompt.substring(0, 80) + '...');
      if (adventureContext && sanitizedContext) {
        console.log('🔄 Original context:', adventureContext.substring(0, 80) + '...');
        console.log('✨ Sanitized context:', sanitizedContext.substring(0, 80) + '...');
      }
      console.log('⏱️ Processing time:', result.processingTimeMs + 'ms');

      return result;

    } catch (error: any) {
      console.error('❌ AI Sanitizer: Failed to sanitize prompt + context:', error.message);
      return this.fallbackFullSanitization(originalPrompt, adventureContext, startTime);
    }
  }

  async sanitizePrompt(originalPrompt: string, context?: string): Promise<SanitizedPromptResult> {
    const startTime = Date.now();
    
    console.log('🧹 AI Sanitizer: Starting prompt sanitization for:', originalPrompt.substring(0, 100) + '...');

    // Check cache first
    const cacheKey = `${originalPrompt}_${context || ''}`;
    if (this.sanitizationCache.has(cacheKey)) {
      console.log('💾 AI Sanitizer: Using cached result');
      return this.sanitizationCache.get(cacheKey)!;
    }

    if (!this.isInitialized || !this.client) {
      console.log('❌ AI Sanitizer: Not initialized, using fallback sanitization');
      return this.fallbackSanitization(originalPrompt, startTime);
    }

    try {
      const systemPrompt = `You are a content sanitizer for a children's adventure app. Your job is to take image generation prompts and make them 100% safe for DALL-E while preserving the visual excitement and intent.

CRITICAL RULES:
1. Remove ALL violent language (fighting → competing, battle → contest, violent → intense)
2. Keep the visual excitement and epic nature
3. Make it completely family-friendly for ages 8-14  
4. Preserve character names and main visual elements
5. Use heroic, adventurous, and magical language instead
6. Return ONLY the cleaned prompt, no explanations

EXAMPLES:
- "charizard violently fighting" → "charizard in an epic heroic pose with dynamic energy"
- "sword battle" → "sword training demonstration" 
- "violent clash" → "intense magical showdown"

Transform this image request:`;

      const userMessage = context 
        ? `Context: ${context}\n\nPrompt to sanitize: ${originalPrompt}`
        : originalPrompt;

      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-mini", // Fast and cost-effective for this task
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      const sanitizedPrompt = completion.choices[0]?.message?.content?.trim() || '';
      
      if (!sanitizedPrompt) {
        throw new Error('Empty response from AI sanitizer');
      }

      const result: SanitizedPromptResult = {
        sanitizedPrompt,
        success: true,
        originalPrompt,
        processingTimeMs: Date.now() - startTime
      };

      // Cache the result
      this.sanitizationCache.set(cacheKey, result);
      
      console.log('✅ AI Sanitizer: Successfully sanitized prompt');
      console.log('🔄 Original:', originalPrompt.substring(0, 80) + '...');
      console.log('✨ Sanitized:', sanitizedPrompt.substring(0, 80) + '...');
      console.log('⏱️ Processing time:', result.processingTimeMs + 'ms');

      return result;

    } catch (error: any) {
      console.error('❌ AI Sanitizer: Failed to sanitize prompt:', error.message);
      return this.fallbackSanitization(originalPrompt, startTime);
    }
  }

  private fallbackFullSanitization(originalPrompt: string, adventureContext: string | undefined, startTime: number): SanitizedPromptResult {
    console.log('🔧 AI Sanitizer: Using rule-based fallback FULL sanitization');
    
    // Rule-based sanitization as fallback
    const replacements: Record<string, string> = {
      'violently fighting': 'in an epic heroic stance',
      'violent fight': 'intense magical contest',
      'fighting': 'training',
      'battle': 'contest',
      'violent': 'dynamic',
      'attack': 'approach',
      'destroy': 'transform',
      'kill': 'defeat',
      'blood': 'energy',
      'wound': 'mark',
      'sword fight': 'sword demonstration',
      'combat': 'competition',
      'war': 'adventure',
      'enemy': 'challenger',
      'rage': 'determination',
      'fury': 'magical energy',
      'slicing through': 'moving through',
      'burns with fury': 'glows with energy'
    };

    // Sanitize prompt
    let sanitizedPrompt = originalPrompt.toLowerCase();
    for (const [problematic, safe] of Object.entries(replacements)) {
      sanitizedPrompt = sanitizedPrompt.replace(new RegExp(problematic, 'gi'), safe);
    }

    // Sanitize context
    let sanitizedContext = adventureContext || '';
    for (const [problematic, safe] of Object.entries(replacements)) {
      sanitizedContext = sanitizedContext.replace(new RegExp(problematic, 'gi'), safe);
    }

    // Add family-friendly wrapper
    sanitizedPrompt = `Create a magical adventure scene: ${sanitizedPrompt}. Style: heroic and family-friendly, perfect for children. No text in the image.`;

    const result: SanitizedPromptResult = {
      sanitizedPrompt,
      sanitizedContext,
      success: false, // Mark as fallback
      originalPrompt,
      processingTimeMs: Date.now() - startTime
    };

    console.log('🔧 Fallback full sanitization completed in', result.processingTimeMs + 'ms');
    
    return result;
  }

  private fallbackSanitization(originalPrompt: string, startTime: number): SanitizedPromptResult {
    console.log('🔧 AI Sanitizer: Using rule-based fallback sanitization');
    
    // Rule-based sanitization as fallback
    let sanitized = originalPrompt.toLowerCase();
    
    // Common problematic terms and their replacements
    const replacements: Record<string, string> = {
      'violently fighting': 'in an epic heroic stance',
      'violent fight': 'intense magical duel',
      'fighting': 'training',
      'battle': 'contest',
      'violent': 'dynamic',
      'attack': 'approach',
      'destroy': 'transform',
      'kill': 'defeat',
      'blood': 'energy',
      'wound': 'mark',
      'sword fight': 'sword demonstration',
      'combat': 'competition',
      'war': 'adventure',
      'enemy': 'challenger',
      'rage': 'determination',
      'fury': 'intensity'
    };

    for (const [problematic, safe] of Object.entries(replacements)) {
      sanitized = sanitized.replace(new RegExp(problematic, 'gi'), safe);
    }

    // Add family-friendly context
    sanitized = `Create a magical adventure scene: ${sanitized}. Style: heroic and family-friendly, perfect for children. No text in the image.`;

    const result: SanitizedPromptResult = {
      sanitizedPrompt: sanitized,
      success: false, // Mark as fallback
      originalPrompt,
      processingTimeMs: Date.now() - startTime
    };

    console.log('🔧 Fallback sanitization completed in', result.processingTimeMs + 'ms');
    
    return result;
  }

  // Clear cache periodically to prevent memory issues
  clearCache() {
    this.sanitizationCache.clear();
    console.log('🗑️ AI Sanitizer: Cache cleared');
  }
}

// Singleton instance
export const aiPromptSanitizer = new AIPromptSanitizer();

// Export types for use in other files
export type { SanitizedPromptResult };
