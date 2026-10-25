import { useState } from 'react'

import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateKarat, useDeleteKarat, useKarats, useSaveSetting, useSettings, useUpdateKarat } from '@/lib/appQueries'
import type { KaratDto, SettingsDto } from '@/shared'

type MpinAction = { title: string; run: (mpin: string) => Promise<unknown> }

const BASIS = ['NET', 'GROSS', 'FINE'] as const

export function General() {
  const { data: settings } = useSettings()
  const [mpinAction, setMpinAction] = useState<MpinAction | null>(null)

  return (
    <div className="space-y-6">
      {settings ? (
        <>
          <CalcBasisCard settings={settings} ask={setMpinAction} />
          <RateUnitsCard settings={settings} ask={setMpinAction} />
          <PrintCard settings={settings} ask={setMpinAction} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      <KaratCard ask={setMpinAction} />

      <MpinDialog open={!!mpinAction} title={mpinAction?.title} onConfirm={(m) => mpinAction!.run(m)} onClose={() => setMpinAction(null)} />
    </div>
  )
}

function SaveSettingCard({ title, children, onSave, ask }: { title: string; children: React.ReactNode; onSave: (mpin: string) => Promise<unknown>; ask: (a: MpinAction) => void }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <Button size="sm" onClick={() => ask({ title: 'Authenticate & save', run: onSave })}>
          Save
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function CalcBasisCard({ settings, ask }: { settings: SettingsDto; ask: (a: MpinAction) => void }) {
  const save = useSaveSetting()
  const [v, setV] = useState(settings['calc.basis'])
  return (
    <SaveSettingCard title="Calculation basis" ask={ask} onSave={(mpin) => save.mutateAsync({ key: 'calc.basis', value: v, mpin })}>
      <div className="grid grid-cols-2 gap-4">
        {(['sale', 'purchase'] as const).map((k) => (
          <div key={k} className="space-y-1.5">
            <Label className="capitalize">{k} basis</Label>
            <Select value={v[k]} onValueChange={(nv) => setV({ ...v, [k]: nv as (typeof BASIS)[number] })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BASIS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </SaveSettingCard>
  )
}

function RateUnitsCard({ settings, ask }: { settings: SettingsDto; ask: (a: MpinAction) => void }) {
  const save = useSaveSetting()
  const [v, setV] = useState(settings['rates.units'])
  return (
    <SaveSettingCard title="Rate units" ask={ask} onSave={(mpin) => save.mutateAsync({ key: 'rates.units', value: v, mpin })}>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Gold</Label>
          <Select value={v.gold} onValueChange={(nv) => setV({ ...v, gold: nv as typeof v.gold })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GRAM_1">Per 1 gram</SelectItem>
              <SelectItem value="GRAM_10">Per 10 gram</SelectItem>
              <SelectItem value="TOLA">Per tola</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Silver</Label>
          <Select value={v.silver} onValueChange={(nv) => setV({ ...v, silver: nv as typeof v.silver })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GRAM_1">Per 1 gram</SelectItem>
              <SelectItem value="KG_1">Per 1 kg</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </SaveSettingCard>
  )
}

function PrintCard({ settings, ask }: { settings: SettingsDto; ask: (a: MpinAction) => void }) {
  const save = useSaveSetting()
  const [v, setV] = useState(settings['print.defaults'])
  return (
    <SaveSettingCard title="Receipt & printing" ask={ask} onSave={(mpin) => save.mutateAsync({ key: 'print.defaults', value: v, mpin })}>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Default layout</Label>
          <Select value={v.layout} onValueChange={(nv) => setV({ ...v, layout: nv as typeof v.layout })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="THERMAL_80">Thermal 80 mm</SelectItem>
              <SelectItem value="A5">A5</SelectItem>
              <SelectItem value="A4">A4</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="copies">Copies</Label>
          <Input id="copies" type="number" min={1} max={5} value={v.copies} onChange={(e) => setV({ ...v, copies: Number(e.target.value) })} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={v.autoWhatsappOnPrint} onCheckedChange={(c) => setV({ ...v, autoWhatsappOnPrint: Boolean(c) })} />
        Auto-send on WhatsApp when printing
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={v.postSaveShareDialog} onCheckedChange={(c) => setV({ ...v, postSaveShareDialog: Boolean(c) })} />
        Show share dialog after save
      </label>
    </SaveSettingCard>
  )
}

function KaratCard({ ask }: { ask: (a: MpinAction) => void }) {
  const { data: karats } = useKarats()
  const create = useCreateKarat()
  const update = useUpdateKarat()
  const del = useDeleteKarat()
  const [add, setAdd] = useState({ metal: 'GOLD', code: '', title: '', touch: '' })
  const [edit, setEdit] = useState<Record<number, string>>({}) // id -> touch being edited

  const submitAdd = () => {
    if (!add.code || !add.title || !add.touch) return
    create.mutate({ metal: add.metal, code: add.code, title: add.title, touch: Number(add.touch) })
    setAdd({ metal: 'GOLD', code: '', title: '', touch: '' })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Karat → touch mapping</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {karats?.map((k: KaratDto) => (
          <div key={k.id} className="flex flex-wrap items-center gap-3 text-sm">
            <span className="w-16 font-medium">{k.title}</span>
            <Badge variant="secondary">{k.metal}</Badge>
            <span className="text-muted-foreground">{k.code}</span>
            <Input
              className="w-28"
              type="number"
              step="0.01"
              value={edit[k.id] ?? k.touch}
              onChange={(e) => setEdit({ ...edit, [k.id]: e.target.value })}
            />
            <span className="text-muted-foreground">% touch</span>
            {edit[k.id] !== undefined && edit[k.id] !== k.touch && (
              <Button size="sm" variant="outline" onClick={() => ask({ title: 'Save karat', run: async (mpin) => { await update.mutateAsync({ id: k.id, body: { touch: Number(edit[k.id]) }, mpin }); setEdit((p) => { const n = { ...p }; delete n[k.id]; return n }) } })}>
                Save
              </Button>
            )}
            {!k.isSystem && (
              <Button size="sm" variant="ghost" onClick={() => ask({ title: 'Delete karat', run: (mpin) => del.mutateAsync({ id: k.id, mpin }) })}>
                Delete
              </Button>
            )}
          </div>
        ))}

        <div className="flex flex-wrap items-end gap-2 border-t pt-3">
          <div className="space-y-1">
            <Label className="text-xs">Metal</Label>
            <Select value={add.metal} onValueChange={(v) => setAdd({ ...add, metal: v })}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GOLD">Gold</SelectItem>
                <SelectItem value="SILVER">Silver</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Code</Label>
            <Input className="w-24" value={add.code} onChange={(e) => setAdd({ ...add, code: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Title</Label>
            <Input className="w-28" value={add.title} onChange={(e) => setAdd({ ...add, title: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Touch %</Label>
            <Input className="w-24" type="number" step="0.01" value={add.touch} onChange={(e) => setAdd({ ...add, touch: e.target.value })} />
          </div>
          <Button size="sm" onClick={submitAdd} disabled={create.isPending}>
            Add karat
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
