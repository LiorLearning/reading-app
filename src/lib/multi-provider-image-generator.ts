import OpenAI from 'openai';
import { ChatMessage } from './utils';
import { FirebaseImageService } from './firebase-image-service';

export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  attempts: number;
  provider: 'openai' | 'azure' | 'stable-diffusion' | 'none';
  duration: number;
}

export interface GenerationOptions {
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  adventureContext?: ChatMessage[];
}

/**
 * Multi-provider image generator with fallback strategy
 * Integrates with existing Firebase image service for persistence
 */
export class MultiProviderImageGenerator {
  private readonly providers: ImageProvider[];
  private readonly firebaseImageService: FirebaseImageService;
  
  constructor() {
    this.providers = [
      new OpenAIProvider(),
      new AzureOpenAIProvider(), 
      new StableDiffusionProvider()
    ];
    this.firebaseImageService = new FirebaseImageService();
  }
  
  /**
   * Generate image with automatic fallback across providers
   */
  async generateWithFallback(
    prompt: string, 
    userId: string,
    options: GenerationOptions = {}
  ): Promise<ImageGenerationResult> {
    
    let lastError: Error | null = null;
    const startTime = Date.now();
    
    console.log(`🚀 [MultiProviderImageGenerator.generateWithFallback()] Starting image generation`);
    console.log(`📝 [MultiProviderImageGenerator.generateWithFallback()] Full prompt: "${prompt}"`);
    console.log(`👤 [MultiProviderImageGenerator.generateWithFallback()] User ID: ${userId}`);
    console.log(`⚙️ [MultiProviderImageGenerator.generateWithFallback()] Options:`, options);
    console.log(`🔄 [MultiProviderImageGenerator.generateWithFallback()] Available providers: ${this.providers.map(p => p.name).join(', ')}`);
    
    // Try each provider in order
    for (let attempt = 0; attempt < this.providers.length; attempt++) {
      const provider = this.providers[attempt];
      const providerStartTime = Date.now();
      
      // Skip providers that aren't configured
      if (!provider.isConfigured()) {
        console.log(`⚠️ [MultiProviderImageGenerator.generateWithFallback()] ${provider.name} not configured, skipping...`);
        continue;
      }
      
      try {
        console.log(`🔄 [MultiProviderImageGenerator.generateWithFallback()] Attempting image generation with ${provider.name}... (attempt ${attempt + 1}/${this.providers.length})`);
        
        // Refine prompt for this specific provider
        const refinedPrompt = await this.refinePromptForProvider(prompt, provider.name, options);
        console.log(`🎯 [MultiProviderImageGenerator.generateWithFallback()] Refined prompt for ${provider.name}: "${refinedPrompt}"`);
        
        // Generate image with current provider
        const imageUrl = await provider.generate(refinedPrompt, userId, options);
        const providerDuration = Date.now() - providerStartTime;
        
        console.log(`✅ [MultiProviderImageGenerator.generateWithFallback()] ${provider.name} generated image successfully in ${providerDuration}ms`);
        console.log(`🖼️ [MultiProviderImageGenerator.generateWithFallback()] Generated image URL: ${imageUrl}`);
        
        // Upload to Firebase for persistence (non-blocking)
        let persistentUrl = imageUrl;
        try {
          const adventureId = options.adventureContext 
            ? this.extractAdventureId(options.adventureContext)
            : crypto.randomUUID();
            
          const uploadResult = await this.firebaseImageService.uploadGeneratedImage(
            userId,
            adventureId,
            imageUrl,
            prompt,
            this.buildAdventureContextString(options.adventureContext || [])
          );
          
          if (uploadResult?.imageUrl) {
            persistentUrl = uploadResult.imageUrl;
            console.log(`☁️ [MultiProviderImageGenerator.generateWithFallback()] Image uploaded to Firebase successfully`);
            console.log(`🔗 [MultiProviderImageGenerator.generateWithFallback()] Firebase URL: ${persistentUrl}`);
          }
        } catch (uploadError) {
          console.warn('⚠️ [MultiProviderImageGenerator.generateWithFallback()] Firebase upload failed, using original URL:', uploadError);
          // Continue with original URL - don't fail the entire generation
        }
        
        const totalDuration = Date.now() - startTime;
        
        return {
          success: true,
          imageUrl: persistentUrl,
          attempts: attempt + 1,
          provider: provider.name,
          duration: totalDuration
        };
        
      } catch (error) {
        lastError = error as Error;
        const providerDuration = Date.now() - providerStartTime;
        
        console.error(`❌ ${provider.name} failed after ${providerDuration}ms:`, error);
        
        // Check for content policy violations (don't retry with other providers)
        if (this.isContentPolicyError(error)) {
          console.log(`🚫 Content policy violation detected, not trying other providers`);
          return {
            success: false,
            error: `Content not suitable for image generation: ${error.message}`,
            attempts: attempt + 1,
            provider: provider.name,
            duration: Date.now() - startTime
          };
        }
        
        // Continue to next provider for other errors
        continue;
      }
    }
    
    // All providers failed
    const totalDuration = Date.now() - startTime;
    console.error(`❌ All image providers failed after ${totalDuration}ms`);
    
    return {
      success: false,
      error: lastError?.message || 'All image generation providers failed',
      attempts: this.providers.length,
      provider: 'none',
      duration: totalDuration
    };
  }
  
  /**
   * Refine prompt for specific provider to improve success rate
   */
  private async refinePromptForProvider(
    originalPrompt: string, 
    providerName: string, 
    options: GenerationOptions
  ): Promise<string> {
    
    // Basic content filtering for child-friendly content
    let refinedPrompt = originalPrompt
      .replace(/scary|frightening|terrifying|horror/gi, 'mysterious')
      .replace(/dark|gloomy|sinister/gi, 'shadowy')
      .replace(/dangerous|perilous/gi, 'challenging')
      .replace(/weapon|sword|gun/gi, 'magical tool');
    
    // Provider-specific fallback optimizations (only used if response processor's enhanced prompt fails)
    switch (providerName) {
      case 'openai':
        // Since enhanced prompt is applied at response processor level, just pass through with minor style hints
        refinedPrompt = `${refinedPrompt}, digital art style, high quality`;
        break;
        
      case 'azure':
        refinedPrompt = `${refinedPrompt}, cinematic style, vivid colors`;
        break;
        
      case 'stable-diffusion':
        refinedPrompt = `${refinedPrompt}, realistic art style, detailed`;
        break;
        
      default:
        refinedPrompt = `${refinedPrompt}, high quality art`;
    }
    
    // Ensure prompt isn't too long (DALL-E has limits)
    if (refinedPrompt.length > 2000) {
      refinedPrompt = refinedPrompt.substring(0, 1990) + '...';
    }
    
    return refinedPrompt;
  }
  
  /**
   * Check if error is related to content policy (don't retry)
   */
  private isContentPolicyError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    return errorMessage.includes('content policy') ||
           errorMessage.includes('safety system') ||
           errorMessage.includes('inappropriate') ||
           errorMessage.includes('safety') ||
           errorMessage.includes('policy');
  }
  
  /**
   * Extract adventure ID from context (for Firebase storage)
   */
  private extractAdventureId(context: ChatMessage[]): string {
    // Since ChatMessage doesn't have metadata, generate a consistent ID based on context
    const contextHash = context.slice(-6).map(msg => msg.content).join('').length;
    return `adventure-${contextHash}-${Date.now()}`;
  }
  
  /**
   * Get recent AI messages for context
   */
  private getRecentAIMessages(context: ChatMessage[]): string {
    return context
      .filter(msg => msg.type === 'ai')
      .slice(-6)
      .map(msg => msg.content.substring(0,250))
      .join(' | ');
  }

  /**
   * Build context string for Firebase storage
   */
  private buildAdventureContextString(context: ChatMessage[]): string {
    const userMessages = context
      .slice(-30) // Last 30 messages
      .map(msg => msg.content.substring(0, 5000)) // Truncate for storage
      .join(' | ');
    
    const aiMessages = this.getRecentAIMessages(context);
    
    return aiMessages ? `${userMessages} | AI Context: ${aiMessages}` : userMessages;
  }
}

// Provider interface
interface ImageProvider {
  name: 'openai' | 'azure' | 'stable-diffusion';
  isConfigured(): boolean;
  generate(prompt: string, userId: string, options?: GenerationOptions): Promise<string>;
}

/**
 * OpenAI DALL-E 3 Provider
 */
class OpenAIProvider implements ImageProvider {
  name = 'openai' as const;
  private client: OpenAI | null = null;
  
  constructor() {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      });
    }
  }
  
  isConfigured(): boolean {
    return this.client !== null;
  }
  
  async generate(prompt: string, userId: string, options: GenerationOptions = {}): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI client not configured');
    }
    
    console.log(`🎯 [OpenAIProvider.generate()] Starting DALL-E 3 image generation`);
    console.log(`📝 [OpenAIProvider.generate()] Full prompt: "${prompt}"`);
    console.log(`👤 [OpenAIProvider.generate()] User ID: ${userId}`);
    console.log(`⚙️ [OpenAIProvider.generate()] Options:`, options);
    console.log(`🎯 dall-e prompt multi-provider: ${prompt}`);
    
    const response = await this.client.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      size: options.size || "1024x1024",
      quality: options.quality || "hd",
      style: options.style || "vivid",
      n: 1,
    });
    
    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      console.error(`❌ [OpenAIProvider.generate()] No image URL returned from OpenAI DALL-E 3`);
      throw new Error('No image URL returned from OpenAI DALL-E 3');
    }
    
    console.log(`✅ [OpenAIProvider.generate()] Successfully generated image with DALL-E 3`);
    console.log(`🖼️ [OpenAIProvider.generate()] Image URL: ${imageUrl}`);
    
    return imageUrl;
  }
}

/**
 * Azure OpenAI DALL-E 3 Provider
 */
class AzureOpenAIProvider implements ImageProvider {
  name = 'azure' as const;
  private client: OpenAI | null = null;
  
  constructor() {
    const apiKey = import.meta.env.VITE_AZURE_OPENAI_API_KEY;
    const endpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
    
    if (apiKey && endpoint) {
      this.client = new OpenAI({
        apiKey: apiKey,
        baseURL: `https://${endpoint}.openai.azure.com/openai/deployments/dall-e-3`,
        defaultQuery: { 'api-version': '2024-02-01' },
        defaultHeaders: {
          'api-key': apiKey,
        },
      });
    }
  }
  
  isConfigured(): boolean {
    return this.client !== null;
  }
  
  async generate(prompt: string, userId: string, options: GenerationOptions = {}): Promise<string> {
    if (!this.client) {
      throw new Error('Azure OpenAI client not configured');
    }
    
    console.log(`🎯 [AzureOpenAIProvider.generate()] Starting Azure DALL-E 3 image generation`);
    console.log(`📝 [AzureOpenAIProvider.generate()] Full prompt: "${prompt}"`);
    console.log(`👤 [AzureOpenAIProvider.generate()] User ID: ${userId}`);
    console.log(`⚙️ [AzureOpenAIProvider.generate()] Options:`, options);
    console.log(`🎯 dall-e prompt azure: ${prompt}`);
    
    const response = await this.client.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      size: options.size || "1024x1024",
      quality: options.quality || "hd",
      style: options.style || "vivid",
      n: 1,
    });
    
    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      console.error(`❌ [AzureOpenAIProvider.generate()] No image URL returned from Azure OpenAI DALL-E 3`);
      throw new Error('No image URL returned from Azure OpenAI DALL-E 3');
    }
    
    console.log(`✅ [AzureOpenAIProvider.generate()] Successfully generated image with Azure DALL-E 3`);
    console.log(`🖼️ [AzureOpenAIProvider.generate()] Image URL: ${imageUrl}`);
    
    return imageUrl;
  }
}

/**
 * Stable Diffusion Provider (fallback)
 */
class StableDiffusionProvider implements ImageProvider {
  name = 'stable-diffusion' as const;
  private readonly apiKey: string | undefined;
  private readonly apiUrl = 'https://api.stability.ai/v1/generation/stable-diffusion-v1-6/text-to-image';
  
  constructor() {
    this.apiKey = import.meta.env.VITE_STABILITY_API_KEY;
  }
  
  isConfigured(): boolean {
    return !!this.apiKey;
  }
  
  async generate(prompt: string, userId: string, options: GenerationOptions = {}): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Stability API key not configured');
    }
    
    console.log(`🎯 [StableDiffusionProvider.generate()] Starting Stable Diffusion image generation`);
    console.log(`📝 [StableDiffusionProvider.generate()] Full prompt: "${prompt}"`);
    console.log(`👤 [StableDiffusionProvider.generate()] User ID: ${userId}`);
    console.log(`⚙️ [StableDiffusionProvider.generate()] Options:`, options);
    
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        text_prompts: [{ text: prompt }],
        cfg_scale: 7,
        height: 1024,
        width: 1024,
        steps: 30,
        samples: 1,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Stability API failed (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    
    if (!result.artifacts?.[0]?.base64) {
      console.error(`❌ [StableDiffusionProvider.generate()] No image returned from Stability API`);
      throw new Error('No image returned from Stability API');
    }
    
    console.log(`✅ [StableDiffusionProvider.generate()] Successfully generated image with Stable Diffusion`);
    
    // Convert base64 to blob URL
    const base64Data = result.artifacts[0].base64;
    const blob = this.base64ToBlob(base64Data, 'image/png');
    const blobUrl = URL.createObjectURL(blob);
    
    console.log(`🖼️ [StableDiffusionProvider.generate()] Generated blob URL: ${blobUrl}`);
    
    return blobUrl;
  }
  
  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
}
