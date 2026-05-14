import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { buildWebSocketUrl } from '@/lib/realtime'

interface ChatMessage {
    type: string
    text: string
    from: string
}

// Shared token cache — avoids rotating the refresh token on every reconnect attempt.
// Token rotation means the 2nd refresh call within 13 minutes will use the already-rotated
// (now revoked) refresh token and get 401, leaving the hook without auth.
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
        cachedToken = ''
        tokenCachedAt = 0
    }
    return ''
}

export function useDriverLocation(
    bookingId: string, 
    enabled: boolean, 
    onStatusUpdate?: () => void,
    externalDriverPos?: { lat: number, lng: number } | null
) {
    const retryCount = useRef(0)
    const fastFailCount = useRef(0)
    const watchId = useRef<number | null>(null)
    const ws = useRef<WebSocket | null>(null)
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])

    // Watch external GPS updates and push them if active
    useEffect(() => {
        if (externalDriverPos && ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: 'location',
                lat: externalDriverPos.lat,
                lng: externalDriverPos.lng,
            }))
        }
    }, [externalDriverPos])

    const sendMessage = (text: string) => {
        if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
            toast.error('Chat is disconnected. Reconnecting...')
            return
        }
        ws.current.send(JSON.stringify({ type: 'message', text }))
    }

    useEffect(() => {
        if (typeof window === 'undefined' || !enabled || !bookingId) {
            console.log(`[WS Driver] Not connecting. enabled: ${enabled}, bookingId: ${bookingId}`)
            return
        }

        console.log(`[WS Driver] Hook enabled for booking ${bookingId}. Preparing to connect...`)

        const connectAndTrack = async () => {
            console.log(`[WS Driver] Fetching token for connection...`)
            const token = await getFreshToken()
            console.log(`[WS Driver] Token fetch result: ${token ? 'Success (token present)' : 'Failed or Empty'}`)

            const wsUrl = buildWebSocketUrl(`/ws/driver/${bookingId}`)
            const finalUrl = token ? `${wsUrl}?token=${token}` : wsUrl
            
            console.log(`[WS Driver] Attempting WebSocket connection to: ${wsUrl}`)
            const socket = new WebSocket(finalUrl)
            ws.current = socket

            const openedAt = Date.now()

            socket.onopen = () => {
                console.log(`[WS Driver] Connection successfully opened!`)
                retryCount.current = 0
                fastFailCount.current = 0

                // If parent manages GPS externally, skip internal watcher
                if (externalDriverPos !== undefined) {
                    console.log(`[WS Driver] Using external GPS source. Skipping internal watchPosition.`)
                    return
                }

                if (!window.isSecureContext) {
                    toast.error('Live Location requires a Secure Context (HTTPS or localhost). Testing via LAN IP will block GPS.')
                    return
                }
                if (!navigator.geolocation) {
                    toast.error('Geolocation is not supported by your browser')
                    return
                }

                console.log(`[WS Driver] Requesting geolocation watchPosition...`)
                watchId.current = navigator.geolocation.watchPosition(
                    (position) => {
                        console.log(`[WS Driver] GPS update received. Sending to server...`)
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
                        console.error('[WS Driver] Geolocation error:', err)
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
                        console.log(`[WS Driver] Received status_update broadcast`)
                        if (onStatusUpdate) onStatusUpdate()
                    }
                } catch (err) {
                    console.error('[WS Driver] Failed to parse chat message:', err)
                }
            }

            socket.onclose = (event) => {
                if (watchId.current !== null) {
                    navigator.geolocation.clearWatch(watchId.current)
                    watchId.current = null
                }

                const liveDuration = Date.now() - openedAt
                console.log(`[WS Driver] Connection closed. Code: ${event.code}, Reason: ${event.reason || 'None'}, Duration: ${liveDuration}ms, Clean: ${event.wasClean}`)

                // Fast-fail guard: server rejection (401/403), not a network drop
                if (liveDuration < 2000) {
                    fastFailCount.current += 1
                    console.warn(`[WS Driver] Fast-fail detected (${fastFailCount.current}/3). Server rejected connection quickly.`)
                    if (fastFailCount.current >= 3) {
                        console.error(`[WS Driver] Server is repeatedly rejecting connection (code ${event.code}). Giving up.`)
                        cachedToken = ''
                        tokenCachedAt = 0
                        return
                    }
                }

                const backoff = Math.min(1000 * Math.pow(1.5, retryCount.current), 30000)
                retryCount.current += 1
                console.log(`[WS Driver] Scheduling reconnect in ${backoff}ms (Attempt ${retryCount.current})`)
                reconnectTimeoutRef.current = setTimeout(connectAndTrack, backoff)
            }

            socket.onerror = (err) => {
                console.error('[WS Driver] WebSocket error object:', err)
                console.error('[WS Driver] Socket state during error:', {
                    readyState: socket.readyState,
                    url: socket.url
                })
            }
        }

        connectAndTrack()

        return () => {
            console.log(`[WS Driver] Cleaning up effect. Disconnecting if connected.`)
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
                reconnectTimeoutRef.current = null
            }
            if (watchId.current !== null) {
                navigator.geolocation.clearWatch(watchId.current)
                watchId.current = null
            }
            if (ws.current) {
                ws.current.onclose = null
                ws.current.onerror = null
                ws.current.close()
                ws.current = null
            }
        }
    }, [bookingId, enabled])

    return { messages, sendMessage }
}
