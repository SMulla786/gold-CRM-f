import { describe, expect, it } from 'vitest'
import { ApiException, errorText } from '@/lib/errors'

describe('G7 closure: a refused call reaches the user as a clear message', () => {
  it('a 400 VALIDATION names its first field problem (the server sends just "Invalid input" + zod flatten details)', () => {
    const e = new ApiException(400, 'VALIDATION', 'Invalid input', { formErrors: [], fieldErrors: { mobile: ['10-digit mobile number'], name: ['Required'] } })
    expect(errorText(e)).toBe('Invalid input — mobile: 10-digit mobile number')
    expect(errorText(new ApiException(400, 'VALIDATION', 'Invalid input', { formErrors: ['Each metal may appear only once'], fieldErrors: {} }))).toBe('Invalid input — Each metal may appear only once')
  })
  it('other refusals keep the server message as is (403 BRANCH_INACTIVE, 409 CONFLICT, a VALIDATION with its own details)', () => {
    expect(errorText(new ApiException(403, 'BRANCH_INACTIVE', 'Branch "Pune" is inactive.', { branchId: 2 }))).toBe('Branch "Pune" is inactive.')
    expect(errorText(new ApiException(409, 'CONFLICT', 'Not enough kacha gold', { code: 'KACHA_SHORT' }))).toBe('Not enough kacha gold')
    expect(errorText(new ApiException(400, 'VALIDATION', 'PAN is required', { code: 'PAN_REQUIRED' }))).toBe('PAN is required')
  })
  it('anything that is not an API error gets the fallback', () => {
    expect(errorText(new TypeError('Failed to fetch'))).toBe('Something went wrong')
    expect(errorText(null, 'Could not save')).toBe('Could not save')
  })
})
