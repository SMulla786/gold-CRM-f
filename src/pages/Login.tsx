import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'

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
    <div className="grid min-h-screen place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Just Udhari</CardTitle>
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
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Log In Now'}
            </Button>
          </form>
          {MOCK && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Dev seed — <code>superadmin</code> / <code>demo.owner</code> / <code>demo.pune</code> / <code>demo.cashier</code>, password <code>ChangeMe@123</code>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
