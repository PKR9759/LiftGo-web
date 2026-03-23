// components/ServiceWorkerRegister.tsx
'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {
                // sw.js doesn't exist yet — silently ignore until created
            })
        }
    }, [])

    return null
}
