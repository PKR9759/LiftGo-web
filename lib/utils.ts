import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function haversineDistance(
  coords1: { lat: number; lng: number },
  coords2: { lat: number; lng: number }
) {
  function toRad(x: number) {
    return (x * Math.PI) / 180
  }
  const R = 6371e3 // metres
  const dLat = toRad(coords2.lat - coords1.lat)
  const dLng = toRad(coords2.lng - coords1.lng)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coords1.lat)) *
    Math.cos(toRad(coords2.lat)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

