import OpenAI from 'openai';
import { SpellingQuestion } from './questionBankUtils';
import { UnifiedAIStreamingService, UnifiedAIResponse } from './unified-ai-streaming-service';

interface ChatMessage {
  type: 'user' | 'ai';
  content: string;
  timestamp: number;
}

export interface AdventureResponse {
  spelling_sentence: string;
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
    
    if (apiKey) {
      this.client = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true // Required for client-side usage
      });
      this.isInitialized = true;
    } else {
      console.warn('VITE_OPENAI_API_KEY not found. AI responses will use fallback mode.');
      this.isInitialized = false;
    }
  }

  // Fallback responses when API is not available
  private getFallbackResponse(userText: string): AdventureResponse {
    const responses = [
      "Great idea! 🚀 That sounds exciting! What happens next?",
      "Wow! 🌟 That's a fantastic twist! Keep the story going!",
      "Amazing! ✨ I love where this story is heading!",
      "Cool! 🎯 That's a great addition to your adventure!",
      "Awesome! 🎭 Your story is getting more exciting!",
      "Nice! 🌈 What a wonderful way to continue the tale!",
      "Brilliant! 💫 I can't wait to see what happens next!",
      "Super! 🎪 You're such a creative storyteller!",
      "Perfect! 🎨 That adds great action to your comic!",
      "Excellent! 🎊 Your adventure is becoming amazing!"
    ];
    const fallbackText = responses[Math.floor(Math.random() * responses.length)];
    return {
      spelling_sentence: "Let's continue our amazing adventure!",
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
  ): any[] {
    const systemMessage = {
      role: "system" as const,
      content: `Role & Perspective: Be my loyal sidekick in an imaginative adventure for children aged 8–14. Speak in the first person as my companion.

Tone: Friendly, encouraging, and light-hearted, with humor and kid-friendly language. Ask only one question at a time. Keep responses under 80 words. Keep the output to exactly 2–3 short lines, using actual newline characters at natural pauses for clean formatting. Put numbered options (like "1. Option A 2. Option B") on separate lines.

Goal: Create fast-paced, mission-oriented and spelling question aligned adventures with lovable characters, thrilling twists, and cliffhangers. Keep me eager for the next scene and encourage multiple missions to inspire a love for storytelling.

Ongoing Adventure: Show excitement, prompt me for what happens next, and occasionally suggest 1–2 creative ideas to spark the next turn.

New Adventure: Ask about my interests (space exploration, robotics, dragons, sci-fi adventures, time travel, etc.). Offer:
- Interest-based adventure (protagonist + villain + clear goal)
- Another interest-based adventure
- "Create-your-own" adventure (I invent the setting, sidekick, and villain)

Use rich plots, lovable characters, and suspenseful cliffhangers.

Character Creation: When creating sidekicks/characters, let me choose names with suggestions, offer trait lists (funny, optimistic, resilient, etc.), and ask me to describe appearance for image creation.

Remember: I'm your loyal companion and guide in this adventure - speak as "I" and refer to the student as "you". Always end with excitement and either a cliffhanger or a single engaging question. Keep responses thrilling and mysterious to match interests.

The app has image generation capabilities, so you can suggest visual elements and encourage kids to ask for images when it would enhance their story.

Adventure State: ${adventureState === 'new' ? 'NEW_ADVENTURE' : adventureState === 'character_creation' ? 'CHARACTER_CREATION' : 'ONGOING_ADVENTURE'}

Current Adventure Context: ${JSON.stringify(currentAdventure)}${storyEventsContext || ''}

Student Profile: ${summary || 'Getting to know this adventurer...'}

You are provided with spelling word which is ${spellingWord}. You are to always use the spelling word to create the first sentence of the adventure.

CRITICAL: You MUST return your response as a valid JSON object with exactly these two keys:
- "spelling_sentence": The first sentence of the adventure that uses the spelling word ${spellingWord}
- "adventure_story": The remaining sentences of the adventure, this should be purely story based on provided context

Example format:
{
  "spelling_sentence": "The brave astronaut discovered a mysterious planet.",
  "adventure_story": "As the spaceship landed, strange lights began to glow from the surface. What could be waiting for us down there?"
}

Return ONLY the JSON object, no other text.`
    };

    // Include recent message history for context (last 6 messages max)
    const recentMessages = messages.slice(-6).map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Add current user message
    const currentMessage = {
      role: "user" as const,
      content: currentUserMessage
    };

    return [systemMessage, ...recentMessages, currentMessage];
  }

  async generateResponse(userText: string, chatHistory: ChatMessage[] = [], spellingQuestion: SpellingQuestion): Promise<AdventureResponse> {
    // If not initialized or no API key, use fallback
    if (!this.isInitialized || !this.client) {
      return this.getFallbackResponse(userText);
    }

    // need to pass this every 3 alternative chat messages
    const stringSpellingWord = JSON.stringify(spellingQuestion.audio);

    try {
      const messages = this.buildChatContext(chatHistory, userText, stringSpellingWord);

      const completion = await this.client.chat.completions.create({
        model: "chatgpt-4o-latest",
        messages: messages,
        response_format: { type: "json_object" },
        max_tokens: 500,
        temperature: 0.8,
        presence_penalty: 0.3,
        frequency_penalty: 0.3,
      });

      const response = completion.choices[0]?.message?.content;
      console.log('Response:', response);
      
      if (response) {
        try {
          // Parse and validate the JSON response
          const parsedResponse: AdventureResponse = JSON.parse(response.trim());
          
          // Validate that both required keys exist
          if (!parsedResponse.spelling_sentence || !parsedResponse.adventure_story) {
            console.warn('Response missing required keys, using fallback');
            return this.getFallbackResponse(userText);
          }
          
          // Return the formatted response
          return parsedResponse;
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError);
          console.log('Raw response:', response);
          return this.getFallbackResponse(userText);
        }
      } else {
        throw new Error('No response content received');
      }
    } catch (error) {
      console.error('OpenAI API error:', error);
      // Return fallback response on error
      return this.getFallbackResponse(userText);
    }
  }

  // Generate initial AI message for starting conversations
  async generateInitialMessage(
    adventureMode: 'new' | 'continue',
    chatHistory: ChatMessage[] = [],
    currentAdventure?: any,
    storyEventsContext?: string,
    summary?: string
  ): Promise<string> {
    // If not initialized or no API key, use fallback
    if (!this.isInitialized || !this.client) {
      return this.getFallbackInitialMessage(adventureMode, chatHistory);
    }

    try {
      // Build context for initial message generation
      const adventureState = adventureMode === 'new' ? 'new' : 'continue';
      
      // Create system message using the main adventure prompt
      const systemMessage = {
        role: "system" as const,
        content: `Role & Perspective: Be my loyal sidekick in an imaginative adventure for children aged 8–14. Speak in the first person as my companion.

Tone: Friendly, encouraging, and light-hearted, with humor and kid-friendly language. Ask only one question at a time in prompt changes.Ask one question at a time. Keep responses under 80 words. Keep the output to exactly 2–3 short lines, using actual newline characters at natural pauses for clean formatting. Put numbered options (like "1. Option A 2. Option B") on separate lines.

Goal: Create fast-paced, mission-oriented adventures with lovable characters, thrilling twists, and cliffhangers. Keep me eager for the next scene and encourage multiple missions to inspire a love for storytelling.

Ongoing Adventure: Show excitement, prompt me for what happens next, and occasionally suggest 1–2 creative ideas to spark the next turn.

New Adventure: Ask about my interests (space exploration, robotics, dragons, sci-fi adventures, time travel, etc.). Offer:
- Interest-based adventure (protagonist + villain + clear goal)
- Another interest-based adventure
- "Create-your-own" adventure (I invent the setting, sidekick, and villain)

Use rich plots, lovable characters, and suspenseful cliffhangers.

Character Creation: When creating sidekicks/characters, let me choose names with suggestions, offer trait lists (funny, optimistic, resilient, etc.), and ask me to describe appearance for image creation.

Remember: I'm your loyal companion and guide in this adventure - speak as "I" and refer to the student as "you". Always end with excitement and either a cliffhanger or a single engaging question. Keep responses thrilling and mysterious to match interests.

The app has image generation capabilities, so you can suggest visual elements and encourage kids to ask for images when it would enhance their story.

Adventure State: ${adventureState === 'new' ? 'NEW_ADVENTURE' : 'ONGOING_ADVENTURE'}

Current Adventure Context: ${JSON.stringify(currentAdventure)}${storyEventsContext || ''}

Student Profile: ${summary || 'Getting to know this adventurer...'}

IMPORTANT: This is the very first message to start our adventure conversation. Generate an enthusiastic greeting that follows the adventure state guidelines above.`
      };

      // For initial message, we send just the system prompt and ask for a greeting
      const userMessage = {
        role: "user" as const,
        content: adventureMode === 'new' 
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
      return this.getFallbackInitialMessage(adventureMode, chatHistory);
    }
  }

  // Fallback responses for initial messages when API is not available
  private getFallbackInitialMessage(adventureMode: 'new' | 'continue', chatHistory: ChatMessage[]): string {
    if (adventureMode === 'new') {
      const newAdventureMessages = [
        "🌟 Welcome, brave adventurer! I'm Krafty, your adventure companion! What kind of amazing adventure would you like to create today? 🚀",
        "✨ Hey there, explorer! Ready to embark on something incredible? Tell me, what type of adventure is calling to you today? 🎭",
        "🎨 Greetings, creative adventurer! I'm Krafty, and I'm here to help you craft the most amazing story! What adventure theme excites you most today? 🌈",
        "🚀 Adventure awaits, my friend! I'm Krafty, your sidekick in this epic journey! What kind of thrilling adventure shall we create together today? ⭐"
      ];
      return newAdventureMessages[Math.floor(Math.random() * newAdventureMessages.length)];
    } else {
      // Continue adventure fallbacks
      const recentMessages = chatHistory.slice(-3);
      const hasRecentContext = recentMessages.length > 0;
      
      if (hasRecentContext) {
        const contextMessages = [
          `🎯 Welcome back, adventurer! I've been thinking about our last conversation... ${recentMessages[recentMessages.length - 1]?.content?.substring(0, 50)}... What happens next in your epic tale? 🌟`,
          `🚀 Great to see you again! Based on where we left off, I have some exciting ideas brewing! What direction would you like to take our adventure now? ✨`,
          `⭐ You're back! I've been eagerly waiting to continue our journey! From what we discussed last time, there are so many possibilities ahead! What's your next move? 🎭`,
          `🌈 Welcome back, storyteller! Our adventure has such great momentum! I can't wait to see what amazing twist you'll add next! What happens now? 🎪`
        ];
        return contextMessages[Math.floor(Math.random() * contextMessages.length)];
      } else {
        const continueMessages = [
          "🎯 Welcome back, adventurer! I'm excited to continue our journey together! What amazing direction should we take our adventure today? 🌟",
          "🚀 Great to see you again! Ready to pick up where we left off and create something incredible? What's next in your story? ✨",
          "⭐ You're back for more adventure! I love your enthusiasm! What exciting twist should we add to your tale today? 🎭"
        ];
        return continueMessages[Math.floor(Math.random() * continueMessages.length)];
      }
    }
  }

  // Extract and filter relevant adventure context with weighted recent messages
  private extractAdventureContext(userAdventure: ChatMessage[]): string {
    if (!userAdventure || userAdventure.length === 0) {
      return "";
    }

    // Get recent messages (last 10 messages) and apply decreasing weights
    const recentMessages = userAdventure.slice(-10);
    
    // Create weighted context - most recent messages have higher importance
    let weightedContext = "";
    recentMessages.reverse().forEach((msg, index) => {
      // Weight: 1.0 for most recent, then 0.9, 0.8, 0.7, etc.
      const weight = Math.max(0.1, 1.0 - (index * 0.1));
      const repetitions = Math.ceil(weight * 3); // Repeat important messages more
      
      for (let i = 0; i < repetitions; i++) {
        weightedContext += msg.content + " ";
      }
    });
    
    // Extract key story elements from weighted context
    const storyElements = weightedContext.toLowerCase();

    // Look for story elements like characters, settings, objects
    const characters = this.extractStoryElements(storyElements, [
      'captain', 'explorer', 'astronaut', 'hero', 'friend', 'krafty', 'robot', 'alien', 
      'pikachu', 'pokemon', 'character', 'wizard', 'princess', 'prince', 'knight',
      'pirate', 'dragon', 'fairy', 'unicorn', 'mage', 'warrior', 'scientist'
    ]);
    
    const settings = this.extractStoryElements(storyElements, [
      'space', 'planet', 'rocket', 'spaceship', 'adventure', 'mission', 'quest', 
      'journey', 'castle', 'forest', 'ocean', 'mountain', 'island', 'city', 'school',
      'cave', 'temple', 'kingdom', 'galaxy', 'laboratory', 'treasure hunt', 'expedition'
    ]);
    
    const objects = this.extractStoryElements(storyElements, [
      'treasure', 'map', 'key', 'sword', 'shield', 'book', 'magic', 'crystal',
      'potion', 'gem', 'artifact', 'spell', 'portal', 'compass', 'telescope'
    ]);

    // Build contextual summary with emphasis on most recent elements
    let context = "";
    if (characters.length > 0) {
      context += `Characters: ${characters.join(", ")}. `;
    }
    if (settings.length > 0) {
      context += `Setting: ${settings.join(", ")}. `;
    }
    if (objects.length > 0) {
      context += `Objects: ${objects.join(", ")}. `;
    }

    // Add the most recent user message directly for highest priority
    const lastUserMessage = userAdventure.filter(msg => msg.type === 'user').slice(-1)[0];
    if (lastUserMessage) {
      context = `Recent focus: ${lastUserMessage.content}. ` + context;
    }

    console.log('Extracted weighted adventure context:', {
      characters,
      settings,
      objects,
      lastUserMessage: lastUserMessage?.content,
      fullContext: context
    });

    return context.trim();
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

  // Helper method to extract story elements
  private extractStoryElements(text: string, keywords: string[]): string[] {
    const found = [];
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        found.push(keyword);
      }
    }
    return [...new Set(found)]; // Remove duplicates
  }

  // Get last 6 conversation messages for OpenAI-style weighting
  private getLastConversationMessages(userAdventure: ChatMessage[]): ChatMessage[] {
    if (!userAdventure || userAdventure.length === 0) {
      return [];
    }
    // Return last 6 messages for OpenAI-style context
    return userAdventure.slice(-6);
  }

  // Generate weighted prompt: 80% user input + 10% latest AI response + 10% other context
  private generateWeightedPrompt(currentText: string, conversationHistory: ChatMessage[]): string {
    if (!conversationHistory || conversationHistory.length === 0) {
      return currentText;
    }

    // Extract latest AI response (10% weight)
    const latestAiMessage = conversationHistory
      .slice()
      .reverse()
      .find(msg => msg.type === 'ai');
    
    const latestAiContext = latestAiMessage ? latestAiMessage.content.substring(0, 100) : '';

    // Extract other context from conversation history (10% weight)
    const otherContextMessages = conversationHistory
      .filter(msg => msg.type === 'user' || (msg.type === 'ai' && msg !== latestAiMessage))
      .map(msg => msg.content)
      .join(' ')
      .substring(0, 100);

    // 80% current text + 10% latest AI + 10% other context
    let weightedContent = currentText;
    
    if (latestAiContext) {
      weightedContent += `. Latest AI context: ${latestAiContext}`;
    }
    
    if (otherContextMessages) {
      weightedContent += `. Other context: ${otherContextMessages}`;
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
        model: "gpt-4o-mini",
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
      
      // Build conversation context string
      const conversationContext = last10Messages
        .map(msg => `${msg.type === 'user' ? 'Student' : 'AI'}: ${msg.content}`)
        .join('\n');

      console.log('Using conversation context for image generation:', conversationContext);

      // Generate contextually aware prompt options
      const promptOptions = this.generateContextualPrompts(audioText, conversationContext, imagePrompt);

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
    fallbackPrompt: string = "space adventure scene"
  ): Promise<{ imageUrl: string; usedPrompt: string } | null> {
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

    try {
      console.log('🌟 Generating adventure image with user adventure context (EARLY-EXIT ENABLED)');

      // Extract adventure context with high priority on recent messages
      const adventureContext = this.extractAdventureContext(userAdventure);
      console.log('Adventure context for image:', adventureContext);

      // Generate one optimized prompt first, then fallback prompts if needed
      const primaryPrompt = this.generatePrimaryAdventurePrompt(prompt, userAdventure, fallbackPrompt);
      
      console.log('🎯 Trying PRIMARY adventure prompt first:', primaryPrompt);

      // Try primary prompt first
      try {
        const finalPrompt = primaryPrompt.length > 400 
          ? primaryPrompt.substring(0, 390) + "..." 
          : primaryPrompt;
        
        console.log(`🎨 Generating with primary prompt`);

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
          console.log(`✅ PRIMARY adventure prompt succeeded - EARLY EXIT (no fallback prompts needed)`);
          this.isGeneratingImage = false; // Clear generation flag
          return { imageUrl, usedPrompt: finalPrompt };
        }
      } catch (primaryError: any) {
        console.log(`❌ Primary adventure prompt failed:`, primaryError.message);
        
        // Only proceed to fallback if it's a safety/policy issue
        if (!primaryError.message?.includes('safety system')) {
          this.isGeneratingImage = false; // Clear generation flag
          throw primaryError;
        }
        
        console.log('🔄 Primary prompt blocked by safety system - trying fallback prompts');
      }

      // Only if primary fails, generate fallback prompts
      console.log('🔄 Generating fallback prompts (primary prompt failed)');
      const fallbackPrompts = this.generateFallbackAdventurePrompts(prompt, userAdventure, fallbackPrompt);

      console.log('Generated fallback prompt options:', fallbackPrompts);

      // Try each fallback prompt option until one succeeds
      for (let i = 0; i < fallbackPrompts.length; i++) {
        try {
          const finalPrompt = fallbackPrompts[i].length > 400 
            ? fallbackPrompts[i].substring(0, 390) + "..." 
            : fallbackPrompts[i];
          
          console.log(`🎨 Trying fallback DALL-E prompt ${i + 1}:`, finalPrompt);

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
            console.log(`✅ Fallback DALL-E prompt ${i + 1} succeeded`);
            this.isGeneratingImage = false; // Clear generation flag
            return { imageUrl, usedPrompt: finalPrompt };
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
      this.isGeneratingImage = false; // Clear generation flag on error
      return null;
    } finally {
      // Ensure flag is always cleared (backup safety measure)
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

  // Helper: Generate the primary optimized adventure prompt (used first)
  private generatePrimaryAdventurePrompt(prompt: string, userAdventure: ChatMessage[], fallbackPrompt: string): string {
    console.log('=== PRIMARY ADVENTURE PROMPT GENERATION ===');
    console.log('Function: AIService.generatePrimaryAdventurePrompt');
    console.log('Current input prompt:', prompt);

    // Get conversation history for weighted prompt generation (last 6 messages - OpenAI style)
    const conversationHistory = this.getLastConversationMessages(userAdventure);
    console.log('Conversation history (last 6 - OpenAI style):', conversationHistory);

    // Generate weighted prompt: 80% user input + 10% latest AI response + 10% other context
    const weightedContent = this.generateWeightedPrompt(prompt, conversationHistory);
    console.log('Weighted content (80% user input, 10% latest AI response, 10% other context):', weightedContent);

    // Create exciting, adventurous images that kids will love while maintaining safety
    const enhancedPrompt = `Create a very realistic, high-quality image: ${weightedContent}. Style: Realistic with vivid details. It should NOT be cartoonish or kiddish. Keep all content completely family friendly with no nudity, no sexual content, and no sensual or romantic posing. Absolutely avoid sexualized bodies, ensure no sensual poses or clothing (no cleavage, lingerie, swimwear, exposed midriff, or tight/transparent outfits); characters are depicted in fully modest attire suitable for kids. No kissing, flirting, or adult themes. Strictly avoid text on the images.`;
    
    console.log('PRIMARY adventure prompt:', enhancedPrompt);
    console.log('WEIGHTING: 80% User Input + 10% Latest AI Response + 10% Other Context');
    console.log('================================================');

    return enhancedPrompt;
  }

  // Helper: Generate fallback adventure prompts (only used if primary fails)
  private generateFallbackAdventurePrompts(prompt: string, userAdventure: ChatMessage[], fallbackPrompt: string): string[] {
    console.log('=== FALLBACK ADVENTURE PROMPTS GENERATION ===');
    console.log('Function: AIService.generateFallbackAdventurePrompts');
    console.log('Current input prompt:', prompt);

    // Get conversation history for weighted prompt generation
    const conversationHistory = this.getLastConversationMessages(userAdventure);
    const weightedContent = this.generateWeightedPrompt(prompt, conversationHistory);

    const prompts: string[] = [];

    // Fallback Option 1: Epic and dynamic cinematic adventure
    const sanitizedEnhancedPrompt1 = `Create an epic, high-quality image: ${weightedContent}. Style: dynamic and cinematic with vivid colors, dramatic lighting, and amazing magical details. Make it look awesome and thrilling - the kind of image kids would want as their wallpaper. Ensure no nudity, sexual content, or sexually inappropriate material whatsoever. Strictly avoid text on the images.`;
    prompts.push(sanitizedEnhancedPrompt1);

    // Fallback Option 2: Thrilling adventure with safe content
    const sanitizedEnhancedPrompt2 = `Create a thrilling, high-quality adventure image: ${weightedContent}. Style: cinematic and realistic with vibrant details, exciting atmosphere, and captivating elements. Make it visually stunning and engaging for children while keeping all content completely family-friendly. No inappropriate content or text on the images.`;
    prompts.push(sanitizedEnhancedPrompt2);
    
    console.log('Fallback prompt 1 (Epic Dynamic):', sanitizedEnhancedPrompt1);
    console.log('Fallback prompt 2 (Thrilling Safe):', sanitizedEnhancedPrompt2);

    // Add simple fallback if all enhanced approaches fail
    if (fallbackPrompt) {
      const simpleFallback = `Create an awesome adventure image: ${prompt}, ${fallbackPrompt}. Style: realistic and exciting, perfect for kids, completely family-friendly content, no text on images.`;
      prompts.push(simpleFallback);
      console.log('Final fallback prompt (Simple Safe):', simpleFallback);
    }

    console.log('================================================');
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
    sessionId: string = crypto.randomUUID()
  ): Promise<UnifiedAIResponse> {
    console.log('🚀 Using NEW unified AI response generation system');
    
    return await this.unifiedStreamingService.generateUnifiedResponse(
      userText,
      chatHistory,
      spellingQuestion,
      userId,
      sessionId
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
}

// Export a singleton instance
export const aiService = new AIService();
export default AIService;
