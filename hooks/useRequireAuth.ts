'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthMe } from '@/lib/api'

export function useRequireAuth() {
    const router = useRouter()
    const [ready, setReady] = useState(false)

    useEffect(() => {
        getAuthMe()
            .then(() => setReady(true))
            .catch(() => router.replace('/auth/login'))
    }, [router])

    return { ready }
}


export function useGuestOnly() {
    const router = useRouter()
    const [ready, setReady] = useState(false)

    useEffect(() => {
        getAuthMe()
            .then(() => router.replace('/liveboard'))
            .catch(() => setReady(true))
    }, [router])

    return { ready }
}
