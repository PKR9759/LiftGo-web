// lib/geocode.ts
import { reverseGeocodeOla } from './olaMaps'

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  return await reverseGeocodeOla(lat, lng)
}