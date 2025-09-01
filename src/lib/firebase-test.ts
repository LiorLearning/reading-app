// Quick test for Firebase Storage
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export const testFirebaseStorage = async (): Promise<void> => {
  try {
    console.log('🧪 Testing Firebase Storage...');
    
    // Create a test blob (small text file)
    const testContent = 'Hello Firebase Storage!';
    const testBlob = new Blob([testContent], { type: 'text/plain' });
    
    // Upload to Firebase Storage
    const testRef = ref(storage, 'test/firebase-test.txt');
    console.log('📤 Uploading test file...');
    
    const uploadResult = await uploadBytes(testRef, testBlob);
    console.log('✅ Upload successful:', uploadResult);
    
    // Get download URL
    const downloadURL = await getDownloadURL(uploadResult.ref);
    console.log('🔗 Download URL:', downloadURL);
    
    console.log('🎉 Firebase Storage test completed successfully!');
  } catch (error) {
    console.error('❌ Firebase Storage test failed:', error);
    
    // Provide specific error guidance
    if (error instanceof Error) {
      if (error.message.includes('storage/unauthorized')) {
        console.error('💡 Fix: Update Firebase Storage Rules to allow writes');
      } else if (error.message.includes('storage/unknown')) {
        console.error('💡 Fix: Check Firebase configuration and make sure Storage is enabled');
      }
    }
  }
};

// Add this to window for easy browser console testing
if (typeof window !== 'undefined') {
  (window as any).testFirebaseStorage = testFirebaseStorage;
}
