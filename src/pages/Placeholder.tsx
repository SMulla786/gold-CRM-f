import { useParams } from 'react-router-dom'

import { MODULES } from '@/shared'

export function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Screen coming in a later task.</p>
    </div>
  )
}

/** /app/:moduleKey landing until the module's real pages are built. */
export function ModulePlaceholder() {
  const { moduleKey } = useParams()
  const mod = MODULES.find((m) => m.key === moduleKey)
  return <Placeholder title={mod?.label ?? moduleKey ?? 'Module'} />
}
