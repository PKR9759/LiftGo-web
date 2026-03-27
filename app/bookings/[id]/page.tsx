// app/bookings/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getBooking, createReview, cancelBooking, markRiderReady, getRideStatusSummary } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { toast } from 'sonner'
import { useDriverLocation } from '@/hooks/useDriverLocation'
import { useRideTracking } from '@/hooks/useRideTracking'
import LiveMap from '@/components/map/LiveMap'
import type { Booking } from '@/types'
import { format } from 'date-fns'

// Fix 7 — consistent booking badge colors
const bookingBadge: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  pending: { variant: 'outline', className: 'border-yellow-400 text-yellow-700 bg-yellow-50' },
  confirmed: { variant: 'default', className: 'bg-blue-600' },
  rider_ready: { variant: 'default', className: 'bg-purple-600' },
  picked_up: { variant: 'default', className: 'bg-green-600' },
  completed: { variant: 'secondary' },
  cancelled: { variant: 'destructive' },
  no_show: { variant: 'outline', className: 'border-orange-400 text-orange-700 bg-orange-50' },
}

const rideBadge: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string; pulse?: boolean }> = {
  scheduled: { variant: 'default', className: 'bg-blue-600' },
  active: { variant: 'default', className: 'bg-green-600', pulse: true },
  full: { variant: 'outline', className: 'border-yellow-400 text-yellow-700 bg-yellow-50' },
  completed: { variant: 'secondary' },
  cancelled: { variant: 'destructive' },
}

function ReviewStars({ rating, onChange }: { rating: number; onChange?: (r: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i} type="button" disabled={!onChange}
          onClick={() => onChange?.(i)}
          className={`text-2xl transition-transform ${onChange ? 'cursor-pointer hover:scale-110' : 'cursor-default'} ${i <= rating ? 'text-yellow-400' : 'text-slate-200'}`}
        >★</button>
      ))}
    </div>
  )
}

type StatusSummary = {
  ride: {
    id: string; status: string; departure_at: string
    available_seats: number; total_seats: number
    minutes_until_departure: number
    can_cancel: boolean; can_start: boolean
    cancellation_deadline: string
  }
  user_booking: {
    id: string; status: string; seats: number
    can_cancel: boolean; can_mark_ready: boolean
  } | null
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const currentUser = getUser()

  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [msgText, setMsgText] = useState('')
  const [summary, setSummary] = useState<StatusSummary | null>(null)
  const [countdown, setCountdown] = useState(0) // local countdown offset in minutes

  const load = async () => {
    try {
      const res = await getBooking(id)
      setBooking(res.data)
    } catch {
      toast.error('Booking not found')
    } finally {
      setLoading(false)
    }
  }

  const loadSummary = async (rideId: string) => {
    try {
      const res = await getRideStatusSummary(rideId)
      setSummary(res.data)
      setCountdown(0) // reset local offset on fresh fetch
    } catch { /* ignore */ }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [id])

  // Fetch status summary when we have booking.ride_id
  useEffect(() => {
    if (!booking?.ride_id) return
    loadSummary(booking.ride_id)
    const interval = setInterval(() => loadSummary(booking.ride_id), 10000)
    return () => clearInterval(interval)
  }, [booking?.ride_id])

  // Fix 9 — local countdown timer
  useEffect(() => {
    const timer = setInterval(() => setCountdown(prev => prev + 1), 60000) // every minute
    return () => clearInterval(timer)
  }, [])

  const minutesUntilDeparture = summary ? summary.ride.minutes_until_departure - countdown : null

  const isRider = currentUser?.id === booking?.rider_id
  const isDriver = currentUser?.id === booking?.driver_id
  const rideIsActive = booking?.ride_status === 'active'
  const canReview = booking?.status === 'completed'

  // Computed from status summary
  const canCancel = summary?.user_booking?.can_cancel ?? false
  const canMarkReady = summary?.user_booking?.can_mark_ready ?? false
  const bookingIsCancellable = booking && ['pending', 'confirmed'].includes(booking.status)

  const isTrackingSupported = ['confirmed', 'rider_ready', 'picked_up'].includes(booking?.status || '')
  useDriverLocation(String(id), !!(isDriver && isTrackingSupported), load)
  const { driverLocation, isDriverOnline, messages: chatMessages, sendMessage } = useRideTracking(String(id), !!(isRider && isTrackingSupported), load)

  const handleReview = async () => {
    if (!booking) return
    setSubmitting(true)
    const revieweeID = currentUser?.id === booking.rider_id ? booking.driver_id : booking.rider_id
    try {
      await createReview({ booking_id: id, reviewee_id: revieweeID, rating, comment })
      setReviewed(true)
      toast.success('Review submitted!')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendChat = () => {
    if (!msgText.trim()) return
    sendMessage(msgText)
    setMsgText('')
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 rounded w-1/2" />
          <div className="h-48 bg-slate-100 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!booking) return null

  const departure = new Date(booking.departure_at)
  const bb = bookingBadge[booking.status] || { variant: 'secondary' as const }
  const rb = rideBadge[booking.ride_status || ''] || { variant: 'secondary' as const }

  const timelineSteps = [
    { label: 'Confirmed', active: ['confirmed', 'rider_ready', 'picked_up', 'completed'].includes(booking.status) },
    { label: 'Ready at Pickup', active: ['rider_ready', 'picked_up', 'completed'].includes(booking.status) },
    { label: 'Picked Up', active: ['picked_up', 'completed'].includes(booking.status) },
    { label: 'Drop Off', active: booking.status === 'completed' }
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">

      {/* header */}
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Booking details</h1>
            <Badge variant={bb.variant} className={bb.className}>
              {booking.status.replace('_', ' ')}
            </Badge>
            {booking.ride_status && (
              <Badge variant={rb.variant} className={`${rb.className || ''} ${rb.pulse ? 'animate-pulse' : ''}`}>
                {rb.pulse && <span className="w-1.5 h-1.5 rounded-full bg-white mr-1.5 inline-block" />}
                Ride: {booking.ride_status}
              </Badge>
            )}
          </div>
          {isDriver && (
            <Button variant="outline" size="sm" onClick={() => router.push(`/rides/${booking.ride_id}/manage`)}>Manage Ride</Button>
          )}
        </div>
        <p className="text-slate-500 text-sm">
          Booked on {format(new Date(booking.created_at), 'dd MMM yyyy')}
        </p>
      </div>

      {/* progress timeline */}
      {['confirmed', 'rider_ready', 'picked_up'].includes(booking.status) && (
        <div className="bg-white border rounded-xl p-5">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center justify-between w-full">
              {timelineSteps.map((step, idx) => (
                <div key={idx} className="flex flex-col items-center flex-1">
                  <div className={`w-4 h-4 rounded-full mb-1 ${step.active ? 'bg-blue-600' : 'bg-slate-200'}`} />
                  <span className={`text-[10px] sm:text-xs text-center ${step.active ? 'text-blue-700 font-medium' : 'text-slate-400'}`}>{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* route */}
      <div className="bg-white border rounded-xl p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Route</h2>
        <div className="flex gap-3">
          <div className="flex flex-col items-center gap-1 pt-1">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <div className="w-0.5 h-8 bg-slate-200" />
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          </div>
          <div className="space-y-4">
            <p className="font-medium text-slate-900 text-sm">{booking.origin_label}</p>
            <p className="font-medium text-slate-900 text-sm">{booking.dest_label}</p>
          </div>
        </div>
      </div>

      {/* trip info */}
      <div className="bg-white border rounded-xl p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Trip info</h2>
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <span className="text-slate-500">Date</span>
          <span className="font-medium text-slate-900">{format(departure, 'dd MMM yyyy')}</span>
          <span className="text-slate-500">Time</span>
          <span className="font-medium text-slate-900">{format(departure, 'hh:mm a')}</span>
          <span className="text-slate-500">Seats</span>
          <span className="font-medium text-slate-900">{booking.seats}</span>
          <span className="text-slate-500">Total</span>
          <span className="font-medium text-slate-900">₹{booking.total_price}</span>
          <span className="text-slate-500">{isRider ? 'Driver' : 'Rider'}</span>
          <span className="font-medium text-slate-900">{isRider ? booking.driver_name : booking.rider_name}</span>
        </div>
      </div>

      {/* ── Fix 6: action buttons driven by status summary ── */}
      {(bookingIsCancellable || (isRider && booking.status === 'confirmed')) && (
        <div className="bg-white border rounded-xl p-5 flex flex-col gap-3">

          {/* Rider: I'm at pickup (visible only when confirmed + can_mark_ready) */}
          {isRider && booking.status === 'confirmed' && (
            <Button
              disabled={actionLoading || !canMarkReady}
              onClick={async () => {
                setActionLoading(true)
                try {
                  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                      enableHighAccuracy: true, timeout: 10000, maximumAge: 0,
                    })
                  })
                  await markRiderReady(id, position.coords.latitude, position.coords.longitude)
                  const res = await getBooking(id)
                  setBooking(res.data)
                  toast.success("Driver notified you're ready!")
                } catch (err: any) {
                  if (err?.code === 1) {
                    await markRiderReady(id)
                    const res = await getBooking(id)
                    setBooking(res.data)
                    toast.success("Marked as ready — location unavailable")
                  } else {
                    toast.error(err?.response?.data?.error || 'Failed to mark ready. Try again.')
                  }
                } finally {
                  setActionLoading(false)
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 w-full"
            >
              {!canMarkReady && minutesUntilDeparture != null
                ? `Available in ${Math.max(0, minutesUntilDeparture - 15)} min`
                : actionLoading ? 'Marking ready...' : "I'm at the pickup point"}
            </Button>
          )}

          {/* Cancel booking — shown disabled with reason when can_cancel is false */}
          {bookingIsCancellable && (
            <div className="flex flex-col gap-1">
              <Button
                variant="destructive"
                disabled={actionLoading || !canCancel}
                onClick={async () => {
                  setActionLoading(true)
                  try {
                    await cancelBooking(id)
                    toast.success('Booking cancelled')
                    router.push('/dashboard')
                  } catch (err: any) {
                    toast.error(err.response?.data?.error || 'Failed to cancel')
                  } finally {
                    setActionLoading(false)
                  }
                }}
              >
                {actionLoading ? 'Cancelling...' : 'Cancel Booking'}
              </Button>
              {!canCancel && (
                <p className="text-xs text-slate-400 text-center">
                  Not available — less than 1 hour before departure
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* review */}
      {canReview && (
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold text-slate-900 mb-1">Leave a review</h2>
          <p className="text-slate-500 text-sm mb-4">
            Rate your experience with {isRider ? booking.driver_name : booking.rider_name}
          </p>
          {reviewed ? (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <p className="text-green-700 text-sm">Review submitted — thank you!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-sm mb-2 block">Rating</Label>
                <ReviewStars rating={rating} onChange={setRating} />
              </div>
              <div>
                <Label className="text-sm mb-1 block">
                  Comment <span className="text-slate-400 font-normal">(optional)</span>
                </Label>
                <Textarea
                  placeholder="How was the ride?"
                  rows={3} className="resize-none"
                  value={comment} onChange={e => setComment(e.target.value)}
                />
              </div>
              <Button onClick={handleReview} disabled={submitting} className="w-full">
                {submitting ? 'Submitting...' : 'Submit review'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── live tracking & chat ── */}
      {rideIsActive && (isRider || isDriver) ? (
        <div className="bg-white border rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-semibold text-slate-900">
              {isDriver ? 'Your location is being shared' : 'Live Tracking'}
            </h2>
            {isRider && isDriverOnline && <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Live</Badge>}
          </div>

          {isRider && (
            <>
              <LiveMap driverLocation={driverLocation} isDriverOnline={isDriverOnline} />

              <div className="mt-6 border-t pt-4">
                <h3 className="font-medium text-sm text-slate-700 mb-3">Quick Chat with Driver</h3>
                <div className="bg-slate-50 rounded-lg py-3 border mb-3 flex flex-col gap-2">
                  <div className="flex gap-2 overflow-x-auto pb-2 px-3 scrollbar-hide">
                    {["Where are you?", "I'm at the exact pin", "Look for a person in a red shirt", "Okay, thanks!"].map((text) => (
                      <button
                        key={text} onClick={() => sendMessage(text)}
                        className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-full hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all whitespace-nowrap"
                      >{text}</button>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 p-3 h-48 overflow-y-auto bg-slate-50 border rounded-xl mx-3">
                    {chatMessages.length === 0 && (
                      <p className="text-xs text-center text-slate-400 py-4">No messages yet. Use quick replies above to communicate.</p>
                    )}
                    {chatMessages.map((msg: any, index: number) => {
                      const isMine = msg.from === 'rider'
                      return (
                        <div key={index} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] px-3 py-2 text-sm ${isMine ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm' : 'bg-slate-200 text-slate-900 rounded-2xl rounded-bl-sm'}`}>
                            {msg.text}
                            <span className={`text-[10px] block mt-0.5 ${isMine ? 'text-blue-200 text-right' : 'text-slate-500'}`}>
                              {isMine ? 'You' : 'Driver'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex gap-2 px-3">
                    <Input value={msgText} onChange={e => setMsgText(e.target.value)} placeholder="Message driver..." onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat() }} className="h-9 text-sm" />
                    <Button size="sm" className="h-9" onClick={handleSendChat}>Send</Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ) : booking.status === 'confirmed' && booking.ride_status !== 'completed' ? (
        <div className="bg-white border rounded-xl p-5">
          <p className="text-slate-400 text-sm">
            Live tracking will appear once the ride starts.
          </p>
        </div>
      ) : null}

    </div>
  )
}