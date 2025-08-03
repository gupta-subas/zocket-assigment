import { createHash } from 'crypto';
import { createLogger } from '../utils/logger';
import { s3Service } from './s3';

const logger = createLogger();

export interface ParsedCodeBlock {
  id: string;
  language: string;
  code: string;
  fileName?: string;
  isFile: boolean;
  hash: string;
  lineStart: number;
  lineEnd: number;
}

export interface CodeArtifactEnhanced {
  id: string;
  title: string;
  language: string;
  code: string;
  hash: string;
  type: 'CODE' | 'HTML' | 'REACT' | 'JAVASCRIPT' | 'PYTHON' | 'PROJECT' | 'OTHER';
  metadata: {
    dependencies?: string[];
    framework?: string;
    hasJSX?: boolean;
    complexity: 'low' | 'medium' | 'high';
    estimatedTokens: number;
  };
}

export interface ProjectStructureEnhanced {
  id: string;
  title: string;
  description?: string;
  framework?: string;
  files: Array<{
    fileName: string;
    content: string;
    language: string;
    hash: string;
    dependencies?: string[];
  }>;
  metadata: {
    totalFiles: number;
    totalLines: number;
    dependencies: string[];
    devDependencies: string[];
    entryPoint?: string;
    buildable: boolean;
  };
}

export class CodeProcessor {
  private codeCache = new Map<string, any>();
  private readonly MAX_CACHE_SIZE = 1000;

  /**
   * Advanced code block extraction using AST-like parsing
   */
  extractCodeBlocks(content: string): ParsedCodeBlock[] {
    const blocks: ParsedCodeBlock[] = [];
    const lines = content.split('\n');
    let currentBlock: Partial<ParsedCodeBlock> | null = null;
    let blockContent: string[] = [];
    let blockStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Start of code block
      const startMatch = line.match(/^```(\w+)?\s*(?:\/\/\s*)?(.+\.(js|jsx|ts|tsx|py|html|css|json|md|yml|yaml|txt|sh|sql|go|rs|java|cpp|c|h))?/);
      if (startMatch && !currentBlock) {
        const language = startMatch[1]?.toLowerCase() || 'text';
        const fileName = startMatch[2]?.trim();
        
        currentBlock = {
          language,
          fileName,
          isFile: !!fileName,
          lineStart: i,
        };
        blockContent = [];
        blockStartLine = i;
        continue;
      }
      
      // End of code block
      if (line.trim() === '```' && currentBlock) {
        const code = blockContent.join('\n').trim();
        if (code.length > 0) {
          const hash = this.generateCodeHash(code);
          const id = `${currentBlock.language}_${hash.substring(0, 8)}`;
          
          blocks.push({
            id,
            language: currentBlock.language!,
            code,
            fileName: currentBlock.fileName,
            isFile: currentBlock.isFile!,
            hash,
            lineStart: blockStartLine,
            lineEnd: i,
          });
        }
        currentBlock = null;
        blockContent = [];
        continue;
      }
      
      // Content inside code block
      if (currentBlock) {
        blockContent.push(line);
      }
    }
    
    return blocks;
  }

  /**
   * Enhanced code artifact processing with metadata extraction
   */
  processCodeArtifacts(content: string): CodeArtifactEnhanced[] {
    const blocks = this.extractCodeBlocks(content);
    const artifacts: CodeArtifactEnhanced[] = [];
    
    for (const block of blocks) {
      if (block.isFile) continue; // Handle files separately in project processing
      
      const metadata = this.analyzeCode(block.code, block.language);
      const title = this.generateTitle(block.code, block.language, metadata);
      
      artifacts.push({
        id: block.id,
        title,
        language: block.language,
        code: block.code,
        hash: block.hash,
        type: this.determineArtifactType(block.language, block.code),
        metadata,
      });
    }
    
    return artifacts;
  }

  /**
   * Enhanced project structure processing
   */
  processProjectStructure(content: string): ProjectStructureEnhanced[] {
    const blocks = this.extractCodeBlocks(content);
    const fileBlocks = blocks.filter(b => b.isFile);
    
    if (fileBlocks.length < 2) return [];
    
    const projects: ProjectStructureEnhanced[] = [];
    const projectGroups = this.groupFilesByProject(fileBlocks);
    
    for (const group of projectGroups) {
      const project = this.buildProjectStructure(group, content);
      if (project) {
        projects.push(project);
      }
    }
    
    return projects;
  }

  /**
   * Smart caching with hash-based deduplication
   */
  async getCachedOrProcess<T>(
    key: string, 
    processor: () => Promise<T>,
    ttl: number = 3600000 // 1 hour
  ): Promise<T> {
    const cached = this.codeCache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
    
    const result = await processor();
    
    // Implement LRU eviction
    if (this.codeCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.codeCache.keys().next().value;
      this.codeCache.delete(oldestKey);
    }
    
    this.codeCache.set(key, {
      data: result,
      timestamp: Date.now(),
    });
    
    return result;
  }

  /**
   * Advanced code analysis with dependency detection
   */
  private analyzeCode(code: string, language: string): CodeArtifactEnhanced['metadata'] {
    const analysis = {
      dependencies: this.extractDependencies(code, language),
      framework: this.detectFramework(code, language),
      hasJSX: this.detectJSX(code),
      complexity: this.calculateComplexity(code),
      estimatedTokens: Math.ceil(code.length / 4),
    };
    
    return analysis;
  }

  /**
   * Improved dependency extraction
   */
  private extractDependencies(code: string, language: string): string[] {
    const deps = new Set<string>();
    
    // ES6 imports
    const importMatches = code.matchAll(/import\s+(?:.*\s+from\s+)?['"]([^'"]+)['"]/g);
    for (const match of importMatches) {
      const pkg = this.normalizePackageName(match[1]);
      if (pkg && !pkg.startsWith('.') && !pkg.startsWith('/')) {
        deps.add(pkg);
      }
    }
    
    // CommonJS requires
    const requireMatches = code.matchAll(/require\(['"]([^'"]+)['"]\)/g);
    for (const match of requireMatches) {
      const pkg = this.normalizePackageName(match[1]);
      if (pkg && !pkg.startsWith('.') && !pkg.startsWith('/')) {
        deps.add(pkg);
      }
    }
    
    // Dynamic imports
    const dynamicMatches = code.matchAll(/import\(['"]([^'"]+)['"]\)/g);
    for (const match of dynamicMatches) {
      const pkg = this.normalizePackageName(match[1]);
      if (pkg && !pkg.startsWith('.') && !pkg.startsWith('/')) {
        deps.add(pkg);
      }
    }
    
    // Language-specific patterns
    if (language === 'python') {
      const pythonImports = code.matchAll(/(?:from\s+(\w+)|import\s+(\w+))/g);
      for (const match of pythonImports) {
        const pkg = match[1] || match[2];
        if (pkg && !this.isPythonBuiltin(pkg)) {
          deps.add(pkg);
        }
      }
    }
    
    return Array.from(deps);
  }

  /**
   * Framework detection with confidence scoring
   */
  private detectFramework(code: string, language: string): string | undefined {
    const frameworks = [
      { name: 'react', patterns: [/import.*react/i, /useState|useEffect|jsx/i, /<[A-Z]\w*/], score: 0 },
      { name: 'vue', patterns: [/import.*vue/i, /@vue\//, /v-if|v-for|v-model/], score: 0 },
      { name: 'angular', patterns: [/@angular\//, /@Component|@Injectable/, /ngOnInit|ngOnDestroy/], score: 0 },
      { name: 'svelte', patterns: [/\.svelte/, /\$:/, /on:click|bind:/], score: 0 },
      { name: 'next', patterns: [/next\//, /getServerSideProps|getStaticProps/, /pages\/|app\//], score: 0 },
      { name: 'express', patterns: [/express/, /app\.get|app\.post/, /req\.|res\./], score: 0 },
      { name: 'fastapi', patterns: [/fastapi/, /@app\./, /Depends\(|HTTPException/], score: 0 },
    ];
    
    for (const framework of frameworks) {
      for (const pattern of framework.patterns) {
        if (pattern.test(code)) {
          framework.score++;
        }
      }
    }
    
    const detected = frameworks.filter(f => f.score > 0).sort((a, b) => b.score - a.score);
    return detected.length > 0 ? detected[0].name : undefined;
  }

  /**
   * JSX detection
   */
  private detectJSX(code: string): boolean {
    return /(<[A-Z][^>]*>|{\s*\w+\s*}|className=|jsx|tsx)/.test(code);
  }

  /**
   * Complexity calculation based on multiple factors
   */
  private calculateComplexity(code: string): 'low' | 'medium' | 'high' {
    let score = 0;
    
    // Line count
    const lines = code.split('\n').length;
    score += lines > 100 ? 3 : lines > 50 ? 2 : 1;
    
    // Cyclomatic complexity indicators
    const complexityPatterns = [
      /if\s*\(/g, /else\s*{/g, /while\s*\(/g, /for\s*\(/g,
      /switch\s*\(/g, /case\s+/g, /catch\s*\(/g, /\?\s*:/g,
      /&&|\|\|/g, /async\s+/g, /await\s+/g
    ];
    
    for (const pattern of complexityPatterns) {
      const matches = code.match(pattern);
      score += matches ? matches.length : 0;
    }
    
    // Nesting depth
    const maxDepth = this.calculateNestingDepth(code);
    score += maxDepth > 4 ? 3 : maxDepth > 2 ? 2 : 1;
    
    if (score > 20) return 'high';
    if (score > 10) return 'medium';
    return 'low';
  }

  /**
   * Calculate nesting depth
   */
  private calculateNestingDepth(code: string): number {
    let maxDepth = 0;
    let currentDepth = 0;
    
    for (const char of code) {
      if (char === '{') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === '}') {
        currentDepth--;
      }
    }
    
    return maxDepth;
  }

  /**
   * Group files by project based on structure patterns
   */
  private groupFilesByProject(fileBlocks: ParsedCodeBlock[]): ParsedCodeBlock[][] {
    // Simple grouping - can be enhanced with ML clustering
    const groups: ParsedCodeBlock[][] = [];
    const ungrouped = [...fileBlocks];
    
    while (ungrouped.length > 0) {
      const current = ungrouped.shift()!;
      const group = [current];
      
      // Find related files
      for (let i = ungrouped.length - 1; i >= 0; i--) {
        const file = ungrouped[i];
        if (this.areFilesRelated(current, file, group)) {
          group.push(file);
          ungrouped.splice(i, 1);
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  }

  /**
   * Determine if files are related and should be in the same project
   */
  private areFilesRelated(file1: ParsedCodeBlock, file2: ParsedCodeBlock, existingGroup: ParsedCodeBlock[]): boolean {
    // Same language family
    const sameLangFamily = this.isSameLangFamily(file1.language, file2.language);
    if (!sameLangFamily) return false;
    
    // Directory structure
    const file1Dir = file1.fileName?.split('/').slice(0, -1).join('/') || '';
    const file2Dir = file2.fileName?.split('/').slice(0, -1).join('/') || '';
    
    // Share common directory prefix
    if (file1Dir && file2Dir && (file1Dir.startsWith(file2Dir) || file2Dir.startsWith(file1Dir))) {
      return true;
    }
    
    // Configuration files
    if (this.isConfigFile(file2.fileName)) {
      return true;
    }
    
    // Import relationships
    const hasImports = this.checkImportRelationship(file1, file2, existingGroup);
    if (hasImports) return true;
    
    return false;
  }

  /**
   * Build complete project structure with metadata
   */
  private buildProjectStructure(files: ParsedCodeBlock[], originalContent: string): ProjectStructureEnhanced | null {
    if (files.length < 2) return null;
    
    const allDeps = new Set<string>();
    const allDevDeps = new Set<string>();
    let detectedFramework: string | undefined;
    let totalLines = 0;
    
    const processedFiles = files.map(file => {
      const deps = this.extractDependencies(file.code, file.language);
      const framework = this.detectFramework(file.code, file.language);
      
      deps.forEach(dep => {
        if (this.isDevDependency(dep)) {
          allDevDeps.add(dep);
        } else {
          allDeps.add(dep);
        }
      });
      
      if (framework && !detectedFramework) {
        detectedFramework = framework;
      }
      
      totalLines += file.code.split('\n').length;
      
      return {
        fileName: file.fileName || `file_${file.id}.${this.getExtension(file.language)}`,
        content: file.code,
        language: file.language,
        hash: file.hash,
        dependencies: deps,
      };
    });
    
    const entryPoint = this.findEntryPoint(processedFiles);
    const title = this.generateProjectTitle(processedFiles, originalContent, detectedFramework);
    
    return {
      id: this.generateCodeHash(processedFiles.map(f => f.content).join('\n')),
      title,
      description: this.extractProjectDescription(originalContent),
      framework: detectedFramework,
      files: processedFiles,
      metadata: {
        totalFiles: processedFiles.length,
        totalLines,
        dependencies: Array.from(allDeps),
        devDependencies: Array.from(allDevDeps),
        entryPoint,
        buildable: this.isBuildable(processedFiles, detectedFramework),
      },
    };
  }

  /**
   * Utility methods
   */
  private generateCodeHash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private normalizePackageName(pkg: string): string {
    // Handle scoped packages
    if (pkg.startsWith('@')) {
      const parts = pkg.split('/');
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : pkg;
    }
    return pkg.split('/')[0];
  }

  private isPythonBuiltin(pkg: string): boolean {
    const builtins = new Set(['os', 'sys', 'json', 'datetime', 'time', 'math', 're', 'random', 'urllib', 'collections']);
    return builtins.has(pkg);
  }

  private isSameLangFamily(lang1: string, lang2: string): boolean {
    const families = [
      ['javascript', 'typescript', 'jsx', 'tsx', 'react'],
      ['python', 'py'],
      ['html', 'css'],
      ['json', 'yaml', 'yml'],
    ];
    
    for (const family of families) {
      if (family.includes(lang1) && family.includes(lang2)) {
        return true;
      }
    }
    
    return lang1 === lang2;
  }

  private isConfigFile(fileName?: string): boolean {
    if (!fileName) return false;
    const configFiles = ['package.json', 'tsconfig.json', 'webpack.config.js', 'vite.config.ts', '.env', 'docker-compose.yml'];
    return configFiles.some(config => fileName.endsWith(config));
  }

  private checkImportRelationship(file1: ParsedCodeBlock, file2: ParsedCodeBlock, group: ParsedCodeBlock[]): boolean {
    // Check if any file in the group imports from file2 or vice versa
    const allFiles = [...group, file1];
    const file2Name = file2.fileName?.replace(/\.[^.]+$/, '') || '';
    
    for (const file of allFiles) {
      if (file.code.includes(file2Name) || file2.code.includes(file.fileName?.replace(/\.[^.]+$/, '') || '')) {
        return true;
      }
    }
    
    return false;
  }

  private isDevDependency(pkg: string): boolean {
    const devPatterns = [
      'typescript', '@types/', 'eslint', 'prettier', 'jest', 'vitest',
      'webpack', 'vite', 'rollup', 'parcel', '@babel/', 'ts-node',
      'nodemon', 'concurrently', 'cross-env', '@testing-library/',
    ];
    return devPatterns.some(pattern => pkg.includes(pattern));
  }

  private findEntryPoint(files: Array<{ fileName: string; language: string }>): string | undefined {
    const priorities = ['index.tsx', 'index.ts', 'index.jsx', 'index.js', 'main.tsx', 'main.ts', 'app.tsx', 'app.ts'];
    
    for (const priority of priorities) {
      const found = files.find(f => f.fileName.toLowerCase().endsWith(priority));
      if (found) return found.fileName;
    }
    
    return files[0]?.fileName;
  }

  private isBuildable(files: Array<{ language: string }>, framework?: string): boolean {
    const buildableFrameworks = ['react', 'vue', 'angular', 'svelte', 'next'];
    const buildableLanguages = ['typescript', 'tsx', 'jsx', 'javascript'];
    
    return !!(framework && buildableFrameworks.includes(framework)) ||
           files.some(f => buildableLanguages.includes(f.language));
  }

  private getExtension(language: string): string {
    const exts: Record<string, string> = {
      javascript: 'js', typescript: 'ts', jsx: 'jsx', tsx: 'tsx',
      python: 'py', html: 'html', css: 'css', json: 'json'
    };
    return exts[language] || 'txt';
  }

  private generateTitle(code: string, language: string, metadata: any): string {
    // Enhanced title generation using metadata
    if (metadata.framework) {
      return `${metadata.framework.charAt(0).toUpperCase() + metadata.framework.slice(1)} Component`;
    }
    
    // Extract meaningful names
    const functionMatch = code.match(/(?:function|const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
    const classMatch = code.match(/class\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
    
    if (classMatch) return `${classMatch[1]} Class`;
    if (functionMatch) return `${functionMatch[1]} Function`;
    
    return `${language.charAt(0).toUpperCase() + language.slice(1)} Code`;
  }

  private generateProjectTitle(files: Array<{ fileName: string }>, content: string, framework?: string): string {
    // Try to extract from content first
    const titlePatterns = [
      /project\s*(?:name|title):\s*([^\n]+)/i,
      /building\s+(?:a\s+)?([^\n]+?)\s+(?:project|app)/i,
      /#\s*([^\n]+)/m, // Markdown title
    ];
    
    for (const pattern of titlePatterns) {
      const match = content.match(pattern);
      if (match) return match[1].trim();
    }
    
    // Generate based on structure
    if (framework) {
      return `${framework.charAt(0).toUpperCase() + framework.slice(1)} Application`;
    }
    
    const hasApi = files.some(f => f.fileName.includes('api') || f.fileName.includes('server'));
    const hasUI = files.some(f => f.fileName.includes('component') || f.fileName.includes('page'));
    
    if (hasApi && hasUI) return 'Full Stack Application';
    if (hasUI) return 'Frontend Application';
    if (hasApi) return 'Backend API';
    
    return 'Code Project';
  }

  private extractProjectDescription(content: string): string | undefined {
    const descPatterns = [
      /(?:description|about):\s*([^\n]+)/i,
      /this\s+(?:project|app|application)\s+(?:is|does|provides)\s+([^\n]+)/i,
    ];
    
    for (const pattern of descPatterns) {
      const match = content.match(pattern);
      if (match) return match[1].trim();
    }
    
    return undefined;
  }

  private determineArtifactType(language: string, code: string): CodeArtifactEnhanced['type'] {
    switch (language.toLowerCase()) {
      case 'html': return 'HTML';
      case 'javascript': case 'js': return 'JAVASCRIPT';
      case 'typescript': case 'ts': return 'JAVASCRIPT';
      case 'jsx': case 'tsx': case 'react':
        return this.detectJSX(code) ? 'REACT' : 'JAVASCRIPT';
      case 'python': case 'py': return 'PYTHON';
      default: return 'CODE';
    }
  }
}

export const codeProcessor = new CodeProcessor();