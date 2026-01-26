'use client'

import { useActionState } from 'react'
import { resetPassword, type AuthActionState } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'

const initialState: AuthActionState = {}

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPassword, initialState)

  return (
    <form action={formAction} className="mt-8 space-y-6">
      {state.message && (
        <Alert variant={state.success ? 'default' : 'destructive'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      {!state.success ? (
        <>
          <div className="space-y-4">
            <div>
              <Label htmlFor="password">Yeni Sifre</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="••••••••"
              />
              {state.errors?.password && (
                <p className="text-sm text-red-500 mt-1">{state.errors.password[0]}</p>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword">Sifre Tekrar</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                placeholder="••••••••"
              />
              {state.errors?.confirmPassword && (
                <p className="text-sm text-red-500 mt-1">{state.errors.confirmPassword[0]}</p>
              )}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Kaydediliyor...' : 'Sifreyi Guncelle'}
          </Button>
        </>
      ) : (
        <div className="text-center">
          <Link href="/login">
            <Button className="w-full">Giris Yap</Button>
          </Link>
        </div>
      )}
    </form>
  )
}
