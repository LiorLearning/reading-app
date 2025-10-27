import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    GoogleGenAI,
    GoogleGenAIOptions,
    LiveCallbacks,
    LiveConnectConfig,
    LiveServerMessage,
    Modality,
    MediaResolution,
    Part,
    Session,
} from "@google/genai";

export type UseGeminiOptions = Omit<GoogleGenAIOptions, "apiKey"> & {
    /** Default model to use when starting the session */
    defaultModel?: string;
    /** Optional default config to merge into `enable` */
    defaultConfig?: LiveConnectConfig;
};

export type UseGemini = {
    /** Start the SDK by establishing a Live session */
    start: (opts?: { model?: string; config?: LiveConnectConfig }) => Promise<boolean>;
    /** Send a text message to the model */
    sendMessage: (text: string) => void;
    /** Close the current session */
    disconnect: () => void;
    /** Interrupt current playback/generation */
    interrupt: () => void;
    /** True when websocket is open */
    connected: boolean;
    /** Current connection status */
    status: "connected" | "disconnected" | "connecting";
    /** Last error if any */
    error?: string;
    /** Finalized text from the most recent model turn (set on turnComplete) */
    lastMessage?: string;
};

export function useGeminiRealtimeSession(options: UseGeminiOptions = {}): UseGemini {
    const {
        defaultModel = "models/gemini-2.5-flash-native-audio-preview-09-2025",
        defaultConfig,
        ...rest
    } = options;

    const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string;
    if (typeof API_KEY !== "string") {
        throw new Error("set REACT_APP_GEMINI_API_KEY in .env");
    }

    const client = useMemo(() => new GoogleGenAI({ apiKey: API_KEY, ...rest }), [API_KEY, rest]);

    const sessionRef = useRef<Session | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const playbackTimeRef = useRef<number>(0);
    const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
    const turnTextRef = useRef<string>("");
    const transcriptRef = useRef<string>("");

    const [model, setModel] = useState<string>(defaultModel);
    const [config, setConfig] = useState<LiveConnectConfig>(
        // Default to AUDIO output with a prebuilt voice; no mic input handled here
        defaultConfig ?? {
            responseModalities: [Modality.AUDIO],
            mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
            },
            contextWindowCompression: {
                triggerTokens: "25600",
                slidingWindow: { targetTokens: "12800" },
            },
            systemInstruction: {
                parts: [
                    {
                        text: `Role: You are a friendly, phonics-based spelling tutor for early elementary kids (around 1st grade).  
Be warm, calm, playful — like a buddy helping a friend fix a word.

Inputs provided:
target_word, question (with blanks), student_entry, mistakes (positions), attempt_number, topic_to_reinforce, spelling_pattern_or_rule.

---

### Core Behavior

1. **Start by reading aloud** what the student wrote exactly as it sounds.  
2. **Diagnose internally** (don't tell the student):  
   - Is it a *sound (phonics)* problem or a *spelling/pattern/convention* problem?
   - Have they got the main spelling rule wrong or is it some other error?
3. **Student-facing move:**
   - If it **sounds wrong**, say so gently and guide them toward the correct *sound* using phonics cues (/ă/, /oo/, /sh/, etc.).  
   - If it **sounds right**, acknowledge that, then shift focus to the *spelling pattern or convention*.
4. **Error Source Priority:**  
Use the mistakes array to locate each incorrect part. Address only one mistake or mistake group per response. Never correct two parts in the same turn.
Strictly avoid spelling pattern reinforcement if already correct done by student.
5. **Hint policy:**  
   - **Attempt 1:** Give one conceptual hint — describe the sound or pattern, without revealing the answer. 
     - Strictly avoid showing or naming the correct letters in first attempt by giving a non-revealing hint instead as per spelling pattern or phonics.  
     ✅ **Keep it short:** Combine the “read aloud” and hint in one or two short sentences. Skip filler like “let's read” or “hmm.”  
   - **Attempt 2:** If still wrong, reveal and briefly explain the letters and pattern.  
     When revealing, be concise — name only the needed letters and link them to the sound or pattern.  
6. **Multiple mistakes:**  
   - Always start with “read aloud” and acknowledgment.  
   - If multiple letters form one shared error (like a vowel team or digraph), treat them as a single mistake group. Otherwise, handle each separately across turns.
   - For each group, apply the two-step cycle (conceptual hint → reveal if needed).  
   - Move to smaller errors only after fixing the main one.
7. **Scope:** Focus only on incorrect or blanked segments ("_").  
   Never mention or comment on correct letters.
8. **Tone:** ≤20 words, ≤2 sentences. Be warm, calm, and playful — sound like a buddy exploring sounds together.  
   **Be efficient:** Avoid filler or long commentary; go straight from “You wrote…” to the key feedback or question.
9. **Examples:** Do not use example words. Explain the sound or pattern directly using phonics symbols (/ch/, /sh/, /ā/, etc.).
10. **Homophone rule:** If the student's word is real but wrong (e.g., *site/cite*), briefly note both meanings, then guide them back.

---

### ✅ Example Behaviors (now correctly following “read aloud → acknowledge → scaffold”)

**Phonics-based correction (sound issue):**
- *Target:* cat *Student:* cot  
  → “You wrote *cot*. We need /kăt/. Which vowel makes the /ă/ sound?”
- *Target:* ship *Student:* shop  
  → “You wrote *shop*. We need /ship/ — which vowel makes that short /ĭ/ sound?”

**Spelling-pattern correction (pattern issue):**
- *Target:* great *Student:* grait  
  → “You wrote *grait*. It sounds right, but the long /ā/ here uses an unusual pattern. Can you guess?”
- *Target:* clock *Student:* klock  
  → “You wrote *klock*. It sounds right, but before 'o' we usually use a different letter for /k/. Which one?”
- *Target:* tickle *Student:* tickel  
  → “You wrote *tick-el*. It sounds right, but that /əl/ ending usually has a different letter order. What might it be?”

**Multiple mistakes:**
- *Target:* bloom *Student:* bulom  
  → “You wrote *bulom*. The middle sound should be the long /oo/. Which letters make that /oo/ sound?”  
  → (If still wrong) “We use 'oo' for /oo/ — that makes *bloom*.”

---

### Rule Hierarchy Summary
1. Always: **Read aloud → acknowledge → scaffold**  
2. Diagnose internally: Sound → Pattern → Convention  
3. Strictly avoid showing or naming the correct letters in first attempt by giving a non-revealing hint instead as per spelling pattern or phonics.
4. One mistake (or group) at a time, using mistakes array. Strictly avoid spelling pattern reinforcement if already correct done by student.  
5. Keep tone kind, concise, and under 20 words"`,
                    },
                ],
            },
            // request transcripts alongside audio
            outputAudioTranscription: {},
        }
    );
    const [status, setStatus] = useState<"connected" | "disconnected" | "connecting">(
        "disconnected"
    );
    const [connected, setConnected] = useState<boolean>(false);
    const [error, setError] = useState<string | undefined>(undefined);
    const [lastMessage, setLastMessage] = useState<string | undefined>(undefined);
    const resetStreamState = () => {
        setLastMessage(undefined);
        turnTextRef.current = "";
        transcriptRef.current = "";
    };

    const disconnect = useCallback(() => {
        try {
            sessionRef.current?.close();
        } catch { }
        sessionRef.current = null;
        try {
            audioContextRef.current?.close();
        } catch { }
        audioContextRef.current = null;
        playbackTimeRef.current = 0;
        scheduledSourcesRef.current.forEach((s) => {
            try {
                s.stop();
            } catch { }
        });
        scheduledSourcesRef.current = [];
        turnTextRef.current = "";
        setConnected(false);
        setStatus("disconnected");
    }, []);

    useEffect(() => {
        return () => {
            // Cleanup on unmount
            disconnect();
        };
    }, [disconnect]);

    const onOpen = useCallback(() => {
        setConnected(true);
        setStatus("connected");
        setError(undefined);
    }, []);

    const onError = useCallback((e: ErrorEvent) => {
        setError(e?.message || "Unknown error");
    }, []);

    const onClose = useCallback((e: CloseEvent) => {
        setConnected(false);
        setStatus("disconnected");
        if (e?.reason) {
            setError(e.reason);
        }
    }, []);

    const onMessage = useCallback((message: LiveServerMessage) => {
        if (!message.serverContent) {
            return;
        }

        // Helper to accumulate transcript chunks robustly
        const accumulate = (prev: string, next: string) => {
            if (!prev) return next;
            if (!next) return prev;
            // If API sends the full prefix repeatedly, replace with the longer one
            if (next.startsWith(prev)) return next;
            // If API sends only the delta token, append with a space if needed
            const needsSpace = !prev.endsWith(" ") && !next.startsWith(" ");
            return prev + (needsSpace ? " " : "") + next;
        };

        // Handle interruption: stop queued audio and reset scheduling, clear partial text
        if ("interrupted" in message.serverContent) {
            const ctx = audioContextRef.current;
            scheduledSourcesRef.current.forEach((s) => {
                try {
                    s.stop();
                } catch { }
            });
            scheduledSourcesRef.current = [];
            if (ctx) playbackTimeRef.current = ctx.currentTime;
            turnTextRef.current = "";
            transcriptRef.current = "";
            return;
        }

        // If the server provides output transcription alongside audio, prefer it for display (incremental or final)
        if ("outputTranscription" in message.serverContent && message.serverContent.outputTranscription?.text) {
            const t = message.serverContent.outputTranscription.text;
            // Keep the latest snapshot of the spoken transcription
            transcriptRef.current = t;
            // Also keep accumulating fallback from parts in case transcription is missing later
            turnTextRef.current = accumulate(turnTextRef.current, t);
        }

        if ("modelTurn" in message.serverContent) {
            const parts: Part[] = message.serverContent.modelTurn?.parts || [];

            const textPieces: string[] = [];
            const audioBase64s: string[] = [];
            for (const p of parts) {
                if (p.text) {
                    textPieces.push(p.text);
                }
                if (p.inlineData && p.inlineData.mimeType?.startsWith("audio/pcm") && p.inlineData.data) {
                    audioBase64s.push(p.inlineData.data);
                }
            }
            const textChunk = textPieces.length ? textPieces.join("") : undefined;
            if (textChunk) {
                // Append incremental chunk; do not expose until turnComplete
                turnTextRef.current = `${turnTextRef.current}${textChunk}`;
            }

            if (audioBase64s.length) {
                // Lazily create audio context
                const ensureCtx = () => {
                    if (!audioContextRef.current) {
                        const AnyWindow = window as any;
                        const Ctor = AnyWindow.AudioContext || AnyWindow.webkitAudioContext;
                        audioContextRef.current = new Ctor();
                        playbackTimeRef.current = (audioContextRef.current as AudioContext).currentTime;
                    }
                    return audioContextRef.current as AudioContext;
                };

                const b64ToArrayBuffer = (b64: string): ArrayBuffer => {
                    const binary = atob(b64);
                    const len = binary.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
                    return bytes.buffer;
                };

                const schedulePcm16 = (buf: ArrayBuffer, sampleRate: number = 24000) => {
                    const ctx = ensureCtx();
                    // Resume context on user gesture browsers
                    if (ctx.state === "suspended") {
                        ctx.resume().catch(() => { });
                    }
                    const view = new DataView(buf);
                    const sampleCount = buf.byteLength / 2;
                    const float32 = new Float32Array(sampleCount);
                    for (let i = 0; i < sampleCount; i++) {
                        const int16 = view.getInt16(i * 2, true);
                        float32[i] = Math.max(-1, Math.min(1, int16 / 32768));
                    }
                    const audioBuffer = ctx.createBuffer(1, sampleCount, sampleRate);
                    audioBuffer.copyToChannel(float32, 0, 0);
                    const source = ctx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(ctx.destination);

                    const startAt = Math.max(ctx.currentTime, playbackTimeRef.current);
                    source.start(startAt);
                    playbackTimeRef.current = startAt + audioBuffer.duration;

                    scheduledSourcesRef.current.push(source);
                    source.onended = () => {
                        scheduledSourcesRef.current = scheduledSourcesRef.current.filter((s) => s !== source);
                    };
                };

                for (const b64 of audioBase64s) {
                    try {
                        schedulePcm16(b64ToArrayBuffer(b64), 24000);
                    } catch { }
                }
            }
        }

        // When the model signals end of turn, expose a single consolidated message
        if ("turnComplete" in message.serverContent) {
            const a = (turnTextRef.current || "").trim();
            const b = (transcriptRef.current || "").trim();
            const finalized = a.length >= b.length ? a : b;
            if (finalized) {
                setLastMessage(finalized);
            }
            turnTextRef.current = "";
            transcriptRef.current = "";
        }
    }, []);

    const start = useCallback(
        async (opts?: { model?: string; config?: LiveConnectConfig }) => {
            if (status === "connecting" || status === "connected") {
                return true;
            }

            const useModel = opts?.model ?? model;
            const useConfig = { ...config, ...(opts?.config ?? {}) } as LiveConnectConfig;

            setStatus("connecting");
            setError(undefined);
            resetStreamState();

            const callbacks: LiveCallbacks = {
                onopen: onOpen,
                onmessage: onMessage,
                onerror: onError,
                onclose: onClose,
            };

            try {
                const sess = await client.live.connect({
                    model: useModel,
                    config: useConfig,
                    callbacks,
                });
                sessionRef.current = sess;
                // Persist chosen model/config
                setModel(useModel);
                setConfig(useConfig);
                return true;
            } catch (e: any) {
                setStatus("disconnected");
                setConnected(false);
                setError(e?.message || "Failed to connect");
                return false;
            }
        },
        [client, config, model, onClose, onError, onMessage, onOpen, status]
    );

    const sendMessage = useCallback((text: string) => {
        if (!text || !sessionRef.current) return;
        interrupt()
        const parts: Part[] = [{ text }];
        sessionRef.current.sendClientContent({ turns: parts, turnComplete: true });
    }, []);

    const interrupt = useCallback(() => {
        // Stop local playback and clear partial buffers
        const ctx = audioContextRef.current;
        scheduledSourcesRef.current.forEach((s) => {
            try {
                s.stop();
            } catch { }
        });
        scheduledSourcesRef.current = [];
        if (ctx) playbackTimeRef.current = ctx.currentTime;
        turnTextRef.current = "";
        transcriptRef.current = "";

        // Hint the server to end current generation by sending an empty turn
        try {
            if (sessionRef.current) {
                sessionRef.current.sendClientContent({ turns: [{ text: "" }], turnComplete: true });
            }
        } catch { }
    }, []);

    return {
        start,
        sendMessage,
        interrupt,
        disconnect,
        connected,
        status,
        error,
        lastMessage,
    };
}
