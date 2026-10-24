import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth'

// Scaffold dashboard: proves login -> correct area and shows the resolved auth context.
export function Dashboard({ title }: { title: string }) {
  const { me, activeBranch } = useAuth()
  if (!me) return null
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Signed in as {me.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm">
          <div>Level: <b>{me.level}</b>{me.isOwner && ' (owner)'}</div>
          <div>Business: {me.business?.name ?? '— (platform)'}</div>
          <div>Home branch: {me.branch?.name ?? '—'}</div>
          <div>Active branch: {activeBranch}</div>
          <div>Accessible branches: {me.accessibleBranches.map((b) => b.name).join(', ') || '—'}</div>
          <div>Plan: {me.subscription?.planName ?? '—'}</div>
          <div>Modules: {me.modules.length}</div>
        </CardContent>
      </Card>
    </div>
  )
}
