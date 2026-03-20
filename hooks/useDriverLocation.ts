import { useEffect, useRef } from 'react'
import Cookies from 'js-cookie'
import { toast } from 'sonner'

export function useDriverLocation(bookingId: string, enabled: boolean) {
    const retryCount = useRef(0)
    const watchId = useRef<number | null>(null)
    const ws = useRef<WebSocket | null>(null)

    useEffect(() => {
        if (typeof window === 'undefined' || !enabled || !bookingId) return

        let reconnectTimeout: NodeJS.Timeout

        const connectAndTrack = () => {
            const token = Cookies.get('liftgo_token')
            if (!token) {
                toast.error('Authentication error, cannot share location')
                return
            }

            const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080'
            const socket = new WebSocket(`${wsUrl}/ws/driver/${bookingId}?token=${token}`)
            ws.current = socket

            socket.onopen = () => {
                retryCount.current = 0 // Reset on successful connection
                // Start watching GPS position
                if (!navigator.geolocation) {
                    toast.error('Geolocation is not supported by your browser')
                    return
                }

                watchId.current = navigator.geolocation.watchPosition(
                    (position) => {
                        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                            const payload = {
                                lat: position.coords.latitude,
                                lng: position.coords.longitude,
                            }
                            ws.current.send(JSON.stringify(payload))
                        }
                    },
                    (err) => {
                        console.error('Geolocation error:', err)
                        toast.error('Failed to get GPS location')
                    },
                    { enableHighAccuracy: true }
                )
            }

            socket.onclose = () => {
                if (watchId.current !== null) {
                    navigator.geolocation.clearWatch(watchId.current)
                    watchId.current = null
                }

                if (retryCount.current < 5) {
                    retryCount.current += 1
                    reconnectTimeout = setTimeout(connectAndTrack, 3000)
                } else {
                    toast.error('Location sharing disconnected. Please refresh.')
                }
            }

            socket.onerror = (err) => {
                console.error('WebSocket error:', err)
                toast.error('Location sharing failed')
                // onclose will be called after onerror naturally, triggering the reconnect loop
            }
        }

        connectAndTrack()

        return () => {
            clearTimeout(reconnectTimeout)
            if (watchId.current !== null) {
                navigator.geolocation.clearWatch(watchId.current)
                watchId.current = null
            }
            if (ws.current) {
                // Remove handlers so we don't reconnect on intentional cleanup
                ws.current.onclose = null
                ws.current.onerror = null
                ws.current.close()
                ws.current = null
            }
        }
    }, [bookingId, enabled])
}
