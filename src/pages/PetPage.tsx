import React, { useState, useEffect, useMemo } from 'react';
import { useCoins } from '@/pages/coinSystem';
import { ttsService } from '@/lib/tts-service';
import { useTTSSpeaking } from '@/hooks/use-tts-speaking';
import { usePetData } from '@/lib/pet-data-service';

type Props = {};

type ActionStatus = 'happy' | 'sad' | 'neutral';

interface ActionButton {
  id: string;
  icon: string;
  status: ActionStatus;
  label: string;
}

export function PetPage({}: Props): JSX.Element {
  // Use shared coin system
  const { coins, spendCoins, hasEnoughCoins, setCoins } = useCoins();
  
  // Use shared pet data system
  const { careLevel, ownedPets, audioEnabled, setCareLevel, addOwnedPet, setAudioEnabled, isPetOwned, getCoinsSpentForCurrentStage, getPetCoinsSpent, addPetCoinsSpent } = usePetData();
  
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
    if (!hasEnoughCoins(cost)) return false;
    spendCoins(cost);
    const newOwnedDens = [...ownedDens, `${petType}_den`];
    setOwnedDens(newOwnedDens);
    localStorage.setItem('owned_dens', JSON.stringify(newOwnedDens));
    return true;
  };
  
  const purchaseAccessory = (petType: string, accessoryId: string, cost: number) => {
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
  const [currentPet, setCurrentPet] = useState('dog'); // Default to dog
  
  // Local state for UI interactions
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [previousCoins, setPreviousCoins] = useState(coins);
  const [previousCoinsSpentForStage, setPreviousCoinsSpentForStage] = useState(0);
  const [showPetShop, setShowPetShop] = useState(false);
  const [lastSpokenMessage, setLastSpokenMessage] = useState('');
  
  // Pet store state
  const [selectedStorePet, setSelectedStorePet] = useState('dog'); // Which pet's store section is shown
  const [storeRefreshTrigger, setStoreRefreshTrigger] = useState(0); // Trigger to refresh store data
  
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

  // Initialize streak and previous coins spent on component mount
  useEffect(() => {
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
    
    // Check if sleep should be reset due to 8-hour timeout
    checkSleepTimeout();
  }, []);

  // Periodically check for sleep timeout (every minute when component is active)
  useEffect(() => {
    const interval = setInterval(() => {
      checkSleepTimeout();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  // Update action states when den ownership or sleep state changes
  useEffect(() => {
    setActionStates(getActionStates());
  }, [currentPet, sleepClicks, ownedDens]);

  // Reset sleep when switching pets
  useEffect(() => {
    resetSleep();
  }, [currentPet]);
  
  // TTS message ID for tracking speaking state
  const petMessageId = 'pet-message';
  const isSpeaking = useTTSSpeaking(petMessageId);
  
  // Pet action states - dynamically updated based on den ownership and sleep state
  const getActionStates = () => {
    const baseActions = [
      { id: 'water', icon: '🍪', status: 'sad' as ActionStatus, label: 'Food' },
    ];
    
    // Add sleep button if den is owned and sleep clicks < 5
    if (isDenOwned(currentPet) && sleepClicks < 5) {
      const sleepLabel = sleepClicks === 0 ? 'Sleep' : `Sleep ${sleepClicks}/5`;
      baseActions.push({ id: 'sleep', icon: '😴', status: 'neutral' as ActionStatus, label: sleepLabel });
    }
    
    // Always add more button at the end
    baseActions.push({ id: 'more', icon: '🐾', status: 'neutral' as ActionStatus, label: 'More' });
    
    return baseActions;
  };

  const [actionStates, setActionStates] = useState<ActionButton[]>(getActionStates());

  const handleActionClick = (actionId: string) => {
    // Handle sleep action
    if (actionId === 'sleep') {
      if (!isDenOwned(currentPet)) {
        alert("You need to buy a den first before your pet can sleep!");
        return;
      }
      
      // Increment sleep clicks (max 5)
      if (sleepClicks < 5) {
        updateSleepClicks(sleepClicks + 1);
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

    // Don't deduct coins for "More" action - always open pet shop
    if (actionId === 'more') {
      // Stop any current audio when opening pet shop
      ttsService.stop();
      setShowPetShop(true);
      return;
    }

    // Check if player has enough coins for feeding actions
    if (!hasEnoughCoins(10)) {
      alert("Not enough coins! You need 10 coins to perform this action.");
      return;
    }

    // Play feeding sound
    playFeedingSound();

    // Deduct coins and increase care level
    spendCoins(10);
    setCareLevel(Math.min(careLevel + 1, 6), currentStreak); // Max 6 actions, pass current streak
    
    // Track coins spent on current pet
    addPetCoinsSpent(currentPet, 10);
    
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

  const getStatusEmoji = (status: ActionStatus) => {
    switch (status) {
      // case 'happy': return '😊';
      // case 'sad': return '😢';
      case 'neutral': return '';
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

  // Get sleepy pet images based on sleep clicks
  const getSleepyPetImage = (clicks: number) => {
    if (clicks >= 5) {
      // TBD - will be added later (fully asleep)
      return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_165610_dog_den_no_bg.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
    } else if (clicks >= 3) {
      // TBD - will be added later (deep sleep)
      return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_163624_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
    } else if (clicks >= 1) {
      // 1+ clicks (getting sleepy)
      return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_162600_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
    } else {
      // 0 clicks (starting to sleep)
      return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_162533_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
    }
  };

  const getPetImage = () => {
    // If pet is in sleep mode (sleepClicks > 0), show sleepy images
    if (sleepClicks > 0 && currentPet === 'dog') {
      return getSleepyPetImage(sleepClicks);
    }
    
    // Check if Bobo is owned and being displayed
    if (currentPet === 'bobo' && isPetOwned('bobo')) {
      // For Bobo, use pet-specific coin tracking
      const boboCoinsSpent = getPetCoinsSpent('bobo');
      return getBoboImage(boboCoinsSpent);
    }
    
    // Check if Feather is owned and being displayed
    if (currentPet === 'feather' && isPetOwned('feather')) {
      // For Feather, use pet-specific coin tracking
      const featherCoinsSpent = getPetCoinsSpent('feather');
      return getFeatherImage(featherCoinsSpent);
    }
    
    // Calculate coins spent on feeding for current evolution stage (for dog)
    const coinsSpentOnFeeding = getCoinsSpentForCurrentStage(currentStreak);
    
    // Check streak level for different dog evolution tiers
    let currentImage;
    
    if (currentStreak >= 3) {
      // Fully evolved dog versions for users with 3+ day streak
      if (coinsSpentOnFeeding >= 50) {
        currentImage = "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_001902_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      } else if (coinsSpentOnFeeding >= 30) {
        currentImage = "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_001847_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      } else if (coinsSpentOnFeeding >= 10) {
        currentImage = "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_001814_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      } else {
        currentImage = "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_001757_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      }
    } else if (currentStreak >= 2) {
      // Grown dog versions for users with 2+ day streak
      if (coinsSpentOnFeeding >= 50) {
        currentImage = "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_001500_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      } else if (coinsSpentOnFeeding >= 30) {
        currentImage = "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_001443_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      } else if (coinsSpentOnFeeding >= 10) {
        currentImage = "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_001432_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      } else {
        currentImage = "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_001417_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      }
    } else {
      // Original small pup images for users with <2 day streak
      if (coinsSpentOnFeeding >= 50) {
        currentImage = "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160214_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      } else if (coinsSpentOnFeeding >= 30) {
        currentImage = "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_000902_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      } else if (coinsSpentOnFeeding >= 10) {
        currentImage = "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160535_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      } else {
        currentImage = "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160158_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      }
    }
    
    // Check if pet evolved and play sound based on coins spent in current stage
    if (previousCoinsSpentForStage !== coinsSpentOnFeeding) {
      // Play sound when crossing evolution thresholds within current stage
      if ((previousCoinsSpentForStage < 30 && coinsSpentOnFeeding >= 30) || 
          (previousCoinsSpentForStage < 50 && coinsSpentOnFeeding >= 50)) {
        setTimeout(() => playEvolutionSound(), 400); // Delay to sync with animation
      }
      setPreviousCoinsSpentForStage(coinsSpentOnFeeding);
    }
    
    return currentImage;
  };

  const handlePetPurchase = (petType: string, cost: number) => {
    if (!hasEnoughCoins(cost)) {
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
    
    // Special message for Bobo and Feather about arrival time
    if (petType === 'bobo' || petType === 'feather') {
      const petName = petType === 'bobo' ? 'Bobo' : 'Feather';
      alert(`🎉 Congratulations! You bought ${petName}! 🚚 Your new pet will arrive in your pet park within 24 hours!`);
    } else {
      alert(`🎉 Congratulations! You bought a ${petType}!`);
    }
  };

  // Pet store data structure - dynamically updated with current ownership status
  const getPetStoreData = () => {
    // Use storeRefreshTrigger and ownedPets to force re-evaluation when pets are purchased
    const currentOwnedPets = ownedPets; // This ensures we use the latest owned pets from the hook
    storeRefreshTrigger; // This ensures the function re-runs when trigger changes
    
    // Ensure we use the latest pet ownership data
    
    return {
    dog: {
      id: 'dog',
      emoji: '🐶',
      name: 'April',
      owned: true, // Dog is always owned by default
      cost: 0,
      den: {
        id: 'cozy_doghouse',
        name: 'Cozy Doghouse Den',
        emoji: '🏠',
        cost: 50,
        description: 'A warm, comfortable space for April to rest and play'
      },
      accessories: [
        { id: 'chew_toys', name: 'Chew Toys', emoji: '🦴', cost: 10, description: 'Durable toys to keep April entertained', locked: true },
        { id: 'tennis_ball', name: 'Tennis Ball', emoji: '🥎', cost: 15, description: 'A bouncy ball for fetch games', locked: true },
        { id: 'luxury_bed', name: 'Luxury Dog Bed', emoji: '🛏️', cost: 30, description: 'Premium comfort for the best sleep', locked: true }
      ]
    },
    bobo: {
      id: 'bobo',
      emoji: '🐵',
      name: 'Bobo',
      owned: isPetOwned('bobo'),
      cost: 60,
      den: {
        id: 'jungle_treehouse',
        name: 'Jungle Treehouse Den',
        emoji: '🌳',
        cost: 50,
        description: 'A treetop paradise with swinging vines and banana storage'
      },
      accessories: [
        { id: 'banana_stash', name: 'Banana Stash', emoji: '🍌', cost: 20, description: 'Fresh bananas always within reach' },
        { id: 'vine_swings', name: 'Vine Swings', emoji: '🌿', cost: 25, description: 'Natural swings for acrobatic fun' },
        { id: 'coconut_toys', name: 'Coconut Toys', emoji: '🥥', cost: 15, description: 'Interactive coconut puzzle toys' }
      ]
    },
    feather: {
      id: 'feather',
      emoji: '🦜',
      name: 'Feather',
      owned: isPetOwned('feather'),
      cost: 60,
      den: {
        id: 'sky_nest',
        name: 'Sky Nest Den',
        emoji: '☁️',
        cost: 50,
        description: 'A floating nest among the clouds with endless sky views'
      },
      accessories: [
        { id: 'seed_dispenser', name: 'Seed Dispenser', emoji: '🌱', cost: 20, description: 'Automatic feeder with premium seeds' },
        { id: 'perch_collection', name: 'Perch Collection', emoji: '🪶', cost: 25, description: 'Various perches for different moods' },
        { id: 'mirror_toy', name: 'Mirror Toy', emoji: '🪞', cost: 15, description: 'Interactive mirror for social play' }
      ]
    }
    };
  };

  // ElevenLabs Text-to-Speech function using the proper TTS service
  const speakText = async (text: string) => {
    if (!audioEnabled || text === lastSpokenMessage) return;
    
    try {
      // Stop any currently playing audio
      ttsService.stop();
      
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
    
    // If pet is sleeping, show sleep-related thoughts
    if (sleepClicks > 0) {
      const sleepThoughts = [
        "Zzz... 😴 I'm getting so sleepy... this feels nice...",
        "💤 Yawn... I'm drifting off to dreamland...",
        "😴 So cozy and warm... perfect for a nap...",
        "Zzz... 💭 I'm dreaming of cookies and adventures...",
        "😴 This is the best sleep ever... so peaceful...",
        "💤 Sweet dreams... I feel so relaxed and happy..."
      ];
      
      if (sleepClicks >= 5) {
        const deepSleepThoughts = [
          "💤💤💤 Zzz... completely asleep... dreaming peacefully...",
          "😴 Deep in dreamland... having the most wonderful dreams...",
          "💤 Fully rested... sleeping like a baby...",
          "Zzz... 🌙 In the deepest, most comfortable sleep..."
        ];
        return getRandomThought(deepSleepThoughts);
      } else if (sleepClicks >= 3) {
        const drowsyThoughts = [
          "😴 Getting very drowsy... almost fully asleep...",
          "💤 So sleepy... my eyelids are getting heavy...",
          "Zzz... 😴 Drifting deeper into sleep...",
          "💤 Almost there... feeling so relaxed and sleepy..."
        ];
        return getRandomThought(drowsyThoughts);
      } else {
        return getRandomThought(sleepThoughts);
      }
    }
    
    // Different thoughts for different pets
    if (currentPet === 'bobo' && isPetOwned('bobo')) {
      const boboCoinsSpent = getPetCoinsSpent('bobo');
      
      if (boboCoinsSpent === 0) {
        const hungryThoughts = [
          "Oook ook! 🐵 I'm Bobo! My banana belly is empty... can you feed me some cookies?",
          "Hey there, Callee! 🍌 Bobo here! I'm swinging from hunger... got any treats?",
          "Oook! It's me, your monkey friend Bobo! 🐵 My tummy is rumbling for some cookies!",
          "Hi Callee! Bobo needs some yummy cookies! 🍪 My monkey appetite is huge!",
          "Oook ook! 🐵 Bobo is starving! Can you help your monkey friend with some treats?",
          "Callee! 🍌 Your monkey Bobo is so hungry... cookies would make me do happy flips!"
        ];
        return getRandomThought(hungryThoughts);
      } else if (boboCoinsSpent < 30) {
        const satisfiedThoughts = [
          "Mmm banana-licious! 🍌 More cookies will make this monkey swing with joy!",
          "Oook ook! Those cookies were amazing! 🐵 But Bobo could eat more!",
          "Yum yum! 🍪 These treats are perfect for a growing monkey like me!",
          "Oook! Those cookies hit the spot! 🐵 But my monkey appetite is still growing!",
          "Thank you, Callee! 🥰 Those cookies were perfect, but Bobo is still a little peckish!",
          "Delicious! 🍪 My tail is wagging so fast! More cookies would make me flip with happiness!"
        ];
        return getRandomThought(satisfiedThoughts);
      } else if (boboCoinsSpent < 50) {
        const growingThoughts = [
          "Oook ook! I'm growing stronger! 🐵 Keep feeding me - I'm getting bigger and more agile!",
          "Look at me swing! 💪 I can feel myself getting stronger with each cookie!",
          "Amazing! I'm growing so fast! 🌱 More cookies will help me become the ultimate monkey!",
          "Callee, I feel so energetic! ⚡ These cookies are making me bigger and more acrobatic!",
          "Oook ook! I'm transforming! 🦋 Keep the cookies coming - I'm almost ready for the next stage!",
          "Incredible! My monkey body is changing! 🐵 More cookies will help me reach my full potential!"
        ];
        return getRandomThought(growingThoughts);
      } else {
        const happyThoughts = [
          "Oook ook! 🥳 I feel amazing, Callee! Now... could you get me some monkey friends to play with!",
          "Oook ook! I'm so strong now! 💪 Maybe it's time to find some playmates to swing with?",
          "I feel fantastic! 🌟 All those cookies worked! Now I'm ready for some monkey business with friends!",
          "Amazing! I'm at my best! ✨ Callee, can you help me find some buddies to climb trees with?",
          "Hooray! I'm fully grown! 🎉 Can you help me find some monkey friends to play with?",
          "Perfect! I feel incredible! 🚀 Maybe it's time to find some playmates for jungle adventures?"
        ];
        return getRandomThought(happyThoughts);
      }
    }

    // Feather-specific thoughts based on coins spent
    if (currentPet === 'feather' && isPetOwned('feather')) {
      const featherCoinsSpent = getPetCoinsSpent('feather');
      
      if (featherCoinsSpent === 0) {
        const hungryThoughts = [
          "Chirp chirp! 🦜 I'm Feather! My little bird belly is empty... can you feed me some seeds?",
          "Tweet tweet! 🌟 Feather here! I'm fluttering from hunger... got any treats?",
          "Chirp! It's me, your feathered friend Feather! 🦜 My tummy is chirping for some seeds!",
          "Hi Callee! Feather needs some yummy seeds! 🌱 My bird appetite is huge!",
          "Tweet tweet! 🦜 Feather is starving! Can you help your bird friend with some treats?",
          "Callee! 🌟 Your bird Feather is so hungry... seeds would make me sing beautiful songs!"
        ];
        return getRandomThought(hungryThoughts);
      } else if (featherCoinsSpent < 30) {
        const satisfiedThoughts = [
          "Tweet tweet! 🌱 More seeds will make this bird sing with joy!",
          "Chirp chirp! Those seeds were amazing! 🦜 But Feather could eat more!",
          "Yum yum! 🌾 These treats are perfect for a growing bird like me!",
          "Tweet! Those seeds hit the spot! 🦜 But my bird appetite is still growing!",
          "Thank you, Callee! 🥰 Those seeds were perfect, but Feather is still a little peckish!",
          "Delicious! 🌱 My wings are flapping so fast! More seeds would make me soar with happiness!"
        ];
        return getRandomThought(satisfiedThoughts);
      } else if (featherCoinsSpent < 50) {
        const growingThoughts = [
          "Tweet tweet! I'm growing stronger! 🦜 Keep feeding me - I'm getting bigger and more colorful!",
          "Look at me fly! 💪 I can feel myself getting stronger with each seed!",
          "Amazing! I'm growing so fast! 🌱 More seeds will help me become the ultimate bird!",
          "Callee, I feel so energetic! ⚡ These seeds are making me bigger and more graceful!",
          "Tweet tweet! I'm transforming! 🦋 Keep the seeds coming - I'm almost ready for the next stage!",
          "Incredible! My feathers are changing! 🦜 More seeds will help me reach my full potential!"
        ];
        return getRandomThought(growingThoughts);
      } else {
        const happyThoughts = [
          "Tweet tweet! 🥳 I feel amazing, Callee! Now... could you get me some bird friends to fly with!",
          "Tweet tweet! I'm so strong now! 💪 Maybe it's time to find some playmates to soar with?",
          "I feel fantastic! 🌟 All those seeds worked! Now I'm ready for some aerial adventures with friends!",
          "Amazing! I'm at my best! ✨ Callee, can you help me find some buddies to fly through clouds with?",
          "Hooray! I'm fully grown! 🎉 Can you help me find some bird friends to play with?",
          "Perfect! I feel incredible! 🚀 Maybe it's time to find some playmates for sky adventures?"
        ];
        return getRandomThought(happyThoughts);
      }
    }
    
    // Default dog thoughts
    const coinsSpentOnFeeding = getCoinsSpentForCurrentStage(currentStreak);
    
    // Pet thoughts based on coins spent on feeding
    if (coinsSpentOnFeeding === 0) {
      // No coins spent on feeding yet
      const hungryThoughts = [
        "Hi Callee... I'm April 🐶 and my tummy's rumbling sadly. Could you please feed me some cookies?",
        "Woof... It's me, April! 🐕 I'm so hungry and feeling down... could you spare some cookies for me?",
        "Hey there, Callee... April here 🐶 My belly is making sad noises... feed me, please?",
        "Hi friend... I'm April and I'm starving... 🍪 Do you have any cookies to cheer me up?",
        "Callee... It's your puppy April! 🐶 I haven't eaten yet and I'm feeling so low... can you help me out?",
        "Callee... 🐕 My tummy feels so empty and sad... cookies would really lift my spirits!"
      ];
      return getRandomThought(hungryThoughts);
    } else if (coinsSpentOnFeeding < 30) {
      // 10-20 coins spent on feeding (1-2 feedings)
      const satisfiedThoughts = [
        "Mmm… yummy! 🍪 More cookies will make me wag my tail even faster!",
        "That was delicious! 😋 But I could definitely eat more cookies, Callee!",
        "Nom nom nom! 🍪 These cookies are amazing! Can I have another one?",
        "Woof! Those cookies hit the spot! 🐶 But my appetite is still growing!",
        "Thank you, Callee! 🥰 Those cookies were perfect, but I'm still a little peckish!",
        "Yum yum! 🍪 My tail is wagging so fast! More cookies would make me even happier!"
      ];
      return getRandomThought(satisfiedThoughts);
    } else if (coinsSpentOnFeeding < 50) {
      // 30-40 coins spent on feeding (3-4 feedings)
      const growingThoughts = [
        "Woof woof! I'm growing stronger! 🐶 Keep feeding me - I'm getting bigger!",
        "Look at me go! 💪 I can feel myself getting stronger with each cookie!",
        "Amazing! I'm growing so fast! 🌱 More cookies will help me grow even more!",
        "Callee, I feel so energetic! ⚡ These cookies are making me bigger and stronger!",
        "Wag wag! I'm transforming! 🦋 Keep the cookies coming - I'm almost ready for the next stage!",
        "Incredible! My body is changing! 🐕 More cookies will help me reach my full potential!"
      ];
      return getRandomThought(growingThoughts);
    } else {
      // 50+ coins spent on feeding (5+ feedings)
      const happyThoughts = [
        "Yippee! 🥳 I feel amazing, Callee! Now… could you put me to sleep?",
        "Woof woof! I'm so strong now! 💪 Maybe it's time for a nice nap?",
        "I feel fantastic! 🌟 All those cookies worked! Now I'm ready for some sleep!",
        "Amazing! I'm at my best! ✨ Callee, can you help me get some rest?",
        "Hooray! I'm fully grown! 🎉 Can you help me go to sleep?",
        "Perfect! I feel incredible! 🚀 Maybe it's time for a cozy nap?"
      ];
      return getRandomThought(happyThoughts);
    }
  };

  // Get coins spent for current pet
  const getCurrentPetCoinsSpent = () => {
    if (currentPet === 'dog') {
      return getCoinsSpentForCurrentStage(currentStreak);
    } else {
      return getPetCoinsSpent(currentPet);
    }
  };

  // Get current pet coins spent value
  const currentPetCoinsSpent = getCurrentPetCoinsSpent();

  // Calculate heart fill percentage based on coins and sleep (if sleep is available)
  const getHeartFillPercentage = () => {
    const hasSleepButton = isDenOwned(currentPet);
    
    if (hasSleepButton) {
      // When sleep is available, heart fill requires both coins (50%) and sleep (50%)
      const coinProgress = Math.min(currentPetCoinsSpent / 50, 1); // Max 50 coins = 100% of coin portion
      const sleepProgress = Math.min(sleepClicks / 5, 1); // Max 5 clicks = 100% of sleep portion
      
      // Each contributes 50% to the total heart fill
      const totalProgress = (coinProgress * 0.5) + (sleepProgress * 0.5);
      return Math.min(totalProgress * 100, 100); // Convert to percentage, max 100%
    } else {
      // When sleep is not available, heart fill is based only on coins
      const coinProgress = Math.min(currentPetCoinsSpent / 50, 1);
      return Math.min(coinProgress * 100, 100);
    }
  };

  // Memoize the pet thought so it only changes when the actual state changes
  const currentPetThought = useMemo(() => {
    return getPetThought();
  }, [currentPet, getCoinsSpentForCurrentStage(currentStreak), getPetCoinsSpent(currentPet), sleepClicks]);

  // Handle audio playback when message changes
  useEffect(() => {
    // Stop any currently playing audio when pet state changes
    ttsService.stop();
    
    // Only speak when:
    // 1. Not in pet shop
    // 2. Audio is enabled
    // 3. Message has changed
    if (!showPetShop && audioEnabled && currentPetThought !== lastSpokenMessage) {
      const timer = setTimeout(() => {
        speakText(currentPetThought);
      }, 500); // Small delay for smooth UX
      
      return () => clearTimeout(timer);
    }
  }, [currentPetThought, showPetShop, audioEnabled, lastSpokenMessage]);

  return (
    <div className="min-h-screen flex flex-col" style={{
      backgroundImage: `url('https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250903_181706_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      fontFamily: 'Quicksand, system-ui, sans-serif'
    }}>
      {/* Glass overlay for better contrast */}
      <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]"></div>

      {/* Top UI - Coins and Streak */}
      <div className="absolute top-5 left-1/2 transform -translate-x-1/2 z-20 flex gap-4">
        {/* Coins */}
        <div className="bg-white/20 backdrop-blur-md rounded-xl px-4 py-3 border border-white/30 shadow-lg">
          <div className="flex items-center gap-2 text-white font-bold text-lg drop-shadow-md">
            <span className="text-xl">🪙</span>
            <span>{coins}</span>
          </div>
        </div>
        
        {/* Streak */}
        <div className="bg-white/20 backdrop-blur-md rounded-xl px-4 py-3 border border-white/30 shadow-lg">
          <div className="flex items-center gap-2 text-white font-bold text-lg drop-shadow-md">
            <span className="text-xl">🔥</span>
            <span>{currentStreak}</span>
          </div>
        </div>
      </div>

      {/* Testing Buttons - Development Only */}
      <div className="absolute bottom-5 left-5 z-20 flex flex-col gap-2">
        <button
          onClick={() => setCoins(100)}
          className="bg-transparent hover:bg-white/5 px-2 py-1 rounded text-transparent hover:text-white/20 text-xs transition-all duration-300 opacity-5 hover:opacity-30"
          title="Testing: Refill coins to 100"
        >
          🔄
        </button>
      </div>

      {/* Testing Button - Increase Streak (Development Only) */}
      <div className="absolute bottom-5 right-5 z-20">
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
      </div>

      {/* Top UI - Heart only */}
      <div className="absolute top-5 right-10 z-20">
        {/* Heart that fills with blood */}
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
            {/* Filled heart (blood) */}
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

        {/* Animated hearts moving from pet to main heart */}
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

      {/* Main pet area - moved down slightly */}
      <div className="flex-1 flex flex-col items-center justify-center relative pb-20 px-4 z-10 mt-16">
        {/* Pet Thought Bubble - Only show when pet shop is closed */}
        {!showPetShop && (
          <div className={`relative rounded-3xl p-5 mb-8 border-3 shadow-xl max-w-md w-full mx-4 backdrop-blur-sm ${
            sleepClicks > 0 
              ? 'bg-gradient-to-br from-purple-50 to-indigo-100 border-purple-400 bg-purple-50/90'
              : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-400 bg-white/90'
          }`}>
            {/* Speech bubble tail */}
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

        {/* Pet (Custom Image) */}
        <div className="relative drop-shadow-2xl">
          <img 
            src={getPetImage()}
            alt="Pet"
            className={`object-contain rounded-2xl transition-all duration-700 ease-out hover:scale-105 ${
              sleepClicks > 0 ? 'w-96 h-96 mt-8' : 'w-80 h-80'
            }`}
            style={{
              animation: careLevel * 10 >= 30 && careLevel * 10 < 50 ? 'petGrow 800ms ease-out' : 
                        careLevel * 10 >= 50 ? 'petEvolve 800ms ease-out' : 'none'
            }}
          />
          
          {/* Sleep indicator */}
          {sleepClicks > 0 && (
            <>
              {/* Sleep counter */}
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-bold text-gray-800 shadow-lg">
                😴 {sleepClicks}/5
              </div>
              
              {/* Floating Z's animation */}
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-2xl animate-bounce">
                💤
              </div>
              
              {/* Fully asleep message */}
              {sleepClicks >= 5 && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-400 to-purple-500 text-white px-4 py-2 rounded-xl font-bold shadow-lg">
                  😴 Fully Asleep
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Food bowl */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-20 text-5xl drop-shadow-lg">
          🥣
        </div>
      </div>

      {/* Dog Evolution Display - Right Side */}
      <div className="absolute right-6 top-1/2 transform -translate-y-1/2 z-10 flex flex-col gap-4">
        {/* Small Pup - Always available */}
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

        {/* Medium Dog - Unlocks at 2 consecutive days */}
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

        {/* Large Dog - Unlocks at 3 consecutive days */}
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

      {/* Bottom Action Buttons */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-30">
        <div className="flex gap-4 px-4 py-2 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 shadow-xl">
        {getActionStates().map((action) => (
          <button
            key={action.id}
            onClick={() => handleActionClick(action.id)}
            className="flex flex-col items-center gap-1 p-3 bg-transparent border-none cursor-pointer rounded-xl min-w-16 transition-all duration-200 hover:bg-white/20 hover:-translate-y-1 active:scale-95"
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
                🪙 10
              </div>
            )}
            
            {/* Free indicator for Sleep action */}
            {action.id === 'sleep' && (
              <div className="text-xs font-semibold text-green-300 drop-shadow-md">
                Free
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
            const petEmoji = petId === 'dog' ? '🐶' : petId === 'bobo' ? '🐵' : petId === 'feather' ? '🦜' : '🐾';
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
                title={`Switch to ${petId === 'dog' ? 'Dog' : petId === 'bobo' ? 'Bobo' : petId === 'feather' ? 'Feather' : petId}`}
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
            {/* Header */}
            <div className="text-center mb-6">
                      <div className="text-6xl mb-4">{selectedPet.emoji}</div>
                      <h2 className="text-3xl font-bold text-gray-800">
                        {selectedPet.name}
              </h2>
            </div>

                    {/* Pet Adoption Section (if not owned) */}
                    {!selectedPet.owned && (
                      <div className="mb-6">
                        {/* Large Pet Display for Unowned Pets */}
                        <div className="text-center mb-4 p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
                          <div className="text-8xl mb-4 animate-bounce">{selectedPet.emoji}</div>
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
                          selectedPet.id === 'dog' 
                            ? 'bg-gradient-to-br from-green-50 to-emerald-100 border-green-300'
                            : 'bg-gradient-to-br from-gray-100 to-gray-200 border-gray-300 opacity-60'
                        }`}>
                          <div className="text-center">
                            <div className={`text-6xl mb-4 ${selectedPet.id !== 'dog' ? 'grayscale' : ''}`}>
                              {selectedPet.den.emoji}
                            </div>
                            <button
                              onClick={() => {
                                if (selectedPet.id === 'dog') {
                                  if (purchaseDen(selectedPet.id, selectedPet.den.cost)) {
                                    playEvolutionSound();
                                    alert(`🎉 You bought the den!`);
                                  } else {
                                    alert(`Not enough coins! You need ${selectedPet.den.cost} coins.`);
                                  }
                                }
                              }}
                              disabled={selectedPet.id !== 'dog' || isDenOwned(selectedPet.id) || !hasEnoughCoins(selectedPet.den.cost)}
                              className={`px-6 py-3 rounded-xl font-bold text-xl transition-all duration-200 ${
                                selectedPet.id !== 'dog'
                                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                                  : isDenOwned(selectedPet.id)
                                  ? 'bg-green-500 text-white cursor-default'
                                  : hasEnoughCoins(selectedPet.den.cost)
                                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:scale-105 shadow-lg'
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
                            >
                              {selectedPet.id !== 'dog'
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
