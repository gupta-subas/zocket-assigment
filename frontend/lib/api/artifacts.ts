import { buildApiUrl, API_CONFIG, getAuthToken } from '@/lib/config/api'

export interface ArtifactCode {
  code: string
  artifact: {
    id: string
    title: string
    language: string
    type: string
    fileSize: number
    createdAt: string
  }
}

export async function getArtifactCode(artifactId: string): Promise<ArtifactCode> {
  const token = getAuthToken()
  
  const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.ARTIFACTS.CODE(artifactId)), {
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Failed to get artifact code')
  }

  return response.json()
}

export async function downloadArtifact(artifactId: string): Promise<Blob> {
  const token = getAuthToken()
  
  const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.ARTIFACTS.DOWNLOAD(artifactId)), {
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Failed to download artifact')
  }

  return response.blob()
}


export function getPreviewUrl(artifactId: string): string {
  const token = getAuthToken()
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : ''
  return `${buildApiUrl(API_CONFIG.ENDPOINTS.ARTIFACTS.PREVIEW(artifactId))}${tokenParam}`
}

export interface HtmlExportResponse {
  success: boolean
  htmlContent?: string
  fileName?: string
  error?: string
}

export async function exportArtifactAsHtml(artifactId: string): Promise<HtmlExportResponse> {
  const token = getAuthToken()
  
  const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.ARTIFACTS.HTML_EXPORT(artifactId)), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Failed to export artifact as HTML')
  }

  return response.json()
}

export interface BundleResponse {
  success: boolean
  message?: string
  bundledHtmlUrl?: string
  buildResult?: {
    bundleSize: number
    buildTime: number
    dependencies: string[]
    installedPackages: string[]
  }
  error?: string
  errors?: string[]
}

export async function bundleReactArtifact(artifactId: string): Promise<BundleResponse> {
  const token = getAuthToken()
  
  const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.ARTIFACTS.BUNDLE(artifactId)), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Failed to bundle React artifact')
  }

  return response.json()
}