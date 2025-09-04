import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChatMessage } from '@/lib/utils';
import { aiService } from '@/lib/ai-service';
import { SpellingQuestion } from '@/lib/questionBankUtils';
import { UnifiedAIResponse, StreamEvent } from '@/lib/unified-ai-streaming-service';
import { stopImageLoadingSound } from '@/lib/sounds';

export interface UseUnifiedAIStreamingOptions {
  userId: string;
  onNewImage?: (imageUrl: string, prompt: string) => void;
  onResponseComplete?: (response: UnifiedAIResponse) => void;
}

export interface UnifiedStreamingState {
  isStreaming: boolean;
  isGeneratingImage: boolean;
  currentText: string;
  generatedImages: string[];
  error: string | null;
  lastResponse: UnifiedAIResponse | null;
}

/**
 * React hook for unified AI streaming with automatic image generation
 * This is the new system that lets AI decide when to generate images
 */
export function useUnifiedAIStreaming(options: UseUnifiedAIStreamingOptions) {
  const { userId, onNewImage, onResponseComplete } = options;
  
  // State management
  const [streamingState, setStreamingState] = useState<UnifiedStreamingState>({
    isStreaming: false,
    isGeneratingImage: false,
    currentText: '',
    generatedImages: [],
    error: null,
    lastResponse: null
  });
  
  // Generate stable session ID that persists across re-renders
  const sessionId = useMemo(() => crypto.randomUUID(), []); // Empty dependency array ensures it never changes
  
  // Handle stream events - STABLE callback to prevent useEffect cleanup
  const handleStreamEventRef = useRef((event: StreamEvent) => {
    console.log('📡 Stream event received:', event.type, event.content.substring(0, 100));
    
    setStreamingState(prev => {
      const newState = { ...prev };
      
      switch (event.type) {
        case 'text':
          newState.currentText += event.content;
          break;
          
        case 'image_start':
          newState.isGeneratingImage = true;
          // Loading sound is handled in response processor
          break;
          
        case 'image_complete':
          newState.isGeneratingImage = false;
          if (event.metadata?.imageUrl) {
            newState.generatedImages.push(event.metadata.imageUrl);
            // Call callback for new image
            if (onNewImage && event.metadata.prompt) {
              onNewImage(event.metadata.imageUrl, event.metadata.prompt);
            }
            // Sound handling is done in response processor
          }
          break;
          
        case 'error':
          newState.error = event.content;
          newState.isGeneratingImage = false;
          // Ensure loading sound is stopped on error
          stopImageLoadingSound();
          break;
          
        case 'complete':
          newState.isStreaming = false;
          newState.isGeneratingImage = false;
          // Ensure loading sound is stopped when stream completes
          stopImageLoadingSound();
          break;
      }
      
      return newState;
    });
  });
  
  // Update the ref when onNewImage changes
  useEffect(() => {
    handleStreamEventRef.current = (event: StreamEvent) => {
      console.log('📡 Stream event received:', event.type, event.content.substring(0, 100));
      
      setStreamingState(prev => {
        const newState = { ...prev };
        
        switch (event.type) {
          case 'text':
            newState.currentText += event.content;
            break;
            
          case 'image_start':
            newState.isGeneratingImage = true;
            break;
            
          case 'image_complete':
            newState.isGeneratingImage = false;
            if (event.metadata?.imageUrl) {
              newState.generatedImages.push(event.metadata.imageUrl);
              if (onNewImage && event.metadata.prompt) {
                onNewImage(event.metadata.imageUrl, event.metadata.prompt);
              }
            }
            break;
            
          case 'error':
            newState.error = event.content;
            newState.isGeneratingImage = false;
            stopImageLoadingSound();
            break;
            
          case 'complete':
            newState.isStreaming = false;
            newState.isGeneratingImage = false;
            stopImageLoadingSound();
            break;
        }
        
        return newState;
      });
    };
  }, [onNewImage]);
  
  // Register/unregister stream event listener - STABLE to prevent cleanup during re-renders
  useEffect(() => {
    if (aiService.isUnifiedSystemReady()) {
      console.log(`🔗 Registering stream event listener for session: ${sessionId}`);
      aiService.onUnifiedStreamEvent(sessionId, (event) => handleStreamEventRef.current(event));
    }
    
    return () => {
      console.log(`🔗 Cleaning up stream event listener for session: ${sessionId}`);
      aiService.removeUnifiedStreamListener(sessionId);
    };
  }, [sessionId]); // Only depends on sessionId - stable!
  
  // Main method to send message and get unified AI response
  const sendMessage = useCallback(async (
    message: string, 
    chatHistory: ChatMessage[], 
    spellingQuestion: SpellingQuestion
  ): Promise<UnifiedAIResponse | null> => {
    
    // Check if unified system is available
    if (!aiService.isUnifiedSystemReady()) {
      console.warn('⚠️ Unified AI system not ready, this should fallback to regular system');
      return null;
    }
    
    // 🛠️ IMPROVED: Better handling of existing streaming state
    if (streamingState.isStreaming) {
      console.log('⚠️ Already streaming - aborting previous request');
      
      try {
        aiService.abortUnifiedStream(sessionId);
        
        // Immediately reset streaming state to prevent stuck conditions
        setStreamingState(prev => ({
          ...prev,
          isStreaming: false,
          isGeneratingImage: false,
          error: null
        }));
        
        // Small delay to let the abort complete
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (abortError) {
        console.warn('Failed to abort previous stream:', abortError);
        // Continue anyway - don't let abort failure block new requests
      }
    }
    
    console.log('🎯 Starting new unified streaming request:', {
      sessionId,
      messagePreview: message.substring(0, 50),
      previouslyStreaming: streamingState.isStreaming
    });
    
    // Reset state for new message
    setStreamingState(prev => ({
      ...prev,
      isStreaming: true,
      isGeneratingImage: false,
      currentText: '',
      generatedImages: [],
      error: null,
      lastResponse: null
    }));
    
    // 🛠️ Set up a safety timeout to prevent permanently stuck state
    let streamingTimeout: NodeJS.Timeout | null = null;
    
    try {
      console.log('🚀 Sending message through unified AI system:', message.substring(0, 50));
      
      streamingTimeout = setTimeout(() => {
        console.log('🚨 STREAMING TIMEOUT: Force-resetting stuck state after 35 seconds');
        setStreamingState(prev => ({
          ...prev,
          isStreaming: false,
          isGeneratingImage: false,
          error: 'Request timed out - please try again'
        }));
        
        // Also abort the service-level stream
        try {
          aiService.abortUnifiedStream(sessionId);
        } catch (err) {
          console.warn('Failed to abort timed-out stream:', err);
        }
      }, 35000); // 35 second timeout
      
      // Generate unified response
      const response = await aiService.generateUnifiedResponse(
        message,
        chatHistory,
        spellingQuestion,
        userId,
        sessionId
      );
      
      // Clear the timeout since request completed successfully
      if (streamingTimeout) {
        clearTimeout(streamingTimeout);
      }
      
      console.log(`✅ Unified response received with ${response.imageUrls.length} images`);
      
      // Update final state
      setStreamingState(prev => ({
        ...prev,
        isStreaming: false,
        isGeneratingImage: false, // Ensure this is also reset
        lastResponse: response,
        currentText: response.textContent,
        generatedImages: response.imageUrls,
        error: null // Clear any previous errors
      }));
      
      // Call completion callback
      if (onResponseComplete) {
        onResponseComplete(response);
      }
      
      return response;
      
    } catch (error) {
      // 🛠️ IMPROVED: Always clear timeout on any error
      if (streamingTimeout) {
        clearTimeout(streamingTimeout);
      }
      
      // Handle aborted requests gracefully
      if (error instanceof Error && (error.name === 'APIUserAbortError' || error.message.includes('aborted'))) {
        console.log('ℹ️ Request aborted (new message sent or component unmounted)');
        console.log('🔍 Hook abort details:', {
          errorName: error.name,
          errorMessage: error.message,
          sessionId: sessionId,
          currentStreamingState: streamingState.isStreaming
        });
        
        // Stop any loading sound when request is aborted
        stopImageLoadingSound();
        
        // 🛠️ CRITICAL: Always reset streaming state on abort
        setStreamingState(prev => ({
          ...prev,
          isStreaming: false,
          isGeneratingImage: false,
          error: null // Don't show error for intentional aborts
        }));
        return null;
      }
      
      console.error('❌ Unified streaming error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // 🛠️ CRITICAL: Always reset streaming state on any error
      setStreamingState(prev => ({
        ...prev,
        isStreaming: false,
        isGeneratingImage: false,
        error: errorMessage
      }));
      
      return null;
    }
  }, [userId, sessionId, onResponseComplete]);
  
  // Abort current stream
  const abortStream = useCallback(() => {
    aiService.abortUnifiedStream(sessionId);
    
    // Stop any ongoing loading sound
    stopImageLoadingSound();
    
    setStreamingState(prev => ({
      ...prev,
      isStreaming: false,
      isGeneratingImage: false
    }));
  }, [sessionId]);
  
  // Check if system is ready
  const isReady = useCallback(() => {
    return aiService.isUnifiedSystemReady();
  }, []);
  
  // Get streaming statistics
  const getStats = useCallback(() => {
    const { lastResponse } = streamingState;
    return {
      hasImages: lastResponse?.hasImages || false,
      imageCount: lastResponse?.imageUrls.length || 0,
      textLength: lastResponse?.textContent.length || 0,
      isReady: isReady()
    };
  }, [streamingState, isReady]);
  
  return {
    // State
    ...streamingState,
    
    // Methods
    sendMessage,
    abortStream,
    isReady,
    getStats,
    
    // Utilities
    sessionId
  };
}

/**
 * Simpler hook for components that just want to check unified system status
 */
export function useUnifiedAIStatus() {
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    setIsReady(aiService.isUnifiedSystemReady());
  }, []);
  
  return {
    isUnifiedSystemReady: isReady,
    hasImageGeneration: isReady
  };
}
