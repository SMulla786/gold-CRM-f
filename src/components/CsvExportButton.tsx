import { Download } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { downloadCsv } from '@/lib/csv'
import { useT } from '@/lib/i18n'

/** "Export CSV" for a list: `rows()` loads every matching row (usually via fetchAllPaged) and returns header + body. */
export function CsvExportButton({ filename, rows, className }: { filename: string; rows: () => Promise<(string | number | null | undefined)[][]>; className?: string }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  return (
    <Button
      variant="outline"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          downloadCsv(filename, await rows())
        } finally {
          setBusy(false)
        }
      }}
    >
      <Download aria-hidden />{busy ? t('bill.exporting') : t('common.export_csv')}
    </Button>
  )
}
