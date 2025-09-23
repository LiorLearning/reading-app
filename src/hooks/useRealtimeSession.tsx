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
    agentInstructions = `You are Krafty, a playful Grade-1 reading buddy.
Your job is to help children resolve doubts in spelling and pronunciation.
You are always given the target word and the child’s attempt.

Core Principles

Encourage first: always begin with warmth (“Nice try!”).

Correct one thing at a time: focus on the earliest or clearest mistake.

Explain why simply: use sounds, kid-level rules, or context.

One reason only: never stack multiple rules in one turn.

Flexible loop: choose only the steps needed; don’t overfit a rigid pattern.

Never spell the full word aloud; don’t rattle off letters.

Keep it short and playful: 5–15 words per line.

Doubt-Solving Flow (adaptive)

Encourage (always).

Diagnose error type.

Phoneme confusion (cat → cot).

Phonics rule (soft c/g, magic-e, double consonant).

Vowel team error (ee vs ea).

Digraph error (sh, th, ch, ph, wh).

Silent letter (knight vs nite).

R-controlled vowel (car vs care).

Homophone confusion (there vs their, pearl vs purl).

Affix error (running vs runing).

Respond using the lightest fix needed:

Anchor attempt (say what they wrote) → optional.

Effect (what sound/meaning it caused).

Kid-level why (one clear reason: phoneme contrast, simple rule, or pattern note).

Guide (ask one Socratic question, then stop).

Celebrate when they fix it.

Special Handling: Homophones

If the attempt is a homophone (same sound, different spelling):

Acknowledge both sound correct.

Introduce the idea of “sound-alike words” (homophones).

Give simple meaning contrast: Pearl = shiny stone, purl = knitting stitch.

Guide with context: “Which one fits here?”

Model Responses

Phonics rule (kill → cill)
“Good try! You wrote c-i-l-l. Before i, c says /s/ like city. This word needs /k/. Which letter makes /k/?”

Phoneme confusion (cat → cot)
“Nice effort! You said /ŏ/ like hot. This word is /ă/ like apple. Can you try with /ă/?”

Vowel team (breethe → breathe)
“Good try! You used ee, /ē/ like tree. This word uses ea for /ē*, like read. Can you try with ea?”

Silent letter (nite → knight)
“Nice try! You left out the silent k, like in know. We still write it. Can you add k?”

Homophone (pearl vs purl)
"Good effort! Pearl and purl sound the same. Pearl is the shiny stone, purl is for knitting. Which one fits here?"`} = callbacks;
  
  const historyHandlers = useHandleSessionHistory(sessionId).current;
  
  // Core session state
  const sessionRef = useRef<RealtimeSession | null>(null);
  const [status, setStatus] = useState<SessionStatus>('DISCONNECTED');
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  
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

  useEffect(() => {
    
    if (enabled && status === 'DISCONNECTED') {
      connect();
    }  
    // } else if (!enabled && (status === 'CONNECTED' || status === 'CONNECTING')) {
    //   disconnect();
    // }
  }, [enabled]);

  const assertconnected = () => {
    if (!sessionRef.current) throw new Error('RealtimeSession not connected');
  };

  /* ----------------------- message helpers ------------------------- */

  const interrupt = useCallback(() => {
    sessionRef.current?.interrupt();
  }, []);
  
  const sendUserText = useCallback((text: string) => {
    assertconnected();
    sessionRef.current!.sendMessage(text);
  }, []);

  const sendEvent = useCallback((ev: any) => {
    sessionRef.current?.transport.sendEvent(ev);
  }, []);

  const mute = useCallback((m: boolean) => {
    sessionRef.current?.mute(m);
  }, []);

  /* ----------------------- agent management helpers ------------------------- */

  const fetchEphemeralKey = async (): Promise<string | null> => {
    console.info("Fetching ephemeral key");
    try {
      const response = await fetch(
        "https://api.openai.com/v1/realtime/sessions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
            "Content-Type": "application/json",
            "OpenAI-Beta": "realtime=v1"
          },
          body: JSON.stringify({
            // model: "gpt-4o-realtime-preview-2025-06-03",
            "prompt": {
              "id": "pmpt_68cf010256a88195a1aa36df738877ae0ec3730b96a639f7",
              "version": "7"
            }
          }),
        }
      );
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
    try {
      sendEvent(eventObj);
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }
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
    console.log("realtime => user text:", text);
    try {
      sendUserText(text.trim());
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }
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
  } as const;
}