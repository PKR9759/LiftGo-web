export function getWebSocketBaseUrl() {
  const explicitWsUrl = process.env.NEXT_PUBLIC_WS_URL?.trim()
  if (explicitWsUrl) {
    return explicitWsUrl.replace(/\/$/, '')
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (apiUrl) {
    return apiUrl.replace(/^http/, 'ws').replace(/\/$/, '')
  }

  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = host === 'localhost' || host === '127.0.0.1' ? ':8080' : ''
    return `${protocol}//${host}${port}`
  }

  return 'ws://localhost:8080'
}

export function buildWebSocketUrl(path: string) {
  const baseUrl = getWebSocketBaseUrl()
  return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
}