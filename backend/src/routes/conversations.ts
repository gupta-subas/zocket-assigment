import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { memoryManager } from '../services/memory';
import { s3Service } from '../services/s3';
import { createLogger } from '../utils/logger';
import { prisma } from '../utils/database';

const router = Router();
const logger = createLogger();

// Validation schemas
const updateConversationSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').max(200, 'Title too long').optional(),
});

const conversationQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1).pipe(z.number().min(1)),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20).pipe(z.number().min(1).max(50)),
  search: z.string().optional(),
});

// GET /api/conversations
router.get('/', requireAuth, async (req, res) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const { page, limit, search } = conversationQuerySchema.parse(req.query);

    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: any = { userId };
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        {
          messages: {
            some: {
              content: { contains: search, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    // Get conversations with message count
    const [conversations, totalCount] = await Promise.all([
      prisma.conversation.findMany({
        where: whereClause,
        include: {
          _count: {
            select: {
              messages: true,
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              content: true,
              role: true,
              createdAt: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.conversation.count({ where: whereClause }),
    ]);

    const formattedConversations = conversations.map(conv => ({
      id: conv.id,
      title: conv.title,
      messageCount: conv._count.messages,
      lastMessage: conv.messages[0] || null,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    }));

    res.json({
      conversations: formattedConversations,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1,
      },
    });

    logger.debug('Conversations retrieved', { userId, count: conversations.length });
  } catch (error) {
    logger.error('Get conversations error:', error);
    
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
      error: 'Failed to retrieve conversations',
      message: 'Unable to fetch conversations',
    });
  }
});

// GET /api/conversations/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        messages: {
          include: {
            artifacts: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found',
        message: 'The specified conversation does not exist or you do not have access to it',
      });
    }

    // Batch refresh S3 URLs for better performance
    const allArtifacts = conversation.messages.flatMap(msg => msg.artifacts);
    
    // Batch refresh URLs (limit concurrency to avoid rate limits)
    const refreshPromises = allArtifacts.map(async (artifact) => {
      try {
        const refreshedUrl = await s3Service.refreshPresignedUrl(artifact.s3Key);
        return { id: artifact.id, refreshedUrl };
      } catch (error) {
        logger.warn(`Failed to refresh S3 URL for artifact ${artifact.id}:`, error);
        return { id: artifact.id, refreshedUrl: null };
      }
    });

    const refreshedUrls = await Promise.all(refreshPromises);
    const urlMap = new Map(refreshedUrls.map(item => [item.id, item.refreshedUrl]));

    // Apply refreshed URLs to messages
    const messagesWithRefreshedArtifacts = conversation.messages.map(message => ({
      ...message,
      artifacts: message.artifacts.map(artifact => ({
        ...artifact,
        s3Url: urlMap.get(artifact.id) || artifact.s3Url,
      })),
    }));

    res.json({
      conversation: {
        ...conversation,
        messages: messagesWithRefreshedArtifacts,
      },
    });

    logger.debug('Conversation retrieved', { conversationId: id, messageCount: conversation.messages.length });
  } catch (error) {
    logger.error('Get conversation error:', error);
    res.status(500).json({
      error: 'Failed to retrieve conversation',
      message: 'Unable to fetch conversation details',
    });
  }
});

// PUT /api/conversations/:id
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const { id } = req.params;
    const { title } = updateConversationSchema.parse(req.body);

    // Verify ownership
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingConversation) {
      return res.status(404).json({
        error: 'Conversation not found',
        message: 'The specified conversation does not exist or you do not have access to it',
      });
    }

    // Update conversation
    const updatedConversation = await prisma.conversation.update({
      where: { id },
      data: { title },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    res.json({
      message: 'Conversation updated successfully',
      conversation: updatedConversation,
    });

    logger.info('Conversation updated', { conversationId: id, newTitle: title });
  } catch (error) {
    logger.error('Update conversation error:', error);
    
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
      error: 'Failed to update conversation',
      message: 'Unable to update conversation',
    });
  }
});

// DELETE /api/conversations/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    // Verify ownership and get conversation with artifacts
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        messages: {
          include: {
            artifacts: {
              select: {
                s3Key: true,
              },
            },
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

    // Collect all S3 keys to delete
    const s3KeysToDelete: string[] = [];
    conversation.messages.forEach(message => {
      message.artifacts.forEach(artifact => {
        s3KeysToDelete.push(artifact.s3Key);
      });
    });

    // Delete from database (cascading will handle messages and artifacts)
    await prisma.conversation.delete({
      where: { id },
    });

    // Clear from memory
    await memoryManager.clearConversation(id);

    // Delete S3 objects (do this asynchronously to not block the response)
    Promise.all(
      s3KeysToDelete.map(async (s3Key) => {
        try {
          await s3Service.deleteCode(s3Key);
        } catch (error) {
          logger.warn(`Failed to delete S3 object ${s3Key}:`, error);
        }
      })
    ).catch(error => {
      logger.error('S3 cleanup error after conversation deletion:', error);
    });

    res.json({
      message: 'Conversation deleted successfully',
      deletedArtifacts: s3KeysToDelete.length,
    });

    logger.info('Conversation deleted', { 
      conversationId: id,
      messageCount: conversation.messages.length,
      artifactCount: s3KeysToDelete.length,
    });
  } catch (error) {
    logger.error('Delete conversation error:', error);
    res.status(500).json({
      error: 'Failed to delete conversation',
      message: 'Unable to delete conversation',
    });
  }
});

// GET /api/conversations/:id/export
router.get('/:id/export', requireAuth, async (req, res) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const { id } = req.params;
    const format = req.query.format as string || 'json';

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        messages: {
          include: {
            artifacts: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        user: {
          select: {
            username: true,
            email: true,
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

    if (format === 'markdown') {
      let markdown = `# ${conversation.title || 'Untitled Conversation'}\n\n`;
      markdown += `**Created:** ${conversation.createdAt.toISOString()}\n`;
      markdown += `**User:** ${conversation.user.username}\n\n`;
      markdown += '---\n\n';

      conversation.messages.forEach((message, index) => {
        const role = message.role === 'USER' ? '👤 User' : '🤖 Assistant';
        markdown += `## ${role}\n\n`;
        markdown += `${message.content}\n\n`;

        if (message.artifacts.length > 0) {
          markdown += '### Code Artifacts\n\n';
          message.artifacts.forEach((artifact) => {
            markdown += `**${artifact.title}** (${artifact.language})\n\n`;
            // Note: We'd need to fetch the code from S3 to include it
            markdown += `[Download ${artifact.title}](${artifact.s3Url})\n\n`;
          });
        }

        markdown += '---\n\n';
      });

      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="conversation-${id}.md"`);
      res.send(markdown);
    } else {
      // JSON format (default)
      const exportData = {
        conversation: {
          id: conversation.id,
          title: conversation.title,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          user: conversation.user,
        },
        messages: conversation.messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt,
          artifacts: msg.artifacts.map(artifact => ({
            id: artifact.id,
            title: artifact.title,
            language: artifact.language,
            type: artifact.type,
            fileSize: artifact.fileSize,
            downloadUrl: artifact.s3Url,
            createdAt: artifact.createdAt,
          })),
        })),
        exportedAt: new Date().toISOString(),
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="conversation-${id}.json"`);
      res.json(exportData);
    }

    logger.info('Conversation exported', { conversationId: id, format });
  } catch (error) {
    logger.error('Export conversation error:', error);
    res.status(500).json({
      error: 'Failed to export conversation',
      message: 'Unable to export conversation',
    });
  }
});

export default router;