import React, { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, Share2 } from 'lucide-react'

interface DeviceGateModalProps {
  open: boolean
  onClose: () => void
  onContinueAnyway: () => void
}

export const DeviceGateModal: React.FC<DeviceGateModalProps> = ({ open, onClose, onContinueAnyway }) => {
  const url = useMemo(() => window.location.href, [])
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  const handleShare = async () => {
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({ title: 'Open on iPad or laptop', url })
      } catch {
        // ignore
      }
    } else {
      // Fallback: copy link if Web Share API is unavailable
      handleCopy()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-md mx-auto bg-card border-2 border-primary/30 shadow-2xl rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold">Best on iPad or Laptop</DialogTitle>
          <DialogDescription className="text-center">
            For the smoothest experience, please open this link on an iPad or a laptop.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input readOnly value={url} className="font-mono" />
            <Button onClick={handleCopy} variant="secondary" title="Copy link">
              <Copy className="h-4 w-4" />
            </Button>
            <Button onClick={handleShare} variant="secondary" title="Share">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>

          {copied && <div className="text-sm text-green-500">Link copied</div>}

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={onContinueAnyway}>
              Continue anyway
            </Button>
            {/* <Button className="flex-1" variant="outline" onClick={() => {}}>
              Close
            </Button> */}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default DeviceGateModal


