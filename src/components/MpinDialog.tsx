import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiException } from '@/lib/api'

interface Props {
  open: boolean
  title?: string
  /** Runs the protected action with the entered MPIN; throw to keep the dialog open with an error. */
  onConfirm: (mpin: string) => Promise<void>
  onClose: () => void
}

export function MpinDialog({ open, title = 'Enter MPIN', onConfirm, onClose }: Props) {
  const [mpin, setMpin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm(mpin)
      setMpin('')
      onClose()
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Verification failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>This action needs your 4-digit security MPIN.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="mpin">MPIN</Label>
          <Input
            id="mpin"
            inputMode="numeric"
            maxLength={4}
            autoFocus
            value={mpin}
            onChange={(e) => setMpin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && mpin.length === 4 && void submit()}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button disabled={mpin.length !== 4 || busy} onClick={() => void submit()}>
            {busy ? 'Verifying…' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
