// Generate a stable messageId for TTS based on message text/HTML content.
// This allows UI elements (like speaker buttons) to reflect speaking state
// consistently across components that render the same content.

export function extractTextFromHtml(html?: string | null): string {
  if (!html) return '';
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.textContent || el.innerText || '').trim();
}

export function hashToBase36(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h) + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

export function bubbleMessageIdFromHtml(html?: string | null): string {
  const text = extractTextFromHtml(html || '');
  return `left-pet-bubble-${hashToBase36(text)}`;
}

export function inlineSpellboxMessageId(word?: string | null, questionId?: number | null): string {
  const key = (questionId ?? word ?? 'inline').toString();
  return `left-pet-inline-${key}`;
}


