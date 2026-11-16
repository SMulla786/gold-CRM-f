import { ShieldAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { SessionChange } from '@/lib/session'

// Rendered by AuthProvider (outside LocaleProvider), so plain English like the login page.
const TEXT: Record<SessionChange, { title: string; body: string; action: string; to: string }> = {
  'other-user': {
    title: 'Signed in as someone else in another tab',
    body: 'Another tab in this browser signed in with a different account. This tab was stopped so it cannot act as that account, and its data was cleared. Reload to continue with the account that is signed in now.',
    action: 'Reload',
    to: '/',
  },
  'signed-out': {
    title: 'Signed out in another tab',
    body: 'This account was signed out in another tab. This tab was stopped and its data was cleared.',
    action: 'Sign in again',
    to: '/login',
  },
  'impersonation-ended': {
    title: 'Support session ended',
    body: 'The impersonation session expired or was ended. This tab was stopped and the business data was cleared.',
    action: 'Back to platform',
    to: '/platform',
  },
}

/** Blocks the whole app after a session change (lib/session). The full page load re-verifies who is signed in. */
export function SessionChanged({ why }: { why: SessionChange }) {
  const t = TEXT[why]
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card role="alertdialog" aria-labelledby="session-changed-title" aria-describedby="session-changed-body" className="w-full max-w-md">
        <CardHeader>
          <ShieldAlert className="size-6 text-destructive" aria-hidden />
          <CardTitle id="session-changed-title">{t.title}</CardTitle>
          <CardDescription id="session-changed-body">{t.body}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button autoFocus className="w-full" onClick={() => window.location.assign(t.to)}>{t.action}</Button>
        </CardContent>
      </Card>
    </main>
  )
}
