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
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recognitionRef = useRef<any | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [useWhisper, setUseWhisper] = useState(false);
  const isCancelledRef = useRef(false);
  const pendingActionRef = useRef<'send' | 'image' | null>(null);
  const optimisticMessageRef = useRef<string | null>(null);
  
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
          
          // Stop all tracks first
          stream.getTracks().forEach(track => track.stop());
          
          // Check if recording was cancelled
          if (isCancelledRef.current) {
            setIsMicActive(false);
            setIsTranscribing(false);
            setText(""); // Clear any partial text
            optimisticMessageRef.current = null;
            return;
          }
          
          try {
            const transcription = await transcribeWithWhisper(audioBlob);
            
            if (transcription && transcription.trim()) {
              console.log('Whisper transcription completed:', transcription.trim());
              
              // Check if there's a pending action to execute
              if (pendingActionRef.current === 'send') {
                // Update the optimistic message with actual transcription
                if (optimisticMessageRef.current) {
                  // The message was already sent optimistically, now we need to update it
                  // This will be handled by the parent component
                  console.log('Updating optimistic message with transcription:', transcription.trim());
                  onGenerate(`__UPDATE_OPTIMISTIC__:${optimisticMessageRef.current}:${transcription.trim()}`);
                  optimisticMessageRef.current = null;
                } else {
                  // Fallback: send normally
                  onGenerate(transcription.trim());
                }
                pendingActionRef.current = null;
                setIsMicActive(false);
                setIsTranscribing(false);
                ttsService.stop();
                setText("");
              } else if (pendingActionRef.current === 'image') {
                // Update optimistic image request
                if (optimisticMessageRef.current) {
                  onGenerate(`__UPDATE_OPTIMISTIC__:${optimisticMessageRef.current}:create image: ${transcription.trim()}`);
                  optimisticMessageRef.current = null;
                } else {
                  // Fallback: send normally
                  onGenerate(`create image: ${transcription.trim()}`);
                }
                pendingActionRef.current = null;
                setIsMicActive(false);
                setIsTranscribing(false);
                ttsService.stop();
                setText("");
              } else {
                // Normal behavior: set text for user to choose action
                setText(transcription.trim());
                setIsMicActive(false);
                setIsTranscribing(false);
              }
            } else {
              setIsMicActive(false);
              setIsTranscribing(false);
              // If no transcription and this was optimistic, we need to handle the failed case
              if (optimisticMessageRef.current) {
                onGenerate(`__UPDATE_OPTIMISTIC__:${optimisticMessageRef.current}:Unable to transcribe audio`);
                optimisticMessageRef.current = null;
              }
            }
          } catch (error) {
            console.error('Whisper transcription failed:', error);
            toast.error("Failed to transcribe audio. Using browser speech recognition as fallback.");
            
            // Handle optimistic message failure
            if (optimisticMessageRef.current) {
              onGenerate(`__UPDATE_OPTIMISTIC__:${optimisticMessageRef.current}:Transcription failed`);
              optimisticMessageRef.current = null;
            }
            
            // Stop current recording state and fallback to browser recognition
            setIsMicActive(false);
            setIsTranscribing(false);
            
            // Small delay to ensure state is updated before starting fallback
            setTimeout(() => {
              startBrowserSpeechRecognition();
            }, 100);
          }
        };

        mediaRecorder.start();
        setIsMicActive(true);
        isCancelledRef.current = false; // Reset cancelled flag
      })
      .catch(error => {
        console.error('Error accessing microphone:', error);
        toast.error("Microphone access denied. Please allow microphone access.");
      });
  }, [transcribeWithWhisper, onGenerate]);

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
      // Always stop the recording state first
      setIsMicActive(false);
      setIsTranscribing(false);
      
      // Handle final transcript - either execute pending action or set text
      if (finalTranscriptText && finalTranscriptText.trim() && !isCancelledRef.current) {
        console.log('Browser speech recognition completed:', finalTranscriptText.trim());
        
        // Check if there's a pending action to execute
        if (pendingActionRef.current === 'send') {
          // Update optimistic message with actual transcription
          if (optimisticMessageRef.current) {
            console.log('Updating optimistic message with browser transcription:', finalTranscriptText.trim());
            onGenerate(`__UPDATE_OPTIMISTIC__:${optimisticMessageRef.current}:${finalTranscriptText.trim()}`);
            optimisticMessageRef.current = null;
          } else {
            // Fallback: send normally
            onGenerate(finalTranscriptText.trim());
          }
          pendingActionRef.current = null;
          ttsService.stop();
          setText("");
        } else if (pendingActionRef.current === 'image') {
          // Update optimistic image request
          if (optimisticMessageRef.current) {
            onGenerate(`__UPDATE_OPTIMISTIC__:${optimisticMessageRef.current}:create image: ${finalTranscriptText.trim()}`);
            optimisticMessageRef.current = null;
          } else {
            // Fallback: send normally
            onGenerate(`create image: ${finalTranscriptText.trim()}`);
          }
          pendingActionRef.current = null;
          ttsService.stop();
          setText("");
        } else {
          // Normal behavior: set text for user to choose action
          setText(finalTranscriptText.trim());
        }
      } else if (isCancelledRef.current) {
        console.log('Speech recognition cancelled');
        pendingActionRef.current = null; // Clear any pending action
        setText(""); // Clear any partial text if cancelled
        optimisticMessageRef.current = null;
      } else {
        // No transcription available
        if (optimisticMessageRef.current && pendingActionRef.current) {
          onGenerate(`__UPDATE_OPTIMISTIC__:${optimisticMessageRef.current}:Unable to transcribe audio`);
          optimisticMessageRef.current = null;
          pendingActionRef.current = null;
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
    
    // Use Whisper if available, otherwise fallback to browser speech recognition
    if (useWhisper && openaiClient) {
      startWhisperRecording();
    } else {
      startBrowserSpeechRecognition();
    }
  }, [isMicActive, isSubmitting, useWhisper, openaiClient, startWhisperRecording, startBrowserSpeechRecognition]);


  // Function to handle canceling the recording
  const handleCancelRecording = useCallback(() => {
    playClickSound();
    
    // Set cancelled flag to prevent auto-sending
    isCancelledRef.current = true;
    pendingActionRef.current = null; // Clear any pending action
    
    // Clear optimistic message if it exists
    if (optimisticMessageRef.current) {
      console.log('Cancelling optimistic message:', optimisticMessageRef.current);
      onGenerate(`__CANCEL_OPTIMISTIC__:${optimisticMessageRef.current}`);
      optimisticMessageRef.current = null;
    }
    
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
    setIsTranscribing(false);
    setText(""); // Clear any partial text
  }, [useWhisper, onGenerate]);

  // Function to handle send button during recording
  const handleSendDuringRecording = useCallback(() => {
    playClickSound();
    console.log('Send button clicked during recording - stopping and sending...');
    
    // Set pending action to send
    pendingActionRef.current = 'send';
    
    // Show immediate transcription state
    setIsTranscribing(true);
    
    // Generate unique ID for optimistic message
    const optimisticId = `optimistic_${Date.now()}`;
    optimisticMessageRef.current = optimisticId;
    
    // Send optimistic message immediately
    console.log('Sending optimistic message with ID:', optimisticId);
    onGenerate(`__OPTIMISTIC__:${optimisticId}:🎤 Transcribing audio...`);
    
    // Clear text input and stop recording
    setText("");
    
    // Stop recording and let transcription handler do the updating
    if (useWhisper && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    } else if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, [useWhisper, onGenerate]);

  // Function to handle create image button during recording
  const handleImageDuringRecording = useCallback(() => {
    playClickSound();
    console.log('Create image button clicked during recording - stopping and sending as image...');
    
    // Set pending action to image
    pendingActionRef.current = 'image';
    
    // Show immediate transcription state
    setIsTranscribing(true);
    
    // Generate unique ID for optimistic message
    const optimisticId = `optimistic_${Date.now()}`;
    optimisticMessageRef.current = optimisticId;
    
    // Send optimistic image request immediately
    console.log('Sending optimistic image message with ID:', optimisticId);
    onGenerate(`__OPTIMISTIC__:${optimisticId}:🎨 Creating image from audio...`);
    
    // Clear text input and stop recording
    setText("");
    
    // Stop recording and let transcription handler do the updating
    if (useWhisper && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    } else if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, [useWhisper, onGenerate]);

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
        {isMicActive || isTranscribing ? (
          // Recording/Transcribing state: Show Cancel button
          <Button
            type="button"
            variant="comic"
            size="icon"
            onClick={handleCancelRecording}
            aria-label={isTranscribing ? "Cancel transcription" : "Cancel recording"}
            className="flex-shrink-0 btn-animate bg-red-500 hover:bg-red-600 text-white border-red-500"
          >
            <X className="h-5 w-5" />
          </Button>
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
        ) : isTranscribing ? (
          // Transcription loading state
          <div className="flex items-center justify-center gap-2 h-10 px-4 bg-blue-50/90 rounded-xl shadow-sm flex-1 backdrop-blur-sm border border-blue-200">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-blue-600 font-medium">Transcribing...</span>
          </div>
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
          disabled={!text.trim() && !isMicActive && !isTranscribing}
          onClick={() => {
            if (isMicActive) {
              // During recording: stop and send as image
              handleImageDuringRecording();
            } else if (isTranscribing) {
              // During transcription: ignore clicks
              return;
            } else {
              // Normal mode: check text and send as image
              if (!text.trim()) {
                toast.error("Please write something first before generating an image.");
                return;
              }
              playClickSound();
              ttsService.stop();
              onGenerate(`create image: ${text.trim()}`);
              setText("");
            }
          }}
          aria-label={isMicActive ? "Stop recording and generate image" : isTranscribing ? "Transcribing..." : "Generate new image"}
          className={cn(
            "h-10 w-10 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 hover:from-purple-600 hover:via-pink-600 hover:to-orange-500 text-white shadow-lg hover:shadow-xl hover:scale-105 flex-shrink-0 btn-animate border-0 backdrop-blur-sm transition-all duration-300 relative overflow-hidden group",
            (!text.trim() && !isMicActive && !isTranscribing) && "opacity-50 cursor-not-allowed hover:scale-100",
            isTranscribing && "opacity-75 cursor-wait hover:scale-100"
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-300/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <ImageIcon className="h-4 w-4 relative z-10 drop-shadow-sm" />
        </Button>
        <Button 
          type="button"
          variant="outline" 
          size="icon" 
          disabled={!text.trim() && !isMicActive && !isTranscribing}
          onClick={(e) => {
            if (isMicActive) {
              // During recording: stop and send directly
              e.preventDefault();
              handleSendDuringRecording();
            } else if (isTranscribing) {
              // During transcription: ignore clicks
              e.preventDefault();
            } else {
              // Normal mode: use regular submit logic
              submit(e);
            }
          }}
          aria-label={isMicActive ? "Stop recording and send" : isTranscribing ? "Transcribing..." : "Send message"}
          className={cn(
            "h-10 w-10 bg-white/90 hover:bg-primary hover:text-primary-foreground shadow-sm hover:shadow-md flex-shrink-0 btn-animate border-0 backdrop-blur-sm",
            (!text.trim() && !isMicActive && !isTranscribing) && "opacity-50 cursor-not-allowed",
            isTranscribing && "opacity-75 cursor-wait"
          )}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </section>
  );
};

export default InputBar;
