/**
 * Sound utility functions for UI interactions
 */

let clickAudio: HTMLAudioElement | null = null;
let imageCompleteAudio: HTMLAudioElement | null = null;
let messageAudio: HTMLAudioElement | null = null;

// Global mute flag for UI SFX to ensure nothing plays over critical TTS
let isUISoundsMuted = false;

/**
 * Initialize all audio files immediately to prevent delays
 */
const initAllSounds = (): void => {
  // Initialize click sound
  if (!clickAudio) {
    clickAudio = new Audio('/sounds/Click.mp3');
    clickAudio.preload = 'auto';
    clickAudio.volume = 0.3;
    clickAudio.load(); // Force load immediately
  }
  
  // Initialize other sounds
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

// Initialize all sounds immediately when this module loads
initAllSounds();

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
