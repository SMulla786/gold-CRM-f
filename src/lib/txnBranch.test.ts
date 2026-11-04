import { describe, expect, it } from 'vitest'
import type { BranchRef } from '@/shared'
import { txnBranchReady, txnBranches } from '@/lib/txnBranch'

const br = (id: number, isActive: boolean): BranchRef => ({ id, name: `B${id}`, parentId: id === 1 ? null : 1, path: `/1/${id}/`, depth: 1, isAdminNode: id === 1, isActive })
const branches = [br(1, true), br(2, false), br(3, true)]

describe('G7 inactive branches in the transaction pickers', () => {
  it('the picker lists only active branches', () => {
    expect(txnBranches(branches).map((b) => b.id)).toEqual([1, 3])
    expect(txnBranches(undefined)).toEqual([])
  })
  it('a transaction form opens only on an active concrete branch; "all" or an inactive branch asks for a branch first', () => {
    expect(txnBranchReady(branches, '3')).toBe(true)
    expect(txnBranchReady(branches, '2')).toBe(false)
    expect(txnBranchReady(branches, 'all')).toBe(false)
    expect(txnBranchReady(branches, '')).toBe(false)
  })
})
