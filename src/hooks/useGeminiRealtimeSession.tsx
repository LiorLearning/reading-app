import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  GoogleGenAI,
  LiveServerMessage,
  MediaResolution,
  Modality,
  Session,
} from '@google/genai';

export type SessionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

export interface GeminiRealtimeSessionOptions {
  onConnectionChange?: (status: SessionStatus) => void;
  enabled?: boolean;
  apiKey?: string; // optional override for env-based key
}

export interface UseGeminiRealtimeSessionReturn {
  setEnabled: (enabled: boolean) => void;
  sendMessage: (text: string) => void;
  interrupt: () => void;
}

// --------------------- Module-level (local global) state ---------------------

const responseQueue: LiveServerMessage[] = [];
let liveSession: Session | undefined = undefined;

// Aggregate audio chunks and last-seen mime type for WAV construction
let audioPartsBase64: string[] = [];
let lastAudioMimeType: string | null = null;

type LiveConfig = {
  model: string;
  voiceName: string;
  instructions: string;
};

const DEFAULT_LIVE_CONFIG: LiveConfig = {
  model: 'models/gemini-2.5-flash-native-audio-preview-09-2025',
  voiceName: 'Zephyr',
  instructions: 'you are a ENGLISH phonetic teacher',
};

let CURRENT_LIVE_CONFIG: LiveConfig = { ...DEFAULT_LIVE_CONFIG };

// ----------------------------- Helpers (queue) ------------------------------

async function handleTurn(): Promise<LiveServerMessage[]> {
  const turn: LiveServerMessage[] = [];
  let done = false;
  while (!done) {
    const message = await waitMessage();
    turn.push(message);
    if (message.serverContent && message.serverContent.turnComplete) {
      done = true;
    }
  }
  return turn;
}

async function waitMessage(): Promise<LiveServerMessage> {
  let done = false;
  let message: LiveServerMessage | undefined = undefined;
  while (!done) {
    message = responseQueue.shift();
    if (message) {
      handleModelTurn(message);
      done = true;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  }
  return message!;
}

function handleModelTurn(message: LiveServerMessage) {
  const parts = message.serverContent?.modelTurn?.parts;
  if (!parts || parts.length === 0) return;
  const part = parts[0];

  if ((part as any)?.fileData) {
    try {
      // eslint-disable-next-line no-console
      console.log(`File: ${(part as any).fileData.fileUri}`);
    } catch {}
  }

  if ((part as any)?.inlineData) {
    const inlineData = (part as any).inlineData as { data?: string; mimeType?: string };
    if (inlineData?.data) {
      audioPartsBase64.push(inlineData.data);
      lastAudioMimeType = inlineData.mimeType ?? lastAudioMimeType;
    }
  }

  if ((part as any)?.text) {
    try {
      // eslint-disable-next-line no-console
      console.log((part as any).text);
    } catch {}
  }
}

// ------------------------- Helpers (audio -> WAV) --------------------------

interface WavConversionOptions {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
}

function parseMimeTypeToWavOptions(mimeType: string | null): WavConversionOptions {
  // Example mime types observed: 'audio/L16; rate=16000', 'audio/L24; rate=48000'
  const fallback: WavConversionOptions = {
    numChannels: 1,
    sampleRate: 16000,
    bitsPerSample: 16,
  };
  if (!mimeType) return fallback;

  const [fileType, ...params] = mimeType.split(';').map((s) => s.trim());
  const [, format] = (fileType || '').split('/');

  const options: Partial<WavConversionOptions> = {
    numChannels: 1,
    bitsPerSample: 16,
  };

  if (format && format.startsWith('L')) {
    const bits = parseInt(format.slice(1), 10);
    if (!Number.isNaN(bits)) options.bitsPerSample = bits;
  }
  for (const param of params) {
    const [key, value] = param.split('=').map((s) => s.trim());
    if (key === 'rate') {
      const rate = parseInt(value, 10);
      if (!Number.isNaN(rate)) options.sampleRate = rate;
    }
  }

  return (options.sampleRate && options.bitsPerSample && options.numChannels
    ? (options as WavConversionOptions)
    : fallback);
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binaryString = atob(b64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function createWavHeader(dataByteLength: number, options: WavConversionOptions): ArrayBuffer {
  const { numChannels, sampleRate, bitsPerSample } = options;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  // RIFF identifier 'RIFF'
  view.setUint8(0, 'R'.charCodeAt(0));
  view.setUint8(1, 'I'.charCodeAt(0));
  view.setUint8(2, 'F'.charCodeAt(0));
  view.setUint8(3, 'F'.charCodeAt(0));
  // file length - 8
  view.setUint32(4, 36 + dataByteLength, true);
  // RIFF type 'WAVE'
  view.setUint8(8, 'W'.charCodeAt(0));
  view.setUint8(9, 'A'.charCodeAt(0));
  view.setUint8(10, 'V'.charCodeAt(0));
  view.setUint8(11, 'E'.charCodeAt(0));
  // format chunk identifier 'fmt '
  view.setUint8(12, 'f'.charCodeAt(0));
  view.setUint8(13, 'm'.charCodeAt(0));
  view.setUint8(14, 't'.charCodeAt(0));
  view.setUint8(15, ' '.charCodeAt(0));
  // format chunk length
  view.setUint32(16, 16, true); // PCM
  // sample format (raw)
  view.setUint16(20, 1, true); // linear PCM
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, byteRate, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, bitsPerSample, true);
  // data chunk identifier 'data'
  view.setUint8(36, 'd'.charCodeAt(0));
  view.setUint8(37, 'a'.charCodeAt(0));
  view.setUint8(38, 't'.charCodeAt(0));
  view.setUint8(39, 'a'.charCodeAt(0));
  // data chunk length
  view.setUint32(40, dataByteLength, true);

  return buffer;
}

function assembleWavBlobFromBase64Chunks(): Blob | null {
  if (!audioPartsBase64.length) return null;
  const options = parseMimeTypeToWavOptions(lastAudioMimeType);
  const byteArrays = audioPartsBase64.map((b64) => base64ToUint8Array(b64));
  const totalLen = byteArrays.reduce((sum, arr) => sum + arr.byteLength, 0);
  const header = createWavHeader(totalLen, options);
  // Convert to BlobParts that are definitely ArrayBufferView with standard ArrayBuffer
  const headerView = new Uint8Array(header);
  const bodyViews = byteArrays.map((bytes) => {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy;
  });
  const blob = new Blob([headerView, ...bodyViews], { type: 'audio/wav' });
  return blob;
}

function resetAudioAggregation() {
  audioPartsBase64 = [];
  lastAudioMimeType = null;
}

// ---------------------------------- Hook -----------------------------------

export function useGeminiRealtimeSession(options: GeminiRealtimeSessionOptions = {}): UseGeminiRealtimeSessionReturn {
  const { onConnectionChange, enabled = true, apiKey } = options;

  const [status, setStatus] = useState<SessionStatus>('DISCONNECTED');
  const [enabledState, setEnabledState] = useState<boolean>(enabled);

  const updateStatus = useCallback((s: SessionStatus) => {
    setStatus(s);
    try { onConnectionChange?.(s); } catch {}
  }, [onConnectionChange]);

  const connect = useCallback(async () => {
    if (liveSession) return;
    updateStatus('CONNECTING');
    try {
      const apiKeyToUse = import.meta.env.VITE_GOOGLE_API_KEY;
      if (!apiKeyToUse) {
        console.error('Gemini API key missing. Provide VITE_GOOGLE_API_KEY or options.apiKey');
        updateStatus('DISCONNECTED');
        return;
      }
      const ai = new GoogleGenAI({ apiKey: apiKeyToUse });

      // Build live config from module-level CURRENT_LIVE_CONFIG
      const config = {
        responseModalities: [Modality.AUDIO] as Modality[],
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: CURRENT_LIVE_CONFIG.voiceName },
          },
        },
        contextWindowCompression: {
          triggerTokens: '25600',
          slidingWindow: { targetTokens: '12800' },
        },
        systemInstruction: {
          parts: [{ text: CURRENT_LIVE_CONFIG.instructions }],
        },
      };

      liveSession = await ai.live.connect({
        model: CURRENT_LIVE_CONFIG.model,
        callbacks: {
          onopen: function () {
            // eslint-disable-next-line no-console
            console.debug('Gemini Live: opened');
          },
          onmessage: function (message: LiveServerMessage) {
            responseQueue.push(message);
          },
          onerror: function (e: ErrorEvent) {
            // eslint-disable-next-line no-console
            console.debug('Gemini Live: error', e.message);
          },
          onclose: function (e: CloseEvent) {
            // eslint-disable-next-line no-console
            console.debug('Gemini Live: close', e.reason);
          },
        },
        config,
      });

      updateStatus('CONNECTED');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Gemini Live connect error:', err);
      updateStatus('DISCONNECTED');
    }
  }, [apiKey, updateStatus]);

  const disconnect = useCallback(() => {
    try {
      liveSession?.close();
    } catch {}
    liveSession = undefined;
    updateStatus('DISCONNECTED');
    resetAudioAggregation();
  }, [updateStatus]);

  useEffect(() => {
    if (enabledState && status === 'DISCONNECTED') {
      connect();
    } else if (!enabledState && (status === 'CONNECTED' || status === 'CONNECTING')) {
      disconnect();
    }
  }, [enabledState, status, connect, disconnect]);

  const ensureConnected = useCallback(async () => {
    if (status === 'CONNECTED' && liveSession) return;
    try { await connect(); } catch {}
  }, [status, connect]);

  const interrupt = useCallback(() => {
    // Best-effort interruption: close the current session
    // If a graceful interrupt API is added later, wire it here
    disconnect();
  }, [disconnect]);

  // Exposed enable/disable that just flip the local ref and trigger connect/disconnect
  const setEnabled = useCallback((val: boolean) => {
    setEnabledState(val);
  }, []);

  return {
    setEnabled,
    sendMessage: useCallback((text: string) => {
        console.info("gemini live sending message: ", text)
      const trimmed = (text || '').trim();
      if (!trimmed) return;
      (async () => {
        await ensureConnected();
        try {
          liveSession?.sendClientContent({ turns: [trimmed] });
          void handleTurn();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('Gemini Live sendClientContent failed:', err);
        }
      })();
    }, [ensureConnected]),
    interrupt,
  } as const;
}


