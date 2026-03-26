'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { getRide, getRideBookings, startRide, markPickedUp, markDropped, markNoShow } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { toast } from 'sonner'
import type { Ride, Booking } from '@/types'
import { format } from 'date-fns'
import { useDriverLocation } from '@/hooks/useDriverLocation'
import LiveMap from '@/components/map/LiveMap'

import { haversineDistance } from '@/lib/utils'

// A sub-component to handle actions per booking
function BookingManager({ booking, onUpdate, driverPos, rideStatus }: any) {
    const [chatOpen, setChatOpen] = useState(false)
    const [msgText, setMsgText] = useState('')
    const [actionLoading, setActionLoading] = useState(false)

    // Look for confirmed bookings to start chat early
    const isActiveTracker = ['confirmed', 'rider_ready', 'picked_up'].includes(booking.status)

    const { messages: chatMessages, sendMessage } = useDriverLocation(
        String(booking.id),
        isActiveTracker,
        onUpdate
    )

    const handleAction = async (action: 'pickup' | 'drop' | 'noshow') => {
        setActionLoading(true)
        try {
            if (action === 'pickup') {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0 // never use cached position
                    })
                })

                const { latitude, longitude } = position.coords
                await markPickedUp(booking.id, latitude, longitude)
                toast.success(`Picked up ${booking.rider_name}!`)
                onUpdate()
                return
            } else if (action === 'drop') {
                await markDropped(booking.id)
                toast.success(`Dropped ${booking.rider_name}!`)
            } else if (action === 'noshow') {
                await markNoShow(booking.id)
                toast.success(`Marked ${booking.rider_name} as No-Show.`)
            }
            onUpdate()
        } catch (err: any) {
            if (action === 'pickup') {
                if (err?.response?.status === 400) {
                    toast.error(err.response.data?.error || 'Too far from pickup point')
                } else if (err?.code === 1) {
                    toast.error('Location access denied. Enable location to pick up riders.')
                } else if (err?.code === 3) {
                    toast.error('Could not get your location. Check GPS signal and try again.')
                } else {
                    toast.error('Something went wrong. Please try again.')
                }
            } else {
                toast.error(err.response?.data?.error || 'Action failed')
            }
        } finally {
            if (action !== 'pickup') setActionLoading(false)
            else setActionLoading(false)
        }
    }

    const handleSend = () => {
        if (!msgText.trim()) return
        sendMessage(msgText)
        setMsgText('')
    }

    const quickMessages = ["I'm on my way", "I'm 2 minutes away", "I've arrived at pickup", "Please come to the main road", "Stuck in traffic"]

    const distance = driverPos && booking.origin_lat != null && booking.origin_lng != null
        ? haversineDistance(
            driverPos,
            { lat: Number(booking.origin_lat), lng: Number(booking.origin_lng) }
        )
        : null

    return (
        <div className="bg-white border rounded-xl p-4 flex flex-col gap-3">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-semibold">{booking.rider_name} <span className="text-slate-400 text-xs font-normal">({booking.seats} seats)</span></p>
                    <p className="text-xs text-slate-500 mt-1">From: {booking.origin_label}</p>
                    <p className="text-xs text-slate-500">To: {booking.dest_label}</p>
                    {booking.status !== 'picked_up' && (
                        <span className="text-xs font-semibold mt-1 inline-block text-indigo-600">
                            {distance !== null
                                ? distance < 200
                                    ? '✓ Within pickup range'
                                    : `${Math.round(distance)}m away`
                                : 'Location unavailable'
                            }
                        </span>
                    )}
                </div>
                <Badge variant={booking.status === 'completed' ? 'secondary' : booking.status === 'cancelled' || booking.status === 'no_show' ? 'destructive' : 'default'}>
                    {booking.status}
                </Badge>
            </div>

            <div className="flex flex-wrap gap-2 mt-2">
                {booking.status === 'rider_ready' && (
                    <Button size="sm" onClick={() => handleAction('pickup')} disabled={actionLoading}>Pick Up</Button>
                )}
                {booking.status === 'picked_up' && (
                    <Button size="sm" onClick={() => handleAction('drop')} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white">Drop Off</Button>
                )}
                {['confirmed', 'rider_ready'].includes(booking.status) && (
                    <Button size="sm" variant="destructive" onClick={() => handleAction('noshow')} disabled={actionLoading}>No Show</Button>
                )}
                {isActiveTracker && (
                    <Button size="sm" variant="outline" onClick={() => setChatOpen(!chatOpen)}>Chat {chatMessages.length > 0 && `(${chatMessages.length})`}</Button>
                )}
            </div>

            {chatOpen && (
                <div className="bg-slate-50 border border-slate-200 mt-2 py-3 rounded flex flex-col gap-2">
                    <div className="flex gap-2 overflow-x-auto pb-2 px-3 scrollbar-hide">
                        {quickMessages.map((text) => (
                            <button
                                key={text}
                                onClick={() => sendMessage(text)}
                                className="
                                    flex-shrink-0 px-3 py-1.5 text-xs font-medium
                                    bg-white border border-slate-200 rounded-full
                                    hover:bg-slate-50 hover:border-slate-300
                                    active:scale-95 transition-all whitespace-nowrap
                                "
                            >
                                {text}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col gap-2 p-3 h-48 overflow-y-auto bg-slate-50 border rounded-xl mx-3">
                        {chatMessages.length === 0 && (
                            <p className="text-xs text-center text-muted-foreground py-4">
                                No messages yet. Use quick replies above to communicate.
                            </p>
                        )}
                        {chatMessages.map((msg: any, index: number) => {
                            const isMine = msg.from === 'driver'
                            return (
                                <div
                                    key={index}
                                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`
                                            max-w-[75%] px-3 py-2 text-sm
                                            ${isMine
                                                ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm'
                                                : 'bg-slate-200 text-slate-900 rounded-2xl rounded-bl-sm'
                                            }
                                        `}
                                    >
                                        {msg.text}
                                        <span className={`
                                            text-[10px] block mt-0.5
                                            ${isMine ? 'text-blue-200 text-right' : 'text-slate-500'}
                                        `}>
                                            {isMine ? 'Driver' : 'Rider'}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <div className="flex gap-2 px-3">
                        <Input value={msgText} onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }} onChange={e => setMsgText(e.target.value)} placeholder="Message rider..." className="h-8 text-sm" />
                        <Button size="sm" onClick={handleSend}>Send</Button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function ManageRidePage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const currentUser = getUser()

    const [ride, setRide] = useState<Ride | null>(null)
    const [bookings, setBookings] = useState<Booking[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [lastUpdated, setLastUpdated] = useState<number | null>(null)
    const [currentTime, setCurrentTime] = useState<number>(Date.now())

    const loadData = async () => {
        try {
            const [rideRes, bookingsRes] = await Promise.all([
                getRide(id),
                getRideBookings(id)
            ])
            if (rideRes.data.driver_id !== currentUser?.id) {
                toast.error('Unauthorized')
                router.push('/')
                return
            }
            setRide(rideRes.data)
            setBookings(bookingsRes.data)
            setLastUpdated(Date.now())
        } catch {
            toast.error('Failed to load ride data')
        } finally {
            setLoading(false)
        }
    }

    // Polling effect
    useEffect(() => {
        loadData()
        const interval = setInterval(() => {
            loadData()
        }, 5000)
        return () => clearInterval(interval)
    }, [id])

    // UI timer
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        if (ride?.status === 'active') {
            navigator.permissions?.query({ name: 'geolocation' }).then(result => {
                if (result.state === 'denied') {
                    toast.error('Location access is blocked. Enable it in browser settings to share your location.')
                }
            })
        }
    }, [ride?.status])


    const [driverPos, setDriverPos] = useState<{ lat: number, lng: number, timestamp: number } | null>(null)
    useEffect(() => {
        if (ride?.status !== 'active') return
        const watchId = navigator.geolocation.watchPosition(
            pos => setDriverPos({ lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: pos.timestamp }),
            err => console.warn('GPS watch error:', err),
            { enableHighAccuracy: true, maximumAge: 10000 }
        )
        return () => navigator.geolocation.clearWatch(watchId)
    }, [ride?.status])

    const handleStartRide = async () => {
        setActionLoading(true)
        try {
            await startRide(id)
            toast.success('Ride started! Live tracking enabled.')
            loadData()
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to start ride')
        } finally {
            setActionLoading(false)
        }
    }

    if (loading && !ride) return <div className="p-10 text-center animate-pulse">Loading manage portal...</div>
    if (!ride) return null

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Manage Ride</h1>
                    <p className="text-sm text-slate-500 mt-1">{ride.origin_label} → {ride.dest_label}</p>
                    {lastUpdated && (
                        <p className="text-xs text-slate-400 mt-1">
                            Last updated {Math.floor((currentTime - lastUpdated) / 1000)}s ago
                        </p>
                    )}
                </div>
                <Badge variant={ride.status === 'active' ? 'default' : 'secondary'} className="text-sm px-3 py-1">
                    {ride.status.toUpperCase()}
                </Badge>
            </div>

            <div className="bg-white border rounded-xl p-5 shadow-sm flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                <div>
                    <p className="font-semibold">Departure: {format(new Date(ride.departure_at), 'hh:mm a')}</p>
                    <p className="text-xs text-slate-500">Date: {format(new Date(ride.departure_at), 'dd MMM yyyy')}</p>
                </div>
                {ride.status === 'scheduled' && (
                    <Button onClick={handleStartRide} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700">
                        {actionLoading ? 'Starting...' : 'Start Ride'}
                    </Button>
                )}
            </div>

            {ride.status === 'active' && driverPos && (
                <LiveMap
                    driverLocation={driverPos}
                    isDriverOnline={true}
                    riderMarkers={bookings
                        ?.filter(b => b.rider_ready_lat && b.rider_ready_lng)
                        .map(b => ({
                            bookingId: String(b.id),
                            lat: Number(b.rider_ready_lat),
                            lng: Number(b.rider_ready_lng),
                            name: b.rider_name,
                            status: b.status,
                        }))
                    }
                />
            )}

            <div>
                <h2 className="text-lg font-bold text-slate-800 mb-3">Bookings ({bookings.length})</h2>
                {bookings.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 bg-slate-50 border border-dashed rounded-xl">
                        No riders have booked this ride yet.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {bookings.map(b => (
                            <BookingManager key={b.id} booking={b} onUpdate={loadData} driverPos={driverPos} rideStatus={ride.status} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
