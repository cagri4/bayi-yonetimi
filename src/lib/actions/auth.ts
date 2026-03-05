'use server'

import { createClient } from '@/lib/supabase/server'
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from '@/lib/validations/auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export type AuthActionState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export async function login(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const validatedFields = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Gecersiz form verileri',
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: validatedFields.data.email,
    password: validatedFields.data.password,
  })

  if (error) {
    console.error('[LOGIN ERROR]', error.message, error.status, error.code)
    return {
      message: 'Email veya sifre hatali',
    }
  }

  // Check if user has a profile and determine redirect
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const result = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const profile = result.data as { role: 'admin' | 'dealer' } | null

    revalidatePath('/', 'layout')

    if (profile?.role === 'admin') {
      redirect('/admin')
    } else {
      redirect('/catalog')
    }
  }

  return { success: true, message: 'Giris basarili' }
}

export async function logout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getUserRole(): Promise<'admin' | 'dealer' | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const result = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile = result.data as { role: 'admin' | 'dealer' } | null

  return profile?.role || null
}

export async function forgotPassword(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const validatedFields = forgotPasswordSchema.safeParse({
    email: formData.get('email'),
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Gecersiz email adresi',
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(
    validatedFields.data.email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
    }
  )

  if (error) {
    return {
      message: 'Sifre sifirlama emaili gonderilemedi',
    }
  }

  return {
    success: true,
    message: 'Sifre sifirlama linki email adresinize gonderildi',
  }
}

export async function resetPassword(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const validatedFields = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Gecersiz form verileri',
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password: validatedFields.data.password,
  })

  if (error) {
    return {
      message: 'Sifre guncellenemedi',
    }
  }

  return {
    success: true,
    message: 'Sifreniz basariyla guncellendi',
  }
}
