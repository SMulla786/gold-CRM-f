import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'

import { TABLE_EDGES } from '@/components/SectionCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useT } from '@/lib/i18n'

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  isLoading?: boolean
  emptyText?: string
  /** Server-side pagination controls (optional). `onPageSize` adds an entries-per-page picker (backend max 100). */
  pagination?: { page: number; pageSize: number; total: number; onPage: (page: number) => void; onPageSize?: (size: number) => void }
}

const PAGE_SIZES = [10, 20, 50, 100]

export function DataTable<T>({ columns, data, isLoading, emptyText, pagination }: DataTableProps<T>) {
  const t = useT()
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() })
  const pageCount = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1

  return (
    <div className="space-y-3">
      <div className={`overflow-hidden rounded-3xl border border-white/80 bg-card shadow-sm dark:border-border ${TABLE_EDGES}`}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, r) => (
                <TableRow key={`sk-${r}`}>
                  {columns.map((_c, c) => (
                    <TableCell key={c}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyText ?? t('table.no_records')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && (pagination.total > pagination.pageSize || (pagination.onPageSize && pagination.total > PAGE_SIZES[0])) && (
        <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
          {pagination.onPageSize && (
            <label className="mr-auto flex items-center gap-2 text-muted-foreground">
              {t('table.entries')}
              <select
                className="h-8 rounded-lg border bg-card px-2 text-foreground"
                value={pagination.pageSize}
                onChange={(e) => { pagination.onPageSize!(Number(e.target.value)); pagination.onPage(1) }}
              >
                {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          )}
          <span className="text-muted-foreground">
            {t('table.page_of', { page: pagination.page, pages: pageCount, total: pagination.total })}
          </span>
          {pagination.total > pagination.pageSize && <>
          <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => pagination.onPage(pagination.page - 1)}>
            {t('table.previous')}
          </Button>
          <Button variant="outline" size="sm" disabled={pagination.page >= pageCount} onClick={() => pagination.onPage(pagination.page + 1)}>
            {t('table.next')}
          </Button>
          </>}
        </div>
      )}
    </div>
  )
}
