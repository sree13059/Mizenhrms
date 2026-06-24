const DEFAULT_API_BASE_URL = import.meta.env.DEV
  ? 'http://localhost:5000/api'
  : 'https://mizenbackendfile.onrender.com/api'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL)
  .replace(/\/$/, '')
  .replace(/\/api\/?$/i, '/api')
const isLocalApi = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(`${API_BASE_URL}/`)

export const authStorage = {
  getToken() {
    return localStorage.getItem('mizenToken') || localStorage.getItem('token') || ''
  },
  getUser() {
    try {
      return JSON.parse(localStorage.getItem('mizenUser') || 'null')
    } catch {
      return null
    }
  },
  setSession(token, user) {
    localStorage.setItem('mizenToken', token)
    localStorage.setItem('token', token)
    localStorage.setItem('mizenUser', JSON.stringify(user))
    localStorage.setItem('mizenRole', user.role)
    localStorage.setItem('mizenAdminLoggedIn', user.role === 'admin' ? 'true' : 'false')
  },
  clearSession() {
    localStorage.removeItem('mizenToken')
    localStorage.removeItem('token')
    localStorage.removeItem('mizenUser')
    localStorage.removeItem('mizenRole')
    localStorage.removeItem('mizenAdminLoggedIn')
  },
}

export async function apiRequest(path, options = {}) {
  const token = authStorage.getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    })
  } catch {
    throw new Error(
      isLocalApi
        ? 'HRMS Backend is offline. Start the Backend on localhost:5000 and try again.'
        : 'Unable to connect to the deployed HRMS Backend. Render may be waking up; please try again shortly.',
    )
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok || data.success === false) {
    const error = new Error(data.message || `${response.status} ${response.statusText || 'Request failed'}: ${path}`)
    error.status = response.status
    throw error
  }

  return data
}

export async function optionalApiRequest(path, fallback, options = {}) {
  try {
    return await apiRequest(path, options)
  } catch (error) {
    if (error.status === 404) return fallback
    throw error
  }
}
