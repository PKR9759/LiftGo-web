import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { buildWebSocketUrl } from '@/lib/realtime'

interface LocationData {
    lat: number
    lng: number
    timestamp: number
}

interface ChatMessage {
    type: string
    text: string
    from: string
}

export function useRideTracking(bookingId: string, enabled: boolean, onStatusUpdate?: () => void) {
    const [driverLocation, setDriverLocation] = useState<LocationData | null>(null)
    const [isDriverOnline, setIsDriverOnline] = useState(false)
    const [messages, setMessages] = useState<ChatMessage[]>([])

    const retryCount = useRef(0)
    const ws = useRef<WebSocket | null>(null)

    const sendMessage = (text: string) => {
        if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
            toast.error('Chat is disconnected. Reconnecting...')
            return
        }
        ws.current.send(JSON.stringify({ type: 'message', text }))
    }

    useEffect(() => {
        if (typeof window === 'undefined' || !enabled || !bookingId) return

        let reconnectTimeout: NodeJS.Timeout

        const connectAndListen = () => {
            const socket = new WebSocket(buildWebSocketUrl(`/ws/rider/${bookingId}`))
            ws.current = socket

            socket.onopen = () => {
                retryCount.current = 0
                setIsDriverOnline(true)
            }

            socket.onmessage = (event) => {
                try {
                    // Guard against empty or non-JSON frames
                    const raw = event.data?.trim()
                    if (!raw || !raw.startsWith('{')) return
                    const data = JSON.parse(raw)
                    if (data.type === 'message') {
                        setMessages(prev => [...prev, data as ChatMessage])
                    } else if (data.type === 'status_update') {
                        if (onStatusUpdate) onStatusUpdate()
                    } else if (data.lat && data.lng) {
                        setDriverLocation({
                            lat: data.lat,
                            lng: data.lng,
                            timestamp: data.timestamp
                        })
                    }
                } catch (err) {
                    console.warn('WS message parse error:', err, 'raw:', event.data)
                }
            }

            socket.onclose = () => {
                setIsDriverOnline(false)
                if (retryCount.current < 5) {
                    retryCount.current += 1
                    reconnectTimeout = setTimeout(connectAndListen, 3000)
                } else {
                    toast.error('Could not restore connection to driver.')
                }
            }

            socket.onerror = (err) => {
                console.error('WebSocket error:', {
                    readyState: socket.readyState,
                    url: socket.url,
                    error: err,
                })
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

    return { driverLocation, isDriverOnline, messages, sendMessage }
}
