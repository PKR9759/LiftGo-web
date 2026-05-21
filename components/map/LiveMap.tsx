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
    dropoffLocation?: { lat: number, lng: number, label: string }
    riderMarkers?: RiderMarker[]
    routeCoordinates?: { lat: number; lng: number }[]
    userRole?: 'driver' | 'rider'
    highlightFractionRange?: [number, number] // [start, end]
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

function getBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const φ1 = lat1 * Math.PI / 180
    const φ2 = lat2 * Math.PI / 180
    const Δλ = (lon2 - lon1) * Math.PI / 180

    const y = Math.sin(Δλ) * Math.cos(φ2)
    const x = Math.cos(φ1) * Math.sin(φ2) -
        Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
    const θ = Math.atan2(y, x)
    return (θ * 180 / Math.PI + 360) % 360
}

const CAR_SVG = `
<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="18" fill="white" fill-opacity="0.2" stroke="white" stroke-width="0.5"/>
    <circle cx="20" cy="20" r="14" fill="#3b82f6" fill-opacity="0.2"/>
    <path d="M20 8L26 28L20 25L14 28L20 8Z" fill="#3b82f6" stroke="white" stroke-width="2" stroke-linejoin="round"/>
</svg>
`

export default function LiveMap({ 
    driverLocation, 
    isDriverOnline, 
    pickupLocation, 
    dropoffLocation,
    riderMarkers,
    routeCoordinates,
    userRole = 'rider',
    highlightFractionRange
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<maplibregl.Map | null>(null)
    const markerRef = useRef<maplibregl.Marker | null>(null)
    const carElRef = useRef<HTMLDivElement | null>(null)
    const prevLocationRef = useRef<LocationData | null>(null)
    const pickupMarkerRef = useRef<maplibregl.Marker | null>(null)
    const dropoffMarkerRef = useRef<maplibregl.Marker | null>(null)
    const riderMarkersRef = useRef<maplibregl.Marker[]>([])
    const [distanceMeter, setDistanceMeter] = React.useState<number | null>(null)
    const [etaMinutes, setEtaMinutes] = React.useState<number | null>(null)

    // Helper to handle location updates
    const handleLocationUpdate = (loc: LocationData) => {
        if (!mapRef.current) return
        const lngLat: [number, number] = [loc.lng, loc.lat]

        if (!markerRef.current) {
            const el = document.createElement('div')
            el.className = 'driver-marker-container'
            el.style.transition = 'all 1s linear'
            el.innerHTML = `
                <div class="car-marker" style="transition: transform 0.5s ease-out;">
                    ${CAR_SVG}
                </div>
                <div class="pulse-ring"></div>
            `
            carElRef.current = el.querySelector('.car-marker') as HTMLDivElement

            markerRef.current = new maplibregl.Marker({ element: el })
                .setLngLat(lngLat)
                .addTo(mapRef.current)

            mapRef.current.flyTo({
                center: lngLat,
                zoom: 15,
                essential: true,
            })
        } else {
            if (prevLocationRef.current) {
                const bearing = getBearing(
                    prevLocationRef.current.lat, prevLocationRef.current.lng,
                    loc.lat, loc.lng
                )
                const dist = getDistance(
                    prevLocationRef.current.lat, prevLocationRef.current.lng,
                    loc.lat, loc.lng
                )
                if (dist > 1 && carElRef.current) {
                    carElRef.current.style.transform = `rotate(${bearing}deg)`
                }
            }
            markerRef.current.setLngLat(lngLat)
            mapRef.current.panTo(lngLat, { duration: 1000 })
        }
        prevLocationRef.current = loc
        if (pickupLocation) {
            const dist = getDistance(loc.lat, loc.lng, pickupLocation.lat, pickupLocation.lng)
            setDistanceMeter(dist)
            setEtaMinutes(Math.max(1, Math.round(dist / 500)))
        }
    }

    // 1. Initialise the MapLibre map on mount (ONLY ONCE)
    useEffect(() => {
        if (typeof window === 'undefined') return
        if (!containerRef.current || mapRef.current) return

        const apiKey = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY || ''
        const styleUrl = `https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json?api_key=${apiKey}`

        fetch(styleUrl)
            .then(res => res.json())
            .then(style => {
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

                map.on('styleimagemissing', (e) => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 1;
                    canvas.height = 1;
                    const context = canvas.getContext('2d');
                    if (context) {
                        const imageData = context.getImageData(0, 0, 1, 1);
                        map.addImage(e.id, imageData);
                    }
                });
            })
            .catch(err => console.error('Error loading map style:', err))

        return () => {
            if (mapRef.current) {
                mapRef.current.remove()
                mapRef.current = null
            }
        }
    }, []) // Empty dependency array means this runs only once on mount

    // 1b. Handle Route Highlighting updates
    useEffect(() => {
        const map = mapRef.current
        if (!map || !routeCoordinates || routeCoordinates.length === 0) return

        const updateRoute = () => {
            const fullCoords = routeCoordinates.map(c => [c.lng, c.lat])
            
            // 1. Update Full Route Source
            const source = map.getSource('route') as maplibregl.GeoJSONSource
            if (source) {
                source.setData({
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'LineString', coordinates: fullCoords }
                })
            } else {
                map.addSource('route', {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        properties: {},
                        geometry: { type: 'LineString', coordinates: fullCoords }
                    }
                })

                map.addLayer({
                    id: 'route-glow',
                    type: 'line',
                    source: 'route',
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: {
                        'line-color': '#3b82f6',
                        'line-width': 8,
                        'line-opacity': 0.1 // Much fainter background route
                    }
                })

                map.addLayer({
                    id: 'route-main',
                    type: 'line',
                    source: 'route',
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: {
                        'line-color': '#3b82f6',
                        'line-width': 4,
                        'line-opacity': 0.2 // Much fainter background route
                    }
                })
            }

            // 2. Update Highlighted Segment Source
            if (highlightFractionRange) {
                const [startFrac, endFrac] = highlightFractionRange
                let startIndex = Math.max(0, Math.floor(startFrac * routeCoordinates.length))
                const endIndex = Math.min(routeCoordinates.length - 1, Math.ceil(endFrac * routeCoordinates.length))
                
                let highlightCoords = routeCoordinates.slice(startIndex, endIndex + 1).map(c => [c.lng, c.lat])

                // Navigation style for drivers: line starts from them
                if (userRole === 'driver' && driverLocation && highlightCoords.length > 0) {
                    highlightCoords = [[driverLocation.lng, driverLocation.lat], ...highlightCoords]
                }
                
                const highlightSource = map.getSource('route-highlight') as maplibregl.GeoJSONSource
                if (highlightSource) {
                    highlightSource.setData({
                        type: 'Feature',
                        properties: {},
                        geometry: { type: 'LineString', coordinates: highlightCoords }
                    })
                } else {
                    map.addSource('route-highlight', {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            properties: {},
                            geometry: { type: 'LineString', coordinates: highlightCoords }
                        }
                    })

                    map.addLayer({
                        id: 'route-highlight-glow',
                        type: 'line',
                        source: 'route-highlight',
                        layout: { 'line-join': 'round', 'line-cap': 'round' },
                        paint: {
                            'line-color': '#2563eb', // Deeper blue
                            'line-width': 10,
                            'line-opacity': 0.3
                        }
                    })

                    map.addLayer({
                        id: 'route-highlight-main',
                        type: 'line',
                        source: 'route-highlight',
                        layout: { 'line-join': 'round', 'line-cap': 'round' },
                        paint: {
                            'line-color': '#2563eb', // Deeper blue
                            'line-width': 5
                        }
                    })
                }

                // Auto-fit to highlight if it's the first time
                if (highlightCoords.length > 1) {
                    const bounds = new maplibregl.LngLatBounds()
                    highlightCoords.forEach(c => bounds.extend(c as [number, number]))
                    map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 2000 })
                }
            } else if (map.getSource('route-highlight')) {
                // If no highlight range provided, clear it
                (map.getSource('route-highlight') as maplibregl.GeoJSONSource).setData({
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'LineString', coordinates: [] }
                })
            }
        }

        if (map.isStyleLoaded()) {
            updateRoute()
        } else {
            map.once('load', updateRoute)
        }
    }, [routeCoordinates, highlightFractionRange])

    // 1c. Handle Pickup and Dropoff marker updates
    useEffect(() => {
        const map = mapRef.current
        if (!map) return

        // Pickup Marker
        if (pickupLocation) {
            if (pickupMarkerRef.current) {
                pickupMarkerRef.current.setLngLat([pickupLocation.lng, pickupLocation.lat])
            } else {
                const el = document.createElement('div')
                el.className = 'pickup-marker'
                el.innerHTML = `<div class="marker-pulse" style="background: #ef4444"></div>`
                
                pickupMarkerRef.current = new maplibregl.Marker({ element: el })
                    .setLngLat([pickupLocation.lng, pickupLocation.lat])
                    .setPopup(new maplibregl.Popup({ offset: 25 }).setText(`Pickup: ${pickupLocation.label}`))
                    .addTo(map)
            }
        } else if (pickupMarkerRef.current) {
            pickupMarkerRef.current.remove()
            pickupMarkerRef.current = null
        }

        // Dropoff Marker
        if (dropoffLocation) {
            if (dropoffMarkerRef.current) {
                dropoffMarkerRef.current.setLngLat([dropoffLocation.lng, dropoffLocation.lat])
            } else {
                const el = document.createElement('div')
                el.className = 'dropoff-marker'
                el.innerHTML = `<div class="marker-pulse" style="background: #10b981"></div>`

                dropoffMarkerRef.current = new maplibregl.Marker({ element: el })
                    .setLngLat([dropoffLocation.lng, dropoffLocation.lat])
                    .setPopup(new maplibregl.Popup({ offset: 25 }).setText(`Dropoff: ${dropoffLocation.label}`))
                    .addTo(map)
            }
        } else if (dropoffMarkerRef.current) {
            dropoffMarkerRef.current.remove()
            dropoffMarkerRef.current = null
        }
    }, [pickupLocation, dropoffLocation])

    // 2. Watch driverLocation and manage the tracking marker
    useEffect(() => {
        if (!mapRef.current || !driverLocation) return
        handleLocationUpdate(driverLocation)
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
        <div className="relative w-full h-80 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shadow-inner">
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes pulse-ring {
                    0% { transform: scale(0.33); opacity: 1; }
                    80%, 100% { opacity: 0; }
                }
                .marker-pulse {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    position: relative;
                }
                .marker-pulse::before {
                    content: '';
                    position: absolute;
                    width: 300%;
                    height: 300%;
                    margin-left: -100%;
                    margin-top: -100%;
                    border-radius: 50%;
                    background-color: inherit;
                    animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
                    opacity: 0.5;
                }
                .marker-pulse::after {
                    content: '';
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    background-color: inherit;
                    border: 3px solid white;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                .driver-marker-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .pulse-ring {
                    position: absolute;
                    width: 60px;
                    height: 60px;
                    border: 2px solid #3b82f6;
                    border-radius: 50%;
                    animation: pulse-ring 2s infinite;
                    pointer-events: none;
                }
            `}} />

            <div ref={containerRef} className="w-full h-full" />

            {/* Glassmorphism Info Card */}
            {distanceMeter !== null && isDriverOnline && (
                <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center bg-white/70 backdrop-blur-md shadow-xl px-4 py-3 rounded-2xl border border-white/40 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {userRole === 'driver' ? 'Next Point' : 'Driver Arriving'}
                            </p>
                            <p className="text-sm font-extrabold text-slate-900 leading-tight">
                                {distanceMeter > 1000
                                    ? `${(distanceMeter / 1000).toFixed(1)} km`
                                    : `${Math.round(distanceMeter)} m`}
                                <span className="mx-1 text-slate-300">|</span>
                                {etaMinutes} min
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-100 border border-green-200">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-[10px] font-bold text-green-700 uppercase">Live</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Offline Overlay */}
            {!isDriverOnline && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/10 backdrop-blur-[1px]">
                    <div className="rounded-2xl bg-white/90 backdrop-blur-md px-6 py-3 text-sm font-bold text-slate-800 shadow-2xl border border-white/50 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                        Driver is currently offline
                    </div>
                </div>
            )}

            {/* Bottom Controls Placeholder */}
            <div className="absolute bottom-4 left-4 z-10 flex gap-2">
                <div className="bg-white/70 backdrop-blur-md p-2 rounded-lg border border-white/40 shadow-lg text-[10px] font-bold text-slate-500 uppercase">
                    LiftGo Real-time
                </div>
            </div>
        </div>
    )
}
