import { Router } from 'express';
import { requireAuth, requireAuthWithQueryToken, AuthenticatedRequest } from '../middleware/auth';
import { s3Service } from '../services/s3';
import { localBundlingService } from '../services/local-bundling-service';
import { optimizedStorageManager } from '../services/optimized-storage-manager';
import { createLogger } from '../utils/logger';
import { prisma } from '../utils/database';

const router = Router();
const logger = createLogger();

// GET /api/artifacts/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    // Find artifact and verify user has access
    const artifact = await prisma.codeArtifact.findFirst({
      where: {
        id,
        message: {
          conversation: {
            userId,
          },
        },
      },
      include: {
        message: {
          select: {
            id: true,
            conversationId: true,
          },
        },
      },
    });

    if (!artifact) {
      return res.status(404).json({
        error: 'Artifact not found',
        message: 'The specified artifact does not exist or you do not have access to it',
      });
    }

    // Refresh S3 URL if needed
    let s3Url = artifact.s3Url;
    try {
      s3Url = await s3Service.refreshPresignedUrl(artifact.s3Key);
    } catch (error) {
      logger.warn(`Failed to refresh S3 URL for artifact ${id}:`, error);
    }

    res.json({
      artifact: {
        ...artifact,
        s3Url,
      },
    });

    logger.debug('Artifact retrieved', { artifactId: id });
  } catch (error) {
    logger.error('Get artifact error:', error);
    res.status(500).json({
      error: 'Failed to retrieve artifact',
      message: 'Unable to fetch artifact details',
    });
  }
});

// GET /api/artifacts/:id/code
router.get('/:id/code', requireAuth, async (req, res) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    // Find artifact and verify user has access
    const artifact = await prisma.codeArtifact.findFirst({
      where: {
        id,
        message: {
          conversation: {
            userId,
          },
        },
      },
    });

    if (!artifact) {
      return res.status(404).json({
        error: 'Artifact not found',
        message: 'The specified artifact does not exist or you do not have access to it',
      });
    }

    // Get code content from S3
    const code = await s3Service.getCode(artifact.s3Key);

    res.json({
      code,
      artifact: {
        id: artifact.id,
        title: artifact.title,
        language: artifact.language,
        type: artifact.type,
        fileSize: artifact.fileSize,
        createdAt: artifact.createdAt,
      },
    });

    logger.debug('Artifact code retrieved', { artifactId: id });
  } catch (error) {
    logger.error('Get artifact code error:', error);
    
    if (error instanceof Error && error.message.includes('Failed to retrieve code from S3')) {
      return res.status(404).json({
        error: 'Code not found',
        message: 'The code file could not be retrieved from storage',
      });
    }

    res.status(500).json({
      error: 'Failed to retrieve code',
      message: 'Unable to fetch code content',
    });
  }
});

// GET /api/artifacts/:id/download
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    // Find artifact and verify user has access
    const artifact = await prisma.codeArtifact.findFirst({
      where: {
        id,
        message: {
          conversation: {
            userId,
          },
        },
      },
    });

    if (!artifact) {
      return res.status(404).json({
        error: 'Artifact not found',
        message: 'The specified artifact does not exist or you do not have access to it',
      });
    }

    // Get code content from S3
    const code = await s3Service.getCode(artifact.s3Key);

    // Set appropriate headers for download
    const fileExtension = getFileExtension(artifact.language);
    const filename = `${artifact.title.replace(/[^a-zA-Z0-9]/g, '-')}${fileExtension}`;
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(code);

    logger.info('Artifact downloaded', { artifactId: id, filename });
  } catch (error) {
    logger.error('Download artifact error:', error);
    res.status(500).json({
      error: 'Failed to download artifact',
      message: 'Unable to download code file',
    });
  }
});

  

// GET /api/artifacts/:id/preview
router.get('/:id/preview', requireAuthWithQueryToken, async (req, res) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    // Find artifact and verify user has access
    const artifact = await prisma.codeArtifact.findFirst({
      where: {
        id,
        message: {
          conversation: {
            userId,
          },
        },
      },
    });

    if (!artifact) {
      return res.status(404).json({
        error: 'Artifact not found',
        message: 'The specified artifact does not exist or you do not have access to it',
      });
    }

    // Get code content from S3
    const code = await s3Service.getCode(artifact.s3Key);

    let previewHtml = '';

    // Detect if content is actually HTML regardless of declared type
    const isActuallyHtml = code.trim().startsWith('<!DOCTYPE') || code.trim().startsWith('<html');

    if (artifact.type === 'HTML' || artifact.language === 'html' || isActuallyHtml) {
      // For HTML, return as-is (it's already self-contained)
      previewHtml = code;
    } else if (['REACT', 'JAVASCRIPT', 'typescript', 'javascript', 'react', 'tsx', 'jsx'].includes(artifact.type) || 
               ['react', 'javascript', 'typescript', 'tsx', 'jsx'].includes(artifact.language)) {
      // Build and create preview using local bundling service
      const buildResult = await localBundlingService.bundleCode(code, artifact.language);
      
      if (buildResult.success && buildResult.previewHtml) {
        previewHtml = buildResult.previewHtml;
      } else {
        return res.status(400).json({
          error: 'Cannot preview',
          message: 'Code cannot be previewed - build failed',
          errors: buildResult.errors,
          warnings: buildResult.warnings,
        });
      }
    } else {
      return res.status(400).json({
        error: 'Cannot preview',
        message: 'This artifact type cannot be previewed',
      });
    }

    // Return HTML for iframe embedding with proper CSP headers
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Content-Security-Policy', 
      "frame-ancestors 'self' http://localhost:3000 https://localhost:3000; " +
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:;"
    );
    res.send(previewHtml);

    logger.debug('Artifact preview generated', { artifactId: id });
  } catch (error) {
    logger.error('Preview artifact error:', error);
    res.status(500).json({
      error: 'Failed to generate preview',
      message: 'Unable to create code preview',
    });
  }
});

// POST /api/artifacts/:id/bundle - Manually bundle a React artifact
router.post('/:id/bundle', requireAuth, async (req, res) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    // Find artifact and verify user has access
    const artifact = await prisma.codeArtifact.findFirst({
      where: {
        id,
        message: {
          conversation: {
            userId,
          },
        },
      },
    });

    if (!artifact) {
      return res.status(404).json({
        error: 'Artifact not found',
        message: 'The specified artifact does not exist or you do not have access to it',
      });
    }

    // Check if it's a React artifact
    const isReact = ['react', 'jsx', 'tsx'].includes(artifact.language.toLowerCase()) || 
                   artifact.type === 'REACT';

    if (!isReact) {
      return res.status(400).json({
        error: 'Not a React artifact',
        message: 'This endpoint only works with React, JSX, or TSX artifacts',
      });
    }

    // Get code content from S3
    const code = await s3Service.getCode(artifact.s3Key);

    // Bundle the code
    const buildResult = await localBundlingService.bundleCode(code, artifact.language);

    if (buildResult.success && buildResult.previewHtml) {
      // Store bundled HTML to S3
      const bundledHtmlStored = await optimizedStorageManager.storeCode(
        buildResult.previewHtml,
        'html',
        {
          tags: {
            type: 'bundled-html-manual',
            originalArtifact: artifact.id,
          },
        }
      );

      // Update the artifact in database with bundled HTML URLs
      await prisma.codeArtifact.update({
        where: { id: artifact.id },
        data: {
          bundledHtmlKey: bundledHtmlStored.s3Key,
          bundledHtmlUrl: bundledHtmlStored.s3Url,
        },
      });

      logger.info(`Manually bundled HTML for React artifact ${artifact.id}`, {
        htmlS3Key: bundledHtmlStored.s3Key,
        htmlSize: bundledHtmlStored.size,
      });

      res.json({
        success: true,
        message: 'React artifact bundled successfully',
        bundledHtmlUrl: bundledHtmlStored.s3Url,
        buildResult: {
          bundleSize: buildResult.bundleSize,
          buildTime: buildResult.buildTime,
          dependencies: buildResult.dependencies,
          installedPackages: buildResult.installedPackages,
        },
      });
    } else {
      res.status(500).json({
        error: 'Bundling failed',
        message: 'Failed to bundle the React artifact',
        errors: buildResult.errors,
      });
    }

  } catch (error) {
    logger.error('Manual bundle error:', error);
    res.status(500).json({
      error: 'Failed to bundle artifact',
      message: 'Unable to bundle the artifact',
    });
  }
});

// DELETE /api/artifacts/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    // Find artifact and verify user has access
    const artifact = await prisma.codeArtifact.findFirst({
      where: {
        id,
        message: {
          conversation: {
            userId,
          },
        },
      },
    });

    if (!artifact) {
      return res.status(404).json({
        error: 'Artifact not found',
        message: 'The specified artifact does not exist or you do not have access to it',
      });
    }

    // Collect all S3 keys to delete
    const s3KeysToDelete = [artifact.s3Key];

    // Delete from database (cascading will handle project files)
    await prisma.codeArtifact.delete({
      where: { id },
    });

    // Delete from S3 (do this asynchronously)
    Promise.all(
      s3KeysToDelete.map(async (s3Key) => {
        try {
          await s3Service.deleteCode(s3Key);
        } catch (error) {
          logger.warn(`Failed to delete S3 object ${s3Key}:`, error);
        }
      })
    ).catch(error => {
      logger.error('S3 cleanup error after artifact deletion:', error);
    });

    res.json({
      message: 'Artifact deleted successfully',
    });

    logger.info('Artifact deleted', { artifactId: id, s3Key: artifact.s3Key });
  } catch (error) {
    logger.error('Delete artifact error:', error);
    res.status(500).json({
      error: 'Failed to delete artifact',
      message: 'Unable to delete artifact',
    });
  }
});

function getFileExtension(language: string): string {
  const extensions: Record<string, string> = {
    javascript: '.js',
    typescript: '.ts',
    react: '.tsx',
    python: '.py',
    html: '.html',
    css: '.css',
    json: '.json',
    yaml: '.yml',
    markdown: '.md',
    sql: '.sql',
    bash: '.sh',
  };

  return extensions[language.toLowerCase()] || '.txt';
}

export default router;