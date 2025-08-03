'use client'

import { useState } from 'react'
import { Message, useAppStore } from '@/lib/store/app-store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { 
  Edit2, 
  Check, 
  X, 
  RotateCcw, 
  User, 
  Bot,
  Copy,
  CheckCheck
} from 'lucide-react'
import { ArtifactAwareMarkdown } from './artifact-aware-markdown'

interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
  onResend?: (content: string) => void
}

export function MessageBubble({ message, isStreaming = false, onResend }: MessageBubbleProps) {
  const { updateMessage, toggleMessageEdit, resendMessage } = useAppStore()
  const [editContent, setEditContent] = useState(message.content)
  const [copied, setCopied] = useState(false)

  const handleSaveEdit = () => {
    updateMessage(message.id, editContent)
  }

  const handleCancelEdit = () => {
    setEditContent(message.content)
    toggleMessageEdit(message.id)
  }

  const handleResend = () => {
    if (onResend && message.role === 'user') {
      resendMessage(message.id)
      onResend(message.content)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const isUser = message.role === 'user'

  return (
    <div className="flex gap-3 md:gap-4 group w-full">
      <div className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-muted flex items-center justify-center">
        {isUser ? (
          <User className="h-3 w-3 md:h-4 md:w-4" />
        ) : (
          <Bot className="h-3 w-3 md:h-4 md:w-4" />
        )}
      </div>

      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {isUser ? 'You' : 'Claude'}
          </Badge>
          {isStreaming && (
            <div className="flex space-x-1">
              <div className="w-1 h-1 bg-primary rounded-full animate-bounce"></div>
              <div className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.1s]"></div>
              <div className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></div>
            </div>
          )}
        </div>

        <div className="w-full">
          {message.isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[100px] resize-none"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelEdit}
                >
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                {isUser ? (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                  </div>
                ) : (
                  <>
                    {/* Debug info */}
                    {message.artifacts && message.artifacts.length > 0 && (
                      <div className="text-xs text-blue-500 mb-2">
                        DEBUG: Found {message.artifacts.length} artifacts: {message.artifacts.map(a => a.title).join(', ')}
                      </div>
                    )}
                    <ArtifactAwareMarkdown 
                      content={message.content}
                      artifacts={message.artifacts}
                    />
                  </>
                )}
              </div>
              
              {!isStreaming && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopy}
                    className="h-8 px-2"
                  >
                    {copied ? (
                      <CheckCheck className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  
                  {isUser && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleMessageEdit(message.id)}
                        className="h-8 px-2"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleResend}
                        className="h-8 px-2"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}