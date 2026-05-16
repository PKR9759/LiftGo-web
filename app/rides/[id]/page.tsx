// app/rides/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getRide, createBooking, getRideStatusSummary } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { extractErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'
import type { Ride } from '@/types'
import { format } from 'date-fns'

const MapView = dynamic(
  () => import('@/components/map/MapView'),
  {
    ssr: false, loading: () => (
      <div className="h-64 rounded-xl border bg-slate-100 animate-pulse" />
    )
  }
)

const rideBadgeStyle: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string; pulse?: boolean }> = {
  scheduled: { variant: 'default', className: 'bg-blue-600' },
  active: { variant: 'default', className: 'bg-green-600', pulse: true },
  full: { variant: 'outline', className: 'border-yellow-400 text-yellow-700 bg-yellow-50' },
  completed: { variant: 'secondary' },
  cancelled: { variant: 'destructive' },
}

export default function RideDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [ride, setRide] = useState<Ride | null>(null)
  const [loading, setLoading] = useState(true)
  const [seats, setSeats] = useState(1)
  const [booking, setBooking] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const [pickupLat, setPickupLat] = useState('')
  const [pickupLng, setPickupLng] = useState('')
  const [pickupLabel, setPickupLabel] = useState('Your pickup location')
  const [useCurrentLocation, setUseCurrentLocation] = useState(false)
  const [dropoffLat, setDropoffLat] = useState('')
  const [dropoffLng, setDropoffLng] = useState('')
  const [dropoffLabel, setDropoffLabel] = useState('Your dropoff location')
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  const currentUser = getUser()
  const loggedIn = !!currentUser
  const searchParams = useSearchParams()

  // Read segment price directly from query params passed by liveboard
  const segmentPriceParam = searchParams.get('segment_price')
  const segmentPrice = segmentPriceParam ? Number(segmentPriceParam) : null

  const load = async () => {
    try {
      const pLatParam = searchParams.get('pickup_lat')
      const pLngParam = searchParams.get('pickup_lng')
      const dLatParam = searchParams.get('dropoff_lat')
      const dLngParam = searchParams.get('dropoff_lng')

      const res = await getRide(id)

      setRide(res.data)
      const pickupLabelParam = searchParams.get('pickup_label')
      const dropoffLabelParam = searchParams.get('dropoff_label')

      setPickupLat(pLatParam ?? String(res.data.origin_lat))
      setPickupLng(pLngParam ?? String(res.data.origin_lng))
      setPickupLabel(pickupLabelParam ?? res.data.origin_label)
      setDropoffLat(dLatParam ?? String(res.data.dest_lat))
      setDropoffLng(dLngParam ?? String(res.data.dest_lng))
      setDropoffLabel(dropoffLabelParam ?? res.data.dest_label)

      if (loggedIn) {
        try {
          const sRes = await getRideStatusSummary(id)
          setSummary(sRes.data)
        } catch (sErr: any) {
          console.error('Failed to load ride status summary:', sErr)
          // Don't redirect, just don't show the summary
        }
      }
    } catch (err: any) {
      console.error('Failed to load ride:', err)
      toast.error('Ride not found')
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id, loggedIn])

  const isDriver = currentUser?.id === ride?.driver_id
  const hasBooking = !!summary?.user_booking

  const handleBook = async () => {
    if (!loggedIn) { router.push('/auth/login'); return }
    if (!ride) return
    if (!Number.isInteger(seats) || seats < 1) {
      toast.error('Please enter a valid seat count')
      return
    }
    if (!segmentPrice && seats > ride.available_seats) {
      toast.error(`Only ${ride.available_seats} seat(s) are available`)
      return
    }

    const pLat = Number(pickupLat)
    const pLng = Number(pickupLng)
    const dLat = Number(dropoffLat)
    const dLng = Number(dropoffLng)
    if (!Number.isFinite(pLat) || !Number.isFinite(pLng) || !Number.isFinite(dLat) || !Number.isFinite(dLng)) {
      toast.error('Pickup and dropoff coordinates are required')
      return
    }

    setBooking(true)
    try {
      const res = await createBooking({
        idempotency_key: idempotencyKey,
        ride_id: id,
        seats,
        pickup_lat: pLat,
        pickup_lng: pLng,
        pickup_label: pickupLabel,
        dropoff_lat: dLat,
        dropoff_lng: dLng,
        dropoff_label: dropoffLabel,
      })
      router.push(`/bookings/${res.data.id}`)
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Booking failed'))
    } finally {
      setBooking(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 rounded w-1/2" />
          <div className="h-64 bg-slate-100 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!ride) return null

  const departure = new Date(ride.departure_at)
  const rb = rideBadgeStyle[ride.status] || { variant: 'secondary' as const }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">

      {/* header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 wrap-break-word">
            {segmentPrice && segmentPrice < ride.price_per_seat
              ? `${pickupLabel.split(',')[0]} → ${dropoffLabel.split(',')[0]}`
              : `${ride.origin_label.split(',')[0]} → ${ride.dest_label.split(',')[0]}`
            }
          </h1>
          <Badge variant={rb.variant} className={`${rb.className || ''} ${rb.pulse ? 'animate-pulse' : ''}`}>
            {rb.pulse && <span className="w-1.5 h-1.5 rounded-full bg-white mr-1.5 inline-block" />}
            {ride.status}
          </Badge>
        </div>
        <p className="text-slate-500 text-sm">
          {format(departure, 'EEEE, dd MMMM yyyy')} at {format(departure, 'hh:mm a')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

        {/* main */}
        <div className="sm:col-span-2 space-y-4">

          {/* map */}
          <MapView
            rides={[ride]}
            height="260px"
            centerLat={ride.origin_lat}
            centerLng={ride.origin_lng}
          />

          {/* driver */}
          <div className="bg-white border rounded-xl p-5">
            <h2 className="font-semibold text-slate-900 mb-3">Driver</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100
                  flex items-center justify-center font-medium text-slate-600">
                  {ride.driver_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-slate-900">{ride.driver_name}</p>
                  <p className="text-xs text-slate-400">
                    {ride.driver_total_reviews} review{ride.driver_total_reviews !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-yellow-400">★</span>
                <span className="font-medium text-slate-900">
                  {ride.driver_avg_rating > 0
                    ? ride.driver_avg_rating.toFixed(1)
                    : 'New'}
                </span>
              </div>
            </div>
          </div>

          {/* notes */}
          {ride.notes && (
            <div className="bg-white border rounded-xl p-5">
              <h2 className="font-semibold text-slate-900 mb-2">Notes</h2>
              <p className="text-slate-500 text-sm">{ride.notes}</p>
            </div>
          )}

          {/* recurring */}
          {ride.is_recurring && ride.recurrence_days && ride.recurrence_days.length > 0 && (
            <div className="bg-white border rounded-xl p-5">
              <h2 className="font-semibold text-slate-900 mb-2">Recurring</h2>
              <div className="flex gap-2 flex-wrap">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                  .filter((_, i) => ride.recurrence_days?.includes(i))
                  .map(day => (
                    <span key={day}
                      className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                      {day}
                    </span>
                  ))
                }
              </div>
            </div>
          )}

        </div>

        {/* booking panel */}
        <div className="sm:col-span-1">
          <div className="bg-white border rounded-xl p-5 sticky top-24">

            <p className="text-2xl font-bold text-slate-900 mb-1">
              ₹{segmentPrice ?? ride.price_per_seat}
            </p>
            <p className="text-xs text-slate-400 mb-4">
              {segmentPrice && segmentPrice < ride.price_per_seat
                ? 'estimated segment fare'
                : 'per seat'}
            </p>

            <div className="space-y-1 mb-4">
              <p className="text-sm text-slate-600 font-medium">
                {ride.available_seats === 0 && ride.status === 'full' && !segmentPrice
                  ? <span className="text-red-600">Fully booked</span>
                  : ride.available_seats === 0 && ride.status === 'full'
                  ? <span className="text-amber-600">Seats may be available on your segment</span>
                  : `${ride.available_seats} of ${ride.total_seats} seats available`
                }
              </p>
            </div>

            {hasBooking ? (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800 leading-relaxed">
                  You already have a booking for this ride.
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/bookings/${summary.user_booking.id}`)}
                >
                  View your booking
                </Button>
              </div>
            ) : isDriver ? (
              <p className="text-xs text-slate-400 text-center py-2 bg-slate-50 rounded-lg border border-dashed">
                This is your ride
              </p>
            ) : !['scheduled', 'active', 'full'].includes(ride.status) ? (
              <p className="text-xs text-slate-400 text-center italic">
                This ride is {ride.status}
              </p>
            ) : (
              <>
                <div className="mb-3">
                  <Label className="text-xs text-slate-500 mb-1 block">
                    Seats to book
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={ride.available_seats}
                    disabled={ride.available_seats === 0 && !segmentPrice}
                    value={seats}
                    onChange={e => {
                      const raw = e.target.value
                      if (raw === '') {
                        setSeats(1)
                        return
                      }
                      const parsed = Number(raw)
                      if (!Number.isFinite(parsed)) {
                        setSeats(1)
                        return
                      }
                      const normalized = Math.min(
                        Math.max(Math.floor(parsed), 1),
                        Math.max(ride.available_seats, 1)
                      )
                      setSeats(normalized)
                    }}
                  />
                </div>

                {/* Pickup & Dropoff labels (read-only on ride details) */}
                <div className="mb-3">
                  <Label className="text-xs text-slate-500 mb-1 block">Pickup</Label>
                  <div className="border rounded-lg p-3 bg-slate-50">
                    <p className="text-sm font-medium text-slate-900">
                      {pickupLabel || ride.origin_label}
                    </p>
                  </div>
                </div>

                <div className="mb-3">
                  <Label className="text-xs text-slate-500 mb-1 block">Dropoff</Label>
                  <div className="border rounded-lg p-3 bg-slate-50">
                    <p className="text-sm font-medium text-slate-900">
                      {dropoffLabel || ride.dest_label}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm mb-4">
                  <span className="text-slate-500">Total</span>
                  <span className="font-semibold text-lg">
                    ₹{((segmentPrice ?? ride.price_per_seat) * seats).toFixed(2).replace(/\.00$/, '')}
                  </span>
                </div>
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={handleBook}
                  disabled={booking || seats < 1 || (!segmentPrice && seats > ride.available_seats) || (ride.available_seats === 0 && !segmentPrice) || !pickupLat || !pickupLng || !dropoffLat || !dropoffLng}
                >
                  {booking ? 'Booking...' : loggedIn ? 'Request seat' : 'Log in to book'}
                </Button>
              </>
            )}

          </div>
        </div>

      </div>
    </div>
  )
}