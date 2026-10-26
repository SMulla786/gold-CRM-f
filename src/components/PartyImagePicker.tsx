import { Camera, ImagePlus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { AuthedImage } from '@/components/AuthedImage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { useT } from '@/lib/i18n'

export type PartyImageKind = 'photo' | 'shop-logo'

/** Upload a picked/captured image for a saved party (POST /app/parties/:id/{photo|shop-logo}, field "file"). */
export const uploadPartyImage = (partyId: number, kind: PartyImageKind, file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post<{ url: string }>(`/app/parties/${partyId}/${kind}`, fd)
}

/** Webcam capture (original 'Capture Photo' modal): live preview, snap to a JPEG File. */
export function CaptureDialog({ onCapture, onClose }: { onCapture: (f: File) => void; onClose: () => void }) {
  const t = useT()
  const video = useRef<HTMLVideoElement>(null)
  // holds an i18n key, translated at render
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((s) => {
        stream = s
        if (video.current) video.current.srcObject = s
      })
      .catch(() => setError('comp.camera_unavailable'))
    if (!navigator.mediaDevices) setError('comp.camera_none')
    return () => stream?.getTracks().forEach((tr) => tr.stop())
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
          <DialogTitle>{t('comp.capture_photo')}</DialogTitle>
          <DialogDescription>{t('comp.capture_desc')}</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{t(error)}</p> : <video ref={video} autoPlay playsInline muted className="w-full rounded-xl bg-black" />}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="button" disabled={!!error} onClick={snap}><Camera className="size-4" aria-hidden /> {t('comp.capture')}</Button>
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
  const t = useT()
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
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>{t('comp.upload')}</Button>
          {camera && <Button type="button" variant="outline" size="sm" onClick={() => setCapturing(true)}><Camera className="size-4" aria-hidden /> {t('comp.capture')}</Button>}
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
