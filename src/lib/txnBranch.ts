import type { BranchRef } from '@/shared'

/** Branches a new entry may post to. An inactive branch keeps its history and reports but takes no new entries (G7; the API answers 403 BRANCH_INACTIVE). */
export const txnBranches = (branches: BranchRef[] | undefined): BranchRef[] => (branches ?? []).filter((b) => b.isActive)

/** The active branch is one concrete branch that may take new entries — "all" or an inactive branch means pick one first. */
export const txnBranchReady = (branches: BranchRef[] | undefined, activeBranch: string): boolean => txnBranches(branches).some((b) => String(b.id) === activeBranch)
