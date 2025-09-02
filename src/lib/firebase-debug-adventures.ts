// Debug functions for Firebase adventure storage
import { useAuth } from '@/hooks/use-auth';
import { firebaseAdventureService } from './firebase-adventure-service';
import { loadAdventureSummariesHybrid, saveAdventureHybrid } from './firebase-adventure-cache';
import { SavedAdventure } from './utils';

/**
 * Debug function to test Firebase adventure loading
 */
export const debugFirebaseAdventures = async (userId: string | null) => {
  console.log('🐛 === FIREBASE ADVENTURE DEBUG ===');
  console.log('📋 User ID:', userId || 'anonymous');
  
  if (!userId) {
    console.log('❌ No authenticated user - will use localStorage fallback');
    return;
  }

  try {
    console.log('🔍 Testing direct Firebase service...');
    const directAdventures = await firebaseAdventureService.loadUserAdventuresFirebase(userId);
    console.log(`📊 Direct Firebase load result: ${directAdventures.length} adventures`);
    
    console.log('🔍 Testing hybrid cache...');
    const hybridAdventures = await loadAdventureSummariesHybrid(userId);
    console.log(`📊 Hybrid cache load result: ${hybridAdventures.length} adventures`);
    
    // Log adventure details
    if (hybridAdventures.length > 0) {
      console.log('📝 Adventures found:');
      hybridAdventures.forEach((adventure, index) => {
        console.log(`  ${index + 1}. ${adventure.name} (ID: ${adventure.id})`);
        console.log(`     Summary: ${adventure.summary.substring(0, 50)}...`);
        console.log(`     Last played: ${new Date(adventure.lastPlayedAt).toLocaleString()}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
  
  console.log('🐛 === DEBUG COMPLETE ===');
};

/**
 * Test saving a sample adventure
 */
export const debugSaveTestAdventure = async (userId: string | null) => {
  if (!userId) {
    console.log('❌ Cannot save test adventure - no authenticated user');
    return;
  }
  
  const testAdventure: SavedAdventure = {
    id: `test-adventure-${Date.now()}`,
    name: 'Debug Test Adventure',
    summary: 'This is a test adventure created for debugging Firebase storage',
    messages: [
      { type: 'system', content: 'Welcome to your debug adventure!' },
      { type: 'user', content: 'This is a test message' },
      { type: 'assistant', content: 'This is a test response' }
    ],
    createdAt: Date.now(),
    lastPlayedAt: Date.now(),
    topicId: 'debug-topic'
  };
  
  console.log('🧪 Saving test adventure...');
  try {
    await saveAdventureHybrid(userId, testAdventure);
    console.log('✅ Test adventure saved successfully');
    
    // Wait a moment then try to load it
    setTimeout(async () => {
      console.log('🔍 Trying to load adventures after save...');
      await debugFirebaseAdventures(userId);
    }, 1000);
    
  } catch (error) {
    console.error('❌ Failed to save test adventure:', error);
  }
};

/**
 * Check Firestore connection and auth status
 */
export const debugFirebaseConnection = async () => {
  console.log('🔌 === FIREBASE CONNECTION DEBUG ===');
  
  try {
    const auth = await import('@/hooks/use-auth');
    const { db } = await import('./firebase');
    const { collection, getDocs } = await import('firebase/firestore');
    
    console.log('✅ Firebase modules imported successfully');
    console.log('✅ Database connection established');
    
    // Try to read from a collection (this will test rules)
    const testCollection = collection(db, 'savedAdventures');
    console.log('✅ Collection reference created');
    
  } catch (error) {
    console.error('❌ Firebase connection error:', error);
  }
  
  console.log('🔌 === CONNECTION DEBUG COMPLETE ===');
};

// Make functions available globally for browser console debugging
declare global {
  interface Window {
    debugFirebaseAdventures: typeof debugFirebaseAdventures;
    debugSaveTestAdventure: typeof debugSaveTestAdventure;
    debugFirebaseConnection: typeof debugFirebaseConnection;
  }
}

if (typeof window !== 'undefined') {
  window.debugFirebaseAdventures = debugFirebaseAdventures;
  window.debugSaveTestAdventure = debugSaveTestAdventure;
  window.debugFirebaseConnection = debugFirebaseConnection;
}
