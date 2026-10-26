import { useState } from 'react'

import { MpinDialog } from '@/components/MpinDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useKachaProcess } from '@/lib/tradeQueries'

const n = (s: string) => Number(s) || 0

interface ProcessForm { type: string; inFine: string; outFine: string; ravalFine: string; remark: string }

/** The exchange this process is launched from: links it (exchangeId) and prefills kacha-in with its fine. */
export interface ProcessSource { id: number; exchangeNo: number; fine: string }

/** Melt / refine kacha into bullion (MPIN). Shared by the kacha pool and the exchange list row action. */
export function ProcessKachaDialog({ metal, source, onClose }: { metal: string; source?: ProcessSource; onClose: () => void }) {
  const proc = useKachaProcess()
  const [f, setF] = useState<ProcessForm>({ type: 'MELT', inFine: source?.fine ?? '', outFine: '', ravalFine: '0', remark: '' })
  const set = (k: keyof ProcessForm, v: string) => setF((s) => ({ ...s, [k]: v }))
  const difference = n(f.inFine) - n(f.outFine) - (f.type === 'REFINE' ? n(f.ravalFine) : 0)
  const ok = n(f.inFine) > 0
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Process {metal} kacha{source ? ` · exchange #${source.exchangeNo}` : ''}</DialogTitle></DialogHeader>
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
        {source && <p className="text-xs text-muted-foreground">Kacha in is prefilled with this exchange's fine ({source.fine} g); the entry is linked to exchange #{source.exchangeNo}.</p>}
        <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground tabular-nums">Loss / difference: {difference.toFixed(3)} g</p>
        <MpinProcess proc={proc} metal={metal} exchangeId={source?.id} f={f} ok={ok} onClose={onClose} />
      </DialogContent>
    </Dialog>
  )
}

function MpinProcess({ proc, metal, exchangeId, f, ok, onClose }: { proc: ReturnType<typeof useKachaProcess>; metal: string; exchangeId?: number; f: ProcessForm; ok: boolean; onClose: () => void }) {
  const [mpinOpen, setMpinOpen] = useState(false)
  return (
    <>
      <DialogFooter><Button disabled={!ok || proc.isPending} onClick={() => setMpinOpen(true)}>Process (MPIN)</Button></DialogFooter>
      <MpinDialog open={mpinOpen} title="Authenticate melting/refining" onConfirm={async (mpin) => {
        await proc.mutateAsync({ body: { type: f.type, metal, inFine: n(f.inFine), outFine: n(f.outFine), ravalFine: f.type === 'REFINE' ? n(f.ravalFine) : 0, exchangeId, remark: f.remark || undefined }, mpin })
        setMpinOpen(false); onClose()
      }} onClose={() => setMpinOpen(false)} />
    </>
  )
}
