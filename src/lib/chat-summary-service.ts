import OpenAI from 'openai';
import { ChatMessage } from './utils';

export interface ChatSummary {
  summary: string;
  messageCount: number;
  lastMessageTimestamp: number;
  generatedAt: number;
}

class ChatSummaryService {
  private client: OpenAI | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    if (apiKey) {
      this.client = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      });
      this.isInitialized = true;
    } else {
      console.warn('VITE_OPENAI_API_KEY not found. Summary generation will use fallback mode.');
      this.isInitialized = false;
    }
  }

  /**
   * Generate a summary of recent chat messages combined with previous summary
   * @param messages - New messages to summarize (typically last 2-4 messages)  
   * @param previousSummary - Previous chat summary to build upon
   * @param adventureContext - Current adventure context for relevance
   * @returns Promise<string> - Generated summary
   */
  async generateChatSummary(
    messages: ChatMessage[], 
    previousSummary?: string,
    adventureContext?: any
  ): Promise<string> {
    if (!this.isInitialized || !this.client) {
      return this.getFallbackSummary(messages, previousSummary);
    }

    try {
      // Format messages for AI processing
      const formattedMessages = messages.map(msg => 
        `${msg.type === 'user' ? 'Child' : 'Assistant'}: ${msg.content}`
      ).join('\n');

      const systemPrompt = `You are creating a memory summary for a child's adventure story. Your job is to create a concise summary that captures:

1. Key story elements (characters, settings, conflicts)
2. Important decisions made by the child  
3. Character relationships and emotions
4. Current story state and direction

Rules:
- Keep summary under 150 words
- Focus on story elements that matter for future conversations
- Maintain child-friendly language (age 6-11)
- Preserve the child's creative ownership
- Update/merge with previous summary when provided

Adventure Context: ${adventureContext ? JSON.stringify(adventureContext) : 'General adventure'}

${previousSummary ? `Previous Summary: ${previousSummary}` : 'This is the start of the adventure summary.'}

Recent Messages:
${formattedMessages}

Generate an updated summary that combines the previous context with new information:`;

      const response = await this.client.chat.completions.create({
        model: 'chatgpt-4o-latest',
        messages: [
          { role: 'system', content: systemPrompt }
        ],
        max_tokens: 200,
        temperature: 0.3, // Lower temperature for consistent summaries
      });

      const summary = response.choices[0]?.message?.content?.trim();
      
      if (!summary) {
        console.warn('Empty summary generated, using fallback');
        return this.getFallbackSummary(messages, previousSummary);
      }

      console.log('✅ Generated chat summary:', summary.substring(0, 50) + '...');
      return summary;

    } catch (error) {
      console.error('Error generating chat summary:', error);
      return this.getFallbackSummary(messages, previousSummary);
    }
  }

  /**
   * Fallback summary generation when API is unavailable
   */
  private getFallbackSummary(messages: ChatMessage[], previousSummary?: string): string {
    const recentContent = messages
      .slice(-2) // Last 2 messages
      .map(msg => msg.content)
      .join(' ');

    const baseSummary = `Adventure continues with: ${recentContent.substring(0, 100)}...`;
    
    if (previousSummary) {
      return `${previousSummary} ${baseSummary}`;
    }
    
    return baseSummary;
  }

  /**
   * Check if summary should be generated based on message count
   * @param messageCount - Current total messages in chat
   * @param lastSummaryMessageCount - Message count when last summary was generated
   * @returns boolean - Whether to generate new summary
   */
  shouldGenerateSummary(messageCount: number, lastSummaryMessageCount: number = 0): boolean {
    const messagesSinceLastSummary = messageCount - lastSummaryMessageCount;
    
    // Generate summary every 2 messages (configurable)
    return messagesSinceLastSummary >= 2;
  }

  /**
   * Create a ChatSummary object with metadata
   */
  createSummaryObject(
    summaryText: string, 
    messageCount: number, 
    lastMessageTimestamp: number
  ): ChatSummary {
    return {
      summary: summaryText,
      messageCount,
      lastMessageTimestamp,
      generatedAt: Date.now()
    };
  }
}

export const chatSummaryService = new ChatSummaryService();
