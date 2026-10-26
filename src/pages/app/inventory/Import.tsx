import { CircleCheck, FileSpreadsheet, PackageCheck, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getAccessToken } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { useItemGroups, useStockImport } from '@/lib/inventoryQueries'
import { STOCK_CLASSES, STOCK_CSV_COLUMNS, type StockImportResultDto } from '@/shared'

// Sample endpoint needs the Bearer token, so fetch + blob-download rather than a bare link.
async function downloadSample() {
  const res = await fetch('/api/app/stock/import/sample.csv', { headers: { Authorization: `Bearer ${getAccessToken()}` }, credentials: 'include' })
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = 'stock-sample.csv'
  a.click()
  URL.revokeObjectURL(url)
}

const tile = (label: string, value: string, sub: string | undefined, Icon: LucideIcon) => (
  <Card className="gap-2 hover:-translate-y-1">
    <CardHeader className="flex flex-row items-center justify-between pb-1">
      <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
      <span className="icon-chip"><Icon className="size-5" aria-hidden /></span>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-extrabold tracking-tight tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </CardContent>
  </Card>
)

export function Import() {
  const t = useT()
  const [stockClass, setStockClass] = useState('GOLD')
  const [method, setMethod] = useState('LOOSE')
  const [groupId, setGroupId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<StockImportResultDto | null>(null)
  const { data: groups } = useItemGroups({ page: 1, stockClass })
  const imp = useStockImport()

  const run = async (dryRun: boolean) => {
    if (!file || !groupId) return
    const res = await imp.mutateAsync({ file, fields: { stockClass, method, groupId, dryRun: String(dryRun) } })
    setResult(res)
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl">{t('inv.import.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('inv.import.intro')}</p>
      </div>

      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label>{t('bill.stock_class')}</Label>
              <Select value={stockClass} onValueChange={(v) => { setStockClass(v); setGroupId('') }}>
                <SelectTrigger className="w-36" aria-label="Stock class">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STOCK_CLASSES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`class.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('subscription.col_method')}</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="w-32" aria-label="Method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOOSE">{t('inv.newstock.loose')}</SelectItem>
                  <SelectItem value="TAG">{t('inv.newstock.tag')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('stock.col_group')}</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger className="w-48" aria-label="Group">
                  <SelectValue placeholder={t('inv.import.select_group')} />
                </SelectTrigger>
                <SelectContent>
                  {groups?.items.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="csv">{t('inv.import.csv_file')}</Label>
              <input
                id="csv"
                type="file"
                accept=".csv,text/csv"
                className="block text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null) }}
              />
            </div>
          </div>

          <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
            {t('inv.import.columns', { cols: STOCK_CSV_COLUMNS.join(', ') })}{' '}
            <button type="button" className="font-medium text-primary underline" onClick={() => void downloadSample()}>
              {t('inv.import.download_sample')}
            </button>
          </p>

          <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
            <Button variant="outline" disabled={!file || !groupId || imp.isPending} onClick={() => run(true)}>
              {t('inv.import.validate')}
            </Button>
            <Button disabled={!file || !groupId || imp.isPending || !result || result.errors.length > 0 || result.dryRun === false} onClick={() => run(false)}>
              {t('inv.import.import')} {result?.valid ? t('inv.import.rows', { n: result.valid }) : ''}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <section className="space-y-3">
          <h2 className="text-xl">{t('inv.import.last_run')}</h2>
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tile(t('inv.import.rows_in_file'), String(result.total), t('inv.import.rows_read'), FileSpreadsheet)}
            {tile(t('inv.import.valid_rows'), String(result.valid), t('inv.import.ready_to_save'), CircleCheck)}
            {tile(t('inv.import.row_issues'), String(result.errors.length), result.errors.length > 0 ? t('inv.import.fix_recheck') : t('inv.import.none_found'), TriangleAlert)}
            {tile(t('inv.import.saved'), result.imported ? String(result.imported) : '—', result.imported ? t('inv.import.entry_no', { no: result.entryNo ?? '' }) : t('inv.import.nothing_saved'), PackageCheck)}
          </div>
          <div className="text-sm text-muted-foreground">
            {result.dryRun ? t('inv.import.dry_run') : t('inv.import.imported')} {t('inv.import.run_summary', { total: result.total, valid: result.valid, errors: result.errors.length })}
            {result.imported ? ` · ${t('inv.import.run_saved', { n: result.imported, no: result.entryNo ?? '' })}` : ''}
          </div>
          {result.errors.length > 0 && (
            <Card className="overflow-x-auto p-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">{t('inv.import.col_row')}</TableHead>
                    <TableHead>{t('inv.import.col_field')}</TableHead>
                    <TableHead>{t('inv.import.col_error')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.errors.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{e.row}</TableCell>
                      <TableCell>{e.field ?? '—'}</TableCell>
                      <TableCell className="text-destructive">{e.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </section>
      )}
    </div>
  )
}
