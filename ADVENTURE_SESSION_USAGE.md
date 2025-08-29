# Adventure Session Tracking Integration

This integration adds optional Firebase session tracking to your reading app without breaking any existing functionality.

## What Gets Tracked

### Automatic Tracking (No Code Changes Needed)
- ✅ **New Adventure Sessions**: When user clicks "New Adventure"
- ✅ **Continue Adventure Sessions**: When user clicks "Continue Adventure" 
- ✅ **Specific Adventure Sessions**: When user resumes a saved adventure
- ✅ **Chat Messages**: All user and AI messages automatically saved
- ✅ **Adventure State**: Question mode, access permissions, prompt counts

### Optional MCQ Tracking

To track MCQ answers in your existing components, you can optionally use the `useSessionMCQTracker` hook:

```typescript
// In your MCQ component (optional enhancement)
import { useSessionMCQTracker } from '@/hooks/use-session-mcq-tracker';

const MyMCQComponent = ({ currentSessionId }: { currentSessionId?: string | null }) => {
  const { trackMCQAnswer } = useSessionMCQTracker(currentSessionId);
  
  const handleAnswerSubmit = async (questionId: number, selectedAnswer: number, isCorrect: boolean) => {
    // Your existing logic first
    recordAnswer(questionId, isCorrect, selectedAnswer);
    
    // Optional Firebase tracking (won't break if it fails)
    await trackMCQAnswer(questionId, selectedAnswer, isCorrect, currentQuestion.topicId);
  };
  
  // ... rest of component
};
```

## Session Flow

### 1. New Adventure
```
User clicks "New Adventure" 
→ handleStartAdventure('topicId', 'new') 
→ Firebase session created with type: 'new_adventure'
→ All subsequent chats/questions tracked to this session
```

### 2. Continue Adventure  
```
User clicks "Continue Adventure"
→ handleStartAdventure('topicId', 'continue')
→ Firebase session created with type: 'continue_adventure' 
→ All subsequent chats/questions tracked to this session
```

### 3. Resume Specific Adventure
```
User clicks specific saved adventure
→ handleContinueSpecificAdventure('adventureId')
→ Firebase session created with type: 'continue_specific'
→ All subsequent chats/questions tracked to this session
```

## Data Structure

Each Firebase session contains:

```typescript
interface AdventureSession {
  id: string;
  userId: string;
  sessionType: 'new_adventure' | 'continue_adventure' | 'continue_specific';
  adventureId: string;
  topicId: string;
  title: string;
  
  // Chat tracking
  chatMessages: ChatMessage[];
  totalChatMessages: number;
  
  // Question tracking (optional)
  mcqAnswers: MCQAnswer[];
  totalQuestionsAnswered: number;
  correctAnswers: number;
  
  // Adventure state
  adventureMode: 'new' | 'continue';
  isInQuestionMode: boolean;
  canAccessQuestions: boolean;
  adventurePromptCount: number;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastActivityAt: Timestamp;
}
```

## Firestore Security Rules

Add these rules to your Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read and write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can read and write their own adventure sessions
    match /adventureSessions/{sessionId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && 
        request.auth.uid == request.resource.data.userId;
    }
  }
}
```

## Key Features

### Non-Breaking Design
- ✅ All Firebase operations are wrapped in try-catch
- ✅ If Firebase fails, app continues working normally
- ✅ No changes to core function signatures
- ✅ Existing local storage and state management unchanged
- ✅ Graceful degradation when offline

### Analytics Ready
Access user session analytics:

```typescript
// Get user's learning analytics
const analytics = await adventureSessionService.getUserSessionAnalytics(userId);
console.log(analytics);
// {
//   totalSessions: 15,
//   totalChatMessages: 234,
//   totalQuestionsAnswered: 45,
//   averageAccuracy: 78,
//   mostActiveTopics: ['space-adventure', 'dragon-quest']
// }
```

## Current Implementation Status

- ✅ Adventure session service created
- ✅ Session creation integrated for all adventure flows
- ✅ Chat message tracking implemented
- ✅ Adventure state syncing implemented  
- ✅ Optional MCQ tracking hook created
- ⏳ Firestore security rules need to be applied
- ⏳ Testing needed

## Testing the Integration

1. **Start New Adventure**: Check Firebase console for new session with type `new_adventure`
2. **Send Chat Messages**: Verify messages appear in session's `chatMessages` array
3. **Continue Adventure**: Check new session created with type `continue_adventure`
4. **Resume Saved Adventure**: Check session created with type `continue_specific`
5. **Answer Questions**: If using optional MCQ tracker, verify answers in `mcqAnswers` array

The app will work exactly the same as before, but now you have detailed session analytics in Firebase!

