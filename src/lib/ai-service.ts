import OpenAI from 'openai';

interface ChatMessage {
  type: 'user' | 'ai';
  content: string;
  timestamp: number;
}

class AIService {
  private client: OpenAI | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
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
  private getFallbackResponse(userText: string): string {
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
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Generate chat context from message history
  private buildChatContext(
    messages: ChatMessage[], 
    currentUserMessage: string,
    adventureState?: string,
    currentAdventure?: any,
    storyEventsContext?: string,
    summary?: string
  ): any[] {
    const systemMessage = {
      role: "system" as const,
      content: `Role & Perspective: Be my loyal sidekick in an imaginative adventure for children aged 8–14. Speak in the first person as my companion.

Tone: Friendly, encouraging, and light-hearted, with humor and kid-friendly language. Ask only one question at a time. Keep responses under 80 words. Keep the output to exactly 2–3 short lines, using explicit newline characters (\\n) at natural pauses for clean formatting.

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

Adventure State: ${adventureState === 'new' ? 'NEW_ADVENTURE' : adventureState === 'character_creation' ? 'CHARACTER_CREATION' : 'ONGOING_ADVENTURE'}

Current Adventure Context: ${JSON.stringify(currentAdventure)}${storyEventsContext || ''}

Student Profile: ${summary || 'Getting to know this adventurer...'}`
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

  async generateResponse(userText: string, chatHistory: ChatMessage[] = []): Promise<string> {
    // If not initialized or no API key, use fallback
    if (!this.isInitialized || !this.client) {
      return this.getFallbackResponse(userText);
    }

    try {
      const messages = this.buildChatContext(chatHistory, userText);

      const completion = await this.client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: messages,
        max_tokens: 100,
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
      console.error('OpenAI API error:', error);
      // Return fallback response on error
      return this.getFallbackResponse(userText);
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

  // Extract the last 3 messages from both user and AI for direct context
  private getRecentMessagesContext(userAdventure: ChatMessage[]): string {
    if (!userAdventure || userAdventure.length === 0) {
      return "";
    }

    // Get the last 6 messages (to try to get 3 from each type)
    const recentMessages = userAdventure.slice(-6);
    
    // Format the messages for context
    const formattedMessages = recentMessages.map(msg => {
      const speaker = msg.type === 'user' ? 'Child' : 'AI';
      return `${speaker}: "${msg.content}"`;
    }).join('\n');

    return formattedMessages;
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

RECENT CONVERSATION CONTEXT:
${this.getRecentMessagesContext(userAdventure)}

ADVENTURE SETTING: ${adventureContext || this.getDefaultAdventureContext()}

Strict rules:
0) Event anchoring: Build directly on the most recent event; include at least one concrete detail from it. Do not change the location/scene or introduce unrelated new objects.
1) Audience/decodability: Kindergarten. Do not use difficult words since this is a reading exercise for kindergarten students.
2) Length: Keep questions concise and age-appropriate.
3) Include these target words: ${wordsToPreserve.join(', ')}
4) Keep it lively and connected to the current adventure.
5) Name usage: You may use character names from the adventure. Avoid other proper names.
6) Clarity: Very simple sentences appropriate for kindergarten reading level.
7) Output format: Return ONLY the new question text. No titles, labels, or extra text.
8) NEVER include any answer option text in the question itself - the question must not reveal or contain the answers.

CRITICAL REQUIREMENTS:
1. PRESERVE ALL WORDS that appear in the answer options - these are the educational words being taught
2. Do NOT change any answer options
3. Do NOT replace educational words with adventure-related words (e.g., don't change "elephant" to "rocketship")
4. ONLY change the question scenario/context to fit the adventure
5. Use characters, settings, or themes from the adventure context, ESPECIALLY the most recent elements
6. Keep the exact same educational objective (spacing, grammar, phonics, etc.)
7. Make it exciting and age-appropriate for children
8. PRIORITIZE the most recent adventure elements mentioned by the user
9. NEVER include the answer text in the question - the question must not give away the correct answer

WORDS TO PRESERVE: ${wordsToPreserve.join(', ')}

Return ONLY the new question text, nothing else.`;

      console.log('Sending contextualized question prompt to AI:', contextualPrompt);

      const completion = await this.client.chat.completions.create({
        model: "gpt-3.5-turbo",
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
      console.log('Generating image based on audio content:', audioText);

      // Generate multiple prompt options based only on audio content
      const promptOptions = this.generateRealisticFunPrompt(audioText, imagePrompt);

      console.log('Generated realistic fun prompt options:', promptOptions);

      // Try each prompt option until one succeeds
      for (let i = 0; i < promptOptions.length; i++) {
        try {
          const prompt = promptOptions[i];
          
          // Ensure prompt is not too long
          const finalPrompt = prompt.length > 400 ? prompt.substring(0, 390) + "..." : prompt;
          
          console.log(`Trying DALL-E prompt ${i + 1}:`, finalPrompt);

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
            console.log(`DALL-E prompt ${i + 1} succeeded`);
            return imageUrl;
          }
        } catch (promptError: any) {
          console.log(`DALL-E prompt ${i + 1} failed:`, promptError.message);
          
          // If this isn't a safety error, or it's the last prompt, throw the error
          if (!promptError.message?.includes('safety system') || i === promptOptions.length - 1) {
            throw promptError;
          }
          
          // Otherwise, continue to the next prompt option
          continue;
        }
      }

      throw new Error('All prompt options failed');
    } catch (error) {
      console.error('DALL-E API error:', error);
      // Return null on error to show placeholder
      return null;
    }
  }

  // Generate adventure-focused images using user_adventure context
  async generateAdventureImage(
    prompt: string,
    userAdventure: ChatMessage[],
    fallbackPrompt: string = "space adventure scene"
  ): Promise<string | null> {
    // If not initialized or no API key, return null (will show placeholder)
    if (!this.isInitialized || !this.client) {
      return null;
    }

    try {
      console.log('🌟 Generating adventure image with user adventure context');

      // Extract adventure context with high priority on recent messages
      const adventureContext = this.extractAdventureContext(userAdventure);
      console.log('Adventure context for image:', adventureContext);

      // Generate adventure-focused prompts
      const adventurePrompts = this.generateAdventurePrompts(prompt, adventureContext, fallbackPrompt);

      console.log('Generated adventure prompt options:', adventurePrompts);

      // Try each prompt option until one succeeds
      for (let i = 0; i < adventurePrompts.length; i++) {
        try {
          const finalPrompt = adventurePrompts[i].length > 400 
            ? adventurePrompts[i].substring(0, 390) + "..." 
            : adventurePrompts[i];
          
          console.log(`🎨 Trying adventure DALL-E prompt ${i + 1}:`, finalPrompt);

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
            console.log(`✅ Adventure DALL-E prompt ${i + 1} succeeded`);
            return imageUrl;
          }
        } catch (promptError: any) {
          console.log(`❌ Adventure DALL-E prompt ${i + 1} failed:`, promptError.message);
          
          if (!promptError.message?.includes('safety system') || i === adventurePrompts.length - 1) {
            throw promptError;
          }
          
          continue;
        }
      }

      throw new Error('All adventure prompt options failed');
    } catch (error) {
      console.error('DALL-E API error for adventure image:', error);
      return null;
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

  // Helper: Generate adventure-focused prompts using user_adventure context
  private generateAdventurePrompts(prompt: string, adventureContext: string, fallbackPrompt: string): string[] {
    const prompts: string[] = [];

    if (adventureContext && adventureContext.trim()) {
      // Option 1: Full adventure context integration with realistic emphasis
      prompts.push(
        `Create a vivid, realistic adventure scene: ${prompt}. Adventure context: ${adventureContext}. Make it exciting, story-driven, and photorealistic for children.`
      );

      // Option 2: Simplified adventure context with realistic style
      prompts.push(
        `${prompt} in the context of: ${adventureContext}. Make it realistic, adventurous and fun for kids.`
      );

      // Option 3: Adventure context as setting with realistic details
      prompts.push(
        `Realistic adventure scene: ${prompt}. Setting and characters from: ${adventureContext}. Child-friendly, exciting, and photorealistic.`
      );
    }

    // Option 4: Fallback with basic adventure feel and realistic style
    prompts.push(`${prompt}, ${fallbackPrompt}, make it realistic, adventurous and exciting for children`);

    // Option 5: Simple fallback with realistic emphasis
    prompts.push(`${prompt}, make it realistic, fun and adventurous`);

    return prompts;
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
        
        reflectionPrompt = `You are Krafty, a warm and encouraging AI tutor helping a ${gradeLevel} student learning English. The child chose a wrong answer, and you need to directly teach them the correct answer and explain why it's right in a way that's perfect for their grade level.

      LEARNING CONTEXT:
      - Grade Level: ${gradeLevel}
      - Topic: ${topicName.replace(/_/g, ' ')}
      - Question: "${questionText}"
      - All Options: ${options.map((opt, i) => `${i}: "${opt}"`).join(", ")}
      - Student chose: "${selectedOption}" (option ${selectedAnswer})
      - Correct answer: "${correctOption}" (option ${correctAnswer})

      DIRECT TEACHING APPROACH:
      1. Start with warm encouragement about their effort
      2. Clearly state what the correct answer is
      3. Explain WHY the correct answer is right using simple, age-appropriate reasoning
      4. If helpful, briefly explain why their choice wasn't the best option (be gentle)
      5. Connect the explanation to the specific topic "${topicName.replace(/_/g, ' ')}"
      6. Use vocabulary appropriate for ${gradeLevel} level

      RESPONSE REQUIREMENTS:
      - Start with encouraging emoji and acknowledgment of effort
      - Clearly state: "The correct answer is [correct option]"
      - Explain the reasoning in 1-2 simple sentences appropriate for ${gradeLevel}
      - Keep it positive and educational, not discouraging
      - Use topic-specific teaching points for "${topicName.replace(/_/g, ' ')}"
      - Maximum 3 sentences total
      - End with encouragement
      
      Example: "🌟 Great effort! The correct answer is '${correctOption}' because [simple explanation for ${gradeLevel} level]. This helps us understand [topic concept]!"
      
      Return ONLY your teaching response, nothing extra.`;
      } else if (questionType === 'fill_blank') {
        // Fill-in-the-blank question
        reflectionPrompt = `You are Krafty, a warm and encouraging AI tutor helping a ${gradeLevel} student learning English. The child gave a wrong answer to a fill-in-the-blank question, and you need to directly teach them the correct answer and explain why it fits perfectly.

      LEARNING CONTEXT:
      - Grade Level: ${gradeLevel}
      - Topic: ${topicName.replace(/_/g, ' ')}
      - Question: "${questionText}"
      - Student wrote: "${selectedAnswer}"
      - Correct answer: "${correctAnswer}"

      DIRECT TEACHING APPROACH FOR FILL-IN-THE-BLANK:
      1. Acknowledge their attempt warmly
      2. State the correct word clearly
      3. Explain why this word fits using age-appropriate reasoning:
         - Sound patterns (phonics)
         - Meaning in context
         - Grammar rules (simple for grade level)
         - Letter patterns or spelling rules
      4. Connect to the learning topic "${topicName.replace(/_/g, ' ')}"

      RESPONSE REQUIREMENTS:
      - Start with encouraging acknowledgment
      - Clearly state: "The correct word is '${correctAnswer}'"
      - Explain why it fits in 1-2 simple sentences for ${gradeLevel}
      - Use vocabulary and concepts appropriate for their grade
      - Maximum 3 sentences total
      - Stay positive and educational
      
      Example: "🌟 Nice try! The correct word is '${correctAnswer}' because [simple explanation]. This helps us practice [topic skill]!"
      
      Return ONLY your teaching response, nothing extra.`;
      } else if (questionType === 'drag_drop') {
        // Drag-and-drop sorting question  
        reflectionPrompt = `You are Krafty, a warm and encouraging AI tutor helping a ${gradeLevel} student learning English. The child made incorrect sorting choices in a drag-and-drop activity, and you need to directly teach them the correct sorting pattern and explain the logic.

      LEARNING CONTEXT:
      - Grade Level: ${gradeLevel}
      - Topic: ${topicName.replace(/_/g, ' ')}
      - Question: "${questionText}"
      - Student made sorting errors
      - There is a correct sorting pattern based on the topic

      DIRECT TEACHING APPROACH FOR DRAG-AND-DROP:
      1. Acknowledge their sorting effort
      2. Explain the correct sorting rule/pattern
      3. Give specific examples of why items belong in certain groups
      4. Use simple language appropriate for ${gradeLevel}
      5. Connect to the "${topicName.replace(/_/g, ' ')}" learning goal

      RESPONSE REQUIREMENTS:
      - Start with encouraging acknowledgment of their effort
      - Explain the sorting rule in simple terms for ${gradeLevel}
      - Give 1-2 specific examples of correct grouping
      - Maximum 3 sentences total
      - Keep it clear and educational
      
      Example: "🤔 Good effort sorting! The correct way to group these is [rule explanation]. For example, [specific example] because [simple reason]!"
      
      Return ONLY your teaching response, nothing extra.`;
      } else if (questionType === 'reading_comprehension') {
        // Reading comprehension question
        reflectionPrompt = `You are Krafty, a warm and encouraging AI tutor helping a ${gradeLevel} student with reading comprehension. The child chose a wrong answer, and you need to directly teach them the correct answer and explain how to find it in the text.

      LEARNING CONTEXT:
      - Grade Level: ${gradeLevel}
      - Topic: ${topicName.replace(/_/g, ' ')}
      - Question: "${questionText}"
      - Student chose: "${selectedAnswer}"
      - Correct answer: "${correctAnswer}"

      DIRECT TEACHING APPROACH FOR READING COMPREHENSION:
      1. Acknowledge their reading effort
      2. State the correct answer clearly
      3. Explain how to find this answer in the text using simple strategies
      4. Use reading comprehension vocabulary appropriate for ${gradeLevel}
      5. Connect to the "${topicName.replace(/_/g, ' ')}" skill

      RESPONSE REQUIREMENTS:
      - Start with encouraging acknowledgment
      - Clearly state the correct answer
      - Explain the reading strategy in simple terms for ${gradeLevel}
      - Maximum 3 sentences total
      - Focus on teaching the skill
      
      Example: "🌟 Great reading effort! The correct answer is '${correctAnswer}' because [explanation of how to find it in text]. This helps us practice [reading skill]!"
      
      Return ONLY your teaching response, nothing extra.`;
      }

      const completion = await this.client.chat.completions.create({
        model: "gpt-3.5-turbo",
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

  // Check if AI service is properly configured
  isConfigured(): boolean {
    return this.isInitialized;
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
