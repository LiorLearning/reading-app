import React from "react";
import { Button } from "@/components/ui/button";
import { X, Camera, CameraOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface RightUserOverlayProps {
  userImageUrl: string | null | undefined;
  userMessageText?: string;
  draggable?: boolean; // Reserved for future use; non-draggable for now
  autoHideToken?: unknown; // Hide bubble when this changes (e.g., after image creation)
  onBubbleVisibilityChange?: (visible: boolean) => void;
  /** Bottom spacing from the panel edge to allow docking UI beneath the avatar */
  bottomOffsetPx?: number;
  /** Show the live camera feed inside the avatar instead of a static image */
  showCameraInAvatar?: boolean;
  /** Choose which side of the stage to anchor the user overlay */
  side?: "left" | "right";
}

/**
 * Bottom-right user avatar with a speech bubble to its left.
 * Mirrors the styling of `LeftPetOverlay` so the conversation feels 2-sided.
 */
const RightUserOverlay: React.FC<RightUserOverlayProps> = ({
  userImageUrl,
  userMessageText,
  autoHideToken,
  onBubbleVisibilityChange,
  bottomOffsetPx = 0,
  showCameraInAvatar = false,
  side = "right",
}) => {
  const [isBubbleHidden, setIsBubbleHidden] = React.useState(false);
  const lastUserTextRef = React.useRef<string | undefined>(undefined);
  const hiddenAtTextRef = React.useRef<string | undefined>(undefined);
  const [hiddenReason, setHiddenReason] = React.useState<null | "manual" | "auto">(null);
  const [cameraStream, setCameraStream] = React.useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [isCameraEnabled, setIsCameraEnabled] = React.useState<boolean>(false);
  const [isRequesting, setIsRequesting] = React.useState<boolean>(false);
  const { toast } = useToast();

  const isLeftSide = side === "left";

  const startCamera = React.useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({ title: "Camera not supported", description: "Use a modern browser on HTTPS or localhost.", duration: 5000 });
        return;
      }
      if (!window.isSecureContext) {
        toast({ title: "Secure context required", description: "Camera needs HTTPS (or localhost).", duration: 5000 });
      }
      setIsRequesting(true);
      toast({ title: "Requesting camera…", description: "Please allow access in your browser prompt.", duration: 2500 });
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false,
      });
      setCameraStream(media);
      setIsCameraEnabled(true);
      if (videoRef.current) {
        videoRef.current.srcObject = media;
        await videoRef.current.play().catch(() => {});
      }
      setIsRequesting(false);
    } catch (e) {
      const error = e as DOMException | Error;
      setCameraStream(null);
      setIsCameraEnabled(false);
      setIsRequesting(false);
      const name = (error as DOMException)?.name || (error as Error)?.name || 'Error';
      const message =
        name === 'NotAllowedError'
          ? 'Permission denied. Click the camera icon in the address bar to enable.'
          : name === 'NotFoundError'
          ? 'No camera found on this device.'
          : name === 'NotReadableError'
          ? 'Camera is in use by another app. Close it and try again.'
          : 'Unable to access the camera.';
      toast({ title: 'Camera error', description: message, duration: 6000 });
    }
  }, [toast]);

  // Track last user text so we can restore it if user taps avatar
  React.useEffect(() => {
    if (userMessageText) {
      lastUserTextRef.current = userMessageText;
    }
  }, [userMessageText]);

  // Hide bubble when token changes (e.g., after image shows)
  React.useEffect(() => {
    if (autoHideToken !== undefined) {
      setIsBubbleHidden(true);
      setHiddenReason("auto");
      hiddenAtTextRef.current = userMessageText || lastUserTextRef.current;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoHideToken]);

  // If auto-hidden, show again when a NEW user message arrives
  React.useEffect(() => {
    if (
      hiddenReason === "auto" &&
      userMessageText &&
      userMessageText !== hiddenAtTextRef.current
    ) {
      setIsBubbleHidden(false);
      setHiddenReason(null);
    }
  }, [userMessageText, hiddenReason]);

  const displayText = isBubbleHidden
    ? undefined
    : userMessageText || lastUserTextRef.current;

  // Publish visibility changes
  React.useEffect(() => {
    const visible = !isBubbleHidden && !!displayText;
    onBubbleVisibilityChange?.(visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBubbleHidden, !!displayText]);

  // Auto-start if requested by prop on mount; cleanup on unmount
  React.useEffect(() => {
    // if (showCameraInAvatar && isCameraEnabled && !cameraStream) {
    //   startCamera();
    // }
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCameraInAvatar]);

  // Attach stream to video when available
  React.useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraStream]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        className={cn(
          "absolute flex items-center gap-3 select-none",
        )}
        style={{
          [isLeftSide ? "left" : "right"]: 16,
          bottom: bottomOffsetPx,
        }}
      >
        {/* Bubble adjacent to the user avatar */}
        {!isBubbleHidden && (
          <div className={cn("pointer-events-auto relative", isLeftSide ? "order-2" : "order-1")}>
            <div
              className="bg-white/95 border-2 border-black rounded-2xl shadow-[0_6px_0_rgba(0,0,0,0.6)] px-4 py-3 max-h-40 overflow-y-auto overflow-x-hidden max-w-none"
              style={{ maxWidth: 'min(65vw, 360px)' }}
            >
              <div className="text-base leading-relaxed break-words">
                {displayText ? (
                  <span>{displayText}</span>
                ) : (
                  <span className="opacity-60">Tell Krafty what you think…</span>
                )}
              </div>
              {/* Close button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsBubbleHidden(true);
                  setHiddenReason("manual");
                }}
                className="absolute top-1 left-1 h-6 w-6 p-0 rounded-full hover:bg-black/10"
                aria-label="Hide message"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            {/* Tail pointing toward the avatar */}
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 w-0 h-0 border-t-[10px] border-b-[10px] border-t-transparent border-b-transparent",
                isLeftSide
                  ? "left-[-10px] border-r-[10px] border-r-black"
                  : "right-[-10px] border-l-[10px] border-l-black",
              )}
            />
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 w-0 h-0 border-t-[9px] border-b-[9px] border-t-transparent border-b-transparent",
                isLeftSide
                  ? "left-[-8px] border-r-[9px] border-r-white"
                  : "right-[-8px] border-l-[9px] border-l-white",
              )}
            />
          </div>
        )}

        {/* User avatar */}
        <div
          className={cn(
            "pointer-events-auto w-[50px] h-[50px] rounded-full overflow-hidden shadow-[0_6px_0_rgba(0,0,0,0.6)] border-2 border-black bg-white/70 backdrop-blur-sm",
            isLeftSide ? "order-1" : "order-2",
          )}
          onClick={(e) => {
            e.stopPropagation();
            setIsBubbleHidden(false);
            setHiddenReason(null);
          }}
        >
            <img
              src="/avatars/krafty-old.png"
              alt="Default avatar"
              className="w-full h-full object-cover rounded-full"
            />
          {/* {isCameraEnabled && cameraStream ? (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1] rounded-full" />
          ) 
          // : userImageUrl ? (
          //   <img src={userImageUrl} alt="You" className="w-full h-full object-cover rounded-full" />
          // ) 
          : (
          
          )} */}

          {isRequesting && (
            <div className="absolute inset-0 grid place-items-center bg-black/40">
              <div className="h-3 w-3 rounded-full bg-white animate-pulse"></div>
            </div>
          )}

          {/* Camera toggle button */}
          {/* <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isCameraEnabled) {
                if (cameraStream) {
                  cameraStream.getTracks().forEach(t => t.stop());
                  setCameraStream(null);
                }
                setIsCameraEnabled(false);
              } else {
                // Call getUserMedia directly in the click handler to satisfy mobile/Safari gesture requirements
             //   startCamera();
              }
            }}
            aria-label={isCameraEnabled ? "Turn camera off" : "Turn camera on"}
            title={isCameraEnabled ? "Turn camera off" : "Turn camera on"}
            className="absolute top-1 right-1 h-4 w-4 grid place-items-center rounded-full border-2 border-black bg-white/80 hover:bg-white text-black shadow-[0_2px_0_rgba(0,0,0,0.6)] disabled:opacity-60"
            disabled={isRequesting}
          >
            {isCameraEnabled ? (
              <Camera className="h-4 w-4" />
            ) : (
              <CameraOff className="h-4 w-4" />
            )}
          </button> */}
        </div>
      </div>
    </div>
  );
};

export default RightUserOverlay;


