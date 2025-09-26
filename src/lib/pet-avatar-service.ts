import { usePetData } from '@/lib/pet-data-service';
import { PetProgressStorage } from '@/lib/pet-progress-storage';
import { useState, useEffect } from 'react';

// Get Bobo images based on feeding count (since feeding is now free)
const getBoboImage = (feedingCount: number) => {
  if (feedingCount >= 5) {
    return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_011137_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  } else if (feedingCount >= 3) {
    return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_011115_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  } else if (feedingCount >= 1) {
    return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_011058_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  } else {
    return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_011043_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  }
};

// Get Feather images based on feeding count (since feeding is now free)
const getFeatherImage = (feedingCount: number) => {
  if (feedingCount >= 5) {
    return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250908_154758_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  } else if (feedingCount >= 3) {
    return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250908_154733_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  } else if (feedingCount >= 1) {
    return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250908_155301_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  } else {
    return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250908_154712_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  }
};

// Get Hamster images based on feeding count (since feeding is now free)
const getHamsterImage = (feedingCount: number) => {
  if (feedingCount >= 3) {
    return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_162550_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  } else if (feedingCount >= 2) {
    return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_163423_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  } else if (feedingCount >= 1) {
    return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_162541_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  } else {
    return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_162526_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  }
};

// Get sleepy pet images based on sleep clicks (3-click progression with placeholders)
const getSleepyPetImage = (clicks: number, petType: string = 'dog') => {
  if (petType === 'hamster') {
    if (clicks >= 3) {
      // 3 clicks (fully asleep) - Final sleep image for hamster
      return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_165002_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
    } else if (clicks >= 2) {
      // 2 clicks (deep sleep) - Second sleep stage for hamster
      return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_164339_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
    } else if (clicks >= 1) {
      // 1 click (getting sleepy) - First sleep stage for hamster
      return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_163334_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
    } else {
      // 0 clicks (awake) - Should not be called in sleep mode
      return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_162526_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
    }
  }
  
  // Default dog sleep images
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

/**
 * Get cumulative care image for April (dog) based on care progression
 */
const getCumulativeCareImage = (feedingCount: number, adventureCoins: number) => {
  // Determine current care stage and image based on your requirements:
  // Feeding count 0 = initial image
  // Feeding count 1 = image change
  // 50 adventure coins earned = image change
  // 50 adventure coins earned = ready for sleep
  
  if (adventureCoins >= 50) {
    // Stage 3: 50+ adventure coins (ready for sleep)
    return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160214_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  } else if (feedingCount >= 1) {
    // Stage 2: Fed once (first feeding triggers image change)
    return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160535_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  } else {
    // Stage 1: Initial hungry/sad state (feeding count 0)
    return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160158_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  }
};

/**
 * Get the current pet avatar image based on pet type, evolution level, and state
 */
export const getCurrentPetAvatarImage = (
  currentPet: string = 'dog',
  currentStreak: number = 0,
  sleepClicks: number = 0,
  isPetOwned: (petType: string) => boolean,
  getPetCoinsSpent: (petType: string) => number,
  getCoinsSpentForCurrentStage: (streak: number) => number,
  getCumulativeCareLevel?: () => { feedingCount: number; adventureCoins: number; sleepCompleted: boolean; adventureCoinsAtLastSleep: number }
): string => {
  // If pet is in sleep mode (sleepClicks > 0), show sleepy images
  if (sleepClicks > 0 && (currentPet === 'dog' || currentPet === 'hamster')) {
    return getSleepyPetImage(sleepClicks, currentPet);
  }
  
  // Check if Bobo is owned and being displayed
  if (currentPet === 'bobo' && isPetOwned('bobo')) {
    // For Bobo, use unified care system (same as PetPage logic)
    if (getCumulativeCareLevel) {
      const cumulativeCare = getCumulativeCareLevel();
      const { feedingCount, adventureCoins } = cumulativeCare;
      
      // Use the same care stage logic as PetPage for consistency
      if (adventureCoins >= 100) {
        return getBoboImage(5); // Map to highest feeding level for ready_for_sleep
      } else if (adventureCoins >= 50) {
        return getBoboImage(3); // Map to adventurous level
      } else if (feedingCount >= 1) {
        return getBoboImage(1); // Map to fed level
      } else {
        return getBoboImage(0); // Map to hungry level
      }
    }
    // Fallback to old logic if getCumulativeCareLevel is not available
    const feedingCount = getCumulativeCareLevel ? getCumulativeCareLevel().feedingCount : 0;
    return getBoboImage(feedingCount);
  }
  
  // Check if Feather is owned and being displayed
  if (currentPet === 'feather' && isPetOwned('feather')) {
    // For Feather, use unified care system (same as PetPage logic)
    if (getCumulativeCareLevel) {
      const cumulativeCare = getCumulativeCareLevel();
      const { feedingCount, adventureCoins } = cumulativeCare;
      
      // Use the same care stage logic as PetPage for consistency
      if (adventureCoins >= 100) {
        return getFeatherImage(5); // Map to highest feeding level for ready_for_sleep
      } else if (adventureCoins >= 50) {
        return getFeatherImage(3); // Map to adventurous level
      } else if (feedingCount >= 1) {
        return getFeatherImage(1); // Map to fed level
      } else {
        return getFeatherImage(0); // Map to hungry level
      }
    }
    // Fallback to old logic if getCumulativeCareLevel is not available
    const feedingCount = getCumulativeCareLevel ? getCumulativeCareLevel().feedingCount : 0;
    return getFeatherImage(feedingCount);
  }
  
  // Check if Cat is owned and being displayed
  if (currentPet === 'cat' && isPetOwned('cat')) {
    // For Cat, use unified care system (same as PetPage logic)
    if (getCumulativeCareLevel) {
      const cumulativeCare = getCumulativeCareLevel();
      const { feedingCount, adventureCoins } = cumulativeCare;
      
      // Use the same care stage logic as PetPage for consistency
      if (adventureCoins >= 100) {
        // ready_for_sleep
        return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250910_000550_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      } else if (adventureCoins >= 50) {
        // adventurous
        return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_234441_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      } else if (feedingCount >= 1) {
        // fed
        return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_234455_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      } else {
        // hungry
        return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_234430_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
      }
    }
    // Fallback
    return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_234430_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
  }
  
  // Check if Hamster is owned and being displayed
  if (currentPet === 'hamster' && isPetOwned('hamster')) {
    // For Hamster, use unified care system (same as PetPage logic)
    if (getCumulativeCareLevel) {
      const cumulativeCare = getCumulativeCareLevel();
      const { feedingCount, adventureCoins } = cumulativeCare;
      
      // Use the same care stage logic as PetPage:
      // Stage 3: 50+ adventure coins (ready for sleep)
      // Stage 2: Fed once (first feeding triggers image change)
      // Stage 1: Initial hungry/sad state (feeding count 0)
      
      if (adventureCoins >= 50) {
        return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_162550_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN"; // ready_for_sleep
      } else if (feedingCount >= 1) {
        return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_162541_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN"; // fed
      } else {
        return "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_162526_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN"; // hungry
      }
    }
    // Fallback to old logic if getCumulativeCareLevel is not available
    const feedingCount = getCumulativeCareLevel ? getCumulativeCareLevel().feedingCount : 0;
    return getHamsterImage(feedingCount);
  }
  
  // For April (dog), use cumulative care level system if available
  if (currentPet === 'dog' && getCumulativeCareLevel) {
    const cumulativeCare = getCumulativeCareLevel();
    return getCumulativeCareImage(cumulativeCare.feedingCount, cumulativeCare.adventureCoins);
  }
  
  // Fallback to feeding count system (since feeding is now free)
  // Try to get feeding count from cumulative care level
  let feedingCount = 0;
  if (getCumulativeCareLevel) {
    feedingCount = getCumulativeCareLevel().feedingCount;
  }
  
  // Check streak level for different dog evolution tiers
  if (currentStreak >= 3) {
    // Fully evolved dog versions for users with 3+ day streak
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

/**
 * Hook to get the current pet avatar image - synchronized with PetPage logic
 */
export const useCurrentPetAvatarImage = () => {
  const { isPetOwned, getPetCoinsSpent, getCoinsSpentForCurrentStage, getCumulativeCareLevel, petData, checkAndPerform8HourReset } = usePetData();
  
  // State for current pet - reactive to changes
  const [currentPetId, setCurrentPetId] = useState(() => {
    try {
      // First try to get from PetProgressStorage (same as PetPage)
      const currentSelectedPet = PetProgressStorage.getCurrentSelectedPet();
      if (currentSelectedPet) {
        return currentSelectedPet;
      }
      
      // Fallback to localStorage
      const stored = localStorage.getItem('current_pet');
      return stored || 'dog';
    } catch {
      return 'dog';
    }
  });
  
  // Track per-pet daily coins, same as PetPage uses for image state
  const [todayCoins, setTodayCoins] = useState<number>(() => {
    try {
      const current = PetProgressStorage.getCurrentSelectedPet() || 'dog';
      return PetProgressStorage.getTodayCoins(current);
    } catch {
      return 0;
    }
  });

  // Local state to force re-render on pet data updates
  const [petDataVersion, setPetDataVersion] = useState(0);
  // Local state to track sleep clicks to keep chat avatar in sync with PetPage
  const [sleepClicksState, setSleepClicksState] = useState<number>(() => {
    try {
      const key = `pet_sleep_data_${PetProgressStorage.getCurrentSelectedPet?.() || 'dog'}`;
      const stored = localStorage.getItem(key) || localStorage.getItem('pet_sleep_data');
      if (!stored) return 0;
      const data = JSON.parse(stored);
      const now = Date.now();
      if (data.sleepEndTime && now >= data.sleepEndTime) return 0;
      if (data.sleepEndTime && now < data.sleepEndTime) return data.clicks || 0;
      const eightHours = 8 * 60 * 60 * 1000;
      if (data.timestamp && now - data.timestamp < eightHours) return data.clicks || 0;
      return 0;
    } catch {
      return 0;
    }
  });
  
  // Listen for changes to current pet selection
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        // First try to get from PetProgressStorage (same as PetPage)
        const currentSelectedPet = PetProgressStorage.getCurrentSelectedPet();
        if (currentSelectedPet) {
          setCurrentPetId(currentSelectedPet);
          return;
        }
        
        // Fallback to localStorage
        const stored = localStorage.getItem('current_pet');
        setCurrentPetId(stored || 'dog');
      } catch {
        setCurrentPetId('dog');
      }
    };
    
    // Listen for storage events (from other tabs/windows)
    window.addEventListener('storage', handleStorageChange);
    
    // Listen for custom events (from same tab)
    window.addEventListener('currentPetChanged', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('currentPetChanged', handleStorageChange);
    };
  }, []);
  
  // Keep today's per-pet coins in sync (calendar-day reset handled by PetProgressStorage)
  useEffect(() => {
    const updateTodayCoins = () => {
      try {
        const current = PetProgressStorage.getCurrentSelectedPet() || currentPetId;
        setTodayCoins(PetProgressStorage.getTodayCoins(current));
      } catch {
        setTodayCoins(0);
      }
    };
    // Update on relevant custom events
    const coinHandler = () => updateTodayCoins();
    const petHandler = () => updateTodayCoins();
    window.addEventListener('coinsChanged', coinHandler as EventListener);
    window.addEventListener('petDataChanged', coinHandler as EventListener);
    window.addEventListener('currentPetChanged', petHandler as EventListener);
    window.addEventListener('storage', coinHandler);
    // Poll as a fallback because todayCoins are stored per pet progress
    const interval = setInterval(updateTodayCoins, 2000);
    updateTodayCoins();
    return () => {
      window.removeEventListener('coinsChanged', coinHandler as EventListener);
      window.removeEventListener('petDataChanged', coinHandler as EventListener);
      window.removeEventListener('currentPetChanged', petHandler as EventListener);
      window.removeEventListener('storage', coinHandler as EventListener);
      clearInterval(interval);
    };
  }, [currentPetId]);

  // Perform 8-hour reset check on mount to mirror PetPage behavior
  useEffect(() => {
    try {
      const wasReset = checkAndPerform8HourReset?.();
      if (wasReset) {
        // Force refresh of local state after reset
        const current = PetProgressStorage.getCurrentSelectedPet() || currentPetId;
        setTodayCoins(PetProgressStorage.getTodayCoins(current));
        setSleepClicksState(0);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for pet data changes (adventure coins, feeding, etc.)
  useEffect(() => {
    const handler = () => setPetDataVersion((v) => v + 1);
    window.addEventListener('petDataChanged', handler as EventListener);
    return () => window.removeEventListener('petDataChanged', handler as EventListener);
  }, []);

  // Poll sleep data to reflect changes made on PetPage (same-tab updates don't fire storage events)
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const key = `pet_sleep_data_${PetProgressStorage.getCurrentSelectedPet?.() || 'dog'}`;
        const stored = localStorage.getItem(key) || localStorage.getItem('pet_sleep_data');
        const now = Date.now();
        let clicks = 0;
        if (stored) {
          const data = JSON.parse(stored);
          if (data.sleepEndTime && now >= data.sleepEndTime) {
            clicks = 0;
          } else if (data.sleepEndTime && now < data.sleepEndTime) {
            clicks = data.clicks || 0;
          } else if (data.timestamp) {
            const eightHours = 8 * 60 * 60 * 1000;
            clicks = now - data.timestamp < eightHours ? (data.clicks || 0) : 0;
          }
        }
        setSleepClicksState((prev) => (prev !== clicks ? clicks : prev));
      } catch {
        // ignore
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Get sleep clicks from localStorage (same logic as PetPage)
  const getSleepClicks = () => {
    try {
      const key = `pet_sleep_data_${PetProgressStorage.getCurrentSelectedPet?.() || 'dog'}`;
      const stored = localStorage.getItem(key) || localStorage.getItem('pet_sleep_data');
      if (stored) {
        const sleepData = JSON.parse(stored);
        const now = Date.now();
        
        // Check if sleep end time has passed (new logic)
        if (sleepData.sleepEndTime && now >= sleepData.sleepEndTime) {
          // Sleep period has ended, return 0
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
  };

  // Level system calculation (same as PetPage)
  const getLevelInfo = () => {
    const adventureCoins = getCumulativeCareLevel().adventureCoins;
    const levelThresholds = [0, 50, 120, 200, 300];
    
    let currentLevel = 1;
    for (let i = levelThresholds.length - 1; i >= 0; i--) {
      if (adventureCoins >= levelThresholds[i]) {
        currentLevel = i + 1;
        break;
      }
    }
    
    return { currentLevel };
  };

  // Level-based image system (same as PetPage)
  const getLevelBasedPetImage = (petType: string, level: number, careState: string) => {
    const petImages = {
      dog: {
        1: {
          coins_0: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160158_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_10: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160535_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_30: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_000902_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_50: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160214_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep1: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_162600_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep2: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_163624_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep3: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_165610_dog_den_no_bg.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN"
        }
      },
      cat: {
        1: {
          coins_0: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_234430_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_10: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_234455_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_30: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_234441_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_50: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250910_000550_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep1: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250911_153821_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep2: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250911_155438_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep3: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250911_160705_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN"
        }
      },
      hamster: {
        1: {
          coins_0: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_162526_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_10: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_162541_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_30: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_163423_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_50: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_162550_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep1: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_163334_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep2: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_164339_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep3: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_165002_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN"
        }
      },
      dragon: {
        1: {
          coins_0: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250908_154712_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_10: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250908_155301_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_30: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250908_154733_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_50: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250908_154758_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep1: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_162600_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep2: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_163624_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          sleep3: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_165610_dog_den_no_bg.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN"
        }
      },
      unicorn: {
        1: {
          coins_0: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160158_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_10: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160535_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_30: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_000902_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
          coins_50: "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160214_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN",
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
    return levelImages[careState as keyof typeof levelImages] || levelImages.coins_0;
  };

  // Determine care state based on current pet and progress (same as PetPage)
  const getCurrentCareState = () => {
    const sleepClicks = sleepClicksState;

    if (sleepClicks > 0) {
      if (sleepClicks >= 3) return 'sleep3';
      if (sleepClicks >= 2) return 'sleep2';
      return 'sleep1';
    }

    // Per-pet daily coin thresholds used by PetPage
    if (todayCoins >= 50) return 'coins_50';
    if (todayCoins >= 30) return 'coins_30';
    if (todayCoins >= 10) return 'coins_10';
    return 'coins_0';
  };

  // Get current level for the active pet (same as PetPage)
  const getCurrentPetLevel = () => {
    const levelInfo = getLevelInfo();
    return levelInfo.currentLevel;
  };

  // Handle special pets (bobo, feather, etc.) - same logic as PetPage
  const getSpecialPetImage = () => {
    // Check if Bobo is owned and being displayed
    if (currentPetId === 'bobo' && isPetOwned('bobo')) {
      const cumulativeCare = getCumulativeCareLevel();
      const { feedingCount, adventureCoins } = cumulativeCare;
      
      // Use the same care stage logic as PetPage for consistency
      if (adventureCoins >= 100) {
        return getBoboImage(5); // Map to highest feeding level for ready_for_sleep
      } else if (adventureCoins >= 50) {
        return getBoboImage(3); // Map to adventurous level
      } else if (feedingCount >= 1) {
        return getBoboImage(1); // Map to fed level
      } else {
        return getBoboImage(0); // Map to hungry level
      }
    }
    
    // Check if Feather is owned and being displayed
    if (currentPetId === 'feather' && isPetOwned('feather')) {
      const cumulativeCare = getCumulativeCareLevel();
      const { feedingCount, adventureCoins } = cumulativeCare;
      
      // Use the same care stage logic as PetPage for consistency
      if (adventureCoins >= 100) {
        return getFeatherImage(5); // Map to highest feeding level for ready_for_sleep
      } else if (adventureCoins >= 50) {
        return getFeatherImage(3); // Map to adventurous level
      } else if (feedingCount >= 1) {
        return getFeatherImage(1); // Map to fed level
      } else {
        return getFeatherImage(0); // Map to hungry level
      }
    }
    
    // Check if Cat is owned and being displayed - use the same daily coin thresholds as PetPage
    if (currentPetId === 'cat' && isPetOwned('cat')) {
      if (todayCoins >= 50) {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fcat-super-happy-unscreen.gif?alt=media&token=8275c06d-139a-42c3-b5e0-abfdcbddd1e1";
      } else if (todayCoins >= 30) {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fcat-happy-unscreen.gif?alt=media&token=baa69ba6-06f5-4c44-ad6b-9a96c241dab0";
      } else if (todayCoins >= 10) {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fcat-neutral-unscreen.gif?alt=media&token=fa2abbc8-8f14-4f63-bf51-355ef0d1c310";
      } else {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fcat-sad-unscreen.gif?alt=media&token=7f5ad9cb-df5d-46dc-ae54-67e35f5a5ed6";
      }
    }
    
    // Check if Dog is owned and being displayed - use the same daily coin thresholds as PetPage
    if (currentPetId === 'dog' && isPetOwned('dog')) {
      if (todayCoins >= 50) {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fdog-super-happy-unscreen.gif?alt=media&token=90825746-c450-46a4-aad5-7c8a113dd33a"; // 50+ coins - placeholder for future GIF
      } else if (todayCoins >= 30) {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fdog-happy-unscreen.gif?alt=media&token=63a8ea0c-4166-4be3-bfd0-4caffaaf58cc"; // 30+ coins - placeholder for future GIF
      } else if (todayCoins >= 10) {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fdog-neutral-unscreen.gif?alt=media&token=fab36d1a-fec3-4510-a99d-eeeef5d9d784"; // 10+ coins - placeholder for future GIF
      } else {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fdog-sad-unscreen.gif?alt=media&token=aa2818bf-d631-4394-97f5-3955b5602299"; // 0 coins - hungry - placeholder for future GIF
      }
    }
    
    // Check if Hamster is owned and being displayed - use the same daily coin thresholds as PetPage
    if (currentPetId === 'hamster' && isPetOwned('hamster')) {
      if (todayCoins >= 50) {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fhamster-super-happy-unscreen.gif?alt=media&token=1c6950e1-b84e-4241-8a3b-34ee4bb31e4d"; // 50+ coins
      } else if (todayCoins >= 30) {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fhamster-waving-unscreen.gif?alt=media&token=d57ef528-9abd-4728-9b92-dee06e4763c6"; // 30+ coins - placeholder for future image
      } else if (todayCoins >= 10) {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fhamster-neutral-unscreen.gif?alt=media&token=8511abcc-9b24-4ea5-b830-9bdb7ad4bee8"; // 10+ coins
      } else {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fhamster-crying-unscreen.gif?alt=media&token=7762a589-6fa3-474e-87e4-3ea2110bd0a0"; // 0 coins - hungry
      }
    }
    
    return null; // No special pet handling needed
  };

  // Main function to get pet image (same as PetPage)
  const getPetImage = () => {
    // First check for special pets
    const specialPetImage = getSpecialPetImage();
    if (specialPetImage) {
      return specialPetImage;
    }
    
    // Fall back to level-based system for standard pets
    const currentLevel = getCurrentPetLevel();
    const careState = getCurrentCareState();
    return getLevelBasedPetImage(currentPetId, currentLevel, careState);
  };

  return getPetImage();
};
