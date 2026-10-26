import { Camera, ImagePlus } from 'lucide-react'
import { useRef, useState } from 'react'

import { AuthedImage } from '@/components/AuthedImage'
import { CaptureDialog } from '@/components/PartyImagePicker'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useApiMutation } from '@/lib/queries'
import type { GirviItemDto } from '@/shared'

/** Pledged-item photo: thumbnail (prints on the receipt) + upload/capture for girvi.entry editors. Uploads immediately. */
export function GirviItemPhoto({ item, printable = true }: { item: GirviItemDto; printable?: boolean }) {
  const { can } = useAuth()
  const [ver, setVer] = useState(0)
  const [capturing, setCapturing] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const path = `/app/girvi/items/${item.id}/photo`
  const upload = useApiMutation(
    (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return api.post<{ url: string }>(path, fd)
    },
    { invalidate: [['girvi-batch']], success: 'Item photo saved' },
  )
  const save = async (file: File | undefined) => {
    if (!file) return
    await upload.mutateAsync(file)
    setVer((v) => v + 1) // same path after a re-upload: bust AuthedImage's fetch
    if (input.current) input.current.value = ''
  }
  const canEdit = can('girvi.entry', 'edit')

  return (
    <div className="flex items-center gap-1.5">
      {item.photoUrl ? (
        <AuthedImage path={path} ver={ver} alt={`${item.name} photo`} className={`size-10 rounded-md border object-cover ${printable ? '' : 'print:hidden'}`} />
      ) : null}
      {canEdit && (
        <span className="flex gap-1 print:hidden">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label={`${item.name} photo file`} onChange={(e) => void save(e.target.files?.[0])} />
          <Button type="button" size="icon" variant="ghost" className="size-7" disabled={upload.isPending} aria-label={`Upload photo ${item.name}`} title="Upload photo" onClick={() => input.current?.click()}>
            <ImagePlus className="size-4" aria-hidden />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="size-7" disabled={upload.isPending} aria-label={`Capture photo ${item.name}`} title="Capture photo" onClick={() => setCapturing(true)}>
            <Camera className="size-4" aria-hidden />
          </Button>
        </span>
      )}
      {capturing && <CaptureDialog onCapture={(f) => void save(f)} onClose={() => setCapturing(false)} />}
    </div>
  )
}
