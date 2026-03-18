// lib/api.ts
import axios from 'axios'
import { getToken } from './auth'
import type {
  AuthResponse, User, Ride, Seek, Booking, Review
} from '@/types'

const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── auth ──────────────────────────────────────────────────
export const register = (data: {
  name: string; email: string; password: string
  phone?: string; role?: string
}) => client.post<AuthResponse>('/api/auth/register', data)

export const login = (data: {
  email: string; password: string
}) => client.post<AuthResponse>('/api/auth/login', data)

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
  dest_lat: number;   dest_lng: number
  radius?: number
}) => client.get<Ride[]>('/api/rides/nearby', { params })

export const getRide = (id: string) =>
  client.get<Ride>(`/api/rides/${id}`)

export const getMyRides = () =>
  client.get<Ride[]>('/api/rides/mine')

export const createRide = (data: {
  origin_lat: number; origin_lng: number; origin_label: string
  dest_lat: number;   dest_lng: number;   dest_label: string
  departure_at: string; total_seats: number
  price_per_seat: number; is_recurring: boolean
  recurrence_days?: number[]; notes?: string
}) => client.post<Ride>('/api/rides', data)

export const cancelRide = (id: string) =>
  client.delete(`/api/rides/${id}`)

// ── seeks ─────────────────────────────────────────────────
export const getNearbySeeks = (params: {
  origin_lat: number; origin_lng: number
  dest_lat: number;   dest_lng: number
  radius?: number
}) => client.get<Seek[]>('/api/seeks/nearby', { params })

export const getMySeeks = () =>
  client.get<Seek[]>('/api/seeks/mine')

export const createSeek = (data: {
  origin_lat: number; origin_lng: number; origin_label: string
  dest_lat: number;   dest_lng: number;   dest_label: string
  seats_needed: number; is_recurring: boolean
  recurrence_days?: number[]
}) => client.post<Seek>('/api/seeks', data)

export const cancelSeek = (id: string) =>
  client.delete(`/api/seeks/${id}`)

// ── bookings ──────────────────────────────────────────────
export const createBooking = (data: {
  ride_id: string; seats: number; seek_id?: string
}) => client.post<Booking>('/api/bookings', data)

export const getMyBookings = () =>
  client.get<Booking[]>('/api/bookings/mine')

export const getIncomingBookings = () =>
  client.get<Booking[]>('/api/bookings/incoming')

export const getBooking = (id: string) =>
  client.get<Booking>(`/api/bookings/${id}`)

export const confirmBooking = (id: string) =>
  client.put<Booking>(`/api/bookings/${id}/confirm`)

export const cancelBooking = (id: string) =>
  client.put<Booking>(`/api/bookings/${id}/cancel`)

// ── reviews ───────────────────────────────────────────────
export const createReview = (data: {
  booking_id: string; reviewee_id: string
  rating: number; comment?: string
}) => client.post<Review>('/api/reviews', data)