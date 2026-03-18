// components/map/MapView.tsx
'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import type { Ride, Seek } from '@/types'

interface Props {
  rides?:       Ride[]
  seeks?:       Seek[]
  height?:      string
  onRideClick?: (ride: Ride) => void
  onSeekClick?: (seek: Seek) => void
  centerLat?:   number
  centerLng?:   number
}

export default function MapView({
  rides = [],
  seeks = [],
  height = '500px',
  onRideClick,
  onSeekClick,
  centerLat = 20.5937,
  centerLng = 78.9629,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!containerRef.current) return
    if ((containerRef.current as any)._leaflet_id) return
    if (mapRef.current) return

    let cancelled = false

    const init = async () => {
      const L = (await import('leaflet')).default
      const { fixLeafletIcons, makeIcon } = await import('@/lib/leaflet-fix')

      if (cancelled) return
      if ((containerRef.current as any)?._leaflet_id) return

      fixLeafletIcons()

      const map = L.map(containerRef.current!, {
        center: [centerLat, centerLng],
        zoom:   6,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      mapRef.current = map

      const allPoints: [number, number][] = []

      rides.forEach(ride => {
        if (cancelled) return

        L.polyline(
          [[ride.origin_lat, ride.origin_lng], [ride.dest_lat, ride.dest_lng]],
          { color: '#3b82f6', weight: 3, dashArray: '6 4' }
        ).addTo(map)

        const marker = L.marker(
          [ride.origin_lat, ride.origin_lng],
          { icon: makeIcon('blue') }
        )
          .bindPopup(`
            <b>${ride.origin_label} → ${ride.dest_label}</b><br/>
            ${ride.available_seats} seat${ride.available_seats !== 1 ? 's' : ''} · ₹${ride.price_per_seat}<br/>
            Driver: ${ride.driver_name}
          `)
          .addTo(map)

        if (onRideClick) marker.on('click', () => onRideClick(ride))

        allPoints.push([ride.origin_lat, ride.origin_lng])
        allPoints.push([ride.dest_lat,   ride.dest_lng])
      })

      seeks.forEach(seek => {
        if (cancelled) return

        L.polyline(
          [[seek.origin_lat, seek.origin_lng], [seek.dest_lat, seek.dest_lng]],
          { color: '#f97316', weight: 2, dashArray: '4 4' }
        ).addTo(map)

        const marker = L.marker(
          [seek.origin_lat, seek.origin_lng],
          { icon: makeIcon('orange') }
        )
          .bindPopup(`
            <b>${seek.origin_label} → ${seek.dest_label}</b><br/>
            Needs ${seek.seats_needed} seat${seek.seats_needed !== 1 ? 's' : ''}<br/>
            ${seek.seeker_name}
          `)
          .addTo(map)

        if (onSeekClick) marker.on('click', () => onSeekClick(seek))

        allPoints.push([seek.origin_lat, seek.origin_lng])
        allPoints.push([seek.dest_lat,   seek.dest_lng])
      })

      if (allPoints.length > 0 && !cancelled) {
        map.fitBounds(allPoints, { padding: [40, 40] })
      }
    }

    init()

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%' }}
      className="rounded-xl border overflow-hidden"
    />
  )
}