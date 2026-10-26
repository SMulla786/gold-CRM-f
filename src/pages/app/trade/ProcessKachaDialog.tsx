import { useState } from 'react'
import { toast } from 'sonner'

import { MpinDialog } from '@/components/MpinDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useT } from '@/lib/i18n'
import { useBulkKachaProcess, useKachaBalance, useKachaProcess } from '@/lib/tradeQueries'
import type { ExchangeDto } from '@/shared'

const n = (s: string) => Number(s) || 0

interface ProcessForm { type: string; inFine: string; outFine: string; ravalFine: string; remark: string }

/** The exchange this process is launched from: links it (exchangeId) and prefills kacha-in with its fine. */
export interface ProcessSource { id: number; exchangeNo: number; fine: string }

/** Melt / refine kacha into bullion (MPIN). Shared by the kacha pool and the exchange list row action. */
export function ProcessKachaDialog({ metal, source, onClose }: { metal: string; source?: ProcessSource; onClose: () => void }) {
  const t = useT()
  const proc = useKachaProcess()
  const { data: pool } = useKachaBalance(metal) // read-only context: what the branch pool holds right now
  const [f, setF] = useState<ProcessForm>({ type: 'MELT', inFine: source?.fine ?? '', outFine: '', ravalFine: '0', remark: '' })
  const set = (k: keyof ProcessForm, v: string) => setF((s) => ({ ...s, [k]: v }))
  const difference = n(f.inFine) - n(f.outFine) - (f.type === 'REFINE' ? n(f.ravalFine) : 0)
  const ok = n(f.inFine) > 0
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('trade.proc.title', { metal })}{source ? t('trade.proc.title_exchange', { no: source.exchangeNo }) : ''}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-3 text-sm tabular-nums">
          <div><div className="text-xs text-muted-foreground">{t('trade.proc.pool_kacha')}</div><div className="font-semibold">{pool ? `${pool.kachaFine} g` : '—'}</div></div>
          <div><div className="text-xs text-muted-foreground">{t('trade.proc.pool_fine')}</div><div className="font-semibold">{pool ? `${pool.bullionFine} g` : '—'}</div></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>{t('bill.type')}</Label>
            <Select value={f.type} onValueChange={(v) => set('type', v)}><SelectTrigger aria-label="Process type"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="MELT">{t('trade.kacha.melt')}</SelectItem><SelectItem value="REFINE">{t('trade.kacha.refine')}</SelectItem></SelectContent></Select>
          </div>
          <div className="hidden sm:block" />
          <div className="space-y-1.5"><Label htmlFor="kp-in">{t('trade.proc.kacha_in')}</Label><Input id="kp-in" type="number" step="0.001" value={f.inFine} onChange={(e) => set('inFine', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="kp-out">{t('trade.proc.bullion_out')}</Label><Input id="kp-out" type="number" step="0.001" value={f.outFine} onChange={(e) => set('outFine', e.target.value)} /></div>
          {f.type === 'REFINE' && <div className="space-y-1.5"><Label htmlFor="kp-raval">{t('trade.proc.raval')}</Label><Input id="kp-raval" type="number" step="0.001" value={f.ravalFine} onChange={(e) => set('ravalFine', e.target.value)} /></div>}
          <div className="space-y-1.5"><Label htmlFor="kp-remark">{t('udhari.remark')}</Label><Input id="kp-remark" value={f.remark} onChange={(e) => set('remark', e.target.value)} /></div>
        </div>
        {source && <p className="text-xs text-muted-foreground">{t('trade.proc.prefill_note', { fine: source.fine, no: source.exchangeNo })}</p>}
        <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground tabular-nums">{t('trade.proc.loss', { diff: difference.toFixed(3) })}</p>
        <MpinProcess proc={proc} metal={metal} exchangeId={source?.id} f={f} ok={ok} onClose={onClose} />
      </DialogContent>
    </Dialog>
  )
}

function MpinProcess({ proc, metal, exchangeId, f, ok, onClose }: { proc: ReturnType<typeof useKachaProcess>; metal: string; exchangeId?: number; f: ProcessForm; ok: boolean; onClose: () => void }) {
  const t = useT()
  const [mpinOpen, setMpinOpen] = useState(false)
  return (
    <>
      <DialogFooter><Button disabled={!ok || proc.isPending} onClick={() => setMpinOpen(true)}>{t('trade.proc.submit')}</Button></DialogFooter>
      <MpinDialog open={mpinOpen} title={t('trade.proc.mpin_title')} onConfirm={async (mpin) => {
        await proc.mutateAsync({ body: { type: f.type, metal, inFine: n(f.inFine), outFine: n(f.outFine), ravalFine: f.type === 'REFINE' ? n(f.ravalFine) : 0, exchangeId, remark: f.remark || undefined }, mpin })
        setMpinOpen(false); onClose()
      }} onClose={() => setMpinOpen(false)} />
    </>
  )
}

/**
 * Send several unprocessed BUY exchanges to melt in one go: one MPIN, then the same POST /app/kacha/process the row
 * dialog sends, once per exchange (MELT, kacha in = the exchange's fine, linked by exchangeId). Failures are listed in one toast.
 */
export function BulkMeltDialog({ exchanges, onClose, onDone }: { exchanges: ExchangeDto[]; onClose: () => void; onDone: () => void }) {
  const t = useT()
  const bulk = useBulkKachaProcess()
  const [out, setOut] = useState<Record<number, string>>({})
  const [mpinOpen, setMpinOpen] = useState(false)
  const ok = exchanges.length > 0 && exchanges.every((e) => (out[e.id] ?? '') !== '')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{t('trade.ex.bulk_melt_title', { n: exchanges.length })}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{t('trade.ex.bulk_melt_note')}</p>
        <div className="max-h-[50vh] overflow-auto rounded-xl border">
          <Table>
            <TableHeader><TableRow><TableHead>{t('trade.col_no')}</TableHead><TableHead>{t('udhari.party')}</TableHead><TableHead>{t('udhari.metal')}</TableHead><TableHead>{t('trade.proc.kacha_in')}</TableHead><TableHead>{t('trade.proc.bullion_out')}</TableHead><TableHead>{t('trade.kacha.col_loss')}</TableHead></TableRow></TableHeader>
            <TableBody>
              {exchanges.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">#{e.exchangeNo}</TableCell>
                  <TableCell>{e.party.name}</TableCell>
                  <TableCell>{e.metal}</TableCell>
                  <TableCell className="tabular-nums">{e.afterFine}</TableCell>
                  <TableCell><Input className="w-28" type="number" step="0.001" aria-label={`Bullion out for exchange ${e.exchangeNo}`} value={out[e.id] ?? ''} onChange={(ev) => setOut((s) => ({ ...s, [e.id]: ev.target.value }))} /></TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{(out[e.id] ?? '') === '' ? '—' : (n(e.afterFine) - n(out[e.id] ?? '')).toFixed(3)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter><Button disabled={!ok || bulk.isPending} onClick={() => setMpinOpen(true)}>{t('trade.ex.bulk_continue')}</Button></DialogFooter>
        <MpinDialog open={mpinOpen} title={t('trade.proc.mpin_title')} onConfirm={async (mpin) => {
          const { done, failed } = await bulk.mutateAsync({
            items: exchanges.map((e) => ({ no: e.exchangeNo, body: { type: 'MELT', metal: e.metal, inFine: n(e.afterFine), outFine: n(out[e.id] ?? ''), ravalFine: 0, exchangeId: e.id } })),
            mpin,
          })
          if (done) toast.success(t('trade.ex.bulk_melt_done', { n: done }))
          if (failed.length) toast.error(t('trade.ex.bulk_melt_failed', { list: failed.join('; ') }))
          setMpinOpen(false); onDone()
        }} onClose={() => setMpinOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
