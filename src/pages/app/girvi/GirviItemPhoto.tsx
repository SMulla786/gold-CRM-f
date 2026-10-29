import { ItemPhoto } from '@/components/ItemPhoto'
import { useAuth } from '@/lib/auth'
import type { GirviItemDto } from '@/shared'

/** Pledged-item photo: thumbnail (prints on the receipt) + upload/capture for girvi.entry editors. Uploads immediately. */
export function GirviItemPhoto({ item, printable = true }: { item: GirviItemDto; printable?: boolean }) {
  const { can } = useAuth()
  return <ItemPhoto path={`/app/girvi/items/${item.id}/photo`} name={item.name} hasPhoto={!!item.photoUrl} canEdit={can('girvi.entry', 'edit')} invalidate={[['girvi-batch']]} printable={printable} />
}
