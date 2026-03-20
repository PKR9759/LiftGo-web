import { useState, useEffect, useRef } from 'react'
import Cookies from 'js-cookie'
import { toast } from 'sonner'

interface LocationData {
    lat: number
    lng: number
    timestamp: number
}

export function useRideTracking(bookingId: string, enabled: boolean) {
    const [driverLocation, setDriverLocation] = useState<LocationData | null>(null)
    const [isDriverOnline, setIsDriverOnline] = useState(false)

    const retryCount = useRef(0)
    const ws = useRef<WebSocket | null>(null)

    useEffect(() => {
        if (typeof window === 'undefined' || !enabled || !bookingId) return

        let reconnectTimeout: NodeJS.Timeout

        const connectAndListen = () => {
            const token = Cookies.get('liftgo_token')
            if (!token) {
                toast.error('Authentication error, cannot connect to tracking')
                return
            }

            const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080'
            const socket = new WebSocket(`${wsUrl}/ws/rider/${bookingId}?token=${token}`)
            ws.current = socket

            socket.onopen = () => {
                retryCount.current = 0
                setIsDriverOnline(true)
            }

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data) as LocationData
                    setDriverLocation({
                        lat: data.lat,
                        lng: data.lng,
                        timestamp: data.timestamp
                    })
                } catch (err) {
                    console.error('Failed to parse location data:', err)
                }
            }

            socket.onclose = () => {
                setIsDriverOnline(false)
                if (retryCount.current < 5) {
                    retryCount.current += 1
                    toast.error('Driver connection lost, attempting reconnect...')
                    reconnectTimeout = setTimeout(connectAndListen, 3000)
                } else {
                    toast.error('Could not restore connection to driver.')
                }
            }

            socket.onerror = (err) => {
                console.error('WebSocket error:', err)
                toast.error('Connection error with tracking server')
            }
        }

        connectAndListen()

        return () => {
            clearTimeout(reconnectTimeout)
            if (ws.current) {
                // Prevent onclose handling during deliberate unmounts
                ws.current.onclose = null
                ws.current.onerror = null
                ws.current.close()
                ws.current = null
            }
        }
    }, [bookingId, enabled])

    return { driverLocation, isDriverOnline }
}
