'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { LatLng } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'
import { autocompleteOla, reverseGeocodeOla, getDirectionsOla, getPlaceDetailsOla } from '@/lib/olaMaps'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// India bounding box (SW corner, NE corner)
const INDIA_BOUNDS: [number, number, number, number] = [
  68.0, 6.5,   // SW lng, lat
  97.5, 37.0   // NE lng, lat
]

interface Props {
  onChange: (
    origin: LatLng | null,
    destination: LatLng | null,
    routeWaypoints?: LatLng[],
    viaPoints?: LatLng[],
    isFetchingRoute?: boolean
  ) => void;
  height?: string;
  enableViaPoints?: boolean;
}

// Helper to create circular marker
function createMarkerEl(color: string) {
  const el = document.createElement('div')
  el.style.width = '14px'
  el.style.height = '14px'
  el.style.borderRadius = '50%'
  el.style.backgroundColor = color
  el.style.border = '2px solid white'
  el.style.boxShadow = '0 0 4px rgba(0,0,0,0.4)'
  return el
}

export default function MapPicker({ onChange, height = '400px', enableViaPoints = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  const originMarker = useRef<maplibregl.Marker | null>(null)
  const destMarker = useRef<maplibregl.Marker | null>(null)
  const viaMarkers = useRef<maplibregl.Marker[]>([])

  const pickingRef = useRef<'origin' | 'destination' | string>('origin')
  const originRef = useRef<LatLng | null>(null)
  const destRef = useRef<LatLng | null>(null)
  const viaPointsRef = useRef<{id: string, location: LatLng | null}[]>([])
  const recalcRouteRef = useRef<NodeJS.Timeout | null>(null)

  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })

  const [picking, setPicking] = useState<'origin' | 'destination' | string>('origin')
  const [localOrigin, setLocalOrigin] = useState<LatLng | null>(null)
  const [localDest, setLocalDest] = useState<LatLng | null>(null)
  const [viaPoints, setViaPoints] = useState<{id: string, location: LatLng | null}[]>([])
  
  // Route fetching statuses
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null)
  const [routeStatus, setRouteStatus] = useState<'idle' | 'fetching' | 'success' | 'error'>('idle')

  // -- init map --
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
          if (!reqUrl.searchParams.has('api_key')) reqUrl.searchParams.set('api_key', apiKey)
          return { url: reqUrl.toString() }
        }
        return { url }
      }
    })

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right')
    map.on('error', (e) => {
        if (e && e.error && e.error.message && e.error.message.includes('3d_model')) return
    })

    map.on('load', () => {
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }
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
      const address = await reverseGeocodeOla(lat, lng)
      const updated: LatLng = { lat, lng, label: address || tempLabel }

      const target = pickingRef.current

      if (target === 'origin') {
        setOrigin(updated)
      } else if (target === 'destination') {
        setDest(updated)
      } else {
        updateViaPoint(target, updated)
      }
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // -- state management helpers --
  const setOrigin = (loc: LatLng | null) => {
    originRef.current = loc
    setLocalOrigin(loc)
    drawMarkers()
    recalcRoute()
    
    if (loc && !destRef.current) {
        pickingRef.current = 'destination'
        setPicking('destination')
    }
  }

  const setDest = (loc: LatLng | null) => {
    destRef.current = loc
    setLocalDest(loc)
    drawMarkers()
    recalcRoute()
    
    if (loc && !originRef.current) {
        pickingRef.current = 'origin'
        setPicking('origin')
    }
  }

  const getValidViaPoints = () => viaPointsRef.current.map(v => v.location).filter(Boolean) as LatLng[]

  const updateViaPoint = (id: string, loc: LatLng | null) => {
    const next = viaPointsRef.current.map(v => v.id === id ? { ...v, location: loc } : v)
    viaPointsRef.current = next
    setViaPoints(next)
    drawMarkers()
    recalcRoute()
  }

  const addViaPoint = () => {
    const id = Math.random().toString(36).substring(2, 11)
    const next = [...viaPointsRef.current, { id, location: null }]
    viaPointsRef.current = next
    setViaPoints(next)
    pickingRef.current = id
    setPicking(id)
  }

  const removeViaPoint = (id: string) => {
    const next = viaPointsRef.current.filter(v => v.id !== id)
    viaPointsRef.current = next
    setViaPoints(next)
    drawMarkers()
    recalcRoute()
    if (pickingRef.current === id) {
      pickingRef.current = 'origin'
      setPicking('origin')
    }
  }

  const drawMarkers = () => {
    const map = mapRef.current
    if (!map) return

    if (originRef.current && typeof originRef.current.lng === 'number' && typeof originRef.current.lat === 'number') {
      if (!originMarker.current) {
        originMarker.current = new maplibregl.Marker({ element: createMarkerEl('#22c55e') })
          .setLngLat([originRef.current.lng, originRef.current.lat])
          .addTo(map)
      } else {
        originMarker.current.setLngLat([originRef.current.lng, originRef.current.lat])
      }
    } else {
      if (originMarker.current) { originMarker.current.remove(); originMarker.current = null }
    }

    if (destRef.current && typeof destRef.current.lng === 'number' && typeof destRef.current.lat === 'number') {
      if (!destMarker.current) {
        destMarker.current = new maplibregl.Marker({ element: createMarkerEl('#ef4444') })
          .setLngLat([destRef.current.lng, destRef.current.lat])
          .addTo(map)
      } else {
        destMarker.current.setLngLat([destRef.current.lng, destRef.current.lat])
      }
    } else {
      if (destMarker.current) { destMarker.current.remove(); destMarker.current = null }
    }

    // sync via markers
    const validVia = viaPointsRef.current.filter(v => v.location)
    while (viaMarkers.current.length > validVia.length) {
      const m = viaMarkers.current.pop()
      if (m) m.remove()
    }
    validVia.forEach((v, i) => {
      if (v.location && typeof v.location.lng === 'number' && typeof v.location.lat === 'number') {
        if (!viaMarkers.current[i]) {
          viaMarkers.current.push(
            new maplibregl.Marker({ element: createMarkerEl('#eab308') })
              .setLngLat([v.location.lng, v.location.lat])
              .addTo(map)
          )
        } else {
          viaMarkers.current[i].setLngLat([v.location.lng, v.location.lat])
        }
      }
    })
  }

  const recalcRoute = () => {
    if (recalcRouteRef.current) clearTimeout(recalcRouteRef.current)
    recalcRouteRef.current = setTimeout(async () => {
      const origin = originRef.current
      const dest = destRef.current
      const map = mapRef.current
      
      if (origin && dest && map) {
        setRouteStatus('fetching')
        onChangeRef.current(origin, dest, [], getValidViaPoints(), true)
        try {
          const route = await getDirectionsOla(
            { lat: origin.lat, lng: origin.lng },
            { lat: dest.lat, lng: dest.lng },
            getValidViaPoints()
          )

          if (route && route.geometry) {
            setRouteStatus('success')
            setRouteInfo({ distance: route.distance, duration: route.duration })
            const source = map.getSource('route') as maplibregl.GeoJSONSource
            if (source) source.setData({ type: 'Feature', properties: {}, geometry: route.geometry as any })
            
            // Fit bounds
            const bounds = new maplibregl.LngLatBounds()
            route.geometry.coordinates.forEach((c: any) => bounds.extend(c))
            map.fitBounds(bounds, { padding: 50 })

            // Pass the route back out! Points are [lng, lat]
            const fullRoutePoints = route.geometry.coordinates.map((coord: number[]) => ({
              lng: coord[0],
              lat: coord[1],
              label: 'route_point'
            }))
            onChangeRef.current(origin, dest, fullRoutePoints, getValidViaPoints(), false)
            return
          }
        } catch (err) {
          console.error("Failed to fetch route", err)
        }
        setRouteStatus('error')
        setRouteInfo(null)
        onChangeRef.current(origin, dest, [], getValidViaPoints(), false)
        const source = map.getSource('route') as maplibregl.GeoJSONSource
        if (source) source.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } })
      } else {
        setRouteStatus('idle')
        setRouteInfo(null)
        onChangeRef.current(origin, dest, [], getValidViaPoints(), false)
        if (map) {
          const source = map.getSource('route') as maplibregl.GeoJSONSource
          if (source) source.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } })
        }
      }
    }, 400)
  }

  const reset = () => {
    setOrigin(null)
    setDest(null)
    setViaPoints([])
    viaPointsRef.current = []
    pickingRef.current = 'origin'
    setPicking('origin')
    const map = mapRef.current
    if (map) map.flyTo({ center: [78.9629, 20.5937], zoom: 4 })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex-1">
                <LocationInput 
                    placeholder="Search pickup in India..." 
                    color="bg-green-500" 
                    borderColor="border-green-400"
                    bgColor="bg-green-50"
                    ringColor="ring-green-200"
                    isPicking={picking === 'origin'}
                    onFocus={() => { pickingRef.current = 'origin'; setPicking('origin') }}
                    value={localOrigin}
                    onChange={(loc: LatLng | null) => setOrigin(loc)}
                    mapRef={mapRef}
                />
            </div>
            
            {viaPoints.length === 0 && (
            <div className="flex items-center justify-center -my-1.5 sm:my-0 sm:pt-1.5 shrink-0">
                <button
                    type="button"
                    onClick={() => {
                        const o = originRef.current
                        const d = destRef.current
                        setOrigin(d);
                        setDest(o);
                    }}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200
                    flex items-center justify-center text-slate-500 hover:text-slate-700
                    transition-all text-sm border border-slate-200 hover:scale-110 active:scale-95"
                    aria-label="Swap origin and destination"
                    title="Swap origin and destination"
                >
                    <span className="sm:hidden">⇅</span>
                    <span className="hidden sm:inline">⇄</span>
                </button>
            </div>
            )}

            {viaPoints.length === 0 && (
            <div className="flex-1">
                <LocationInput 
                    placeholder="Search destination in India..." 
                    color="bg-red-500" 
                    borderColor="border-red-400"
                    bgColor="bg-red-50"
                    ringColor="ring-red-200"
                    isPicking={picking === 'destination'}
                    onFocus={() => { pickingRef.current = 'destination'; setPicking('destination') }}
                    value={localDest}
                    onChange={(loc: LatLng | null) => setDest(loc)}
                    mapRef={mapRef}
                />
            </div>
            )}
        </div>

        {viaPoints.length > 0 && (
          <div className="flex flex-col gap-3 ml-4 border-l-2 border-dashed border-slate-200 pl-4 py-2 pr-8">
                {viaPoints.map((v) => (
              <div key={v.id} className="relative pr-10">
                        <LocationInput 
                            placeholder="Add stop..." 
                            color="bg-yellow-500" 
                            borderColor="border-yellow-400"
                            bgColor="bg-yellow-50"
                            ringColor="ring-yellow-200"
                            isPicking={picking === v.id}
                            onFocus={() => { pickingRef.current = v.id; setPicking(v.id) }}
                            value={v.location}
                            onChange={(loc: LatLng | null) => updateViaPoint(v.id, loc)}
                            mapRef={mapRef}
                        />
                        <button 
                            type="button" 
                            onClick={() => removeViaPoint(v.id)}
                          className="absolute right-0 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>
        )}

        {viaPoints.length > 0 && (
             <div>
                <LocationInput 
                    placeholder="Search destination in India..." 
                    color="bg-red-500" 
                    borderColor="border-red-400"
                    bgColor="bg-red-50"
                    ringColor="ring-red-200"
                    isPicking={picking === 'destination'}
                    onFocus={() => { pickingRef.current = 'destination'; setPicking('destination') }}
                    value={localDest}
                    onChange={(loc: LatLng | null) => setDest(loc)}
                    mapRef={mapRef}
                />
            </div>
        )}

        {enableViaPoints && (
            <div className="pt-1">
                <button 
                  type="button" 
                  onClick={addViaPoint} 
                  className="text-sm text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 p-1 rounded hover:bg-blue-50 transition-colors"
                >
                    <span className="text-lg leading-none">+</span> Add stop
                </button>
            </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          📍 Search or click map to set points
        </p>
        
        {/* Route status indicator */}
        <div className="text-xs flex items-center gap-2">
          {routeStatus === 'fetching' && <span className="text-blue-500 flex items-center gap-1"><span className="animate-spin inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full"></span> Fetching route...</span>}
          {routeStatus === 'success' && <span className="text-green-600 font-medium">✓ Route ready</span>}
          {routeStatus === 'error' && <span className="text-red-500 font-medium">⚠ Could not load route — check connection or locations</span>}
        </div>

        {(localOrigin || localDest || viaPoints.length > 0) && (
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

      {routeInfo && routeStatus === 'success' && (
        <div className="flex items-center gap-3 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
          <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <span className="text-sm font-medium text-blue-700">{routeInfo.distance}</span>
          <span className="text-blue-300">•</span>
          <span className="text-sm text-blue-600">{routeInfo.duration} drive</span>
        </div>
      )}

    </div>
  )
}

function LocationInput({ 
    placeholder, color, borderColor, bgColor, ringColor, 
    isPicking, onFocus, value, onChange, mapRef 
}: any) {
    const boxRef = useRef<HTMLDivElement>(null)
    const [query, setQuery] = useState('')
    const debouncedQuery = useDebounce(query, 500)
    const [results, setResults] = useState<any[]>([])
    const [searching, setSearching] = useState(false)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const suppressSearch = useRef(false)

    useEffect(() => {
        if (value) {
            suppressSearch.current = true
            setQuery(value.label)
            setDropdownOpen(false)
        } else {
            setQuery('')
        }
    }, [value])

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
                setDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    useEffect(() => {
        if (suppressSearch.current) {
            suppressSearch.current = false
            return
        }
        if (debouncedQuery.length >= 3) {
            setSearching(true)
            autocompleteOla(debouncedQuery).then(res => {
                setResults(res)
                setDropdownOpen(res.length > 0)
                setSearching(false)
            })
        } else {
            setResults([])
            setDropdownOpen(false)
        }
    }, [debouncedQuery])

    const selectResult = async (r: any) => {
        let lat, lng, label;

        if (r.geometry && r.geometry.location) {
            lat = r.geometry.location.lat
            lng = r.geometry.location.lng
            label = r.structured_formatting?.main_text || r.description
        } else {
            // Fetch missing details
            const details = await getPlaceDetailsOla(r.place_id)
            if (!details) return
            lat = details.lat
            lng = details.lng
            label = details.label
        }
        
        suppressSearch.current = true
        setQuery(label)
        setResults([])
        setDropdownOpen(false)
        
        const map = mapRef.current
        if (map && typeof lng === 'number' && typeof lat === 'number') {
            map.flyTo({ center: [lng, lat], zoom: 14 })
        }
        
        onChange({ lat, lng, label })
    }

    return (
        <div className="relative w-full" ref={boxRef}>
            <div className={`flex items-center gap-2 border rounded-lg px-3 py-2.5 transition-colors ${
                isPicking ? `${borderColor} ${bgColor} ring-1 ${ringColor}` : 'border-slate-200 bg-white'
            }`}>
                <div className={`w-2.5 h-2.5 rounded-full ${color} shrink-0`} />
                <input
                    type="text"
                    placeholder={placeholder}
                    value={query}
                    onChange={e => {
                        suppressSearch.current = false
                        setQuery(e.target.value)
                        if (e.target.value === '') onChange(null)
                    }}
                    onFocus={() => {
                        onFocus()
                        if (results.length > 0) setDropdownOpen(true)
                    }}
                    className="flex-1 text-sm outline-none bg-transparent placeholder:text-slate-400 text-slate-900 min-w-0"
                />
                {searching && <span className="text-xs text-slate-400 shrink-0 animate-pulse">searching...</span>}
                {query && (
                    <button
                        type="button"
                        onClick={() => {
                            suppressSearch.current = true
                            setQuery('')
                            setResults([])
                            setDropdownOpen(false)
                            onChange(null)
                        }}
                        className="text-slate-400 hover:text-slate-600 shrink-0 text-sm"
                        aria-label="Clear"
                    >
                        ✕
                    </button>
                )}
            </div>

            {dropdownOpen && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto w-full">
                    {results.map((r, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => selectResult(r)}
                            className="w-full text-left px-3 py-2.5 text-sm text-slate-700
                                hover:bg-slate-50 active:bg-slate-100 border-b last:border-0
                                flex flex-col gap-0.5 transition-colors"
                        >
                            <span className="font-medium truncate">{r.structured_formatting?.main_text || r.description}</span>
                            {r.structured_formatting?.secondary_text && (
                                <span className="text-xs text-slate-400 truncate">{r.structured_formatting.secondary_text}</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}