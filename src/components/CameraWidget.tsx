import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CameraWidgetProps {
  className?: string;
}

const MIN_SIZE = 100;
const MAX_SIZE = 150;
const DEFAULT_SIZE = 130 // 48 * 4px (w-48)

export const CameraWidget: React.FC<CameraWidgetProps> = ({ className }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [isResizing, setIsResizing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const resizeStartRef = useRef<{ startX: number; startY: number; startSize: number } | null>(null);

  // Request camera access on mount
  useEffect(() => {
    requestCameraAccess();

    return () => {
      stopCamera();
    };
  }, []);

  // Monitor stream health and auto-restart if needed
  useEffect(() => {
    if (!stream) return;

    const checkStreamHealth = () => {
      const tracks = stream.getVideoTracks();
      if (tracks.length === 0 || tracks[0].readyState === 'ended') {
        console.log('Camera stream ended, attempting to restart...');
        requestCameraAccess();
      }
    };

    const healthCheck = setInterval(checkStreamHealth, 5000);

    return () => {
      clearInterval(healthCheck);
    };
  }, [stream]);

  // Assign stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;

      videoRef.current
        .play()
        .then(() => console.log('Video playing'))
        .catch((err) => {
          console.error('Error playing video:', err);
        });
    }
  }, [stream]);

  const requestCameraAccess = async (retryCount = 0) => {
    try {
      setError(null);

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 480 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      console.log('Got media stream:', mediaStream);
      console.log('Video tracks:', mediaStream.getVideoTracks());

      setStream(mediaStream);
    } catch (err: any) {
      console.error('Camera access error:', err);
      
      // Auto-retry logic for temporary failures
      if (retryCount < 3 && (err.name === 'NotReadableError' || err.name === 'AbortError')) {
        console.log(`Retrying camera access (attempt ${retryCount + 1})`);
        setTimeout(() => requestCameraAccess(retryCount + 1), 2000);
        return;
      }
      
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found');
      } else {
        setError('Camera error');
      }
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Handle mouse resize events
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeStartRef.current) return;
      
      const deltaX = e.clientX - resizeStartRef.current.startX;
      const deltaY = e.clientY - resizeStartRef.current.startY;
      const delta = Math.max(deltaX, deltaY); // Use the larger movement
      
      const newSize = Math.min(MAX_SIZE, Math.max(MIN_SIZE, resizeStartRef.current.startSize + delta));
      setSize(newSize);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startSize: size
    };
  };

  const adjustSize = (increment: boolean) => {
    const step = 20;
    const newSize = increment 
      ? Math.min(MAX_SIZE, size + step)
      : Math.max(MIN_SIZE, size - step);
    setSize(newSize);
  };

  return (
    <div className={cn('fixed bottom-6 left-6 z-50 group', className)}>
      <div className="relative">
        <div 
          className="relative rounded-full overflow-hidden shadow-lg border-2 border-white/30 bg-black"
          style={{ width: `${size}px`, height: `${size}px` }}
        >
          {stream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-800">
              <div className="text-center">
                {error ? (
                  <>
                    <div className="h-6 w-6 mx-auto mb-1 bg-red-500 rounded-full animate-pulse"></div>
                    <p className="text-xs text-gray-400">Error</p>
                  </>
                ) : (
                  <>
                    <div className="h-6 w-6 mx-auto mb-1 bg-blue-500 rounded-full animate-pulse"></div>
                    <p className="text-xs text-gray-400">Loading...</p>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-1">
            <Button
              onClick={() => adjustSize(false)}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-white hover:bg-white/20 rounded-full"
              disabled={size <= MIN_SIZE}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => adjustSize(true)}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-white hover:bg-white/20 rounded-full"
              disabled={size >= MAX_SIZE}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Resize handle */}
          <div 
            className="absolute bottom-0 right-0 w-4 h-4 bg-white/20 hover:bg-white/40 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            onMouseDown={handleResizeStart}
            style={{
              clipPath: 'polygon(100% 0%, 0% 100%, 100% 100%)'
            }}
          />
        </div>

        {/* Live indicator */}
        {stream && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
        )}
      </div>
    </div>
  );
};
