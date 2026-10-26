import { Keyboard } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useT } from '@/lib/i18n'

// [keys, i18n key of the description]
const SHORTCUTS: [string, string][] = [
  ['Ctrl / ⌘ + K', 'comp.sc_search'],
  ['Alt + S', 'comp.sc_stock'],
  ['?', 'comp.sc_help'],
  ['Enter', 'comp.sc_scan'],
  ['Esc', 'comp.sc_close'],
]

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))

/** Keyboard shortcuts help ('?' anywhere outside a text field). */
export function ShortcutsHelp() {
  const t = useT()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e.target)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Keyboard shortcuts (?)" title="Keyboard shortcuts (?)" onClick={() => setOpen(true)}>
        <Keyboard />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('comp.shortcuts_title')}</DialogTitle>
            <DialogDescription>{t('comp.shortcuts_desc')}</DialogDescription>
          </DialogHeader>
          <dl className="divide-y text-sm">
            {SHORTCUTS.map(([keys, what]) => (
              <div key={keys} className="flex items-center justify-between gap-4 py-2">
                <dt>{t(what)}</dt>
                <dd>
                  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{keys}</kbd>
                </dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </>
  )
}
