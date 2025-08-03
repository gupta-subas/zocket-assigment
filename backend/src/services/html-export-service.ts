import { promises as fs } from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import type { LocalBundleResult } from './local-bundling-service';

const logger = createLogger();

export interface HtmlExportOptions {
  filename?: string;
  outputDir?: string;
  includeTimestamp?: boolean;
}

export interface HtmlExportResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
}

export class HtmlExportService {
  private readonly defaultOutputDir: string;

  constructor() {
    // Create exports directory in the project root
    this.defaultOutputDir = path.join(process.cwd(), 'html-exports');
    this.initializeExportDirectory();
  }

  /**
   * Save bundled code as an HTML file for local preview
   */
  async saveAsHtml(
    bundleResult: LocalBundleResult,
    options: HtmlExportOptions = {}
  ): Promise<HtmlExportResult> {
    try {
      if (!bundleResult.success || !bundleResult.previewHtml) {
        return {
          success: false,
          error: 'Bundle result is not successful or missing HTML content',
        };
      }

      const outputDir = options.outputDir || this.defaultOutputDir;
      const fileName = this.generateFileName(options);
      const filePath = path.join(outputDir, fileName);

      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      // Write the HTML file
      await fs.writeFile(filePath, bundleResult.previewHtml, 'utf8');

      logger.info(`HTML file saved successfully: ${filePath}`);

      return {
        success: true,
        filePath,
        fileName,
      };

    } catch (error) {
      logger.error('Failed to save HTML file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Save bundled code with custom HTML template
   */
  async saveWithCustomTemplate(
    bundledCode: string,
    language: string,
    options: HtmlExportOptions = {}
  ): Promise<HtmlExportResult> {
    try {
      const outputDir = options.outputDir || this.defaultOutputDir;
      const fileName = this.generateFileName(options);
      const filePath = path.join(outputDir, fileName);

      // Generate custom HTML with the bundled code
      const htmlContent = this.generateCustomHtml(bundledCode, language);

      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      // Write the HTML file
      await fs.writeFile(filePath, htmlContent, 'utf8');

      logger.info(`Custom HTML file saved successfully: ${filePath}`);

      return {
        success: true,
        filePath,
        fileName,
      };

    } catch (error) {
      logger.error('Failed to save custom HTML file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Generate a custom HTML template for bundled code
   */
  private generateCustomHtml(bundledCode: string, language: string): string {
    const isReact = ['react', 'jsx', 'tsx'].includes(language.toLowerCase());
    const timestamp = new Date().toISOString();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isReact ? 'React Component' : 'Code'} Preview - Local Export</title>
    <style>
        * {
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            color: white;
            margin-bottom: 30px;
        }
        
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 2.5rem;
            font-weight: 600;
        }
        
        .header p {
            margin: 0;
            opacity: 0.9;
            font-size: 1.1rem;
        }
        
        #root {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            min-height: 400px;
            position: relative;
        }
        
        .error {
            color: #d73a49;
            background: #ffeef0;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #d73a49;
            margin: 15px 0;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
        }
        
        .error strong {
            display: block;
            margin-bottom: 8px;
            font-size: 1.1rem;
        }
        
        .error pre {
            background: rgba(215, 58, 73, 0.1);
            padding: 12px;
            border-radius: 4px;
            overflow-x: auto;
            margin-top: 12px;
            font-size: 0.9rem;
        }
        
        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 200px;
            font-size: 1.2rem;
            color: #666;
        }
        
        .loading::after {
            content: '';
            width: 20px;
            height: 20px;
            border: 2px solid #ddd;
            border-top: 2px solid #667eea;
            border-radius: 50%;
            margin-left: 10px;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .debug-panel {
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-size: 12px;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
            display: none;
            max-width: 350px;
            word-wrap: break-word;
            z-index: 1000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        
        .debug-panel.show {
            display: block;
        }
        
        .debug-panel h4 {
            margin: 0 0 10px 0;
            color: #4fc3f7;
            font-size: 14px;
        }
        
        .debug-panel .debug-item {
            margin: 8px 0;
            padding: 4px 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        
        .debug-panel .debug-item:last-child {
            border-bottom: none;
        }
        
        .footer {
            text-align: center;
            margin-top: 30px;
            color: rgba(255,255,255,0.8);
            font-size: 0.9rem;
        }
        
        .toggle-debug {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0,0,0,0.7);
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            z-index: 999;
        }
        
        .toggle-debug:hover {
            background: rgba(0,0,0,0.9);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${isReact ? '⚛️ React Component' : '🚀 Code'} Preview</h1>
            <p>Local Export • Generated ${new Date().toLocaleString()}</p>
        </div>
        
        <div id="root">
            <div class="loading">${isReact ? 'Loading React component' : 'Running code'}...</div>
        </div>
        
        <div class="footer">
            <p>💡 Double-click anywhere or use the debug button to toggle debug information</p>
        </div>
    </div>
    
    <button class="toggle-debug" onclick="toggleDebug()">🐛 Debug</button>
    
    <div class="debug-panel" id="debug-panel">
        <h4>📊 Debug Information</h4>
        <div class="debug-item">
            <strong>Bundle Size:</strong> ${(bundledCode.length / 1024).toFixed(2)} KB
        </div>
        <div class="debug-item">
            <strong>Language:</strong> ${language}
        </div>
        <div class="debug-item">
            <strong>Generated:</strong> ${timestamp}
        </div>
        <div class="debug-item">
            <strong>Environment:</strong> Local Preview
        </div>
        <div class="debug-item" id="performance-info">
            <strong>Load Time:</strong> <span id="load-time">Calculating...</span>
        </div>
    </div>
    
    <script>
        // Enhanced error handling with better UI
        window.onerror = function(msg, url, lineNo, columnNo, error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            errorDiv.innerHTML = \`
                <strong>❌ Runtime Error</strong>
                <div>\${msg}</div>
                <small>📍 Line: \${lineNo || 'unknown'}, Column: \${columnNo || 'unknown'}</small>
                \${error && error.stack ? '<pre>' + error.stack + '</pre>' : ''}
            \`;
            document.getElementById('root').innerHTML = '';
            document.getElementById('root').appendChild(errorDiv);
            console.error('Runtime error details:', { msg, url, lineNo, columnNo, error });
            return false;
        };

        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', function(event) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            errorDiv.innerHTML = \`
                <strong>⚠️ Unhandled Promise Rejection</strong>
                <div>\${event.reason ? event.reason.toString() : 'Unknown error'}</div>
            \`;
            document.getElementById('root').innerHTML = '';
            document.getElementById('root').appendChild(errorDiv);
            console.error('Unhandled promise rejection:', event.reason);
        });
        
        // Debug panel toggle functionality
        function toggleDebug() {
            const debugPanel = document.getElementById('debug-panel');
            debugPanel.classList.toggle('show');
        }
        
        // Show debug info on double-click
        document.addEventListener('dblclick', toggleDebug);
        
        // Performance monitoring
        const startTime = performance.now();
        
        try {
            // Execute the bundled code
            ${bundledCode}
            
            // Update performance info
            const loadTime = performance.now() - startTime;
            document.getElementById('load-time').textContent = loadTime.toFixed(2) + 'ms';
            console.log(\`✅ Component loaded successfully in \${loadTime.toFixed(2)}ms\`);
            
        } catch (error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            errorDiv.innerHTML = \`
                <strong>💥 Execution Error</strong>
                <div>\${error.message}</div>
                \${error.stack ? '<pre>' + error.stack + '</pre>' : ''}
            \`;
            document.getElementById('root').innerHTML = '';
            document.getElementById('root').appendChild(errorDiv);
            console.error('Execution error details:', error);
        }
        
        // Add keyboard shortcuts
        document.addEventListener('keydown', function(event) {
            // Press 'D' to toggle debug
            if (event.key === 'd' || event.key === 'D') {
                if (!event.ctrlKey && !event.metaKey && !event.altKey) {
                    toggleDebug();
                }
            }
        });
    </script>
</body>
</html>`;
  }

  /**
   * Generate a unique filename for the HTML export
   */
  private generateFileName(options: HtmlExportOptions): string {
    let fileName = options.filename || 'preview';
    
    // Remove .html extension if provided
    fileName = fileName.replace(/\.html$/, '');
    
    // Add timestamp if requested or no custom filename provided
    if (options.includeTimestamp !== false) {
      const timestamp = new Date().toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .split('.')[0]; // Remove milliseconds
      
      fileName = options.filename ? `${fileName}_${timestamp}` : `preview_${timestamp}`;
    }
    
    return `${fileName}.html`;
  }

  /**
   * Initialize the export directory
   */
  private async initializeExportDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.defaultOutputDir, { recursive: true });
      logger.info(`HTML export directory initialized: ${this.defaultOutputDir}`);
    } catch (error) {
      logger.error('Failed to initialize export directory:', error);
    }
  }

  /**
   * List all exported HTML files
   */
  async listExports(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.defaultOutputDir);
      return files.filter(file => file.endsWith('.html')).sort();
    } catch (error) {
      logger.error('Failed to list exports:', error);
      return [];
    }
  }

  /**
   * Delete an exported HTML file
   */
  async deleteExport(fileName: string): Promise<boolean> {
    try {
      const filePath = path.join(this.defaultOutputDir, fileName);
      await fs.unlink(filePath);
      logger.info(`Deleted export file: ${fileName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete export file ${fileName}:`, error);
      return false;
    }
  }

  /**
   * Clean up old exports (older than specified days)
   */
  async cleanupOldExports(olderThanDays: number = 7): Promise<number> {
    try {
      const files = await this.listExports();
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.defaultOutputDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          deletedCount++;
          logger.info(`Cleaned up old export: ${file}`);
        }
      }

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old exports:', error);
      return 0;
    }
  }

  /**
   * Get export directory path
   */
  getExportDirectory(): string {
    return this.defaultOutputDir;
  }
}

export const htmlExportService = new HtmlExportService();