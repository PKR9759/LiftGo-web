'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { LatLng } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'
import { autocompleteOla, reverseGeocodeOla, getDirectionsOla } from '@/lib/olaMaps'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// India bounding box (SW corner, NE corner)
const INDIA_BOUNDS: [number, number, number, number] = [
  68.0, 6.5,   // SW lng, lat
  97.5, 37.0   // NE lng, lat
]

interface Props {
  onChange: (origin: LatLng | null, destination: LatLng | null) => void
  height?: string
}

export default function MapPicker({ onChange, height = '400px' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  const originMarker = useRef<maplibregl.Marker | null>(null)
  const destMarker = useRef<maplibregl.Marker | null>(null)

  const pickingRef = useRef<'origin' | 'destination'>('origin')
  const originRef = useRef<LatLng | null>(null)
  const destRef = useRef<LatLng | null>(null)

  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })

  const [picking, setPicking] = useState<'origin' | 'destination'>('origin')
  const [localOrigin, setLocalOrigin] = useState<LatLng | null>(null)
  const [localDest, setLocalDest] = useState<LatLng | null>(null)
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null)

  // search box state
  const [originQuery, setOriginQuery] = useState('')
  const [destQuery, setDestQuery] = useState('')
  const debouncedOrigin = useDebounce(originQuery, 500)
  const debouncedDest = useDebounce(destQuery, 500)

  const [originResults, setOriginResults] = useState<any[]>([])
  const [destResults, setDestResults] = useState<any[]>([])
  const [searching, setSearching] = useState<'origin' | 'dest' | null>(null)

  useEffect(() => {
    if (debouncedOrigin.length >= 3) {
      setSearching('origin')
      autocompleteOla(debouncedOrigin).then(res => {
        setOriginResults(res)
        setSearching(null)
      })
    } else {
      setOriginResults([])
    }
  }, [debouncedOrigin])

  useEffect(() => {
    if (debouncedDest.length >= 3) {
      setSearching('dest')
      autocompleteOla(debouncedDest).then(res => {
        setDestResults(res)
        setSearching(null)
      })
    } else {
      setDestResults([])
    }
  }, [debouncedDest])

  // init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const apiKey = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY || 'YOUR_OLA_MAPS_API_KEY_HERE'
    const styleUrl = `https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json?api_key=${apiKey}`

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [78.9629, 20.5937],
      zoom: 4,
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

    map.on('load', () => {
      // Add source and layer for route
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] }
        }
      })
      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3b82f6', 'line-width': 5, 'line-opacity': 0.8 }
      })
    })

    map.on('click', async (e) => {
      const { lat, lng } = e.lngLat
      const tempLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`

      if (pickingRef.current === 'origin') {
        placeOrigin(map, lat, lng, tempLabel)
      } else {
        placeDest(map, lat, lng, tempLabel)
      }

      // Reverse geocode
      const address = await reverseGeocodeOla(lat, lng)
      if (pickingRef.current === 'destination') { // since we flipped it in placeOrigin
        const updated: LatLng = { lat, lng, label: address }
        originRef.current = updated
        setLocalOrigin(updated)
        setOriginQuery(address)
        onChangeRef.current(updated, destRef.current)
      } else {
        const updated: LatLng = { lat, lng, label: address }
        destRef.current = updated
        setLocalDest(updated)
        setDestQuery(address)
        onChangeRef.current(originRef.current, updated)
      }
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  const updateRoute = async (origin: LatLng, dest: LatLng) => {
    const map = mapRef.current
    if (!map) return

    const route = await getDirectionsOla(
      { lat: origin.lat, lng: origin.lng },
      { lat: dest.lat, lng: dest.lng }
    )

    if (route && route.geometry) {
      setRouteInfo({ distance: route.distance, duration: route.duration })
      const source = map.getSource('route') as maplibregl.GeoJSONSource
      if (source) {
        source.setData({
          type: 'Feature',
          properties: {},
          geometry: route.geometry as any
        })
      }
      // Fit bounds
      const bounds = new maplibregl.LngLatBounds()
      route.geometry.coordinates.forEach((c: any) => bounds.extend(c))
      map.fitBounds(bounds, { padding: 50 })
    } else {
      setRouteInfo(null)
      const source = map.getSource('route') as maplibregl.GeoJSONSource
      if (source) {
        source.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } })
      }
    }
  }

  const placeOrigin = (map: maplibregl.Map, lat: number, lng: number, label: string) => {
    if (originMarker.current) originMarker.current.remove()

    // Create custom green marker
    const el = document.createElement('div')
    el.style.width = '14px'
    el.style.height = '14px'
    el.style.borderRadius = '50%'
    el.style.backgroundColor = '#22c55e'
    el.style.border = '2px solid white'
    el.style.boxShadow = '0 0 4px rgba(0,0,0,0.4)'

    originMarker.current = new maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(map)

    const newOrigin: LatLng = { lat, lng, label }
    originRef.current = newOrigin
    setLocalOrigin(newOrigin)
    setOriginQuery(label)
    onChangeRef.current(newOrigin, destRef.current)

    pickingRef.current = 'destination'
    setPicking('destination')

    if (destRef.current) updateRoute(newOrigin, destRef.current)
  }

  const placeDest = (map: maplibregl.Map, lat: number, lng: number, label: string) => {
    if (destMarker.current) destMarker.current.remove()

    // Create custom red marker
    const el = document.createElement('div')
    el.style.width = '14px'
    el.style.height = '14px'
    el.style.borderRadius = '50%'
    el.style.backgroundColor = '#ef4444'
    el.style.border = '2px solid white'
    el.style.boxShadow = '0 0 4px rgba(0,0,0,0.4)'

    destMarker.current = new maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(map)

    const newDest: LatLng = { lat, lng, label }
    destRef.current = newDest
    setLocalDest(newDest)
    setDestQuery(label)
    onChangeRef.current(originRef.current, newDest)

    pickingRef.current = 'origin'
    setPicking('origin')

    if (originRef.current) updateRoute(originRef.current, newDest)
  }

  const selectResult = (result: any, type: 'origin' | 'dest') => {
    const lat = result.geometry.location.lat
    const lng = result.geometry.location.lng
    const label = result.structured_formatting.main_text

    const map = mapRef.current
    if (!map) return

    map.flyTo({ center: [lng, lat], zoom: 14 })

    if (type === 'origin') {
      placeOrigin(map, lat, lng, label)
      setOriginQuery(label)
      setOriginResults([])
    } else {
      placeDest(map, lat, lng, label)
      setDestQuery(label)
      setDestResults([])
    }
  }

  const reset = () => {
    if (originMarker.current) { originMarker.current.remove(); originMarker.current = null }
    if (destMarker.current) { destMarker.current.remove(); destMarker.current = null }
    const map = mapRef.current
    if (map) {
      const source = map.getSource('route') as maplibregl.GeoJSONSource
      if (source) source.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } })
      map.flyTo({ center: [78.9629, 20.5937], zoom: 4 })
    }
    originRef.current = null
    destRef.current = null
    pickingRef.current = 'origin'
    setLocalOrigin(null)
    setLocalDest(null)
    setOriginQuery('')
    setDestQuery('')
    setOriginResults([])
    setDestResults([])
    setPicking('origin')
    setRouteInfo(null)
    onChangeRef.current(null, null)
  }

  return (
    <div className="space-y-3">
      {/* search boxes */}
      <div className="grid grid-cols-2 gap-3">
        {/* origin search */}
        <div className="relative">
          <div className={`flex items-center gap-2 border rounded-lg px-3 py-2
            transition-colors ${picking === 'origin'
              ? 'border-green-400 bg-green-50'
              : 'border-slate-200 bg-white'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
            <input
              type="text"
              placeholder="Search pickup in India..."
              value={originQuery}
              onChange={e => setOriginQuery(e.target.value)}
              onFocus={() => {
                pickingRef.current = 'origin'
                setPicking('origin')
              }}
              className="flex-1 text-sm outline-none bg-transparent placeholder:text-slate-400 text-slate-900 min-w-0"
            />
            {searching === 'origin' && <span className="text-xs text-slate-400 shrink-0">...</span>}
          </div>

          {originResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border rounded-lg shadow-lg overflow-hidden">
              {originResults.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectResult(r, 'origin')}
                  className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 border-b last:border-0 truncate"
                >
                  <span className="font-medium mr-1">{r.structured_formatting?.main_text || r.description}</span>
                  <span className="text-xs text-slate-400">{r.structured_formatting?.secondary_text || ''}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* destination search */}
        <div className="relative">
          <div className={`flex items-center gap-2 border rounded-lg px-3 py-2
            transition-colors ${picking === 'destination'
              ? 'border-red-400 bg-red-50'
              : 'border-slate-200 bg-white'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
            <input
              type="text"
              placeholder="Search destination in India..."
              value={destQuery}
              onChange={e => setDestQuery(e.target.value)}
              onFocus={() => {
                pickingRef.current = 'destination'
                setPicking('destination')
              }}
              className="flex-1 text-sm outline-none bg-transparent placeholder:text-slate-400 text-slate-900 min-w-0"
            />
            {searching === 'dest' && <span className="text-xs text-slate-400 shrink-0">...</span>}
          </div>

          {destResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border rounded-lg shadow-lg overflow-hidden">
              {destResults.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectResult(r, 'dest')}
                  className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 border-b last:border-0 truncate"
                >
                  <span className="font-medium mr-1">{r.structured_formatting?.main_text || r.description}</span>
                  <span className="text-xs text-slate-400">{r.structured_formatting?.secondary_text || ''}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {picking === 'origin' ? 'Search or click map to set pickup' : 'Search or click map to set destination'}
        </p>
        {(localOrigin || localDest) && (
          <button type="button" onClick={reset} className="text-xs text-slate-400 hover:text-slate-600 underline">
            Reset
          </button>
        )}
      </div>

      <div
        ref={containerRef}
        style={{ height, width: '100%' }}
        className="rounded-xl border overflow-hidden"
      />

      {routeInfo && (
        <div className="flex items-center gap-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <span className="text-sm font-medium text-blue-700">{routeInfo.distance}</span>
          <span className="text-blue-300">•</span>
          <span className="text-sm text-blue-600">{routeInfo.duration} drive</span>
        </div>
      )}

      {(localOrigin || localDest) && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className={`p-2 rounded-lg border ${localOrigin ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
            <p className="font-medium text-green-700 mb-0.5">Pickup</p>
            <p className="text-slate-600 truncate">{localOrigin ? localOrigin.label : 'Not set'}</p>
          </div>
          <div className={`p-2 rounded-lg border ${localDest ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
            <p className="font-medium text-red-700 mb-0.5">Destination</p>
            <p className="text-slate-600 truncate">{localDest ? localDest.label : 'Not set'}</p>
          </div>
        </div>
      )}
    </div>
  )
}