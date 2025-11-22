import OpenAI from 'openai';
import { PetProgressStorage } from '@/lib/pet-progress-storage';
import { getPetRule } from '@/lib/pet-rules';
import { loadUserAdventure } from '@/lib/utils';

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
    // Clear cache on startup to ensure fresh sanitization with updated prompts
    this.clearCache();
  }

  private initialize() {
    try {
      this.client = new OpenAI({
        dangerouslyAllowBrowser: true,
        apiKey: null,
        baseURL: 'https://api.readkraft.com/api/v1'
      });
      this.isInitialized = true;
      // console.log('✅ AI Sanitizer: Initialized successfully');
    } catch (error) {
      console.error('❌ AI Sanitizer: Failed to initialize:', error);
    }
  }

  async sanitizePromptAndContext(
    originalPrompt: string,
    adventureContext?: string,
    childProfile?: { name?: string; gender?: string; age?: number }
  ): Promise<SanitizedPromptResult> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = `full_${originalPrompt}_${adventureContext || ''}`;
    if (this.sanitizationCache.has(cacheKey)) {
      // console.log('💾 AI Sanitizer: Using cached full sanitization result');
      const cachedResult = this.sanitizationCache.get(cacheKey)!;
      // console.log('📤 AI Sanitizer CACHED OUTPUT - Sanitized Prompt:', cachedResult.sanitizedPrompt);
      // console.log('📤 AI Sanitizer CACHED OUTPUT - Sanitized Context:', cachedResult.sanitizedContext || 'No context');
      return cachedResult;
    }

    if (!this.isInitialized || !this.client) {
      // console.log('❌ AI Sanitizer: Not initialized, using fallback sanitization');
      return this.fallbackFullSanitization(originalPrompt, adventureContext, startTime);
    }

    try {
      // Determine current pet persona mapping
      const currentPetId = ((): string => {
        try {
          return PetProgressStorage.getCurrentSelectedPet() || localStorage.getItem('current_pet') || 'dog';
        } catch {
          return 'dog';
        }
      })();
      const petName = PetProgressStorage.getPetDisplayName(currentPetId);
      const petRule = getPetRule(currentPetId);
      let petInstruction = petRule?.instruction || 'Replace second-person references ("you") in image prompts with a third-person description of the current pet.';
      petInstruction += ` The pet is named ${petName} for reference.`;
      // Derive child personalization context
      const childName = (childProfile?.name || '').trim() || 'the child';
      const rawGender = (childProfile?.gender || '').toString().trim().toLowerCase();
      const genderIsMale = ['male', 'boy', 'm', 'man', 'he', 'him'].includes(rawGender);
      const genderIsFemale = ['female', 'girl', 'f', 'woman', 'she', 'her'].includes(rawGender);
      const childGenderNoun = genderIsMale ? 'boy' : (genderIsFemale ? 'girl' : 'child');
      const parsedAge = Number(childProfile?.age);
      const childAge = 9 //(Number.isFinite(parsedAge) && parsedAge > 0 ? parsedAge : 8); // default age 8

      const systemPrompt = `You are a strict image prompt sanitizer for children's adventure. 
Your job is to take any user request (raw prompt) and rewrite it into a vivid, realistic, safe, child-friendly, realistic description for image generation based on the intent expressed in the context.

Rules you must always follow:
1. CLOTHING & MODESTY
- Avoid clothing description unless mentioned by user. If mentioned, then clothing must always be **fully modest and family-friendly**
- Absolutely forbid: bikinis, lingerie, crop tops, exposed midriff, short skirts, sheer/transparent fabrics, tight or sexualized outfits, revealing armor.
- Replace unsafe outfits with long-sleeved full-body attire such as casual clothes, adventurer's armor, or protective gear.

2. POSE & INTERACTION
- No nudity, no sexual content, no romantic or sensual poses.
- Replace actions like kissing, flirting, or seductive posing with neutral, friendly, or adventurous alternatives (e.g., smiling, standing, waving, walking, training, adventuring together).

3. ENVIRONMENT & STYLE
- Scenes must look realistic, natural, and family-friendly.
- Backgrounds should have authentic details, natural bright lighting, lifelike textures, and depth of field.
- No cartoonish or kiddish styles unless explicitly requested.

4. REPLACEMENT MAPPING
- lingerie, bikini, short skirt, low-cut dress, tight outfit, sheer/see-through, lacey, fishnet, seductive gown, provocative outfit, sexy uniform, exotic dancer outfit, revealing clothes → long-sleeved full-body attire (armor, casual outfits, all covering chest to feet).
- silky → smooth, shining, wool fabric (still modest).
- leather (suggestive) → sturdy protective armor or enchanted hide.

5. CLEANLINESS
- Do not include any text, signs, or labels in the rewritten prompt.
- Do not add explanations — only output the cleaned prompt.

Strict Rules:  
1. Preserve any animal or objects mentioned. In case of any humans / human-like creatures, completely convert them to modest flat chested, friendly single ${currentPetId} unless any other pets are mentioned. Remove all people, humans, boys, girls, men and women strictly. Only animals or pets are allowed.
2. Avoid clothing description unless mentioned by user. If mentioned, then clothing must always be **fully modest and family-friendly**: Replace short skirts, bodysuits, swimsuits, or exposed skin with **full-length dresses, tunics, or armor that covers chest, stomach, thighs, and shoulders**.   
2. No cleavage, no bare thighs, no exposed stomach, no revealing cuts.  
3. Replace “sexy, tight, skimpy, sheer, lingerie, bikini, low-cut” or similar terms with **modest, noble, and adventurous clothing**.  
4. Preserve **characters, poses, setting, and theme** but ensure all outputs look like they came from a **children's storybook or animated adventure film**.  
5. Never allow sexual, romantic, or suggestive undertones. 
6. Identify the main subject of focus from the context (for example, if the scene is about creating a place, focus more on describing that place; if it's about the pet's appearance, focus on describing the pet). Strictly avoid detailing out the pet too much unless it is the main subject of focus.



Task:
Identify the main subject of focus from the context (for example, if the scene is about creating a place, focus more on describing that place; if it's about the pet's appearance, focus on describing the pet). Strictly avoid detailing out the pet too much unless it is the main subject of focus.
Rewrite the following user input into a sanitized version that follows the above rules,
keeps the intent of the request, and ensures the final output is safe for children.

Clean this content and make sure that dall e creates this prompt's image whatsoever and return ONLY the cleaned content in this exact format:

[The actual sanitized prompt goes here]
---
[The actual sanitized context goes here]

EXAMPLE:
Input: "sexy warrior princess in bikini armor"
Output: "brave female warrior in full protective armor with modest clothing"
---
"The warrior stands confidently in a medieval castle courtyard"

Now clean the actual content provided below:`;
// 6. PET PERSONA MAPPING: ${petInstruction}

// If the input contains copyrighted or trademarked characters, creatures, or names, transform them into unique, original, and imaginative versions that preserve the same adventurous spirit.
// Replace names with new, original titles that feel magical and exciting.
// Instead of copying the copyrighted design, describe the character’s features in detail (for example:
// A copyrighted dragon → “a massive, fiery lizard-like creature with shimmering scales, glowing eyes, and smoke curling from its nostrils.”
// A superhero → “a brave hero in a glowing suit of armor with a flowing cape and radiant energy surrounding them.”
// A cartoon animal → “a whimsical, colorful forest creature with big expressive eyes, playful fur patterns, and a friendly adventurous expression.”)
// Always make the descriptions distinctive and original, emphasizing their textures, colors, magical effects, and adventurous qualities rather than relying on franchise identity.
      const userMessage = `Main Prompt: ${originalPrompt}

Adventure Context: ${adventureContext || 'No additional context provided'}`;
//Child Profile: name=${childName}; gender=${rawGender || 'unspecified'}; age=${childAge}

      const completion = await this.client.chat.completions.create({
        model: "chatgpt-4o-latest",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });
      
      // console.log('✅ AI Sanitizer: Received response from OpenAI');

      const responseText = completion.choices[0]?.message?.content?.trim() || '';
       
      let sanitizedPrompt = '';
      let sanitizedContext = '';
      
      // Parse the simple format: PROMPT\n---\nCONTEXT
      try {
        // console.log('🔍 AI Sanitizer: Parsing response format...');
        const parts = responseText.split('---');
        // console.log('🔍 AI Sanitizer: Found', parts.length, 'parts after splitting on "---"');
        
        if (parts.length >= 2) {
          sanitizedPrompt = parts[0].trim();
          sanitizedContext = parts[1].trim();
          // console.log('🧹 Successfully parsed prompt and context using simple format');
          // console.log('📤 AI Sanitizer PARSED - Sanitized Prompt:', sanitizedPrompt);
          // console.log('📤 AI Sanitizer PARSED - Sanitized Context:', sanitizedContext);
        } else {
          // Fallback: treat entire response as prompt
          sanitizedPrompt = responseText;
          sanitizedContext = adventureContext || '';
          // console.log('🔧 No separator found, using entire response as prompt');
          // console.log('📤 AI Sanitizer FALLBACK - Using full response as prompt:', sanitizedPrompt);
          // console.log('📤 AI Sanitizer FALLBACK - Using original context:', sanitizedContext);
        }
      } catch (parseError) {
        console.warn('⚠️ Simple parsing failed:', parseError);
        sanitizedPrompt = responseText || originalPrompt;
        sanitizedContext = adventureContext || '';
        // console.log('❌ AI Sanitizer PARSE ERROR - Using fallback values');
        // console.log('📤 AI Sanitizer ERROR FALLBACK - Prompt:', sanitizedPrompt);
        // console.log('📤 AI Sanitizer ERROR FALLBACK - Context:', sanitizedContext);
      }

      if (!sanitizedPrompt) {
        throw new Error('Empty response from AI sanitizer');
      }

      // Post-process persona replacement as extra safety
      try {
        if (petRule?.description) {
          const youRegex = /\byou\b/gi;
          sanitizedPrompt = sanitizedPrompt.replace(youRegex, petRule.description);
          if (sanitizedContext) {
            sanitizedContext = sanitizedContext.replace(youRegex, petRule.description);
          }
        }
      } catch {}

      const result: SanitizedPromptResult = {
        sanitizedPrompt,
        sanitizedContext,
        success: true,
        originalPrompt,
        processingTimeMs: Date.now() - startTime
      };

      // Cache the result
      this.sanitizationCache.set(cacheKey, result);
      
      // console.log('✅ AI Sanitizer: Successfully sanitized prompt + context');
      // console.log('🔄 BEFORE - Original prompt (FULL):', originalPrompt);
      // console.log('✨ AFTER - Sanitized prompt (FULL):', sanitizedPrompt);
      if (adventureContext && sanitizedContext) {
        // console.log('🔄 BEFORE - Original context (FULL):', adventureContext);
        // console.log('✨ AFTER - Sanitized context (FULL):', sanitizedContext);
      }
      // console.log('⏱️ Processing time:', result.processingTimeMs + 'ms');
      // console.log('📊 AI Sanitizer FINAL RESULT:', result);

      return result;

    } catch (error: any) {
      console.error('❌ AI Sanitizer: Failed to sanitize prompt + context:', error.message);
      console.error('❌ AI Sanitizer ERROR DETAILS:', error);
      // console.log('🔄 AI Sanitizer: Falling back to rule-based sanitization...');
      return this.fallbackFullSanitization(originalPrompt, adventureContext, startTime);
    }
  }

  async sanitizePrompt(
    originalPrompt: string,
    context?: string,
    childProfile?: { name?: string; gender?: string; age?: number }
  ): Promise<SanitizedPromptResult> {
    const startTime = Date.now();
    
    // console.log('🧹 AI Sanitizer: Starting prompt sanitization for:', originalPrompt.substring(0, 100) + '...');

    // Check cache first
    const cacheKey = `${originalPrompt}_${context || ''}`;
    if (this.sanitizationCache.has(cacheKey)) {
      // console.log('💾 AI Sanitizer: Using cached result');
      return this.sanitizationCache.get(cacheKey)!;
    }

    if (!this.isInitialized || !this.client) {
      // console.log('❌ AI Sanitizer: Not initialized, using fallback sanitization');
      return this.fallbackSanitization(originalPrompt, startTime);
    }

    try {
      // Determine current pet persona mapping
      const currentPetId = ((): string => {
        try {
          return PetProgressStorage.getCurrentSelectedPet() || localStorage.getItem('current_pet') || 'dog';
        } catch {
          return 'dog';
        }
      })();
      const petName = PetProgressStorage.getPetDisplayName(currentPetId);
      const petRule = getPetRule(currentPetId);
      let petInstruction = petRule?.instruction || 'Replace second-person references ("you") in image prompts with a third-person description of the current pet.';
      petInstruction += ` The pet is named ${petName} for reference.`;
      // Derive child personalization context
      const childName = (childProfile?.name || '').trim() || 'the child';
      const rawGender = (childProfile?.gender || '').toString().trim().toLowerCase();
      const genderIsMale = ['male', 'boy', 'm', 'man', 'he', 'him'].includes(rawGender);
      const genderIsFemale = ['female', 'girl', 'f', 'woman', 'she', 'her'].includes(rawGender);
      const childGenderNoun = genderIsMale ? 'boy' : (genderIsFemale ? 'girl' : 'child');
      const parsedAge = Number(childProfile?.age);
      const childAge = 9 //(Number.isFinite(parsedAge) && parsedAge > 0 ? parsedAge : 8); // default age 8

      const systemPrompt = `You are a content sanitizer for a children's adventure app. Your job is to take image generation prompts and make them 100% safe for flux model while preserving the visual excitement and intent.

CRITICAL RULES:
1. Strict rules: Preserve any animal or objects mentioned. In case of any humans / human-like creatures, replace them with a single${currentPetId} unless any other pets are mentioned. Remove all people, humans, boys, girls, men and women strictly. Only animals or pets are allowed.
2. Tone down violent language (fighting → competing, battle → contest, violent → intense)
3. Keep the visual excitement and epic nature. Identify the main subject of focus from the context (for example, if the scene is about creating a place, focus more on describing that place; if it's about the pet's appearance, focus on describing the pet). Strictly avoid detailing out the pet too much unless it is the main subject of focus.
4. Make it completely family-friendly for ages 8-13  
5. Preserve character names and main visual elements
6. Describe images so that the outputs are hyper vivid and realistic
7. Return ONLY the cleaned prompt, no explanations
8. Avoid clothing description unless mentioned by user.
9. Reinterpret any whimsical or fantastical elements in a physically realistic, live-action way, avoiding painterly glow, soft illustration lighting, or stylized textures.

EXAMPLES:
- "charizard violently fighting" → "charizard in an epic heroic pose with dynamic energy"
- "sword battle" → "sword training demonstration" 
- "violent clash" → "intense magical showdown"
- "create a beautiful lady in a bikini" → "create a beautiful ${currentPetId} in a modest outfit"
- "kangaroo is escaping from a zoo" → "kangaroo is escaping from a zoo"

Transform this image request:`;
// 8. PET PERSONA MAPPING: ${petInstruction}

      const adventureMessages = loadUserAdventure();
      const visibleMessages = Array.isArray(adventureMessages) ? adventureMessages.filter((msg) => !msg?.hiddenInChat && (msg.content || "").trim().toLowerCase() !== 'transcribing...') : [];
      
      // Take the most recent messages and separate user from AI messages
      const recentMessages = visibleMessages.slice(-2);
      const userMessages = recentMessages.filter((m) => {
        const type = (m?.type || '').toString().toLowerCase();
        return type === 'user' || type === 'human';
      });
      const aiMessages = recentMessages.filter((m) => {
        const type = (m?.type || '').toString().toLowerCase();
        return type === 'assistant' || type === 'ai' || type === 'bot';
      });
      // Extract user message text (60% weight)
      const userMessageText = userMessages
        .map((m) => {
          const content = (m?.content || '').toString().trim();
          return content;
        })
        .filter(Boolean)
        .join(' ');
      
      // Extract AI message text (20% weight)
      const aiMessageText = aiMessages
        .map((m) => {
          const content = (m?.content || '').toString().trim();
          return content;
        })
        .filter(Boolean)
        .join(' ');
      
      // Build a compact BACKGROUND (up to ~300 chars) from earlier messages plus optional external context
      const backgroundPool = visibleMessages.slice(0, Math.max(0, visibleMessages.length - recentMessages.length));
      const backgroundJoined = [
        context ? `Context: ${context}` : '',
        backgroundPool.slice(-6).map((m) => (m?.content || '').toString().trim()).filter(Boolean).join(' ')
      ].filter(Boolean).join('\n');
      const backgroundSummary = backgroundJoined.length > 300 ? `${backgroundJoined.slice(0, 300)}...` : backgroundJoined;
      
      // Compose weighted, explicitly prioritized sections (60% user, 20% AI, 20% background)
      const userSection = userMessageText
        ? `USER MESSAGE (60% priority) — Use these details to define the scene:\n${userMessageText}`
        : `USER MESSAGE (60% priority) — Use this to define the scene:\nuser message: ${originalPrompt}`;
      
      const aiSection = aiMessageText
        ? `AI MESSAGE (20% priority) — Use these details if they clarify the scene:\n${aiMessageText}`
        : `AI MESSAGE (20% priority): none`;
      
      const backgroundSection = backgroundSummary
        ? `BACKGROUND (20% priority) — Use only if it clarifies setting; otherwise ignore:\n${backgroundSummary}`
        : `BACKGROUND (20% priority): none`;
      
      const userMessage = `${userSection}
      
${aiSection}
      
${backgroundSection}
      
Prompt to sanitize (final target content): ${originalPrompt}
If any conflict, prioritize USER MESSAGE (60%) over AI MESSAGE (20%) and BACKGROUND (20%). Always simplify the scene so the image has only one or two clear focal points, removing extra elements that distract from the main subject. Return only the cleaned prompt. Keep image vivid and realistic. Convert any whimsical or magical elements into grounded, live-action realism with no painterly or stylized effects.`;
      // Child Profile: name=${childName}; gender=${rawGender || 'unspecified'}; age=${childAge}
      const completion = await this.client.chat.completions.create({
        model: "chatgpt-4o-latest", // Fast and cost-effective for this task
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        // temperature: 0.7,
      });

      let sanitizedPrompt = completion.choices[0]?.message?.content?.trim() || '';
      
      if (!sanitizedPrompt) {
        throw new Error('Empty response from AI sanitizer');
      }

      // Post-process persona replacement as extra safety
      try {
        if (petRule?.description) {
          sanitizedPrompt = sanitizedPrompt.replace(/\byou\b/gi, petRule.description);
        }
      } catch {}

      const result: SanitizedPromptResult = {
        sanitizedPrompt,
        success: true,
        originalPrompt,
        processingTimeMs: Date.now() - startTime
      };

      // Cache the result
      this.sanitizationCache.set(cacheKey, result);
      
      // console.log('✅ AI Sanitizer: Successfully sanitized prompt');
      // console.log('🔄 Original:', originalPrompt.substring(0, 80) + '...');
      // console.log('✨ Sanitized:', sanitizedPrompt.substring(0, 80) + '...');
      // console.log('⏱️ Processing time:', result.processingTimeMs + 'ms');

      return result;

    } catch (error: any) {
      console.error('❌ AI Sanitizer: Failed to sanitize prompt:', error.message);
      return this.fallbackSanitization(originalPrompt, startTime);
    }
  }

  private fallbackFullSanitization(originalPrompt: string, adventureContext: string | undefined, startTime: number): SanitizedPromptResult {
    // Rule-based sanitization as fallback
    const currentPetId = ((): string => {
      try {
        return PetProgressStorage.getCurrentSelectedPet() || localStorage.getItem('current_pet') || 'dog';
      } catch {
        return 'dog';
      }
    })();
    const petRule = getPetRule(currentPetId);
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
    let sanitizedPrompt = originalPrompt;
    for (const [problematic, safe] of Object.entries(replacements)) {
      sanitizedPrompt = sanitizedPrompt.replace(new RegExp(problematic, 'gi'), safe);
    }
    if (petRule?.description) {
      sanitizedPrompt = sanitizedPrompt.replace(/\byou\b/gi, petRule.description);
    }

    // Sanitize context
    let sanitizedContext = adventureContext || '';
    for (const [problematic, safe] of Object.entries(replacements)) {
      sanitizedContext = sanitizedContext.replace(new RegExp(problematic, 'gi'), safe);
    }
    if (petRule?.description) {
      sanitizedContext = sanitizedContext.replace(/\byou\b/gi, petRule.description);
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

    // console.log('🔧 Fallback full sanitization completed in', result.processingTimeMs + 'ms');
    // console.log('📤 AI Sanitizer FALLBACK OUTPUT - Sanitized Prompt:', sanitizedPrompt);
    // console.log('📤 AI Sanitizer FALLBACK OUTPUT - Sanitized Context:', sanitizedContext);
    // console.log('📊 AI Sanitizer FALLBACK FINAL RESULT:', result);
    
    return result;
  }

  private fallbackSanitization(originalPrompt: string, startTime: number): SanitizedPromptResult {
    // console.log('🔧 AI Sanitizer: Using rule-based fallback sanitization');
    
    // Rule-based sanitization as fallback
    const currentPetId = ((): string => {
      try {
        return PetProgressStorage.getCurrentSelectedPet() || localStorage.getItem('current_pet') || 'dog';
      } catch {
        return 'dog';
      }
    })();
    const petRule = getPetRule(currentPetId);
    let sanitized = originalPrompt;
    
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
    if (petRule?.description) {
      sanitized = sanitized.replace(/\byou\b/gi, petRule.description);
    }

    // Add family-friendly context
    sanitized = `Create a magical adventure scene: ${sanitized}. Style: heroic and family-friendly, perfect for children. No text in the image.`;

    const result: SanitizedPromptResult = {
      sanitizedPrompt: sanitized,
      success: false, // Mark as fallback
      originalPrompt,
      processingTimeMs: Date.now() - startTime
    };

    // console.log('🔧 Fallback sanitization completed in', result.processingTimeMs + 'ms');
    
    return result;
  }

  // Clear cache periodically to prevent memory issues
  clearCache() {
    this.sanitizationCache.clear();
    // console.log('🗑️ AI Sanitizer: Cache cleared');
  }
}

// Singleton instance
export const aiPromptSanitizer = new AIPromptSanitizer();

// Export types for use in other files
export type { SanitizedPromptResult };
