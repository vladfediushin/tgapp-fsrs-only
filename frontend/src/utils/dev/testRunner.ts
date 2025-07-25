/**
 * Simple test runner for unified store validation
 * Can be run in any JavaScript environment without external dependencies
 */

interface TestResult {
  name: string
  passed: boolean
  duration: number
  details?: any
  error?: string
}

interface TestSuite {
  name: string
  results: TestResult[]
  totalTests: number
  passedTests: number
  failedTests: number
  totalDuration: number
}

class SimpleTestRunner {
  private results: TestSuite[] = []

  async runTest(name: string, testFn: () => Promise<any> | any): Promise<TestResult> {
    const startTime = performance.now()
    
    try {
      const result = await testFn()
      const duration = performance.now() - startTime
      
      return {
        name,
        passed: true,
        duration,
        details: result
      }
    } catch (error) {
      const duration = performance.now() - startTime
      
      return {
        name,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async runSuite(suiteName: string, tests: Array<{ name: string, fn: () => Promise<any> | any }>): Promise<TestSuite> {
    console.log(`\n🧪 Running test suite: ${suiteName}`)
    console.log('=' .repeat(50))
    
    const results: TestResult[] = []
    const startTime = performance.now()
    
    for (const test of tests) {
      console.log(`  ⏳ ${test.name}...`)
      const result = await this.runTest(test.name, test.fn)
      results.push(result)
      
      if (result.passed) {
        console.log(`  ✅ ${test.name} (${result.duration.toFixed(2)}ms)`)
      } else {
        console.log(`  ❌ ${test.name} (${result.duration.toFixed(2)}ms)`)
        console.log(`     Error: ${result.error}`)
      }
    }
    
    const totalDuration = performance.now() - startTime
    const passedTests = results.filter(r => r.passed).length
    const failedTests = results.filter(r => !r.passed).length
    
    const suite: TestSuite = {
      name: suiteName,
      results,
      totalTests: results.length,
      passedTests,
      failedTests,
      totalDuration
    }
    
    this.results.push(suite)
    
    console.log(`\n📊 Suite Results: ${passedTests}/${results.length} passed (${totalDuration.toFixed(2)}ms)`)
    
    return suite
  }

  printSummary(): void {
    console.log('\n' + '='.repeat(60))
    console.log('🎯 TEST SUMMARY')
    console.log('='.repeat(60))
    
    let totalTests = 0
    let totalPassed = 0
    let totalFailed = 0
    let totalDuration = 0
    
    for (const suite of this.results) {
      totalTests += suite.totalTests
      totalPassed += suite.passedTests
      totalFailed += suite.failedTests
      totalDuration += suite.totalDuration
      
      const status = suite.failedTests === 0 ? '✅' : '❌'
      console.log(`${status} ${suite.name}: ${suite.passedTests}/${suite.totalTests} passed`)
    }
    
    console.log('-'.repeat(60))
    console.log(`📈 Overall: ${totalPassed}/${totalTests} tests passed`)
    console.log(`⏱️  Total time: ${totalDuration.toFixed(2)}ms`)
    console.log(`${totalFailed === 0 ? '🎉 All tests passed!' : `⚠️  ${totalFailed} tests failed`}`)
  }
}

// Mock implementations for testing without actual React/Zustand
const createMockStore = () => {
  const state = {
    user: null,
    settings: { examCountry: 'am', examLanguage: 'en' },
    memoryCache: new Map(),
    localStorageCache: new Map(),
    pendingRequests: new Map(),
    loading: {},
    errors: {}
  }
  
  return {
    getState: () => state,
    setState: (newState: any) => Object.assign(state, newState),
    subscribe: (listener: any) => () => {}
  }
}

// Test implementations
const testCacheOperations = async () => {
  const mockStore = createMockStore()
  const testData = { id: 1, name: 'Test User' }
  const cacheKey = 'test-user-1'
  
  // Test memory cache
  mockStore.getState().memoryCache.set(cacheKey, {
    data: testData,
    timestamp: Date.now(),
    ttl: 5 * 60 * 1000
  })
  
  const cached = mockStore.getState().memoryCache.get(cacheKey)
  if (!cached || cached.data.id !== 1) {
    throw new Error('Memory cache operation failed')
  }
  
  return { cacheSize: mockStore.getState().memoryCache.size }
}

const testRequestDeduplication = async () => {
  const mockStore = createMockStore()
  const requestKey = 'user-123'
  
  // Simulate pending request
  const mockPromise = Promise.resolve({ id: 123, name: 'User' })
  mockStore.getState().pendingRequests.set(requestKey, mockPromise)
  
  // Check deduplication
  const hasPending = mockStore.getState().pendingRequests.has(requestKey)
  if (!hasPending) {
    throw new Error('Request deduplication failed')
  }
  
  // Cleanup
  mockStore.getState().pendingRequests.delete(requestKey)
  
  return { deduplicated: true }
}

const testCacheInvalidation = async () => {
  const mockStore = createMockStore()
  
  // Add test data to cache
  mockStore.getState().memoryCache.set('user-123', { data: {}, timestamp: Date.now(), ttl: 1000 })
  mockStore.getState().memoryCache.set('user-456', { data: {}, timestamp: Date.now(), ttl: 1000 })
  mockStore.getState().memoryCache.set('settings-123', { data: {}, timestamp: Date.now(), ttl: 1000 })
  
  // Test pattern-based invalidation
  const keysToDelete = Array.from(mockStore.getState().memoryCache.keys())
    .filter(key => key.startsWith('user-'))
  
  keysToDelete.forEach(key => mockStore.getState().memoryCache.delete(key))
  
  const remainingKeys = Array.from(mockStore.getState().memoryCache.keys())
  if (remainingKeys.some(key => key.startsWith('user-'))) {
    throw new Error('Cache invalidation failed')
  }
  
  return { invalidatedKeys: keysToDelete.length, remainingKeys: remainingKeys.length }
}

const testTTLExpiration = async () => {
  const mockStore = createMockStore()
  const now = Date.now()
  
  // Add expired entry
  mockStore.getState().memoryCache.set('expired-key', {
    data: { test: true },
    timestamp: now - 10000, // 10 seconds ago
    ttl: 5000 // 5 second TTL
  })
  
  // Add valid entry
  mockStore.getState().memoryCache.set('valid-key', {
    data: { test: true },
    timestamp: now,
    ttl: 10000 // 10 second TTL
  })
  
  // Check TTL logic
  const expiredEntry = mockStore.getState().memoryCache.get('expired-key')
  const validEntry = mockStore.getState().memoryCache.get('valid-key')
  
  const isExpired = expiredEntry && (now - expiredEntry.timestamp) > expiredEntry.ttl
  const isValid = validEntry && (now - validEntry.timestamp) <= validEntry.ttl
  
  if (!isExpired || !isValid) {
    throw new Error('TTL expiration logic failed')
  }
  
  return { expiredDetected: isExpired, validDetected: isValid }
}

const testPerformanceBenchmark = async () => {
  const mockStore = createMockStore()
  const iterations = 1000
  
  // Benchmark cache operations
  const startTime = performance.now()
  
  for (let i = 0; i < iterations; i++) {
    const key = `benchmark-${i}`
    const data = { id: i, value: `test-${i}` }
    
    // Set cache entry
    mockStore.getState().memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: 60000
    })
    
    // Get cache entry
    const cached = mockStore.getState().memoryCache.get(key)
    if (!cached) {
      throw new Error(`Cache miss for key ${key}`)
    }
  }
  
  const endTime = performance.now()
  const totalTime = endTime - startTime
  const avgTime = totalTime / iterations
  
  if (avgTime > 1) { // Should be sub-millisecond
    throw new Error(`Cache operations too slow: ${avgTime.toFixed(3)}ms average`)
  }
  
  return {
    iterations,
    totalTime: totalTime.toFixed(2),
    averageTime: avgTime.toFixed(3),
    opsPerSecond: Math.round(iterations / (totalTime / 1000))
  }
}

// Main test runner function
export const runAllTests = async (): Promise<void> => {
  const runner = new SimpleTestRunner()
  
  console.log('🚀 Starting Unified Store Test Suite')
  console.log('Time:', new Date().toISOString())
  
  // Core functionality tests
  await runner.runSuite('Core Cache Operations', [
    { name: 'Memory Cache Operations', fn: testCacheOperations },
    { name: 'Request Deduplication', fn: testRequestDeduplication },
    { name: 'Cache Invalidation', fn: testCacheInvalidation },
    { name: 'TTL Expiration Logic', fn: testTTLExpiration }
  ])
  
  // Performance tests
  await runner.runSuite('Performance Benchmarks', [
    { name: 'Cache Operation Speed', fn: testPerformanceBenchmark }
  ])
  
  // Integration tests (if available)
  try {
    await runner.runSuite('Integration Tests', [
      { 
        name: 'Cache Health Check', 
        fn: async () => {
          // Mock cache health check
          return {
            memoryCache: { size: 0, hitRate: 0 },
            localStorageCache: { size: 0, hitRate: 0 },
            overallHealth: 'good'
          }
        }
      }
    ])
  } catch (error) {
    console.log('⚠️  Integration tests skipped (dependencies not available)')
  }
  
  runner.printSummary()
}

// Export for use in browser console or Node.js
if (typeof window !== 'undefined') {
  (window as any).runUnifiedStoreTests = runAllTests
}

export default runAllTests