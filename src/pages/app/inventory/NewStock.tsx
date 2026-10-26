import { Gem, Layers, Package, Plus, Scale, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useKarats } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { useCreateStockEntry, useItemGroups, useItemNames } from '@/lib/inventoryQueries'
import { ItemNameDialog } from '@/pages/app/inventory/ItemMasters'
import { CHARGE_UNITS, STOCK_CLASSES, computeLine } from '@/shared'

interface Row {
  itemNameId: string
  tagNo: string
  huid: string
  karatCode: string
  pcs: string
  gross: string
  less: string
  tunch: string
  wastage: string
  stoneCharge: string
  other: string
  labour: string
  labourUnit: string
  rate: string
  purchaseCost: string
  remarks: string
}
/** Today in the browser's zone as YYYY-MM-DD (date input format). */
const todayLocal = () => new Date().toLocaleDateString('en-CA')
const blank = (): Row => ({ itemNameId: '', tagNo: '', huid: '', karatCode: '', pcs: '1', gross: '', less: '0', tunch: '', wastage: '0', stoneCharge: '0', other: '0', labour: '0', labourUnit: 'PER_GRAM', rate: '', purchaseCost: '', remarks: '' })

export function NewStock() {
  const t = useT()
  const navigate = useNavigate()
  const [stockClass, setStockClass] = useState('GOLD')
  const [method, setMethod] = useState('LOOSE')
  const [rows, setRows] = useState<Row[]>([blank()])
  const [repeat, setRepeat] = useState('1') // Item Repeat (Many): duplicate the last row N times
  const { data: names } = useItemNames({ stockClass, page: 1, pageSize: 100 })
  const [txnDate, setTxnDate] = useState(todayLocal)
  const [clearAfterSave, setClearAfterSave] = useState(true)
  const { data: karats } = useKarats()
  const create = useCreateStockEntry()
  const { can } = useAuth()
  const canCreateItem = can('inventory.item_masters', 'edit')
  // Inline 'New item': the row index whose picker gets the created item name.
  const [newItemRow, setNewItemRow] = useState<number | null>(null)
  const { data: groups } = useItemGroups({ stockClass, page: 1, pageSize: 100 })
  // Apply rate: fill the rate input of blank rows (or every row when overwriting). Input convenience only.
  const [bulkRate, setBulkRate] = useState('')
  const [overwriteRate, setOverwriteRate] = useState(false)
  const applyRate = () => setRows((rs) => rs.map((r) => (overwriteRate || r.rate === '' ? { ...r, rate: bulkRate } : r)))

  const set = (i: number, k: keyof Row, v: string) =>
    setRows((rs) =>
      rs.map((r, j) => {
        if (j !== i) return r
        const next = { ...r, [k]: v }
        // picking a karat defaults tunch to its touch when empty
        if (k === 'karatCode' && !r.tunch) next.tunch = karats?.find((kt) => kt.code === v)?.touch ?? ''
        return next
      }),
    )

  const valid = rows.every((r) => r.itemNameId && Number(r.gross) > 0)

  const payload = () => ({
    stockClass,
    method,
    // Only sent when back-dated/changed; otherwise the server stamps today's business date (unchanged behaviour).
    txnDate: txnDate && txnDate !== todayLocal() ? txnDate : undefined,
    rows: rows.map((r) => ({
      itemNameId: Number(r.itemNameId),
      tagNo: method === 'TAG' && r.tagNo ? r.tagNo : undefined,
      huid: r.huid || undefined,
      karatCode: r.karatCode || undefined,
      pcs: Number(r.pcs) || 1,
      gross: Number(r.gross),
      less: Number(r.less) || 0,
      tunch: r.tunch ? Number(r.tunch) : undefined,
      wastage: Number(r.wastage) || 0,
      stoneCharge: Number(r.stoneCharge) || 0,
      other: Number(r.other) || 0,
      labour: Number(r.labour) || 0,
      labourUnit: r.labourUnit,
      rate: r.rate ? Number(r.rate) : undefined,
      purchaseCost: r.purchaseCost ? Number(r.purchaseCost) : undefined,
      remarks: r.remarks || undefined,
    })),
  })

  const submit = async () => {
    await create.mutateAsync(payload())
    if (clearAfterSave) setRows([blank()])
  }
  // Save & Print (TAG only): save, then jump to Tags with the new items preselected for label printing.
  const saveAndPrint = async () => {
    const res = await create.mutateAsync(payload())
    setRows([blank()])
    navigate('/app/inventory/tags', { state: { ids: res.items.map((i) => i.id) } })
  }

  // Live batch totals derived from the rows being entered (no extra requests).
  const totals = rows.reduce(
    (acc, r) => {
      const { net, fine } = computeLine({ gross: Number(r.gross) || 0, less: Number(r.less) || 0, tunch: Number(r.tunch) || 0, wastage: Number(r.wastage) || 0 })
      return { pcs: acc.pcs + (Number(r.pcs) || 0), gross: acc.gross + (Number(r.gross) || 0), net: acc.net + Number(net), fine: acc.fine + Number(fine) }
    },
    { pcs: 0, gross: 0, net: 0, fine: 0 },
  )
  const readyRows = rows.filter((r) => r.itemNameId && Number(r.gross) > 0).length

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
      <div>
        <h2 className="text-xl">{t('inv.newstock.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('inv.newstock.intro')}</p>
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile(t('inv.newstock.rows_in_batch'), String(rows.length), t('inv.newstock.ready_rows', { n: readyRows }), Layers)}
        {tile(t('inv.newstock.pieces'), String(totals.pcs), t('inv.newstock.pieces_sub'), Package)}
        {tile(t('inv.newstock.gross_weight'), totals.gross.toFixed(3), t('inv.newstock.net_sub', { g: totals.net.toFixed(3) }), Scale)}
        {tile(t('inv.newstock.fine_weight'), totals.fine.toFixed(3), t('inv.newstock.fine_sub'), Gem)}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1.5">
            <Label>{t('bill.stock_class')}</Label>
            <Select value={stockClass} onValueChange={(v) => { setStockClass(v); setRows([blank()]) }}>
              <SelectTrigger className="w-40" aria-label="Stock class">
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
            <Label>{t('inv.newstock.entry_method')}</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-40" aria-label="Entry method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOOSE">{t('inv.newstock.loose')}</SelectItem>
                <SelectItem value="TAG">{t('inv.newstock.tag')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ns-date">{t('inv.newstock.entry_date')}</Label>
            <Input id="ns-date" type="date" className="w-40" max={todayLocal()} value={txnDate} onChange={(e) => setTxnDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Checkbox id="ns-clear" checked={clearAfterSave} onCheckedChange={(v) => setClearAfterSave(v === true)} />
            <Label htmlFor="ns-clear" className="font-normal">{t('inv.newstock.clear_after_save')}</Label>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="overflow-x-auto p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-40">{t('bill.col_item')}</TableHead>
                {method === 'TAG' && <TableHead>{t('inv.newstock.tag')}</TableHead>}
                <TableHead>HUID</TableHead>
                <TableHead>{t('stock.col_karat')}</TableHead>
                <TableHead>{t('stock.col_pcs')}</TableHead>
                <TableHead>{t('stock.col_gross')}</TableHead>
                <TableHead>{t('bill.col_less')}</TableHead>
                <TableHead>{t('bill.col_tunch')}</TableHead>
                <TableHead>{t('bill.col_wastage')}</TableHead>
                <TableHead>{t('stock.col_net')}</TableHead>
                <TableHead>{t('stock.col_fine')}</TableHead>
                <TableHead>{t('class.STONE')}</TableHead>
                <TableHead>{t('bill.col_other')}</TableHead>
                <TableHead>{t('bill.col_labour')}</TableHead>
                <TableHead>{t('bill.col_unit')}</TableHead>
                <TableHead>{t('udhari.rate')}</TableHead>
                <TableHead>{t('inv.newstock.col_cost')}</TableHead>
                <TableHead>{t('udhari.remark')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const { net, fine } = computeLine({ gross: Number(r.gross) || 0, less: Number(r.less) || 0, tunch: Number(r.tunch) || 0, wastage: Number(r.wastage) || 0 })
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Select value={r.itemNameId} onValueChange={(v) => set(i, 'itemNameId', v)}>
                          <SelectTrigger aria-label="Item name">
                            <SelectValue placeholder={t('bill.col_item')} />
                          </SelectTrigger>
                          <SelectContent>
                            {names?.items.filter((n) => n.isActive || String(n.id) === r.itemNameId).map((n) => (
                              <SelectItem key={n.id} value={String(n.id)}>
                                {n.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {canCreateItem && (
                          <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="New item name for this row" title={t('inv.newstock.new_item_name')} onClick={() => setNewItemRow(i)}>
                            <Plus className="size-4" aria-hidden />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    {method === 'TAG' && (
                      <TableCell>
                        <Input className="w-24" placeholder={t('inv.newstock.tag_auto')} value={r.tagNo} onChange={(e) => set(i, 'tagNo', e.target.value.toUpperCase())} />
                      </TableCell>
                    )}
                    <TableCell><Input className="w-24" placeholder={t('inv.newstock.huid_ph')} aria-label="HUID" value={r.huid} maxLength={6} onChange={(e) => set(i, 'huid', e.target.value.toUpperCase())} /></TableCell>
                    <TableCell>
                      <Select value={r.karatCode} onValueChange={(v) => set(i, 'karatCode', v)}>
                        <SelectTrigger className="w-24" aria-label="Karat">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {karats?.map((k) => (
                            <SelectItem key={k.id} value={k.code}>
                              {k.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input className="w-16" type="number" value={r.pcs} onChange={(e) => set(i, 'pcs', e.target.value)} /></TableCell>
                    <TableCell><Input className="w-24" type="number" step="0.001" value={r.gross} onChange={(e) => set(i, 'gross', e.target.value)} /></TableCell>
                    <TableCell><Input className="w-20" type="number" step="0.001" value={r.less} onChange={(e) => set(i, 'less', e.target.value)} /></TableCell>
                    <TableCell><Input className="w-20" type="number" step="0.01" value={r.tunch} onChange={(e) => set(i, 'tunch', e.target.value)} /></TableCell>
                    <TableCell><Input className="w-16" type="number" step="0.01" value={r.wastage} onChange={(e) => set(i, 'wastage', e.target.value)} /></TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{net}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fine}</TableCell>
                    <TableCell><Input className="w-20" type="number" aria-label="Stone charge" value={r.stoneCharge} onChange={(e) => set(i, 'stoneCharge', e.target.value)} /></TableCell>
                    <TableCell><Input className="w-20" type="number" aria-label="Other charge" value={r.other} onChange={(e) => set(i, 'other', e.target.value)} /></TableCell>
                    <TableCell><Input className="w-20" type="number" value={r.labour} onChange={(e) => set(i, 'labour', e.target.value)} /></TableCell>
                    <TableCell>
                      <Select value={r.labourUnit} onValueChange={(v) => set(i, 'labourUnit', v)}>
                        <SelectTrigger className="w-28" aria-label="Labour unit">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CHARGE_UNITS.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input className="w-24" type="number" value={r.rate} onChange={(e) => set(i, 'rate', e.target.value)} /></TableCell>
                    <TableCell><Input className="w-24" type="number" value={r.purchaseCost} onChange={(e) => set(i, 'purchaseCost', e.target.value)} /></TableCell>
                    <TableCell><Input className="w-28" aria-label="Remark" value={r.remarks} onChange={(e) => set(i, 'remarks', e.target.value)} /></TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button variant="ghost" size="sm" aria-label="Duplicate row" onClick={() => setRows((rs) => [...rs.slice(0, i + 1), { ...r }, ...rs.slice(i + 1)])} title={t('inv.newstock.duplicate')}>⧉</Button>
                      <Button variant="ghost" size="sm" aria-label="Remove row" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} title={t('inv.newstock.remove')}>✕</Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setRows((rs) => [...rs, blank()])}>
            {t('inv.newstock.add_row')}
          </Button>
          <div className="flex items-center gap-1">
            <Input className="w-16" type="number" min={1} aria-label="Repeat count" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
            <Button variant="outline" onClick={() => setRows((rs) => [...rs, ...Array.from({ length: Math.max(1, Number(repeat) || 1) }, () => ({ ...rs[rs.length - 1]! }))])} title={t('inv.newstock.repeat_hint')}>
              {t('inv.newstock.repeat_last')}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Input className="w-24" type="number" min={0} placeholder={t('udhari.rate')} aria-label="Rate for rows" value={bulkRate} onChange={(e) => setBulkRate(e.target.value)} />
            <Button variant="outline" disabled={bulkRate === ''} onClick={applyRate} title={t('inv.newstock.apply_rate_hint')}>
              {t('inv.newstock.apply_rate')}
            </Button>
            <Checkbox id="ns-rate-overwrite" checked={overwriteRate} onCheckedChange={(v) => setOverwriteRate(v === true)} />
            <Label htmlFor="ns-rate-overwrite" className="font-normal">{t('inv.newstock.overwrite_rates')}</Label>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {method === 'TAG' && (
              <Button variant="outline" disabled={!valid || create.isPending} onClick={saveAndPrint}>
                {create.isPending ? t('bill.saving') : t('inv.newstock.save_print')}
              </Button>
            )}
            <Button disabled={!valid || create.isPending} onClick={submit}>
              {create.isPending ? t('bill.saving') : t(rows.length === 1 ? 'inv.newstock.save_one' : 'inv.newstock.save_other', { n: rows.length })}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t('inv.newstock.footnote')}</p>
      </div>
      {newItemRow !== null && (
        <ItemNameDialog
          groups={(groups?.items ?? []).filter((g) => g.stockClass === stockClass)}
          stockClass={stockClass}
          onCreated={(n) => { if (n.group.stockClass === stockClass) set(newItemRow, 'itemNameId', String(n.id)) }}
          onClose={() => setNewItemRow(null)}
        />
      )}
    </div>
  )
}
