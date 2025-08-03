'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'
import { useAppStore } from '@/lib/store/app-store'
import { getPreviewUrl } from '@/lib/api/artifacts'

interface CodePreviewProps {
  code: string
  language: string
  title: string
}

export function CodePreview({ code, language, title }: CodePreviewProps) {
  const { currentArtifact } = useAppStore()
  const isWebLanguage = ['html', 'css', 'javascript', 'tsx', 'jsx', 'typescript', 'react'].includes(language.toLowerCase())
  
  if (!isWebLanguage) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Card className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-medium mb-2">Preview Not Available</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Preview is only available for web languages (HTML, CSS, JavaScript, React).
          </p>
          <Badge variant="secondary">{language}</Badge>
        </Card>
      </div>
    )
  }

  // Always use backend preview for React components when we have an artifact
  const getArtifactPreviewUrl = () => {
    // For React components, always try backend preview first
    if (['javascript', 'jsx', 'tsx', 'typescript', 'react'].includes(language.toLowerCase())) {
      if (currentArtifact?.id) {
        console.log('Using backend preview for React component:', currentArtifact.id)
        return getPreviewUrl(currentArtifact.id)
      }
      // If no artifact ID but it's React code, encourage saving
      console.log('React code detected but no artifact ID available')
    }
    
    // For non-React with artifact, also use backend
    if (currentArtifact?.id) {
      console.log('Using backend preview for artifact:', currentArtifact.id)
      return getPreviewUrl(currentArtifact.id)
    }
    
    // Fallback to local preview generation
    const createPreviewContent = () => {
      if (language.toLowerCase() === 'html') {
        return code
      }
      
      if (language.toLowerCase() === 'css') {
        return `
          <!DOCTYPE html>
          <html>
            <head>
              <style>${code}</style>
            </head>
            <body>
              <div class="preview-container">
                <h1>CSS Preview</h1>
                <p>Your CSS styles are applied to this document.</p>
              </div>
            </body>
          </html>
        `
      }
      
      if (['javascript', 'jsx', 'tsx', 'typescript', 'react'].includes(language.toLowerCase())) {
        // For React code, show message to save as artifact for proper bundling
        return `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: system-ui; padding: 40px; text-align: center; background: #f5f5f5; }
                .message { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
                .icon { font-size: 48px; margin-bottom: 20px; }
              </style>
            </head>
            <body>
              <div class="message">
                <div class="icon">⚡</div>
                <h3>Enhanced React Preview Available</h3>
                <p>Save this code as an artifact to preview with enhanced bundling, dependency management, and optimized React rendering.</p>
                <p><small>This enables advanced features like automatic dependency installation, tree shaking, and proper ReactDOM handling.</small></p>
              </div>
            </body>
          </html>
        `
      }
      
      return code
    }

    const previewContent = createPreviewContent()
    const blob = new Blob([previewContent], { type: 'text/html' })
    return URL.createObjectURL(blob)
  }

  const previewUrl = getArtifactPreviewUrl()

  return (
    <div className="h-full w-full p-4">
      <iframe
        src={previewUrl}
        className="w-full h-full border rounded-md"
        sandbox="allow-scripts allow-same-origin"
        title={`Preview of ${title}`}
      />
    </div>
  )
}