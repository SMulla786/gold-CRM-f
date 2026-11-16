import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useT } from '@/lib/i18n'
import { METALS, moneyToMetal, type BankAccountDto } from '@/shared'

import type { InlineUdharForm } from './inlineUdharForm'

/** TRD-02: udhar jama / udhar + bhav cut posted with a buy-sell or exchange as a linked udhar entry (same rules as New Udhar). */
export function InlineUdharCard({ value, onChange, unitGrams, txnNo, banks }: { value: InlineUdharForm; onChange: (v: InlineUdharForm) => void; unitGrams: number; txnNo?: number; banks?: BankAccountDto[] }) {
  const t = useT()
  const set = (k: keyof InlineUdharForm, v: string) => onChange({ ...value, [k]: v })
  // online jama / udhar: amount + its bank account, as on New Udhar
  const online = (dir: 'In' | 'Out') => {
    const [amt, bank] = dir === 'In' ? (['onlineIn', 'inBankId'] as const) : (['onlineOut', 'outBankId'] as const)
    return (
      <div className="space-y-1.5">
        <Label htmlFor={`iu-online-${dir}`}>{t(dir === 'In' ? 'trade.iu.online_in' : 'trade.iu.online_out')}</Label>
        <Input id={`iu-online-${dir}`} type="number" min="0" value={value[amt]} onChange={(e) => set(amt, e.target.value)} />
        {Number(value[amt]) > 0 && (
          <Select value={value[bank]} onValueChange={(v) => set(bank, v)}>
            <SelectTrigger aria-label={t(dir === 'In' ? 'udhari.in_bank' : 'udhari.out_bank')} aria-invalid={!value[bank]}><SelectValue placeholder={t(dir === 'In' ? 'udhari.in_bank' : 'udhari.out_bank')} /></SelectTrigger>
            <SelectContent>{banks?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} · {b.accountNo}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>
    )
  }
  const bhavWt = value.bhavDir && Number(value.bhavAmount) > 0 && Number(value.bhavRate) > 0 ? moneyToMetal(Number(value.bhavAmount), Number(value.bhavRate), unitGrams) : null
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('trade.iu.title')}</CardTitle>
        <CardDescription>{txnNo ? t('trade.iu.linked', { no: txnNo }) : t('trade.iu.hint')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="iu-cash-in">{t('trade.iu.cash_in')}</Label><Input id="iu-cash-in" type="number" min="0" value={value.cashIn} onChange={(e) => set('cashIn', e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="iu-cash-out">{t('trade.iu.cash_out')}</Label><Input id="iu-cash-out" type="number" min="0" value={value.cashOut} onChange={(e) => set('cashOut', e.target.value)} /></div>
        {online('In')}
        {online('Out')}
        <div className="space-y-1.5">
          <Label>{t('udhari.metal')}</Label>
          <Select value={value.metal} onValueChange={(v) => set('metal', v)}>
            <SelectTrigger aria-label="Inline udhar metal"><SelectValue /></SelectTrigger>
            <SelectContent>{METALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5"><Label htmlFor="iu-metal-in">{t('trade.iu.metal_in')}</Label><Input id="iu-metal-in" type="number" step="0.001" min="0" value={value.metalIn} onChange={(e) => set('metalIn', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="iu-metal-out">{t('trade.iu.metal_out')}</Label><Input id="iu-metal-out" type="number" step="0.001" min="0" value={value.metalOut} onChange={(e) => set('metalOut', e.target.value)} /></div>
        </div>
        <fieldset className="space-y-1.5 sm:col-span-2">
          <legend className="text-sm font-medium">{t('udhari.bhav_cut')}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            <Select value={value.bhavDir || 'none'} onValueChange={(v) => set('bhavDir', v === 'none' ? '' : v)}>
              <SelectTrigger aria-label="Bhav cut direction"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('trade.iu.bhav_none')}</SelectItem>
                <SelectItem value="MONEY_TO_METAL">{t('udhari.money_to_metal')}</SelectItem>
                <SelectItem value="METAL_TO_MONEY">{t('udhari.metal_to_money')}</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" min="0" aria-label="Bhav cut amount" placeholder={t('trade.iu.bhav_amount')} disabled={!value.bhavDir} value={value.bhavAmount} onChange={(e) => set('bhavAmount', e.target.value)} />
            <Input type="number" min="0" aria-label="Bhav cut rate" placeholder={t('trade.iu.bhav_rate', { unit: unitGrams === 1000 ? '/kg' : `/${unitGrams}g` })} disabled={!value.bhavDir} value={value.bhavRate} onChange={(e) => set('bhavRate', e.target.value)} />
          </div>
          {bhavWt && <p className="text-xs text-muted-foreground tabular-nums">{t('trade.iu.bhav_weight', { wt: bhavWt, metal: value.metal })}</p>}
        </fieldset>
      </CardContent>
    </Card>
  )
}
