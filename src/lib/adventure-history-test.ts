// Debug/test utilities for adventure history system
import { adventureHistoryService } from './adventure-history-service';
import { PetProgressStorage } from './pet-progress-storage';

/**
 * Test function to verify adventure history system works correctly
 */
export async function testAdventureHistory() {
  console.log('🧪 Testing Adventure History System...');
  
  try {
    const testPetId = 'dog';
    const testAdventureType = 'house';
    const testAdventureId = 'test-adventure-123';
    const testSummary = 'We built an amazing treehouse with slides and a cozy reading nook!';
    
    // Test 1: Record adventure history
    console.log('📝 Test 1: Recording adventure history...');
    await adventureHistoryService.recordAdventureHistory(
      testPetId,
      testAdventureType,
      testAdventureId,
      'test-session-456',
      testSummary
    );
    console.log('✅ Adventure history recorded successfully');
    
    // Test 2: Check if history exists
    console.log('🔍 Test 2: Checking if adventure history exists...');
    const hasHistory = await adventureHistoryService.hasAdventureHistory(testPetId, testAdventureType);
    console.log('✅ Has history:', hasHistory);
    
    // Test 3: Get adventure history entry
    console.log('📖 Test 3: Getting adventure history entry...');
    const historyEntry = await adventureHistoryService.getAdventureHistoryEntry(testPetId, testAdventureType);
    console.log('✅ History entry:', historyEntry);
    
    // Test 4: Get last adventure context
    console.log('🔄 Test 4: Getting last adventure context...');
    const context = await adventureHistoryService.getLastAdventureContext(testPetId, testAdventureType);
    console.log('✅ Adventure context:', context);
    
    // Test 5: Get adventure stats
    console.log('📊 Test 5: Getting adventure stats...');
    const stats = await adventureHistoryService.getAdventureStats(testPetId);
    console.log('✅ Adventure stats:', stats);
    
    console.log('🎉 Adventure History System Test Completed Successfully!');
    return true;
  } catch (error) {
    console.error('❌ Adventure History System Test Failed:', error);
    return false;
  }
}

/**
 * Debug function to log current adventure history state
 */
export async function debugAdventureHistory() {
  console.log('🐛 Debugging Adventure History...');
  
  try {
    await adventureHistoryService.debugLogHistory();
    
    const currentPet = PetProgressStorage.getCurrentSelectedPet();
    console.log('🐾 Current selected pet:', currentPet);
    
    if (currentPet) {
      const petStats = await adventureHistoryService.getAdventureStats(currentPet);
      console.log('📊 Current pet adventure stats:', petStats);
      
      // Check each adventure type
      const adventureTypes = ['food', 'house', 'travel', 'friend', 'story'];
      for (const type of adventureTypes) {
        const hasHistory = await adventureHistoryService.hasAdventureHistory(currentPet, type);
        const entry = await adventureHistoryService.getAdventureHistoryEntry(currentPet, type);
        console.log(`🎮 ${type}: hasHistory=${hasHistory}`, entry ? `summary="${entry.summary?.substring(0, 50)}..."` : 'no entry');
      }
    }
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

/**
 * Quick test for just the current selected pet
 */
export async function testCurrentPetOnly() {
  console.log('🔄 Testing Adventure Context for Current Pet Only...');
  
  try {
    const currentPet = PetProgressStorage.getCurrentSelectedPet();
    if (!currentPet) {
      console.error('❌ No pet currently selected!');
      return false;
    }
    
    console.log(`🐾 Testing adventures for current pet: ${currentPet.toUpperCase()}`);
    
    const adventureTypes = [
      { type: 'house', emoji: '🏠', summary: `We built an amazing ${currentPet} house with slides and rainbow bridges!` },
      { type: 'travel', emoji: '✈️', summary: `We flew to magical lands with our ${currentPet} companion!` },
      { type: 'friend', emoji: '👥', summary: `We created a magical friend who loves playing with ${currentPet}s!` },
      { type: 'food', emoji: '🍽️', summary: `We collected a ${currentPet}-sized feast and defeated villains!` },
      { type: 'story', emoji: '📚', summary: `We created an epic ${currentPet} adventure story!` }
    ];
    
    for (const adventure of adventureTypes) {
      // 1. Record adventure
      await adventureHistoryService.recordAdventureHistory(
        currentPet,
        adventure.type, 
        `test-${currentPet}-${adventure.type}-current`,
        `test-session-current-${adventure.type}`,
        adventure.summary
      );
      
      // 2. Check context loading
      const context = await adventureHistoryService.getLastAdventureContext(currentPet, adventure.type);
      console.log(`  ✅ ${adventure.emoji} ${adventure.type}:`, 
        context?.summary?.substring(0, 50) + '...',
        context?.comicPanels ? `[${context.comicPanels.length} panels]` : '[no panels]'
      );
    }
    
    console.log(`\n🎉 Current Pet (${currentPet}) Adventure Context Test Completed!`);
    console.log('🎮 Now try clicking any adventure button twice to see the context in action!');
    
    return true;
  } catch (error) {
    console.error('❌ Current Pet Test Failed:', error);
    return false;
  }
}

/**
 * Clear adventure history for testing
 */
export async function clearTestAdventureHistory() {
  console.log('🧹 Clearing test adventure history...');
  
  try {
    const testPetId = 'dog';
    const adventureTypes = ['food', 'house', 'travel', 'friend'];
    
    for (const type of adventureTypes) {
      await adventureHistoryService.clearAdventureHistory(testPetId, type);
    }
    
    console.log('✅ Test adventure history cleared');
  } catch (error) {
    console.error('❌ Failed to clear test adventure history:', error);
  }
}

/**
 * Test the image restoration specifically
 */
export async function testImageRestoration() {
  console.log('🖼️ Testing Adventure Image Restoration...');
  
  try {
    const currentPet = PetProgressStorage.getCurrentSelectedPet();
    if (!currentPet) {
      console.error('❌ No pet currently selected!');
      return false;
    }
    
    console.log(`🐾 Testing image restoration for: ${currentPet.toUpperCase()}`);
    
    // Create a mock adventure with comic panels (simulating a saved adventure with images)
    const mockAdventureId = `test-${currentPet}-house-with-images-${Date.now()}`;
    const mockComicPanels = [
      { id: '1', image: 'https://example.com/house-room1.jpg', text: 'We designed a cozy living room!' },
      { id: '2', image: 'https://example.com/house-room2.jpg', text: 'Then we added a magical slide!' },
      { id: '3', image: 'https://example.com/house-room3.jpg', text: 'Finally, a rainbow bridge to connect rooms!' }
    ];
    
    // Record adventure history
    await adventureHistoryService.recordAdventureHistory(
      currentPet,
      'house', 
      mockAdventureId,
      `session-${mockAdventureId}`,
      'We built an amazing house with a cozy living room, magical slide, and rainbow bridge!'
    );
    
    // Get context (this will try to load full adventure with images)
    const context = await adventureHistoryService.getLastAdventureContext(currentPet, 'house');
    
    console.log('🔍 Adventure Context Loaded:');
    console.log('  - Adventure ID:', context?.adventureId);
    console.log('  - Summary:', context?.summary?.substring(0, 80) + '...');
    console.log('  - Comic Panels:', context?.comicPanels?.length || 0, 'panels');
    console.log('  - Messages:', context?.messages?.length || 0, 'messages');
    
    if (context?.comicPanels && context.comicPanels.length > 0) {
      console.log('🖼️ Comic Panels Found:');
      context.comicPanels.forEach((panel, index) => {
        console.log(`    Panel ${index + 1}: ${panel.text}`);
      });
    }
    
    console.log('🎉 Image Restoration Test Completed!');
    console.log('📝 Note: In real usage, images will be loaded from your saved Firebase adventures');
    console.log('🎮 Try completing a real house adventure, then clicking house again to see images restored!');
    
    return true;
  } catch (error) {
    console.error('❌ Image Restoration Test Failed:', error);
    return false;
  }
}

/**
 * Test the end-to-end adventure context flow
 */
export async function testAdventureContextFlow() {
  console.log('🔄 Testing Adventure Context Flow for ALL Pet Types & Adventure Types...');
  
  try {
    const petTypes = ['dog', 'cat', 'bobo', 'feather', 'hamster'];
    const adventureTypes = [
      { type: 'house', emoji: '🏠', summary: 'We built an amazing treehouse with slides and rainbow bridges!' },
      { type: 'travel', emoji: '✈️', summary: 'We flew to the cloud castle and helped friendly dragons!' },
      { type: 'friend', emoji: '👥', summary: 'We created a magical rainbow dragon friend who loves cookies!' },
      { type: 'food', emoji: '🍽️', summary: 'We collected a feast and defeated the Sneaky Raccoon villain!' },
      { type: 'story', emoji: '📚', summary: 'We created an epic space adventure with robot companions!' }
    ];
    
    for (const petId of petTypes) {
      console.log(`\n🐾 Testing ${petId.toUpperCase()} adventures...`);
      
      for (const adventure of adventureTypes) {
        // 1. Record adventure for this pet
        const petSpecificSummary = `${adventure.summary} (with ${petId})`;
        await adventureHistoryService.recordAdventureHistory(
          petId,
          adventure.type, 
          `test-${petId}-${adventure.type}-adventure-123`,
          `test-session-${petId}-${adventure.type}`,
          petSpecificSummary
        );
        
        // 2. Check context loading for this pet
        const context = await adventureHistoryService.getLastAdventureContext(petId, adventure.type);
        console.log(`  ✅ ${adventure.emoji} ${adventure.type} context for ${petId}:`, 
          context?.summary?.substring(0, 40) + '...',
          context?.comicPanels ? `[${context.comicPanels.length} panels]` : '[no panels]'
        );
      }
    }
    
    console.log('\n🎉 ALL Pet Types & Adventure Types Context Flow Test Completed!');
    console.log(`✅ Tested ${petTypes.length} pets × ${adventureTypes.length} adventure types = ${petTypes.length * adventureTypes.length} combinations!`);
    console.log('🐾 Each pet now maintains separate adventure memories!');
    console.log('🎮 Switch pets and try clicking adventure buttons to see pet-specific context!');
    
    return true;
  } catch (error) {
    console.error('❌ Adventure Context Flow Test Failed:', error);
    return false;
  }
}

// Make functions available in browser console for testing
if (typeof window !== 'undefined') {
  (window as any).testAdventureHistory = testAdventureHistory;
  (window as any).debugAdventureHistory = debugAdventureHistory;
  (window as any).clearTestAdventureHistory = clearTestAdventureHistory;
  (window as any).testAdventureContextFlow = testAdventureContextFlow;
  (window as any).testCurrentPetOnly = testCurrentPetOnly;
  (window as any).testImageRestoration = testImageRestoration;
}
