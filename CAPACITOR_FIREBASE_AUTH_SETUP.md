# Capacitor Firebase Authentication Setup for iOS (Apple Sign-In Only)

This document outlines all configuration changes needed to integrate `@capacitor-firebase/authentication` for Apple Sign-In on iOS devices.

**Note:** Google Sign-In continues to use web Firebase Auth. Only Apple Sign-In uses Capacitor Firebase Auth on native platforms.

## Prerequisites
- ✅ `@capacitor-firebase/authentication` package installed
- ✅ Firebase project configured
- ✅ iOS project exists in `ios/` directory

---

## 1. iOS Configuration Files

### A. Podfile (`ios/App/Podfile`)

Add Firebase Auth to your Podfile:

```ruby
target 'App' do
  capacitor_pods
  # Add your Pods here
  pod 'Firebase/Auth'
end
```

**After modifying Podfile, run:**
```bash
cd ios/App
pod install
```

---

### B. GoogleService-Info.plist

1. Download `GoogleService-Info.plist` from Firebase Console:
   - Go to Firebase Console → Project Settings → Your apps
   - Select your iOS app (or create one if needed)
   - Download `GoogleService-Info.plist`

2. Add to Xcode project:
   - Open `ios/App/App.xcworkspace` in Xcode
   - Right-click on the "App" folder → "Add Files to 'App'"
   - Select `GoogleService-Info.plist`
   - Ensure "Copy items if needed" is checked
   - Ensure it's added to the App target

---

### C. Info.plist URL Schemes

In Xcode:
1. Select your project in the navigator
2. Select the "App" target
3. Go to the "Info" tab
4. Expand "URL Types" section
5. Click "+" to add a new URL type
6. Set:
   - **Identifier**: `com.googleusercontent.apps.YOUR_REVERSED_CLIENT_ID`
   - **URL Schemes**: The value from `REVERSED_CLIENT_ID` in `GoogleService-Info.plist`

**To find REVERSED_CLIENT_ID:**
- Open `GoogleService-Info.plist` in a text editor
- Look for the key `<key>REVERSED_CLIENT_ID</key>`
- Copy the value from `<string>...</string>` below it

**Example:**
If `REVERSED_CLIENT_ID` is `com.googleusercontent.apps.123456789-abcdefg`, add that exact value to URL Schemes.

---

### D. AppDelegate.swift (`ios/App/App/AppDelegate.swift`)

Update your `AppDelegate.swift` to handle authentication URLs:

```swift
import UIKit
import Capacitor
import FirebaseCore

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Initialize Firebase
        FirebaseApp.configure()
        
        return true
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Handle authentication callbacks
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    // ... rest of your AppDelegate code
}
```

**Key changes:**
- Import `FirebaseCore`
- Call `FirebaseApp.configure()` in `didFinishLaunchingWithOptions`
- Add `application(_:open:options:)` method to handle URL callbacks

---

## 2. Code Changes

### A. Update `src/lib/firebase.ts`

Modify to use Capacitor Firebase Auth on native platforms:

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
// Use Capacitor Firebase Auth on native platforms, web Firebase Auth on web
let auth;
if (Capacitor.isNativePlatform()) {
  // On native platforms, initialize Capacitor Firebase Auth
  FirebaseAuthentication.initialize({ skipNativeAuth: false });
  auth = getAuth(app);
} else {
  // On web, use standard Firebase Auth
  auth = getAuth(app);
}

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Storage and get a reference to the service
export const storage = getStorage(app);

export { auth };
export default app;
```

---

### B. Update `src/hooks/use-auth.tsx`

Modify authentication methods to use Capacitor Firebase Auth on native platforms:

**Add imports at the top:**
```typescript
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
```

**Update `signInWithGoogle` method:**

Find the `signInWithGoogle` function and replace it with:

```typescript
const signInWithGoogle = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      // Use Capacitor Firebase Auth for native platforms
      const result = await FirebaseAuthentication.signInWithGoogle();
      
      if (result.user) {
        // Get the credential and sign in with Firebase
        const credential = GoogleAuthProvider.credential(
          result.user.idToken,
          result.user.accessToken
        );
        await signInWithCredential(auth, credential);
      }
    } else {
      // Use web Firebase Auth
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    }
  } catch (error: any) {
    console.error('Google sign-in error:', error);
    throw error;
  }
};
```

**Update `signInWithApple` method:**

Find the `signInWithApple` function and replace it with:

```typescript
const signInWithApple = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      // Use Capacitor Firebase Auth for native platforms
      const result = await FirebaseAuthentication.signInWithApple();
      
      if (result.user) {
        // Get the credential and sign in with Firebase
        const provider = new OAuthProvider('apple.com');
        const credential = provider.credential({
          idToken: result.user.idToken!,
          rawNonce: result.user.nonce,
        });
        await signInWithCredential(auth, credential);
      }
    } else {
      // Use web Firebase Auth
      const provider = new OAuthProvider('apple.com');
      await signInWithPopup(auth, provider);
    }
  } catch (error: any) {
    console.error('Apple sign-in error:', error);
    throw error;
  }
};
```

**Update `signOut` method:**

Find the `signOut` function and add Capacitor sign out:

```typescript
const signOut = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      // Sign out from Capacitor Firebase Auth
      await FirebaseAuthentication.signOut();
    }
    // Sign out from Firebase Auth (works for both web and native)
    await firebaseSignOut(auth);
    
    // Clear local state
    setUser(null);
    setUserData(null);
    setHasGoogleAccount(false);
    
    // Clear local storage
    PetProgressStorage.clearAll();
    CoinSystem.clearCoins();
    
    // Navigate to welcome page
    window.location.href = '/';
  } catch (error: any) {
    console.error('Sign out error:', error);
    throw error;
  }
};
```

---

## 3. Package.json Dependencies

Ensure you have these dependencies:

```json
{
  "dependencies": {
    "@capacitor/core": "^5.0.0",
    "@capacitor-firebase/authentication": "^1.0.0",
    "firebase": "^12.2.1"
  }
}
```

---

## 4. Environment Variables

Ensure your `.env` file has all Firebase configuration variables:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

---

## 5. Firebase Console Configuration

### Enable Sign-in Methods:
1. Go to Firebase Console → Authentication → Sign-in method
2. Enable **Apple** sign-in provider (for iOS)
3. Configure OAuth consent screen if needed
4. **Note:** Google Sign-In continues to work via web Firebase Auth

### Add iOS App (if not already added):
1. Firebase Console → Project Settings → Your apps
2. Click iOS icon to add iOS app
3. Enter your iOS bundle ID
4. Download `GoogleService-Info.plist`

---

## 6. Testing Checklist

After making all changes:

- [ ] Run `pod install` in `ios/App` directory
- [ ] Build iOS app in Xcode
- [ ] Test Apple sign-in on iOS device/simulator
- [ ] Verify Google sign-in still works (uses web Firebase Auth)
- [ ] Test sign-out functionality
- [ ] Verify authentication state persists across app restarts

---

## Notes

- **Do NOT run `npx cap sync` or `npx cap copy`** - you'll handle that manually
- The Capacitor Firebase Auth plugin handles native authentication flows
- Web authentication continues to use standard Firebase Auth
- Make sure `GoogleService-Info.plist` is properly added to Xcode project
- URL Schemes must match the `REVERSED_CLIENT_ID` exactly

---

## Troubleshooting

**Issue: "No Firebase App '[DEFAULT]' has been created"**
- Ensure `FirebaseApp.configure()` is called in `AppDelegate.swift`

**Issue: Sign-in redirects don't work**
- Verify URL Schemes are correctly configured in Info.plist
- Ensure `application(_:open:options:)` is implemented in AppDelegate

**Issue: Pod install fails**
- Make sure you're in the `ios/App` directory
- Try `pod deintegrate` then `pod install`
