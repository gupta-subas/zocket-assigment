import { buildApiUrl, API_CONFIG } from '@/lib/config/api'

export interface LoginRequest {
  email: string
  password: string
}



export interface User {
  id: string
  email: string
  username: string
  credits: number
  createdAt: string
  conversationCount?: number
}

export interface AuthResponse {
  message: string
  user: User
  token: string
}

export interface ValidationError {
  field: string
  message: string
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.AUTH.LOGIN), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message || 'Login failed')
  }

  // Store the token
  localStorage.setItem('authToken', result.token)

  return result
}



export async function getCurrentUser(): Promise<{ user: User }> {
  const token = getAuthToken()
  
  if (!token) {
    throw new Error('No auth token found')
  }

  const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.AUTH.ME), {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message || 'Failed to get user')
  }

  return result
}

export async function refreshToken(): Promise<{ token: string }> {
  const token = getAuthToken()
  
  if (!token) {
    throw new Error('No auth token found')
  }

  const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.AUTH.REFRESH), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message || 'Failed to refresh token')
  }

  // Store the new token
  localStorage.setItem('authToken', result.token)

  return result
}

export function logout(): void {
  localStorage.removeItem('authToken')
}

export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('authToken')
  }
  return null
}

export function isAuthenticated(): boolean {
  return !!getAuthToken()
}