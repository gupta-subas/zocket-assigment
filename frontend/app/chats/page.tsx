"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {} from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  MessageSquare,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Calendar,
  ArrowLeft,
  Loader2,
  CreditCard,
} from "lucide-react";
import {
  getConversations,
  deleteConversation,
  updateConversation,
} from "@/lib/api/conversations";
import { useAppStore } from "@/lib/store/app-store";
import { AuthGuard } from "@/components/auth/auth-guard";
import { NavigationSidebar } from "@/components/sidebar/navigation-sidebar";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/components/providers/auth-provider";

interface ConversationWithDate extends Conversation {
  formattedDate: string;
  timeAgo: string;
}

interface Conversation {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function ChatsPage() {
  const router = useRouter();
  const { startNewChat, setCurrentConversation } = useAppStore();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const conversationsPerPage = 12; // Show 12 conversations per page (3x4 grid)

  // Fetch conversations with pagination
  const {
    data: conversationsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["conversations", currentPage],
    queryFn: () => getConversations(currentPage, conversationsPerPage),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Delete conversation mutation
  const deleteMutation = useMutation({
    mutationFn: deleteConversation,
    onSuccess: () => {
      refetch();
      setDeleteDialogOpen(false);
      setSelectedConversation(null);
    },
    onError: (error) => {
      console.error("Failed to delete conversation:", error);
    },
  });

  // Update conversation title mutation
  const updateTitleMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      updateConversation(id, title),
    onSuccess: () => {
      refetch();
      setEditDialogOpen(false);
      setSelectedConversation(null);
      setNewTitle("");
    },
    onError: (error) => {
      console.error("Failed to update conversation title:", error);
    },
  });

  const conversations = conversationsData?.conversations || [];

  // TODO: will handle once backend implemented for pagination
  const totalConversations = 10;
  const totalPages = Math.ceil(totalConversations / conversationsPerPage);

  // Filter conversations based on search query (only for current page)
  const filteredConversations = conversations.filter((conv) =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSearchQuery(""); // Clear search when changing pages
  };

  // Group conversations by date
  const groupedConversations = filteredConversations.reduce((groups, conv) => {
    const date = new Date(conv.updatedAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let groupKey: string;
    if (date.toDateString() === today.toDateString()) {
      groupKey = "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = "Yesterday";
    } else if (date.getTime() > today.getTime() - 7 * 24 * 60 * 60 * 1000) {
      groupKey = "This Week";
    } else if (date.getTime() > today.getTime() - 30 * 24 * 60 * 60 * 1000) {
      groupKey = "This Month";
    } else {
      groupKey = "Older";
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }

    groups[groupKey].push({
      ...conv,
      formattedDate: date.toLocaleDateString(),
      timeAgo: formatDistanceToNow(date, { addSuffix: true }),
    });

    return groups;
  }, {} as Record<string, ConversationWithDate[]>);

  const handleNewChat = () => {
    startNewChat();
    router.push("/");
  };

  const handleSelectConversation = (conversationId: string) => {
    setCurrentConversation(conversationId);
    router.push("/");
  };

  const handleDeleteClick = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setDeleteDialogOpen(true);
  };

  const handleEditClick = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setNewTitle(conversation.title);
    setEditDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedConversation) {
      deleteMutation.mutate(selectedConversation.id);
    }
  };

  const handleTitleUpdate = () => {
    if (selectedConversation && newTitle.trim()) {
      updateTitleMutation.mutate({
        id: selectedConversation.id,
        title: newTitle.trim(),
      });
    }
  };

  return (
    <AuthGuard>
      <ErrorBoundary>
        <SidebarProvider defaultOpen={true}>
          <div className="h-screen w-full flex overflow-hidden">
            <NavigationSidebar />
            <SidebarInset className="flex-1 flex flex-col">
              {/* Header */}
              <header className="flex-none border-b bg-background">
                <div className="container flex h-14 max-w-screen-2xl items-center">
                  <SidebarTrigger />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push("/")}
                    className="ml-2 md:hidden"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Back to chat</span>
                  </Button>
                  <div className="ml-4 flex-1">
                    <h1 className="text-lg font-semibold">Chat History</h1>
                    <p className="text-sm text-muted-foreground hidden sm:block">
                      Manage your conversations with Zocket
                    </p>
                  </div>
                  <Badge variant="outline" className="mr-4">
                    <CreditCard className="h-3 w-3 mr-1" />
                    {user?.credits || 0} credits
                  </Badge>
                  <ThemeToggle />
                </div>
              </header>

              {/* Content */}
              <main className="flex-1 overflow-y-auto">
                <div className="container max-w-screen-2xl p-6">
                  {/* Search */}
                  <div className="mb-6">
                    <div className="relative max-w-sm">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search conversations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Loading State */}
                  {isLoading && (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground">
                        Loading conversations...
                      </span>
                    </div>
                  )}

                  {/* Empty State */}
                  {!isLoading && conversations.length === 0 && (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground" />
                        <CardTitle className="mb-2">
                          No conversations yet
                        </CardTitle>
                        <CardDescription className="mb-4">
                          Start your first conversation with Zocket
                        </CardDescription>
                        <Button onClick={handleNewChat}>
                          <Plus className="mr-2 h-4 w-4" />
                          Start New Chat
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* Conversations List */}
                  {!isLoading &&
                    Object.keys(groupedConversations).length > 0 && (
                      <div className="space-y-8">
                        {Object.entries(groupedConversations).map(
                          ([groupName, convs]) => (
                            <div key={groupName}>
                              <div className="mb-4 flex items-center space-x-2">
                                <Calendar className="h-4 w-4" />
                                <h2 className="text-sm font-medium text-muted-foreground">
                                  {groupName}
                                </h2>
                              </div>
                              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {convs.map((conversation) => (
                                  <Card
                                    key={conversation.id}
                                    className="group cursor-pointer transition-shadow hover:shadow-md"
                                    onClick={() =>
                                      handleSelectConversation(conversation.id)
                                    }
                                  >
                                    <CardHeader className="pb-2">
                                      <div className="flex items-start justify-between">
                                        <div className="min-w-0 flex-1">
                                          <CardTitle className="mb-1 truncate text-sm">
                                            {conversation.title ||
                                              "Untitled Chat"}
                                          </CardTitle>
                                          <CardDescription className="text-xs">
                                            {conversation.timeAgo}
                                          </CardDescription>
                                        </div>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                            >
                                              <MoreHorizontal className="h-4 w-4" />
                                              <span className="sr-only">
                                                More options
                                              </span>
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditClick(conversation);
                                              }}
                                            >
                                              <Edit className="mr-2 h-4 w-4" />
                                              Rename
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteClick(conversation);
                                              }}
                                              className="text-destructive"
                                            >
                                              <Trash2 className="mr-2 h-4 w-4" />
                                              Delete
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>
                                          {conversation.formattedDate}
                                        </span>
                                        <Badge variant="secondary">
                                          {conversation.messageCount} messages
                                        </Badge>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                              {groupName !== "Older" && (
                                <Separator className="mt-8" />
                              )}
                            </div>
                          )
                        )}
                      </div>
                    )}

                  {/* No Search Results */}
                  {!isLoading &&
                    searchQuery &&
                    filteredConversations.length === 0 && (
                      <Card>
                        <CardContent className="flex flex-col items-center justify-center py-8">
                          <Search className="mb-2 h-8 w-8 text-muted-foreground" />
                          <CardDescription>
                            No conversations found for &quot;{searchQuery}&quot;
                          </CardDescription>
                        </CardContent>
                      </Card>
                    )}

                  {/* Pagination */}
                  {!isLoading && !searchQuery && totalPages > 1 && (
                    <div className="mt-8 flex justify-center">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() =>
                                handlePageChange(Math.max(1, currentPage - 1))
                              }
                              className={
                                currentPage === 1
                                  ? "pointer-events-none opacity-50"
                                  : "cursor-pointer"
                              }
                            />
                          </PaginationItem>

                          {/* First page */}
                          {currentPage > 2 && (
                            <>
                              <PaginationItem>
                                <PaginationLink
                                  onClick={() => handlePageChange(1)}
                                  className="cursor-pointer"
                                >
                                  1
                                </PaginationLink>
                              </PaginationItem>
                              {currentPage > 3 && (
                                <PaginationItem>
                                  <PaginationEllipsis />
                                </PaginationItem>
                              )}
                            </>
                          )}

                          {/* Current page and adjacent pages */}
                          {Array.from(
                            { length: Math.min(3, totalPages) },
                            (_, i) => {
                              const pageNum = Math.max(
                                1,
                                Math.min(totalPages, currentPage - 1 + i)
                              );
                              if (pageNum < 1 || pageNum > totalPages)
                                return null;

                              return (
                                <PaginationItem key={pageNum}>
                                  <PaginationLink
                                    onClick={() => handlePageChange(pageNum)}
                                    isActive={pageNum === currentPage}
                                    className="cursor-pointer"
                                  >
                                    {pageNum}
                                  </PaginationLink>
                                </PaginationItem>
                              );
                            }
                          )}

                          {/* Last page */}
                          {currentPage < totalPages - 1 && (
                            <>
                              {currentPage < totalPages - 2 && (
                                <PaginationItem>
                                  <PaginationEllipsis />
                                </PaginationItem>
                              )}
                              <PaginationItem>
                                <PaginationLink
                                  onClick={() => handlePageChange(totalPages)}
                                  className="cursor-pointer"
                                >
                                  {totalPages}
                                </PaginationLink>
                              </PaginationItem>
                            </>
                          )}

                          <PaginationItem>
                            <PaginationNext
                              onClick={() =>
                                handlePageChange(
                                  Math.min(totalPages, currentPage + 1)
                                )
                              }
                              className={
                                currentPage === totalPages
                                  ? "pointer-events-none opacity-50"
                                  : "cursor-pointer"
                              }
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </div>
              </main>
            </SidebarInset>
          </div>

          {/* Delete Dialog */}
          <AlertDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &quot;
                  {selectedConversation?.title}&quot;? This action cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteConfirm}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Edit Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rename Conversation</DialogTitle>
                <DialogDescription>
                  Enter a new title for this conversation.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Enter conversation title..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleTitleUpdate();
                    }
                  }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleTitleUpdate}
                  disabled={!newTitle.trim() || updateTitleMutation.isPending}
                >
                  {updateTitleMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </SidebarProvider>
      </ErrorBoundary>
    </AuthGuard>
  );
}
