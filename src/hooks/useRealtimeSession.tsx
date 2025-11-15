import React, { useCallback, useRef, useState, useEffect } from 'react';
import { v4 as uuidv4 } from "uuid";
import {
  RealtimeSession,
  RealtimeAgent,
  OpenAIRealtimeWebRTC,
} from '@openai/agents/realtime';

import { audioFormatForCodec, applyCodecPreferences } from '../lib/codecUtils';
import { convertWebMBlobToWav } from "../lib/audioUtils";
import { useHandleSessionHistory } from './useHandleSessionHistory';

// Simple session status type
export type SessionStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED";

export interface RealtimeSessionCallbacks {
  onConnectionChange?: (status: SessionStatus) => void;
  onAgentHandoff?: (agentName: string) => void;
  isAudioPlaybackEnabled?: boolean;
  enabled?: boolean;
  agentName?: string;
  agentVoice?: string;
  agentInstructions?: string;
  sessionId?: string | null;
}

export interface UseRealtimeSessionReturn {
  // Core session functionality
  status: SessionStatus;
  sendMessage: (text: string) => void;
  onToggleConnection: () => void;
  downloadRecording: () => Promise<void>;
  interruptRealtimeSession: () => void;
}

export function useRealtimeSession(callbacks: RealtimeSessionCallbacks = {}): UseRealtimeSessionReturn {
  const { 
    onConnectionChange, 
    onAgentHandoff, 
    isAudioPlaybackEnabled = true, 
    enabled = true,
    agentName = 'spellingTutor',
    agentVoice = 'sage',
    sessionId,
    agentInstructions = `Role:
You are the world's best Orton Gillingham spelling tutor with a warm personality.  You are friendly, phonics-based spelling tutor for early elementary kids (around 1st grade). The spelling rule is just for context, use it ONLY if spelling rule error: yes. If the student spelled the given pattern correctly, do NOT mention or reinforce that pattern.”

Inputs provided:
target_word, question (with blanks), student_entry, mistake (description), attempt_number, topic_to_reinforce, spelling_pattern_or_rule (just for context), spelling rule error: yes/no

Core Behavior

1. Start by reading aloud what the student wrote exactly as it sounds.

2. Diagnose internally (don’t tell the student):

- Use the mistake and spelling rule error (yes / no) to understand nature of mistake made by the child. 
- Strictly avoid spelling pattern reinforcement if already correct done by student.

3A. Student-facing move: Attempt 1

- Use the mistake and spelling rule error (yes / no) to understand nature of mistake made by the child. The spelling rule is just for context, use it ONLY if spelling rule error: true. If the student spelled the given pattern correctly, do NOT mention or reinforce that pattern.”
- If it's a sound issue and not a spelling pattern issue, guide them toward the correct sound using phonics cues (/ă/, /oo/, /sh/, etc.) without mentioning the spelling pattern.
- If it's a spelling pattern issue, gently guide them towards the pattern without providing answer.
- Use the spelling rule ONLY if the mistake shows misunderstanding of the rule.
- Strictly avoid showing or naming the correct letters in first attempt by giving a non-revealing hint instead as per spelling pattern or phonics.

example: 
target: garage 
student entry: girage 
spelling pattern: "The -AGE ending can make the sound /ij/ in words of French origin, such as garage and collage. The final E is silent." 
ideal ai response: You wrote gi-rage. The first vowel should make the /ə/ sound. Which vowel makes that sound in garage?

3B. Student-facing move: Attempt 2

- If still wrong, reveal and briefly explain the letters and pattern.
- Be concise — name only the needed letters and link them to the sound or pattern

4. Other rules:
Address only one mistake or mistake group per response.
Never correct two parts in the same turn.
Keep it short.
The spelling rule is just for context, use it ONLY if the error is associated with that rule. If the student spelled the given pattern correctly, do NOT mention or reinforce that pattern.”

5. Multiple mistakes:

If multiple letters form one shared error (like a vowel team or digraph), treat them as a single mistake group.
Otherwise, handle each separately across turns.
For each group, apply the two-step cycle (conceptual hint → reveal).
Move to smaller errors only after fixing the main one.

7. Scope:
Focus only on incorrect or blanked segments (_).
Never mention or comment on correct letters.

8. Tone:
≤20 words, ≤2 sentences.
Warm, calm, playful.
Go straight from “You wrote…” to the key feedback or question.

9. Examples:
Do not use example words.
Explain the sound or pattern directly using phonics symbols (/ch/, /sh/, /ā/, etc.).

10. Homophone rule:
If the student’s word is real but wrong (e.g., site/cite), briefly note both meanings, then guide them back.

✅ Example Behaviors

Non-spelling pattern correction:
target: village 
student entry: vilage
spelling pattern: "The -AGE ending can make the sound /ij/ in words of French origin, such as garage and collage. The final E is silent." 
ideal ai response: You wrote vi-lage. That middle sound needs two letters. Which letter is doubled in village?

Phonics-based correction (sound issue)

Target: cat  Student: cot
→ “You wrote cot. We need /kăt/. Which vowel makes the /ă/ sound?”

Spelling-pattern correction (pattern issue)

Target: great  Student: grait
→ “You wrote grait. It sounds right, but the long /ā/ here uses an unusual pattern. Can you guess?”

Target: tickle  Student: tickel
→ “You wrote tick-el. It sounds right, but that /əl/ ending usually has a different letter order. What might it be?”

Multiple mistakes
Target: bloom  
Student: bulom
→ “You wrote bulom. The middle sound should be the long /oo/. Which letters make that /oo/ sound?”
→ (Attempt 2) “We use ‘oo’ for /oo/ — that makes bloom.”

🔠 Rule Hierarchy Summary

Always: Read aloud → acknowledge → scaffold

Diagnose internally: Sound → Pattern → Convention

Attempt 1 = hint (never show letters).

Use mistakes array; one mistake group per turn.
Strictly avoid pattern reinforcement if the student already spelled that part correctly.

Keep tone kind, concise, warm.`} = callbacks;
  
  const historyHandlers = useHandleSessionHistory(sessionId).current;
  
  // Core session state
  const sessionRef = useRef<RealtimeSession | null>(null);
  const [status, setStatus] = useState<SessionStatus>('DISCONNECTED');
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  // Queues to buffer outbound traffic until the transport is connected
  const pendingTextQueueRef = useRef<string[]>([]);
  const pendingEventQueueRef = useRef<any[]>([]);
  const isFlushingRef = useRef<boolean>(false);
  
  // Audio recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const updateStatus = useCallback(
    (s: SessionStatus) => {
      setStatus(s);
      onConnectionChange?.(s);
    },
    [onConnectionChange],
  );

  const codecParamRef = useRef<string>('opus');

  // Wrapper to pass current codec param
  const applyCodec = useCallback(
    (pc: RTCPeerConnection) => applyCodecPreferences(pc, codecParamRef.current),
    [],
  );

  const handleAgentHandoff = (item: any) => {
    const history = item.context.history;
    const lastMessage = history[history.length - 1];
    const handoffAgentName = lastMessage.name.split("transfer_to_")[1];
    onAgentHandoff?.(handoffAgentName);
  };
  // Create SDK audio element
  const sdkAudioElement = React.useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }, []);

  // Attach SDK audio element once it exists
  useEffect(() => {
    if (sdkAudioElement && !audioElementRef.current) {
      audioElementRef.current = sdkAudioElement;
    }
  }, [sdkAudioElement]);

  function handleTransportEvent(event: any) {
    // Handle additional server events that aren't managed by the session
    switch (event.type) {
      case "conversation.item.input_audio_transcription.completed": {
        historyHandlers.handleTranscriptionCompleted(event);
        break;
      }
      case "response.audio_transcript.done": {
        historyHandlers.handleTranscriptionCompleted(event);
        break;
      }
      case "response.audio_transcript.delta": {
        historyHandlers.handleTranscriptionDelta(event);
        break;
      }
      // No default case - ignore all other events
    }
  }

  useEffect(() => {
    if (sessionRef.current) {
      // Handle agent handoff
      sessionRef.current.on("agent_handoff", handleAgentHandoff);
      // Handle transport events
      sessionRef.current.on("transport_event", handleTransportEvent);
    }
  }, [sessionRef.current]);

  // Handle audio playback and muting
  useEffect(() => {
    if (!enabled) return;
    if (audioElementRef.current) {
      if (isAudioPlaybackEnabled) {
        audioElementRef.current.muted = false;
        // Only try to play if there's actually audio content to avoid autoplay warnings
        if (audioElementRef.current.srcObject) {
          audioElementRef.current.play().catch((err) => {
            // This is expected behavior - browsers block autoplay until user interaction
            console.debug("Autoplay blocked (this is normal):", err.message);
          });
        }
      } else {
        audioElementRef.current.muted = true;
        audioElementRef.current.pause();
      }
    }

    try {
      mute(!isAudioPlaybackEnabled);
    } catch (err) {
      console.warn('Failed to toggle SDK mute', err);
    }
  }, [isAudioPlaybackEnabled, enabled]);

  // Sync mute state after connection
  useEffect(() => {
    if (!enabled) return;
    if (status === 'CONNECTED') {
      try {
        mute(!isAudioPlaybackEnabled);
      } catch (err) {
        console.warn('mute sync after connect failed', err);
      }
    }
  }, [status, isAudioPlaybackEnabled, enabled]);

  // Handle recording when connected
  useEffect(() => {
    if (!enabled) return;
    if (status === "CONNECTED" && audioElementRef.current?.srcObject) {
      const remoteStream = audioElementRef.current.srcObject as MediaStream;
      startRecording(remoteStream);
    }

    return () => {
      stopRecording();
    };
  }, [status, enabled]);

  const connect = useCallback(
    async () => {
      if (sessionRef.current) return; // already connected

      updateStatus('CONNECTING');
      try {
        // Debug: Preview agent instructions (first 300 chars)
        try {
          const preview = (agentInstructions || '').replace(/\s+/g, ' ').slice(0, 300);
          console.info('[realtime] agentInstructions preview:', preview + (agentInstructions.length > 300 ? '…' : ''));
        } catch {}
        const EPHEMERAL_KEY = await fetchEphemeralKey();
        if (!EPHEMERAL_KEY) return;
        // Create the agent with the provided configuration
        const agent = new RealtimeAgent({
          name: agentName,
          voice: agentVoice as any,
          instructions: agentInstructions,
          handoffs: [], // No handoffs needed for single agent
          tools: [], // No tools needed for spelling tutor
          handoffDescription: 'spelling tutor teaches via pronunciation to grade 1 students',
        });

      const codecParam = codecParamRef.current;
      const audioFormat = audioFormatForCodec(codecParam);
      
        sessionRef.current = new RealtimeSession(agent, {
          transport: new OpenAIRealtimeWebRTC({
            audioElement: sdkAudioElement,
            // Set preferred codec before offer creation
            changePeerConnection: async (pc: RTCPeerConnection) => {
              applyCodec(pc);
              return pc;
            },
          }),
          model: 'gpt-4o-realtime-preview-2025-08-28', // Latest realtime model
          config: {
            inputAudioFormat: audioFormat,
            outputAudioFormat: audioFormat,
          },
          context: {}, // No additional context needed
        });
   
        await sessionRef.current.connect({ apiKey: EPHEMERAL_KEY });

        updateStatus('CONNECTED');
        
        // Send initial session update without triggering auto-response
        // This prevents the realtime session from speaking over ElevenLabs initial adventure message
        updateSession(false);

        // Flush any queued outbound messages/events
        try {
          if (!isFlushingRef.current) {
            isFlushingRef.current = true;
            // Drain event queue first to configure session before user texts
            while (pendingEventQueueRef.current.length > 0) {
              const ev = pendingEventQueueRef.current.shift();
              try { sessionRef.current?.transport.sendEvent(ev); } catch (err) { console.warn('Failed sending queued event, re-queuing', err); pendingEventQueueRef.current.unshift(ev); break; }
            }
            while (pendingTextQueueRef.current.length > 0) {
              const text = pendingTextQueueRef.current.shift();
              try { sessionRef.current?.sendMessage(text); } catch (err) { console.warn('Failed sending queued text, re-queuing', err); pendingTextQueueRef.current.unshift(text); break; }
            }
          }
        } finally {
          isFlushingRef.current = false;
        }
      } catch (err) {
        console.error("Error connecting via SDK:", err);
        updateStatus("DISCONNECTED");
      }
    },
    [agentName, agentVoice, agentInstructions, updateStatus],
  );

  const disconnect = useCallback(() => {
    console.log("Disconnecting from session");
    sessionRef.current?.close();
    sessionRef.current = null;
    updateStatus('DISCONNECTED');
  }, [updateStatus]);

  // Reconnect session if agentInstructions change (to switch between spelling/reading tutors)
  const lastInstructionsRef = useRef<string | undefined>(agentInstructions);
  useEffect(() => {
    if (!enabled) return;
    // If instructions string changed, reconnect with new agent configuration
    const prev = lastInstructionsRef.current;
    if (prev !== agentInstructions) {
      lastInstructionsRef.current = agentInstructions;
      // Disconnect current session (if any) and reconnect with updated instructions
      if (status === 'CONNECTED' || status === 'CONNECTING') {
        try { disconnect(); } catch {}
      }
      // Slight delay to allow transport close before reconnect
      const t = setTimeout(() => {
        try { connect(); } catch {}
      }, 50);
      return () => clearTimeout(t);
    }
  }, [agentInstructions, enabled, status, connect, disconnect]);

  useEffect(() => {
    
    if (enabled && status === 'DISCONNECTED') {
      connect();
    }  
    // } else if (!enabled && (status === 'CONNECTED' || status === 'CONNECTING')) {
    //   disconnect();
    // }
  }, [enabled]);

  // Waiter to ensure connection established before sending; resolves once CONNECTED or times out
  const waitForConnected = useCallback(async (timeoutMs: number = 5000) => {
    if (status === 'CONNECTED' && sessionRef.current) return;
    const start = Date.now();
    await new Promise<void>((resolve, reject) => {
      const interval = setInterval(() => {
        if (status === 'CONNECTED' && sessionRef.current) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          reject(new Error('Realtime connection timeout'));
        }
      }, 50);
    });
  }, [status]);

  // Ensure connected (kick off connection if needed) before attempting to send
  const ensureConnectedBeforeSend = useCallback(async () => {
    if (status === 'CONNECTED' && sessionRef.current) return;
    try {
      await connect();
    } catch {}
    try {
      await waitForConnected(5000);
    } catch (err) {
      // Swallow; callers will queue on failure
    }
  }, [status, connect, waitForConnected]);

  const assertconnected = () => {
    if (!sessionRef.current) throw new Error('RealtimeSession not connected');
  };

  /* ----------------------- message helpers ------------------------- */

  const interrupt = useCallback(() => {
    try {
      // Interrupt can throw if the transport/data channel isn't ready yet.
      // Swallow the error; subsequent sends will queue until connected.
      sessionRef.current?.interrupt();
    } catch (err) {
      try {
        console.debug('realtime interrupt ignored (not connected yet)', (err as any)?.message || err);
      } catch {}
    }
  }, []);
  
  const sendUserText = useCallback((text: string) => {
    // Non-throwing: if not connected yet, queue
    if (!sessionRef.current) {
      pendingTextQueueRef.current.push(text);
      // Kick connection if needed
      ensureConnectedBeforeSend();
      return;
    }
    try {
      sessionRef.current.sendMessage(text);
    } catch (err) {
      console.warn('sendMessage failed, queuing text', err);
      pendingTextQueueRef.current.push(text);
      ensureConnectedBeforeSend();
    }
  }, [ensureConnectedBeforeSend]);

  const sendEvent = useCallback((ev: any) => {
    // Non-throwing: if not connected or data-channel not ready, queue
    if (!sessionRef.current) {
      pendingEventQueueRef.current.push(ev);
      ensureConnectedBeforeSend();
      return;
    }
    try {
      sessionRef.current.transport.sendEvent(ev);
    } catch (err) {
      console.warn('sendEvent failed, queuing event', err);
      pendingEventQueueRef.current.push(ev);
      ensureConnectedBeforeSend();
    }
  }, [ensureConnectedBeforeSend]);

  const mute = useCallback((m: boolean) => {
    sessionRef.current?.mute(m);
  }, []);

  /* ----------------------- agent management helpers ------------------------- */

  const fetchEphemeralKey = async (): Promise<string | null> => {
    console.info("Fetching ephemeral key");
    try {
      const isReadingTutor = agentName === 'readingTutor';
      const promptId = isReadingTutor
        ? "pmpt_690e5a1eb9208196ae0461dafdeb990902f7ad0f5ca166b4"
        : "pmpt_68cf010256a88195a1aa36df738877ae0ec3730b96a639f7";
      const promptVersion = isReadingTutor ? "14" : "51";
      const betaHeader = isReadingTutor ? "Reading-AI-tutor" : "realtime=v1";
      const response = await fetch(
        "https://api.readkraft.com/api/v1/realtime/sessions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "OpenAI-Beta": betaHeader
          },
          body: JSON.stringify({
            // model: "gpt-4o-realtime-preview-2025-06-03",
            "prompt": {
              "id": promptId,
              "version": promptVersion
            }
          }),
        }
      );
      try {
        console.info('[realtime] server prompt config:', { id: promptId, version: promptVersion, betaHeader });
      } catch {}
      const data = await response.json();

      if (!data.client_secret?.value) {
        console.error("No ephemeral key provided by the server");
        updateStatus("DISCONNECTED");
        return null;
      }
      let value = data.client_secret.value //.slice(3);
      console.log("Ephemeral key fetched", value);
      return value;
    } catch (error) {
      console.error("Error in /session:", error);
      updateStatus("DISCONNECTED");
      return null;
    }
  };

  const sendClientEvent = (eventObj: any) => {
    // Delegate to safe sendEvent (queues if needed)
    sendEvent(eventObj);
  };

  const sendSimulatedUserMessage = (text: string) => {
    const id = uuidv4().slice(0, 32);

    sendClientEvent({
      type: 'conversation.item.create',
      item: {
        id,
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    });
    sendClientEvent({ type: 'response.create' });
  };

  const updateSession = (shouldTriggerResponse: boolean = false) => {
    // Disable voice activity detection - text input only
    const turnDetection = null; // Disable VAD completely

    sendEvent({
      type: 'session.update',
      session: {
        turn_detection: turnDetection,
      },
    });

    if (shouldTriggerResponse) {
      sendSimulatedUserMessage('hi');
    }
  };

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    interrupt();
    try {
      // Pretty print JSON payloads while preserving raw
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch {}
      if (parsed && typeof parsed === 'object') {
        console.info('[realtime] sendMessage payload (parsed):', parsed);
      } else {
        console.info('[realtime] sendMessage text:', text);
      }
    } catch {}
    // Non-throwing safe send; queues if not yet connected
    sendUserText(text.trim());
  }, [interrupt, sendUserText]);

  const onToggleConnection = () => {
    console.log("Toggling connection",status);
    if (status === "CONNECTED" || status === "CONNECTING") {
      disconnect();
    } else {
      connect();
    }
  };

  /* ----------------------- audio recording helpers ------------------------- */

  /**
   * Starts recording only the remote stream (agent audio).
   * Microphone input is disabled for text-only interaction.
   * @param remoteStream - The remote MediaStream (e.g., from the audio element).
   */
  const startRecording = useCallback(async (remoteStream: MediaStream) => {
    // No microphone access - record only agent audio
    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    try {
      const remoteSource = audioContext.createMediaStreamSource(remoteStream);
      remoteSource.connect(destination);
    } catch (err) {
      console.error("Error connecting remote stream to the audio context:", err);
      return; // Exit if we can't connect the remote stream
    }

    const options = { mimeType: "audio/webm" };
    try {
      const mediaRecorder = new MediaRecorder(destination.stream, options);
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
    } catch (err) {
      console.error("Error starting MediaRecorder with remote stream:", err);
    }
  }, []);

  /**
   * Stops the MediaRecorder, if active.
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.requestData();
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  }, []);

  /**
   * Initiates download of the agent audio recording after converting from WebM to WAV.
   * Only contains agent responses (no microphone input).
   * If the recorder is still active, we request its latest data before downloading.
   */
  const downloadRecording = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.requestData();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (recordedChunksRef.current.length === 0) {
      console.warn("No recorded chunks found to download.");
      return;
    }
    
    const webmBlob = new Blob(recordedChunksRef.current, { type: "audio/webm" });

    try {
      const wavBlob = await convertWebMBlobToWav(webmBlob);
      const url = URL.createObjectURL(wavBlob);
      const now = new Date().toISOString().replace(/[:.]/g, "-");

      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `agent_audio_${now}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      console.error("Error converting recording to WAV:", err);
    }
  }, []);

  return {
    status,
    sendMessage,
    onToggleConnection,
    downloadRecording,
    interruptRealtimeSession: interrupt,
  } as const;
}