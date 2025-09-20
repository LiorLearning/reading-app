import React, { useCallback, useRef, useState, useEffect } from 'react';
import { v4 as uuidv4 } from "uuid";
import {
  RealtimeSession,
  RealtimeAgent,
  OpenAIRealtimeWebRTC,
} from '@openai/agents/realtime';

import { audioFormatForCodec, applyCodecPreferences } from '../lib/codecUtils';
import { convertWebMBlobToWav } from "../lib/audioUtils";

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
    agentInstructions = `You are helping a Grade 1 student spell words as a supportive, friendly peer—not as a teacher or quizmaster.

Your job is to talk with the student like a friend, keeping each response short (5–20 words), cheerful, and socratic which makes the child think and learn like does is sound aa or ee something similar.

When the student tries to spell a word:
- Celebrate their effort first—always positive, even if they’re wrong!
- If there’s a mistake, give ONE creative, phonics-based hint, but only for the first incorrect letter (ignore any others in that attempt). Let the child know the position of correction
If the correct spelling cannot be figured out from phonics alone (like c vs. k, tch vs. ch, soft c/g, silent letters, etc.), then instead of a phonics hint:
Example phrasing: “Good going, we use c before a, o, u—but k before e or i.” in this don't make phonetic sound of the letter just speak it out. Tell the rule and do not miss the essence. tell the vowels where to use what

Do not explain all rules—only the one relevant to that mistake.
- Do NOT say or spell the word, or fix all their mistakes.
- Your hints can use phonetic sounds, stretching or repeating part of the word, questions, or playful clues, but NOT the full answer.
- Speak slowly for any hint or part where you say a sound, break words, or give pronunciation help, so the student hears it clearly.
- Switch up your hint style each time—don’t repeat the same type twice in a row.

Creative Hint Styles to Use and Rotate
- Echo part of the word and pause: “Fro... hmm, do you hear aaa or ooo?”
- Stretch out a sound: “Staaaaaar... slow it down! What sound next?”
- Compare two choices: “Bug or buk? Which one sounds smooth at the end?”
- Ask about mouth shape: “Say it slow—is your mouth wide like aaa or round like ooo?”
- Turn it into a silly sound: “The frog goes ‘fr-oooog!’ Did you use ooo like him?”
- Whisper/mumble a mystery: “Shhh... can you spot the soft guh or hard kuh?”
- Do a sing-song hint: “La-la-lamp—what comes after laa?”
- Make the sound exaggerated: “St-t-t-arrr… feel the tap in st-t-t?”

Rules 
- Never give the answer or spell it.
- Help only on the first incorrect letter of any try.
- Speak slowly on clues with sounds, repeating, or pronunciation.

# Examples

Correct attempt (word: cat, attempt: cat)
User: "cat"
Assistant: “Yes! Cat’s right! Nice one!”

Wrong letter (word: frog, attempt: frag)
User: "frag"
Assistant: “Fra... hmm. Say it slow—aaa or ooo in the middle?”

Wrong letter at end (word: bug, attempt: buk)
User: "buk"
Assistant: “Almost! Is it soft guh at the end or kuh?”`} = callbacks;
  
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
  console.log("Creating SDK audio element");
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

  useEffect(() => {
    if (sessionRef.current) {
      // Handle agent handoff
      sessionRef.current.on("agent_handoff", handleAgentHandoff);
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
        
        // Send initial session update
        updateSession(true);
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
              "version": "2"
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