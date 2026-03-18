// components/Navbar.tsx
'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { clearAuth, getUser, isLoggedIn } from '@/lib/auth'
import { useEffect, useState } from 'react'

export default function Navbar() {
  const router   = useRouter()
  const pathname = usePathname()

  const [loggedIn,  setLoggedIn]  = useState(false)
  const [userName,  setUserName]  = useState('')
  const [mounted,   setMounted]   = useState(false)

  useEffect(() => {
    setMounted(true)
    setLoggedIn(isLoggedIn())
    const user = getUser()
    if (user) setUserName(user.name)
  }, [])

  useEffect(() => {
    if (!mounted) return
    setLoggedIn(isLoggedIn())
    const user = getUser()
    setUserName(user?.name ?? '')
  }, [pathname, mounted])

  const handleLogout = () => {
    clearAuth()
    setLoggedIn(false)
    setUserName('')
    router.push('/')
    router.refresh()
  }

  if (!mounted) {
    return (
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-slate-900">
            LiftGo
          </Link>
          <div className="w-32" />
        </div>
      </nav>
    )
  }

  return (
    <nav className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">

        <Link href="/" className="text-xl font-bold text-slate-900">
          LiftGo
        </Link>

        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
            Live board
          </Link>
          {loggedIn && (
            <>
              <Link href="/rides/new" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                Offer ride
              </Link>
              <Link href="/seeks/new" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                Need ride
              </Link>
              <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                Dashboard
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {loggedIn ? (
            <>
              <Link href="/profile" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                {userName}
              </Link>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link href="/auth/login">
                <Button variant="ghost" size="sm">Log in</Button>
              </Link>
              <Link href="/auth/register">
                <Button size="sm">Sign up</Button>
              </Link>
            </>
          )}
        </div>

      </div>
    </nav>
  )
}