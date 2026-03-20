// lib/olaMaps.ts

const IS_DEV = process.env.NODE_ENV === 'development'

interface CachedResponse {
    data: any
    timestamp: number
}

const CACHE_KEY_PREFIX = 'olamaps_'
const CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours

function getCache(key: string): any | null {
    if (typeof window === 'undefined') return null
    try {
        const item = sessionStorage.getItem(CACHE_KEY_PREFIX + key)
        if (!item) return null
        const parsed: CachedResponse = JSON.parse(item)
        if (Date.now() - parsed.timestamp > CACHE_TTL) {
            sessionStorage.removeItem(CACHE_KEY_PREFIX + key)
            return null
        }
        return parsed.data
    } catch {
        return null
    }
}

function setCache(key: string, data: any) {
    if (typeof window === 'undefined') return
    try {
        sessionStorage.setItem(
            CACHE_KEY_PREFIX + key,
            JSON.stringify({ data, timestamp: Date.now() })
        )
    } catch {
        // ignore
    }
}

export async function autocompleteOla(query: string) {
    if (!query || query.length < 3) return []

    // Development cache / mock to avoid wasting API requests
    const cacheKey = `auto_${query}`
    const cached = getCache(cacheKey)
    if (IS_DEV && cached) {
        console.log('[Dev] Using cached autocomplete for:', query)
        return cached
    }

    const apiKey = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY
    if (!apiKey || apiKey === 'YOUR_OLA_MAPS_API_KEY_HERE') {
        if (IS_DEV) {
            // Return mock data if no API key is provided yet
            return [
                { place_id: 'mock1', main_text: `Mock ${query} 1`, structured_formatting: { main_text: `Mock ${query} 1`, secondary_text: 'Maharashtra, India' }, geometry: { location: { lat: 19.0760, lng: 72.8777 } } },
                { place_id: 'mock2', main_text: `Mock ${query} 2`, structured_formatting: { main_text: `Mock ${query} 2`, secondary_text: 'Delhi, India' }, geometry: { location: { lat: 28.7041, lng: 77.1025 } } }
            ]
        }
        return []
    }

    try {
        const res = await fetch(`https://api.olamaps.io/places/v1/autocomplete?input=${encodeURIComponent(query)}&api_key=${apiKey}`, {
            headers: { 'X-Request-Id': crypto.randomUUID() }
        })
        const data = await res.json()
        if (data.status === 'ok' && data.predictions) {
            setCache(cacheKey, data.predictions)
            return data.predictions
        }
        return []
    } catch (error) {
        console.error('Ola Autocomplete Error:', error)
        return []
    }
}

export async function reverseGeocodeOla(lat: number, lng: number): Promise<string> {
    const cacheKey = `rev_${lat.toFixed(4)}_${lng.toFixed(4)}`
    const cached = getCache(cacheKey)
    if (IS_DEV && cached) {
        console.log('[Dev] Using cached reverse geocode for:', lat, lng)
        return cached
    }

    const apiKey = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY
    if (!apiKey || apiKey === 'YOUR_OLA_MAPS_API_KEY_HERE') {
        if (IS_DEV) return `Mock Place (${lat.toFixed(2)}, ${lng.toFixed(2)})`
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    }

    try {
        // ola maps reverse geocode API format: reverse-geocode?latlng=LAT,LNG
        const res = await fetch(`https://api.olamaps.io/places/v1/reverse-geocode?latlng=${lat},${lng}&api_key=${apiKey}`, {
            headers: { 'X-Request-Id': crypto.randomUUID() }
        })
        const data = await res.json()
        if (data.status === 'ok' && data.results && data.results.length > 0) {
            // returns detailed results, grab formatted_address
            const label = data.results[0].formatted_address
            const shortLabel = label.split(',').slice(0, 2).join(',').trim()
            setCache(cacheKey, shortLabel)
            return shortLabel
        }
    } catch (error) {
        console.error('Ola Reverse Geocode Error:', error)
    }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

export async function getDirectionsOla(origin: { lat: number; lng: number }, dest: { lat: number; lng: number }) {
    const cacheKey = `dir_${origin.lat.toFixed(4)}_${origin.lng.toFixed(4)}_to_${dest.lat.toFixed(4)}_${dest.lng.toFixed(4)}`
    const cached = getCache(cacheKey)

    if (IS_DEV && cached) {
        console.log('[Dev] Using cached directions')
        return cached
    }

    const apiKey = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY
    if (!apiKey || apiKey === 'YOUR_OLA_MAPS_API_KEY_HERE') {
        if (IS_DEV) {
            // Mock direction geometry (straight line)
            return {
                distance: '10 km',
                duration: '15 mins',
                geometry: {
                    type: 'LineString',
                    coordinates: [[origin.lng, origin.lat], [dest.lng, dest.lat]]
                }
            }
        }
        return null
    }

    try {
        // Ola maps direction api endpoint might differ slightly, using standard direction endpoint
        // "https://api.olamaps.io/routing/v1/directions"
        const url = new URL('https://api.olamaps.io/routing/v1/directions')
        url.searchParams.set('origin', `${origin.lat},${origin.lng}`)
        url.searchParams.set('destination', `${dest.lat},${dest.lng}`)
        url.searchParams.set('api_key', apiKey)

        const res = await fetch(url.toString(), {
            method: "POST", // Many routing APIs require POST due to multiple waypoints, check docs
            headers: {
                'X-Request-Id': crypto.randomUUID(),
                'Content-Type': 'application/json'
            }
        })

        // Fallback GET format if POST fails due to strictness
        const postRes = res.ok ? await res.json() : await (await fetch(url.toString())).json();
        const data = postRes;

        if (data.status === 'SUCCESS' && data.routes && data.routes.length > 0) {
            const route = data.routes[0]
            const distKm = (route.legs[0].distance / 1000).toFixed(1)
            const durMin = Math.round(route.legs[0].duration / 60)
            const hours = Math.floor(durMin / 60)
            const mins = durMin % 60
            const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`

            // Ola direction APIs generally return encoded polyline or straight GeoJSON
            const polyline = (await import('@mapbox/polyline')).default;
            let geometryCoordinates: [number, number][] = []

            if (route.overview_polyline) {
                // decoding geometry string
                geometryCoordinates = polyline.decode(route.overview_polyline)
                    .map(([lat, lng]: [number, number]) => [lng, lat]) // GeoJSON uses Long, Lat
            }

            const result = {
                distance: `${distKm} km`,
                duration: durationStr,
                geometry: {
                    type: 'LineString',
                    coordinates: geometryCoordinates
                }
            }
            setCache(cacheKey, result)
            return result
        }
    } catch (error) {
        console.error('Ola Directions Error:', error)
    }
    return null
}
