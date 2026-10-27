import { NavLink, useLocation } from 'react-router-dom'

import { cn } from '@/lib/utils'

/** TASK-91 section tabs: one scrollable pill strip (never wraps on phones). Stays a <nav> of links.
 *  A tab whose `to` carries a query (e.g. ?kind=PURCHASE) is active only when that query is in the URL, and then wins over its path-only sibling. */
export function PageTabs({ tabs }: { tabs: Array<{ to: string; label: string; end?: boolean }> }) {
  const { pathname, search } = useLocation()
  const queryActive = (to: string) => {
    const [path, query] = to.split('?')
    return !!query && pathname === path && [...new URLSearchParams(query).entries()].every(([k, v]) => new URLSearchParams(search).get(k) === v)
  }
  const someQueryTabActive = tabs.some((t) => queryActive(t.to))
  return (
    <nav className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-white/80 bg-card p-1 shadow-sm sm:w-fit dark:border-border print:hidden">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            cn(
              'shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition-colors',
              (t.to.includes('?') ? queryActive(t.to) : isActive && !someQueryTabActive) ? 'bg-brand/15 font-semibold text-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--color-brand)_35%,transparent)]' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
