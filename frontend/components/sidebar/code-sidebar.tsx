'use client'

import { useAppStore } from '@/lib/store/app-store'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  X, 
  Download, 
  Code2, 
  Eye,
  Copy,
  CheckCheck
} from 'lucide-react'
import { CodeEditor } from './code-editor'
import { CodePreview } from './code-preview'
import { useState } from 'react'

export function CodeSidebar() {
  const { 
    currentArtifact, 
    setSidebarOpen, 
    currentView, 
    setCurrentView 
  } = useAppStore()
  const [copied, setCopied] = useState(false)

  if (!currentArtifact) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center text-muted-foreground">
          <Code2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No code artifact to display</p>
        </div>
      </div>
    )
  }

  const handleDownload = () => {
    const element = document.createElement('a')
    const file = new Blob([currentArtifact.code || ''], { type: 'text/plain' })
    element.href = URL.createObjectURL(file)
    element.download = currentArtifact.filename || `${currentArtifact.title}.${getFileExtension(currentArtifact.language)}`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentArtifact.code || '')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="h-full flex flex-col bg-sidebar">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-sidebar-primary" />
            <span className="font-medium text-sidebar-foreground">Code Artifact</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(false)}
            className="h-8 w-8 p-0 hover:bg-sidebar-accent"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sidebar-foreground">
              {currentArtifact.title}
            </h3>
            <Badge variant="secondary" className="text-xs">
              {currentArtifact.language}
            </Badge>
          </div>

          {currentArtifact.filename && (
            <p className="text-sm text-sidebar-foreground/70">
              {currentArtifact.filename}
            </p>
          )}
        </div>

        <Separator className="my-3" />

        {/* View Toggle */}
        <div className="flex items-center justify-between">
          <ToggleGroup
            type="single"
            value={currentView}
            onValueChange={(value) => value && setCurrentView(value as 'code' | 'preview')}
            className="gap-1"
          >
            <ToggleGroupItem 
              value="code" 
              size="sm"
              className="data-[state=on]:bg-sidebar-primary data-[state=on]:text-sidebar-primary-foreground"
            >
              <Code2 className="h-3 w-3 mr-1" />
              Code
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="preview" 
              size="sm"
              className="data-[state=on]:bg-sidebar-primary data-[state=on]:text-sidebar-primary-foreground"
            >
              <Eye className="h-3 w-3 mr-1" />
              Preview
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 px-2 hover:bg-sidebar-accent"
            >
              {copied ? (
                <CheckCheck className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-8 px-2 hover:bg-sidebar-accent"
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {currentView === 'code' ? (
          <CodeEditor 
            code={currentArtifact.code || ''}
            language={currentArtifact.language}
          />
        ) : (
          <CodePreview 
            code={currentArtifact.code || ''}
            language={currentArtifact.language}
            title={currentArtifact.title}
          />
        )}
      </div>
    </div>
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