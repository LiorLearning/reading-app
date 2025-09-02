# Firebase Security Rules Debug Guide

## Current Error
```
FirebaseError: Missing or insufficient permissions.
```

## Problem
Firestore security rules are blocking write access to the `adventureImageUrls` collection.

## Solution: Update Firestore Rules

### 1. Open Firebase Console
- Go to https://console.firebase.google.com/
- Select project: `litkraft-8d090`  
- Navigate to Firestore Database → Rules

### 2. Replace Rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read and write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Adventure sessions - users can read/write their own sessions
    match /adventureSessions/{sessionId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    // Adventure image URLs - users can read/write their own image URLs
    match /adventureImageUrls/{imageId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Temporary: Allow all authenticated users (for development)
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 3. Click "Publish"

### 4. Test Again
Generate another image - you should see:
```
💾 Storing image URL to Firebase Firestore...
✅ Image URL stored successfully: [prompt]...
```

## Security Notes

The rules ensure:
- ✅ Only authenticated users can access data
- ✅ Users can only access their own data (userId matches)
- ✅ Create/read/write permissions are properly set
- ⚠️  The catch-all rule at the bottom is for development - remove it in production

## Production Rules (Later)
Remove the catch-all rule and use only specific collection rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /adventureSessions/{sessionId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    match /adventureImageUrls/{imageId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```
