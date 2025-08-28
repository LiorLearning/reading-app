import React, { useCallback, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mic, Send, Image as ImageIcon, Square, X } from "lucide-react";
import { toast } from "sonner";
import { playClickSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";
import OpenAI from 'openai';
import { ttsService } from "@/lib/tts-service";

interface InputBarProps {
  onGenerate: (text: string) => void;
  onGenerateImage: () => void;
}

const InputBar: React.FC<InputBarProps> = ({ onGenerate, onGenerateImage }) => {
  const [text, setText] = useState("");
  const [isMicActive, setIsMicActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const recognitionRef = useRef<any | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [useWhisper, setUseWhisper] = useState(false);
  const isCancelledRef = useRef(false);
  
  // Initialize OpenAI client for Whisper
  const openaiClient = React.useMemo(() => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (apiKey) {
      setUseWhisper(true);
      return new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      });
    }
    return null;
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
    if (!openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      // Create a File object from the blob
      const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
      
      const transcription = await openaiClient.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'en',
      });

      return transcription.text;
    } catch (error) {
      console.error('Whisper transcription error:', error);
      throw error;
    }
  }, [openaiClient]);

  // Start recording with MediaRecorder for Whisper
  const startWhisperRecording = useCallback(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        audioChunksRef.current = [];
        
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Check if recording was cancelled
          if (isCancelledRef.current) {
            // Stop all tracks and exit without processing
            stream.getTracks().forEach(track => track.stop());
            setIsMicActive(false);
            return;
          }
          
          try {
            const transcription = await transcribeWithWhisper(audioBlob);
            
            // Auto-send the transcription if it's not empty
            if (transcription && transcription.trim()) {
              // Pause any currently playing TTS when user sends a message via voice
              ttsService.stop();
              setIsSubmitting(true);
              onGenerate(transcription.trim());
              setText("");
              setIsSubmitting(false);
            } else {
              setText(transcription);
            }
          } catch (error) {
            toast.error("Failed to transcribe audio. Using browser speech recognition as fallback.");
            // Fallback to browser speech recognition
            startBrowserSpeechRecognition();
          }

          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());
          setIsMicActive(false);
        };

        mediaRecorder.start();
        setIsMicActive(true);
        isCancelledRef.current = false; // Reset cancelled flag
      })
      .catch(error => {
        console.error('Error accessing microphone:', error);
        toast.error("Microphone access denied. Please allow microphone access.");
      });
  }, [transcribeWithWhisper]);

  // Browser speech recognition fallback
  const startBrowserSpeechRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in this browser.");
      return;
    }
    
    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = true;
    
    let finalTranscriptText = '';
    
    rec.onstart = () => {
      setIsMicActive(true);
      finalTranscriptText = ''; // Reset when starting
      isCancelledRef.current = false; // Reset cancelled flag
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
    
    rec.onerror = () => {
      toast.error("Microphone error – please try again.");
      setIsMicActive(false);
      setIsSubmitting(false);
    };
    
    rec.onend = () => {
      if (isMicActive) {
        setIsMicActive(false);
        
        // Auto-send the final transcript if it's not empty AND not cancelled
        if (finalTranscriptText && finalTranscriptText.trim() && !isCancelledRef.current) {
          // Pause any currently playing TTS when user sends a message via voice
          ttsService.stop();
          setIsSubmitting(true);
          onGenerate(finalTranscriptText.trim());
          setText("");
          setIsSubmitting(false);
        }
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
      // Stop recording manually - user clicked cancel
      if (useWhisper && mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      } else if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsMicActive(false);
      setIsSubmitting(false);
      return;
    }

    // Use Whisper if available, otherwise fallback to browser speech recognition
    if (useWhisper && openaiClient) {
      startWhisperRecording();
    } else {
      startBrowserSpeechRecognition();
    }
  }, [isMicActive, isSubmitting, useWhisper, openaiClient, startWhisperRecording, startBrowserSpeechRecognition]);

  // New function to handle sending the recorded audio
  const handleSendRecording = useCallback(() => {
    playClickSound();
    
    if (useWhisper && mediaRecorderRef.current) {
      // Stop Whisper recording and process
      mediaRecorderRef.current.stop();
    } else if (recognitionRef.current) {
      // Stop browser speech recognition and process
      recognitionRef.current.stop();
    }
    
    // The actual processing and sending will happen in the respective onStop handlers
    // which already have the auto-send logic
  }, [useWhisper]);

  // New function to handle canceling the recording
  const handleCancelRecording = useCallback(() => {
    playClickSound();
    
    // Set cancelled flag to prevent auto-sending
    isCancelledRef.current = true;
    
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
      
      onGenerate(text.trim());
      setText("");
      setIsSubmitting(false);
    },
    [onGenerate, text, isMicActive, useWhisper]
  );

  return (
    <section aria-label="Create next panel" className="bg-transparent">
      <form onSubmit={submit} className="flex items-stretch gap-2 bg-transparent">
        {isMicActive ? (
          // Recording state: Show Send and Cancel buttons
          <>
            <Button
              type="button"
              variant="comic"
              size="icon"
              onClick={handleSendRecording}
              aria-label="Send recording"
              className="flex-shrink-0 btn-animate bg-green-500 hover:bg-green-600 text-white border-green-500"
            >
              <Send className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="comic"
              size="icon"
              onClick={handleCancelRecording}
              aria-label="Cancel recording"
              className="flex-shrink-0 btn-animate bg-red-500 hover:bg-red-600 text-white border-red-500"
            >
              <X className="h-5 w-5" />
            </Button>
          </>
        ) : (
          // Normal state: Show Mic button
          <Button
            type="button"
            variant="comic"
            size="icon"
            onClick={startVoice}
            aria-label="Voice input"
            className="flex-shrink-0 btn-animate"
          >
            <Mic className="h-5 w-5" />
          </Button>
        )}
        {isMicActive ? (
          <WaveformVisualizer />
        ) : (
          <Input
            aria-label="What happens next?"
            placeholder="What happens next?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="rounded-xl flex-1 bg-white/90 border-0 shadow-sm focus:shadow-md transition-shadow backdrop-blur-sm"
          />
        )}
        <Button 
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            if (!text.trim()) {
              toast.error("Please write something first before generating an image.");
              return;
            }
            playClickSound();
            // Pause any currently playing TTS when user generates an image
            ttsService.stop();
            onGenerate(`create image: ${text.trim()}`);
            setText("");
          }}
          aria-label="Generate new image"
          className="h-10 w-10 bg-white/90 hover:bg-primary hover:text-primary-foreground shadow-sm hover:shadow-md flex-shrink-0 btn-animate border-0 backdrop-blur-sm"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Button type="submit" variant="outline" size="icon" className="h-10 w-10 bg-white/90 hover:bg-primary hover:text-primary-foreground shadow-sm hover:shadow-md flex-shrink-0 btn-animate border-0 backdrop-blur-sm">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </section>
  );
};

export default InputBar;
