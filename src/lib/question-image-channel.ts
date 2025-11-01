import { MultiProviderImageGenerator } from '@/lib/multi-provider-image-generator';

/**
 * Generate a child-friendly educational image for a single vocabulary word.
 * Uses the Flux provider (with multi-provider fallback already configured).
 */
export function buildDefaultPrompt(word: string): string {
  return `A high-quality, realistic educational photo illustration of a single ${word} placed on a clean, softly lit surface. The image should feel bright, modern, and engaging for children aged 6–8 — detailed textures, natural lighting, and minimal background distractions. The object should look real and slightly stylized to maintain warmth and approachability, similar to a child-friendly photo in a premium learning magazine. No text, no hands, no clutter — just the object, clear and centered.`;
}

export async function generateQuestionImageForWord(word: string): Promise<string> {
  const prompt = buildDefaultPrompt(word);

  const generator = new MultiProviderImageGenerator();
  const result = await generator.generateWithFallback(prompt, 'worksheet');
  if (!result.success || !result.imageUrl) {
    throw new Error(result.error || 'Image generation failed');
  }
  return result.imageUrl;
}

export async function generateImageWithPrompt(prompt: string): Promise<string> {
  const generator = new MultiProviderImageGenerator();
  const result = await generator.generateWithFallback(prompt, 'worksheet');
  if (!result.success || !result.imageUrl) {
    throw new Error(result.error || 'Image generation failed');
  }
  return result.imageUrl;
}


