import { useQuery } from '@tanstack/react-query'
import { FileDown, Printer } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBusinessProfile } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { fetchAllPaged } from '@/lib/queries'
import { downloadPdf, shareOnWhatsApp } from '@/lib/share'
import { useBhavBooking, useBuySell, useExchange } from '@/lib/tradeQueries'
import type { ExchangeDto, PartyRefDto } from '@/shared'

import { PaymentLines } from './TradeExtras'

const inr = (s: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(s))
const date = (s: string) => new Date(s).toLocaleDateString('en-IN')
const time = (s: string) => new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
const signed = (s: string) => `${Number(s) > 0 ? '+' : ''}${s}`

/** Shared shell for the trade print views — same .print-area pattern as RepairSlip / OrderPrint.
 *  Screen chrome and slip body are translated (like UdharView); the WhatsApp summary text stays English (like BillView). */
function PrintShell({ back, backLabel, note, title, party, summary, status, children }: {
  back: string; backLabel: string; note: string; title: string
  party?: PartyRefDto; summary?: (shop: string) => string; status?: string; children: ReactNode
}) {
  const t = useT()
  const { me } = useAuth()
  const { data: business } = useBusinessProfile()
  const shopName = business?.name ?? me?.business?.name ?? t('girvi.shop')
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link to={back} className="text-sm font-medium text-brand-strong hover:underline">← {backLabel}</Link>
            {status && <Badge variant="secondary">{status}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{note}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {party && summary && <Button variant="outline" onClick={() => shareOnWhatsApp(party.mobile, summary(shopName))}>{t('bill.share')}</Button>}
          <Button variant="outline" onClick={downloadPdf}><FileDown aria-hidden />{t('bill.download_pdf')}</Button>
          <Button onClick={() => window.print()}><Printer aria-hidden />{t('bill.print')}</Button>
        </div>
      </div>

      <div className="print-area space-y-4 rounded-3xl border border-white/80 bg-card p-6 text-sm shadow-sm sm:p-10 dark:border-border print:rounded-none print:border-0 print:bg-transparent print:shadow-none">
        <header className="text-center">
          <div className="text-lg font-bold">{shopName}</div>
          {business?.address && <div>{business.address}</div>}
          {business?.gstin && <div>GSTIN: {business.gstin}</div>}
          <div className="mt-1 font-medium">{title}</div>
        </header>
        {children}
        {party && (
          <div className="flex justify-between gap-6 pt-10">
            <div className="w-40 border-t pt-1 text-center text-xs text-muted-foreground">{t('trade.print.party_sign')}</div>
            <div className="w-40 border-t pt-1 text-center text-xs text-muted-foreground">{t('trade.print.for_shop', { shop: shopName })}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function Head({ no, label, txnDate, createdAt, party, extra }: { no: number; label: string; txnDate: string; createdAt: string; party: PartyRefDto; extra?: ReactNode }) {
  const t = useT()
  return (
    <div className="flex justify-between gap-4 rounded-2xl bg-muted/50 px-4 py-3 print:rounded-none print:border-y print:bg-transparent print:px-0">
      <div>
        <span className="text-muted-foreground">{label}:</span> #{no}<br />
        <span className="text-muted-foreground">{t('udhari.date')}:</span> {date(txnDate)} {time(createdAt)}
        {extra}
      </div>
      <div className="text-right">
        <div className="font-medium">{party.name}</div>
        <div>{party.mobile}</div>
        {party.shopName && <div>{party.shopName}</div>}
      </div>
    </div>
  )
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex justify-between${strong ? ' border-t-2 border-brand pt-1 text-base font-bold' : ''}`}><span className={strong ? '' : 'text-muted-foreground'}>{label}</span><span>{value}</span></div>
}

function Loading() {
  const t = useT()
  return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
}

/** /app/exchange/:id/print — old jewellery exchange receipt. */
export function ExchangePrint() {
  const t = useT()
  const { id } = useParams()
  const { data: e, isLoading } = useExchange(Number(id))
  if (isLoading || !e) return <Loading />
  const money = Number(e.rate) > 0
  return (
    <PrintShell
      back="/app/exchange" backLabel={t('trade.tab_exchanges')} note={t('trade.print.ex_note')}
      title={t('trade.print.ex_title', { kind: e.side === 'BUY' ? t('trade.print.kind_purchase') : t('trade.print.kind_sale') })} party={e.party}
      summary={(shop) => `${shop}\nExchange #${e.exchangeNo} · ${e.metal} ${e.afterFine} g fine${money ? ` · ${inr(e.finalAmount)} · Balance ${inr(e.balance)}` : ''}`}
    >
      <Head no={e.exchangeNo} label={t('src.EXCHANGE')} txnDate={e.txnDate} createdAt={e.createdAt} party={e.party} extra={<><br /><span className="text-muted-foreground">{t('udhari.metal')}:</span> {e.metal}</>} />
      <div className="overflow-x-auto print:overflow-visible">
        <Table>
          <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t('trade.serial')}</TableHead><TableHead className="text-right">{t('udhari.weight_g')}</TableHead><TableHead className="text-right">{t('trade.touch_pct')}</TableHead><TableHead className="text-right">{t('trade.fine_g')}</TableHead></TableRow></TableHeader>
          <TableBody>
            {e.lines.map((l, i) => (
              <TableRow key={l.id}>
                <TableCell>{i + 1}</TableCell><TableCell>{l.serialNo ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{l.weight}</TableCell><TableCell className="text-right tabular-nums">{l.touch}</TableCell><TableCell className="text-right tabular-nums">{l.fine}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="ml-auto max-w-xs space-y-1 tabular-nums">
        <Line label={t('trade.print.fine_before')} value={`${e.totalFine} g`} />
        <Line label={t('trade.fine_adjust')} value={`${signed(e.diffFine)} g`} />
        <Line label={t('trade.print.fine_after')} value={`${e.afterFine} g`} strong />
        {money && <>
          <Line label={t('udhari.rate')} value={inr(e.rate)} />
          {Number(e.charges) > 0 && <Line label={t('trade.charges')} value={inr(e.charges)} />}
          {Number(e.discount) > 0 && <Line label={t('bill.discount')} value={inr(e.discount)} />}
          <Line label={t('trade.final_amount')} value={inr(e.finalAmount)} />
          <Line label={t('bill.cash')} value={inr(e.cash)} />
          <Line label={`${t('bill.online')}${e.bankAccount ? ` (${e.bankAccount.name})` : ''}`} value={inr(e.online)} />
          <PaymentLines payments={e.payments} />
          <div className="flex justify-between font-medium"><span>{t('bill.balance')}</span><span>{inr(e.balance)}</span></div>
        </>}
        {!money && <p className="text-xs text-muted-foreground">{t('trade.print.metal_settled')}</p>}
      </div>
      {e.remark && <p><span className="text-muted-foreground">{t('udhari.remark')}:</span> {e.remark}</p>}
    </PrintShell>
  )
}

/** /app/buy_sell/:id/print — bullion buy / sell slip. */
export function BuySellPrint() {
  const t = useT()
  const { id } = useParams()
  const { data: tr, isLoading } = useBuySell(Number(id))
  if (isLoading || !tr) return <Loading />
  const paidLabel = tr.side === 'BUY' ? t('udhari.col_paid') : t('udhari.col_received')
  return (
    <PrintShell
      back="/app/buy_sell" backLabel={t('trade.print.bs_back')} note={t('trade.print.bs_note')}
      title={t('trade.print.bs_title', { kind: tr.side === 'BUY' ? t('trade.print.kind_purchase') : t('trade.print.kind_sale'), metal: tr.metal })} party={tr.party}
      summary={(shop) => `${shop}\nTrade #${tr.buySellNo} · ${tr.side} ${tr.totalWeight} g ${tr.metal} · ${inr(tr.totalAmount)} · Balance ${inr(tr.balance)}`}
    >
      <Head no={tr.buySellNo} label={t('trade.print.trade')} txnDate={tr.txnDate} createdAt={tr.createdAt} party={tr.party} extra={tr.bhavBooking ? <><br /><span className="text-muted-foreground">{t('trade.print.against_booking')}</span> #{tr.bhavBooking.bookingNo}</> : null} />
      <div className="overflow-x-auto print:overflow-visible">
        <Table>
          <TableHeader><TableRow><TableHead>#</TableHead><TableHead className="text-right">{t('udhari.weight_g')}</TableHead><TableHead className="text-right">{t('udhari.rate')}</TableHead><TableHead className="text-right">{t('bill.amount')}</TableHead></TableRow></TableHeader>
          <TableBody>
            {tr.lines.map((l, i) => (
              <TableRow key={l.id}>
                <TableCell>{i + 1}</TableCell>
                <TableCell className="text-right tabular-nums">{l.weight}</TableCell><TableCell className="text-right tabular-nums">{inr(l.rate)}</TableCell><TableCell className="text-right tabular-nums">{inr(l.amount)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-medium"><TableCell>{t('bill.col_total')}</TableCell><TableCell className="text-right tabular-nums">{tr.totalWeight}</TableCell><TableCell /><TableCell /></TableRow>
          </TableBody>
        </Table>
      </div>
      <div className="ml-auto max-w-xs space-y-1 tabular-nums">
        {Number(tr.discount) > 0 && <Line label={t('bill.discount')} value={inr(tr.discount)} />}
        <Line label={t('trade.print.total_amount')} value={inr(tr.totalAmount)} strong />
        <Line label={t('trade.print.paid_cash', { paid: paidLabel })} value={inr(tr.cash)} />
        <Line label={`${t('trade.print.paid_online', { paid: paidLabel })}${tr.bankAccount ? ` (${tr.bankAccount.name})` : ''}`} value={inr(tr.online)} />
        <PaymentLines payments={tr.payments} />
        <div className="flex justify-between font-medium"><span>{t('bill.balance')}</span><span>{inr(tr.balance)}</span></div>
      </div>
      {tr.narration && <p><span className="text-muted-foreground">{t('udhari.col_narration')}:</span> {tr.narration}</p>}
    </PrintShell>
  )
}

/** /app/buy_sell/bhav/:id/print — bhav (rate lock) booking slip. */
export function BhavPrint() {
  const t = useT()
  const { id } = useParams()
  const { data: b, isLoading } = useBhavBooking(Number(id))
  if (isLoading || !b) return <Loading />
  return (
    <PrintShell
      back="/app/buy_sell/bhav" backLabel={t('trade.print.bhav_back')} note={t('trade.print.bhav_note')} status={b.status}
      title={t('trade.print.bhav_title', { kind: b.side === 'BUY' ? t('trade.print.we_buy') : t('trade.print.we_sell') })} party={b.party}
      summary={(shop) => `${shop}\nBhav booking #${b.bookingNo} · ${b.side} ${b.weight} g ${b.metal} @ ${b.rate} · Advance ${inr(b.advance)}`}
    >
      <Head no={b.bookingNo} label={t('trade.col_booking')} txnDate={b.txnDate} createdAt={b.createdAt} party={b.party} extra={<><br /><span className="text-muted-foreground">{t('stock.col_status')}:</span> {b.status}</>} />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        <Item label={t('trade.side')}>{b.side}</Item>
        <Item label={t('udhari.metal')}>{b.metal}</Item>
        <Item label={t('bill.col_weight')}>{b.weight} g</Item>
        <Item label={t('udhari.rate')}>{inr(b.rate)}</Item>
        <Item label={t('trade.print.pending_weight')}>{b.pendingWeight} g</Item>
        {b.entryType === 'ONLY_ENTRY' && <Item label={t('trade.print.entry')}>{t('trade.print.record_only')}</Item>}
        {b.verifiedAt && <Item label={t('trade.bhav.verified')}>{date(b.verifiedAt)}{b.verifiedBy ? ` · ${b.verifiedBy}` : ''}</Item>}
      </dl>
      {!!b.lines?.length && (
        <div className="overflow-x-auto print:overflow-visible">
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead className="text-right">{t('udhari.weight_g')}</TableHead><TableHead className="text-right">{t('udhari.rate')}</TableHead><TableHead className="text-right">{t('bill.amount')}</TableHead></TableRow></TableHeader>
            <TableBody>
              {b.lines.map((l, i) => (
                <TableRow key={l.id}><TableCell>{i + 1}</TableCell><TableCell className="text-right tabular-nums">{l.weight}</TableCell><TableCell className="text-right tabular-nums">{inr(l.rate)}</TableCell><TableCell className="text-right tabular-nums">{inr(l.amount)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <div className="ml-auto max-w-xs space-y-1 tabular-nums">
        <Line label={t('bill.amount')} value={inr(b.amount)} strong />
        <Line label={`${t('trade.col_advance')}${b.bankAccount ? t('trade.print.incl_online', { name: b.bankAccount.name }) : ''}`} value={inr(b.advance)} />
        <PaymentLines payments={b.payments} />
      </div>
      {b.narration && <p><span className="text-muted-foreground">{t('udhari.col_narration')}:</span> {b.narration}</p>}
    </PrintShell>
  )
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-medium">{children}</dd></div>
}

/** /app/exchange/print?side&metal&q&ptype — every row matching the Exchanges list filters, as a printable list. */
export function ExchangeListPrint() {
  const t = useT()
  const [sp] = useSearchParams()
  const get = (k: string) => sp.get(k) ?? undefined
  const filters = { side: get('side'), metal: get('metal'), q: get('q'), partyType: get('partyType') ?? get('ptype'), processed: get('processed'), from: get('from'), to: get('to') }
  const { data, isLoading } = useQuery({ queryKey: ['exchange', 'print-all', filters], queryFn: () => fetchAllPaged<ExchangeDto>('/app/exchange', filters) })
  if (isLoading || !data) return <Loading />
  const rows = data
  const fineOf = (m: string) => rows.filter((e) => e.metal === m).reduce((a, e) => a + Number(e.afterFine), 0)
  const amount = rows.filter((e) => Number(e.rate) > 0).reduce((a, e) => a + Number(e.finalAmount), 0)
  const applied = [filters.side, filters.metal, filters.partyType, filters.processed && (filters.processed === 'true' ? t('trade.print.f_sent') : t('trade.print.f_not_sent')), (filters.from || filters.to) && t('trade.print.f_range', { from: filters.from ?? '…', to: filters.to ?? '…' }), filters.q && `“${filters.q}”`].filter(Boolean).join(' · ') || t('daybook.all')
  return (
    <PrintShell back="/app/exchange" backLabel={t('trade.tab_exchanges')} note={t('trade.print.list_note')} title={t('trade.print.list_title')}>
      <p className="text-center text-muted-foreground">{t('trade.print.filters', { applied, n: rows.length })}</p>
      <div className="overflow-x-auto print:overflow-visible">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t('trade.col_no')}</TableHead><TableHead>{t('udhari.date')}</TableHead><TableHead>{t('trade.side')}</TableHead><TableHead>{t('udhari.party')}</TableHead><TableHead>{t('udhari.metal')}</TableHead>
            <TableHead className="text-right">{t('trade.ex.col_fine_before')}</TableHead><TableHead className="text-right">{t('trade.ex.col_adj')}</TableHead><TableHead className="text-right">{t('stock.col_fine')}</TableHead><TableHead className="text-right">{t('bill.amount')}</TableHead><TableHead className="text-right">{t('bill.balance')}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.id}>
                <TableCell>#{e.exchangeNo}</TableCell><TableCell className="whitespace-nowrap">{date(e.txnDate)}</TableCell><TableCell>{e.side}</TableCell>
                <TableCell>{e.party.name}<div className="text-xs text-muted-foreground">{e.party.mobile}</div></TableCell><TableCell>{e.metal}</TableCell>
                <TableCell className="text-right tabular-nums">{e.totalFine}</TableCell><TableCell className="text-right tabular-nums">{signed(e.diffFine)}</TableCell><TableCell className="text-right tabular-nums">{e.afterFine}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(e.rate) > 0 ? inr(e.finalAmount) : t('trade.ex.metal_only')}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(e.rate) > 0 ? inr(e.balance) : `${e.afterFine}g`}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="ml-auto max-w-xs space-y-1 tabular-nums">
        <Line label={t('inv.dash.gold_fine')} value={`${fineOf('GOLD').toFixed(3)} g`} />
        <Line label={t('inv.dash.silver_fine')} value={`${fineOf('SILVER').toFixed(3)} g`} />
        <Line label={t('trade.print.value_money')} value={inr(amount)} strong />
      </div>
    </PrintShell>
  )
}
