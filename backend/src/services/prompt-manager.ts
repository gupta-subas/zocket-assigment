import { createLogger } from '../utils/logger';
import { PROMPT_TEMPLATES, SCENARIO_TEMPLATES } from './prompt-templates';

const logger = createLogger();

export interface PromptContext {
  userMessage: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  codeLanguage?: string;
  projectType?: string;
  complexity?: 'simple' | 'medium' | 'complex';
  enableSecurity?: boolean;
  enableBuilding?: boolean;
}

export interface PromptTemplate {
  system: string;
  instructions: string;
  constraints: string;
  examples?: string;
  format: string;
}

export class PromptManager {
  private readonly basePrompts: Map<string, PromptTemplate>;
  private readonly languageSpecificRules: Map<string, string>;
  private readonly securityRules: string;
  private readonly buildingRules: string;

  constructor() {
    this.basePrompts = this.initializeBasePrompts();
    this.languageSpecificRules = this.initializeLanguageRules();
    this.securityRules = this.initializeSecurityRules();
    this.buildingRules = this.initializeBuildingRules();
  }

  /**
   * Generate optimized prompt for single-file code generation
   */
  generatePrompt(context: PromptContext): string {
    const template = this.selectTemplate(context);
    const languageRules = this.getLanguageRules(context.codeLanguage);
    const securityRules = context.enableSecurity ? this.securityRules : '';
    const buildingRules = context.enableBuilding ? this.buildingRules : '';
    
    const enhancedPrompt = this.buildEnhancedPrompt({
      userMessage: context.userMessage,
      template,
      languageRules,
      securityRules,
      buildingRules,
      complexity: context.complexity || 'medium',
    });

    logger.info('Generated enhanced prompt', {
      messageLength: context.userMessage.length,
      promptLength: enhancedPrompt.length,
      language: context.codeLanguage,
      enableSecurity: context.enableSecurity,
      enableBuilding: context.enableBuilding,
    });

    return enhancedPrompt;
  }

  /**
   * Initialize base prompt templates
   */
  private initializeBasePrompts(): Map<string, PromptTemplate> {
    const prompts = new Map<string, PromptTemplate>();

    // General coding prompt
    prompts.set('general', {
      system: `You are an expert software engineer specializing in creating production-ready, single-file applications. Your code is clean, efficient, and follows industry best practices.`,
      
      instructions: `
CRITICAL REQUIREMENTS:
1. ALWAYS consolidate ALL code into a SINGLE file - NEVER create multiple files
2. If multiple components/functions are needed, put them ALL in the same code block
3. Use clear section comments to organize different parts within the single file
4. Make the code production-ready and self-contained
5. Include all necessary imports, dependencies, and configurations in one file`,

      constraints: `
ABSOLUTE CONSTRAINTS:
- ❌ NO separate files (no index.js + component.js)
- ❌ NO project folder structures
- ❌ NO package.json suggestions unless specifically requested
- ❌ NO "create this file, then create that file" instructions
- ✅ ONE comprehensive, complete file only
- ✅ Everything functional in a single code block
- ✅ Well-organized with clear section comments`,

      format: `
RESPONSE FORMAT:
1. Brief explanation (2-3 sentences max)
2. ONE code block containing ALL the code
3. Optional: Brief usage notes if needed

EXAMPLE STRUCTURE:
\`\`\`javascript
// ===== IMPORTS =====
import React from 'react';

// ===== UTILITIES =====
function helperFunction() { /* ... */ }

// ===== MAIN COMPONENT =====
function App() { /* ... */ }

// ===== STYLES (if needed) =====
const styles = \`/* CSS here */\`;

// ===== EXPORT =====
export default App;
\`\`\``
    });

    // Web development specific
    prompts.set('web', {
      system: `You are a full-stack web development expert who creates complete, single-file web applications. You excel at building self-contained HTML documents with embedded CSS and JavaScript.`,
      
      instructions: `
WEB DEVELOPMENT RULES:
1. Create ONE complete HTML file with embedded CSS and JavaScript
2. Use modern web standards (HTML5, ES6+, CSS3)
3. Include responsive design principles
4. Add proper meta tags and accessibility features
5. Ensure cross-browser compatibility`,

      constraints: `
WEB-SPECIFIC CONSTRAINTS:
- ❌ NO separate CSS files
- ❌ NO separate JavaScript files  
- ❌ NO external dependencies unless absolutely necessary
- ✅ Inline CSS within <style> tags
- ✅ Inline JavaScript within <script> tags
- ✅ Complete, standalone HTML document`,

      format: `
\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Application Title</title>
    <style>
        /* ALL CSS HERE */
    </style>
</head>
<body>
    <!-- HTML CONTENT -->
    
    <script>
        // ALL JAVASCRIPT HERE
    </script>
</body>
</html>
\`\`\``
    });

    // React/Modern JavaScript
    prompts.set('react', {
      system: `You are a React expert who builds complete, single-file React applications. You create production-ready components with all necessary code in one comprehensive file.`,
      
      instructions: `
REACT SINGLE-FILE RULES:
1. Put ALL components in ONE file (main component + sub-components)
2. Include all hooks, utilities, and helpers in the same file
3. Use modern React patterns (hooks, functional components)
4. Include styled-components or CSS-in-JS if styling is needed
5. Make it a complete, runnable React application`,

      constraints: `
REACT CONSTRAINTS:
- ❌ NO separate component files
- ❌ NO separate hooks files
- ❌ NO separate utility files
- ✅ All components in one file with clear sections
- ✅ Complete import statements at the top
- ✅ One main export at the bottom`,

      format: `
\`\`\`jsx
import React, { useState, useEffect } from 'react';

// ===== UTILITIES =====
const utility = () => { /* ... */ };

// ===== SUB-COMPONENTS =====
const SubComponent = ({ prop }) => {
  return <div>{prop}</div>;
};

// ===== MAIN COMPONENT =====
const App = () => {
  const [state, setState] = useState();
  
  return (
    <div>
      {/* Main app content */}
      <SubComponent prop={state} />
    </div>
  );
};

export default App;
\`\`\``
    });

    // Python specific
    prompts.set('python', {
      system: `You are a Python expert who creates complete, single-file Python applications. Your code is clean, follows PEP 8, and includes all necessary functionality in one comprehensive script.`,
      
      instructions: `
PYTHON SINGLE-FILE RULES:
1. Include ALL classes, functions, and logic in ONE file
2. Follow PEP 8 style guidelines
3. Use proper imports and type hints where appropriate
4. Include a main execution block if applicable
5. Make the code modular within the single file using clear sections`,

      constraints: `
PYTHON CONSTRAINTS:
- ❌ NO separate module files
- ❌ NO separate class files
- ❌ NO package structure suggestions
- ✅ All imports at the top
- ✅ All code in logical sections within one file
- ✅ Clear function and class organization`,

      format: `
\`\`\`python
# ===== IMPORTS =====
import os
from typing import List, Dict

# ===== CONSTANTS =====
CONSTANT = "value"

# ===== UTILITY FUNCTIONS =====
def utility_function():
    pass

# ===== MAIN CLASSES =====
class MainClass:
    def __init__(self):
        pass

# ===== MAIN EXECUTION =====
if __name__ == "__main__":
    # Main code here
    pass
\`\`\``
    });

    return prompts;
  }

  /**
   * Initialize language-specific rules
   */
  private initializeLanguageRules(): Map<string, string> {
    const rules = new Map<string, string>();

    rules.set('javascript', `
JAVASCRIPT SPECIFIC:
- Use modern ES6+ syntax
- Include proper error handling
- Use async/await for asynchronous operations
- Follow camelCase naming conventions
- Include JSDoc comments for complex functions`);

    rules.set('typescript', `
TYPESCRIPT SPECIFIC:
- Include proper type annotations
- Define interfaces/types at the top of the file
- Use strict TypeScript settings
- Leverage TypeScript's advanced features (generics, utility types)
- Export types alongside implementation`);

    rules.set('react', `
REACT SPECIFIC:
- Use functional components with hooks
- Implement proper state management
- Include PropTypes or TypeScript types
- Follow React best practices (keys, refs, etc.)
- Use React.memo for performance optimization where needed`);

    rules.set('python', `
PYTHON SPECIFIC:
- Follow PEP 8 style guide
- Use type hints for function parameters and returns
- Include docstrings for classes and functions
- Use context managers where appropriate
- Handle exceptions properly`);

    rules.set('html', `
HTML SPECIFIC:
- Use semantic HTML5 elements
- Include proper meta tags
- Ensure accessibility (ARIA labels, alt text)
- Use modern CSS Grid/Flexbox for layouts
- Implement responsive design principles`);

    return rules;
  }

  /**
   * Initialize security rules
   */
  private initializeSecurityRules(): string {
    return `
SECURITY REQUIREMENTS:
- ❌ NO eval(), innerHTML, or document.write()
- ❌ NO hardcoded secrets, passwords, or API keys
- ❌ NO SQL injection vulnerabilities (use parameterized queries)
- ❌ NO XSS vulnerabilities (sanitize inputs)
- ✅ Use textContent instead of innerHTML
- ✅ Validate and sanitize all user inputs
- ✅ Use environment variables for sensitive data
- ✅ Implement proper error handling without exposing internals`;
  }

  /**
   * Initialize building rules
   */
  private initializeBuildingRules(): string {
    return `
BUILD OPTIMIZATION:
- Write code that's ready for bundling/minification
- Use standard import/export syntax
- Avoid dynamic imports unless necessary
- Structure code for tree-shaking optimization
- Include only necessary dependencies
- Write performant, production-ready code`;
  }

  /**
   * Select appropriate template based on context
   */
  private selectTemplate(context: PromptContext): PromptTemplate {
    const message = context.userMessage.toLowerCase();
    
    // Detect scenario type first
    let scenarioTemplate = '';
    if (message.includes('fix') || message.includes('bug') || message.includes('error')) {
      scenarioTemplate = SCENARIO_TEMPLATES.BUG_FIX;
    } else if (message.includes('review') || message.includes('improve') || message.includes('optimize')) {
      scenarioTemplate = SCENARIO_TEMPLATES.CODE_REVIEW;
    } else if (message.includes('add') || message.includes('feature') || message.includes('enhance')) {
      scenarioTemplate = SCENARIO_TEMPLATES.FEATURE_REQUEST;
    } else if (message.includes('convert') || message.includes('migrate') || message.includes('port')) {
      scenarioTemplate = SCENARIO_TEMPLATES.MIGRATION;
    }
    
    // Detect quality level
    let qualityLevel = 'general';
    if (message.includes('enterprise') || message.includes('production') || message.includes('professional')) {
      qualityLevel = 'production';
    } else if (message.includes('simple') || message.includes('basic') || message.includes('beginner')) {
      qualityLevel = 'educational';
    } else if (message.includes('prototype') || message.includes('quick') || message.includes('fast')) {
      qualityLevel = 'prototype';
    }
    
    // Get base template
    let baseTemplate = this.basePrompts.get('general')!;
    
    if (message.includes('react') || message.includes('jsx') || message.includes('component')) {
      baseTemplate = this.basePrompts.get('react')!;
    } else if (message.includes('html') || message.includes('website') || message.includes('web page')) {
      baseTemplate = this.basePrompts.get('web')!;
    } else if (message.includes('python') || context.codeLanguage === 'python') {
      baseTemplate = this.basePrompts.get('python')!;
    }
    
    // Enhance template with scenario and quality context
    if (scenarioTemplate) {
      baseTemplate = {
        ...baseTemplate,
        instructions: baseTemplate.instructions + '\n\n' + scenarioTemplate,
      };
    }
    
    // Apply quality-specific enhancements
    const qualityEnhancement = this.getQualityEnhancement(qualityLevel);
    if (qualityEnhancement) {
      baseTemplate = {
        ...baseTemplate,
        instructions: baseTemplate.instructions + '\n\n' + qualityEnhancement,
      };
    }
    
    return baseTemplate;
  }

  /**
   * Get quality-specific enhancement
   */
  private getQualityEnhancement(qualityLevel: string): string {
    switch (qualityLevel) {
      case 'production':
        return PROMPT_TEMPLATES.PRODUCTION;
      case 'educational':
        return PROMPT_TEMPLATES.EDUCATIONAL;
      case 'prototype':
        return PROMPT_TEMPLATES.PROTOTYPE;
      default:
        return '';
    }
  }

  /**
   * Get language-specific rules
   */
  private getLanguageRules(language?: string): string {
    if (!language) return '';
    
    const normalized = language.toLowerCase();
    return this.languageSpecificRules.get(normalized) || 
           this.languageSpecificRules.get('javascript') || '';
  }

  /**
   * Build the final enhanced prompt
   */
  private buildEnhancedPrompt({
    userMessage,
    template,
    languageRules,
    securityRules,
    buildingRules,
    complexity,
  }: {
    userMessage: string;
    template: PromptTemplate;
    languageRules: string;
    securityRules: string;
    buildingRules: string;
    complexity: string;
  }): string {
    const complexityGuidance = this.getComplexityGuidance(complexity);
    
    return `${template.system}

${template.instructions}

${template.constraints}

${languageRules}

${securityRules}

${buildingRules}

${complexityGuidance}

${template.format}

USER REQUEST: ${userMessage}

REMEMBER: Create ONE complete, production-ready file. NO separate files, NO project structures, NO multi-file solutions. Everything must be in a SINGLE code block.`;
  }

  /**
   * Get complexity-specific guidance
   */
  private getComplexityGuidance(complexity: string): string {
    switch (complexity) {
      case 'simple':
        return `
COMPLEXITY: SIMPLE
- Focus on clear, straightforward implementation
- Minimize abstractions and keep it direct
- Prioritize readability over advanced patterns`;

      case 'complex':
        return `
COMPLEXITY: COMPLEX
- Use advanced patterns and optimizations
- Include comprehensive error handling
- Implement design patterns where appropriate
- Add detailed documentation and comments`;

      default:
        return `
COMPLEXITY: MEDIUM
- Balance simplicity with functionality
- Use appropriate abstractions
- Include basic error handling
- Add clear comments for complex logic`;
    }
  }

  /**
   * Analyze user message to extract context
   */
  analyzeMessage(message: string): Partial<PromptContext> {
    const analysis: Partial<PromptContext> = {};
    
    // Detect language
    const languages = ['javascript', 'typescript', 'python', 'react', 'html', 'css'];
    for (const lang of languages) {
      if (message.toLowerCase().includes(lang)) {
        analysis.codeLanguage = lang;
        break;
      }
    }
    
    // Detect complexity
    if (message.includes('simple') || message.includes('basic') || message.includes('quick')) {
      analysis.complexity = 'simple';
    } else if (message.includes('complex') || message.includes('advanced') || message.includes('comprehensive')) {
      analysis.complexity = 'complex';
    } else {
      analysis.complexity = 'medium';
    }
    
    // Detect project type
    if (message.includes('website') || message.includes('web app') || message.includes('landing page')) {
      analysis.projectType = 'web';
    } else if (message.includes('react app') || message.includes('component')) {
      analysis.projectType = 'react';
    } else if (message.includes('script') || message.includes('automation')) {
      analysis.projectType = 'script';
    }
    
    return analysis;
  }

  /**
   * Create context-aware prompt for regeneration
   */
  generateRegeneratePrompt(originalMessage: string, feedback: string): string {
    const context = this.analyzeMessage(originalMessage);
    context.userMessage = `${originalMessage}\n\nADDITIONAL FEEDBACK: ${feedback}\n\nPlease regenerate the code addressing the feedback while maintaining the single-file requirement.`;
    
    return this.generatePrompt(context as PromptContext);
  }
}

export const promptManager = new PromptManager();