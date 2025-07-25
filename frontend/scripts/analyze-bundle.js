#!/usr/bin/env node

/**
 * Bundle Analysis Script
 * Analyzes the optimized bundle and compares with baseline
 */

const fs = require('fs');
const path = require('path');
const { gzipSync } = require('zlib');

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

// Baseline measurements (before optimization)
const BASELINE = {
  totalSize: 627979, // bytes (uncompressed)
  mainJS: 595150,
  css: 22539,
  ponyfill: 10290,
  gzippedEstimate: 150000 // estimated gzipped size
};

// Target reductions
const TARGETS = {
  totalReduction: 0.35, // 35% reduction target
  maxInitialBundle: 280 * 1024, // 280KB target
  maxChunkSize: 50 * 1024 // 50KB per chunk
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getGzipSize(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return gzipSync(content).length;
  } catch (error) {
    console.warn(`Could not gzip ${filePath}:`, error.message);
    return 0;
  }
}

function analyzeBundle() {
  const distPath = path.join(__dirname, '../dist');
  
  if (!fs.existsSync(distPath)) {
    console.error(`${colors.red}❌ Build directory not found: ${distPath}${colors.reset}`);
    console.log(`${colors.yellow}💡 Run 'npm run build' first${colors.reset}`);
    process.exit(1);
  }

  console.log(`${colors.bold}${colors.cyan}📊 Bundle Optimization Analysis${colors.reset}\n`);

  const results = {
    totalSize: 0,
    totalGzipped: 0,
    jsSize: 0,
    jsGzipped: 0,
    cssSize: 0,
    cssGzipped: 0,
    chunks: [],
    analysis: {
      initialBundle: 0,
      lazyChunks: 0,
      vendorChunks: 0,
      pageChunks: 0
    }
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
        
        results.totalSize += size;
        results.totalGzipped += gzipSize;
        
        const chunkInfo = {
          name: relativePath,
          size: size,
          gzipped: gzipSize,
          type: 'unknown'
        };

        // Categorize chunks
        if (item.endsWith('.js')) {
          results.jsSize += size;
          results.jsGzipped += gzipSize;
          chunkInfo.type = 'js';
          
          // Analyze chunk types based on naming
          if (item.includes('index-') || item.includes('main-')) {
            chunkInfo.category = 'initial';
            results.analysis.initialBundle += gzipSize;
          } else if (item.includes('vendor-') || item.includes('react-core')) {
            chunkInfo.category = 'vendor';
            results.analysis.vendorChunks += gzipSize;
          } else if (item.includes('page-')) {
            chunkInfo.category = 'page';
            results.analysis.pageChunks += gzipSize;
          } else {
            chunkInfo.category = 'lazy';
            results.analysis.lazyChunks += gzipSize;
          }
        } else if (item.endsWith('.css')) {
          results.cssSize += size;
          results.cssGzipped += gzipSize;
          chunkInfo.type = 'css';
          chunkInfo.category = 'style';
        }
        
        results.chunks.push(chunkInfo);
      }
    }
  }

  // Analyze the assets directory
  const assetsPath = path.join(distPath, 'assets');
  if (fs.existsSync(assetsPath)) {
    analyzeDirectory(assetsPath);
  }

  // Display results
  displayResults(results);
}

function displayResults(results) {
  // Baseline comparison
  console.log(`${colors.bold}📈 Size Comparison (Gzipped):${colors.reset}`);
  
  const totalReduction = ((BASELINE.gzippedEstimate - results.totalGzipped) / BASELINE.gzippedEstimate) * 100;
  const reductionColor = totalReduction >= 30 ? colors.green : totalReduction >= 20 ? colors.yellow : colors.red;
  
  console.log(`  Baseline:     ${formatBytes(BASELINE.gzippedEstimate)}`);
  console.log(`  Current:      ${formatBytes(results.totalGzipped)}`);
  console.log(`  Reduction:    ${reductionColor}${totalReduction.toFixed(1)}%${colors.reset}`);
  console.log(`  Target:       ${colors.cyan}35%${colors.reset}`);

  // Bundle breakdown
  console.log(`\n${colors.bold}📦 Bundle Breakdown (Gzipped):${colors.reset}`);
  console.log(`  JavaScript:   ${formatBytes(results.jsGzipped)} (${((results.jsGzipped / results.totalGzipped) * 100).toFixed(1)}%)`);
  console.log(`  CSS:          ${formatBytes(results.cssGzipped)} (${((results.cssGzipped / results.totalGzipped) * 100).toFixed(1)}%)`);
  console.log(`  Total:        ${formatBytes(results.totalGzipped)}`);

  // Chunk analysis
  console.log(`\n${colors.bold}🧩 Chunk Analysis:${colors.reset}`);
  console.log(`  Initial Bundle: ${formatBytes(results.analysis.initialBundle)}`);
  console.log(`  Vendor Chunks:  ${formatBytes(results.analysis.vendorChunks)}`);
  console.log(`  Page Chunks:    ${formatBytes(results.analysis.pageChunks)}`);
  console.log(`  Lazy Chunks:    ${formatBytes(results.analysis.lazyChunks)}`);

  // Largest chunks
  console.log(`\n${colors.bold}📁 Largest Chunks:${colors.reset}`);
  results.chunks
    .sort((a, b) => b.gzipped - a.gzipped)
    .slice(0, 10)
    .forEach(chunk => {
      const sizeColor = chunk.gzipped > TARGETS.maxChunkSize ? colors.red : colors.green;
      const categoryIcon = {
        initial: '🚀',
        vendor: '📦',
        page: '📄',
        lazy: '⏳',
        style: '🎨'
      }[chunk.category] || '📄';
      
      console.log(`  ${categoryIcon} ${chunk.name}: ${sizeColor}${formatBytes(chunk.gzipped)}${colors.reset}`);
    });

  // Performance assessment
  console.log(`\n${colors.bold}⚡ Performance Assessment:${colors.reset}`);
  
  const assessments = [];
  
  // Initial bundle size
  if (results.analysis.initialBundle <= TARGETS.maxInitialBundle) {
    assessments.push(`${colors.green}✅ Initial bundle size: ${formatBytes(results.analysis.initialBundle)} (target: ${formatBytes(TARGETS.maxInitialBundle)})${colors.reset}`);
  } else {
    assessments.push(`${colors.red}❌ Initial bundle too large: ${formatBytes(results.analysis.initialBundle)} (target: ${formatBytes(TARGETS.maxInitialBundle)})${colors.reset}`);
  }
  
  // Total reduction
  if (totalReduction >= TARGETS.totalReduction * 100) {
    assessments.push(`${colors.green}✅ Size reduction: ${totalReduction.toFixed(1)}% (target: ${(TARGETS.totalReduction * 100).toFixed(0)}%)${colors.reset}`);
  } else {
    assessments.push(`${colors.yellow}⚠️  Size reduction: ${totalReduction.toFixed(1)}% (target: ${(TARGETS.totalReduction * 100).toFixed(0)}%)${colors.reset}`);
  }
  
  // Chunk splitting
  const chunkCount = results.chunks.filter(c => c.type === 'js').length;
  if (chunkCount >= 5) {
    assessments.push(`${colors.green}✅ Code splitting: ${chunkCount} JS chunks${colors.reset}`);
  } else {
    assessments.push(`${colors.yellow}⚠️  Limited code splitting: ${chunkCount} JS chunks${colors.reset}`);
  }
  
  assessments.forEach(assessment => console.log(`  ${assessment}`));

  // Recommendations
  console.log(`\n${colors.bold}💡 Optimization Recommendations:${colors.reset}`);
  
  const recommendations = [];
  
  if (results.analysis.initialBundle > TARGETS.maxInitialBundle) {
    recommendations.push('Consider further code splitting of the initial bundle');
  }
  
  if (totalReduction < 30) {
    recommendations.push('Implement additional tree shaking optimizations');
  }
  
  const largeChunks = results.chunks.filter(c => c.gzipped > TARGETS.maxChunkSize);
  if (largeChunks.length > 0) {
    recommendations.push(`Split ${largeChunks.length} large chunks (>${formatBytes(TARGETS.maxChunkSize)})`);
  }
  
  if (results.analysis.vendorChunks > 100 * 1024) {
    recommendations.push('Consider splitting vendor libraries further');
  }
  
  if (recommendations.length === 0) {
    console.log(`  ${colors.green}🎉 Bundle is well optimized!${colors.reset}`);
  } else {
    recommendations.forEach(rec => console.log(`  • ${rec}`));
  }

  // Summary
  const overallScore = calculateOptimizationScore(results, totalReduction);
  const scoreColor = overallScore >= 90 ? colors.green : overallScore >= 70 ? colors.yellow : colors.red;
  
  console.log(`\n${colors.bold}🎯 Optimization Score: ${scoreColor}${overallScore}/100${colors.reset}`);
  
  if (overallScore >= 90) {
    console.log(`${colors.green}🚀 Excellent optimization!${colors.reset}`);
  } else if (overallScore >= 70) {
    console.log(`${colors.yellow}⚡ Good optimization, room for improvement${colors.reset}`);
  } else {
    console.log(`${colors.red}🔧 Needs more optimization work${colors.reset}`);
  }
}

function calculateOptimizationScore(results, totalReduction) {
  let score = 0;
  
  // Size reduction (40 points)
  score += Math.min(40, (totalReduction / 35) * 40);
  
  // Initial bundle size (30 points)
  const initialRatio = Math.min(1, TARGETS.maxInitialBundle / results.analysis.initialBundle);
  score += initialRatio * 30;
  
  // Code splitting (20 points)
  const chunkCount = results.chunks.filter(c => c.type === 'js').length;
  score += Math.min(20, (chunkCount / 8) * 20);
  
  // Chunk size distribution (10 points)
  const largeChunks = results.chunks.filter(c => c.gzipped > TARGETS.maxChunkSize).length;
  const totalChunks = results.chunks.filter(c => c.type === 'js').length;
  const goodChunkRatio = Math.max(0, 1 - (largeChunks / totalChunks));
  score += goodChunkRatio * 10;
  
  return Math.round(score);
}

// Run analysis
try {
  analyzeBundle();
} catch (error) {
  console.error(`${colors.red}❌ Bundle analysis failed:${colors.reset}`, error.message);
  process.exit(1);
}