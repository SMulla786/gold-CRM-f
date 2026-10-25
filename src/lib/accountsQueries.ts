// Phase 3 accounts — income/expense, asset ledgers, Day-Book hooks against /api/app/*.
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { qs, useApiMutation } from '@/lib/queries'
import type { DayBookDto, IncomeExpenseDailySummaryDto, IncomeExpenseDto, LedgerPageDto, Paged } from '@/shared'

// ───── Income / Expense ─────
export const useIncomeExpense = (params: Record<string, string | number | undefined>, enabled = true) =>
  useQuery({ queryKey: ['income-expense', params], queryFn: () => api.get<Paged<IncomeExpenseDto>>(`/app/income-expense${qs(params)}`), enabled })
export const useIncomeExpenseSummary = (params: Record<string, string | number | undefined>, enabled = true) =>
  useQuery({ queryKey: ['income-expense-summary', params], queryFn: () => api.get<IncomeExpenseDailySummaryDto[]>(`/app/income-expense/summary${qs(params)}`), enabled })
export const useCreateIncomeExpense = () =>
  useApiMutation((body: Record<string, unknown>) => api.post('/app/income-expense', body), {
    invalidate: [['income-expense'], ['ledger'], ['day-book']],
    success: 'Saved',
  })
export const useUpdateIncomeExpense = () =>
  useApiMutation(({ id, body, mpin }: { id: number; body: Record<string, unknown>; mpin: string }) => api.patch(`/app/income-expense/${id}`, body, { mpin }), {
    invalidate: [['income-expense'], ['ledger'], ['day-book']],
    success: 'Updated',
  })
export const useDeleteIncomeExpense = () =>
  useApiMutation(({ id, mpin }: { id: number; mpin: string }) => api.del(`/app/income-expense/${id}`, { mpin }), {
    invalidate: [['income-expense'], ['ledger'], ['day-book']],
    success: 'Deleted',
  })

// ───── Asset ledgers & Day-Book ─────
export const useLedger = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['ledger', params], queryFn: () => api.get<LedgerPageDto>(`/app/ledgers${qs(params)}`) })
export const useDayBook = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ['day-book', params], queryFn: () => api.get<DayBookDto>(`/app/day-book${qs(params)}`) })

// TASK-80: open / close a branch-day (MPIN). A closed day blocks all ledger postings (403 DAY_CLOSED).
type DayStatus = { date: string; status: 'OPEN' | 'CLOSED' }
export const useOpenDay = () =>
  useApiMutation(({ date, mpin }: { date: string; mpin: string }) => api.post<DayStatus>('/app/daybook/open', { date }, { mpin }), { invalidate: [['day-book']], success: 'Day reopened' })
export const useCloseDay = () =>
  useApiMutation(({ date, mpin }: { date: string; mpin: string }) => api.post<DayStatus>('/app/daybook/close', { date }, { mpin }), { invalidate: [['day-book']], success: 'Day closed' })
