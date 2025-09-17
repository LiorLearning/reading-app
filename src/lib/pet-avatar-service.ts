import { usePetData } from '@/lib/pet-data-service';
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
 * Hook to get the current pet avatar image
 */
export const useCurrentPetAvatarImage = () => {
  const { isPetOwned, getPetCoinsSpent, getCoinsSpentForCurrentStage, getCumulativeCareLevel, petData } = usePetData();
  
  // State for current pet - reactive to changes
  const [currentPetId, setCurrentPetId] = useState(() => {
    try {
      const stored = localStorage.getItem('current_pet');
      return stored || 'dog';
    } catch {
      return 'dog';
    }
  });
  
  // Listen for changes to current pet selection
  useEffect(() => {
    const handleStorageChange = () => {
      try {
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
  
  // Get current pet from state (now reactive)
  const getCurrentPet = () => currentPetId;

  // Get current streak from localStorage (same logic as PetPage)
  const getCurrentStreak = () => {
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
  };

  // Get sleep clicks from localStorage (same logic as PetPage)
  const getSleepClicks = () => {
    try {
      const stored = localStorage.getItem('pet_sleep_data');
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

  const currentPet = getCurrentPet();
  const currentStreak = getCurrentStreak();
  const sleepClicks = getSleepClicks();

  // Use the reactive getCumulativeCareLevel from the hook
  return getCurrentPetAvatarImage(
    currentPet,
    currentStreak,
    sleepClicks,
    isPetOwned,
    getPetCoinsSpent,
    getCoinsSpentForCurrentStage,
    getCumulativeCareLevel // Use the reactive function from the hook
  );
};
