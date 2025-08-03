'use client'

import { useRef } from 'react'
import Editor from '@monaco-editor/react'
import { useTheme } from 'next-themes'

interface CodeEditorProps {
  code: string
  language: string
  onChange?: (value: string) => void
  readOnly?: boolean
}

export function CodeEditor({ code, language, onChange, readOnly = true }: CodeEditorProps) {
  const editorRef = useRef<unknown>(null)
  const { theme } = useTheme()

  const handleEditorDidMount = (editor: unknown, monaco: unknown) => {
    editorRef.current = editor

    // Configure Monaco theme
    // @ts-expect-error - Monaco types not available
    monaco.editor.defineTheme('claude-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#fafaf9',
        'editor.foreground': '#0c0a09',
        'editor.lineHighlightBackground': '#f5f5f4',
        'editor.selectionBackground': '#d4d4d8',
        'editorLineNumber.foreground': '#a1a1aa',
        'editorGutter.background': '#fafaf9',
      }
    })

    // @ts-expect-error - Monaco types not available
    monaco.editor.defineTheme('claude-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#18181b',
        'editor.foreground': '#fafafa',
        'editor.lineHighlightBackground': '#27272a',
        'editor.selectionBackground': '#3f3f46',
        'editorLineNumber.foreground': '#71717a',
        'editorGutter.background': '#18181b',
      }
    })

    // Set theme
    // @ts-expect-error - Monaco types not available
    monaco.editor.setTheme(theme === 'dark' ? 'claude-dark' : 'claude-light')
  }

  // Convert language names to Monaco language IDs
  const getMonacoLanguage = (lang: string): string => {
    const languageMap: Record<string, string> = {
      'javascript': 'javascript',
      'typescript': 'typescript',
      'tsx': 'typescript',
      'jsx': 'javascript',
      'react': 'typescript', // React components should use TypeScript syntax highlighting
      'python': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'csharp': 'csharp',
      'go': 'go',
      'rust': 'rust',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'yaml': 'yaml',
      'xml': 'xml',
      'sql': 'sql',
      'bash': 'shell',
      'powershell': 'powershell',
      'markdown': 'markdown',
    }
    
    return languageMap[lang.toLowerCase()] || 'plaintext'
  }

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        width="100%"
        value={code}
        language={getMonacoLanguage(language)}
        theme={theme === 'dark' ? 'claude-dark' : 'claude-light'}
        onMount={handleEditorDidMount}
        onChange={(value) => onChange?.(value || '')}
        options={{
          readOnly,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          lineHeight: 1.5,
          padding: { top: 16, bottom: 16 },
          renderLineHighlight: 'all',
          selectOnLineNumbers: true,
          automaticLayout: true,
          wordWrap: 'on',
          wrappingIndent: 'indent',
          folding: true,
          lineNumbers: 'on',
          glyphMargin: false,
          lineDecorationsWidth: 0,
          lineNumbersMinChars: 3,
          renderWhitespace: 'selection',
          scrollBeyondLastColumn: 0,
          overviewRulerLanes: 0,
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 12,
            horizontalScrollbarSize: 12,
          },
        }}
      />
    </div>
  )
}