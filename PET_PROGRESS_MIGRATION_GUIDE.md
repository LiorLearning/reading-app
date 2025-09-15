# Pet Progress Storage Migration Guide

## Overview

The new `PetProgressStorage` service provides comprehensive pet-wise local storage with enhanced features including:

✅ **Cumulative coins spent per pet** (for level upgrades)  
✅ **8-hour heart reset cycle** (feed/adventure/sleep)  
✅ **Sleep timer tracking** (when put to sleep and when to wake up)  
✅ **Level system with unlocks**  
✅ **Achievement and milestone tracking**  
✅ **Pet customization system**  
✅ **Automatic data migration from old system**

## Key Features Implemented

### 1. Pet-Wise Data Storage
- Each pet has its own dedicated storage space
- Data is isolated per pet ID (e.g., 'dog', 'bobo', 'feather')
- Global settings for current selected pet and audio preferences

### 2. Cumulative Coins Tracking
```typescript
// Track coins spent on specific pet for level upgrades
PetProgressStorage.addCoinsSpent('dog', 50);
const totalSpent = PetProgressStorage.getCumulativeCoinsSpent('dog');
```

### 3. 8-Hour Heart Reset Cycle
```typescript
// Automatically resets every 8 hours:
// - feedingCount: 0
// - adventureCoins: 0  
// - sleepCompleted: false
// - Pet becomes sad and hungry again

const timeUntilReset = PetProgressStorage.getTimeUntilHeartReset('dog');
```

### 4. Sleep Timer System
```typescript
// Put pet to sleep with custom duration
PetProgressStorage.putPetToSleep('dog', 8 * 60 * 60 * 1000); // 8 hours

// Check sleep status
const sleepTimeRemaining = PetProgressStorage.getSleepTimeRemaining('dog');
const isAsleep = petData.sleepData.isAsleep;

// Pet will be sad when it wakes up after sleep duration
```

### 5. Level System
```typescript
// Levels based on total adventure coins earned:
// Level 1: 0 coins
// Level 2: 200 coins  
// Level 3: 500 coins
// Level 4: 1000 coins

const levelInfo = PetProgressStorage.getLevelInfo('dog');
// Returns: { currentLevel: 2, nextLevelThreshold: 500, progress: 75 }
```

### 6. Achievement System
```typescript
// Automatic milestone tracking
const milestones = PetProgressStorage.getMilestones('dog');
const stats = PetProgressStorage.getAchievementStats('dog');
// Returns: { totalFeedings: 15, totalAdventures: 8, totalSleeps: 3, longestStreak: 5 }
```

## Migration from Existing System

### Automatic Migration
The new system automatically migrates data from the old `PetDataService`:

```typescript
// Run migration on app startup
PetProgressStorage.migrateFromOldPetDataService();
```

### Manual Migration Steps

1. **Replace imports:**
```typescript
// OLD
import { PetDataService, usePetData } from '@/lib/pet-data-service';

// NEW  
import { PetProgressStorage, usePetProgress } from '@/lib/pet-progress-storage';
```

2. **Update component usage:**
```typescript
// OLD
const { petData, feedPet, addAdventureCoins } = usePetData();

// NEW
const { petProgress, feedPet, addAdventureCoins, levelInfo, milestones } = usePetProgress('dog');
```

3. **Update method calls:**
```typescript
// OLD
PetDataService.incrementFeedingCount();
PetDataService.addAdventureCoins(10);

// NEW
PetProgressStorage.feedPet('dog');
PetProgressStorage.addAdventureCoins('dog', 10);
```

## Integration Examples

### 1. PetPage Component Integration

```typescript
import { usePetProgress, useGlobalPetSettings } from '@/lib/pet-progress-storage';

export default function PetPage() {
  const { currentSelectedPet } = useGlobalPetSettings();
  const {
    petProgress,
    heartFillPercentage,
    isAsleep,
    sleepTimeRemaining,
    timeUntilHeartReset,
    levelInfo,
    milestones,
    feedPet,
    addAdventureCoins,
    putToSleep
  } = usePetProgress(currentSelectedPet);

  const handleFeed = () => {
    feedPet(); // Automatically tracks feeding count and achievements
  };

  const handleAdventure = (coinsEarned: number) => {
    addAdventureCoins(coinsEarned); // Automatically checks for level ups
  };

  const handleSleep = () => {
    putToSleep(); // 8-hour sleep duration by default
  };

  return (
    <div>
      <h2>Pet Level {levelInfo.currentLevel}</h2>
      <div>Heart Fill: {heartFillPercentage}%</div>
      <div>Time until reset: {formatTime(timeUntilHeartReset)}</div>
      
      {isAsleep && (
        <div>Sleeping... {formatTime(sleepTimeRemaining)} remaining</div>
      )}
      
      <div>Achievements: {milestones.length}</div>
    </div>
  );
}
```

### 2. Adventure/MCQ Integration

```typescript
// In MCQ or adventure completion
import { PetProgressStorage } from '@/lib/pet-progress-storage';
import { useGlobalPetSettings } from '@/lib/pet-progress-storage';

const { currentSelectedPet } = useGlobalPetSettings();

// When user completes adventure and earns coins
const handleAdventureComplete = (coinsEarned: number) => {
  // Add coins to current pet
  PetProgressStorage.addAdventureCoins(currentSelectedPet, coinsEarned);
  
  // Also add to global coin system
  CoinSystem.addAdventureCoins(coinsEarned);
};
```

### 3. Pet Selection/Switching

```typescript
import { PetProgressStorage, useGlobalPetSettings } from '@/lib/pet-progress-storage';

const { currentSelectedPet, setCurrentSelectedPet } = useGlobalPetSettings();

const handlePetSwitch = (newPetId: string) => {
  // Check if pet is owned
  if (PetProgressStorage.isPetOwned(newPetId)) {
    setCurrentSelectedPet(newPetId);
  }
};
```

### 4. Pet Purchase Integration

```typescript
const handlePetPurchase = (petId: string, cost: number) => {
  if (CoinSystem.spendCoins(cost)) {
    // Mark pet as owned
    PetProgressStorage.setPetOwnership(petId, true);
    
    // Track coins spent on this pet
    PetProgressStorage.addCoinsSpent(petId, cost);
    
    // Switch to new pet
    PetProgressStorage.setCurrentSelectedPet(petId);
  }
};
```

## Data Structure Comparison

### Old System (PetDataService)
```typescript
interface PetData {
  careLevel: number;
  ownedPets: string[];
  audioEnabled: boolean;
  cumulativeCareLevel: {
    feedingCount: number;
    adventureCoins: number;
    sleepCompleted: boolean;
  };
}
```

### New System (PetProgressStorage)
```typescript
interface PetProgressData {
  petId: string;
  petType: string;
  cumulativeCoinsSpent: number;
  
  heartData: {
    feedingCount: number;
    adventureCoins: number;
    sleepCompleted: boolean;
    lastHeartResetTime: number;
    nextHeartResetTime: number;
  };
  
  sleepData: {
    isAsleep: boolean;
    sleepStartTime: number;
    sleepEndTime: number;
    sleepClicks: number;
    willBeSadOnWakeup: boolean;
  };
  
  levelData: {
    currentLevel: number;
    totalAdventureCoinsEarned: number;
    levelUpTimestamp: number;
  };
  
  achievementData: {
    totalFeedingsSinceOwned: number;
    totalAdventuresSinceOwned: number;
    totalSleepsSinceOwned: number;
    longestStreak: number;
    milestones: string[];
  };
  
  customizationData: {
    unlockedImages: string[];
    unlockedAccessories: string[];
    currentAccessory?: string;
    specialStates: string[];
  };
}
```

## Testing the Migration

### 1. Backup Existing Data
```typescript
// Before migration, backup existing data
const backup = {
  petData: localStorage.getItem('litkraft_pet_data'),
  sleepData: localStorage.getItem('pet_sleep_data'),
  coins: localStorage.getItem('litkraft_coins')
};
```

### 2. Test Migration
```typescript
// Run migration
PetProgressStorage.migrateFromOldPetDataService();

// Verify data
const dogProgress = PetProgressStorage.getPetProgress('dog');
console.log('Migrated dog data:', dogProgress);
```

### 3. Rollback if Needed
```typescript
// If issues occur, restore backup
if (backup.petData) {
  localStorage.setItem('litkraft_pet_data', backup.petData);
}
```

## Performance Considerations

1. **Lazy Loading**: Pet data is only loaded when accessed
2. **Event-Driven Updates**: Components automatically update when pet data changes
3. **Efficient Storage**: Each pet's data is stored separately to avoid large JSON objects
4. **Automatic Cleanup**: Old data structures are cleaned up during migration

## Troubleshooting

### Common Issues

1. **Data Not Migrating**
   - Check browser console for migration errors
   - Verify old data exists in localStorage
   - Run migration manually: `PetProgressStorage.migrateFromOldPetDataService()`

2. **Heart Not Resetting**
   - Check `nextHeartResetTime` in pet data
   - Verify system time is correct
   - Force reset: `PetProgressStorage.checkAndPerformHeartReset(petData)`

3. **Sleep Timer Issues**
   - Check `sleepEndTime` vs current time
   - Verify sleep duration is set correctly
   - Check `isAsleep` flag

### Debug Commands

```typescript
// Get all pet data for debugging
const allPets = PetProgressStorage.getAllOwnedPets();
console.log('All pets:', allPets);

// Check specific pet
const dogData = PetProgressStorage.getPetProgress('dog');
console.log('Dog data:', dogData);

// Reset specific pet (for testing)
PetProgressStorage.resetPetData('dog');
```

## Next Steps

1. **Gradual Migration**: Start by integrating the new system alongside the old one
2. **Component Updates**: Update components one by one to use the new hooks
3. **Testing**: Thoroughly test all pet interactions
4. **Cleanup**: Remove old PetDataService after full migration
5. **Feature Enhancement**: Add new features like pet customization and achievements

The new system is backward compatible and includes automatic migration, so existing users won't lose their progress during the transition.
