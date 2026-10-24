import type { ErrorCode } from '@/shared'

export class ApiException extends Error {
  status: number
  code: ErrorCode
  details?: unknown

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiException'
    this.status = status
    this.code = code
    this.details = details
  }
}
