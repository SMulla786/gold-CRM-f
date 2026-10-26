import { FileJson } from 'lucide-react'
import { useMemo, useState } from 'react'

import { TableCard } from '@/components/SectionCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv } from '@/lib/csv'
import { useT } from '@/lib/i18n'
import { useGstRegisterAll } from '@/lib/reportsQueries'

import { fromRegister, parse2b, reconcile, type BookRow, type Pair, type TwoBInvoice } from './reconcile'

const inr = (n: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n))
const r2 = (n: number) => Math.round(n * 100) / 100

type Tab = 'matched' | 'mismatch' | 'only2b' | 'onlyBooks' | 'duplicates' | 'invalidGstin'
const TABS: { key: Tab; label: string }[] = [
  { key: 'matched', label: 'Matched' }, { key: 'mismatch', label: 'Amount mismatch' }, { key: 'only2b', label: 'In 2B only' },
  { key: 'onlyBooks', label: 'In books only' }, { key: 'duplicates', label: 'Duplicates' }, { key: 'invalidGstin', label: 'Invalid GSTIN' },
]
const MONEY = new Set(['2B taxable', 'Books taxable', '2B tax', 'Books tax', 'Tax difference', 'Taxable', 'Tax', 'Value', 'Total'])
const PAIR_HEAD = ['GSTIN', 'Party', '2B invoice', 'Books bill', '2B taxable', 'Books taxable', '2B tax', 'Books tax', 'Tax difference']
const BOOK_HEAD = ['Bill', 'Date', 'Party', 'GSTIN', 'Taxable', 'Tax', 'Total']
const pairRow = (p: Pair) => [p.b2.gstin, p.book.party, p.b2.inv, p.book.billNo, p.b2.taxable, p.book.taxable, p.b2.tax, p.book.tax, r2(p.book.tax - p.b2.tax)]
const bookRow = (b: BookRow) => [b.billNo, b.billDate, b.party, b.gstin ?? '', b.taxable, b.tax, b.total]
const twoBRow = (x: TwoBInvoice) => [x.gstin, x.inv, x.date, x.taxable, x.tax, x.value]

/** TASK-97 GSTR-2B reconciliation, entirely client-side: the JSON is parsed in the browser and never uploaded. */
export function Reconcile2b({ from, to }: { from: string; to: string }) {
  const t = useT()
  const [file, setFile] = useState<{ name: string; rows: TwoBInvoice[] } | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('mismatch')
  const reg = useGstRegisterAll({ from: from || undefined, to: to || undefined, kind: 'PURCHASE' })
  const result = useMemo(() => (file && reg.data ? reconcile(file.rows, fromRegister(reg.data)) : null), [file, reg.data])

  const onFile = async (f: File | undefined) => {
    setError('')
    if (!f) return setFile(null)
    try {
      const rows = parse2b(JSON.parse(await f.text()))
      if (!rows.length) throw new Error('No B2B invoices found in this file.')
      setFile({ name: f.name, rows })
    } catch (e) {
      setFile(null)
      setError(e instanceof SyntaxError ? 'This is not a valid JSON file.' : e instanceof Error ? e.message : String(e))
    }
  }

  const head = tab === 'matched' || tab === 'mismatch' ? PAIR_HEAD : tab === 'only2b' ? ['GSTIN', 'Invoice', 'Date', 'Taxable', 'Tax', 'Value'] : BOOK_HEAD
  const rows: (string | number)[][] = !result ? []
    : tab === 'matched' || tab === 'mismatch' ? result[tab].map(pairRow)
      : tab === 'only2b' ? result.only2b.map(twoBRow) : result[tab].map(bookRow)

  return (
    <div className="space-y-6">
      <Card className="print:hidden">
        <CardHeader><CardTitle>How to use</CardTitle></CardHeader>
        <CardContent className="p-6 pt-0">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>On the GST portal open Returns → GSTR-2B for the month and download the JSON file.</li>
            <li>Set From and To above to that same month.</li>
            <li>Choose the file below. It is read in your browser and is not uploaded.</li>
            <li>Rows are matched on supplier GSTIN + invoice number against your GST purchase bills, so enter the supplier invoice number as the purchase bill number. Case, spaces, '/' and '-' and leading zeros are ignored; amounts within ₹1 count as matched.</li>
            <li>Purchases from suppliers without a GSTIN are skipped (they carry no ITC).</li>
          </ol>
        </CardContent>
      </Card>

      <Card className="print:hidden">
        <CardContent className="flex flex-wrap items-end gap-4 p-6">
          <div className="space-y-1.5">
            <Label htmlFor="g2b-file">GSTR-2B JSON file</Label>
            <Input id="g2b-file" type="file" accept=".json,application/json" className="w-72" onChange={(e) => void onFile(e.target.files?.[0])} />
          </div>
          {file && <p className="flex items-center gap-2 text-sm text-muted-foreground"><FileJson className="size-4" aria-hidden />{file.name} · {file.rows.length} invoices</p>}
          {result && <Button className="ml-auto" variant="outline" size="sm" disabled={!rows.length}
            onClick={() => downloadCsv(`gstr2b-${tab}-${from || 'all'}.csv`, [head, ...rows])}>{t('common.export_csv')}</Button>}
        </CardContent>
      </Card>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {file && !result && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
      {result && (
        <>
          {result.noGstin > 0 && <p className="text-sm text-muted-foreground">{result.noGstin} purchase bills have no supplier GSTIN and were skipped.</p>}
          <nav className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border bg-card p-1 shadow-sm sm:w-fit print:hidden">
            {TABS.map((x) => (
              <button key={x.key} type="button" onClick={() => setTab(x.key)}
                className={`shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${tab === x.key ? 'bg-brand/15 font-semibold text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                {x.label} ({result[x.key].length})
              </button>
            ))}
          </nav>
          <h3 className="hidden text-base font-semibold print:block">{TABS.find((x) => x.key === tab)?.label}</h3>
          <TableCard>
            <Table>
              <TableHeader><TableRow>{head.map((h) => <TableHead key={h} className={MONEY.has(h) ? 'text-right' : ''}>{h}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {rows.length ? rows.map((r, i) => (
                  <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className={MONEY.has(head[j]) ? 'text-right tabular-nums' : head[j] === 'GSTIN' ? 'font-mono text-xs' : ''}>{MONEY.has(head[j]) ? inr(c) : c}</TableCell>)}</TableRow>
                )) : <TableRow><TableCell colSpan={head.length} className="h-16 text-center text-muted-foreground">{t('common.no_data')}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableCard>
        </>
      )}
    </div>
  )
}
