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
  status: 'scheduled' | 'active' | 'full' | 'cancelled' | 'completed'
  created_at: string
  route_coordinates?: { lat: number; lng: number }[]
  pickup_distance_m?: number
  dropoff_distance_m?: number
  pickup_fraction?: number
  dropoff_fraction?: number
  route_coverage_pct?: number
  match_score?: number
}

export interface Booking {
  id: string
  ride_id: string
  rider_id: string
  rider_name: string
  driver_id: string
  driver_name: string
  origin_label: string
  dest_label: string
  departure_at: string
  seats: number
  status: 'pending' | 'confirmed' | 'rider_ready' | 'picked_up' | 'no_show' | 'cancelled' | 'completed'
  ride_status?: 'scheduled' | 'active' | 'full' | 'cancelled' | 'completed'
  total_price: number
  picked_up_at?: string
  dropped_at?: string
  created_at: string

  // Extra fields when returned from driver booking list
  rider_rating?: number
  rider_origin_lat?: number
  rider_origin_lng?: number
  rider_dest_lat?: number
  rider_dest_lng?: number
  rider_ready_lat?: number
  rider_ready_lng?: number
  pickup_fraction?: number
  dropoff_fraction?: number
  full_route_price_per_seat?: number
  segment_price_per_seat?: number
  segment_coverage_pct?: number
  total_full_price?: number
  total_savings?: number
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

export interface CreateBookingRequest {
  ride_id: string
  seats: number
  pickup_lat: number
  pickup_lng: number
  dropoff_lat: number
  dropoff_lng: number
}