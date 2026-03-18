// lib/geocode.ts
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const data = await res.json()
      if (data.display_name) {
        // shorten to first 2 parts — "Bandra West, Mumbai"
        const parts = data.display_name.split(',')
        return parts.slice(0, 2).join(',').trim()
      }
    } catch {
      // fallback to coords
    }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }