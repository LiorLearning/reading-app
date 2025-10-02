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
  // If pet is in sleep mode (sleepClicks > 0), show sleepy images/GIFs by pet
  if (sleepClicks > 0) {
    if (currentPet === 'monkey') {
      return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fmonkey-sleeping-unscreen.gif?alt=media&token=f635d423-7204-4477-806f-04b8d8c11f4d";
    }
    if (currentPet === 'parrot') {
      return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fparrot-sleeping-unscreen.gif?alt=media&token=8971174c-20b4-46e2-bb64-e9be6f35d3d1";
    }
    if (currentPet === 'dragon') {
      return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fdragon-sleeping-unscreen.gif?alt=media&token=1fa04c6a-3099-406e-8806-8ff8fbe48402";
    }
    if (currentPet === 'unicorn') {
      return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Funicorn-sleeping-unscreen.gif?alt=media&token=4e329a08-ba34-4e56-bd7a-d6eed5d7d09d";
    }
    if (currentPet === 'dog') {
      return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fdog-sleeping.gif?alt=media&token=ffc0469d-0cd0-488e-9672-ac41282b3c26";
    }
    if (currentPet === 'cat') {
      return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fcat-sleeping.gif?alt=media&token=dd59e26d-3694-433f-a36a-e852ecf4f519";
    }
    if (currentPet === 'hamster') {
      return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fhamster-sleeping.gif?alt=media&token=a3b5cea4-24c2-4336-8c4b-c165c3e0535d";
    }
    
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

    // Daily quest override (same mapping as PetPage)
    try {
      const questStatesRaw = typeof window !== 'undefined' ? localStorage.getItem('litkraft_daily_quests_state') : null;
      if (questStatesRaw) {
        const arr = JSON.parse(questStatesRaw) as Array<{ pet: string; activity: string; progress: number; target?: number; }>;
        const item = arr?.find(x => x.pet === currentPetId);
        const target = (item && typeof item.target === 'number' && item.target > 0) ? item.target : 5;
        if (item) {
          const prog = Number(item.progress || 0);
          if (prog >= target) return 'coins_50';
          if (prog >= 3) return 'coins_30';
          if (prog >= 1) return 'coins_10';
        }
      }
    } catch {
      // ignore and fall through
    }

    // Enforce daily sadness assignment cap: only assigned pets can be sad today
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('litkraft_daily_sadness') : null;
      if (raw) {
        const sad = JSON.parse(raw) as { date: string; assignedPets: string[] };
        const today = new Date().toISOString().slice(0, 10);
        const assigned = Array.isArray(sad?.assignedPets) ? sad.assignedPets : [];
        const isAssignedToday = sad?.date === today && assigned.includes(currentPetId);
        if (!isAssignedToday) {
          // Clamp to neutral-or-better buckets; never render coins_0 for unassigned pets
          if (todayCoins >= 50) return 'coins_50';
          if (todayCoins >= 30) return 'coins_30';
          if (todayCoins >= 10) return 'coins_10';
          return 'coins_10';
        }
      }
    } catch {}

    // Force sad when pet will be sad on wakeup or heart is empty (align with PetPage)
    try {
      const petProgress = PetProgressStorage.getPetProgress(currentPetId);
      const { heartData, sleepData } = petProgress;
      const isHeartEmpty = heartData.feedingCount === 0 && heartData.adventureCoins === 0 && !heartData.sleepCompleted;
      if (sleepData.willBeSadOnWakeup || isHeartEmpty) {
        return 'coins_0';
      }
    } catch {
      // ignore; fall through to coin thresholds
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

  // Handle pets that have GIF sets; decide by unified careState
  const getSpecialPetImage = (careState: string) => {
    // Helper: collapse careState to GIF mood buckets, and treat any sleep as super-happy
    const stateToGifKey = (state: string): 'coins_50' | 'coins_30' | 'coins_10' | 'coins_0' => {
      if (state.startsWith('sleep')) return 'coins_50';
      if (state === 'coins_50') return 'coins_50';
      if (state === 'coins_30') return 'coins_30';
      if (state === 'coins_10') return 'coins_10';
      return 'coins_0';
    };
    const gifKey = stateToGifKey(careState);
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
    
    // Check if Cat is owned and being displayed - map from careState buckets
    if (currentPetId === 'cat' && isPetOwned('cat')) {
      if (gifKey === 'coins_50') {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fcat-super-happy-unscreen.gif?alt=media&token=8275c06d-139a-42c3-b5e0-abfdcbddd1e1";
      } else if (gifKey === 'coins_30') {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fcat-happy-unscreen.gif?alt=media&token=baa69ba6-06f5-4c44-ad6b-9a96c241dab0";
      } else if (gifKey === 'coins_10') {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fcat-neutral-unscreen.gif?alt=media&token=fa2abbc8-8f14-4f63-bf51-355ef0d1c310";
      } else {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fcat-sad-unscreen.gif?alt=media&token=7f5ad9cb-df5d-46dc-ae54-67e35f5a5ed6";
      }
    }
    
    // Check if Dog is owned and being displayed - map from careState buckets
    if (currentPetId === 'dog' && isPetOwned('dog')) {
      if (gifKey === 'coins_50') {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fdog-super-happy-unscreen.gif?alt=media&token=90825746-c450-46a4-aad5-7c8a113dd33a";
      } else if (gifKey === 'coins_30') {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fdog-happy-unscreen.gif?alt=media&token=63a8ea0c-4166-4be3-bfd0-4caffaaf58cc";
      } else if (gifKey === 'coins_10') {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fdog-neutral-unscreen.gif?alt=media&token=fab36d1a-fec3-4510-a99d-eeeef5d9d784";
      } else {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fdog-sad-unscreen.gif?alt=media&token=aa2818bf-d631-4394-97f5-3955b5602299";
      }
    }
    
    // Check if Hamster is owned and being displayed - map from careState buckets
    if (currentPetId === 'hamster' && isPetOwned('hamster')) {
      if (gifKey === 'coins_50') {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fhamster-super-happy-unscreen.gif?alt=media&token=1c6950e1-b84e-4241-8a3b-34ee4bb31e4d";
      } else if (gifKey === 'coins_30') {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fhamster-waving-unscreen.gif?alt=media&token=d57ef528-9abd-4728-9b92-dee06e4763c6";
      } else if (gifKey === 'coins_10') {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fhamster-neutral-unscreen.gif?alt=media&token=8511abcc-9b24-4ea5-b830-9bdb7ad4bee8";
      } else {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fhamster-crying-unscreen.gif?alt=media&token=7762a589-6fa3-474e-87e4-3ea2110bd0a0";
      }
    }
    
    // Check if Dragon is owned and being displayed - map from careState buckets (TBD GIFs)
    if (currentPetId === 'dragon' && isPetOwned('dragon')) {
      if (gifKey === 'coins_50') {
        return "TBD";
      } else if (gifKey === 'coins_30') {
        return "TBD";
      } else if (gifKey === 'coins_10') {
        return "TBD";
      } else {
        return "TBD";
      }
    }
    
    // Check if Unicorn is owned and being displayed - map from careState buckets (TBD GIFs)
    if (currentPetId === 'unicorn' && isPetOwned('unicorn')) {
      if (gifKey === 'coins_50') {
        return "TBD";
      } else if (gifKey === 'coins_30') {
        return "TBD";
      } else if (gifKey === 'coins_10') {
        return "TBD";
      } else {
        return "TBD";
      }
    }
    
    // Check if Parrot is owned and being displayed - map from careState buckets
    if (currentPetId === 'parrot' && isPetOwned('parrot')) {
      if (gifKey === 'coins_50') {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fparrot-superhappy-unscreen.gif?alt=media&token=af057d1e-47b1-4a6c-8fa7-fbc44da8b18a";
      } else if (gifKey === 'coins_30') {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fparrot-happy-unscreen.gif?alt=media&token=4f4df3cf-486f-4471-8fae-480775d1574d";
      } else if (gifKey === 'coins_10') {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fparrot-neutral-unscreen.gif?alt=media&token=9da3fa6e-9f8b-4c65-8427-94378971a739";
      } else {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fparrot-sad-unscreen.gif?alt=media&token=05efa46e-ec9a-4aac-86ed-43dec953cb49";
      }
    }
    
    // Check if Monkey is owned and being displayed - map from careState buckets
    if (currentPetId === 'monkey' && isPetOwned('monkey')) {
      if (gifKey === 'coins_50') {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fmonkey-superhappy-unscreen.gif?alt=media&token=2e4a741f-cf3f-471c-9d84-94b63c066687";
      } else if (gifKey === 'coins_30') {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fmonkey-happy-unscreen.gif?alt=media&token=042e3938-b885-447b-a63e-e1b883fa4e5f";
      } else if (gifKey === 'coins_10') {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fmonkey-neutral-unscreen.gif?alt=media&token=7380ade3-dd24-4bc7-a8e0-cf0894a83bc0";
      } else {
        return "https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fmonkey-sad-unscreen.gif?alt=media&token=3fbbd435-b1de-4932-a693-137c626e20e4";
      }
    }
    
    return null; // No special pet handling needed
  };

  // Main function to get pet image (same as PetPage)
  const getPetImage = () => {
    // Compute unified care state first
    const careState = getCurrentCareState();
    
    // Prefer GIFs for pets that have them, driven by careState
    const specialPetImage = getSpecialPetImage(careState);
    if (specialPetImage) {
      return specialPetImage;
    }
    
    // Fall back to level-based system for standard pets (static images)
    const currentLevel = getCurrentPetLevel();
    return getLevelBasedPetImage(currentPetId, currentLevel, careState);
  };

  return getPetImage();
};

// ----- Emotion action media placeholders -----
// Replace these per-pet URLs with real Firestore/GCS links when available.
export type PetEmotionAction = 'feed' | 'water' | 'pat' | 'needy';

const ACTION_MEDIA_PLACEHOLDERS: Record<string, Record<PetEmotionAction, string>> = {
  dog: {
    feed: 'https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fdog-food-unscreen.gif?alt=media&token=fd024488-b0d1-499b-9d48-4552ffd99271',
    water: 'https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fdog-water-unscreen.gif?alt=media&token=86ef6744-5fa5-4381-b0b9-19cef93a91a8',
    // Pet = coins_30 (happy); Wrong = sad
    pat: 'https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fdog-happy-unscreen.gif?alt=media&token=63a8ea0c-4166-4be3-bfd0-4caffaaf58cc',
    needy: 'https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fdog-sad-unscreen.gif?alt=media&token=aa2818bf-d631-4394-97f5-3955b5602299',
  },
  cat: {
    feed: 'https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fcat-food-unscreen.gif?alt=media&token=c82c8075-f34e-4ee2-b986-ea674a42a559',
    water: 'https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fcat-water-unscreen.gif?alt=media&token=3ce09ca8-74c3-48ca-a153-60e5a5dd6c63',
    pat: 'https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fcat-happy-unscreen.gif?alt=media&token=baa69ba6-06f5-4c44-ad6b-9a96c241dab0',
    needy: 'https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fcat-sad-unscreen.gif?alt=media&token=7f5ad9cb-df5d-46dc-ae54-67e35f5a5ed6',
  },
  hamster: {
    feed: 'https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fhamster-food-unscreen.gif?alt=media&token=799c1d3a-0076-43e8-ac8b-b9ecf9481dd0',
    water: 'https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fhamster-water-unscreen.gif?alt=media&token=917777a5-10a7-4aa3-a7d5-6b0db1cc149b',
    pat: 'https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fhamster-waving-unscreen.gif?alt=media&token=d57ef528-9abd-4728-9b92-dee06e4763c6',
    needy: 'https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fhamster-crying-unscreen.gif?alt=media&token=7762a589-6fa3-474e-87e4-3ea2110bd0a0',
  },
  parrot: {
    feed: 'https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fparrot-food-unscreen.gif?alt=media&token=4201c661-7acc-46d0-8c22-24abd39ef948',
    water: 'https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fparrot-water-unscreen.gif?alt=media&token=b9a5e15d-ce03-44b2-af99-2ead4f6a29ba',
    pat: 'https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fparrot-happy-unscreen.gif?alt=media&token=4f4df3cf-486f-4471-8fae-480775d1574d',
    needy: 'https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fparrot-sad-unscreen.gif?alt=media&token=05efa46e-ec9a-4aac-86ed-43dec953cb49',
  },
  monkey: {
    feed: 'https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fmonkey-food-unscreen.gif?alt=media&token=9a12ed08-5ea3-4ecb-aa7a-bd876d4aee18',
    water: 'https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fmonkey-water-unscreen.gif?alt=media&token=a1cd303c-a298-4c46-8716-8ba812189865',
    pat: 'https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fmonkey-happy-unscreen.gif?alt=media&token=042e3938-b885-447b-a63e-e1b883fa4e5f',
    needy: 'https://firebasestorage.googleapis.com/v0/b/litkraft-8d090.firebasestorage.app/o/videos%2Fmonkey-sad-unscreen.gif?alt=media&token=3fbbd435-b1de-4932-a693-137c626e20e4',
  },
  dragon: {
    feed: '/placeholder.svg',
    water: '/placeholder.svg',
    pat: 'TBD', // coins_30 equivalent
    needy: 'TBD', // sad equivalent
  },
  unicorn: {
    feed: '/placeholder.svg',
    water: '/placeholder.svg',
    pat: 'TBD',
    needy: 'TBD',
  },
};

export const getPetEmotionActionMedia = (
  petType: string,
  action: PetEmotionAction
): string => {
  const set = ACTION_MEDIA_PLACEHOLDERS[petType] || ACTION_MEDIA_PLACEHOLDERS['dog'];
  return set[action] || '/placeholder.svg';
};
