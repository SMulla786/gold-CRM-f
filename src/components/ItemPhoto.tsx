import { Camera, ImagePlus } from 'lucide-react'
import { useRef, useState } from 'react'

import { AuthedImage } from '@/components/AuthedImage'
import { CaptureDialog } from '@/components/PartyImagePicker'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { useApiMutation } from '@/lib/queries'

/** Line item photo: thumbnail + upload/capture for editors. Uploads immediately to `path` (POST, field "file"); served by GET on the same path. */
export function ItemPhoto({ path, name, hasPhoto, canEdit, invalidate, printable = true }: { path: string; name: string; hasPhoto: boolean; canEdit: boolean; invalidate: string[][]; printable?: boolean }) {
  const t = useT()
  const [ver, setVer] = useState(0)
  const [capturing, setCapturing] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const upload = useApiMutation(
    (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return api.post<{ url: string }>(path, fd)
    },
    { invalidate, success: t('girvi.photo_saved') },
  )
  const save = async (file: File | undefined) => {
    if (!file) return
    await upload.mutateAsync(file)
    setVer((v) => v + 1) // same path after a re-upload: bust AuthedImage's fetch
    if (input.current) input.current.value = ''
  }

  return (
    <div className="flex items-center gap-1.5">
      {hasPhoto ? (
        <AuthedImage path={path} ver={ver} alt={`${name} photo`} className={`size-10 rounded-md border object-cover ${printable ? '' : 'print:hidden'}`} />
      ) : null}
      {canEdit && (
        <span className="flex gap-1 print:hidden">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label={`${name} photo file`} onChange={(e) => void save(e.target.files?.[0])} />
          <Button type="button" size="icon" variant="ghost" className="size-7" disabled={upload.isPending} aria-label={`Upload photo ${name}`} title="Upload photo" onClick={() => input.current?.click()}>
            <ImagePlus className="size-4" aria-hidden />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="size-7" disabled={upload.isPending} aria-label={`Capture photo ${name}`} title="Capture photo" onClick={() => setCapturing(true)}>
            <Camera className="size-4" aria-hidden />
          </Button>
        </span>
      )}
      {capturing && <CaptureDialog onCapture={(f) => void save(f)} onClose={() => setCapturing(false)} />}
    </div>
  )
}
