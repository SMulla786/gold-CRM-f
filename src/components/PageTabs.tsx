import { NavLink } from 'react-router-dom'

import { cn } from '@/lib/utils'

/** TASK-91 section tabs: one scrollable pill strip (never wraps on phones). Stays a <nav> of links. */
export function PageTabs({ tabs }: { tabs: Array<{ to: string; label: string; end?: boolean }> }) {
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
              isActive ? 'bg-brand/15 font-semibold text-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--color-brand)_35%,transparent)]' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
