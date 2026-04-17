import { z } from 'zod'

const emailField = z.string().min(1, 'Email is required').email('Please enter a valid email address')
const passwordField = z.string().min(8, 'Password must be at least 8 characters')

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const signupSchema = z
  .object({
    email: emailField,
    password: passwordField,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    firstName: z.string().min(1, 'First name is required').max(80),
    lastName: z.string().min(1, 'Last name is required').max(80),
    organization: z.string().min(1, 'Organization is required').max(120),
    jobTitle: z.string().max(120).optional().or(z.literal('')),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
export type SignupInput = z.infer<typeof signupSchema>

export const magicLinkSchema = z.object({ email: emailField })
export type MagicLinkInput = z.infer<typeof magicLinkSchema>

export const resetPasswordSchema = z.object({ email: emailField })
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
