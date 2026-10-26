import { Download, FileCheck2, Upload } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { SelectBranchForTxn } from '@/components/SelectBranchForTxn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { useBankAccounts } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { ApiException } from '@/lib/errors'
import type { GirviImportResultDto } from '@/shared'

const inr = (s: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))

/** Girvi > Import: upload a CSV of existing loans, check every row, then import (only when all loans are valid). */
export function GirviImport() {
  const { activeBranch } = useAuth()
  const { data: banks } = useBankAccounts()
  const [file, setFile] = useState<File | null>(null)
  const [bankAccountId, setBankAccountId] = useState('')
  const [result, setResult] = useState<GirviImportResultDto | null>(null)
  const [busy, setBusy] = useState(false)
  const [onlyErrors, setOnlyErrors] = useState(false)
  const branchReady = activeBranch !== '' && activeBranch !== 'all'

  const run = async (dryRun: boolean) => {
    if (!file || busy) return
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('dryRun', String(dryRun))
      if (bankAccountId) fd.append('bankAccountId', bankAccountId)
      const res = await api.post<GirviImportResultDto>('/app/girvi/import', fd)
      setResult(res)
      if (!dryRun) toast.success(`Imported ${res.imported} of ${res.loans.length} loans`)
    } catch (e) {
      toast.error(e instanceof ApiException ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }
  const sample = async () => {
    const blob = await api.blob('/app/girvi/import/sample.csv')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'girvi-import-sample.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const rows = (result?.loans ?? []).filter((l) => !onlyErrors || l.errors.length)
  const allValid = !!result && result.valid === result.loans.length && result.loans.length > 0

  return (
    <div className="space-y-6">
      {!branchReady && <SelectBranchForTxn note="Pick the branch the imported loans belong to." />}
      <Card>
        <CardHeader>
          <CardTitle>Bulk import girvi loans</CardTitle>
          <p className="text-sm text-muted-foreground">
            One row per pledged item; rows with the same <code>loan_ref</code> become one loan. Customers are matched by mobile, or created. Each loan posts its payout on its issue date, exactly like a new loan.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="gi-file">CSV file *</Label>
            <Input id="gi-file" type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null) }} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gi-bank">Bank account (for online payouts)</Label>
            <Select value={bankAccountId} onValueChange={setBankAccountId}>
              <SelectTrigger id="gi-bank"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{(banks ?? []).map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} ····{b.accountNo.slice(-4)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={() => void sample()}><Download aria-hidden /> Sample CSV</Button>
            <Button variant="outline" disabled={!file || busy || !branchReady} onClick={() => void run(true)}><FileCheck2 aria-hidden /> Check</Button>
            <Button disabled={!allValid || busy || !branchReady || (result?.dryRun === false)} onClick={() => void run(false)}><Upload aria-hidden /> Import</Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle>
              {result.dryRun ? 'Check result' : 'Import result'}: {result.valid} of {result.loans.length} loans valid{!result.dryRun && `, ${result.imported} imported`}
            </CardTitle>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} /> Show only loans with mistakes
            </label>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Loan ref</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Issue date</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Valuation</TableHead>
                    <TableHead className="text-right">Loan</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((l) => (
                    <TableRow key={l.loanRef}>
                      <TableCell className="tabular-nums">{l.row}</TableCell>
                      <TableCell>{l.loanRef}</TableCell>
                      <TableCell>{l.customer}<span className="block text-xs text-muted-foreground">{l.mobile} · {l.existingCustomer ? 'existing customer' : 'new customer'}</span></TableCell>
                      <TableCell>{l.issueDate}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.items}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr(l.valuation)}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(l.principal) ? inr(l.principal) : l.principal}</TableCell>
                      <TableCell className="whitespace-normal">
                        {l.girviNo != null ? <Badge>Girvi #{l.girviNo}</Badge> : l.errors.length === 0 ? <Badge variant="secondary">OK</Badge> : (
                          <ul className="space-y-0.5 text-sm text-destructive">
                            {l.errors.map((e, i) => <li key={i}>Row {e.row}{e.field ? ` · ${e.field}` : ''}: {e.message}</li>)}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
