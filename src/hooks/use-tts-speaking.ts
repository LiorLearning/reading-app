import { useState, useEffect } from 'react';
import { ttsService } from '@/lib/tts-service';

export const useTTSSpeaking = (messageId: string) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    // Check initial state
    setIsSpeaking(ttsService.isMessageSpeaking(messageId));

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
