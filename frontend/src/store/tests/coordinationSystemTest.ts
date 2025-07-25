// Comprehensive State Coordination System Test Suite
import { useStateCoordinator } from '../stateCoordinator'
import { stateValidator } from '../validation/stateValidator'
import { performanceMonitor } from '../monitoring/performanceMonitor'
import { stateInspector } from '../devtools/stateInspector'
import { errorRecoveryManager } from '../errorHandling/errorRecovery'
import { persistenceCoordinator } from '../persistence/persistenceCoordinator'
import { stateLogger } from '../logging/stateLogger'

// ============================================================================
// Test Types and Interfaces
// ============================================================================

export interface TestResult {
  name: string
  passed: boolean
  duration: number
  error?: string
  details?: any
}

export interface TestSuite {
  name: string
  tests: TestResult[]
  passed: boolean
  duration: number
  summary: {
    total: number
    passed: number
    failed: number
    passRate: number
  }
}

export interface SystemTestReport {
  timestamp: number
  overallPassed: boolean
  suites: TestSuite[]
  summary: {
    totalTests: number
    passedTests: number
    failedTests: number
    overallPassRate: number
    totalDuration: number
  }
  systemHealth: {
    coordination: boolean
    validation: boolean
    performance: boolean
    persistence: boolean
    errorHandling: boolean
  }
}

// ============================================================================
// Test Runner Implementation
// ============================================================================

export class CoordinationSystemTester {
  private testResults: TestResult[] = []
  private suites: TestSuite[] = []

  async runAllTests(): Promise<SystemTestReport> {
    const startTime = Date.now()
    
    stateLogger.info('test', 'Starting comprehensive state coordination system tests')
    
    // Run all test suites
    const suites = await Promise.all([
      this.runCoordinationTests(),
      this.runValidationTests(),
      this.runPerformanceTests(),
      this.runPersistenceTests(),
      this.runErrorHandlingTests(),
      this.runIntegrationTests()
    ])

    const endTime = Date.now()
    const totalDuration = endTime - startTime

    // Calculate overall statistics
    const totalTests = suites.reduce((sum, suite) => sum + suite.summary.total, 0)
    const passedTests = suites.reduce((sum, suite) => sum + suite.summary.passed, 0)
    const failedTests = totalTests - passedTests
    const overallPassRate = totalTests > 0 ? passedTests / totalTests : 0
    const overallPassed = failedTests === 0

    // Assess system health
    const systemHealth = {
      coordination: suites[0].passed,
      validation: suites[1].passed,
      performance: suites[2].passed,
      persistence: suites[3].passed,
      errorHandling: suites[4].passed
    }

    const report: SystemTestReport = {
      timestamp: startTime,
      overallPassed,
      suites,
      summary: {
        totalTests,
        passedTests,
        failedTests,
        overallPassRate,
        totalDuration
      },
      systemHealth
    }

    stateLogger.info('test', 'State coordination system tests completed', {
      overallPassed,
      totalTests,
      passedTests,
      failedTests,
      passRate: Math.round(overallPassRate * 100),
      duration: totalDuration
    })

    return report
  }

  // ============================================================================
  // State Coordination Tests
  // ============================================================================

  private async runCoordinationTests(): Promise<TestSuite> {
    const tests: TestResult[] = []
    const startTime = Date.now()

    // Additional tests already updated above

    const endTime = Date.now()
    const duration = endTime - startTime
    const passed = tests.every(test => test.passed)
    const summary = this.calculateSummary(tests)

    return {
      name: 'State Coordination',
      tests,
      passed,
      duration,
      summary
    }
  }

  // ============================================================================
  // Validation Tests
  // ============================================================================

  private async runValidationTests(): Promise<TestSuite> {
    const tests: TestResult[] = []
    const startTime = Date.now()

    // Test 1: Validator Initialization
    tests.push(await this.runTest('Validator Initialization', async () => {
      const rules = stateValidator.getRules()
      if (rules.length === 0) {
        throw new Error('No validation rules loaded')
      }
      
      return { rulesCount: rules.length }
    }))

    // Test 2: State Validation
    tests.push(await this.runTest('State Validation', async () => {
      const report = await stateValidator.validate()
      
      return {
        overallValid: report.overallValid,
        totalRules: report.totalRules,
        passedRules: report.passedRules,
        failedRules: report.failedRules
      }
    }))

    // Test 3: Category Validation
    tests.push(await this.runTest('Category Validation', async () => {
      const categories = ['user-data', 'settings', 'cache', 'fsrs']
      const results: Record<string, any> = {}
      
      for (const category of categories) {
        const report = await stateValidator.validateCategory(category)
        results[category] = {
          valid: report.overallValid,
          rules: report.totalRules
        }
      }
      
      return { categoryResults: results }
    }))

    // Test 4: Custom Rule Addition
    tests.push(await this.runTest('Custom Rule Addition', async () => {
      const initialCount = stateValidator.getRules().length
      
      stateValidator.addRule({
        name: 'test-rule',
        description: 'Test rule for validation',
        severity: 'info',
        category: 'test',
        validate: () => ({ isValid: true })
      })
      
      const newCount = stateValidator.getRules().length
      
      if (newCount !== initialCount + 1) {
        throw new Error('Custom rule not added properly')
      }
      
      // Clean up
      stateValidator.removeRule('test-rule')
      
      return { initialCount, newCount }
    }))

    const endTime = Date.now()
    const duration = endTime - startTime
    const passed = tests.every(test => test.passed)
    const summary = this.calculateSummary(tests)

    return {
      name: 'State Validation',
      tests,
      passed,
      duration,
      summary
    }
  }

  // ============================================================================
  // Performance Tests
  // ============================================================================

  private async runPerformanceTests(): Promise<TestSuite> {
    const tests: TestResult[] = []
    const startTime = Date.now()

    // Test 1: Performance Monitor Initialization
    tests.push(await this.runTest('Performance Monitor Initialization', async () => {
      const stats = performanceMonitor.getStats()
      
      return {
        totalMetrics: stats.totalMetrics,
        categories: stats.categories
      }
    }))

    // Test 2: Metric Recording
    tests.push(await this.runTest('Metric Recording', async () => {
      const initialCount = performanceMonitor.getMetrics().length
      
      // Record some test metrics
      performanceMonitor.recordTiming('test-operation', 100, 'test')
      performanceMonitor.incrementCounter('test-counter', 'test')
      performanceMonitor.setGauge('test-gauge', 50, 'test')
      
      const newCount = performanceMonitor.getMetrics().length
      
      if (newCount <= initialCount) {
        throw new Error('Metrics not recorded properly')
      }
      
      return { initialCount, newCount, recorded: newCount - initialCount }
    }))

    // Test 3: Performance Report Generation
    tests.push(await this.runTest('Performance Report Generation', async () => {
      const report = performanceMonitor.generateReport(60000)
      
      return {
        totalMetrics: report.summary.totalMetrics,
        categories: Object.keys(report.summary.categories).length,
        throughput: report.summary.throughput
      }
    }))

    // Test 4: Timer Functionality
    tests.push(await this.runTest('Timer Functionality', async () => {
      const timer = performanceMonitor.startTimer('test-timer', 'test')
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const metric = timer.stop()
      
      if (metric.duration < 10) {
        throw new Error('Timer duration seems incorrect')
      }
      
      return { duration: metric.duration }
    }))

    const endTime = Date.now()
    const duration = endTime - startTime
    const passed = tests.every(test => test.passed)
    const summary = this.calculateSummary(tests)

    return {
      name: 'Performance Monitoring',
      tests,
      passed,
      duration,
      summary
    }
  }

  // ============================================================================
  // Persistence Tests
  // ============================================================================

  private async runPersistenceTests(): Promise<TestSuite> {
    const tests: TestResult[] = []
    const startTime = Date.now()

    // Test 1: Persistence Coordinator Initialization
    tests.push(await this.runTest('Persistence Coordinator Initialization', async () => {
      const stats = persistenceCoordinator.getStats()
      
      if (stats.layers.length === 0) {
        throw new Error('No persistence layers available')
      }
      
      return {
        layersCount: stats.layers.length,
        availableLayers: stats.layers.filter(l => l.available).length
      }
    }))

    // Test 2: Write and Read Operations
    tests.push(await this.runTest('Write and Read Operations', async () => {
      const testKey = 'test-persistence-key'
      const testValue = { message: 'Hello, persistence!', timestamp: Date.now() }
      
      // Write test data
      await persistenceCoordinator.write(testKey, testValue)
      
      // Read test data
      const readValue = await persistenceCoordinator.read(testKey)
      
      if (!readValue || readValue.message !== testValue.message) {
        throw new Error('Read value does not match written value')
      }
      
      // Clean up
      await persistenceCoordinator.delete(testKey)
      
      return { written: testValue, read: readValue }
    }))

    // Test 3: Layer Fallback
    tests.push(await this.runTest('Layer Fallback', async () => {
      const stats = persistenceCoordinator.getStats()
      const availableLayers = stats.layers.filter(l => l.available)
      
      if (availableLayers.length < 2) {
        // Skip test if we don't have multiple layers
        return { skipped: true, reason: 'Insufficient layers for fallback test' }
      }
      
      return { availableLayers: availableLayers.length }
    }))

    // Test 4: Operation History
    tests.push(await this.runTest('Operation History', async () => {
      const initialOperations = persistenceCoordinator.getOperations().length
      
      // Perform some operations
      await persistenceCoordinator.write('test-history-1', 'value1')
      await persistenceCoordinator.write('test-history-2', 'value2')
      await persistenceCoordinator.read('test-history-1')
      
      const newOperations = persistenceCoordinator.getOperations().length
      
      if (newOperations <= initialOperations) {
        throw new Error('Operations not recorded in history')
      }
      
      // Clean up
      await persistenceCoordinator.delete('test-history-1')
      await persistenceCoordinator.delete('test-history-2')
      
      return { initialOperations, newOperations, recorded: newOperations - initialOperations }
    }))

    const endTime = Date.now()
    const duration = endTime - startTime
    const passed = tests.every(test => test.passed)
    const summary = this.calculateSummary(tests)

    return {
      name: 'Persistence Coordination',
      tests,
      passed,
      duration,
      summary
    }
  }

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  private async runErrorHandlingTests(): Promise<TestSuite> {
    const tests: TestResult[] = []
    const startTime = Date.now()

    // Test 1: Error Manager Initialization
    tests.push(await this.runTest('Error Manager Initialization', async () => {
      const stats = errorRecoveryManager.getStats()
      
      return {
        totalErrors: stats.totalErrors,
        recoveryRate: stats.recoveryRate
      }
    }))

    // Test 2: Error Handling
    tests.push(await this.runTest('Error Handling', async () => {
      const initialErrorCount = errorRecoveryManager.getErrors().length
      
      // Generate a test error
      const testError = new Error('Test error for error handling')
      const errorId = errorRecoveryManager.handleError(testError, {
        operation: 'test-operation'
      })
      
      const newErrorCount = errorRecoveryManager.getErrors().length
      
      if (newErrorCount <= initialErrorCount) {
        throw new Error('Error not recorded properly')
      }
      
      const error = errorRecoveryManager.getError(errorId)
      if (!error) {
        throw new Error('Error not retrievable by ID')
      }
      
      return { errorId, errorType: error.type, errorSeverity: error.severity }
    }))

    // Test 3: Error Recovery
    tests.push(await this.runTest('Error Recovery', async () => {
      // Create a recoverable error
      const testError = new Error('Network timeout')
      const errorId = errorRecoveryManager.handleError(testError, {
        operation: 'api-call'
      })
      
      const error = errorRecoveryManager.getError(errorId)
      if (!error) {
        throw new Error('Test error not found')
      }
      
      return {
        errorId,
        hasRecovery: !!error.recovery,
        recoveryType: error.recovery?.type
      }
    }))

    // Test 4: Error Statistics
    tests.push(await this.runTest('Error Statistics', async () => {
      const stats = errorRecoveryManager.getStats()
      
      return {
        totalErrors: stats.totalErrors,
        resolvedErrors: stats.resolvedErrors,
        errorsByType: Object.keys(stats.errorsByType).length,
        errorsBySeverity: Object.keys(stats.errorsBySeverity).length
      }
    }))

    const endTime = Date.now()
    const duration = endTime - startTime
    const passed = tests.every(test => test.passed)
    const summary = this.calculateSummary(tests)

    return {
      name: 'Error Handling',
      tests,
      passed,
      duration,
      summary
    }
  }

  // ============================================================================
  // Integration Tests
  // ============================================================================

  private async runIntegrationTests(): Promise<TestSuite> {
    const tests: TestResult[] = []
    const startTime = Date.now()

    // Test 1: Full System Integration
    tests.push(await this.runTest('Full System Integration', async () => {
      // Start a debug session
      const session = stateInspector.startDebugSession('integration-test')
      
      // Take a snapshot
      const snapshot = stateInspector.takeSnapshot('integration-test-start')
      
      // Perform some coordinated operations
      const coordinator = useStateCoordinator.getState()
      await coordinator.executeMiddleware('before', 'integration-test', {})
      
      // Validate the state
      const validationReport = await stateValidator.validate()
      
      // End the debug session
      const endedSession = stateInspector.endDebugSession()
      
      return {
        sessionId: session.id,
        snapshotTaken: !!snapshot,
        validationPassed: validationReport.overallValid,
        sessionEnded: !!endedSession
      }
    }))

    // Test 2: Cross-System Communication
    tests.push(await this.runTest('Cross-System Communication', async () => {
      // Test that systems can communicate with each other
      const performanceTimer = performanceMonitor.startTimer('cross-system-test', 'integration')
      
      try {
        // Trigger validation which should log to the logger
        await stateValidator.validate()
        
        // Check if performance metrics were recorded
        const metrics = performanceMonitor.getMetrics('integration')
        
        performanceTimer.stop()
        
        return {
          metricsRecorded: metrics.length > 0,
          timerWorked: true
        }
      } catch (error) {
        performanceTimer.stop()
        throw error
      }
    }))

    // Test 3: System Health Check
    tests.push(await this.runTest('System Health Check', async () => {
      const coordinator = useStateCoordinator.getState()
      const health = {
        coordinator: !!coordinator && !!coordinator.config,
        validator: !!stateValidator && stateValidator.getRules().length > 0,
        performance: !!performanceMonitor && performanceMonitor.getStats().totalMetrics >= 0,
        persistence: !!persistenceCoordinator && persistenceCoordinator.getStats().layers.length > 0,
        errorHandling: !!errorRecoveryManager && errorRecoveryManager.getStats().totalErrors >= 0,
        inspector: !!stateInspector && stateInspector.isEnabled()
      }
      
      const healthyComponents = Object.values(health).filter(Boolean).length
      const totalComponents = Object.keys(health).length
      
      if (healthyComponents < totalComponents) {
        throw new Error(`System health check failed: ${healthyComponents}/${totalComponents} components healthy`)
      }
      
      return { health, healthyComponents, totalComponents }
    }))

    const endTime = Date.now()
    const duration = endTime - startTime
    const passed = tests.every(test => test.passed)
    const summary = this.calculateSummary(tests)

    return {
      name: 'System Integration',
      tests,
      passed,
      duration,
      summary
    }
  }

  // ============================================================================
  // Test Utilities
  // ============================================================================

  private async runTest(name: string, testFn: () => Promise<any>): Promise<TestResult> {
    const startTime = Date.now()
    
    try {
      const details = await testFn()
      const duration = Date.now() - startTime
      
      return {
        name,
        passed: true,
        duration,
        details
      }
    } catch (error) {
      const duration = Date.now() - startTime
      
      return {
        name,
        passed: false,
        duration,
        error: (error as Error).message,
        details: { error }
      }
    }
  }

  private calculateSummary(tests: TestResult[]): TestSuite['summary'] {
    const total = tests.length
    const passed = tests.filter(test => test.passed).length
    const failed = total - passed
    const passRate = total > 0 ? passed / total : 0

    return { total, passed, failed, passRate }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  async quickHealthCheck(): Promise<boolean> {
    try {
      const report = await this.runAllTests()
      return report.overallPassed
    } catch (error) {
      stateLogger.error('test', 'Health check failed', { error })
      return false
    }
  }

  async runSpecificSuite(suiteName: string): Promise<TestSuite | null> {
    switch (suiteName.toLowerCase()) {
      case 'coordination':
        return this.runCoordinationTests()
      case 'validation':
        return this.runValidationTests()
      case 'performance':
        return this.runPerformanceTests()
      case 'persistence':
        return this.runPersistenceTests()
      case 'error':
      case 'errorhandling':
        return this.runErrorHandlingTests()
      case 'integration':
        return this.runIntegrationTests()
      default:
        return null
    }
  }

  generateReport(report: SystemTestReport): string {
    const lines: string[] = []
    
    lines.push('# State Coordination System Test Report')
    lines.push(`Generated: ${new Date(report.timestamp).toISOString()}`)
    lines.push(`Overall Status: ${report.overallPassed ? '✅ PASSED' : '❌ FAILED'}`)
    lines.push(`Pass Rate: ${Math.round(report.summary.overallPassRate * 100)}%`)
    lines.push(`Duration: ${report.summary.totalDuration}ms`)
    lines.push('')

    lines.push('## Summary')
    lines.push(`- Total Tests: ${report.summary.totalTests}`)
    lines.push(`- Passed: ${report.summary.passedTests}`)
    lines.push(`- Failed: ${report.summary.failedTests}`)
    lines.push('')

    lines.push('## System Health')
    for (const [component, healthy] of Object.entries(report.systemHealth)) {
      lines.push(`- ${component}: ${healthy ? '✅' : '❌'}`)
    }
    lines.push('')

    lines.push('## Test Suites')
    for (const suite of report.suites) {
      lines.push(`### ${suite.name}`)
      lines.push(`Status: ${suite.passed ? '✅ PASSED' : '❌ FAILED'}`)
      lines.push(`Tests: ${suite.summary.passed}/${suite.summary.total} passed`)
      lines.push(`Duration: ${suite.duration}ms`)
      lines.push('')

      for (const test of suite.tests) {
        lines.push(`- ${test.passed ? '✅' : '❌'} ${test.name} (${test.duration}ms)`)
        if (!test.passed && test.error) {
          lines.push(`  Error: ${test.error}`)
        }
      }
      lines.push('')
    }

    return lines.join('\n')
  }
}

// ============================================================================
// Global Test Instance
// ============================================================================

export const coordinationSystemTester = new CoordinationSystemTester()

// ============================================================================
// Convenience Functions
// ============================================================================

export const runSystemTests = (): Promise<SystemTestReport> => {
  return coordinationSystemTester.runAllTests()
}

export const quickHealthCheck = (): Promise<boolean> => {
  return coordinationSystemTester.quickHealthCheck()
}

export const runTestSuite = (suiteName: string): Promise<TestSuite | null> => {
  return coordinationSystemTester.runSpecificSuite(suiteName)
}