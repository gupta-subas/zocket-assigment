import { createLogger } from '../utils/logger';

const logger = createLogger();

export interface SecurityScanResult {
  isSecure: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  issues: SecurityIssue[];
  recommendations: string[];
  score: number; // 0-100, higher is more secure
}

export interface SecurityIssue {
  id: string;
  type: 'xss' | 'injection' | 'malicious' | 'privacy' | 'dangerous-api' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  line?: number;
  column?: number;
  suggestion?: string;
  codeSnippet?: string;
}

export interface ValidationOptions {
  strictMode?: boolean;
  allowedDomains?: string[];
  allowedAPIs?: string[];
  maxComplexity?: number;
  enableHeuristics?: boolean;
}

export class SecurityValidator {
  private readonly dangerousPatterns: Map<RegExp, SecurityIssue>;
  private readonly suspiciousPatterns: Map<RegExp, Partial<SecurityIssue>>;
  private readonly allowedAPIs: Set<string>;

  constructor() {
    this.dangerousPatterns = this.initializeDangerousPatterns();
    this.suspiciousPatterns = this.initializeSuspiciousPatterns();
    this.allowedAPIs = this.initializeAllowedAPIs();
  }

  /**
   * Comprehensive security validation of code
   */
  async validateCode(
    code: string,
    language: string,
    options: ValidationOptions = {}
  ): Promise<SecurityScanResult> {
    const issues: SecurityIssue[] = [];
    let score = 100;

    try {
      // 1. Static pattern analysis
      const staticIssues = this.analyzeStaticPatterns(code, language);
      issues.push(...staticIssues);

      // 2. XSS vulnerability detection
      const xssIssues = this.detectXSSVulnerabilities(code, language);
      issues.push(...xssIssues);

      // 3. Injection attack detection
      const injectionIssues = this.detectInjectionAttacks(code, language);
      issues.push(...injectionIssues);

      // 4. Malicious API usage detection
      const apiIssues = this.detectMaliciousAPIUsage(code, language, options);
      issues.push(...apiIssues);

      // 5. Privacy and data security
      const privacyIssues = this.detectPrivacyIssues(code, language);
      issues.push(...privacyIssues);

      // 6. Language-specific security checks
      const langIssues = this.performLanguageSpecificChecks(code, language);
      issues.push(...langIssues);

      // 7. Heuristic analysis (if enabled)
      if (options.enableHeuristics) {
        const heuristicIssues = this.performHeuristicAnalysis(code, language);
        issues.push(...heuristicIssues);
      }

      // Calculate security score
      score = this.calculateSecurityScore(issues);

      // Determine risk level
      const riskLevel = this.determineRiskLevel(issues, score);

      // Generate recommendations
      const recommendations = this.generateRecommendations(issues, language);

      const result: SecurityScanResult = {
        isSecure: issues.filter(i => ['high', 'critical'].includes(i.severity)).length === 0,
        riskLevel,
        issues,
        recommendations,
        score,
      };

      logger.info(`Security scan completed: ${issues.length} issues found, score: ${score}`);
      return result;

    } catch (error) {
      logger.error('Security validation error:', error);
      return {
        isSecure: false,
        riskLevel: 'critical',
        issues: [{
          id: 'scan-error',
          type: 'other',
          severity: 'critical',
          description: 'Security scan failed - code may contain hidden vulnerabilities',
        }],
        recommendations: ['Manual security review required'],
        score: 0,
      };
    }
  }

  /**
   * Validate project structure for security issues
   */
  async validateProject(
    files: Array<{ fileName: string; content: string; language: string }>,
    options: ValidationOptions = {}
  ): Promise<{
    overallSecurity: SecurityScanResult;
    fileResults: Map<string, SecurityScanResult>;
    crossFileIssues: SecurityIssue[];
  }> {
    const fileResults = new Map<string, SecurityScanResult>();
    const allIssues: SecurityIssue[] = [];

    // Scan each file
    for (const file of files) {
      const result = await this.validateCode(file.content, file.language, options);
      fileResults.set(file.fileName, result);
      allIssues.push(...result.issues);
    }

    // Cross-file analysis
    const crossFileIssues = this.analyzeCrossFileSecurityIssues(files);
    allIssues.push(...crossFileIssues);

    // Calculate overall security
    const avgScore = fileResults.size > 0
      ? Array.from(fileResults.values()).reduce((sum, r) => sum + r.score, 0) / fileResults.size
      : 0;

    const overallSecurity: SecurityScanResult = {
      isSecure: allIssues.filter(i => ['high', 'critical'].includes(i.severity)).length === 0,
      riskLevel: this.determineRiskLevel(allIssues, avgScore),
      issues: allIssues,
      recommendations: this.generateProjectRecommendations(allIssues, files),
      score: avgScore,
    };

    return {
      overallSecurity,
      fileResults,
      crossFileIssues,
    };
  }

  /**
   * Real-time security checking during code streaming
   */
  async validateCodeChunk(
    codeChunk: string,
    language: string,
    context: { previousChunks?: string[]; fullCode?: string }
  ): Promise<{
    immediateIssues: SecurityIssue[];
    requiresFullScan: boolean;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }> {
    const immediateIssues: SecurityIssue[] = [];

    // Quick dangerous pattern check
    for (const [pattern, issue] of this.dangerousPatterns) {
      if (pattern.test(codeChunk)) {
        immediateIssues.push({
          ...issue,
          id: `chunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        });
      }
    }

    // Check for obvious malicious patterns
    const maliciousPatterns = [
      /eval\s*\(/i,
      /document\.write\s*\(/i,
      /innerHTML\s*=/i,
      /\.then\s*\(\s*eval/i,
      /fetch\s*\(\s*['"](https?:\/\/|\/\/)/i,
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(codeChunk)) {
        immediateIssues.push({
          id: `malicious-${Date.now()}`,
          type: 'malicious',
          severity: 'high',
          description: 'Potentially malicious code pattern detected',
          codeSnippet: codeChunk.substring(0, 100),
        });
      }
    }

    const requiresFullScan = 
      immediateIssues.some(i => i.severity === 'critical') ||
      codeChunk.includes('import') ||
      codeChunk.includes('require') ||
      codeChunk.includes('fetch') ||
      codeChunk.includes('XMLHttpRequest');

    const riskLevel = immediateIssues.length > 0
      ? immediateIssues.reduce((max, issue) => {
          const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
          return severityOrder[issue.severity] > severityOrder[max] ? issue.severity : max;
        }, 'low' as SecurityIssue['severity'])
      : 'low';

    return {
      immediateIssues,
      requiresFullScan,
      riskLevel,
    };
  }

  // Private methods

  private initializeDangerousPatterns(): Map<RegExp, SecurityIssue> {
    const patterns = new Map<RegExp, SecurityIssue>();

    // XSS patterns
    patterns.set(/innerHTML\s*=/, {
      id: 'xss-innerhtml',
      type: 'xss',
      severity: 'high',
      description: 'Direct innerHTML assignment can lead to XSS vulnerabilities',
      suggestion: 'Use textContent or sanitize HTML content',
    });

    patterns.set(/document\.write\s*\(/, {
      id: 'xss-document-write',
      type: 'xss',
      severity: 'critical',
      description: 'document.write() can introduce XSS vulnerabilities',
      suggestion: 'Use DOM manipulation methods instead',
    });

    // Code injection patterns
    patterns.set(/eval\s*\(/, {
      id: 'injection-eval',
      type: 'injection',
      severity: 'critical',
      description: 'eval() can execute arbitrary code and is extremely dangerous',
      suggestion: 'Remove eval() and use safer alternatives',
    });

    patterns.set(/Function\s*\(.*\)\s*\(/, {
      id: 'injection-function-constructor',
      type: 'injection',
      severity: 'critical',
      description: 'Function constructor can execute arbitrary code',
      suggestion: 'Use regular function declarations',
    });

    // Dangerous APIs
    patterns.set(/setTimeout\s*\(\s*["`']/, {
      id: 'dangerous-settimeout',
      type: 'injection',
      severity: 'high',
      description: 'setTimeout with string argument can execute arbitrary code',
      suggestion: 'Use setTimeout with function reference',
    });

    patterns.set(/setInterval\s*\(\s*["`']/, {
      id: 'dangerous-setinterval',
      type: 'injection',
      severity: 'high',
      description: 'setInterval with string argument can execute arbitrary code',
      suggestion: 'Use setInterval with function reference',
    });

    // External resource loading
    patterns.set(/script\s*src\s*=\s*["`']https?:\/\/(?!localhost)/, {
      id: 'external-script',
      type: 'privacy',
      severity: 'medium',
      description: 'Loading external scripts can compromise security',
      suggestion: 'Verify the source and use integrity hashes',
    });

    return patterns;
  }

  private initializeSuspiciousPatterns(): Map<RegExp, Partial<SecurityIssue>> {
    const patterns = new Map<RegExp, Partial<SecurityIssue>>();

    patterns.set(/crypto|password|secret|token|key/i, {
      type: 'privacy',
      severity: 'medium',
      description: 'Potential hardcoded credentials or sensitive data',
    });

    patterns.set(/fetch\s*\(\s*["`'][^"`']*["`']/, {
      type: 'privacy',
      severity: 'low',
      description: 'External API call detected',
    });

    patterns.set(/localStorage|sessionStorage/, {
      type: 'privacy',
      severity: 'low',
      description: 'Browser storage usage detected',
    });

    return patterns;
  }

  private initializeAllowedAPIs(): Set<string> {
    return new Set([
      'console',
      'Math',
      'Date',
      'Array',
      'Object',
      'String',
      'Number',
      'Boolean',
      'JSON',
      'Promise',
      'setTimeout',
      'setInterval',
      'clearTimeout',
      'clearInterval',
      'requestAnimationFrame',
      'cancelAnimationFrame',
    ]);
  }

  private analyzeStaticPatterns(code: string, language: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const lines = code.split('\n');

    for (const [pattern, issue] of this.dangerousPatterns) {
      const matches = [...code.matchAll(new RegExp(pattern.source, 'gi'))];
      
      for (const match of matches) {
        const lineNumber = this.getLineNumber(code, match.index || 0);
        issues.push({
          ...issue,
          id: `${issue.id}-${lineNumber}`,
          line: lineNumber,
          codeSnippet: lines[lineNumber - 1]?.trim(),
        });
      }
    }

    return issues;
  }

  private detectXSSVulnerabilities(code: string, language: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // DOM manipulation without sanitization
    const xssPatterns = [
      {
        pattern: /\.innerHTML\s*\+=?\s*.*\+/g,
        description: 'String concatenation with innerHTML is vulnerable to XSS',
      },
      {
        pattern: /\$\([^)]*\)\.html\(/g,
        description: 'jQuery html() method can introduce XSS vulnerabilities',
      },
      {
        pattern: /insertAdjacentHTML\s*\(/g,
        description: 'insertAdjacentHTML without sanitization can lead to XSS',
      },
    ];

    for (const { pattern, description } of xssPatterns) {
      const matches = [...code.matchAll(pattern)];
      for (const match of matches) {
        issues.push({
          id: `xss-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'xss',
          severity: 'high',
          description,
          line: this.getLineNumber(code, match.index || 0),
          suggestion: 'Use textContent or a trusted sanitization library',
        });
      }
    }

    return issues;
  }

  private detectInjectionAttacks(code: string, language: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // SQL injection patterns (for backend code)
    if (language.includes('sql') || code.includes('SELECT') || code.includes('INSERT')) {
      const sqlPatterns = [
        /SELECT.*\+.*FROM/gi,
        /INSERT.*\+.*INTO/gi,
        /UPDATE.*\+.*SET/gi,
        /DELETE.*\+.*WHERE/gi,
      ];

      for (const pattern of sqlPatterns) {
        const matches = [...code.matchAll(pattern)];
        for (const match of matches) {
          issues.push({
            id: `sql-injection-${Date.now()}`,
            type: 'injection',
            severity: 'critical',
            description: 'Potential SQL injection vulnerability detected',
            line: this.getLineNumber(code, match.index || 0),
            suggestion: 'Use parameterized queries or prepared statements',
          });
        }
      }
    }

    // Command injection patterns
    const commandPatterns = [
      /exec\s*\(/g,
      /system\s*\(/g,
      /shell_exec\s*\(/g,
      /passthru\s*\(/g,
    ];

    for (const pattern of commandPatterns) {
      const matches = [...code.matchAll(pattern)];
      for (const match of matches) {
        issues.push({
          id: `command-injection-${Date.now()}`,
          type: 'injection',
          severity: 'critical',
          description: 'Command execution function detected - potential injection risk',
          line: this.getLineNumber(code, match.index || 0),
          suggestion: 'Validate and sanitize all inputs, use safer alternatives',
        });
      }
    }

    return issues;
  }

  private detectMaliciousAPIUsage(
    code: string,
    language: string,
    options: ValidationOptions
  ): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // Dangerous browser APIs
    const dangerousAPIs = [
      'geolocation',
      'getUserMedia',
      'notification',
      'camera',
      'microphone',
      'bluetooth',
      'usb',
      'serial',
    ];

    for (const api of dangerousAPIs) {
      const pattern = new RegExp(`navigator\\.${api}|${api}\\s*\\(`, 'gi');
      const matches = [...code.matchAll(pattern)];
      
      for (const match of matches) {
        issues.push({
          id: `dangerous-api-${api}`,
          type: 'dangerous-api',
          severity: 'medium',
          description: `Usage of potentially sensitive API: ${api}`,
          line: this.getLineNumber(code, match.index || 0),
          suggestion: 'Ensure proper user consent and security measures',
        });
      }
    }

    // Network requests to suspicious domains
    const urlPattern = /(?:fetch|XMLHttpRequest|axios|$.ajax).*?["`'](https?:\/\/[^"`']+)["`']/gi;
    const matches = [...code.matchAll(urlPattern)];
    
    for (const match of matches) {
      const url = match[1];
      if (!this.isAllowedDomain(url, options.allowedDomains)) {
        issues.push({
          id: `suspicious-request-${Date.now()}`,
          type: 'privacy',
          severity: 'medium',
          description: `Network request to external domain: ${url}`,
          line: this.getLineNumber(code, match.index || 0),
          suggestion: 'Verify the destination is trusted and secure',
        });
      }
    }

    return issues;
  }

  private detectPrivacyIssues(code: string, language: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // Hardcoded secrets/credentials
    const secretPatterns = [
      {
        pattern: /(?:password|passwd|pwd)\s*[=:]\s*["`'][^"`']+["`']/gi,
        description: 'Hardcoded password detected',
      },
      {
        pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*["`'][^"`']+["`']/gi,
        description: 'Hardcoded API key detected',
      },
      {
        pattern: /(?:secret|token)\s*[=:]\s*["`'][^"`']+["`']/gi,
        description: 'Hardcoded secret/token detected',
      },
    ];

    for (const { pattern, description } of secretPatterns) {
      const matches = [...code.matchAll(pattern)];
      for (const match of matches) {
        issues.push({
          id: `privacy-secret-${Date.now()}`,
          type: 'privacy',
          severity: 'high',
          description,
          line: this.getLineNumber(code, match.index || 0),
          suggestion: 'Use environment variables or secure configuration',
        });
      }
    }

    return issues;
  }

  private performLanguageSpecificChecks(code: string, language: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        issues.push(...this.checkJavaScriptSecurity(code));
        break;
      case 'python':
        issues.push(...this.checkPythonSecurity(code));
        break;
      case 'html':
        issues.push(...this.checkHTMLSecurity(code));
        break;
    }

    return issues;
  }

  private checkJavaScriptSecurity(code: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // Prototype pollution
    if (code.includes('__proto__') || code.includes('constructor.prototype')) {
      issues.push({
        id: 'js-prototype-pollution',
        type: 'malicious',
        severity: 'high',
        description: 'Potential prototype pollution detected',
        suggestion: 'Avoid direct prototype manipulation',
      });
    }

    // Unsafe JSON parsing
    const jsonPattern = /JSON\.parse\s*\(\s*[^)]*\)/g;
    const matches = [...code.matchAll(jsonPattern)];
    for (const match of matches) {
      issues.push({
        id: 'js-unsafe-json',
        type: 'injection',
        severity: 'medium',
        description: 'JSON.parse without validation can be dangerous',
        line: this.getLineNumber(code, match.index || 0),
        suggestion: 'Validate JSON data before parsing',
      });
    }

    return issues;
  }

  private checkPythonSecurity(code: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // Dangerous Python functions
    const dangerousFunctions = ['exec', 'eval', 'compile', '__import__'];
    
    for (const func of dangerousFunctions) {
      const pattern = new RegExp(`\\b${func}\\s*\\(`, 'g');
      const matches = [...code.matchAll(pattern)];
      
      for (const match of matches) {
        issues.push({
          id: `python-dangerous-${func}`,
          type: 'injection',
          severity: 'critical',
          description: `Dangerous Python function: ${func}()`,
          line: this.getLineNumber(code, match.index || 0),
          suggestion: 'Use safer alternatives or validate inputs thoroughly',
        });
      }
    }

    return issues;
  }

  private checkHTMLSecurity(code: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // Inline JavaScript
    const inlineJsPattern = /(?:on\w+\s*=|javascript:)/gi;
    const matches = [...code.matchAll(inlineJsPattern)];
    
    for (const match of matches) {
      issues.push({
        id: 'html-inline-js',
        type: 'xss',
        severity: 'high',
        description: 'Inline JavaScript detected in HTML',
        line: this.getLineNumber(code, match.index || 0),
        suggestion: 'Use external JavaScript files and CSP headers',
      });
    }

    return issues;
  }

  private performHeuristicAnalysis(code: string, language: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // Obfuscated code detection
    const obfuscationIndicators = [
      /\\x[0-9a-f]{2}/gi, // Hex escapes
      /\\u[0-9a-f]{4}/gi, // Unicode escapes
      /[a-zA-Z_][a-zA-Z0-9_]{30,}/g, // Very long identifiers
      /\[.*\]\[.*\]\[.*\]/g, // Bracket notation chaining
    ];

    let obfuscationScore = 0;
    for (const pattern of obfuscationIndicators) {
      const matches = code.match(pattern);
      if (matches) {
        obfuscationScore += matches.length;
      }
    }

    if (obfuscationScore > 10) {
      issues.push({
        id: 'heuristic-obfuscation',
        type: 'malicious',
        severity: 'medium',
        description: 'Code appears to be obfuscated',
        suggestion: 'Review for potential malicious intent',
      });
    }

    return issues;
  }

  private analyzeCrossFileSecurityIssues(
    files: Array<{ fileName: string; content: string; language: string }>
  ): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // Check for password files
    const sensitiveFiles = files.filter(f => 
      f.fileName.includes('password') ||
      f.fileName.includes('secret') ||
      f.fileName.includes('key')
    );

    for (const file of sensitiveFiles) {
      issues.push({
        id: `cross-file-sensitive-${file.fileName}`,
        type: 'privacy',
        severity: 'medium',
        description: `Sensitive file detected: ${file.fileName}`,
        suggestion: 'Ensure sensitive files are properly secured',
      });
    }

    return issues;
  }

  private calculateSecurityScore(issues: SecurityIssue[]): number {
    let score = 100;
    
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 25;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 8;
          break;
        case 'low':
          score -= 3;
          break;
      }
    }

    return Math.max(0, score);
  }

  private determineRiskLevel(issues: SecurityIssue[], score: number): 'low' | 'medium' | 'high' | 'critical' {
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;

    if (criticalIssues > 0) return 'critical';
    if (highIssues > 2 || score < 50) return 'high';
    if (highIssues > 0 || score < 75) return 'medium';
    return 'low';
  }

  private generateRecommendations(issues: SecurityIssue[], language: string): string[] {
    const recommendations = new Set<string>();

    // General recommendations based on issues
    if (issues.some(i => i.type === 'xss')) {
      recommendations.add('Implement proper input sanitization and output encoding');
      recommendations.add('Use Content Security Policy (CSP) headers');
    }

    if (issues.some(i => i.type === 'injection')) {
      recommendations.add('Use parameterized queries and prepared statements');
      recommendations.add('Implement strict input validation');
    }

    if (issues.some(i => i.type === 'privacy')) {
      recommendations.add('Use environment variables for sensitive configuration');
      recommendations.add('Implement proper access controls');
    }

    if (issues.some(i => i.type === 'dangerous-api')) {
      recommendations.add('Request minimal permissions and implement user consent');
      recommendations.add('Use secure communication protocols (HTTPS)');
    }

    // Language-specific recommendations
    if (language.includes('javascript')) {
      recommendations.add('Enable strict mode and use modern JavaScript features');
      recommendations.add('Implement proper error handling and logging');
    }

    return Array.from(recommendations);
  }

  private generateProjectRecommendations(
    issues: SecurityIssue[],
    files: Array<{ fileName: string; content: string; language: string }>
  ): string[] {
    const recommendations = new Set<string>();

    recommendations.add('Implement regular security audits and dependency scanning');
    recommendations.add('Use automated security testing in CI/CD pipeline');
    recommendations.add('Follow security coding standards and guidelines');

    if (files.some(f => f.fileName.includes('config'))) {
      recommendations.add('Secure configuration files and use environment variables');
    }

    return Array.from(recommendations);
  }

  private isAllowedDomain(url: string, allowedDomains?: string[]): boolean {
    if (!allowedDomains || allowedDomains.length === 0) {
      // Default allowed domains
      const defaultAllowed = ['localhost', '127.0.0.1', 'github.com', 'npmjs.com'];
      return defaultAllowed.some(domain => url.includes(domain));
    }

    return allowedDomains.some(domain => url.includes(domain));
  }

  private getLineNumber(code: string, index: number): number {
    return code.substring(0, index).split('\n').length;
  }
}

export const securityValidator = new SecurityValidator();