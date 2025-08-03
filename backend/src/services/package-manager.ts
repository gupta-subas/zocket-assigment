import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger();

export interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  main?: string;
  type?: string;
}

export interface DependencyInstallResult {
  success: boolean;
  installedPackages: string[];
  errors?: string[];
  warnings?: string[];
  packageJsonPath?: string;
}

export interface ProjectSetupResult {
  success: boolean;
  projectPath: string;
  packageJsonCreated: boolean;
  dependenciesInstalled: boolean;
  errors?: string[];
  buildCommand?: string;
  startCommand?: string;
}

export class PackageManagerService {
  private tempProjectsDir: string;

  constructor() {
    this.tempProjectsDir = path.join(process.cwd(), 'temp-projects');
    this.ensureTempDirectory();
  }

  private async ensureTempDirectory() {
    try {
      await fs.mkdir(this.tempProjectsDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create temp projects directory', error);
    }
  }

  /**
   * Extract dependencies from code content
   */
  extractDependenciesFromCode(code: string, language: string): {
    dependencies: string[];
    devDependencies: string[];
    detectedFramework?: string;
  } {
    const dependencies: string[] = [];
    const devDependencies: string[] = [];
    let detectedFramework: string | undefined;

    // Extract import statements
    const importRegex = /(?:import.*from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;
    let match;

    while ((match = importRegex.exec(code)) !== null) {
      const packageName = match[1] || match[2];
      
      // Skip relative imports
      if (packageName.startsWith('.') || packageName.startsWith('/')) {
        continue;
      }

      // Extract package name (handle scoped packages)
      const pkgName = packageName.startsWith('@') 
        ? packageName.split('/').slice(0, 2).join('/')
        : packageName.split('/')[0];

      if (!dependencies.includes(pkgName) && !devDependencies.includes(pkgName)) {
        // Detect framework and add to appropriate dependencies
        if (this.isReactPackage(pkgName)) {
          dependencies.push(pkgName);
          detectedFramework = 'react';
        } else if (this.isVuePackage(pkgName)) {
          dependencies.push(pkgName);
          detectedFramework = 'vue';
        } else if (this.isAngularPackage(pkgName)) {
          dependencies.push(pkgName);
          detectedFramework = 'angular';
        } else if (this.isDevDependency(pkgName)) {
          devDependencies.push(pkgName);
        } else {
          dependencies.push(pkgName);
        }
      }
    }

    // Add common dependencies based on detected patterns
    if (language === 'typescript' || code.includes('interface ') || code.includes(': string')) {
      if (!devDependencies.includes('typescript')) {
        devDependencies.push('typescript', '@types/node');
      }
    }

    if (detectedFramework === 'react') {
      if (!dependencies.includes('react')) {
        dependencies.push('react', 'react-dom');
      }
      if (language === 'typescript') {
        devDependencies.push('@types/react', '@types/react-dom');
      }
    }

    return { dependencies, devDependencies, detectedFramework };
  }

  /**
   * Generate package.json based on detected dependencies and framework
   */
  generatePackageJson(
    projectName: string,
    dependencies: string[],
    devDependencies: string[],
    framework?: string
  ): PackageJson {
    const packageJson: PackageJson = {
      name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      version: '1.0.0',
      dependencies: {},
      devDependencies: {},
      scripts: {}
    };

    // Add dependencies with latest versions (in production, you'd fetch actual versions)
    dependencies.forEach(dep => {
      packageJson.dependencies![dep] = 'latest';
    });

    devDependencies.forEach(dep => {
      packageJson.devDependencies![dep] = 'latest';
    });

    // Add framework-specific scripts and configuration
    switch (framework) {
      case 'react':
        packageJson.scripts = {
          'dev': 'vite',
          'build': 'vite build',
          'preview': 'vite preview',
          'lint': 'eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0'
        };
        if (!packageJson.devDependencies!['vite']) {
          packageJson.devDependencies!['vite'] = 'latest';
          packageJson.devDependencies!['@vitejs/plugin-react'] = 'latest';
        }
        break;
      
      case 'vue':
        packageJson.scripts = {
          'dev': 'vite',
          'build': 'vite build',
          'preview': 'vite preview'
        };
        break;
      
      default:
        packageJson.scripts = {
          'start': 'node index.js',
          'dev': 'node index.js',
          'build': 'echo "No build step configured"'
        };
        if (devDependencies.includes('typescript')) {
          packageJson.scripts['build'] = 'tsc';
          packageJson.scripts['dev'] = 'ts-node index.ts';
          packageJson.main = 'dist/index.js';
        }
    }

    return packageJson;
  }

  /**
   * Set up a complete project with dependencies
   */
  async setupProject(
    files: Array<{ fileName: string; content: string; language: string }>,
    projectName: string
  ): Promise<ProjectSetupResult> {
    const projectPath = path.join(this.tempProjectsDir, projectName);
    const result: ProjectSetupResult = {
      success: false,
      projectPath,
      packageJsonCreated: false,
      dependenciesInstalled: false,
      errors: []
    };

    try {
      // Create project directory
      await fs.mkdir(projectPath, { recursive: true });

      // Extract dependencies from all files
      const allDependencies = new Set<string>();
      const allDevDependencies = new Set<string>();
      let detectedFramework: string | undefined;

      for (const file of files) {
        const extracted = this.extractDependenciesFromCode(file.content, file.language);
        extracted.dependencies.forEach(dep => allDependencies.add(dep));
        extracted.devDependencies.forEach(dep => allDevDependencies.add(dep));
        if (extracted.detectedFramework) {
          detectedFramework = extracted.detectedFramework;
        }
      }

      // Generate and write package.json
      const packageJson = this.generatePackageJson(
        projectName,
        Array.from(allDependencies),
        Array.from(allDevDependencies),
        detectedFramework
      );

      const packageJsonPath = path.join(projectPath, 'package.json');
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
      result.packageJsonCreated = true;

      // Write all project files
      for (const file of files) {
        const filePath = path.join(projectPath, file.fileName);
        const fileDir = path.dirname(filePath);
        await fs.mkdir(fileDir, { recursive: true });
        await fs.writeFile(filePath, file.content);
      }

      // Add framework-specific config files
      if (detectedFramework === 'react') {
        await this.createViteConfig(projectPath);
        await this.createIndexHtml(projectPath);
      }

      // Install dependencies (with timeout and error handling)
      const installResult = await this.installDependencies(projectPath);
      result.dependenciesInstalled = installResult.success;
      
      if (!installResult.success) {
        result.errors?.push(...(installResult.errors || []));
      }

      result.success = result.packageJsonCreated && result.dependenciesInstalled;
      result.buildCommand = packageJson.scripts?.build || 'npm run build';
      result.startCommand = packageJson.scripts?.dev || packageJson.scripts?.start || 'npm start';

      logger.info(`Project ${projectName} setup completed`, {
        success: result.success,
        dependencies: allDependencies.size,
        devDependencies: allDevDependencies.size
      });

      return result;

    } catch (error) {
      logger.error(`Failed to setup project ${projectName}`, error);
      result.errors?.push(`Project setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Install dependencies with timeout and proper error handling
   */
  private async installDependencies(projectPath: string, timeout = 120000): Promise<DependencyInstallResult> {
    return new Promise((resolve) => {
      const result: DependencyInstallResult = {
        success: false,
        installedPackages: [],
        errors: []
      };

      const npmProcess = spawn('npm', ['install'], {
        cwd: projectPath,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      npmProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      npmProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        npmProcess.kill('SIGTERM');
        result.errors?.push('npm install timed out after 2 minutes');
        resolve(result);
      }, timeout);

      npmProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (code === 0) {
          result.success = true;
          // Extract installed packages from stdout
          const packageMatches = stdout.match(/added \d+ packages/g);
          if (packageMatches) {
            result.installedPackages = packageMatches;
          }
        } else {
          result.errors?.push(`npm install failed with code ${code}`);
          if (stderr) {
            result.errors?.push(stderr);
          }
        }
        
        resolve(result);
      });

      npmProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        result.errors?.push(`Failed to spawn npm process: ${error.message}`);
        resolve(result);
      });
    });
  }

  private async createViteConfig(projectPath: string) {
    const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
`;
    await fs.writeFile(path.join(projectPath, 'vite.config.ts'), viteConfig);
  }

  private async createIndexHtml(projectPath: string) {
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Generated React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
    await fs.writeFile(path.join(projectPath, 'index.html'), indexHtml);
  }

  /**
   * Clean up old temporary projects
   */
  async cleanupOldProjects(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
    try {
      const entries = await fs.readdir(this.tempProjectsDir, { withFileTypes: true });
      const now = Date.now();

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const projectPath = path.join(this.tempProjectsDir, entry.name);
          const stats = await fs.stat(projectPath);
          
          if (now - stats.mtime.getTime() > maxAge) {
            await fs.rm(projectPath, { recursive: true, force: true });
            logger.info(`Cleaned up old project: ${entry.name}`);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old projects', error);
    }
  }

  // Helper methods for package classification
  private isReactPackage(packageName: string): boolean {
    const reactPackages = ['react', 'react-dom', 'react-router', 'react-router-dom', '@reduxjs/toolkit', 'react-redux'];
    return reactPackages.some(pkg => packageName === pkg || packageName.startsWith(pkg + '/'));
  }

  private isVuePackage(packageName: string): boolean {
    const vuePackages = ['vue', 'vue-router', 'vuex', 'pinia'];
    return vuePackages.some(pkg => packageName === pkg || packageName.startsWith(pkg + '/'));
  }

  private isAngularPackage(packageName: string): boolean {
    return packageName.startsWith('@angular/');
  }

  private isDevDependency(packageName: string): boolean {
    const devPackages = [
      'typescript', '@types/', 'eslint', 'prettier', 'jest', 'vitest', 
      'webpack', 'vite', 'rollup', 'parcel', '@babel/', 'ts-node',
      'nodemon', 'concurrently', 'cross-env'
    ];
    return devPackages.some(pkg => packageName === pkg || packageName.startsWith(pkg));
  }
}

export const packageManagerService = new PackageManagerService();