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

// Cached token state shared across reconnects within the same session.
// Avoids rotating the refresh token on every reconnect attempt.
let cachedToken = ''
let tokenCachedAt = 0
const TOKEN_TTL_MS = 13 * 60 * 1000 // refresh if older than 13 min (access token is 15 min)

async function getFreshToken(): Promise<string> {
    const now = Date.now()
    if (cachedToken && now - tokenCachedAt < TOKEN_TTL_MS) {
        return cachedToken
    }
    try {
        const { refreshAuth } = await import('@/lib/api')
        const res = await refreshAuth()
        if (res?.data?.access_token) {
            cachedToken = res.data.access_token
            tokenCachedAt = Date.now()
            return cachedToken
        }
    } catch {
        // If refresh fails (e.g. session expired), clear cached token
        cachedToken = ''
        tokenCachedAt = 0
    }
    return ''
}

export function useRideTracking(bookingId: string, enabled: boolean, onStatusUpdate?: () => void) {
    const [driverLocation, setDriverLocation] = useState<LocationData | null>(null)
    const [isDriverOnline, setIsDriverOnline] = useState(false)
    const [messages, setMessages] = useState<ChatMessage[]>([])

    const retryCount = useRef(0)
    const fastFailCount = useRef(0)
    const ws = useRef<WebSocket | null>(null)
    // Use a ref for the timeout so cleanup always cancels the latest scheduled reconnect
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const sendMessage = (text: string) => {
        if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
            toast.error('Chat is disconnected. Reconnecting...')
            return
        }
        ws.current.send(JSON.stringify({ type: 'message', text }))
    }

    useEffect(() => {
        if (typeof window === 'undefined' || !enabled || !bookingId) {
            console.log(`[WS Rider] Not connecting. enabled: ${enabled}, bookingId: ${bookingId}`)
            return
        }

        console.log(`[WS Rider] Hook enabled for booking ${bookingId}. Preparing to connect...`)

        const connectAndListen = async () => {
            console.log(`[WS Rider] Fetching token for connection...`)
            const token = await getFreshToken()
            console.log(`[WS Rider] Token fetch result: ${token ? 'Success (token present)' : 'Failed or Empty'}`)

            const wsUrl = buildWebSocketUrl(`/ws/rider/${bookingId}`)
            const finalUrl = token ? `${wsUrl}?token=${token}` : wsUrl
            
            console.log(`[WS Rider] Attempting WebSocket connection to: ${wsUrl}`)
            const socket = new WebSocket(finalUrl)
            ws.current = socket

            const openedAt = Date.now()

            socket.onopen = () => {
                console.log(`[WS Rider] Connection successfully opened!`)
                retryCount.current = 0
                fastFailCount.current = 0
                setIsDriverOnline(true)
            }

            socket.onmessage = (event) => {
                try {
                    const raw = event.data?.trim()
                    if (!raw || !raw.startsWith('{')) return
                    const data = JSON.parse(raw)
                    if (data.type === 'message') {
                        setMessages(prev => [...prev, data as ChatMessage])
                    } else if (data.type === 'status_update') {
                        console.log(`[WS Rider] Received status_update broadcast`)
                        if (onStatusUpdate) onStatusUpdate()
                    } else if (data.lat && data.lng) {
                        setDriverLocation({
                            lat: data.lat,
                            lng: data.lng,
                            timestamp: data.timestamp
                        })
                    }
                } catch (err) {
                    console.warn('[WS Rider] message parse error:', err, 'raw:', event.data)
                }
            }

            socket.onclose = (event) => {
                setIsDriverOnline(false)
                const liveDuration = Date.now() - openedAt
                console.log(`[WS Rider] Connection closed. Code: ${event.code}, Reason: ${event.reason || 'None'}, Duration: ${liveDuration}ms, Clean: ${event.wasClean}`)

                // Fast-fail guard: if the socket dies within 2 seconds of opening
                // it means the server rejected the upgrade (401/403), not a network drop.
                if (liveDuration < 2000) {
                    fastFailCount.current += 1
                    console.warn(`[WS Rider] Fast-fail detected (${fastFailCount.current}/3). Server rejected connection quickly.`)
                    if (fastFailCount.current >= 3) {
                        console.error(`[WS Rider] Server is repeatedly rejecting connection (code ${event.code}). Giving up.`)
                        // Force-expire the cached token so next attempt gets a fresh one
                        cachedToken = ''
                        tokenCachedAt = 0
                        return
                    }
                }

                const backoff = Math.min(1000 * Math.pow(1.5, retryCount.current), 30000)
                retryCount.current += 1
                console.log(`[WS Rider] Scheduling reconnect in ${backoff}ms (Attempt ${retryCount.current})`)
                reconnectTimeoutRef.current = setTimeout(connectAndListen, backoff)
            }

            socket.onerror = (err) => {
                console.error('[WS Rider] WebSocket error object:', err)
                console.error('[WS Rider] Socket state during error:', {
                    readyState: socket.readyState,
                    url: socket.url
                })
            }
        }

        connectAndListen()

        return () => {
            console.log(`[WS Rider] Cleaning up effect. Disconnecting if connected.`)
            // Cancel any pending reconnect
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
                reconnectTimeoutRef.current = null
            }
            if (ws.current) {
                ws.current.onclose = null
                ws.current.onerror = null
                ws.current.close()
                ws.current = null
            }
        }
    }, [bookingId, enabled])

    return { driverLocation, isDriverOnline, messages, sendMessage }
}
