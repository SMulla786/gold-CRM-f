import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { shareOnWhatsApp } from '@/lib/share'

export type ShareSize = 'A4' | 'MINI'

interface Props {
  open: boolean
  onClose: () => void
  name?: string
  mobile?: string
  buildText: (size: ShareSize) => string
}

/** WhatsApp share via wa.me: edit the number, pick A4 Full / Mini 80mm wording, send as text.
 *  shortcut: text only. Attaching the PDF needs the WhatsApp Business API. */
export function WhatsAppShareDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={(o) => { if (!o) props.onClose() }}>
      <DialogContent className="sm:max-w-md">
        {/* body mounts on open, so the number resets to the party's each time */}
        <ShareBody {...props} />
      </DialogContent>
    </Dialog>
  )
}

function ShareBody({ onClose, name, mobile, buildText }: Props) {
  const [num, setNum] = useState(mobile ?? '')
  const [size, setSize] = useState<ShareSize>('A4')
  const text = buildText(size)
  const send = () => {
    shareOnWhatsApp(num.trim(), text)
    onClose()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Share on WhatsApp</DialogTitle>
        <DialogDescription>{name ? `Send to ${name}. ` : ''}The message is sent as text.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="wa-mobile">Mobile number</Label>
          <Input id="wa-mobile" inputMode="tel" value={num} onChange={(e) => setNum(e.target.value)} placeholder="10-digit mobile" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wa-size">Format</Label>
          <Select value={size} onValueChange={(v) => setSize(v as ShareSize)}>
            <SelectTrigger id="wa-size" className="w-full" aria-label="Share format"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="A4">A4 Full</SelectItem>
              <SelectItem value="MINI">Mini 80mm</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 font-sans text-xs whitespace-pre-wrap">{text}</pre>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={send} disabled={!num.trim()}>Send on WhatsApp</Button>
      </DialogFooter>
    </>
  )
}
