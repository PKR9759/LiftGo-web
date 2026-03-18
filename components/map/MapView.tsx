// components/map/MapView.tsx
'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import type { Ride, Seek } from '@/types'

interface Props {
  rides?:        Ride[]
  seeks?:        Seek[]
  height?:       string
  onRideClick?:  (ride: Ride) => void
  onSeekClick?:  (seek: Seek) => void
  centerLat?:    number
  centerLng?:    number
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
  const markersRef   = useRef<any[]>([])
  const linesRef     = useRef<any[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (mapRef.current) return
    if (!containerRef.current) return

    const init = async () => {
      const L = (await import('leaflet')).default
      const { fixLeafletIcons, makeIcon } = await import('@/lib/leaflet-fix')

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

      // plot rides as blue lines + green origin marker
      rides.forEach(ride => {
        const line = L.polyline(
          [
            [ride.origin_lat, ride.origin_lng],
            [ride.dest_lat,   ride.dest_lng],
          ],
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

        if (onRideClick) {
          marker.on('click', () => onRideClick(ride))
        }

        markersRef.current.push(marker)
        linesRef.current.push(line)
      })

      // plot seeks as orange markers
      seeks.forEach(seek => {
        const line = L.polyline(
          [
            [seek.origin_lat, seek.origin_lng],
            [seek.dest_lat,   seek.dest_lng],
          ],
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

        if (onSeekClick) {
          marker.on('click', () => onSeekClick(seek))
        }

        markersRef.current.push(marker)
        linesRef.current.push(line)
      })

      // fit map to all markers if any exist
      const allPoints: [number, number][] = [
        ...rides.flatMap(r => [
          [r.origin_lat, r.origin_lng] as [number, number],
          [r.dest_lat,   r.dest_lng]   as [number, number],
        ]),
        ...seeks.flatMap(s => [
          [s.origin_lat, s.origin_lng] as [number, number],
          [s.dest_lat,   s.dest_lng]   as [number, number],
        ]),
      ]

      if (allPoints.length > 0) {
        map.fitBounds(allPoints, { padding: [40, 40] })
      }
    }

    init()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current   = null
        markersRef.current = []
        linesRef.current   = []
      }
    }
  }, [rides, seeks])

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%' }}
      className="rounded-xl border overflow-hidden"
    />
  )
}