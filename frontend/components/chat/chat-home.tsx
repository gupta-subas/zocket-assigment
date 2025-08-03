"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUp } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

interface ChatHomeProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

const suggestionPrompts = [
  "Create a responsive webpage layout using HTML and CSS",
  "Explain how React state and props work",
  "Build a to-do list using React",
  "What is the difference between var, let, and const in JavaScript?",
  "Fix this CSS layout issue",
  "Add a dark mode toggle in a React app",
  "Generate meta tags for SEO optimization",
  "What are React hooks and when should I use them?",
  "Center a div both vertically and horizontally",
  "How does the virtual DOM work in React?",
];

export function ChatHome({ onSendMessage, isLoading }: ChatHomeProps) {
  const [message, setMessage] = useState("");
  const { user } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (!isLoading) {
      onSendMessage(suggestion);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <div className="w-full max-w-3xl space-y-8">
        {/* Greeting Message */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-medium text-foreground">
            ✨ Hey there,{" "}
            <span className="text-muted-foreground">
              {user?.username || user?.email?.split("@")[0] || "Guest"}
            </span>
          </h1>
        </div>

        {/* Main Input */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How can I help you today?"
              disabled={isLoading}
              className="h-20 w-full rounded-3xl border bg-background pl-6 pr-6 text-base shadow-sm focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Send Button - Bottom Right */}
          <Button
            type="submit"
            size="icon"
            disabled={!message.trim() || isLoading}
            className="absolute bottom-2 right-2 h-10 w-10 rounded-full"
          >
            <ArrowUp className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>

        {/* Suggestion Buttons */}
        <div className="flex flex-wrap justify-center gap-2">
          {suggestionPrompts.map((prompt, index) => (
            <Button
              key={index}
              variant="outline"
              onClick={() => handleSuggestionClick(prompt)}
              disabled={isLoading}
              className="h-9 rounded-full border-muted-foreground/20 px-4 text-sm font-normal text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {prompt}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
