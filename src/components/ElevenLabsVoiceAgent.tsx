import React, { useEffect, useState, useCallback } from 'react';
import { useConversation } from '@elevenlabs/react';
import { voiceAgentService } from '../lib/voice-agent-service';

interface ElevenLabsVoiceAgentProps {
  // This component is always hidden, no props needed
}

const ElevenLabsVoiceAgent: React.FC<ElevenLabsVoiceAgentProps> = () => {
  const [micMuted, setMicMuted] = useState(true); // Muted by default - voice output only
  const [volume, setVolume] = useState(0.8);
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  const conversation = useConversation({
    micMuted,
    volume,
    onConnect: () => {
      console.log('✅ ElevenLabs: Connected to voice agent');
      setConnectionStatus('connected');
    },
    onDisconnect: () => {
      console.log('🔌 ElevenLabs: Disconnected from voice agent');
      setConnectionStatus('disconnected');
    },
    onMessage: (message) => {
      console.log('💬 ElevenLabs: Received message:', message);
    },
    onError: (error) => {
      console.error('❌ ElevenLabs: Connection error:', error);
      setConnectionStatus('disconnected');
    },
  });

  const { sendUserMessage } = conversation;

  const startConversation = useCallback(async () => {
    if (connectionStatus === 'connected' || connectionStatus === 'connecting') {
      console.log('🔄 ElevenLabs: Conversation already active');
      return true;
    }

    try {
      setConnectionStatus('connecting');
      console.log('🎤 ElevenLabs: Starting voice output session (no microphone needed)...');
      
      // Start the conversation with your agent (no microphone required for output-only)
      const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID;
      if (!agentId) {
        throw new Error('VITE_ELEVENLABS_AGENT_ID not configured');
      }

      await conversation.startSession({
        agentId: agentId,
        connectionType: 'websocket' // Using websocket for voice output
      });

      console.log('✅ ElevenLabs: Voice output session started successfully');
      return true;
    } catch (error) {
      console.error('❌ ElevenLabs: Failed to start voice session:', error);
      setConnectionStatus('disconnected');
      return false;
    }
  }, [conversation, connectionStatus]);

  const stopConversation = useCallback(async () => {
    try {
      await conversation.endSession();
      console.log('🛑 ElevenLabs: Conversation session ended');
    } catch (error) {
      console.error('❌ ElevenLabs: Failed to stop conversation:', error);
    }
  }, [conversation]);

  const sendTextMessage = useCallback(async (message: string) => {
    if (connectionStatus !== 'connected') {
      // Try to start conversation if not connected
      const started = await startConversation();
      if (!started) {
        console.warn('🚫 ElevenLabs: Cannot send message - conversation not started');
        return false;
      }
    }

    try {
      console.log('📤 ElevenLabs: Sending text message for voice output:', message);
      
      // Send the text message through the existing conversation connection
      // Microphone is already muted by default for voice output only
      sendUserMessage(message);
      
      return true;
    } catch (error) {
      console.error('❌ ElevenLabs: Failed to send text message:', error);
      return false;
    }
  }, [connectionStatus, startConversation, sendUserMessage]);

  useEffect(() => {
    const initializeVoiceAgent = async () => {
      try {
        // Store conversation methods in voice agent service
        voiceAgentService.setConversation(conversation);
        voiceAgentService.setConversationMethods({
          startConversation,
          stopConversation,
          sendTextMessage,
          getConnectionStatus: () => connectionStatus
        });
        
        setIsInitialized(true);
        console.log('✅ ElevenLabs Voice Agent component initialized with enhanced callbacks');
        
        // Auto-start the conversation session for voice output
        console.log('🚀 ElevenLabs: Auto-starting voice session...');
        await startConversation();
      } catch (error) {
        console.error('❌ Failed to initialize ElevenLabs Voice Agent:', error);
      }
    };

    initializeVoiceAgent();
  }, [conversation, startConversation, stopConversation, sendTextMessage, connectionStatus]);

  // This component is always hidden - it only provides the network functionality
  return (
    <div style={{ display: 'none' }}>
      {/* Hidden component - only provides ElevenLabs conversation functionality */}
      {/* Connection Status: {connectionStatus} */}
    </div>
  );
};

export default ElevenLabsVoiceAgent;
