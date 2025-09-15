import React, { useState, useEffect, useMemo } from 'react';
import { useCoins, CoinSystem } from '@/pages/coinSystem';
import { ttsService } from '@/lib/tts-service';
import { useTTSSpeaking } from '@/hooks/use-tts-speaking';
import { usePetData } from '@/lib/pet-data-service';
import { loadAdventureSummariesHybrid } from '@/lib/firebase-adventure-cache';
import { useAuth } from '@/hooks/use-auth';
import { PetSelectionFlow } from '@/components/PetSelectionFlow';
import { PetProgressStorage } from '@/lib/pet-progress-storage';

type Props = {
  onStartAdventure?: (topicId: string, mode: 'new' | 'continue') => void;
  onContinueSpecificAdventure?: (adventureId: string) => void;
};

type ActionStatus = 'happy' | 'sad' | 'neutral' | 'disabled';

interface ActionButton {
  id: string;
  icon: string;
  status: ActionStatus;
  label: string;
}

export function PetPage({ onStartAdventure, onContinueSpecificAdventure }: Props): JSX.Element {
  // Use shared coin system
  const { coins, spendCoins, hasEnoughCoins, canSpendForFeeding, setCoins } = useCoins();
  
  // Get Firebase authenticated user for adventure loading and user data for personalized pet thoughts
  const { user, userData } = useAuth();
  
  // Use shared pet data system
  const { careLevel, ownedPets, audioEnabled, setCareLevel, addOwnedPet, setAudioEnabled, isPetOwned, getCoinsSpentForCurrentStage, getPetCoinsSpent, addPetCoinsSpent, incrementFeedingCount, addAdventureCoins, setSleepCompleted, getCumulativeCarePercentage, getCumulativeCareLevel, isSleepAvailable, migrateToCumulativeCareSystem, checkAndPerform24HourReset, checkAndPerform8HourReset } = usePetData();
  
  // Den and accessories state (stored in localStorage)
  const [ownedDens, setOwnedDens] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('owned_dens');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  
  const [ownedAccessories, setOwnedAccessories] = useState<{[key: string]: string[]}>(() => {
    try {
      const stored = localStorage.getItem('owned_accessories');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  
  // Helper functions for dens and accessories
  const isDenOwned = (petType: string) => ownedDens.includes(`${petType}_den`);
  const isAccessoryOwned = (petType: string, accessoryId: string) => {
    return ownedAccessories[petType]?.includes(accessoryId) || false;
  };
  
  const purchaseDen = (petType: string, cost: number) => {
    // Use regular coin checking since feeding is now free
    if (!hasEnoughCoins(cost)) return false;
    spendCoins(cost);
    const newOwnedDens = [...ownedDens, `${petType}_den`];
    setOwnedDens(newOwnedDens);
    localStorage.setItem('owned_dens', JSON.stringify(newOwnedDens));
    return true;
  };
  
  const purchaseAccessory = (petType: string, accessoryId: string, cost: number) => {
    // Use regular coin checking since feeding is now free
    if (!hasEnoughCoins(cost)) return false;
    spendCoins(cost);
    const newAccessories = { ...ownedAccessories };
    if (!newAccessories[petType]) newAccessories[petType] = [];
    newAccessories[petType].push(accessoryId);
    setOwnedAccessories(newAccessories);
    localStorage.setItem('owned_accessories', JSON.stringify(newAccessories));
    return true;
  };
  
  // State for which pet is currently being displayed
  const [currentPet, setCurrentPet] = useState('cat'); // Default to cat
  
  // Local state for UI interactions
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [previousCoins, setPreviousCoins] = useState(coins);
  const [previousCoinsSpentForStage, setPreviousCoinsSpentForStage] = useState(0);
  const [showPetShop, setShowPetShop] = useState(false);
  const [lastSpokenMessage, setLastSpokenMessage] = useState('');
  
  // Pet store state
  const [selectedStorePet, setSelectedStorePet] = useState('cat'); // Which pet's store section is shown
  const [storeRefreshTrigger, setStoreRefreshTrigger] = useState(0); // Trigger to refresh store data
  
  // Pet selection flow state
  const [showPetSelection, setShowPetSelection] = useState(false);
  
  // Sleep timer state
  const [sleepTimeRemaining, setSleepTimeRemaining] = useState(0); // in milliseconds
  
  // Sleep state management with localStorage persistence
  const [sleepClicks, setSleepClicks] = useState(() => {
    try {
      const stored = localStorage.getItem('pet_sleep_data');
      if (stored) {
        const sleepData = JSON.parse(stored);
        const now = Date.now();
        const eightHours = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
        
        // Check if 8 hours have passed since last sleep update
        if (sleepData.timestamp && (now - sleepData.timestamp) < eightHours) {
          return sleepData.clicks || 0;
        }
      }
      return 0;
    } catch {
      return 0;
    }
  });
  
  // Streak system for dog evolution unlocks - based on consecutive calendar days (US timezone)
  const [currentStreak, setCurrentStreak] = useState(() => {
    try {
      const streakData = localStorage.getItem('pet_feeding_streak_data');
      if (streakData) {
        const parsed = JSON.parse(streakData);
        return Math.max(0, parsed.streak || 0);
      }
      return 0;
    } catch {
      return 0;
    }
  });

  // Get current date in US timezone (Eastern Time)
  const getCurrentUSDate = () => {
    const now = new Date();
    const usDate = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    return usDate.toDateString(); // Returns format like "Mon Jan 01 2024"
  };

  // Load and validate streak data
  const getStreakData = () => {
    try {
      const stored = localStorage.getItem('pet_feeding_streak_data');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to parse streak data:', error);
    }
    return { streak: 0, lastFeedDate: null, feedDates: [] };
  };

  // Save streak data to localStorage
  const saveStreakData = (streakData: { streak: number; lastFeedDate: string; feedDates: string[] }) => {
    try {
      localStorage.setItem('pet_feeding_streak_data', JSON.stringify(streakData));
      setCurrentStreak(streakData.streak);
    } catch (error) {
      console.warn('Failed to save streak data:', error);
    }
  };

  // Update streak based on feeding date
  const updateStreak = () => {
    const currentDate = getCurrentUSDate();
    const streakData = getStreakData();
    
    // If already fed today, don't update streak
    if (streakData.lastFeedDate === currentDate) {
      return streakData.streak;
    }

    let newStreak = streakData.streak;
    const feedDates = [...(streakData.feedDates || [])];

    // Add today's date to feed dates
    if (!feedDates.includes(currentDate)) {
      feedDates.push(currentDate);
    }

    // Check if this continues a streak
    if (streakData.lastFeedDate) {
      const lastDate = new Date(streakData.lastFeedDate);
      const today = new Date(currentDate);
      const daysDifference = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDifference === 1) {
        // Consecutive day - increment streak
        newStreak = streakData.streak + 1;
      } else if (daysDifference > 1) {
        // Gap in feeding - reset streak to 1
        newStreak = 1;
      }
      // If daysDifference === 0, it means same day (already handled above)
    } else {
      // First time feeding
      newStreak = 1;
    }

    const newStreakData = {
      streak: newStreak,
      lastFeedDate: currentDate,
      feedDates: feedDates.slice(-30) // Keep last 30 days for performance
    };

    saveStreakData(newStreakData);
    return newStreak;
  };

  // Track previous level for level-up detection
  const [previousLevel, setPreviousLevel] = useState(1); // Start with level 1

  // Initialize streak and previous coins spent on component mount
  useEffect(() => {
    // Check for 8-hour reset first (resets to initial sad/hungry state)
    const wasReset = checkAndPerform8HourReset();
    
    // Migrate existing users to cumulative care system
    migrateToCumulativeCareSystem();
    
    const streakData = getStreakData();
    if (streakData.lastFeedDate) {
      const currentDate = getCurrentUSDate();
      const lastDate = new Date(streakData.lastFeedDate);
      const today = new Date(currentDate);
      const daysDifference = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // If more than 1 day has passed since last feeding, reset streak
      if (daysDifference > 1) {
        const resetStreakData = {
          streak: 0,
          lastFeedDate: streakData.lastFeedDate,
          feedDates: streakData.feedDates || []
        };
        saveStreakData(resetStreakData);
      }
    }
    
    // Initialize previous coins spent for current stage
    setPreviousCoinsSpentForStage(getCoinsSpentForCurrentStage(currentStreak));
    
    // Initialize previous level based on current coins
    const currentLevel = getCurrentPetLevel();
    setPreviousLevel(currentLevel);
    
    // Check if sleep should be reset due to 8-hour timeout
    checkSleepTimeout();
  }, []);

  // Check for level ups
  useEffect(() => {
    const currentLevel = getCurrentPetLevel();
    if (currentLevel > previousLevel) {
      // Level up detected!
      console.log(`🎉 Level up! ${previousLevel} → ${currentLevel}`);
      playEvolutionSound();
      
      // Show level up animation
      setShowHeartAnimation(true);
      setTimeout(() => setShowHeartAnimation(false), 1500);
      
      // Update previous level
      setPreviousLevel(currentLevel);
    }
  }, [getCumulativeCareLevel().adventureCoins, previousLevel]);

  // Periodically check for sleep timeout (every minute when component is active)
  useEffect(() => {
    const interval = setInterval(() => {
      checkSleepTimeout();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  // Real-time timer update when pet is fully asleep
  useEffect(() => {
    if (sleepClicks >= 3) {
      const interval = setInterval(() => {
        const newTimeRemaining = getSleepTimeRemaining();
        setSleepTimeRemaining(newTimeRemaining);
      }, 1000); // Update every second

      return () => clearInterval(interval);
    }
  }, [sleepClicks]);

  // Update action states when pet, sleep state, or adventure coins change
  useEffect(() => {
    setActionStates(getActionStates());
  }, [currentPet, sleepClicks, getCumulativeCareLevel().adventureCoins]);

  // Reset sleep when switching pets
  useEffect(() => {
    resetSleep();
  }, [currentPet]);
  
  // TTS message ID for tracking speaking state
  const petMessageId = 'pet-message';
  const isSpeaking = useTTSSpeaking(petMessageId);
  
  // Check if user is first-time and show pet selection flow
  useEffect(() => {
    const checkFirstTimeUser = () => {
      // Check if user has any owned pets
      const allOwnedPets = PetProgressStorage.getAllOwnedPets();
      
      // If no pets are owned, show pet selection flow
      if (allOwnedPets.length === 0) {
        setShowPetSelection(true);
      }
    };
    
    checkFirstTimeUser();
  }, []);
  
  // Pet action states - dynamically updated based on den ownership and sleep state
  const getActionStates = () => {
    const baseActions = [
      { id: 'water', icon: '🍪', status: 'sad' as ActionStatus, label: 'Food' },
    ];
    
    // Add adventure button (always available)
    baseActions.push({ id: 'adventure', icon: '🚀', status: 'neutral' as ActionStatus, label: 'Adventure' });
    
    // Add sleep button (always visible and clickable)
    let sleepLabel, sleepStatus;
    if (sleepClicks >= 3) {
      sleepLabel = 'Sleeping';
      sleepStatus = 'neutral'; // Always clickable when fully asleep
    } else {
      sleepLabel = sleepClicks === 0 ? 'Sleep' : `Sleep ${sleepClicks}/3`;
      sleepStatus = isSleepAvailable() ? 'neutral' : 'disabled';
    }
    baseActions.push({ id: 'sleep', icon: '😴', status: sleepStatus as ActionStatus, label: sleepLabel });
    
    // Always add more button at the end
    baseActions.push({ id: 'more', icon: '🐾', status: 'neutral' as ActionStatus, label: 'More' });
    
    return baseActions;
  };

  const [actionStates, setActionStates] = useState<ActionButton[]>(getActionStates());

  // Handle adventure button click
  const handleAdventureClick = async () => {
    try {
      // Stop any current audio
      ttsService.stop();
      
      // Play click sound
      playFeedingSound(); // Reuse feeding sound for click
      
      if (!onStartAdventure) {
        alert("Adventure functionality is not available right now!");
        return;
      }

      // Try to get the most recent adventure to continue
      const savedAdventures = await loadAdventureSummariesHybrid(user?.uid || null);
      
      if (savedAdventures && savedAdventures.length > 0) {
        // Continue the most recent adventure
        const lastAdventure = savedAdventures[0]; // Already sorted by lastPlayedAt desc
        console.log('🚀 Continuing last adventure:', lastAdventure.name);
        
        if (onContinueSpecificAdventure) {
          onContinueSpecificAdventure(lastAdventure.id);
        } else {
          // Fallback to continue mode with a default topic
          onStartAdventure('space_exploration', 'continue');
        }
      } else {
        // No saved adventures, start a new one
        console.log('🚀 Starting new adventure (no saved adventures found)');
        onStartAdventure('space_exploration', 'new');
      }
    } catch (error) {
      console.error('Failed to handle adventure click:', error);
      // Fallback to starting a new adventure
      if (onStartAdventure) {
        onStartAdventure('space_exploration', 'new');
      }
    }
  };

  const handleActionClick = (actionId: string) => {
    // Handle sleep action
    if (actionId === 'sleep') {
      // If pet is fully asleep (3 clicks), do nothing (timer is always visible)
      if (sleepClicks >= 3) {
        return;
      }
      
      // Check if sleep is available (100 adventure coins since last sleep)
      if (!isSleepAvailable()) {
        const cumulativeCare = getCumulativeCareLevel();
        const coinsSinceLastSleep = cumulativeCare.adventureCoins - cumulativeCare.adventureCoinsAtLastSleep;
        const coinsNeeded = 100 - coinsSinceLastSleep;
        alert(`Sleep is not available yet! You need ${coinsNeeded} more adventure coins. Go on adventures to earn more coins! 🚀`);
        return;
      }
      
      // Increment sleep clicks (max 3) - no den required
      if (sleepClicks < 3) {
        const newSleepClicks = sleepClicks + 1;
        updateSleepClicks(newSleepClicks);
        
        // If sleep is completed (3 clicks), mark cumulative care level as complete
        if (newSleepClicks >= 3) {
          setSleepCompleted(true);
        }
        
        // Play a gentle sleep sound
        playFeedingSound(); // Reuse feeding sound for now
        
        // Trigger heart animation for sleep progress
        setShowHeartAnimation(true);
        setTimeout(() => setShowHeartAnimation(false), 1000);
        
        // Stop any current audio when pet gets sleepier
        ttsService.stop();
      }
      return;
    }

    // Handle adventure action
    if (actionId === 'adventure') {
      handleAdventureClick();
      return;
    }

    // Don't deduct coins for "More" action - always open pet shop
    if (actionId === 'more') {
      // Stop any current audio when opening pet shop
      ttsService.stop();
      setShowPetShop(true);
      return;
    }

    // Feeding is now free - no coin check needed
    // if (!hasEnoughCoins(0)) {
    //   alert("Not enough coins! You need 0 coins to perform this action.");
    //   return;
    // }

    // Play feeding sound
    playFeedingSound();

    // No coins deducted - feeding is free
    // spendCoins(0);
    setCareLevel(Math.min(careLevel + 1, 6), currentStreak); // Max 6 actions, pass current streak
    
    // Track coins spent on current pet (0 for free feeding)
    addPetCoinsSpent(currentPet, 0);
    
    // Update cumulative care level - increment feeding count
    incrementFeedingCount();
    
    // Update streak based on calendar days
    const newStreak = updateStreak();

    // Trigger heart animation
    setShowHeartAnimation(true);
    setTimeout(() => setShowHeartAnimation(false), 1000);

    // Update action status to happy
    setActionStates(prev => prev.map(action => 
      action.id === actionId 
        ? { ...action, status: 'happy' }
        : action
    ));
  };

  // Save sleep data to localStorage
  const saveSleepData = (clicks: number) => {
    try {
      const sleepData = {
        clicks: clicks,
        timestamp: Date.now()
      };
      localStorage.setItem('pet_sleep_data', JSON.stringify(sleepData));
    } catch (error) {
      console.warn('Failed to save sleep data:', error);
    }
  };

  // Update sleep clicks and save to localStorage
  const updateSleepClicks = (newClicks: number) => {
    setSleepClicks(newClicks);
    saveSleepData(newClicks);
  };

  // Reset sleep when needed (e.g., when switching pets or after full sleep cycle)
  const resetSleep = () => {
    setSleepClicks(0);
    saveSleepData(0);
  };

  // Check if sleep should be reset due to 8-hour timeout
  const checkSleepTimeout = () => {
    try {
      const stored = localStorage.getItem('pet_sleep_data');
      if (stored) {
        const sleepData = JSON.parse(stored);
        const now = Date.now();
        const eightHours = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
        
        // If 8 hours have passed, reset sleep
        if (sleepData.timestamp && (now - sleepData.timestamp) >= eightHours) {
          resetSleep();
          return true; // Sleep was reset
        }
      }
      return false; // No reset needed
    } catch {
      return false;
    }
  };

  // Calculate remaining sleep time
  const getSleepTimeRemaining = () => {
    try {
      const stored = localStorage.getItem('pet_sleep_data');
      if (stored) {
        const sleepData = JSON.parse(stored);
        const now = Date.now();
        const eightHours = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
        
        if (sleepData.timestamp) {
          const timeElapsed = now - sleepData.timestamp;
          const timeRemaining = eightHours - timeElapsed;
          return Math.max(0, timeRemaining);
        }
      }
      return 0;
    } catch {
      return 0;
    }
  };

  // Format time remaining for display
  const formatTimeRemaining = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getStatusEmoji = (status: ActionStatus) => {
    switch (status) {
      // case 'happy': return '😊';
      // case 'sad': return '😢';
      case 'neutral': return '';
      case 'disabled': return '🔒';
      default: return '';
    }
  };

  // Sound effect functions
  const playFeedingSound = () => {
    try {
      // Create a pleasant "nom nom" eating sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create a short, pleasant eating sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Pleasant "crunch" sound frequencies
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
      oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.type = 'triangle';
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log('Audio not supported');
    }
  };

  const playEvolutionSound = () => {
    try {
      // Create a magical "sparkle" evolution sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create multiple tones for a magical effect
      const frequencies = [523, 659, 784, 1047]; // C, E, G, C (major chord)
      
      frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + index * 0.1);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime + index * 0.1);
        gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + index * 0.1 + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + index * 0.1 + 0.8);
        
        oscillator.start(audioContext.currentTime + index * 0.1);
        oscillator.stop(audioContext.currentTime + index * 0.1 + 0.8);
      });
    } catch (error) {
      console.log('Audio not supported');
    }
  };

  // Get Bobo images based on coins spent
  const getBoboImage = (coinsSpent: number) => {
    if (coinsSpent >= 50) {
      return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_011137_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
    } else if (coinsSpent >= 30) {
      return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_011115_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
    } else if (coinsSpent >= 10) {
      return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_011058_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
    } else {
      return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_011043_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
    }
  };

  // Get Feather images based on coins spent
  const getFeatherImage = (coinsSpent: number) => {
    if (coinsSpent >= 50) {
      return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250908_154758_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
    } else if (coinsSpent >= 30) {
      return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250908_154733_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
    } else if (coinsSpent >= 10) {
      return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250908_155301_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
    } else {
      return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250908_154712_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
    }
  };

// Get sleepy pet images based on sleep clicks (3-click progression with placeholders)
const getSleepyPetImage = (clicks: number) => {
  if (clicks >= 3) {
    // 3 clicks (fully asleep) - Final sleep image
    return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_165610_dog_den_no_bg.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  } else if (clicks >= 2) {
    // 2 clicks (deep sleep) - Second sleep stage placeholder
    return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_163624_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN"; // Placeholder for 2nd click
  } else if (clicks >= 1) {
    // 1 click (getting sleepy) - First sleep stage placeholder  
    return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_162600_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN"; // Placeholder for 1st click
  } else {
    // 0 clicks (awake) - Should not be called in sleep mode
    return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_162533_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  }
};

  // Get current level for the active pet
  const getCurrentPetLevel = () => {
    const levelInfo = getLevelInfo();
    return levelInfo.currentLevel;
  };

  // Level-based image system - combines level progression with care progression
  const getLevelBasedPetImage = (petType: string, level: number, careState: string) => {
    const petImages = {
      cat: {
        1: {
          // Level 1 Cat images - using placeholder images for now
          hungry: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160158_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          fed: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160535_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          adventurous: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_000902_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          ready_for_sleep: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160214_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep1: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_162600_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep2: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_163624_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep3: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_165610_dog_den_no_bg.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN"
        }
      },
      hamster: {
        1: {
          // Level 1 Hamster images - using placeholder images for now
          hungry: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_011043_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          fed: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_011058_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          adventurous: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_011115_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          ready_for_sleep: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_011137_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep1: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_162600_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep2: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_163624_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep3: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_165610_dog_den_no_bg.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN"
        }
      },
      dragon: {
        1: {
          // Level 1 Dragon images - using placeholder images for now
          hungry: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250908_154712_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          fed: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250908_155301_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          adventurous: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250908_154733_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          ready_for_sleep: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250908_154758_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep1: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_162600_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep2: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_163624_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep3: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_165610_dog_den_no_bg.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN"
        }
      },
      unicorn: {
        1: {
          // Level 1 Unicorn images - using placeholder images for now
          hungry: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160158_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          fed: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160535_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          adventurous: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_000902_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          ready_for_sleep: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160214_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep1: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_162600_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep2: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_163624_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep3: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_165610_dog_den_no_bg.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN"
        }
      }
    };

    const petLevelImages = petImages[petType as keyof typeof petImages];
    if (!petLevelImages) {
      // Fallback for unknown pets
      return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160158_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
    }

    const levelImages = petLevelImages[level as keyof typeof petLevelImages] || petLevelImages[1];
    return levelImages[careState as keyof typeof levelImages] || levelImages.hungry;
  };

  // Determine care state based on current pet and progress
  const getCurrentCareState = () => {
    if (sleepClicks > 0) {
      if (sleepClicks >= 3) return 'sleep3';
      if (sleepClicks >= 2) return 'sleep2';
      return 'sleep1';
    }

    if (currentPet === 'cat' && isPetOwned('cat')) {
      const catCoinsSpent = getPetCoinsSpent('cat');
      if (catCoinsSpent >= 50) return 'ready_for_sleep';
      if (catCoinsSpent >= 30) return 'adventurous';
      if (catCoinsSpent >= 10) return 'fed';
      return 'hungry';
    }

    if (currentPet === 'hamster' && isPetOwned('hamster')) {
      const hamsterCoinsSpent = getPetCoinsSpent('hamster');
      if (hamsterCoinsSpent >= 50) return 'ready_for_sleep';
      if (hamsterCoinsSpent >= 30) return 'adventurous';
      if (hamsterCoinsSpent >= 10) return 'fed';
      return 'hungry';
    }

    if (currentPet === 'dragon' && isPetOwned('dragon')) {
      const dragonCoinsSpent = getPetCoinsSpent('dragon');
      if (dragonCoinsSpent >= 50) return 'ready_for_sleep';
      if (dragonCoinsSpent >= 30) return 'adventurous';
      if (dragonCoinsSpent >= 10) return 'fed';
      return 'hungry';
    }
    
    if (currentPet === 'unicorn' && isPetOwned('unicorn')) {
      const unicornCoinsSpent = getPetCoinsSpent('unicorn');
      if (unicornCoinsSpent >= 50) return 'ready_for_sleep';
      if (unicornCoinsSpent >= 30) return 'adventurous';
      if (unicornCoinsSpent >= 10) return 'fed';
      return 'hungry';
    }

    // Default state for any other pets or fallback
    const cumulativeCare = getCumulativeCareLevel();
    const { feedingCount, adventureCoins } = cumulativeCare;
    
    if (adventureCoins >= 100) return 'ready_for_sleep';
    if (adventureCoins >= 50) return 'adventurous';
    if (feedingCount >= 1) return 'fed';
    return 'hungry';
  };

  const getPetImage = () => {
    const currentLevel = getCurrentPetLevel();
    const careState = getCurrentCareState();
    return getLevelBasedPetImage(currentPet, currentLevel, careState);
  };

  // Get cumulative care image for April based on care progression
  const getCumulativeCareImage = () => {
    const cumulativeCare = getCumulativeCareLevel();
    const { feedingCount, adventureCoins } = cumulativeCare;
    
    // Debug logging
    console.log('🐶 Cumulative Care Debug:', { feedingCount, adventureCoins, carePercentage: getCumulativeCarePercentage() });
    
    let currentImage;
    let previousCareStage = 0; // Track previous stage for animation
    
    // Determine current care stage and image
    if (adventureCoins >= 100) {
      // Stage 4: 100+ adventure coins (ready for sleep) - 80% care
      currentImage = "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160214_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN"; // PLACEHOLDER - will be replaced
      previousCareStage = 4;
    } else if (adventureCoins >= 50) {
      // Stage 3: 50+ adventure coins (experienced adventurer) - 60% care
      currentImage = "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_000902_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN"; // PLACEHOLDER - will be replaced
      previousCareStage = 3;
    } else if (feedingCount >= 1) {
      // Stage 2: Fed once (first feeding triggers image change)
      currentImage = "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160535_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN"; // PLACEHOLDER - will be replaced
      previousCareStage = 2;
    } else {
      // Stage 1: Initial hungry/sad state - 0% care
      currentImage = "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160158_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN"; // PLACEHOLDER - will be replaced
      previousCareStage = 1;
    }
    
    // Check if care stage changed and play evolution sound
    const storedPreviousStage = localStorage.getItem('previous_care_stage');
    const lastCareStage = storedPreviousStage ? parseInt(storedPreviousStage) : 1;
    
    if (previousCareStage > lastCareStage) {
      // Care stage increased - play evolution sound
      setTimeout(() => playEvolutionSound(), 400); // Delay to sync with animation
      localStorage.setItem('previous_care_stage', previousCareStage.toString());
    }
    
    return currentImage;
  };

  // Original dog image system (fallback)
  const getOriginalDogImage = (coinsSpentOnFeeding: number) => {
    if (currentStreak >= 3) {
      // Fully evolved dog versions for users with 3+ day streak
      // Use feeding count instead of coins spent (since feeding is now free)
      const feedingCount = getCumulativeCareLevel().feedingCount;
      if (feedingCount >= 5) {
        return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_001902_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      } else if (feedingCount >= 3) {
        return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_001847_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      } else if (feedingCount >= 1) {
        return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_001814_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      } else {
        return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_001757_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      }
    } else if (currentStreak >= 2) {
      // Grown dog versions for users with 2+ day streak
      // Use feeding count instead of coins spent (since feeding is now free)
      const feedingCount = getCumulativeCareLevel().feedingCount;
      if (feedingCount >= 5) {
        return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_001500_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      } else if (feedingCount >= 3) {
        return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_001443_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      } else if (feedingCount >= 1) {
        return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_001432_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      } else {
        return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_001417_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      }
    } else {
      // Original small pup images for users with <2 day streak
      // Use feeding count instead of coins spent (since feeding is now free)
      const feedingCount = getCumulativeCareLevel().feedingCount;
      if (feedingCount >= 5) {
        return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160214_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      } else if (feedingCount >= 3) {
        return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_000902_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      } else if (feedingCount >= 1) {
        return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160535_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      } else {
        return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160158_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      }
    }
  };

  // Handle pet selection from the first-time flow
  const handlePetSelection = (petId: string, petName: string) => {
    // Set pet ownership and name
    PetProgressStorage.setPetOwnership(petId, true);
    PetProgressStorage.setPetName(petId, petName);
    
    // Set as current selected pet
    PetProgressStorage.setCurrentSelectedPet(petId);
    setCurrentPet(petId);
    
    // Hide the selection flow
    setShowPetSelection(false);
    
    // Trigger store refresh to update UI
    setStoreRefreshTrigger(prev => prev + 1);
  };

  const handlePetPurchase = (petType: string, cost: number) => {
    // Use regular coin checking since feeding is now free
    if (!hasEnoughCoins(cost)) {
      // Feeding is now free, so no need to reserve coins for feeding
      alert(`Not enough coins! You need ${cost} coins to buy this pet.`);
      return;
    }

    if (isPetOwned(petType)) {
      alert("You already own this pet!");
      return;
    }

    // Deduct coins and add pet to owned pets
    spendCoins(cost);
    addOwnedPet(petType);
    
    // Switch to the newly purchased pet
    setCurrentPet(petType);
    
    // Play purchase sound (reuse evolution sound for now)
    playEvolutionSound();
    
    // Get pet name from store data
    const petStoreData = getPetStoreData();
    const petName = petStoreData[petType]?.name || petType;
    alert(`🎉 Congratulations! You bought ${petName}!`);
  };

  // Pet store data structure - dynamically updated with current ownership status
  const getPetStoreData = () => {
    // Use storeRefreshTrigger and ownedPets to force re-evaluation when pets are purchased
    const currentOwnedPets = ownedPets; // This ensures we use the latest owned pets from the hook
    storeRefreshTrigger; // This ensures the function re-runs when trigger changes
    
    return {
      cat: {
        id: 'cat',
        emoji: '🐱',
        name: 'Whiskers',
        owned: isPetOwned('cat'),
        cost: 200,
      den: {
          id: 'cozy_cathouse',
          name: 'Cozy Cat House',
        emoji: '🏠',
        cost: 50,
          description: 'A comfortable space for Whiskers to nap and play'
      },
      accessories: [
          { id: 'scratching_post', name: 'Scratching Post', emoji: '🪵', cost: 15, description: 'Perfect for keeping claws sharp' },
          { id: 'cat_toys', name: 'Cat Toys', emoji: '🧶', cost: 20, description: 'Feather wands and yarn balls for entertainment' },
          { id: 'luxury_cushion', name: 'Luxury Cushion', emoji: '🛏️', cost: 25, description: 'Premium comfort for afternoon naps' }
        ]
      },
      hamster: {
        id: 'hamster',
        emoji: '🐹',
        name: 'Peanut',
        owned: isPetOwned('hamster'),
        cost: 200,
      den: {
          id: 'hamster_habitat',
          name: 'Hamster Habitat',
          emoji: '🏠',
          cost: 40,
          description: 'A multi-level home with tunnels and hideouts'
      },
      accessories: [
          { id: 'exercise_wheel', name: 'Exercise Wheel', emoji: '⚙️', cost: 15, description: 'Keep Peanut active and healthy' },
          { id: 'food_stash', name: 'Food Stash', emoji: '🥜', cost: 10, description: 'Premium seeds and treats storage' },
          { id: 'tunnel_system', name: 'Tunnel System', emoji: '🕳️', cost: 20, description: 'Expandable tunnel network for exploration' }
        ]
      },
      dragon: {
        id: 'dragon',
        emoji: '🐉',
        name: 'Ember',
        owned: isPetOwned('dragon'),
        cost: 400,
      den: {
          id: 'dragon_lair',
          name: 'Dragon Lair',
          emoji: '🏰',
          cost: 100,
          description: 'A majestic lair with treasure hoards and volcanic warmth'
      },
      accessories: [
          { id: 'treasure_hoard', name: 'Treasure Hoard', emoji: '💎', cost: 50, description: 'Shiny gems and gold for collecting' },
          { id: 'fire_crystals', name: 'Fire Crystals', emoji: '🔥', cost: 40, description: 'Magical crystals that enhance fire breath' },
          { id: 'dragon_perch', name: 'Dragon Perch', emoji: '⛰️', cost: 35, description: 'A high mountain perch for surveying the realm' }
        ]
      },
      unicorn: {
        id: 'unicorn',
        emoji: '🦄',
        name: 'Stardust',
        owned: isPetOwned('unicorn'),
        cost: 400,
        den: {
          id: 'enchanted_grove',
          name: 'Enchanted Grove',
          emoji: '🌸',
          cost: 100,
          description: 'A magical forest clearing filled with rainbow flowers'
        },
        accessories: [
          { id: 'rainbow_mane', name: 'Rainbow Mane', emoji: '🌈', cost: 45, description: 'Magical mane that shimmers with all colors' },
          { id: 'star_dust', name: 'Star Dust', emoji: '✨', cost: 40, description: 'Enchanted dust that grants magical abilities' },
          { id: 'crystal_horn', name: 'Crystal Horn', emoji: '💎', cost: 50, description: 'A beautiful crystal horn that glows with inner light' }
      ]
    }
    };
  };

  // ElevenLabs Text-to-Speech function using the proper TTS service
  const speakText = async (text: string) => {
    if (!audioEnabled || text === lastSpokenMessage || isSpeaking) return;
    
    try {
      // Stop any currently playing audio
      ttsService.stop();
      
      // Add a small delay to ensure previous audio is fully stopped
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setLastSpokenMessage(text);
      
      // Use the TTS service with a child-friendly voice and appropriate settings
      await ttsService.speak(text, {
        stability: 0.7,
        similarity_boost: 0.8,
        speed: 0.9, // Slightly slower for better comprehension
        messageId: petMessageId,
        voice: 'cgSgspJ2msm6clMCkdW9' // Jessica voice - warm and friendly for children
      });
    } catch (error) {
      console.error('TTS error:', error);
    }
  };

  const getPetThought = () => {
    // Helper function to randomly select from an array of thoughts
    const getRandomThought = (thoughts: string[]) => {
      return thoughts[Math.floor(Math.random() * thoughts.length)];
    };
    
    // Get user's name for personalized thoughts (fallback to 'friend' if no username)
    const userName = userData?.username || 'friend';
    
    // Get pet's custom name (fallback to default if not set)
    const petName = PetProgressStorage.getPetDisplayName(currentPet);
    
    // Get cumulative care level data
    const cumulativeCare = getCumulativeCareLevel();
    
    // If pet is sleeping, show sleep-related thoughts
    if (sleepClicks > 0) {
      if (sleepClicks >= 3) {
        const timeRemaining = getSleepTimeRemaining();
        const timeString = formatTimeRemaining(timeRemaining);
        
        const deepSleepThoughts = [
          "💤💤💤 Zzz... completely asleep... dreaming peacefully... I feel 100% loved! ❤️",
          "😴 Deep in dreamland... having the most wonderful dreams... My heart is completely full! 💖",
          "💤 Fully rested... sleeping like a baby... I'm the happiest pet ever! 🥰",
          "Zzz... 🌙 In the deepest, most comfortable sleep... Thank you for taking such good care of me! 💕",
          "😴 Sweet dreams... I'm completely at peace... feeling so loved and cared for! 💖",
          "💤 Perfect slumber... dreaming of all our adventures together... so content! 🥰"
        ];
        return getRandomThought(deepSleepThoughts);
      } else if (sleepClicks >= 2) {
        const drowsyThoughts = [
          "😴 Getting very drowsy... almost fully asleep... keep petting me to sleep...",
          "💤 So sleepy... my eyelids are getting heavy... a little more help please...",
          "Zzz... 😴 Drifting deeper into sleep... your gentle touch is so soothing...",
          "💤 Almost there... feeling so relaxed and sleepy... help me reach dreamland...",
          "😴 So close to perfect sleep... your care is making me so peaceful...",
          "💤 Nearly in dreamland... keep helping me drift off completely..."
        ];
        return getRandomThought(drowsyThoughts);
      } else {
        const sleepThoughts = [
          "Zzz... 😴 I'm getting so sleepy... this feels nice... help me sleep more!",
          "💤 Yawn... I'm starting to drift off... keep petting me to help me sleep...",
          "😴 So cozy and warm... perfect for a nap... your touch is so comforting...",
          "Zzz... 💭 I'm dreaming of cookies and adventures... help me sleep deeper...",
          "😴 This is the best feeling... so peaceful... keep helping me relax...",
          "💤 Sweet dreams are starting... I feel so safe with you... more gentle pets please!"
        ];
        return getRandomThought(sleepThoughts);
      }
    }
    
    // Different thoughts for different pets
    if (currentPet === 'cat' && isPetOwned('cat')) {
      const catCoinsSpent = getPetCoinsSpent('cat');
      
      if (catCoinsSpent === 0) {
        const hungryThoughts = [
          `Meow meow! 🐱 I'm ${petName}! My heart aches with hunger, ${userName}... I need your love and some treats to feel whole again! 💔`,
          `Oh ${userName}! 🐾 ${petName} here, feeling so lonely and empty inside... My soul yearns for your care and some yummy snacks! 😿`,
          `Meow! It's me, your devoted feline friend ${petName}! 🐱 My tummy cries out in sadness... please fill my heart with food and love!`,
          `Dear ${userName}! ${petName} feels so vulnerable and needy... 🍪 My entire being craves your nurturing touch and treats! 💕`,
          `Meow meow! 🐱 ${petName} is desperately starving for your affection! Can you heal my aching heart with some treats? 🥺`,
          `${userName}! 🐾 Your precious cat ${petName} feels so fragile and hungry... treats would make my heart overflow with pure joy! ✨`
        ];
        return getRandomThought(hungryThoughts);
      } else if (catCoinsSpent < 30) {
        const satisfiedThoughts = [
          `Purr purr! 🐾 Oh ${userName}, my heart is warming up! More treats would make this kitty's soul dance with pure bliss! 💖`,
          `Meow meow! Those treats touched my very soul! 🐱 But ${petName} still feels a tender longing for more of your love!`,
          `Yum yum! 🍪 These treats are healing my heart, dear ${userName}! I feel myself growing stronger with your care!`,
          `Meow! Those treats filled a piece of my heart! 🐱 But my spirit still yearns for more of your beautiful kindness!`,
          `Thank you, beloved ${userName}! 🥰 Those treats were like sunshine to my soul, but ${petName} still feels a gentle hunger for more love!`,
          `Delicious! 🍪 My tail is swishing with overwhelming joy! More treats would make me leap to the stars with happiness! ✨`
        ];
        return getRandomThought(satisfiedThoughts);
      } else if (catCoinsSpent < 50) {
        const growingThoughts = [
          `Meow meow! I'm growing stronger, ${userName}! 🐱 Your love is transforming me - I feel my spirit becoming more graceful and powerful!`,
          `Look at me pounce with such passion! 💪 I can feel my heart expanding with strength from each precious treat you give me!`,
          `Amazing! I'm growing so fast, dear ${userName}! 🌱 More treats will help me become the most magnificent cat for you!`,
          `${userName}, I feel electricity in my soul! ⚡ These treats are making me bigger, more graceful, and overflowing with love for you!`,
          `Meow meow! I'm transforming into something beautiful! 🦋 Keep the treats coming - my heart is almost ready to reach new heights!`,
          `Incredible! My whiskers are tingling with pure joy! 🐱 More treats will help me reach my full potential and make you so proud! ✨`
        ];
        return getRandomThought(growingThoughts);
      } else {
        const happyThoughts = [
          `Meow meow! 🥳 I feel absolutely radiant, ${userName}! My heart is bursting with love! Now... could you get me some cat friends to share this joy with?`,
          `Purr purr! I'm so magnificently strong now! 💪 My soul is overflowing with gratitude! Maybe it's time to find playmates to spread this happiness?`,
          `I feel absolutely fantastic, dear ${userName}! 🌟 All those treats filled my heart completely! Now I'm ready for magical cat adventures with friends!`,
          `Amazing! I'm at my most beautiful self! ✨ ${userName}, can you help me find some buddies to share this overwhelming joy with?`,
          `Hooray! I'm fully grown and my heart is singing! 🎉 Can you help me find some cat friends to celebrate this love with?`,
          `Perfect! I feel incredibly blessed by your care! 🚀 Maybe it's time to find playmates for the most wonderful adventures ever! 💖`
        ];
        return getRandomThought(happyThoughts);
      }
    }

    if (currentPet === 'hamster' && isPetOwned('hamster')) {
      const hamsterCoinsSpent = getPetCoinsSpent('hamster');
      
      if (hamsterCoinsSpent === 0) {
        const hungryThoughts = [
          `Squeak squeak! 🐹 I'm ${petName}! My tiny heart feels so empty and fragile, ${userName}... can you fill my soul with some seeds? 💔`,
          `Oh dear ${userName}! 🥜 ${petName} here, feeling so small and vulnerable... I'm trembling from hunger... got any treats to warm my heart?`,
          `Squeak! It's me, your devoted hamster friend ${petName}! 🐹 My cheeks and heart are both empty... I need your love to feel whole again!`,
          `Sweet ${userName}! ${petName} feels so tiny and needy... 🌱 My hamster soul craves your nurturing care and yummy seeds! 🥺`,
          `Squeak squeak! 🐹 ${petName} is desperately starving for your affection! Can you heal your tiny friend's aching heart with some treats?`,
          `${userName}! 🥜 Your precious hamster ${petName} feels so delicate and hungry... seeds would make my little heart burst with pure joy! ✨`
        ];
        return getRandomThought(hungryThoughts);
      } else if (hamsterCoinsSpent < 30) {
        const satisfiedThoughts = [
          `Squeak squeak! 🌱 Oh ${userName}, my little heart is glowing! More seeds would make this hamster's spirit soar with bliss! 💖`,
          `Nom nom! Those seeds touched my tiny soul! 🐹 But ${petName} still feels a sweet longing for more of your precious love!`,
          `Yum yum! 🥜 These treats are like magic to my heart, dear ${userName}! I feel myself growing stronger with your tender care!`,
          `Squeak! Those seeds warmed my little heart! 🐹 But my spirit still yearns for more of your beautiful kindness!`,
          `Thank you, beloved ${userName}! 🥰 Those seeds were like tiny miracles, but ${petName} still feels a gentle hunger for more love!`,
          `Delicious! 🌱 My cheeks are full but my heart wants to overflow! More seeds would make me spin with pure ecstasy! ✨`
        ];
        return getRandomThought(satisfiedThoughts);
      } else if (hamsterCoinsSpent < 50) {
        const growingThoughts = [
          `Squeak squeak! I'm growing stronger, ${userName}! 🐹 Your love is transforming me - I feel my tiny spirit becoming mighty and swift!`,
          `Look at me run with such passion! 💪 I can feel my little heart expanding with power from each precious seed you give me!`,
          `Amazing! I'm growing so fast, dear ${userName}! 🌱 More seeds will help me become the most incredible hamster for you!`,
          `${userName}, I feel lightning in my tiny soul! ⚡ These seeds are making me bigger, more active, and overflowing with love for you!`,
          `Squeak squeak! I'm transforming into something magnificent! 🦋 Keep the seeds coming - my heart is almost ready to reach new heights!`,
          `Incredible! My whiskers are vibrating with pure joy! 🐹 More seeds will help me reach my full potential and make you so proud! ✨`
        ];
        return getRandomThought(growingThoughts);
      } else {
        const happyThoughts = [
          `Squeak squeak! 🥳 I feel absolutely radiant, ${userName}! My tiny heart is bursting with immense love! Now... could you get me some hamster friends to share this joy with?`,
          `Squeak squeak! I'm so magnificently strong now! 💪 My soul is overflowing with gratitude! Maybe it's time to find playmates to spread this happiness?`,
          `I feel absolutely fantastic, dear ${userName}! 🌟 All those seeds filled my heart completely! Now I'm ready for magical hamster adventures with friends!`,
          `Amazing! I'm at my most beautiful self! ✨ ${userName}, can you help me find some buddies to share this overwhelming joy with?`,
          `Hooray! I'm fully grown and my heart is singing! 🎉 Can you help me find some hamster friends to celebrate this love with?`,
          `Perfect! I feel incredibly blessed by your care! 🚀 Maybe it's time to find playmates for the most wonderful wheel adventures ever! 💖`
        ];
        return getRandomThought(happyThoughts);
      }
    }
    
    if (currentPet === 'dragon' && isPetOwned('dragon')) {
      const dragonCoinsSpent = getPetCoinsSpent('dragon');
      
      if (dragonCoinsSpent === 0) {
        const hungryThoughts = [
          `Roar roar! 🐉 I'm Ember! My mighty dragon heart aches with emptiness, ${userName}... I need your love and magical treats to feel powerful again! 💔`,
          `Oh noble ${userName}! 🔥 Ember here, feeling so weak and vulnerable... My soul yearns for your care and precious gems! 😭`,
          `Roar! It's me, your devoted dragon friend Ember! 🐉 My fire is dying without your love... please fuel my heart with treats!`,
          `Majestic ${userName}! Ember feels so fragile and needy... 💎 My entire dragon essence craves your nurturing touch and magical food! 💕`,
          `Roar roar! 🐉 Ember is desperately starving for your affection! Can you heal my aching dragon heart with some treats? 🥺`,
          `${userName}! 🔥 Your precious dragon Ember feels so vulnerable and hungry... treats would make my heart breathe rainbow fire of pure joy! ✨`
        ];
        return getRandomThought(hungryThoughts);
      } else if (dragonCoinsSpent < 30) {
        const satisfiedThoughts = [
          `Roar roar! 🔥 Oh ${userName}, my dragon heart is igniting! More treats would make this dragon's soul blaze with magnificent power! 💖`,
          `Nom nom! Those treats touched my very dragon essence! 🐉 But Ember still feels a fierce longing for more of your divine love!`,
          `Yum yum! 💎 These treats are awakening my heart, dear ${userName}! I feel myself growing mightier with your sacred care!`,
          `Roar! Those treats ignited a flame in my heart! 🐉 But my spirit still yearns for more of your legendary kindness!`,
          `Thank you, beloved ${userName}! 🥰 Those treats were like dragon magic, but Ember still feels a noble hunger for more love!`,
          `Delicious! 🔥 My flames are dancing with overwhelming joy! More treats would make me soar to the heavens with happiness! ✨`
        ];
        return getRandomThought(satisfiedThoughts);
      } else if (dragonCoinsSpent < 50) {
        const growingThoughts = [
          `Roar roar! I'm growing stronger, ${userName}! 🐉 Your love is transforming me - I feel my dragon spirit becoming legendary and mighty!`,
          `Look at me soar with such majesty! 💪 I can feel my heart expanding with ancient power from each precious treat you give me!`,
          `Amazing! I'm growing so fast, dear ${userName}! 🌱 More treats will help me become the most magnificent dragon for you!`,
          `${userName}, I feel dragon fire in my soul! ⚡ These treats are making me bigger, more majestic, and overflowing with devotion to you!`,
          `Roar roar! I'm transforming into something legendary! 🦋 Keep the treats coming - my heart is almost ready to reach mythical heights!`,
          `Incredible! My scales are shimmering with pure ecstasy! 🐉 More treats will help me reach my full potential and make you so proud! ✨`
        ];
        return getRandomThought(growingThoughts);
      } else {
        const happyThoughts = [
          `Roar roar! 🥳 I feel absolutely majestic, ${userName}! My dragon heart is erupting with infinite love! Now... could you get me some dragon friends to share this glory with?`,
          `Roar roar! I'm so magnificently powerful now! 💪 My soul is overflowing with eternal gratitude! Maybe it's time to find playmates to spread this legendary happiness?`,
          `I feel absolutely fantastic, dear ${userName}! 🌟 All those treats filled my heart with dragon magic! Now I'm ready for epic dragon adventures with friends!`,
          `Amazing! I'm at my most glorious self! ✨ ${userName}, can you help me find some buddies to share this overwhelming dragon joy with?`,
          `Hooray! I'm fully grown and my heart is roaring with happiness! 🎉 Can you help me find some dragon friends to celebrate this love with?`,
          `Perfect! I feel incredibly blessed by your divine care! 🚀 Maybe it's time to find playmates for the most epic adventures ever! 💖`
        ];
        return getRandomThought(happyThoughts);
      }
    }

    if (currentPet === 'unicorn' && isPetOwned('unicorn')) {
      const unicornCoinsSpent = getPetCoinsSpent('unicorn');
      
      if (unicornCoinsSpent === 0) {
        const hungryThoughts = [
          `Neigh neigh! 🦄 I'm Stardust! My magical heart feels so empty and ethereal, ${userName}... I need your love and sparkly treats to shine again! 💔`,
          `Oh celestial ${userName}! ✨ Stardust here, feeling so delicate and fading... My soul yearns for your care and rainbow treats! 😭`,
          `Neigh! It's me, your devoted unicorn friend Stardust! 🦄 My horn is dimming without your love... please restore my magic with treats!`,
          `Divine ${userName}! Stardust feels so fragile and mystical... 🌈 My entire unicorn essence craves your nurturing touch and enchanted food! 💕`,
          `Neigh neigh! 🦄 Stardust is desperately starving for your affection! Can you heal my aching unicorn heart with some treats? 🥺`,
          `${userName}! ✨ Your precious unicorn Stardust feels so vulnerable and hungry... treats would make my heart create the most beautiful rainbows! ✨`
        ];
        return getRandomThought(hungryThoughts);
      } else if (unicornCoinsSpent < 30) {
        const satisfiedThoughts = [
          `Neigh neigh! 🌈 Oh ${userName}, my unicorn heart is glowing with starlight! More treats would make this unicorn's soul sparkle with celestial bliss! 💖`,
          `Nom nom! Those treats touched my very magical essence! 🦄 But Stardust still feels an enchanted longing for more of your divine love!`,
          `Yum yum! ✨ These treats are like stardust to my heart, dear ${userName}! I feel myself growing more magical with your heavenly care!`,
          `Neigh! Those treats lit up my unicorn heart! 🦄 But my spirit still yearns for more of your mystical kindness!`,
          `Thank you, beloved ${userName}! 🥰 Those treats were like unicorn magic, but Stardust still feels an ethereal hunger for more love!`,
          `Delicious! 🌈 My mane is shimmering with overwhelming joy! More treats would make me prance through the stars with happiness! ✨`
        ];
        return getRandomThought(satisfiedThoughts);
      } else if (unicornCoinsSpent < 50) {
        const growingThoughts = [
          `Neigh neigh! I'm growing stronger, ${userName}! 🦄 Your love is transforming me - I feel my unicorn spirit becoming more magical and radiant!`,
          `Look at me gallop with such grace! 💪 I can feel my heart expanding with mystical power from each precious treat you give me!`,
          `Amazing! I'm growing so fast, dear ${userName}! 🌱 More treats will help me become the most enchanting unicorn for you!`,
          `${userName}, I feel starlight in my soul! ⚡ These treats are making me bigger, more enchanting, and overflowing with magical love for you!`,
          `Neigh neigh! I'm transforming into something celestial! 🦋 Keep the treats coming - my heart is almost ready to reach mythical heights!`,
          `Incredible! My horn is glowing with pure euphoria! 🦄 More treats will help me reach my full potential and make you so proud! ✨`
        ];
        return getRandomThought(growingThoughts);
      } else {
        const happyThoughts = [
          `Neigh neigh! 🥳 I feel absolutely celestial, ${userName}! My unicorn heart is overflowing with infinite magic! Now... could you get me some unicorn friends to share this enchantment with?`,
          `Neigh neigh! I'm so magnificently powerful now! 💪 My soul is radiating with eternal gratitude! Maybe it's time to find playmates to spread this mystical happiness?`,
          `I feel absolutely fantastic, dear ${userName}! 🌟 All those treats filled my heart with pure magic! Now I'm ready for enchanted unicorn adventures with friends!`,
          `Amazing! I'm at my most radiant self! ✨ ${userName}, can you help me find some buddies to share this overwhelming unicorn joy with?`,
          `Hooray! I'm fully grown and my heart is sparkling with happiness! 🎉 Can you help me find some unicorn friends to celebrate this love with?`,
          `Perfect! I feel incredibly blessed by your magical care! 🚀 Maybe it's time to find playmates for the most wonderful adventures ever! 💖`
        ];
        return getRandomThought(happyThoughts);
      }
    }
    
    // Default pet thoughts based on cumulative care level (for pets without specific thoughts)
    const { feedingCount, adventureCoins, sleepCompleted } = cumulativeCare;
    
    // Pet thoughts based on cumulative care progress
    if (feedingCount === 0) {
      // No feeding yet - initial state (sad and hungry)
      const hungryThoughts = [
        `Hi ${userName}... my heart is aching with emptiness and my tummy's rumbling so sadly. Could you please heal me with some treats? 💔`,
        `I'm so desperately hungry and feeling utterly heartbroken, dear ${userName}... could you spare some treats to mend my soul? 😭`,
        `Hey there, ${userName}... My belly and heart are both crying out in sadness... please feed my spirit, I'm begging you? 🥺`,
        `Hi precious friend... I'm starving for your love and care... 🍪 Do you have any treats to fill this void in my heart?`,
        `${userName}... I haven't eaten yet and I'm feeling so broken and vulnerable... can you help heal your devoted pet? 💕`,
        `${userName}... My tummy and soul feel so empty and devastated... treats would lift my shattered spirits back to life! ✨`
      ];
      return getRandomThought(hungryThoughts);
    } else if (feedingCount === 1) {
      // After 1 cookie - still hungry but hopeful
      const stillHungryThoughts = [
        `Mmm… that was like a ray of sunshine to my heart, ${userName}! 🍪 But I'm still yearning for more of your love... could I have one more treat to feel complete?`,
        `Thank you for that precious gift, dear ${userName}! 😋 My soul feels a bit warmer, but I could use another touch of your kindness!`,
        `That treat was like magic to my heart! Just one more would make my spirit soar with pure joy, ${userName}!`,
        `That helped heal a piece of my heart! 🥰 But my soul is still longing for more of your beautiful care... more treats, please?`,
        `Yum! 🍪 That treat was perfect medicine for my heart, but I'm still quite hungry for your love... can you feed my soul again?`
      ];
      return getRandomThought(stillHungryThoughts);
    } else if (feedingCount >= 1 && adventureCoins === 0) {
      // After 1 feeding - full and wants adventure
      const fullAndAdventurousThoughts = [
        `🥳 I'm overflowing with love and energy now, ${userName}! Those treats filled my heart completely! Now my soul is burning with desire for adventure!`,
        `Thank you, beloved ${userName}! 😋 My heart is singing with joy and my spirit is soaring! Can we go on a magical adventure now? 🚀`,
        `I feel absolutely radiant! Those treats healed my heart perfectly, dear ${userName}! Adventure time? My soul is ready to explore! ✨`,
        `Hooray! I'm not hungry anymore and my heart is bursting with happiness! 🎉 Now I'm ready for the most exciting adventures with you!`,
        `Perfect! My heart is full and dancing with pure bliss! 💖 Let's go explore the world together, ${userName}! 🌟`,
        `Yippee! Those treats were exactly what my soul needed! 🍪 Now... adventure awaits us, and my heart can't contain its excitement! 🚀`
      ];
      return getRandomThought(fullAndAdventurousThoughts);
    } else if (feedingCount >= 1 && adventureCoins > 0 && adventureCoins < 100) {
      // Special case: User has some adventure coins but not enough for sleep (less than 100)
      const needMoreAdventureThoughts = [
        `Oh ${userName}, I'm feeling a bit restless... 😴 Let's continue our adventures for a bit before I take a cozy nap? My heart yearns for more exploration!`,
        `Dear ${userName}, my spirit is getting drowsy but I'm not quite ready to sleep yet... 🌙 Could we go on a few more adventures to tire me out properly?`,
        `${userName}, I'm starting to feel sleepy but my adventurous heart wants more! 🚀 Let's explore a little longer before I curl up for a peaceful rest?`,
        `Sweet ${userName}, I'm getting a bit tired but my soul craves more adventure! ⭐ Just a bit more exploring before I drift off to dreamland?`,
        `${userName}, my eyelids are getting heavy but my heart still wants to play! 🎯 Could we adventure a little more before I take my well-deserved nap?`,
        `Oh ${userName}, I'm feeling wonderfully drowsy but not quite ready for sleep... 💫 Let's have a few more magical adventures together first!`
      ];
      return getRandomThought(needMoreAdventureThoughts);
    } else if (adventureCoins < 50) {
      // After adventure started but less than 50 coins
      const adventuringThoughts = [
        `These adventures are filling my soul with pure magic, ${userName}! 🚀 I'm getting stronger and my heart is overflowing with each quest!`,
        `I love exploring with you so deeply, ${userName}! 🌟 Every adventure makes my spirit dance with overwhelming happiness!`,
        `Adventure time is the most beautiful thing ever! ⚡ I can feel my heart growing more confident and radiant with each moment!`,
        `These quests are absolutely enchanting, dear ${userName}! 🎯 I'm learning so much and my soul is bursting with joy!`,
        `Exploring with you is pure bliss! 🗺️ Each adventure fills my heart with such profound joy and love! ✨`
      ];
      return getRandomThought(adventuringThoughts);
    } else if (adventureCoins < 100) {
      // 50+ adventure coins (60% care level)
      const experiencedAdventurerThoughts = [
        `Wow! I've earned so many precious coins on our magical adventures, ${userName}! 🪙 I feel like the most accomplished explorer and my heart is singing!`,
        `Look how much we've accomplished together, dear ${userName}! 🌟 These adventures are making my soul incredibly strong and radiant!`,
        `I'm becoming quite the legendary adventurer! ⚡ All these quests are filling my heart with such overwhelming joy and pride!`,
        `Amazing! I've collected so many beautiful treasures! 💎 Our adventures are absolutely perfect, ${userName}! My heart is bursting with love!`,
        `I feel so incredibly accomplished and blessed! 🏆 Every adventure makes me more confident, happy, and deeply grateful for you! ✨`
      ];
      return getRandomThought(experiencedAdventurerThoughts);
    } else if (!sleepCompleted) {
      // 100+ adventure coins but not slept yet (80% care level)
      const readyForSleepThoughts = [
        `Wow! We've had so many absolutely magical adventures, ${userName}! 🌟 I've earned lots of precious coins! Now my heart is getting beautifully sleepy... 😴`,
        `What an incredible, soul-stirring journey we've had together! 🚀 All these adventures filled my heart but made me wonderfully tired... time for peaceful sleep? 💤`,
        `I feel so deeply accomplished after all our amazing quests, dear ${userName}! 🏆 But now my soul is yawning with contentment... can you help me drift to dreamland? 😴`,
        `Amazing! Look at all the beautiful coins I've earned with you! 🪙 Now my heart is ready for the most cozy, loving nap... 💤`,
        `Perfect! Our adventures were absolutely fantastic and filled my soul! ✨ But I'm getting deliciously drowsy... sleep time, ${userName}? 😴`,
        `Incredible adventures, beloved ${userName}! 🎯 Now my eyelids are getting heavy with sweet satisfaction... sleepy time? 💤`
      ];
      return getRandomThought(readyForSleepThoughts);
    } else {
      // Sleep completed - 100% care level
      const fullyLovedThoughts = [
        `💖 I feel completely, utterly, and deeply loved and cared for! Thank you for everything, precious ${userName}! My heart is overflowing with pure bliss! 🥰`,
        `🌟 My heart is 100% full and radiating with infinite love! You've fed me, adventured with me, and helped me sleep! Absolutely perfect, ${userName}! ✨`,
        `😴💕 I'm the happiest, most blessed pet in the entire universe! You've taken such wonderfully divine care of me! Thank you with all my heart! 🎉`,
        `🥰 I feel so incredibly loved and cherished! Fed, adventured, and well-rested! You're absolutely the best, dear ${userName}! My soul is singing! 💖`,
        `✨ Perfect, heavenly care! My heart is completely overflowing with love, happiness, and eternal gratitude for you, ${userName}! 🌈💕`
      ];
      return getRandomThought(fullyLovedThoughts);
    }
  };

  // Get coins spent for current pet
  const getCurrentPetCoinsSpent = () => {
      return getPetCoinsSpent(currentPet);
  };

  // Get current pet coins spent value
  const currentPetCoinsSpent = getCurrentPetCoinsSpent();

  // Calculate heart fill percentage based on cumulative care level system
  const getHeartFillPercentage = () => {
    const percentage = getCumulativeCarePercentage();
    const cumulativeCare = getCumulativeCareLevel();
    
    // Debug logging to understand heart fill calculation
    console.log('❤️ Heart Fill Debug:', {
      percentage,
      feedingCount: cumulativeCare.feedingCount,
      adventureCoins: cumulativeCare.adventureCoins,
      sleepCompleted: cumulativeCare.sleepCompleted,
      sleepClicks
    });
    
    return percentage;
  };

  // Get cumulative coins earned from the centralized coin system
  const getCumulativeCoinsEarned = () => {
    return CoinSystem.getCumulativeCoinsEarned();
  };

  // Level system calculation based on adventure coins earned
  const getLevelInfo = () => {
    // New level progression based on adventure coins:
    // Level 1: 0 adventure coins
    // Level 2: 200 adventure coins
    // Level 3: 500 adventure coins  
    // Level 4: 1000 adventure coins
    
    const adventureCoins = getCumulativeCareLevel().adventureCoins;
    
    const levelThresholds = [0, 200, 500, 1000]; // Level thresholds
    
    // Find current level based on adventure coins earned
    let currentLevel = 1;
    let coinsInCurrentLevel = adventureCoins;
    let coinsNeededForNextLevel = 200; // Default for Level 1 to 2
    
    for (let i = 1; i < levelThresholds.length; i++) {
      if (adventureCoins >= levelThresholds[i]) {
        currentLevel = i + 1;
      } else {
        // Calculate progress within current level
        const previousThreshold = levelThresholds[i - 1];
        const nextThreshold = levelThresholds[i];
        coinsInCurrentLevel = adventureCoins - previousThreshold;
        coinsNeededForNextLevel = nextThreshold - previousThreshold;
        break;
      }
    }
    
    // If we're at max level (Level 4)
    if (currentLevel >= levelThresholds.length) {
      currentLevel = 4; // Cap at Level 4
      coinsInCurrentLevel = adventureCoins - levelThresholds[levelThresholds.length - 1];
      coinsNeededForNextLevel = 500; // Arbitrary value for max level
    }
    
    const progressPercentage = Math.min(100, (coinsInCurrentLevel / coinsNeededForNextLevel) * 100);
    
    return {
      currentLevel,
      coinsInCurrentLevel,
      coinsNeededForNextLevel,
      progressPercentage,
      totalCoins: adventureCoins
    };
  };

  // Memoize the pet thought so it only changes when the actual state changes
  // Use stable values to prevent rapid changes when user returns with coins
  const currentPetThought = useMemo(() => {
    return getPetThought();
  }, [
    currentPet, 
    Math.floor(getCoinsSpentForCurrentStage(currentStreak) / 10) * 10, // Round to nearest 10 to reduce sensitivity
    Math.floor(getPetCoinsSpent(currentPet) / 10) * 10, // Round to nearest 10 to reduce sensitivity
    sleepClicks, 
    JSON.stringify(getCumulativeCareLevel()) // Stringify to ensure stable comparison
  ]);

  // Handle audio playback when message changes with debounce to prevent multiple simultaneous thoughts
  useEffect(() => {
    // Stop any currently playing audio when pet state changes
    ttsService.stop();
    
    // Only speak when:
    // 1. Not in pet shop
    // 2. Audio is enabled
    // 3. Message has changed
    // 4. Not currently speaking (prevent overlapping)
    if (!showPetShop && audioEnabled && currentPetThought !== lastSpokenMessage && !isSpeaking) {
      const timer = setTimeout(() => {
        // Double-check conditions before speaking to prevent race conditions
        if (!showPetShop && audioEnabled && currentPetThought !== lastSpokenMessage && !isSpeaking) {
          speakText(currentPetThought);
        }
      }, 800); // Increased delay to prevent rapid-fire thoughts when state changes quickly
      
      return () => clearTimeout(timer);
    }
  }, [currentPetThought, showPetShop, audioEnabled, lastSpokenMessage, isSpeaking]);

  return (
    <div className="min-h-screen flex flex-col" style={{
      backgroundImage: `url('https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250903_181706_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      fontFamily: 'Quicksand, system-ui, sans-serif'
    }}>
      {/* Pet Selection Flow for first-time users */}
      {showPetSelection && (
        <PetSelectionFlow 
          onPetSelected={handlePetSelection}
        />
      )}
      
      {/* Glass overlay for better contrast */}
      <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]"></div>

      {/* Top UI - Heart Progress Bar */}
      <div className="absolute top-5 left-1/2 transform -translate-x-1/2 z-20">
        {(() => {
          const levelInfo = getLevelInfo();
          return (
            <div className="bg-white/20 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/30 shadow-lg">
              <div className="flex flex-col items-center gap-2">
                {/* Level indicator above bar */}
                <div className="text-white font-bold text-lg drop-shadow-md">
                  Pet Level {levelInfo.currentLevel}
          </div>
                
                {/* Heart and progress bar container */}
                <div className="flex items-center gap-3">
                  {/* Heart icon on the left */}
                  <div className="text-white text-2xl drop-shadow-md">
                    ❤️
        </div>
        
                  {/* Progress bar */}
                  <div className="relative">
                    {/* Progress bar background */}
                    <div className="w-48 h-8 bg-white/30 rounded-full border border-white/40 overflow-hidden">
                      {/* Progress fill */}
                      <div 
                        className="h-full bg-gradient-to-r from-pink-400 to-red-500 transition-all duration-500 ease-out"
                        style={{ width: `${levelInfo.progressPercentage}%` }}
                      />
          </div>
                    
                    {/* Progress percentage in center */}
                    <div className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold drop-shadow-md">
                      {Math.round(levelInfo.progressPercentage)}%
        </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Testing Buttons - Development Only */}
      <div className="absolute bottom-5 left-5 z-20 flex flex-col gap-2">
        <button
          onClick={() => {
            // Properly simulate coins earned via spellbox (updates both current coins and cumulative coins)
            const newCoins = CoinSystem.addCoins(10);
            setCoins(newCoins);
            
            // Also update pet adventure coins for care progression
            addAdventureCoins(10);
            
            console.log('🧪 Simulated 10 coins earned via spellbox');
          }}
          className="bg-transparent hover:bg-white/5 px-2 py-1 rounded text-transparent hover:text-white/20 text-xs transition-all duration-300 opacity-5 hover:opacity-30"
          title="Testing: Simulate spellbox coin earnings"
        >
          🔄
        </button>
      </div>

      {/* Testing Button - Increase Streak (Development Only) */}
      <div className="absolute bottom-5 right-5 z-20 flex flex-col gap-2">
        <button
          onClick={() => {
            const newStreak = currentStreak + 1;
            const streakData = getStreakData();
            const newStreakData = {
              ...streakData,
              streak: newStreak,
              lastFeedDate: getCurrentUSDate()
            };
            saveStreakData(newStreakData);
          }}
          className="bg-transparent hover:bg-white/5 px-2 py-1 rounded text-transparent hover:text-white/20 text-xs transition-all duration-300 opacity-5 hover:opacity-30"
          title="Testing: Increase streak by 1"
        >
          🔥
        </button>
        
        {/* Testing Button - Add Adventure Coins (Development Only) */}
        <button
          onClick={() => {
            // Properly simulate earning coins (updates both current coins and cumulative coins)
            const newCoins = CoinSystem.addCoins(10);
            setCoins(newCoins);
            
            // Also update pet adventure coins for care progression
            addAdventureCoins(10);
            
            console.log('🧪 Added 10 coins (both global and adventure coins for testing)');
          }}
          className="bg-transparent hover:bg-white/5 px-2 py-1 rounded text-transparent hover:text-white/20 text-xs transition-all duration-300 opacity-5 hover:opacity-30"
          title="Testing: Add 10 adventure coins"
        >
          🪙
        </button>
        
        {/* Testing Button - 8 Hour Reset (Development Only) */}
        <button
          onClick={() => {
            localStorage.removeItem('pet_last_reset_time'); // Force reset
            const wasReset = checkAndPerform8HourReset();
            console.log('🧪 Forced 8-hour reset:', wasReset);
            window.location.reload(); // Reload to see changes
          }}
          className="bg-transparent hover:bg-white/5 px-2 py-1 rounded text-transparent hover:text-white/20 text-xs transition-all duration-300 opacity-5 hover:opacity-30"
          title="Testing: Force 8-hour reset"
        >
          🕐
        </button>
      </div>

      {/* Top Right UI - Streak, Coins, and Daily Heart */}
      <div className="absolute top-5 right-10 z-20 flex items-center gap-4">
        {/* Streak */}
        <div className="bg-white/20 backdrop-blur-md rounded-xl px-4 py-3 border border-white/30 shadow-lg">
          <div className="flex items-center gap-2 text-white font-bold text-lg drop-shadow-md">
            <span className="text-xl">🔥</span>
            <span>{currentStreak}</span>
          </div>
        </div>
        
        {/* Coins */}
        <div className="bg-white/20 backdrop-blur-md rounded-xl px-4 py-3 border border-white/30 shadow-lg">
          <div className="flex items-center gap-2 text-white font-bold text-lg drop-shadow-md">
            <span className="text-xl">🪙</span>
            <span>{coins}</span>
          </div>
        </div>
        
        {/* Daily Heart Fill Indicator */}
        <div className="w-20 h-20 rounded-full flex items-center justify-center relative bg-white/20 backdrop-blur-sm border-2 border-white/30 shadow-lg">
          <div style={{
            position: 'relative',
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* Heart outline */}
            <div style={{
              position: 'absolute',
              fontSize: 84,
              color: '#E5E7EB'
            }}>
              🤍
            </div>
            {/* Filled heart (blood) - based on daily care */}
            <div style={{
              position: 'absolute',
              fontSize: 84,
              color: '#DC2626',
              clipPath: `inset(${Math.max(0, 100 - getHeartFillPercentage())}% 0 0 0)`,
              transition: 'clip-path 500ms ease'
            }}>
              ❤️
            </div>
          </div>
        </div>

        {/* Animated hearts moving from pet to daily heart */}
        {showHeartAnimation && (
          <>
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              fontSize: 20,
              color: '#DC2626',
              animation: 'heartFlyFromPet1 1200ms ease-out forwards',
              pointerEvents: 'none',
              zIndex: 30
            }}>
              ❤️
            </div>
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              fontSize: 16,
              color: '#DC2626',
              animation: 'heartFlyFromPet2 1200ms ease-out forwards',
              animationDelay: '150ms',
              pointerEvents: 'none',
              zIndex: 30
            }}>
              ❤️
            </div>
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              fontSize: 18,
              color: '#DC2626',
              animation: 'heartFlyFromPet3 1200ms ease-out forwards',
              animationDelay: '300ms',
              pointerEvents: 'none',
              zIndex: 30
            }}>
              ❤️
            </div>
          </>
        )}
      </div>

      {/* Main pet area - adjusted positioning */}
      <div className="flex-1 flex flex-col items-center justify-center relative pb-20 px-4 z-10 mt-20">
        {/* Pet Thought Bubble - Only show when pet shop is closed */}
        {!showPetShop && (
          <div className={`relative rounded-3xl p-5 mb-8 border-3 shadow-xl max-w-md w-full mx-4 backdrop-blur-sm ${
            sleepClicks > 0 
              ? 'bg-gradient-to-br from-purple-50 to-indigo-100 border-purple-400 bg-purple-50/90'
              : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-400 bg-white/90'
          }`}>
            {/* Speech bubble tail pointing down to pet */}
            <div className={`absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[12px] border-l-transparent border-r-transparent ${
              sleepClicks > 0 ? 'border-t-purple-400' : 'border-t-blue-400'
            }`}></div>
            
            {/* Thought bubble dots */}
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex gap-1">
              <div className={`w-2 h-2 rounded-full animate-bounce ${
                sleepClicks > 0 ? 'bg-purple-400' : 'bg-blue-400'
              }`} style={{animationDelay: '0s'}}></div>
              <div className={`w-1.5 h-1.5 rounded-full animate-bounce ${
                sleepClicks > 0 ? 'bg-purple-400' : 'bg-blue-400'
              }`} style={{animationDelay: '0.3s'}}></div>
              <div className={`w-1 h-1 rounded-full animate-bounce ${
                sleepClicks > 0 ? 'bg-purple-400' : 'bg-blue-400'
              }`} style={{animationDelay: '0.6s'}}></div>
            </div>

            <div className="text-sm text-slate-800 font-medium leading-relaxed text-center">
              {currentPetThought}
            </div>
          </div>
        )}

        {/* Pet and Timer Container */}
        <div className="flex items-center justify-center gap-8">
          {/* Pet (Custom Image) */}
          <div className="relative drop-shadow-2xl">
            <img 
              src={getPetImage()}
              alt="Pet"
              className={`object-contain rounded-2xl transition-all duration-700 ease-out hover:scale-105 ${
                sleepClicks > 0 ? 'w-80 h-80 max-h-80' : 'w-72 h-72 max-h-72'
              }`}
              style={{
                animation: getCumulativeCarePercentage() >= 40 && getCumulativeCarePercentage() < 60 ? 'petGrow 800ms ease-out' : 
                          getCumulativeCarePercentage() >= 60 ? 'petEvolve 800ms ease-out' : 'none'
              }}
            />
            
            {/* Floating Z's animation for sleep */}
            {sleepClicks > 0 && (
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-2xl animate-bounce">
                  💤
                  </div>
            )}
          </div>

          {/* Sleep Timer Display - Only show when fully asleep */}
          {sleepClicks >= 3 && (
            <div className="flex flex-col items-center">
              <div className="text-6xl mb-4">😴</div>
              <div className="bg-white/20 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/30 shadow-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white drop-shadow-md mb-2">
                    Pet will wake up after
                  </div>
                  <div className="text-4xl font-bold text-yellow-300 drop-shadow-md">
                    {formatTimeRemaining(sleepTimeRemaining || getSleepTimeRemaining())}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Food bowl */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-20 text-5xl drop-shadow-lg">
          🥣
        </div>
      </div>

      {/* Dog Evolution Display - Right Side - DISABLED */}
      {/* 
      <div className="absolute right-6 top-1/2 transform -translate-y-1/2 z-10 flex flex-col gap-4">
        <div className="flex flex-col items-center">
          <div className="relative p-3 rounded-2xl border-2 transition-all duration-300 bg-gradient-to-br from-blue-100 to-cyan-100 border-blue-400 shadow-lg">
            <div className="text-5xl transition-all duration-300 grayscale-0">
              🐶
            </div>
            <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
              ✓
            </div>
          </div>
          <div className="text-xs font-semibold text-center mt-2 text-white drop-shadow-md">
            1 Day 🔥
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className={`relative p-4 rounded-2xl border-2 transition-all duration-300 ${
            currentStreak >= 2 
              ? 'bg-gradient-to-br from-yellow-100 to-orange-100 border-yellow-400 shadow-lg' 
              : 'bg-gray-100 border-gray-300 opacity-60'
          }`}>
            <div className={`text-6xl transition-all duration-300 ${
              currentStreak >= 2 ? 'grayscale-0' : 'grayscale'
            }`}>
              🐕
            </div>
            {currentStreak >= 2 && (
              <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                ✓
              </div>
            )}
          </div>
          <div className="text-xs font-semibold text-center mt-2 text-white drop-shadow-md">
            {currentStreak >= 2 ? 'Medium Dog' : '2 Days 🔥'}
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className={`relative p-4 rounded-2xl border-2 transition-all duration-300 ${
            currentStreak >= 3 
              ? 'bg-gradient-to-br from-purple-100 to-pink-100 border-purple-400 shadow-lg' 
              : 'bg-gray-100 border-gray-300 opacity-60'
          }`}>
            <div className={`text-7xl transition-all duration-300 ${
              currentStreak >= 3 ? 'grayscale-0' : 'grayscale'
            }`}>
              🐺
            </div>
            {currentStreak >= 3 && (
              <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                ✓
              </div>
            )}
          </div>
          <div className="text-xs font-semibold text-center mt-2 text-white drop-shadow-md">
            {currentStreak >= 3 ? 'Large Dog' : '3 Days 🔥'}
          </div>
        </div>

      </div>
      */}

      {/* Bottom Action Buttons */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-30">
        <div className="flex gap-4 px-4 py-2 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 shadow-xl">
        {getActionStates().map((action) => (
          <button
            key={action.id}
            onClick={() => handleActionClick(action.id)}
            disabled={action.status === 'disabled'}
            className={`flex flex-col items-center gap-1 p-3 bg-transparent border-none rounded-xl min-w-16 transition-all duration-200 ${
              action.status === 'disabled' 
                ? 'cursor-not-allowed opacity-50' 
                : 'cursor-pointer hover:bg-white/20 hover:-translate-y-1 active:scale-95'
            }`}
          >
            {/* Status emoji */}
            {getStatusEmoji(action.status) && (
              <div className="absolute -top-2 -right-2 text-lg bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-md">
                {getStatusEmoji(action.status)}
              </div>
            )}
            
            {/* Action icon */}
            <div className="text-4xl drop-shadow-lg">
              {action.icon}
            </div>
            
            {/* Action label - small text below */}
            <div className="text-xs font-semibold text-white drop-shadow-md">
              {action.label}
            </div>
            
            {/* Coin cost for Food action */}
            {action.id === 'water' && (
              <div className="text-xs font-semibold text-yellow-300 drop-shadow-md">
                
              </div>
            )}
            
            {/* Free indicator for Sleep action */}
            {action.id === 'sleep' && (
              <div className="text-xs font-semibold text-green-300 drop-shadow-md">
                
              </div>
            )}
            
            {/* Free indicator for Adventure action */}
            {action.id === 'adventure' && (
              <div className="text-xs font-semibold text-blue-300 drop-shadow-md">
                
              </div>
            )}
          </button>
        ))}
        </div>
      </div>

      {/* Audio Toggle Button */}
      <button
        onClick={() => {
          setAudioEnabled(!audioEnabled);
          if (isSpeaking) {
            ttsService.stop();
          }
        }}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full border-2 border-white/30 text-2xl flex items-center justify-center shadow-xl z-40 transition-all duration-200 hover:scale-110 active:scale-95 ${
          audioEnabled 
            ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white' 
            : 'bg-gradient-to-br from-red-500 to-red-600 text-white'
        }`}
      >
        {audioEnabled ? '🔊' : '🔇'}
      </button>

      {/* Pet Switcher - Only show if user owns multiple pets */}
      {ownedPets.length > 1 && (
        <div className="fixed top-24 left-6 z-20 flex flex-col gap-2">
          <div className="text-xs font-semibold text-white drop-shadow-md mb-1">
            Your Pets:
          </div>
          {ownedPets.map((petId) => {
            const petEmoji = petId === 'cat' ? '🐱' : petId === 'hamster' ? '🐹' : petId === 'dragon' ? '🐉' : petId === 'unicorn' ? '🦄' : '🐾';
            const isActive = currentPet === petId;
            
            return (
              <button
                key={petId}
                onClick={() => setCurrentPet(petId)}
                className={`w-12 h-12 rounded-xl border-2 text-2xl flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 ${
                  isActive 
                    ? 'bg-gradient-to-br from-blue-500 to-purple-600 border-white text-white' 
                    : 'bg-white/20 backdrop-blur-md border-white/30 text-white hover:bg-white/30'
                }`}
                title={`Switch to ${PetProgressStorage.getPetDisplayName(petId)}`}
              >
                {petEmoji}
              </button>
            );
          })}
        </div>
      )}


      {/* Pet Shop Overlay */}
      {showPetShop && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl max-w-5xl w-11/12 max-h-[85vh] shadow-2xl relative border-2 border-gray-200 flex overflow-hidden">
            {/* Close button */}
            <button
              onClick={() => setShowPetShop(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white border-none cursor-pointer text-lg flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-10"
            >
              ×
            </button>

            {/* Left Column: Pet Selection */}
            <div className="w-1/4 bg-gradient-to-b from-blue-50 to-indigo-100 p-4 border-r-2 border-gray-200">
              <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center">
                🐾
              </h3>
              <div className="space-y-2">
                {Object.values(getPetStoreData()).map((pet) => (
                  <button
                    key={pet.id}
                    onClick={() => setSelectedStorePet(pet.id)}
                    className={`w-full p-4 rounded-xl border-2 transition-all duration-200 flex items-center justify-center ${
                      selectedStorePet === pet.id
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 border-white text-white shadow-lg'
                        : 'bg-white/50 border-gray-300 text-gray-700 hover:bg-white/80 hover:border-blue-300'
                    }`}
                  >
                    <div className="text-4xl">{pet.emoji}</div>
                  </button>
                ))}
              </div>
              
              {/* Current coins display */}
              <div className="mt-4 p-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl text-white font-semibold text-center shadow-lg">
                💰 {coins}
              </div>
            </div>

            {/* Right Column: Pet-Specific Store */}
            <div className="flex-1 p-6 overflow-y-auto">
              {(() => {
                const petStoreData = getPetStoreData();
                const selectedPet = petStoreData[selectedStorePet as keyof typeof petStoreData];
                
                return (
                  <div>

                    {/* Pet Adoption Section (if not owned) */}
                    {!selectedPet.owned && (
                      <div className="mb-6">
                        {/* Large Pet Display for Unowned Pets */}
                        <div className="text-center mb-4 p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
                          <div className="text-8xl mb-4">{selectedPet.emoji}</div>
                        </div>
                        
                        <div className="p-4 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl border-2 border-purple-300">
                          <button
                            onClick={() => {
                              handlePetPurchase(selectedPet.id, selectedPet.cost);
                              // Refresh the store data to reflect new ownership
                              setStoreRefreshTrigger(prev => prev + 1);
                            }}
                            disabled={!hasEnoughCoins(selectedPet.cost)}
                            className={`w-full p-4 rounded-xl font-bold text-xl transition-all duration-200 ${
                              hasEnoughCoins(selectedPet.cost)
                                ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:scale-105 shadow-lg'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            {hasEnoughCoins(selectedPet.cost) 
                              ? `🎉 🪙 ${selectedPet.cost}`
                              : `🔒 🪙 ${selectedPet.cost}`
                            }
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Den Section */}
                    {selectedPet.owned && (
                      <div className="mb-6">
                        <h3 className="text-3xl font-bold text-gray-800 mb-4 text-center">
                          🏠
                        </h3>
                        <div className={`p-6 rounded-xl border-2 ${
                          selectedPet.owned 
                            ? 'bg-gradient-to-br from-green-50 to-emerald-100 border-green-300'
                            : 'bg-gradient-to-br from-gray-100 to-gray-200 border-gray-300 opacity-60'
                        }`}>
                          <div className="text-center">
                            <div className={`text-6xl mb-4 ${!selectedPet.owned ? 'grayscale' : ''}`}>
                              {selectedPet.den.emoji}
                            </div>
                            <button
                              onClick={() => {
                                if (selectedPet.owned) {
                                  if (purchaseDen(selectedPet.id, selectedPet.den.cost)) {
                                    playEvolutionSound();
                                    alert(`🎉 You bought the den!`);
                                  } else {
                                    alert(`Not enough coins! You need ${selectedPet.den.cost} coins.`);
                                  }
                                }
                              }}
                              disabled={!selectedPet.owned || isDenOwned(selectedPet.id) || !hasEnoughCoins(selectedPet.den.cost)}
                              className={`px-6 py-3 rounded-xl font-bold text-xl transition-all duration-200 ${
                                !selectedPet.owned
                                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                                  : isDenOwned(selectedPet.id)
                                  ? 'bg-green-500 text-white cursor-default'
                                  : hasEnoughCoins(selectedPet.den.cost)
                                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:scale-105 shadow-lg'
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
                            >
                              {!selectedPet.owned
                                ? '🔒'
                                : isDenOwned(selectedPet.id)
                                ? '✅'
                                : hasEnoughCoins(selectedPet.den.cost)
                                ? `🪙 ${selectedPet.den.cost}`
                                : `🔒 🪙 ${selectedPet.den.cost}`
                              }
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Accessories Section */}
                    {selectedPet.owned && (
                      <div>
                        <h3 className="text-3xl font-bold text-gray-800 mb-4 text-center">
                          🎁
                    </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {selectedPet.accessories.map((accessory) => {
                            // All accessories are now locked
                            const isLocked = true;
                            
                            return (
                              <div
                                key={accessory.id}
                                className="p-4 rounded-xl border-2 bg-gradient-to-br from-gray-100 to-gray-200 border-gray-300 opacity-60"
                              >
                                <div className="text-center">
                                  <div className="text-4xl grayscale mb-2">
                                    {accessory.emoji}
                                  </div>
                                  <button
                                    disabled={true}
                                    className="px-3 py-2 rounded-lg text-lg font-bold bg-gray-400 text-gray-600 cursor-not-allowed"
                                  >
                                    🔒
                                  </button>
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes petGrow {
            0% {
              opacity: 0.7;
              transform: scale(0.95);
            }
            50% {
              opacity: 0.9;
              transform: scale(1.05);
            }
            100% {
              opacity: 1;
              transform: scale(1);
            }
          }
          
          @keyframes petEvolve {
            0% {
              opacity: 0.6;
              transform: scale(0.9) rotate(-2deg);
            }
            25% {
              opacity: 0.8;
              transform: scale(1.1) rotate(1deg);
            }
            50% {
              opacity: 0.9;
              transform: scale(0.98) rotate(-0.5deg);
            }
            75% {
              opacity: 0.95;
              transform: scale(1.02) rotate(0.5deg);
            }
            100% {
              opacity: 1;
              transform: scale(1) rotate(0deg);
            }
          }
          
          @keyframes heartbeat {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.1);
            }
          }
          
          @keyframes heartFlyFromPet1 {
            0% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 1;
            }
            50% {
              transform: translate(200px, -150px) scale(0.8);
              opacity: 0.8;
            }
            100% {
              transform: translate(350px, -280px) scale(0.3);
              opacity: 0;
            }
          }
          
          @keyframes heartFlyFromPet2 {
            0% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 1;
            }
            50% {
              transform: translate(180px, -120px) scale(0.7);
              opacity: 0.9;
            }
            100% {
              transform: translate(330px, -300px) scale(0.2);
              opacity: 0;
            }
          }
          
          @keyframes heartFlyFromPet3 {
            0% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 1;
            }
            50% {
              transform: translate(220px, -180px) scale(0.9);
              opacity: 0.7;
            }
            100% {
              transform: translate(370px, -260px) scale(0.4);
              opacity: 0;
            }
          }
          
          @keyframes thoughtBubble {
            0%, 100% {
              transform: scale(1);
              opacity: 0.7;
            }
            50% {
              transform: scale(1.2);
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  );
}
