'use client'

import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

interface LocationData {
    lat: number
    lng: number
    timestamp: number
}

interface RiderMarker {
    bookingId: string
    lat: number
    lng: number
    name: string
    status: string
}

interface Props {
    driverLocation: LocationData | null
    isDriverOnline: boolean
    pickupLocation?: { lat: number, lng: number, label: string }
    riderMarkers?: RiderMarker[]
}

// Center of India map bounds fallback
const CENTER_LNG = 78.9629
const CENTER_LAT = 20.5937

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3 // metres
    const φ1 = lat1 * Math.PI / 180
    const φ2 = lat2 * Math.PI / 180
    const Δφ = (lat2 - lat1) * Math.PI / 180
    const Δλ = (lon2 - lon1) * Math.PI / 180

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
}

export default function LiveMap({ driverLocation, isDriverOnline, pickupLocation, riderMarkers }: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<maplibregl.Map | null>(null)
    const markerRef = useRef<maplibregl.Marker | null>(null)
    const pickupMarkerRef = useRef<maplibregl.Marker | null>(null)
    const riderMarkersRef = useRef<maplibregl.Marker[]>([])
    const [distanceMeter, setDistanceMeter] = React.useState<number | null>(null)

    // 1. Initialise the MapLibre map on mount
    useEffect(() => {
        if (typeof window === 'undefined') return
        if (!containerRef.current || mapRef.current) return

        const apiKey = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY || ''
        const styleUrl = `https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json?api_key=${apiKey}`

        fetch(styleUrl)
            .then(res => res.json())
            .then(style => {
                // Filter out 3d_model layers that cause MapLibre errors
                if (style && style.layers) {
                    style.layers = style.layers.filter((layer: any) =>
                        layer.id !== '3d_model_data' && layer['source-layer'] !== '3d_model'
                    )
                }

                const map = new maplibregl.Map({
                    container: containerRef.current!,
                    style: style,
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

                // Suppress missing image warnings (like 'pedestrian_polygon')
                map.on('styleimagemissing', (e) => {
                    console.warn(`Map style missing image: ${e.id}. Using placeholder.`);
                    // Optionally add a transparent 1x1 pixel image to stop the error/warning spam
                    const canvas = document.createElement('canvas');
                    canvas.width = 1;
                    canvas.height = 1;
                    const context = canvas.getContext('2d');
                    if (context) {
                        const imageData = context.getImageData(0, 0, 1, 1);
                        map.addImage(e.id, imageData);
                    }
                });

                if (pickupLocation) {
                    pickupMarkerRef.current = new maplibregl.Marker({ color: '#ef4444' }) // red
                        .setLngLat([pickupLocation.lng, pickupLocation.lat])
                        .setPopup(new maplibregl.Popup({ offset: 25 }).setText(pickupLocation.label))
                        .addTo(map)
                }
            })
            .catch(err => console.error('Error loading map style:', err))

        return () => {
            if (mapRef.current) {
                mapRef.current.remove()
                mapRef.current = null
            }
        }
    }, [pickupLocation])

    // 2. Watch driverLocation and manage the tracking marker
    useEffect(() => {
        if (!mapRef.current || !driverLocation) return

        const lngLat: [number, number] = [driverLocation.lng, driverLocation.lat]

        if (!markerRef.current) {
            // First time getting location — create marker and fly there
            markerRef.current = new maplibregl.Marker({ color: '#3b82f6' }) // blue
                .setLngLat(lngLat)
                .addTo(mapRef.current)

            mapRef.current.flyTo({
                center: lngLat,
                zoom: 15,
                essential: true,
            })
        } else {
            // Subsequent updates — smoothly follow the driver
            markerRef.current.setLngLat(lngLat)
            mapRef.current.panTo(lngLat)
        }

        if (pickupLocation) {
            setDistanceMeter(getDistance(driverLocation.lat, driverLocation.lng, pickupLocation.lat, pickupLocation.lng))
        }
    }, [driverLocation, pickupLocation])

    // 3. Watch riderMarkers and create/update pins for waiting riders
    useEffect(() => {
        if (!mapRef.current || !riderMarkers?.length) return

        // Clear old rider markers
        riderMarkersRef.current.forEach(m => m.remove())
        riderMarkersRef.current = []

        riderMarkers.forEach(rider => {
            if (!rider.lat || !rider.lng) return
            if (rider.status === 'picked_up' || rider.status === 'completed') return

            // Green marker for riders waiting at pickup
            const el = document.createElement('div')
            el.className = 'rider-marker'
            el.innerHTML = `
                <div style="
                    background: #16a34a; 
                    color: white; 
                    border-radius: 50%; 
                    width: 36px; height: 36px;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 16px; font-weight: bold;
                    border: 2px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                ">
                    ${rider.name.charAt(0).toUpperCase()}
                </div>
            `

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([rider.lng, rider.lat])
                .setPopup(
                    new maplibregl.Popup({ offset: 25 })
                        .setHTML(`<strong>${rider.name}</strong><br/>Waiting at pickup`)
                )
                .addTo(mapRef.current!)

            riderMarkersRef.current.push(marker)
        })
    }, [riderMarkers])

    return (
        <div className="relative w-full h-72 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
            <div ref={containerRef} className="w-full h-full" />

            {/* Distance Indicator */}
            {distanceMeter !== null && isDriverOnline && (
                <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur shadow-md px-3 py-2 rounded-lg border border-slate-200">
                    <p className="text-xs font-semibold text-slate-700">Distance to Pickup</p>
                    <p className="text-sm font-bold text-blue-600">
                        {distanceMeter > 1000
                            ? `${(distanceMeter / 1000).toFixed(1)} km`
                            : `${Math.round(distanceMeter)} m`} away
                    </p>
                </div>
            )}

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
