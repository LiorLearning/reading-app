import { useCallback, useRef } from 'react';
import { useConversation } from '@elevenlabs/react';

interface VoiceFeedbackOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: (message: string) => void;
  onError?: (error: Error) => void;
}

export function useVoiceFeedback(options: VoiceFeedbackOptions = {}) {
  const conversationRef = useRef<any>(null);
  const isConnectedRef = useRef(false);

  const conversation = useConversation();

  conversationRef.current = conversation;

  const startVoiceFeedback = useCallback(async (message?: string) => {
    try {
      console.log('🚀 Starting ElevenLabs voice feedback connection...');
      
      // Request microphone permission if not already granted
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✅ Microphone permission granted');

      // Start the conversation with the new API
      const conversationId = await conversation.startSession({
        agentId: 'agent_9201k5451jf1fm0tb2hwt9p6yf24', // Hardcoded agent ID
        connectionType: 'webrtc', // Use WebRTC connection
        userId: 'reading-app-user'
      });

      console.log('🎉 Voice feedback connected with ElevenLabs! ID:', conversationId);
      isConnectedRef.current = true;
      options.onConnect?.();

      // If a message is provided, send it after a short delay
      if (message && conversation.sendUserMessage) {
        console.log('📤 Sending feedback message to ElevenLabs agent:', message);
        setTimeout(() => {
          conversation.sendUserMessage(message);
        }, 1000);
      }

    } catch (error) {
      console.error('❌ Failed to start voice feedback:', error);
      isConnectedRef.current = false;
      
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          console.warn('⚠️ Microphone permission denied for voice feedback');
        } else if (error.name === 'NotFoundError') {
          console.warn('⚠️ No microphone found for voice feedback');
        }
        options.onError?.(error);
      }
    }
  }, [conversation, options]);

  const stopVoiceFeedback = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (error) {
      console.error('Failed to stop voice feedback:', error);
    }
  }, [conversation]);

  const sendVoiceMessage = useCallback(async (message: string) => {
    if (!isConnectedRef.current || !conversation.sendUserMessage) {
      console.warn('Cannot send voice message: not connected or sendUserMessage not available');
      return;
    }

    try {
      await conversation.sendUserMessage(message);
    } catch (error) {
      console.error('Failed to send voice message:', error);
    }
  }, [conversation]);

  const triggerIncorrectAnswerFeedback = useCallback(async (userAnswer: string, correctAnswer: string, question: string) => {
    const feedbackMessage = `The user answered "${userAnswer}" but the correct answer is "${correctAnswer}". The question was: "${question}". Please provide encouraging feedback and help them understand the correct answer.`;
    
    console.log('🎤 Triggering voice feedback for incorrect answer:', {
      userAnswer,
      correctAnswer,
      question,
      isConnected: isConnectedRef.current
    });
    
    if (isConnectedRef.current) {
      console.log('📡 Sending message to existing voice connection');
      await sendVoiceMessage(feedbackMessage);
    } else {
      console.log('🔌 Starting new voice connection with ElevenLabs');
      await startVoiceFeedback(feedbackMessage);
    }
  }, [startVoiceFeedback, sendVoiceMessage]);

  return {
    conversation,
    isConnected: isConnectedRef.current,
    isSpeaking: conversation.isSpeaking,
    startVoiceFeedback,
    stopVoiceFeedback,
    sendVoiceMessage,
    triggerIncorrectAnswerFeedback
  };
}
