import * as esbuild from 'esbuild';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger();

export interface LocalBundleResult {
  success: boolean;
  bundledCode?: string;
  previewHtml?: string;
  dependencies: string[];
  installedPackages: string[];
  errors: string[];
  warnings: string[];
  buildTime: number;
  bundleSize?: number;
}

export interface PackageInfo {
  name: string;
  version?: string;
  installed: boolean;
  installTime?: number;
}

export class LocalBundlingService {
  private readonly sandboxPath: string;
  private readonly nodeModulesPath: string;
  private readonly packageJsonPath: string;
  private packageCache = new Map<string, PackageInfo>();
  private installing = new Set<string>(); // Track ongoing installations

  constructor() {
    this.sandboxPath = path.join(process.cwd(), 'sandbox');
    this.nodeModulesPath = path.join(this.sandboxPath, 'node_modules');
    this.packageJsonPath = path.join(this.sandboxPath, 'package.json');
    
    this.initializeSandbox();
  }

  /**
   * Main bundling method with auto-dependency installation
   */
  async bundleCode(code: string, language: string): Promise<LocalBundleResult> {
    const startTime = Date.now();

    try {
      // 1. Preprocess code (adds missing imports)
      const processedCode = this.preprocessReactCode(code, language);
      
      // 2. Extract dependencies from processed code
      const dependencies = this.extractDependencies(processedCode);
      logger.info('Extracted dependencies:', dependencies);

      // 3. Ensure all packages are installed
      let installedPackages: string[] = [];
      try {
        installedPackages = await this.ensurePackagesInstalled(dependencies);
      } catch (installError) {
        logger.warn('Package installation failed, proceeding without dependencies:', installError);
        // Continue with bundling - might work with CDN or built-in packages
      }
      
      // 4. Bundle with local dependencies (use processed code)
      const bundleResult = await this.performLocalBundle(processedCode, language);
      
      const result: LocalBundleResult = {
        success: bundleResult.success,
        bundledCode: bundleResult.bundledCode,
        previewHtml: bundleResult.previewHtml,
        dependencies,
        installedPackages,
        errors: bundleResult.errors,
        warnings: bundleResult.warnings,
        buildTime: Date.now() - startTime,
        bundleSize: bundleResult.bundleSize,
      };

      return result;

    } catch (error) {
      logger.error('Local bundling failed:', error);
      return {
        success: false,
        dependencies: [],
        installedPackages: [],
        errors: [error instanceof Error ? error.message : 'Unknown bundling error'],
        warnings: [],
        buildTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Extract import statements from code
   */
  private extractDependencies(code: string): string[] {
    const dependencies = new Set<string>();
    
    // Match ES6 imports: import ... from 'package'
    const es6ImportRegex = /import\s+(?:[^'"]*\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = es6ImportRegex.exec(code)) !== null) {
      const importPath = match[1];
      
      // Skip relative imports (start with . or /)
      if (!importPath.startsWith('.') && !importPath.startsWith('/') && !importPath.startsWith('node:')) {
        // Extract package name (handle scoped packages)
        const packageName = this.extractPackageName(importPath);
        if (packageName) {
          dependencies.add(packageName);
        }
      }
    }

    // Match CommonJS requires: require('package')
    const cjsRequireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = cjsRequireRegex.exec(code)) !== null) {
      const requirePath = match[1];
      
      if (!requirePath.startsWith('.') && !requirePath.startsWith('/') && !requirePath.startsWith('node:')) {
        const packageName = this.extractPackageName(requirePath);
        if (packageName) {
          dependencies.add(packageName);
        }
      }
    }

    return Array.from(dependencies);
  }

  /**
   * Extract package name from import path (handle subpaths and scoped packages)
   */
  private extractPackageName(importPath: string): string | null {
    // Handle scoped packages (@scope/package or @scope/package/subpath)
    if (importPath.startsWith('@')) {
      const parts = importPath.split('/');
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
    }
    
    // Handle regular packages (package or package/subpath)
    const parts = importPath.split('/');
    return parts[0] || null;
  }

  /**
   * Ensure all required packages are installed
   */
  private async ensurePackagesInstalled(packages: string[]): Promise<string[]> {
    const installed: string[] = [];
    const toInstall: string[] = [];

    // Check which packages need installation
    for (const pkg of packages) {
      if (this.packageCache.has(pkg) && this.packageCache.get(pkg)!.installed) {
        installed.push(pkg);
      } else if (await this.isPackageInstalled(pkg)) {
        this.packageCache.set(pkg, { name: pkg, installed: true });
        installed.push(pkg);
      } else {
        toInstall.push(pkg);
      }
    }

    // Install missing packages
    if (toInstall.length > 0) {
      logger.info('Installing packages:', toInstall);
      const newlyInstalled = await this.installPackages(toInstall);
      installed.push(...newlyInstalled);
    }

    return installed;
  }

  /**
   * Check if a package is already installed
   */
  private async isPackageInstalled(packageName: string): Promise<boolean> {
    try {
      const packagePath = path.join(this.nodeModulesPath, packageName);
      await fs.access(packagePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Install packages using npm
   */
  private async installPackages(packages: string[]): Promise<string[]> {
    const installedPackages: string[] = [];

    // Prevent concurrent installations of the same package
    const uniquePackages = packages.filter(pkg => !this.installing.has(pkg));
    uniquePackages.forEach(pkg => this.installing.add(pkg));

    try {
      if (uniquePackages.length === 0) {
        return installedPackages;
      }

      await this.runNpmInstall(uniquePackages);
      
      // Verify installations and update cache
      for (const pkg of uniquePackages) {
        if (await this.isPackageInstalled(pkg)) {
          this.packageCache.set(pkg, { 
            name: pkg, 
            installed: true, 
            installTime: Date.now() 
          });
          installedPackages.push(pkg);
          logger.info(`Successfully installed: ${pkg}`);
        } else {
          logger.warn(`Failed to verify installation: ${pkg}`);
        }
      }

    } catch (error) {
      logger.error('Package installation failed:', error);
      throw new Error(`Failed to install packages: ${uniquePackages.join(', ')}`);
    } finally {
      // Clean up installation tracking
      uniquePackages.forEach(pkg => this.installing.delete(pkg));
    }

    return installedPackages;
  }

  /**
   * Run npm install command
   */
  private async runNpmInstall(packages: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const npm = spawn('npm', ['install', '--save', ...packages], {
        cwd: this.sandboxPath,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      npm.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      npm.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      npm.on('close', (code) => {
        if (code === 0) {
          logger.debug('npm install stdout:', stdout);
          resolve();
        } else {
          logger.error('npm install failed:', stderr);
          reject(new Error(`npm install failed with code ${code}: ${stderr}`));
        }
      });

      npm.on('error', (error) => {
        reject(new Error(`Failed to spawn npm: ${error.message}`));
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        npm.kill();
        reject(new Error('npm install timeout'));
      }, 120000);
    });
  }

  /**
   * Perform the actual bundling with esbuild
   */
  private async performLocalBundle(code: string, language: string): Promise<{
    success: boolean;
    bundledCode?: string;
    previewHtml?: string;
    errors: string[];
    warnings: string[];
    bundleSize?: number;
  }> {
    try {
      // Code is already preprocessed, use as-is
      const processedCode = code;

      const result = await esbuild.build({
        stdin: {
          contents: processedCode,
          loader: this.getEsbuildLoader(language),
          resolveDir: this.sandboxPath,
        },
        bundle: true,
        format: 'iife',
        platform: 'browser',
        target: ['es2020', 'chrome80', 'firefox80', 'safari14'],
        minify: true,
        sourcemap: 'inline',
        treeShaking: true,
        write: false,
        metafile: true,
        jsx: 'automatic',
        jsxImportSource: 'react',
        define: {
          'process.env.NODE_ENV': '"development"',
          'global': 'globalThis',
        },
        plugins: [
          this.createEnhancedResolverPlugin(),
          this.createPerformancePlugin(),
        ],
        nodePaths: [this.nodeModulesPath],
        resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
        conditions: ['development', 'browser'],
        mainFields: ['browser', 'module', 'main'],
        legalComments: 'none',
        charset: 'utf8',
      });

      const bundledCode = result.outputFiles?.[0]?.text || '';
      const bundleSize = result.outputFiles?.[0]?.contents.length || 0;
      
      // Handle inline source map
      let sourceMap: string | undefined;
      if (bundledCode.includes('sourceMappingURL=data:')) {
        sourceMap = 'inline';
      }

      // Analyze metafile for performance insights
      if (result.metafile) {
        this.analyzeMetafile(result.metafile);
      }

      // Generate enhanced preview HTML
      const previewHtml = this.generateEnhancedPreviewHtml(bundledCode, language, sourceMap);

      return {
        success: true,
        bundledCode,
        previewHtml,
        errors: [],
        warnings: result.warnings.map(w => w.text),
        bundleSize,
      };

    } catch (error: any) {
      logger.error('esbuild bundling failed:', error);
      
      const errors = [];
      if (error.errors) {
        errors.push(...error.errors.map((e: any) => e.text));
      } else {
        errors.push(error.message);
      }

      return {
        success: false,
        errors,
        warnings: error.warnings?.map((w: any) => w.text) || [],
      };
    }
  }

  /**
   * Enhanced resolver plugin with better dependency handling
   */
  private createEnhancedResolverPlugin(): esbuild.Plugin {
    return {
      name: 'enhanced-local-resolver',
      setup: (build) => {
        // Let esbuild handle React and ReactDOM resolution naturally
        // This prevents path resolution issues and works better with different React versions

        // Handle other npm packages - let esbuild do the heavy lifting
        // Only intervene for special cases if needed
        build.onResolve({ filter: /^[^./]/ }, (args) => {
          if (args.namespace !== 'file') return;
          
          // Let esbuild handle package resolution with its built-in logic
          // This is more reliable than custom path resolution
          return null;
        });
      },
    };
  }

  /**
   * Performance monitoring plugin
   */
  private createPerformancePlugin(): esbuild.Plugin {
    return {
      name: 'performance-monitor',
      setup: (build) => {
        let startTime: number;

        build.onStart(() => {
          startTime = Date.now();
          logger.debug('Starting enhanced build...');
        });

        build.onEnd((result) => {
          const buildTime = Date.now() - startTime;
          logger.debug(`Enhanced build completed in ${buildTime}ms`);
          
          if (result.metafile) {
            const inputs = Object.keys(result.metafile.inputs).length;
            const outputs = Object.keys(result.metafile.outputs).length;
            logger.debug(`Processed ${inputs} inputs, generated ${outputs} outputs`);
          }
        });
      },
    };
  }

  /**
   * Analyze metafile for performance insights
   */
  private analyzeMetafile(metafile: esbuild.Metafile): void {
    try {
      const analysis = esbuild.analyzeMetafile(metafile, { verbose: false });
      logger.debug('Bundle analysis complete');
      
      // Log key metrics
      const outputs = Object.keys(metafile.outputs);
      const inputs = Object.keys(metafile.inputs);
      logger.debug(`Bundle contains ${inputs.length} inputs and ${outputs.length} outputs`);
      
      // Log largest dependencies
      const inputSizes = Object.entries(metafile.inputs)
        .map(([path, info]) => ({ path, bytes: info.bytes }))
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, 5);
      
      if (inputSizes.length > 0) {
        logger.debug('Largest dependencies:', inputSizes);
      }
    } catch (error) {
      logger.warn('Failed to analyze metafile:', error);
    }
  }

  /**
   * Generate enhanced preview HTML with better error handling and features
   */
  private generateEnhancedPreviewHtml(
    bundledCode: string, 
    language: string,
    sourceMap?: string
  ): string {
    const isReact = this.isReactLanguage(language);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isReact ? 'React Component' : 'Code'} Preview</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        #root {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            min-height: 200px;
        }
        .error {
            color: #d73a49;
            background: #ffeef0;
            padding: 16px;
            border-radius: 4px;
            border-left: 4px solid #d73a49;
            margin: 10px 0;
        }
        .debug-info {
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 8px;
            border-radius: 4px;
            font-size: 12px;
            font-family: monospace;
            display: none;
            max-width: 300px;
            word-wrap: break-word;
        }
        .debug-info.show {
            display: block;
        }
    </style>
</head>
<body>
    <div id="root">${isReact ? 'Loading React component...' : 'Running code...'}</div>
    <div class="debug-info" id="debug-info">
        Bundle size: ${(bundledCode.length / 1024).toFixed(2)}KB<br>
        ${sourceMap ? 'Source maps: enabled' : 'Source maps: disabled'}
    </div>
    
    <script>
        // Enhanced error handling with better error reporting
        window.onerror = function(msg, url, lineNo, columnNo, error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            errorDiv.innerHTML = \`
                <strong>Runtime Error:</strong> \${msg}<br>
                <small>Line: \${lineNo || 'unknown'}, Column: \${columnNo || 'unknown'}</small>
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
            errorDiv.innerHTML = '<strong>Unhandled Promise Rejection:</strong> ' + 
                (event.reason ? event.reason.toString() : 'Unknown error');
            document.getElementById('root').innerHTML = '';
            document.getElementById('root').appendChild(errorDiv);
            console.error('Unhandled promise rejection:', event.reason);
        });
        
        // Show debug info on double-click
        document.addEventListener('dblclick', function() {
            const debugInfo = document.getElementById('debug-info');
            debugInfo.classList.toggle('show');
        });
        
        // Performance monitoring
        const startTime = performance.now();
        
        try {
            ${bundledCode}
            
            // Log successful execution time
            const loadTime = performance.now() - startTime;
            console.log(\`Component loaded successfully in \${loadTime.toFixed(2)}ms\`);
            
        } catch (error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            errorDiv.innerHTML = \`
                <strong>Execution Error:</strong> \${error.message}<br>
                \${error.stack ? '<pre>' + error.stack + '</pre>' : ''}
            \`;
            document.getElementById('root').innerHTML = '';
            document.getElementById('root').appendChild(errorDiv);
            console.error('Execution error details:', error);
        }
    </script>
    ${sourceMap ? '<!-- Source map data available for debugging -->' : ''}
</body>
</html>`;
  }

  /**
   * Preprocess React code for auto-rendering
   */
  preprocessReactCode(code: string, language: string): string {
    if (!this.isReactLanguage(language)) {
      return code;
    }

    // Ensure React and ReactDOM are imported
    const hasReactDefaultImport = /import\s+React(\s|,|\s+from)/.test(code);
    const hasReactDOMImport = /import.*ReactDOM.*from\s+['"]react-dom['"]/.test(code) || 
                             /import\s+\*\s+as\s+ReactDOM\s+from\s+['"]react-dom['"]/.test(code) ||
                             /import\s+{\s*render\s*}.*from\s+['"]react-dom['"]/.test(code) ||
                             /import\s+{\s*createRoot\s*}.*from\s+['"]react-dom\/client['"]/.test(code);
    
    if (!hasReactDefaultImport) {
      code = `import React from 'react';\n${code}`;
    }
    
    if (!hasReactDOMImport) {
      // Find where to insert ReactDOM import - look for React import first
      const reactImportMatch = code.match(/import React.*from ['"]react['"];?\n/);
      if (reactImportMatch) {
        // Insert after React import - use both old and new APIs for compatibility
        code = code.replace(reactImportMatch[0], reactImportMatch[0] + `import * as ReactDOM from 'react-dom';\nimport { createRoot } from 'react-dom/client';\n`);
      } else {
        // Add at the beginning
        code = `import * as ReactDOM from 'react-dom';\nimport { createRoot } from 'react-dom/client';\n${code}`;
      }
    }

    // Add auto-render logic for exported components using render function
    const hasAutoRender = /ReactDOM\.render\(|render\(React\.createElement|createRoot\(|root\.render\(/.test(code);
    if (code.includes('export default') && !hasAutoRender) {
      let componentName = null;
      
      // Try different export patterns - prioritize function components
      const patterns = [
        /export\s+default\s+function\s+(\w+)/,  // export default function ComponentName
        /function\s+(\w+)\([^)]*\)\s*\{[^}]*return\s*\(/m, // function that returns JSX
        /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*\{[^}]*return\s*\(/m, // arrow function component
        /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*\(/m, // simple arrow component
        /export\s+default\s+(\w+)/, // export default ComponentName (last resort)
      ];
      
      for (const pattern of patterns) {
        const match = code.match(pattern);
        if (match) {
          componentName = match[1];
          break;
        }
      }
      
      // If we found a component name, add auto-render using React 18+ createRoot with fallback
      if (componentName) {
        code += `

// Auto-render component with React 18+ compatibility
if (typeof document !== 'undefined' && document.getElementById('root')) {
  const rootElement = document.getElementById('root');
  const component = React.createElement(${componentName});
  
  // Use React 18+ createRoot if available, fallback to ReactDOM.render
  if (typeof createRoot === 'function') {
    const root = createRoot(rootElement);
    root.render(component);
  } else if (ReactDOM.render) {
    ReactDOM.render(component, rootElement);
  } else {
    console.error('Neither createRoot nor ReactDOM.render is available');
  }
}`;
      } else {
        // No component detected - add generic render for export default
        logger.debug('No specific component name detected, using generic export default render');
      }
    }

    return code;
  }


  /**
   * Get appropriate esbuild loader for language
   */
  private getEsbuildLoader(language: string): esbuild.Loader {
    const loaderMap: Record<string, esbuild.Loader> = {
      'javascript': 'js',
      'typescript': 'ts',
      'react': 'tsx',
      'jsx': 'jsx',
      'tsx': 'tsx',
      'js': 'js',
      'ts': 'ts',
    };

    return loaderMap[language.toLowerCase()] || 'js';
  }

  /**
   * Check if language is React-related
   */
  private isReactLanguage(language: string): boolean {
    return ['react', 'jsx', 'tsx'].includes(language.toLowerCase());
  }

  /**
   * Initialize sandbox directory and package.json
   */
  private async initializeSandbox(): Promise<void> {
    try {
      // Create sandbox directory if it doesn't exist
      await fs.mkdir(this.sandboxPath, { recursive: true });

      // Create package.json if it doesn't exist
      try {
        await fs.access(this.packageJsonPath);
      } catch {
        const packageJson = {
          name: 'code-editor-sandbox',
          version: '1.0.0',
          description: 'Sandbox for code editor builds',
          private: true,
          dependencies: {},
        };
        
        await fs.writeFile(
          this.packageJsonPath, 
          JSON.stringify(packageJson, null, 2)
        );
        
        logger.info('Created sandbox package.json');
      }

    } catch (error) {
      logger.error('Failed to initialize sandbox:', error);
      throw error;
    }
  }

  /**
   * Get build statistics
   */
  getBuildStats(): {
    installedPackages: number;
    sandboxPath: string;
  } {
    return {
      installedPackages: this.packageCache.size,
      sandboxPath: this.sandboxPath,
    };
  }

  /**
   * Clear package cache (useful for development)
   */
  clearPackageCache(): void {
    this.packageCache.clear();
    logger.info('Cleared package cache');
  }
}

export const localBundlingService = new LocalBundlingService();