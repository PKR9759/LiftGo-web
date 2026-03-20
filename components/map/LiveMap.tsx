'use client'

import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

interface LocationData {
    lat: number
    lng: number
    timestamp: number
}

interface Props {
    driverLocation: LocationData | null
    isDriverOnline: boolean
}

// Center of India map bounds fallback
const CENTER_LNG = 78.9629
const CENTER_LAT = 20.5937

export default function LiveMap({ driverLocation, isDriverOnline }: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<maplibregl.Map | null>(null)
    const markerRef = useRef<maplibregl.Marker | null>(null)

    // 1. Initialise the MapLibre map on mount
    useEffect(() => {
        if (typeof window === 'undefined') return
        if (!containerRef.current || mapRef.current) return

        const apiKey = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY || ''
        const styleUrl = `https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json?api_key=${apiKey}`

        const map = new maplibregl.Map({
            container: containerRef.current,
            style: styleUrl,
            center: [CENTER_LNG, CENTER_LAT],
            zoom: 5,
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
        mapRef.current = map

        return () => {
            if (mapRef.current) {
                mapRef.current.remove()
                mapRef.current = null
            }
        }
    }, [])

    // 2. Watch driverLocation and manage the tracking marker
    useEffect(() => {
        if (!mapRef.current || !driverLocation) return

        const lngLat: [number, number] = [driverLocation.lng, driverLocation.lat]

        if (!markerRef.current) {
            // First time getting location — create marker and fly there
            markerRef.current = new maplibregl.Marker({ color: '#3b82f6' })
                .setLngLat(lngLat)
                .addTo(mapRef.current)

            mapRef.current.flyTo({
                center: lngLat,
                zoom: 15,
                essential: true,
            })
        } else {
            // Subsequent updates — smoothly follow the rider
            markerRef.current.setLngLat(lngLat)
            mapRef.current.panTo(lngLat)
        }
    }, [driverLocation])

    return (
        <div className="relative w-full h-72 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
            <div ref={containerRef} className="w-full h-full" />

            {/* Offline Overlay */}
            {!isDriverOnline && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
                    <div className="rounded-full border border-amber-200 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 shadow-sm">
                        Driver offline
                    </div>
                </div>
            )}
        </div>
    )
}
