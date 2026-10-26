import { CircleCheck, FileSpreadsheet, PackageCheck, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getAccessToken } from '@/lib/api'
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

const CLASS_LABEL: Record<string, string> = { GOLD: 'Gold', SILVER: 'Silver', STONE: 'Stone', ARTIFICIAL: 'Artificial', FRANCHISE: 'Franchise' }

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
        <h2 className="text-xl">Bulk upload</h2>
        <p className="text-sm text-muted-foreground">Load stock lines from a spreadsheet: check the file first, then save it.</p>
      </div>

      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label>Stock class</Label>
              <Select value={stockClass} onValueChange={(v) => { setStockClass(v); setGroupId('') }}>
                <SelectTrigger className="w-36" aria-label="Stock class">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STOCK_CLASSES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CLASS_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="w-32" aria-label="Method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOOSE">Loose</SelectItem>
                  <SelectItem value="TAG">Tag</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Group</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger className="w-48" aria-label="Group">
                  <SelectValue placeholder="Select group" />
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
              <Label htmlFor="csv">CSV file</Label>
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
            Columns (header row, case-insensitive): {STOCK_CSV_COLUMNS.join(', ')} ·{' '}
            <button type="button" className="font-medium text-primary underline" onClick={() => void downloadSample()}>
              download sample CSV
            </button>
          </p>

          <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
            <Button variant="outline" disabled={!file || !groupId || imp.isPending} onClick={() => run(true)}>
              Validate (dry-run)
            </Button>
            <Button disabled={!file || !groupId || imp.isPending || !result || result.errors.length > 0 || result.dryRun === false} onClick={() => run(false)}>
              Import {result?.valid ? `${result.valid} rows` : ''}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <section className="space-y-3">
          <h2 className="text-xl">Last run</h2>
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tile('Rows in file', String(result.total), 'Data rows read', FileSpreadsheet)}
            {tile('Valid rows', String(result.valid), 'Ready to save', CircleCheck)}
            {tile('Row issues', String(result.errors.length), result.errors.length > 0 ? 'Fix and re-check' : 'None found', TriangleAlert)}
            {tile('Saved', result.imported ? String(result.imported) : '—', result.imported ? `Entry #${result.entryNo}` : 'Nothing saved yet', PackageCheck)}
          </div>
          <div className="text-sm text-muted-foreground">
            {result.dryRun ? 'Dry-run:' : 'Imported:'} {result.total} rows · {result.valid} valid · {result.errors.length} errors
            {result.imported ? ` · ${result.imported} saved (entry #${result.entryNo})` : ''}
          </div>
          {result.errors.length > 0 && (
            <Card className="overflow-x-auto p-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead>Error</TableHead>
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
