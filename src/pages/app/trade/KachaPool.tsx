import { Coins, Flame, Recycle, TrendingDown, type LucideIcon } from 'lucide-react'
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Type</Label>
            <Select value={f.type} onValueChange={(v) => set('type', v)}><SelectTrigger aria-label="Process type"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="MELT">Melt</SelectItem><SelectItem value="REFINE">Refine</SelectItem></SelectContent></Select>
          </div>
          <div className="hidden sm:block" />
          <div className="space-y-1.5"><Label htmlFor="kp-in">Kacha in (fine g)</Label><Input id="kp-in" type="number" step="0.001" value={f.inFine} onChange={(e) => set('inFine', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="kp-out">Bullion out (fine g)</Label><Input id="kp-out" type="number" step="0.001" value={f.outFine} onChange={(e) => set('outFine', e.target.value)} /></div>
          {f.type === 'REFINE' && <div className="space-y-1.5"><Label htmlFor="kp-raval">Raval back to kacha (g)</Label><Input id="kp-raval" type="number" step="0.001" value={f.ravalFine} onChange={(e) => set('ravalFine', e.target.value)} /></div>}
          <div className="space-y-1.5"><Label htmlFor="kp-remark">Remark</Label><Input id="kp-remark" value={f.remark} onChange={(e) => set('remark', e.target.value)} /></div>
        </div>
        <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground tabular-nums">Loss / difference: {difference.toFixed(3)} g</p>
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

  // Summary numbers derived from the list already fetched (no extra requests).
  const activeRows = (list?.items ?? []).filter((p) => !p.reverted)
  const lossOnPage = activeRows.reduce((sum, p) => sum + n(p.difference), 0)

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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl">Kacha pool</h2>
          <p className="text-sm text-muted-foreground">Old metal bought in, and the bullion it becomes after processing.</p>
        </div>
        {canEdit && <Button onClick={() => setProcessing(true)}>Melt / Refine</Button>}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Select value={metal} onValueChange={setMetal}>
            <SelectTrigger className="w-32" aria-label="Metal"><SelectValue /></SelectTrigger>
            <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile(`Kacha (unprocessed) ${metal}`, `${bal?.kachaFine ?? '—'} g`, 'Fine grams awaiting processing', Recycle)}
        {tile(`Bullion (refined) ${metal}`, `${bal?.bullionFine ?? '—'} g`, 'Fine grams after processing', Coins)}
        {tile('Processing entries', list ? String(list.total) : '—', list ? `${activeRows.length} active on this page` : undefined, Flame)}
        {tile('Loss on this page', list ? `${lossOnPage.toFixed(3)} g` : '—', 'Excludes reverted entries', TrendingDown)}
      </div>

      <section className="space-y-3">
        <h2 className="text-xl">Processing history</h2>
        <Card className="overflow-x-auto p-2">
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
                )) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="icon-chip"><Flame className="size-5" aria-hidden /></span>
                        <span>No processing yet</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
            </TableBody>
          </Table>
        </Card>
      </section>

      {processing && <ProcessDialog metal={metal} onClose={() => setProcessing(false)} />}
      <MpinDialog open={reverting != null} title="Revert this process" onConfirm={(mpin) => revert.mutateAsync({ id: reverting!, mpin })} onClose={() => setReverting(null)} />
    </div>
  )
}
