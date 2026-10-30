/**
 * Cross-tab session safety (ISS-19). Every tab of one browser profile shares the httpOnly refresh cookie, but each
 * tab keeps its own access token + `me` in memory. A login / logout / impersonation in another tab can therefore
 * change whose session a refresh returns. A tab must never silently continue as someone else: it stops, clears its
 * user state and asks to reload (`SessionChanged`). The server still authorises every request.
 *
 * Identity = "<user id>:<impersonating Super Admin id or empty>", read from the access token's claims. It is only
 * compared, never trusted for access. Tokens and passwords are never broadcast: events carry ids only.
 */

export type SessionChange = 'other-user' | 'signed-out' | 'impersonation-ended'

/** `sub:imp` from an access token (payload read without verification), or null if it cannot be read. */
export function tokenIdentity(token: string): string | null {
  try {
    const part = token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(part)) as { sub?: unknown; imp?: unknown }
    return claims.sub == null ? null : `${String(claims.sub)}:${claims.imp == null ? '' : String(claims.imp)}`
  } catch {
    return null
  }
}

/** The account the shared refresh cookie belongs to: the Super Admin while impersonating, else the user. */
export const cookieOwner = (identity: string): string => {
  const [sub, imp] = identity.split(':')
  return imp || sub!
}

/** A refresh returned `next` while this tab is `mine`: why that is not this tab's session. */
export const refreshChange = (mine: string, next: string | null): SessionChange =>
  next != null && mine.split(':')[1] !== '' && next === `${mine.split(':')[1]}:` ? 'impersonation-ended' : 'other-user'

export interface AuthEvent {
  type: 'login' | 'logout'
  /** cookie owner (user id) whose login / logout this was — never a token */
  who: string
}

/** What this tab (`mine`, null = logged out) must do about another tab's event. */
export function reactTo(e: AuthEvent, mine: string | null): SessionChange | null {
  if (!mine) return null // nothing to protect; the next login / reload restores from the cookie
  const owner = cookieOwner(mine)
  if (e.type === 'login') return e.who === owner ? null : 'other-user' // the cookie now belongs to someone else
  return e.who === owner ? 'signed-out' : null
}

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ju-auth') : null

export const announce = (e: AuthEvent): void => channel?.postMessage(e)

export function onAnnounce(fn: (e: AuthEvent) => void): () => void {
  if (!channel) return () => {}
  const h = (m: MessageEvent<AuthEvent>) => fn(m.data)
  channel.addEventListener('message', h)
  return () => channel.removeEventListener('message', h)
}
