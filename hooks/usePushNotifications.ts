// hooks/usePushNotifications.ts
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import axios from 'axios'
import { getToken } from '@/lib/auth'

type PermissionState = 'default' | 'granted' | 'denied'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

export function usePushNotifications() {
    const [permission, setPermission] = useState<PermissionState>('default')
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (typeof window === 'undefined' || !('Notification' in window)) return

        setPermission(Notification.permission as PermissionState)

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready
                .then((reg) => reg.pushManager.getSubscription())
                .then((sub) => {
                    if (sub) setIsSubscribed(true)
                })
                .catch(() => {
                    // SW not yet active (sw.js not created yet) — silently ignore
                })
        }
    }, [])

    const subscribe = async () => {
        if (typeof window === 'undefined' || !('Notification' in window)) return

        setIsLoading(true)
        try {
            const result = await Notification.requestPermission()
            setPermission(result as PermissionState)

            if (result === 'denied') {
                toast.error('Notifications blocked. You can enable them in browser settings.')
                return
            }

            if (result !== 'granted') return

            if (!('serviceWorker' in navigator)) {
                toast.error('Push notifications not supported in this browser.')
                return
            }

            const registration = await navigator.serviceWorker.ready

            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
            if (!vapidKey) {
                console.error('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set')
                return
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
            })

            const subJSON = subscription.toJSON()
            const endpoint = subJSON.endpoint!
            const p256dh = subJSON.keys?.p256dh!
            const auth = subJSON.keys?.auth!

            const token = getToken()
            await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}/api/push/subscribe`,
                { endpoint, p256dh, auth },
                { headers: { Authorization: `Bearer ${token}` } }
            )

            setIsSubscribed(true)
            toast.success('Notifications enabled!')
        } catch (err) {
            console.error('Push subscription failed:', err)
            toast.error('Failed to enable notifications.')
        } finally {
            setIsLoading(false)
        }
    }

    return { permission, isSubscribed, isLoading, subscribe }
}
