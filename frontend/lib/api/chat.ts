import { buildApiUrl, API_CONFIG, getAuthToken } from '@/lib/config/api'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface Artifact {
  id: string
  title: string
  language: string
  type: string
  s3Key: string
  s3Url: string
  bundledHtmlKey?: string
  bundledHtmlUrl?: string
  fileSize: number
  createdAt: string
}

export interface ChatResponse {
  message: string
  data: {
    messageId: string
    conversationId: string
    response: string
    artifacts: Artifact[]
    builds: number
    security?: {
      isSecure: boolean
      riskLevel: string
      score: number
      issues: number
    }
  }
}


export async function sendChatMessage(
  message: string,
  conversationId?: string
): Promise<ChatResponse> {
  const token = getAuthToken()
  
  const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CHAT.SEND), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    body: JSON.stringify({ 
      message,
      conversationId,
      stream: false,
      enableSecurity: true,
      enableBuilding: true,
      enablePreview: true
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Failed to send message')
  }

  return response.json()
}

export async function streamChatMessage(
  message: string,
  onMessage: (chunk: string) => void,
  onArtifact?: (artifact: { id: string; title: string; language: string; type: string; s3Key: string; s3Url: string; size: number }) => void,
  onBuild?: (build: { status: string; message?: string; buildId?: string }) => void,
  conversationId?: string
): Promise<{ conversationId: string; messageId: string } | void> {
  const token = getAuthToken()
  
  const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CHAT.SEND), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    body: JSON.stringify({ 
      message,
      conversationId,
      stream: true,
      enableSecurity: true,
      enableBuilding: true,
      enablePreview: true
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Failed to send message')
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let conversationMetadata: { conversationId: string; messageId: string } | null = null

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.trim())

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            return conversationMetadata || undefined
          }

          try {
            const parsed = JSON.parse(data)
            
            if (parsed.type === 'chunk') {
              if (parsed.data.text) {
                onMessage(parsed.data.text)
              } else if (parsed.data.type === 'artifact' && onArtifact) {
                onArtifact(parsed.data.artifact)
              } else if (parsed.data.type === 'build' && onBuild) {
                onBuild(parsed.data.buildResult)
              }
            } else if (parsed.type === 'metadata' && parsed.data.conversationId) {
              conversationMetadata = {
                conversationId: parsed.data.conversationId,
                messageId: parsed.data.messageId
              }
            } else if (parsed.type === 'error') {
              throw new Error(parsed.data.error || 'Stream error occurred')
            }
          } catch (e) {
            console.error('Failed to parse SSE data:', e)
            if (e instanceof Error && e.message.includes('Stream error')) {
              throw e
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
  
  return conversationMetadata || undefined
}