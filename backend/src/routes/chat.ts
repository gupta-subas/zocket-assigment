import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { geminiService } from '../services/gemini';
import { memoryManager } from '../services/memory';
import { createLogger } from '../utils/logger';
import { prisma } from '../utils/database';

import { optimizedStorageManager } from '../services/optimized-storage-manager';
import { streamingService } from '../services/streaming-service';
import { securityValidator } from '../services/security-validator';
import { enhancedCodeExtractor } from '../services/enhanced-code-extractor';
import { localBundlingService } from '../services/local-bundling-service';
import { codeIntentDetector } from '../services/code-intent-detector';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const logger = createLogger();

// Validation schemas
const sendMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(10000, 'Message too long'),
  conversationId: z.string().uuid('Invalid conversation ID').optional(),
  stream: z.boolean().optional().default(true),
  enableSecurity: z.boolean().optional().default(true),
  enableBuilding: z.boolean().optional().default(true),
  enablePreview: z.boolean().optional().default(true),
});

// POST /api/chat/send
router.post('/send', requireAuth, async (req, res) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const { 
      message, 
      conversationId, 
      stream, 
      enableSecurity, 
      enableBuilding, 
      enablePreview 
    } = sendMessageSchema.parse(req.body);

    // Check user credits
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User account no longer exists'
      });
    }

    if (user.credits <= 0) {
      return res.status(403).json({
        error: 'Insufficient credits',
        message: 'You have exhausted your credits. Please contact subasgupta@outlook.com to get more credits.',
        credits: 0
      });
    }

    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 20, // Get last 20 messages for context (most recent first)
            select: {
              id: true,
              role: true,
              content: true,
              createdAt: true,
            },
          },
        },
      });

      if (!conversation) {
        return res.status(404).json({
          error: 'Conversation not found',
          message: 'The specified conversation does not exist or you do not have access to it',
        });
      }
    } else {
      // Create new conversation
      conversation = await prisma.conversation.create({
        data: {
          userId,
          title: message.length > 50 ? message.substring(0, 47) + '...' : message,
        },
        include: {
          messages: true,
        },
      });
    }

    // Save user message
    const userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: message,
      },
    });

    if (stream) {
      // Create optimized streaming session
      const sessionId = uuidv4();
      const session = streamingService.createStreamSession(sessionId, res, {
        enableArtifactProcessing: true,
        enableBuilding: enableBuilding,
        enablePreview: enablePreview,
        compression: true,
        timeout: 120000,
      });

      try {
        // Get conversation memory and create chat session
        const memory = memoryManager.getConversationMemory(conversation.id);
        const history = await memory.getGeminiHistory();
        const chatSession = geminiService.createChatSession(history);

        // Stream with single-file processing
        const aiResponseGenerator = geminiService.streamMessage(message, chatSession, {
          enableSecurity,
          enableBuilding,
          conversationHistory: history,
        });
        
        // Custom streaming for single-file consolidation
        let fullResponse = '';
        const artifacts = [];

        for await (const chunk of aiResponseGenerator) {
          if (!chunk.isComplete) {
            fullResponse += chunk.text;
            
            // Send chunk to client
            streamingService['sendEvent'](sessionId, {
              type: 'chunk',
              data: {
                text: chunk.text,
                isComplete: false,
              },
            });
          }
        }

        // Intelligent code detection before extraction
        const userIntent = codeIntentDetector.analyzeUserIntent(message);
        const responseIntent = codeIntentDetector.analyzeResponseContent(fullResponse);
        
        logger.info('Code intent analysis', {
          userIntent: userIntent,
          responseIntent: responseIntent,
          conversationId: conversation.id,
        });

        // Only extract code if user intent is code-related AND response contains substantial code
        let consolidatedCode = null;
        if (userIntent.isCodeRelated && (responseIntent.isCodeRelated && responseIntent.confidence > 0.6)) {
          logger.info('Attempting code extraction based on intent analysis');
          consolidatedCode = enhancedCodeExtractor.extractAndConsolidateCode(fullResponse);
        } else {
          logger.info('Skipping code extraction - not code-related or insufficient intent', {
            userIntentCodeRelated: userIntent.isCodeRelated,
            userReasoning: userIntent.reasoning,
            responseIntentCodeRelated: responseIntent.isCodeRelated,
            responseConfidence: responseIntent.confidence,
            responseReasoning: responseIntent.reasoning,
          });
        }
        
        if (consolidatedCode) {
          // Store the consolidated code without compression to preserve formatting
          const stored = await optimizedStorageManager.storeCode(
            consolidatedCode.code,
            consolidatedCode.language,
            {
              compression: false,
              tags: {
                conversationId: conversation.id,
                type: 'consolidated-single-file',
                originalBlocks: consolidatedCode.metadata.originalBlocks.toString(),
              },
            }
          );

          artifacts.push({
            id: consolidatedCode.id,
            title: consolidatedCode.title,
            language: consolidatedCode.language,
            type: consolidatedCode.type,
            code: consolidatedCode.code,
            hash: consolidatedCode.hash,
            metadata: consolidatedCode.metadata,
            s3Key: stored.s3Key,
            s3Url: stored.s3Url,
            size: stored.size,
          });

          // Don't send artifact event during streaming - wait until it's saved to database
          // We'll send it after the artifact is properly saved to the database

          // Build if enabled and buildable
          if (enableBuilding && isBuildable(consolidatedCode)) {
            try {
              // Use local bundling service
              const smartBuildResult = await localBundlingService.bundleCode(
                consolidatedCode.code,
                consolidatedCode.language
              );
              
              // Send comprehensive build result
              streamingService['sendEvent'](sessionId, {
                type: 'chunk',
                data: {
                  type: 'build',
                  buildResult: {
                    success: smartBuildResult.success,
                    artifactId: consolidatedCode.id,
                    bundleSize: smartBuildResult.bundleSize,
                    buildTime: smartBuildResult.buildTime,
                    dependencies: smartBuildResult.dependencies,
                    installedPackages: smartBuildResult.installedPackages,
                    errors: smartBuildResult.errors,
                    warnings: smartBuildResult.warnings,
                  },
                },
              });

              // Build completed successfully
              
            } catch (buildError) {
              logger.warn(`Smart build failed for consolidated code:`, buildError);
              streamingService['sendEvent'](sessionId, {
                type: 'chunk',
                data: {
                  type: 'build-error',
                  error: buildError instanceof Error ? buildError.message : 'Build failed',
                },
              });
            }
          }
        }

        const streamResult = {
          fullResponse,
          artifacts,
          projects: [], // No multi-file projects
          builds: [],
        };

        // Security validation if enabled
        let securityResults = null;
        if (enableSecurity) {
          try {
            securityResults = await securityValidator.validateCode(
              streamResult.fullResponse,
              'text',
              {
                strictMode: true,
                enableHeuristics: true,
                maxComplexity: 100,
              }
            );

            // Send security scan results
            streamingService['sendEvent'](sessionId, {
              type: 'chunk',
              data: {
                type: 'security',
                isSecure: securityResults.isSecure,
                riskLevel: securityResults.riskLevel,
                issues: securityResults.issues.length,
                score: securityResults.score,
              },
            });
          } catch (secError) {
            logger.warn('Security validation failed:', secError);
          }
        }

        // Save assistant message with enhanced metadata
        const assistantMessage = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: 'ASSISTANT',
            content: streamResult.fullResponse,
          },
        });

        // Process artifacts with new system
        const savedArtifacts = [];

        // Save consolidated artifacts with consistent IDs
        for (const artifact of streamResult.artifacts) {
          try {
            const savedArtifact = await prisma.codeArtifact.create({
              data: {
                id: artifact.id, // Use the same ID from the code extractor
                messageId: assistantMessage.id,
                title: artifact.title,
                language: artifact.language,
                type: artifact.type,
                s3Key: artifact.s3Key,
                s3Url: artifact.s3Url,
                fileSize: artifact.size,
              },
            });
            savedArtifacts.push(savedArtifact);

            // Now send the artifact event after it's safely in database
            streamingService['sendEvent'](sessionId, {
              type: 'chunk',
              data: {
                type: 'artifact',
                artifact: {
                  id: savedArtifact.id,
                  title: savedArtifact.title,
                  language: savedArtifact.language,
                  type: savedArtifact.type,
                  s3Key: savedArtifact.s3Key,
                  s3Url: savedArtifact.s3Url,
                  size: savedArtifact.fileSize,
                },
              },
            });
          } catch (error) {
            logger.error('Failed to save consolidated artifact:', error);
          }
        }


        // Update conversation memory with enhanced context
        await memory.saveContext(
          { input: message },
          { output: streamResult.fullResponse }
        );

        // Close streaming session
        streamingService.closeSession(sessionId, 'completed');

        // Decrement user credits after successful streaming response
        await prisma.user.update({
          where: { id: userId },
          data: { credits: { decrement: 1 } }
        });

        logger.info('Single-file streaming chat response completed', {
          conversationId: conversation.id,
          messageId: assistantMessage.id,
          artifactsCount: savedArtifacts.length,
          singleFileProcessed: streamResult.artifacts.length > 0,
          securityScore: securityResults?.score || 'skipped',
        });

      } catch (error) {
        logger.error('Enhanced streaming chat error:', error);
        streamingService.closeSession(sessionId, 'error');
        
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Streaming failed',
            message: 'An error occurred during streaming',
          });
        }
      }
    } else {
      // Enhanced non-streaming response
      try {
        const memory = memoryManager.getConversationMemory(conversation.id);
        const history = await memory.getGeminiHistory();
        const chatSession = geminiService.createChatSession(history);

        const response = await geminiService.sendMessage(message, chatSession, {
          enableSecurity,
          enableBuilding,
          conversationHistory: history,
        });
        
        // Intelligent code detection before extraction
        const userIntent = codeIntentDetector.analyzeUserIntent(message);
        const responseIntent = codeIntentDetector.analyzeResponseContent(response);
        
        logger.info('Code intent analysis (non-streaming)', {
          userIntent: userIntent,
          responseIntent: responseIntent,
          conversationId: conversation.id,
        });

        // Only extract code if user intent is code-related AND response contains substantial code
        let consolidatedCode = null;
        if (userIntent.isCodeRelated && (responseIntent.isCodeRelated && responseIntent.confidence > 0.6)) {
          logger.info('Attempting code extraction based on intent analysis (non-streaming)');
          consolidatedCode = enhancedCodeExtractor.extractAndConsolidateCode(response);
        } else {
          logger.info('Skipping code extraction - not code-related or insufficient intent (non-streaming)', {
            userIntentCodeRelated: userIntent.isCodeRelated,
            userReasoning: userIntent.reasoning,
            responseIntentCodeRelated: responseIntent.isCodeRelated,
            responseConfidence: responseIntent.confidence,
            responseReasoning: responseIntent.reasoning,
          });
        }
        const savedArtifacts = [];
        const builds = [];

        // Security validation if enabled
        let securityResults = null;
        if (enableSecurity) {
          try {
            securityResults = await securityValidator.validateCode(
              response,
              'text',
              { strictMode: true, enableHeuristics: true }
            );
          } catch (secError) {
            logger.warn('Security validation failed:', secError);
          }
        }

        // Save assistant message
        const assistantMessage = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: 'ASSISTANT',
            content: response,
          },
        });

        // Process consolidated code
        if (consolidatedCode) {
          try {
            // Store the consolidated code without compression to preserve formatting
            const stored = await optimizedStorageManager.storeCode(
              consolidatedCode.code,
              consolidatedCode.language,
              { 
                compression: false,
                tags: { 
                  conversationId: conversation.id,
                  messageId: assistantMessage.id,
                  type: 'non-streaming-consolidated',
                  originalBlocks: consolidatedCode.metadata.originalBlocks.toString(),
                },
              }
            );

            const savedArtifact = await prisma.codeArtifact.create({
              data: {
                id: consolidatedCode.id, // Use the same ID from the code extractor
                messageId: assistantMessage.id,
                title: consolidatedCode.title,
                language: consolidatedCode.language,
                type: consolidatedCode.type,
                s3Key: stored.s3Key,
                s3Url: stored.s3Url,
                fileSize: stored.size,
              },
            });

            savedArtifacts.push(savedArtifact);

            // Build if enabled
            if (enableBuilding && isBuildable(consolidatedCode)) {
              try {
                const smartBuildResult = await localBundlingService.bundleCode(
                  consolidatedCode.code,
                  consolidatedCode.language
                );
                
                if (smartBuildResult.success) {
                  builds.push({ 
                    artifact: savedArtifact, 
                    buildResult: smartBuildResult,
                  });

                  // For React artifacts, also save the bundled HTML to S3
                  if (smartBuildResult.previewHtml && isReactArtifact(consolidatedCode)) {
                    try {
                      const bundledHtmlStored = await optimizedStorageManager.storeCode(
                        smartBuildResult.previewHtml,
                        'html',
                        {
                          tags: {
                            conversationId: conversation.id,
                            messageId: assistantMessage.id,
                            type: 'bundled-html',
                            originalArtifact: savedArtifact.id,
                          },
                        }
                      );

                      // Update the artifact in database with bundled HTML URLs
                      await prisma.codeArtifact.update({
                        where: { id: savedArtifact.id },
                        data: {
                          bundledHtmlKey: bundledHtmlStored.s3Key,
                          bundledHtmlUrl: bundledHtmlStored.s3Url,
                        },
                      });

                      logger.info(`Bundled HTML saved for non-streaming React artifact ${savedArtifact.id}`, {
                        htmlS3Key: bundledHtmlStored.s3Key,
                        htmlSize: bundledHtmlStored.size,
                      });
                    } catch (htmlError) {
                      logger.warn(`Failed to save bundled HTML for non-streaming artifact ${savedArtifact.id}:`, htmlError);
                    }
                  }
                }

                // Build completed successfully
                
              } catch (buildError) {
                logger.warn(`Smart build failed for consolidated code:`, buildError);
              }
            }

          } catch (error) {
            logger.error('Failed to save consolidated code:', error);
          }
        }


        // Update memory with enhanced context
        await memory.saveContext(
          { input: message },
          { output: response }
        );

        // Decrement user credits after successful response
        await prisma.user.update({
          where: { id: userId },
          data: { credits: { decrement: 1 } }
        });

        res.json({
          message: 'Single-file response generated successfully',
          data: {
            messageId: assistantMessage.id,
            conversationId: conversation.id,
            response,
            artifacts: savedArtifacts,
            builds: builds.length,
            security: securityResults ? {
              isSecure: securityResults.isSecure,
              riskLevel: securityResults.riskLevel,
              score: securityResults.score,
              issues: securityResults.issues.length,
            } : null,
            stats: {
              consolidatedCodeProcessed: consolidatedCode ? 1 : 0,
              originalBlocks: consolidatedCode?.metadata.originalBlocks || 0,
              buildsCompleted: builds.length,
              securityScanEnabled: enableSecurity,
            },
          },
        });

        logger.info('Single-file chat response completed', {
          conversationId: conversation.id,
          messageId: assistantMessage.id,
          artifactsCount: savedArtifacts.length,
          consolidatedCodeProcessed: consolidatedCode ? 1 : 0,
          buildsCount: builds.length,
          securityScore: securityResults?.score || 'skipped',
        });

      } catch (error) {
        logger.error('Single-file chat response error:', error);
        res.status(500).json({
          error: 'Failed to generate single-file response',
          message: 'An error occurred while processing your request',
        });
      }
    }
  } catch (error) {
    logger.error('Chat endpoint error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    res.status(500).json({
      error: 'Chat request failed',
      message: 'Unable to process chat request',
    });
  }
});

// POST /api/chat/regenerate
router.post('/regenerate/:messageId', requireAuth, async (req, res) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const { messageId } = req.params;
    const { stream = true } = req.body;

    // Find the message and verify ownership
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversation: {
          userId,
        },
      },
      include: {
        conversation: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!message) {
      return res.status(404).json({
        error: 'Message not found',
        message: 'The specified message does not exist or you do not have access to it',
      });
    }

    if (message.role !== 'ASSISTANT') {
      return res.status(400).json({
        error: 'Invalid message type',
        message: 'Can only regenerate assistant messages',
      });
    }

    // Find the user message that prompted this assistant response
    const messageIndex = message.conversation.messages.findIndex(m => m.id === messageId);
    if (messageIndex === 0) {
      return res.status(400).json({
        error: 'Cannot regenerate',
        message: 'No user message found to regenerate from',
      });
    }

    const userMessage = message.conversation.messages[messageIndex - 1];
    
    // Delete the old assistant message and any artifacts
    await prisma.codeArtifact.deleteMany({
      where: { messageId: message.id },
    });
    
    await prisma.message.delete({
      where: { id: message.id },
    });

    // Regenerate response using the same logic as /send
    // This is similar to the /send endpoint but reuses existing conversation
    if (stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      });

      let fullResponse = '';
      
      try {
        const memory = memoryManager.getConversationMemory(message.conversation.id);
        const history = await memory.getGeminiHistory();
        const chatSession = geminiService.createChatSession(history);

        const streamGenerator = geminiService.streamMessage(userMessage.content, chatSession);
        
        for await (const chunk of streamGenerator) {
          if (!chunk.isComplete) {
            fullResponse += chunk.text;
            
            res.write(`data: ${JSON.stringify({
              type: 'chunk',
              data: {
                text: chunk.text,
                isComplete: false,
              }
            })}\n\n`);
          }
        }

        // Save new assistant message
        const newAssistantMessage = await prisma.message.create({
          data: {
            conversationId: message.conversation.id,
            role: 'ASSISTANT',
            content: fullResponse,
          },
        });

        res.write(`data: ${JSON.stringify({
          type: 'complete',
          data: {
            messageId: newAssistantMessage.id,
            conversationId: message.conversation.id,
            isComplete: true,
          }
        })}\n\n`);

        await memory.saveContext(
          { input: userMessage.content },
          { output: fullResponse }
        );

      } catch (error) {
        logger.error('Regenerate streaming error:', error);
        res.write(`data: ${JSON.stringify({
          type: 'error',
          data: {
            error: 'Failed to regenerate response',
          }
        })}\n\n`);
      }
      
      res.end();
    } else {
      // Non-streaming regeneration
      try {
        const memory = memoryManager.getConversationMemory(message.conversation.id);
        const history = await memory.getGeminiHistory();
        const chatSession = geminiService.createChatSession(history);

        const response = await geminiService.sendMessage(userMessage.content, chatSession, {
          enableSecurity: true,
          enableBuilding: true,
          conversationHistory: history,
        });

        // Save new assistant message
        const newAssistantMessage = await prisma.message.create({
          data: {
            conversationId: message.conversation.id,
            role: 'ASSISTANT',
            content: response,
          },
        });

        // Update memory
        await memory.saveContext(
          { input: userMessage.content },
          { output: response }
        );

        res.json({
          message: 'Response regenerated successfully',
          data: {
            messageId: newAssistantMessage.id,
            conversationId: message.conversation.id,
            response,
          },
        });

        logger.info('Message regenerated successfully', {
          conversationId: message.conversation.id,
          oldMessageId: messageId,
          newMessageId: newAssistantMessage.id,
        });

      } catch (error) {
        logger.error('Non-streaming regeneration error:', error);
        res.status(500).json({
          error: 'Failed to regenerate response',
          message: 'An error occurred while regenerating the response',
        });
      }
    }

  } catch (error) {
    logger.error('Regenerate message error:', error);
    res.status(500).json({
      error: 'Failed to regenerate message',
      message: 'An error occurred while regenerating the response',
    });
  }
});

// Helper function for buildability check
function isBuildable(artifact: any): boolean {
  const buildableTypes = ['REACT', 'JAVASCRIPT', 'HTML'];
  const buildableLanguages = ['javascript', 'typescript', 'jsx', 'tsx', 'react'];
  
  return buildableTypes.includes(artifact.type) || 
         buildableLanguages.includes(artifact.language?.toLowerCase());
}

// Helper function to check if artifact is React-based
function isReactArtifact(artifact: any): boolean {
  const reactTypes = ['REACT'];
  const reactLanguages = ['jsx', 'tsx', 'react'];
  
  return reactTypes.includes(artifact.type) || 
         reactLanguages.includes(artifact.language?.toLowerCase()) ||
         artifact.metadata?.hasJSX ||
         artifact.metadata?.framework === 'react';
}

export default router;