import { useEffect, useRef, useState } from 'react'
import Cookies from 'js-cookie'
import { toast } from 'sonner'

interface ChatMessage {
    type: string
    text: string
    from: string
}

export function useDriverLocation(bookingId: string, enabled: boolean, onStatusUpdate?: () => void) {
    const retryCount = useRef(0)
    const watchId = useRef<number | null>(null)
    const ws = useRef<WebSocket | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])

    const sendMessage = (text: string) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'message', text }))
        }
    }

    useEffect(() => {
        if (typeof window === 'undefined' || !enabled || !bookingId) return

        let reconnectTimeout: NodeJS.Timeout

        const connectAndTrack = () => {
            const token = Cookies.get('liftgo_token')
            if (!token) {
                toast.error('Authentication error, cannot share location')
                return
            }

            const host = window.location.hostname
            const defaultWsUrl = host === 'localhost' ? 'ws://localhost:8080' : `ws://${host}:8080`
            const wsUrl = process.env.NEXT_PUBLIC_WS_URL || defaultWsUrl
            const socket = new WebSocket(`${wsUrl}/ws/driver/${bookingId}?token=${token}`)
            ws.current = socket

            socket.onopen = () => {
                retryCount.current = 0 // Reset on successful connection
                // Start watching GPS position
                if (!window.isSecureContext) {
                    toast.error('Live Location requires a Secure Context (HTTPS or localhost). Testing via LAN IP will block GPS.')
                    return
                }
                if (!navigator.geolocation) {
                    toast.error('Geolocation is not supported by your browser')
                    return
                }

                watchId.current = navigator.geolocation.watchPosition(
                    (position) => {
                        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                            const payload = {
                                type: 'location',
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

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    if (data.type === 'message') {
                        setMessages((prev: ChatMessage[]) => [...prev, data as ChatMessage])
                    } else if (data.type === 'status_update') {
                        if (onStatusUpdate) onStatusUpdate()
                    }
                } catch (err) {
                    console.error('Failed to parse chat message:', err)
                }
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

    return { messages, sendMessage }
}
