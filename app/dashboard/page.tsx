// app/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  getMyRides, getMySeeks,
  getMyBookings, getIncomingBookings,
  confirmBooking, cancelBooking,
  cancelRide, cancelSeek,
} from '@/lib/api'
import { getUser } from '@/lib/auth'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { toast } from 'sonner'
import type { Ride, Seek, Booking } from '@/types'
import { format } from 'date-fns'
import { Bell, X } from 'lucide-react'

const MapView = dynamic(
  () => import('@/components/map/MapView'),
  { ssr: false }
)

type Tab = 'my-rides' | 'my-seeks' | 'incoming' | 'my-bookings'

const statusColor: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  // Booking statuses
  pending: { variant: 'outline', className: 'border-yellow-400 text-yellow-700 bg-yellow-50' },
  confirmed: { variant: 'default', className: 'bg-blue-600' },
  rider_ready: { variant: 'default', className: 'bg-purple-600' },
  picked_up: { variant: 'default', className: 'bg-green-600 text-white' },
  no_show: { variant: 'outline', className: 'border-orange-400 text-orange-700 bg-orange-50' },

  // Generic / Shared statuses
  cancelled: { variant: 'destructive' },
  completed: { variant: 'secondary' },

  // Ride statuses
  scheduled: { variant: 'default', className: 'bg-blue-600' },
  active: { variant: 'default', className: 'bg-green-600 text-white' },
  full: { variant: 'outline', className: 'border-yellow-400 text-yellow-700 bg-yellow-50' },

  // Seek statuses
  matched: { variant: 'secondary' },
  expired: { variant: 'destructive' },
}

export default function DashboardPage() {
  const { ready } = useRequireAuth()
  const { permission, isSubscribed, isLoading, subscribe } = usePushNotifications()
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState<Tab>('my-rides')
  const [myRides, setMyRides] = useState<Ride[]>([])
  const [mySeeks, setMySeeks] = useState<Seek[]>([])
  const [incoming, setIncoming] = useState<Booking[]>([])
  const [myBookings, setMyBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setUser(getUser())
    const load = async () => {
      setLoading(true)
      try {
        const [ridesRes, seeksRes, incomingRes, bookingsRes] = await Promise.all([
          getMyRides(),
          getMySeeks(),
          getIncomingBookings(),
          getMyBookings(),
        ])
        console.log("Current User:", user?.id, user?.email)
        console.log("Rides:", ridesRes.data)
        console.log(seeksRes.data)
        console.log(incomingRes.data)
        console.log(bookingsRes.data)
        setMyRides(ridesRes.data)
        setMySeeks(seeksRes.data)
        setIncoming(incomingRes.data)
        setMyBookings(bookingsRes.data)
      } catch {
        toast.error('Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleConfirm = async (id: string) => {
    try {
      await confirmBooking(id)
      setIncoming(prev =>
        prev.map(b => b.id === id ? { ...b, status: 'confirmed' as const } : b)
      )
      toast.success('Booking confirmed')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to confirm')
    }
  }

  const handleCancelBooking = async (id: string) => {
    try {
      await cancelBooking(id)
      setMyBookings(prev =>
        prev.map(b => b.id === id ? { ...b, status: 'cancelled' as const } : b)
      )
      setIncoming(prev =>
        prev.map(b => b.id === id ? { ...b, status: 'cancelled' as const } : b)
      )
      toast.success('Booking cancelled')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to cancel')
    }
  }

  const handleCancelRide = async (id: string) => {
    try {
      await cancelRide(id)
      setMyRides(prev =>
        prev.map(r => r.id === id ? { ...r, status: 'cancelled' as const } : r)
      )
      toast.success('Ride cancelled')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to cancel ride')
    }
  }

  const handleCancelSeek = async (id: string) => {
    try {
      await cancelSeek(id)
      setMySeeks(prev =>
        prev.map(s => s.id === id ? { ...s, status: 'cancelled' as const } : s)
      )
      toast.success('Seek cancelled')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to cancel seek')
    }
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'my-rides', label: 'My rides', count: myRides.length },
    { key: 'my-seeks', label: 'My seeks', count: mySeeks.filter(s => s.status === 'active').length },
    { key: 'incoming', label: 'Incoming', count: incoming.filter(b => b.status === 'pending').length },
    { key: 'my-bookings', label: 'My bookings', count: myBookings.length },
  ]

  if (!ready) return null

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">

      {/* push notification banner (HIDDEN) */}
      {/* 
      {!bannerDismissed && permission === 'default' && !isSubscribed && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 mb-6">
          <Bell className="h-5 w-5 text-indigo-500 shrink-0" />
          <p className="text-sm text-indigo-800 flex-1">
            Enable notifications to get instant booking alerts
          </p>
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
            onClick={subscribe}
            disabled={isLoading}
          >
            {isLoading ? 'Enabling…' : 'Enable'}
          </Button>
          <button
            onClick={() => setBannerDismissed(true)}
            className="text-indigo-400 hover:text-indigo-600 shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {permission === 'denied' && (
        <p className="text-xs text-muted-foreground mb-6">
          Notifications are blocked. To enable: in Chrome go to Settings →
          Notifications, in Brave click the shield icon in the address bar.
        </p>
      )}
      */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          {user && (
            <p className="text-slate-500 text-sm mt-1">Welcome back, {user.name}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href="/rides/new">
            <Button size="sm">+ Offer ride</Button>
          </Link>
          <Link href="/seeks/new">
            <Button size="sm" variant="outline">+ Need ride</Button>
          </Link>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
              whitespace-nowrap transition-colors
              ${tab === t.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
              }
            `}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`
                text-xs rounded-full px-1.5 py-0.5 font-medium
                ${tab === t.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-300 text-slate-600'
                }
              `}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-white border rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/3 mb-3" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* ── my rides ── */}
      {!loading && tab === 'my-rides' && (
        <div className="space-y-4">
          {myRides.length === 0 ? (
            <Empty message="No rides posted yet" action={{ label: 'Offer a ride', href: '/rides/new' }} />
          ) : (
            myRides.map(ride => (
              <div key={ride.id} className="bg-white border rounded-xl overflow-hidden">
                <div className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-slate-900 break-words">
                          {ride.origin_label} → {ride.dest_label}
                        </p>
                        <Badge
                          variant={statusColor[ride.status]?.variant || 'secondary'}
                          className={statusColor[ride.status]?.className}
                        >
                          {ride.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-500">
                        {format(new Date(ride.departure_at), 'dd MMM yyyy · hh:mm a')}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        {ride.available_seats}/{ride.total_seats} seats · ₹{ride.price_per_seat}/seat
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Link href={`/rides/${ride.id}/manage`}>
                        <Button variant="default" size="sm">Manage</Button>
                      </Link>
                      <Link href={`/rides/${ride.id}`}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                      {['scheduled', 'active'].includes(ride.status) && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleCancelRide(ride.id)}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                  <MapView
                    rides={[ride]}
                    height="160px"
                    centerLat={ride.origin_lat}
                    centerLng={ride.origin_lng}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── my seeks ── */}
      {!loading && tab === 'my-seeks' && (
        <div className="space-y-4">
          {mySeeks.length === 0 ? (
            <Empty message="No seeks posted yet" action={{ label: 'Post a seek', href: '/seeks/new' }} />
          ) : (
            mySeeks.map(seek => (
              <div key={seek.id} className="bg-white border rounded-xl p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-slate-900">
                        {seek.origin_label} → {seek.dest_label}
                      </p>
                      <Badge
                        variant={statusColor[seek.status]?.variant || 'secondary'}
                        className={statusColor[seek.status]?.className}
                      >
                        {seek.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500">
                      {seek.seats_needed} seat{seek.seats_needed !== 1 ? 's' : ''} needed
                    </p>
                    {seek.status === 'active' && (
                      <p className="text-xs text-slate-400 mt-1">
                        Expires {format(new Date(seek.expires_at), 'hh:mm a')}
                      </p>
                    )}
                    {seek.is_recurring && (
                      <p className="text-xs text-slate-400 mt-1">Recurring</p>
                    )}
                  </div>
                  {seek.status === 'active' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleCancelSeek(seek.id)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── incoming bookings ── */}
      {!loading && tab === 'incoming' && (
        <div className="space-y-4">
          {incoming.length === 0 ? (
            <Empty message="No bookings on your rides yet" />
          ) : (
            incoming.map(b => (
              <div key={b.id} className="bg-white border rounded-xl p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-slate-900">
                        {b.origin_label} → {b.dest_label}
                      </p>
                      <Badge
                        variant={statusColor[b.status]?.variant || 'secondary'}
                        className={statusColor[b.status]?.className}
                      >
                        {b.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500">
                      Rider: {b.rider_name} · {b.seats} seat{b.seats !== 1 ? 's' : ''} · ₹{b.total_price}
                    </p>
                    <p className="text-sm text-slate-500">
                      {format(new Date(b.departure_at), 'dd MMM yyyy · hh:mm a')}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {b.status === 'pending' && (
                      <Button size="sm" onClick={() => handleConfirm(b.id)}>
                        Confirm
                      </Button>
                    )}
                    {['pending', 'confirmed'].includes(b.status) && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleCancelBooking(b.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── my bookings ── */}
      {!loading && tab === 'my-bookings' && (
        <div className="space-y-4">
          {myBookings.length === 0 ? (
            <Empty message="No bookings yet" action={{ label: 'Find a ride', href: '/' }} />
          ) : (
            myBookings.map(b => (
              <div key={b.id} className="bg-white border rounded-xl p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-slate-900">
                        {b.origin_label} → {b.dest_label}
                      </p>
                      <Badge
                        variant={statusColor[b.status]?.variant || 'secondary'}
                        className={statusColor[b.status]?.className}
                      >
                        {b.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500">
                      Driver: {b.driver_name} · {b.seats} seat{b.seats !== 1 ? 's' : ''} · ₹{b.total_price}
                    </p>
                    <p className="text-sm text-slate-500">
                      {format(new Date(b.departure_at), 'dd MMM yyyy · hh:mm a')}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Link href={`/bookings/${b.id}`}>
                      <Button variant="outline" size="sm">View</Button>
                    </Link>
                    {['pending', 'confirmed'].includes(b.status) && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleCancelBooking(b.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  )
}

function Empty({
  message,
  action,
}: {
  message: string
  action?: { label: string; href: string }
}) {
  return (
    <div className="text-center py-16">
      <p className="text-slate-400 mb-4">{message}</p>
      {action && (
        <Link href={action.href}>
          <Button variant="outline">{action.label}</Button>
        </Link>
      )}
    </div>
  )
}