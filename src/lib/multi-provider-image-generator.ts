import OpenAI from 'openai';
import { GoogleGenAI, PersonGeneration } from '@google/genai';
import { ChatMessage } from './utils';
import { toast } from 'sonner'
import analytics from '@/lib/analytics';
import { PetProgressStorage } from '@/lib/pet-progress-storage';
import { auth } from '@/lib/firebase';

export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  attempts: number;
  provider: 'flux-schnell' | 'flux-pro' | 'google-imagen' | 'openai' | 'azure' | 'stable-diffusion' | 'none';
  duration: number;
}

export interface GenerationOptions {
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  adventureContext?: ChatMessage[];
  sanitizedConversationContext?: string;
  attemptNumber?: number;
  username?: string;
}

/**
 * Multi-provider image generator with fallback strategy
 * Integrates with existing Firebase image service for persistence
 */
export class MultiProviderImageGenerator {
  private readonly providers: ImageProvider[];
  private nextStartingProviderIndex: 0 | 1 = 0;

  constructor() {
    this.providers = [
      new FluxSchnellProvider(),
      new FluxProProvider(),
      new FluxSchnellProvider(),
      new FluxProProvider(),
      // new OpenAIProvider(),
      // new GoogleImagenProvider(),
      // new AzureOpenAIProvider(),
      // new StableDiffusionProvider()
    ];
  }

  async generateWithFallback(
    prompt: string,
    userId: string,
    options: GenerationOptions = {},
    sanitizedFallbackPrompt?: string
  ): Promise<ImageGenerationResult> {

    let lastError: Error | null = null;
    const startTime = Date.now();

    // Try each provider in order
    const providerStartingIndex = this.nextStartingProviderIndex;
    this.nextStartingProviderIndex = this.nextStartingProviderIndex === 0 ? 1 : 0;
    for (let attempt = 0; attempt < this.providers.length; attempt++) {
      const provider = this.providers[(providerStartingIndex+attempt)%2];
      const providerStartTime = Date.now();

      // Skip providers that aren't configured
      if (!provider.isConfigured()) {
        // console.log(`⚠️ [MultiProviderImageGenerator.generateWithFallback()] ${provider.name} not configured, skipping...`);
        continue;
      }

      try {
        // Refine prompt for this specific provider
        const promptForProvider = (provider.name === 'flux-schnell' || provider.name === 'flux-pro') && sanitizedFallbackPrompt
          ? sanitizedFallbackPrompt
          : prompt;
        const refinedPrompt = await this.refinePromptForProvider(promptForProvider, provider.name, options);
        // console.log(`🎯 [MultiProviderImageGenerator.generateWithFallback()] Refined prompt for ${provider.name}: "${refinedPrompt}"`);

        // Generate image with current provider
        const imageUrl = await provider.generate(refinedPrompt, userId, {
          ...options,
          attemptNumber: attempt + 1,
          adventureContext: options.adventureContext || [],
          sanitizedConversationContext: options.sanitizedConversationContext
        });
        const providerDuration = Date.now() - providerStartTime;

        const lengthInfo = typeof imageUrl === 'string' ? imageUrl.length : 'unknown-length';
        // console.log(`✅ [MultiProviderImageGenerator.generateWithFallback()] ${provider.name} generated image successfully in ${providerDuration}ms (length=${lengthInfo})`);

        const totalDuration = Date.now() - startTime;

        return {
          success: true,
          imageUrl,
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
          // console.log(`🚫 Content policy violation detected, not trying other providers`);
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
    providerName: ImageProvider['name'],
    options: GenerationOptions
  ): Promise<string> {

    // Basic content filtering for child-friendly content
    let refinedPrompt = originalPrompt
      .replace(/scary|frightening|terrifying|horror/gi, 'mysterious')
      .replace(/dark|gloomy|sinister/gi, 'light')
      .replace(/dangerous|perilous/gi, 'challenging')
      .replace(/weapon|sword|gun/gi, 'magical tool')
      .replace(/dress|camisole|gown|enchanting|robe|skirt|corset|cape/gi, 'casual clothes')
      .replace(/bikini/gi, 'modest clothing');

    // Provider-specific fallback optimizations (only used if response processor's enhanced prompt fails)
    switch (providerName) {
      case 'openai':
        // Since enhanced prompt is applied at response processor level, just pass through with minor style hints
        refinedPrompt = `${refinedPrompt}, digital art style, high quality`;
        break;

      case 'azure':
        refinedPrompt = `${refinedPrompt}, cinematic style, vivid colors`;
        break;

      case 'flux-schnell':
      case 'flux-pro':
        // Get current pet for consistency with AI prompt sanitizer
        const currentPetId = ((): string => {
          try {
            return PetProgressStorage.getCurrentSelectedPet() || localStorage.getItem('current_pet') || 'dog';
          } catch {
            return 'dog';
          }
        })();
        refinedPrompt = `${refinedPrompt}. Strict rules: In case of any humans / human-like creatures, completely convert them to flat chested, friendly single ${currentPetId} unless any other pets are mentioned. ART INSTRUCTION: Vividly realistic, Cinematic with bright natural lighting, warm sunlight streaming in, cheerful and safe mood, realistic fur, 24mm film look, grounded realism — live-action adventure still from Uncharted or Avengers, not stylized, not animated.`;
        break;
      //Strict rules: In case of any humans / human-like creatures, completely convert them to fully clothed, modest flat chested, family friendly ${currentPetId}s.
      // Strict Rules: shoulders of all characters should be fully covered with clothes, with no bare skin visible. All characters are strictly 9 years old or less. All girls are strictly flat chested. 
      case 'google-imagen':
        refinedPrompt = `${refinedPrompt}, high quality art, richly detailed, photorealistic lighting`;
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
      // errorMessage.includes('moderated') ||
      errorMessage.includes('policy');
  }

  /**
   * Extract adventure ID from context (for Firebase storage)
   */
  private extractAdventureId(context: ChatMessage[]): string {
    // Since ChatMessage doesn't have metadata, generate a consistent ID based on context
    const contextHash = context.slice(-10).map(msg => msg.content).join('').length;
    return `adventure-${contextHash}-${Date.now()}`;
  }

  /**
   * Get recent AI messages for context
   */
  private getRecentAIMessages(context: ChatMessage[]): string {
    return context
      .filter(msg => msg.type === 'ai')
      .slice(-6)
      .map(msg => msg.content.substring(0, 250))
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
  name: 'flux-schnell' | 'flux-pro' | 'google-imagen' | 'openai' | 'azure' | 'stable-diffusion';
  isConfigured(): boolean;
  generate(prompt: string, userId: string, options?: GenerationOptions): Promise<string>;
}

class FluxSchnellProvider implements ImageProvider {
  name = 'flux-schnell' as const;

  isConfigured(): boolean {
    return true;
  }

  async generate(prompt: string, userId: string, options: GenerationOptions = {}): Promise<string> {
    const apiUrl = 'https://api.readkraft.com/api/replicate/v1/models/black-forest-labs/flux-schnell/predictions';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'prefer': 'wait',
      },
      body: JSON.stringify({
        input: {
          prompt,
          go_fast: true,
          output_quality: 100,
          num_inference_steps: 4,
          aspect_ratio: '5:4',
          output_format: 'png',
          //safety_tolerance: 1,
          //prompt_upsampling: false,

          metadata: (() => {
            const getUsername = (): string => {
              try {
                const fromOption = (options as any)?.username;
                if (typeof fromOption === 'string' && fromOption.trim()) return fromOption.trim();
              } catch { }
              try {
                const n = (auth?.currentUser?.displayName || '').trim();
                if (n) return n;
              } catch { }
              try {
                for (let i = 0; i < localStorage.length; i++) {
                  const k = localStorage.key(i) || '';
                  if (k.startsWith('firebase:authUser:')) {
                    const rawUser = localStorage.getItem(k);
                    if (rawUser) {
                      const obj = JSON.parse(rawUser);
                      const dn = ((obj?.displayName || (obj?.providerData?.[0]?.displayName)) || '').trim();
                      if (dn) return dn;
                    }
                  }
                }
              } catch { }
              return 'friend';
            };
            try {
              const raw = localStorage.getItem('user_adventure');
              const username = getUsername();
              const attempt = typeof (options as any)?.attemptNumber === 'number' ? (options as any).attemptNumber : 1;
              if (!raw) return { username, attempt };
              const parsed = JSON.parse(raw);
              if (!Array.isArray(parsed)) return { username, attempt };
              const visibleMessages = parsed.filter((m: any) => !m?.hiddenInChat && (m.content || "").trim().toLowerCase() !== 'transcribing...');
              const lastFour = visibleMessages.slice(-6);
              const compact = lastFour.map((m: any) => ({
                type: m?.type,
                content: typeof m?.content === 'string' ? m.content : String(m?.content ?? ''),
                timestamp: typeof m?.timestamp === 'number' ? m.timestamp : Date.now()
              }));
              return { user_adventure: compact, username, attempt };
            } catch {
              const username = getUsername();
              const attempt = typeof (options as any)?.attemptNumber === 'number' ? (options as any).attemptNumber : 1;
              return { username, attempt };
            }
          })(),
        },
        webhook: "https://api.readkraft.com/api/discord",
        webhook_events_filter: [
          "completed"
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Flux Schnell Replicate API failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    const firstOutputUrl = result?.output?.[0];
    if (!firstOutputUrl || typeof firstOutputUrl !== 'string') {
      analytics.capture('image_creation_failed', {
        provider: 'flux',
        prompt,
      });
      toast.warning('Oops, image creation failed!', {
        duration: 3000,
      });
      // console.info("Inappropriate image generated by Flux Schnell");
      return
      //throw new Error('Flux Schnell Replicate API did not return an output URL');
    }
    return firstOutputUrl;
  }
}

class FluxProProvider implements ImageProvider {
  name = 'flux-pro' as const;

  isConfigured(): boolean {
    return true;
  }

  async generate(prompt: string, userId: string, options: GenerationOptions = {}): Promise<string> {
    const apiUrl = 'https://api.readkraft.com/api/replicate/v1/models/black-forest-labs/flux-1.1-pro/predictions';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'prefer': 'wait',
      },
      body: JSON.stringify({
        input: {
          prompt,
          output_quality: 100,
          aspect_ratio: '5:4',
          output_format: 'png',
          safety_tolerance: 1,
          prompt_upsampling: false,          
          metadata: (() => {
            const getUsername = (): string => {
              try {
                const fromOption = (options as any)?.username;
                if (typeof fromOption === 'string' && fromOption.trim()) return fromOption.trim();
              } catch { }
              try {
                const n = (auth?.currentUser?.displayName || '').trim();
                if (n) return n;
              } catch { }
              try {
                for (let i = 0; i < localStorage.length; i++) {
                  const k = localStorage.key(i) || '';
                  if (k.startsWith('firebase:authUser:')) {
                    const rawUser = localStorage.getItem(k);
                    if (rawUser) {
                      const obj = JSON.parse(rawUser);
                      const dn = ((obj?.displayName || (obj?.providerData?.[0]?.displayName)) || '').trim();
                      if (dn) return dn;
                    }
                  }
                }
              } catch { }
              return 'friend';
            };
            try {
              const raw = localStorage.getItem('user_adventure');
              const username = getUsername();
              const attempt = typeof (options as any)?.attemptNumber === 'number' ? (options as any).attemptNumber : 1;
              if (!raw) return { username, attempt };
              const parsed = JSON.parse(raw);
              if (!Array.isArray(parsed)) return { username, attempt };
              const visibleMessages = parsed.filter((m: any) => !m?.hiddenInChat && (m.content || "").trim().toLowerCase() !== 'transcribing...');
              const lastFour = visibleMessages.slice(-6);
              const compact = lastFour.map((m: any) => ({
                type: m?.type,
                content: typeof m?.content === 'string' ? m.content : String(m?.content ?? ''),
                timestamp: typeof m?.timestamp === 'number' ? m.timestamp : Date.now()
              }));
              return { user_adventure: compact, username, attempt };
            } catch {
              const username = getUsername();
              const attempt = typeof (options as any)?.attemptNumber === 'number' ? (options as any).attemptNumber : 1;
              return { username, attempt };
            }
          })(),
        },
        webhook: "https://api.readkraft.com/api/discord",
        webhook_events_filter: [
          "completed"
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Flux Schnell Replicate API failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    const firstOutputUrl = result?.output;
    if (!firstOutputUrl || typeof firstOutputUrl !== 'string') {
      analytics.capture('image_creation_failed', {
        provider: 'flux',
        prompt,
      });
      toast.warning('Oops, image creation failed!', {
        duration: 3000,
      });
      // console.info("Inappropriate image generated by Flux Schnell");
      return
      //throw new Error('Flux Schnell Replicate API did not return an output URL');
    }
    return firstOutputUrl;
  }
}

class GoogleImagenProvider implements ImageProvider {
  name = 'google-imagen' as const;
  private client: GoogleGenAI | null = null;
  private static blobUrlCache: Map<string, string> = new Map();

  constructor() {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    } else {
      console.warn('⚠️ [GoogleImagenProvider] VITE_GOOGLE_API_KEY not configured. Provider disabled.');
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async generate(prompt: string, userId: string, options: GenerationOptions = {}): Promise<string> {
    if (!this.client) {
      throw new Error('Google Imagen client not configured');
    }

    const response = await this.client.models.generateImages({
      model: 'imagen-4.0-fast-generate-001',
      prompt,
      config: {
        numberOfImages: 1,
        personGeneration: PersonGeneration.ALLOW_ALL,
        includeRaiReason: true,
        outputMimeType: 'image/png',
      },
    });

    const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;

    if (!imageBytes) {
      throw new Error('No image bytes returned from Google Imagen');
    }

    // Return data URL string so UI can render immediately without waiting and we can upload base64
    const dataUrl = `data:image/png;base64,${imageBytes}`;
    // console.log(`✅ [GoogleImagenProvider.generate()] Created data URL from base64 (length: ${imageBytes.length})`);
    return dataUrl;
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

/**
 * OpenAI DALL-E 3 Provider
 */
class OpenAIProvider implements ImageProvider {
  name = 'openai' as const;
  private client: OpenAI | null = null;

  constructor() {
    this.client = new OpenAI({
      dangerouslyAllowBrowser: true,
      apiKey: null,
      baseURL: 'https://api.readkraft.com/api/v1'
    });
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async generate(prompt: string, userId: string, options: GenerationOptions = {}): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI client not configured');
    }
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

    // console.log(`✅ [OpenAIProvider.generate()] Successfully generated image with DALL-E 3`); 
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

    // console.log(`✅ [AzureOpenAIProvider.generate()] Successfully generated image with Azure DALL-E 3`); 
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

    // console.log(`✅ [StableDiffusionProvider.generate()] Successfully generated image with Stable Diffusion`);

    // Convert base64 to blob URL
    const base64Data = result.artifacts[0].base64;
    const blob = this.base64ToBlob(base64Data, 'image/png');
    const blobUrl = URL.createObjectURL(blob);

    // console.log(`🖼️ [StableDiffusionProvider.generate()] Generated blob URL: ${blobUrl}`);

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
