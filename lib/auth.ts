// lib/auth.ts
import Cookies from 'js-cookie'

const TOKEN_KEY = 'liftgo_token'
const USER_KEY  = 'liftgo_user'

export const setAuth = (token: string, user: object) => {
  Cookies.set(TOKEN_KEY, token, { expires: 7, sameSite: 'lax' })
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export const getToken = (): string | undefined => {
  return Cookies.get(TOKEN_KEY)
}

export const getUser = () => {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

export const clearAuth = () => {
  Cookies.remove(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export const isLoggedIn = (): boolean => {
  return !!getToken()
}