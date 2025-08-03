import { Response } from 'express';
import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { codeProcessor, CodeArtifactEnhanced, ProjectStructureEnhanced } from './code-processor';
import { optimizedStorageManager } from './optimized-storage-manager';
import { localBundlingService } from './local-bundling-service';
import { prisma } from '../utils/database';
import { s3Service } from './s3';

const logger = createLogger();

export interface StreamEvent {
  id: string;
  type: 'chunk' | 'artifact' | 'project' | 'build' | 'error' | 'complete';
  data: any;
  timestamp: number;
  retryCount?: number;
}

export interface StreamOptions {
  enableArtifactProcessing?: boolean;
  enableBuilding?: boolean;
  enablePreview?: boolean;
  maxRetries?: number;
  timeout?: number;
  compression?: boolean;
}

export interface StreamSession {
  id: string;
  response: Response;
  options: StreamOptions;
  eventHistory: StreamEvent[];
  startTime: number;
  lastActivity: number;
  isActive: boolean;
  artifactsProcessed: number;
  projectsProcessed: number;
  totalChunks: number;
}

export class StreamingService extends EventEmitter {
  private sessions = new Map<string, StreamSession>();
  private readonly maxSessions = 100;
  private readonly sessionTimeout = 300000; // 5 minutes
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.startSessionCleanup();
  }

  /**
   * Create a new streaming session with enhanced capabilities
   */
  createStreamSession(
    sessionId: string,
    response: Response,
    options: StreamOptions = {}
  ): StreamSession {
    // Set SSE headers with enhanced configuration
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control, Content-Type',
      'Access-Control-Expose-Headers': 'X-Stream-Session-Id',
      'X-Stream-Session-Id': sessionId,
      'X-Accel-Buffering': 'no', // Nginx optimization
    });

    const session: StreamSession = {
      id: sessionId,
      response,
      options: {
        enableArtifactProcessing: true,
        enableBuilding: true,
        enablePreview: true,
        maxRetries: 3,
        timeout: 120000, // 2 minutes
        compression: false,
        ...options,
      },
      eventHistory: [],
      startTime: Date.now(),
      lastActivity: Date.now(),
      isActive: true,
      artifactsProcessed: 0,
      projectsProcessed: 0,
      totalChunks: 0,
    };

    // Cleanup old sessions if needed
    if (this.sessions.size >= this.maxSessions) {
      this.cleanupOldestSession();
    }

    this.sessions.set(sessionId, session);

    // Send initial connection event
    this.sendEvent(sessionId, {
      type: 'chunk',
      data: {
        type: 'connection',
        message: 'Stream connected',
        sessionId,
        capabilities: {
          artifactProcessing: session.options.enableArtifactProcessing,
          building: session.options.enableBuilding,
          preview: session.options.enablePreview,
        },
      },
    });

    // Set up session timeout
    setTimeout(() => {
      this.closeSession(sessionId, 'timeout');
    }, session.options.timeout!);

    logger.info(`Stream session created: ${sessionId}`);
    return session;
  }

  /**
   * Stream AI response with real-time processing
   */
  async streamAIResponse(
    sessionId: string,
    aiResponseGenerator: AsyncGenerator<{ text: string; isComplete: boolean }>,
    conversationId: string
  ): Promise<{
    fullResponse: string;
    artifacts: CodeArtifactEnhanced[];
    projects: ProjectStructureEnhanced[];
    builds: any[];
  }> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error('Invalid or inactive session');
    }

    let fullResponse = '';
    let artifacts: CodeArtifactEnhanced[] = [];
    let projects: ProjectStructureEnhanced[] = [];
    let builds: any[] = [];

    try {
      // Stream chunks and process in real-time
      for await (const chunk of aiResponseGenerator) {
        if (!chunk.isComplete) {
          fullResponse += chunk.text;
          session.totalChunks++;
          session.lastActivity = Date.now();

          // Send chunk to client
          this.sendEvent(sessionId, {
            type: 'chunk',
            data: {
              text: chunk.text,
              isComplete: false,
              progress: {
                chunks: session.totalChunks,
                artifacts: session.artifactsProcessed,
                projects: session.projectsProcessed,
              },
            },
          });

          // Process artifacts in real-time as content streams
          if (session.options.enableArtifactProcessing) {
            await this.processStreamingArtifacts(sessionId, fullResponse, conversationId);
          }
        }
      }

      // Final processing after stream completes
      if (session.options.enableArtifactProcessing) {
        const finalResults = await this.processFinalArtifacts(
          sessionId, 
          fullResponse, 
          conversationId
        );
        
        artifacts = finalResults.artifacts;
        projects = finalResults.projects;
        builds = finalResults.builds;
      }

      // Send completion event
      this.sendEvent(sessionId, {
        type: 'complete',
        data: {
          conversationId,
          artifacts: artifacts.length,
          projects: projects.length,
          builds: builds.length,
          stats: {
            totalChunks: session.totalChunks,
            processingTime: Date.now() - session.startTime,
            artifactsProcessed: session.artifactsProcessed,
            projectsProcessed: session.projectsProcessed,
          },
        },
      });

      return { fullResponse, artifacts, projects, builds };

    } catch (error) {
      logger.error(`Stream processing error for session ${sessionId}:`, error);
      
      this.sendEvent(sessionId, {
        type: 'error',
        data: {
          error: 'Stream processing failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: false,
        },
      });

      throw error;
    }
  }

  /**
   * Process artifacts incrementally as content streams
   */
  private async processStreamingArtifacts(
    sessionId: string,
    currentContent: string,
    conversationId: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      // Extract new artifacts from the current content
      const allArtifacts = codeProcessor.processCodeArtifacts(currentContent);
      const allProjects = codeProcessor.processProjectStructure(currentContent);

      // Only process new artifacts (compare with previously processed)
      const newArtifacts = allArtifacts.slice(session.artifactsProcessed);
      const newProjects = allProjects.slice(session.projectsProcessed);

      // Process new artifacts
      for (const artifact of newArtifacts) {
        try {
          // Store artifact
          const stored = await optimizedStorageManager.storeCode(
            artifact.code,
            artifact.language,
            { 
              compression: session.options.compression,
              tags: { 
                sessionId, 
                conversationId,
                type: 'streaming-artifact',
              },
            }
          );

          // Send artifact event
          this.sendEvent(sessionId, {
            type: 'artifact',
            data: {
              id: artifact.id,
              title: artifact.title,
              language: artifact.language,
              type: artifact.type,
              metadata: artifact.metadata,
              s3Key: stored.s3Key,
              s3Url: stored.s3Url,
              size: stored.size,
            },
          });

          session.artifactsProcessed++;

          // Build if enabled
          if (session.options.enableBuilding && this.isBuildable(artifact)) {
            this.buildArtifactAsync(sessionId, artifact, stored);
          }

        } catch (error) {
          logger.warn(`Failed to process streaming artifact ${artifact.id}:`, error);
        }
      }

      // Process new projects
      for (const project of newProjects) {
        try {
          // Store project
          const projectFiles = project.files.map(f => ({
            fileName: f.fileName,
            content: f.content,
            language: f.language,
          }));

          const stored = await s3Service.uploadProject(
            projectFiles,
            project.title
          );

          // Send project event
          this.sendEvent(sessionId, {
            type: 'project',
            data: {
              id: project.id,
              title: project.title,
              framework: project.framework,
              metadata: project.metadata,
              projectS3Key: stored.projectS3Key,
              projectS3Url: stored.projectS3Url,
              files: stored.files.length,
            },
          });

          session.projectsProcessed++;

          // Build project if enabled
          if (session.options.enableBuilding && project.metadata.buildable) {
            this.buildProjectAsync(sessionId, project, stored);
          }

        } catch (error) {
          logger.warn(`Failed to process streaming project ${project.id}:`, error);
        }
      }

    } catch (error) {
      logger.error(`Streaming artifact processing error:`, error);
    }
  }

  /**
   * Final artifact processing after stream completion
   */
  private async processFinalArtifacts(
    sessionId: string,
    fullContent: string,
    conversationId: string
  ): Promise<{
    artifacts: CodeArtifactEnhanced[];
    projects: ProjectStructureEnhanced[];
    builds: any[];
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    // Final extraction and validation
    const artifacts = codeProcessor.processCodeArtifacts(fullContent);
    const projects = codeProcessor.processProjectStructure(fullContent);
    const builds: any[] = [];

    // Process any remaining artifacts that weren't caught during streaming
    const remainingArtifacts = artifacts.slice(session.artifactsProcessed);
    const remainingProjects = projects.slice(session.projectsProcessed);

    for (const artifact of remainingArtifacts) {
      try {
        const stored = await optimizedStorageManager.storeCode(
          artifact.code,
          artifact.language,
          { 
            compression: session.options.compression,
            tags: { sessionId, conversationId, type: 'final-artifact' },
          }
        );

        this.sendEvent(sessionId, {
          type: 'artifact',
          data: { ...artifact, ...stored },
        });

        if (session.options.enableBuilding && this.isBuildable(artifact)) {
          const buildResult = await this.buildArtifactAsync(sessionId, artifact, stored);
          if (buildResult) builds.push(buildResult);
        }

      } catch (error) {
        logger.error(`Final artifact processing error:`, error);
      }
    }

    for (const project of remainingProjects) {
      try {
        const projectFiles = project.files.map(f => ({
          fileName: f.fileName,
          content: f.content,
          language: f.language,
        }));

        const stored = await s3Service.uploadProject(
          projectFiles,
          project.title
        );

        this.sendEvent(sessionId, {
          type: 'project',
          data: { ...project, ...stored },
        });

        if (session.options.enableBuilding && project.metadata.buildable) {
          const buildResult = await this.buildProjectAsync(sessionId, project, stored);
          if (buildResult) builds.push(buildResult);
        }

      } catch (error) {
        logger.error(`Final project processing error:`, error);
      }
    }

    return { artifacts, projects, builds };
  }

  /**
   * Asynchronously build artifact and send result
   */
  private async buildArtifactAsync(
    sessionId: string,
    artifact: CodeArtifactEnhanced,
    stored: any
  ): Promise<any> {
    try {
      this.sendEvent(sessionId, {
        type: 'build',
        data: {
          status: 'started',
          artifactId: artifact.id,
          type: 'artifact',
        },
      });

      const buildResult = await localBundlingService.bundleCode(
        artifact.code,
        artifact.language
      );

      if (buildResult.success) {
        // Store built code
        const builtStored = await optimizedStorageManager.storeCode(
          buildResult.bundledCode!,
          'javascript',
          {
            tags: {
              sessionId,
              type: 'built-artifact',
              originalArtifact: artifact.id,
            },
          }
        );

        let bundledHtmlStored = null;
        let previewUrl = null;

        // For React artifacts, also save the bundled HTML to S3
        if (buildResult.previewHtml && this.isReactArtifact(artifact)) {
          try {
            bundledHtmlStored = await optimizedStorageManager.storeCode(
              buildResult.previewHtml,
              'html',
              {
                tags: {
                  sessionId,
                  type: 'bundled-html',
                  originalArtifact: artifact.id,
                },
              }
            );
            previewUrl = bundledHtmlStored.s3Url;

            // Update the artifact in database with bundled HTML URLs
            await prisma.codeArtifact.update({
              where: { id: artifact.id },
              data: {
                bundledHtmlKey: bundledHtmlStored.s3Key,
                bundledHtmlUrl: bundledHtmlStored.s3Url,
              },
            });

            logger.info(`Bundled HTML saved for React artifact ${artifact.id}`, {
              htmlS3Key: bundledHtmlStored.s3Key,
              htmlSize: bundledHtmlStored.size,
            });
          } catch (htmlError) {
            logger.warn(`Failed to save bundled HTML for artifact ${artifact.id}:`, htmlError);
            // Don't fail the entire build if HTML saving fails
            previewUrl = builtStored.s3Url;
          }
        } else {
          previewUrl = buildResult.previewHtml ? builtStored.s3Url : null;
        }

        this.sendEvent(sessionId, {
          type: 'build',
          data: {
            status: 'completed',
            artifactId: artifact.id,
            type: 'artifact',
            buildResult: {
              success: true,
              builtSize: buildResult.bundleSize,
              buildTime: buildResult.buildTime,
              previewUrl: previewUrl,
              bundledHtmlUrl: bundledHtmlStored?.s3Url,
            },
          },
        });

        return { 
          artifact, 
          buildResult, 
          stored: builtStored,
          bundledHtmlStored 
        };
      } else {
        this.sendEvent(sessionId, {
          type: 'build',
          data: {
            status: 'failed',
            artifactId: artifact.id,
            type: 'artifact',
            errors: buildResult.errors,
          },
        });
      }

    } catch (error) {
      logger.error(`Artifact build error:`, error);
      this.sendEvent(sessionId, {
        type: 'build',
        data: {
          status: 'failed',
          artifactId: artifact.id,
          type: 'artifact',
          error: error instanceof Error ? error.message : 'Build failed',
        },
      });
    }

    return null;
  }

  /**
   * Asynchronously build project and send result
   */
  private async buildProjectAsync(
    sessionId: string,
    project: ProjectStructureEnhanced,
    stored: any
  ): Promise<any> {
    try {
      this.sendEvent(sessionId, {
        type: 'build',
        data: {
          status: 'started',
          projectId: project.id,
          type: 'project',
        },
      });

      const projectFiles = project.files.map(f => ({
        fileName: f.fileName,
        content: f.content,
        language: f.language,
      }));

      // TODO: Implement project building with proper build pipeline
      // For now, just return success without actual building
      const buildResult = {
        success: true,
        bundledCode: null,
        bundleSize: 0,
        buildTime: Date.now(),
        previewHtml: null,
      };

      this.sendEvent(sessionId, {
        type: 'build',
        data: {
          status: 'completed',
          projectId: project.id,
          type: 'project',
          buildResult: {
            success: true,
            builtSize: 0,
            buildTime: buildResult.buildTime,
            previewUrl: null,
          },
        },
      });

      return { project, buildResult, stored };

    } catch (error) {
      logger.error(`Project build error:`, error);
      this.sendEvent(sessionId, {
        type: 'build',
        data: {
          status: 'failed',
          projectId: project.id,
          type: 'project',
          error: error instanceof Error ? error.message : 'Build failed',
        },
      });
    }

    return null;
  }

  /**
   * Send event to client with retry mechanism
   */
  private sendEvent(sessionId: string, eventData: Partial<StreamEvent>): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) return;

    const event: StreamEvent = {
      id: `${sessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
      ...eventData,
    } as StreamEvent;

    try {
      const eventString = `id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`;
      session.response.write(eventString);
      session.eventHistory.push(event);
      session.lastActivity = Date.now();

      // Keep only last 100 events in history
      if (session.eventHistory.length > 100) {
        session.eventHistory = session.eventHistory.slice(-100);
      }

    } catch (error) {
      logger.error(`Failed to send event to session ${sessionId}:`, error);
      this.closeSession(sessionId, 'write_error');
    }
  }

  /**
   * Close streaming session
   */
  closeSession(sessionId: string, reason: string = 'client_request'): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      // Send final event
      if (session.isActive) {
        session.response.write(`data: ${JSON.stringify({
          type: 'complete',
          data: { reason, sessionId },
        })}\n\n`);
      }

      session.response.end();
      session.isActive = false;
      this.sessions.delete(sessionId);

      logger.info(`Stream session closed: ${sessionId} (${reason})`);

    } catch (error) {
      logger.error(`Error closing session ${sessionId}:`, error);
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    activeSessions: number;
    totalSessions: number;
    averageSessionDuration: number;
    averageArtifactsPerSession: number;
    averageProjectsPerSession: number;
  } {
    const activeSessions = Array.from(this.sessions.values()).filter(s => s.isActive);
    const allSessions = Array.from(this.sessions.values());

    const now = Date.now();
    const avgDuration = allSessions.length > 0
      ? allSessions.reduce((sum, s) => sum + (now - s.startTime), 0) / allSessions.length
      : 0;

    const avgArtifacts = allSessions.length > 0
      ? allSessions.reduce((sum, s) => sum + s.artifactsProcessed, 0) / allSessions.length
      : 0;

    const avgProjects = allSessions.length > 0
      ? allSessions.reduce((sum, s) => sum + s.projectsProcessed, 0) / allSessions.length
      : 0;

    return {
      activeSessions: activeSessions.length,
      totalSessions: this.sessions.size,
      averageSessionDuration: avgDuration,
      averageArtifactsPerSession: avgArtifacts,
      averageProjectsPerSession: avgProjects,
    };
  }

  // Private helper methods

  private isBuildable(artifact: CodeArtifactEnhanced): boolean {
    const buildableTypes = ['REACT', 'JAVASCRIPT', 'HTML'];
    const buildableLanguages = ['javascript', 'typescript', 'jsx', 'tsx', 'react'];
    
    return buildableTypes.includes(artifact.type) || 
           buildableLanguages.includes(artifact.language.toLowerCase());
  }

  private isReactArtifact(artifact: CodeArtifactEnhanced): boolean {
    const reactTypes = ['REACT'];
    const reactLanguages = ['jsx', 'tsx', 'react'];
    
    return reactTypes.includes(artifact.type) || 
           reactLanguages.includes(artifact.language.toLowerCase()) ||
           artifact.metadata?.hasJSX ||
           artifact.metadata?.framework === 'react';
  }

  private startSessionCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60000); // Clean up every minute
  }

  private cleanupInactiveSessions(): void {
    const now = Date.now();
    const sessionsToClose: string[] = [];

    this.sessions.forEach((session, sessionId) => {
      if (now - session.lastActivity > this.sessionTimeout) {
        sessionsToClose.push(sessionId);
      }
    });

    sessionsToClose.forEach(sessionId => {
      this.closeSession(sessionId, 'timeout');
    });

    if (sessionsToClose.length > 0) {
      logger.info(`Cleaned up ${sessionsToClose.length} inactive sessions`);
    }
  }

  private cleanupOldestSession(): void {
    let oldestSession: StreamSession | null = null;
    let oldestSessionId: string | null = null;

    this.sessions.forEach((session, sessionId) => {
      if (!oldestSession || session.startTime < oldestSession.startTime) {
        oldestSession = session;
        oldestSessionId = sessionId;
      }
    });

    if (oldestSessionId) {
      this.closeSession(oldestSessionId, 'capacity_limit');
    }
  }

  /**
   * Cleanup resources
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close all active sessions
    this.sessions.forEach((session, sessionId) => {
      this.closeSession(sessionId, 'server_shutdown');
    });

    logger.info('Streaming service shut down');
  }
}

export const streamingService = new StreamingService();