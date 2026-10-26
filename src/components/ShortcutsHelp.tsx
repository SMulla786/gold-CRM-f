import { Keyboard } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const SHORTCUTS: [string, string][] = [
  ['Ctrl / ⌘ + K', 'Search menus and jump to a page'],
  ['Alt + S', 'Stock lookup (tag, HUID or item name)'],
  ['?', 'Show this list'],
  ['Enter', 'Submit a scanned tag on Scan/Match'],
  ['Esc', 'Close the open dialog'],
]

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))

/** Keyboard shortcuts help ('?' anywhere outside a text field). */
export function ShortcutsHelp() {
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
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>Work faster at the counter.</DialogDescription>
          </DialogHeader>
          <dl className="divide-y text-sm">
            {SHORTCUTS.map(([keys, what]) => (
              <div key={keys} className="flex items-center justify-between gap-4 py-2">
                <dt>{what}</dt>
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
