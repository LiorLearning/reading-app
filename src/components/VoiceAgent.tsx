'use client';

import { useConversation } from '@elevenlabs/react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

interface VoiceAgentProps {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: (message: string) => void;
  onError?: (error: Error) => void;
  autoTrigger?: boolean; // If true, automatically trigger voice feedback
  triggerMessage?: string; // Message to send to agent when triggered
}

export function VoiceAgent({
  onConnect,
  onDisconnect,
  onMessage,
  onError,
  autoTrigger = false,
  triggerMessage
}: VoiceAgentProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const conversation = useConversation();

  // Check microphone permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setHasPermission(result.state === 'granted');
        
        // Also try to get user media to ensure permission
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          setHasPermission(true);
        } catch (err) {
          setHasPermission(false);
        }
      } catch (error) {
        console.log('Permission check failed, will request on first use');
        setHasPermission(null);
      }
    };

    checkPermission();
  }, []);

  const startConversation = useCallback(async () => {
    try {
      setIsConnecting(true);
      
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasPermission(true);

      // Start the conversation with the new API
      const conversationId = await conversation.startSession({
        agentId: 'agent_9201k5451jf1fm0tb2hwt9p6yf24', // Hardcoded agent ID as requested
        connectionType: 'webrtc', // Use WebRTC connection
        userId: 'reading-app-user' // Custom user ID for tracking
      });

      console.log('Voice agent connected with ID:', conversationId);
      setIsConnected(true);
      setIsConnecting(false);
      onConnect?.();

    } catch (error) {
      console.error('Failed to start conversation:', error);
      setIsConnecting(false);
      setHasPermission(false);
      
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          alert('Microphone permission denied. Please allow microphone access to use voice features.');
        } else if (error.name === 'NotFoundError') {
          alert('No microphone found. Please connect a microphone to use voice features.');
        } else {
          alert(`Failed to start voice conversation: ${error.message}`);
        }
      }
    }
  }, [conversation, onConnect]);

  const stopConversation = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (error) {
      console.error('Failed to stop conversation:', error);
    }
  }, [conversation]);

  const sendMessage = useCallback(async (message: string) => {
    if (!isConnected || !conversation.sendUserMessage) {
      console.warn('Cannot send message: not connected or sendUserMessage not available');
      return;
    }

    try {
      await conversation.sendUserMessage(message);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, [isConnected, conversation]);

  // Auto-trigger functionality
  useEffect(() => {
    if (autoTrigger && isConnected && triggerMessage && conversation.sendUserMessage) {
      // Small delay to ensure connection is fully established
      const timer = setTimeout(() => {
        sendMessage(triggerMessage);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [autoTrigger, isConnected, triggerMessage, sendMessage]);

  // Determine button state and text
  const getButtonState = () => {
    if (isConnecting) return { disabled: true, text: 'Connecting...', icon: MicOff };
    if (isConnected) return { disabled: false, text: 'Stop Voice', icon: VolumeX };
    if (hasPermission === false) return { disabled: false, text: 'Start Voice (Need Permission)', icon: Mic };
    return { disabled: false, text: 'Start Voice', icon: Mic };
  };

  const buttonState = getButtonState();
  const ButtonIcon = buttonState.icon;

  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        onClick={isConnected ? stopConversation : startConversation}
        disabled={buttonState.disabled}
        variant={isConnected ? "destructive" : "default"}
        size="sm"
        className="flex items-center gap-2"
      >
        <ButtonIcon className="h-4 w-4" />
        {buttonState.text}
      </Button>

      {/* Status indicators */}
      <div className="flex flex-col items-center text-sm text-gray-600">
        <p>
          Status: {
            isConnecting ? 'Connecting...' :
            isConnected ? 'Connected' :
            'Disconnected'
          }
        </p>
        {isConnected && (
          <p className="text-xs">
            Agent is {conversation.isSpeaking ? 'speaking' : 'listening'}
          </p>
        )}
        {hasPermission === false && (
          <p className="text-xs text-red-500">
            Microphone permission required
          </p>
        )}
      </div>
    </div>
  );
}

// Hook for easier integration with existing components
export function useVoiceAgent() {
  const [isTriggered, setIsTriggered] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string>('');

  const triggerVoiceFeedback = useCallback((message: string) => {
    setTriggerMessage(message);
    setIsTriggered(true);
  }, []);

  const resetTrigger = useCallback(() => {
    setIsTriggered(false);
    setTriggerMessage('');
  }, []);

  return {
    triggerVoiceFeedback,
    resetTrigger,
    VoiceAgentComponent: (
      <VoiceAgent
        autoTrigger={isTriggered}
        triggerMessage={triggerMessage}
        onConnect={() => setIsTriggered(false)}
        onError={() => setIsTriggered(false)}
      />
    )
  };
}
