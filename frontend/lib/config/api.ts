// Centralized API configuration
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001',
  ENDPOINTS: {
    // Auth endpoints
    AUTH: {
      LOGIN: '/api/auth/login',
      ME: '/api/auth/me',
      REFRESH: '/api/auth/refresh'
    },
    // Chat endpoints
    CHAT: {
      SEND: '/api/chat/send',
      REGENERATE: (messageId: string) => `/api/chat/regenerate/${messageId}`
    },
    // Conversation endpoints  
    CONVERSATIONS: {
      LIST: '/api/conversations',
      GET: (id: string) => `/api/conversations/${id}`,
      UPDATE: (id: string) => `/api/conversations/${id}`,
      DELETE: (id: string) => `/api/conversations/${id}`,
      EXPORT: (id: string, format: string = 'json') => `/api/conversations/${id}/export?format=${format}`
    },
    // Artifact endpoints
    ARTIFACTS: {
      GET: (id: string) => `/api/artifacts/${id}`,
      CODE: (id: string) => `/api/artifacts/${id}/code`,
      DOWNLOAD: (id: string) => `/api/artifacts/${id}/download`, 
      PREVIEW: (id: string) => `/api/artifacts/${id}/preview`,
      HTML_EXPORT: (id: string) => `/api/artifacts/${id}/html-export`,
      BUNDLE: (id: string) => `/api/artifacts/${id}/bundle`
    }
  }
} as const

// Helper function to build full URLs
export function buildApiUrl(endpoint: string): string {
  return `${API_CONFIG.BASE_URL}${endpoint}`
}

// Helper function to get auth token
export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('authToken')
  }
  return null
}

// Helper function to build auth headers
export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken()
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  }
}