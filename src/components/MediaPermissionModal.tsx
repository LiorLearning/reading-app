import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ensureMediaPermissions } from "@/lib/media-permission";

interface MediaPermissionModalProps {
  open: boolean;
  onClose: () => void;
  onEnabled?: (result: { micGranted: boolean; camGranted: boolean }) => void;
}

export const MediaPermissionModal: React.FC<MediaPermissionModalProps> = ({ open, onClose, onEnabled }) => {
  const [isRequesting, setIsRequesting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleEnableClick = async () => {
    setError(null);
    setIsRequesting(true);
    try {
      const result = await ensureMediaPermissions();
      onEnabled?.(result);
      onClose();
    } catch (e) {
      setError("Something went wrong requesting microphone and camera.");
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-full max-w-md mx-auto bg-card border-2 border-primary/30 shadow-2xl rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Enable microphone and camera</DialogTitle>
          <DialogDescription>
            We use your microphone for speaking with your pet and the camera for selfies.
          </DialogDescription>
        </DialogHeader>

        {/* {error && (<p className="text-destructive text-sm">{error}</p>)} */}

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isRequesting}>
            Continue without
          </Button>
          <Button onClick={handleEnableClick} disabled={isRequesting}>
            {isRequesting ? "Requesting…" : "Use microphone and camera"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MediaPermissionModal;


