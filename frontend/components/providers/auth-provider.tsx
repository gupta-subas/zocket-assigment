'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User, getCurrentUser, logout as apiLogout } from '@/lib/api/auth'

interface AuthContextType {
  isAuthenticated: boolean
  user: User | null
  isLoading: boolean
  login: (token: string, user: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing token and validate it
    const checkAuth = async () => {
      const savedToken = localStorage.getItem('authToken')
      if (savedToken) {
        try {
          const { user: currentUser } = await getCurrentUser()
          setUser(currentUser)
          setIsAuthenticated(true)
        } catch (error) {
          // Token is invalid, remove it
          localStorage.removeItem('authToken')
          setUser(null)
          setIsAuthenticated(false)
          console.warn('Auth token validation failed:', error)
        }
      }
      setIsLoading(false)
    }

    checkAuth()
  }, [])

  const login = (token: string, userData: User) => {
    setUser(userData)
    setIsAuthenticated(true)
    localStorage.setItem('authToken', token)
  }

  const logout = () => {
    setUser(null)
    setIsAuthenticated(false)
    apiLogout()
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}