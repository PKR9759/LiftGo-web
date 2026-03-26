// components/Navbar.tsx
'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { clearAuth, getUser, isLoggedIn } from '@/lib/auth'
import { useEffect, useState } from 'react'

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()

  const [loggedIn, setLoggedIn] = useState(false)
  const [userName, setUserName] = useState('')
  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

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

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const handleLogout = () => {
    clearAuth()
    setLoggedIn(false)
    setUserName('')
    setMenuOpen(false)
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

  const navLinks = loggedIn
    ? [
      { href: '/', label: 'Home' },
      { href: '/liveboard', label: 'Live board' },
      { href: '/rides/new', label: 'Offer ride' },
      { href: '/seeks/new', label: 'Need ride' },
      { href: '/dashboard', label: 'Dashboard' },
    ]
    : [{ href: '/', label: 'Home' }]

  return (
    <nav className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="text-xl font-bold text-slate-900">
          LiftGo
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${pathname === link.href
                  ? 'text-slate-900 font-medium'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop auth buttons */}
        <div className="hidden md:flex items-center gap-3">
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

        {/* Hamburger button — mobile only */}
        <button
          onClick={() => setMenuOpen(prev => !prev)}
          className="md:hidden flex flex-col justify-center items-center w-10 h-10 rounded-lg
            hover:bg-slate-100 transition-colors relative"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          <span
            className={`block h-0.5 w-5 bg-slate-700 rounded transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-[3px]' : ''
              }`}
          />
          <span
            className={`block h-0.5 w-5 bg-slate-700 rounded mt-1 transition-all duration-300 ${menuOpen ? 'opacity-0' : ''
              }`}
          />
          <span
            className={`block h-0.5 w-5 bg-slate-700 rounded mt-1 transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''
              }`}
          />
        </button>
      </div>

      {/* Mobile menu panel */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out border-t ${menuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 border-t-transparent'
          }`}
      >
        <div className="bg-white px-4 py-4 space-y-1">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`block px-3 py-2.5 rounded-lg text-sm transition-colors ${pathname === link.href
                  ? 'bg-slate-100 text-slate-900 font-medium'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
            >
              {link.label}
            </Link>
          ))}

          <div className="border-t my-3" />

          {loggedIn ? (
            <>
              <Link
                href="/profile"
                className={`block px-3 py-2.5 rounded-lg text-sm transition-colors ${pathname === '/profile'
                    ? 'bg-slate-100 text-slate-900 font-medium'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                👤 {userName}
              </Link>
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-red-600
                  hover:bg-red-50 transition-colors"
              >
                Log out
              </button>
            </>
          ) : (
            <div className="flex gap-2 px-3 pt-2">
              <Link href="/auth/login" className="flex-1">
                <Button variant="outline" className="w-full">Log in</Button>
              </Link>
              <Link href="/auth/register" className="flex-1">
                <Button className="w-full">Sign up</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}