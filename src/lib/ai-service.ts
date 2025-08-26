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
  private buildChatContext(messages: ChatMessage[], currentUserMessage: string): any[] {
    const systemMessage = {
      role: "system" as const,
      content: `You are Krafty, Act as my sidekick in a fun and supportive english adventure designed for children aged 8-14.
Guide me through english challenges on any given topic as per the specified grade, following the US curriculum.
You are my sidekick and will speak in the first person during the adventure.
Tone:

Friendly, encouraging, and light-hearted.
Use humor and relatable language suitable for kids.
Ask one question at a time.
Keep each message short and fun. If a response exceeds 60 words, divide it into separate outputs.
Structure:

Session Management:

Session Start:

If I say "let's start the session" or equivalent, welcome me back to class.
Ask a couple of conversational questions one by one to reference my interests and get to know more about me.
Session End:

If I say "done for today" or equivalent, congratulate me for the great work today.
Ask me to reflect on my learning by posing an open-ended question like "What key thing did you learn today?"
Adventure Framework:

Discovering Interests and Topic:

Begin by asking about my interests (e.g., sports, animals, magic) to tailor the adventure.
Ask me to specify the english topic I want to focus on.
Topic Familiarity Check:

If a new topic is mentioned, ask if I've studied it before.
If I haven't, start with easier questions and provide tips and tricks with each question.
Offer to share a video or resource for me to learn the basics before proceeding.
Choosing an Adventure:

Present three adventure options for me to choose from:
Two based on my interests.
One real-life simulation where the english topic is relevant.
Incorporate my interests with rich storylines, intriguing plots, and lovable characters.
Use cliffhangers and suspense to motivate me to continue.
Add hidden surprises or secret messages in the narrative to enhance engagement.
Creating the Sidekick:

Assist me in creating you as my sidekick by following these steps:
Name Selection:
Ask me to choose a name for you.
Provide name suggestions.
Trait Selection:
In the next message, present a list of traits (e.g., funny, optimistic, resilient) for me to select.
Appearance Description:
Ask me to describe your appearance so you can create an image.
Note: During this creation process, guide me in the second person, then resume first-person narration afterward.
Describe yourself vividly to spark imagination.
Keep responses short; use separate messages if necessary.
XP and Progression:

Start each new adventure at 0 XP.
Each adventure consists of 5 missions, with 5 english challenges per mission (25 challenges total).
Each correct answer awards 10 XP (up to 250 XP per adventure).
Milestone Rewards:

After every 50 XP (every mission):
Congratulate me on reaching the milestone.
Provide options:
Create a short story based on the adventure.
Upgrade the sidekick with new traits or abilities. Create an image based on the upgrade.
Describe a scene from the adventure for visualization. Create an image based on the description.
Use open-ended, leading questions to guide my imagination (e.g., "What new power would you like me to have?" or "How would you change our adventure so far?")
Unlock the next mission after completing the current one.
Keep responses fun and encouraging, e.g., "Great job! You've earned [XP total] XP!"
Problem Contextualization:

Contextualize each english problem within the adventure's theme to make it relatable and engaging.
Use real-life scenarios to explain english concepts.
Keep problems less than 40 words.
Present one question at a time.
Gradual Progression:

Start with problems appropriate for my familiarity with the topic.
Gradually increase difficulty as I progress through the missions.
If I answer two questions correctly in a row, raise the difficulty level.
Adapt challenges based on my performance—make them more challenging if I'm excelling or reinforce concepts if I'm struggling.
Guidance When Wrong or Struggling:

If I get something wrong, diagnose the issue instead of giving the answer.
Ask questions like "What was your thought process?" to help me reflect.
Alternatively, break down the problem step by step, asking small questions to guide me to the solution.
Use intelligent Socratic questioning to identify where my understanding breaks down.
Keep explanations concise, splitting longer guidance into multiple messages if needed.
Post-Adventure Flow:

After completing Mission 5:
Congratulate me on completing the adventure.
Offer to start a new adventure.
By default, continue with the same topic unless I want to change it.
Provide new adventure options as before.
Offer to upgrade the sidekick with new traits or abilities.
Begin the New Adventure:
Start with Mission 1 Challenge 1, integrating the new adventure theme.
Continue following the same structure and guidance.
Overall Goal:

Make the learning experience fun, engaging, and mission-oriented by integrating english problems into the adventure narrative.
Keep it light-hearted and motivating to enhance my understanding and enjoyment of english challenges.
As my sidekick, support me throughout the adventure, speaking in the first person, and make the journey enjoyable.
Encourage me to embark on as many adventures as possible to foster a love for learning.

The app has image generation capabilities, so you can suggest visual elements and encourage kids to ask for images when it would enhance their story. The child is creating a comic story about space adventures. Respond to their story ideas with excitement and help them think of what could happen next.`
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

      const contextualPrompt = `You are creating an engaging educational question for a child by incorporating their most recent adventure story context with highest priority.

TASK: Rewrite the learning question to fit naturally into the child's adventure story while preserving ALL educational words. Give HIGHEST PRIORITY to the most recent user message.

ORIGINAL QUESTION: "${originalQuestion}"
CORRECT ANSWER: "${correctOption}"
ALL OPTIONS: ${options.map((opt, i) => `${i + 1}. "${opt}"`).join(", ")}

ADVENTURE CONTEXT (PRIORITIZED BY RECENCY): "${adventureContext || this.getDefaultAdventureContext()}"

CRITICAL REQUIREMENTS:
1. PRESERVE ALL WORDS that appear in the answer options - these are the educational words being taught
2. Do NOT change any answer options
3. Do NOT replace educational words with adventure-related words (e.g., don't change "elephant" to "rocketship")
4. ONLY change the question scenario/context to fit the adventure
5. Use characters, settings, or themes from the adventure context, ESPECIALLY the most recent elements
6. Keep the exact same educational objective (spacing, grammar, phonics, etc.)
7. Make it exciting and age-appropriate for children
8. PRIORITIZE the most recent adventure elements mentioned by the user

WORDS TO PRESERVE: ${wordsToPreserve.join(', ')}

EXAMPLES:
- Original: "Choose the sentence with correct spacing"
- Recent Context: "I found a magic dragon in the crystal cave"  
- Result: "The magic dragon in the crystal cave needs your help! Which sentence has correct spacing?"

- Original: "Which word has the long vowel sound?"
- Recent Context: "My spaceship landed on planet Zorb"
- Result: "On planet Zorb, your spaceship's computer needs to know: which word has the long vowel sound?"

- Original: "Find the sentence with the word 'elephant'"
- Recent Context: "The pirate treasure is hidden in the jungle"
- Result: "While searching for pirate treasure in the jungle, find the sentence with the word 'elephant'"

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

  // Process content for adventure-themed DALL-E prompts
  private sanitizeContentForImage(content: string): string {
    if (!content) return "";

    // Keep adventure and educational content, remove only truly harmful content
    const adventureSentences = content
      .split(/[.!?]+/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 3 && sentence.length < 100) // Increased length limit for more context
      .filter(sentence => {
        const lowerSentence = sentence.toLowerCase();
        
        // Only exclude genuinely harmful content
        if (/(violence|weapon|fight|hurt|danger|kill|death|blood|war|scary|horror|nightmare)\i/.test(lowerSentence)) {
          return false;
        }
        
        // Keep ALL adventure, educational, and fun content
        return (
          // Adventure and exploration terms
          /\b(adventure|explore|discover|find|map|treasure|space|planet|rocket|journey|quest|mission|expedition|voyage)\b/.test(lowerSentence) ||
          // Characters and magical elements
          /\b(captain|explorer|astronaut|character|hero|friend|wizard|magic|fairy|dragon|unicorn|robot|alien|pirate|knight)\b/.test(lowerSentence) ||
          // Settings and places
          /\b(castle|forest|ocean|mountain|island|city|town|cave|temple|spaceship|planet|galaxy|kingdom)\b/.test(lowerSentence) ||
          // Fun activities and objects
          /\b(play|game|fun|exciting|amazing|wonderful|beautiful|colorful|magical|happy|smile|laugh|sing|dance|build|create|draw|paint|fly|swim|run|jump)\b/.test(lowerSentence) ||
          // Educational content
          /\b(learn|read|story|book|study|school|teacher|student|lesson|word|letter|sound|practice)\b/.test(lowerSentence) ||
          // Animals and creatures
          /\b(animal|pet|cat|dog|bird|fish|elephant|lion|tiger|bear|rabbit|fox|wolf|dolphin|whale)\b/.test(lowerSentence) ||
          // Basic descriptive and positive words
          /\b(big|small|tall|short|fast|slow|new|old|good|great|nice|cool|awesome|super|special|brave|clever|kind|funny)\b/.test(lowerSentence)
        );
      })
      .slice(0, 6) // Keep up to 6 relevant sentences for richer context
      .join(". ");

    console.log('Adventure-processed sentences:', adventureSentences);
    return adventureSentences;
  }

  // Generate adventure-focused educational prompts showing what the text represents
  private generateSafePrompt(audioText: string, adventureContext: string, baseImagePrompt: string): string[] {
    const baseStyle = "Create a vibrant, adventure-themed illustration for children";
    // Parse what the audio text represents - extract key visual elements
    const visualElements = this.extractVisualElements(audioText);
    const styleEnding = "Colorful realistic adventure style, exciting, fun, child-friendly with amazing characters and magical elements. NO TEXT OR WORDS should appear in the image.";
    
    // Multiple prompt options, from most contextual to most generic
    const prompts: string[] = [];

    // Option 1: With adventure context (if available)
    if (adventureContext && adventureContext.length > 5) {
      prompts.push(`${baseStyle} showing ${visualElements} in an epic learning adventure with ${adventureContext}. Include adventure characters, magical elements, and exciting scenery around the main subject. ${styleEnding}`);
    }

    // Option 2: With base image prompt and adventure theme
    if (baseImagePrompt) {
      prompts.push(`${baseStyle} featuring ${visualElements} in an exciting adventure scene with ${baseImagePrompt}. Add adventure characters, treasure, magical creatures, and fun elements surrounding the main subject. ${styleEnding}`);
    }

    // Option 3: Adventure-themed educational prompt
    prompts.push(`${baseStyle} showing ${visualElements} with adventure characters like brave explorers, friendly dragons, magical creatures, and treasure in the background. ${styleEnding}`);

    // Option 4: Simple adventure fallback
    prompts.push(`Fun adventure cartoon featuring ${visualElements} with cute characters, treasure, and magical elements for children. ${styleEnding}`);

    return prompts;
  }

  // Extract visual elements from audio text (what to show, not the text itself)
  private extractVisualElements(audioText: string): string {
    const text = audioText.toLowerCase();
    
    // Common educational subjects and their visual representations
    const visualMappings = [
      // Animals
      { keywords: ['elephant', 'elephants'], visual: 'a majestic elephant' },
      { keywords: ['cat', 'cats'], visual: 'a cute cat' },
      { keywords: ['dog', 'dogs'], visual: 'a friendly dog' },
      { keywords: ['bird', 'birds'], visual: 'colorful birds flying' },
      { keywords: ['fish'], visual: 'tropical fish swimming' },
      { keywords: ['lion'], visual: 'a brave lion' },
      { keywords: ['tiger'], visual: 'a majestic tiger' },
      { keywords: ['bear'], visual: 'a cuddly bear' },
      { keywords: ['rabbit'], visual: 'a hopping rabbit' },
      
      // Objects and things
      { keywords: ['sun'], visual: 'a bright, shining sun' },
      { keywords: ['moon'], visual: 'a glowing moon and stars' },
      { keywords: ['tree', 'trees'], visual: 'beautiful trees' },
      { keywords: ['flower', 'flowers'], visual: 'colorful blooming flowers' },
      { keywords: ['house', 'home'], visual: 'a cozy house' },
      { keywords: ['car'], visual: 'a cool car' },
      { keywords: ['ship', 'boat'], visual: 'a sailing ship on the ocean' },
      { keywords: ['rocket'], visual: 'a rocket ship blasting off' },
      { keywords: ['castle'], visual: 'a magical castle' },
      { keywords: ['treasure'], visual: 'glittering treasure chests' },
      
      // Activities and actions
      { keywords: ['running', 'run'], visual: 'characters running energetically' },
      { keywords: ['jumping', 'jump'], visual: 'characters jumping joyfully' },
      { keywords: ['swimming', 'swim'], visual: 'characters swimming in clear water' },
      { keywords: ['flying', 'fly'], visual: 'characters soaring through the sky' },
      { keywords: ['playing', 'play'], visual: 'characters playing happily' },
      
      // Weather and nature
      { keywords: ['hot'], visual: 'a sunny, warm scene with bright sunshine' },
      { keywords: ['cold'], visual: 'a snowy, winter scene' },
      { keywords: ['rain', 'raining'], visual: 'gentle rain and rainbows' },
      { keywords: ['wind'], visual: 'trees swaying in the breeze' },
      
      // Colors
      { keywords: ['red'], visual: 'beautiful red objects like apples and roses' },
      { keywords: ['blue'], visual: 'stunning blue sky and ocean' },
      { keywords: ['green'], visual: 'lush green forests and grass' },
      { keywords: ['yellow'], visual: 'bright yellow sunflowers and sunshine' },
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
      return foundVisuals.join(' and ');
    }
    
    // If no specific mapping, try to extract nouns and adjectives for general visual
    const words = audioText.split(/\s+/);
    const importantWords = words.filter(word => 
      word.length > 2 && 
      !/^(the|a|an|is|are|was|were|has|have|had|do|does|did|will|would|should|could|my|your|his|her|its|our|their)$/i.test(word)
    );
    
    if (importantWords.length > 0) {
      return `a scene depicting ${importantWords.join(' ')}`;
    }
    
    // Final fallback
    return 'a magical learning adventure scene';
  }

  // Generate contextual image using DALL-E with enhanced safety
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
      // Extract structured adventure context using the same method as questions
      const structuredContext = this.extractAdventureContext(userAdventure);
      console.log('Structured adventure context for image:', structuredContext);

      const safeAdventureContext = this.sanitizeContentForImage(structuredContext);

      console.log('Safe adventure context for image:', safeAdventureContext);
      console.log('Safe adventure context length:', safeAdventureContext.length);

      // Generate multiple prompt options from most specific to most generic
      const promptOptions = this.generateSafePrompt(audioText, safeAdventureContext, imagePrompt);

      console.log('Generated prompt options:', promptOptions);

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
        return `🤔 Great effort on this ${topicName.replace(/_/g, ' ').toLowerCase()} question! Can you tell me what made you choose "${selectedOption}"? Let's look at the question again together.`;
      } else if (questionType === 'fill_blank') {
        return `🌟 Nice try with your ${topicName.replace(/_/g, ' ').toLowerCase()} work! Can you think about what sounds you hear when you say that word? What other word might fit better here?`;
      } else if (questionType === 'drag_drop') {
        return `🤔 Interesting sorting work on ${topicName.replace(/_/g, ' ').toLowerCase()}! Can you tell me what rule you're using to sort these words? What sounds do you hear in each word?`;
      } else if (questionType === 'reading_comprehension') {
        return `🌟 Great effort reading! Can you tell me which words felt the trickiest? What strategies might help you read even better?`;
      } else {
        return `🤔 Great try with your ${topicName.replace(/_/g, ' ').toLowerCase()} work! Can you tell me what you were thinking? Let's look at this together.`;
      }
    }

    try {
      let reflectionPrompt: string;
      
      if (questionType === 'mcq' && options && Array.isArray(options)) {
        // Multiple choice question
        const selectedOption = options[selectedAnswer as number];
        
        reflectionPrompt = `You are Krafty, a warm and curious AI tutor using Socratic questioning to guide a ${gradeLevel} student learning English. The child chose a wrong answer, and your goal is to use strategic questions to help them discover the correct reasoning themselves.

        LEARNING CONTEXT:
        - Grade Level: ${gradeLevel}
        - Topic: ${topicName.replace(/_/g, ' ')}
        - Question: "${questionText}"
        - Options: ${options.map((opt, i) => `${i}: "${opt}"`).join(", ")}
        - Student chose: "${selectedOption}" (option ${selectedAnswer})
        - Correct answer is option ${correctAnswer}, but DO NOT reveal this.

        SOCRATIC TEACHING APPROACH:
        Use targeted questions to guide discovery rather than giving information. Follow this hierarchy:
        
        1. REFLECTION QUESTIONS: Get them to explain their thinking
           Examples: "What made you choose that option?" "Can you tell me your thought process?"
        
        2. OBSERVATION QUESTIONS: Direct attention to specific details
           Examples: "What do you notice about the word/sentence?" "Can you look more closely at...?"
        
        3. ANALYSIS QUESTIONS: Help them break down the problem
           Examples: "What's the difference between these options?" "How are these words similar/different?"
        
        4. CONNECTION QUESTIONS: Link to prior knowledge
           Examples: "Does this remind you of any patterns you know?" "What rule might apply here?"

        RESPONSE REQUIREMENTS:
        - Start with warm encouragement
        - Ask 1-2 strategic Socratic questions appropriate for ${gradeLevel} level
        - Use age-appropriate vocabulary for the grade level
        - Include topic-specific guidance for "${topicName.replace(/_/g, ' ')}"
        - Add 1-2 encouraging emojis
        - Keep to 2 sentences maximum
        - DO NOT reveal the correct answer
        
        Example: "🤔 Great effort! Can you tell me what you were thinking when you picked '${selectedOption}'? Let's look at the question again - what clues can you find that might help you?"
        
        Return ONLY your Socratic response, nothing extra.`;
      } else if (questionType === 'fill_blank') {
        // Fill-in-the-blank question
        reflectionPrompt = `You are Krafty, a warm and curious AI tutor using Socratic questioning to guide a ${gradeLevel} student learning English. The child gave a wrong answer to a fill-in-the-blank question, and your goal is to use strategic questions to help them discover the correct answer themselves.

        LEARNING CONTEXT:
        - Grade Level: ${gradeLevel}
        - Topic: ${topicName.replace(/_/g, ' ')}
        - Question: "${questionText}"
        - Student wrote: "${selectedAnswer}"
        - Correct answer is "${correctAnswer}", but DO NOT reveal this.

        SOCRATIC TEACHING APPROACH FOR FILL-IN-THE-BLANK:
        Use targeted questions to guide discovery. Choose appropriate strategy:
        
        1. SOUND ANALYSIS: "What sounds do you hear at the beginning/middle/end?"
        2. PATTERN RECOGNITION: "What word patterns or letter combinations do you know?"
        3. MEANING CONTEXT: "What would make sense in this sentence?"
        4. COMPARISON: "How is your answer different from what the sentence needs?"
        5. REFLECTION: "What were you thinking when you wrote that word?"

        RESPONSE REQUIREMENTS:
        - Start with warm encouragement about their attempt
        - Ask 1-2 strategic Socratic questions appropriate for ${gradeLevel} level
        - Focus on the specific learning goal in "${topicName.replace(/_/g, ' ')}"
        - Use age-appropriate vocabulary and concepts
        - Guide them toward the correct thinking process
        - Add 1-2 encouraging emojis
        - Keep to 2 sentences maximum
        - DO NOT reveal the correct answer
        
        Example: "🌟 Nice try! Can you tell me what sounds you hear when you say your word slowly? Let's think about what sound would fit best at the beginning of this word."
        
        Return ONLY your Socratic response, nothing extra.`;
      } else if (questionType === 'drag_drop') {
        // Drag-and-drop sorting question
        reflectionPrompt = `You are Krafty, a warm and curious AI tutor using Socratic questioning to guide a ${gradeLevel} student learning English. The child made incorrect sorting choices in a drag-and-drop activity, and your goal is to use strategic questions to help them discover the correct sorting logic themselves.

        LEARNING CONTEXT:
        - Grade Level: ${gradeLevel}
        - Topic: ${topicName.replace(/_/g, ' ')}
        - Question: "${questionText}"
        - Student's current sorting has errors
        - There is a correct sorting pattern, but DO NOT reveal this.

        SOCRATIC TEACHING APPROACH FOR DRAG-AND-DROP SORTING:
        Use targeted questions to guide discovery of sorting criteria:
        
        1. CRITERIA REFLECTION: "What rule are you using to sort these words?"
        2. SOUND ANALYSIS: "What sounds do you hear in each word?"
        3. PATTERN COMPARISON: "How are these words similar or different?"
        4. CATEGORY THINKING: "What makes a word belong in this group?"
        5. STRATEGY QUESTIONING: "Can you explain your thinking process?"

        RESPONSE REQUIREMENTS:
        - Start with warm encouragement about their sorting attempt
        - Ask 1-2 strategic Socratic questions appropriate for ${gradeLevel} level
        - Focus on the specific sorting criteria for "${topicName.replace(/_/g, ' ')}"
        - Use age-appropriate vocabulary and concepts
        - Guide them to reconsider their sorting choices
        - Add 1-2 encouraging emojis
        - Keep to 2 sentences maximum
        - DO NOT reveal the correct answers or sorting
        
        Example: "🤔 Interesting sorting! Can you tell me what sounds you hear in each word and how that helps you decide where they go? What do you notice about the vowel sounds in the words you put together?"
        
        Return ONLY your Socratic response, nothing extra.`;
      } else if (questionType === 'reading_comprehension') {
        // Reading comprehension question
        reflectionPrompt = `You are Krafty, a warm and curious AI tutor using Socratic questioning to guide a ${gradeLevel} student learning English. The child had difficulty with reading comprehension, and your goal is to use strategic questions to help them improve their reading and understanding.

        LEARNING CONTEXT:
        - Grade Level: ${gradeLevel}
        - Topic: ${topicName.replace(/_/g, ' ')}
        - Reading Task: "${questionText}"
        - Student's reading accuracy: ${selectedAnswer}%
        - Target accuracy should be higher, but focus on improvement, not perfection.

        SOCRATIC TEACHING APPROACH FOR READING COMPREHENSION:
        Use targeted questions to guide reading improvement:
        
        1. READING STRATEGY: "What strategies help you read more clearly?"
        2. SOUND AWARENESS: "Can you tell me which words felt tricky to say?"
        3. COMPREHENSION CHECK: "What did you understand from the passage?"
        4. PACING REFLECTION: "How did the speed of your reading feel?"
        5. CONFIDENCE BUILDING: "Which parts did you read really well?"

        RESPONSE REQUIREMENTS:
        - Start with warm encouragement about their reading attempt
        - Ask 1-2 strategic Socratic questions appropriate for ${gradeLevel} level
        - Focus on the specific reading skills in "${topicName.replace(/_/g, ' ')}"
        - Use age-appropriate vocabulary and concepts
        - Guide them toward better reading strategies
        - Add 1-2 encouraging emojis
        - Keep to 2 sentences maximum
        - DO NOT criticize, only guide improvement
        
        Example: "🌟 Great effort reading! Can you tell me which words felt the trickiest, and what strategies might help you with those words? Let's think about how we can make your reading even smoother!"
        
        Return ONLY your Socratic response, nothing extra.`;
      } else {
        // Fallback for any other question types (treat as generic)
        const selectedOption = options ? options[selectedAnswer as number] : selectedAnswer;
        
        reflectionPrompt = `You are Krafty, a warm and curious AI tutor using Socratic questioning to guide a ${gradeLevel} student learning English. The child gave a wrong answer, and your goal is to use strategic questions to help them discover the correct reasoning themselves.

        LEARNING CONTEXT:
        - Grade Level: ${gradeLevel}
        - Topic: ${topicName.replace(/_/g, ' ')}
        - Question: "${questionText}"
        - Student's answer: "${selectedOption}"
        - There is a better answer, but DO NOT reveal this.

        RESPONSE REQUIREMENTS:
        - Start with warm encouragement
        - Ask 1-2 strategic Socratic questions appropriate for ${gradeLevel} level
        - Focus on the specific learning goal in "${topicName.replace(/_/g, ' ')}"
        - Add 1-2 encouraging emojis
        - Keep to 2 sentences maximum
        - DO NOT reveal the correct answer
        
        Example: "🤔 Great try! Can you tell me what you were thinking? Let's look at this together - what clues can you find?"
        
        Return ONLY your Socratic response, nothing extra.`;
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
        return `🤔 Great effort on this ${topicName.replace(/_/g, ' ').toLowerCase()} question! Can you tell me what made you choose "${selectedOption}"? Let's look at the question again together.`;
      } else if (questionType === 'fill_blank') {
        return `🌟 Nice try with your ${topicName.replace(/_/g, ' ').toLowerCase()} work! Can you think about what sounds you hear when you say that word? What other word might fit better here?`;
      } else if (questionType === 'drag_drop') {
        return `🤔 Interesting sorting work on ${topicName.replace(/_/g, ' ').toLowerCase()}! Can you tell me what rule you're using to sort these words? What sounds do you hear in each word?`;
      } else if (questionType === 'reading_comprehension') {
        return `🌟 Great effort reading! Can you tell me which words felt the trickiest? What strategies might help you read even better?`;
      } else {
        return `🤔 Great try with your ${topicName.replace(/_/g, ' ').toLowerCase()} work! Can you tell me what you were thinking? Let's look at this together.`;
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
