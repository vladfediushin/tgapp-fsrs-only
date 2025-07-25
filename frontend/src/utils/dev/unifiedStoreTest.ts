// Unified Store Integration Test Suite
import { useUnifiedStore, useUnifiedActions } from '../../store/unified'
import { cacheMonitor } from '../cacheMonitor'

export interface TestResult {
  testName: string
  passed: boolean
  duration: number
  details: string
  error?: string
}

export interface TestSuite {
  name: string
  results: TestResult[]
  totalTests: number
  passedTests: number
  failedTests: number
  totalDuration: number
}

class UnifiedStoreTestRunner {
  private results: TestResult[] = []

  async runTest(testName: string, testFn: () => Promise<void>): Promise<TestResult> {
    const startTime = Date.now()
    
    try {
      await testFn()
      const duration = Date.now() - startTime
      const result: TestResult = {
        testName,
        passed: true,
        duration,
        details: `Test completed successfully in ${duration}ms`
      }
      this.results.push(result)
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      const result: TestResult = {
        testName,
        passed: false,
        duration,
        details: `Test failed after ${duration}ms`,
        error: error instanceof Error ? error.message : String(error)
      }
      this.results.push(result)
      return result
    }
  }

  async runAllTests(): Promise<TestSuite> {
    console.log('🧪 Starting Unified Store Test Suite')
    this.results = []
    const suiteStartTime = Date.now()

    // Test 1: Cache Layer Functionality
    await this.runTest('Cache Layer Basic Operations', async () => {
      const store = useUnifiedStore.getState()
      
      // Test memory cache
      store.setCachedData('test-key', { data: 'test-value' }, 5000)
      const cached = store.getCachedData('test-key')
      
      if (!cached || (cached as any).data !== 'test-value') {
        throw new Error('Memory cache failed to store/retrieve data')
      }
      
      // Test cache invalidation
      store.invalidateCache('test-key')
      const invalidated = store.getCachedData('test-key')
      
      if (invalidated !== null) {
        throw new Error('Cache invalidation failed')
      }
    })

    // Test 2: Request Deduplication
    await this.runTest('Request Deduplication', async () => {
      const actions = useUnifiedActions()
      
      // Simulate multiple simultaneous requests
      const promises = [
        actions.executeWithDeduplication('test-dedup', () => 
          new Promise(resolve => setTimeout(() => resolve('result'), 100))
        ),
        actions.executeWithDeduplication('test-dedup', () => 
          new Promise(resolve => setTimeout(() => resolve('result'), 100))
        ),
        actions.executeWithDeduplication('test-dedup', () => 
          new Promise(resolve => setTimeout(() => resolve('result'), 100))
        )
      ]
      
      const results = await Promise.all(promises)
      
      // All should return the same result
      if (!results.every(r => r === 'result')) {
        throw new Error('Request deduplication failed - different results returned')
      }
    })

    // Test 3: Settings Management
    await this.runTest('Settings Management', async () => {
      const actions = useUnifiedActions()
      const store = useUnifiedStore.getState()
      
      const originalCountry = store.settings.examCountry
      
      // Update settings
      actions.updateSettings({ examCountry: 'test-country' })
      
      const updatedStore = useUnifiedStore.getState()
      if (updatedStore.settings.examCountry !== 'test-country') {
        throw new Error('Settings update failed')
      }
      
      // Restore original settings
      actions.updateSettings({ examCountry: originalCountry })
    })

    // Test 4: Cache Metrics
    await this.runTest('Cache Metrics Tracking', async () => {
      const store = useUnifiedStore.getState()
      const initialMetrics = store.getCacheMetrics()
      
      // Perform cache operations
      store.setCachedData('metrics-test', { value: 1 })
      store.getCachedData('metrics-test') // Hit
      store.getCachedData('non-existent') // Miss
      
      const finalMetrics = store.getCacheMetrics()
      
      if (finalMetrics.requests <= initialMetrics.requests) {
        throw new Error('Cache metrics not tracking requests properly')
      }
      
      if (finalMetrics.hits <= initialMetrics.hits) {
        throw new Error('Cache metrics not tracking hits properly')
      }
    })

    // Test 5: Error Handling
    await this.runTest('Error Handling', async () => {
      const actions = useUnifiedActions()
      
      try {
        // This should fail gracefully
        await actions.loadUser(-1) // Invalid user ID
        throw new Error('Expected error was not thrown')
      } catch (error) {
        // Expected to fail - this is good
        if (error.message === 'Expected error was not thrown') {
          throw error
        }
        // Error was handled properly
      }
    })

    // Test 6: Cache TTL (Time To Live)
    await this.runTest('Cache TTL Functionality', async () => {
      const store = useUnifiedStore.getState()
      
      // Set cache with very short TTL
      store.setCachedData('ttl-test', { value: 'expires-soon' }, 50) // 50ms TTL
      
      // Should be available immediately
      let cached = store.getCachedData('ttl-test')
      if (!cached || (cached as any).value !== 'expires-soon') {
        throw new Error('Cache with TTL not stored properly')
      }
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Should be expired now
      cached = store.getCachedData('ttl-test')
      if (cached !== null) {
        throw new Error('Cache TTL not working - expired data still available')
      }
    })

    // Test 7: Performance Benchmark
    await this.runTest('Performance Benchmark', async () => {
      const store = useUnifiedStore.getState()
      const iterations = 1000
      
      // Benchmark cache operations
      const startTime = Date.now()
      
      for (let i = 0; i < iterations; i++) {
        store.setCachedData(`perf-test-${i}`, { index: i })
        store.getCachedData(`perf-test-${i}`)
      }
      
      const duration = Date.now() - startTime
      const opsPerSecond = (iterations * 2) / (duration / 1000) // 2 ops per iteration
      
      if (opsPerSecond < 1000) { // Should handle at least 1000 ops/sec
        throw new Error(`Performance too slow: ${opsPerSecond.toFixed(0)} ops/sec`)
      }
      
      console.log(`📊 Performance: ${opsPerSecond.toFixed(0)} cache operations/second`)
    })

    const totalDuration = Date.now() - suiteStartTime
    const passedTests = this.results.filter(r => r.passed).length
    const failedTests = this.results.filter(r => !r.passed).length

    const suite: TestSuite = {
      name: 'Unified Store Integration Tests',
      results: this.results,
      totalTests: this.results.length,
      passedTests,
      failedTests,
      totalDuration
    }

    console.log(`✅ Test Suite Complete: ${passedTests}/${suite.totalTests} passed in ${totalDuration}ms`)
    
    if (failedTests > 0) {
      console.error(`❌ ${failedTests} tests failed:`)
      this.results.filter(r => !r.passed).forEach(result => {
        console.error(`  - ${result.testName}: ${result.error}`)
      })
    }

    return suite
  }

  getResults(): TestResult[] {
    return this.results
  }
}

// Performance monitoring utilities
export const measureCachePerformance = async (operations: number = 1000): Promise<{
  cacheHitTime: number
  cacheMissTime: number
  apiSimulationTime: number
  cacheEfficiency: number
}> => {
  const store = useUnifiedStore.getState()
  
  // Measure cache hits
  store.setCachedData('perf-hit-test', { data: 'cached-value' })
  const hitStartTime = Date.now()
  for (let i = 0; i < operations; i++) {
    store.getCachedData('perf-hit-test')
  }
  const cacheHitTime = Date.now() - hitStartTime

  // Measure cache misses
  const missStartTime = Date.now()
  for (let i = 0; i < operations; i++) {
    store.getCachedData(`perf-miss-test-${i}`)
  }
  const cacheMissTime = Date.now() - missStartTime

  // Simulate API calls
  const apiStartTime = Date.now()
  for (let i = 0; i < operations; i++) {
    await new Promise(resolve => setTimeout(resolve, 1)) // 1ms simulated API delay
  }
  const apiSimulationTime = Date.now() - apiStartTime

  const cacheEfficiency = ((apiSimulationTime - cacheHitTime) / apiSimulationTime) * 100

  return {
    cacheHitTime,
    cacheMissTime,
    apiSimulationTime,
    cacheEfficiency
  }
}

// API call reduction measurement
export const measureAPICallReduction = (): {
  totalRequests: number
  cacheHits: number
  apiCallsSaved: number
  reductionPercentage: number
} => {
  const metrics = cacheMonitor.getStatistics()
  const apiCallsSaved = metrics.cacheHits
  const totalPotentialCalls = metrics.totalRequests
  const reductionPercentage = totalPotentialCalls > 0 
    ? (apiCallsSaved / totalPotentialCalls) * 100 
    : 0

  return {
    totalRequests: metrics.totalRequests,
    cacheHits: metrics.cacheHits,
    apiCallsSaved,
    reductionPercentage
  }
}

// Export test runner instance
export const testRunner = new UnifiedStoreTestRunner()

// Auto-run tests in development
export const runDevelopmentTests = async () => {
  console.log('🔧 Running development tests for unified store...')
  const results = await testRunner.runAllTests()
  
  // Log performance metrics
  const performance = await measureCachePerformance(100)
  console.log('📈 Cache Performance Metrics:', performance)
  
  const apiReduction = measureAPICallReduction()
  console.log('📉 API Call Reduction:', apiReduction)
  
  return results
}