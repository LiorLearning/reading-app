import React, { useState, useEffect, useMemo, useRef } from 'react';
import { auth } from '@/lib/firebase';
import { deductCoinsOnPurchase } from '@/lib/state-store-api';
import { useNavigate } from 'react-router-dom';
import { useCoins, CoinSystem } from '@/pages/coinSystem';
import { PetProgressStorage } from '@/lib/pet-progress-storage';
import { ttsService } from '@/lib/tts-service';
import { useTTSSpeaking } from '@/hooks/use-tts-speaking';
import { usePetData, PetDataService } from '@/lib/pet-data-service';
import { loadAdventureSummariesHybrid } from '@/lib/firebase-adventure-cache';
import { useAuth } from '@/hooks/use-auth';
import { PetSelectionFlow } from '@/components/PetSelectionFlow';
import { stateStoreReader, stateStoreApi } from '@/lib/state-store-api';
import PetNamingModal from '@/components/PetNamingModal';
//
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { GraduationCap, ChevronDown, ChevronUp, LogOut, ShoppingCart, MoreHorizontal, TrendingUp, Clock } from 'lucide-react';
import { playClickSound } from '@/lib/sounds';
import { sampleMCQData } from '../data/mcq-questions';
import { loadUserProgress, saveTopicPreference, loadTopicPreference, saveGradeSelection, getNextTopicByPreference } from '@/lib/utils';
import EvolutionStrip from '@/components/adventure/EvolutionStrip';
import { ensureMicPermission } from '@/lib/mic-permission';
import { toast } from 'sonner';


type Props = {
  onStartAdventure?: (
    topicId: string, 
    mode: 'new' | 'continue', 
    adventureType?: string,
      continuationContext?: {
        adventureId: string;
        chatHistory?: any[];
        adventureName?: string;
        comicPanels?: any[];
        cachedImages?: any[];
      }
  ) => void;
  onContinueSpecificAdventure?: (adventureId: string) => void;
};

type ActionStatus = 'happy' | 'sad' | 'neutral' | 'disabled' | 'no-emoji';

interface ActionButton {
  id: string;
  icon: string;
  status: ActionStatus;
  label: string;
}

export function PetPage({ onStartAdventure, onContinueSpecificAdventure }: Props): JSX.Element {
  // Navigation hook
  const navigate = useNavigate();
  
  // Use shared coin system
  const { coins, spendCoins, hasEnoughCoins, canSpendForFeeding, setCoins } = useCoins();
  
  // Get Firebase authenticated user for adventure loading and user data for personalized pet thoughts
  const { user, userData, signOut, loading, updateUserData } = useAuth();
  
  // Use shared pet data system
  const { careLevel, ownedPets, audioEnabled, setCareLevel, addOwnedPet, setAudioEnabled, isPetOwned, getCoinsSpentForCurrentStage, getPetCoinsSpent, addPetCoinsSpent, incrementFeedingCount, addAdventureCoins, setSleepCompleted, getCumulativeCarePercentage, getCumulativeCareLevel, isSleepAvailable, resetCumulativeCareLevel, migrateToCumulativeCareSystem, checkAndPerform24HourReset, checkAndPerform8HourReset } = usePetData();
  
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
  
  const purchaseDen = async (petType: string, cost: number) => {
    // Use regular coin checking since feeding is now free
    if (!hasEnoughCoins(cost)) return false;
    if (auth.currentUser) {
      try {
        await deductCoinsOnPurchase({ userId: auth.currentUser.uid, amount: cost });
      } catch (err) {
        alert('Could not complete purchase. Please try again.');
        return false;
      }
    }
    spendCoins(cost);
    const newOwnedDens = [...ownedDens, `${petType}_den`];
    setOwnedDens(newOwnedDens);
    localStorage.setItem('owned_dens', JSON.stringify(newOwnedDens));
    return true;
  };
  
  const purchaseAccessory = async (petType: string, accessoryId: string, cost: number) => {
    // Use regular coin checking since feeding is now free
    if (!hasEnoughCoins(cost)) return false;
    if (auth.currentUser) {
      try {
        await deductCoinsOnPurchase({ userId: auth.currentUser.uid, amount: cost });
      } catch (err) {
        alert('Could not complete purchase. Please try again.');
        return false;
      }
    }
    spendCoins(cost);
    const newAccessories = { ...ownedAccessories };
    if (!newAccessories[petType]) newAccessories[petType] = [];
    newAccessories[petType].push(accessoryId);
    setOwnedAccessories(newAccessories);
    localStorage.setItem('owned_accessories', JSON.stringify(newAccessories));
    return true;
  };
  
  // State for which pet is currently being displayed
  const [currentPet, setCurrentPet] = useState(() => {
    try {
      const storedSelected = PetProgressStorage.getCurrentSelectedPet();
      if (storedSelected) {
        // Keep localStorage in sync for avatar consumers on initial render
        localStorage.setItem('current_pet', storedSelected);
        return storedSelected;
      }
      // Fallback to any legacy/local value
      const legacy = localStorage.getItem('current_pet');
      return legacy || 'cat';
    } catch {
      return 'cat';
    }
  });

  // Helper: per-pet sleep localStorage key
  const getSleepKey = (petId: string) => `pet_sleep_data_${petId}`;
  
  // Local state for UI interactions
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [previousCoins, setPreviousCoins] = useState(coins);
  const [previousCoinsSpentForStage, setPreviousCoinsSpentForStage] = useState(0);
  const [showPetShop, setShowPetShop] = useState(false);
  // UI: vertical slider for pet list (show max 5 at once)
  const [petStartIndex, setPetStartIndex] = useState(0);
  const [showMoreOverlay, setShowMoreOverlay] = useState(false);
  const [lastSpokenMessage, setLastSpokenMessage] = useState('');
  
  // Pet store state
  const [storeRefreshTrigger, setStoreRefreshTrigger] = useState(0); // Trigger to refresh store data
  const [purchaseLoadingId, setPurchaseLoadingId] = useState<string | null>(null);
  
  // Pet selection flow state
  const [showPetSelection, setShowPetSelection] = useState(false);
  
  // ADDED FOR HOME PAGE FUNCTIONALITY: Grade selection state
  const [selectedPreference, setSelectedPreference] = useState<'start' | 'middle' | null>(null);
  const [selectedTopicFromPreference, setSelectedTopicFromPreference] = useState<string | null>(null);
  const [selectedGradeFromDropdown, setSelectedGradeFromDropdown] = useState<string | null>(null);
  const [selectedGradeAndLevel, setSelectedGradeAndLevel] = useState<{grade: string, level: 'start' | 'middle'} | null>(null);
  const [isAdventureLoading, setIsAdventureLoading] = useState(false);
  
  // Sleep timer state
  const [sleepTimeRemaining, setSleepTimeRemaining] = useState(0); // in milliseconds
  // Loader for sleeping GIF when switching to a sleeping pet
  const [isSleepingGifLoading, setIsSleepingGifLoading] = useState(false);
  const sleepingGifLoadTokenRef = useRef(0);
  const previousPetForLoaderRef = useRef(currentPet);
  
  // Sleep state management with localStorage persistence (per-pet)
  const [sleepClicks, setSleepClicks] = useState(() => {
    try {
      const stored = localStorage.getItem(getSleepKey(currentPet)) || localStorage.getItem('pet_sleep_data');
      if (stored) {
        const sleepData = JSON.parse(stored);
        const now = Date.now();
        
        // Check if sleep end time has passed (new logic)
        if (sleepData.sleepEndTime && now >= sleepData.sleepEndTime) {
          // Sleep period has ended, reset to 0
          return 0;
        }
        // Use new sleep end time if available
        else if (sleepData.sleepEndTime && now < sleepData.sleepEndTime) {
          return sleepData.clicks || 0;
        }
        // Fallback to old logic for backward compatibility
        else if (sleepData.timestamp && !sleepData.sleepEndTime) {
          const eightHours = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
          if ((now - sleepData.timestamp) < eightHours) {
            return sleepData.clicks || 0;
          }
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

  // Hydrate streak from Firestore-driven auth broadcast and keep it in sync
  useEffect(() => {
    try {
      const s = Number(localStorage.getItem('litkraft_streak') || '0');
      if (!Number.isNaN(s)) setCurrentStreak(s);
    } catch {}
    const onStreakChanged = (e: any) => {
      try {
        const s = Number((e?.detail && e.detail.streak) ?? 0);
        if (!Number.isNaN(s)) setCurrentStreak(s);
      } catch {}
    };
    try { window.addEventListener('streakChanged', onStreakChanged as any); } catch {}
    return () => { try { window.removeEventListener('streakChanged', onStreakChanged as any); } catch {}; };
  }, []);

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
    // One-time migration: clear legacy default ownership of dog for first-time users
    try {
      const hasOwnedInPetData = PetDataService.getOwnedPets().length > 0;
      const anyOwnedInProgress = PetProgressStorage.getAllOwnedPets().length > 0;
      if (!hasOwnedInPetData && !anyOwnedInProgress) {
        const global = PetProgressStorage.getGlobalSettings();
        if (global.currentSelectedPet === 'dog') {
          PetProgressStorage.setCurrentSelectedPet('');
        }
        const dog = PetProgressStorage.getPetProgress('dog', 'dog');
        if (dog.generalData.isOwned) {
          dog.generalData.isOwned = false;
          dog.generalData.isCurrentlySelected = false;
          PetProgressStorage.setPetProgress(dog);
        }
      }
    } catch {}

    // Check for 8-hour reset first (resets to initial sad/hungry state)
    const wasReset = checkAndPerform8HourReset();
    
    // Migrate existing users to cumulative care system
    migrateToCumulativeCareSystem();
    
    // SYNC: Initialize current pet from PetProgressStorage to localStorage for pet-avatar-service
    try {
      const currentSelectedPet = PetProgressStorage.getCurrentSelectedPet();
      if (currentSelectedPet) {
        // Sync to localStorage for pet-avatar-service
        localStorage.setItem('current_pet', currentSelectedPet);
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('currentPetChanged'));
        setCurrentPet(currentSelectedPet);
        
        // Sync to PetDataService if pet is owned in PetProgressStorage
        const petData = PetProgressStorage.getPetProgress(currentSelectedPet);
        if (petData.generalData.isOwned && !isPetOwned(currentSelectedPet)) {
          addOwnedPet(currentSelectedPet);
        }
      }
    } catch (error) {
      console.warn('Failed to sync current pet from PetProgressStorage:', error);
    }
    
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
    
    // Initialize sleep timer if pet is currently sleeping
    if (sleepClicks >= 3) {
      const timeRemaining = getSleepTimeRemaining();
      setSleepTimeRemaining(timeRemaining);
    }
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

  // Show loading overlay when switching to a sleeping pet until sleeping GIF loads
  useEffect(() => {
    // Only consider when current pet changes OR sleep state indicates sleeping
    const petChanged = previousPetForLoaderRef.current !== currentPet;
    previousPetForLoaderRef.current = currentPet;
    const isSleeping = sleepClicks > 0;
    if (!petChanged && !isSleeping) {
      return;
    }

    // Determine if the displayed image is a sleeping GIF for current pet
    const url = getPetImage?.();
    const looksLikeGif = typeof url === 'string' && /sleeping|unscreen\.gif|\.gif/i.test(url);
    if (!isSleeping || !looksLikeGif) {
      setIsSleepingGifLoading(false);
      return;
    }

    // Start loader and preload
    const token = Date.now();
    sleepingGifLoadTokenRef.current = token;

    // Optional small delay before showing overlay to prevent flicker on cached loads
    let showOverlayTimer: any = null;
    let didShowOverlay = false;
    showOverlayTimer = setTimeout(() => {
      // Only show if still the latest token
      if (sleepingGifLoadTokenRef.current === token) {
        setIsSleepingGifLoading(true);
        didShowOverlay = true;
      }
    }, 120);

    const img = new Image();
    img.decoding = 'async';
    img.src = url as string;

    const cleanup = () => {
      if (showOverlayTimer) clearTimeout(showOverlayTimer);
      img.onload = null;
      img.onerror = null;
    };

    if ((img as any).complete && (img as any).naturalWidth > 0) {
      cleanup();
      // If it finished immediately, don't show overlay; but if already visible, keep minimal time
      if (sleepingGifLoadTokenRef.current === token) {
        if (didShowOverlay) {
          setTimeout(() => {
            if (sleepingGifLoadTokenRef.current === token) {
              setIsSleepingGifLoading(false);
            }
          }, 200);
        } else {
          setIsSleepingGifLoading(false);
        }
      }
      return;
    }

    img.onload = () => {
      cleanup();
      if (sleepingGifLoadTokenRef.current !== token) return; // stale
      if (didShowOverlay) {
        setTimeout(() => {
          if (sleepingGifLoadTokenRef.current === token) {
            setIsSleepingGifLoading(false);
          }
        }, 200);
      } else {
        setIsSleepingGifLoading(false);
      }
    };
    img.onerror = () => {
      cleanup();
      if (sleepingGifLoadTokenRef.current !== token) return; // stale
      setIsSleepingGifLoading(false);
    };

    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPet, sleepClicks]);

  // Update action states when pet, sleep state, or adventure coins change
  useEffect(() => {
    setActionStates(getActionStates());
  }, [currentPet, sleepClicks, getCumulativeCareLevel().adventureCoins]);

  // Reset sleep when switching pets (skip on initial mount)
  const hasMountedRef = useRef(false);
  // Layout refs for stage and elements to maintain minimum gap between bubble and pet
  const stageRef = useRef<HTMLDivElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const petRef = useRef<HTMLDivElement | null>(null);
  const [bubbleTopPx, setBubbleTopPx] = useState<number>(24);
  const [evoOffsetPx, setEvoOffsetPx] = useState<number>(72);

  useEffect(() => {
    const MIN_GAP_PX = 16;
    const DEFAULT_TOP_PX = 24;
    const measure = () => {
      const stage = stageRef.current;
      const bubble = bubbleRef.current;
      const pet = petRef.current;
      if (!stage || !bubble || !pet) return;
      const bubbleRect = bubble.getBoundingClientRect();
      const petRect = pet.getBoundingClientRect();
      const gap = petRect.top - bubbleRect.bottom;
      if (isFinite(gap)) {
        const missing = Math.max(0, MIN_GAP_PX - gap);
        const nextTop = Math.max(8, DEFAULT_TOP_PX - missing);
        setBubbleTopPx(nextTop);
      }
      // Position evolution strip just to the right of the pet image
      const halfPetWidth = Math.round(petRect.width / 2);
      const gapRight = 16; // desired gap between pet and strip
      setEvoOffsetPx(halfPetWidth + gapRight);
    };
    // initial and on resize
    setTimeout(measure, 0);
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [sleepClicks, currentPet]);
  useEffect(() => {
    if (hasMountedRef.current) {
      // Load current pet's sleep state from per-pet storage instead of resetting
      try {
        const stored = localStorage.getItem(getSleepKey(currentPet)) || localStorage.getItem('pet_sleep_data');
        if (stored) {
          const d = JSON.parse(stored);
          const now = Date.now();
          if (d.sleepEndTime && now >= d.sleepEndTime) {
            setSleepClicks(0);
          } else if (d.sleepEndTime && now < d.sleepEndTime) {
            setSleepClicks(d.clicks || 0);
          } else if (d.timestamp) {
            const eightHours = 8 * 60 * 60 * 1000;
            setSleepClicks(now - d.timestamp < eightHours ? (d.clicks || 0) : 0);
          } else {
            setSleepClicks(0);
          }
        } else {
          setSleepClicks(0);
        }
      } catch {
        setSleepClicks(0);
      }
    } else {
      hasMountedRef.current = true;
    }
  }, [currentPet]);
  
  // Mirror server sleep window to local UI for the current pet
  useEffect(() => {
    const handler = (e: any) => {
      try {
        const states = (e?.detail as any[]) || [];
        const s = states.find((x: any) => x.pet === currentPet);
        if (s?.sleepStartAt && s?.sleepEndAt) {
          const startMs = (s.sleepStartAt as any).toMillis ? (s.sleepStartAt as any).toMillis() : new Date(s.sleepStartAt as any).getTime();
          const endMs = (s.sleepEndAt as any).toMillis ? (s.sleepEndAt as any).toMillis() : new Date(s.sleepEndAt as any).getTime();
          if (endMs && Date.now() < endMs) {
            updateSleepClicks(3, startMs || Date.now(), endMs);
          }
        }
      } catch {}
    };
    window.addEventListener('dailyQuestsUpdated', handler as any);
    return () => window.removeEventListener('dailyQuestsUpdated', handler as any);
  }, [currentPet]);
  
  // TTS message ID for tracking speaking state
  const petMessageId = 'pet-message';
  const isSpeaking = useTTSSpeaking(petMessageId);
  
  // Check if user needs pet selection flow (only for users who have completed onboarding)
  useEffect(() => {
    const checkPetSelection = async () => {
      // Only proceed if auth loading is complete and user data is available
      if (loading || !userData || !user) return;
      
      // Only show pet selection if user has completed onboarding
      if (!userData.isFirstTime && userData.grade) {
        try {
          // First check local storage for owned pets
          const localOwnedPets = PetProgressStorage.getAllOwnedPets();
          const localPetIds = localOwnedPets.map(pet => pet.petId);
          
          // Also check Firebase userState for owned pets (prefer petnames keys)
          const petNamesMap = await stateStoreReader.getPetNames(user.uid);
          const firebasePetIds = Object.keys(petNamesMap || {});
          
          // If user has pets in either local storage or Firebase, don't show selection
          if (localPetIds.length > 0 || firebasePetIds.length > 0) {
            // User has pets, ensure we have a current selected pet
            const currentSelected = PetProgressStorage.getCurrentSelectedPet();
            if (!currentSelected && (localPetIds.length > 0 || firebasePetIds.length > 0)) {
              // Set the first available pet as current
              const firstPet = localPetIds[0] || firebasePetIds[0];
              if (firstPet) {
                PetProgressStorage.setCurrentSelectedPet(firstPet);
                setCurrentPet(firstPet);
                try {
                  localStorage.setItem('current_pet', firstPet);
                  window.dispatchEvent(new CustomEvent('currentPetChanged'));
                } catch (error) {
                  console.warn('Failed to save current pet to localStorage:', error);
                }
              }
            }
            setShowPetSelection(false);
          } else {
            // No pets found, show pet selection flow
            setShowPetSelection(true);
          }
        } catch (error) {
          console.warn('Error checking pet ownership:', error);
          // Fallback to local check only
          const allOwnedPets = PetProgressStorage.getAllOwnedPets();
          if (allOwnedPets.length === 0) {
            setShowPetSelection(true);
          }
        }
      }
    };
    
    checkPetSelection();
  }, [userData, loading, user]);
  
  // ADDED FOR HOME PAGE FUNCTIONALITY: Grade selection logic
  useEffect(() => {
    if (userData) {
      // Load user progress to check for current topic
      const userProgress = loadUserProgress();
      
      // Load saved preference
      const savedPreference = loadTopicPreference();
      let preferenceLevel: 'start' | 'middle' | null = null;
      
      if (savedPreference && savedPreference.level) {
        preferenceLevel = savedPreference.level;
      } else if (userData.level) {
        // Fallback to userData level if no saved preference
        preferenceLevel = userData.level as 'start' | 'middle';
      }
      
      console.log('Setting selectedPreference to:', preferenceLevel);
      setSelectedPreference(preferenceLevel);
      
      // Initialize the combined grade and level selection for proper highlighting
      if (preferenceLevel && userData?.gradeDisplayName) {
        setSelectedGradeAndLevel({ 
          grade: userData.gradeDisplayName, 
          level: preferenceLevel 
        });
        console.log('Initialized selectedGradeAndLevel:', { grade: userData.gradeDisplayName, level: preferenceLevel });
      }
      
      // First, check if there's a current topic saved from previous selection
      if (userProgress?.currentTopicId) {
        console.log('Loading saved current topic from progress:', userProgress.currentTopicId);
        setSelectedTopicFromPreference(userProgress.currentTopicId);
      } else if (savedPreference) {
        // Preference no longer stores a specific topicId; pick next topic via preference
        const allTopicIds = Object.keys(sampleMCQData.topics);
        const nextByPref = getNextTopicByPreference(allTopicIds, savedPreference.level as 'start' | 'middle', userData.gradeDisplayName);
        if (nextByPref) {
          console.log('Loading topic from level preference:', nextByPref);
          setSelectedTopicFromPreference(nextByPref);
        }
      }
    }
  }, [userData]);
  
  // Pet action states - dynamically updated based on den ownership and sleep state
  const getActionStates = () => {
    const baseActions = [
      // { id: 'water', icon: '', status: 'sad' as ActionStatus, label: '' },
    ];
    
    // Determine current item to display with 8-hour hold behavior (story excluded)
    const sequence = ['house', 'friend', 'dressing-competition', 'who-made-the-pets-sick', 'travel', 'food', 'plant-dreams'];
    const sadType = PetProgressStorage.getCurrentTodoDisplayType(currentPet, sequence, 50);
    
    const statusFor = (type: string): ActionStatus => {
      const done = PetProgressStorage.isAdventureTypeCompleted(currentPet, type, 50);
      if (type === sadType && !done) return 'sad';
      return done ? 'happy' : 'neutral';
    };
    
    // Only show the current sad item in the bottom bar
    baseActions.push({ id: sadType, icon: sadType === 'house' ? '🏠' : sadType === 'friend' ? '👫' : sadType === 'food' ? '🍪' : sadType === 'travel' ? '✈️' : sadType === 'story' ? '📚' : '🌙', status: statusFor(sadType), label: (
      sadType === 'plant-dreams' ? 'Plant Dreams' : sadType.charAt(0).toUpperCase() + sadType.slice(1)
    ) });
    
    // Add sleep button - per-pet gating using hydrated daily quest progress
    // Determine if the CURRENT pet has completed today's daily quest (>= target, default 5)
    let canSleepForCurrentPet = false;
    try {
      const questStatesRaw = typeof window !== 'undefined' ? localStorage.getItem('litkraft_daily_quests_state') : null;
      if (questStatesRaw) {
        const arr = JSON.parse(questStatesRaw) as Array<{ pet: string; progress: number; target?: number }>;
        const item = arr?.find((x) => x.pet === currentPet);
        const target = (item && typeof item.target === 'number' && item.target > 0) ? item.target : 5;
        const prog = Number(item?.progress || 0);
        canSleepForCurrentPet = prog >= target;
      }
    } catch {}

    // Show sad when available but not done, happy when completed; disabled when not available
    let sleepLabel, sleepStatus: ActionStatus;
    if (sleepClicks >= 3) {
      sleepLabel = 'Sleeping';
      sleepStatus = 'happy'; // Pet is fully asleep and happy
    } else if (canSleepForCurrentPet) {
      sleepLabel = sleepClicks === 0 ? 'Sleep' : `Sleep ${sleepClicks}/3`;
      sleepStatus = 'sad'; // Sleep is available for this pet but needs to sleep
    } else {
      sleepLabel = sleepClicks === 0 ? 'Sleep' : `Sleep ${sleepClicks}/3`;
      sleepStatus = 'disabled'; // Sleep not available yet for this pet
    }
    baseActions.push({ id: 'sleep', icon: '😴', status: sleepStatus, label: sleepLabel });
    
    // Add more button
    baseActions.push({ id: 'more', icon: '🐾', status: 'neutral' as ActionStatus, label: 'More' });
    
    // Always add shop button at the end (rightmost)
    baseActions.push({ id: 'shop', icon: '🛒', status: 'no-emoji' as ActionStatus, label: 'Shop' });
    
    return baseActions;
  };

  const [actionStates, setActionStates] = useState<ActionButton[]>(getActionStates());

  // Handle adventure button click
  const handleAdventureClick = async (adventureType: string = 'food') => {
    console.log('🎯 PetPage handleAdventureClick called with adventureType:', adventureType);
    // Prevent multiple clicks by checking if already loading
    if (isAdventureLoading) {
      console.log('🎯 Adventure already loading, skipping');
      return;
    }

    try {
      // Set loading state at the start
      setIsAdventureLoading(true);

      // Adventure is now available immediately
      const cumulativeCare = getCumulativeCareLevel();
      
      // Stop any current audio
      ttsService.stop();
      
      // Play click sound
      playFeedingSound(); // Reuse feeding sound for click
      
      if (!onStartAdventure || !onContinueSpecificAdventure) {
        alert("Adventure functionality is not available right now!");
        return;
      }

      // Check if user is authenticated
      if (!user) {
        console.warn('User not authenticated, starting new adventure');
        onStartAdventure(selectedTopicFromPreference || 'K-F.2', 'new', adventureType);
        return;
      }

      // Import the adventure tracker
      const { PetAdventureTracker } = await import('@/lib/pet-adventure-tracker');
      
      // Check if there's an existing adventure for this pet and adventure type
      const existingAdventure = await PetAdventureTracker.hasExistingAdventure(
        user.uid, 
        currentPet, 
        adventureType
      );

      console.log('🎯 PetPage: Existing adventure check:', existingAdventure);

      if (existingAdventure.exists && existingAdventure.adventureId) {
        // Continue existing adventure with context
        console.log('🔄 PetPage: Continuing existing adventure:', existingAdventure.adventureId);
        console.log('🔄 PetPage: Adventure has', existingAdventure.messageCount, 'messages');
        
        // Use onStartAdventure with 'continue' mode and pass the adventure context
        // This will trigger the AI to generate a "welcome back" message with context
        onStartAdventure(
          existingAdventure.topicId || 'K-F.2', 
          'continue', 
          adventureType,
          {
            adventureId: existingAdventure.adventureId,
            chatHistory: existingAdventure.chatHistory,
            adventureName: existingAdventure.adventureName,
            comicPanels: existingAdventure.comicPanels,
            cachedImages: existingAdventure.cachedImages
          }
        );
        
        // Update activity timestamp
        await PetAdventureTracker.updateAdventureActivity(
          user.uid, 
          currentPet, 
          adventureType
        );
      } else {
        // Start new adventure and track it
        const newAdventureId = crypto.randomUUID();
        const topicId = selectedTopicFromPreference || 'K-F.2';
        
        console.log('🚀 PetPage: Starting new adventure with type:', adventureType, 'ID:', newAdventureId);
        
        // Track the new adventure
        await PetAdventureTracker.startNewAdventure(
          user.uid,
          currentPet,
          adventureType,
          newAdventureId,
          topicId
        );
        
        // Start the new adventure with the pre-generated ID
        onStartAdventure(topicId, 'new', adventureType, {
          adventureId: newAdventureId,
          chatHistory: [],
          adventureName: `New ${adventureType} adventure`
        });
      }
    } catch (error) {
      console.error('Failed to handle adventure click:', error);
      // Fallback to starting a new adventure
      if (onStartAdventure) {
        onStartAdventure(selectedTopicFromPreference || 'K-F.2', 'new', adventureType);
      }
    } finally {
      // Clear loading state when done (or on error)
      setIsAdventureLoading(false);
    }
  };

  const handleProgressTrackingClick = () => {
    playClickSound();
    navigate('/progress');
  };

  const handleActionClick = async (actionId: string) => {
    console.log('🎯 PetPage: handleActionClick called with actionId:', actionId);
    // Handle sleep action
    if (actionId === 'sleep') {
      // If pet is fully asleep (3 clicks), do nothing (timer is always visible)
      if (sleepClicks >= 3) {
        return;
      }
      
      // Check if sleep is available (50 adventure coins since last sleep)
      if (!isSleepAvailable()) {
        const cumulativeCare = getCumulativeCareLevel();
        const coinsSinceLastSleep = cumulativeCare.adventureCoins - cumulativeCare.adventureCoinsAtLastSleep;
        const coinsNeeded = 50 - coinsSinceLastSleep;
        alert(`Sleep is not available yet! You need ${coinsNeeded} more adventure coins. Go on adventures to earn more coins! 🚀`);
        return;
      }
      
      // Increment sleep clicks (max 3) - no den required
      if (sleepClicks < 3) {
        const newSleepClicks = sleepClicks + 1;
        
        // If sleep is completed (3 clicks), start the 8-hour sleep timer
        if (newSleepClicks >= 3) {
          const now = Date.now();
          const eightHours = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
          const sleepEndTime = now + eightHours;
          
          updateSleepClicks(newSleepClicks, now, sleepEndTime);
          setSleepCompleted(true);
          
          // Persist sleep window in Firestore dailyQuests for cross-device sync
          (async () => {
            try {
              const { auth } = await import('@/lib/firebase');
              const { stateStoreApi } = await import('@/lib/state-store-api');
              const user = auth.currentUser;
              const petId = currentPet;
              if (user) {
                await stateStoreApi.startPetSleep({ userId: user.uid, pet: petId, durationMs: eightHours });
              }
            } catch {}
          })();

          // Set initial sleep time remaining
          setSleepTimeRemaining(eightHours);
        } else {
          updateSleepClicks(newSleepClicks);
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

    // Handle food action - starts new adventure (requires mic permission)
    if (actionId === 'food') {
      const granted = await ensureMicPermission();
      if (!granted) {
        toast.error('Enable Mic Access');
        return;
      }
      handleAdventureClick('food');
      return;
    }

    // Handle friend action - starts new friend adventure
    if (actionId === 'friend') {
      console.log('🎯 PetPage: Friend button clicked, calling handleAdventureClick with "friend"');
      const granted = await ensureMicPermission();
      if (!granted) {
        toast.error('Enable Mic Access');
        return;
      }
      handleAdventureClick('friend');
      return;
    }

    // Handle dressing competition action - starts new dressing-competition adventure
    if (actionId === 'dressing-competition') {
      console.log('🎯 PetPage: Dressing Competition clicked, calling handleAdventureClick with "dressing-competition"');
      const granted = await ensureMicPermission();
      if (!granted) {
        toast.error('Enable Mic Access');
        return;
      }
      handleAdventureClick('dressing-competition');
      return;
    }

    // Handle investigation action - starts new sick investigation adventure
    if (actionId === 'who-made-the-pets-sick') {
      console.log('🎯 PetPage: Who Made The Pets Sick clicked, calling handleAdventureClick with "who-made-the-pets-sick"');
      const granted = await ensureMicPermission();
      if (!granted) {
        toast.error('Enable Mic Access');
        return;
      }
      handleAdventureClick('who-made-the-pets-sick');
      return;
    }

    // Handle house action - starts new house adventure
    if (actionId === 'house') {
      console.log('🎯 PetPage: House button clicked, calling handleAdventureClick with "house"');
      const granted = await ensureMicPermission();
      if (!granted) {
        toast.error('Enable Mic Access');
        return;
      }
      handleAdventureClick('house');
      return;
    }

    // Handle travel action - starts new travel adventure
    if (actionId === 'travel') {
      console.log('🎯 PetPage: Travel button clicked, calling handleAdventureClick with "travel"');
      const granted = await ensureMicPermission();
      if (!granted) {
        toast.error('Enable Mic Access');
        return;
      }
      handleAdventureClick('travel');
      return;
    }

    // Handle story action - starts new story adventure
    if (actionId === 'story') {
      console.log('🎯 PetPage: Story button clicked, calling handleAdventureClick with "story"');
      const granted = await ensureMicPermission();
      if (!granted) {
        toast.error('Enable Mic Access');
        return;
      }
      handleAdventureClick('story');
      return;
    }

    // Handle plant dreams action - starts new plant dreams adventure
    if (actionId === 'plant-dreams') {
      console.log('🎯 PetPage: Plant Dreams button clicked, calling handleAdventureClick with "plant-dreams"');
      const granted = await ensureMicPermission();
      if (!granted) {
        toast.error('Enable Mic Access');
        return;
      }
      handleAdventureClick('plant-dreams');
      return;
    }

    // Don't deduct coins for "Shop" action - always open pet shop
    if (actionId === 'shop') {
      // Stop any current audio when opening pet shop
      ttsService.stop();
      setShowPetShop(true);
      return;
    }

    // Handle more action - open overlay with ordered list
    if (actionId === 'more') {
      setShowMoreOverlay(true);
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

  // Save sleep data to localStorage and best-effort sync to Firestore
  const saveSleepData = (clicks: number, sleepStartTime?: number, sleepEndTime?: number) => {
    try {
      const sleepData = {
        clicks: clicks,
        timestamp: Date.now(),
        sleepStartTime: sleepStartTime || 0,
        sleepEndTime: sleepEndTime || 0
      };
      localStorage.setItem(getSleepKey(currentPet), JSON.stringify(sleepData));

      // Firestore sync (non-blocking)
      (async () => {
        try {
          const { auth } = await import('@/lib/firebase');
          const { firebasePetStateService } = await import('@/lib/firebase-pet-state-service');
          const user = auth.currentUser;
          const petId = currentPet;
          if (user && petId) {
            await firebasePetStateService.initPetState(user.uid, petId);
            if (clicks >= 3 && sleepStartTime && sleepEndTime) {
              await firebasePetStateService.setSleepWindow(user.uid, petId, true, sleepEndTime - sleepStartTime);
              await firebasePetStateService.updateCumulativeCare(user.uid, petId, { sleepCompleted: true });
            }
          }
        } catch {}
      })();
    } catch (error) {
      console.warn('Failed to save sleep data:', error);
    }
  };

  // Update sleep clicks and save to localStorage
  const updateSleepClicks = (newClicks: number, sleepStartTime?: number, sleepEndTime?: number) => {
    setSleepClicks(newClicks);
    saveSleepData(newClicks, sleepStartTime, sleepEndTime);
  };

  // Reset sleep when needed (e.g., when switching pets or after full sleep cycle)
  const resetSleep = () => {
    // Determine if server sleep should be cleared based on prior stored window
    let shouldClearServer = false;
    try {
      const stored = localStorage.getItem(getSleepKey(currentPet));
      if (stored) {
        const prev = JSON.parse(stored);
        if (prev?.sleepEndTime && Date.now() >= prev.sleepEndTime) {
          shouldClearServer = true;
        }
      }
    } catch {}

    setSleepClicks(0);
    saveSleepData(0);

    if (!shouldClearServer) return;

    // Clear server-side sleep markers only when sleep window actually ended
    (async () => {
      try {
        const { auth } = await import('@/lib/firebase');
        const { stateStoreApi } = await import('@/lib/state-store-api');
        const user = auth.currentUser;
        const petId = currentPet;
        if (user) {
          await stateStoreApi.clearPetSleep({ userId: user.uid, pet: petId });
        }
      } catch {}
    })();
  };

  // Check if sleep should be reset due to 8-hour timeout
  const checkSleepTimeout = () => {
    try {
      const stored = localStorage.getItem(getSleepKey(currentPet));
      if (stored) {
        const sleepData = JSON.parse(stored);
        const now = Date.now();
        
        let shouldReset = false;
        
        // Check if sleep end time has passed (new logic)
        if (sleepData.sleepEndTime && now >= sleepData.sleepEndTime) {
          shouldReset = true;
        }
        // Fallback to old logic for backward compatibility
        else if (sleepData.timestamp && !sleepData.sleepEndTime) {
          const eightHours = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
          if ((now - sleepData.timestamp) >= eightHours) {
            shouldReset = true;
          }
        }
        
        if (shouldReset) {
          // Reset sleep state
          resetSleep();
          
          // Reset pet to sad and hungry state (feeding count and adventure coins to 0)
          resetCumulativeCareLevel();
          
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
      const stored = localStorage.getItem(getSleepKey(currentPet));
      if (stored) {
        const sleepData = JSON.parse(stored);
        const now = Date.now();
        
        // If pet has 3 sleep clicks and has sleep end time stored
        if (sleepData.clicks >= 3 && sleepData.sleepEndTime) {
          const timeRemaining = sleepData.sleepEndTime - now;
          return Math.max(0, timeRemaining);
        }
        
        // Fallback to old logic for backward compatibility
        if (sleepData.clicks >= 3 && sleepData.timestamp) {
          const eightHours = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
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
      case 'happy': return '✅';
      case 'sad': return '😢';
      case 'neutral': return '😐';
      case 'disabled': return '';
      case 'no-emoji': return '';
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

  // // Get Bobo images based on coins spent
  // const getBoboImage = (coinsSpent: number) => {
  //   if (coinsSpent >= 50) {
  //     return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_011137_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  //   } else if (coinsSpent >= 30) {
  //     return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_011115_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  //   } else if (coinsSpent >= 10) {
  //     return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_011058_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  //   } else {
  //     return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_011043_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  //   }
  // };

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
      dog: {
        1: {
          // Level 1 Dog images - coin-based progression
          coins_0: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160158_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_10: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160535_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_30: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_000902_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_50: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160214_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep1: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_162600_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep2: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_163624_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep3: "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fdog-sleeping.gif?alt=media&token=ffc0469d-0cd0-488e-9672-ac41282b3c26"
        }
      },
      cat: {
        1: {
          // Level 1 Cat images - coin-based progression
          coins_0: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_234430_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_10: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250918_002119_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_30: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_234441_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_50: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250910_000550_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep1: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250911_153821_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep2: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250911_155438_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep3: "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fcat-sleeping.gif?alt=media&token=dd59e26d-3694-433f-a36a-e852ecf4f519"
        }
      },
      hamster: {
        1: {
          // Level 1 Hamster images - coin-based progression
          coins_0: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_162526_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_10: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_162541_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_30: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_163423_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_50: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_162550_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep1: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_163334_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep2: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_164339_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep3: "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fhamster-sleeping.gif?alt=media&token=a3b5cea4-24c2-4336-8c4b-c165c3e0535d"
        }
      },
      dragon: {
        1: {
          // Level 1 Dragon images - coin-based progression
          coins_0: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250928_235231_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_10: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250928_235240_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_30: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250928_235248_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_50: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250928_235258_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep1: "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fdragon-sleeping-unscreen.gif?alt=media&token=1fa04c6a-3099-406e-8806-8ff8fbe48402",
          sleep2: "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fdragon-sleeping-unscreen.gif?alt=media&token=1fa04c6a-3099-406e-8806-8ff8fbe48402",
          sleep3: "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fdragon-sleeping-unscreen.gif?alt=media&token=1fa04c6a-3099-406e-8806-8ff8fbe48402"
        }
      },
      unicorn: {
        1: {
          // Level 1 Unicorn images - coin-based progression
          coins_0: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250929_000219_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_10: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250929_000231_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_30: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250929_000240_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_50: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250929_000250_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep1: "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Funicorn-sleeping-unscreen.gif?alt=media&token=4e329a08-ba34-4e56-bd7a-d6eed5d7d09d",
          sleep2: "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Funicorn-sleeping-unscreen.gif?alt=media&token=4e329a08-ba34-4e56-bd7a-d6eed5d7d09d",
          sleep3: "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Funicorn-sleeping-unscreen.gif?alt=media&token=4e329a08-ba34-4e56-bd7a-d6eed5d7d09d"
        }
      },
      monkey: {
        1: {
          // Level 1 Monkey images - coin-based progression
          coins_0: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_011043_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_10: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_011058_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_30: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_011115_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_50: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_011137_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep1: "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fmonkey-sleeping-unscreen.gif?alt=media&token=f635d423-7204-4477-806f-04b8d8c11f4d",
          sleep2: "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fmonkey-sleeping-unscreen.gif?alt=media&token=f635d423-7204-4477-806f-04b8d8c11f4d",
          sleep3: "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fmonkey-sleeping-unscreen.gif?alt=media&token=f635d423-7204-4477-806f-04b8d8c11f4d"
        }
      },
      parrot: {
        1: {
          // Level 1 Parrot images - coin-based progression
          coins_0: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250908_154712_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_10: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250908_155301_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_30: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250908_154733_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_50: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250908_154758_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep1: "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fparrot-sleeping-unscreen.gif?alt=media&token=8971174c-20b4-46e2-bb64-e9be6f35d3d1",
          sleep2: "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fparrot-sleeping-unscreen.gif?alt=media&token=8971174c-20b4-46e2-bb64-e9be6f35d3d1",
          sleep3: "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fparrot-sleeping-unscreen.gif?alt=media&token=8971174c-20b4-46e2-bb64-e9be6f35d3d1"
        }
      }
    };

    const petLevelImages = petImages[petType as keyof typeof petImages];
    if (!petLevelImages) {
      // Fallback for unknown pets
      return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160158_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
    }

    const levelImages = petLevelImages[level as keyof typeof petLevelImages] || petLevelImages[1];
    return levelImages[careState as keyof typeof levelImages] || levelImages.coins_0;
  };

  // Determine care state based on current pet and progress
  const getCurrentCareState = () => {
    if (sleepClicks > 0) {
      if (sleepClicks >= 3) return 'sleep3';
      if (sleepClicks >= 2) return 'sleep2';
      return 'sleep1';
    }

    // If daily quest is completed for this pet, force happy state regardless of heart emptiness
    try {
      const questStatesRaw = typeof window !== 'undefined' ? localStorage.getItem('litkraft_daily_quests_state') : null;
      if (questStatesRaw) {
        const arr = JSON.parse(questStatesRaw) as Array<{ pet: string; activity: string; progress: number; target?: number; }>
        const item = arr?.find(x => x.pet === currentPet);
        const target = (item && typeof item.target === 'number' && item.target > 0) ? item.target : 5;
        if (item) {
          const prog = Number(item.progress || 0);
          if (prog >= target) {
            return 'coins_50';
          }
          // Map partial progress tiers to mood for immediate feedback outside adventure
          if (prog >= 3) return 'coins_30';
          if (prog >= 1) return 'coins_10';
        }
      }
    } catch {}

    // If 8-hour heart reset has occurred (empty heart) or pet woke up sad, force sad image
    try {
      const petProgress = PetProgressStorage.getPetProgress(currentPet);
      const { heartData, sleepData } = petProgress;
      const isHeartEmpty = heartData.feedingCount === 0 && heartData.adventureCoins === 0 && !heartData.sleepCompleted;
      if (sleepData.willBeSadOnWakeup || isHeartEmpty) {
        return 'coins_0';
      }
    } catch {}

    // Daily coin-based progression (per pet): 0, 10, 30, 50
    const todayCoins = PetProgressStorage.getTodayCoins(currentPet);
    if (todayCoins >= 50) return 'coins_50';
    if (todayCoins >= 30) return 'coins_30';
    if (todayCoins >= 10) return 'coins_10';
    return 'coins_0';
  };

  const getPetImage = () => {
    const currentLevel = getCurrentPetLevel();
    const careState = getCurrentCareState();
    return getLevelBasedPetImage(currentPet, currentLevel, careState);
  };

  // Get cumulative care image for April based on coin progression
  const getCumulativeCareImage = () => {
    // Debug logging
    console.log('🐶 Coin-based Care Debug:', { coins, carePercentage: getCumulativeCarePercentage() });
    
    let currentImage;
    let previousCareStage = 0; // Track previous stage for animation
    
    // Determine current care stage and image based on coins
    if (coins >= 50) {
      // Stage 4: 50+ coins
      currentImage = "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160214_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      previousCareStage = 4;
    } else if (coins >= 30) {
      // Stage 3: 30+ coins
      currentImage = "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_000902_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      previousCareStage = 3;
    } else if (coins >= 10) {
      // Stage 2: 10+ coins
      currentImage = "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160535_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      previousCareStage = 2;
    } else {
      // Stage 1: 0 coins - initial state
      currentImage = "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160158_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
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

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut();
      playClickSound();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Handle pet selection from the first-time flow
  const handlePetSelection = (petId: string, petName: string) => {
    // Set pet ownership and name in PetProgressStorage
    PetProgressStorage.setPetOwnership(petId, true);
    PetProgressStorage.setPetName(petId, petName);
    
    // Set as current selected pet in PetProgressStorage
    PetProgressStorage.setCurrentSelectedPet(petId);
    setCurrentPet(petId);
    
    // SYNC WITH PetDataService: Add pet to owned pets list
    addOwnedPet(petId);
    
    // SYNC WITH pet-avatar-service: Set current pet in localStorage
    try {
      localStorage.setItem('current_pet', petId);
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('currentPetChanged'));
    } catch (error) {
      console.warn('Failed to save current pet to localStorage:', error);
    }
    
    // Persist pet name to Firestore userStates.petnames without touching counts
    try {
      if (user?.uid) {
        stateStoreApi.setPetName({ userId: user.uid, pet: petId, name: petName });
      }
    } catch {}

    // Hide the selection flow
    setShowPetSelection(false);
    
    // Trigger store refresh to update UI
    setStoreRefreshTrigger(prev => prev + 1);
  };
  
  // ADDED FOR HOME PAGE FUNCTIONALITY: Grade selection handlers
  const handleGradeSelection = React.useCallback((gradeDisplayName: string) => {
    playClickSound();
    setSelectedGradeFromDropdown(gradeDisplayName);
  }, []);

  const handlePreferenceSelection = React.useCallback(async (level: 'start' | 'middle', gradeDisplayName?: string) => {
    playClickSound();
    
    // Update selected grade if provided
    if (gradeDisplayName) {
      setSelectedGradeFromDropdown(gradeDisplayName);
      // Save grade selection to localStorage for persistence
      saveGradeSelection(gradeDisplayName);
      // Track the combined grade and level selection for highlighting
      setSelectedGradeAndLevel({ grade: gradeDisplayName, level });
    }
    
    // Persist selection to Firebase (minimal write)
    try {
      const mapDisplayToCode = (name?: string): string => {
        if (!name) return '';
        if (name === 'Kindergarten') return 'gradeK';
        if (name === '1st Grade') return 'grade1';
        if (name === '2nd Grade') return 'grade2';
        // 3rd, 4th and 5th should store as grade3 in Firebase per requirement
        if (name === '3rd Grade' || name === '4th Grade' || name === '5th Grade') return 'grade3';
        return '';
      };
      const gradeCode = mapDisplayToCode(gradeDisplayName || userData?.gradeDisplayName);
      const levelCode = level === 'middle' ? 'mid' : level;
      const levelDisplayName = level === 'middle' ? 'Mid Level' : 'Start Level';
      const gradeName = gradeDisplayName || userData?.gradeDisplayName || '';
      if (gradeCode) {
        await updateUserData({
          grade: gradeCode,
          gradeDisplayName: gradeName,
          level: levelCode,
          levelDisplayName
        });
      }
    } catch (e) {
      console.error('Failed to persist grade/level selection:', e);
    }
    
    // Get all available topic IDs from MCQ data in order
    const allTopicIds = Object.keys(sampleMCQData.topics);
    
    // Save preference and get the specific topic immediately
    const specificTopic = saveTopicPreference(level, allTopicIds, gradeDisplayName);
    
    console.log(`Preference selection - Level: ${level}, Grade: ${gradeDisplayName}, Topic: ${specificTopic}`);
    
    setSelectedPreference(level);
    setSelectedTopicFromPreference(specificTopic);
    
    console.log(`State updated - selectedPreference: ${level}, selectedTopicFromPreference: ${specificTopic}, selectedGrade: ${gradeDisplayName}`);
  }, [updateUserData, userData]);

  const handlePetPurchase = async (petType: string, cost: number) => {
    // Get pet data to check level requirements
    const petStoreData = getPetStoreData();
    const petData = petStoreData[petType];
    
    if (!petData) {
      alert("Pet not found!");
      return;
    }

    // Check level requirement first
    if (petData.isLocked) {
      alert(`🔒 This pet requires Level ${petData.requiredLevel} to unlock! Keep playing adventures to level up!`);
      return;
    }

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
    if (auth.currentUser) {
      try {
        await deductCoinsOnPurchase({ userId: auth.currentUser.uid, amount: cost, clientCoins: coins });
      } catch (err) {
        alert('Could not complete purchase. Please try again.');
        return;
      }
    }
    spendCoins(cost);
    addOwnedPet(petType);
    
    // Switch to the newly purchased pet and persist selection globally
    PetProgressStorage.setCurrentSelectedPet(petType);
    setCurrentPet(petType);
    
    // Sync to localStorage for pet-avatar-service
    try {
      localStorage.setItem('current_pet', petType);
      // Dispatch custom event to notify other components and sync avatar hooks
      window.dispatchEvent(new CustomEvent('currentPetChanged'));
    } catch (error) {
      console.warn('Failed to save current pet to localStorage:', error);
    }
    
    // Play purchase sound (reuse evolution sound for now)
    playEvolutionSound();
    
    // Mark ownership in per-pet storage as well
    PetProgressStorage.setPetOwnership(petType, true);

    // Generic success message, then prompt user to name the pet
    alert('🎉 Congratulations! You bought a new pet!');

    const chosenName = window.prompt('What would you like to name your new pet?', '');
    if (chosenName && chosenName.trim()) {
      PetProgressStorage.setPetName(petType, chosenName.trim());
      try {
        if (user?.uid) {
          stateStoreApi.setPetName({ userId: user.uid, pet: petType, name: chosenName.trim() });
        }
      } catch {}
    }
  };

  // Pet store data structure - dynamically updated with current ownership status
  const getPetStoreData = () => {
    // Use storeRefreshTrigger and ownedPets to force re-evaluation when pets are purchased
    const currentOwnedPets = ownedPets; // This ensures we use the latest owned pets from the hook
    storeRefreshTrigger; // This ensures the function re-runs when trigger changes
    
    // Get USER level (cumulative coins) for unlock requirements in shop
    const { currentLevel: userLevel } = getUserLevelInfo();
    
    return {
      dog: {
        id: 'dog',
        emoji: '🐶',
        name: 'Buddy',
        owned: isPetOwned('dog'),
        cost: 150,
        requiredLevel: 2,
        isLocked: userLevel < 2,
        category: 'common'
      },
      cat: {
        id: 'cat',
        emoji: '🐱',
        name: 'Whiskers',
        owned: isPetOwned('cat'),
        cost: 150,
        requiredLevel: 2,
        isLocked: userLevel < 2,
        category: 'common'
      },
      hamster: {
        id: 'hamster',
        emoji: '🐹',
        name: 'Peanut',
        owned: isPetOwned('hamster'),
        cost: 150,
        requiredLevel: 2,
        isLocked: userLevel < 2,
        category: 'common'
      },
      monkey: {
        id: 'monkey',
        emoji: '🐵',
        name: 'Chipper',
        owned: isPetOwned('monkey'),
        cost: 300,
        requiredLevel: 5,
        isLocked: userLevel < 5,
        category: 'uncommon'
      },
      parrot: {
        id: 'parrot',
        emoji: '🦜',
        name: 'Rio',
        owned: isPetOwned('parrot'),
        cost: 300,
        requiredLevel: 5,
        isLocked: userLevel < 5,
        category: 'uncommon'
      },
      dragon: {
        id: 'dragon',
        emoji: '🐉',
        name: 'Ember',
        owned: isPetOwned('dragon'),
        cost: 500,
        requiredLevel: 10,
        isLocked: userLevel < 10,
        category: 'rare'
      },
      unicorn: {
        id: 'unicorn',
        emoji: '🦄',
        name: 'Stardust',
        owned: isPetOwned('unicorn'),
        cost: 500,
        requiredLevel: 10,
        isLocked: userLevel < 10,
        category: 'rare'
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
        messageId: petMessageId
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
    const { feedingCount, adventureCoins, sleepCompleted } = cumulativeCare;
    
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
    
    // All pets now use the generalized cumulative care system below

    // Strict Daily Quest gating (Firestore-hydrated via localStorage):
    // - If today's quest for current pet has progress < target: show ONLY the quest message
    // - If progress >= target: show ONLY sleep-ready messages
    try {
      const questStatesRaw = typeof window !== 'undefined' ? localStorage.getItem('litkraft_daily_quests_state') : null;
      if (questStatesRaw) {
        const arr = JSON.parse(questStatesRaw) as Array<{ pet: string; activity: string; progress: number; target?: number; }>;
        const s = arr.find(x => x.pet === currentPet);
        if (s) {
          const target = Number((s as any).target ?? 5);
          const prog = Number(s.progress || 0);
          if (prog < target) {
            const activity = s.activity;
            const byTypeStrict: Record<string, string[]> = {
              house: [
                `I'm feeling a bit sad in this empty space, ${userName}... 😢 Let's build our dream house together! 🏠 What kind of rooms should we create?`,
                `This bare room makes me sad... 🥺 But I can't wait to design our perfect home with you! 🏡 Where should we put the furniture?`, 
                `Everything feels so empty and cold right now... 😔 But we can make it cozy together! 🛋️ Which room should we work on first?`
              ],
              travel: [
                `I'm tired of being stuck inside, ${userName}! ✈️ Want to go explore somewhere new?`,
                `I'm bored and need a change of scenery! 🌍 Can we go travel together?`,
                `I really want to get out and do something fun! 🚀 Where should we go today?`
              ],
              friend: [
                `I miss warm hugs and giggles! 👫 Can we visit a friend?`,
                `My heart wants company today, ${userName} 💞 Let's go say hi to a friend!`,
                `I want to share treats and stories! 🐾 Friend time?`
              ],
              'dressing-competition': [
                `It’s dress-up time, ${userName}! 👗 I’m excited! What should I wear—maybe a crown… or something else?`,
                `I want to look amazing today! ✨ What should I wear—maybe a bow… or something else?`,
                `Help me pick my look! 😻 What should I wear—maybe a cape… or something else?`
              ],
              'who-made-the-pets-sick': [
                `I’m worried, ${userName}… so many pets feel sick. What should we check first—maybe the fountain… or something else?`,
                `My best friend is weak today. 😢 How should we investigate?`,
                `Something’s wrong in the pet kingdom! 🐾 What should we investigate—maybe the food… or something else?`
              ],
              food: [
                `My tummy feels tiny and grumbly, ${userName}… 🍪 A loving snack please?`,
                `I'm craving your yummy kindness! 🍩 Could we share a treat?`,
                `My heart and belly need a cuddle—maybe a cookie? 🍪`
              ],
              'plant-dreams': [
                `Hold my paw and plant a gentle dream with me 🌙✨`,
                `I feel sparkly inside! 🌟 Shall we grow peaceful, cozy dreams?`,
                `Let's whisper wishes and plant them into the night 🌙`
              ],
              story: [
                `Let's curl up with a story, ${userName}! 📖 Which tale should we read?`,
                `Story time! 🌟 I’m ready for an epic adventure in words!`,
                `Can we read together now? 📚 I love when you narrate!`
              ]
            };
            const choices = byTypeStrict[activity] || [];
            if (choices.length > 0) return getRandomThought(choices);
          } else {
            const sleepReadyThoughts = [
              `Wow! We've had magical adventures, ${userName}! 🌟 Now I'm getting sleepy... 😴`,
              `What an incredible journey we've had! 🚀 I'm wonderfully tired now... 💤`,
              `I feel accomplished after our quests! 🏆 My soul yawns with contentment... 😴`,
              `Perfect day together, ${userName}! I'm ready for a cozy nap... 💤`,
              `We did it! ✨ My heart is happy and sleepy now... 😴`
            ];
            return getRandomThought(sleepReadyThoughts);
          }
        }
      }
    } catch {}

    // Priority (fallback only when Firestore state not available): If adventure coins >= 50, show sleepy thoughts
    if (adventureCoins >= 50 && !sleepCompleted) {
      const readyForSleepThoughts = [
        `Wow! We've had magical adventures, ${userName}! 🌟 Now I'm getting sleepy... 😴`,
        `What an incredible journey we've had! 🚀 I'm wonderfully tired now... 💤`,
        `I feel accomplished after our quests! 🏆 My soul yawns with contentment... 😴`,
        `Amazing! Look at all my coins! 🪙 Ready for a cozy nap... 💤`,
        `Perfect! Our adventures filled my soul! ✨ I'm deliciously drowsy now... 😴`,
        `Incredible adventures, beloved ${userName}! 🎯 My eyelids grow heavy... 💤`
      ];
      return getRandomThought(readyForSleepThoughts);
    }

    // Before other generic care-based thoughts, align the thought with the current Daily Quest.
    // Primary source: Firestore `dailyQuests` (hydrated into localStorage by auth listener).
    // Fallback: local PetProgressStorage sequencing so the bubble never goes blank.
    const todoSequence = ['house', 'friend', 'dressing-competition', 'who-made-the-pets-sick', 'travel', 'food', 'plant-dreams', 'story'];
    let activityFromFirestore: string | null = null;
    let doneFromFirestore = false;
    try {
      const questStatesRaw = typeof window !== 'undefined' ? localStorage.getItem('litkraft_daily_quests_state') : null;
      if (questStatesRaw) {
        const arr = JSON.parse(questStatesRaw) as Array<{ pet: string; activity: string; progress: number; target?: number; }>;
        const s = arr.find(x => x.pet === currentPet);
        if (s) {
          activityFromFirestore = s.activity;
          const tgt = Number((s as any).target ?? 5);
          doneFromFirestore = Number(s.progress || 0) >= tgt;
        }
      }
    } catch {}
    const currentTodoType = activityFromFirestore || PetProgressStorage.getCurrentTodoDisplayType(currentPet, todoSequence, 50);
    const isTodoCompleted = doneFromFirestore || PetProgressStorage.isAdventureTypeCompleted(currentPet, currentTodoType, 50);
    if (!isTodoCompleted) {
      const byType: Record<string, string[]> = {
        house: [
          `I'm feeling a bit sad in this empty space, ${userName}... 😢 Let's build our dream house together! 🏠 What kind of rooms should we create?`,
          `This bare room makes me sad... 🥺 But I can't wait to design our perfect home with you! 🏡 Where should we put the furniture?`, 
          `Everything feels so empty and cold right now... 😔 But we can make it cozy together! 🛋️ Which room should we work on first?`
        ],
        travel: [
          `I'm tired of being stuck inside, ${userName}! ✈️ Want to go explore somewhere new?`,
          `I'm bored and need a change of scenery! 🌍 Can we go travel together?`,
          `I really want to get out and do something fun! 🚀 Where should we go today?`
        ],
        friend: [
          `I miss warm hugs and giggles! 👫 Can we visit a friend?`,
          `My heart wants company today, ${userName} 💞 Let's go say hi to a friend!`,
          `I want to share treats and stories! 🐾 Friend time?`
        ],
        'dressing-competition': [
          `It’s dress-up time, ${userName}! 👗 I’m excited! What should I wear—maybe a crown… or something else?`,
          `I want to look amazing today! ✨ What should I wear—maybe a bow… or something else?`,
          `Help me pick my look! 😻 What should I wear—maybe a cape… or something else?`
        ],
        'who-made-the-pets-sick': [
          `I’m worried, ${userName}… so many pets feel sick. What should we check first—maybe the fountain… or something else?`,
          `My best friend is weak today. 😢 How should we investigate?`,
          `Something’s wrong in the pet kingdom! 🐾 What should we investigate—maybe the food… or something else?`
        ],
        food: [
          `My tummy feels tiny and grumbly, ${userName}… 🍪 A loving snack please?`,
          `I'm craving your yummy kindness! 🍩 Could we share a treat?`,
          `My heart and belly need a cuddle—maybe a cookie? 🍪`
        ],
        'plant-dreams': [
          `Hold my paw and plant a gentle dream with me 🌙✨`,
          `I feel sparkly inside! 🌟 Shall we grow peaceful, cozy dreams?`,
          `Let's whisper wishes and plant them into the night 🌙`
        ],
        story: [
          `Let's curl up with a story, ${userName}! 📖 Which tale should we read?`,
          `Story time! 🌟 I’m ready for an epic adventure in words!`,
          `Can we read together now? 📚 I love when you narrate!`
        ]
      };
      const choices = byType[currentTodoType] || [];
      if (choices.length > 0) {
        return getRandomThought(choices);
      }
    }

    // Default pet thoughts based on cumulative care level (for pets without specific thoughts)
    
    // Pet thoughts based on cumulative care progress
    if (feedingCount === 0) {
      // No feeding yet - initial state (sad and hungry)
      const hungryThoughts = [
        `Hi ${userName}... my tummy's rumbling! Could you share some treats with me? 🍪`,
        `I'm so hungry, ${userName}... my stomach keeps growling! Could you spare some treats? 😋`,
        `Hey ${userName}... My belly is making noises... please feed me soon? 🥺`,
        `Hi friend... I'm absolutely starving! 🍪 Do you have any treats?`,
        `${userName}... I haven't eaten and my stomach won't stop growling... help? 🍽️`,
        `${userName}... My tummy feels so empty... treats would make me so happy! ✨`
      ];
      return getRandomThought(hungryThoughts);
    } else if (feedingCount === 1) {
      // After 1 cookie - still hungry but hopeful
      const stillHungryThoughts = [
        `Mmm… that was delicious, ${userName}! 🍪 I'd love another treat!`,
        `Thank you for that tasty treat, ${userName}! 😋 I'm still a bit hungry!`,
        `That treat was wonderful! Another one would make this day perfect!`,
        `That was so good! 🥰 I'm still feeling peckish... one more?`,
        `Yum! 🍪 That was delicious, but I think I have room for more!`
      ];
      return getRandomThought(stillHungryThoughts);
    } else if (feedingCount >= 1 && adventureCoins === 0) {
      // After 1 feeding - full and wants adventure
      const fullAndAdventurousThoughts = [
        `🥳 I'm bursting with energy now! Can we go on an adventure together?`,
        `Thank you, ${userName}! 😋 My heart sings with joy! Can we start an adventure? 🚀`,
        `I feel absolutely radiant! Those treats were perfect! Can you take me on an adventure? ✨`,
        `Hooray! My tummy is happy and I'm ready for an adventure! Let's go! 🎉`,
        `Perfect! My heart is full and I can't wait to start our adventure! 💖`,
        `Yippee! Those treats gave me energy! Can we please go on an adventure now? 🚀`
      ];
      return getRandomThought(fullAndAdventurousThoughts);
    } else if (feedingCount >= 1 && adventureCoins > 0 && adventureCoins < 100) {
      // Special case: User has some adventure coins but not enough for sleep (less than 100)
      const needMoreAdventureThoughts = [
        `Oh ${userName}, I'm feeling restless... 😴 Let's continue our adventures?`,
        `${userName}, I'm drowsy but not ready to sleep... 🌙 More adventures?`,
        `${userName}, I'm sleepy but my heart wants more! 🚀 Let's explore?`,
        `Sweet ${userName}, I'm tired but crave adventure! ⭐ More exploring?`,
        `${userName}, my eyelids are heavy but my heart wants to play! 🎯`,
        `Oh ${userName}, I'm wonderfully drowsy... 💫 More magical adventures first?`
      ];
      return getRandomThought(needMoreAdventureThoughts);
    } else if (adventureCoins < 50) {
      // After adventure started but less than 50 coins
      const adventuringThoughts = [
        `These adventures fill my soul with magic, ${userName}! 🚀 My heart overflows!`,
        `I love exploring with you, ${userName}! 🌟 Every adventure makes me dance!`,
        `Adventure time is beautiful! ⚡ My heart grows confident with each moment!`,
        `These quests are enchanting, dear ${userName}! 🎯 My soul bursts with joy!`,
        `Exploring with you is bliss! 🗺️ Each adventure fills my heart! ✨`
      ];
      return getRandomThought(adventuringThoughts);
    } else if (!sleepCompleted) {
      // This case is now handled by the 50+ coins check at the top
      // Fallback for any edge cases
      const experiencedAdventurerThoughts = [
        `Wow! So many precious coins from our adventures, ${userName}! 🪙 My heart sings!`,
        `Look what we've accomplished together, ${userName}! 🌟 My soul feels strong!`,
        `I'm becoming a legendary adventurer! ⚡ These quests fill my heart!`,
        `Amazing! I've collected beautiful treasures! 💎 Our adventures are perfect!`,
        `I feel accomplished and blessed! 🏆 Every adventure makes me grateful! ✨`
      ];
      return getRandomThought(experiencedAdventurerThoughts);
    } else {
      // Sleep completed - 100% care level
      const fullyLovedThoughts = [
        `💖 I feel completely loved and cared for! My heart overflows with bliss! 🥰`,
        `🌟 My heart is full and radiating love! You've done everything perfectly! ✨`,
        `😴💕 I'm the happiest pet in the universe! You've taken divine care! 🎉`,
        `🥰 I feel cherished! Fed, adventured, and well-rested! You're the best! 💖`,
        `✨ Perfect care! My heart overflows with love and eternal gratitude! 🌈💕`
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

  // User-wise level info based on cumulative coins across all pets
  const getUserLevelInfo = () => {
    const totalCoins = getCumulativeCoinsEarned() || 0;
    const coinsForLevel = (n: number): number => {
      if (n === 1) return 0;
      if (n === 2) return 50;
      if (n === 3) return 120;
      if (n === 4) return 200;
      return 200 + 150 * (n - 4);
    };
    let currentLevel = 1;
    for (let n = 2; n <= 50; n++) {
      if (totalCoins >= coinsForLevel(n)) currentLevel = n; else break;
    }
    const currentThreshold = coinsForLevel(currentLevel);
    const nextThreshold = coinsForLevel(currentLevel + 1);
    const coinsInCurrentLevel = totalCoins - currentThreshold;
    const coinsNeededForNextLevel = nextThreshold - currentThreshold;
    const progressPercentage = Math.min(100, (coinsInCurrentLevel / coinsNeededForNextLevel) * 100);
    return { currentLevel, coinsInCurrentLevel, coinsNeededForNextLevel, progressPercentage, totalCoins };
  };

  // Pet-wise level calculation using coinsForLevel progression
  const getLevelInfo = () => {
    const coinsForLevel = (n: number): number => {
      if (n === 1) return 0;
      if (n === 2) return 50;
      if (n === 3) return 120;
      if (n === 4) return 200;
      return 200 + 150 * (n - 4);
    };

    const petProgress = PetProgressStorage.getPetProgress(currentPet);
    const totalCoins = petProgress.levelData.totalAdventureCoinsEarned || 0;

    let currentLevel = 1;
    for (let n = 2; n <= 50; n++) {
      if (totalCoins >= coinsForLevel(n)) currentLevel = n; else break;
    }

    const currentThreshold = coinsForLevel(currentLevel);
    const nextThreshold = coinsForLevel(currentLevel + 1);
    const coinsInCurrentLevel = totalCoins - currentThreshold;
    const coinsNeededForNextLevel = nextThreshold - currentThreshold;
    const progressPercentage = Math.min(100, (coinsInCurrentLevel / coinsNeededForNextLevel) * 100);

    return {
      currentLevel,
      coinsInCurrentLevel,
      coinsNeededForNextLevel,
      progressPercentage,
      totalCoins,
    };
  };

  // Live refresh tick for quests/progress to mirror coins auto-updates
  const [questRefreshTick, setQuestRefreshTick] = React.useState(0);

  // Listen for quest/coin/pet events and bump tick to re-render thought and quest UI
  React.useEffect(() => {
    const bump = () => setQuestRefreshTick((t) => t + 1);
    window.addEventListener('dailyQuestsUpdated', bump as EventListener);
    window.addEventListener('coinsChanged', bump as EventListener);
    window.addEventListener('adventureCoinsAdded', bump as EventListener);
    window.addEventListener('petDataChanged', bump as EventListener);
    window.addEventListener('petProgressChanged', bump as EventListener);
    window.addEventListener('currentPetChanged', bump as EventListener);
    window.addEventListener('storage', bump as EventListener);
    return () => {
      window.removeEventListener('dailyQuestsUpdated', bump as EventListener);
      window.removeEventListener('coinsChanged', bump as EventListener);
      window.removeEventListener('adventureCoinsAdded', bump as EventListener);
      window.removeEventListener('petDataChanged', bump as EventListener);
      window.removeEventListener('petProgressChanged', bump as EventListener);
      window.removeEventListener('currentPetChanged', bump as EventListener);
      window.removeEventListener('storage', bump as EventListener);
    };
  }, []);

  // Recompute action buttons (including per-pet sleep gating) live when quests update
  useEffect(() => {
    setActionStates(getActionStates());
  }, [questRefreshTick]);

  // Memoize the pet thought so it only changes when the actual state changes
  // Use stable values to prevent rapid changes when user returns with coins
  const currentPetThought = useMemo(() => {
    return getPetThought();
  }, [
    currentPet, 
    Math.floor(getCoinsSpentForCurrentStage(currentStreak) / 10) * 10, // Round to nearest 10 to reduce sensitivity
    Math.floor(getPetCoinsSpent(currentPet) / 10) * 10, // Round to nearest 10 to reduce sensitivity
    sleepClicks, 
    JSON.stringify(getCumulativeCareLevel()), // Stringify to ensure stable comparison
    questRefreshTick
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
    // 5. NOT during pet selection flow
    if (!showPetShop && audioEnabled && currentPetThought !== lastSpokenMessage && !isSpeaking && !showPetSelection) {
      const timer = setTimeout(() => {
        // Double-check conditions before speaking to prevent race conditions
        if (!showPetShop && audioEnabled && currentPetThought !== lastSpokenMessage && !isSpeaking && !showPetSelection) {
          speakText(currentPetThought);
        }
      }, 800); // Increased delay to prevent rapid-fire thoughts when state changes quickly
      
      return () => clearTimeout(timer);
    }
  }, [currentPetThought, showPetShop, audioEnabled, lastSpokenMessage, isSpeaking, showPetSelection]);

  // Developer tool: advance local time by 8 hours to test sleep/reset (DEV only)
  const advanceTimeBy8Hours = React.useCallback(() => {
    const eightHours = 8 * 60 * 60 * 1000;

    try {
      // Shift pet_sleep_data timestamps backward by 8h (simulates time passing)
      const stored = localStorage.getItem('pet_sleep_data');
      if (stored) {
        const d = JSON.parse(stored);
        const shifted = {
          ...d,
          timestamp: typeof d.timestamp === 'number' ? d.timestamp - eightHours : Date.now() - eightHours,
          sleepStartTime: typeof d.sleepStartTime === 'number' ? Math.max(0, d.sleepStartTime - eightHours) : 0,
          sleepEndTime: typeof d.sleepEndTime === 'number' ? Math.max(0, d.sleepEndTime - eightHours) : 0,
        };
        localStorage.setItem('pet_sleep_data', JSON.stringify(shifted));
      }

      // Force 8h reset eligibility
      const lastReset = localStorage.getItem('pet_last_reset_time');
      if (lastReset) {
        const shifted = (parseInt(lastReset, 10) - eightHours).toString();
        localStorage.setItem('pet_last_reset_time', shifted);
      } else {
        localStorage.setItem('pet_last_reset_time', (Date.now() - eightHours).toString());
      }

      // Push PetProgressStorage timers over thresholds for current pet
      try {
        const petId = PetProgressStorage.getCurrentSelectedPet();
        if (petId) {
          const pd = PetProgressStorage.getPetProgress(petId);
          pd.heartData.nextHeartResetTime = Date.now() - 1;
          if (pd.sleepData.isAsleep) {
            pd.sleepData.sleepEndTime = Date.now() - 1;
          }
          PetProgressStorage.setPetProgress(pd);
        }
      } catch {}

      // Trigger existing checks/updates in this page
      try {
        checkAndPerform8HourReset();
      } catch {}
      try {
        // Local sleep check to update UI immediately
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        checkSleepTimeout();
        setSleepTimeRemaining(0);
      } catch {}
    } catch (e) {
      console.warn('Dev time advance failed:', e);
    }
  }, []);
  
  // Developer tool: advance local time by 24 hours to test daily resets (DEV only)
  const advanceTimeBy24Hours = React.useCallback(() => {
    const twentyFourHours = 24 * 60 * 60 * 1000;

    try {
      // Shift pet_sleep_data timestamps backward by 24h (simulates time passing)
      const stored = localStorage.getItem('pet_sleep_data');
      if (stored) {
        const d = JSON.parse(stored);
        const shifted = {
          ...d,
          timestamp: typeof d.timestamp === 'number' ? d.timestamp - twentyFourHours : Date.now() - twentyFourHours,
          sleepStartTime: typeof d.sleepStartTime === 'number' ? Math.max(0, d.sleepStartTime - twentyFourHours) : 0,
          sleepEndTime: typeof d.sleepEndTime === 'number' ? Math.max(0, d.sleepEndTime - twentyFourHours) : 0,
        };
        localStorage.setItem('pet_sleep_data', JSON.stringify(shifted));
      }

      // Force 24h reset eligibility
      const lastReset = localStorage.getItem('pet_last_reset_time');
      if (lastReset) {
        const shifted = (parseInt(lastReset, 10) - twentyFourHours).toString();
        localStorage.setItem('pet_last_reset_time', shifted);
      } else {
        localStorage.setItem('pet_last_reset_time', (Date.now() - twentyFourHours).toString());
      }

      // Push PetProgressStorage timers over thresholds for current pet
      try {
        const petId = PetProgressStorage.getCurrentSelectedPet();
        if (petId) {
          const pd = PetProgressStorage.getPetProgress(petId);
          pd.heartData.nextHeartResetTime = Date.now() - 1;
          if (pd.sleepData.isAsleep) {
            pd.sleepData.sleepEndTime = Date.now() - 1;
          }
          PetProgressStorage.setPetProgress(pd);
        }
      } catch {}

      // Trigger existing checks/updates in this page
      try {
        checkAndPerform24HourReset();
      } catch {}
      try {
        // Local sleep check to update UI immediately
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        checkSleepTimeout();
        setSleepTimeRemaining(0);
      } catch {}
    } catch (e) {
      console.warn('Dev time advance failed:', e);
    }
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-y-auto overflow-x-hidden" style={{
      backgroundImage: `url('https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250903_181706_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center 50%',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
      fontFamily: 'Quicksand, system-ui, sans-serif'
    }}>
      {/* Invisible dev buttons (top-right) to advance time */}
      {import.meta.env && (import.meta as any).env?.DEV ? (
        <>
          <button
            type="button"
            aria-label="Advance time by 8 hours"
            onClick={advanceTimeBy8Hours}
            style={{ opacity: 0, position: 'absolute', top: 0, right: 0, width: 48, height: 48, zIndex: 50 }}
            tabIndex={-1}
          />
          <button
            type="button"
            aria-label="Advance time by 24 hours"
            onClick={advanceTimeBy24Hours}
            style={{ opacity: 0, position: 'absolute', top: 0, right: 48, width: 48, height: 48, zIndex: 50 }}
            tabIndex={-1}
          />
        </>
      ) : null}
      {/* Pet Selection Flow for first-time users */}
      {showPetSelection && (
        <PetSelectionFlow 
          onPetSelected={handlePetSelection}
        />
      )}
      
      {/* Glass overlay for better contrast */}
      <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]"></div>

      {/* ADDED FOR HOME PAGE FUNCTIONALITY: Grade Selection Button - Top Left */}
      {userData && (
        <div className="absolute top-5 left-5 z-30">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                className={`border-2 ${selectedPreference ? 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700' : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'} text-white rounded-xl px-4 py-3 font-semibold btn-animate flex items-center gap-2 shadow-lg transition-all duration-300`}
                style={{ boxShadow: selectedPreference ? '0 4px 0 #15803d' : '0 4px 0 #1d4ed8' }}
                onClick={() => playClickSound()}
              >
                <GraduationCap className="h-5 w-5" />
                {(() => {
                  const currentGrade = selectedGradeFromDropdown || userData?.gradeDisplayName || 'Grade';
                  const userName = userData?.username || 'User';
                  const gradeLabel = (() => {
                    if (!currentGrade) return 'Grade';
                    if (/^K/i.test(currentGrade)) return 'K';
                    const match = currentGrade.match(/\d+/);
                    return match ? match[0] : currentGrade;
                  })();
                  const buttonText = `${userName}'s Grade: ${gradeLabel}`;
                  return buttonText;
                })()}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              className="w-64 border-2 border-gray-300 bg-white shadow-xl rounded-xl"
              align="start"
            >
              {/* Kindergarten */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === 'K' ? 'bg-blue-100' : ''}`}>
                  <span className="text-lg">🎓</span>
                  <span className="font-semibold">Kindergarten</span>
                  {selectedGradeAndLevel?.grade === 'K' && (
                    <span className="ml-auto text-blue-600 text-sm">✓</span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent 
                  className="w-48 border-2 border-gray-300 bg-white shadow-xl rounded-xl"
                >
                  <DropdownMenuItem 
                    className={`flex items-center gap-2 px-4 py-3 hover:bg-green-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === 'K' && selectedGradeAndLevel?.level === 'start' ? 'bg-green-100' : ''}`}
                    onClick={() => handlePreferenceSelection('start', 'Kindergarten')}
                  >
                    
                    <span className="text-lg">🌱</span>
                    <div>
                      <div className="font-semibold">Start</div>
                      <div className="text-sm text-gray-500">Beginning level</div>
                    </div>
                    {selectedGradeAndLevel?.grade === 'K' && selectedGradeAndLevel?.level === 'start' ? <span className="ml-auto text-green-600">✓</span> : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === 'K' && selectedGradeAndLevel?.level === 'middle' ? 'bg-blue-100' : ''}`}
                    onClick={() => handlePreferenceSelection('middle', 'Kindergarten')}
                  >
                    <span className="text-lg">🚀</span>
                    <div>
                      <div className="font-semibold">Middle</div>
                      <div className="text-sm text-gray-500">Intermediate level</div>
                    </div>
                    {selectedGradeAndLevel?.grade === 'K' && selectedGradeAndLevel?.level === 'middle' ? <span className="ml-auto text-blue-600">✓</span> : null}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* 1st Grade */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '1st' ? 'bg-blue-100' : ''}`}>
                  <span className="text-lg">🎓</span>
                  <span className="font-semibold">1st Grade</span>
                  {selectedGradeAndLevel?.grade === '1st' && (
                    <span className="ml-auto text-blue-600 text-sm">✓</span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent 
                  className="w-48 border-2 border-gray-300 bg-white shadow-xl rounded-xl"
                >
                  <DropdownMenuItem 
                    className={`flex items-center gap-2 px-4 py-3 hover:bg-green-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '1st' && selectedGradeAndLevel?.level === 'start' ? 'bg-green-100' : ''}`}
                    onClick={() => handlePreferenceSelection('start', '1st Grade')}
                  >
                    <span className="text-lg">🌱</span>
                    <div>
                      <div className="font-semibold">Start</div>
                      <div className="text-sm text-gray-500">Beginning level</div>
                    </div>
                    {selectedGradeAndLevel?.grade === '1st' && selectedGradeAndLevel?.level === 'start' ? <span className="ml-auto text-green-600">✓</span> : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '1st' && selectedGradeAndLevel?.level === 'middle' ? 'bg-blue-100' : ''}`}
                    onClick={() => handlePreferenceSelection('middle', '1st Grade')}
                  >
                    <span className="text-lg">🚀</span>
                    <div>
                      <div className="font-semibold">Middle</div>
                      <div className="text-sm text-gray-500">Intermediate level</div>
                    </div>
                    {selectedGradeAndLevel?.grade === '1st' && selectedGradeAndLevel?.level === 'middle' ? <span className="ml-auto text-blue-600">✓</span> : null}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* 2nd Grade */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '2nd' ? 'bg-blue-100' : ''}`}>
                  <span className="text-lg">🎓</span>
                  <span className="font-semibold">2nd Grade</span>
                  {selectedGradeAndLevel?.grade === '2nd' && (
                    <span className="ml-auto text-blue-600 text-sm">✓</span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent 
                  className="w-48 border-2 border-gray-300 bg-white shadow-xl rounded-xl"
                >
                  <DropdownMenuItem 
                    className={`flex items-center gap-2 px-4 py-3 hover:bg-green-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '2nd' && selectedGradeAndLevel?.level === 'start' ? 'bg-green-100' : ''}`}
                    onClick={() => handlePreferenceSelection('start', '2nd Grade')}
                  >
                    <span className="text-lg">🌱</span>
                    <div>
                      <div className="font-semibold">Start</div>
                      <div className="text-sm text-gray-500">Beginning level</div>
                    </div>
                    {selectedGradeAndLevel?.grade === '2nd' && selectedGradeAndLevel?.level === 'start' ? <span className="ml-auto text-green-600">✓</span> : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '2nd' && selectedGradeAndLevel?.level === 'middle' ? 'bg-blue-100' : ''}`}
                    onClick={() => handlePreferenceSelection('middle', '2nd Grade')}
                  >
                    <span className="text-lg">🚀</span>
                    <div>
                      <div className="font-semibold">Middle</div>
                      <div className="text-sm text-gray-500">Intermediate level</div>
                    </div>
                    {selectedGradeAndLevel?.grade === '2nd' && selectedGradeAndLevel?.level === 'middle' ? <span className="ml-auto text-blue-600">✓</span> : null}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* 3rd Grade */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '3rd' ? 'bg-blue-100' : ''}`}>
                  <span className="text-lg">🎓</span>
                  <span className="font-semibold">3rd Grade</span>
                  {selectedGradeAndLevel?.grade === '3rd' && (
                    <span className="ml-auto text-blue-600 text-sm">✓</span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent 
                  className="w-48 border-2 border-gray-300 bg-white shadow-xl rounded-xl"
                >
                  <DropdownMenuItem 
                    className={`flex items-center gap-2 px-4 py-3 hover:bg-green-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '3rd' && selectedGradeAndLevel?.level === 'start' ? 'bg-green-100' : ''}`}
                    onClick={() => handlePreferenceSelection('start', '3rd Grade')}
                  >
                    <span className="text-lg">🌱</span>
                    <div>
                      <div className="font-semibold">Start</div>
                      <div className="text-sm text-gray-500">Beginning level</div>
                    </div>
                    {selectedGradeAndLevel?.grade === '3rd' && selectedGradeAndLevel?.level === 'start' ? <span className="ml-auto text-green-600">✓</span> : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '3rd' && selectedGradeAndLevel?.level === 'middle' ? 'bg-blue-100' : ''}`}
                    onClick={() => handlePreferenceSelection('middle', '3rd Grade')}
                  >
                    <span className="text-lg">🚀</span>
                    <div>
                      <div className="font-semibold">Middle</div>
                      <div className="text-sm text-gray-500">Intermediate level</div>
                    </div>
                    {selectedGradeAndLevel?.grade === '3rd' && selectedGradeAndLevel?.level === 'middle' ? <span className="ml-auto text-blue-600">✓</span> : null}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* 4th Grade */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '4th' ? 'bg-blue-100' : ''}`}>
                  <span className="text-lg">🎓</span>
                  <span className="font-semibold">4th Grade</span>
                  {selectedGradeAndLevel?.grade === '4th' && (
                    <span className="ml-auto text-blue-600 text-sm">✓</span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent 
                  className="w-48 border-2 border-gray-300 bg-white shadow-xl rounded-xl"
                >
                  <DropdownMenuItem 
                    className={`flex items-center gap-2 px-4 py-3 hover:bg-green-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '4th' && selectedGradeAndLevel?.level === 'start' ? 'bg-green-100' : ''}`}
                    onClick={() => handlePreferenceSelection('start', '4th')}
                  >
                    <span className="text-lg">🌱</span>
                    <div>
                      <div className="font-semibold">Start</div>
                      <div className="text-sm text-gray-500">Beginning level</div>
                    </div>
                    {selectedGradeAndLevel?.grade === '4th' && selectedGradeAndLevel?.level === 'start' ? <span className="ml-auto text-green-600">✓</span> : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '4th' && selectedGradeAndLevel?.level === 'middle' ? 'bg-blue-100' : ''}`}
                    onClick={() => handlePreferenceSelection('middle', '4th')}
                  >
                    <span className="text-lg">🚀</span>
                    <div>
                      <div className="font-semibold">Middle</div>
                      <div className="text-sm text-gray-500">Intermediate level</div>
                    </div>
                    {selectedGradeAndLevel?.grade === '4th' && selectedGradeAndLevel?.level === 'middle' ? <span className="ml-auto text-blue-600">✓</span> : null}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* 5th Grade */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '5th' ? 'bg-blue-100' : ''}`}>
                  <span className="text-lg">🎓</span>
                  <span className="font-semibold">5th Grade</span>
                  {selectedGradeAndLevel?.grade === '5th' && (
                    <span className="ml-auto text-blue-600 text-sm">✓</span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent 
                  className="w-48 border-2 border-gray-300 bg-white shadow-xl rounded-xl"
                >
                  <DropdownMenuItem 
                    className={`flex items-center gap-2 px-4 py-3 hover:bg-green-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '5th' && selectedGradeAndLevel?.level === 'start' ? 'bg-green-100' : ''}`}
                    onClick={() => handlePreferenceSelection('start', '5th')}
                  >
                    <span className="text-lg">🌱</span>
                    <div>
                      <div className="font-semibold">Start</div>
                      <div className="text-sm text-gray-500">Beginning level</div>
                    </div>
                    {selectedGradeAndLevel?.grade === '5th' && selectedGradeAndLevel?.level === 'start' ? <span className="ml-auto text-green-600">✓</span> : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedGradeAndLevel?.grade === '5th' && selectedGradeAndLevel?.level === 'middle' ? 'bg-blue-100' : ''}`}
                    onClick={() => handlePreferenceSelection('middle', '5th')}
                  >
                    <span className="text-lg">🚀</span>
                    <div>
                      <div className="font-semibold">Middle</div>
                      <div className="text-sm text-gray-500">Intermediate level</div>
                    </div>
                    {selectedGradeAndLevel?.grade === '5th' && selectedGradeAndLevel?.level === 'middle' ? <span className="ml-auto text-blue-600">✓</span> : null}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              
              {/* View Progress Button */}
              <DropdownMenuItem 
                className="flex items-center gap-2 px-4 py-3 hover:bg-green-50 cursor-pointer rounded-lg"
                onClick={handleProgressTrackingClick}
              >
                <TrendingUp className="h-4 w-4 text-green-600" />
                <div>
                  <div className="font-semibold text-green-600">View Progress</div>
                  <div className="text-sm text-gray-500">Track your spelling journey</div>
                </div>
              </DropdownMenuItem>
              
              {/* Logout Button */}
              <div className="border-t border-gray-200 mt-2 pt-2">
                <DropdownMenuItem 
                  className="flex items-center gap-2 px-4 py-3 hover:bg-red-50 cursor-pointer rounded-lg text-red-600"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  <span className="font-semibold">Log Out</span>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Top UI - Heart Progress Bar (horizontal) - hidden when vertical is enabled */}
      {false && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-30">
          {(() => {
            const levelInfo = getLevelInfo();
            return (
              <div className="bg-white/20 backdrop-blur-md rounded-2xl px-5 py-2.5 border border-white/30 shadow-lg">
                <div className="flex flex-col items-center gap-2">
                  {/* Level indicator above bar */}
                  <div className="text-white font-bold text-base drop-shadow-md">
                    Pet Level {levelInfo.currentLevel}
                  </div>
                  {/* Heart and progress bar container */}
                  <div className="flex items-center gap-3">
                    {/* Heart icon on the left */}
                    <div className="text-white text-2xl drop-shadow-md">❤️</div>
                    {/* Progress bar */}
                    <div className="relative">
                      {/* Progress bar background */}
                      <div className="w-48 h-6 bg-white/30 rounded-full border border-white/40 overflow-hidden">
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
      )}

      {/* Top Right UI - User Level Bar (cumulative coins across pets) */}
      <div className="absolute top-5 right-10 z-30">
        {(() => {
          const levelInfo = getUserLevelInfo();
          return (
            <div className="rounded-xl px-3 py-2 shadow-lg w-56">
              <div className="flex items-center gap-2">
                <div className="text-white font-bold text-lg drop-shadow-md">L{levelInfo.currentLevel}</div>
                <div className="relative h-6 w-full bg-white/30 rounded-full border border-white/40 overflow-hidden flex items-center">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-pink-400 transition-all duration-500 ease-out"
                    style={{ width: `${levelInfo.progressPercentage}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold drop-shadow-md whitespace-nowrap">
                    {Math.round(levelInfo.progressPercentage)}%
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
          className="bg-transparent hover:bg-white/5 px-3 py-1 rounded text-transparent hover:text-white/20 text-xs transition-all duration-300 opacity-5 hover:opacity-30"
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
        
        {/* Testing Button - Advance Time by 24 Hours (Development Only) */}
        <button
          onClick={advanceTimeBy24Hours}
          className="bg-transparent hover:bg-white/5 px-2 py-1 rounded text-transparent hover:text-white/20 text-xs transition-all duration-300 opacity-5 hover:opacity-30"
          title="Testing: Advance time by 24 hours"
        >
          <Clock size={16} />
        </button>
      </div>

      {/* Top Right UI - Streak and Coins (below pet level) */}
      <div className="absolute top-16 right-4 z-20 flex gap-4">
        {/* Streak */}
        <div className="rounded-xl px-4 py-2 shadow-lg w-20">
          <div className="flex items-center gap-2 text-white font-bold text-lg drop-shadow-md">
            <span className="text-xl">🔥</span>
            <span>{currentStreak}</span>
          </div>
        </div>
        
        {/* Coins */}
        <div className="rounded-xl px-30 py-2 shadow-lg w-28">
          <div className="flex items-center gap-2 text-white font-bold text-lg drop-shadow-md">
            <span className="text-xl">🪙 </span>
            <span>{coins}</span>
          </div>
        </div>

        {/* Removed star coins: total coins already shown to the left */}
        
        {/* Daily Heart Fill Indicator - Temporarily commented out */}
        {/* <div className="w-20 h-20 rounded-full flex items-center justify-center relative">
          <div style={{
            position: 'relative',
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* Heart outline */}
            {/* <div style={{
              position: 'absolute',
              fontSize: 84,
              color: '#E5E7EB'
            }}>
              🤍
            </div>
            {/* Filled heart (blood) - based on daily care */}
            {/* <div style={{
              position: 'absolute',
              fontSize: 84,
              color: '#DC2626',
              clipPath: `inset(${Math.max(0, 100 - getHeartFillPercentage())}% 0 0 0)`,
              transition: 'clip-path 500ms ease'
            }}>
              ❤️
            </div>
          </div>
        </div> */}

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

      {/* Main pet area - fixed stage to prevent layout jump */}
      <div className="flex-1 flex flex-col items-center justify-center relative px-8 z-10 mt-12">
        <div ref={stageRef} className="relative w-full flex justify-center items-end overflow-hidden" style={{ minHeight: 'clamp(380px, 45vh, 520px)' }}>
          {/* Thought bubble pinned to top */}
          {!showPetShop && (
            <div ref={bubbleRef} className="absolute left-1/2 -translate-x-1/2 w-full max-w-md px-4" style={{ top: bubbleTopPx }}>
              <div className={`relative rounded-3xl p-5 border-3 shadow-2xl w-full backdrop-blur-md ${
                sleepClicks > 0 
                  ? 'bg-gradient-to-br from-purple-50 to-indigo-100 border-purple-400 bg-purple-50/95'
                  : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-400 bg-white/95'
              }`} style={{ zIndex: 30 }}>
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
                  {sleepClicks >= 3 ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-lg font-bold">Pet will wake up after</div>
                      <div className="text-2xl font-bold text-purple-600">
                        {formatTimeRemaining(sleepTimeRemaining || getSleepTimeRemaining())}
                      </div>
                    </div>
                  ) : (
                    currentPetThought
                  )}
                </div>
              </div>
            </div>
          )}
          {/* Pet pinned to bottom */}
          <div ref={petRef} className="absolute bottom-0 left-1/2 -translate-x-1/2 drop-shadow-2xl">
            {isSleepingGifLoading && (
              <div className="absolute inset-0 z-40 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                <div className="relative z-50 rounded-xl px-4 py-3 bg-white/90 border shadow-lg text-slate-700 text-sm font-medium">
                  Loading...
                </div>
              </div>
            )}
            <img 
              src={getPetImage()}
              alt="Pet"
              className={`object-contain rounded-2xl transition-all duration-700 ease-out hover:scale-105 ${
                sleepClicks > 0 ? 'w-64 h-64 max-h-[280px]' : 'w-60 h-60 max-h-[260px]'
              }`}
              style={{
                animation: getCumulativeCarePercentage() >= 40 && getCumulativeCarePercentage() < 60 ? 'petGrow 800ms ease-out' : 
                          getCumulativeCarePercentage() >= 60 ? 'petEvolve 800ms ease-out' : 'none'
              }}
            />
          </div>
        </div>
      </div>

      {/* Evolution strip next to the pet */}
      <div className="pointer-events-none absolute inset-0">
        <div className="relative w-full h-full">
          <div className="pointer-events-auto absolute left-1/2 top-1/2 z-20 hidden sm:block" style={{ transform: `translate(${evoOffsetPx}px, -80%)` }}>
            {(() => {
              const { currentLevel } = getLevelInfo();
              const levelInfo = getLevelInfo();
              const ringPct = Math.max(0, Math.min(100, Math.round(levelInfo.progressPercentage)));
              return (
                <EvolutionStrip
                  currentLevel={currentLevel}
                  stageLevels={[1, 5, 10]}
                  orientation="vertical"
                  size="sm"
                  petType={currentPet}
                  unlockedImage={getLevelBasedPetImage(currentPet, currentLevel, 'coins_10')}
                  ringProgressPct={ringPct}
                />
              );
            })()}
          </div>
          {/* Mobile placement under pet */}
          <div className="pointer-events-auto absolute bottom-28 left-1/2 -translate-x-1/2 z-20 sm:hidden">
            {(() => {
              const { currentLevel } = getLevelInfo();
              const levelInfo = getLevelInfo();
              const ringPct = Math.max(0, Math.min(100, Math.round(levelInfo.progressPercentage)));
              return (
                <EvolutionStrip currentLevel={currentLevel} stageLevels={[1, 5, 10]} size="sm" ringProgressPct={ringPct} />
              );
            })()}
          </div>
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

      {/* Below-bubble To-Dos: Travel and Sleep */}
      {!showPetShop && (
        <div className="relative z-20 mt-4 flex justify-center pb-24">
          <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 shadow-lg p-3 w-[400px] mb-8">
            {/* Subheader */}
            <div className="mb-2 px-1 text-white/90 font-semibold tracking-wide text-sm">Today</div>
            <div className="mt-1 flex flex-col gap-2">
              {(() => {
                // Prefer Firestore dailyQuests progress (hydrated in auth listener). Fallback to local logic.
                const questStatesRaw = typeof window !== 'undefined' ? localStorage.getItem('litkraft_daily_quests_state') : null;
                let activityFromFirestore: string | null = null;
                let fracFromFirestore: number | null = null;
                try {
                  if (questStatesRaw) {
                    const arr = JSON.parse(questStatesRaw) as Array<{ pet: string; activity: string; progress: number; target: number; }>;
                    const item = arr?.find(x => x.pet === currentPet);
                    if (item && item.target > 0) {
                      activityFromFirestore = item.activity;
                      fracFromFirestore = Math.max(0, Math.min(1, item.progress / item.target));
                    }
                  }
                } catch {}

                // Fallbacks when Firestore hasn't hydrated yet
                const questSequence = ['house', 'friend', 'dressing-competition', 'who-made-the-pets-sick', 'travel', 'food', 'plant-dreams'];
                const currentQuestType = activityFromFirestore || PetProgressStorage.getCurrentTodoDisplayType(currentPet, questSequence, 50);
                const doneLocal = PetProgressStorage.isAdventureTypeCompleted(currentPet, currentQuestType, 50);
                const progress = fracFromFirestore !== null ? fracFromFirestore : (doneLocal ? 1 : 0);
                const done = progress >= 1;
                
                // Get icon and label for the current quest type
                const getQuestIcon = (type: string) => {
                  switch(type) {
                    case 'house': return '🏠';
                    case 'travel': return '✈️';
                    case 'friend': return '👫';
                    case 'who-made-the-pets-sick': return '🕵️';
                    case 'dressing-competition': return '👗';
                    case 'food': return '🍪';
                    case 'plant-dreams': return '🌙';
                    default: return '✨';
                  }
                };
                
                const getQuestLabel = (type: string) => {
                  if (type === 'plant-dreams') return 'Plant Dreams';
                  if (type === 'who-made-the-pets-sick') return 'Who Made The Pets Sick';
                  if (type === 'dressing-competition') return 'Dressing Competition';
                  return type.charAt(0).toUpperCase() + type.slice(1);
                };
                
                const questIcon = getQuestIcon(currentQuestType);
                const questLabel = getQuestLabel(currentQuestType);
                
                return (
                  <div className={`relative flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-300 ${done ? 'bg-gradient-to-r from-green-400/30 to-emerald-400/30 border-green-300/60 shadow-lg shadow-green-400/20' : 'bg-white/10 border-white/20'}`}>
                    {/* Celebration badge for completed */}
                    {done && (
                      <div className="absolute -top-2 -left-2 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg animate-pulse">
                        ⭐
                      </div>
                    )}
                    <div className="w-10 h-10 rounded-xl bg-white/25 flex items-center justify-center text-2xl">{questIcon}</div>
                    <div className="flex-1">
                      <div className={`font-semibold drop-shadow-md ${done ? 'text-green-100 line-through decoration-2 decoration-green-300' : 'text-white'}`}>{questLabel}</div>
                      <div className="mt-0.5 h-2 bg-white/25 rounded-full overflow-hidden w-[260px]">
                        <div className={`h-full transition-all duration-500 ${done ? 'bg-gradient-to-r from-green-400 to-emerald-400 shadow-sm' : 'bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400'}`} style={{ width: `${Math.round(progress * 100)}%` }} />
                      </div>
                    </div>
                    <button aria-label={done ? 'Completed - Click to view' : `Start ${questLabel}`} onClick={() => handleActionClick(currentQuestType)} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${done ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg hover:from-green-600 hover:to-green-700 hover:scale-105' : 'bg-white/90'}`}>
                      {done ? '✓' : '→'}
                    </button>
                  </div>
                );
              })()}
              {(() => {
                const clicks = sleepClicks;
                const asleep = clicks >= 3;
                // Per-pet gating: sleep only available when CURRENT pet's daily quest is done
                let canSleepForCurrentPet = false;
                try {
                  const questStatesRaw = typeof window !== 'undefined' ? localStorage.getItem('litkraft_daily_quests_state') : null;
                  if (questStatesRaw) {
                    const arr = JSON.parse(questStatesRaw) as Array<{ pet: string; progress: number; target?: number }>;
                    const item = arr?.find((x) => x.pet === currentPet);
                    const target = (item && typeof item.target === 'number' && item.target > 0) ? item.target : 5;
                    const prog = Number(item?.progress || 0);
                    canSleepForCurrentPet = prog >= target;
                  }
                } catch {}
                const progress = Math.min(clicks / 3, 1);
                const label = asleep ? 'Sleeping' : 'Sleep';
                const disabled = asleep || (!canSleepForCurrentPet && clicks < 3);
                return (
                  <div className={`relative flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-300 ${asleep ? 'bg-gradient-to-r from-green-400/30 to-emerald-400/30 border-green-300/60 shadow-lg shadow-green-400/20' : 'bg-white/10 border-white/20'}`}>
                    {/* Celebration badge for completed */}
                    {asleep && (
                      <div className="absolute -top-2 -left-2 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg animate-pulse">
                        ⭐
                      </div>
                    )}
                    <div className="w-10 h-10 rounded-xl bg-white/25 flex items-center justify-center text-2xl">😴</div>
                    <div className="flex-1">
                      <div className={`font-semibold drop-shadow-md ${asleep ? 'text-green-100 line-through decoration-2 decoration-green-300' : 'text-white'}`}>{label}</div>
                      <div className="mt-0.5 h-2 bg-white/25 rounded-full overflow-hidden w-[260px]">
                        <div className={`h-full transition-all duration-500 ${asleep ? 'bg-gradient-to-r from-green-400 to-emerald-400 shadow-sm' : 'bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400'}`} style={{ width: `${progress * 100}%` }} />
                      </div>
                    </div>
                    <button aria-label={asleep ? 'Completed - Click to view' : 'Sleep'} onClick={() => handleActionClick('sleep')} disabled={disabled} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${asleep ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg hover:from-green-600 hover:to-green-700 hover:scale-105' : disabled ? 'bg-white/50 opacity-50' : 'bg-white/90'}`}>
                      {asleep ? '✓' : '→'}
                    </button>
                  </div>
                );
              })()}
            </div>
            {/* Footer shortcuts: More and Shop inside the same container */}
            <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-2 gap-2">
              <button
                aria-label="More"
                onClick={() => handleActionClick('more')}
                className="h-11 rounded-xl bg-white/80 text-slate-800 font-semibold flex items-center justify-center gap-2 hover:scale-105 active:scale-95"
              >
                <span className="text-xl">🐾</span>
                <span>More</span>
              </button>
              <button
                aria-label="Shop"
                onClick={() => handleActionClick('shop')}
                className="h-11 rounded-xl bg-white/80 text-slate-800 font-semibold flex items-center justify-center gap-2 hover:scale-105 active:scale-95"
              >
                <span className="text-xl">🛒</span>
                <span>Shop</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Removed bottom action bar; actions are in the to-do container */}

      {/* More Overlay */}
      {showMoreOverlay && (() => {
        // Canonical sequence aligned with backend ACTIVITY_SEQUENCE (story handled separately):
        const coreSeq = ['house','friend','dressing-competition','who-made-the-pets-sick','travel','food','plant-dreams'];
        // Prefer Firestore daily quest assignment (hydrated into localStorage by auth listener)
        let assignedDailyType: string | null = null;
        let assignedDailyDone: boolean = false;
        try {
          const questStatesRaw = typeof window !== 'undefined' ? localStorage.getItem('litkraft_daily_quests_state') : null;
          if (questStatesRaw) {
            const arr = JSON.parse(questStatesRaw) as Array<{ pet: string; activity: string; progress: number; target?: number; }>;
            const s = arr.find(x => x.pet === currentPet);
            if (s && coreSeq.includes(s.activity)) {
              assignedDailyType = s.activity;
              const target = Number(s?.target ?? 0);
              const prog = Number(s?.progress ?? 0);
              assignedDailyDone = target > 0 && prog >= target;
            }
          }
        } catch {}
        // Fallback to local sequencing if Firestore hasn't hydrated
        if (!assignedDailyType) {
          assignedDailyType = PetProgressStorage.getCurrentTodoDisplayType(currentPet, coreSeq, 50);
        }

        // Completion info still used for badges/emojis
        const doneSet = new Set(coreSeq.filter(t => PetProgressStorage.isAdventureTypeCompleted(currentPet, t, 50)));

        // Unlock rules:
        // - Always unlock Story
        // - Unlock today's assigned daily quest
        // - Unlock all activities that come BEFORE today's assigned quest in the canonical order
        // - If today's assigned quest is completed, also unlock the NEXT quest immediately
        const unlocked = new Set<string>(['story']);
        const assignedIndexOriginal = assignedDailyType ? coreSeq.indexOf(assignedDailyType) : -1;
        if (assignedDailyType) {
          unlocked.add(assignedDailyType);
          if (assignedIndexOriginal >= 0) {
            for (let i = 0; i < assignedIndexOriginal; i++) {
              unlocked.add(coreSeq[i]);
            }
            if (assignedDailyDone) {
              const nextIndex = Math.min(coreSeq.length - 1, assignedIndexOriginal + 1);
              unlocked.add(coreSeq[nextIndex]);
            }
          }
        }

        // If today's quest is completed, advance the overlay highlight to the next quest for display
        const assignedDailyTypeForDisplay = (() => {
          if (!assignedDailyType) return assignedDailyType;
          if (!assignedDailyDone) return assignedDailyType;
          const idx = coreSeq.indexOf(assignedDailyType);
          if (idx < 0) return assignedDailyType;
          const nextIndex = Math.min(coreSeq.length - 1, idx + 1);
          return coreSeq[nextIndex];
        })();
        const assignedIndex = assignedDailyTypeForDisplay ? coreSeq.indexOf(assignedDailyTypeForDisplay) : -1;

        // Render order: Daily Quest → Story → remaining
        const remaining = coreSeq.filter(t => t !== assignedDailyTypeForDisplay);
        const renderOrder = assignedDailyTypeForDisplay ? [assignedDailyTypeForDisplay, 'story', ...remaining] : ['story', ...coreSeq];

        const renderRow = (type: string) => {
          const typeIndex = coreSeq.indexOf(type);
          const typeDoneVisual = (
            (assignedIndex > 0 && typeIndex > -1 && typeIndex < assignedIndex) // all activities before today's quest
            || (type === assignedDailyType && assignedDailyDone) // today's quest when completed
            || doneSet.has(type) // persistent completion threshold met
          );
          const isUnlocked = unlocked.has(type);
          const icon = type === 'house' ? '🏠' : type === 'travel' ? '✈️' : type === 'friend' ? '👫' : type === 'dressing-competition' ? '👗' : type === 'who-made-the-pets-sick' ? '🕵️' : type === 'food' ? '🍪' : type === 'story' ? '📚' : '🌙';
          const label = type === 'plant-dreams' ? 'Plant Dreams' : type === 'dressing-competition' ? 'Dressing Competition' : type === 'who-made-the-pets-sick' ? 'Who Made The Pets Sick' : type.charAt(0).toUpperCase() + type.slice(1);
          const statusEmoji = !isUnlocked ? '🔒' : (typeDoneVisual ? '✅' : (type === assignedDailyTypeForDisplay ? '⭐' : '😐'));
          return (
            <button
              key={type}
              className={`flex items-center justify-between p-3 rounded-xl border ${isUnlocked ? 'border-gray-200 hover:bg-gray-50' : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'}`}
              onClick={() => { if (!isUnlocked) return; setShowMoreOverlay(false); handleActionClick(type); }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{icon}</span>
                <span className="font-semibold">{label}</span>
              </div>
              <span className="text-xl">{statusEmoji}</span>
            </button>
          );
        };

        return (
          <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center" onClick={() => setShowMoreOverlay(false)}>
            <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
              {/* Close button */}
              <button
                aria-label="Close"
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 border border-gray-300 text-xl leading-none flex items-center justify-center"
                onClick={() => setShowMoreOverlay(false)}
              >
                ×
              </button>
              <div className="text-xl font-bold mb-4">Do next</div>
              <div className="flex flex-col gap-2">
                {renderOrder.map(renderRow)}
              </div>
            </div>
          </div>
        );
      })()}

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
        <div className="fixed top-24 left-6 z-20 flex flex-col gap-2 items-center">
          <div className="text-md font-semibold text-white drop-shadow-md mb-1">
            Your Pets:
          </div>
          {/* Up arrow for sliding up */}
          {ownedPets.length > 5 && (
            <button
              onClick={() => setPetStartIndex((idx) => Math.max(0, idx - 1))}
              className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-md transition-colors ${
                petStartIndex > 0 ? 'bg-white/30 border-white/50 hover:bg-white/40' : 'bg-white/10 border-white/20 opacity-50 cursor-not-allowed'
              }`}
              aria-label="Scroll up"
              disabled={petStartIndex === 0}
            >
              <ChevronUp className="text-white" />
            </button>
          )}

          {ownedPets.slice(petStartIndex, petStartIndex + 5).map((petId) => {
            const isActive = currentPet === petId;
            const petType = PetProgressStorage.getPetType(petId) || petId;
            const levelForPet = (() => {
              try { return PetProgressStorage.getPetProgress(petId, petType).levelData.currentLevel; } catch { return 1; }
            })();
            const petHasImages = ['dog','cat','hamster','dragon','unicorn','monkey','parrot'].includes(petType);
            const petImageUrl = petHasImages ? getLevelBasedPetImage(petType, levelForPet, 'coins_30') : '';
            const petEmoji = petType === 'cat' ? '🐱' : petType === 'hamster' ? '🐹' : petType === 'dragon' ? '🐉' : petType === 'unicorn' ? '🦄' : petType === 'monkey' ? '🐵' : petType === 'parrot' ? '🦜' : '🐾';

            return (
              <button
                key={petId}
                onClick={() => {
                  setCurrentPet(petId);

                  // SYNC: Update PetProgressStorage current selected pet
                  PetProgressStorage.setCurrentSelectedPet(petId);

                  // Sync to localStorage for pet-avatar-service
                  try {
                    localStorage.setItem('current_pet', petId);
                    // Dispatch custom event to notify other components
                    window.dispatchEvent(new CustomEvent('currentPetChanged'));
                  } catch (error) {
                    console.warn('Failed to save current pet to localStorage:', error);
                  }
                }}
                className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center shadow-lg overflow-hidden transition-all duration-200 hover:scale-110 ${
                  isActive
                    ? 'bg-gradient-to-br from-blue-500 to-purple-600 border-white'
                    : 'bg-white/25 backdrop-blur-md border-white/40 hover:bg-white/35'
                }`}
                title={`Switch to ${PetProgressStorage.getPetDisplayName(petId)}`}
              >
                {petHasImages ? (
                  <img
                    src={petImageUrl}
                    alt={PetProgressStorage.getPetDisplayName(petId)}
                    className="w-full h-full object-contain p-1 drop-shadow-sm"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-3xl text-white">{petEmoji}</span>
                )}
              </button>
            );
          })}
          {/* Down arrow for sliding down */}
          {ownedPets.length > 5 && (
            <button
              onClick={() => setPetStartIndex((idx) => Math.min(Math.max(0, ownedPets.length - 5), idx + 1))}
              className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-md transition-colors ${
                petStartIndex < Math.max(0, ownedPets.length - 5) ? 'bg-white/30 border-white/50 hover:bg-white/40' : 'bg-white/10 border-white/20 opacity-50 cursor-not-allowed'
              }`}
              aria-label="Scroll down"
              disabled={petStartIndex >= Math.max(0, ownedPets.length - 5)}
            >
              <ChevronDown className="text-white" />
            </button>
          )}
        </div>
      )}



      {/* Pet Shop Overlay */}
      {showPetShop && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl max-w-4xl w-11/12 max-h-[85vh] shadow-2xl relative border-2 border-gray-200 flex flex-col">
            {/* Close button */}
            <button
              onClick={() => setShowPetShop(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white border-none cursor-pointer text-lg flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-10"
            >
              ×
            </button>

            {/* Header */}
            <div className="p-6 border-b-2 border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-3xl font-bold text-gray-800">Pet Book</h2>
                {(() => {
                  const data = getPetStoreData();
                  const total = Object.keys(data).length;
                  const owned = Object.values(data).filter((p: any) => p.owned).length;
                  return (
                    <div className="text-gray-600 mt-2 font-medium">{owned} out of {total} pets</div>
                  );
                })()}
              </div>
              <div className="inline-block px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl text-white font-semibold shadow-lg">
                💰 {coins} coins
              </div>
            </div>

            {/* Pet Grid - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {Object.values(getPetStoreData()).map((pet) => (
                  <div
                    key={pet.id}
                    className={`relative p-6 rounded-xl border-2 transition-all duration-200 text-center ${
                      pet.owned
                        ? 'bg-gradient-to-br from-green-50 to-emerald-100 border-green-300'
                        : pet.isLocked
                        ? 'bg-gradient-to-br from-gray-100 to-gray-200 border-gray-300 opacity-75'
                        : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 hover:scale-105'
                    }`}
                  >
                    {/* Owned Badge */}
                    {pet.owned && (
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-lg font-bold shadow-lg">
                        ✓
                      </div>
                    )}
                    
                    {/* Level Lock Badge */}
                    {pet.isLocked && !pet.owned && (
                      <div className="absolute -top-2 -left-2 w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                        L{pet.requiredLevel}
                      </div>
                    )}
                    
                    {/* Category badge (top-right) */}
                    {pet.category && (
                      <div
                        className={`mx-auto mb-3 inline-block px-3 py-1 rounded-full text-xs font-bold border shadow-sm capitalize
                          ${pet.category === 'common' ? 'bg-green-100 text-green-700 border-green-300' : ''}
                          ${pet.category === 'uncommon' ? 'bg-purple-100 text-purple-700 border-purple-300' : ''}
                          ${pet.category === 'rare' ? 'bg-amber-100 text-amber-700 border-amber-300' : ''}
                        `}
                      >
                        {pet.category}
                      </div>
                    )}

                    {/* Required Level Badge - always shows required level */}
                    <div className="absolute -top-2 -left-2 w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                      L{pet.requiredLevel}
                    </div>
                    
                    {/* Pet Image or Emoji */}
                    {pet.isLocked && !pet.owned ? (
                      <div className="mb-4 flex items-center justify-center">
                        {(['dog','cat','hamster','dragon','unicorn','monkey','parrot'] as string[]).includes(pet.id) ? (
                          <img
                            src={getLevelBasedPetImage(pet.id, 1, 'coins_50')}
                            alt={`${pet.name} (locked)`}
                            className="h-24 w-24 object-contain filter grayscale brightness-0 opacity-40"
                            loading="lazy"
                          />
                        ) : (
                          <div className="text-6xl grayscale opacity-40">{pet.emoji}</div>
                        )}
                      </div>
                    ) : (
                      <div className="mb-4 flex items-center justify-center">
                        {(['dog','cat','hamster','dragon','unicorn','monkey','parrot'] as string[]).includes(pet.id) ? (
                          <img
                            src={getLevelBasedPetImage(pet.id, 1, 'coins_50')}
                            alt={pet.name}
                            className="h-24 w-24 object-contain drop-shadow-sm"
                            loading="lazy"
                          />
                        ) : (
                          <div className="text-6xl">{pet.emoji}</div>
                        )}
                      </div>
                    )}
                    
                    {/* Pet Name (user-given name shown after purchase) */}
                    <div className={`text-lg font-semibold mb-3 ${pet.isLocked && !pet.owned ? 'text-gray-500' : 'text-gray-800'}`}>
                      {pet.owned ? PetProgressStorage.getPetDisplayName(pet.id) : ''}
                    </div>
                    
                    {/* Purchase Button or Status */}
                    {pet.owned ? (
                      <div className="px-4 py-2 bg-green-500 text-white rounded-xl font-bold">
                        ✅ Owned
                      </div>
                    ) : pet.isLocked ? (
                      <div className="w-full px-4 py-3 rounded-xl font-bold text-lg bg-gray-400 text-gray-600 cursor-not-allowed">
                        🔒 Level {pet.requiredLevel}
                      </div>
                    ) : (
                      <button
                        onClick={async () => {
                          if (purchaseLoadingId) return;
                          setPurchaseLoadingId(pet.id);
                          try {
                            await handlePetPurchase(pet.id, pet.cost);
                          } finally {
                            setPurchaseLoadingId(null);
                            setStoreRefreshTrigger(prev => prev + 1);
                          }
                        }}
                        disabled={!hasEnoughCoins(pet.cost) || pet.isLocked || purchaseLoadingId === pet.id}
                        aria-busy={purchaseLoadingId === pet.id}
                        className={`w-full px-4 py-3 rounded-xl font-bold text-lg transition-all duration-200 ${
                          hasEnoughCoins(pet.cost)
                            ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:scale-105 shadow-lg disabled:opacity-60 disabled:hover:scale-100'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {purchaseLoadingId === pet.id
                          ? 'Processing...'
                          : hasEnoughCoins(pet.cost)
                            ? `🪙 ${pet.cost}`
                            : `🔒 ${pet.cost}`}
                      </button>
                    )}
                  </div>
                ))}
              </div>
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
