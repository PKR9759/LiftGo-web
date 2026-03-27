'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getNearbyRides, getNearbySeeks } from '@/lib/api'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import type { Ride, Seek, LatLng } from '@/types'
import { format } from 'date-fns'

const MapPicker = dynamic(
  () => import('@/components/map/MapPicker'),
  { ssr: false, loading: () => <MapSkeleton height="420px" /> }
)

type Tab = 'rides' | 'seeks'

export default function HomePage() {
  const { ready } = useRequireAuth()

  const [rides, setRides] = useState<Ride[]>([])
  const [seeks, setSeeks] = useState<Seek[]>([])
  const [tab, setTab] = useState<Tab>('rides')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null)
  const [selectedSeek, setSelectedSeek] = useState<Seek | null>(null)

  const searchRef = useRef<(o: LatLng, d: LatLng) => void>(null)

  const [sortBy, setSortBy] = useState<'soonest' | 'price' | 'seats'>('soonest')
  const [maxPrice, setMaxPrice] = useState<number | ''>('')
  const [minSeats, setMinSeats] = useState<number | ''>('')

  const filterAndSort = <T extends { created_at: string }>(items: T[]) => {
    let result = [...items]

    if (maxPrice !== '') {
      result = result.filter(i => {
        const price = (i as any).price_per_seat
        return price === undefined || price <= (maxPrice as number)
      })
    }
    if (minSeats !== '') {
      result = result.filter(i => {
        const seats = (i as any).available_seats || (i as any).seats_needed || 0
        return seats >= (minSeats as number)
      })
    }

    return result.sort((a, b) => {
      if (sortBy === 'price') {
        const pa = (a as any).price_per_seat || 0
        const pb = (b as any).price_per_seat || 0
        return pa - pb
      }
      if (sortBy === 'seats') {
        const sa = (a as any).available_seats || (a as any).seats_needed || 0
        const sb = (b as any).available_seats || (b as any).seats_needed || 0
        return sb - sa
      }
      const ta = new Date((a as any).departure_at || (a as any).expires_at || a.created_at).getTime()
      const tb = new Date((b as any).departure_at || (b as any).expires_at || b.created_at).getTime()
      return ta - tb
    })
  }

  const search = useCallback(async (o: LatLng, d: LatLng) => {
    setLoading(true)
    setSearched(true)
    try {
      const [ridesRes, seeksRes] = await Promise.all([
        getNearbyRides({
          origin_lat: o.lat, origin_lng: o.lng,
          dest_lat: d.lat, dest_lng: d.lng,
          radius: 5000,
        }),
        getNearbySeeks({
          origin_lat: o.lat, origin_lng: o.lng,
          dest_lat: d.lat, dest_lng: d.lng,
          radius: 5000,
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

  const clearSearch = () => {
    setRides([])
    setSeeks([])
    setSearched(false)
    setSelectedRide(null)
    setSelectedSeek(null)
    clearFilters()
  }

  const clearFilters = () => {
    setMaxPrice('')
    setMinSeats('')
    setSortBy('soonest')
  }

  if (!ready) return null

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">

      {/* header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Live ride board</h1>
          <p className="text-slate-500 text-sm mt-1">
            Click your origin then destination to find matches
          </p>
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
            </div>
          ) : (
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
              {/* tabs */}
              <div className="flex border-b">
                <button
                  onClick={() => { setTab('rides'); setSelectedRide(null) }}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === 'rides'
                    ? 'text-slate-900 border-b-2 border-slate-900 bg-slate-50'
                    : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                  Rides ({rides.length})
                </button>
                <button
                  onClick={() => { setTab('seeks'); setSelectedSeek(null) }}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === 'seeks'
                    ? 'text-slate-900 border-b-2 border-slate-900 bg-slate-50'
                    : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                  Seekers ({seeks.length})
                </button>
              </div>

              {/* filter bar */}
              <div className="px-4 py-3 flex flex-wrap gap-2 items-center justify-between border-b bg-white">
                <button
                  onClick={clearFilters}
                  className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                >
                  Reset
                </button>
                <div className="flex gap-1.5">
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    className="text-[11px] border rounded px-1.5 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-slate-300"
                  >
                    <option value="soonest">Soonest</option>
                    <option value="price">Cheapest</option>
                    <option value="seats">Seats</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Max ₹"
                    value={maxPrice}
                    onChange={e => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
                    className="text-[11px] border rounded px-1.5 py-1 w-14 bg-transparent focus:outline-none focus:ring-1 focus:ring-slate-300"
                  />
                  <select
                    value={minSeats}
                    onChange={e => setMinSeats(e.target.value ? Number(e.target.value) : '')}
                    className="text-[11px] border rounded px-1.5 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-slate-300"
                  >
                    <option value="">Seats</option>
                    {[1, 2, 3, 4].map(n => (
                      <option key={n} value={n}>{n}+</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* results list */}
              <div className="max-h-[380px] overflow-y-auto">
                {loading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse">
                        <div className="h-3 bg-slate-100 rounded w-2/3 mb-2" />
                        <div className="h-3 bg-slate-100 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : tab === 'rides' ? (
                  <div className="divide-y text-slate-900">
                    {filterAndSort(rides).length === 0 ? (
                      <EmptyResults
                        message={searched && (maxPrice || minSeats) ? "No rides match filters" : "No rides near this route"}
                        action={!maxPrice && !minSeats ? { label: 'Offer a ride', href: '/rides/new' } : undefined}
                      />
                    ) : (
                      (filterAndSort(rides) as Ride[]).map(ride => (
                        <RideResult
                          key={ride.id}
                          ride={ride}
                          selected={selectedRide?.id === ride.id}
                          onClick={() => setSelectedRide(
                            selectedRide?.id === ride.id ? null : ride
                          )}
                        />
                      ))
                    )}
                  </div>
                ) : (
                  <div className="divide-y text-slate-900">
                    {filterAndSort(seeks).length === 0 ? (
                      <EmptyResults
                        message={searched && (maxPrice || minSeats) ? "No seeks match filters" : "No seekers near this route"}
                        action={!maxPrice && !minSeats ? { label: 'Post your need', href: '/seeks/new' } : undefined}
                      />
                    ) : (
                      (filterAndSort(seeks) as Seek[]).map(seek => (
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
            </div>
          )}
        </div>
      </div>

      {/* selected ride detail */}
      {selectedRide && (
        <div className="mt-4 bg-white border rounded-xl p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-semibold text-slate-900">
                  {selectedRide.origin_label} → {selectedRide.dest_label}
                </h2>
                <Badge
                  variant={selectedRide.status === 'cancelled' ? 'destructive' : selectedRide.status === 'completed' ? 'secondary' : selectedRide.status === 'full' ? 'outline' : 'default'}
                  className={
                    selectedRide.status === 'scheduled' ? 'bg-blue-600 text-white' :
                      selectedRide.status === 'active' ? 'bg-green-600 text-white animate-pulse' :
                        selectedRide.status === 'full' ? 'border-yellow-400 text-yellow-700 bg-yellow-50' :
                          ''
                  }
                >
                  {selectedRide.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-white mr-1.5 inline-block" />}
                  {selectedRide.status}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-500 mb-3">
                <span>
                  {format(new Date(selectedRide.departure_at), 'dd MMM · hh:mm a')}
                </span>
                <span>·</span>
                <span className="font-medium text-slate-700">{selectedRide.available_seats} seats left</span>
                <span>·</span>
                <span className="font-semibold text-slate-900">₹{selectedRide.price_per_seat}</span>
              </div>
              {selectedRide.notes && (
                <p className="text-sm text-slate-600 mb-4 bg-slate-50 p-3 rounded-lg italic border-l-4 border-slate-200">
                  "{selectedRide.notes}"
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 min-w-[140px]">
              <Link href={`/rides/${selectedRide.id}`}>
                <Button variant="outline" className="w-full text-xs">View details</Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* selected seek detail */}
      {selectedSeek && (
        <div className="mt-4 bg-white border rounded-xl p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-semibold text-slate-900">
                  {selectedSeek.origin_label} → {selectedSeek.dest_label}
                </h2>
                <Badge
                  variant={selectedSeek.status === 'cancelled' ? 'destructive' : selectedSeek.status === 'matched' ? 'secondary' : 'default'}
                  className={selectedSeek.status === 'active' ? 'bg-blue-600 text-white' : ''}
                >
                  {selectedSeek.status}
                </Badge>
              </div>
              <div className="text-sm text-slate-500 mb-3">
                <span>{selectedSeek.seats_needed} seat{selectedSeek.seats_needed !== 1 ? 's' : ''} needed</span>
                <span className="mx-2">·</span>
                <span>Expires {format(new Date(selectedSeek.expires_at), 'dd MMM · hh:mm a')}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 min-w-[140px]">
              <Button className="w-full" disabled>Offer ride (Coming soon)</Button>
              <Link href={`/seeks/${selectedSeek.id}`}>
                <Button variant="outline" className="w-full text-xs">View details</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RideResult({ ride, selected, onClick }: { ride: Ride; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer transition-all hover:bg-slate-50 border-b border-slate-100 last:border-0 ${selected ? 'bg-blue-50/50 border-l-4 border-l-blue-600' : ''}`}
    >
      <div className="flex justify-between items-start mb-1">
        <p className="font-semibold text-slate-900 text-sm truncate pr-2">
          {ride.origin_label.split(',')[0]} → {ride.dest_label.split(',')[0]}
        </p>
        <span className="font-bold text-slate-900 text-sm whitespace-nowrap">₹{ride.price_per_seat}</span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-slate-500">
        <span>{format(new Date(ride.departure_at), 'hh:mm a')}</span>
        <span>·</span>
        <span>{ride.available_seats} seats</span>
        {ride.status === 'active' && (
          <Badge variant="default" className="bg-green-600 text-[9px] h-4 px-1 leading-none text-white font-bold">LIVE</Badge>
        )}
      </div>
    </div>
  )
}

function SeekResult({ seek, selected, onClick }: { seek: Seek; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer transition-all hover:bg-slate-50 border-b border-slate-100 last:border-0 ${selected ? 'bg-blue-50/50 border-l-4 border-l-blue-600' : ''}`}
    >
      <div className="flex justify-between items-start mb-1">
        <p className="font-semibold text-slate-900 text-sm truncate pr-4">
          {seek.origin_label.split(',')[0]} → {seek.dest_label.split(',')[0]}
        </p>
        <Badge variant="outline" className="text-[10px] h-4 px-1 leading-none text-slate-600 font-medium">{seek.seats_needed} seats</Badge>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-slate-500">
        <span>Expires {format(new Date(seek.expires_at), 'hh:mm a')}</span>
        {seek.is_recurring && (
          <span className="text-emerald-600 font-semibold ml-2">Recurring</span>
        )}
      </div>
    </div>
  )
}

function EmptyResults({ message, action }: { message: string; action?: { label: string; href: string } }) {
  return (
    <div className="p-10 text-center">
      <p className="text-slate-400 text-sm mb-4 leading-relaxed">{message}</p>
      {action && (
        <Link href={action.href}>
          <Button variant="outline" size="sm" className="text-[11px] shadow-sm hover:shadow-md transition-shadow">{action.label}</Button>
        </Link>
      )}
    </div>
  )
}

function MapSkeleton({ height }: { height: string }) {
  return (
    <div
      style={{ height }}
      className="bg-slate-100 rounded-xl animate-pulse flex items-center justify-center p-6 text-center border-2 border-dashed border-slate-200"
    >
      <p className="text-slate-400 text-sm font-medium italic">Loading map components...</p>
    </div>
  )
}