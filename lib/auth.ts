// lib/auth.ts

export const getUser = () => {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('liftgo_user')
  return raw ? JSON.parse(raw) : null
}

export const setUser = (user: object) => {
  localStorage.setItem('liftgo_user', JSON.stringify(user))
}

export const clearAuthCache = () => {
  localStorage.removeItem('liftgo_user')
  try {
    document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  } catch (e) { }
}