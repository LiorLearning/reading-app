"use client";

import { useRef, useEffect } from "react";
import { adventureSessionService } from "../lib/adventure-session-service";

export function useHandleSessionHistory(sessionId?: string | null) {
  // Store for accumulating transcription deltas
  const transcriptAccumulator = useRef<Map<string, string>>(new Map());
  
  // Store current sessionId in ref so handlers always have latest value
  const sessionIdRef = useRef<string | null>(sessionId || null);
  
  // Update sessionId ref when it changes
  useEffect(() => {
    sessionIdRef.current = sessionId || null;
  }, [sessionId]);

  /* ----------------------- event handlers ------------------------- */

  function handleTranscriptionDelta(item: any) {
    const itemId = item.item_id;
    const deltaText = item.delta || "";
    
    if (itemId && deltaText) {
      // Accumulate delta text
      const current = transcriptAccumulator.current.get(itemId) || "";
      transcriptAccumulator.current.set(itemId, current + deltaText);
    }
  }

  function handleTranscriptionCompleted(item: any) {
    const itemId = item.item_id;
    const finalTranscript = item.transcript || "";
    
    if (itemId) {
      // Get the accumulated text or use the final transcript
      const accumulatedText = transcriptAccumulator.current.get(itemId) || finalTranscript;
      
      // Log only the final transcription in a single line
      if (accumulatedText.trim()) {   
        if (sessionIdRef.current) {
          adventureSessionService.addTranscription(sessionIdRef.current, accumulatedText.trim());
        }
      }
      
      // Clean up the accumulator
      transcriptAccumulator.current.delete(itemId);
    }
  }

  const handlersRef = useRef({
    handleTranscriptionDelta,
    handleTranscriptionCompleted,
  });

  return handlersRef;
}
