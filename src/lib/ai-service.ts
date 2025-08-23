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

The child is creating a comic story about space adventures. Respond to their story ideas with excitement and help them think of what could happen next.`
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

  // Generate contextual question based on adventure context
  async generateContextualQuestion(
    originalQuestion: string,
    options: string[],
    correctAnswer: number,
    userAdventure: ChatMessage[]
  ): Promise<string> {
    // If not initialized or no API key, return original question
    if (!this.isInitialized || !this.client) {
      return originalQuestion;
    }

    try {
      // Extract adventure context from chat messages
      const adventureContext = userAdventure
        .slice(-10) // Get last 10 messages for context
        .map(msg => msg.content)
        .join(" ");

      // Get the correct answer option
      const correctOption = options[correctAnswer];

      const contextualPrompt = `You are helping create an educational question that incorporates a child's adventure story context while maintaining the original learning objective.

Original question: "${originalQuestion}"
Correct answer option: "${correctOption}"
All answer options: ${options.map((opt, i) => `${i}: "${opt}"`).join(", ")}

Adventure context from the child's story: "${adventureContext}"

Create a new question that:
1. Incorporates characters, settings, or themes from the adventure context
2. Maintains the exact same educational objective as the original question
3. Uses the correct answer option naturally in the context
4. Is engaging and age-appropriate for children
5. Does NOT change the answer options - they must remain exactly the same

If there's insufficient adventure context, make it generic but exciting (like "the brave explorer said..." or "to complete the mission...").

Return ONLY the new question text, nothing else.`;

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
      
      if (response) {
        return response.trim();
      } else {
        throw new Error('No response content received');
      }
    } catch (error) {
      console.error('OpenAI API error generating contextual question:', error);
      // Return original question on error
      return originalQuestion;
    }
  }

  // Sanitize content for safe DALL-E prompts
  private sanitizeContentForImage(content: string): string {
    if (!content) return "";

    // Remove potentially problematic content and keep only safe, educational terms
    const safeSentences = content
      .split(/[.!?]+/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 3 && sentence.length < 50)
      .filter(sentence => {
        const lowerSentence = sentence.toLowerCase();
        // Keep only educational, adventure, and child-friendly content
        return (
          // Include educational terms
          /\b(learn|read|story|book|adventure|explore|discover|find|map|treasure|space|planet|rocket|journey|quest|mission)\b/.test(lowerSentence) ||
          // Include safe character/setting references
          /\b(captain|explorer|astronaut|character|hero|friend|journey|castle|forest|ocean|mountain|island)\b/.test(lowerSentence)
        ) &&
        // Exclude anything potentially problematic
        !/(violence|weapon|fight|scary|dark|evil|bad|hurt|danger|problem)/i.test(lowerSentence);
      })
      .slice(0, 3) // Keep only first 3 relevant sentences
      .join(". ");

    return safeSentences;
  }

  // Generate safe educational prompts
  private generateSafePrompt(answerWord: string, safeContext: string, baseImagePrompt: string): string[] {
    const baseStyle = "Create a colorful, educational illustration for children featuring";
    const styleEnding = "Bright cartoon style, friendly, educational, safe for children.";
    
    // Multiple prompt options, from most contextual to most generic
    const prompts: string[] = [];

    // Option 1: With sanitized context (if available)
    if (safeContext && safeContext.length > 10) {
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
      // Extract and sanitize adventure context from chat messages
      const rawAdventureContext = userAdventure
        .slice(-6) // Reduced from 8 to 6 for better safety
        .map(msg => msg.content)
        .join(" ");

      const safeAdventureContext = this.sanitizeContentForImage(rawAdventureContext);

      // Generate multiple prompt options from most specific to most generic
      const promptOptions = this.generateSafePrompt(answerWord, safeAdventureContext, imagePrompt);

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
