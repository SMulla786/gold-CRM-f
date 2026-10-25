import { useState } from 'react'

import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/lib/auth'
import { useKachaBalance, useKachaList, useKachaProcess, useRevertKacha } from '@/lib/tradeQueries'
import { METALS } from '@/shared'

const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const n = (s: string) => Number(s) || 0

function ProcessDialog({ metal, onClose }: { metal: string; onClose: () => void }) {
  const proc = useKachaProcess()
  const [f, setF] = useState({ type: 'MELT', inFine: '', outFine: '', ravalFine: '0', remark: '' })
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))
  const difference = n(f.inFine) - n(f.outFine) - (f.type === 'REFINE' ? n(f.ravalFine) : 0)
  const ok = n(f.inFine) > 0
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Process {metal} kacha</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Type</Label>
            <Select value={f.type} onValueChange={(v) => set('type', v)}><SelectTrigger aria-label="Process type"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="MELT">Melt</SelectItem><SelectItem value="REFINE">Refine</SelectItem></SelectContent></Select>
          </div>
          <div />
          <div className="space-y-1.5"><Label htmlFor="kp-in">Kacha in (fine g)</Label><Input id="kp-in" type="number" step="0.001" value={f.inFine} onChange={(e) => set('inFine', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="kp-out">Bullion out (fine g)</Label><Input id="kp-out" type="number" step="0.001" value={f.outFine} onChange={(e) => set('outFine', e.target.value)} /></div>
          {f.type === 'REFINE' && <div className="space-y-1.5"><Label htmlFor="kp-raval">Raval back to kacha (g)</Label><Input id="kp-raval" type="number" step="0.001" value={f.ravalFine} onChange={(e) => set('ravalFine', e.target.value)} /></div>}
          <div className="space-y-1.5"><Label htmlFor="kp-remark">Remark</Label><Input id="kp-remark" value={f.remark} onChange={(e) => set('remark', e.target.value)} /></div>
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">Loss / difference: {difference.toFixed(3)} g</p>
        <MpinProcess proc={proc} metal={metal} f={f} ok={ok} onClose={onClose} />
      </DialogContent>
    </Dialog>
  )
}

function MpinProcess({ proc, metal, f, ok, onClose }: { proc: ReturnType<typeof useKachaProcess>; metal: string; f: { type: string; inFine: string; outFine: string; ravalFine: string; remark: string }; ok: boolean; onClose: () => void }) {
  const [mpinOpen, setMpinOpen] = useState(false)
  return (
    <>
      <DialogFooter><Button disabled={!ok || proc.isPending} onClick={() => setMpinOpen(true)}>Process (MPIN)</Button></DialogFooter>
      <MpinDialog open={mpinOpen} title="Authenticate melting/refining" onConfirm={async (mpin) => {
        await proc.mutateAsync({ body: { type: f.type, metal, inFine: n(f.inFine), outFine: n(f.outFine), ravalFine: f.type === 'REFINE' ? n(f.ravalFine) : 0, remark: f.remark || undefined }, mpin })
        setMpinOpen(false); onClose()
      }} onClose={() => setMpinOpen(false)} />
    </>
  )
}

export function KachaPool() {
  const { can } = useAuth()
  const canEdit = can('exchange.entry', 'edit')
  const [metal, setMetal] = useState('GOLD')
  const { data: bal } = useKachaBalance(metal)
  const { data: list, isLoading } = useKachaList({ metal, page: 1 })
  const revert = useRevertKacha()
  const [processing, setProcessing] = useState(false)
  const [reverting, setReverting] = useState<number | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={metal} onValueChange={setMetal}>
          <SelectTrigger className="w-32" aria-label="Metal"><SelectValue /></SelectTrigger>
          <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
        {canEdit && <Button className="ml-auto" onClick={() => setProcessing(true)}>Melt / Refine</Button>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">Kacha (unprocessed) {metal}</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold tabular-nums">{bal?.kachaFine ?? '—'} g</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">Bullion (refined) {metal}</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold tabular-nums">{bal?.bullionFine ?? '—'} g</div></CardContent></Card>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>In</TableHead><TableHead>Out</TableHead><TableHead>Raval</TableHead><TableHead>Loss</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={8} className="h-16 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              : list?.items.length ? list.items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{date(p.txnDate)}</TableCell><TableCell>{p.type}</TableCell>
                  <TableCell className="tabular-nums">{p.inFine}</TableCell><TableCell className="tabular-nums">{p.outFine}</TableCell><TableCell className="tabular-nums">{p.ravalFine}</TableCell><TableCell className="tabular-nums">{p.difference}</TableCell>
                  <TableCell>{p.reverted ? <Badge variant="secondary">Reverted</Badge> : <Badge>Done</Badge>}</TableCell>
                  <TableCell>{canEdit && !p.reverted && <Button variant="ghost" size="sm" onClick={() => setReverting(p.id)}>Revert</Button>}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={8} className="h-16 text-center text-muted-foreground">No processing yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      {processing && <ProcessDialog metal={metal} onClose={() => setProcessing(false)} />}
      <MpinDialog open={reverting != null} title="Revert this process" onConfirm={(mpin) => revert.mutateAsync({ id: reverting!, mpin })} onClose={() => setReverting(null)} />
    </div>
  )
}
