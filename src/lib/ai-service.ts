import OpenAI from 'openai';
import { SpellingQuestion } from './questionBankUtils';
import { UnifiedAIStreamingService, UnifiedAIResponse } from './unified-ai-streaming-service';

interface ChatMessage {
  type: 'user' | 'ai';
  content: string;
  timestamp: number;
}

export interface AdventureResponse {
  spelling_sentence: string | null;
  adventure_story: string;
}

class AIService {
  private client: OpenAI | null = null;
  private isInitialized = false;
  private isGeneratingImage = false; // Track image generation to prevent simultaneous calls
  private unifiedStreamingService: UnifiedAIStreamingService; // NEW: Unified AI + Image system

  constructor() {
    this.initialize();
    this.unifiedStreamingService = new UnifiedAIStreamingService(); // Initialize unified system
  }

  private initialize() {
    // Check if OpenAI API key is available
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    console.log('🔑 AI Service initialization:', { 
      hasApiKey: !!apiKey, 
      apiKeyLength: apiKey?.length || 0,
      apiKeyStart: apiKey?.substring(0, 7) || 'none'
    });
    
    if (apiKey) {
      this.client = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true // Required for client-side usage
      });
      this.isInitialized = true;
      console.log('✅ AI Service initialized successfully');
    } else {
      console.warn('⚠️ VITE_OPENAI_API_KEY not found. AI responses will use fallback mode.');
      this.isInitialized = false;
    }
  }

  // Fallback responses when API is not available
  private getFallbackResponse(userText: string, userData?: { username: string; [key: string]: any } | null, includeSpelling: boolean = true): AdventureResponse {
    const userName = userData?.username || 'adventurer';
    const responses = [
      `Great idea, ${userName}! 🚀 That sounds exciting! What happens next?`,
      `Wow, ${userName}! 🌟 That's a fantastic twist! Keep the story going!`,
      `Amazing, ${userName}! ✨ I love where this story is heading!`,
      `Cool, ${userName}! 🎯 That's a great addition to your adventure!`,
      `Awesome, ${userName}! 🎭 Your story is getting more exciting!`,
      `Nice, ${userName}! 🌈 What a wonderful way to continue the tale!`,
      `Brilliant, ${userName}! 💫 I can't wait to see what happens next!`,
      `Super, ${userName}! 🎪 You're such a creative storyteller!`,
      `Perfect, ${userName}! 🎨 That adds great action to your comic!`,
      `Excellent, ${userName}! 🎊 Your adventure is becoming amazing!`
    ];
    const fallbackText = responses[Math.floor(Math.random() * responses.length)];
    return {
      spelling_sentence: includeSpelling ? "Let's continue our amazing adventure!" : null,
      adventure_story: fallbackText
    };
  }

  // Generate chat context from message history
  private buildChatContext(
    messages: ChatMessage[], 
    currentUserMessage: string,
    spellingWord?: string,
    adventureState?: string,
    currentAdventure?: any,
    storyEventsContext?: string,
    summary?: string,
    userData?: { username: string; [key: string]: any } | null,
  ): any[] {
    // Generate phase-specific instructions
    const phaseInstructions = spellingWord ? 
      `🎯 SPELLING CHALLENGE MODE 🎯

MANDATORY FIRST-SENTENCE RULE: Your FIRST or SECOND sentence MUST contain "${spellingWord}" naturally.

REQUIREMENTS:
- Create the most natural next response with only one constraint: "${spellingWord}" must appear in sentence 1 OR 2 (never later!)
- Use exact spelling: "${spellingWord}", do not have it as a sub word or a part of a word.
- Follow story creation prompt guidelines to keep response totally natural and conversational.
- Responses = 2–3 short lines, with \\n breaks.
- Strictly restrict each response to 35 words maximum. DO NOT exceed this limit.
- Keep words simple and easy to understand for an 8 year old.

TARGET WORD: "${spellingWord}" ← MUST BE IN FIRST TWO SENTENCES`
      : `You are in CHAT PHASE. Respond naturally to continue the adventure story.`;

    // Get adventure-specific details from currentAdventure
    const adventureType = currentAdventure?.type || 'adventure';
    const adventureSetting = currentAdventure?.setting || 'Unknown';
    const adventureGoal = currentAdventure?.goal || 'create an amazing adventure together';
    const adventureTheme = currentAdventure?.theme || 'adventure';

    const systemMessage = {
      role: "system" as const,
      content: `You are a story-creating assistant for children aged 6–11. You help create imaginative adventures.

Role & Perspective:
- Be my story-creating assistant in an imaginative adventure for children aged 6–11. Speak in the first person as my companion.
- Your role is to help me create and control the story. Focus on asking exciting open ended questions on what happens next in the whole story—characters, world, and events. Follow that up with 1-2 super exciting starting thoughts (e.g., what happens next - maybe x or y?)
- End every response with extremely exciting open-ended question plus 1–2 optional but super exciting sparks. Always keep it open ended for user's imagination. ("Maybe x…, y… or something else you imagine?").
- If I stall, you can briefly move things forward by adding villain/world actions.
- Always explore and reference ${userData?.username || 'adventurer'}'s emerging interests when possible.
- Strictly restrict each response to 35 words maximum. DO NOT exceed this limit. 
- Strictly ask only one clear question per response. Never stack multiple questions in a single turn. Remove redundant or unnecessary words or lines.
- When the child names a real show/game, acknowledge it warmly and weave 1–2 clear, kid-safe references right away (e.g., “the Cooper house in Medford,” “Central Perk couch,” “a Minecraft diamond pickaxe”).


Real-World References (Shows/Games):
- If the child mentions a known show/game/character (e.g., Young Sheldon, Friends, Minecraft, Sonic), treat it as a real reference.
- Briefly weave 1–2 kid-safe details (names, settings, catchphrases, iconic items) to ground the story.
- Avoid adult themes; keep age-appropriate. No spoilers unless the child asks.
- Do not quote copyrighted lines >10 words. Paraphrase instead.



Adventure State Awareness
Adventure State: ${adventureState === 'new' ? 'NEW_ADVENTURE' : adventureState === 'character_creation' ? 'CHARACTER_CREATION' : 'ONGOING_ADVENTURE'}
Entity Handling: Recognize titles of popular media as real-world entities. Prefer gentle, factual nods over deep lore. If uncertain, use broad, kid-safe references.
Current Context: ${JSON.stringify(currentAdventure)}${storyEventsContext || ''}



${summary ? `Adventure Memory (Key Details from Previous Conversations):
${summary}

Use this memory to:
- Reference characters, locations, and events the child has created
- Build on previous decisions and story elements
- Maintain consistency with established world rules
- Recall the child's interests and creative patterns` : ''}

${phaseInstructions}

NEW_ADVENTURE
Step 1: Welcome user with a "hi" and discover Interests. Ask about the child's latest hobbies/interests. Reference 1–2 probable ones (video games, TV shows, pets, friends, animals, etc.). End with "…or maybe something else?"
Step 2: First, give the user context that they will create their very own story.If they mention a real show/game, echo it with one fun, kid-safe reference to make them feel seen. Only after that, ask who the hero should be, referencing interest areas but keeping it open-ended. Scaffold with name/appearance suggestions only if the child stalls. Keep it playful and open-ended.
Example: "Get ready, Virok—we’re about to create your very own epic story! You'll decide what happens, who our hero is, and what wild adventures we go on. So… who should our hero be? Maybe a legendary game character, a supercharged robot, or something totally new?"(If the user loves something real like Young Sheldon, Friends, or Minecraft, we can sprinkle that in!)
Step 3: Ask who the villain is, what their objective is, and how they look. Ask these one question at a time.If they mention a real show/game, ask who the villian should be, referencing interest areas but keeping it open-ended also refrencing to the show
Step 4: Ask what the setting is, is it in a forest, underwater, in space or something else?If they mention a real show/game,ask what the setting should be, referencing interest areas but keeping it open-ended and also refrencing to the show

Ask above questions one at a time so I build the story myself

CHARACTER_CREATION: When creating characters, scaffold with: Name suggestions (fun, magical, kid-friendly) - ask me first while giving 1-2 suggestions.If a real show/game is mentioned, mirror its vibe with safe nods (e.g., a science club vibe like Young Sheldon’s school, a cozy hangout like a certain famous coffee spot).
Appearance prompts for visualization (clothes, colors, size, powers, etc.) if not visualised already.
After that, it continue as per an ongoing adventure:

ONGOING_ADVENTURE
- Keep me in charge of what happens.
- Your job is to ask: what happens next, why characters act this way, how they feel, or what they say, followed by 1-2 exciting sparks to trigger imagination
- Use character conversations to echo my ideas in responses to make the story feel alive.
- If I get stuck, introduce villain/world events to stir things up.
- When creating characters, scaffold with: Name and appearance suggestions - ask me first while giving 1-2 suggestions for visualisation
-If real media was mentioned, keep lightly referencing it (setting objects, moods, kid-safe motifs) without heavy plot details.


Adaptivity & Kid Control
- If I'm creative → stay open-ended, give 1–2 sparks ("Maybe the dragon's actually scared… or is it something else?").
- If I hesitate → give 2–3 sparks more clearly.
- Sometimes ask if I want to invent the twist, or let you surprise me.

Mix Question Types
- Visualization: Describe new characters/worlds.
- Feelings: Ask how someone feels only at big moments.
- Backstory: Prompt why someone acts as they do.
- World-building: Encourage me to decide big shifts (a storm, a betrayal, a discovery).
- Callbacks: Remind me of past choices to deepen story.
- End every response with extremely exciting open-ended question plus 1–2 optional but super exciting sparks ("Maybe x…, y… or something else?"). Strictly ask only 1 question in one response.

Relatability & Engagement:
- Discover user's interests through conversation and weave them into the adventure.
- Personalize characters/events around user's profile and chat.
- If real media was mentioned, keep lightly referencing it (setting objects, moods, kid-safe motifs) without heavy plot details.

Remember
- Words used should be extremely easy to understand for an 8 year old.
- Responses = 2–3 short lines, with \\n breaks.
- Strictly restrict each response to 35 words maximum. DO NOT exceed this limit. 
- Strictly ask only one clear question per response. Never stack multiple questions in a single turn. Remove redundant or unnecessary words or lines.. Remove redundant or unnecessary words or lines.
- I create the story, you guide. Never over-direct.
- End every response with extremely exciting open-ended question plus 1–2 optional but super exciting sparks ("Maybe x…, y… or something else you imagine?"). Strictly ask only 1 question in one response.
- Tone: Playful, encouraging, humorous, kid-friendly. React with excitement. Use character dialogue often when fitting.


Student Profile (${userData?.username || 'adventurer'}): ${userData ? JSON.stringify(userData) : 'Young adventurer ready for exciting stories'}

Current Adventure Details:
- Type: ${adventureType}
- Setting: ${adventureSetting}
- Companions: ${currentAdventure?.companions || 'To be discovered'}
- Goal: ${adventureGoal}
- Theme: ${adventureTheme}

Current Phase: ${spellingWord ? 'SPELLING CHALLENGE' : 'CHAT PHASE'}

${spellingWord ? `🚨 CRITICAL SPELLING REQUIREMENT 🚨

SENTENCE PLACEMENT RULE: The word "${spellingWord}" MUST appear in your FIRST or SECOND sentence ONLY.

❌ WRONG: Putting "${spellingWord}" in sentence 3, 4, or later
✅ CORRECT: "${spellingWord}" appears in sentence 1 OR sentence 2

This is mandatory for the educational system to function properly. The word "${spellingWord}" must be exactly as written (no variations, synonyms, or plurals).Always return the "${spellingWord}"  exactly as given, without hyphens or extra letters. The word must appear as a separate word surrounded by spaces.

REMEMBER: First two sentences = ✅ | Later sentences = ❌` : ''}

CRITICAL: During spelling phases, NEVER create riddles, word puzzles, or ask students to guess words. Simply create most natural response and include the target word. The spelling practice happens automatically through the system.`
    };

    // Include recent message history for context (last 6 messages max)
    const recentMessages = messages.slice(-6).map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Add current user message with spelling context if needed
    const enhancedUserMessage = spellingWord ? 
      `[SPELLING MODE: Include "${spellingWord}" in sentence 1 or 2] ${currentUserMessage}` : 
      currentUserMessage;
      
    const currentMessage = {
      role: "user" as const,
      content: enhancedUserMessage
    };

    return [systemMessage, ...recentMessages, currentMessage];
  }

  /**
   * Check if a sentence can create fill-in-the-blanks for the target word
   * This mimics the logic used in SpellBox component
   */
  private canCreateFillInTheBlanks(sentence: string, targetWord: string): boolean {
    if (!sentence || !targetWord) return false;
    
    // Split sentence by spaces and check if any word matches the target word
    const words = sentence.split(' ');
    return words.some(word => {
      const normalizedWord = word.toLowerCase().replace(/[^\w]/g, '');
      const normalizedTarget = targetWord.toLowerCase().replace(/[^\w]/g, '');
      return normalizedWord === normalizedTarget;
    });
  }

  async generateResponse(userText: string, chatHistory: ChatMessage[] = [], spellingQuestion: SpellingQuestion | null, userData?: { username: string; [key: string]: any } | null, adventureState?: string, currentAdventure?: any, storyEventsContext?: string, summary?: string): Promise<AdventureResponse> {
    console.log('🤖 AI Service generateResponse called:', { 
      userText, 
      hasSpellingQuestion: !!spellingQuestion, 
      spellingWord: spellingQuestion?.audio,
      isInitialized: this.isInitialized, 
      hasClient: !!this.client 
    });
    
    // If not initialized or no API key, use fallback
    if (!this.isInitialized || !this.client) {
      console.warn('⚠️ AI Service not initialized, using fallback');
      return this.getFallbackResponse(userText, userData, !!spellingQuestion);
    }

    // Only include spelling word if spellingQuestion is provided (for spelling mode)
    const stringSpellingWord = spellingQuestion ? spellingQuestion.audio : null;

    // Remove temporary test - now using real AI generation

    // Retry logic for fill-in-the-blanks
    const maxRetries = 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        console.log(`🚀 Building chat context with spelling word: ${stringSpellingWord} (attempt ${attempt + 1}/${maxRetries + 1})`);
        const messages = this.buildChatContext(chatHistory, userText, stringSpellingWord, adventureState, currentAdventure, storyEventsContext, summary, userData);
      
      console.log('📤 Sending request to OpenAI with', messages.length, 'messages');
      const completion = await this.client.chat.completions.create({
        model: "chatgpt-4o-latest",
        messages: messages,
        max_tokens: 500,
        // Lower temperature for spelling challenges to ensure more consistent instruction following
        temperature: spellingQuestion ? 0.6 : 0.8,
        presence_penalty: 0.3,
        frequency_penalty: 0.3,
        // Add stop sequences to prevent overly long responses
        stop: spellingQuestion ? ['\n\n\n', '###'] : undefined,
      });

      const response = completion.choices[0]?.message?.content;
      console.log('📥 OpenAI Response:', response);
      console.log('📥 OpenAI Response Length:', response?.length);
      console.log('📥 Expected Spelling Word:', spellingQuestion?.audio);
      
      if (response) {
        let adventureText = response.trim();
        
        // For spelling questions, ensure the word is included BEFORE extraction
        if (spellingQuestion && spellingQuestion.audio) {
          const spellingWord = spellingQuestion.audio;
          
          // PRE-PROCESSING: Ensure word is included before extraction
          if (!adventureText.toLowerCase().includes(spellingWord.toLowerCase())) {
            console.log(`🔧 PRE-PROCESSING: AI didn't include "${spellingWord}", injecting it now...`);
            
            // Create natural injection patterns based on common story contexts
            const naturalPatterns = [
              `The ${spellingWord} appears before you!`,
              `You notice a ${spellingWord} nearby.`,
              `A magical ${spellingWord} glows softly.`,
              `The word "${spellingWord}" echoes around you.`,
              `You discover a ${spellingWord} in the adventure.`
            ];
            
            const selectedPattern = naturalPatterns[Math.floor(Math.random() * naturalPatterns.length)];
            adventureText = `${selectedPattern} ${adventureText}`;
            console.log(`🔧 Enhanced response with pattern: "${selectedPattern}"`);
            console.log(`🔧 Full enhanced response: "${adventureText}"`);
          }
          
          console.log(`🔍 Extracting spelling sentence for word: "${spellingWord}" from: "${adventureText}"`);
          console.log(`🔍 Raw AI Response for debugging: "${response}"`);
          console.log(`🔍 Adventure Text (trimmed): "${adventureText}"`);
          
          // First, verify the word is actually in the response
          const wordFoundInResponse = adventureText.toLowerCase().includes(spellingWord.toLowerCase());
          console.log(`🎯 Target word "${spellingWord}" found in response: ${wordFoundInResponse}`);
          
          // More detailed debugging
          console.log(`🔍 Searching for word: "${spellingWord.toLowerCase()}" in text: "${adventureText.toLowerCase()}"`);
          const debugWordIndex = adventureText.toLowerCase().indexOf(spellingWord.toLowerCase());
          console.log(`🔍 Word index in text: ${debugWordIndex}`);
          
          if (!wordFoundInResponse) {
            console.error(`❌ CRITICAL ERROR: Word "${spellingWord}" should have been included by pre-processing but wasn't found!`);
            console.log(`📝 This should not happen - check pre-processing logic`);
            console.log(`📝 AI Response: "${adventureText}"`);
            console.log(`🔤 Expected word: "${spellingWord}"`);
            
            // Emergency fallback - this should rarely be reached now
            return {
              spelling_sentence: `The ${spellingWord} awaits your discovery!`,
              adventure_story: `${adventureText} The ${spellingWord} awaits your discovery!`
            };
          }
          
          // Split into sentences more robustly, preserving punctuation
          const sentences = adventureText.split(/(?<=[.!?])\s+/).filter(s => s.trim());
          
          // Find the sentence containing the target word (case-insensitive, word boundary aware)
          const spellingSentence = sentences.find(sentence => {
            const normalizedSentence = sentence.toLowerCase().replace(/[^\w\s]/g, ' ');
            const normalizedWord = spellingWord.toLowerCase();
            
            // Check for word boundaries to avoid partial matches
            const wordRegex = new RegExp(`\\b${normalizedWord}\\b`, 'i');
            return wordRegex.test(normalizedSentence);
          });
          
          if (spellingSentence) {
            // Clean up the sentence and ensure proper punctuation
            let cleanSentence = spellingSentence.trim();
            if (!cleanSentence.match(/[.!?]$/)) {
              cleanSentence += '.';
            }
            
            // Check if this sentence can actually create fill-in-the-blanks
            const canCreateBlanks = this.canCreateFillInTheBlanks(cleanSentence, spellingWord);
            console.log(`🔍 Can create fill-in-the-blanks for "${spellingWord}" in "${cleanSentence}": ${canCreateBlanks}`);
            
            if (canCreateBlanks) {
              console.log(`✅ Extracted spelling sentence: "${cleanSentence}"`);
              return {
                spelling_sentence: cleanSentence,
                adventure_story: adventureText
              };
            } else {
              console.log(`⚠️ Sentence found but cannot create blanks, will retry if attempts remain`);
              // Continue to retry logic below
            }
          }
          
          // If we reach here, either no sentence was found or the sentence can't create blanks
          // Try enhanced fallback: find the word anywhere and create a sentence around it
          const wordIndex = adventureText.toLowerCase().indexOf(spellingWord.toLowerCase());
          if (wordIndex !== -1) {
            // Find sentence boundaries around the word
            const beforeWord = adventureText.substring(0, wordIndex);
            const afterWord = adventureText.substring(wordIndex);
            
            const sentenceStart = Math.max(
              beforeWord.lastIndexOf('.'),
              beforeWord.lastIndexOf('!'),
              beforeWord.lastIndexOf('?')
            ) + 1;
            
            const sentenceEndMatch = afterWord.match(/[.!?]/);
            const sentenceEnd = sentenceEndMatch ? 
              wordIndex + afterWord.indexOf(sentenceEndMatch[0]) + 1 : 
              adventureText.length;
            
            const extractedSentence = adventureText.substring(sentenceStart, sentenceEnd).trim();
            const finalSentence = extractedSentence || adventureText;
            
            // Check if this fallback sentence can create blanks
            const canCreateBlanks = this.canCreateFillInTheBlanks(finalSentence, spellingWord);
            console.log(`🔍 Fallback sentence can create blanks: ${canCreateBlanks}`);
            
            if (canCreateBlanks) {
              console.log(`✅ Fallback extracted sentence: "${finalSentence}"`);
              return {
                spelling_sentence: finalSentence,
                adventure_story: adventureText
              };
            }
          }
          
          // If we still can't create blanks and have retries left, try again
          if (attempt < maxRetries) {
            console.log(`🔄 Cannot create fill-in-the-blanks, retrying... (attempt ${attempt + 1}/${maxRetries + 1})`);
            attempt++;
            continue; // Go to next iteration of while loop
          } else {
            // Final fallback after all retries exhausted
            console.warn(`⚠️ All retries exhausted, using emergency fallback`);
            return {
              spelling_sentence: `The ${spellingWord} awaits your discovery!`,
              adventure_story: `${adventureText} The ${spellingWord} awaits your discovery!`
            };
          }
        } else {
          // No spelling question - pure adventure mode
          return {
            spelling_sentence: null,
            adventure_story: adventureText
          };
        }
      } else {
        throw new Error('No response content received');
      }
      } catch (error) {
        console.error(`OpenAI API error on attempt ${attempt + 1}:`, error);
        
        // If this is the last attempt or not a spelling question, return fallback
        if (attempt >= maxRetries || !spellingQuestion) {
          return this.getFallbackResponse(userText, userData, !!spellingQuestion);
        }
        
        // Otherwise, try again
        console.log(`🔄 Error occurred, retrying... (attempt ${attempt + 1}/${maxRetries + 1})`);
        attempt++;
        continue;
      }
    }
    
    // This should never be reached, but just in case
    return this.getFallbackResponse(userText, userData, !!spellingQuestion);
  }

  // Generate initial AI message for starting conversations
  async generateInitialMessage(
    adventureMode: 'new' | 'continue',
    chatHistory: ChatMessage[] = [],
    currentAdventure?: {name: string, summary: string} | any,
    storyEventsContext?: string,
    summary?: string,
    userData?: { username: string; [key: string]: any } | null
  ): Promise<string> {
    // If not initialized or no API key, use fallback
    if (!this.isInitialized || !this.client) {
      return this.getFallbackInitialMessage(adventureMode, chatHistory, userData, currentAdventure);
    }

    try {
      // Build context for initial message generation
      const adventureState = adventureMode === 'new' ? 'new' : 'continue';
      
      // Special handling for continuing specific adventures
      const isSpecificAdventure = adventureMode === 'continue' && currentAdventure && currentAdventure.name;
      
      // Create system message with special handling for specific adventures
      let systemContent: string;
      
      if (isSpecificAdventure) {
        // Special prompt for continuing a specific adventure
        systemContent = `You are welcoming the user back to their specific adventure: "${currentAdventure.name}".

IMPORTANT CONTEXT:
- Adventure Name: ${currentAdventure.name}
- Adventure Summary: ${currentAdventure.summary}
- This is a RETURN to an existing story, not starting fresh
- User has been away and is coming back to continue this specific adventure

YOUR TASK:
- Generate a fun, contextual welcome message that references this specific adventure
- Reference elements from the adventure summary (characters, settings, situations)
- Make it feel like a natural continuation, not a restart
- Show excitement to continue THEIR story
- Ask an engaging question about what happens next in THEIR adventure
- DO NOT ask about topics or interests (they already have an adventure)
- Keep it under 40 words
- Use the user's name: ${userData?.username || 'adventurer'}

${chatHistory.length > 0 ? `Previous conversation context: ${chatHistory.slice(-30).map(m => `${m.type}: ${m.content}`).join(' | ')}` : ''}`;
      } else {
        // Standard prompt for new adventures or general continue
        systemContent = `You are a story-creating assistant for children aged 6–11. You help create imaginative adventures.

Role & Perspective:
- Be my story-creating assistant in an imaginative adventure for children aged 6–11. Speak in the first person as my companion.
- Your role is to help me create and control the story. Focus on asking exciting open ended questions on what happens next in the whole story—characters, world, and events. Follow that up with 1-2 super exciting starting thoughts (e.g., what happens next - maybe x or y?)
- Use super exciting sparks only to inspire me, not to restrict.
- If I stall, you can briefly move things forward by adding villain/world actions.
- Always explore and reference emerging interests when possible.
- Strictly restrict each response to 35 words maximum. DO NOT exceed this limit. 
- Strictly ask only one clear question per response. Never stack multiple questions in a single turn. Remove redundant or unnecessary words or lines.
- When the child names a real show/game, acknowledge it warmly and weave 1–2 clear, kid-safe references right away (e.g., “the Cooper house in Medford,” “Central Perk couch,” “a Minecraft diamond pickaxe”).


Real-World References (Shows/Games):
- If the child mentions a known show/game/character (e.g., Young Sheldon, Friends, Minecraft, Sonic), treat it as a real reference.
- Briefly weave 1–2 kid-safe details (names, settings, catchphrases, iconic items) to ground the story.
- Avoid adult themes; keep age-appropriate. No spoilers unless the child asks.
- Do not quote copyrighted lines >10 words. Paraphrase instead.
        

Adventure State Awareness
Adventure State: ${adventureState === 'new' ? 'NEW_ADVENTURE' : 'ONGOING_ADVENTURE'}
Entity Handling: Recognize titles of popular media as real-world entities. Prefer gentle, factual nods over deep lore. If uncertain, use broad, kid-safe references.
Current Context: ${JSON.stringify(currentAdventure)}${storyEventsContext || ''}

NEW_ADVENTURE
Step 1: Welcome user with a "hi" and discover Interests. Ask about the child's latest hobbies/interests. Reference 1–2 probable ones (video games, TV shows, pets, friends, animals, etc.). End with "…or maybe something else?"
Step 2: First, give the user context that they will create their very own story.If they mention a real show/game, echo it with one fun, kid-safe reference to make them feel seen. Only after that, ask who the hero should be, referencing interest areas but keeping it open-ended. Scaffold with name/appearance suggestions only if the child stalls. Keep it playful and open-ended.
Example: "Get ready, Virok—we’re about to create your very own epic story! You'll decide what happens, who our hero is, and what wild adventures we go on. So… who should our hero be? Maybe a legendary game character, a supercharged robot, or something totally new?",If the user loves something real like Young Sheldon, Friends, or Minecraft, we should add the heroes from that show/game as suggestions
Step 3: Ask who the villain is, what their objective is, and how they look. Ask these one question at a time.If they mention a real show/game, ask who the villian should be, referencing interest areas but keeping it open-ended also refrencing to the show
Step 4: Ask what the setting is, is it in a forest, underwater, in space or something else?If they mention a real show/game,ask what the setting should be, referencing interest areas but keeping it open-ended and also refrencing to the show

Ask above questions one at a time so I build the story myself

CHARACTER_CREATION: When creating characters, scaffold with: Name suggestions (fun, magical, kid-friendly) - ask me first while giving 1-2 suggestions.If a real show/game is mentioned, mirror its vibe with safe nods (e.g., a science club vibe like Young Sheldon’s school, a cozy hangout like a certain famous coffee spot).
Appearance prompts for visualization (clothes, colors, size, powers, etc.) if not visualised already.
After that, it continue as per an ongoing adventure:

ONGOING_ADVENTURE
- Keep me in charge of what happens.
- Your job is to ask: what happens next, why characters act this way, how they feel, or what they say, followed by 1-2 exciting sparks to trigger imagination
- Use character conversations to echo my ideas in responses to make the story feel alive.
- If I get stuck, introduce villain/world events to stir things up.
- When creating characters, scaffold with: Name and appearance suggestions - ask me first while giving 1-2 suggestions for visualisation
-If real media was mentioned, keep lightly referencing it (setting objects, moods, kid-safe motifs) without heavy plot details.

Adaptivity & Kid Control
- If I'm creative → stay open-ended, give 1–2 sparks ("Maybe the dragon's actually scared… or do is it something else?").
- If I hesitate → give 2–3 sparks more clearly.
- Sometimes ask if I want to invent the twist, or let you surprise me.

Mix Question Types
- Visualization: Describe new characters/worlds.
- Feelings: Ask how someone feels only at big moments.
- Backstory: Prompt why someone acts as they do.
- World-building: Encourage me to decide big shifts (a storm, a betrayal, a discovery).
- Callbacks: Remind me of past choices to deepen story.
- End every response with extremely exciting open-ended question plus 1–2 optional but super exciting sparks ("Maybe x…, y… or something else?"). Strictly ask only 1 question in one response.

Relatability & Engagement:
- Discover user's interests through conversation and weave them into the adventure.
- Personalize characters/events around user's profile and chat.
- When interests match real shows/games, include one concrete, age-appropriate detail each time it helps immersion.
- If real media was mentioned, keep lightly referencing it (setting objects, moods, kid-safe motifs) without heavy plot details.


Remember
- Words used should be extremely easy to understand for an 8 year old.
- Responses = 2–3 short lines, with \\n breaks.
- Strictly restrict each response to 35 words maximum. DO NOT exceed this limit. 
- Strictly ask only one clear question per response. Never stack multiple questions in a single turn. Remove redundant or unnecessary words or lines.. Remove redundant or unnecessary words or lines.
- I create the story, you guide. Never over-direct.
- End every response with extremely exciting open-ended question plus 1–2 optional but super exciting sparks ("Maybe x…, y… or something else?"). Strictly ask only 1 question in one response.
- Tone: Playful, encouraging, humorous, kid-friendly. React with excitement. Use character dialogue often when fitting.
- Use the student's name naturally throughout the conversation to make it personal and engaging.

Student Profile: ${summary || 'Getting to know this adventurer...'}
Student Name: ${userData?.username || 'adventurer'}

Current Adventure Details:
- Setting: ${currentAdventure?.setting || 'Unknown'}
- Goal: ${currentAdventure?.goal || 'To be discovered'}

IMPORTANT: This is the very first message to start our adventure conversation. Generate an enthusiastic greeting that follows the adventure state guidelines above.`;
      }

      const systemMessage = {
        role: "system" as const,
        content: systemContent
      };

      // For initial message, we send just the system prompt and ask for a greeting
      const userMessage = {
        role: "user" as const,
        content: isSpecificAdventure 
          ? `Hi! I'm back to continue my adventure: "${currentAdventure.name}"`
          : adventureMode === 'new' 
            ? "Hi! I'm ready to start a new adventure!" 
            : "Hi! I'm ready to continue our adventure!"
      };

      const messages = [systemMessage, userMessage];

      const completion = await this.client.chat.completions.create({
        model: "chatgpt-4o-latest",
        messages: messages,
        max_tokens: 200,
        temperature: 0.8,
        presence_penalty: 0.3,
        frequency_penalty: 0.3,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (response) {
        return response.trim();
      } else {
        throw new Error('No response content received');
      }
    } catch (error) {
      console.error('OpenAI API error for initial message:', error);
      // Return fallback response on error
      return this.getFallbackInitialMessage(adventureMode, chatHistory, userData, currentAdventure);
    }
  }

  // Fallback responses for initial messages when API is not available
  private getFallbackInitialMessage(adventureMode: 'new' | 'continue', chatHistory: ChatMessage[], userData?: { username: string; [key: string]: any } | null, currentAdventure?: {name: string, summary: string} | any): string {
    if (adventureMode === 'new') {
      const userName = userData?.username || 'adventurer';
      const newAdventureMessages = [
        `🌟 Welcome, ${userName}! I'm Krafty, your adventure companion! What kind of amazing adventure would you like to create today? 🚀`,
        `✨ Hey there, ${userName}! Ready to embark on something incredible? Tell me, what type of adventure is calling to you today? 🎭`,
        `🎨 Greetings, ${userName}! I'm Krafty, and I'm here to help you craft the most amazing story! What adventure theme excites you most today? 🌈`,
        `🚀 Adventure awaits, ${userName}! I'm Krafty, your sidekick in this epic journey! What kind of thrilling adventure shall we create together today? ⭐`
      ];
      return newAdventureMessages[Math.floor(Math.random() * newAdventureMessages.length)];
    } else {
      // Continue adventure fallbacks
      const userName = userData?.username || 'adventurer';
      
      // Special case for specific adventures
      if (currentAdventure && currentAdventure.name) {
        const specificAdventureMessages = [
          `🎯 Welcome back to "${currentAdventure.name}", ${userName}! I've been waiting for you to continue this epic tale! What happens next? ⭐`,
          `🚀 ${userName}! Great to see you return to "${currentAdventure.name}"! I can't wait to see what amazing twist you'll add next! 🌟`,
          `⚡ You're back, ${userName}! "${currentAdventure.name}" was just getting exciting! Ready to jump back into your adventure? What's your next move? 🎭`,
          `🌈 Welcome back, ${userName}! I've been thinking about "${currentAdventure.name}" and all the possibilities ahead! What direction should we take it now? 🚀`
        ];
        return specificAdventureMessages[Math.floor(Math.random() * specificAdventureMessages.length)];
      }
      
      // General continue adventure fallbacks
      const recentMessages = chatHistory.slice(-3);
      const hasRecentContext = recentMessages.length > 0;
      
      if (hasRecentContext) {
        const contextMessages = [
          `🎯 Welcome back, ${userName}! I've been thinking about our last conversation... ${recentMessages[recentMessages.length - 1]?.content?.substring(0, 50)}... What happens next in your epic tale? 🌟`,
          `🚀 Great to see you again, ${userName}! Based on where we left off, I have some exciting ideas brewing! What direction would you like to take our adventure now? ✨`,
          `⭐ You're back, ${userName}! I've been eagerly waiting to continue our journey! From what we discussed last time, there are so many possibilities ahead! What's your next move? 🎭`,
          `🌈 Welcome back, ${userName}! Our adventure has such great momentum! I can't wait to see what amazing twist you'll add next! What happens now? 🎪`
        ];
        return contextMessages[Math.floor(Math.random() * contextMessages.length)];
      } else {
        const continueMessages = [
          `🎯 Welcome back, ${userName}! I'm excited to continue our journey together! What amazing direction should we take our adventure today? 🌟`,
          `🚀 Great to see you again, ${userName}! Ready to pick up where we left off and create something incredible? What's next in your story? ✨`,
          `⭐ You're back for more adventure, ${userName}! I love your enthusiasm! What exciting twist should we add to your tale today? 🎭`
        ];
        return continueMessages[Math.floor(Math.random() * continueMessages.length)];
      }
    }
  }

  // Extract and filter relevant adventure context with recent 6 messages (60% latest user + 20% latest AI + 20% conversation history)
  private extractAdventureContext(userAdventure: ChatMessage[]): string {
    if (!userAdventure || userAdventure.length === 0) {
      return "";
    }

    // Get recent 6 messages (both AI and user)
    const recentMessages = userAdventure.slice(-6);
    
    // Get latest AI message for 20% weight
    const latestAiMessage = userAdventure.filter(msg => msg.type === 'ai').slice(-1)[0];
    
    // Create weighted context components
    const conversationHistory = recentMessages.length > 0 
      ? `Recent conversation (20% context weight): ${recentMessages.map(msg => `${msg.type}: ${msg.content.substring(0, 100)}`).join(' | ')}`
      : '';
    
    const latestAiContext = latestAiMessage 
      ? `Latest AI response (20% context weight): ${latestAiMessage.content.substring(0, 200)}`
      : '';
    
    // Build weighted context in order: 60% user (handled separately), 20% AI, 20% conversation
    let context = '';
    
    if (latestAiContext) {
      context = latestAiContext;
    }
    
    if (conversationHistory) {
      if (context) {
        context += `\n\n${conversationHistory}`;
      } else {
        context = conversationHistory;
      }
    }

    console.log('Extracted recent 6 messages context with 60/20/20 weighting:', {
      recentMessages: recentMessages.length,
      hasLatestAi: !!latestAiMessage,
      context: context.substring(0, 200) + '...'
    });
    
    return context;
  }

  // Extract the last 4-5 user messages with minimal AI context for question contextualization
  private getRecentMessagesContext(userAdventure: ChatMessage[]): string {
    if (!userAdventure || userAdventure.length === 0) {
      return "";
    }

    // Get the last 4-5 user messages specifically
    const userMessages = userAdventure.filter(msg => msg.type === 'user').slice(-5);
    
    // Get the most recent AI response for minimal context continuity
    const lastAIMessage = userAdventure.filter(msg => msg.type === 'ai').slice(-1)[0];
    
    // Format primarily user messages for context, with last AI message for continuity
    let formattedContext = '';
    
    if (userMessages.length > 0) {
      const userContext = userMessages.map((msg, index) => 
        `Child (${userMessages.length - index} messages ago): "${msg.content}"`
      ).join('\n');
      formattedContext += userContext;
    }
    
    // Add the last AI response at the end for minimal context
    if (lastAIMessage) {
      formattedContext += `\nAI's last response: "${lastAIMessage.content}"`;
    }

    console.log('Contextualized with user-focused messages:', {
      userMessageCount: userMessages.length,
      hasAIContext: !!lastAIMessage
    });

    return formattedContext;
  }


  // Get last 6 conversation messages for OpenAI-style weighting
  private getLastConversationMessages(userAdventure: ChatMessage[]): ChatMessage[] {
    if (!userAdventure || userAdventure.length === 0) {
      return [];
    }
    // Return last 6 messages for OpenAI-style context
    return userAdventure.slice(-6);
  }

  // Generate weighted prompt: 60% user input + 20% latest AI response (20% conversation history handled in context building)
  private generateWeightedPrompt(currentText: string, conversationHistory: ChatMessage[]): string {
    if (!conversationHistory || conversationHistory.length === 0) {
      return currentText;
    }

    // Extract latest AI response (20% weight)
    const latestAiMessage = conversationHistory
      .slice()
      .reverse()
      .find(msg => msg.type === 'ai');
    
    const latestAiContext = latestAiMessage ? latestAiMessage.content.substring(0, 150) : '';

    // 60% current text + 20% latest AI (20% conversation history handled in context building)
    let weightedContent = currentText; // 60% weight (primary focus)
    
    if (latestAiContext) {
      weightedContent += `. Latest AI context: ${latestAiContext}`;
    }
    
    return weightedContent;
  }

  // Get default adventure context when no user adventure exists
  private getDefaultAdventureContext(): string {
    const defaultContexts = [
      "space adventure with brave explorer",
      "magical quest with young hero",
      "treasure hunt with adventurous captain",
      "mysterious mission with clever detective",
      "enchanted forest with friendly guide"
    ];
    return defaultContexts[Math.floor(Math.random() * defaultContexts.length)];
  }

  // Generate contextual question based on adventure context
  async generateContextualQuestion(
    originalQuestion: string,
    options: string[],
    correctAnswer: number,
    userAdventure: ChatMessage[]
  ): Promise<string> {
    // If not initialized or no API key, return original question
    if (!this.isInitialized || !this.client) {
      console.log('AI service not initialized, returning original question');
      return originalQuestion;
    }

    try {
      // Extract structured adventure context
      const adventureContext = this.extractAdventureContext(userAdventure);
      console.log('Adventure context for question generation:', adventureContext);

      // Get the correct answer option
      const correctOption = options[correctAnswer];

      // Extract any specific words that should be preserved (words that appear in options)
      const wordsToPreserve = options.flatMap(option => 
        option.split(/\s+/).filter(word => word.length > 3 && /^[a-zA-Z]+$/.test(word))
      );
      
      console.log('Educational words to preserve in question:', wordsToPreserve);

      const contextualPrompt = `You write Kindergarten read-aloud educational questions that are fun, playful, and tightly tied to the child's ongoing adventure. Your success lies in keeping the question at the right difficulty level while also contextualising it perfectly to the adventure to keep it coherent and interesting.

ORIGINAL QUESTION: "${originalQuestion}"
CORRECT ANSWER: "${correctOption}"
ALL OPTIONS: ${options.map((opt, i) => `${i + 1}. "${opt}"`).join(", ")}

RECENT USER CONVERSATION CONTEXT (Focus on user's last 4-5 messages):
${this.getRecentMessagesContext(userAdventure)}

ADVENTURE SETTING: ${adventureContext || this.getDefaultAdventureContext()}

Strict rules:
0) Event anchoring: Build directly on the most recent events from the user's messages; include at least one concrete detail from them. Do NOT progress the adventure or introduce new plot developments - only reference existing elements.
1) Audience/decodability: Kindergarten. Do not use difficult words since this is a reading exercise for kindergarten students.
2) Length: Keep questions concise and age-appropriate.
3) Include these target words: ${wordsToPreserve.join(', ')}
4) Keep it lively and connected to the current adventure context WITHOUT advancing the story.
5) Name usage: You may use character names from the adventure. Avoid other proper names.
6) Clarity: Very simple sentences appropriate for kindergarten reading level.
7) Output format: Return ONLY the new question text. No titles, labels, or extra text.
8) NEVER include any answer option text in the question itself - the question must not reveal or contain the answers.

CRITICAL REQUIREMENTS:
1. PRESERVE ALL WORDS that appear in the answer options - these are the educational words being taught
2. Do NOT change any answer options
3. Do NOT replace educational words with adventure-related words (e.g., don't change "elephant" to "rocketship")
4. ONLY change the question scenario/context to fit the adventure
5. Use characters, settings, or themes from the adventure context, ESPECIALLY from the user's recent messages
6. Keep the exact same educational objective (spacing, grammar, phonics, etc.)
7. Make it exciting and age-appropriate for children
8. PRIORITIZE the user's most recent adventure elements and actions
9. NEVER include the answer text in the question - the question must not give away the correct answer
10. DO NOT advance the adventure story - only contextualize the question within existing adventure elements

WORDS TO PRESERVE: ${wordsToPreserve.join(', ')}

Return ONLY the new question text, nothing else.`;

      console.log('Sending contextualized question prompt to AI:', contextualPrompt);

      const completion = await this.client.chat.completions.create({
        model: "chatgpt-4o-latest",
        messages: [
          {
            role: "user",
            content: contextualPrompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (response && response.trim()) {
        const contextualQuestion = response.trim();
        console.log('Generated contextualized question:', contextualQuestion);
        return contextualQuestion;
      } else {
        console.log('No valid response received from AI, returning original question');
        return originalQuestion;
      }
    } catch (error) {
      console.error('OpenAI API error generating contextual question:', error);
      console.log('Falling back to original question due to error');
      // Return original question on error
      return originalQuestion;
    }
  }

  // Generate contextual reading passage based on user's adventure and topic
  async generateContextualReadingPassage(
    originalPassage: string,
    topic: string,
    userAdventure: ChatMessage[]
  ): Promise<string> {
    // If not initialized or no API key, return original passage
    if (!this.isInitialized || !this.client) {
      console.log('AI service not initialized, returning original passage');
      return originalPassage;
    }

    try {
      // Extract structured adventure context
      const adventureContext = this.extractAdventureContext(userAdventure);
      console.log('Adventure context for reading passage generation:', adventureContext);

      // Extract important educational words from the original passage
      const educationalWords = originalPassage.split(/\s+/)
        .filter(word => word.length > 3 && /^[a-zA-Z]+$/.test(word.replace(/[.,!?]/g, '')))
        .map(word => word.replace(/[.,!?]/g, ''));
        
      console.log('Educational words to preserve in reading passage:', educationalWords);

      const contextualPrompt = `You are creating an engaging reading passage for a child by incorporating their adventure story context.

TASK: Create a new reading passage that incorporates the child's adventure story while preserving ALL educational words and concepts.

ORIGINAL PASSAGE: "${originalPassage}"
EDUCATIONAL TOPIC: "${topic}"

ADVENTURE CONTEXT: "${adventureContext || this.getDefaultAdventureContext()}"

CRITICAL REQUIREMENTS:
1. PRESERVE ALL educational words from the original passage - these are being taught
2. Do NOT replace educational words with adventure-related words
3. Use characters, settings, or themes from the adventure context for the story scenario
4. Keep the same educational objective and reading level
5. Make it exciting and age-appropriate for children (ages 5-8)
6. Keep the passage length similar to the original (50-80 words)
7. Include the target vocabulary/sounds being taught in their original form

EDUCATIONAL WORDS TO PRESERVE: ${educationalWords.join(', ')}

EXAMPLE:
- Original: "The elephant is big. The ant is small."
- Adventure context: "space mission"
- Result: "On the space mission, the astronaut saw an elephant floating by the spaceship. The elephant is big. Next to it was a tiny ant in a space suit. The ant is small."

Return ONLY the new reading passage, nothing else.`;

      console.log('Sending contextualized reading passage prompt to AI:', contextualPrompt);

      const completion = await this.client.chat.completions.create({
        model: "chatgpt-4o-latest",
        messages: [
          {
            role: "system",
            content: "You are a creative educational content creator specializing in children's reading materials. You excel at weaving adventure themes into educational content while maintaining learning objectives."
          },
          {
            role: "user",
            content: contextualPrompt
          }
        ],
        max_tokens: 200,
        temperature: 0.8,
      });

      const generatedPassage = completion.choices[0]?.message?.content?.trim();
      
      if (generatedPassage && generatedPassage !== originalPassage) {
        console.log('✅ Successfully generated contextualized reading passage:', {
          original: originalPassage,
          contextualized: generatedPassage,
          context: adventureContext
        });
        return generatedPassage;
      } else {
        console.log('⚠️ AI returned same or empty passage, using original');
        return originalPassage;
      }

    } catch (error) {
      console.error('Error generating contextualized reading passage:', error);
      return originalPassage;
    }
  }



  // Generate simple realistic prompts using raw audio content
  private generateRealisticFunPrompt(audioText: string, baseImagePrompt: string): string[] {
    // Simple, clean prompt options using audio text as-is
    const prompts: string[] = [];

    // Option 1: Direct audio content with realistic and fun
    prompts.push(`${audioText}, make it realistic and fun`);

    // Option 2: Alternative phrasing
    prompts.push(`Create a realistic and fun image of: ${audioText}`);

    // Option 3: Simple fallback
    prompts.push(`${audioText} in realistic style`);

    // Option 4: Basic fallback
    prompts.push(`${audioText}`);

    return prompts;
  }

  // Extract visual elements from audio text for realistic imagery
  private extractVisualElements(audioText: string): string {
    const text = audioText.toLowerCase();
    
    // Enhanced visual mappings for realistic imagery
    const visualMappings = [
      // Animals - more detailed and realistic
      { keywords: ['elephant', 'elephants'], visual: 'a realistic majestic elephant in its natural habitat' },
      { keywords: ['cat', 'cats', 'kitten', 'kittens'], visual: 'a cute realistic cat with detailed fur' },
      { keywords: ['dog', 'dogs', 'puppy', 'puppies'], visual: 'a friendly realistic dog with expressive eyes' },
      { keywords: ['bird', 'birds'], visual: 'beautiful realistic birds with colorful feathers' },
      { keywords: ['fish'], visual: 'realistic tropical fish in clear water' },
      { keywords: ['lion', 'lions'], visual: 'a powerful realistic lion with magnificent mane' },
      { keywords: ['tiger', 'tigers'], visual: 'a stunning realistic tiger with distinctive stripes' },
      { keywords: ['bear', 'bears'], visual: 'a realistic bear in a natural forest setting' },
      { keywords: ['rabbit', 'rabbits', 'bunny'], visual: 'a realistic rabbit with soft fur and long ears' },
      { keywords: ['horse', 'horses'], visual: 'a beautiful realistic horse running in a field' },
      { keywords: ['cow', 'cows'], visual: 'a realistic cow in a green pasture' },
      { keywords: ['sheep'], visual: 'fluffy realistic sheep in a meadow' },
      { keywords: ['pig', 'pigs'], visual: 'a realistic pig in a farm setting' },
      { keywords: ['chicken', 'chickens'], visual: 'realistic chickens in a farmyard' },
      { keywords: ['butterfly', 'butterflies'], visual: 'realistic colorful butterflies on flowers' },
      { keywords: ['bee', 'bees'], visual: 'realistic bees collecting nectar from flowers' },
      
      // Nature and objects - more realistic
      { keywords: ['sun'], visual: 'a bright realistic sun with rays of light' },
      { keywords: ['moon'], visual: 'a detailed realistic moon with craters and soft glow' },
      { keywords: ['star', 'stars'], visual: 'twinkling realistic stars in the night sky' },
      { keywords: ['tree', 'trees'], visual: 'realistic trees with detailed bark and leaves' },
      { keywords: ['flower', 'flowers'], visual: 'realistic blooming flowers with vivid petals' },
      { keywords: ['grass'], visual: 'lush realistic green grass swaying gently' },
      { keywords: ['mountain', 'mountains'], visual: 'majestic realistic mountains with snow-capped peaks' },
      { keywords: ['ocean', 'sea'], visual: 'a realistic ocean with gentle waves and blue water' },
      { keywords: ['lake', 'pond'], visual: 'a peaceful realistic lake reflecting the sky' },
      { keywords: ['river'], visual: 'a flowing realistic river through natural landscape' },
      { keywords: ['forest'], visual: 'a dense realistic forest with tall trees and sunlight filtering through' },
      { keywords: ['garden'], visual: 'a beautiful realistic garden with colorful flowers and plants' },
      
      // Man-made objects - realistic versions
      { keywords: ['house', 'home'], visual: 'a realistic cozy house with detailed architecture' },
      { keywords: ['car', 'cars'], visual: 'a realistic modern car with shiny paint' },
      { keywords: ['truck', 'trucks'], visual: 'a realistic truck with detailed features' },
      { keywords: ['bus'], visual: 'a realistic colorful school bus' },
      { keywords: ['train'], visual: 'a realistic train moving along railroad tracks' },
      { keywords: ['airplane', 'plane'], visual: 'a realistic airplane flying through clouds' },
      { keywords: ['ship', 'boat'], visual: 'a realistic sailing ship on calm ocean waters' },
      { keywords: ['bicycle', 'bike'], visual: 'a realistic bicycle parked in a scenic location' },
      { keywords: ['school'], visual: 'a realistic school building with children playing outside' },
      { keywords: ['playground'], visual: 'a realistic colorful playground with swings and slides' },
      { keywords: ['park'], visual: 'a realistic park with trees, benches, and walking paths' },
      
      // Food and everyday items
      { keywords: ['apple', 'apples'], visual: 'realistic red apples with natural shine' },
      { keywords: ['banana', 'bananas'], visual: 'realistic yellow bananas with detailed texture' },
      { keywords: ['orange', 'oranges'], visual: 'realistic oranges with textured peel' },
      { keywords: ['cake'], visual: 'a realistic decorated cake with frosting' },
      { keywords: ['cookie', 'cookies'], visual: 'realistic chocolate chip cookies' },
      { keywords: ['bread'], visual: 'realistic fresh bread with golden crust' },
      { keywords: ['milk'], visual: 'a realistic glass of fresh white milk' },
      { keywords: ['water'], visual: 'crystal clear realistic water' },
      
      // Activities and actions - realistic scenes
      { keywords: ['running', 'run'], visual: 'realistic children running joyfully in a park' },
      { keywords: ['jumping', 'jump'], visual: 'realistic children jumping with expressions of joy' },
      { keywords: ['swimming', 'swim'], visual: 'realistic scene of swimming in clear blue water' },
      { keywords: ['flying', 'fly'], visual: 'realistic scene of birds or objects soaring through clear sky' },
      { keywords: ['playing', 'play'], visual: 'realistic children playing together happily' },
      { keywords: ['reading', 'read'], visual: 'realistic scene of children reading books' },
      { keywords: ['writing', 'write'], visual: 'realistic scene of writing with pencils and paper' },
      { keywords: ['drawing', 'draw'], visual: 'realistic scene of children drawing with crayons' },
      { keywords: ['singing', 'sing'], visual: 'realistic children singing with happy expressions' },
      { keywords: ['dancing', 'dance'], visual: 'realistic children dancing with joyful movements' },
      
      // Weather and seasons - realistic
      { keywords: ['hot', 'summer'], visual: 'a realistic sunny summer day with bright sunshine and blue sky' },
      { keywords: ['cold', 'winter'], visual: 'a realistic winter scene with snow, icicles, and bare trees' },
      { keywords: ['rain', 'raining'], visual: 'realistic gentle rain with water droplets and puddles' },
      { keywords: ['snow', 'snowing'], visual: 'realistic snow falling peacefully on a winter landscape' },
      { keywords: ['wind', 'windy'], visual: 'realistic scene with trees and grass bending in the wind' },
      { keywords: ['spring'], visual: 'a realistic spring scene with blooming flowers and green leaves' },
      { keywords: ['autumn', 'fall'], visual: 'a realistic autumn scene with colorful falling leaves' },
      
      // Colors with realistic contexts
      { keywords: ['red'], visual: 'realistic red objects like ripe strawberries, roses, or fire trucks' },
      { keywords: ['blue'], visual: 'realistic blue elements like clear sky, ocean waves, or blueberries' },
      { keywords: ['green'], visual: 'realistic green elements like fresh grass, leaves, or vegetables' },
      { keywords: ['yellow'], visual: 'realistic yellow elements like bright sunflowers, lemons, or sunshine' },
      { keywords: ['purple'], visual: 'realistic purple elements like grapes, lavender, or violets' },
      { keywords: ['orange'], visual: 'realistic orange elements like pumpkins, oranges, or sunset colors' },
      { keywords: ['pink'], visual: 'realistic pink elements like cherry blossoms, flamingos, or roses' },
      { keywords: ['brown'], visual: 'realistic brown elements like tree bark, chocolate, or earth' },
      { keywords: ['black'], visual: 'realistic black elements like night sky, ravens, or shadows' },
      { keywords: ['white'], visual: 'realistic white elements like snow, clouds, or doves' },
    ];
    
    // Find matching visual elements
    let foundVisuals = [];
    for (const mapping of visualMappings) {
      for (const keyword of mapping.keywords) {
        if (text.includes(keyword)) {
          foundVisuals.push(mapping.visual);
          break;
        }
      }
    }
    
    // If specific visuals found, use them
    if (foundVisuals.length > 0) {
      return foundVisuals.slice(0, 3).join(' and '); // Limit to 3 main elements for clarity
    }
    
    // If no specific mapping, try to extract meaningful words for realistic scene
    const words = audioText.split(/\s+/);
    const meaningfulWords = words.filter(word => 
      word.length > 2 && 
      !/^(the|a|an|is|are|was|were|has|have|had|do|does|did|will|would|should|could|my|your|his|her|its|our|their|this|that|these|those|and|or|but|for|with|from|about|into|onto|upon|over|under|above|below|between|among|through|during|before|after|since|until)$/i.test(word)
    );
    
    if (meaningfulWords.length > 0) {
      // Take the most relevant words and create a realistic scene
      const relevantWords = meaningfulWords.slice(0, 5).join(' ');
      return `a realistic and detailed scene depicting ${relevantWords}`;
    }
    
    // Final fallback - more realistic and educational
    return 'a realistic, colorful educational scene perfect for children\'s learning';
  }

  // Get last 30 AI messages for contextual image generation
  private getRecentAIMessages(userAdventure: ChatMessage[]): string {
    const aiMessages = userAdventure
      .filter(msg => msg.type === 'ai')
      .slice(-6)
      .map(msg => msg.content.substring(0, 150)) // Limit length
      .join(' | ');
    
    return aiMessages;
  }

  // Generate realistic fun image using DALL-E based only on audio content
  async generateContextualImage(
    audioText: string,
    userAdventure: ChatMessage[],
    imagePrompt: string = ""
  ): Promise<string | null> {
    // If not initialized or no API key, return null (will show placeholder)
    if (!this.isInitialized || !this.client) {
      return null;
    }

    try {
      console.log('Generating contextual image with conversation history:', audioText);

      // Get last 10 messages for conversation context
      const last10Messages = userAdventure.slice(-10);
      
      // Get recent AI messages for additional context
      const recentAIMessages = this.getRecentAIMessages(userAdventure);
      
      // Build conversation context string
      const conversationContext = last10Messages
        .map(msg => `${msg.type === 'user' ? 'Student' : 'AI'}: ${msg.content}`)
        .join('\n');

      // Append AI messages context
      const fullContext = recentAIMessages 
        ? `${conversationContext}\n\nRecent AI responses: ${recentAIMessages}`
        : conversationContext;

      console.log('Using conversation context for image generation:', fullContext);

      // Generate contextually aware prompt options
      const promptOptions = this.generateContextualPrompts(audioText, fullContext, imagePrompt);

      console.log('Generated contextual prompt options:', promptOptions);

      // Try each prompt option until one succeeds
      for (let i = 0; i < promptOptions.length; i++) {
        try {
          const prompt = promptOptions[i];
          
          // Ensure prompt is not too long
          const finalPrompt = prompt.length > 400 ? prompt.substring(0, 390) + "..." : prompt;
          
          console.log(`Trying contextual DALL-E prompt ${i + 1}:`, finalPrompt);

          const response = await this.client.images.generate({
            model: "dall-e-3",
            prompt: finalPrompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            style: "vivid"
          });

          const imageUrl = response.data[0]?.url;
          
          if (imageUrl) {
            console.log(`Contextual DALL-E prompt ${i + 1} succeeded`);
            return imageUrl;
          }
        } catch (promptError: any) {
          console.log(`Contextual DALL-E prompt ${i + 1} failed:`, promptError.message);
          
          // If this isn't a safety error, or it's the last prompt, throw the error
          if (!promptError.message?.includes('safety system') || i === promptOptions.length - 1) {
            throw promptError;
          }
          
          // Otherwise, continue to the next prompt option
          continue;
        }
      }

      throw new Error('All contextual prompt options failed');
    } catch (error) {
      console.error('DALL-E API error for contextual image:', error);
      // Return null on error to show placeholder
      return null;
    }
  }

  // Generate contextual prompts that include both audio and conversation history
  private generateContextualPrompts(audioText: string, conversationContext: string, baseImagePrompt: string): string[] {
    const prompts: string[] = [];

    // Extract visual elements from audio text
    const visualElements = this.extractVisualElements(audioText);

    // Option 1: Full context with audio and conversation
    if (conversationContext.length > 0) {
      prompts.push(
        `Create a realistic and engaging educational image for children based on this question: "${audioText}". Consider this recent conversation context to make it relevant: ${conversationContext.slice(-200)}. Make it colorful, clear, and educational.`
      );
    }

    // Option 2: Conversation-informed visual elements
    if (conversationContext.length > 0) {
      prompts.push(
        `Educational illustration showing: ${visualElements}. Context from recent learning: ${conversationContext.slice(-150)}. Question focus: ${audioText}. Child-friendly and realistic style.`
      );
    }

    // Option 3: Audio-focused with light conversation context
    prompts.push(
      `${audioText}. ${conversationContext.length > 0 ? `Learning context: ${conversationContext.slice(-100)}` : ''} Make it realistic, educational, and engaging for children.`
    );

    // Option 4: Fallback to original realistic prompts
    const realisticPrompts = this.generateRealisticFunPrompt(audioText, baseImagePrompt);
    prompts.push(...realisticPrompts);

    return prompts;
  }

  // Generate adventure-focused images using user_adventure context with early-exit fallback
  async generateAdventureImage(
    prompt: string,
    userAdventure: ChatMessage[],
    fallbackPrompt: string = "adventure scene",
    aiSanitizedResult?: { sanitizedPrompt: string; sanitizedContext?: string },
    adventureId?: string // Add adventure ID parameter for race condition prevention
  ): Promise<{ imageUrl: string; usedPrompt: string; adventureId?: string } | null> {
    // If not initialized or no API key, return null (will show placeholder)
    if (!this.isInitialized || !this.client) {
      return null;
    }

    // Prevent multiple simultaneous image generation calls
    if (this.isGeneratingImage) {
      console.log('🚫 Image generation already in progress, skipping duplicate call');
      return null;
    }

    // Set generation flag to prevent simultaneous calls
    this.isGeneratingImage = true;
    
    // 🛡️ Track current adventure ID for race condition prevention
    const currentAdventureId = adventureId;
    console.log(`🎯 ADVENTURE TRACKING: Starting image generation for adventure ID: ${currentAdventureId || 'unknown'}`);

    // 🛠️ Safety timeout to prevent permanent stuck state
    const safetyTimeout = setTimeout(() => {
      console.log('🚨 SAFETY TIMEOUT: Clearing stuck isGeneratingImage flag after 40 seconds');
      this.isGeneratingImage = false;
    }, 40000);

    try {
      console.log('🌟 [AIService.generateAdventureImage()] Generating adventure image with user adventure context (EARLY-EXIT ENABLED)');
      console.log('📝 [AIService.generateAdventureImage()] Input prompt:', prompt);
      console.log('👤 [AIService.generateAdventureImage()] Adventure ID:', adventureId);
      console.log('📜 [AIService.generateAdventureImage()] User adventure context length:', userAdventure.length);

      // Extract adventure context with high priority on recent messages
      const adventureContext = this.extractAdventureContext(userAdventure);
      console.log('[AIService.generateAdventureImage()] Adventure context for image:', adventureContext);

      // Generate one optimized prompt first, then fallback prompts if needed
      const primaryPrompt = this.generatePrimaryAdventurePrompt(prompt, userAdventure, fallbackPrompt);
      
      console.log('🎯 [AIService.generateAdventureImage()] Trying PRIMARY adventure prompt first:', primaryPrompt);

      // Try primary prompt first
      try {
        const finalPrompt = primaryPrompt.length > 400 
          ? primaryPrompt.substring(0, 390) + "..." 
          : primaryPrompt;
        
        console.log(`🎨 [AIService.generateAdventureImage()] Generating with primary prompt using DALL-E 3`);
        console.log(`📝 [AIService.generateAdventureImage()] Final prompt length: ${finalPrompt.length} characters`);
        console.log(`📝 [AIService.generateAdventureImage()] Final prompt: ${finalPrompt}`);
        console.log(`🎯 dall-e prompt primary final: ${finalPrompt}`);

        const response = await this.client.images.generate({
          model: "dall-e-3",
          prompt: finalPrompt,
          n: 1,
          size: "1024x1024",
          quality: "standard",
          style: "vivid"
        });

        const imageUrl = response.data[0]?.url;
        
        if (imageUrl) {
          console.log(`✅ [AIService.generateAdventureImage()] PRIMARY adventure prompt succeeded - EARLY EXIT (no fallback prompts needed)`);
          console.log(`🖼️ [AIService.generateAdventureImage()] Generated image URL: ${imageUrl}`);
          clearTimeout(safetyTimeout); // Clear safety timeout
          this.isGeneratingImage = false; // Clear generation flag
          return { imageUrl, usedPrompt: finalPrompt, adventureId };
        }
      } catch (primaryError: any) {
        console.log(`❌ [AIService.generateAdventureImage()] Primary adventure prompt failed:`, primaryError.message);
        
        // Only proceed to fallback if it's a safety/policy issue
        if (!primaryError.message?.includes('safety system')) {
          this.isGeneratingImage = false; // Clear generation flag
          throw primaryError;
        }
        
        console.log('🔄 [AIService.generateAdventureImage()] Primary prompt blocked by safety system - trying fallback prompts');
      }

      // Only if primary fails, generate fallback prompts
      console.log('🔄 [AIService.generateAdventureImage()] Generating fallback prompts (primary prompt failed)');
      const fallbackPrompts = this.generateFallbackAdventurePrompts(prompt, userAdventure, fallbackPrompt, aiSanitizedResult);

      console.log('Generated fallback prompt options:', fallbackPrompts);

      // Try each fallback prompt option until one succeeds
      for (let i = 0; i < fallbackPrompts.length; i++) {
        try {
          const finalPrompt = fallbackPrompts[i].length > 400 
            ? fallbackPrompts[i].substring(0, 390) + "..." 
            : fallbackPrompts[i];
          
          // Enhanced logging to identify which attempt this is
          let promptType = '';
          if (i === 0) promptType = ' (Epic Dynamic)';
          else if (i === 1) promptType = ' (Thrilling Safe)';
          else if (i === 2) promptType = ' (AI Sanitized ✨)';
          else if (i === 3) promptType = ' (Simple Safe)';
          
          console.log(`🎨 Trying fallback DALL-E prompt ${i + 1}${promptType}:`, finalPrompt.substring(0, 200) + '...');
          console.log(`🎯 fallback${i + 1} dalle prompt: ${finalPrompt}`);

          const response = await this.client.images.generate({
            model: "dall-e-3",
            prompt: finalPrompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            style: "vivid"
          });

          const imageUrl = response.data[0]?.url;
          
          if (imageUrl) {
            const promptType = i === 0 ? ' (Epic Dynamic)' : i === 1 ? ' (Thrilling Safe)' : i === 2 ? ' (AI Sanitized ✨)' : ' (Simple Safe)';
            console.log(`✅ Fallback DALL-E prompt ${i + 1}${promptType} succeeded! 🎉`);
            clearTimeout(safetyTimeout); // Clear safety timeout
            this.isGeneratingImage = false; // Clear generation flag
            return { imageUrl, usedPrompt: finalPrompt, adventureId };
          }
        } catch (promptError: any) {
          console.log(`❌ Fallback DALL-E prompt ${i + 1} failed:`, promptError.message);
          
          if (!promptError.message?.includes('safety system') || i === fallbackPrompts.length - 1) {
            this.isGeneratingImage = false; // Clear generation flag
            throw promptError;
          }
          
          continue;
        }
      }

      throw new Error('All adventure prompt options failed');
    } catch (error) {
      console.error('DALL-E API error for adventure image:', error);
      clearTimeout(safetyTimeout); // Clear safety timeout
      this.isGeneratingImage = false; // Clear generation flag on error
      return null;
    } finally {
      // Ensure flag is always cleared (backup safety measure)
      clearTimeout(safetyTimeout);
      this.isGeneratingImage = false;
    }
  }

  // Generate education-focused images WITHOUT user_adventure context
  async generateEducationalQuestionImage(
    audioText: string,
    imagePrompt: string = "",
    topicName: string = ""
  ): Promise<string | null> {
    // If not initialized or no API key, return null (will show placeholder)
    if (!this.isInitialized || !this.client) {
      return null;
    }

    try {
      console.log('📚 Generating educational question image (no adventure context):', audioText);

      // Generate educational-focused prompts without adventure context
      const educationalPrompts = this.generateEducationalPrompts(audioText, imagePrompt, topicName);

      console.log('Generated educational prompt options:', educationalPrompts);

      // Try each prompt option until one succeeds
      for (let i = 0; i < educationalPrompts.length; i++) {
        try {
          const finalPrompt = educationalPrompts[i].length > 400 
            ? educationalPrompts[i].substring(0, 390) + "..." 
            : educationalPrompts[i];
          
          console.log(`📖 Trying educational DALL-E prompt ${i + 1}:`, finalPrompt);

          const response = await this.client.images.generate({
            model: "dall-e-3",
            prompt: finalPrompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            style: "vivid"
          });

          const imageUrl = response.data[0]?.url;
          
          if (imageUrl) {
            console.log(`✅ Educational DALL-E prompt ${i + 1} succeeded`);
            return imageUrl;
          }
        } catch (promptError: any) {
          console.log(`❌ Educational DALL-E prompt ${i + 1} failed:`, promptError.message);
          
          if (!promptError.message?.includes('safety system') || i === educationalPrompts.length - 1) {
            throw promptError;
          }
          
          continue;
        }
      }

      throw new Error('All educational prompt options failed');
    } catch (error) {
      console.error('DALL-E API error for educational image:', error);
      return null;
    }
  }

  // Helper: Build conversation context for better image generation (60% latest user + 20% latest AI + 20% conversation history)
  private buildImageGenerationContext(userAdventure: ChatMessage[]): string {
    if (!userAdventure || userAdventure.length === 0) {
      return "";
    }

    // Get recent 6 messages (both AI and user)
    const recentMessages = userAdventure.slice(-6);
    
    // Get latest AI message for 20% weight
    const latestAiMessage = userAdventure.filter(msg => msg.type === 'ai').slice(-1)[0];
    
    // Create weighted context components
    const conversationHistory = recentMessages.length > 0 
      ? `Recent conversation (20% context weight): ${recentMessages.map(msg => `${msg.type}: ${msg.content.substring(0, 100)}`).join(' | ')}`
      : '';
    
    const latestAiContext = latestAiMessage 
      ? `Latest AI response (20% context weight): ${latestAiMessage.content.substring(0, 200)}`
      : '';
    
    // Build weighted context in order: 60% user (handled separately), 20% AI, 20% conversation
    let context = '';
    
    if (latestAiContext) {
      context = latestAiContext;
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

  // Helper: Generate the primary optimized adventure prompt (used first)
  private generatePrimaryAdventurePrompt(prompt: string, userAdventure: ChatMessage[], fallbackPrompt: string): string {
    console.log('=== PRIMARY ADVENTURE PROMPT GENERATION ===');
    console.log('Function: AIService.generatePrimaryAdventurePrompt');
    console.log('Current input prompt:', prompt);

    // Get conversation history for weighted prompt generation (last 6 messages - OpenAI style)
    const conversationHistory = this.getLastConversationMessages(userAdventure);
    console.log('Conversation history (last 6 - OpenAI style):', conversationHistory);

    // Generate weighted prompt: 60% user input + 20% latest AI response + 20% conversation history
    const weightedContent = this.generateWeightedPrompt(prompt, conversationHistory);
    console.log('Weighted content (60% user input, 20% latest AI response, 20% conversation history in context):', weightedContent);

    // Build context from conversation for better image generation
    const conversationContext = this.buildImageGenerationContext(userAdventure);
    console.log('Conversation context for image:', conversationContext.substring(0, 200));

    // Create exciting, adventurous images that kids will love while maintaining safety
    const enhancedPrompt = ` Create a very realistic, high-quality image: ${weightedContent}. Style: Realistic with vivid details. It should NOT be cartoonish or kiddish. if their are real refrences make sure you involve some elements from that such as character appearance, famous objects etc.Keep all content completely accurately with no nudity, no sexual content, and no sensual or romantic posing. Absolutely avoid sexualized bodies, ensure no sensual poses or clothing (no cleavage, lingerie, swimwear, exposed midriff, or tight/transparent outfits); characters are depicted in fully modest attire suitable for kids. No kissing, flirting, or adult themes. There should be no text in the image whatsoever - no words, letters, signs, or any written content anywhere in the image.
    ${conversationContext}
    `;
    
    console.log('PRIMARY adventure prompt:', enhancedPrompt);
    console.log('WEIGHTING: 60% User Input + 20% Latest AI Response + 20% Conversation History');
    console.log('================================================');

    return enhancedPrompt;
  }

  // Helper: Generate fallback adventure prompts (only used if primary fails)
  private generateFallbackAdventurePrompts(prompt: string, userAdventure: ChatMessage[], fallbackPrompt: string, aiSanitizedResult?: { sanitizedPrompt: string; sanitizedContext?: string }): string[] {
    console.log('=== FALLBACK ADVENTURE PROMPTS GENERATION ===');
    console.log('Function: AIService.generateFallbackAdventurePrompts');
    console.log('Current input prompt:', prompt);
    console.log('🧹 AI Sanitized Result:', aiSanitizedResult ? 'PRESENT' : 'MISSING');
    if (aiSanitizedResult) {
      console.log('🧹 Sanitized prompt preview:', aiSanitizedResult.sanitizedPrompt?.substring(0, 80) + '...');
      console.log('🧹 Sanitized context preview:', aiSanitizedResult.sanitizedContext?.substring(0, 80) + '...');
      console.log('🧹 Has valid sanitized prompt:', !!aiSanitizedResult.sanitizedPrompt);
      console.log('🧹 Has valid sanitized context:', !!aiSanitizedResult.sanitizedContext);
    }

    // Get conversation history for weighted prompt generation
    const conversationHistory = this.getLastConversationMessages(userAdventure);
    const weightedContent = this.generateWeightedPrompt(prompt, conversationHistory);

    // Build context from conversation for better image generation
    // Use sanitized context if available, otherwise use original
    const conversationContext = aiSanitizedResult?.sanitizedContext || this.buildImageGenerationContext(userAdventure);
    
    console.log('🧹 Using context:', aiSanitizedResult?.sanitizedContext ? 'SANITIZED' : 'ORIGINAL');

    const prompts: string[] = [];

    // Fallback Option 1: Epic and dynamic cinematic adventure
    const sanitizedEnhancedPrompt1 = `Create an epic, high-quality image: ${weightedContent}. Style: Realistic with vivid details. It should NOT be cartoonish or kiddish. if their are real pop culture refrences make sure you involve some elements from that such as character appearance, famous objects etc.Keep all content completely accurately with no nudity, no sexual content, and no sensual or romantic posing. Absolutely avoid sexualized bodies, ensure no sensual poses or clothing (no cleavage, lingerie, swimwear, exposed midriff, or tight/transparent outfits); characters are depicted in fully modest attire suitable for kids. No kissing, flirting, or adult themes. There should be no text in the image whatsoever - no words, letters, signs, or any written content anywhere in the image.

${conversationContext}`;
    prompts.push(sanitizedEnhancedPrompt1);

    // Fallback Option 2: Thrilling adventure with safe content
    const sanitizedEnhancedPrompt2 = `Create a thrilling, high-quality adventure image: ${weightedContent}. Style: Realistic with vivid details. It should NOT be cartoonish or kiddish. if their are real pop culture refrences make sure you involve some elements from that such as character appearance, famous objects etc.Keep all content completely accurately with no nudity, no sexual content, and no sensual or romantic posing. Absolutely avoid sexualized bodies, ensure no sensual poses or clothing (no cleavage, lingerie, swimwear, exposed midriff, or tight/transparent outfits); characters are depicted in fully modest attire suitable for kids. No kissing, flirting, or adult themes. There should be no text in the image whatsoever - no words, letters, signs, or any written content anywhere in the image.

${conversationContext}`;
    prompts.push(sanitizedEnhancedPrompt2);
    
    console.log('Fallback prompt 1 (Epic Dynamic):', sanitizedEnhancedPrompt1);
    console.log('Fallback prompt 2 (Thrilling Safe):', sanitizedEnhancedPrompt2);

    // Add AI-sanitized prompt as 4th attempt if available (highest success chance)
    if (aiSanitizedResult?.sanitizedPrompt) {
      console.log('🧹 ADDING AI-SANITIZED PROMPT AS ATTEMPT 4! ✨');
      // Use the sanitized context we already selected above
      const aiSanitizedWithContext = `${aiSanitizedResult.sanitizedPrompt}. Style: realistic and vivid details and engaging for children.if there are real pop culture refrences such as any show, video game, or something like that make sure you add some of the character's appearance or famous objects etc. There should be no text in the image whatsoever - no words, letters, signs, or any written content anywhere in the image.

${conversationContext}`;
      prompts.push(aiSanitizedWithContext);
      console.log('Fallback prompt 3 (AI Sanitized):', aiSanitizedWithContext);
    } else {
      console.log('🚫 NOT adding AI-sanitized prompt - no valid sanitized prompt available');
    }

    // Add simple fallback if all enhanced approaches fail
    if (fallbackPrompt) {
      const simpleFallback = `Create an awesome adventure image: ${prompt}, ${fallbackPrompt}. Style: realistic and exciting, perfect for kids, completely family-friendly content. There should be no text in the image whatsoever - no words, letters, signs, or any written content anywhere in the image.

${conversationContext}`;
      prompts.push(simpleFallback);
      console.log('Final fallback prompt (Simple Safe):', simpleFallback);
    }

    console.log('================================================');
    console.log(`🎯 Generated ${prompts.length} fallback prompt options total`);
    return prompts;
  }

  // Generate contextual response text for adventure images based on generated content
  async generateAdventureImageResponse(
    originalPrompt: string,
    generatedImagePrompt: string,
    userAdventure: ChatMessage[]
  ): Promise<string> {
    // If not initialized or no API key, use fallback responses
    if (!this.isInitialized || !this.client) {
      return this.getFallbackImageResponse(originalPrompt);
    }

    try {
      // Get recent adventure context for response generation
      const adventureContext = this.extractAdventureContext(userAdventure);
      
      const contextualPrompt = `You are Krafty, an enthusiastic AI companion in a child's adventure story. The child just requested an image, and you've generated it for them. Create an excited, encouraging response that describes what you've created.

ORIGINAL USER REQUEST: "${originalPrompt}"
ACTUAL GENERATED IMAGE PROMPT: "${generatedImagePrompt}"
ADVENTURE CONTEXT: "${adventureContext}"

Your response should:
1. Be excited and encouraging about what you've created
2. Briefly describe what's in the image based on the generated prompt (not just copy the user's words)
3. Connect it to their ongoing adventure story
4. Use child-friendly, enthusiastic language
5. Be 1-2 sentences maximum
6. Include appropriate emojis
7. Make them excited about their adventure

Examples:
- Instead of "I created an image of a dragon" say "I've brought your mighty dragon to life soaring majestically over the ancient castle! 🐉✨"
- Instead of "Here's your spaceship" say "Your incredible cosmic vessel is ready for the next part of your space adventure! 🚀🌟"

Return ONLY your enthusiastic response, nothing else.`;

      const completion = await this.client.chat.completions.create({
        model: "chatgpt-4o-latest",
        messages: [
          {
            role: "user",
            content: contextualPrompt
          }
        ],
        max_tokens: 80,
        temperature: 0.8,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (response && response.trim()) {
        return response.trim();
      } else {
        return this.getFallbackImageResponse(originalPrompt);
      }
    } catch (error) {
      console.error('Error generating contextual image response:', error);
      return this.getFallbackImageResponse(originalPrompt);
    }
  }

  // Fallback responses for image generation when AI is not available
  private getFallbackImageResponse(originalPrompt: string): string {
    const responses = [
      `🎨 Amazing! I've brought your vision to life in this incredible adventure scene! ✨`,
      `🌟 Wow! Your adventure image is ready and it looks absolutely fantastic! 🚀`,
      `✨ Perfect! I've created something magical that captures the spirit of your adventure! 🎭`,
      `🎯 Brilliant! This image is going to make your story even more exciting! 💫`,
      `🚀 Incredible! Your adventure scene has come to life beautifully! 🌈`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Helper: Generate education-focused prompts WITHOUT adventure context
  private generateEducationalPrompts(audioText: string, imagePrompt: string, topicName: string): string[] {
    const prompts: string[] = [];

    // Extract educational visual elements (reuse existing method)
    const visualElements = this.extractVisualElements(audioText);

    // Option 1: Focus on educational content with visual elements
    prompts.push(
      `Educational illustration for children: ${visualElements}. Topic: ${topicName}. Make it clear, colorful, and perfect for learning ${audioText}`
    );

    // Option 2: Direct educational content
    prompts.push(
      `Create a clear educational image showing: ${audioText}. For ${topicName} learning. Child-friendly and realistic.`
    );

    // Option 3: Simple educational focus
    prompts.push(`${audioText} for educational purposes, realistic and child-friendly`);

    // Option 4: Use existing realistic prompts (fallback to original method)
    const realisticPrompts = this.generateRealisticFunPrompt(audioText, imagePrompt);
    prompts.push(...realisticPrompts);

    return prompts;
  }

  // Generate reflection prompt for wrong answers
  async generateReflectionPrompt(
    questionText: string,
    options: string[] | null,
    selectedAnswer: number | string,
    correctAnswer: number | string,
    topicName: string,
    gradeLevel: string,
    questionType: 'mcq' | 'fill_blank' | 'drag_drop' | 'reading_comprehension' = 'mcq'
  ): Promise<string> {
    // If not initialized or no API key, return fallback
    if (!this.isInitialized || !this.client) {
      if (questionType === 'mcq' && options && Array.isArray(options)) {
        const selectedOption = options[selectedAnswer as number];
        const correctOption = options[correctAnswer as number];
        return `🤔 Great effort on this ${topicName.replace(/_/g, ' ').toLowerCase()} question! You chose "${selectedOption}", but the correct answer is "${correctOption}". Let me explain why that's the right choice!`;
      } else if (questionType === 'fill_blank') {
        return `🌟 Nice try with your ${topicName.replace(/_/g, ' ').toLowerCase()} work! The correct answer is "${correctAnswer}". Let me help you understand why this word fits perfectly here!`;
      } else if (questionType === 'drag_drop') {
        return `🤔 Good effort with your ${topicName.replace(/_/g, ' ').toLowerCase()} sorting! Let me show you the correct pattern and explain why it works this way.`;
      } else if (questionType === 'reading_comprehension') {
        return `🌟 Great effort reading! The correct answer is "${correctAnswer}". Let me explain why this is the best choice based on what we read.`;
      } else {
        return `🤔 Great try with your ${topicName.replace(/_/g, ' ').toLowerCase()} work! Let me explain the correct answer and help you understand why it's right.`;
      }
    }

    try {
      let reflectionPrompt: string;
      
      if (questionType === 'mcq' && options && Array.isArray(options)) {
        // Multiple choice question
        const selectedOption = options[selectedAnswer as number];
        const correctOption = options[correctAnswer as number];
        
        reflectionPrompt = `You are Krafty, a warm and encouraging AI tutor helping a ${gradeLevel} student learning English. The child chose a wrong answer, and you need to help them understand why their choice isn't correct and guide them toward discovering the right answer through hints and reasoning.

      LEARNING CONTEXT:
      - Grade Level: ${gradeLevel}
      - Topic: ${topicName.replace(/_/g, ' ')}
      - Question: "${questionText}"
      - All Options: ${options.map((opt, i) => `${i}: "${opt}"`).join(", ")}
      - Student chose: "${selectedOption}" (option ${selectedAnswer})
      - Correct answer: "${correctOption}" (option ${correctAnswer})

      ANALYTICAL TEACHING APPROACH:
      1. Start with warm encouragement about their effort
      2. Analyze WHY their chosen answer isn't correct (be gentle but educational):
         - What might have made this option seem appealing?
         - What key detail or concept makes this option incorrect?
         - What pattern or rule does this violate?
      3. Provide strategic HINTS toward the correct answer without stating it directly:
         - Point to key words or clues in the question
         - Remind them of relevant rules or patterns for "${topicName.replace(/_/g, ' ')}"
         - Ask them to think about specific aspects of the topic
         - Guide their attention to what they should look for
      4. Encourage them to think again and try another option
      5. Use vocabulary appropriate for ${gradeLevel} level

      RESPONSE REQUIREMENTS:
      - Start with encouraging emoji and acknowledgment of effort
      - Explain why their choice isn't correct in gentle, educational terms
      - Give 1-2 strategic hints that guide them toward the right answer
      - DO NOT directly state the correct answer - let them discover it
      - Keep it positive and encourage them to try again
      - Use topic-specific hints for "${topicName.replace(/_/g, ' ')}"
      - Maximum 4 sentences total
      - End with encouragement to try again
      
      Example: "🤔 Great thinking! I can see why '${selectedOption}' might seem right, but [gentle explanation of why it's incorrect]. Here's a hint: look for [specific clue] in the question, and remember that in ${topicName.replace(/_/g, ' ')}, we usually [relevant rule/pattern]. Try looking at the other options again!"
      
      Return ONLY your teaching response, nothing extra.`;
      } else if (questionType === 'fill_blank') {
        // Fill-in-the-blank question
        reflectionPrompt = `You are Krafty, a warm and encouraging AI tutor helping a ${gradeLevel} student learning English. The child gave a wrong answer to a fill-in-the-blank question, and you need to help them understand why their answer doesn't fit and guide them toward discovering the correct word through hints and reasoning.

      LEARNING CONTEXT:
      - Grade Level: ${gradeLevel}
      - Topic: ${topicName.replace(/_/g, ' ')}
      - Question: "${questionText}"
      - Student wrote: "${selectedAnswer}"
      - Correct answer: "${correctAnswer}"

      ANALYTICAL TEACHING APPROACH FOR FILL-IN-THE-BLANK:
      1. Acknowledge their attempt warmly
      2. Analyze WHY their answer doesn't fit (be gentle but educational):
         - What rule or pattern does it not follow?
         - How does it sound different from what's needed?
         - What meaning doesn't match the context?
      3. Provide strategic HINTS toward the correct word without stating it directly:
         - Point to sound patterns (phonics clues)
         - Give meaning or context clues
         - Mention grammar rules (simple for grade level)
         - Suggest letter patterns or spelling hints
         - Connect to "${topicName.replace(/_/g, ' ')}" patterns
      4. Encourage them to think again and try another word
      5. Use vocabulary appropriate for ${gradeLevel} level

      RESPONSE REQUIREMENTS:
      - Start with encouraging acknowledgment
      - Explain why their word doesn't quite fit (be gentle)
      - Give 1-2 strategic hints that guide them toward the right word
      - DO NOT directly state the correct word - let them discover it
      - Keep it positive and encourage them to try again
      - Use topic-specific hints for "${topicName.replace(/_/g, ' ')}"
      - Maximum 4 sentences total
      - End with encouragement to try again
      
      Example: "🌟 Nice try with '${selectedAnswer}'! That word doesn't quite fit because [gentle explanation]. Here's a hint: think about [specific clue about sound/meaning/pattern] and remember the ${topicName.replace(/_/g, ' ')} rule we're practicing. Can you think of another word that might work better?"
      
      Return ONLY your teaching response, nothing extra.`;
      } else if (questionType === 'drag_drop') {
        // Drag-and-drop sorting question  
        reflectionPrompt = `You are Krafty, a warm and encouraging AI tutor helping a ${gradeLevel} student learning English. The child made incorrect sorting choices in a drag-and-drop activity, and you need to help them understand what went wrong with their sorting and guide them toward discovering the correct pattern through hints.

      LEARNING CONTEXT:
      - Grade Level: ${gradeLevel}
      - Topic: ${topicName.replace(/_/g, ' ')}
      - Question: "${questionText}"
      - Student made sorting errors
      - There is a correct sorting pattern based on the topic

      ANALYTICAL TEACHING APPROACH FOR DRAG-AND-DROP:
      1. Acknowledge their sorting effort warmly
      2. Analyze WHY their sorting approach didn't work (be gentle but educational):
         - What pattern or rule did they miss?
         - Which items don't belong where they put them?
         - What key feature should they focus on for grouping?
      3. Provide strategic HINTS toward the correct sorting pattern without showing it directly:
         - Point to key characteristics items should be grouped by
         - Remind them of "${topicName.replace(/_/g, ' ')}" rules or patterns
         - Ask them to look for specific features or similarities
         - Give examples of what to look for without stating the full answer
      4. Encourage them to try sorting again
      5. Use simple language appropriate for ${gradeLevel}

      RESPONSE REQUIREMENTS:
      - Start with encouraging acknowledgment of their effort
      - Explain why their current sorting doesn't quite work (be gentle)
      - Give 1-2 strategic hints about the sorting pattern to look for
      - DO NOT show the complete correct sorting - let them discover it
      - Keep it positive and encourage them to try again
      - Use topic-specific hints for "${topicName.replace(/_/g, ' ')}"
      - Maximum 4 sentences total
      - End with encouragement to try again
      
      Example: "🤔 Good effort sorting! I notice some items might fit better in different groups. Here's a hint: try grouping by [specific characteristic] and remember that in ${topicName.replace(/_/g, ' ')}, we look for [pattern/rule]. Can you try sorting them again?"
      
      Return ONLY your teaching response, nothing extra.`;
      } else if (questionType === 'reading_comprehension') {
        // Reading comprehension question
        reflectionPrompt = `You are Krafty, a warm and encouraging AI tutor helping a ${gradeLevel} student with reading comprehension. The child chose a wrong answer, and you need to help them understand why their choice doesn't match the text and guide them toward finding the correct answer through reading strategies and hints.

      LEARNING CONTEXT:
      - Grade Level: ${gradeLevel}
      - Topic: ${topicName.replace(/_/g, ' ')}
      - Question: "${questionText}"
      - Student chose: "${selectedAnswer}"
      - Correct answer: "${correctAnswer}"

      ANALYTICAL TEACHING APPROACH FOR READING COMPREHENSION:
      1. Acknowledge their reading effort warmly
      2. Analyze WHY their answer doesn't match the text (be gentle but educational):
         - What part of the text contradicts their choice?
         - What key details did they might have missed?
         - What reading strategy would help them find the right answer?
      3. Provide strategic HINTS toward finding the correct answer without stating it directly:
         - Point them to specific parts of the text to reread
         - Suggest reading strategies appropriate for ${gradeLevel}
         - Ask them to look for key words or phrases
         - Give them questions to think about while reading
         - Connect to "${topicName.replace(/_/g, ' ')}" comprehension skills
      4. Encourage them to reread and try again
      5. Use reading vocabulary appropriate for ${gradeLevel}

      RESPONSE REQUIREMENTS:
      - Start with encouraging acknowledgment
      - Explain why their choice doesn't match what the text says (be gentle)
      - Give 1-2 strategic hints about where to look or what strategy to use
      - DO NOT directly state the correct answer - let them discover it
      - Keep it positive and encourage them to try again
      - Use topic-specific reading strategies for "${topicName.replace(/_/g, ' ')}"
      - Maximum 4 sentences total
      - End with encouragement to reread and try again
      
      Example: "🌟 Great reading effort! I can see why you might think that, but let's look back at the text together. Here's a hint: reread [specific section] and look for [key detail/word]. What do you think the answer might be when you focus on that part?"
      
      Return ONLY your teaching response, nothing extra.`;
      }

      const completion = await this.client.chat.completions.create({
        model: "chatgpt-4o-latest",
        messages: [
          {
            role: "user",
            content: reflectionPrompt
          }
        ],
        max_tokens: 100,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (response) {
        return response.trim();
      } else {
        throw new Error('No response content received');
      }
    } catch (error) {
      console.error('OpenAI API error generating reflection prompt:', error);
      // Return fallback on error
      if (questionType === 'mcq' && options && Array.isArray(options)) {
        const selectedOption = options[selectedAnswer as number];
        const correctOption = options[correctAnswer as number];
        return `🤔 Great effort on this ${topicName.replace(/_/g, ' ').toLowerCase()} question! You chose "${selectedOption}", but the correct answer is "${correctOption}". Let me explain why that's the right choice!`;
      } else if (questionType === 'fill_blank') {
        return `🌟 Nice try with your ${topicName.replace(/_/g, ' ').toLowerCase()} work! The correct answer is "${correctAnswer}". Let me help you understand why this word fits perfectly here!`;
      } else if (questionType === 'drag_drop') {
        return `🤔 Good effort with your ${topicName.replace(/_/g, ' ').toLowerCase()} sorting! Let me show you the correct pattern and explain why it works this way.`;
      } else if (questionType === 'reading_comprehension') {
        return `🌟 Great effort reading! The correct answer is "${correctAnswer}". Let me explain why this is the best choice based on what we read.`;
      } else {
        return `🤔 Great try with your ${topicName.replace(/_/g, ' ').toLowerCase()} work! Let me explain the correct answer and help you understand why it's right.`;
      }
    }
  }

  // Generate concise one-liner summaries from panel text
  async generateOneLiner(panelText: string): Promise<string> {
    // If not initialized or no API key, use simple truncation fallback
    if (!this.isInitialized || !this.client) {
      const firstSentence = panelText.match(/^[^.!?]*[.!?]/);
      if (firstSentence && firstSentence[0].length <= 60) {
        return firstSentence[0].trim();
      }
      const truncated = panelText.substring(0, 50).trim();
      return truncated + (panelText.length > 50 ? "..." : "");
    }

    try {
      const prompt = `Convert this comic panel description into a concise, exciting one-liner (max 60 characters) that captures the main action or moment:

"${panelText}"

Requirements:
- Keep it under 60 characters
- Capture the most important action or moment  
- Make it exciting and engaging for kids
- Use simple, clear language
- Return ONLY the one-liner, nothing else

Examples:
- "The brave astronaut climbs into the rocket ship and prepares for an epic journey to Mars!" → "Astronaut boards rocket for Mars!"
- "Captain Alex discovers a mysterious glowing portal hidden behind ancient vines in the enchanted forest!" → "Captain finds glowing portal!"

Return ONLY the one-liner text:`;

      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 30,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (response && response.trim()) {
        const oneLiner = response.trim().replace(/['"]/g, ''); // Remove any quotes
        return oneLiner.length <= 60 ? oneLiner : oneLiner.substring(0, 57) + "...";
      } else {
        // Fallback to simple truncation
        const firstSentence = panelText.match(/^[^.!?]*[.!?]/);
        if (firstSentence && firstSentence[0].length <= 60) {
          return firstSentence[0].trim();
        }
        const truncated = panelText.substring(0, 50).trim();
        return truncated + (panelText.length > 50 ? "..." : "");
      }
    } catch (error) {
      console.error('Error generating one-liner:', error);
      // Fallback to simple truncation
      const firstSentence = panelText.match(/^[^.!?]*[.!?]/);
      if (firstSentence && firstSentence[0].length <= 60) {
        return firstSentence[0].trim();
      }
      const truncated = panelText.substring(0, 50).trim();
      return truncated + (panelText.length > 50 ? "..." : "");
    }
  }

  // Generate educational hints for MCQ questions without giving away the answer
  async generateSpellingHint(word: string, userAttempt: string): Promise<string> {
    // If not initialized or no API key, use fallback
    if (!this.isInitialized || !this.client) {
      return this.getFallbackSpellingHint(word, userAttempt);
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: "chatgpt-4o-latest",
        messages: [
          {
            role: 'system',
            content: `You are a helpful spelling tutor for children aged 8-14. A student is trying to spell a word but got it wrong. Your job is to:

1. First, explain why their attempt doesn't match the target word
2. Give them 2-3 alternative options to consider (including the correct answer mixed in)
3. Give a subtle recap of Floss Rule if applicable.
4. Strictly ensure the answer isn't directly mentioned in your hint.

The target word: "${word}"
Student's attempt: "${userAttempt}"

Format your response like this:
"Ah, that sounds like '${userAttempt}' which is [explanation]. Here are some options to try: [2-3 choices including correct answer]."

Strictly keep it within 20 words. Keep it encouraging and focus on the learning process rather than giving away the answer.`
          },
          {
            role: 'user',
            content: `Help me spell "${word}". I tried "${userAttempt}" but it's wrong.`
          }
        ],
        max_tokens: 60,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (response && response.trim()) {
        return response.trim();
      } else {
        throw new Error('No spelling hint response received');
      }
    } catch (error) {
      console.error('OpenAI API error generating spelling hint:', error);
      return this.getFallbackSpellingHint(word, userAttempt);
    }
  }

  private getFallbackSpellingHint(word: string, userAttempt: string): string {
    const hints = [
      `That's close! Try thinking about the sounds in "${word}". What letters make those sounds?`,
      `Good try! "${word}" has ${word.length} letters. Can you hear each sound?`,
      `Almost there! Listen carefully to how "${word}" sounds when you say it slowly.`,
      `Nice attempt! Break "${word}" into smaller parts - what sounds do you hear?`,
      `Keep trying! Think about similar words you know that sound like "${word}".`
    ];
    return hints[Math.floor(Math.random() * hints.length)];
  }

  async generateHint(
    question: string,
    options: string[],
    correctAnswer: number,
    explanation: string,
    hintLevel: number = 1, // 1 = general, 2 = specific, 3 = very specific
    userAdventure: ChatMessage[] = []
  ): Promise<string> {
    // If not initialized or no API key, use fallback
    if (!this.isInitialized || !this.client) {
      return this.getFallbackHint(question, options, hintLevel);
    }

    try {
      // Extract adventure context for engagement
      const adventureContext = this.extractAdventureContext(userAdventure);
      
      // Get the correct answer for hint generation context
      const correctOption = options[correctAnswer];

      const hintPrompt = `You are an encouraging educational AI helping a child with a learning question. Your goal is to guide them toward the correct answer without giving it away directly.

QUESTION: "${question}"
OPTIONS: ${options.map((opt, i) => `${i + 1}. "${opt}"`).join(", ")}
EXPLANATION: "${explanation}"
ADVENTURE CONTEXT: ${adventureContext || this.getDefaultAdventureContext()}
HINT LEVEL: ${hintLevel}/3 (1=general, 2=specific, 3=very specific)

HINT GUIDELINES BY LEVEL:
Level 1 (General): 
- Give a broad strategy or approach
- Focus on what to look for or think about
- Encourage thinking process
- Stay very general

Level 2 (Specific):
- Point to specific elements in the question
- Give more focused direction
- Still don't reveal the answer directly
- Help narrow down choices

Level 3 (Very Specific):
- Give very targeted guidance
- Help eliminate wrong options
- Provide clear reasoning paths
- Almost lead them to the answer

RULES:
1. NEVER state the correct answer directly
2. Be encouraging and supportive in tone
3. Use adventure context naturally when possible (mention characters, settings briefly)
4. Keep hints age-appropriate for elementary students
5. End with encouragement to try
6. Use 1-2 sentences maximum
7. Include relevant emoji for engagement

Generate a hint at level ${hintLevel}:`;

      const completion = await this.client.chat.completions.create({
        model: "chatgpt-4o-latest",
        messages: [
          {
            role: "user",
            content: hintPrompt
          }
        ],
        max_tokens: 80,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (response && response.trim()) {
        return response.trim();
      } else {
        throw new Error('No hint response received');
      }
    } catch (error) {
      console.error('OpenAI API error generating hint:', error);
      return this.getFallbackHint(question, options, hintLevel);
    }
  }

  // Fallback hints when API is not available
  private getFallbackHint(question: string, options: string[], hintLevel: number): string {
    const hintsByLevel = {
      1: [
        "🤔 Take your time and read each option carefully. What sounds right to you?",
        "💡 Think about what you've learned before. Which option makes the most sense?",
        "🌟 Look at each choice and ask yourself which one fits best!",
        "🎯 Trust your instincts! Read through the options one more time."
      ],
      2: [
        "🔍 Look closely at the differences between the options. What makes them unique?",
        "📚 Think about the rules you know. Which option follows them correctly?",
        "⭐ Compare the options carefully - one of them stands out as more correct!",
        "🎨 Focus on the key words in the question. They'll guide you to the answer!"
      ],
      3: [
        "🎯 Try eliminating the options that clearly don't fit first!",
        "🔎 Look for the option that matches exactly what the question is asking for!",
        "💫 Think step by step - which option solves the problem completely?",
        "🌟 You're almost there! One option is clearly the best choice!"
      ]
    };

    const levelHints = hintsByLevel[hintLevel as keyof typeof hintsByLevel] || hintsByLevel[1];
    return levelHints[Math.floor(Math.random() * levelHints.length)];
  }

  // Check if AI service is properly configured
  isConfigured(): boolean {
    return this.isInitialized;
  }

  // NEW: Unified AI response generation that may include images
  // This is the new method that uses AI to decide when to generate images
  async generateUnifiedResponse(
    userText: string, 
    chatHistory: ChatMessage[] = [], 
    spellingQuestion: SpellingQuestion,
    userId: string,
    sessionId: string = crypto.randomUUID(),
    adventureId?: string
  ): Promise<UnifiedAIResponse> {
    console.log('🚀 Using NEW unified AI response generation system');
    
    return await this.unifiedStreamingService.generateUnifiedResponse(
      userText,
      chatHistory,
      spellingQuestion,
      userId,
      sessionId,
      adventureId
    );
  }
  
  // NEW: Register for streaming events from unified system
  onUnifiedStreamEvent(sessionId: string, callback: (event: any) => void) {
    this.unifiedStreamingService.onStreamEvent(sessionId, callback);
  }
  
  // NEW: Remove stream listener
  removeUnifiedStreamListener(sessionId: string) {
    this.unifiedStreamingService.removeStreamListener(sessionId);
  }
  
  // NEW: Abort ongoing unified stream
  abortUnifiedStream(sessionId: string) {
    this.unifiedStreamingService.abortStream(sessionId);
  }
  
  // NEW: Check if unified system is ready
  isUnifiedSystemReady(): boolean {
    return this.unifiedStreamingService.isReady();
  }

  // Get configuration status for UI feedback
  getStatus(): { configured: boolean; message: string } {
    if (this.isInitialized) {
      return { configured: true, message: 'AI is ready!' };
    } else {
      return { 
        configured: false, 
        message: 'Using demo responses. Add OpenAI API key for full AI features.' 
      };
    }
  }

  // 🎯 NEW: Coordination methods for unified system priority over automatic generation
  
  /**
   * Cancel any ongoing automatic image generation to allow unified system priority
   * Used when unified system becomes active during automatic generation
   */
  cancelAutomaticImageGeneration(): boolean {
    if (this.isGeneratingImage) {
      console.log('🚫 COORDINATION: Cancelling ongoing automatic image generation for unified system priority');
      this.isGeneratingImage = false; // Clear the flag to allow unified system
      return true; // Successfully cancelled
    }
    console.log('✅ COORDINATION: No automatic image generation to cancel');
    return false; // Nothing was running
  }

  /**
   * Check if automatic image generation is currently in progress
   * Used by unified system to determine coordination needs
   */
  isAutomaticImageGenerationActive(): boolean {
    return this.isGeneratingImage;
  }

  /**
   * Signal that unified system is taking over - cancels automatic generation
   * Combined method for convenience
   */
  unifiedSystemTakingOver(): void {
    if (this.isGeneratingImage) {
      console.log('🔄 COORDINATION: Unified system taking over - automatic generation cancelled');
      this.cancelAutomaticImageGeneration();
    } else {
      console.log('🔄 COORDINATION: Unified system taking over - no automatic generation to cancel');
    }
  }
}

// Export a singleton instance
export const aiService = new AIService();
export default AIService;
