// app/bookings/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { getBooking, createReview } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { toast } from 'sonner'
import type { Booking } from '@/types'
import { format } from 'date-fns'

const statusColor: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending:   'outline',
  confirmed: 'default',
  cancelled: 'destructive',
  completed: 'secondary',
}

function ReviewStars({
  rating,
  onChange,
}: {
  rating: number
  onChange?: (r: number) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(i)}
          className={`text-2xl transition-transform ${
            onChange ? 'cursor-pointer hover:scale-110' : 'cursor-default'
          } ${i <= rating ? 'text-yellow-400' : 'text-slate-200'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export default function BookingDetailPage() {
  const { id }      = useParams<{ id: string }>()
  const currentUser = getUser()

  const [booking,    setBooking]    = useState<Booking | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [rating,     setRating]     = useState(5)
  const [comment,    setComment]    = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reviewed,   setReviewed]   = useState(false)

  useEffect(() => {
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
    load()
  }, [id])

  const handleReview = async () => {
    if (!booking) return
    setSubmitting(true)

    const revieweeID = currentUser?.id === booking.rider_id
      ? booking.driver_id
      : booking.rider_id

    try {
      await createReview({
        booking_id:  id,
        reviewee_id: revieweeID,
        rating,
        comment,
      })
      setReviewed(true)
      toast.success('Review submitted!')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
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

  const isRider       = currentUser?.id === booking.rider_id
  const canReview     = ['confirmed', 'completed'].includes(booking.status)
  const departure     = new Date(booking.departure_at)

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">

      {/* header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-slate-900">Booking details</h1>
          <Badge variant={statusColor[booking.status]}>
            {booking.status}
          </Badge>
        </div>
        <p className="text-slate-500 text-sm">
          Booked on {format(new Date(booking.created_at), 'dd MMM yyyy')}
        </p>
      </div>

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
          <span className="font-medium text-slate-900">
            {format(departure, 'dd MMM yyyy')}
          </span>

          <span className="text-slate-500">Time</span>
          <span className="font-medium text-slate-900">
            {format(departure, 'hh:mm a')}
          </span>

          <span className="text-slate-500">Seats</span>
          <span className="font-medium text-slate-900">{booking.seats}</span>

          <span className="text-slate-500">Total</span>
          <span className="font-medium text-slate-900">₹{booking.total_price}</span>

          <span className="text-slate-500">
            {isRider ? 'Driver' : 'Rider'}
          </span>
          <span className="font-medium text-slate-900">
            {isRider ? booking.driver_name : booking.rider_name}
          </span>
        </div>
      </div>

      {/* review */}
      {canReview && (
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold text-slate-900 mb-1">Leave a review</h2>
          <p className="text-slate-500 text-sm mb-4">
            Rate your experience with{' '}
            {isRider ? booking.driver_name : booking.rider_name}
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
                  Comment{' '}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </Label>
                <Textarea
                  placeholder="How was the ride?"
                  rows={3}
                  className="resize-none"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                />
              </div>
              <Button
                onClick={handleReview}
                disabled={submitting}
                className="w-full"
              >
                {submitting ? 'Submitting...' : 'Submit review'}
              </Button>
            </div>
          )}
        </div>
      )}

    </div>
  )
}