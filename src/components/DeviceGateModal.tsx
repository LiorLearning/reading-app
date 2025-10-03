import React, { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, Share2, QrCode } from 'lucide-react'

interface DeviceGateModalProps {
  open: boolean
  onClose: () => void
  onContinueAnyway: () => void
}

export const DeviceGateModal: React.FC<DeviceGateModalProps> = ({ open, onClose, onContinueAnyway }) => {
  const url = useMemo(() => window.location.href, [])
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)

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
      setShowQR(true)
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
            <Button onClick={() => setShowQR((v) => !v)} variant="secondary" title="Show QR">
              <QrCode className="h-4 w-4" />
            </Button>
          </div>

          {copied && <div className="text-sm text-green-500">Link copied</div>}

          {showQR && (
            <div className="flex items-center justify-center">
              {/* Simple, dependency-free QR via Google Charts as a fallback */}
              <img
                src={`https://chart.googleapis.com/chart?cht=qr&chs=220x220&chl=${encodeURIComponent(url)}`}
                alt="QR code for this link"
                className="rounded-md border"
                width={220}
                height={220}
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={onContinueAnyway}>
              Continue anyway
            </Button>
            <Button className="flex-1" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default DeviceGateModal


