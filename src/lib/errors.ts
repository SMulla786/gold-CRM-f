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

/** What to tell the user about a failed call: the server's message; a 400 VALIDATION adds its first field problem, since the
 *  server's message for a schema failure is just "Invalid input" (details = zod flatten). */
export function errorText(e: unknown, fallback = 'Something went wrong'): string {
  if (!(e instanceof ApiException)) return fallback
  const d = e.code === 'VALIDATION' ? (e.details as { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> } | undefined) : undefined
  const field = Object.entries(d?.fieldErrors ?? {}).find(([, msgs]) => msgs?.length)
  const first = field ? `${field[0]}: ${field[1]![0]}` : d?.formErrors?.[0]
  return first ? `${e.message} — ${first}` : e.message
}
