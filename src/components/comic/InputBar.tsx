import React, { useCallback, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mic, Send, Image as ImageIcon, Square, X } from "lucide-react";
import { toast } from "sonner";
import { playClickSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";
import { ttsService } from "@/lib/tts-service";
import analytics from "@/lib/analytics";
import { useAuth } from "@/hooks/use-auth";

interface InputBarProps {
  onGenerate: (text: string) => void;
  // onGenerateImage removed (image button disabled)
  onAddMessage: (message: { type: 'user' | 'ai'; content: string; timestamp: number }) => void;
  /** When true, disables all interactions and shows a transparent blocker overlay */
  disabled?: boolean;
  /** Called when user taps/clicks while disabled (to nudge elsewhere) */
  onDisabledClick?: () => void;
  /** Optional small debug label explaining why input is disabled */
  disabledReason?: string;
}

const InputBar: React.FC<InputBarProps> = ({ onGenerate, onAddMessage, disabled = false, onDisabledClick, disabledReason }) => {
  const [text, setText] = useState("");
  const [isMicActive, setIsMicActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const recognitionRef = useRef<any | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // 16 kHz mono WAV capture via AudioContext
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const [useWhisper, setUseWhisper] = useState(true);
  const isCancelledRef = useRef(false);
  const pendingActionRef = useRef<'send' | 'image' | null>(null);
  const { user, userData } = useAuth();
  const displayName = React.useMemo(() => {
    try {
      const nm = (userData?.username || user?.displayName || '').trim();
      return nm || 'Anonymous';
    } catch {
      return 'Anonymous';
    }
  }, [userData?.username, user?.displayName]);
  
  // Backend base URL (same approach as Reading/SpellBox)
  const backendBaseUrl = React.useMemo(() => {
    try {
      const v = ((import.meta as any).env?.VITE_BACKEND_BASE_URL || '') as string;
      return (v && typeof v === 'string') ? v.replace(/\/+$/, '') : '';
    } catch {
      return '';
    }
  }, []);

  // Waveform Visualizer Component
  const WaveformVisualizer = () => {
    return (
      <div className="flex items-center justify-center gap-1 h-10 px-4 bg-white/90 rounded-xl shadow-sm flex-1 backdrop-blur-sm">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="w-1 bg-primary rounded-full animate-pulse"
            style={{
              height: `${Math.random() * 20 + 8}px`,
              animationDelay: `${i * 0.1}s`,
              animationDuration: `${0.5 + Math.random() * 0.5}s`
            }}
          />
        ))}
      </div>
    );
  };

  // Whisper API transcription
  const transcribeWithWhisper = useCallback(async (audioBlob: Blob) => {
    try {
      // Match Reading flow: POST to backend /api/fireworks/transcribe with whisper-v3-turbo
      const file = new File([audioBlob], 'speech.wav', { type: 'audio/wav' });
      const fd = new FormData();
      fd.append('file', file);
      fd.append('model', 'whisper-v3-turbo');
      fd.append('language', 'en');
      // Forward username so backend can include it in Discord payload
      fd.append('username', displayName);
      const base = backendBaseUrl || '';
      const url = `${base}/api/fireworks/transcribe`;
      const resp = await fetch(url, { method: 'POST', body: fd });
      const json: any = await resp.json().catch(() => ({}));
      const text = (json?.text || '').toString();
      return text;
    } catch (error) {
      console.error('Whisper transcription error (Fireworks):', error);
      throw error;
    }
  }, [backendBaseUrl, displayName]);

  // Start recording with MediaRecorder for Whisper
  const startWhisperRecording = useCallback(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        audioChunksRef.current = [];
        pcmChunksRef.current = [];
        mediaStreamRef.current = stream;

        // Create a 16kHz mono AudioContext and capture PCM frames
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx: AudioContext = new Ctx({ sampleRate: 16000 });
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (e: AudioProcessingEvent) => {
          try {
            const input = e.inputBuffer.getChannelData(0);
            const copy = new Float32Array(input.length);
            copy.set(input);
            pcmChunksRef.current.push(copy);
          } catch {}
        };
        source.connect(processor);
        processor.connect(ctx.destination);
        audioContextRef.current = ctx;
        audioSourceRef.current = source;
        scriptProcessorRef.current = processor;

        // Use MediaRecorder only to control start/stop UX; data is ignored
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          // Encode 16kHz mono WAV from captured PCM frames
          const usedSampleRate = audioContextRef.current?.sampleRate || 16000;
          const wavBlob = encodeWavFromPCM(pcmChunksRef.current, usedSampleRate);
          
          // Stop all tracks first
          try { stream.getTracks().forEach(track => track.stop()); } catch {}
          // Disconnect audio graph and close context
          try { scriptProcessorRef.current?.disconnect(); } catch {}
          try { audioSourceRef.current?.disconnect(); } catch {}
          try { await audioContextRef.current?.close(); } catch {}
          audioContextRef.current = null;
          audioSourceRef.current = null;
          scriptProcessorRef.current = null;
          mediaStreamRef.current = null;
          
          // Check if recording was cancelled
          if (isCancelledRef.current) {
            setIsMicActive(false);
            setText(""); // Clear any partial text
            return;
          }
          
          try {
            const transcription = await transcribeWithWhisper(wavBlob);
            
            if (transcription && transcription.trim()) {
              console.log('Whisper transcription completed:', transcription.trim());
              
              // Check if there's a pending action to execute
              if (pendingActionRef.current === 'send') {
                // Send transcription directly
                pendingActionRef.current = null;
                setIsMicActive(false);
                ttsService.stop();
                onGenerate(transcription.trim());
                setText("");
              } else if (pendingActionRef.current === 'image') {
                // Send as create image request directly
                pendingActionRef.current = null;
                setIsMicActive(false);
                ttsService.stop();
                onGenerate(`create image: ${transcription.trim()}`);
                setText("");
              } else {
                // Normal behavior: set text for user to choose action
                setText(transcription.trim());
                setIsMicActive(false);
              }
            } else {
              setIsMicActive(false);
            }
          } catch (error) {
            console.error('Whisper transcription failed:', error);
            toast.error("Failed to transcribe audio. Using browser speech recognition as fallback.");
            
            // Stop current recording state and fallback to browser recognition
            setIsMicActive(false);
            
            // Small delay to ensure state is updated before starting fallback
            setTimeout(() => {
              startBrowserSpeechRecognition();
            }, 100);
          }
        };

        mediaRecorder.start();
        // Note: isMicActive is already set to true in startVoice for instant UI feedback
        // isCancelledRef.current is already reset in startVoice
      })
      .catch(error => {
        console.error('Error accessing microphone:', error);
        toast.error("Microphone access denied. Please allow microphone access.");
        // Reset mic active state if microphone access fails
        setIsMicActive(false);
      });
  }, [transcribeWithWhisper, onGenerate]);

  // Minimal WAV encoder for Float32 PCM chunks (mono)
  const encodeWavFromPCM = React.useCallback((chunks: Float32Array[], sampleRate: number): Blob => {
    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const buffer = new ArrayBuffer(44 + totalLength * 2);
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + totalLength * 2, true);
    writeString(view, 8, 'WAVE');
    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // PCM
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate (16-bit mono)
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, totalLength * 2, true);

    // Write PCM samples
    let offset = 44;
    const clamp = (n: number) => Math.max(-1, Math.min(1, n));
    for (const chunk of chunks) {
      for (let i = 0; i < chunk.length; i++) {
        const s = clamp(chunk[i]);
        const val = s < 0 ? s * 0x8000 : s * 0x7fff;
        view.setInt16(offset, val, true);
        offset += 2;
      }
    }
    return new Blob([view], { type: 'audio/wav' });
  }, []);

  function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // Browser speech recognition fallback
  const startBrowserSpeechRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in this browser.");
      setIsMicActive(false); // Reset state if not supported
      return;
    }
    
    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = true;
    
    let finalTranscriptText = '';
    
    rec.onstart = () => {
      // Note: isMicActive is already set to true in startVoice for instant UI feedback
      finalTranscriptText = ''; // Reset when starting
      // isCancelledRef.current is already reset in startVoice
    };
    
    rec.onresult = (event: any) => {
      if (isSubmitting) return;
      
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
          finalTranscriptText += transcript; // Store for auto-send
        } else {
          interimTranscript += transcript;
        }
      }
      
      setText(finalTranscriptText + interimTranscript);
    };
    
    rec.onerror = (event: any) => {
      toast.error("Microphone error – please try again.");
      setIsMicActive(false);
      setIsSubmitting(false);
    };
    
    rec.onend = () => {
      // Always stop the recording state first
      setIsMicActive(false);
      
      // Handle final transcript - either execute pending action or set text
      if (finalTranscriptText && finalTranscriptText.trim() && !isCancelledRef.current) {
        console.log('Browser speech recognition completed:', finalTranscriptText.trim());
        
        // Check if there's a pending action to execute
        if (pendingActionRef.current === 'send') {
          // Send transcription directly
          pendingActionRef.current = null;
          ttsService.stop();
          onGenerate(finalTranscriptText.trim());
          setText("");
        } else if (pendingActionRef.current === 'image') {
          // Send as create image request directly
          pendingActionRef.current = null;
          ttsService.stop();
          onGenerate(`create image: ${finalTranscriptText.trim()}`);
          setText("");
        } else {
          // Normal behavior: set text for user to choose action
          setText(finalTranscriptText.trim());
        }
      } else if (isCancelledRef.current) {
        console.log('Speech recognition cancelled');
        pendingActionRef.current = null; // Clear any pending action
        setText(""); // Clear any partial text if cancelled
      }
    };
    
    rec.start();
    recognitionRef.current = rec;
  }, [isMicActive, isSubmitting, onGenerate]);

  const startVoice = useCallback(() => {
    playClickSound();
    
    // Stop any ongoing TTS when mic button is clicked
    ttsService.stop();
    
    if (isMicActive) {
      // Stop recording manually - user clicked to stop (not cancel)
      if (useWhisper && mediaRecorderRef.current) {
        // Let the recording finish naturally and process the transcription
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      } else if (recognitionRef.current) {
        // Let browser recognition finish naturally and process the transcription  
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      // Don't set isMicActive to false here - let the onend/onstop handlers do it
      return;
    }

    // Clear any existing text before starting new recording
    setText("");
    
    // Set mic active state IMMEDIATELY for instant UI feedback
    setIsMicActive(true);
    isCancelledRef.current = false;
    
    // Use Whisper if available, otherwise fallback to browser speech recognition
    if (useWhisper) {
      startWhisperRecording();
    } else {
      startBrowserSpeechRecognition();
    }
  }, [isMicActive, isSubmitting, useWhisper, startWhisperRecording, startBrowserSpeechRecognition]);


  // Function to handle canceling the recording
  const handleCancelRecording = useCallback(() => {
    playClickSound();
    
    // Set cancelled flag to prevent auto-sending
    isCancelledRef.current = true;
    pendingActionRef.current = null; // Clear any pending action
    
    if (useWhisper && mediaRecorderRef.current) {
      // Stop Whisper recording without processing
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      
      // Stop all audio tracks
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          stream.getTracks().forEach(track => track.stop());
        })
        .catch(console.error);
    } else if (recognitionRef.current) {
      // Stop browser speech recognition without processing
      recognitionRef.current.abort(); // Use abort instead of stop to cancel
      recognitionRef.current = null;
    }
    
    setIsMicActive(false);
    setIsSubmitting(false);
    setText(""); // Clear any partial text
  }, [useWhisper]);

  // Function to handle send button during recording
  const handleSendDuringRecording = useCallback(() => {
    playClickSound();
    console.log('Send button clicked during recording - stopping and sending...');
    
    // Immediately hide recording UI for instant feedback
    setIsMicActive(false);
    
    // Immediately add "transcribing..." message for instant feedback
    onAddMessage({
      type: 'user',
      content: 'Transcribing...',
      timestamp: Date.now()
    });
    
    // Set pending action to send
    pendingActionRef.current = 'send';
    
    // Stop recording and let transcription handler do the sending
    if (useWhisper && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    } else if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, [useWhisper, onAddMessage]);

  // Function to handle create image button during recording
  // Image button disabled – no-op handler retained for safety
  const handleImageDuringRecording = useCallback(() => {
    // intentionally disabled
  }, []);

  const submit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!text.trim()) return;
      
      // Pause any currently playing TTS when user sends a message
      ttsService.stop();
      
      setIsSubmitting(true);
      
      // If recording is active, stop it first
      if (isMicActive) {
        if (useWhisper && mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current = null;
        } else if (recognitionRef.current) {
          recognitionRef.current.stop();
          recognitionRef.current = null;
        }
        setIsMicActive(false);
      }
      
      try {
        const clean = text.trim();
        analytics.capture('user_input_submitted', {
          input_text: clean,
          char_count: clean.length,
          input_source: 'chat',
        });
      } catch {}
      onGenerate(text.trim());
      setText("");
      setIsSubmitting(false);
    },
    [onGenerate, text, isMicActive, useWhisper]
  );

  return (
    <section aria-label="Create next panel" className="bg-transparent relative">
      <form onSubmit={submit} className="flex items-stretch gap-2 bg-transparent">
        {isMicActive ? (
          // Recording state: Cancel button on left
          <Button
            type="button"
            variant="comic"
            size="icon"
            onClick={disabled ? undefined : handleCancelRecording}
            aria-label="Cancel recording"
            className="flex-shrink-0 bg-red-500 hover:bg-red-600 text-white border-red-500 active:translate-y-0 active:shadow-solid"
            disabled={disabled}
          >
            <X className="h-5 w-5" />
          </Button>
        ) : null}
        {isMicActive ? (
          <WaveformVisualizer />
        ) : (
          <Input
            aria-label="What happens next?"
            placeholder="What happens next?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="rounded-xl flex-1 bg-white/90 border-0 shadow-sm focus:shadow-md transition-shadow backdrop-blur-sm"
            disabled={disabled}
          />
        )}
        {isMicActive ? (
          // Recording state: Send button in middle (where mic was)
          <Button 
            type="button"
            variant="comic"
            size="icon"
            onClick={(e) => {
              if (disabled) {
                e.preventDefault();
                onDisabledClick?.();
                return;
              }
              e.preventDefault();
              handleSendDuringRecording();
            }}
            aria-label="Stop recording and send"
            className="flex-shrink-0 active:translate-y-0 active:shadow-solid"
            disabled={disabled}
          >
            <Send className="h-5 w-5" />
          </Button>
        ) : text.trim() ? (
          // User has typed text: Mic button becomes Send button
          <Button
            type="submit"
            variant="comic"
            size="icon"
            onClick={(e) => {
              if (disabled) {
                e.preventDefault();
                onDisabledClick?.();
                return;
              }
              submit(e);
            }}
            aria-label="Send message"
            className="flex-shrink-0 active:translate-y-0 active:shadow-solid"
            disabled={disabled}
          >
            <Send className="h-5 w-5" />
          </Button>
        ) : (
          // Default state: Only Mic button
          <Button
            type="button"
            variant="comic"
            size="icon"
            onClick={disabled ? undefined : startVoice}
            aria-label="Voice input"
            className="flex-shrink-0 active:translate-y-0 active:shadow-solid"
            disabled={disabled}
          >
            <Mic className="h-5 w-5" />
          </Button>
        )}
      </form>
      {disabled && disabledReason && (import.meta as any)?.env?.DEV && (
        <div
          className="absolute -top-5 right-0 z-30 text-[10px] px-2 py-0.5 rounded-full bg-yellow-200 text-yellow-900 border border-yellow-400 shadow-sm select-none"
          aria-label={`Input disabled: ${disabledReason}`}
        >
          {disabledReason}
        </div>
      )}
      {disabled && (
        <div
          className="absolute inset-0 z-20 rounded-xl cursor-not-allowed"
          onClick={(e) => {
            e.preventDefault();
            onDisabledClick?.();
          }}
          role="button"
          aria-label="Please tap Next to continue"
          title={((import.meta as any)?.env?.DEV && disabledReason) || 'Input disabled'}
        />
      )}
    </section>
  );
};

export default InputBar;
