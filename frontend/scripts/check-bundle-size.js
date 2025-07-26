#!/usr/bin/env node

/**
 * Bundle Size Check Script
 * Validates production build against performance budgets
 */

import fs from 'fs';
import path from 'path';
import { gzipSync } from 'zlib';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Performance budgets (in bytes)
const BUDGETS = {
  maxTotalSize: 150 * 1024, // 150KB
  maxJSSize: 100 * 1024,    // 100KB
  maxCSSSize: 30 * 1024,    // 30KB
  maxImageSize: 50 * 1024,  // 50KB
  maxChunkSize: 50 * 1024,  // 50KB per chunk
};

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getGzipSize(filePath) {
  const content = fs.readFileSync(filePath);
  return gzipSync(content).length;
}

function analyzeBundle() {
  const distPath = path.join(__dirname, '../dist');
  
  if (!fs.existsSync(distPath)) {
    console.error(`${colors.red}❌ Build directory not found: ${distPath}${colors.reset}`);
    process.exit(1);
  }

  console.log(`${colors.bold}${colors.cyan}📊 Bundle Size Analysis${colors.reset}\n`);

  const results = {
    totalSize: 0,
    jsSize: 0,
    cssSize: 0,
    imageSize: 0,
    chunks: [],
    violations: [],
  };

  function analyzeDirectory(dir, prefix = '') {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        analyzeDirectory(itemPath, `${prefix}${item}/`);
      } else {
        const size = stat.size;
        const gzipSize = getGzipSize(itemPath);
        const relativePath = `${prefix}${item}`;
        
        results.totalSize += gzipSize;
        
        // Categorize by file type
        if (item.endsWith('.js')) {
          results.jsSize += gzipSize;
          results.chunks.push({
            name: relativePath,
            size: gzipSize,
            type: 'js',
          });
        } else if (item.endsWith('.css')) {
          results.cssSize += gzipSize;
          results.chunks.push({
            name: relativePath,
            size: gzipSize,
            type: 'css',
          });
        } else if (item.match(/\.(png|jpg|jpeg|gif|svg|webp|avif)$/i)) {
          results.imageSize += gzipSize;
          results.chunks.push({
            name: relativePath,
            size: gzipSize,
            type: 'image',
          });
        }
        
        // Check individual chunk size
        if (gzipSize > BUDGETS.maxChunkSize && item.match(/\.(js|css)$/)) {
          results.violations.push({
            type: 'chunk-size',
            file: relativePath,
            size: gzipSize,
            budget: BUDGETS.maxChunkSize,
          });
        }
      }
    }
  }

  analyzeDirectory(path.join(distPath, 'assets'));

  // Check budgets
  if (results.totalSize > BUDGETS.maxTotalSize) {
    results.violations.push({
      type: 'total-size',
      size: results.totalSize,
      budget: BUDGETS.maxTotalSize,
    });
  }

  if (results.jsSize > BUDGETS.maxJSSize) {
    results.violations.push({
      type: 'js-size',
      size: results.jsSize,
      budget: BUDGETS.maxJSSize,
    });
  }

  if (results.cssSize > BUDGETS.maxCSSSize) {
    results.violations.push({
      type: 'css-size',
      size: results.cssSize,
      budget: BUDGETS.maxCSSSize,
    });
  }

  if (results.imageSize > BUDGETS.maxImageSize) {
    results.violations.push({
      type: 'image-size',
      size: results.imageSize,
      budget: BUDGETS.maxImageSize,
    });
  }

  // Display results
  console.log(`${colors.bold}📦 Bundle Summary (Gzipped):${colors.reset}`);
  console.log(`  Total Size: ${formatBytes(results.totalSize)} / ${formatBytes(BUDGETS.maxTotalSize)} ${results.totalSize <= BUDGETS.maxTotalSize ? colors.green + '✅' : colors.red + '❌'}${colors.reset}`);
  console.log(`  JavaScript: ${formatBytes(results.jsSize)} / ${formatBytes(BUDGETS.maxJSSize)} ${results.jsSize <= BUDGETS.maxJSSize ? colors.green + '✅' : colors.red + '❌'}${colors.reset}`);
  console.log(`  CSS: ${formatBytes(results.cssSize)} / ${formatBytes(BUDGETS.maxCSSSize)} ${results.cssSize <= BUDGETS.maxCSSSize ? colors.green + '✅' : colors.red + '❌'}${colors.reset}`);
  console.log(`  Images: ${formatBytes(results.imageSize)} / ${formatBytes(BUDGETS.maxImageSize)} ${results.imageSize <= BUDGETS.maxImageSize ? colors.green + '✅' : colors.red + '❌'}${colors.reset}`);

  console.log(`\n${colors.bold}📁 Largest Chunks:${colors.reset}`);
  results.chunks
    .sort((a, b) => b.size - a.size)
    .slice(0, 10)
    .forEach(chunk => {
      const color = chunk.size > BUDGETS.maxChunkSize ? colors.red : colors.green;
      console.log(`  ${color}${chunk.name}: ${formatBytes(chunk.size)}${colors.reset}`);
    });

  // Display violations
  if (results.violations.length > 0) {
    console.log(`\n${colors.bold}${colors.red}⚠️  Budget Violations:${colors.reset}`);
    results.violations.forEach(violation => {
      switch (violation.type) {
        case 'total-size':
          console.log(`  ${colors.red}❌ Total bundle size exceeds budget: ${formatBytes(violation.size)} > ${formatBytes(violation.budget)}${colors.reset}`);
          break;
        case 'js-size':
          console.log(`  ${colors.red}❌ JavaScript size exceeds budget: ${formatBytes(violation.size)} > ${formatBytes(violation.budget)}${colors.reset}`);
          break;
        case 'css-size':
          console.log(`  ${colors.red}❌ CSS size exceeds budget: ${formatBytes(violation.size)} > ${formatBytes(violation.budget)}${colors.reset}`);
          break;
        case 'image-size':
          console.log(`  ${colors.red}❌ Image size exceeds budget: ${formatBytes(violation.size)} > ${formatBytes(violation.budget)}${colors.reset}`);
          break;
        case 'chunk-size':
          console.log(`  ${colors.red}❌ Chunk size exceeds budget: ${violation.file} (${formatBytes(violation.size)} > ${formatBytes(violation.budget)})${colors.reset}`);
          break;
      }
    });

    console.log(`\n${colors.bold}${colors.yellow}💡 Optimization Suggestions:${colors.reset}`);
    
    if (results.violations.some(v => v.type === 'total-size' || v.type === 'js-size')) {
      console.log(`  • Consider code splitting and lazy loading`);
      console.log(`  • Remove unused dependencies`);
      console.log(`  • Use dynamic imports for large libraries`);
    }
    
    if (results.violations.some(v => v.type === 'css-size')) {
      console.log(`  • Remove unused CSS`);
      console.log(`  • Use CSS-in-JS or CSS modules`);
      console.log(`  • Consider critical CSS inlining`);
    }
    
    if (results.violations.some(v => v.type === 'image-size')) {
      console.log(`  • Optimize images (WebP, AVIF formats)`);
      console.log(`  • Use responsive images`);
      console.log(`  • Consider lazy loading for images`);
    }
    
    if (results.violations.some(v => v.type === 'chunk-size')) {
      console.log(`  • Split large chunks into smaller ones`);
      console.log(`  • Review manual chunk configuration`);
    }

    console.log(`\n${colors.red}❌ Build failed due to budget violations${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bold}✅ All performance budgets met!${colors.reset}`);
    
    // Calculate performance score
    const totalScore = Math.round(
      (1 - results.totalSize / BUDGETS.maxTotalSize) * 100
    );
    
    console.log(`\n${colors.bold}🎯 Performance Score: ${totalScore}/100${colors.reset}`);
    
    if (totalScore >= 90) {
      console.log(`${colors.green}🚀 Excellent performance!${colors.reset}`);
    } else if (totalScore >= 70) {
      console.log(`${colors.yellow}⚡ Good performance, room for improvement${colors.reset}`);
    } else {
      console.log(`${colors.red}🐌 Performance needs attention${colors.reset}`);
    }
  }
}

// Run analysis
try {
  analyzeBundle();
} catch (error) {
  console.error(`${colors.red}❌ Bundle analysis failed:${colors.reset}`, error.message);
  process.exit(1);
}