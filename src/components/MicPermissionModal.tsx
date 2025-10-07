import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ensureMicPermission } from "@/lib/mic-permission";

interface MicPermissionModalProps {
  open: boolean;
  onClose: () => void;
  onEnabled?: () => void;
}

export const MicPermissionModal: React.FC<MicPermissionModalProps> = ({ open, onClose, onEnabled }) => {
  const [isRequesting, setIsRequesting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleEnableClick = async () => {
    setError(null);
    setIsRequesting(true);
    try {
      const granted = await ensureMicPermission();
      if (!granted) {
        setError("We couldn't access your microphone. You can enable it in your browser settings later.");
      }
      onEnabled?.();
      onClose();
    } catch (e) {
      setError("Something went wrong requesting the microphone.");
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-full max-w-md mx-auto bg-card border-2 border-primary/30 shadow-2xl rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Enable your microphone</DialogTitle>
          <DialogDescription>
            Turn on your microphone for a fun Adventure!
          </DialogDescription>
        </DialogHeader>

        {/* <div className="space-y-3 text-sm text-muted-foreground">
          {error && (
            <p className="text-destructive">{error}</p>
          )}
        </div> */}

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isRequesting}>
            Maybe later
          </Button>
          <Button onClick={handleEnableClick} disabled={isRequesting}>
            {isRequesting ? "Requesting…" : "Enable microphone"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MicPermissionModal;


