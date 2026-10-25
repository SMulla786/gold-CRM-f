import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/lib/auth'
import { useKarigarIssues, useReceiveKarigarIssue } from '@/lib/ordersQueries'
import type { KarigarIssueDto } from '@/shared'

const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const n = (s: string) => Number(s) || 0

interface RItem { orderItemId: number; label: string; returnedGross: string; returnedLess: string; touch: string; ghatAllowance: string; labour: string; tagNo: string }

function ReceiveDialog({ issue, onClose }: { issue: KarigarIssueDto; onClose: () => void }) {
  const receive = useReceiveKarigarIssue()
  const [items, setItems] = useState<RItem[]>(
    issue.items.filter((it) => it.status === 'ASSIGNED').map((it) => ({ orderItemId: it.id, label: `${it.itemName.name} (ord #${it.order.orderNo})`, returnedGross: it.gross, returnedLess: it.less, touch: it.touch, ghatAllowance: '0', labour: '0', tagNo: '' })),
  )
  const set = (i: number, k: keyof RItem, v: string) => setItems((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  const ok = items.every((r) => n(r.returnedGross) > 0)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Receive from {issue.karigar.name} · issue #{issue.issueNo}</DialogTitle></DialogHeader>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Ret. gross</TableHead><TableHead>Less</TableHead><TableHead>Touch</TableHead><TableHead>Ghat (g)</TableHead><TableHead>Labour ₹</TableHead><TableHead>Tag</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map((r, i) => (
                <TableRow key={r.orderItemId}>
                  <TableCell className="text-sm">{r.label}</TableCell>
                  <TableCell><Input className="w-20" type="number" step="0.001" aria-label="Returned gross" value={r.returnedGross} onChange={(e) => set(i, 'returnedGross', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-16" type="number" step="0.001" aria-label="Returned less" value={r.returnedLess} onChange={(e) => set(i, 'returnedLess', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-16" type="number" step="0.01" aria-label="Touch" value={r.touch} onChange={(e) => set(i, 'touch', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-16" type="number" step="0.001" aria-label="Ghat" value={r.ghatAllowance} onChange={(e) => set(i, 'ghatAllowance', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-20" type="number" aria-label="Labour" value={r.labour} onChange={(e) => set(i, 'labour', e.target.value)} /></TableCell>
                  <TableCell><Input className="w-24" aria-label="Tag" placeholder="auto" value={r.tagNo} onChange={(e) => set(i, 'tagNo', e.target.value.toUpperCase())} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button disabled={!ok || receive.isPending} onClick={async () => {
            await receive.mutateAsync({ id: issue.id, body: { items: items.map((r) => ({ orderItemId: r.orderItemId, returnedGross: n(r.returnedGross), returnedLess: n(r.returnedLess), touch: r.touch !== '' ? n(r.touch) : undefined, ghatAllowance: n(r.ghatAllowance), labour: n(r.labour), tagNo: r.tagNo || undefined })) } })
            onClose()
          }}>Receive & tag finished pieces</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function KarigarIssues() {
  const { can } = useAuth()
  const canReceive = can('orders.karigar_list', 'edit')
  const [status, setStatus] = useState('OPEN')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useKarigarIssues({ status: status || undefined, page })
  const [receiving, setReceiving] = useState<KarigarIssueDto | null>(null)

  return (
    <div className="space-y-4">
      <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1) }}>
        <SelectTrigger className="w-44" aria-label="Issue status"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="OPEN">Open</SelectItem><SelectItem value="RECEIVED">Received</SelectItem><SelectItem value="CANCELLED">Cancelled</SelectItem></SelectContent>
      </Select>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : data?.items.length ? (
        <div className="grid gap-3">
          {data.items.map((iss) => (
            <Card key={iss.id}>
              <CardHeader className="flex-row items-start justify-between gap-3 pb-2">
                <CardTitle className="text-sm">Issue #{iss.issueNo} · {iss.karigar.name} <Badge variant={iss.status === 'OPEN' ? 'secondary' : 'default'} className="ml-2">{iss.status}</Badge></CardTitle>
                {canReceive && iss.status === 'OPEN' && <Button size="sm" onClick={() => setReceiving(iss)}>Receive</Button>}
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <div>{date(iss.issueDate)}{iss.dueDate ? ` · due ${date(iss.dueDate)}` : ''} · issued {Number(iss.goldFine) ? `${iss.goldFine}g Au ` : ''}{Number(iss.silverFine) ? `${iss.silverFine}g Ag ` : ''}{Number(iss.cash) + Number(iss.online) > 0 ? `₹${Number(iss.cash) + Number(iss.online)}` : ''}</div>
                <div>{iss.items.map((it) => `${it.itemName.name} (ord #${it.order.orderNo})`).join(', ')}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : <p className="text-sm text-muted-foreground">No issues.</p>}

      {receiving && <ReceiveDialog issue={receiving} onClose={() => setReceiving(null)} />}
    </div>
  )
}
