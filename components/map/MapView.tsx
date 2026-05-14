// components/map/MapView.tsx
'use client'

import React, { useEffect, useRef } from 'react'
import type { Ride } from '@/types'
import { getDirectionsOla } from '@/lib/olaMaps'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

interface Props {
  rides?: Ride[]
  height?: string
  onRideClick?: (ride: Ride) => void
  centerLat?: number
  centerLng?: number
}

// India bounds fallback
const INDIA_BOUNDS: [number, number, number, number] = [68.0, 6.5, 97.5, 37.0]

export default function MapView({
  rides = [],
  height = '500px',
  onRideClick,
  centerLat = 20.5937,
  centerLng = 78.9629,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!containerRef.current || mapRef.current) return

    const apiKey = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY || 'YOUR_OLA_MAPS_API_KEY_HERE'
    const styleUrl = `https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json?api_key=${apiKey}`

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [centerLng, centerLat],
      zoom: 5,
      maxBounds: INDIA_BOUNDS,
      transformRequest: (url) => {
        if (url.includes('api.olamaps.io')) {
          const reqUrl = new URL(url)
          if (!reqUrl.searchParams.has('api_key')) {
            reqUrl.searchParams.set('api_key', apiKey)
          }
          return { url: reqUrl.toString() }
        }
        return { url }
      }
    })

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right')

    // Suppress harmless Ola Maps internal style warnings
    map.on('error', (e) => {
      if (e.error?.message?.includes('3d_model')) return
    })

    map.on('load', async () => {
      let routeFeatures: any[] = []
      const bounds = new maplibregl.LngLatBounds()
      let hasPoints = false

      // Process rides
      for (const ride of rides) {
        // Create marker
        const el = document.createElement('div')
        el.style.width = '14px'
        el.style.height = '14px'
        el.style.borderRadius = '50%'
        el.style.backgroundColor = '#3b82f6' // blue
        el.style.cursor = 'pointer'
        el.style.border = '2px solid white'
        el.style.boxShadow = '0 0 4px rgba(0,0,0,0.4)'

        const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`
          <b>${ride.origin_label} &rarr; ${ride.dest_label}</b><br/>
          ${ride.available_seats} seat${ride.available_seats !== 1 ? 's' : ''} &middot; ₹${ride.price_per_seat}<br/>
          Driver: ${ride.driver_name}
        `)

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([ride.origin_lng, ride.origin_lat])
          .setPopup(popup)
          .addTo(map)

        if (onRideClick) {
          el.addEventListener('click', () => {
            // Let the popup open but also fire onClick
            onRideClick(ride)
          })
        }

        let coordinates: [number, number][] = []
        if (ride.route_coordinates && ride.route_coordinates.length > 2) {
          coordinates = ride.route_coordinates.map(c => [c.lng, c.lat])
        } else {
          try {
            const route = await getDirectionsOla(
              { lat: ride.origin_lat, lng: ride.origin_lng },
              { lat: ride.dest_lat, lng: ride.dest_lng }
            )
            if (route?.geometry?.coordinates?.length > 2) {
              coordinates = route.geometry.coordinates as [number, number][]
            }
          } catch {
            // ignore and fall back to direct line
          }
          if (coordinates.length <= 2) {
            coordinates = [[ride.origin_lng, ride.origin_lat], [ride.dest_lng, ride.dest_lat]]
          }
        }

        routeFeatures.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates },
          properties: { color: '#3b82f6', isRide: true }
        })

        bounds.extend([ride.origin_lng, ride.origin_lat])
        bounds.extend([ride.dest_lng, ride.dest_lat])
        hasPoints = true
      }

      // Draw all lines
      map.addSource('routes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: routeFeatures
        }
      })
      map.addLayer({
        id: 'routes-ride-layer',
        type: 'line',
        source: 'routes',
        filter: ['==', ['get', 'isRide'], true],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 3,
          'line-dasharray': [6, 4],
          'line-opacity': 0.8
        }
      })

      if (hasPoints) {
        map.fitBounds(bounds, { padding: 40 })
      }
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [rides, centerLat, centerLng, onRideClick])

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%' }}
      className="rounded-xl border overflow-hidden relative z-0"
    />
  )
}