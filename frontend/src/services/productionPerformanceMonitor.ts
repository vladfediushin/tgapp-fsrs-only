/**
 * Production Performance Monitor
 * Lightweight performance monitoring optimized for production
 */

import { productionMonitoringConfig, isProductionEnvironment } from '../config/monitoring.production'
import { productionAnalytics } from './productionAnalytics'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ProductionMetric {
  name: string
  value: number
  unit: string
  category: string
  timestamp: number
  tags?: Record<string, string>
}

export interface PerformanceThresholds {
  slowApiCall: number
  slowRender: number
  highMemoryUsage: number
  largeBundle: number
}

export interface PerformanceSummary {
  totalMetrics: number
  averageResponseTime: number
  errorRate: number
  slowOperations: number
  memoryUsage?: number
  timestamp: number
}

// ============================================================================
// Lightweight Performance Monitor
// ============================================================================

class ProductionPerformanceMonitor {
  private config = productionMonitoringConfig.performance
  private metrics: ProductionMetric[] = []
  private timers: Map<string, number> = new Map()
  private initialized = false
  private reportTimer?: NodeJS.Timeout

  constructor() {
    this.setupReporting()
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.initialized || !this.config.enabled) return

    try {
      // Monitor Web Vitals if available
      this.setupWebVitals()
      
      // Monitor navigation timing
      this.recordNavigationTiming()
      
      // Set up periodic memory monitoring (if enabled)
      if (this.config.enableMemoryMonitoring && !isProductionEnvironment()) {
        this.setupMemoryMonitoring()
      }

      this.initialized = true
      console.log('Production performance monitor initialized')
    } catch (error) {
      console.warn('Failed to initialize performance monitor:', error)
    }
  }

  // ============================================================================
  // Core Metrics Collection
  // ============================================================================

  recordMetric(metric: Omit<ProductionMetric, 'timestamp'>): void {
    if (!this.config.enabled) return

    // Apply sampling
    if (Math.random() > this.config.sampleRate) return

    const fullMetric: ProductionMetric = {
      ...metric,
      timestamp: Date.now()
    }

    this.metrics.push(fullMetric)

    // Prevent memory overflow
    if (this.metrics.length > this.config.maxMetrics) {
      this.metrics.shift()
    }

    // Check thresholds
    this.checkThreshold(fullMetric)

    // Send to analytics if enabled
    productionAnalytics.trackPerformanceMetric({
      name: metric.name,
      value: metric.value,
      unit: metric.unit,
      category: metric.category
    })
  }

  startTimer(name: string, category: string = 'general'): void {
    this.timers.set(`${category}:${name}`, performance.now())
  }

  endTimer(name: string, category: string = 'general', tags?: Record<string, string>): number {
    const key = `${category}:${name}`
    const startTime = this.timers.get(key)
    
    if (!startTime) {
      console.warn(`Timer not found: ${key}`)
      return 0
    }

    const duration = performance.now() - startTime
    this.timers.delete(key)

    this.recordMetric({
      name,
      value: duration,
      unit: 'ms',
      category,
      tags
    })

    return duration
  }

  // ============================================================================
  // Specific Performance Measurements
  // ============================================================================

  measureApiCall(url: string, method: string, duration: number, status: number): void {
    this.recordMetric({
      name: 'api_call',
      value: duration,
      unit: 'ms',
      category: 'api',
      tags: {
        url: this.sanitizeUrl(url),
        method,
        status: status.toString(),
        success: status < 400 ? 'true' : 'false'
      }
    })
  }

  measureRender(component: string, duration: number): void {
    this.recordMetric({
      name: 'component_render',
      value: duration,
      unit: 'ms',
      category: 'render',
      tags: { component }
    })
  }

  measureRouteChange(route: string, duration: number): void {
    this.recordMetric({
      name: 'route_change',
      value: duration,
      unit: 'ms',
      category: 'navigation',
      tags: { route: this.sanitizeRoute(route) }
    })
  }

  measureBundleSize(chunkName: string, size: number): void {
    this.recordMetric({
      name: 'bundle_size',
      value: size,
      unit: 'bytes',
      category: 'bundle',
      tags: { chunk: chunkName }
    })
  }

  // ============================================================================
  // Web Vitals Integration
  // ============================================================================

  private setupWebVitals(): void {
    // Core Web Vitals measurement
    try {
      // First Contentful Paint
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.recordMetric({
              name: 'first_contentful_paint',
              value: entry.startTime,
              unit: 'ms',
              category: 'web_vitals'
            })
          }
        }
      })
      observer.observe({ entryTypes: ['paint'] })

      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        
        this.recordMetric({
          name: 'largest_contentful_paint',
          value: lastEntry.startTime,
          unit: 'ms',
          category: 'web_vitals'
        })
      })
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

      // Cumulative Layout Shift
      let clsValue = 0
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value
          }
        }
        
        this.recordMetric({
          name: 'cumulative_layout_shift',
          value: clsValue,
          unit: 'score',
          category: 'web_vitals'
        })
      })
      clsObserver.observe({ entryTypes: ['layout-shift'] })

    } catch (error) {
      console.warn('Web Vitals monitoring not available:', error)
    }
  }

  // ============================================================================
  // Navigation Timing
  // ============================================================================

  private recordNavigationTiming(): void {
    if (!window.performance?.timing) return

    const timing = window.performance.timing
    const navigationStart = timing.navigationStart

    // Page load metrics
    const metrics = [
      { name: 'dns_lookup', value: timing.domainLookupEnd - timing.domainLookupStart },
      { name: 'tcp_connect', value: timing.connectEnd - timing.connectStart },
      { name: 'request_response', value: timing.responseEnd - timing.requestStart },
      { name: 'dom_processing', value: timing.domComplete - timing.domLoading },
      { name: 'page_load', value: timing.loadEventEnd - navigationStart }
    ]

    metrics.forEach(metric => {
      if (metric.value > 0) {
        this.recordMetric({
          name: metric.name,
          value: metric.value,
          unit: 'ms',
          category: 'navigation'
        })
      }
    })
  }

  // ============================================================================
  // Memory Monitoring
  // ============================================================================

  private setupMemoryMonitoring(): void {
    if (!('memory' in performance)) return

    setInterval(() => {
      const memory = (performance as any).memory
      
      this.recordMetric({
        name: 'memory_used',
        value: memory.usedJSHeapSize,
        unit: 'bytes',
        category: 'memory'
      })

      this.recordMetric({
        name: 'memory_total',
        value: memory.totalJSHeapSize,
        unit: 'bytes',
        category: 'memory'
      })
    }, 30000) // Every 30 seconds
  }

  // ============================================================================
  // Threshold Monitoring
  // ============================================================================

  private checkThreshold(metric: ProductionMetric): void {
    const thresholds = this.config.thresholds
    let violated = false
    let thresholdName = ''
    let thresholdValue = 0

    switch (metric.category) {
      case 'api':
        if (metric.value > thresholds.slowApiCall) {
          violated = true
          thresholdName = 'slow_api_call'
          thresholdValue = thresholds.slowApiCall
        }
        break
      
      case 'render':
        if (metric.value > thresholds.slowRender) {
          violated = true
          thresholdName = 'slow_render'
          thresholdValue = thresholds.slowRender
        }
        break
      
      case 'memory':
        if (metric.name === 'memory_used' && metric.value > thresholds.highMemoryUsage) {
          violated = true
          thresholdName = 'high_memory_usage'
          thresholdValue = thresholds.highMemoryUsage
        }
        break
      
      case 'bundle':
        if (metric.value > thresholds.largeBundle) {
          violated = true
          thresholdName = 'large_bundle'
          thresholdValue = thresholds.largeBundle
        }
        break
    }

    if (violated) {
      // Log threshold violation
      if (!isProductionEnvironment()) {
        console.warn(`Performance threshold violated: ${thresholdName}`, {
          metric: metric.name,
          value: metric.value,
          threshold: thresholdValue,
          unit: metric.unit
        })
      }

      // Track threshold violation
      productionAnalytics.trackEvent({
        name: 'performance_threshold_violated',
        category: 'performance',
        properties: {
          thresholdName,
          metricName: metric.name,
          value: metric.value,
          threshold: thresholdValue,
          unit: metric.unit
        }
      })
    }
  }

  // ============================================================================
  // Reporting
  // ============================================================================

  private setupReporting(): void {
    this.reportTimer = setInterval(() => {
      if (this.metrics.length > 0) {
        this.generateReport()
      }
    }, this.config.reportInterval)
  }

  private generateReport(): PerformanceSummary {
    const now = Date.now()
    const recentMetrics = this.metrics.filter(m => now - m.timestamp < this.config.reportInterval)

    if (recentMetrics.length === 0) {
      return {
        totalMetrics: 0,
        averageResponseTime: 0,
        errorRate: 0,
        slowOperations: 0,
        timestamp: now
      }
    }

    // Calculate summary statistics
    const apiMetrics = recentMetrics.filter(m => m.category === 'api')
    const errorMetrics = recentMetrics.filter(m => 
      m.tags?.success === 'false' || m.name.includes('error')
    )
    const slowMetrics = recentMetrics.filter(m => {
      const thresholds = this.config.thresholds
      return (
        (m.category === 'api' && m.value > thresholds.slowApiCall) ||
        (m.category === 'render' && m.value > thresholds.slowRender)
      )
    })

    const averageResponseTime = apiMetrics.length > 0 
      ? apiMetrics.reduce((sum, m) => sum + m.value, 0) / apiMetrics.length 
      : 0

    const errorRate = recentMetrics.length > 0 
      ? errorMetrics.length / recentMetrics.length 
      : 0

    const summary: PerformanceSummary = {
      totalMetrics: recentMetrics.length,
      averageResponseTime,
      errorRate,
      slowOperations: slowMetrics.length,
      timestamp: now
    }

    // Add memory usage if available
    const memoryMetrics = recentMetrics.filter(m => m.category === 'memory' && m.name === 'memory_used')
    if (memoryMetrics.length > 0) {
      summary.memoryUsage = memoryMetrics[memoryMetrics.length - 1].value
    }

    // Log summary in development
    if (!isProductionEnvironment()) {
      console.log('Performance summary:', summary)
    }

    return summary
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url, window.location.origin)
      return urlObj.pathname
    } catch {
      return url.split('?')[0] // Remove query params
    }
  }

  private sanitizeRoute(route: string): string {
    // Remove dynamic segments for grouping
    return route.replace(/\/\d+/g, '/:id').replace(/\/[a-f0-9-]{36}/g, '/:uuid')
  }

  // ============================================================================
  // Public API
  // ============================================================================

  getMetrics(category?: string): ProductionMetric[] {
    return category 
      ? this.metrics.filter(m => m.category === category)
      : [...this.metrics]
  }

  getCurrentSummary(): PerformanceSummary {
    return this.generateReport()
  }

  clearMetrics(): void {
    this.metrics = []
  }

  destroy(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer)
    }
    this.timers.clear()
    this.metrics = []
  }
}

// ============================================================================
// Service Instance
// ============================================================================

export const productionPerformanceMonitor = new ProductionPerformanceMonitor()

// ============================================================================
// Utility Functions
// ============================================================================

export const measureAsync = async <T>(
  name: string,
  fn: () => Promise<T>,
  category: string = 'general'
): Promise<T> => {
  productionPerformanceMonitor.startTimer(name, category)
  try {
    const result = await fn()
    productionPerformanceMonitor.endTimer(name, category, { success: 'true' })
    return result
  } catch (error) {
    productionPerformanceMonitor.endTimer(name, category, { success: 'false' })
    throw error
  }
}

export const measureSync = <T>(
  name: string,
  fn: () => T,
  category: string = 'general'
): T => {
  productionPerformanceMonitor.startTimer(name, category)
  try {
    const result = fn()
    productionPerformanceMonitor.endTimer(name, category, { success: 'true' })
    return result
  } catch (error) {
    productionPerformanceMonitor.endTimer(name, category, { success: 'false' })
    throw error
  }
}

// ============================================================================
// React Hook
// ============================================================================

export const useProductionPerformanceMonitor = () => {
  return {
    monitor: productionPerformanceMonitor,
    measureAsync,
    measureSync,
    recordMetric: productionPerformanceMonitor.recordMetric.bind(productionPerformanceMonitor),
    startTimer: productionPerformanceMonitor.startTimer.bind(productionPerformanceMonitor),
    endTimer: productionPerformanceMonitor.endTimer.bind(productionPerformanceMonitor),
    measureApiCall: productionPerformanceMonitor.measureApiCall.bind(productionPerformanceMonitor),
    measureRender: productionPerformanceMonitor.measureRender.bind(productionPerformanceMonitor),
    measureRouteChange: productionPerformanceMonitor.measureRouteChange.bind(productionPerformanceMonitor),
    getCurrentSummary: productionPerformanceMonitor.getCurrentSummary.bind(productionPerformanceMonitor),
  }
}

// ============================================================================
// Export Default Service
// ============================================================================

export default productionPerformanceMonitor