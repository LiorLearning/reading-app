import { useState, useEffect } from 'react';
import { ttsService } from '@/lib/tts-service';

export const useTTSSpeaking = (messageId: string) => {
  // Use lazy initializer to get initial state safely
  const [isSpeaking, setIsSpeaking] = useState(() => 
    ttsService.isMessageSpeaking(messageId)
  );

  useEffect(() => {
    // Listen for speaking state changes
    const handleSpeakingStateChange = (currentSpeakingMessageId: string | null) => {
      setIsSpeaking(currentSpeakingMessageId === messageId);
    };

    ttsService.addSpeakingStateListener(handleSpeakingStateChange);

    // Cleanup listener on unmount
    return () => {
      ttsService.removeSpeakingStateListener(handleSpeakingStateChange);
    };
  }, [messageId]);

  return isSpeaking;
};
