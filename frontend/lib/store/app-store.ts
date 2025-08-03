import { create } from 'zustand'
import { Conversation } from '@/lib/api/conversations'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isEditing?: boolean
  artifacts?: CodeArtifact[]
}

export interface CodeArtifact {
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
  code?: string // Will be loaded separately
  filename?: string
  timestamp?: Date
}

interface AppState {
  messages: Message[]
  currentArtifact: CodeArtifact | null
  sidebarOpen: boolean
  currentView: 'code' | 'preview'
  isLoading: boolean
  
  // Conversation management
  conversations: Conversation[]
  currentConversationId: string | null
  
  // Actions
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  updateMessage: (id: string, content: string) => void
  toggleMessageEdit: (id: string) => void
  addArtifactToLastMessage: (artifact: CodeArtifact) => void
  setCurrentArtifact: (artifact: CodeArtifact | null | ((prev: CodeArtifact | null) => CodeArtifact | null)) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setCurrentView: (view: 'code' | 'preview') => void
  setLoading: (loading: boolean) => void
  resendMessage: (messageId: string) => void
  
  // Conversation actions
  setConversations: (conversations: Conversation[]) => void
  setCurrentConversation: (conversationId: string | null) => void
  addConversation: (conversation: Conversation) => void
  updateConversation: (id: string, updates: Partial<Conversation>) => void
  removeConversation: (id: string) => void
  clearMessages: () => void
  startNewChat: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  messages: [],
  currentArtifact: null,
  sidebarOpen: false,
  currentView: 'code',
  isLoading: false,
  
  // Conversation state
  conversations: [],
  currentConversationId: null,

  addMessage: (message) => {
    const newMessage: Message = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    }
    set((state) => ({
      messages: [...state.messages, newMessage],
    }))
  },

  updateMessage: (id, content) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, content, isEditing: false } : msg
      ),
    }))
  },

  toggleMessageEdit: (id) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, isEditing: !msg.isEditing } : msg
      ),
    }))
  },

  addArtifactToLastMessage: (artifact) => {
    set((state) => {
      const lastMessageIndex = state.messages.length - 1
      if (lastMessageIndex >= 0 && state.messages[lastMessageIndex].role === 'assistant') {
        const updatedMessages = [...state.messages]
        const lastMessage = updatedMessages[lastMessageIndex]
        const existingArtifacts = lastMessage.artifacts || []
        
        // Check if artifact already exists (to avoid duplicates)
        const existingIndex = existingArtifacts.findIndex(a => a.id === artifact.id)
        
        if (existingIndex >= 0) {
          // Update existing artifact
          existingArtifacts[existingIndex] = artifact
        } else {
          // Add new artifact
          existingArtifacts.push(artifact)
        }
        
        updatedMessages[lastMessageIndex] = {
          ...lastMessage,
          artifacts: existingArtifacts
        }
        return { messages: updatedMessages }
      }
      return state
    })
  },

  setCurrentArtifact: (artifact) => {
    set((state) => {
      const newArtifact = typeof artifact === 'function' ? artifact(state.currentArtifact) : artifact
      return { currentArtifact: newArtifact }
    })
    const currentState = get()
    if (currentState.currentArtifact && !currentState.sidebarOpen) {
      set({ sidebarOpen: true })
    }
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }))
  },

  setSidebarOpen: (open) => {
    set({ sidebarOpen: open })
  },

  setCurrentView: (view) => {
    set({ currentView: view })
  },

  setLoading: (loading) => {
    set({ isLoading: loading })
  },

  resendMessage: (messageId) => {
    const state = get()
    const messageIndex = state.messages.findIndex(msg => msg.id === messageId)
    if (messageIndex !== -1) {
      const messagesToKeep = state.messages.slice(0, messageIndex + 1)
      set({ messages: messagesToKeep })
    }
  },

  // Conversation management actions
  setConversations: (conversations) => {
    set({ conversations })
  },

  setCurrentConversation: (conversationId) => {
    set({ currentConversationId: conversationId })
  },

  addConversation: (conversation) => {
    set((state) => ({
      conversations: [conversation, ...state.conversations]
    }))
  },

  updateConversation: (id, updates) => {
    set((state) => ({
      conversations: state.conversations.map(conv =>
        conv.id === id ? { ...conv, ...updates } : conv
      )
    }))
  },

  removeConversation: (id) => {
    set((state) => ({
      conversations: state.conversations.filter(conv => conv.id !== id),
      currentConversationId: state.currentConversationId === id ? null : state.currentConversationId,
      messages: state.currentConversationId === id ? [] : state.messages
    }))
  },

  clearMessages: () => {
    set({ messages: [], currentArtifact: null, sidebarOpen: false })
  },

  startNewChat: () => {
    set({ 
      messages: [], 
      currentArtifact: null, 
      sidebarOpen: false, 
      currentConversationId: null 
    })
  },
}))