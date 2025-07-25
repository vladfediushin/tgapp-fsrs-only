// Service Worker Consolidation Test
// Tests the consolidated service worker functionality

import { 
  initializeServiceWorker,
  getServiceWorkerManager,
  useServiceWorker,
  usePWAInstall,
  useServiceWorkerDebug,
  isServiceWorkerSupported,
  isPWAInstalled,
  canInstallPWA,
  ServiceWorkerConfig,
  ServiceWorkerState,
  PWAInstallState
} from './serviceWorker'

// Test configuration
const testConfig: ServiceWorkerConfig = {
  swUrl: '/sw.js',
  scope: '/',
  enableAutoUpdate: true,
  enableBackgroundSync: true,
  enableDebug: true
}

// ============================================================================
// Core Functionality Tests
// ============================================================================

export const testServiceWorkerConsolidation = async (): Promise<{
  success: boolean
  results: Array<{ test: string; passed: boolean; error?: string }>
}> => {
  const results: Array<{ test: string; passed: boolean; error?: string }> = []

  // Test 1: Service Worker Support Detection
  try {
    const isSupported = isServiceWorkerSupported()
    results.push({
      test: 'Service Worker Support Detection',
      passed: typeof isSupported === 'boolean'
    })
  } catch (error) {
    results.push({
      test: 'Service Worker Support Detection',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Test 2: Manager Initialization
  try {
    const manager = initializeServiceWorker(testConfig)
    const isInitialized = manager !== null && typeof manager.register === 'function'
    results.push({
      test: 'Manager Initialization',
      passed: isInitialized
    })
  } catch (error) {
    results.push({
      test: 'Manager Initialization',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Test 3: State Management
  try {
    const manager = getServiceWorkerManager()
    if (manager) {
      const state = manager.getState()
      const hasRequiredProperties = 
        typeof state.isSupported === 'boolean' &&
        typeof state.isRegistered === 'boolean' &&
        typeof state.isActive === 'boolean'
      
      results.push({
        test: 'State Management',
        passed: hasRequiredProperties
      })
    } else {
      results.push({
        test: 'State Management',
        passed: false,
        error: 'Manager not initialized'
      })
    }
  } catch (error) {
    results.push({
      test: 'State Management',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Test 4: PWA Install State
  try {
    const manager = getServiceWorkerManager()
    if (manager) {
      const installState = manager.getInstallState()
      const hasRequiredProperties = 
        typeof installState.canInstall === 'boolean' &&
        typeof installState.isInstalled === 'boolean' &&
        typeof installState.isStandalone === 'boolean' &&
        typeof installState.platform === 'string'
      
      results.push({
        test: 'PWA Install State',
        passed: hasRequiredProperties
      })
    } else {
      results.push({
        test: 'PWA Install State',
        passed: false,
        error: 'Manager not initialized'
      })
    }
  } catch (error) {
    results.push({
      test: 'PWA Install State',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Test 5: Event System
  try {
    const manager = getServiceWorkerManager()
    if (manager) {
      let eventReceived = false
      const unsubscribe = manager.on('test-event', () => {
        eventReceived = true
      })
      
      // Simulate event emission (this would normally be internal)
      manager['emit']('test-event', { test: true })
      
      unsubscribe()
      
      results.push({
        test: 'Event System',
        passed: eventReceived
      })
    } else {
      results.push({
        test: 'Event System',
        passed: false,
        error: 'Manager not initialized'
      })
    }
  } catch (error) {
    results.push({
      test: 'Event System',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Test 6: Background Sync API
  try {
    const manager = getServiceWorkerManager()
    if (manager) {
      // Test that the method exists and doesn't throw
      await manager.registerBackgroundSync('test-sync')
      results.push({
        test: 'Background Sync API',
        passed: true
      })
    } else {
      results.push({
        test: 'Background Sync API',
        passed: false,
        error: 'Manager not initialized'
      })
    }
  } catch (error) {
    results.push({
      test: 'Background Sync API',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Test 7: Cache Management API
  try {
    const manager = getServiceWorkerManager()
    if (manager) {
      // Test that cache methods exist and don't throw
      await manager.getCacheStatus()
      await manager.cacheUrls(['/test-url'])
      results.push({
        test: 'Cache Management API',
        passed: true
      })
    } else {
      results.push({
        test: 'Cache Management API',
        passed: false,
        error: 'Manager not initialized'
      })
    }
  } catch (error) {
    results.push({
      test: 'Cache Management API',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Test 8: Debug Features (Development Only)
  try {
    const manager = getServiceWorkerManager()
    if (manager && process.env.NODE_ENV === 'development') {
      const debugInfo = await manager.getDebugInfo()
      const debugMetrics = manager.getDebugMetrics()
      
      const hasDebugFeatures = debugInfo !== null && debugMetrics !== null
      results.push({
        test: 'Debug Features (Development)',
        passed: hasDebugFeatures
      })
    } else {
      results.push({
        test: 'Debug Features (Development)',
        passed: true, // Pass if not in development or manager not available
        error: 'Debug features disabled in production (expected)'
      })
    }
  } catch (error) {
    results.push({
      test: 'Debug Features (Development)',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Test 9: Utility Functions
  try {
    const pwaInstalled = isPWAInstalled()
    const canInstall = canInstallPWA()
    
    const utilitiesWork = 
      typeof pwaInstalled === 'boolean' &&
      typeof canInstall === 'boolean'
    
    results.push({
      test: 'Utility Functions',
      passed: utilitiesWork
    })
  } catch (error) {
    results.push({
      test: 'Utility Functions',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Calculate overall success
  const passedTests = results.filter(r => r.passed).length
  const totalTests = results.length
  const success = passedTests === totalTests

  return {
    success,
    results
  }
}

// ============================================================================
// API Compatibility Tests
// ============================================================================

export const testAPICompatibility = (): {
  success: boolean
  results: Array<{ test: string; passed: boolean; error?: string }>
} => {
  const results: Array<{ test: string; passed: boolean; error?: string }> = []

  // Test backward compatibility imports
  try {
    // These should all be available from the main serviceWorker.ts file
    const compatibilityTests = [
      { name: 'initializeServiceWorker', fn: initializeServiceWorker },
      { name: 'getServiceWorkerManager', fn: getServiceWorkerManager },
      { name: 'isServiceWorkerSupported', fn: isServiceWorkerSupported },
      { name: 'isPWAInstalled', fn: isPWAInstalled },
      { name: 'canInstallPWA', fn: canInstallPWA }
    ]

    for (const test of compatibilityTests) {
      results.push({
        test: `API Compatibility: ${test.name}`,
        passed: typeof test.fn === 'function'
      })
    }
  } catch (error) {
    results.push({
      test: 'API Compatibility Check',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  const passedTests = results.filter(r => r.passed).length
  const totalTests = results.length
  const success = passedTests === totalTests

  return {
    success,
    results
  }
}

// ============================================================================
// Test Runner
// ============================================================================

export const runAllTests = async (): Promise<{
  consolidationTests: Awaited<ReturnType<typeof testServiceWorkerConsolidation>>
  compatibilityTests: ReturnType<typeof testAPICompatibility>
  overallSuccess: boolean
}> => {
  console.log('🧪 Running Service Worker Consolidation Tests...')
  
  const consolidationTests = await testServiceWorkerConsolidation()
  const compatibilityTests = testAPICompatibility()
  
  const overallSuccess = consolidationTests.success && compatibilityTests.success

  // Log results
  console.log('\n📊 Test Results:')
  console.log('================')
  
  console.log('\n🔧 Consolidation Tests:')
  consolidationTests.results.forEach(result => {
    const status = result.passed ? '✅' : '❌'
    console.log(`${status} ${result.test}`)
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
  })
  
  console.log('\n🔄 Compatibility Tests:')
  compatibilityTests.results.forEach(result => {
    const status = result.passed ? '✅' : '❌'
    console.log(`${status} ${result.test}`)
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
  })
  
  console.log(`\n🎯 Overall Result: ${overallSuccess ? '✅ PASSED' : '❌ FAILED'}`)
  console.log(`Consolidation: ${consolidationTests.results.filter(r => r.passed).length}/${consolidationTests.results.length}`)
  console.log(`Compatibility: ${compatibilityTests.results.filter(r => r.passed).length}/${compatibilityTests.results.length}`)

  return {
    consolidationTests,
    compatibilityTests,
    overallSuccess
  }
}

// Export for console testing
if (typeof window !== 'undefined') {
  (window as any).testServiceWorker = runAllTests
  console.log('🔧 Service Worker tests available at window.testServiceWorker()')
}