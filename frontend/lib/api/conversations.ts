import { buildApiUrl, API_CONFIG, getAuthToken } from '@/lib/config/api'

export interface Conversation {
  id: string
  title: string
  messageCount: number
  lastMessage?: {
    content: string
    role: string
    createdAt: string
  }
  createdAt: string
  updatedAt: string
}

export interface ConversationDetails {
  id: string
  title: string
  messages: Array<{
    id: string
    role: 'USER' | 'ASSISTANT'
    content: string
    createdAt: string
    artifacts: Array<{
      id: string
      title: string
      language: string
      type: string
      s3Key: string
      s3Url: string
      fileSize: number
      createdAt: string
    }>
  }>
  createdAt: string
  updatedAt: string
}

export interface ConversationsResponse {
  conversations: Conversation[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export async function getConversations(
  page: number = 1,
  limit: number = 20,
  search?: string
): Promise<ConversationsResponse> {
  const token = getAuthToken()
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  })
  
  if (search) {
    params.append('search', search)
  }
  
  const response = await fetch(`${buildApiUrl(API_CONFIG.ENDPOINTS.CONVERSATIONS.LIST)}?${params}`, {
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Failed to get conversations')
  }

  return response.json()
}

export async function getConversation(id: string): Promise<{ conversation: ConversationDetails }> {
  const token = getAuthToken()
  
  const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CONVERSATIONS.GET(id)), {
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Failed to get conversation')
  }

  return response.json()
}

export async function updateConversation(id: string, title: string): Promise<void> {
  const token = getAuthToken()
  
  const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CONVERSATIONS.UPDATE(id)), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    body: JSON.stringify({ title })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Failed to update conversation')
  }
}

export async function deleteConversation(id: string): Promise<void> {
  const token = getAuthToken()
  
  const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CONVERSATIONS.DELETE(id)), {
    method: 'DELETE',
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Failed to delete conversation')
  }
}

export async function exportConversation(id: string, format: 'json' | 'markdown' = 'json'): Promise<Blob> {
  const token = getAuthToken()
  
  const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CONVERSATIONS.EXPORT(id, format)), {
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Failed to export conversation')
  }

  return response.blob()
}