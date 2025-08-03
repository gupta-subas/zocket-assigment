'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Card } from '@/components/ui/card'
import { 
  Code2, 
  Eye, 
  Download, 
  Copy, 
  CheckCheck, 
  ExternalLink,
  Expand,
  ChevronDown,
  ChevronUp,
  PanelRight
} from 'lucide-react'
import { CodeEditor } from '@/components/sidebar/code-editor'
import { CodePreview } from '@/components/sidebar/code-preview'
import { CodeArtifact, useAppStore } from '@/lib/store/app-store'
import { getArtifactCode, downloadArtifact } from '@/lib/api/artifacts'
import { buildApiUrl, API_CONFIG } from '@/lib/config/api'

interface InlineArtifactViewerProps {
  artifact: CodeArtifact
  className?: string
}

export function InlineArtifactViewer({ artifact, className = '' }: InlineArtifactViewerProps) {
  const { setCurrentArtifact, setSidebarOpen } = useAppStore()
  const [currentView, setCurrentView] = useState<'code' | 'preview'>('code')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [code, setCode] = useState(artifact.code || '')
  const [isExpanded, setIsExpanded] = useState(false)

  // Load artifact code if not already loaded
  useEffect(() => {
    const loadCode = async () => {
      if (!code && artifact.id) {
        console.log('Inline viewer loading code for artifact:', artifact.id, artifact.title)
        setLoading(true)
        try {
          const artifactCode = await getArtifactCode(artifact.id)
          console.log('Inline viewer loaded code:', {
            artifactId: artifact.id,
            length: artifactCode.code.length,
            preview: artifactCode.code.substring(0, 100) + '...'
          })
          setCode(artifactCode.code)
        } catch (error) {
          console.error('Failed to load artifact code:', error)
        } finally {
          setLoading(false)
        }
      }
    }

    loadCode()
  }, [artifact.id, artifact.title, code])

  const handleDownload = async () => {
    try {
      const blob = await downloadArtifact(artifact.id)
      const url = URL.createObjectURL(blob)
      const element = document.createElement('a')
      element.href = url
      element.download = `${artifact.title}.${getFileExtension(artifact.language)}`
      document.body.appendChild(element)
      element.click()
      document.body.removeChild(element)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download artifact:', error)
    }
  }

  const handleCopy = async () => {
    try {
      if (!code) {
        console.error('No code to copy')
        return
      }
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleOpenInSidebar = async () => {
    console.log('Opening in sidebar:', { 
      artifactId: artifact.id, 
      artifactTitle: artifact.title,
      codeLength: code ? code.length : 'no code',
      codePreview: code ? code.substring(0, 100) + '...' : 'no code'
    })
    
    let finalCode = code
    
    // If we don't have code yet, try to load it
    if (!finalCode && artifact.id) {
      try {
        setLoading(true)
        const artifactCode = await getArtifactCode(artifact.id)
        finalCode = artifactCode.code
        setCode(finalCode)
      } catch (error) {
        console.error('Failed to load code for sidebar:', error)
      } finally {
        setLoading(false)
      }
    }
    
    setCurrentArtifact({ ...artifact, code: finalCode })
    setSidebarOpen(true)
  }

  const handleOpenInNewTab = () => {
    if (artifact.s3Url) {
      window.open(artifact.s3Url, '_blank')
    }
  }

  const isWebLanguage = ['html', 'css', 'javascript', 'tsx', 'jsx', 'typescript', 'react'].includes(
    artifact.language.toLowerCase()
  )
  
  // Debug logging
  console.log('Artifact language check:', {
    language: artifact.language,
    languageLower: artifact.language.toLowerCase(),
    isWebLanguage,
    currentView,
    isExpanded,
    supportedLanguages: ['html', 'css', 'javascript', 'tsx', 'jsx', 'typescript', 'react']
  })

  return (
    <Card className={`overflow-hidden ${className}`}>
      {/* Header */}
      <div className="border-b p-3 bg-muted/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            <span className="font-medium text-sm">{artifact.title}</span>
            <Badge variant="secondary" className="text-xs">{artifact.language}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        
        {/* Always visible controls */}
        <div className="flex items-center justify-between">
          <ToggleGroup
            type="single"
            value={currentView}
            onValueChange={(value) => value && setCurrentView(value as 'code' | 'preview')}
            className="h-8"
          >
            <ToggleGroupItem value="code" size="sm" className="text-xs">
              <Code2 className="h-3 w-3 mr-1" />
              Code
            </ToggleGroupItem>
            {isWebLanguage && (
              <ToggleGroupItem value="preview" size="sm" className="text-xs">
                <Eye className="h-3 w-3 mr-1" />
                Preview
              </ToggleGroupItem>
            )}
          </ToggleGroup>

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 w-8 p-0"
              disabled={loading}
              title="Copy code"
            >
              {copied ? (
                <CheckCheck className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenInSidebar}
              className="h-8 px-2"
              disabled={loading}
              title="View Artifact"
            >
              <PanelRight className="h-3 w-3 mr-1" />
              <span className="text-xs">View Artifact</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-8 w-8 p-0"
              disabled={loading}
              title="Download file"
            >
              <Download className="h-3 w-3" />
            </Button>
            {artifact.s3Url && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenInNewTab}
                className="h-8 w-8 p-0"
                title="Open in new tab"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Content - Collapsible */}
      {isExpanded && (
        <div className="h-96 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-muted-foreground">Loading code...</div>
            </div>
          ) : currentView === 'code' ? (
            <CodeEditor 
              code={code}
              language={artifact.language}
            />
          ) : (
            <CodePreview 
              code={code}
              language={artifact.language}
              title={artifact.title}
            />
          )}
        </div>
      )}
      
      {/* Preview without expansion - compact view */}
      {!isExpanded && (
        <div className="p-3 border-t bg-background">
          <div className="text-xs font-medium text-foreground mb-2">
            {currentView === 'code' ? 'Code snippet:' : 'Preview:'}
          </div>
          {currentView === 'code' ? (
            <div className="relative">
              <pre className="text-xs bg-muted/50 border border-border p-3 rounded-md overflow-hidden font-mono">
                <code className="text-foreground block whitespace-pre-wrap">
                  {code.length > 200 ? `${code.substring(0, 200)}...` : code}
                </code>
              </pre>
              {code.length > 200 && (
                <div className="absolute bottom-1 right-1 text-xs text-muted-foreground bg-background/80 px-1 rounded">
                  +{code.length - 200} more chars
                </div>
              )}
            </div>
          ) : isWebLanguage ? (
            <div className="h-24 border border-border rounded-md overflow-hidden bg-background">
              <iframe
                src={buildApiUrl(API_CONFIG.ENDPOINTS.ARTIFACTS.PREVIEW(artifact.id))}
                className="w-full h-full border-none"
                sandbox="allow-scripts allow-same-origin"
                title={`Preview of ${artifact.title}`}
              />
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic p-3 text-center border border-dashed border-border rounded-md">
              Preview not available for {artifact.language} files
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function getFileExtension(language: string): string {
  const extensions: Record<string, string> = {
    javascript: 'js',
    typescript: 'ts',
    tsx: 'tsx',
    jsx: 'jsx',
    python: 'py',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    csharp: 'cs',
    go: 'go',
    rust: 'rs',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    yaml: 'yml',
    xml: 'xml',
    sql: 'sql',
    bash: 'sh',
    powershell: 'ps1',
  }
  
  return extensions[language.toLowerCase()] || 'txt'
}