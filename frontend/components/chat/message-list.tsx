'use client'

import { useState } from 'react'
import { Message, CodeArtifact } from '@/lib/store/app-store'
import { MessageBubble } from './message-bubble'
import { Button } from '@/components/ui/button'
import { 
  Code2, 
  Sparkles, 
  PenTool,
  BookOpen,
  Coffee,
  Send
} from 'lucide-react'

interface MessageListProps {
  messages: Message[]
  currentResponse?: string
  currentArtifacts?: CodeArtifact[]
  onResendMessage: (content: string) => void
  onSendMessage: (content: string) => void
  isLoading: boolean
}

export function MessageList({ messages, currentResponse, currentArtifacts, onResendMessage, onSendMessage, isLoading }: MessageListProps) {
  const categoryPrompts = {
    code: "Help me write some code. I need assistance with programming.",
    write: "Help me write something. I need assistance with writing.",
    learn: "I want to learn about a topic. Can you teach me something new?",
    life: "I have a question about life, advice, or general topics."
  }

  const handleCategoryClick = (category: keyof typeof categoryPrompts) => {
    if (!isLoading) {
      onSendMessage(categoryPrompts[category])
    }
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {messages.length === 0 && !currentResponse && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] md:min-h-[70vh] space-y-6 md:space-y-8 px-4">
          {/* Welcome message with spark */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3 text-2xl md:text-4xl font-light text-foreground">
              <Sparkles className="h-6 w-6 md:h-8 md:w-8 text-orange-500" />
              How can I help you today?
            </div>
          </div>
          
          {/* Claude-style input area */}
          <div className="w-full max-w-4xl space-y-4">
            <ClaudeInputArea onSendMessage={onSendMessage} isLoading={isLoading} />
            
            {/* Category buttons */}
            <div className="flex flex-wrap gap-2 md:gap-3 justify-center">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 text-xs md:text-sm"
                onClick={() => handleCategoryClick('code')}
                disabled={isLoading}
              >
                <Code2 className="h-3 w-3 md:h-4 md:w-4" />
                Code
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 text-xs md:text-sm"
                onClick={() => handleCategoryClick('write')}
                disabled={isLoading}
              >
                <PenTool className="h-3 w-3 md:h-4 md:w-4" />
                Write
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 text-xs md:text-sm"
                onClick={() => handleCategoryClick('learn')}
                disabled={isLoading}
              >
                <BookOpen className="h-3 w-3 md:h-4 md:w-4" />
                Learn
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 text-xs md:text-sm"
                onClick={() => handleCategoryClick('life')}
                disabled={isLoading}
              >
                <Coffee className="h-3 w-3 md:h-4 md:w-4" />
                Life stuff
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {messages.map((message) => (
        <MessageBubble 
          key={message.id}
          message={message}
          onResend={onResendMessage}
        />
      ))}
      
      {currentResponse && (
        <MessageBubble 
          message={{
            id: 'streaming',
            role: 'assistant',
            content: currentResponse,
            timestamp: new Date(),
            artifacts: currentArtifacts
          }}
          isStreaming
        />
      )}
    </div>
  )
}

function ClaudeInputArea({ onSendMessage, isLoading }: { onSendMessage: (content: string) => void, isLoading: boolean }) {
  const [inputValue, setInputValue] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim())
      setInputValue('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex items-center gap-3 p-3 md:p-4 border rounded-xl bg-muted/30 min-h-[56px] md:min-h-[64px]">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="How can I help you today?"
          disabled={isLoading}
          className="flex-1 bg-transparent border-none outline-none text-sm md:text-base placeholder-muted-foreground"
        />
        {inputValue.trim() && (
          <Button
            type="submit"
            size="sm"
            disabled={isLoading}
            className="h-8 w-8 p-0"
          >
            <Send className="h-3 w-3" />
          </Button>
        )}
      </div>
    </form>
  )
}