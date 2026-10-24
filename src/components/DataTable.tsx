import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'

import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  isLoading?: boolean
  emptyText?: string
  /** Server-side pagination controls (optional). */
  pagination?: { page: number; pageSize: number; total: number; onPage: (page: number) => void }
}

export function DataTable<T>({ columns, data, isLoading, emptyText = 'No records', pagination }: DataTableProps<T>) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() })
  const pageCount = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
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
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
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
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.total > pagination.pageSize && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">
            Page {pagination.page} of {pageCount} · {pagination.total} total
          </span>
          <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => pagination.onPage(pagination.page - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={pagination.page >= pageCount} onClick={() => pagination.onPage(pagination.page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
