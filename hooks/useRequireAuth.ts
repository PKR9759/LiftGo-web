'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isLoggedIn } from '@/lib/auth'

/**
 * Redirects to /auth/login if the user is not authenticated.
 * Returns { ready: true } once auth is confirmed, so the page can render.
 */
export function useRequireAuth() {
    const router = useRouter()
    const [ready, setReady] = useState(false)

    useEffect(() => {
        if (!isLoggedIn()) {
            router.replace('/auth/login')
        } else {
            setReady(true)
        }
    }, [router])

    return { ready }
}

/**
 * Redirects to /dashboard if the user IS already authenticated (for login/register pages).
 * Returns { ready: true } once confirmed the user is NOT logged in.
 */
export function useGuestOnly() {
    const router = useRouter()
    const [ready, setReady] = useState(false)

    useEffect(() => {
        if (isLoggedIn()) {
            router.replace('/liveboard')
        } else {
            setReady(true)
        }
    }, [router])

    return { ready }
}
