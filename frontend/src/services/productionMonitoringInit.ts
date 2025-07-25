/**
 * Production Monitoring Initialization
 * Centralized initialization and coordination of all production monitoring services
 */

import { productionMonitoringConfig, isProductionEnvironment, validateConfiguration } from '../config/monitoring.production'
import { productionErrorTracker } from './productionErrorTracking'
import { productionAnalytics } from './productionAnalytics'
import { productionPerformanceMonitor } from './productionPerformanceMonitor'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface MonitoringInitResult {
  success: boolean
  services: {
    errorTracking: boolean
    analytics: boolean
    performance: boolean
  }
  errors: string[]
  warnings: string[]
  config: {
    environment: string
    version: string
    features: Record<string, boolean>
  }
}

// ============================================================================
// Production Monitoring Coordinator
// ============================================================================

class ProductionMonitoringCoordinator {
  private initialized = false
  private initPromise?: Promise<MonitoringInitResult>

  // ============================================================================
  // Initialization
  // ============================================================================

  async initialize(): Promise<MonitoringInitResult> {
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this.performInitialization()
    return this.initPromise
  }

  private async performInitialization(): Promise<MonitoringInitResult> {
    const result: MonitoringInitResult = {
      success: false,
      services: {
        errorTracking: false,
        analytics: false,
        performance: false
      },
      errors: [],
      warnings: [],
      config: {
        environment: productionMonitoringConfig.environment,
        version: productionMonitoringConfig.version,
        features: {}
      }
    }

    try {
      // Validate configuration first
      const validation = validateConfiguration()
      result.errors.push(...validation.errors)
      result.warnings.push(...validation.warnings)

      // Log initialization start
      console.log(`🚀 Initializing production monitoring for ${productionMonitoringConfig.environment}`)

      // Initialize services in order
      await this.initializeErrorTracking(result)
      await this.initializeAnalytics(result)
      await this.initializePerformanceMonitoring(result)

      // Set up integrations
      this.setupServiceIntegrations()

      // Mark as initialized
      this.initialized = true
      result.success = result.errors.length === 0

      // Log final status
      this.logInitializationResult(result)

      return result

    } catch (error) {
      result.errors.push(`Monitoring initialization failed: ${error.message}`)
      console.error('❌ Production monitoring initialization failed:', error)
      return result
    }
  }

  // ============================================================================
  // Service Initialization
  // ============================================================================

  private async initializeErrorTracking(result: MonitoringInitResult): Promise<void> {
    try {
      if (productionMonitoringConfig.errorTracking.enabled) {
        await productionErrorTracker.initialize()
        result.services.errorTracking = true
        
        // Set global context
        productionErrorTracker.setTag('environment', productionMonitoringConfig.environment)
        productionErrorTracker.setTag('version', productionMonitoringConfig.version)
        productionErrorTracker.setContext('monitoring', {
          service: 'tgapp-fsrs-frontend',
          initialized: new Date().toISOString()
        })

        console.log('✅ Error tracking initialized')
      } else {
        result.warnings.push('Error tracking is disabled')
      }
    } catch (error) {
      result.errors.push(`Error tracking initialization failed: ${error.message}`)
      console.error('❌ Error tracking initialization failed:', error)
    }
  }

  private async initializeAnalytics(result: MonitoringInitResult): Promise<void> {
    try {
      if (productionMonitoringConfig.analytics.enabled) {
        await productionAnalytics.initialize()
        result.services.analytics = true
        console.log('✅ Analytics initialized')
      } else {
        result.warnings.push('Analytics is disabled')
      }
    } catch (error) {
      result.errors.push(`Analytics initialization failed: ${error.message}`)
      console.error('❌ Analytics initialization failed:', error)
    }
  }

  private async initializePerformanceMonitoring(result: MonitoringInitResult): Promise<void> {
    try {
      if (productionMonitoringConfig.performance.enabled) {
        await productionPerformanceMonitor.initialize()
        result.services.performance = true
        console.log('✅ Performance monitoring initialized')
      } else {
        result.warnings.push('Performance monitoring is disabled')
      }
    } catch (error) {
      result.errors.push(`Performance monitoring initialization failed: ${error.message}`)
      console.error('❌ Performance monitoring initialization failed:', error)
    }
  }

  // ============================================================================
  // Service Integration
  // ============================================================================

  private setupServiceIntegrations(): void {
    // Integrate error tracking with analytics
    if (productionMonitoringConfig.errorTracking.enabled && productionMonitoringConfig.analytics.enabled) {
      this.integrateErrorTrackingWithAnalytics()
    }

    // Integrate performance monitoring with analytics
    if (productionMonitoringConfig.performance.enabled && productionMonitoringConfig.analytics.enabled) {
      this.integratePerformanceWithAnalytics()
    }

    // Set up cross-service breadcrumbs
    this.setupCrossServiceBreadcrumbs()
  }

  private integrateErrorTrackingWithAnalytics(): void {
    // Override analytics error tracking to also send to Sentry
    const originalTrackError = productionAnalytics.trackError.bind(productionAnalytics)
    productionAnalytics.trackError = (error: Error, context?: Record<string, any>) => {
      // Send to analytics
      originalTrackError(error, context)
      
      // Also send to error tracker
      productionErrorTracker.captureError(error, {
        component: context?.component,
        action: context?.action,
        extra: context
      })
    }
  }

  private integratePerformanceWithAnalytics(): void {
    // Performance thresholds trigger analytics events
    const originalRecordMetric = productionPerformanceMonitor.recordMetric.bind(productionPerformanceMonitor)
    productionPerformanceMonitor.recordMetric = (metric) => {
      // Record the metric normally
      originalRecordMetric(metric)
      
      // Check for critical performance issues
      if (this.isCriticalPerformanceIssue(metric)) {
        productionAnalytics.trackEvent({
          name: 'critical_performance_issue',
          category: 'performance',
          properties: {
            metricName: metric.name,
            value: metric.value,
            unit: metric.unit,
            category: metric.category
          }
        })
      }
    }
  }

  private setupCrossServiceBreadcrumbs(): void {
    // Track page views in error tracking
    const originalTrackPageView = productionAnalytics.trackPageView.bind(productionAnalytics)
    productionAnalytics.trackPageView = (page: string, properties?: Record<string, any>) => {
      originalTrackPageView(page, properties)
      
      productionErrorTracker.addBreadcrumb({
        message: `Page view: ${page}`,
        category: 'navigation',
        level: 'info',
        data: properties
      })
    }

    // Track user actions in error tracking
    const originalTrackUserAction = productionAnalytics.trackUserAction.bind(productionAnalytics)
    productionAnalytics.trackUserAction = (action: string, component: string, properties?: Record<string, any>) => {
      originalTrackUserAction(action, component, properties)
      
      productionErrorTracker.addBreadcrumb({
        message: `User action: ${action} in ${component}`,
        category: 'user',
        level: 'info',
        data: { action, component, ...properties }
      })
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private isCriticalPerformanceIssue(metric: any): boolean {
    const thresholds = productionMonitoringConfig.performance.thresholds
    
    return (
      (metric.category === 'api' && metric.value > thresholds.slowApiCall * 2) ||
      (metric.category === 'render' && metric.value > thresholds.slowRender * 3) ||
      (metric.category === 'memory' && metric.value > thresholds.highMemoryUsage * 1.5)
    )
  }

  private logInitializationResult(result: MonitoringInitResult): void {
    const { services, errors, warnings } = result
    const enabledServices = Object.entries(services).filter(([, enabled]) => enabled).map(([name]) => name)
    
    if (result.success) {
      console.log(`✅ Production monitoring initialized successfully`)
      console.log(`📊 Enabled services: ${enabledServices.join(', ')}`)
      
      if (warnings.length > 0) {
        console.warn(`⚠️ Warnings: ${warnings.join(', ')}`)
      }
    } else {
      console.error(`❌ Production monitoring initialization completed with errors`)
      console.error(`🚫 Errors: ${errors.join(', ')}`)
      
      if (enabledServices.length > 0) {
        console.log(`✅ Partially enabled services: ${enabledServices.join(', ')}`)
      }
    }

    // Store result for debugging
    if (!isProductionEnvironment()) {
      (window as any).__MONITORING_INIT_RESULT__ = result
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  isInitialized(): boolean {
    return this.initialized
  }

  getServices() {
    return {
      errorTracker: productionErrorTracker,
      analytics: productionAnalytics,
      performanceMonitor: productionPerformanceMonitor
    }
  }

  async getStatus(): Promise<{
    initialized: boolean
    environment: string
    services: Record<string, boolean>
    config: any
  }> {
    const result = await this.initialize()
    
    return {
      initialized: this.initialized,
      environment: productionMonitoringConfig.environment,
      services: result.services,
      config: {
        errorTracking: productionMonitoringConfig.errorTracking.enabled,
        analytics: productionMonitoringConfig.analytics.enabled,
        performance: productionMonitoringConfig.performance.enabled,
        features: productionMonitoringConfig.features
      }
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    try {
      productionPerformanceMonitor.destroy()
      productionAnalytics.destroy()
      this.initialized = false
      console.log('🧹 Production monitoring services destroyed')
    } catch (error) {
      console.error('Error destroying monitoring services:', error)
    }
  }
}

// ============================================================================
// Service Instance
// ============================================================================

export const productionMonitoringCoordinator = new ProductionMonitoringCoordinator()

// ============================================================================
// Auto-initialization
// ============================================================================

// Initialize monitoring when the module loads
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      productionMonitoringCoordinator.initialize()
    })
  } else {
    // DOM is already ready
    productionMonitoringCoordinator.initialize()
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    productionMonitoringCoordinator.destroy()
  })
}

// ============================================================================
// Export Default Coordinator
// ============================================================================

export default productionMonitoringCoordinator