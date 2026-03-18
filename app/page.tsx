'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getNearbyRides, getNearbySeeks } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import type { Ride, Seek, LatLng } from '@/types'
import { format } from 'date-fns'

const MapPicker = dynamic(
  () => import('@/components/map/MapPicker'),
  { ssr: false, loading: () => <MapSkeleton height="420px" /> }
)

type Tab = 'rides' | 'seeks'

export default function HomePage() {
  const [rides,        setRides]        = useState<Ride[]>([])
  const [seeks,        setSeeks]        = useState<Seek[]>([])
  const [tab,          setTab]          = useState<Tab>('rides')
  const [loading,      setLoading]      = useState(false)
  const [searched,     setSearched]     = useState(false)
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null)
  const [selectedSeek, setSelectedSeek] = useState<Seek | null>(null)
  const [loggedIn,     setLoggedIn]     = useState(false)

  const searchRef = useRef<(o: LatLng, d: LatLng) => void>(null)

  useEffect(() => {
    setLoggedIn(isLoggedIn())
  }, [])

  const search = useCallback(async (o: LatLng, d: LatLng) => {
    setLoading(true)
    setSearched(true)
    try {
      const [ridesRes, seeksRes] = await Promise.all([
        getNearbyRides({
          origin_lat: o.lat, origin_lng: o.lng,
          dest_lat:   d.lat, dest_lng:   d.lng,
          radius: 3000,
        }),
        getNearbySeeks({
          origin_lat: o.lat, origin_lng: o.lng,
          dest_lat:   d.lat, dest_lng:   d.lng,
          radius: 3000,
        }),
      ])
      setRides(ridesRes.data)
      setSeeks(seeksRes.data)
    } catch {
      setRides([])
      setSeeks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    searchRef.current = search
  }, [search])

  const handleMapChange = useCallback((
    o: LatLng | null,
    d: LatLng | null
  ) => {
    setSelectedRide(null)
    setSelectedSeek(null)
    if (o && d) {
      searchRef.current?.(o, d)
    }
  }, [])

  const reset = () => {
    setRides([])
    setSeeks([])
    setSearched(false)
    setSelectedRide(null)
    setSelectedSeek(null)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">

      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Live ride board</h1>
          <p className="text-slate-500 text-sm mt-1">
            Click your origin then destination to find matches
          </p>
        </div>
        {loggedIn && (
          <div className="flex gap-2">
            <Link href="/rides/new">
              <Button size="sm">+ Offer ride</Button>
            </Link>
            <Link href="/seeks/new">
              <Button size="sm" variant="outline">+ Need ride</Button>
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* left — map always visible, never toggled */}
        <div className="lg:col-span-2">
          <MapPicker
            onChange={handleMapChange}
            height="420px"
          />
        </div>

        {/* right — results panel */}
        <div className="lg:col-span-1">
          {!searched ? (
            <div className="bg-white border rounded-xl p-6 text-center h-full
              flex flex-col items-center justify-center min-h-[200px]">
              <p className="text-slate-400 text-sm mb-4">
                Click two points on the map to find rides and seekers near your route
              </p>
              {!loggedIn && (
                <div className="space-y-2 w-full">
                  <Link href="/auth/register" className="block">
                    <Button className="w-full" size="sm">Sign up to post</Button>
                  </Link>
                  <Link href="/auth/login" className="block">
                    <Button variant="ghost" className="w-full" size="sm">Log in</Button>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border rounded-xl overflow-hidden">

              {/* tabs */}
              <div className="flex border-b">
                <button
                  onClick={() => { setTab('rides'); setSelectedRide(null) }}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    tab === 'rides'
                      ? 'text-slate-900 border-b-2 border-slate-900'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Rides ({rides.length})
                </button>
                <button
                  onClick={() => { setTab('seeks'); setSelectedSeek(null) }}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    tab === 'seeks'
                      ? 'text-slate-900 border-b-2 border-slate-900'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Seekers ({seeks.length})
                </button>
              </div>

              {/* search again button */}
              <div className="px-4 pt-3">
                <button
                  onClick={reset}
                  className="text-xs text-slate-400 hover:text-slate-600 underline"
                >
                  Click map to search a different route
                </button>
              </div>

              {/* loading */}
              {loading && (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className="h-3 bg-slate-100 rounded w-2/3 mb-2" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              )}

              {/* rides */}
              {!loading && tab === 'rides' && (
                <div className="divide-y max-h-[340px] overflow-y-auto">
                  {rides.length === 0 ? (
                    <EmptyResults
                      message="No rides near this route"
                      action={loggedIn
                        ? { label: 'Offer a ride', href: '/rides/new' }
                        : undefined
                      }
                    />
                  ) : (
                    rides.map(ride => (
                      <RideResult
                        key={ride.id}
                        ride={ride}
                        selected={selectedRide?.id === ride.id}
                        onClick={() => setSelectedRide(
                          selectedRide?.id === ride.id ? null : ride
                        )}
                        loggedIn={loggedIn}
                      />
                    ))
                  )}
                </div>
              )}

              {/* seeks */}
              {!loading && tab === 'seeks' && (
                <div className="divide-y max-h-[340px] overflow-y-auto">
                  {seeks.length === 0 ? (
                    <EmptyResults
                      message="No seekers near this route"
                      action={loggedIn
                        ? { label: 'Post your need', href: '/seeks/new' }
                        : undefined
                      }
                    />
                  ) : (
                    seeks.map(seek => (
                      <SeekResult
                        key={seek.id}
                        seek={seek}
                        selected={selectedSeek?.id === seek.id}
                        onClick={() => setSelectedSeek(
                          selectedSeek?.id === seek.id ? null : seek
                        )}
                      />
                    ))
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      {/* selected ride detail */}
      {selectedRide && (
        <div className="mt-4 bg-white border rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-semibold text-slate-900">
                  {selectedRide.origin_label} → {selectedRide.dest_label}
                </h2>
                <Badge variant={
                  selectedRide.status === 'active' ? 'default' : 'secondary'
                }>
                  {selectedRide.status}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-500 mb-3">
                <span>
                  {format(new Date(selectedRide.departure_at), 'dd MMM · hh:mm a')}
                </span>
                <span>·</span>
                <span>{selectedRide.available_seats} seats left</span>
                <span>·</span>
                <span className="font-medium text-slate-900">
                  ₹{selectedRide.price_per_seat}/seat
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center
                  justify-center text-xs font-medium">
                  {selectedRide.driver_name?.charAt(0).toUpperCase()}
                </div>
                <span>{selectedRide.driver_name}</span>
                <span className="text-yellow-400">★</span>
                <span>
                  {selectedRide.driver_avg_rating > 0
                    ? selectedRide.driver_avg_rating.toFixed(1)
                    : 'New'}
                </span>
              </div>
              {selectedRide.notes && (
                <p className="text-xs text-slate-400 mt-2 italic">
                  "{selectedRide.notes}"
                </p>
              )}
            </div>
            <div className="shrink-0 flex gap-2">
              {loggedIn ? (
                <Link href={`/rides/${selectedRide.id}`}>
                  <Button size="sm">Book seat</Button>
                </Link>
              ) : (
                <Link href="/auth/login">
                  <Button size="sm">Log in to book</Button>
                </Link>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedRide(null)}
              >
                ✕
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* selected seek detail */}
      {selectedSeek && (
        <div className="mt-4 bg-white border rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-semibold text-slate-900">
                  {selectedSeek.origin_label} → {selectedSeek.dest_label}
                </h2>
                <Badge variant="outline">{selectedSeek.status}</Badge>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-500 mb-3">
                <span>
                  Needs {selectedSeek.seats_needed} seat{selectedSeek.seats_needed !== 1 ? 's' : ''}
                </span>
                <span>·</span>
                <span>
                  Expires {format(new Date(selectedSeek.expires_at), 'hh:mm a')}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center
                  justify-center text-xs font-medium">
                  {selectedSeek.seeker_name?.charAt(0).toUpperCase()}
                </div>
                <span>{selectedSeek.seeker_name}</span>
                <span className="text-yellow-400">★</span>
                <span>
                  {selectedSeek.seeker_avg_rating > 0
                    ? selectedSeek.seeker_avg_rating.toFixed(1)
                    : 'New'}
                </span>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedSeek(null)}
            >
              ✕
            </Button>
          </div>
        </div>
      )}

    </div>
  )
}

function RideResult({ ride, selected, onClick, loggedIn }: {
  ride: Ride; selected: boolean; onClick: () => void; loggedIn: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer transition-colors ${
        selected ? 'bg-blue-50' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {ride.origin_label}
          </p>
          <p className="text-xs text-slate-400 mb-1">↓</p>
          <p className="text-sm font-medium text-slate-900 truncate">
            {ride.dest_label}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
            <span>{format(new Date(ride.departure_at), 'dd MMM · hh:mm a')}</span>
            <span>·</span>
            <span>{ride.available_seats} seats</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-semibold text-slate-900">₹{ride.price_per_seat}</p>
          <p className="text-xs text-slate-400">per seat</p>
          <div className="flex items-center gap-1 mt-1 justify-end">
            <span className="text-yellow-400 text-xs">★</span>
            <span className="text-xs text-slate-500">
              {ride.driver_avg_rating > 0
                ? ride.driver_avg_rating.toFixed(1)
                : 'New'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SeekResult({ seek, selected, onClick }: {
  seek: Seek; selected: boolean; onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer transition-colors ${
        selected ? 'bg-orange-50' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {seek.origin_label}
          </p>
          <p className="text-xs text-slate-400 mb-1">↓</p>
          <p className="text-sm font-medium text-slate-900 truncate">
            {seek.dest_label}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
            <span>
              Needs {seek.seats_needed} seat{seek.seats_needed !== 1 ? 's' : ''}
            </span>
            <span>·</span>
            <span>{seek.seeker_name}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1 justify-end">
            <span className="text-yellow-400 text-xs">★</span>
            <span className="text-xs text-slate-500">
              {seek.seeker_avg_rating > 0
                ? seek.seeker_avg_rating.toFixed(1)
                : 'New'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Expires {format(new Date(seek.expires_at), 'hh:mm a')}
          </p>
        </div>
      </div>
    </div>
  )
}

function EmptyResults({ message, action }: {
  message: string
  action?: { label: string; href: string }
}) {
  return (
    <div className="p-8 text-center">
      <p className="text-slate-400 text-sm mb-3">{message}</p>
      {action && (
        <Link href={action.href}>
          <Button variant="outline" size="sm">{action.label}</Button>
        </Link>
      )}
    </div>
  )
}

function MapSkeleton({ height }: { height: string }) {
  return (
    <div
      style={{ height }}
      className="rounded-xl border bg-slate-100 animate-pulse"
    />
  )
}