'use client'

import { useAppStore } from '@/lib/store/app-store'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { 
  Code2, 
  Eye, 
  Download, 
  Copy, 
  CheckCheck, 
  X,
  ExternalLink,
  Package
} from 'lucide-react'
import { CodeEditor } from './code-editor'
import { CodePreview } from './code-preview'
import { useState, useEffect } from 'react'
import { getArtifactCode, downloadArtifact, bundleReactArtifact } from '@/lib/api/artifacts'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function CodeArtifactSidebar() {
  const { 
    currentArtifact, 
    setSidebarOpen, 
    currentView, 
    setCurrentView,
    setCurrentArtifact 
  } = useAppStore()
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [bundling, setBundling] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [code, setCode] = useState(currentArtifact?.code || '')

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1280)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Load artifact code if not already loaded
  useEffect(() => {
    const loadCode = async () => {
      if (currentArtifact && !code && currentArtifact.id) {
        console.log('Sidebar loading code for artifact:', {
          id: currentArtifact.id,
          title: currentArtifact.title,
          hasExistingCode: !!currentArtifact.code
        })
        setLoading(true)
        try {
          const artifactCode = await getArtifactCode(currentArtifact.id)
          console.log('Sidebar loaded code:', {
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
  }, [currentArtifact, code])

  // Update local code when currentArtifact changes
  useEffect(() => {
    if (currentArtifact?.code) {
      console.log('Sidebar using existing code from artifact:', {
        length: currentArtifact.code.length,
        preview: currentArtifact.code.substring(0, 100) + '...'
      })
      setCode(currentArtifact.code)
    } else {
      setCode('')
    }
  }, [currentArtifact])

  // Reset to code view for non-web languages
  useEffect(() => {
    if (currentArtifact) {
      const isWebLang = ['html', 'css', 'javascript', 'tsx', 'jsx', 'typescript', 'react'].includes(
        currentArtifact.language?.toLowerCase() || ''
      )
      if (!isWebLang && currentView === 'preview') {
        setCurrentView('code')
      }
    }
  }, [currentArtifact, currentView, setCurrentView])

  if (!currentArtifact) {
    return null
  }

  const handleDownload = async () => {
    try {
      const blob = await downloadArtifact(currentArtifact.id)
      const url = URL.createObjectURL(blob)
      const element = document.createElement('a')
      element.href = url
      element.download = `${currentArtifact.title}.${getFileExtension(currentArtifact.language)}`
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

  const handleBundle = async () => {
    if (!currentArtifact) return
    
    setBundling(true)
    try {
      const result = await bundleReactArtifact(currentArtifact.id)
      if (result.success && result.bundledHtmlUrl) {
        // Update the current artifact with the new bundled HTML URL
        setCurrentArtifact(prev => prev ? {
          ...prev,
          bundledHtmlUrl: result.bundledHtmlUrl
        } : null)
        
        // Automatically open the bundled version
        window.open(result.bundledHtmlUrl, '_blank')
        
        console.log('React artifact bundled successfully:', result)
      } else {
        console.error('Bundling failed:', result.error || result.errors)
      }
    } catch (error) {
      console.error('Failed to bundle React artifact:', error)
    } finally {
      setBundling(false)
    }
  }

  const handleOpenInNewTab = () => {
    const isReactArtifact = ['react', 'jsx', 'tsx'].includes(currentArtifact.language.toLowerCase()) || 
                           currentArtifact.type === 'REACT'
    
    // For React artifacts, prefer bundled HTML URL if available
    if (isReactArtifact && currentArtifact.bundledHtmlUrl) {
      window.open(currentArtifact.bundledHtmlUrl, '_blank')
    } else if (currentArtifact.s3Url) {
      window.open(currentArtifact.s3Url, '_blank')
    }
  }

  // Check if this is a web language that can be previewed
  const isWebLanguage = ['html', 'css', 'javascript', 'tsx', 'jsx', 'typescript', 'react'].includes(
    currentArtifact?.language?.toLowerCase() || ''
  )

  const sidebarContent = (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-3">
        {/* View Toggle */}
        <ToggleGroup
          type="single"
          value={currentView}
          onValueChange={(value) => value && setCurrentView(value as 'code' | 'preview')}
          size="sm"
        >
          <ToggleGroupItem value="code">
            <Code2 className="h-4 w-4 mr-1" />
            Code
          </ToggleGroupItem>
          {isWebLanguage && (
            <ToggleGroupItem value="preview">
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </ToggleGroupItem>
          )}
        </ToggleGroup>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            disabled={loading}
          >
            {copied ? (
              <CheckCheck className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            <span className="sr-only">Copy code</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            disabled={loading}
          >
            <Download className="h-4 w-4" />
            <span className="sr-only">Download</span>
          </Button>
          {/* Bundle button for React artifacts */}
          {(['react', 'jsx', 'tsx'].includes(currentArtifact.language.toLowerCase()) || currentArtifact.type === 'REACT') && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBundle}
              disabled={loading || bundling}
              title={currentArtifact.bundledHtmlUrl ? "Re-bundle React component" : "Bundle React component for preview"}
            >
              <Package className={`h-4 w-4 ${bundling ? 'animate-spin' : ''}`} />
              <span className="sr-only">Bundle React component</span>
            </Button>
          )}
          {currentArtifact.s3Url && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenInNewTab}
              title={
                (['react', 'jsx', 'tsx'].includes(currentArtifact.language.toLowerCase()) || currentArtifact.type === 'REACT') && currentArtifact.bundledHtmlUrl
                  ? "Open bundled React component"
                  : "Open in new tab"
              }
            >
              <ExternalLink className="h-4 w-4" />
              <span className="sr-only">Open in new tab</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading code...</div>
          </div>
        ) : currentView === 'code' ? (
          code ? (
            <div className="h-full">
              <CodeEditor 
                code={code}
                language={currentArtifact.language}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Failed to load code
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const loadCode = async () => {
                      if (currentArtifact?.id) {
                        setLoading(true)
                        try {
                          const artifactCode = await getArtifactCode(currentArtifact.id)
                          setCode(artifactCode.code)
                        } catch (error) {
                          console.error('Failed to reload artifact code:', error)
                        } finally {
                          setLoading(false)
                        }
                      }
                    }
                    loadCode()
                  }}
                >
                  Retry Loading
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="h-full">
            <CodePreview 
              code={code || ''}
              language={currentArtifact.language}
              title={currentArtifact.title}
            />
          </div>
        )}
      </div>
    </div>
  )

  // Mobile modal view
  if (isMobile) {
    return (
      <Dialog open={true} onOpenChange={(open) => !open && setSidebarOpen(false)}>
        <DialogContent className="h-[90vh] max-w-[95vw] p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Code Artifact</DialogTitle>
          </DialogHeader>
          {sidebarContent}
        </DialogContent>
      </Dialog>
    )
  }

  // Desktop sidebar view
  return sidebarContent
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