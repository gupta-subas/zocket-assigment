'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send } from 'lucide-react'

interface ChatInputProps {
  onSendMessage: (message: string) => void
  isLoading: boolean
}

export function ChatInput({ onSendMessage, isLoading }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim() && !isLoading) {
      onSendMessage(message.trim())
      setMessage('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [message])


  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything..."
          disabled={isLoading}
          className="min-h-[56px] max-h-[120px] w-full resize-none rounded-3xl border bg-background pl-6 pr-16 py-4 shadow-sm focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          rows={1}
        />
        
        {/* Send button */}
        <Button
          type="submit"
          size="icon"
          disabled={!message.trim() || isLoading}
          className="absolute bottom-2 right-2 h-10 w-10 rounded-full"
        >
          <Send className="h-4 w-4" />
          <span className="sr-only">Send message</span>
        </Button>
      </div>
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="mt-2 text-xs text-muted-foreground">
          Zocket is thinking...
        </div>
      )}
      
      {/* Character count for very long messages */}
      {message.length > 1000 && (
        <div className="mt-1 text-right text-xs text-muted-foreground">
          {message.length}/10000
        </div>
      )}
      
    </form>
  )
}