'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getNearbyRides } from '@/lib/api'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import type { Ride, LatLng } from '@/types'
import { format } from 'date-fns'

const MapPicker = dynamic(
  () => import('@/components/map/MapPicker'),
  { ssr: false, loading: () => <MapSkeleton height="420px" /> }
)



function formatRupee(amount: number) {
  return `₹${amount.toFixed(2).replace(/\.00$/, '')}`
}

function getRideSegmentPricing(ride: Ride) {
  const fullPrice = ride.price_per_seat
  const coverageFraction =
    ride.pickup_fraction !== undefined && ride.dropoff_fraction !== undefined && ride.dropoff_fraction > ride.pickup_fraction
      ? ride.dropoff_fraction - ride.pickup_fraction
      : ride.route_coverage_pct !== undefined && ride.route_coverage_pct > 0
        ? ride.route_coverage_pct / 100
        : 1

  const segmentPrice = Math.max(0, fullPrice * coverageFraction)
  const savings = Math.max(0, fullPrice - segmentPrice)

  return {
    fullPrice,
    segmentPrice,
    savings,
    coveragePct: Math.round(coverageFraction * 1000) / 10,
  }
}

export default function HomePage() {
  const { ready } = useRequireAuth()

  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null)

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
        const seats = (i as any).available_seats || 0
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
        const sa = (a as any).available_seats || 0
        const sb = (b as any).available_seats || 0
        return sb - sa
      }
      const ta = new Date((a as any).departure_at || a.created_at).getTime()
      const tb = new Date((b as any).departure_at || b.created_at).getTime()
      return ta - tb
    })
  }

  const search = useCallback(async (o: LatLng, d: LatLng) => {
    setLoading(true)
    setSearched(true)
    try {
      const ridesRes = await getNearbyRides({
        origin_lat: o.lat, origin_lng: o.lng,
        dest_lat: d.lat, dest_lng: d.lng,
        radius: 5000,
      })
      setRides(ridesRes.data)
    } catch {
      setRides([])
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
    if (o && d) {
      searchRef.current?.(o, d)
    }
  }, [])

  const clearSearch = () => {
    setRides([])
    setSearched(false)
    setSelectedRide(null)
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
              flex flex-col items-center justify-center min-h-50">
              <p className="text-slate-400 text-sm mb-4">
                Click two points on the map to find rides near your route
              </p>
            </div>
          ) : (
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
              {/* header */}
              <div className="px-4 py-3 border-b bg-slate-50">
                <p className="text-sm font-medium text-slate-900">
                  Available Rides ({rides.length})
                </p>
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
              <div className="max-h-95 overflow-y-auto">
                {loading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse">
                        <div className="h-3 bg-slate-100 rounded w-2/3 mb-2" />
                        <div className="h-3 bg-slate-100 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : (
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
                <span className="font-semibold text-slate-900">{formatRupee(getRideSegmentPricing(selectedRide).segmentPrice)} after cut</span>
                <span className="text-slate-400 line-through">{formatRupee(selectedRide.price_per_seat)}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-500 mb-4">
                <span>Full fare/seat {formatRupee(selectedRide.price_per_seat)}</span>
                <span>·</span>
                <span>Cut fare/seat {formatRupee(getRideSegmentPricing(selectedRide).segmentPrice)}</span>
                <span>·</span>
                <span>You save {formatRupee(getRideSegmentPricing(selectedRide).savings)}</span>
              </div>
              {selectedRide.notes && (
                <p className="text-sm text-slate-600 mb-4 bg-slate-50 p-3 rounded-lg italic border-l-4 border-slate-200">
                  "{selectedRide.notes}"
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 min-w-35">
              <Link href={`/rides/${selectedRide.id}`}>
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
  const pricing = getRideSegmentPricing(ride)
  let matchQuality = "";
  if (ride.match_score !== undefined) {
    if (ride.match_score > 4.0) matchQuality = "Great match";
    else if (ride.match_score >= 2.0) matchQuality = "Good match";
    else matchQuality = "Partial match";
  }

  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer transition-all hover:bg-slate-50 border-b border-slate-100 last:border-0 ${selected ? 'bg-blue-50/50 border-l-4 border-l-blue-600' : ''}`}
    >
      <div className="flex justify-between items-start mb-1">
        <p className="font-semibold text-slate-900 text-sm truncate pr-2">
          {ride.origin_label.split(',')[0]} → {ride.dest_label.split(',')[0]}
        </p>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">After cut</div>
          <div className="font-bold text-slate-900 text-sm whitespace-nowrap">{formatRupee(pricing.segmentPrice)}</div>
          <div className="text-[10px] text-slate-400 line-through">{formatRupee(pricing.fullPrice)}</div>
        </div>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-slate-500">
        <span>{format(new Date(ride.departure_at), 'hh:mm a')}</span>
        <span>·</span>
        <span>{ride.available_seats} seats</span>
        {ride.status === 'active' && (
          <Badge variant="default" className="bg-green-600 text-[9px] h-4 px-1 leading-none text-white font-bold">LIVE</Badge>
        )}
      </div>
      
      {(ride.pickup_distance_m! > 0 || ride.route_coverage_pct! > 0 || matchQuality) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 mt-2">
           {matchQuality && (
               <span className={`font-semibold ${ride.match_score! > 4.0 ? 'text-green-600' : ride.match_score! >= 2.0 ? 'text-blue-600' : 'text-orange-500'}`}>
                   {matchQuality}
               </span>
           )}
           {ride.pickup_distance_m !== undefined && ride.pickup_distance_m > 0 && (
               <span>📍 {ride.pickup_distance_m}m from your pickup</span>
           )}
           {ride.route_coverage_pct !== undefined && ride.route_coverage_pct > 0 && (
               <span>🛣️ Covers {ride.route_coverage_pct}% of your journey</span>
           )}
           <span>💸 Save {formatRupee(pricing.savings)} per seat</span>
        </div>
      )}
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