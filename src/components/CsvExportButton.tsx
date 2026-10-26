import { Download, FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { downloadCsv, downloadXlsx } from '@/lib/csv'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type Rows = (string | number | null | undefined)[][]

/** "Export CSV" for a list, plus an adjacent "Excel" (.xlsx) button with the same rows.
 *  `rows()` loads every matching row (usually via fetchAllPaged) and returns header + body. */
export function CsvExportButton({ filename, rows, className }: { filename: string; rows: () => Promise<Rows>; className?: string }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <Button
        variant="outline"
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
      <ExcelExportButton filename={filename} rows={rows} />
    </div>
  )
}

/** "Excel" button: downloads `rows()` (header + body, same as the CSV) as `<filename minus .csv>.xlsx`. */
export function ExcelExportButton({ filename, rows, className, size, disabled }: { filename: string; rows: () => Rows | Promise<Rows>; className?: string; size?: 'sm'; disabled?: boolean }) {
  const [busy, setBusy] = useState(false)
  return (
    <Button
      variant="outline"
      size={size}
      className={className}
      disabled={disabled || busy}
      onClick={async () => {
        setBusy(true)
        try {
          await downloadXlsx(filename, await rows())
        } catch {
          toast.error('Excel export failed')
        } finally {
          setBusy(false)
        }
      }}
    >
      <FileSpreadsheet aria-hidden />Excel
    </Button>
  )
}
