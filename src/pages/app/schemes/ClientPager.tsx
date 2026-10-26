import { useState } from 'react'

import { Button } from '@/components/ui/button'

const PAGE_SIZES = [10, 20, 50, 100]

/** Client-side paging over an already-fetched (unpaged) array. Page clamps when the list shrinks. */
export function useClientPage<T>(rows: T[] | undefined, initialSize = 20) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialSize)
  const total = rows?.length ?? 0
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, pages)
  const start = (current - 1) * pageSize
  return {
    pageRows: (rows ?? []).slice(start, start + pageSize),
    /** index offset of the first row on this page (for S.N.) */
    start,
    pager: { page: current, pages, pageSize, total, onPage: setPage, onPageSize: (s: number) => { setPageSize(s); setPage(1) } },
  }
}

export function ClientPager({ page, pages, pageSize, total, onPage, onPageSize, label = 'Rows per page' }: ReturnType<typeof useClientPage>['pager'] & { label?: string }) {
  if (total <= PAGE_SIZES[0]!) return null
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 px-2 py-2 text-sm">
      <label className="mr-auto flex items-center gap-2 text-muted-foreground">
        {label}
        <select className="h-8 rounded-lg border bg-card px-2 text-foreground" aria-label={label} value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
          {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <span className="text-muted-foreground">Page {page} of {pages} · {total} rows</span>
      {pages > 1 && <>
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </>}
    </div>
  )
}
