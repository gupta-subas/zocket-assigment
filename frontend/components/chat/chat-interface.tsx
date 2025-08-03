"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore, CodeArtifact } from "@/lib/store/app-store";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { ChatHome } from "./chat-home";
import { useMutation } from "@tanstack/react-query";
import { streamChatMessage } from "@/lib/api/chat";
import { getArtifactCode } from "@/lib/api/artifacts";
import { CreditExhaustedDialog } from "@/components/ui/credit-exhausted-dialog";
import { useAuth } from "@/components/providers/auth-provider";

export function ChatInterface() {
  const {
    messages,
    addMessage,
    setLoading,
    isLoading,
    setCurrentArtifact,
    currentConversationId,
    setCurrentConversation,
    addConversation,
  } = useAppStore();

  const { user } = useAuth();
  const [currentResponse, setCurrentResponse] = useState("");
  const [currentArtifacts, setCurrentArtifacts] = useState<CodeArtifact[]>([]);
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      // Clear current artifact if starting a new conversation
      if (!currentConversationId) {
        setCurrentArtifact(null);
      }

      const userMessage = { role: "user" as const, content };
      addMessage(userMessage);
      setLoading(true);
      setCurrentResponse("");
      setCurrentArtifacts([]);

      let responseContent = "";

      const result = await streamChatMessage(
        content,
        (chunk: string) => {
          responseContent += chunk;
          setCurrentResponse(responseContent);
        },
        async (artifact: {
          id: string;
          title: string;
          language: string;
          type: string;
          s3Key: string;
          s3Url: string;
          size: number;
        }) => {
          // Create artifact object
          const artifactObj: CodeArtifact = {
            id: artifact.id,
            title: artifact.title,
            language: artifact.language,
            type: artifact.type,
            s3Key: artifact.s3Key,
            s3Url: artifact.s3Url,
            fileSize: artifact.size,
            createdAt: new Date().toISOString(),
          };

          // Load the actual code
          try {
            console.log("Loading artifact code for:", artifact.id);
            const artifactCode = await getArtifactCode(artifact.id);
            const artifactWithCode = {
              ...artifactObj,
              code: artifactCode.code,
            };

            console.log("Artifact code loaded successfully:", {
              id: artifactWithCode.id,
              title: artifactWithCode.title,
              codeLength: artifactWithCode.code?.length || 0,
            });

            // Set in global store for sidebar
            setCurrentArtifact(artifactWithCode);

            // Add to current artifacts for this streaming message
            setCurrentArtifacts((prev) => {
              const existing = prev.find((a) => a.id === artifactWithCode.id);
              if (existing) {
                console.log("Updating existing artifact in currentArtifacts");
                return prev.map((a) =>
                  a.id === artifactWithCode.id ? artifactWithCode : a
                );
              }
              console.log(
                "Adding new artifact to currentArtifacts, total will be:",
                prev.length + 1
              );
              return [...prev, artifactWithCode];
            });
          } catch (error) {
            console.error("Failed to load artifact code:", error);
            // Still add the artifact without code
            setCurrentArtifact(artifactObj);
            setCurrentArtifacts((prev) => {
              console.log(
                "Adding artifact without code to currentArtifacts, total will be:",
                prev.length + 1
              );
              return [...prev, artifactObj];
            });
          }
        },
        (build: { status: string; message?: string }) => {
          console.log("Build result:", build);
        },
        currentConversationId || undefined
      );

      // If we got conversation metadata and it's a new conversation, update the state
      if (result && result.conversationId && !currentConversationId) {
        setCurrentConversation(result.conversationId);

        // Add to conversations list (basic conversation object)
        addConversation({
          id: result.conversationId,
          title:
            content.length > 50 ? content.substring(0, 47) + "..." : content,
          messageCount: 2, // User message + assistant response
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      console.log("Finalizing message with artifacts:", {
        responseLength: responseContent.length,
        artifactCount: currentArtifacts.length,
        artifacts: currentArtifacts.map((a) => ({ id: a.id, title: a.title })),
      });

      addMessage({
        role: "assistant",
        content: responseContent,
        artifacts: currentArtifacts,
      });
      setCurrentResponse("");
      setCurrentArtifacts([]);
      setLoading(false);
    },
    onError: (error) => {
      console.error("Failed to send message:", error);
      setLoading(false);
      setCurrentResponse("");

      // Check if it's a credit exhaustion error
      if (
        error instanceof Error &&
        error.message.includes("exhausted your credits")
      ) {
        setShowCreditDialog(true);
        return;
      }

      // Add error message to chat
      addMessage({
        role: "assistant",
        content: `Error: ${
          error instanceof Error
            ? error.message
            : "Failed to send message. Please try again."
        }`,
      });
    },
  });

  const handleSendMessage = (content: string) => {
    sendMessageMutation.mutate(content);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentResponse]);

  return (
    <div className="flex h-full flex-col">
      {/* Content Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 && !currentResponse ? (
          // Show home page when no messages
          <ChatHome onSendMessage={handleSendMessage} isLoading={isLoading} />
        ) : (
          // Show message list when there are messages
          <div className="mx-auto max-w-3xl p-4">
            <MessageList
              messages={messages}
              currentResponse={currentResponse}
              currentArtifacts={currentArtifacts}
              onResendMessage={handleSendMessage}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
            />
          </div>
        )}
      </div>

      {/* Chat Input - Only show when there are messages */}
      {(messages.length > 0 || currentResponse) && (
        <div className="border-t bg-background p-4">
          <div className="mx-auto max-w-3xl">
            <ChatInput
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
            />
          </div>
        </div>
      )}

      {/* Credit Exhausted Dialog */}
      <CreditExhaustedDialog
        open={showCreditDialog}
        onOpenChange={setShowCreditDialog}
        remainingCredits={user?.credits || 0}
      />
    </div>
  );
}
