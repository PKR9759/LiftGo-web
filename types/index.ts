// types/index.ts

export interface User {
  id: string
  name: string
  email: string
  phone?: string
  avatar_url?: string
  avg_rating: number
  total_reviews: number
  role: 'rider' | 'driver' | 'both'
  created_at: string
}

export interface Ride {
  id: string
  driver_id: string
  driver_name: string
  driver_avg_rating: number
  driver_total_reviews: number
  origin_lat: number
  origin_lng: number
  origin_label: string
  dest_lat: number
  dest_lng: number
  dest_label: string
  departure_at: string
  total_seats: number
  available_seats: number
  price_per_seat: number
  is_recurring: boolean
  recurrence_days?: number[]
  notes?: string
  status: 'active' | 'full' | 'cancelled' | 'completed'
  created_at: string
}

export interface Seek {
  id: string
  seeker_id: string
  seeker_name: string
  seeker_avg_rating: number
  seeker_total_reviews: number
  origin_lat: number
  origin_lng: number
  origin_label: string
  dest_lat: number
  dest_lng: number
  dest_label: string
  seats_needed: number
  is_recurring: boolean
  recurrence_days?: number[]
  status: 'active' | 'matched' | 'expired' | 'cancelled'
  expires_at: string
  created_at: string
}

export interface Booking {
  id: string
  ride_id: string
  rider_id: string
  rider_name: string
  driver_id: string
  driver_name: string
  seek_id?: string
  origin_label: string
  dest_label: string
  departure_at: string
  seats: number
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  ride_status?: 'active' | 'full' | 'cancelled' | 'completed' | 'scheduled'
  total_price: number
  created_at: string
}

export interface Review {
  id: string
  booking_id: string
  reviewer_id: string
  reviewer_name: string
  reviewee_id: string
  rating: number
  comment?: string
  created_at: string
}

export interface AuthResponse {
  token: string
  user: {
    id: string
    name: string
    email: string
    role: string
  }
}

export interface LatLng {
  lat: number
  lng: number
  label: string
}