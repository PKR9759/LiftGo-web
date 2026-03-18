// app/auth/register/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { register as registerUser } from '@/lib/api'
import { setAuth } from '@/lib/auth'
import { toast } from 'sonner'

const schema = z.object({
  name:     z.string().min(2, 'Name must be at least 2 characters'),
  email:    z.string().email('Invalid email'),
  phone:    z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm:  z.string(),
  role:     z.enum(['rider', 'driver', 'both']),
}).refine(d => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
})

type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const router    = useRouter()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'both' },
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const res = await registerUser({
        name:     data.name,
        email:    data.email,
        password: data.password,
        phone:    data.phone,
        role:     data.role,
      })
      setAuth(res.data.token, res.data.user)
      toast.success('Account created!')
      router.push('/')
      router.refresh()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Create an account</h1>
          <p className="text-slate-500 text-sm mt-1">
            Join LiftGo and start sharing rides
          </p>
        </div>

        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            <div>
              <Label className="text-sm mb-1 block">Full name</Label>
              <Input placeholder="Pawan Kumar" {...register('name')} />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label className="text-sm mb-1 block">Email</Label>
              <Input
                type="email"
                placeholder="you@example.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Label className="text-sm mb-1 block">
                Phone <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              <Input type="tel" placeholder="9876543210" {...register('phone')} />
            </div>

            <div>
              <Label className="text-sm mb-1 block">Password</Label>
              <Input
                type="password"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <div>
              <Label className="text-sm mb-1 block">Confirm password</Label>
              <Input
                type="password"
                placeholder="••••••••"
                {...register('confirm')}
              />
              {errors.confirm && (
                <p className="text-red-500 text-xs mt-1">{errors.confirm.message}</p>
              )}
            </div>

            {/* role picker */}
            <div>
              <Label className="text-sm mb-2 block">I want to</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['rider', 'driver', 'both'] as const).map(r => (
                  <label key={r} className="relative cursor-pointer">
                    <input
                      type="radio"
                      value={r}
                      {...register('role')}
                      className="peer sr-only"
                    />
                    <div className="text-center border rounded-lg py-2 text-sm
                      text-slate-600 peer-checked:border-slate-900
                      peer-checked:bg-slate-900 peer-checked:text-white
                      transition-colors capitalize">
                      {r === 'both'
                        ? 'Both'
                        : r === 'rider'
                        ? 'Find rides'
                        : 'Offer rides'
                      }
                    </div>
                  </label>
                ))}
              </div>
              {errors.role && (
                <p className="text-red-500 text-xs mt-1">{errors.role.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </Button>

          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-4">
          Already have an account?{' '}
          <Link
            href="/auth/login"
            className="text-slate-900 font-medium hover:underline"
          >
            Log in
          </Link>
        </p>

      </div>
    </div>
  )
}