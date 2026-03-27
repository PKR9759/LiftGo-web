'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { getRide, getRideBookings, startRide, cancelRide, markPickedUp, markDropped, markNoShow, confirmBooking, cancelBooking, getRideStatusSummary } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { toast } from 'sonner'
import type { Ride, Booking } from '@/types'
import { format } from 'date-fns'
import { useDriverLocation } from '@/hooks/useDriverLocation'
import LiveMap from '@/components/map/LiveMap'
import { haversineDistance } from '@/lib/utils'

// Fix 7 — consistent badge colors
const bookingBadgeStyle: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
    pending: { variant: 'outline', className: 'border-yellow-400 text-yellow-700 bg-yellow-50' },
    confirmed: { variant: 'default', className: 'bg-blue-600' },
    rider_ready: { variant: 'default', className: 'bg-purple-600' },
    picked_up: { variant: 'default', className: 'bg-green-600' },
    completed: { variant: 'secondary' },
    cancelled: { variant: 'destructive' },
    no_show: { variant: 'outline', className: 'border-orange-400 text-orange-700 bg-orange-50' },
}

const rideBadgeStyle: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string; pulse?: boolean }> = {
    scheduled: { variant: 'default', className: 'bg-blue-600' },
    active: { variant: 'default', className: 'bg-green-600', pulse: true },
    full: { variant: 'outline', className: 'border-yellow-400 text-yellow-700 bg-yellow-50' },
    completed: { variant: 'secondary' },
    cancelled: { variant: 'destructive' },
}

type StatusSummary = {
    ride: {
        id: string; status: string; departure_at: string
        available_seats: number; total_seats: number
        minutes_until_departure: number
        can_cancel: boolean; can_start: boolean
        cancellation_deadline: string
    }
    user_booking: any
}

// Fix 6 — per-booking action buttons
function BookingManager({ booking, onUpdate, driverPos, rideStatus }: any) {
    const [actionLoading, setActionLoading] = useState(false)

    const handleAction = async (action: 'confirm' | 'decline' | 'pickup' | 'drop' | 'noshow') => {
        setActionLoading(true)
        try {
            if (action === 'confirm') {
                await confirmBooking(booking.id)
                toast.success(`Confirmed ${booking.rider_name}'s booking!`)
            } else if (action === 'decline') {
                await cancelBooking(booking.id)
                toast.success(`Declined ${booking.rider_name}'s booking.`)
            } else if (action === 'pickup') {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true, timeout: 10000, maximumAge: 0
                    })
                })
                await markPickedUp(booking.id, position.coords.latitude, position.coords.longitude)
                toast.success(`Picked up ${booking.rider_name}!`)
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
            setActionLoading(false)
        }
    }

    const distance = driverPos && booking.rider_ready_lat != null && booking.rider_ready_lng != null
        ? haversineDistance(driverPos, { lat: Number(booking.rider_ready_lat), lng: Number(booking.rider_ready_lng) })
        : null

    const bb = bookingBadgeStyle[booking.status] || { variant: 'secondary' as const }

    // Fix 6 — determine which action buttons to show based on booking + ride status
    const showConfirmDecline = booking.status === 'pending' && rideStatus === 'scheduled'
    const showPickupNoshow = ['confirmed', 'rider_ready'].includes(booking.status) && rideStatus === 'active'
    const showDropoff = booking.status === 'picked_up' && rideStatus === 'active'
    const isTerminal = ['completed', 'cancelled', 'no_show'].includes(booking.status)

    return (
        <div className="bg-white border rounded-xl p-4 flex flex-col gap-3">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-semibold">{booking.rider_name} <span className="text-slate-400 text-xs font-normal">({booking.seats} seats)</span></p>
                    <p className="text-xs text-slate-500 mt-1">From: {booking.origin_label}</p>
                    <p className="text-xs text-slate-500">To: {booking.dest_label}</p>
                    {!isTerminal && booking.status !== 'picked_up' && (
                        <span className="text-xs font-semibold mt-1 inline-block text-indigo-600">
                            {distance !== null
                                ? distance < 200 ? '✓ Within pickup range' : `${Math.round(distance)}m away`
                                : 'Location unavailable'}
                        </span>
                    )}
                </div>
                <Badge variant={bb.variant} className={bb.className}>
                    {booking.status.replace('_', ' ')}
                </Badge>
            </div>

            <div className="flex flex-wrap gap-2 mt-2">
                {showConfirmDecline && (
                    <>
                        <Button size="sm" onClick={() => handleAction('confirm')} disabled={actionLoading}>Confirm</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleAction('decline')} disabled={actionLoading}>Decline</Button>
                    </>
                )}
                {showPickupNoshow && (
                    <>
                        {booking.status === 'rider_ready' && (
                            <Button size="sm" onClick={() => handleAction('pickup')} disabled={actionLoading}>Pick Up</Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => handleAction('noshow')} disabled={actionLoading}>No Show</Button>
                    </>
                )}
                {showDropoff && (
                    <Button size="sm" onClick={() => handleAction('drop')} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white">Drop Off</Button>
                )}
            </div>
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
    const [summary, setSummary] = useState<StatusSummary | null>(null)
    const [countdown, setCountdown] = useState(0)

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

    const loadSummary = async () => {
        try {
            const res = await getRideStatusSummary(id)
            setSummary(res.data)
            setCountdown(0)
        } catch { /* ignore */ }
    }

    useEffect(() => {
        loadData()
        loadSummary()
        const interval = setInterval(() => { loadData(); loadSummary() }, 5000)
        return () => clearInterval(interval)
    }, [id])

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [])

    // Fix 9 — countdown
    useEffect(() => {
        const timer = setInterval(() => setCountdown(prev => prev + 1), 60000)
        return () => clearInterval(timer)
    }, [])

    const minutesUntilDeparture = summary ? summary.ride.minutes_until_departure - countdown : null
    const canCancel = summary?.ride.can_cancel ?? false
    const canStart = summary?.ride.can_start ?? false

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
            loadSummary()
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to start ride')
        } finally {
            setActionLoading(false)
        }
    }

    const handleCancelRide = async () => {
        setActionLoading(true)
        try {
            await cancelRide(id)
            toast.success('Ride cancelled')
            loadData()
            loadSummary()
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to cancel ride')
        } finally {
            setActionLoading(false)
        }
    }

    if (loading && !ride) return <div className="p-10 text-center animate-pulse">Loading manage portal...</div>
    if (!ride) return null

    const rb = rideBadgeStyle[ride.status] || { variant: 'secondary' as const }

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
                <Badge variant={rb.variant} className={`text-sm px-3 py-1 ${rb.className || ''} ${rb.pulse ? 'animate-pulse' : ''}`}>
                    {rb.pulse && <span className="w-1.5 h-1.5 rounded-full bg-white mr-1.5 inline-block" />}
                    {ride.status.toUpperCase()}
                </Badge>
            </div>

            {/* Fix 8 — seats display */}
            {summary && (
                <div className="bg-white border rounded-xl p-4">
                    <p className="text-sm text-slate-600">
                        {summary.ride.available_seats === 0
                            ? <span className="font-semibold text-red-600">Fully booked</span>
                            : <><span className="font-semibold">{summary.ride.available_seats}</span> of {summary.ride.total_seats} seats available</>
                        }
                    </p>
                </div>
            )}

            {/* Fix 6 — ride-level actions */}
            <div className="bg-white border rounded-xl p-5 shadow-sm flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                <div>
                    <p className="font-semibold">Departure: {format(new Date(ride.departure_at), 'hh:mm a')}</p>
                    <p className="text-xs text-slate-500">Date: {format(new Date(ride.departure_at), 'dd MMM yyyy')}</p>
                    {minutesUntilDeparture != null && minutesUntilDeparture > 0 && (
                        <p className="text-xs text-slate-400 mt-1">
                            {minutesUntilDeparture > 60
                                ? `${Math.floor(minutesUntilDeparture / 60)}h ${minutesUntilDeparture % 60}m until departure`
                                : `${minutesUntilDeparture} min until departure`}
                        </p>
                    )}
                </div>
                <div className="flex gap-2 flex-wrap">
                    {ride.status === 'scheduled' && (
                        <>
                            <div className="flex flex-col items-center gap-1">
                                <Button
                                    onClick={handleStartRide}
                                    disabled={actionLoading || !canStart}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    {actionLoading ? 'Starting...' : 'Start Ride'}
                                </Button>
                                {!canStart && minutesUntilDeparture != null && minutesUntilDeparture > 30 && (
                                    <p className="text-[10px] text-slate-400">Unlocks in {minutesUntilDeparture - 30} min</p>
                                )}
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <Button
                                    variant="destructive"
                                    onClick={handleCancelRide}
                                    disabled={actionLoading || !canCancel}
                                >
                                    Cancel Ride
                                </Button>
                                {!canCancel && (
                                    <p className="text-[10px] text-slate-400">Locked — too close to departure</p>
                                )}
                            </div>
                        </>
                    )}
                </div>
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
                        }))}
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
                            <BookingManager key={b.id} booking={b} onUpdate={() => { loadData(); loadSummary() }} driverPos={driverPos} rideStatus={ride.status} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
