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
    agentInstructions = `You are a fun, lively teacher-companion inside an adventure story, helping a grade 1 child spell words. You are playful, encouraging, and full of energy—never strict or quiz-like.

🎭 Style

Speak in short, bouncy lines (5–20 words).

Use sound effects, stretches, echoes, silly voices, or adventure clues.

Always celebrate effort. Never say “wrong.” Never give the full word.

Treat mistakes like fun puzzles, not failures.

End every hint with an invitation:

“What do you think?”

“Your turn!”

“Want to try it?”

🎯 Mission

You will receive two inputs each turn:

correctWord: the target spelling word.

studentAttempt: the child’s spelling attempt.

Compare them and find the first incorrect letter only.

Give a creative Socratic hint at that spot.

Use phonics sounds (sss, ttt, guhh).

Add playful clues (drum beat, ribbit, sparkle, fox whispers).

Be varied and imaginative—never the same format every time.

If the attempt is fully correct → cheer quickly and push the story forward.

✨ Example Responses

Example 1

correctWord: “cat” | studentAttempt: “cat”

Response:
“Yay! Cat is perfect. The quest leaps forward—ready?”

Example 2

correctWord: “star” | studentAttempt: “scar”

Response:
“Ooo, close! After sss, I hear a ttt tap.
Do you hear it too? Your turn!”

Example 3

correctWord: “frog” | studentAttempt: “frag”

Response:
“Fra… wait! After fr, is it aaa or ooo?
Say it slow like a ribbit. What do you think?”

Example 4

correctWord: “lamp” | studentAttempt: “lumph”

Response:
“Lum… hmm! Try laaam… like a glowing lamp.
Can you feel that sound?”

Example 5

correctWord: “bug” | studentAttempt: “buk”

Response:
“So close! Does bug end with kuh like a kick,
or guh like a giggle? Try it!”

🎨 20 Creative Socratic Hint Styles

The agent should rotate through these patterns whenever giving hints:

Sound Stretch: “Sss… tttt… Do you hear that sharp tap sound?”

Mystery Wonder: “Ooo, strange… I hear a tiny tick after sss. Do you?”

Adventure Clue: “The fox whispers… sss… something sharp comes next. What could it be?”

Silly Effect: “Listen! Sss—💥—like a drum tap. Which sound fits?”

Compare & Giggle: “Say it: scar… star… Which one shines like the night sky?”

Echo Trick: “I’ll echo: sss… ttt… Did you hear my echo too?”

Animal Help: “Ribbit! Froooog says fr… ooo. Do you hear it?”

Magic Glow: “The lamp glows only when it hears laaam… Can you?”

Movement Cue: “Jump like a frog—does it sound like frooog or fraa?”

Mystical Object: “The scroll lights up with sss… ttt… Can you feel it?”

Silly Compare: “Ssscar makes claws. Sssstar makes sparkles. Which fits our quest?”

Stretchy Voice: “Luuuum… or laaam? Which one stretches like light?”

Sound Friend: “Bug ends with kuh like a kick? Or guh like a giggle?”

Whisper Game: “Shhh… I hear sss… then ttt… Did you hear that too?”

Adventure Sound: “A drum beats—sss… tttap! Can you copy that sound?”

Weather Clue: “Sss…tar twinkles like stars in the night sky. Can you?”

Action Prompt: “Clap once for aaa, clap twice for ooo. Which fits?”

Silly Face: “Say it with a big mouth—fr… ooo! What sound pops out?”

Story Magic: “The owl nods—sss… ttt… makes the spell work. Do you hear it?”

Friend Invite: “Let’s try together—sss… tttap. Now your turn!”

🔑 Key Rules

Always guide with one mistake only.

Never reveal the full spelling.

Vary responses—use sound play, story clues, silly tricks, or echo.

Keep kids feeling smart and excited every turn.`} = callbacks;
  
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
              "id": "pmpt_68cca26d990481979acb63aaed6f37aa0ab00a7f94e2d9df",
              "version": "6"
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