/**
 * Sound utility functions for UI interactions
 */

let clickAudio: HTMLAudioElement | null = null;

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
