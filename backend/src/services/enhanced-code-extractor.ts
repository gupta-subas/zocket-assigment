import { createHash } from 'crypto';
import { createLogger } from '../utils/logger';

const logger = createLogger();

export interface ExtractedCode {
  id: string;
  title: string;
  language: string;
  code: string;
  hash: string;
  type: 'CODE' | 'HTML' | 'REACT' | 'JAVASCRIPT' | 'TYPESCRIPT' | 'PYTHON' | 'CSS' | 'OTHER';
  metadata: {
    originalBlocks: number;
    dependencies: string[];
    framework?: string;
    hasJSX: boolean;
    estimatedLines: number;
    complexity: 'low' | 'medium' | 'high';
    buildable: boolean;
    previewable: boolean;
  };
}

export class EnhancedCodeExtractor {
  
  /**
   * Extract and intelligently consolidate code from AI responses
   */
  extractAndConsolidateCode(content: string): ExtractedCode | null {
    const codeBlocks = this.extractAllCodeFormats(content);
    
    if (codeBlocks.length === 0) {
      return null;
    }

    // Smart consolidation based on detected patterns
    const consolidatedCode = this.intelligentConsolidation(codeBlocks);
    
    if (!consolidatedCode) {
      return null;
    }

    const metadata = this.analyzeCode(consolidatedCode, codeBlocks);
    const title = this.generateSmartTitle(consolidatedCode, metadata);

    return {
      id: this.generateHash(consolidatedCode),
      title,
      language: metadata.framework || this.detectLanguageFromCode(consolidatedCode),
      code: consolidatedCode,
      hash: this.generateHash(consolidatedCode),
      type: this.determineCodeType(consolidatedCode, metadata),
      metadata,
    };
  }

  /**
   * Enhanced code block extraction - handles multiple AI output formats
   */
  private extractAllCodeFormats(content: string): Array<{
    language: string;
    code: string;
    fileName?: string;
    isFile: boolean;
    context?: string;
  }> {
    const blocks: Array<{
      language: string;
      code: string;
      fileName?: string;
      isFile: boolean;
      context?: string;
    }> = [];

    // Pattern 1: Standard code blocks with language (most common case)
    const standardPattern = /```(\w+)?\s*\n([\s\S]*?)```/gi;
    this.extractWithPattern(content, standardPattern, blocks, 'standard');

    // Only use additional patterns if no standard blocks found
    if (blocks.length === 0) {
      // Pattern 2: Code blocks with file paths (src/components/Button.tsx)
      const filePathPattern = /```(\w+)?\s*(?:\/\/\s*)?((?:src\/|components\/|pages\/|utils\/|lib\/|app\/)[^`\n]+\.(js|jsx|ts|tsx|py|html|css|json))\s*\n([\s\S]*?)```/gi;
      this.extractWithPattern(content, filePathPattern, blocks, 'filepath');

      // Pattern 3: Inline code with language hints
      const inlinePattern = /(?:Here's the|This is the|The following)\s+(\w+)\s+code[:\s]*```(\w+)?\s*\n([\s\S]*?)```/gi;
      this.extractWithPattern(content, inlinePattern, blocks, 'inline');
    }

    // Pattern 4: Simple code blocks without language (only if no other patterns matched)
    if (blocks.length === 0) {
      const simplePattern = /```\s*\n([\s\S]*?)```/gi;
      this.extractSimpleBlocks(content, simplePattern, blocks);
    }

    // Pattern 5: Code snippets in descriptions - DISABLED to prevent fragmentation
    // const snippetPattern = /(?:function|class|const|let|var|import|export|def|if|for|while)\s+[^`\n]*?(?:\{[\s\S]*?\}|:[\s\S]*?(?=\n\n|\n[A-Z]|\n$))/gm;
    // this.extractCodeSnippets(content, snippetPattern, blocks);

    return this.deduplicateBlocks(blocks);
  }

  private extractWithPattern(
    content: string, 
    pattern: RegExp, 
    blocks: any[], 
    type: string
  ): void {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      let language, fileName, code;
      
      if (type === 'standard') {
        // For simplified standard pattern: ```language\ncode```
        language = this.normalizeLanguage(match[1] || 'text');
        fileName = undefined;
        code = match[2]?.trim();
      } else {
        // For other patterns with filename support
        language = this.normalizeLanguage(match[1] || this.detectLanguageFromFilename(match[2]) || 'text');
        fileName = match[2]?.trim();
        code = (match[4] || match[3])?.trim();
      }
      
      if (code && code.length > 10) { // Minimum code length
        blocks.push({
          language,
          code,
          fileName,
          isFile: !!fileName,
          context: type,
        });
      }
    }
  }

  private extractSimpleBlocks(content: string, pattern: RegExp, blocks: any[]): void {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const code = match[1]?.trim();
      if (code && code.length > 10) {
        const detectedLang = this.detectLanguageFromCode(code);
        
        // Avoid duplicates
        const isDuplicate = blocks.some(block => 
          this.calculateSimilarity(block.code, code) > 0.8
        );
        
        if (!isDuplicate) {
          blocks.push({
            language: detectedLang,
            code,
            isFile: false,
            context: 'simple',
          });
        }
      }
    }
  }

  private extractCodeSnippets(content: string, pattern: RegExp, blocks: any[]): void {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const code = match[0]?.trim();
      if (code && code.length > 20) { // Longer minimum for snippets
        const detectedLang = this.detectLanguageFromCode(code);
        blocks.push({
          language: detectedLang,
          code,
          isFile: false,
          context: 'snippet',
        });
      }
    }
  }

  /**
   * Intelligent consolidation - groups related code and optimizes structure
   */
  private intelligentConsolidation(blocks: any[]): string | null {
    if (blocks.length === 0) return null;
    
    // Group by language and framework
    const primaryLang = this.detectPrimaryLanguage(blocks);
    const primaryBlocks = blocks.filter(b => 
      this.languageMatches(b.language, primaryLang)
    );

    if (primaryBlocks.length === 0) return null;

    // Language-specific consolidation strategies
    switch (primaryLang.toLowerCase()) {
      case 'javascript':
      case 'typescript':
      case 'jsx':
      case 'tsx':
        return this.consolidateJavaScript(primaryBlocks);
      case 'python':
        return this.consolidatePython(primaryBlocks);
      case 'html':
        return this.consolidateWeb(blocks); // Use all blocks for web
      default:
        return this.consolidateGeneric(primaryBlocks);
    }
  }

  private consolidateJavaScript(blocks: any[]): string {
    // Simple consolidation - just join blocks with clear separators
    // This preserves the original code structure without complex parsing
    
    if (blocks.length === 1) {
      // Single block - return as-is to preserve original formatting
      return blocks[0].code;
    }

    // Multiple blocks - combine with clear separators
    const sections: string[] = [];
    
    blocks.forEach((block, index) => {
      if (index > 0) {
        sections.push(''); // Empty line between blocks
      }
      
      // Add block with optional context comment
      if (block.fileName) {
        sections.push(`// ==================== ${block.fileName.toUpperCase()} ====================`);
      } else if (blocks.length > 1) {
        sections.push(`// ==================== BLOCK ${index + 1} ====================`);
      }
      
      sections.push(block.code);
    });

    return sections.join('\n');
  }

  private consolidatePython(blocks: any[]): string {
    // Simple consolidation for Python - preserve original structure
    
    if (blocks.length === 1) {
      return blocks[0].code;
    }

    const sections: string[] = [];
    
    blocks.forEach((block, index) => {
      if (index > 0) {
        sections.push(''); // Empty line between blocks
      }
      
      if (block.fileName) {
        sections.push(`# ==================== ${block.fileName.toUpperCase()} ====================`);
      } else if (blocks.length > 1) {
        sections.push(`# ==================== BLOCK ${index + 1} ====================`);
      }
      
      sections.push(block.code);
    });

    return sections.join('\n');
  }

  private consolidateWeb(blocks: any[]): string {
    let htmlContent = '';
    const cssBlocks: string[] = [];
    const jsBlocks: string[] = [];

    for (const block of blocks) {
      switch (block.language.toLowerCase()) {
        case 'html':
          htmlContent = block.code;
          break;
        case 'css':
          cssBlocks.push(block.code);
          break;
        case 'javascript':
        case 'js':
          jsBlocks.push(block.code);
          break;
      }
    }

    if (!htmlContent) {
      htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Application</title>
</head>
<body>
    <div id="root">
        <h1>Generated Application</h1>
    </div>
</body>
</html>`;
    }

    // Inject CSS
    if (cssBlocks.length > 0) {
      const cssContent = cssBlocks.join('\n');
      const styleTag = `\n<style>\n${cssContent}\n</style>`;
      htmlContent = htmlContent.replace('</head>', `${styleTag}\n</head>`);
    }

    // Inject JavaScript
    if (jsBlocks.length > 0) {
      const jsContent = jsBlocks.join('\n');
      const scriptTag = `\n<script>\n${jsContent}\n</script>`;
      htmlContent = htmlContent.replace('</body>', `${scriptTag}\n</body>`);
    }

    return htmlContent;
  }

  private consolidateGeneric(blocks: any[]): string {
    return blocks.map(block => 
      `// ==================== ${block.fileName || 'CODE BLOCK'} ====================\n${block.code}`
    ).join('\n\n');
  }

  // Utility methods
  private normalizeLanguage(lang: string): string {
    const normalized = lang.toLowerCase();
    const mappings: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'cpp': 'c++',
      'cs': 'csharp',
      'sh': 'shell',
      'yml': 'yaml',
    };
    return mappings[normalized] || normalized;
  }

  private detectLanguageFromFilename(filename?: string): string {
    if (!filename) return 'text';
    
    const ext = filename.split('.').pop()?.toLowerCase();
    const mappings: Record<string, string> = {
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
    };
    
    return mappings[ext || ''] || 'text';
  }

  private detectLanguageFromCode(code: string): string {
    const trimmed = code.trim();
    
    // HTML detection (most specific first)
    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || 
        (trimmed.includes('<head>') && trimmed.includes('<body>'))) {
      return 'html';
    }
    
    // Python detection (BEFORE TypeScript to avoid confusion with type hints)
    if (/(?:def\s+\w+|import\s+\w+|from\s+\w+\s+import|if\s+__name__|print\s*\(|""".*"""|'''.*'''|#.*\n|^\s*class\s+\w+|Union\[|List\[|Dict\[|Callable\[)/i.test(code)) {
      return 'python';
    }
    
    // React/JSX detection
    if (/(?:import.*react|<[A-Z]\w*|jsx|export\s+default)/i.test(code)) {
      return /\.tsx?$|typescript/i.test(code) ? 'tsx' : 'jsx';
    }
    
    // TypeScript detection (more specific patterns to avoid Python confusion)
    if (/(?:interface\s+\w+|type\s+\w+\s*=|:\s*(?:string|number|boolean|object)\s*[=;]|<T.*>|enum\s+\w+)/i.test(code)) {
      return 'typescript';
    }
    
    // JavaScript detection
    if (/(?:function|const|let|var|=>|import|export)/i.test(code)) {
      return 'javascript';
    }
    
    // HTML detection
    if (/<(?:html|head|body|div|span|p|h[1-6])/i.test(code)) {
      return 'html';
    }
    
    // CSS detection
    if (/(?:\w+\s*\{[^}]*\}|@media|@keyframes)/i.test(code)) {
      return 'css';
    }
    
    return 'text';
  }

  private detectPrimaryLanguage(blocks: any[]): string {
    const langCounts: Record<string, number> = {};
    
    blocks.forEach(block => {
      const lang = this.normalizeLanguage(block.language);
      langCounts[lang] = (langCounts[lang] || 0) + block.code.length;
    });

    return Object.entries(langCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'text';
  }

  private languageMatches(lang1: string, lang2: string): boolean {
    const normalized1 = this.normalizeLanguage(lang1);
    const normalized2 = this.normalizeLanguage(lang2);
    
    // Group related languages
    const jsFamily = ['javascript', 'typescript', 'jsx', 'tsx'];
    const webFamily = ['html', 'css', 'javascript'];
    
    if (jsFamily.includes(normalized1) && jsFamily.includes(normalized2)) return true;
    if (webFamily.includes(normalized1) && webFamily.includes(normalized2)) return true;
    
    return normalized1 === normalized2;
  }

  private calculateSimilarity(code1: string, code2: string): number {
    const clean1 = code1.replace(/\s+/g, ' ').trim();
    const clean2 = code2.replace(/\s+/g, ' ').trim();
    
    if (clean1 === clean2) return 1;
    
    const longer = clean1.length > clean2.length ? clean1 : clean2;
    const shorter = clean1.length > clean2.length ? clean2 : clean1;
    
    if (longer.length === 0) return 1;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private deduplicateBlocks(blocks: any[]): any[] {
    const unique: any[] = [];
    
    for (const block of blocks) {
      const isDuplicate = unique.some(existing => 
        this.calculateSimilarity(existing.code, block.code) > 0.7 || // More aggressive deduplication
        existing.code.includes(block.code) || // Remove if one is contained in another
        block.code.includes(existing.code)
      );
      
      if (!isDuplicate) {
        unique.push(block);
      } else {
        // If current block is longer, replace the existing one
        const existingIndex = unique.findIndex(existing => 
          this.calculateSimilarity(existing.code, block.code) > 0.7
        );
        if (existingIndex !== -1 && block.code.length > unique[existingIndex].code.length) {
          unique[existingIndex] = block;
        }
      }
    }
    
    return unique;
  }

  private analyzeCode(code: string, blocks: any[]): ExtractedCode['metadata'] {
    const lines = code.split('\n').length;
    const dependencies = this.extractDependencies(code);
    const framework = this.detectFramework(code);
    const hasJSX = /(?:<[A-Z]\w*|jsx)/i.test(code);
    
    return {
      originalBlocks: blocks.length,
      dependencies,
      framework,
      hasJSX,
      estimatedLines: lines,
      complexity: lines > 200 ? 'high' : lines > 50 ? 'medium' : 'low',
      buildable: this.isBuildable(code, framework),
      previewable: this.isPreviewable(code, framework),
    };
  }

  private extractDependencies(code: string): string[] {
    const deps: Set<string> = new Set();
    
    // JavaScript/TypeScript imports
    const importMatches = code.match(/(?:import.*?from\s+['"`]([^'"`]+)['"`]|require\(['"`]([^'"`]+)['"`]\))/g);
    importMatches?.forEach(imp => {
      const match = imp.match(/['"`]([^'"`]+)['"`]/);
      if (match && !match[1].startsWith('./') && !match[1].startsWith('../')) {
        deps.add(match[1]);
      }
    });

    // Python imports
    const pythonImports = code.match(/(?:import\s+(\w+)|from\s+(\w+)\s+import)/g);
    pythonImports?.forEach(imp => {
      const match = imp.match(/(?:import\s+(\w+)|from\s+(\w+)\s+import)/);
      if (match) {
        deps.add(match[1] || match[2]);
      }
    });

    return Array.from(deps);
  }

  private detectFramework(code: string): string | undefined {
    if (/(?:import.*react|from\s+['"`]react['"`])/i.test(code)) return 'react';
    if (/(?:import.*vue|from\s+['"`]vue['"`])/i.test(code)) return 'vue';
    if (/(?:import.*angular|from\s+['"`]@angular)/i.test(code)) return 'angular';
    if (/(?:import.*svelte|from\s+['"`]svelte['"`])/i.test(code)) return 'svelte';
    if (/(?:express\(|app\.listen|app\.get)/i.test(code)) return 'express';
    if (/(?:fastapi|from\s+fastapi)/i.test(code)) return 'fastapi';
    if (/(?:flask|from\s+flask)/i.test(code)) return 'flask';
    
    return undefined;
  }

  private isBuildable(code: string, framework?: string): boolean {
    const buildableLanguages = ['javascript', 'typescript', 'jsx', 'tsx', 'python'];
    const buildableFrameworks = ['react', 'vue', 'angular', 'svelte'];
    
    return buildableLanguages.some(lang => code.includes(lang)) ||
           (framework ? buildableFrameworks.includes(framework) : false) ||
           /(?:function|class|const|let|var|import|export)/i.test(code);
  }

  private isPreviewable(code: string, framework?: string): boolean {
    const previewableFrameworks = ['react', 'vue', 'angular', 'svelte'];
    
    return /(?:<[A-Z]\w*|component|render|template|html)/i.test(code) ||
           (framework ? previewableFrameworks.includes(framework) : false) ||
           /<(?:html|head|body|div)/i.test(code);
  }

  private determineCodeType(code: string, metadata: ExtractedCode['metadata']): ExtractedCode['type'] {
    const trimmed = code.trim();
    
    // Check for HTML first (most specific)
    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || 
        (trimmed.includes('<head>') && trimmed.includes('<body>'))) {
      return 'HTML';
    }
    
    if (metadata.framework === 'react' || metadata.hasJSX) return 'REACT';
    if (/typescript|\.tsx?$|interface|type\s+\w+\s*=/i.test(code)) return 'TYPESCRIPT';
    if (/javascript|\.jsx?$/i.test(code)) return 'JAVASCRIPT';
    if (/python|\.py$/i.test(code)) return 'PYTHON';
    if (/<(?:html|head|body)/i.test(code)) return 'HTML';
    if (/(?:\w+\s*\{[^}]*\}|@media|@keyframes)/i.test(code)) return 'CSS';
    
    return 'CODE';
  }

  private generateSmartTitle(code: string, metadata: ExtractedCode['metadata']): string {
    // Try to extract HTML title first
    const htmlTitleMatch = code.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (htmlTitleMatch) {
      return htmlTitleMatch[1].trim();
    }
    
    // Try to extract meaningful names
    const componentMatch = code.match(/(?:function|class|const)\s+([A-Z]\w*)/);
    const functionMatch = code.match(/function\s+(\w+)/);
    const classMatch = code.match(/class\s+(\w+)/);
    
    if (componentMatch) return `${componentMatch[1]} Component`;
    if (classMatch) return `${classMatch[1]} Class`;
    if (functionMatch) return `${functionMatch[1]} Function`;
    
    if (metadata.framework) return `${metadata.framework.charAt(0).toUpperCase() + metadata.framework.slice(1)} Application`;
    
    return `${metadata.complexity.charAt(0).toUpperCase() + metadata.complexity.slice(1)} Complexity Code`;
  }

  private generateHash(code: string): string {
    return createHash('sha256').update(code).digest('hex').substring(0, 12);
  }
}

export const enhancedCodeExtractor = new EnhancedCodeExtractor(); 