import { createLogger } from '../utils/logger';

const logger = createLogger();

export interface CodeIntentResult {
  isCodeRelated: boolean;
  confidence: number;
  reasoning: string;
  suggestedAction: 'extract_code' | 'skip_extraction';
}

export class CodeIntentDetector {
  private codeKeywords = [
    // Programming languages
    'javascript', 'typescript', 'python', 'java', 'html', 'css', 'react', 'vue', 'angular',
    'php', 'c++', 'c#', 'go', 'rust', 'kotlin', 'swift', 'ruby', 'scala', 'nodejs',
    
    // Coding terms
    'function', 'variable', 'class', 'method', 'algorithm', 'code', 'programming', 'script',
    'component', 'api', 'database', 'sql', 'query', 'debug', 'fix', 'error', 'bug',
    'implement', 'build', 'create', 'develop', 'app', 'application', 'website', 'web',
    
    // Code-related actions
    'write code', 'create function', 'build app', 'make component', 'fix code',
    'debug', 'implement', 'create script', 'write program', 'develop', 'code for',
    'help me code', 'programming help', 'software', 'algorithm'
  ];

  private nonCodeKeywords = [
    // General conversation
    'how are you', 'hello', 'hi', 'thanks', 'thank you', 'goodbye', 'bye',
    'weather', 'news', 'story', 'joke', 'recipe', 'travel', 'advice', 'opinion',
    'explain', 'what is', 'who is', 'where is', 'when', 'why', 'how to',
    
    // Non-technical topics
    'health', 'fitness', 'cooking', 'music', 'movie', 'book', 'art', 'history',
    'science', 'math', 'philosophy', 'psychology', 'business', 'marketing',
    'writing', 'essay', 'letter', 'email', 'poem', 'creative writing',
    
    // General questions
    'tell me about', 'what do you think', 'can you help', 'i need advice',
    'recommend', 'suggest', 'opinion on', 'thoughts on'
  ];

  /**
   * Analyzes user input to determine if it's code-related
   */
  analyzeUserIntent(userMessage: string): CodeIntentResult {
    const message = userMessage.toLowerCase();
    
    // Check for explicit code-related requests
    const codeScore = this.calculateCodeScore(message);
    const nonCodeScore = this.calculateNonCodeScore(message);
    
    // Check for code patterns in the message
    const hasCodePatterns = this.hasCodePatterns(message);
    
    // Calculate confidence
    let confidence = Math.abs(codeScore - nonCodeScore) / Math.max(codeScore + nonCodeScore, 1);
    if (hasCodePatterns) confidence += 0.3;
    
    const isCodeRelated = codeScore > nonCodeScore || hasCodePatterns;
    
    let reasoning = '';
    if (isCodeRelated) {
      reasoning = hasCodePatterns ? 
        'Message contains code patterns or syntax' :
        `Code-related keywords detected (score: ${codeScore} vs ${nonCodeScore})`;
    } else {
      reasoning = `Non-code keywords dominate (score: ${nonCodeScore} vs ${codeScore})`;
    }

    return {
      isCodeRelated,
      confidence: Math.min(confidence, 1.0),
      reasoning,
      suggestedAction: isCodeRelated ? 'extract_code' : 'skip_extraction'
    };
  }

  /**
   * Analyzes AI response to determine if it contains meaningful code
   */
  analyzeResponseContent(responseContent: string): CodeIntentResult {
    const content = responseContent.toLowerCase();
    
    // Check for code blocks
    const codeBlockCount = this.countCodeBlocks(responseContent);
    const hasSubstantialCode = this.hasSubstantialCode(responseContent);
    
    // If no code blocks, very unlikely to be code-related
    if (codeBlockCount === 0) {
      return {
        isCodeRelated: false,
        confidence: 0.9,
        reasoning: 'No code blocks found in response',
        suggestedAction: 'skip_extraction'
      };
    }

    // If code blocks exist but content is mostly explanatory
    const codeToTextRatio = this.calculateCodeToTextRatio(responseContent);
    
    let isCodeRelated = false;
    let confidence = 0;
    let reasoning = '';

    if (hasSubstantialCode && codeToTextRatio > 0.2) {
      isCodeRelated = true;
      confidence = Math.min(0.7 + (codeToTextRatio * 0.3), 1.0);
      reasoning = `Substantial code content found (${codeBlockCount} blocks, ${(codeToTextRatio * 100).toFixed(1)}% code)`;
    } else if (codeBlockCount > 0 && codeToTextRatio > 0.05) {
      isCodeRelated = true;
      confidence = 0.5 + (codeToTextRatio * 0.3);
      reasoning = `Some code content found (${codeBlockCount} blocks, ${(codeToTextRatio * 100).toFixed(1)}% code)`;
    } else {
      isCodeRelated = false;
      confidence = 0.8;
      reasoning = `Code blocks found but mostly explanatory (${(codeToTextRatio * 100).toFixed(1)}% code content)`;
    }

    return {
      isCodeRelated,
      confidence,
      reasoning,
      suggestedAction: isCodeRelated ? 'extract_code' : 'skip_extraction'
    };
  }

  private calculateCodeScore(message: string): number {
    return this.codeKeywords.reduce((score, keyword) => {
      return score + (message.includes(keyword) ? 1 : 0);
    }, 0);
  }

  private calculateNonCodeScore(message: string): number {
    return this.nonCodeKeywords.reduce((score, keyword) => {
      return score + (message.includes(keyword) ? 1 : 0);
    }, 0);
  }

  private hasCodePatterns(message: string): boolean {
    const patterns = [
      /function\s+\w+\s*\(/,
      /const\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /var\s+\w+\s*=/,
      /class\s+\w+/,
      /import\s+.*from/,
      /export\s+/,
      /console\.log/,
      /document\./,
      /window\./,
      /<\w+.*>/,
      /\{\s*\w+:\s*\w+/,
      /\(\w+\)\s*=>/,
    ];

    return patterns.some(pattern => pattern.test(message));
  }

  private countCodeBlocks(content: string): number {
    const codeBlockRegex = /```[\s\S]*?```/g;
    const matches = content.match(codeBlockRegex);
    return matches ? matches.length : 0;
  }

  private hasSubstantialCode(content: string): boolean {
    const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
    let match;
    let totalCodeLines = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const codeContent = match[1];
      const lines = codeContent.split('\n').filter(line => line.trim().length > 0);
      totalCodeLines += lines.length;
    }

    return totalCodeLines >= 5; // At least 5 lines of code to be considered substantial
  }

  private calculateCodeToTextRatio(content: string): number {
    const codeBlockRegex = /```[\s\S]*?```/g;
    const codeBlocks = content.match(codeBlockRegex);
    
    if (!codeBlocks) return 0;

    const codeLength = codeBlocks.join('').length;
    const totalLength = content.length;
    
    return codeLength / totalLength;
  }
}

export const codeIntentDetector = new CodeIntentDetector();