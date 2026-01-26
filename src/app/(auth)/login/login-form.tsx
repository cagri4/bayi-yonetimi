'use client'

import { useActionState } from 'react'
import { login, type AuthActionState } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'

const initialState: AuthActionState = {}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState)

  return (
    <form action={formAction} className="mt-8 space-y-6">
      {state.message && !state.success && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="ornek@firma.com"
          />
          {state.errors?.email && (
            <p className="text-sm text-red-500 mt-1">{state.errors.email[0]}</p>
          )}
        </div>

        <div>
          <Label htmlFor="password">Sifre</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
          {state.errors?.password && (
            <p className="text-sm text-red-500 mt-1">{state.errors.password[0]}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Link
          href="/forgot-password"
          className="text-sm text-blue-600 hover:text-blue-500"
        >
          Sifremi unuttum
        </Link>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Giris yapiliyor...' : 'Giris Yap'}
      </Button>
    </form>
  )
}
