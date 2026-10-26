import { Camera, ImagePlus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { AuthedImage } from '@/components/AuthedImage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'

export type PartyImageKind = 'photo' | 'shop-logo'

/** Upload a picked/captured image for a saved party (POST /app/parties/:id/{photo|shop-logo}, field "file"). */
export const uploadPartyImage = (partyId: number, kind: PartyImageKind, file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post<{ url: string }>(`/app/parties/${partyId}/${kind}`, fd)
}

/** Webcam capture (original 'Capture Photo' modal): live preview, snap to a JPEG File. */
function CaptureDialog({ onCapture, onClose }: { onCapture: (f: File) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((s) => {
        stream = s
        if (video.current) video.current.srcObject = s
      })
      .catch(() => setError('Camera not available. Allow camera access in the browser, or upload a file instead.'))
    if (!navigator.mediaDevices) setError('This browser has no camera access (needs https or localhost).')
    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [])

  const snap = () => {
    const v = video.current
    if (!v || !v.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    canvas.getContext('2d')?.drawImage(v, 0, 0)
    canvas.toBlob((b) => {
      if (!b) return
      onCapture(new File([b], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      onClose()
    }, 'image/jpeg', 0.9)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Capture photo</DialogTitle>
          <DialogDescription>Position the face in the frame, then capture.</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : <video ref={video} autoPlay playsInline muted className="w-full rounded-xl bg-black" />}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={!!error} onClick={snap}><Camera className="size-4" aria-hidden /> Capture</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Pick or capture one party image; the parent uploads it after the party is saved. */
export function PartyImagePicker({ label, kind, value, onChange, existingPath, camera }: {
  label: string
  kind: PartyImageKind
  value: File | null
  onChange: (f: File | null) => void
  /** current image on the server (edit mode) */
  existingPath?: string
  camera?: boolean
}) {
  const [capturing, setCapturing] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!value) return setPreview(null)
    const url = URL.createObjectURL(value)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted">
          {preview ? <img src={preview} alt={`${label} preview`} className="size-full object-cover" /> : existingPath ? <AuthedImage path={existingPath} alt={label} className="size-full object-cover" /> : <ImagePlus className="size-5 text-muted-foreground" aria-hidden />}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            aria-label={`${label} file`}
            data-kind={kind}
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>Upload</Button>
          {camera && <Button type="button" variant="outline" size="sm" onClick={() => setCapturing(true)}><Camera className="size-4" aria-hidden /> Capture</Button>}
          {value && (
            <Button type="button" variant="ghost" size="sm" aria-label={`Clear ${label}`} onClick={() => { onChange(null); if (input.current) input.current.value = '' }}>
              <X className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>
      {capturing && <CaptureDialog onCapture={onChange} onClose={() => setCapturing(false)} />}
    </div>
  )
}
