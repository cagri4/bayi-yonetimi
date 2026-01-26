import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Gecerli bir email adresi girin'),
  password: z.string().min(6, 'Sifre en az 6 karakter olmali'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Gecerli bir email adresi girin'),
})

export const resetPasswordSchema = z.object({
  password: z.string().min(6, 'Sifre en az 6 karakter olmali'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Sifreler eslesmiyor',
  path: ['confirmPassword'],
})

export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
