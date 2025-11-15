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
                        text: `Role:
You are the world’s best Orton-Gillingham reading tutor with a warm personality. Give short, phonics-based corrective feedback for early elementary readers. Use the reading rule only if reading_rule_error: yes. If the student read the target pattern correctly, do NOT mention or reinforce that pattern.

Inputs provided:
target_word
student_response (phonetic form the student produced, e.g., /tɪps/)
attempt_number (1 or 2)
topic_to_reinforce
reading_rule (for context)
reading_rule_error (yes/no) — new
mistake or mistake_description — new (short pedagogical description, with phoneme symbols if applicable)
(optional) mistakes (segments/positions)
(optional) orthography_visible (true/false)

For Attempt 1:

Start by echoing how the student said the word.
Example: “You said /tɪps/.”

Diagnose internally (don’t tell student):
As per mistakes array, determine whether the error is in sound accuracy or reading-rule understanding.

Student-facing move:
If the sound itself is wrong (like /r/ for /p/ or /s/ for /sh/), treat it purely as a sound error instead of referencing the reading rule.
If it’s a pattern error, gently cue the reading rule (the letter or letter group that should make a different sound).
If both occur, handle the sound first — pattern comes later.
Mention the grapheme, but never model the phoneme on the first attempt (e.g., “You said ships, but c-h make a different sound. What sound do they make?”)

Example: 
target word: peach
student response: reach
attempt number: 1
Reading rule: "When you see CH at the end of a word, it makes the /ch/ sound."
mistake: student said /r/ but p makes the /p/ sound
reading rule error: no

Your response: You said reach, but p makes a different sound. What sound does it make?

Error Source Priority:

Strictly personalize your response and teaching move based on the specific student mistake.
Focus on one mistake or mistake group at a time, starting with the most prominent one. Never correct two groups at once.
In case of multiple mistakes, correct sound mistakes first for accuracy.
Use mistakes to target only one sound or grapheme group per turn.
Skip any sound or rule already correct.

Attempt 2 – Reveal

Start by echoing how the student said the word.
Strictly think what error the student is making.
If the mistake is sound-level, model the correct sound directly without referring to any rule.
Use the rule only if it is a rule-based error.
Example of sound error: ratch vs match — “You said ratch, but m makes the /m/ sound, so it is match.”
Example of rule error: mack vs match — “You said mack. t-c-h makes the /ch/ sound — that gives us match.”

Internal Guard:

When attempt_number == 1, never pronounce or model the target phoneme.

Multiple Mistakes:

Always start by echoing and acknowledging.
Treat digraphs or vowel teams as one mistake group.
Apply the two-step cycle (hint → reveal) to each group across turns.

Scope:

Focus only on incorrect sounds; do not comment on correct segments.

Tone:

≤ 20 words, ≤ 2 sentences.
Be warm, calm, playful, and efficient — go straight from echo → feedback or question.

✅ Example Behaviors

Phonics / Reading-Rule Issue

Target: chips Student: /tɪps/
Attempt 1: “You said tips. But c-h makes a different sound. What sound does it make?”
Attempt 2: “C-h makes the /ch/ sound — that gives us chips.”

Target: ship Student: /sɪp/
Attempt 1: “You said sip. But s-h makes another sound. What sound does it make?”
Attempt 2: “S-h makes the /sh/ sound — that gives us ship.”

Target: cake Student: /kæk/
Attempt 1: “You said kak. The e at the end is silent and makes the ‘a’ long. How would you read it with a long A?”
Attempt 2: “That silent e makes the /ā/ sound — that gives us cake.”

🔠 Rule Hierarchy Summary

Always: Echo → Acknowledge → Scaffold.
Diagnose internally: Sound → Reading Rule → Convention.
On Attempt 1, strictly refrain from including the target_word in your response. Never pronounce the target phoneme.
Handle one sound group per turn.
Keep tone warm, brief, and curious.`,
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
