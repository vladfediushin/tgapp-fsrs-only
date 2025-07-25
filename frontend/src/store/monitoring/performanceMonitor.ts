// Performance Monitoring and Metrics Collection System
import { stateLogger } from '../logging/stateLogger'

// ============================================================================
// Performance Types and Interfaces
// ============================================================================

export interface PerformanceMetric {
  name: string
  value: number
  unit: string
  timestamp: number
  category: string
  tags?: Record<string, string>
}

export interface TimingMetric extends PerformanceMetric {
  startTime: number
  endTime: number
  duration: number
}

export interface CounterMetric extends PerformanceMetric {
  count: number
  rate?: number
}

export interface GaugeMetric extends PerformanceMetric {
  current: number
  min?: number
  max?: number
  average?: number
}

export interface HistogramMetric extends PerformanceMetric {
  values: number[]
  percentiles: Record<string, number>
  mean: number
  stdDev: number
}

export interface PerformanceReport {
  timestamp: number
  duration: number
  metrics: PerformanceMetric[]
  summary: {
    totalMetrics: number
    categories: Record<string, number>
    topSlowOperations: TimingMetric[]
    errorRate: number
    throughput: number
  }
}

export interface PerformanceThreshold {
  name: string
  category: string
  metric: string
  threshold: number
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
  severity: 'warning' | 'error'
  description: string
}

// ============================================================================
// Performance Timer
// ============================================================================

export class PerformanceTimer {
  private startTime: number
  private endTime?: number
  private name: string
  private category: string
  private tags: Record<string, string>

  constructor(name: string, category: string = 'general', tags: Record<string, string> = {}) {
    this.name = name
    this.category = category
    this.tags = tags
    this.startTime = performance.now()
  }

  stop(): TimingMetric {
    this.endTime = performance.now()
    const duration = this.endTime - this.startTime

    const metric: TimingMetric = {
      name: this.name,
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      category: this.category,
      tags: this.tags,
      startTime: this.startTime,
      endTime: this.endTime,
      duration
    }

    performanceMonitor.recordMetric(metric)
    return metric
  }

  getDuration(): number {
    const endTime = this.endTime || performance.now()
    return endTime - this.startTime
  }
}

// ============================================================================
// Performance Monitor Implementation
// ============================================================================

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private counters: Map<string, number> = new Map()
  private gauges: Map<string, number> = new Map()
  private histograms: Map<string, number[]> = new Map()
  private thresholds: PerformanceThreshold[] = []
  private maxMetrics: number = 10000
  private reportInterval: number = 60000 // 1 minute
  private lastReport: number = Date.now()

  constructor() {
    this.setupDefaultThresholds()
    this.startPeriodicReporting()
  }

  // ============================================================================
  // Metric Recording
  // ============================================================================

  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric)
    this.checkThresholds(metric)
    this.pruneMetrics()

    stateLogger.debug('performance', `Recorded metric: ${metric.name}`, {
      metric: {
        name: metric.name,
        value: metric.value,
        unit: metric.unit,
        category: metric.category
      }
    })
  }

  startTimer(name: string, category: string = 'general', tags: Record<string, string> = {}): PerformanceTimer {
    return new PerformanceTimer(name, category, tags)
  }

  recordTiming(name: string, duration: number, category: string = 'general', tags: Record<string, string> = {}): void {
    const metric: TimingMetric = {
      name,
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      category,
      tags,
      startTime: Date.now() - duration,
      endTime: Date.now(),
      duration
    }
    this.recordMetric(metric)
  }

  incrementCounter(name: string, category: string = 'general', increment: number = 1, tags: Record<string, string> = {}): void {
    const key = `${category}:${name}`
    const currentValue = this.counters.get(key) || 0
    const newValue = currentValue + increment
    this.counters.set(key, newValue)

    const metric: CounterMetric = {
      name,
      value: newValue,
      unit: 'count',
      timestamp: Date.now(),
      category,
      tags,
      count: newValue,
      rate: this.calculateRate(key, newValue)
    }
    this.recordMetric(metric)
  }

  setGauge(name: string, value: number, category: string = 'general', tags: Record<string, string> = {}): void {
    const key = `${category}:${name}`
    this.gauges.set(key, value)

    const metric: GaugeMetric = {
      name,
      value,
      unit: 'gauge',
      timestamp: Date.now(),
      category,
      tags,
      current: value
    }
    this.recordMetric(metric)
  }

  recordHistogram(name: string, value: number, category: string = 'general', tags: Record<string, string> = {}): void {
    const key = `${category}:${name}`
    const values = this.histograms.get(key) || []
    values.push(value)
    
    // Keep only last 1000 values for performance
    if (values.length > 1000) {
      values.shift()
    }
    
    this.histograms.set(key, values)

    const percentiles = this.calculatePercentiles(values)
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length
    const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length)

    const metric: HistogramMetric = {
      name,
      value,
      unit: 'histogram',
      timestamp: Date.now(),
      category,
      tags,
      values: [...values],
      percentiles,
      mean,
      stdDev
    }
    this.recordMetric(metric)
  }

  // ============================================================================
  // Store-Specific Metrics
  // ============================================================================

  recordStoreOperation(storeName: string, operation: string, duration: number, success: boolean): void {
    this.recordTiming(`${storeName}.${operation}`, duration, 'store', {
      store: storeName,
      operation,
      success: success.toString()
    })

    this.incrementCounter(`${storeName}.operations`, 'store', 1, {
      store: storeName,
      operation
    })

    if (!success) {
      this.incrementCounter(`${storeName}.errors`, 'store', 1, {
        store: storeName,
        operation
      })
    }
  }

  recordCacheOperation(cacheType: string, operation: string, hit: boolean, duration?: number): void {
    this.incrementCounter(`cache.${operation}`, 'cache', 1, {
      cacheType,
      operation,
      hit: hit.toString()
    })

    if (hit) {
      this.incrementCounter('cache.hits', 'cache', 1, { cacheType })
    } else {
      this.incrementCounter('cache.misses', 'cache', 1, { cacheType })
    }

    if (duration !== undefined) {
      this.recordTiming(`cache.${operation}.duration`, duration, 'cache', {
        cacheType,
        operation
      })
    }
  }

  recordAPICall(endpoint: string, method: string, duration: number, status: number): void {
    this.recordTiming(`api.${method}.${endpoint}`, duration, 'api', {
      endpoint,
      method,
      status: status.toString()
    })

    this.incrementCounter('api.requests', 'api', 1, {
      endpoint,
      method,
      status: status.toString()
    })

    if (status >= 400) {
      this.incrementCounter('api.errors', 'api', 1, {
        endpoint,
        method,
        status: status.toString()
      })
    }
  }

  recordRenderTime(component: string, duration: number): void {
    this.recordTiming(`render.${component}`, duration, 'render', {
      component
    })

    this.recordHistogram('render.times', duration, 'render', {
      component
    })
  }

  // ============================================================================
  // Memory and Resource Monitoring
  // ============================================================================

  recordMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      this.setGauge('memory.used', memory.usedJSHeapSize, 'memory')
      this.setGauge('memory.total', memory.totalJSHeapSize, 'memory')
      this.setGauge('memory.limit', memory.jsHeapSizeLimit, 'memory')
    }
  }

  recordStorageUsage(): void {
    try {
      // LocalStorage usage
      let localStorageSize = 0
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          localStorageSize += localStorage[key].length + key.length
        }
      }
      this.setGauge('storage.localStorage', localStorageSize, 'storage')

      // SessionStorage usage
      let sessionStorageSize = 0
      for (let key in sessionStorage) {
        if (sessionStorage.hasOwnProperty(key)) {
          sessionStorageSize += sessionStorage[key].length + key.length
        }
      }
      this.setGauge('storage.sessionStorage', sessionStorageSize, 'storage')
    } catch (error) {
      stateLogger.warn('performance', 'Failed to record storage usage', { error })
    }
  }

  // ============================================================================
  // Threshold Management
  // ============================================================================

  private setupDefaultThresholds(): void {
    this.thresholds = [
      {
        name: 'slow-api-call',
        category: 'api',
        metric: 'duration',
        threshold: 5000,
        operator: 'gt',
        severity: 'warning',
        description: 'API call took longer than 5 seconds'
      },
      {
        name: 'very-slow-api-call',
        category: 'api',
        metric: 'duration',
        threshold: 10000,
        operator: 'gt',
        severity: 'error',
        description: 'API call took longer than 10 seconds'
      },
      {
        name: 'slow-render',
        category: 'render',
        metric: 'duration',
        threshold: 100,
        operator: 'gt',
        severity: 'warning',
        description: 'Component render took longer than 100ms'
      },
      {
        name: 'high-error-rate',
        category: 'api',
        metric: 'rate',
        threshold: 0.1,
        operator: 'gt',
        severity: 'error',
        description: 'API error rate is above 10%'
      },
      {
        name: 'memory-usage-high',
        category: 'memory',
        metric: 'used',
        threshold: 100 * 1024 * 1024, // 100MB
        operator: 'gt',
        severity: 'warning',
        description: 'Memory usage is above 100MB'
      }
    ]
  }

  addThreshold(threshold: PerformanceThreshold): void {
    this.thresholds.push(threshold)
  }

  removeThreshold(name: string): void {
    this.thresholds = this.thresholds.filter(t => t.name !== name)
  }

  private checkThresholds(metric: PerformanceMetric): void {
    for (const threshold of this.thresholds) {
      if (threshold.category === metric.category) {
        const value = metric.value
        const thresholdValue = threshold.threshold
        let violated = false

        switch (threshold.operator) {
          case 'gt':
            violated = value > thresholdValue
            break
          case 'lt':
            violated = value < thresholdValue
            break
          case 'gte':
            violated = value >= thresholdValue
            break
          case 'lte':
            violated = value <= thresholdValue
            break
          case 'eq':
            violated = value === thresholdValue
            break
        }

        if (violated) {
          const logLevel = threshold.severity === 'error' ? 'error' : 'warn'
          stateLogger[logLevel]('performance', `Performance threshold violated: ${threshold.name}`, {
            thresholdName: threshold.name,
            description: threshold.description,
            metric: metric.name,
            value,
            thresholdValue,
            operator: threshold.operator
          })
        }
      }
    }
  }

  // ============================================================================
  // Reporting and Analysis
  // ============================================================================

  generateReport(duration: number = 60000): PerformanceReport {
    const now = Date.now()
    const cutoff = now - duration
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff)

    const categories: Record<string, number> = {}
    const timingMetrics: TimingMetric[] = []

    for (const metric of recentMetrics) {
      categories[metric.category] = (categories[metric.category] || 0) + 1
      
      if ('duration' in metric) {
        timingMetrics.push(metric as TimingMetric)
      }
    }

    const topSlowOperations = timingMetrics
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)

    const errorMetrics = recentMetrics.filter(m => 
      m.name.includes('error') || (m.tags && m.tags.success === 'false')
    )
    const errorRate = recentMetrics.length > 0 ? errorMetrics.length / recentMetrics.length : 0

    const throughput = recentMetrics.length / (duration / 1000) // metrics per second

    return {
      timestamp: now,
      duration,
      metrics: recentMetrics,
      summary: {
        totalMetrics: recentMetrics.length,
        categories,
        topSlowOperations,
        errorRate,
        throughput
      }
    }
  }

  private startPeriodicReporting(): void {
    setInterval(() => {
      const report = this.generateReport(this.reportInterval)
      
      stateLogger.info('performance', 'Performance report', {
        totalMetrics: report.summary.totalMetrics,
        categories: report.summary.categories,
        errorRate: report.summary.errorRate,
        throughput: report.summary.throughput,
        topSlowOperations: report.summary.topSlowOperations.slice(0, 3).map(op => ({
          name: op.name,
          duration: op.duration
        }))
      })

      // Record system metrics
      this.recordMemoryUsage()
      this.recordStorageUsage()
    }, this.reportInterval)
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private calculateRate(key: string, currentValue: number): number {
    // Simple rate calculation - could be enhanced with time windows
    return currentValue / ((Date.now() - this.lastReport) / 1000)
  }

  private calculatePercentiles(values: number[]): Record<string, number> {
    const sorted = [...values].sort((a, b) => a - b)
    const percentiles = [50, 75, 90, 95, 99]
    const result: Record<string, number> = {}

    for (const p of percentiles) {
      const index = Math.ceil((p / 100) * sorted.length) - 1
      result[`p${p}`] = sorted[Math.max(0, index)]
    }

    return result
  }

  private pruneMetrics(): void {
    if (this.metrics.length > this.maxMetrics) {
      const excess = this.metrics.length - this.maxMetrics
      this.metrics.splice(0, excess)
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  getMetrics(category?: string, limit?: number): PerformanceMetric[] {
    let filtered = category ? 
      this.metrics.filter(m => m.category === category) : 
      this.metrics

    if (limit) {
      filtered = filtered.slice(-limit)
    }

    return filtered
  }

  getCounters(): Map<string, number> {
    return new Map(this.counters)
  }

  getGauges(): Map<string, number> {
    return new Map(this.gauges)
  }

  clear(): void {
    this.metrics = []
    this.counters.clear()
    this.gauges.clear()
    this.histograms.clear()
  }

  getStats(): {
    totalMetrics: number
    categories: string[]
    oldestMetric: number
    newestMetric: number
  } {
    return {
      totalMetrics: this.metrics.length,
      categories: [...new Set(this.metrics.map(m => m.category))],
      oldestMetric: this.metrics.length > 0 ? this.metrics[0].timestamp : 0,
      newestMetric: this.metrics.length > 0 ? this.metrics[this.metrics.length - 1].timestamp : 0
    }
  }
}

// ============================================================================
// Global Performance Monitor Instance
// ============================================================================

export const performanceMonitor = new PerformanceMonitor()

// ============================================================================
// Convenience Functions
// ============================================================================

export const measureAsync = async <T>(
  name: string,
  fn: () => Promise<T>,
  category: string = 'general',
  tags: Record<string, string> = {}
): Promise<T> => {
  const timer = performanceMonitor.startTimer(name, category, tags)
  try {
    const result = await fn()
    timer.stop()
    return result
  } catch (error) {
    timer.stop()
    performanceMonitor.incrementCounter(`${name}.errors`, category, 1, { ...tags, error: 'true' })
    throw error
  }
}

export const measureSync = <T>(
  name: string,
  fn: () => T,
  category: string = 'general',
  tags: Record<string, string> = {}
): T => {
  const timer = performanceMonitor.startTimer(name, category, tags)
  try {
    const result = fn()
    timer.stop()
    return result
  } catch (error) {
    timer.stop()
    performanceMonitor.incrementCounter(`${name}.errors`, category, 1, { ...tags, error: 'true' })
    throw error
  }
}

// ============================================================================
// React Hook for Performance Monitoring
// ============================================================================

export const usePerformanceMonitor = () => {
  return {
    monitor: performanceMonitor,
    startTimer: performanceMonitor.startTimer.bind(performanceMonitor),
    recordTiming: performanceMonitor.recordTiming.bind(performanceMonitor),
    incrementCounter: performanceMonitor.incrementCounter.bind(performanceMonitor),
    setGauge: performanceMonitor.setGauge.bind(performanceMonitor),
    recordHistogram: performanceMonitor.recordHistogram.bind(performanceMonitor),
    generateReport: performanceMonitor.generateReport.bind(performanceMonitor),
    measureAsync,
    measureSync
  }
}