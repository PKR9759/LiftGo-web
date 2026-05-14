// lib/api.ts
import axios from 'axios'
import type {
  AuthResponse, User, Ride, Booking, Review
} from '@/types'

const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

let isRefreshing = false

let failedQueue: Array<{ resolve: (value?: unknown) => void, reject: (reason?: any) => void }> = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Do not intercept if the failed request was the refresh token request itself
    if (originalRequest.url === '/api/auth/refresh') {
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject })
        })
          .then(() => {
            return client(originalRequest)
          })
          .catch((err) => {
            return Promise.reject(err)
          })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        await client.post('/api/auth/refresh')
        processQueue(null, 'refreshed')
        return client(originalRequest)
      } catch (err) {
        processQueue(err, null)
        if (typeof window !== 'undefined') {
          const isAuthPage = window.location.pathname.startsWith('/auth/')
          if (!isAuthPage) {
            window.location.href = '/auth/login'
          }
        }
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

// ── auth ──────────────────────────────────────────────────
export const register = (data: {
  name: string; email: string; password: string
  phone?: string; role?: string
}) => client.post<AuthResponse>('/api/auth/register', data)

export const login = (data: {
  email: string; password: string
}) => client.post<AuthResponse>('/api/auth/login', data)

export const logoutUser = () => client.post<{ message: string }>('/api/auth/logout')

export const getAuthMe = () => client.get<{ user: User }>('/api/auth/me')

export const refreshAuth = () => client.post<{ access_token: string }>('/api/auth/refresh')

// ── users ─────────────────────────────────────────────────
export const getMe = () =>
  client.get<User>('/api/users/me')

export const updateMe = (data: Partial<User>) =>
  client.put<User>('/api/users/me', data)

export const getUserReviews = (userID: string) =>
  client.get<Review[]>(`/api/users/${userID}/reviews`)

// ── rides ─────────────────────────────────────────────────
export const getNearbyRides = (params: {
  origin_lat: number; origin_lng: number
  dest_lat: number; dest_lng: number
  radius?: number
  seats_needed?: number
}) => client.get<Ride[]>('/api/rides/nearby', { params })

export const getRide = (id: string) =>
  client.get<Ride>(`/api/rides/${id}`)

export const getMyRides = () =>
  client.get<Ride[]>('/api/rides/mine')

export const createRide = (data: {
  origin_lat: number; origin_lng: number; origin_label: string
  dest_lat: number; dest_lng: number; dest_label: string
  departure_at: string; total_seats: number
  price_per_seat: number; is_recurring: boolean
  recurrence_days?: number[]; notes?: string
  waypoints?: Array<{ lat: number; lng: number }>
}) => client.post<Ride>('/api/rides', data)

export const updateRideStatus = (id: string, status: 'active' | 'completed') =>
  client.put<{ message: string }>(`/api/rides/${id}/status`, { status })

export const cancelRide = (id: string) =>
  client.delete(`/api/rides/${id}`)

// ── bookings ──────────────────────────────────────────────
export const createBooking = (data: {
  ride_id: string; seats: number
  pickup_lat: number
  pickup_lng: number
  dropoff_lat: number
  dropoff_lng: number
}) => client.post<Booking>('/api/bookings', data)

export const getMyBookings = () =>
  client.get<Booking[]>('/api/bookings/mine')

export const getIncomingBookings = () =>
  client.get<Booking[]>('/api/bookings/incoming')

export const getBooking = (id: string) =>
  client.get<Booking>(`/api/bookings/${id}`)

export const getRideBookings = (rideId: string) =>
  client.get<Booking[]>(`/api/rides/${rideId}/bookings`)

export const startRide = (rideId: string) =>
  client.put<{ message: string }>(`/api/rides/${rideId}/start-ride`)

export const getRideStatusSummary = (rideId: string) =>
  client.get<{
    ride: {
      id: string; status: string; departure_at: string
      available_seats: number; total_seats: number
      minutes_until_departure: number
      can_cancel: boolean; can_start: boolean
      cancellation_deadline: string
    }
    user_booking: {
      id: string; status: string; seats: number
      can_cancel: boolean; can_mark_ready: boolean
    } | null
  }>(`/api/rides/${rideId}/status-summary`)

export const confirmBooking = (id: string) =>
  client.put<Booking>(`/api/bookings/${id}/confirm`)

export const cancelBooking = (id: string) =>
  client.put<Booking>(`/api/bookings/${id}/cancel`)

export const markRiderReady = (id: string, riderLat?: number, riderLng?: number) =>
  client.put<Booking>(`/api/bookings/${id}/rider-ready`, {
    rider_lat: riderLat,
    rider_lng: riderLng
  })

export const markPickedUp = (id: string, driverLat: number, driverLng: number) =>
  client.put<Booking>(`/api/bookings/${id}/picked-up`, {
    driver_lat: driverLat,
    driver_lng: driverLng
  })

export const markDropped = (id: string) =>
  client.put<Booking>(`/api/bookings/${id}/dropped`)

export const markNoShow = (id: string) =>
  client.put<Booking>(`/api/bookings/${id}/no-show`)

// ── reviews ───────────────────────────────────────────────
export const createReview = (data: {
  booking_id: string; reviewee_id: string
  rating: number; comment?: string
}) => client.post<Review>('/api/reviews', data)

// ── notifications ────────────────────────────────────────
export const subscribePush = (data: { endpoint: string, p256dh: string, auth: string }) =>
  client.post('/api/push/subscribe', data)