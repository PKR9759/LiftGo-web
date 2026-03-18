'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import type { LatLng } from '@/types'

interface Props {
  onChange: (origin: LatLng | null, destination: LatLng | null) => void
  height?:  string
}

export default function MapPicker({ onChange, height = '400px' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)
  const originMarker = useRef<any>(null)
  const destMarker   = useRef<any>(null)
  const routeLine    = useRef<any>(null)
  const pickingRef   = useRef<'origin' | 'destination'>('origin')
  const originRef    = useRef<LatLng | null>(null)
  const destRef      = useRef<LatLng | null>(null)
  const mountedRef   = useRef(true)
  const onChangeRef  = useRef(onChange)

  useEffect(() => { onChangeRef.current = onChange })

  const [picking,     setPicking]     = useState<'origin' | 'destination'>('origin')
  const [localOrigin, setLocalOrigin] = useState<LatLng | null>(null)
  const [localDest,   setLocalDest]   = useState<LatLng | null>(null)
  const [loading,     setLoading]     = useState(false)

  // search box state
  const [originQuery,   setOriginQuery]   = useState('')
  const [destQuery,     setDestQuery]     = useState('')
  const [originResults, setOriginResults] = useState<any[]>([])
  const [destResults,   setDestResults]   = useState<any[]>([])
  const [searching,     setSearching]     = useState<'origin' | 'dest' | null>(null)

  useEffect(() => {
    mountedRef.current = true
    if (typeof window === 'undefined') return
    if (!containerRef.current) return
    if ((containerRef.current as any)._leaflet_id) return

    const setup = async () => {
      const L = (await import('leaflet')).default
      const { fixLeafletIcons, makeIcon } = await import('@/lib/leaflet-fix')

      if (!mountedRef.current) return
      if ((containerRef.current as any)?._leaflet_id) return

      fixLeafletIcons()

      const map = L.map(containerRef.current!, {
        center: [20.5937, 78.9629],
        zoom: 5,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      mapRef.current = map

      map.on('click', (e: any) => {
        if (!mountedRef.current || !mapRef.current) return
        const { lat, lng } = e.latlng
        const coordLabel   = `${lat.toFixed(5)}, ${lng.toFixed(5)}`

        if (pickingRef.current === 'origin') {
          placeOrigin(L, map, lat, lng, coordLabel)
        } else {
          placeDest(L, map, lat, lng, coordLabel)
        }

        // update geocode label in background
        import('@/lib/geocode').then(({ reverseGeocode }) => {
          reverseGeocode(lat, lng).then(label => {
            if (!mountedRef.current) return
            if (pickingRef.current === 'destination') {
              // we just placed origin, update it
              const updated: LatLng = { lat, lng, label }
              originRef.current = updated
              setLocalOrigin(updated)
              setOriginQuery(label)
              onChangeRef.current(updated, destRef.current)
              originMarker.current?.getPopup()
                ?.setContent(`<b>Pickup</b><br/>${label}`)
            } else {
              // we just placed dest, update it
              const updated: LatLng = { lat, lng, label }
              destRef.current = updated
              setLocalDest(updated)
              setDestQuery(label)
              onChangeRef.current(originRef.current, updated)
              destMarker.current?.getPopup()
                ?.setContent(`<b>Destination</b><br/>${label}`)
            }
          })
        })
      })
    }

    setup()

    return () => {
      mountedRef.current = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current       = null
        originMarker.current = null
        destMarker.current   = null
        routeLine.current    = null
        originRef.current    = null
        destRef.current      = null
        pickingRef.current   = 'origin'
      }
    }
  }, [])

  // ── helpers ────────────────────────────────────────────────

  const placeOrigin = (L: any, map: any, lat: number, lng: number, label: string) => {
    import('@/lib/leaflet-fix').then(({ makeIcon }) => {
      if (originMarker.current) { originMarker.current.remove(); originMarker.current = null }
      originMarker.current = L.marker([lat, lng], { icon: makeIcon('green') })
        .bindPopup(`<b>Pickup</b><br/>${label}`)
        .addTo(map)
        .openPopup()
    })
    const newOrigin: LatLng = { lat, lng, label }
    originRef.current = newOrigin
    setLocalOrigin(newOrigin)
    setOriginQuery(label)
    onChangeRef.current(newOrigin, destRef.current)
    pickingRef.current = 'destination'
    setPicking('destination')
  }

  const placeDest = (L: any, map: any, lat: number, lng: number, label: string) => {
    import('@/lib/leaflet-fix').then(({ makeIcon }) => {
      if (destMarker.current) { destMarker.current.remove(); destMarker.current = null }
      destMarker.current = L.marker([lat, lng], { icon: makeIcon('red') })
        .bindPopup(`<b>Destination</b><br/>${label}`)
        .addTo(map)
        .openPopup()

      if (originRef.current) {
        const o = originRef.current
        if (routeLine.current) { routeLine.current.remove(); routeLine.current = null }
        routeLine.current = L.polyline(
          [[o.lat, o.lng], [lat, lng]],
          { color: '#3b82f6', weight: 3, dashArray: '6 4' }
        ).addTo(map)
        map.fitBounds([[o.lat, o.lng], [lat, lng]], { padding: [40, 40] })
      }
    })
    const newDest: LatLng = { lat, lng, label }
    destRef.current = newDest
    setLocalDest(newDest)
    setDestQuery(label)
    onChangeRef.current(originRef.current, newDest)
    pickingRef.current = 'origin'
    setPicking('origin')
  }

  // ── nominatim search ───────────────────────────────────────

  const searchPlace = async (query: string, type: 'origin' | 'dest') => {
    if (query.length < 3) {
      type === 'origin' ? setOriginResults([]) : setDestResults([])
      return
    }
    setSearching(type)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const data = await res.json()
      if (type === 'origin') setOriginResults(data)
      else setDestResults(data)
    } catch {
      // silently fail
    } finally {
      setSearching(null)
    }
  }

  const selectResult = async (result: any, type: 'origin' | 'dest') => {
    const lat   = parseFloat(result.lat)
    const lng   = parseFloat(result.lon)
    const label = result.display_name.split(',').slice(0, 2).join(',').trim()

    if (!mapRef.current) return
    const L = (await import('leaflet')).default

    // zoom map to selected place
    mapRef.current.setView([lat, lng], 13)

    if (type === 'origin') {
      placeOrigin(L, mapRef.current, lat, lng, label)
      setOriginQuery(label)
      setOriginResults([])
    } else {
      placeDest(L, mapRef.current, lat, lng, label)
      setDestQuery(label)
      setDestResults([])
    }
  }

  const reset = () => {
    if (originMarker.current) { originMarker.current.remove(); originMarker.current = null }
    if (destMarker.current)   { destMarker.current.remove();   destMarker.current   = null }
    if (routeLine.current)    { routeLine.current.remove();    routeLine.current    = null }
    originRef.current  = null
    destRef.current    = null
    pickingRef.current = 'origin'
    setLocalOrigin(null)
    setLocalDest(null)
    setOriginQuery('')
    setDestQuery('')
    setOriginResults([])
    setDestResults([])
    setPicking('origin')
    onChangeRef.current(null, null)
    // reset map view
    mapRef.current?.setView([20.5937, 78.9629], 5)
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
              placeholder="Search pickup..."
              value={originQuery}
              onChange={e => {
                setOriginQuery(e.target.value)
                searchPlace(e.target.value, 'origin')
              }}
              onFocus={() => {
                pickingRef.current = 'origin'
                setPicking('origin')
              }}
              className="flex-1 text-sm outline-none bg-transparent
                placeholder:text-slate-400 text-slate-900 min-w-0"
            />
            {searching === 'origin' && (
              <span className="text-xs text-slate-400 shrink-0">...</span>
            )}
          </div>

          {/* origin dropdown */}
          {originResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1
              bg-white border rounded-lg shadow-lg overflow-hidden">
              {originResults.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectResult(r, 'origin')}
                  className="w-full text-left px-3 py-2 text-sm text-slate-700
                    hover:bg-slate-50 border-b last:border-0 truncate"
                >
                  {r.display_name.split(',').slice(0, 3).join(', ')}
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
              placeholder="Search destination..."
              value={destQuery}
              onChange={e => {
                setDestQuery(e.target.value)
                searchPlace(e.target.value, 'dest')
              }}
              onFocus={() => {
                pickingRef.current = 'destination'
                setPicking('destination')
              }}
              className="flex-1 text-sm outline-none bg-transparent
                placeholder:text-slate-400 text-slate-900 min-w-0"
            />
            {searching === 'dest' && (
              <span className="text-xs text-slate-400 shrink-0">...</span>
            )}
          </div>

          {/* destination dropdown */}
          {destResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1
              bg-white border rounded-lg shadow-lg overflow-hidden">
              {destResults.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectResult(r, 'dest')}
                  className="w-full text-left px-3 py-2 text-sm text-slate-700
                    hover:bg-slate-50 border-b last:border-0 truncate"
                >
                  {r.display_name.split(',').slice(0, 3).join(', ')}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* instruction + reset row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {picking === 'origin'
            ? 'Search or click map to set pickup'
            : 'Search or click map to set destination'
          }
        </p>
        {(localOrigin || localDest) && (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            Reset
          </button>
        )}
      </div>

      {/* map */}
      <div
        ref={containerRef}
        style={{ height, width: '100%' }}
        className="rounded-xl border overflow-hidden"
      />

      {/* selected summary */}
      {(localOrigin || localDest) && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className={`p-2 rounded-lg border ${
            localOrigin ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'
          }`}>
            <p className="font-medium text-green-700 mb-0.5">Pickup</p>
            <p className="text-slate-600 truncate">
              {localOrigin ? localOrigin.label : 'Not set'}
            </p>
          </div>
          <div className={`p-2 rounded-lg border ${
            localDest ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
          }`}>
            <p className="font-medium text-red-700 mb-0.5">Destination</p>
            <p className="text-slate-600 truncate">
              {localDest ? localDest.label : 'Not set'}
            </p>
          </div>
        </div>
      )}

    </div>
  )
}