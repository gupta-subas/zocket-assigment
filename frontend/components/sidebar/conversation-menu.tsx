'use client'

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Edit, Trash2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateConversation, deleteConversation } from '@/lib/api/conversations'
import { useAppStore } from '@/lib/store/app-store'

interface ConversationMenuProps {
  conversationId: string
  currentTitle: string
}

export function ConversationMenu({ conversationId, currentTitle }: ConversationMenuProps) {
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [newTitle, setNewTitle] = useState(currentTitle)
  const queryClient = useQueryClient()
  const { updateConversation: updateConversationStore, removeConversation, currentConversationId, startNewChat } = useAppStore()

  const renameMutation = useMutation({
    mutationFn: (title: string) => updateConversation(conversationId, title),
    onSuccess: () => {
      updateConversationStore(conversationId, { title: newTitle })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setShowRenameDialog(false)
    },
    onError: (error) => {
      console.error('Failed to rename conversation:', error)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteConversation(conversationId),
    onSuccess: () => {
      removeConversation(conversationId)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setShowDeleteDialog(false)
      
      // If we deleted the current conversation, start a new chat
      if (currentConversationId === conversationId) {
        startNewChat()
      }
    },
    onError: (error) => {
      console.error('Failed to delete conversation:', error)
    }
  })

  const handleRename = () => {
    if (newTitle.trim() && newTitle !== currentTitle) {
      renameMutation.mutate(newTitle.trim())
    } else {
      setShowRenameDialog(false)
    }
  }

  const handleDelete = () => {
    deleteMutation.mutate()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setNewTitle(currentTitle)
              setShowRenameDialog(true)
            }}
          >
            <Edit className="h-3 w-3 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive"
          >
            <Trash2 className="h-3 w-3 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
            <DialogDescription>
              Give this conversation a new name.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            placeholder="Conversation title"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRename} 
              disabled={renameMutation.isPending || !newTitle.trim()}
            >
              {renameMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{currentTitle}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}