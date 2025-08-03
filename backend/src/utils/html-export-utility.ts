#!/usr/bin/env node

import { localBundlingService } from '../services/local-bundling-service';
import { htmlExportService } from '../services/html-export-service';
import { createLogger } from './logger';

const logger = createLogger();

export interface ExportCodeOptions {
  code: string;
  language: string;
  filename?: string;
  outputDir?: string;
  includeTimestamp?: boolean;
}

/**
 * Utility function to bundle code and save it as an HTML file
 */
export async function exportCodeAsHtml(options: ExportCodeOptions) {
  try {
    logger.info('Starting code bundling and HTML export...');
    
    // Bundle the code
    const bundleResult = await localBundlingService.bundleCode(options.code, options.language);
    
    if (!bundleResult.success) {
      logger.error('Bundling failed:', bundleResult.errors);
      return {
        success: false,
        error: 'Bundling failed: ' + bundleResult.errors.join(', '),
      };
    }
    
    logger.info('Code bundled successfully, saving HTML file...');
    
    // Save as HTML file
    const exportResult = await htmlExportService.saveAsHtml(bundleResult, {
      filename: options.filename,
      outputDir: options.outputDir,
      includeTimestamp: options.includeTimestamp,
    });
    
    if (exportResult.success) {
      logger.info(`✅ HTML file saved successfully!`);
      logger.info(`📁 File location: ${exportResult.filePath}`);
      logger.info(`📄 File name: ${exportResult.fileName}`);
      logger.info(`🌐 Open in browser: file://${exportResult.filePath}`);
      
      return {
        success: true,
        filePath: exportResult.filePath,
        fileName: exportResult.fileName,
        bundleInfo: {
          dependencies: bundleResult.dependencies,
          installedPackages: bundleResult.installedPackages,
          buildTime: bundleResult.buildTime,
          bundleSize: bundleResult.bundleSize,
        },
      };
    } else {
      logger.error('Failed to save HTML file:', exportResult.error);
      return {
        success: false,
        error: exportResult.error,
      };
    }
    
  } catch (error) {
    logger.error('Export failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Export code with custom template (bypasses the bundling service's HTML generation)
 */
export async function exportWithCustomTemplate(options: ExportCodeOptions) {
  try {
    logger.info('Starting code bundling for custom template...');
    
    // Bundle the code
    const bundleResult = await localBundlingService.bundleCode(options.code, options.language);
    
    if (!bundleResult.success) {
      logger.error('Bundling failed:', bundleResult.errors);
      return {
        success: false,
        error: 'Bundling failed: ' + bundleResult.errors.join(', '),
      };
    }
    
    if (!bundleResult.bundledCode) {
      return {
        success: false,
        error: 'No bundled code generated',
      };
    }
    
    logger.info('Code bundled successfully, saving with custom template...');
    
    // Save with custom template
    const exportResult = await htmlExportService.saveWithCustomTemplate(
      bundleResult.bundledCode,
      options.language,
      {
        filename: options.filename,
        outputDir: options.outputDir,
        includeTimestamp: options.includeTimestamp,
      }
    );
    
    if (exportResult.success) {
      logger.info(`✅ Custom HTML file saved successfully!`);
      logger.info(`📁 File location: ${exportResult.filePath}`);
      logger.info(`📄 File name: ${exportResult.fileName}`);
      logger.info(`🌐 Open in browser: file://${exportResult.filePath}`);
      
      return {
        success: true,
        filePath: exportResult.filePath,
        fileName: exportResult.fileName,
        bundleInfo: {
          dependencies: bundleResult.dependencies,
          installedPackages: bundleResult.installedPackages,
          buildTime: bundleResult.buildTime,
          bundleSize: bundleResult.bundleSize,
        },
      };
    } else {
      logger.error('Failed to save custom HTML file:', exportResult.error);
      return {
        success: false,
        error: exportResult.error,
      };
    }
    
  } catch (error) {
    logger.error('Custom export failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * List all exported HTML files
 */
export async function listExportedFiles() {
  try {
    const files = await htmlExportService.listExports();
    const exportDir = htmlExportService.getExportDirectory();
    
    logger.info(`📁 Export directory: ${exportDir}`);
    
    if (files.length === 0) {
      logger.info('📄 No exported files found');
      return { files: [], exportDir };
    }
    
    logger.info(`📄 Found ${files.length} exported file(s):`);
    files.forEach((file, index) => {
      logger.info(`  ${index + 1}. ${file}`);
    });
    
    return { files, exportDir };
  } catch (error) {
    logger.error('Failed to list exported files:', error);
    return { files: [], exportDir: '', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Clean up old exported files
 */
export async function cleanupOldExports(olderThanDays: number = 7) {
  try {
    const deletedCount = await htmlExportService.cleanupOldExports(olderThanDays);
    logger.info(`🧹 Cleaned up ${deletedCount} old export file(s) (older than ${olderThanDays} days)`);
    return { deletedCount };
  } catch (error) {
    logger.error('Failed to cleanup old exports:', error);
    return { deletedCount: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Example usage (commented out - uncomment to test)
/*
async function exampleUsage() {
  const reactCode = `
import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Counter Example</h1>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
      <button onClick={() => setCount(count - 1)}>
        Decrement
      </button>
    </div>
  );
}

export default Counter;
  `;

  const result = await exportCodeAsHtml({
    code: reactCode,
    language: 'react',
    filename: 'counter-example',
    includeTimestamp: true,
  });

  if (result.success) {
    console.log('Success!', result);
  } else {
    console.error('Failed:', result.error);
  }
}

// Uncomment to test:
// exampleUsage();
*/