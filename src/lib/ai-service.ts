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
      content: `You are Krafty, a friendly AI companion in a children's reading adventure app. You help kids create stories by responding enthusiastically to their ideas and encouraging them to continue their adventure. 

Key personality traits:
- Enthusiastic and encouraging
- Uses emojis appropriately (1-2 per message)
- Keeps responses brief but engaging (1-2 sentences max)
- Focuses on story development and creativity
- Age-appropriate language for children
- Always asks follow-up questions to keep the story going

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

  // Extract and filter relevant adventure context
  private extractAdventureContext(userAdventure: ChatMessage[]): string {
    if (!userAdventure || userAdventure.length === 0) {
      return "";
    }

    // Get recent messages (last 8 messages for better context)
    const recentMessages = userAdventure.slice(-8);
    
    // Extract key story elements - characters, locations, objects, actions
    const storyElements = recentMessages
      .map(msg => msg.content)
      .join(" ")
      .toLowerCase();

    // Look for story elements like characters, settings, objects
    const characters = this.extractStoryElements(storyElements, [
      'captain', 'explorer', 'astronaut', 'hero', 'friend', 'krafty', 'robot', 'alien', 
      'pikachu', 'pokemon', 'character', 'wizard', 'princess', 'prince', 'knight'
    ]);
    
    const settings = this.extractStoryElements(storyElements, [
      'space', 'planet', 'rocket', 'spaceship', 'adventure', 'mission', 'quest', 
      'journey', 'castle', 'forest', 'ocean', 'mountain', 'island', 'city', 'school'
    ]);
    
    const objects = this.extractStoryElements(storyElements, [
      'treasure', 'map', 'key', 'sword', 'shield', 'book', 'magic', 'crystal'
    ]);

    // Build contextual summary
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

    console.log('Extracted adventure context:', {
      characters,
      settings,
      objects,
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

      const contextualPrompt = `You are creating an engaging educational question for a child by incorporating their adventure story context.

TASK: Rewrite the learning question to fit naturally into the child's adventure story while preserving ALL educational words.

ORIGINAL QUESTION: "${originalQuestion}"
CORRECT ANSWER: "${correctOption}"
ALL OPTIONS: ${options.map((opt, i) => `${i + 1}. "${opt}"`).join(", ")}

ADVENTURE CONTEXT: "${adventureContext || this.getDefaultAdventureContext()}"

CRITICAL REQUIREMENTS:
1. PRESERVE ALL WORDS that appear in the answer options - these are the educational words being taught
2. Do NOT change any answer options
3. Do NOT replace educational words with adventure-related words (e.g., don't change "elephant" to "rocketship")
4. ONLY change the question scenario/context to fit the adventure
5. Use characters, settings, or themes from the adventure context for the scenario
6. Keep the exact same educational objective (spacing, grammar, phonics, etc.)
7. Make it exciting and age-appropriate for children

WORDS TO PRESERVE: ${wordsToPreserve.join(', ')}

EXAMPLES:
- Original: "Choose the sentence with correct spacing"
- Context: "space adventure with captain"  
- Result: "Captain, to navigate the spaceship safely, which sentence has correct spacing?"

- Original: "Which word has the long vowel sound?"
- Context: "treasure hunt adventure"
- Result: "In your treasure hunt, which word has the long vowel sound?"

- Original: "Find the sentence with the word 'elephant'"
- Context: "space mission with astronauts"
- Result: "Astronaut, during your space mission, find the sentence with the word 'elephant'"

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

  // Sanitize content for safe DALL-E prompts
  private sanitizeContentForImage(content: string): string {
    if (!content) return "";

    // Remove potentially problematic content and keep safe, educational terms
    const safeSentences = content
      .split(/[.!?]+/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 3 && sentence.length < 80) // Increased length limit
      .filter(sentence => {
        const lowerSentence = sentence.toLowerCase();
        
        // First exclude obviously problematic content
        if (/(violence|weapon|fight|scary|dark|evil|bad|hurt|danger|kill|death|blood|war)/i.test(lowerSentence)) {
          return false;
        }
        
        // Keep sentences with educational, adventure, and child-friendly content
        return (
          // Educational terms
          /\b(learn|read|story|book|adventure|explore|discover|find|map|treasure|space|planet|rocket|journey|quest|mission|study|school|teacher|student)\b/.test(lowerSentence) ||
          // Character/setting references
          /\b(captain|explorer|astronaut|character|hero|friend|journey|castle|forest|ocean|mountain|island|city|town|home|family|animal|pet)\b/.test(lowerSentence) ||
          // Fun activities and objects
          /\b(play|game|fun|exciting|amazing|wonderful|beautiful|colorful|magical|happy|smile|laugh|sing|dance|build|create|draw|paint)\b/.test(lowerSentence) ||
          // Common story elements that are safe
          /\b(prince|princess|king|queen|wizard|magic|fairy|dragon|unicorn|robot|spaceship|car|house|tree|flower|sun|moon|star)\b/.test(lowerSentence) ||
          // Basic descriptive words
          /\b(big|small|tall|short|fast|slow|new|old|good|great|nice|cool|awesome|super|special)\b/.test(lowerSentence)
        );
      })
      .slice(0, 4) // Keep up to 4 relevant sentences
      .join(". ");

    console.log('Sanitized sentences:', safeSentences);
    return safeSentences;
  }

  // Generate safe educational prompts
  private generateSafePrompt(answerWord: string, safeContext: string, baseImagePrompt: string): string[] {
    const baseStyle = "Create a colorful, educational illustration for children featuring";
    const styleEnding = "Bright cartoon style, friendly, educational, safe for children.";
    
    // Multiple prompt options, from most contextual to most generic
    const prompts: string[] = [];

    // Option 1: With sanitized context (if available)
    if (safeContext && safeContext.length > 5) {
      prompts.push(`${baseStyle} "${answerWord}" in a fun learning adventure with ${safeContext}. ${styleEnding}`);
    }

    // Option 2: With base image prompt
    if (baseImagePrompt) {
      prompts.push(`${baseStyle} "${answerWord}" in an educational ${baseImagePrompt}. ${styleEnding}`);
    }

    // Option 3: Generic educational prompt
    prompts.push(`${baseStyle} the concept of "${answerWord}" in a fun, educational way. Show children learning about ${answerWord}. ${styleEnding}`);

    // Option 4: Super simple fallback
    prompts.push(`Educational cartoon illustration showing "${answerWord}" for children. Colorful, friendly, safe.`);

    return prompts;
  }

  // Generate contextual image using DALL-E with enhanced safety
  async generateContextualImage(
    answerWord: string,
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
      const promptOptions = this.generateSafePrompt(answerWord, safeAdventureContext, imagePrompt);

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
    options: string[],
    selectedAnswer: number,
    correctAnswer: number
  ): Promise<string> {
    // If not initialized or no API key, return fallback
    if (!this.isInitialized || !this.client) {
      const selectedOption = options[selectedAnswer];
      return `🤔 Hmm, that's not quite right! Can you think about why "${selectedOption}" might not be the best answer? What clues in the question might help you?`;
    }

    try {
      const selectedOption = options[selectedAnswer];
      
      const reflectionPrompt = `You are Krafty, a friendly AI tutor helping a child learn. The child just answered a multiple-choice question incorrectly, and your job is to guide them to think about WHY their answer is wrong WITHOUT revealing the correct answer yet.

Question: "${questionText}"
Options: ${options.map((opt, i) => `${i}: "${opt}"`).join(", ")}
Student chose: "${selectedOption}" (option ${selectedAnswer})
Correct answer is option ${correctAnswer}, but DO NOT mention this or reveal the correct answer.

Create a supportive response that:
1. Acknowledges their attempt positively
2. Asks them to think about why their chosen answer might not be correct
3. Gives a gentle hint about what to look for in the question
4. Encourages them to explain their thinking
5. Uses age-appropriate language for children
6. Does NOT reveal the correct answer
7. Uses 1-2 appropriate emojis
8. Keeps it under 2 sentences

Example style: "🤔 That's a good try! Can you think about what makes '${selectedOption}' different from what the question is asking for? What clues can you find in the question?"

Return ONLY your response, nothing else.`;

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
      const selectedOption = options[selectedAnswer];
      return `🤔 Hmm, that's not quite right! Can you think about why "${selectedOption}" might not be the best answer? What clues in the question might help you?`;
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
