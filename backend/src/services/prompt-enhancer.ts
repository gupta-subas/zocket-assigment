import { createLogger } from '../utils/logger';

const logger = createLogger();

export interface EnhancementOptions {
  includeContext?: boolean;
  includeBestPractices?: boolean;
  includeErrorPrevention?: boolean;
  targetLanguage?: string;
  complexity?: 'beginner' | 'intermediate' | 'advanced';
  codeStyle?: 'clean' | 'performance' | 'readable';
  includeComments?: boolean;
  includeTypeHints?: boolean;
}

export interface EnhancedPrompt {
  originalPrompt: string;
  enhancedPrompt: string;
  addedContext: string[];
  suggestions: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export class PromptEnhancer {
  /**
   * Enhance a user prompt for better code generation
   */
  async enhancePrompt(
    prompt: string,
    options: EnhancementOptions = {}
  ): Promise<EnhancedPrompt> {
    const startTime = Date.now();
    
    try {
      const {
        includeContext = true,
        includeBestPractices = true,
        includeErrorPrevention = true,
        targetLanguage,
        complexity = 'intermediate',
        codeStyle = 'clean',
        includeComments = true,
        includeTypeHints = true
      } = options;

      // Analyze the original prompt
      const analysis = this.analyzePrompt(prompt);
      const detectedLanguage = targetLanguage || analysis.detectedLanguage;
      
      // Build enhancement components
      const contextEnhancements: string[] = [];
      const suggestions: string[] = [];
      
      // Add language-specific context
      if (includeContext && detectedLanguage) {
        const langContext = this.getLanguageContext(detectedLanguage, complexity);
        if (langContext) {
          contextEnhancements.push(langContext);
        }
      }

      // Add best practices
      if (includeBestPractices) {
        const practices = this.getBestPractices(detectedLanguage, codeStyle);
        contextEnhancements.push(...practices);
        suggestions.push(`Follow ${detectedLanguage} best practices for ${codeStyle} code`);
      }

      // Add error prevention guidelines
      if (includeErrorPrevention) {
        const errorPrevention = this.getErrorPreventionGuidelines(detectedLanguage);
        contextEnhancements.push(...errorPrevention);
        suggestions.push('Include error handling and edge case considerations');
      }

      // Add coding standards
      if (includeComments) {
        contextEnhancements.push('Include clear, descriptive comments explaining the code logic');
        suggestions.push('Add meaningful comments and documentation');
      }

      if (includeTypeHints && this.supportsTypes(detectedLanguage)) {
        contextEnhancements.push('Use proper type annotations and type safety');
        suggestions.push('Include type hints for better code reliability');
      }

      // Build the enhanced prompt
      const enhancedPrompt = this.buildEnhancedPrompt(
        prompt,
        contextEnhancements,
        detectedLanguage,
        complexity,
        analysis
      );

      const processingTime = Date.now() - startTime;
      logger.debug('Prompt enhanced successfully', {
        originalLength: prompt.length,
        enhancedLength: enhancedPrompt.length,
        language: detectedLanguage,
        complexity: analysis.estimatedComplexity,
        processingTime
      });

      return {
        originalPrompt: prompt,
        enhancedPrompt,
        addedContext: contextEnhancements,
        suggestions,
        estimatedComplexity: analysis.estimatedComplexity
      };

    } catch (error) {
      logger.error('Failed to enhance prompt:', error);
      
      // Return original prompt if enhancement fails
      return {
        originalPrompt: prompt,
        enhancedPrompt: prompt,
        addedContext: [],
        suggestions: ['Enhancement failed - using original prompt'],
        estimatedComplexity: 'medium'
      };
    }
  }

  /**
   * Analyze the prompt to understand requirements
   */
  private analyzePrompt(prompt: string): {
    detectedLanguage: string | null;
    hasUI: boolean;
    hasAPI: boolean;
    hasDatabase: boolean;
    estimatedComplexity: 'low' | 'medium' | 'high';
    keywords: string[];
  } {
    const lowerPrompt = prompt.toLowerCase();
    
    // Detect programming language
    const languagePatterns = {
      'react': /react|jsx|component|hook|state|props/,
      'javascript': /javascript|js|node|express|async|promise/,
      'typescript': /typescript|ts|interface|type|generic/,
      'python': /python|django|flask|pandas|numpy|pip/,
      'java': /java|spring|maven|gradle|class/,
      'html': /html|webpage|website|dom|css/,
      'css': /css|styling|layout|flexbox|grid/,
      'sql': /sql|database|query|select|insert|table/,
      'vue': /vue|vuejs|composition|reactive/,
      'angular': /angular|directive|service|component/
    };

    let detectedLanguage: string | null = null;
    for (const [lang, pattern] of Object.entries(languagePatterns)) {
      if (pattern.test(lowerPrompt)) {
        detectedLanguage = lang;
        break;
      }
    }

    // Detect features
    const hasUI = /ui|interface|frontend|component|button|form|page|screen|design/.test(lowerPrompt);
    const hasAPI = /api|endpoint|server|backend|request|response|rest|graphql/.test(lowerPrompt);
    const hasDatabase = /database|db|store|save|persist|collection|table|model/.test(lowerPrompt);

    // Estimate complexity
    let estimatedComplexity: 'low' | 'medium' | 'high' = 'low';
    
    const complexityIndicators = {
      high: /authentication|authorization|security|encryption|microservice|distributed|scaling|performance|optimization|complex|advanced|enterprise/,
      medium: /integration|multiple|several|various|different|custom|dynamic|interactive|responsive/,
      low: /simple|basic|quick|easy|straightforward|minimal/
    };

    if (complexityIndicators.high.test(lowerPrompt)) {
      estimatedComplexity = 'high';
    } else if (complexityIndicators.medium.test(lowerPrompt) || (+hasUI + +hasAPI + +hasDatabase) >= 2) {
      estimatedComplexity = 'medium';
    }

    // Extract keywords
    const keywords = prompt.match(/\b[a-zA-Z]{3,}\b/g) || [];

    return {
      detectedLanguage,
      hasUI,
      hasAPI,
      hasDatabase,
      estimatedComplexity,
      keywords: [...new Set(keywords)].slice(0, 10)
    };
  }

  /**
   * Get language-specific context
   */
  private getLanguageContext(language: string, complexity: string): string | null {
    const contexts: Record<string, Record<string, string>> = {
      react: {
        beginner: 'Create a React functional component using hooks. Use modern React patterns.',
        intermediate: 'Create a React component with proper TypeScript types, error boundaries, and performance optimization.',
        advanced: 'Implement advanced React patterns like compound components, render props, or custom hooks with full TypeScript support.'
      },
      javascript: {
        beginner: 'Use modern ES6+ JavaScript with clear variable names and simple logic.',
        intermediate: 'Use advanced JavaScript features like async/await, destructuring, and modules.',
        advanced: 'Implement advanced JavaScript patterns with proper error handling, performance optimization, and design patterns.'
      },
      typescript: {
        beginner: 'Use TypeScript with basic type annotations and interfaces.',
        intermediate: 'Use advanced TypeScript features like generics, utility types, and strict type checking.',
        advanced: 'Implement complex TypeScript patterns with advanced types, decorators, and metaprogramming.'
      },
      python: {
        beginner: 'Write clean Python code following PEP 8 standards with clear variable names.',
        intermediate: 'Use Python advanced features like list comprehensions, decorators, and context managers.',
        advanced: 'Implement advanced Python patterns with metaclasses, async programming, and performance optimization.'
      }
    };

    return contexts[language]?.[complexity] || null;
  }

  /**
   * Get best practices for the language and style
   */
  private getBestPractices(language: string | null, style: string): string[] {
    if (!language) return [];

    const practices: Record<string, Record<string, string[]>> = {
      react: {
        clean: [
          'Use functional components with hooks',
          'Implement proper prop validation',
          'Follow component composition patterns',
          'Use descriptive component and prop names'
        ],
        performance: [
          'Use React.memo for expensive components',
          'Implement proper key props for lists',
          'Use useCallback and useMemo when appropriate',
          'Avoid unnecessary re-renders'
        ],
        readable: [
          'Break down complex components into smaller ones',
          'Use custom hooks for shared logic',
          'Add proper JSDoc comments',
          'Organize imports and exports clearly'
        ]
      },
      javascript: {
        clean: [
          'Use const and let instead of var',
          'Prefer arrow functions for short functions',
          'Use template literals for string interpolation',
          'Implement proper error handling'
        ],
        performance: [
          'Avoid unnecessary object creation in loops',
          'Use efficient array methods',
          'Implement proper async/await patterns',
          'Consider memory management'
        ],
        readable: [
          'Use descriptive variable and function names',
          'Add comments for complex logic',
          'Break long functions into smaller ones',
          'Use consistent naming conventions'
        ]
      },
      python: {
        clean: [
          'Follow PEP 8 style guidelines',
          'Use list comprehensions appropriately',
          'Implement proper exception handling',
          'Use type hints for function parameters'
        ],
        performance: [
          'Use appropriate data structures',
          'Implement generator functions for large datasets',
          'Consider using built-in functions',
          'Profile and optimize bottlenecks'
        ],
        readable: [
          'Use docstrings for functions and classes',
          'Follow the Zen of Python principles',
          'Use meaningful variable names',
          'Keep functions focused on single responsibilities'
        ]
      }
    };

    return practices[language]?.[style] || [];
  }

  /**
   * Get error prevention guidelines
   */
  private getErrorPreventionGuidelines(language: string | null): string[] {
    if (!language) return ['Include proper error handling and validation'];

    const guidelines: Record<string, string[]> = {
      react: [
        'Implement error boundaries for component error handling',
        'Validate props and add default values',
        'Handle loading and error states properly',
        'Use keys for dynamic lists to avoid rendering issues'
      ],
      javascript: [
        'Add try-catch blocks for async operations',
        'Validate function parameters',
        'Handle null and undefined values properly',
        'Use strict mode and avoid global variables'
      ],
      typescript: [
        'Use strict TypeScript configuration',
        'Implement proper type guards',
        'Handle optional properties safely',
        'Use union types for better type safety'
      ],
      python: [
        'Use specific exception types instead of bare except',
        'Validate input parameters',
        'Handle file operations with context managers',
        'Use type hints to catch type-related errors'
      ]
    };

    return guidelines[language] || ['Include comprehensive error handling'];
  }

  /**
   * Check if language supports type hints
   */
  private supportsTypes(language: string | null): boolean {
    return ['typescript', 'python', 'java', 'c#', 'swift', 'kotlin'].includes(language || '');
  }

  /**
   * Build the final enhanced prompt
   */
  private buildEnhancedPrompt(
    originalPrompt: string,
    contextEnhancements: string[],
    language: string | null,
    complexity: string,
    analysis: any
  ): string {
    const sections: string[] = [];

    // Start with the original prompt
    sections.push(`**Original Request:**\n${originalPrompt}`);

    // Add detected context
    if (language) {
      sections.push(`\n**Target Language/Framework:** ${language.charAt(0).toUpperCase() + language.slice(1)}`);
    }

    if (analysis.estimatedComplexity !== 'low') {
      sections.push(`**Complexity Level:** ${analysis.estimatedComplexity}`);
    }

    // Add enhancement guidelines
    if (contextEnhancements.length > 0) {
      sections.push(`\n**Implementation Guidelines:**`);
      contextEnhancements.forEach((enhancement, index) => {
        sections.push(`${index + 1}. ${enhancement}`);
      });
    }

    // Add specific requirements based on detected features
    const requirements: string[] = [];
    
    if (analysis.hasUI) {
      requirements.push('Create a responsive and user-friendly interface');
    }
    
    if (analysis.hasAPI) {
      requirements.push('Implement proper API error handling and status codes');
    }
    
    if (analysis.hasDatabase) {
      requirements.push('Include data validation and proper database operations');
    }

    if (requirements.length > 0) {
      sections.push(`\n**Additional Requirements:**`);
      requirements.forEach((req, index) => {
        sections.push(`${index + 1}. ${req}`);
      });
    }

    // Add final instruction
    sections.push(`\n**Final Instruction:** Please provide complete, working code that follows all the above guidelines and includes proper error handling, comments, and best practices for ${language || 'the detected language'}.`);

    return sections.join('\n');
  }

  /**
   * Get quick enhancement for simple cases
   */
  async enhanceQuickly(prompt: string, language?: string): Promise<string> {
    const quickEnhancement = await this.enhancePrompt(prompt, {
      targetLanguage: language,
      complexity: 'intermediate',
      includeContext: true,
      includeBestPractices: false,
      includeErrorPrevention: true
    });

    return quickEnhancement.enhancedPrompt;
  }
}

export const promptEnhancer = new PromptEnhancer(); 