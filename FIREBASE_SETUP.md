# Firebase Authentication Setup Guide

This guide will help you set up Firebase authentication for your reading app and deploy it on Vercel.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or select an existing project
3. Follow the setup wizard to create your project

## Step 2: Enable Authentication

1. In your Firebase console, go to **Authentication** in the left sidebar
2. Click on **Get started**
3. Go to the **Sign-in method** tab
4. Enable the following sign-in providers:
   - **Email/Password**: Click to enable
   - **Google**: Click to enable and configure (you'll need to add your domain)

## Step 3: Configure Authorized Domains

1. In the **Sign-in method** tab, scroll down to **Authorized domains**
2. Add your domains:
   - For local development: `localhost`
   - For Vercel: Your Vercel domain (e.g., `your-app.vercel.app`)
   - Any custom domains you plan to use

## Step 4: Get Firebase Configuration

1. Go to **Project Settings** (gear icon in the left sidebar)
2. Scroll down to **Your apps** section
3. Click on the **Web** app icon (`</>`) to create a web app
4. Register your app with a name (e.g., "Reading App")
5. Copy the configuration values

## Step 5: Set Up Firestore Database

1. Go to **Firestore Database** in the left sidebar
2. Click **Create database**
3. Choose **Start in test mode** (you can secure it later)
4. Select a location close to your users

## Step 6: Configure Environment Variables

### For Local Development:
1. Create a `.env.local` file in your project root
2. Copy the values from `.env.example` and replace with your Firebase config:

```env
VITE_FIREBASE_API_KEY=your_actual_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### For Vercel Deployment:
1. Go to your Vercel dashboard
2. Select your project or import it from GitHub
3. Go to **Settings** > **Environment Variables**
4. Add each environment variable:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

## Step 7: Update Firebase Security Rules

### Firestore Security Rules

Update your Firestore security rules to allow authenticated users to read/write their own data:

1. Go to **Firestore Database** > **Rules** in Firebase Console
2. Replace with:

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

### Firebase Storage Security Rules

**CRITICAL:** Also configure Firebase Storage rules for image access:

1. Go to **Storage** > **Rules** in Firebase Console
2. Replace with:

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // Allow authenticated users to read and write their own adventure images
    match /adventure-images/{userId}/{adventureId}/{imageFile} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow authenticated users to read their own test files
    match /test/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
    
    // Temporary: Allow all authenticated users to read images (for development)
    // Remove this in production and use specific rules above
    match /{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

3. Click **Publish** for both Firestore and Storage rules

## Step 8: Deploy to Vercel

1. **Using Vercel CLI:**
   ```bash
   npm install -g vercel
   vercel
   ```

2. **Using GitHub Integration:**
   - Push your code to GitHub
   - Go to [Vercel Dashboard](https://vercel.com/)
   - Click "New Project"
   - Import your GitHub repository
   - Configure environment variables
   - Deploy

## Step 9: Test Your Application

1. Visit your deployed app
2. Try signing up with email/password
3. Try signing in with Google
4. Complete the onboarding process
5. Verify data is saved to Firestore

## Common Issues and Solutions

### CORS Errors
- Make sure your domain is added to Firebase authorized domains
- Check that your environment variables are correctly set

### Authentication Not Working
- Verify all environment variables are set correctly
- Check Firebase console for any error logs
- Make sure authentication providers are enabled

### Firestore Permission Denied
- Update your security rules to allow authenticated users
- Make sure you're signed in when trying to write data

### Preview Images Not Loading (403 Errors)
- Configure Firebase Storage security rules (see Step 7)
- Ensure you're signed in when viewing images
- Check browser console for specific storage permission errors

## Security Best Practices

1. **Firestore Rules**: Always secure your database with proper rules
2. **API Keys**: Firebase API keys are safe to expose in client-side code
3. **Environment Variables**: Use Vercel's environment variable system
4. **Domain Restrictions**: Only add necessary domains to authorized domains list

## Support

If you encounter issues:
1. Check the Firebase console for error logs
2. Check browser developer tools for client-side errors
3. Verify environment variables are correctly set
4. Test authentication methods individually

Your reading app should now be fully integrated with Firebase authentication and deployed on Vercel!
