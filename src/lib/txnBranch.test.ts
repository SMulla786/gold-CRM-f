import { describe, expect, it } from 'vitest'
import type { BranchRef, MeDto } from '@/shared'
import { txnBranchReady, txnBranches, writeBranch } from '@/lib/txnBranch'

const br = (id: number, isActive: boolean): BranchRef => ({ id, name: `B${id}`, parentId: id === 1 ? null : 1, path: `/1/${id}/`, depth: 1, isAdminNode: id === 1, isActive })
const branches = [br(1, true), br(2, false), br(3, true)]
const me = (level: MeDto['level'], own: BranchRef): MeDto =>
  ({ id: 9, name: 'U', username: 'u', level, isOwner: false, business: null, branch: own, accessibleBranches: branches, permissions: {}, modules: [], subscription: null, hasMpin: false, impersonatedBy: null })

describe('G7 closure: the branch a store write lands on (the API refuses it with 403 BRANCH_INACTIVE when inactive)', () => {
  it("an admin writes to the picked branch, or to their own branch on 'All branches'", () => {
    expect(writeBranch(me('ADMIN', br(1, true)), '2')).toEqual(br(2, false))
    expect(writeBranch(me('ADMIN', br(1, true)), 'all')).toEqual(br(1, true))
  })
  it('staff always write to their own branch, whatever the switcher shows', () => {
    expect(writeBranch(me('BRANCH_USER', br(2, false)), '3')).toEqual(br(2, false))
  })
  it('no user, no branch', () => {
    expect(writeBranch(null, 'all')).toBeNull()
  })
})

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
