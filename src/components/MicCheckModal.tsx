import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { setMicVerified } from "@/lib/mic-verification";
import { ttsService } from "@/lib/tts-service";
import { Mic, Square, Volume2 } from "lucide-react";

interface MicCheckModalProps {
	open: boolean;
	onClose: () => void;
	onPassed?: () => void;
}

const PHRASES_EN = [
	"Reading app ready",
	"I'm ready to read now",
	"Let's start my reading",
	"Hello, I am ready",
];

function normalize(text: string): string {
	return (text || "")
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function tokenMatchScore(target: string, transcript: string): number {
	const t1 = normalize(target).split(" ").filter(Boolean);
	const t2 = new Set(normalize(transcript).split(" ").filter(Boolean));
	if (t1.length === 0) return 0;
	let hit = 0;
	for (const tok of t1) if (t2.has(tok)) hit++;
	return hit / t1.length;
}

export const MicCheckModal: React.FC<MicCheckModalProps> = ({ open, onClose, onPassed }) => {
	const { user } = useAuth();
	const [isRecording, setIsRecording] = React.useState(false);
	const [isProcessing, setIsProcessing] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [isSuccess, setIsSuccess] = React.useState(false);
	const [transcript, setTranscript] = React.useState<string>("");
	const [phrase, setPhrase] = React.useState<string>(() => PHRASES_EN[Math.floor(Math.random() * PHRASES_EN.length)]);
	const [level, setLevel] = React.useState<number>(0); // 0..1 approx RMS
	const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
	const chunksRef = React.useRef<Blob[]>([]);
	const streamRef = React.useRef<MediaStream | null>(null);
	const analyserRef = React.useRef<AnalyserNode | null>(null);
	const rafRef = React.useRef<number | null>(null);
	const audioCtxRef = React.useRef<AudioContext | null>(null);

	const backendBaseUrl = React.useMemo(() => {
		try {
			const v = ((import.meta as any).env?.VITE_BACKEND_BASE_URL || "") as string;
			return (v && typeof v === "string") ? v.replace(/\/+$/, "") : "";
		} catch {
			return "";
		}
	}, []);

	const speakInstruction = React.useCallback(async () => {
		try {
			const instruction = `Read the below message aloud: ${phrase}`;
			await ttsService.speak(instruction, { messageId: 'krafty-mic-check' });
		} catch {
			// ignore TTS errors
		}
	}, [phrase]);

	const speakPhraseOnly = React.useCallback(async () => {
		try {
			await ttsService.speak(phrase, { messageId: 'krafty-mic-check-phrase' });
		} catch {
			// ignore TTS errors
		}
	}, [phrase]);

	const stopVisualize = React.useCallback(() => {
		if (rafRef.current) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
		if (audioCtxRef.current) {
			try { audioCtxRef.current.close(); } catch {}
			audioCtxRef.current = null;
		}
		analyserRef.current = null;
	}, []);

	const startVisualize = React.useCallback((stream: MediaStream) => {
		try {
			const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
			const ctx: AudioContext = new Ctx();
			audioCtxRef.current = ctx;
			const src = ctx.createMediaStreamSource(stream);
			const analyser = ctx.createAnalyser();
			analyser.fftSize = 512;
			src.connect(analyser);
			analyserRef.current = analyser;
			const data = new Uint8Array(analyser.frequencyBinCount);
			const tick = () => {
				analyser.getByteTimeDomainData(data);
				// approximate RMS from time domain
				let sum = 0;
				for (let i = 0; i < data.length; i++) {
					const v = (data[i] - 128) / 128;
					sum += v * v;
				}
				const rms = Math.sqrt(sum / data.length);
				setLevel(Math.min(1, rms * 2)); // scale a bit
				rafRef.current = requestAnimationFrame(tick);
			};
			rafRef.current = requestAnimationFrame(tick);
		} catch {
			// ignore visualization errors
		}
	}, []);

	const startRecording = React.useCallback(async () => {
		setError(null);
		setTranscript("");
		try { ttsService.stop(true); } catch {}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			streamRef.current = stream;
			chunksRef.current = [];
			const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
			mediaRecorderRef.current = mr;
			mr.ondataavailable = (e) => {
				if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
			};
			mr.onstop = async () => {
				try { stream.getTracks().forEach(t => t.stop()); } catch {}
				stopVisualize();
				setIsRecording(false);
				setIsProcessing(true);
				try {
					// Build form for Whisper endpoint
					const blob = new Blob(chunksRef.current, { type: "audio/webm" });
					const file = new File([blob], "speech.webm", { type: "audio/webm" });
					const fd = new FormData();
					fd.append("file", file);
					fd.append("model", "whisper-v3-turbo");
					fd.append("language", "en");
					const url = `${backendBaseUrl}/api/fireworks/transcribe`;
					const resp = await fetch(url, { method: "POST", body: fd });
					const json: any = await resp.json().catch(() => ({}));
					const text = (json?.text || "").toString();
					setTranscript(text);
					// Evaluate match
					const score = tokenMatchScore(phrase, text);
					if (score >= 0.8) {
						// Mark verified and show success briefly before closing
						try { if (user?.uid) setMicVerified(user.uid); } catch {}
						setIsSuccess(true);
						setError(null);
						setTimeout(() => {
							onPassed?.();
							onClose();
						}, 1000);
					} else {
						setError("We couldn't hear the phrase clearly. Please try again.");
					}
				} catch (err) {
					setError("Transcription failed. Please try again.");
				} finally {
					setIsProcessing(false);
				}
			};
			startVisualize(stream);
			mr.start();
			setIsRecording(true);
		} catch (e) {
			setError("Unable to access microphone. Please check browser permissions.");
		} finally {
			setIsProcessing(false);
		}
	}, [backendBaseUrl, onClose, onPassed, phrase, startVisualize, stopVisualize, user?.uid]);

	const stopRecording = React.useCallback(() => {
		try {
			if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
				mediaRecorderRef.current.stop();
			}
		} catch {
			// ignore
		}
	}, []);

	React.useEffect(() => {
		if (!open) {
			try { stopRecording(); } catch {}
			stopVisualize();
			try { ttsService.stop(true); } catch {}
			setIsSuccess(false);
		}
	}, [open, stopRecording, stopVisualize]);

	const handleRetry = React.useCallback(() => {
		setError(null);
		setTranscript("");
		setPhrase(PHRASES_EN[Math.floor(Math.random() * PHRASES_EN.length)]);
	}, []);

	// Auto-speak instruction when the modal opens
	React.useEffect(() => {
		if (!open) return;
		let cancelled = false;
		Promise.resolve().then(async () => {
			if (cancelled) return;
			await speakInstruction();
		});
		return () => { cancelled = true; };
	}, [open, speakInstruction]);

	return (
		<Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
			<DialogContent
				className="w-full max-w-md mx-auto bg-card border-2 border-primary/30 shadow-2xl rounded-3xl"
				onPointerDownOutside={(e) => e.preventDefault()}
				onInteractOutside={(e) => e.preventDefault()}
				onEscapeKeyDown={(e) => e.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle className="text-2xl">Quick mic check</DialogTitle>
				</DialogHeader>

				<div className="mt-3 space-y-3">
					{/* Simple level meter */}
					<div className="h-3 w-full bg-muted rounded-full overflow-hidden">
						<div
							className="h-full bg-primary transition-all"
							style={{ width: `${Math.min(100, Math.max(5, Math.round(level * 100)))}%` }}
						/>
					</div>
					<div className="flex items-center justify-between gap-2">
						<div className="text-sm text-muted-foreground">
							Message: <span className="font-semibold">{phrase}</span>
						</div>
						<Button
							size="icon"
							variant="outline"
							onClick={speakPhraseOnly}
							disabled={isRecording || isProcessing}
							aria-label="Play message"
							title="Play message"
						>
							<Volume2 className="h-4 w-4" />
						</Button>
					</div>
					
					{isSuccess ? (
						<div className="text-sm text-green-600 font-medium">Mic looks good! You're ready to go.</div>
					) : error ? (
						<div className="text-sm text-destructive">{error}</div>
					) : null}
				</div>

				<div className="mt-5 flex items-center justify-end gap-3">
					<Button
						variant="secondary"
						onClick={handleRetry}
						disabled={isRecording || isProcessing || isSuccess}
					>
						New phrase
					</Button>
					<Button
						type="button"
						variant="comic"
						size="icon"
						onClick={isRecording ? stopRecording : startRecording}
						aria-label={isRecording ? "Stop recording" : "Start recording"}
						className={`flex-shrink-0 btn-animate ${isRecording ? 'bg-red-500 hover:bg-red-600 text-white border-red-500' : ''}`}
						disabled={isProcessing || isSuccess}
						title={isRecording ? "Stop" : "Record"}
					>
						{isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
};

export default MicCheckModal;


