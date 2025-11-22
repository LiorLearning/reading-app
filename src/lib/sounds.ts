/**
 * Sound utility functions for UI interactions
 */

let clickAudio: HTMLAudioElement | null = null;
let imageLoadingAudio: HTMLAudioElement | null = null;
let imageCompleteAudio: HTMLAudioElement | null = null;
let messageAudio: HTMLAudioElement | null = null;

// Add state tracking for image loading sound
let isImageLoadingSoundPlaying = false;
// Global mute flag for UI SFX to ensure nothing plays over critical TTS
let isUISoundsMuted = false;

/**
 * Initialize all audio files immediately to prevent delays
 */
const initAllSounds = (): void => {
  // Only initialize in browser environment
  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    return;
  }
  
  // Initialize click sound
  if (!clickAudio) {
    clickAudio = new Audio('/sounds/Click.mp3');
    clickAudio.preload = 'auto';
    clickAudio.volume = 0.3;
    clickAudio.load(); // Force load immediately
  }
  
  // Initialize other sounds
  if (!imageLoadingAudio) {
    imageLoadingAudio = new Audio('/sounds/image-loading.mp3');
    imageLoadingAudio.preload = 'auto';
    imageLoadingAudio.volume = 0.4;
    imageLoadingAudio.load();
  }
  
  if (!imageCompleteAudio) {
    imageCompleteAudio = new Audio('/sounds/image-complete.mp3');
    imageCompleteAudio.preload = 'auto';
    imageCompleteAudio.volume = 0.5;
    imageCompleteAudio.load();
  }
  
  if (!messageAudio) {
    messageAudio = new Audio('/sounds/message.mp3');
    messageAudio.preload = 'auto';
    messageAudio.volume = 0.4;
    messageAudio.load();
  }
};

// Initialize all sounds immediately when this module loads (only in browser)
if (typeof window !== 'undefined') {
  initAllSounds();
}

/**
 * Ensure all sounds are ready to play (useful for user interaction unlock)
 */
export const ensureSoundsReady = (): void => {
  initAllSounds();
};

/**
 * Initialize the click sound audio element
 */
const initClickSound = (): HTMLAudioElement => {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    throw new Error('Audio is not available in this environment');
  }
  if (!clickAudio) {
    clickAudio = new Audio('/sounds/Click.mp3');
    clickAudio.preload = 'auto';
    clickAudio.volume = 0.3; // Set volume to 30% to not be too loud
    clickAudio.load();
  }
  return clickAudio;
};

/**
 * Play click sound effect for button interactions
 */
export const playClickSound = (): void => {
  return
  try {
    if (isUISoundsMuted) return;
    if (clickAudio) {
      // Reset audio to beginning in case it was already playing
      clickAudio.currentTime = 0;
      clickAudio.play().catch((error) => {
        // Silently handle autoplay restrictions - browsers may block audio without user interaction
        console.debug('Audio play blocked by browser:', error);
      });
    }
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
  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    throw new Error('Audio is not available in this environment');
  }
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
  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    throw new Error('Audio is not available in this environment');
  }
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
    if (isUISoundsMuted) return;
    if (imageLoadingAudio) {
      // Reset audio to beginning in case it was already playing
      imageLoadingAudio.currentTime = 0;
      
      // Set up event listeners to track playing state
      imageLoadingAudio.onplay = () => {
        isImageLoadingSoundPlaying = true;
      };
      
      imageLoadingAudio.onended = () => {
        isImageLoadingSoundPlaying = false;
      };
      
      imageLoadingAudio.onpause = () => {
        isImageLoadingSoundPlaying = false;
      };
      
      imageLoadingAudio.onerror = () => {
        isImageLoadingSoundPlaying = false;
      };
      
      imageLoadingAudio.play().catch((error) => {
        // Silently handle autoplay restrictions
        isImageLoadingSoundPlaying = false;
        console.debug('Audio play blocked by browser:', error);
      });
    }
  } catch (error) {
    // Silently handle any audio errors
    isImageLoadingSoundPlaying = false;
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
      isImageLoadingSoundPlaying = false;
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
    if (isUISoundsMuted) return;
    if (imageCompleteAudio) {
      // Reset audio to beginning in case it was already playing
      imageCompleteAudio.currentTime = 0;
      imageCompleteAudio.play().catch((error) => {
        // Silently handle autoplay restrictions
        console.debug('Audio play blocked by browser:', error);
      });
    }
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
 * Check if image loading sound is currently playing
 */
export const isImageLoadingSoundCurrentlyPlaying = (): boolean => {
  return isImageLoadingSoundPlaying;
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
  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    throw new Error('Audio is not available in this environment');
  }
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
    if (isUISoundsMuted) return;
    if (messageAudio) {
      // Reset audio to beginning in case it was already playing
      messageAudio.currentTime = 0;
      messageAudio.play().catch((error) => {
        // Silently handle autoplay restrictions
        console.debug('Audio play blocked by browser:', error);
      });
    }
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

/**
 * Pause and reset all known UI SFX immediately.
 */
export const pauseAllUISounds = (): void => {
  try {
    if (clickAudio) {
      clickAudio.pause();
      clickAudio.currentTime = 0;
    }
  } catch {}
  try {
    if (imageLoadingAudio) {
      imageLoadingAudio.pause();
      imageLoadingAudio.currentTime = 0;
      isImageLoadingSoundPlaying = false;
    }
  } catch {}
  try {
    if (imageCompleteAudio) {
      imageCompleteAudio.pause();
      imageCompleteAudio.currentTime = 0;
    }
  } catch {}
  try {
    if (messageAudio) {
      messageAudio.pause();
      messageAudio.currentTime = 0;
    }
  } catch {}
};

/**
 * Mute/unmute UI SFX globally, and pause/reset any currently playing SFX when muting.
 */
export const muteAllUISounds = (): void => {
  isUISoundsMuted = true;
  pauseAllUISounds();
};

export const unmuteAllUISounds = (): void => {
  isUISoundsMuted = false;
};
