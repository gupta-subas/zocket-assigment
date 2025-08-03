'use client'

import { useAppStore } from '@/lib/store/app-store'
import { ChatInterface } from '@/components/chat/chat-interface'
import { CodeArtifactSidebar } from '@/components/sidebar/code-artifact-sidebar'
import { NavigationSidebar } from '@/components/sidebar/navigation-sidebar'
import { AuthGuard } from '@/components/auth/auth-guard'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/components/providers/auth-provider'
import { CreditCard } from 'lucide-react'

export function MainLayout() {
  const { sidebarOpen, currentArtifact } = useAppStore()
  const { user } = useAuth()

  return (
    <ErrorBoundary>
      <AuthGuard>
        <SidebarProvider defaultOpen={true}>
          <div className="h-screen w-full flex overflow-hidden">
            <NavigationSidebar />
            <SidebarInset className="flex-1 flex flex-col">
              {/* Header */}
              <header className="flex-none border-b bg-background">
                <div className="container flex h-14 max-w-screen-2xl items-center">
                  <SidebarTrigger />
                  <div className="flex-1" />
                  <Badge variant="outline" className="mr-4">
                    <CreditCard className="h-3 w-3 mr-1" />
                    {user?.credits || 0} credits
                  </Badge>
                  <ThemeToggle />
                </div>
              </header>
              
              {/* Main Content Area */}
              <main className="flex-1 overflow-hidden">
                <div className="h-full max-w-screen-2xl mx-auto">
                  {currentArtifact && sidebarOpen ? (
                    <div className="grid h-full lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_480px]">
                      {/* Chat Interface */}
                      <div className="overflow-hidden">
                        <ChatInterface />
                      </div>
                      
                      {/* Code Artifacts Sidebar - Desktop */}
                      <div className="hidden lg:flex border-l overflow-hidden">
                        <CodeArtifactSidebar />
                      </div>
                    </div>
                  ) : (
                    <div className="h-full overflow-hidden">
                      <ChatInterface />
                    </div>
                  )}
                </div>
              </main>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </AuthGuard>
    </ErrorBoundary>
  )
}