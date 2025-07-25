// Performance Testing and Benchmarking Tools
// Comprehensive testing suite for bundle optimization and loading performance

// ============================================================================
// Types and Interfaces
// ============================================================================

interface BenchmarkResult {
  name: string
  duration: number
  iterations: number
  averageTime: number
  minTime: number
  maxTime: number
  standardDeviation: number
  timestamp: number
}

interface LoadTestResult {
  resource: string
  loadTime: number
  size: number
  cached: boolean
  status: 'success' | 'error'
  error?: string
  timestamp: number
}

interface BundleAnalysis {
  totalSize: number
  chunkSizes: { [key: string]: number }
  duplicateModules: string[]
  unusedExports: string[]
  heaviestModules: Array<{ name: string; size: number }>
  compressionRatio: number
  treeShakingEffectiveness: number
}

interface PerformanceTestSuite {
  name: string
  tests: PerformanceTest[]
  results: TestSuiteResult[]
}

interface PerformanceTest {
  name: string
  description: string
  test: () => Promise<any> | any
  timeout?: number
  iterations?: number
}

interface TestSuiteResult {
  suiteName: string
  testResults: Array<{
    testName: string
    passed: boolean
    duration: number
    error?: string
    metrics?: any
  }>
  totalDuration: number
  passedTests: number
  failedTests: number
  timestamp: number
}

// ============================================================================
// Performance Benchmarking
// ============================================================================

class PerformanceBenchmark {
  private results: BenchmarkResult[] = []

  /**
   * Run a benchmark test with multiple iterations
   */
  async benchmark(
    name: string,
    testFn: () => Promise<any> | any,
    iterations = 100
  ): Promise<BenchmarkResult> {
    console.log(`[Benchmark] Starting ${name} (${iterations} iterations)`)
    
    const times: number[] = []
    
    // Warm up
    for (let i = 0; i < Math.min(10, iterations); i++) {
      await testFn()
    }
    
    // Actual benchmark
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      await testFn()
      const end = performance.now()
      times.push(end - start)
    }
    
    const totalTime = times.reduce((a, b) => a + b, 0)
    const averageTime = totalTime / iterations
    const minTime = Math.min(...times)
    const maxTime = Math.max(...times)
    
    // Calculate standard deviation
    const variance = times.reduce((acc, time) => {
      return acc + Math.pow(time - averageTime, 2)
    }, 0) / iterations
    const standardDeviation = Math.sqrt(variance)
    
    const result: BenchmarkResult = {
      name,
      duration: totalTime,
      iterations,
      averageTime,
      minTime,
      maxTime,
      standardDeviation,
      timestamp: Date.now()
    }
    
    this.results.push(result)
    
    console.log(`[Benchmark] ${name} completed:`, {
      average: `${averageTime.toFixed(2)}ms`,
      min: `${minTime.toFixed(2)}ms`,
      max: `${maxTime.toFixed(2)}ms`,
      stdDev: `${standardDeviation.toFixed(2)}ms`
    })
    
    return result
  }

  /**
   * Compare two benchmark results
   */
  compare(baseline: string, comparison: string): {
    improvement: number
    significantDifference: boolean
    recommendation: string
  } {
    const baselineResult = this.results.find(r => r.name === baseline)
    const comparisonResult = this.results.find(r => r.name === comparison)
    
    if (!baselineResult || !comparisonResult) {
      throw new Error('Benchmark results not found')
    }
    
    const improvement = ((baselineResult.averageTime - comparisonResult.averageTime) / baselineResult.averageTime) * 100
    const significantDifference = Math.abs(improvement) > 5 // 5% threshold
    
    let recommendation = ''
    if (improvement > 10) {
      recommendation = 'Significant performance improvement detected'
    } else if (improvement < -10) {
      recommendation = 'Performance regression detected - investigate'
    } else {
      recommendation = 'No significant performance difference'
    }
    
    return { improvement, significantDifference, recommendation }
  }

  getResults(): BenchmarkResult[] {
    return [...this.results]
  }

  clearResults(): void {
    this.results = []
  }
}

// ============================================================================
// Load Testing
// ============================================================================

class LoadTester {
  private results: LoadTestResult[] = []

  /**
   * Test loading performance of a resource
   */
  async testResourceLoad(url: string, useCache = false): Promise<LoadTestResult> {
    const startTime = performance.now()
    
    try {
      const response = await fetch(url, {
        cache: useCache ? 'default' : 'no-cache'
      })
      
      const endTime = performance.now()
      const loadTime = endTime - startTime
      
      const size = parseInt(response.headers.get('content-length') || '0')
      const cached = response.headers.get('x-cache') === 'HIT' ||
                    (response.headers.get('cache-control')?.includes('max-age') && useCache) || false
      
      const result: LoadTestResult = {
        resource: url,
        loadTime,
        size,
        cached,
        status: response.ok ? 'success' : 'error',
        timestamp: Date.now()
      }
      
      if (!response.ok) {
        result.error = `HTTP ${response.status}: ${response.statusText}`
      }
      
      this.results.push(result)
      return result
      
    } catch (error) {
      const endTime = performance.now()
      const result: LoadTestResult = {
        resource: url,
        loadTime: endTime - startTime,
        size: 0,
        cached: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      }
      
      this.results.push(result)
      return result
    }
  }

  /**
   * Test multiple resources concurrently
   */
  async testConcurrentLoads(urls: string[], maxConcurrency = 6): Promise<LoadTestResult[]> {
    const results: LoadTestResult[] = []
    
    for (let i = 0; i < urls.length; i += maxConcurrency) {
      const batch = urls.slice(i, i + maxConcurrency)
      const batchResults = await Promise.all(
        batch.map(url => this.testResourceLoad(url))
      )
      results.push(...batchResults)
    }
    
    return results
  }

  /**
   * Analyze load test results
   */
  analyzeResults(): {
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    averageLoadTime: number
    totalDataTransferred: number
    cacheHitRate: number
    slowestRequests: LoadTestResult[]
  } {
    const successful = this.results.filter(r => r.status === 'success')
    const failed = this.results.filter(r => r.status === 'error')
    const cached = this.results.filter(r => r.cached)
    
    const averageLoadTime = successful.length > 0 
      ? successful.reduce((sum, r) => sum + r.loadTime, 0) / successful.length 
      : 0
    
    const totalDataTransferred = successful.reduce((sum, r) => sum + r.size, 0)
    const cacheHitRate = this.results.length > 0 ? (cached.length / this.results.length) * 100 : 0
    
    const slowestRequests = [...this.results]
      .sort((a, b) => b.loadTime - a.loadTime)
      .slice(0, 5)
    
    return {
      totalRequests: this.results.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      averageLoadTime,
      totalDataTransferred,
      cacheHitRate,
      slowestRequests
    }
  }

  getResults(): LoadTestResult[] {
    return [...this.results]
  }

  clearResults(): void {
    this.results = []
  }
}

// ============================================================================
// Bundle Analysis
// ============================================================================

class BundleAnalyzer {
  /**
   * Analyze current bundle composition
   */
  async analyzeBundles(): Promise<BundleAnalysis> {
    const analysis: BundleAnalysis = {
      totalSize: 0,
      chunkSizes: {},
      duplicateModules: [],
      unusedExports: [],
      heaviestModules: [],
      compressionRatio: 0,
      treeShakingEffectiveness: 0
    }

    try {
      // Get all loaded scripts
      const scripts = Array.from(document.querySelectorAll('script[src]'))
      const loadTester = new LoadTester()
      
      for (const script of scripts) {
        const src = (script as HTMLScriptElement).src
        if (src && src.includes(window.location.origin)) {
          try {
            const result = await loadTester.testResourceLoad(src, true)
            if (result.status === 'success') {
              analysis.totalSize += result.size
              analysis.chunkSizes[src] = result.size
            }
          } catch (error) {
            console.warn(`[BundleAnalyzer] Failed to analyze ${src}:`, error)
          }
        }
      }
      
      // Analyze heaviest modules
      analysis.heaviestModules = Object.entries(analysis.chunkSizes)
        .map(([name, size]) => ({ name, size }))
        .sort((a, b) => b.size - a.size)
        .slice(0, 10)
      
      // Estimate compression ratio (simplified)
      const uncompressedEstimate = analysis.totalSize * 3 // Rough estimate
      analysis.compressionRatio = analysis.totalSize / uncompressedEstimate
      
      // Estimate tree shaking effectiveness (simplified)
      const vendorSize = Object.entries(analysis.chunkSizes)
        .filter(([name]) => name.includes('vendor') || name.includes('node_modules'))
        .reduce((sum, [, size]) => sum + size, 0)
      
      analysis.treeShakingEffectiveness = vendorSize > 0 
        ? Math.max(0, 1 - (vendorSize / (analysis.totalSize * 0.7))) 
        : 0.8
      
    } catch (error) {
      console.error('[BundleAnalyzer] Analysis failed:', error)
    }

    return analysis
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations(analysis: BundleAnalysis): string[] {
    const recommendations: string[] = []
    
    if (analysis.totalSize > 200 * 1024) { // 200KB
      recommendations.push('Bundle size exceeds 200KB - consider more aggressive code splitting')
    }
    
    if (analysis.compressionRatio > 0.4) {
      recommendations.push('Compression ratio is high - enable gzip/brotli compression')
    }
    
    if (analysis.treeShakingEffectiveness < 0.6) {
      recommendations.push('Tree shaking effectiveness is low - review unused imports')
    }
    
    const largeChunks = analysis.heaviestModules.filter(m => m.size > 50 * 1024)
    if (largeChunks.length > 0) {
      recommendations.push(`Large chunks detected: ${largeChunks.map(c => c.name).join(', ')}`)
    }
    
    if (analysis.duplicateModules.length > 0) {
      recommendations.push(`Duplicate modules found: ${analysis.duplicateModules.join(', ')}`)
    }
    
    return recommendations
  }
}

// ============================================================================
// Performance Test Suite
// ============================================================================

class PerformanceTestRunner {
  private suites: PerformanceTestSuite[] = []
  private results: TestSuiteResult[] = []

  /**
   * Add a test suite
   */
  addSuite(suite: PerformanceTestSuite): void {
    this.suites.push(suite)
  }

  /**
   * Run all test suites
   */
  async runAllSuites(): Promise<TestSuiteResult[]> {
    console.log('[PerformanceTest] Running all test suites')
    
    for (const suite of this.suites) {
      await this.runSuite(suite)
    }
    
    return this.results
  }

  /**
   * Run a specific test suite
   */
  async runSuite(suite: PerformanceTestSuite): Promise<TestSuiteResult> {
    console.log(`[PerformanceTest] Running suite: ${suite.name}`)
    const startTime = performance.now()
    
    const testResults: Array<{
      testName: string
      passed: boolean
      duration: number
      error?: string
      metrics?: any
    }> = []
    let passedTests = 0
    let failedTests = 0
    
    for (const test of suite.tests) {
      const testStart = performance.now()
      
      try {
        const timeout = test.timeout || 10000
        const testPromise = Promise.resolve(test.test())
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), timeout)
        )
        
        await Promise.race([testPromise, timeoutPromise])
        
        const testEnd = performance.now()
        testResults.push({
          testName: test.name,
          passed: true,
          duration: testEnd - testStart,
          metrics: {}
        })
        passedTests++
        
      } catch (error) {
        const testEnd = performance.now()
        testResults.push({
          testName: test.name,
          passed: false,
          duration: testEnd - testStart,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        failedTests++
      }
    }
    
    const endTime = performance.now()
    const result: TestSuiteResult = {
      suiteName: suite.name,
      testResults,
      totalDuration: endTime - startTime,
      passedTests,
      failedTests,
      timestamp: Date.now()
    }
    
    this.results.push(result)
    suite.results.push(result)
    
    console.log(`[PerformanceTest] Suite ${suite.name} completed: ${passedTests}/${suite.tests.length} passed`)
    
    return result
  }

  /**
   * Get test results
   */
  getResults(): TestSuiteResult[] {
    return [...this.results]
  }

  /**
   * Generate test report
   */
  generateReport(): string {
    let report = '# Performance Test Report\n\n'
    
    for (const result of this.results) {
      report += `## ${result.suiteName}\n`
      report += `- **Duration**: ${result.totalDuration.toFixed(2)}ms\n`
      report += `- **Passed**: ${result.passedTests}\n`
      report += `- **Failed**: ${result.failedTests}\n`
      report += `- **Success Rate**: ${((result.passedTests / (result.passedTests + result.failedTests)) * 100).toFixed(1)}%\n\n`
      
      if (result.failedTests > 0) {
        report += '### Failed Tests\n'
        result.testResults
          .filter(t => !t.passed)
          .forEach(t => {
            report += `- **${t.testName}**: ${t.error}\n`
          })
        report += '\n'
      }
    }
    
    return report
  }
}

// ============================================================================
// Predefined Test Suites
// ============================================================================

/**
 * Create bundle optimization test suite
 */
export const createBundleOptimizationSuite = (): PerformanceTestSuite => ({
  name: 'Bundle Optimization',
  tests: [
    {
      name: 'Initial Bundle Size',
      description: 'Test that initial bundle size is under 150KB',
      test: async () => {
        const analyzer = new BundleAnalyzer()
        const analysis = await analyzer.analyzeBundles()
        
        if (analysis.totalSize > 150 * 1024) {
          throw new Error(`Bundle size ${(analysis.totalSize / 1024).toFixed(1)}KB exceeds 150KB limit`)
        }
        
        return { bundleSize: analysis.totalSize }
      }
    },
    {
      name: 'Chunk Loading Performance',
      description: 'Test that chunks load within performance budget',
      test: async () => {
        const loadTester = new LoadTester()
        const scripts = Array.from(document.querySelectorAll('script[src]'))
          .map(s => (s as HTMLScriptElement).src)
          .filter(src => src.includes('chunk'))
        
        const results = await loadTester.testConcurrentLoads(scripts.slice(0, 5))
        const averageLoadTime = results.reduce((sum, r) => sum + r.loadTime, 0) / results.length
        
        if (averageLoadTime > 200) {
          throw new Error(`Average chunk load time ${averageLoadTime.toFixed(1)}ms exceeds 200ms budget`)
        }
        
        return { averageLoadTime, testedChunks: results.length }
      }
    },
    {
      name: 'Tree Shaking Effectiveness',
      description: 'Test that tree shaking is working effectively',
      test: async () => {
        const analyzer = new BundleAnalyzer()
        const analysis = await analyzer.analyzeBundles()
        
        if (analysis.treeShakingEffectiveness < 0.6) {
          throw new Error(`Tree shaking effectiveness ${(analysis.treeShakingEffectiveness * 100).toFixed(1)}% is below 60% threshold`)
        }
        
        return { effectiveness: analysis.treeShakingEffectiveness }
      }
    }
  ],
  results: []
})

/**
 * Create loading performance test suite
 */
export const createLoadingPerformanceSuite = (): PerformanceTestSuite => ({
  name: 'Loading Performance',
  tests: [
    {
      name: 'First Contentful Paint',
      description: 'Test that FCP is under 1.8 seconds',
      test: () => {
        return new Promise((resolve, reject) => {
          if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                if (entry.name === 'first-contentful-paint') {
                  observer.disconnect()
                  
                  if (entry.startTime > 1800) {
                    reject(new Error(`FCP ${entry.startTime.toFixed(1)}ms exceeds 1800ms budget`))
                  } else {
                    resolve({ fcp: entry.startTime })
                  }
                  return
                }
              }
            })
            
            observer.observe({ entryTypes: ['paint'] })
            
            // Timeout after 5 seconds
            setTimeout(() => {
              observer.disconnect()
              reject(new Error('FCP measurement timeout'))
            }, 5000)
          } else {
            reject(new Error('PerformanceObserver not supported'))
          }
        })
      },
      timeout: 6000
    },
    {
      name: 'Time to Interactive',
      description: 'Test that TTI is under 2.5 seconds',
      test: () => {
        return new Promise((resolve) => {
          const checkInteractive = () => {
            if (document.readyState === 'complete') {
              const tti = performance.now()
              if (tti > 2500) {
                throw new Error(`TTI ${tti.toFixed(1)}ms exceeds 2500ms budget`)
              }
              resolve({ tti })
            } else {
              setTimeout(checkInteractive, 100)
            }
          }
          checkInteractive()
        })
      }
    }
  ],
  results: []
})

// ============================================================================
// Global Instances and Utilities
// ============================================================================

const benchmark = new PerformanceBenchmark()
const loadTester = new LoadTester()
const bundleAnalyzer = new BundleAnalyzer()
const testRunner = new PerformanceTestRunner()

/**
 * Run comprehensive performance tests
 */
export const runPerformanceTests = async (): Promise<{
  bundleAnalysis: BundleAnalysis
  testResults: TestSuiteResult[]
  recommendations: string[]
}> => {
  console.log('[PerformanceTest] Starting comprehensive performance tests')
  
  // Add predefined test suites
  testRunner.addSuite(createBundleOptimizationSuite())
  testRunner.addSuite(createLoadingPerformanceSuite())
  
  // Run tests
  const testResults = await testRunner.runAllSuites()
  
  // Analyze bundles
  const bundleAnalysis = await bundleAnalyzer.analyzeBundles()
  
  // Generate recommendations
  const recommendations = bundleAnalyzer.generateRecommendations(bundleAnalysis)
  
  console.log('[PerformanceTest] Performance tests completed')
  
  return {
    bundleAnalysis,
    testResults,
    recommendations
  }
}

/**
 * Quick performance benchmark
 */
export const quickBenchmark = async (name: string, testFn: () => any): Promise<BenchmarkResult> => {
  return benchmark.benchmark(name, testFn, 10)
}

export {
  PerformanceBenchmark,
  LoadTester,
  BundleAnalyzer,
  PerformanceTestRunner,
  benchmark,
  loadTester,
  bundleAnalyzer,
  testRunner
}

export type {
  BenchmarkResult,
  LoadTestResult,
  BundleAnalysis,
  PerformanceTestSuite,
  TestSuiteResult
}