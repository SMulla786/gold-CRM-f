import { useState } from 'react'
import { toast } from 'sonner'

import { MpinDialog } from '@/components/MpinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateKarat, useDeleteKarat, useKarats, useSaveSetting, useSettings, useUpdateKarat } from '@/lib/appQueries'
import { useAuth } from '@/lib/auth'
import { karatBody, type KaratDto, type SettingsDto } from '@/shared'

type MpinAction = { title: string; run: (mpin: string) => Promise<unknown> }

const BASIS = ['NET', 'GROSS', 'FINE'] as const

export function General() {
  const { data: settings } = useSettings()
  const [mpinAction, setMpinAction] = useState<MpinAction | null>(null)

  return (
    <div className="space-y-8">
      {settings ? (
        <div className="stagger grid gap-4 xl:grid-cols-3">
          <CalcBasisCard settings={settings} ask={setMpinAction} />
          <RateUnitsCard settings={settings} ask={setMpinAction} />
          <PrintCard settings={settings} ask={setMpinAction} />
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      )}
      <KaratCard ask={setMpinAction} />

      <MpinDialog open={!!mpinAction} title={mpinAction?.title} onConfirm={(m) => mpinAction!.run(m)} onClose={() => setMpinAction(null)} />
    </div>
  )
}

function SaveSettingCard({ title, children, onSave, ask }: { title: string; children: React.ReactNode; onSave: (mpin: string) => Promise<unknown>; ask: (a: MpinAction) => void }) {
  const { can } = useAuth()
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>{title}</CardTitle>
        {can('settings.misc', 'edit') && (
          <Button size="sm" onClick={() => ask({ title: 'Authenticate & save', run: onSave })}>
            Save
          </Button>
        )}
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
              <SelectTrigger aria-label={`${k} basis`}>
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
            <SelectTrigger aria-label="Gold rate unit">
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
            <SelectTrigger aria-label="Silver rate unit">
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
            <SelectTrigger aria-label="Print layout">
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
  const { can } = useAuth()
  const canEdit = can('settings.misc', 'edit')
  const canDelete = can('settings.misc', 'delete')
  const { data: karats } = useKarats()
  const create = useCreateKarat()
  const update = useUpdateKarat()
  const del = useDeleteKarat()
  const [add, setAdd] = useState({ metal: 'GOLD', code: '', title: '', touch: '' })
  const [edit, setEdit] = useState<Record<number, string>>({}) // id -> touch being edited

  // Validate with the shared schema (blank touch -> error, not 0).
  const submitAdd = () => {
    const parsed = karatBody.safeParse(add)
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? 'Invalid karat')
    create.mutate(parsed.data)
    setAdd({ metal: 'GOLD', code: '', title: '', touch: '' })
  }
  const saveTouch = (id: number, value: string) => {
    const parsed = karatBody.shape.touch.safeParse(value)
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? 'Invalid touch')
    ask({
      title: 'Save karat',
      run: async (mpin) => {
        await update.mutateAsync({ id, body: { touch: parsed.data }, mpin })
        setEdit((p) => { const n = { ...p }; delete n[id]; return n })
      },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Karat → touch mapping</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {karats?.map((k: KaratDto) => (
          <div key={k.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/40 px-4 py-2 text-sm">
            <span className="w-16 font-medium">{k.title}</span>
            <Badge variant="secondary">{k.metal}</Badge>
            <span className="text-muted-foreground">{k.code}</span>
            <Input
              className="w-28"
              type="number"
              step="0.01"
              aria-label={`${k.title} touch %`}
              disabled={!canEdit}
              value={edit[k.id] ?? k.touch}
              onChange={(e) => setEdit({ ...edit, [k.id]: e.target.value })}
            />
            <span className="text-muted-foreground">% touch</span>
            {canEdit && edit[k.id] !== undefined && edit[k.id] !== k.touch && (
              <Button size="sm" variant="outline" onClick={() => saveTouch(k.id, edit[k.id])}>
                Save
              </Button>
            )}
            {canDelete && !k.isSystem && (
              <Button size="sm" variant="ghost" onClick={() => ask({ title: 'Delete karat', run: (mpin) => del.mutateAsync({ id: k.id, mpin }) })}>
                Delete
              </Button>
            )}
          </div>
        ))}

        {canEdit && (
        <div className="flex flex-wrap items-end gap-3 border-t pt-4">
          <div className="space-y-1">
            <Label className="text-xs">Metal</Label>
            <Select value={add.metal} onValueChange={(v) => setAdd({ ...add, metal: v })}>
              <SelectTrigger className="w-28" aria-label="Metal">
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
        )}
      </CardContent>
    </Card>
  )
}
