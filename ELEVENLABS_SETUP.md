# ElevenLabs Voice Agent Setup

This application now uses ElevenLabs for voice agent functionality instead of OpenAI TTS.

## Environment Variables Required

Add the following environment variable to your `.env` file:

```bash
VITE_ELEVENLABS_AGENT_ID=your_elevenlabs_agent_id
```

## How to Get Your Agent ID

1. Go to [ElevenLabs Console](https://elevenlabs.io/)
2. Navigate to your agents
3. Create a new agent or use an existing one
4. Copy the Agent ID from the agent settings

## Features

- **Hidden Integration**: The ElevenLabs voice agent runs as a hidden component with no UI
- **Network Calls Only**: Uses ElevenLabs React SDK for voice conversations
- **Microphone Access**: Automatically requests microphone permission when needed
- **Fallback Support**: Gracefully handles initialization failures

## Usage

The voice agent service maintains the same API as before:

```typescript
import { voiceAgentService } from './lib/voice-agent-service';

// Handle incorrect answers with voice feedback
await voiceAgentService.handleIncorrectAnswer(
  questionId, 
  correctAnswer, 
  userAnswer, 
  questionContext
);

// Speak text directly
await voiceAgentService.speak("Hello world");

// Check if currently speaking
const isSpeaking = voiceAgentService.isCurrentlySpeaking();
```

## Component Integration

The `ElevenLabsVoiceAgent` component is automatically mounted in `App.tsx` and runs in the background. It:

- Initializes the ElevenLabs conversation
- Handles microphone permissions
- Provides voice functionality to the rest of the app
- Remains completely hidden from the user interface
