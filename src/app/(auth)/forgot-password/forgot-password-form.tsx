'use client'

import { useActionState } from 'react'
import { forgotPassword, type AuthActionState } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'

const initialState: AuthActionState = {}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPassword, initialState)

  return (
    <form action={formAction} className="mt-8 space-y-6">
      {state.message && (
        <Alert variant={state.success ? 'default' : 'destructive'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      {!state.success && (
        <>
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

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Gonderiliyor...' : 'Sifirlama Linki Gonder'}
          </Button>
        </>
      )}

      <div className="text-center">
        <Link
          href="/login"
          className="text-sm text-blue-600 hover:text-blue-500"
        >
          Girise don
        </Link>
      </div>
    </form>
  )
}
