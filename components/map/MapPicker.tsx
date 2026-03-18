// components/map/MapPicker.tsx
'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import type { LatLng } from '@/types'

interface Props {
  origin:      LatLng | null
  destination: LatLng | null
  onChange:    (origin: LatLng | null, destination: LatLng | null) => void
  height?:     string
}

export default function MapPicker({
  origin,
  destination,
  onChange,
  height = '400px',
}: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const mapRef        = useRef<any>(null)
  const originMarker  = useRef<any>(null)
  const destMarker    = useRef<any>(null)
  const routeLine     = useRef<any>(null)
  const pickingRef    = useRef<'origin' | 'destination'>('origin')

  const [picking,  setPicking]  = useState<'origin' | 'destination'>('origin')
  const [loading,  setLoading]  = useState(false)
  const [localOrigin, setLocalOrigin]   = useState<LatLng | null>(origin)
  const [localDest,   setLocalDest]     = useState<LatLng | null>(destination)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!containerRef.current) return

    // ── guard against double-init (React StrictMode) ──
    if ((containerRef.current as any)._leaflet_id) return
    if (mapRef.current) return

    let cancelled = false

    const init = async () => {
      const L = (await import('leaflet')).default
      const { fixLeafletIcons, makeIcon } = await import('@/lib/leaflet-fix')
      const { reverseGeocode } = await import('@/lib/geocode')

      if (cancelled) return
      if ((containerRef.current as any)?._leaflet_id) return

      fixLeafletIcons()

      const map = L.map(containerRef.current!, {
        center: [20.5937, 78.9629],
        zoom:   5,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      mapRef.current = map

      map.on('click', async (e: any) => {
        if (cancelled) return
        const { lat, lng } = e.latlng
        setLoading(true)

        const label = await reverseGeocode(lat, lng)
        if (cancelled) return

        if (pickingRef.current === 'origin') {
          if (originMarker.current) {
            originMarker.current.setLatLng([lat, lng])
              .getPopup()?.setContent(`<b>Origin</b><br/>${label}`)
          } else {
            originMarker.current = L.marker([lat, lng], { icon: makeIcon('green') })
              .bindPopup(`<b>Origin</b><br/>${label}`)
              .addTo(map)
              .openPopup()
          }

          const newOrigin = { lat, lng, label }
          setLocalOrigin(newOrigin)
          onChange(newOrigin, localDest)
          pickingRef.current = 'destination'
          setPicking('destination')

        } else {
          if (destMarker.current) {
            destMarker.current.setLatLng([lat, lng])
              .getPopup()?.setContent(`<b>Destination</b><br/>${label}`)
          } else {
            destMarker.current = L.marker([lat, lng], { icon: makeIcon('red') })
              .bindPopup(`<b>Destination</b><br/>${label}`)
              .addTo(map)
              .openPopup()
          }

          const newDest = { lat, lng, label }
          setLocalDest(newDest)

          const currentOrigin = localOrigin || (() => {
            const pos = originMarker.current?.getLatLng()
            return pos ? { lat: pos.lat, lng: pos.lng, label: '' } : null
          })()

          onChange(currentOrigin, newDest)

          if (currentOrigin) {
            if (routeLine.current) {
              routeLine.current.setLatLngs([
                [currentOrigin.lat, currentOrigin.lng],
                [lat, lng],
              ])
            } else {
              routeLine.current = L.polyline(
                [[currentOrigin.lat, currentOrigin.lng], [lat, lng]],
                { color: '#3b82f6', weight: 3, dashArray: '6 4' }
              ).addTo(map)
            }

            map.fitBounds([
              [currentOrigin.lat, currentOrigin.lng],
              [lat, lng],
            ], { padding: [40, 40] })
          }

          pickingRef.current = 'origin'
          setPicking('origin')
        }

        setLoading(false)
      })
    }

    init()

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current      = null
        originMarker.current = null
        destMarker.current   = null
        routeLine.current    = null
        pickingRef.current   = 'origin'
      }
    }
  }, [])

  const reset = () => {
    if (originMarker.current) { originMarker.current.remove(); originMarker.current = null }
    if (destMarker.current)   { destMarker.current.remove();   destMarker.current   = null }
    if (routeLine.current)    { routeLine.current.remove();    routeLine.current    = null }
    setLocalOrigin(null)
    setLocalDest(null)
    pickingRef.current = 'origin'
    setPicking('origin')
    onChange(null, null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className={`
            px-3 py-1 rounded-full text-xs font-medium border
            ${picking === 'origin'
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-slate-50 text-slate-400 border-slate-200'
            }
          `}>
            1 · Click origin
          </span>
          <span className={`
            px-3 py-1 rounded-full text-xs font-medium border
            ${picking === 'destination'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-slate-50 text-slate-400 border-slate-200'
            }
          `}>
            2 · Click destination
          </span>
          {loading && (
            <span className="text-xs text-slate-400">Locating...</span>
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
            localOrigin ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'
          }`}>
            <p className="font-medium text-green-700 mb-0.5">Origin</p>
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