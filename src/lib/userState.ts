import type { QueryClient } from '@tanstack/react-query'

import { abortPending, setAccessToken } from '@/lib/api'

/** Drop everything that belongs to the current user before the identity changes (logout, impersonation start / end,
 *  a session changed in another tab): in-flight requests, the access token and every cached query. */
export function dropUserState(queryClient: QueryClient) {
  abortPending()
  setAccessToken(null)
  queryClient.clear()
}
