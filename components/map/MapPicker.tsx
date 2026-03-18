'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import type { LatLng } from '@/types'

interface Props {
  onChange: (origin: LatLng | null, destination: LatLng | null) => void
  height?:  string
}

export default function MapPicker({ onChange, height = '400px' }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const mapRef        = useRef<any>(null)
  const originMarker  = useRef<any>(null)
  const destMarker    = useRef<any>(null)
  const routeLine     = useRef<any>(null)
  const pickingRef    = useRef<'origin' | 'destination'>('origin')
  const originRef     = useRef<LatLng | null>(null)
  const destRef       = useRef<LatLng | null>(null)
  const mountedRef    = useRef(true)
  const onChangeRef   = useRef(onChange)

  // keep onChangeRef current on every render — no effect re-run needed
  useEffect(() => {
    onChangeRef.current = onChange
  })

  const [picking,     setPicking]     = useState<'origin' | 'destination'>('origin')
  const [localOrigin, setLocalOrigin] = useState<LatLng | null>(null)
  const [localDest,   setLocalDest]   = useState<LatLng | null>(null)
  const [loading,     setLoading]     = useState(false)

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
          if (originMarker.current) {
            originMarker.current.remove()
            originMarker.current = null
          }

          originMarker.current = L.marker([lat, lng], {
            icon: makeIcon('green'),
          })
            .bindPopup(`<b>Pickup</b><br/>${coordLabel}`)
            .addTo(map)
            .openPopup()

          const newOrigin: LatLng = { lat, lng, label: coordLabel }
          originRef.current = newOrigin
          setLocalOrigin(newOrigin)
          onChangeRef.current(newOrigin, destRef.current)

          pickingRef.current = 'destination'
          setPicking('destination')

          // update label in background
          setLoading(true)
          import('@/lib/geocode').then(({ reverseGeocode }) => {
            reverseGeocode(lat, lng).then(label => {
              if (!mountedRef.current) return
              const updated: LatLng = { lat, lng, label }
              originRef.current = updated
              setLocalOrigin(updated)
              onChangeRef.current(updated, destRef.current)
              if (originMarker.current) {
                originMarker.current
                  .getPopup()
                  ?.setContent(`<b>Pickup</b><br/>${label}`)
              }
              setLoading(false)
            })
          })

        } else {
          if (destMarker.current) {
            destMarker.current.remove()
            destMarker.current = null
          }

          destMarker.current = L.marker([lat, lng], {
            icon: makeIcon('red'),
          })
            .bindPopup(`<b>Destination</b><br/>${coordLabel}`)
            .addTo(map)
            .openPopup()

          const newDest: LatLng = { lat, lng, label: coordLabel }
          destRef.current = newDest
          setLocalDest(newDest)
          onChangeRef.current(originRef.current, newDest)

          // draw route line
          if (originRef.current) {
            const o = originRef.current
            if (routeLine.current) {
              routeLine.current.remove()
              routeLine.current = null
            }
            routeLine.current = L.polyline(
              [[o.lat, o.lng], [lat, lng]],
              { color: '#3b82f6', weight: 3, dashArray: '6 4' }
            ).addTo(map)

            map.fitBounds(
              [[o.lat, o.lng], [lat, lng]],
              { padding: [40, 40] }
            )
          }

          pickingRef.current = 'origin'
          setPicking('origin')

          // update label in background
          setLoading(true)
          import('@/lib/geocode').then(({ reverseGeocode }) => {
            reverseGeocode(lat, lng).then(label => {
              if (!mountedRef.current) return
              const updated: LatLng = { lat, lng, label }
              destRef.current = updated
              setLocalDest(updated)
              onChangeRef.current(originRef.current, updated)
              if (destMarker.current) {
                destMarker.current
                  .getPopup()
                  ?.setContent(`<b>Destination</b><br/>${label}`)
              }
              setLoading(false)
            })
          })
        }
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

  const reset = () => {
    if (originMarker.current) { originMarker.current.remove(); originMarker.current = null }
    if (destMarker.current)   { destMarker.current.remove();   destMarker.current   = null }
    if (routeLine.current)    { routeLine.current.remove();    routeLine.current    = null }
    originRef.current  = null
    destRef.current    = null
    pickingRef.current = 'origin'
    setLocalOrigin(null)
    setLocalDest(null)
    setPicking('origin')
    onChangeRef.current(null, null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
            picking === 'origin'
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-slate-50 text-slate-400 border-slate-200'
          }`}>
            1 · Click origin
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
            picking === 'destination'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-slate-50 text-slate-400 border-slate-200'
          }`}>
            2 · Click destination
          </span>
          {loading && (
            <span className="text-xs text-slate-400">Getting location...</span>
          )}
        </div>
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

      <div
        ref={containerRef}
        style={{ height, width: '100%' }}
        className="rounded-xl border overflow-hidden"
      />

      {(localOrigin || localDest) && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className={`p-2 rounded-lg border ${
            localOrigin
              ? 'bg-green-50 border-green-200'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <p className="font-medium text-green-700 mb-0.5">Pickup</p>
            <p className="text-slate-600 truncate">
              {localOrigin ? localOrigin.label : 'Not set'}
            </p>
          </div>
          <div className={`p-2 rounded-lg border ${
            localDest
              ? 'bg-red-50 border-red-200'
              : 'bg-slate-50 border-slate-200'
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