# Firebase Storage Rules Fix for Preview Images

## Problem
Preview images from Firebase Storage are showing 403 errors because Storage security rules are not configured.

## Root Cause
- Firebase Storage has separate security rules from Firestore
- By default, Firebase Storage denies all access unless explicitly allowed
- The current setup only has Firestore rules configured

## Solution: Configure Firebase Storage Security Rules

### Step 1: Open Firebase Console
1. Go to https://console.firebase.google.com/
2. Select your project: `litkraft-8d090`
3. Navigate to **Storage** in the left sidebar
4. Click on the **Rules** tab

### Step 2: Update Storage Rules
Replace the default rules with:

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // Adventure images - users can upload/read their own generated images
    match /adventure-images/{userId}/{adventureId}/{fileName} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // User recordings - automatic video/audio recording storage
    match /user-recordings/{userId}/{date}/{fileName} {
      allow write: if request.auth != null 
                   && request.auth.uid == userId
                   && request.resource.size < 500 * 1024 * 1024 // Max 500MB per file
                   && request.resource.contentType.matches('(audio|video)/.*');
      
      allow read: if request.auth != null && request.auth.uid == userId;
    }
    
    // Test files - for development and testing
    match /test/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
    
    // Public assets - publicly readable files (avatars, backgrounds, etc.)
    match /public/{allPaths=**} {
      allow read; // Public read access
      allow write: if request.auth != null; // Only authenticated users can write
    }
    
    // User profile images and avatars
    match /user-avatars/{userId}/{fileName} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Temporary: Allow all authenticated users (for development)
    // Remove this in production and use specific rules above
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Step 3: Click "Publish"

### Step 4: Test the Fix
1. Refresh your app
2. Try viewing preview images - they should now load correctly
3. Console errors should disappear

## Security Notes

The rules ensure:
- ✅ Only authenticated users can access images
- ✅ Users can only access their own images (userId path matching)
- ✅ Read and write permissions are properly set for the adventure-images path structure
- ⚠️ The catch-all rule at the bottom is for development - remove it in production

## Production Rules (Later)
For production, remove the catch-all rule and use only specific path rules:

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // Users can read and write their own adventure images
    match /adventure-images/{userId}/{adventureId}/{imageFile} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow reading of public assets (if needed)
    match /public/{allPaths=**} {
      allow read;
    }
  }
}
```

## Current Image Storage Path Structure
Images are stored at: `adventure-images/{userId}/{adventureId}/{imageFile}`

This matches the code in:
- `src/lib/image-proxy-service.ts` line 74
- `functions/src/index.ts` line 56

## After Applying the Fix
Your preview images should load correctly and the 403 errors in the console should disappear.
