"use client";

import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import { CodeArtifact } from "@/lib/store/app-store";
import { InlineArtifactViewer } from "./inline-artifact-viewer";

interface ArtifactAwareMarkdownProps {
  content: string;
  artifacts?: CodeArtifact[];
}

export function ArtifactAwareMarkdown({
  content,
  artifacts = [],
}: ArtifactAwareMarkdownProps) {
  // For debugging - always log to see what we're getting
  console.log("ArtifactAwareMarkdown called with:", {
    contentPreview: content.substring(0, 200),
    artifactCount: artifacts?.length || 0,
    artifacts:
      artifacts?.map((a) => ({
        id: a.id,
        title: a.title,
        language: a.language,
        hasCode: !!a.code,
      })) || [],
  });

  // Custom renderer for code blocks
  const customRenderers: Components = {
    code: (props) => {
      const { children, className } = props;
      const isInline = !className?.includes("language-");

      if (!isInline) {
        // For code blocks, check if we have a corresponding artifact
        const codeContent = String(children).replace(/\n$/, "");

        console.log("Processing code block:", {
          codeLength: codeContent.length,
          codePreview: codeContent.substring(0, 100),
          availableArtifacts: artifacts.length,
          className,
        });

        // First try to find matching artifact with code content
        let matchingArtifact = artifacts.find((artifact) => {
          if (!artifact.code) return false;

          // Normalize both strings for comparison (remove extra whitespace)
          const normalizeCode = (str: string) =>
            str.replace(/\s+/g, " ").trim().toLowerCase();
          const normalizedCodeContent = normalizeCode(codeContent);
          const normalizedArtifactCode = normalizeCode(artifact.code);

          // Check if the code block is substantial enough to be an artifact
          if (normalizedCodeContent.length < 20) return false;

          // Calculate similarity based on shared content
          const shorterLength = Math.min(
            normalizedCodeContent.length,
            normalizedArtifactCode.length
          );
          const longerLength = Math.max(
            normalizedCodeContent.length,
            normalizedArtifactCode.length
          );

          // If length difference is too large, it's likely not a match
          if (longerLength / shorterLength > 3) return false;

          // Check for substantial content overlap
          if (
            normalizedArtifactCode.includes(normalizedCodeContent) ||
            normalizedCodeContent.includes(normalizedArtifactCode)
          ) {
            console.log("Found matching artifact:", artifact.title);
            return true;
          }

          // Check for high similarity using common substrings
          const similarity = calculateSimilarity(
            normalizedCodeContent,
            normalizedArtifactCode
          );
          if (similarity > 0.3) {
            console.log(
              "Found similar artifact:",
              artifact.title,
              "similarity:",
              similarity
            );
            return true;
          }

          return false;
        });

        // Only try fallback detection if we have artifacts that actually came from the backend
        // This prevents creating fake artifacts for example code in conversational responses
        if (!matchingArtifact && artifacts.length > 0) {
          // Only match if artifacts have actual code content loaded from backend
          // This ensures we don't create artifacts for example code in conversational responses
          const artifactsWithCode = artifacts.filter(
            (artifact) => artifact.code && artifact.code.length > 0
          );

          if (artifactsWithCode.length > 0) {
            const isLargeCodeBlock = codeContent.length > 50; // Reduced threshold
            const hasWebLanguage =
              className?.includes("language-html") ||
              className?.includes("language-css") ||
              className?.includes("language-javascript") ||
              className?.includes("language-jsx") ||
              className?.includes("language-tsx");

            if (
              (isLargeCodeBlock || hasWebLanguage) &&
              artifactsWithCode.length === 1
            ) {
              // If we have exactly one artifact with code and a substantial code block, assume they match
              matchingArtifact = artifactsWithCode[0];
              console.log(
                "Using fallback matching for artifact with code:",
                matchingArtifact.title
              );
            } else if (isLargeCodeBlock || artifactsWithCode.length === 1) {
              // For multiple artifacts, try to match by language/type, or if only one artifact, use it
              matchingArtifact =
                artifactsWithCode.find((artifact) => {
                  const artifactLanguage = artifact.language.toLowerCase();
                  const blockLanguage =
                    className?.replace("language-", "").toLowerCase() || "";

                  return (
                    artifactLanguage === blockLanguage ||
                    (artifactLanguage === "html" && hasWebLanguage) ||
                    (artifactLanguage === "javascript" &&
                      (blockLanguage === "js" || blockLanguage === "jsx")) ||
                    (artifactLanguage === "typescript" &&
                      (blockLanguage === "ts" || blockLanguage === "tsx"))
                  );
                }) ||
                (artifactsWithCode.length === 1
                  ? artifactsWithCode[0]
                  : undefined);

              if (matchingArtifact) {
                console.log(
                  "Using language-based or single artifact matching:",
                  matchingArtifact.title
                );
              }
            }
          } else {
            console.log(
              "No artifacts with code content available, skipping fallback matching"
            );
          }
        }

        // Simple similarity function
        function calculateSimilarity(str1: string, str2: string): number {
          const len1 = str1.length;
          const len2 = str2.length;
          const matrix = Array(len1 + 1)
            .fill(null)
            .map(() => Array(len2 + 1).fill(null));

          for (let i = 0; i <= len1; i++) matrix[i][0] = i;
          for (let j = 0; j <= len2; j++) matrix[0][j] = j;

          for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
              if (str1[i - 1] === str2[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1];
              } else {
                matrix[i][j] = Math.min(
                  matrix[i - 1][j - 1] + 1,
                  matrix[i][j - 1] + 1,
                  matrix[i - 1][j] + 1
                );
              }
            }
          }

          return 1 - matrix[len1][len2] / Math.max(len1, len2);
        }

        // If we found a matching artifact, render the artifact viewer instead
        if (matchingArtifact) {
          console.log(
            "✅ Found matching artifact, rendering InlineArtifactViewer:",
            matchingArtifact.title
          );
          return (
            <div className="my-4 not-prose">
              <InlineArtifactViewer artifact={matchingArtifact} />
            </div>
          );
        } else {
          console.log("❌ No matching artifact found for code block");
        }
      }

      // Default code rendering for inline code or non-matching blocks
      if (isInline) {
        return (
          <code
            className="bg-muted/50 text-foreground px-1.5 py-0.5 rounded-md font-mono text-sm"
            {...props}
          >
            {children}
          </code>
        );
      }

      // For code blocks that don't match artifacts, use better styling
      return (
        <div className="my-4 not-prose">
          <pre className="bg-muted/50 border border-border p-4 rounded-md overflow-x-auto">
            <code
              className="text-foreground font-mono text-sm whitespace-pre"
              {...props}
            >
              {children}
            </code>
          </pre>
        </div>
      );
    },
  };

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={customRenderers}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
