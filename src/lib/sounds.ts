/**
 * Sound utility functions for UI interactions
 */

let clickAudio: HTMLAudioElement | null = null;
let imageLoadingAudio: HTMLAudioElement | null = null;
let imageCompleteAudio: HTMLAudioElement | null = null;
let messageAudio: HTMLAudioElement | null = null;

/**
 * Initialize the click sound audio element
 */
const initClickSound = (): HTMLAudioElement => {
  if (!clickAudio) {
    clickAudio = new Audio('/sounds/Click.mp3');
    clickAudio.preload = 'auto';
    clickAudio.volume = 0.3; // Set volume to 30% to not be too loud
  }
  return clickAudio;
};

/**
 * Play click sound effect for button interactions
 */
export const playClickSound = (): void => {
  try {
    const audio = initClickSound();
    // Reset audio to beginning in case it was already playing
    audio.currentTime = 0;
    audio.play().catch((error) => {
      // Silently handle autoplay restrictions - browsers may block audio without user interaction
      console.debug('Audio play blocked by browser:', error);
    });
  } catch (error) {
    // Silently handle any audio errors
    console.debug('Error playing click sound:', error);
  }
};

/**
 * Set the volume for click sounds (0.0 to 1.0)
 */
export const setClickSoundVolume = (volume: number): void => {
  const audio = initClickSound();
  audio.volume = Math.max(0, Math.min(1, volume));
};

/**
 * Initialize the image loading sound audio element
 */
const initImageLoadingSound = (): HTMLAudioElement => {
  if (!imageLoadingAudio) {
    imageLoadingAudio = new Audio('/sounds/image-loading.mp3');
    imageLoadingAudio.preload = 'auto';
    imageLoadingAudio.volume = 0.4; // Set volume to 40%
  }
  return imageLoadingAudio;
};

/**
 * Initialize the image complete sound audio element
 */
const initImageCompleteSound = (): HTMLAudioElement => {
  if (!imageCompleteAudio) {
    imageCompleteAudio = new Audio('/sounds/image-complete.mp3');
    imageCompleteAudio.preload = 'auto';
    imageCompleteAudio.volume = 0.5; // Set volume to 50%
  }
  return imageCompleteAudio;
};

/**
 * Play image loading sound effect when image generation starts
 */
export const playImageLoadingSound = (): void => {
  try {
    const audio = initImageLoadingSound();
    // Reset audio to beginning in case it was already playing
    audio.currentTime = 0;
    audio.play().catch((error) => {
      // Silently handle autoplay restrictions
      console.debug('Audio play blocked by browser:', error);
    });
  } catch (error) {
    // Silently handle any audio errors
    console.debug('Error playing image loading sound:', error);
  }
};

/**
 * Stop image loading sound effect
 */
export const stopImageLoadingSound = (): void => {
  try {
    if (imageLoadingAudio) {
      imageLoadingAudio.pause();
      imageLoadingAudio.currentTime = 0;
    }
  } catch (error) {
    // Silently handle any audio errors
    console.debug('Error stopping image loading sound:', error);
  }
};

/**
 * Play image complete sound effect when image generation finishes
 */
export const playImageCompleteSound = (): void => {
  try {
    const audio = initImageCompleteSound();
    // Reset audio to beginning in case it was already playing
    audio.currentTime = 0;
    audio.play().catch((error) => {
      // Silently handle autoplay restrictions
      console.debug('Audio play blocked by browser:', error);
    });
  } catch (error) {
    // Silently handle any audio errors
    console.debug('Error playing image complete sound:', error);
  }
};

/**
 * Set the volume for image loading sounds (0.0 to 1.0)
 */
export const setImageLoadingSoundVolume = (volume: number): void => {
  const audio = initImageLoadingSound();
  audio.volume = Math.max(0, Math.min(1, volume));
};

/**
 * Set the volume for image complete sounds (0.0 to 1.0)
 */
export const setImageCompleteSoundVolume = (volume: number): void => {
  const audio = initImageCompleteSound();
  audio.volume = Math.max(0, Math.min(1, volume));
};

/**
 * Initialize the message sound audio element
 */
const initMessageSound = (): HTMLAudioElement => {
  if (!messageAudio) {
    messageAudio = new Audio('/sounds/message.mp3');
    messageAudio.preload = 'auto';
    messageAudio.volume = 0.4; // Set volume to 40%
  }
  return messageAudio;
};

/**
 * Play message sound effect for chat messages sent/received
 */
export const playMessageSound = (): void => {
  try {
    const audio = initMessageSound();
    // Reset audio to beginning in case it was already playing
    audio.currentTime = 0;
    audio.play().catch((error) => {
      // Silently handle autoplay restrictions
      console.debug('Audio play blocked by browser:', error);
    });
  } catch (error) {
    // Silently handle any audio errors
    console.debug('Error playing message sound:', error);
  }
};

/**
 * Set the volume for message sounds (0.0 to 1.0)
 */
export const setMessageSoundVolume = (volume: number): void => {
  const audio = initMessageSound();
  audio.volume = Math.max(0, Math.min(1, volume));
};
