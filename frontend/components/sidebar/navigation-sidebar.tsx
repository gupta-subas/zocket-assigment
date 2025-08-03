"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Plus,
  MessageSquare,
  Clock,
  User,
  ChevronDown,
  Loader2,
  LogOut,
} from "lucide-react";
import { useAppStore, CodeArtifact } from "@/lib/store/app-store";
import { getConversations, getConversation } from "@/lib/api/conversations";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ConversationMenu } from "./conversation-menu";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function NavigationSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useSidebar();
  const {
    conversations,
    setConversations,
    startNewChat,
    setCurrentConversation,
    currentConversationId,
    clearMessages,
    addMessage,
    setCurrentArtifact,
  } = useAppStore();

  const { user, logout } = useAuth();

  // Fetch conversations
  const { data: conversationsData, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => getConversations(1, 20),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (conversationsData?.conversations) {
      setConversations(conversationsData.conversations);
    }
  }, [conversationsData, setConversations]);

  const handleNewChat = () => {
    startNewChat();
    router.push("/");
  };

  // Load conversation mutation
  const loadConversationMutation = useMutation({
    mutationFn: (conversationId: string) => getConversation(conversationId),
    onSuccess: (data) => {
      clearMessages();
      let latestArtifact: CodeArtifact | null = null;

      // Convert backend messages to frontend format
      data.conversation.messages.forEach((msg) => {
        // Convert backend artifacts to frontend format
        const artifacts: CodeArtifact[] = msg.artifacts.map((artifact) => ({
          id: artifact.id,
          title: artifact.title,
          language: artifact.language,
          type: artifact.type,
          s3Key: artifact.s3Key,
          s3Url: artifact.s3Url,
          fileSize: artifact.fileSize,
          createdAt: artifact.createdAt,
          // Code will be loaded on demand when needed
        }));

        // Keep track of the most recent artifact (last one chronologically)
        if (artifacts.length > 0) {
          // Get the most recently created artifact from this message
          const mostRecent = artifacts.reduce((latest, current) => {
            return new Date(current.createdAt) > new Date(latest.createdAt)
              ? current
              : latest;
          });

          // Update latestArtifact if this one is more recent
          if (
            !latestArtifact ||
            new Date(mostRecent.createdAt) > new Date(latestArtifact.createdAt)
          ) {
            latestArtifact = mostRecent;
          }
        }

        addMessage({
          role: msg.role.toLowerCase() as "user" | "assistant",
          content: msg.content,
          artifacts: artifacts.length > 0 ? artifacts : undefined,
        });
      });

      // Set the most recent artifact as current if any exist
      if (latestArtifact) {
        console.log(
          "Setting current artifact from loaded conversation:",
          (latestArtifact as CodeArtifact).title
        );
        setCurrentArtifact(latestArtifact);
      } else {
        console.log("No artifacts found in loaded conversation");
        setCurrentArtifact(null);
      }
    },
    onError: (error) => {
      console.error("Failed to load conversation:", error);
    },
  });

  const handleSelectConversation = (conversationId: string) => {
    if (conversationId === currentConversationId) return;

    setCurrentConversation(conversationId);
    loadConversationMutation.mutate(conversationId);

    // Navigate to home page if we're on the chats page
    if (pathname === "/chats") {
      router.push("/");
    }
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex items-center justify-center">
                <Image
                  src="/assets/zocket-black-text-logo.svg"
                  alt="Zocket"
                  width={114}
                  height={28}
                  className="h-6 w-auto dark:invert"
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate text-xs text-muted-foreground">
                  AI Assistant
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="New chat" onClick={handleNewChat}>
                  <Plus />
                  <span>New chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Chats"
                  onClick={() => router.push("/chats")}
                >
                  <MessageSquare />
                  <span>Chats</span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {conversations.length}
                  </Badge>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {state === "expanded" && (
          <SidebarGroup>
            <SidebarGroupLabel>
              Recent Conversations
              {isLoading && <Loader2 className="ml-2 h-3 w-3 animate-spin" />}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {conversations.length > 0 ? (
                  conversations.slice(0, 10).map((conversation) => (
                    <SidebarMenuItem key={conversation.id}>
                      <div className="flex items-center group w-full">
                        <SidebarMenuButton
                          tooltip={conversation.title || "Untitled Chat"}
                          className={`flex-1 ${
                            currentConversationId === conversation.id
                              ? "bg-accent"
                              : ""
                          } ${
                            loadConversationMutation.isPending
                              ? "opacity-50"
                              : ""
                          }`}
                          onClick={() =>
                            handleSelectConversation(conversation.id)
                          }
                          disabled={loadConversationMutation.isPending}
                        >
                          <Clock />
                          <span className="truncate">
                            {conversation.title || "Untitled Chat"}
                          </span>
                        </SidebarMenuButton>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <ConversationMenu
                            conversationId={conversation.id}
                            currentTitle={conversation.title || "Untitled Chat"}
                          />
                        </div>
                      </div>
                    </SidebarMenuItem>
                  ))
                ) : (
                  <SidebarMenuItem>
                    <div className="text-sm text-muted-foreground px-2 py-1">
                      {isLoading ? "Loading..." : "No recent chats"}
                    </div>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <User />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">
                      {user?.username || "User"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.email || "user@example.com"}
                    </span>
                  </div>
                  <ChevronDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem disabled>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">
                      {user?.username}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {user?.email}
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
