import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CameraWidgetProps {
  className?: string;
}

export const CameraWidget: React.FC<CameraWidgetProps> = ({ className }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Request camera access on mount
  useEffect(() => {
    requestCameraAccess();

    return () => {
      stopCamera();
    };
  }, []);

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

  const requestCameraAccess = async () => {
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

  const toggleCamera = () => {
    if (stream) {
      stopCamera();
    } else {
      requestCameraAccess();
    }
  };

  const hideWidget = () => {
    setIsVisible(false);
    stopCamera();
  };

  if (!isVisible) return null;

  return (
    <div className={cn('fixed bottom-6 left-6 z-50 group', className)}>
      <div className="relative">
        {stream ? (
          <div className="relative w-48 h-48 rounded-full overflow-hidden shadow-lg border-2 border-white/30 bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1]"
            />

            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-1">
              <Button
                onClick={toggleCamera}
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-white hover:bg-white/20 rounded-full"
              >
                <VideoOff className="h-4 w-4" />
              </Button>
              <Button
                onClick={hideWidget}
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-white hover:bg-white/20 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="w-32 h-32 rounded-full overflow-hidden shadow-lg border-2 border-white/30 bg-gray-800 flex items-center justify-center relative">
            <div className="text-center">
              {error ? (
                <>
                  <VideoOff className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-400">Off</p>
                </>
              ) : (
                <>
                  <Video className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-400">Start</p>
                </>
              )}
            </div>

            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-1">
              <Button
                onClick={toggleCamera}
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-white hover:bg-white/20 rounded-full"
              >
                <Video className="h-4 w-4" />
              </Button>
              <Button
                onClick={hideWidget}
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-white hover:bg-white/20 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {stream && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
        )}
      </div>
    </div>
  );
};
