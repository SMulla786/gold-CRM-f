import { zodResolver } from '@hookform/resolvers/zod'
import { Gem } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { homeForLevel } from '@/components/guards'
import { ApiException } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { loginBody, type LoginBody } from '@/shared'

const MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export function Login() {
  const { me, login } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginBody>({ resolver: zodResolver(loginBody) })

  if (me) return <Navigate to={homeForLevel(me.level)} replace />

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const user = await login(values.login, values.password)
      navigate(homeForLevel(user.level), { replace: true })
    } catch (err) {
      setFormError(err instanceof ApiException ? err.message : 'Something went wrong. Try again.')
    }
  })

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[oklch(0.16_0.012_70)] p-12 text-[oklch(0.95_0.01_85)] lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-32 -top-32 size-[520px] rounded-full bg-brand/25 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-40 right-0 size-[420px] rounded-full bg-brand-strong/20 blur-3xl" aria-hidden />
        <span className="relative flex items-center gap-2">
          <Gem className="size-6 text-brand" aria-hidden />
          <span className="wordmark font-serif text-2xl font-semibold">Just Udhari</span>
        </span>
        <div className="relative max-w-md space-y-4">
          <h2 className="font-serif text-4xl leading-tight">Every gram, every rupee — in one ledger.</h2>
          <p className="text-sm text-[oklch(0.8_0.02_85)]">Billing, udhar, girvi, stock and day-book for your jewellery shop, across all your branches.</p>
        </div>
        <p className="relative text-xs text-[oklch(0.65_0.02_85)]">© Just Udhari</p>
      </aside>
      <div className="grid place-items-center p-6">
      <Card className="w-full max-w-sm border-brand/20 shadow-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="font-serif text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="login">Username or Email</Label>
              <Input id="login" autoComplete="username" autoFocus {...register('login')} />
              {errors.login && <p className="text-xs text-destructive">{errors.login.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Log In Now'}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/privacy" className="underline">Privacy Policy</Link>
          </p>
          {MOCK && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Dev seed — <code>superadmin</code> / <code>demo.owner</code> / <code>demo.pune</code> / <code>demo.cashier</code>, password <code>&lt;demo seed password&gt;</code>
            </p>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
