import { GoogleGenerativeAI, GenerativeModel, ChatSession } from '@google/generative-ai';
import { createLogger } from '../utils/logger';
import { packageManagerService } from './package-manager';
import { promptManager } from './prompt-manager';
import { codeIntentDetector } from './code-intent-detector';

const logger = createLogger();

export interface StreamChunk {
  text: string;
  isComplete: boolean;
}

export interface CodeArtifact {
  title: string;
  language: string;
  code: string;
  type: 'CODE' | 'HTML' | 'REACT' | 'JAVASCRIPT' | 'PYTHON' | 'PROJECT' | 'OTHER';
}

export interface ProjectStructure {
  title: string;
  description?: string;
  files: Array<{
    fileName: string;
    content: string;
    language: string;
  }>;
  type: 'PROJECT';
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    });
  }

  /**
   * Create a new chat session
   */
  createChatSession(history: any[] = []): ChatSession {
    return this.model.startChat({
      history: history.map(msg => ({
        role: msg.role === 'USER' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })),
    });
  }

  /**
   * Send a message and get streaming response
   */
  async *streamMessage(
    message: string, 
    chatSession?: ChatSession,
    options?: {
      enableSecurity?: boolean;
      enableBuilding?: boolean;
      conversationHistory?: Array<{ role: string; content: string }>;
    }
  ): AsyncGenerator<StreamChunk, void, unknown> {
    try {
      const session = chatSession || this.createChatSession();
      
      // Check if this is a code-related request first
      const userIntent = codeIntentDetector.analyzeUserIntent(message);
      
      let finalMessage = message;
      
      // Only use enhanced coding prompts for code-related requests
      if (userIntent.isCodeRelated) {
        const promptContext = {
          userMessage: message,
          conversationHistory: options?.conversationHistory,
          enableSecurity: options?.enableSecurity ?? true,
          enableBuilding: options?.enableBuilding ?? true,
          ...promptManager.analyzeMessage(message)
        };
        
        finalMessage = promptManager.generatePrompt(promptContext);
        
        logger.info('Sending enhanced coding message to Gemini', { 
          messageLength: message.length,
          enhancedLength: finalMessage.length,
          detectedLanguage: promptContext.codeLanguage,
          complexity: promptContext.complexity,
          userIntent: userIntent.reasoning
        });
      } else {
        logger.info('Sending conversational message to Gemini', { 
          messageLength: message.length,
          userIntent: userIntent.reasoning,
          confidence: userIntent.confidence
        });
      }

      const result = await session.sendMessageStream(finalMessage);
      
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield {
            text,
            isComplete: false,
          };
        }
      }

      // Final chunk to indicate completion
      yield {
        text: '',
        isComplete: true,
      };

      logger.info('Gemini response completed');
    } catch (error) {
      logger.error('Gemini streaming error:', error);
      throw new Error('Failed to get AI response');
    }
  }

  /**
   * Send a message and get complete response (non-streaming)
   */
  async sendMessage(
    message: string, 
    chatSession?: ChatSession,
    options?: {
      enableSecurity?: boolean;
      enableBuilding?: boolean;
      conversationHistory?: Array<{ role: string; content: string }>;
    }
  ): Promise<string> {
    try {
      const session = chatSession || this.createChatSession();
      
      // Check if this is a code-related request first
      const userIntent = codeIntentDetector.analyzeUserIntent(message);
      
      let finalMessage = message;
      
      // Only use enhanced coding prompts for code-related requests
      if (userIntent.isCodeRelated) {
        const promptContext = {
          userMessage: message,
          conversationHistory: options?.conversationHistory,
          enableSecurity: options?.enableSecurity ?? true,
          enableBuilding: options?.enableBuilding ?? true,
          ...promptManager.analyzeMessage(message)
        };
        
        finalMessage = promptManager.generatePrompt(promptContext);
        
        logger.info('Sending enhanced coding message to Gemini (non-streaming)', { 
          inputLength: message.length,
          enhancedInputLength: finalMessage.length,
          detectedLanguage: promptContext.codeLanguage,
          complexity: promptContext.complexity,
          userIntent: userIntent.reasoning
        });
      } else {
        logger.info('Sending conversational message to Gemini (non-streaming)', { 
          inputLength: message.length,
          userIntent: userIntent.reasoning,
          confidence: userIntent.confidence
        });
      }
      
      const result = await session.sendMessage(finalMessage);
      const response = await result.response;
      
      logger.info('Gemini response received', { 
        inputLength: message.length,
        outputLength: response.text().length,
        wasCodeRelated: userIntent.isCodeRelated
      });

      return response.text();
    } catch (error) {
      logger.error('Gemini message error:', error);
      throw new Error('Failed to get AI response');
    }
  }

  /**
   * Extract project structures from AI response
   */
  extractProjectStructures(response: string): ProjectStructure[] {
    const projects: ProjectStructure[] = [];
    
    // Look for project structure patterns
    const projectPatterns = [
      // Pattern 1: Explicit file structure with file paths
      /```(\w+)\s*\n?(?:\/\/\s*)?(.+\.(js|jsx|ts|tsx|py|html|css|json|md))\s*\n([\s\S]*?)```/gi,
      // Pattern 2: Multiple files indicated by comments
      /(?:\/\*\s*(\w+(?:\s+\w+)*)\s*\*\/|\/\/\s*(\w+(?:\s+\w+)*)|#\s*(\w+(?:\s+\w+)*))\s*\n```(\w+)?\s*\n?(?:\/\/\s*)?(.+\.(js|jsx|ts|tsx|py|html|css|json|md))\s*\n([\s\S]*?)```/gi,
    ];

    // Look for folder structure indicators
    const folderIndicators = [
      'src/',
      'components/',
      'pages/',
      'utils/',
      'styles/',
      'public/',
      'api/',
      'hooks/',
      'context/',
      'lib/',
      'types/',
    ];

    // Check if response contains folder structure indicators
    const hasProjectStructure = folderIndicators.some(indicator => 
      response.toLowerCase().includes(indicator.toLowerCase())
    );

    if (hasProjectStructure) {
      const projectFiles: Array<{ fileName: string; content: string; language: string }> = [];
      
      // Extract all code blocks that might be files
      const codeBlockRegex = /```(\w+)?\s*\n?(?:\/\/\s*)?(.+\.(js|jsx|ts|tsx|py|html|css|json|md|yml|yaml|txt))\s*\n([\s\S]*?)```/gi;
      let match;
      
      while ((match = codeBlockRegex.exec(response)) !== null) {
        const language = match[1]?.toLowerCase() || this.getLanguageFromExtension(match[2]);
        const fileName = match[2].trim();
        const content = match[3].trim();
        
        if (content.length > 0) {
          projectFiles.push({
            fileName,
            content,
            language,
          });
        }
      }

      // If we found multiple files, create a project structure
      if (projectFiles.length > 1) {
        const projectTitle = this.generateProjectTitle(projectFiles, response);
        
        projects.push({
          title: projectTitle,
          description: this.extractProjectDescription(response),
          files: projectFiles,
          type: 'PROJECT',
        });
      }
    }

    logger.info('Extracted project structures', { count: projects.length });
    return projects;
  }

  /**
   * Extract code artifacts from AI response (updated to handle projects)
   */
  extractCodeArtifacts(response: string): CodeArtifact[] {
    const artifacts: CodeArtifact[] = [];
    
    // First check if this is a project structure
    const projectStructures = this.extractProjectStructures(response);
    if (projectStructures.length > 0) {
      // For now, we'll treat project structures as single artifacts
      // The actual files will be handled separately in the chat route
      return [];
    }
    
    // Match code blocks with language specification (exclude file paths)
    const codeBlockRegex = /```(\w+)?\s*\n(?!\s*[\w\-\.]+\/[\w\-\.]+)([\s\S]*?)```/g;
    let match;
    let artifactIndex = 1;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1]?.toLowerCase() || 'text';
      const code = match[2].trim();
      
      if (code.length === 0) continue;

      const artifact: CodeArtifact = {
        title: this.generateArtifactTitle(language, code, artifactIndex),
        language,
        code,
        type: this.determineArtifactType(language, code),
      };

      artifacts.push(artifact);
      artifactIndex++;
    }

    logger.info('Extracted code artifacts', { count: artifacts.length });
    return artifacts;
  }

  /**
   * Generate a descriptive title for the code artifact
   */
  private generateArtifactTitle(language: string, code: string, index: number): string {
    // Try to extract meaningful names from code
    if (language === 'javascript' || language === 'typescript' || language === 'react') {
      // Look for function/component names
      const functionMatch = code.match(/(?:function|const|let|var)\s+(\w+)|export\s+(?:default\s+)?(?:function\s+)?(\w+)/);
      if (functionMatch) {
        return functionMatch[1] || functionMatch[2];
      }
      
      // Look for React component
      const componentMatch = code.match(/(?:export\s+default\s+)?(?:function\s+|const\s+)(\w+)(?:\s*[=:]|\s*\()/);
      if (componentMatch) {
        return `${componentMatch[1]} Component`;
      }
    }
    
    if (language === 'python') {
      // Look for class or function names
      const classMatch = code.match(/class\s+(\w+)/);
      if (classMatch) {
        return `${classMatch[1]} Class`;
      }
      
      const functionMatch = code.match(/def\s+(\w+)/);
      if (functionMatch) {
        return `${functionMatch[1]} Function`;
      }
    }
    
    if (language === 'html') {
      // Look for title tag
      const titleMatch = code.match(/<title>(.*?)<\/title>/i);
      if (titleMatch) {
        return titleMatch[1];
      }
      return 'HTML Document';
    }
    
    if (language === 'css') {
      return 'Stylesheet';
    }

    // Default titles
    const languageTitles: Record<string, string> = {
      javascript: 'JavaScript Code',
      typescript: 'TypeScript Code',
      react: 'React Component',
      python: 'Python Script',
      java: 'Java Code',
      cpp: 'C++ Code',
      go: 'Go Code',
      rust: 'Rust Code',
      sql: 'SQL Query',
      bash: 'Shell Script',
      json: 'JSON Data',
      yaml: 'YAML Configuration',
      dockerfile: 'Dockerfile',
    };

    return languageTitles[language] || `${language.charAt(0).toUpperCase() + language.slice(1)} Code`;
  }

  /**
   * Determine the type of code artifact
   */
  private determineArtifactType(language: string, code: string): CodeArtifact['type'] {
    switch (language.toLowerCase()) {
      case 'html':
        return 'HTML';
      case 'javascript':
        return 'JAVASCRIPT';
      case 'typescript':
      case 'tsx':
      case 'react':
        // Check if it's a React component
        if (code.includes('React') || code.includes('jsx') || code.includes('useState') || code.includes('useEffect')) {
          return 'REACT';
        }
        return 'JAVASCRIPT';
      case 'python':
      case 'py':
        return 'PYTHON';
      default:
        return 'CODE';
    }
  }

  /**
   * Get chat session history in the format expected by Gemini
   */
  static formatChatHistory(messages: any[]): any[] {
    return messages.map(msg => ({
      role: msg.role === 'USER' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));
  }

  /**
   * Generate a project title based on files and response content
   */
  private generateProjectTitle(files: Array<{ fileName: string; content: string; language: string }>, response: string): string {
    // Look for project name in the response
    const projectNamePatterns = [
      /project\s+(?:name|title):\s*([^\n]+)/i,
      /building\s+(?:a\s+)?([^\n]+?)\s+(?:project|app|application)/i,
      /create\s+(?:a\s+)?([^\n]+?)\s+(?:project|app|application)/i,
      /(?:project|app|application)\s+called\s+([^\n]+)/i,
    ];

    for (const pattern of projectNamePatterns) {
      const match = response.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // Generate based on file structure
    const hasReactFiles = files.some(f => f.language === 'tsx' || f.language === 'jsx' || f.fileName.includes('component'));
    const hasApiFiles = files.some(f => f.fileName.includes('api') || f.fileName.includes('server'));
    const hasStyleFiles = files.some(f => f.language === 'css' || f.fileName.includes('style'));

    if (hasReactFiles && hasApiFiles) {
      return 'Full Stack React Application';
    } else if (hasReactFiles) {
      return 'React Application';
    } else if (hasApiFiles) {
      return 'API Project';
    } else if (files.some(f => f.language === 'python')) {
      return 'Python Project';
    } else {
      return 'Code Project';
    }
  }

  /**
   * Extract project description from response
   */
  private extractProjectDescription(response: string): string | undefined {
    const lines = response.split('\n');
    const descriptionPatterns = [
      /this\s+(?:project|application|app)\s+(?:is|will|does|provides)/i,
      /(?:here's|this\s+is)\s+(?:a|an)\s+([^\n]+)/i,
    ];

    for (const line of lines) {
      for (const pattern of descriptionPatterns) {
        if (pattern.test(line)) {
          return line.trim();
        }
      }
    }

    // Get first meaningful sentence
    const sentences = response.match(/[^\.!?]+[\.!?]+/g);
    if (sentences && sentences.length > 0) {
      const firstSentence = sentences[0].trim();
      if (firstSentence.length > 20 && firstSentence.length < 200) {
        return firstSentence;
      }
    }

    return undefined;
  }

  /**
   * Get language from file extension
   */
  private getLanguageFromExtension(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const extensionMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'jsx',
      'ts': 'typescript',
      'tsx': 'tsx',
      'py': 'python',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml',
      'txt': 'text',
      'sh': 'bash',
      'sql': 'sql',
    };

    return extensionMap[extension || ''] || 'text';
  }

  /**
   * Setup a project with dependency management
   */
  async setupProjectWithDependencies(
    projectStructures: ProjectStructure[],
    projectName: string = 'generated-project'
  ): Promise<{
    success: boolean;
    projectPath?: string;
    buildCommand?: string;
    startCommand?: string;
    errors?: string[];
    dependenciesInstalled?: boolean;
  }> {
    try {
      if (projectStructures.length === 0) {
        return { success: false, errors: ['No project structures provided'] };
      }

      // Use the first project structure (or merge multiple if needed)
      const project = projectStructures[0];
      
      // Convert project files to the format expected by package manager
      const files = project.files.map(file => ({
        fileName: file.fileName,
        content: file.content,
        language: file.language
      }));

      // Setup project with dependency management
      const setupResult = await packageManagerService.setupProject(files, projectName);

      if (setupResult.success) {
        logger.info(`Project ${projectName} setup completed with dependencies`, {
          projectPath: setupResult.projectPath,
          packageJsonCreated: setupResult.packageJsonCreated,
          dependenciesInstalled: setupResult.dependenciesInstalled
        });

        return {
          success: true,
          projectPath: setupResult.projectPath,
          buildCommand: setupResult.buildCommand,
          startCommand: setupResult.startCommand,
          dependenciesInstalled: setupResult.dependenciesInstalled
        };
      } else {
        return {
          success: false,
          errors: setupResult.errors || ['Project setup failed']
        };
      }

    } catch (error) {
      logger.error('Failed to setup project with dependencies', error);
      return {
        success: false,
        errors: [`Project setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Enhanced project extraction that also handles dependency setup
   */
  async extractAndSetupProject(content: string, projectName?: string): Promise<{
    projects: ProjectStructure[];
    setupResult?: {
      success: boolean;
      projectPath?: string;
      buildCommand?: string;
      startCommand?: string;
      errors?: string[];
    };
  }> {
    // Extract project structures
    const projects = this.extractProjectStructures(content);
    
    if (projects.length === 0) {
      return { projects };
    }

    // If we have projects, try to set them up with dependencies
    const setupResult = await this.setupProjectWithDependencies(
      projects, 
      projectName || `project-${Date.now()}`
    );

    return {
      projects,
      setupResult
    };
  }
}

let geminiServiceInstance: GeminiService | null = null;

export const geminiService = {
  getInstance(): GeminiService {
    if (!geminiServiceInstance) {
      geminiServiceInstance = new GeminiService();
    }
    return geminiServiceInstance;
  },
  
  // Proxy methods to maintain backward compatibility
  streamMessage(message: string, chatSession?: any, options?: any) {
    return this.getInstance().streamMessage(message, chatSession, options);
  },
  
  extractProjectStructures(content: string) {
    return this.getInstance().extractProjectStructures(content);
  },
  
  async extractAndSetupProject(content: string, projectName?: string) {
    return this.getInstance().extractAndSetupProject(content, projectName);
  },
  
  createChatSession(history: any[] = []) {
    return this.getInstance().createChatSession(history);
  },
  
  async sendMessage(message: string, chatSession?: any, options?: any) {
    return this.getInstance().sendMessage(message, chatSession, options);
  },
  
  extractCodeArtifacts(response: string) {
    return this.getInstance().extractCodeArtifacts(response);
  },

  /**
   * Generate regenerate prompt with feedback
   */
  generateRegeneratePrompt(originalMessage: string, feedback: string) {
    return promptManager.generateRegeneratePrompt(originalMessage, feedback);
  }
};