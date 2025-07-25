// Consolidated Performance Monitoring System
// Phase 2.1: Merges performanceMonitor.ts, performanceBudgets.ts, realTimeStatistics.ts, and statisticsOptimization.ts
// Maintains all existing functionality with improved organization and compatibility layer

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useUnifiedActions, useUnifiedStore } from '../../store/unified'

// ============================================================================
// CONSOLIDATED TYPES AND INTERFACES
// ============================================================================

// Core Performance Metrics (from performanceMonitor.ts)
export interface PerformanceMetrics {
  // Core Web Vitals
  fcp?: number // First Contentful Paint
  lcp?: number // Largest Contentful Paint
  fid?: number // First Input Delay
  cls?: number // Cumulative Layout Shift
  ttfb?: number // Time to First Byte
  
  // Custom Metrics
  initialLoadTime: number
  routeLoadTimes: Record<string, number>
  resourceLoadTimes: Record<string, number>
  memoryUsage: number
  
  // Navigation Timing
  navigationStart: number
  domContentLoaded: number
  loadComplete: number
  
  // Resource Timing
  totalResources: number
  cachedResources: number
  networkResources: number
  
  // Bundle Metrics
  jsSize: number
  cssSize: number
  imageSize: number
  totalSize: number
  bundleSize?: number
  vendorSize?: number
  
  // User Experience
  interactionDelay: number
  scrollPerformance: number
  renderBlocking: number
  
  // DOM Metrics (from performanceBudgets.ts)
  domNodes?: number
  domDepth?: number
  
  // Performance Scores (from performanceBudgets.ts)
  performanceScore?: number
  budgetScore?: number
}

export interface PerformanceInsights {
  metrics: {
    loadTime: 'good' | 'needs-improvement' | 'poor'
    bundleSize: 'good' | 'needs-improvement' | 'poor'
    codeSplitting: 'good' | 'needs-improvement' | 'poor'
    caching: 'good' | 'needs-improvement' | 'poor'
  }
  recommendations: string[]
  score: number
}

// Performance Budget Types (from performanceBudgets.ts)
export interface PerformanceBudget {
  // Bundle size budgets (in bytes)
  maxBundleSize: number
  maxChunkSize: number
  maxVendorSize: number
  maxAssetSize: number
  
  // Loading time budgets (in milliseconds)
  maxInitialLoadTime: number
  maxRouteLoadTime: number
  maxChunkLoadTime: number
  
  // Core Web Vitals budgets
  maxFCP: number // First Contentful Paint
  maxLCP: number // Largest Contentful Paint
  maxFID: number // First Input Delay
  maxCLS: number // Cumulative Layout Shift
  maxTTI: number // Time to Interactive
  
  // Resource budgets
  maxImageSize: number
  maxFontSize: number
  maxCSSSize: number
  maxJSSize: number
  
  // Network budgets
  maxRequests: number
  maxDOMNodes: number
  maxDOMDepth: number
}

export interface BudgetViolation {
  metric: string
  actual: number
  budget: number
  severity: 'warning' | 'error' | 'critical'
  timestamp: number
  context?: any
}

// Real-time Statistics Types (from realTimeStatistics.ts)
export type StatisticsEventType = 'answer_submitted' | 'session_completed' | 'goal_achieved' | 'streak_updated'

export interface StatisticsEvent {
  type: StatisticsEventType
  data: any
  timestamp: number
  userId: string
}

export interface RealTimeStatsOptions {
  userId: string
  refreshInterval?: number
  enableAutoRefresh?: boolean
  onStatsUpdate?: (stats: any) => void
}

// Optimization Types (from statisticsOptimization.ts)
export interface VirtualScrollOptions {
  itemHeight: number
  containerHeight: number
  overscan?: number
}

export interface ProgressiveLoadingOptions {
  pageSize: number
  loadThreshold?: number
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

const DEFAULT_BUDGETS: PerformanceBudget = {
  // Bundle size budgets (targeting < 150KB initial bundle)
  maxBundleSize: 150 * 1024, // 150KB
  maxChunkSize: 50 * 1024,   // 50KB per chunk
  maxVendorSize: 100 * 1024, // 100KB for vendor libraries
  maxAssetSize: 25 * 1024,   // 25KB per asset
  
  // Loading time budgets (targeting fast 3G)
  maxInitialLoadTime: 1200,  // 1.2 seconds
  maxRouteLoadTime: 300,     // 300ms
  maxChunkLoadTime: 200,     // 200ms
  
  // Core Web Vitals budgets (good thresholds)
  maxFCP: 1800,  // 1.8 seconds
  maxLCP: 2000,  // 2.0 seconds
  maxFID: 100,   // 100ms
  maxCLS: 0.1,   // 0.1
  maxTTI: 2500,  // 2.5 seconds
  
  // Resource budgets
  maxImageSize: 100 * 1024,  // 100KB per image
  maxFontSize: 50 * 1024,    // 50KB per font
  maxCSSSize: 30 * 1024,     // 30KB per CSS file
  maxJSSize: 50 * 1024,      // 50KB per JS file
  
  // Network budgets
  maxRequests: 50,     // 50 requests max
  maxDOMNodes: 1500,   // 1500 DOM nodes
  maxDOMDepth: 32      // 32 levels deep
}

// ============================================================================
// UTILITY FUNCTIONS (from statisticsOptimization.ts)
// ============================================================================

// Simple debounce implementation
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: number
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = window.setTimeout(() => func(...args), delay)
  }
}

// Simple throttle implementation
const throttle = <T extends (...args: any[]) => any>(
  func: T,
  delay: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): ((...args: Parameters<T>) => void) => {
  const { leading = true, trailing = true } = options
  let lastCallTime = 0
  let timeoutId: number | null = null
  
  return (...args: Parameters<T>) => {
    const now = Date.now()
    
    if (leading && now - lastCallTime >= delay) {
      lastCallTime = now
      func(...args)
    } else if (trailing) {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        lastCallTime = Date.now()
        func(...args)
      }, delay - (now - lastCallTime))
    }
  }
}

// ============================================================================
// STATISTICS EVENT EMITTER (from realTimeStatistics.ts)
// ============================================================================

class StatisticsEventEmitter {
  private listeners: Map<StatisticsEventType, Set<(event: StatisticsEvent) => void>> = new Map()

  subscribe(eventType: StatisticsEventType, callback: (event: StatisticsEvent) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(callback)

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(eventType)
      if (listeners) {
        listeners.delete(callback)
      }
    }
  }

  emit(eventType: StatisticsEventType, data: any, userId: string) {
    const event: StatisticsEvent = {
      type: eventType,
      data,
      timestamp: Date.now(),
      userId
    }

    const listeners = this.listeners.get(eventType)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event)
        } catch (error) {
          console.error('Error in statistics event listener:', error)
        }
      })
    }
  }

  clear() {
    this.listeners.clear()
  }
}

export const statisticsEventEmitter = new StatisticsEventEmitter()

// ============================================================================
// CONSOLIDATED PERFORMANCE MONITOR CLASS
// ============================================================================

class ConsolidatedPerformanceMonitor {
  // Core monitoring properties (from performanceMonitor.ts)
  private metrics: Partial<PerformanceMetrics> = {}
  private observers: PerformanceObserver[] = []
  private routeStartTimes: Map<string, number> = new Map()
  private memoryInterval?: NodeJS.Timeout
  private listeners: ((metrics: Partial<PerformanceMetrics>) => void)[] = []

  // Budget monitoring properties (from performanceBudgets.ts)
  private budgets: PerformanceBudget
  private violations: BudgetViolation[] = []
  private budgetObservers: Map<string, PerformanceObserver> = new Map()
  private budgetListeners: Array<(violation: BudgetViolation) => void> = []
  private metricsListeners: Array<(metrics: PerformanceMetrics) => void> = []

  constructor(customBudgets?: Partial<PerformanceBudget>) {
    this.budgets = { ...DEFAULT_BUDGETS, ...customBudgets }
    this.initializeMetrics()
    this.setupObservers()
    this.setupBudgetObservers()
    this.startMemoryMonitoring()
    this.startBudgetMonitoring()
  }

  // ============================================================================
  // CORE METRICS INITIALIZATION (from performanceMonitor.ts)
  // ============================================================================

  private initializeMetrics(): void {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    
    if (navigation) {
      const navStart = navigation.startTime || performance.timeOrigin
      this.metrics = {
        navigationStart: navStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navStart,
        loadComplete: navigation.loadEventEnd - navStart,
        ttfb: navigation.responseStart - navStart,
        initialLoadTime: navigation.loadEventEnd - navStart,
        routeLoadTimes: {},
        resourceLoadTimes: {},
        memoryUsage: 0,
        totalResources: 0,
        cachedResources: 0,
        networkResources: 0,
        jsSize: 0,
        cssSize: 0,
        imageSize: 0,
        totalSize: 0,
        interactionDelay: 0,
        scrollPerformance: 0,
        renderBlocking: 0
      }
    }

    this.collectResourceMetrics()
    this.notifyListeners()
  }

  private setupObservers(): void {
    // Core Web Vitals Observer
    if ('PerformanceObserver' in window) {
      try {
        // LCP Observer
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as any
          if (lastEntry) {
            this.metrics.lcp = lastEntry.startTime
            this.checkBudget('lcp', lastEntry.startTime, this.budgets.maxLCP)
            this.notifyListeners()
          }
        })
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
        this.observers.push(lcpObserver)

        // FCP Observer
        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          for (const entry of entries) {
            if (entry.name === 'first-contentful-paint') {
              this.metrics.fcp = entry.startTime
              this.checkBudget('fcp', entry.startTime, this.budgets.maxFCP)
              this.notifyListeners()
            }
          }
        })
        fcpObserver.observe({ entryTypes: ['paint'] })
        this.observers.push(fcpObserver)

        // FID Observer
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          for (const entry of entries) {
            this.metrics.fid = (entry as any).processingStart - entry.startTime
            this.checkBudget('fid', this.metrics.fid, this.budgets.maxFID)
            this.notifyListeners()
          }
        })
        fidObserver.observe({ entryTypes: ['first-input'] })
        this.observers.push(fidObserver)

        // CLS Observer
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0
          const entries = list.getEntries()
          for (const entry of entries) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value
            }
          }
          this.metrics.cls = clsValue
          this.checkBudget('cls', clsValue, this.budgets.maxCLS)
          this.notifyListeners()
        })
        clsObserver.observe({ entryTypes: ['layout-shift'] })
        this.observers.push(clsObserver)

        // Resource Observer
        const resourceObserver = new PerformanceObserver((list) => {
          this.collectResourceMetrics()
          this.processResourceEntries(list.getEntries() as PerformanceResourceTiming[])
          this.notifyListeners()
        })
        resourceObserver.observe({ entryTypes: ['resource'] })
        this.observers.push(resourceObserver)

      } catch (error) {
        console.warn('Performance observers not fully supported:', error)
      }
    }
  }

  private collectResourceMetrics(): void {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    
    let jsSize = 0
    let cssSize = 0
    let imageSize = 0
    let totalSize = 0
    let cachedCount = 0
    let networkCount = 0

    resources.forEach(resource => {
      const size = resource.transferSize || resource.encodedBodySize || 0
      totalSize += size

      // Categorize by type
      if (resource.name.includes('.js') || resource.name.includes('javascript')) {
        jsSize += size
      } else if (resource.name.includes('.css') || resource.name.includes('stylesheet')) {
        cssSize += size
      } else if (resource.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
        imageSize += size
      }

      // Track cache vs network
      if (resource.transferSize === 0 && resource.encodedBodySize > 0) {
        cachedCount++
      } else {
        networkCount++
      }

      // Track individual resource load times
      if (this.metrics.resourceLoadTimes) {
        const resourceName = resource.name.split('/').pop() || resource.name
        this.metrics.resourceLoadTimes[resourceName] = resource.responseEnd - resource.startTime
      }
    })

    this.metrics.jsSize = jsSize
    this.metrics.cssSize = cssSize
    this.metrics.imageSize = imageSize
    this.metrics.totalSize = totalSize
    this.metrics.totalResources = resources.length
    this.metrics.cachedResources = cachedCount
    this.metrics.networkResources = networkCount
  }

  // ============================================================================
  // BUDGET MONITORING (from performanceBudgets.ts)
  // ============================================================================

  private setupBudgetObservers(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return
    }

    // Navigation timing observer
    try {
      const navObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processNavigationEntry(entry as PerformanceNavigationTiming)
        }
      })
      navObserver.observe({ entryTypes: ['navigation'] })
      this.budgetObservers.set('navigation', navObserver)
    } catch (error) {
      console.warn('[PerformanceBudgets] Navigation observer not supported:', error)
    }
  }

  private startBudgetMonitoring(): void {
    // Monitor DOM metrics
    this.monitorDOMMetrics()
    
    // Monitor bundle sizes (if available)
    this.monitorBundleSizes()
    
    // Calculate performance scores periodically
    setInterval(() => {
      this.calculatePerformanceScores()
    }, 5000)
  }

  private processNavigationEntry(entry: PerformanceNavigationTiming): void {
    const loadTime = entry.loadEventEnd - entry.fetchStart
    this.metrics.initialLoadTime = loadTime
    
    this.checkBudget('initialLoadTime', loadTime, this.budgets.maxInitialLoadTime)
    this.notifyMetricsListeners()
  }

  private processResourceEntries(entries: PerformanceResourceTiming[]): void {
    entries.forEach(entry => {
      const url = new URL(entry.name)
      const size = entry.transferSize || entry.encodedBodySize || 0
      const loadTime = entry.responseEnd - entry.startTime
      
      // Categorize resource and check budgets
      if (url.pathname.endsWith('.js')) {
        this.checkBudget('jsSize', size, this.budgets.maxJSSize, { file: url.pathname })
        
        if (url.pathname.includes('chunk')) {
          this.checkBudget('chunkSize', size, this.budgets.maxChunkSize, { file: url.pathname })
          this.checkBudget('chunkLoadTime', loadTime, this.budgets.maxChunkLoadTime, { file: url.pathname })
        }
      } else if (url.pathname.endsWith('.css')) {
        this.checkBudget('cssSize', size, this.budgets.maxCSSSize, { file: url.pathname })
      } else if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(url.pathname)) {
        this.checkBudget('imageSize', size, this.budgets.maxImageSize, { file: url.pathname })
      } else if (/\.(woff|woff2|ttf|otf)$/i.test(url.pathname)) {
        this.checkBudget('fontSize', size, this.budgets.maxFontSize, { file: url.pathname })
      }
    })
  }

  private checkBudget(
    metric: string, 
    actual: number, 
    budget: number, 
    context?: any
  ): void {
    if (actual <= budget) return

    const violation: BudgetViolation = {
      metric,
      actual,
      budget,
      severity: this.getSeverity(actual, budget),
      timestamp: Date.now(),
      context
    }

    this.violations.push(violation)
    this.notifyViolationListeners(violation)
    
    console.warn(
      `[PerformanceBudgets] Budget violation: ${metric}`,
      `Actual: ${actual}, Budget: ${budget}`,
      context
    )
  }

  private getSeverity(actual: number, budget: number): 'warning' | 'error' | 'critical' {
    const ratio = actual / budget
    if (ratio > 2) return 'critical'
    if (ratio > 1.5) return 'error'
    return 'warning'
  }

  private monitorDOMMetrics(): void {
    const checkDOM = () => {
      const nodeCount = document.querySelectorAll('*').length
      const depth = this.calculateDOMDepth()
      
      this.metrics.domNodes = nodeCount
      this.metrics.domDepth = depth
      
      this.checkBudget('domNodes', nodeCount, this.budgets.maxDOMNodes)
      this.checkBudget('domDepth', depth, this.budgets.maxDOMDepth)
      
      this.notifyMetricsListeners()
    }
    
    // Check DOM metrics periodically
    setInterval(checkDOM, 10000) // Every 10 seconds
    
    // Check on DOM changes
    if ('MutationObserver' in window) {
      const observer = new MutationObserver(() => {
        setTimeout(checkDOM, 100) // Debounce
      })
      observer.observe(document.body, { childList: true, subtree: true })
    }
  }

  private calculateDOMDepth(element = document.body, depth = 0): number {
    let maxDepth = depth
    for (const child of element.children) {
      const childDepth = this.calculateDOMDepth(child as HTMLElement, depth + 1)
      maxDepth = Math.max(maxDepth, childDepth)
    }
    return maxDepth
  }

  private monitorBundleSizes(): void {
    // This would typically be integrated with build tools
    // For now, we estimate from loaded resources
    setTimeout(() => {
      const totalJSSize = this.metrics.jsSize || 0
      const vendorSize = 0 // Would need to be calculated from actual resources
      
      this.metrics.bundleSize = totalJSSize
      this.metrics.vendorSize = vendorSize
      
      this.checkBudget('bundleSize', totalJSSize, this.budgets.maxBundleSize)
      this.checkBudget('vendorSize', vendorSize, this.budgets.maxVendorSize)
      
      this.notifyMetricsListeners()
    }, 5000)
  }

  private calculatePerformanceScores(): void {
    const scores = {
      fcp: this.scoreMetric(this.metrics.fcp || 0, this.budgets.maxFCP),
      lcp: this.scoreMetric(this.metrics.lcp || 0, this.budgets.maxLCP),
      fid: this.scoreMetric(this.metrics.fid || 0, this.budgets.maxFID),
      cls: this.scoreMetric(this.metrics.cls || 0, this.budgets.maxCLS),
      loadTime: this.scoreMetric(this.metrics.initialLoadTime || 0, this.budgets.maxInitialLoadTime),
      bundleSize: this.scoreMetric(this.metrics.bundleSize || 0, this.budgets.maxBundleSize)
    }
    
    // Calculate weighted performance score
    this.metrics.performanceScore = Math.round(
      (scores.fcp * 0.15 +
       scores.lcp * 0.25 +
       scores.fid * 0.15 +
       scores.cls * 0.15 +
       scores.loadTime * 0.20 +
       scores.bundleSize * 0.10) * 100
    )
    
    // Calculate budget compliance score
    const recentViolations = this.violations.filter(v => 
      Date.now() - v.timestamp < 60000 // Last minute
    ).length
    
    this.metrics.budgetScore = Math.max(0, 100 - (recentViolations * 10))
    
    this.notifyMetricsListeners()
  }

  private scoreMetric(actual: number, budget: number): number {
    if (actual === 0) return 1
    const ratio = actual / budget
    if (ratio <= 0.5) return 1
    if (ratio <= 1) return 1 - (ratio - 0.5) * 2
    return Math.max(0, 1 - (ratio - 1) * 0.5)
  }

  // ============================================================================
  // MEMORY MONITORING (from performanceMonitor.ts)
  // ============================================================================

  private startMemoryMonitoring(): void {
    if ('memory' in performance) {
      this.memoryInterval = setInterval(() => {
        const memory = (performance as any).memory
        if (memory) {
          this.metrics.memoryUsage = memory.usedJSHeapSize
          this.notifyListeners()
        }
      }, 5000) // Update every 5 seconds
    }
  }

  // ============================================================================
  // PUBLIC API METHODS
  // ============================================================================

  public trackRouteChange(route: string): void {
    const now = performance.now()
    
    // End previous route timing
    for (const [prevRoute, startTime] of this.routeStartTimes.entries()) {
      if (!this.metrics.routeLoadTimes) this.metrics.routeLoadTimes = {}
      this.metrics.routeLoadTimes[prevRoute] = now - startTime
    }
    
    // Start new route timing
    this.routeStartTimes.clear()
    this.routeStartTimes.set(route, now)
    this.notifyListeners()
  }

  public trackInteraction(delay: number): void {
    this.metrics.interactionDelay = Math.max(this.metrics.interactionDelay || 0, delay)
    this.notifyListeners()
  }

  public trackScrollPerformance(fps: number): void {
    this.metrics.scrollPerformance = fps
    this.notifyListeners()
  }

  public getMetrics(): Partial<PerformanceMetrics> {
    return { ...this.metrics }
  }

  public getInsights(): PerformanceInsights {
    const metrics = this.metrics
    const insights: PerformanceInsights = {
      metrics: {
        loadTime: 'good',
        bundleSize: 'good',
        codeSplitting: 'good',
        caching: 'good'
      },
      recommendations: [],
      score: 100
    }

    let score = 100

    // Analyze load time
    const loadTime = metrics.initialLoadTime || 0
    if (loadTime > 3000) {
      insights.metrics.loadTime = 'poor'
      insights.recommendations.push('Reduce initial load time by code splitting and lazy loading')
      score -= 20
    } else if (loadTime > 1500) {
      insights.metrics.loadTime = 'needs-improvement'
      insights.recommendations.push('Consider optimizing critical rendering path')
      score -= 10
    }

    // Analyze bundle size
    const bundleSize = metrics.jsSize || 0
    if (bundleSize > 200 * 1024) {
      insights.metrics.bundleSize = 'poor'
      insights.recommendations.push('Bundle size is too large. Implement code splitting and tree shaking')
      score -= 25
    } else if (bundleSize > 150 * 1024) {
      insights.metrics.bundleSize = 'needs-improvement'
      insights.recommendations.push('Consider reducing bundle size with better tree shaking')
      score -= 15
    }

    // Analyze code splitting
    const routeCount = Object.keys(metrics.routeLoadTimes || {}).length
    if (routeCount < 2) {
      insights.metrics.codeSplitting = 'poor'
      insights.recommendations.push('Implement route-based code splitting')
      score -= 20
    } else if (routeCount < 4) {
      insights.metrics.codeSplitting = 'needs-improvement'
      insights.recommendations.push('Consider more granular code splitting')
      score -= 10
    }

    // Analyze caching
    const cacheRatio = (metrics.cachedResources || 0) / (metrics.totalResources || 1)
    if (cacheRatio < 0.5) {
      insights.metrics.caching = 'poor'
      insights.recommendations.push('Improve caching strategy for better performance')
      score -= 15
    } else if (cacheRatio < 0.8) {
      insights.metrics.caching = 'needs-improvement'
      insights.recommendations.push('Optimize cache headers and service worker caching')
      score -= 8
    }

    // Core Web Vitals analysis
    if (metrics.fcp && metrics.fcp > 3000) {
      insights.recommendations.push('Improve First Contentful Paint by optimizing critical resources')
      score -= 10
    }

    if (metrics.lcp && metrics.lcp > 4000) {
      insights.recommendations.push('Optimize Largest Contentful Paint by preloading key resources')
      score -= 15
    }

    if (metrics.cls && metrics.cls > 0.25) {
      insights.recommendations.push('Reduce Cumulative Layout Shift by reserving space for dynamic content')
      score -= 10
    }

    insights.score = Math.max(0, score)
    return insights
  }

  // Budget API methods
  public getBudgets(): PerformanceBudget {
    return { ...this.budgets }
  }

  public updateBudgets(newBudgets: Partial<PerformanceBudget>): void {
    this.budgets = { ...this.budgets, ...newBudgets }
    console.log('[ConsolidatedPerformance] Budgets updated:', newBudgets)
  }

  public getViolations(since?: number): BudgetViolation[] {
    const cutoff = since || 0
    return this.violations.filter(v => v.timestamp >= cutoff)
  }

  public clearViolations(): void {
    this.violations = []
  }

  // ============================================================================
  // EVENT SYSTEM
  // ============================================================================

  public subscribe(callback: (metrics: Partial<PerformanceMetrics>) => void): () => void {
    this.listeners.push(callback)
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  public onViolation(callback: (violation: BudgetViolation) => void): () => void {
    this.budgetListeners.push(callback)
    return () => {
      const index = this.budgetListeners.indexOf(callback)
      if (index > -1) this.budgetListeners.splice(index, 1)
    }
  }

  public onMetricsUpdate(callback: (metrics: PerformanceMetrics) => void): () => void {
    this.metricsListeners.push(callback)
    return () => {
      const index = this.metricsListeners.indexOf(callback)
      if (index > -1) this.metricsListeners.splice(index, 1)
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.metrics))
  }

  private notifyViolationListeners(violation: BudgetViolation): void {
    this.budgetListeners.forEach(callback => {
      try {
        callback(violation)
      } catch (error) {
        console.error('[ConsolidatedPerformance] Error in violation callback:', error)
      }
    })
  }

  private notifyMetricsListeners(): void {
    this.metricsListeners.forEach(callback => {
      try {
        callback(this.metrics as PerformanceMetrics)
      } catch (error) {
        console.error('[ConsolidatedPerformance] Error in metrics callback:', error)
      }
    })
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  public destroy(): void {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
    
    this.budgetObservers.forEach(observer => observer.disconnect())
    this.budgetObservers.clear()
    
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval)
    }
    
    this.listeners = []
    this.budgetListeners = []
    this.metricsListeners = []
    this.violations = []
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let consolidatedPerformanceMonitor: ConsolidatedPerformanceMonitor | null = null

export const getConsolidatedPerformanceMonitor = (customBudgets?: Partial<PerformanceBudget>): ConsolidatedPerformanceMonitor => {
  if (!consolidatedPerformanceMonitor) {
    consolidatedPerformanceMonitor = new ConsolidatedPerformanceMonitor(customBudgets)
  }
  return consolidatedPerformanceMonitor
}

// ============================================================================
// OPTIMIZATION UTILITIES (from statisticsOptimization.ts)
// ============================================================================

/**
 * Optimized data aggregation for large datasets
 */
export const optimizeDataAggregation = <T>(
  data: T[],
  aggregationFn: (items: T[]) => any,
  chunkSize: number = 1000
) => {
  if (data.length <= chunkSize) {
    return aggregationFn(data)
  }

  // Process data in chunks to avoid blocking the main thread
  const chunks: T[][] = []
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize))
  }

  return chunks.reduce((acc, chunk) => {
    const chunkResult = aggregationFn(chunk)
    return Array.isArray(acc) ? [...acc, ...chunkResult] : { ...acc, ...chunkResult }
  }, Array.isArray(aggregationFn([])) ? [] : {})
}

/**
 * Optimize chart data by reducing points for better performance
 */
export const optimizeChartData = (
  data: Array<{ x: any; y: number }>,
  maxPoints: number = 100
) => {
  if (data.length <= maxPoints) return data

  const step = Math.ceil(data.length / maxPoints)
  const optimized: Array<{ x: any; y: number }> = []

  for (let i = 0; i < data.length; i += step) {
    const chunk = data.slice(i, i + step)
    const avgY = chunk.reduce((sum, point) => sum + point.y, 0) / chunk.length
    
    optimized.push({
      x: chunk[Math.floor(chunk.length / 2)].x, // Use middle point's x value
      y: Math.round(avgY * 100) / 100 // Round to 2 decimal places
    })
  }

  return optimized
}

// ============================================================================
// REACT HOOKS
// ============================================================================

/**
 * Main performance metrics hook (from performanceMonitor.ts)
 */
export const usePerformanceMetrics = () => {
  const [metrics, setMetrics] = useState<Partial<PerformanceMetrics>>({})
  const [insights, setInsights] = useState<PerformanceInsights | null>(null)
  const monitorRef = useRef<ConsolidatedPerformanceMonitor>()

  useEffect(() => {
    monitorRef.current = getConsolidatedPerformanceMonitor()
    
    // Initial metrics
    setMetrics(monitorRef.current.getMetrics())
    setInsights(monitorRef.current.getInsights())

    // Subscribe to updates
    const unsubscribe = monitorRef.current.subscribe((newMetrics) => {
      setMetrics(newMetrics)
      setInsights(monitorRef.current!.getInsights())
    })

    return unsubscribe
  }, [])

  const trackRouteChange = useCallback((route: string) => {
    monitorRef.current?.trackRouteChange(route)
  }, [])

  const trackInteraction = useCallback((delay: number) => {
    monitorRef.current?.trackInteraction(delay)
  }, [])

  const trackScrollPerformance = useCallback((fps: number) => {
    monitorRef.current?.trackScrollPerformance(fps)
  }, [])

  return {
    metrics,
    insights,
    trackRouteChange,
    trackInteraction,
    trackScrollPerformance
  }
}

/**
 * Performance budgets hook (from performanceBudgets.ts)
 */
export const usePerformanceBudgets = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [violations, setViolations] = useState<BudgetViolation[]>([])
  const [budgets, setBudgets] = useState<PerformanceBudget | null>(null)

  useEffect(() => {
    const monitor = getConsolidatedPerformanceMonitor()
    if (!monitor) return

    setBudgets(monitor.getBudgets())
    setMetrics(monitor.getMetrics() as PerformanceMetrics)
    setViolations(monitor.getViolations())

    const unsubscribeMetrics = monitor.onMetricsUpdate((newMetrics) => {
      setMetrics(newMetrics)
    })

    const unsubscribeViolations = monitor.onViolation((violation) => {
      setViolations(prev => [...prev, violation])
    })

    return () => {
      unsubscribeMetrics()
      unsubscribeViolations()
    }
  }, [])

  return { metrics, violations, budgets }
}

/**
 * Memoized statistics calculator (from statisticsOptimization.ts)
 */
export const useMemoizedStats = <T>(
  data: T[] | null,
  calculator: (data: T[]) => any,
  dependencies: any[] = []
) => {
  return useMemo(() => {
    if (!data || data.length === 0) return null
    return calculator(data)
  }, [data, ...dependencies])
}

/**
 * Debounced data refresh (from statisticsOptimization.ts)
 */
export const useDebouncedRefresh = (
  refreshFn: () => void,
  delay: number = 300
) => {
  const debouncedRefresh = useCallback(
    debounce(refreshFn, delay),
    [refreshFn, delay]
  )

  return debouncedRefresh
}

/**
 * Throttled real-time updates (from statisticsOptimization.ts)
 */
export const useThrottledUpdates = (
  updateFn: (data: any) => void,
  delay: number = 1000
) => {
  const throttledUpdate = useCallback(
    throttle(updateFn, delay, { leading: true, trailing: true }),
    [updateFn, delay]
  )

  return throttledUpdate
}

/**
 * Virtual scrolling hook (from statisticsOptimization.ts)
 */
export const useVirtualScroll = <T>(
  items: T[],
  options: VirtualScrollOptions
) => {
  const { itemHeight, containerHeight, overscan = 5 } = options
  const scrollElementRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)

  const visibleItemsCount = Math.ceil(containerHeight / itemHeight)
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(
    items.length - 1,
    startIndex + visibleItemsCount + overscan * 2
  )

  const visibleItems = items.slice(startIndex, endIndex + 1)
  const totalHeight = items.length * itemHeight
  const offsetY = startIndex * itemHeight

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return {
    scrollElementRef,
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    startIndex,
    endIndex
  }
}

/**
 * Progressive data loading hook (from statisticsOptimization.ts)
 */
export const useProgressiveLoading = <T>(
  loadDataFn: (page: number, pageSize: number) => Promise<T[]>,
  options: ProgressiveLoadingOptions
) => {
  const { pageSize, loadThreshold = 0.8 } = options
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return

    setLoading(true)
    try {
      const newData = await loadDataFn(page, pageSize)
      
      if (newData.length < pageSize) {
        setHasMore(false)
      }

      setData(prev => [...prev, ...newData])
      setPage(prev => prev + 1)
    } catch (error) {
      console.error('Error loading more data:', error)
    } finally {
      setLoading(false)
    }
  }, [loadDataFn, page, pageSize, loading, hasMore])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight

    if (scrollPercentage >= loadThreshold && !loading && hasMore) {
      loadMore()
    }
  }, [loadMore, loading, hasMore, loadThreshold])

  // Initial load
  useEffect(() => {
    if (data.length === 0 && !loading) {
      loadMore()
    }
  }, [])

  return {
    data,
    loading,
    hasMore,
    loadMore,
    handleScroll,
    reset: () => {
      setData([])
      setPage(0)
      setHasMore(true)
    }
  }
}

/**
 * Real-time statistics hook (from realTimeStatistics.ts)
 */
export const useRealTimeStatistics = ({
  userId,
  refreshInterval = 30000, // 30 seconds
  enableAutoRefresh = true,
  onStatsUpdate
}: RealTimeStatsOptions) => {
  const actions = useUnifiedActions()
  const store = useUnifiedStore()
  const intervalRef = useRef<number>()
  const lastUpdateRef = useRef<number>(0)

  // Throttled update handler to prevent excessive re-renders
  const throttledUpdate = useThrottledUpdates((newStats: any) => {
    if (onStatsUpdate) {
      onStatsUpdate(newStats)
    }
  }, 1000)

  // Debounced refresh to prevent rapid successive calls
  const debouncedRefresh = useDebouncedRefresh(async () => {
    if (!userId) return

    try {
      const now = Date.now()
      
      // Only refresh if enough time has passed since last update
      if (now - lastUpdateRef.current < refreshInterval / 2) {
        return
      }

      const [userStats, dailyProgress, fsrsStats] = await Promise.allSettled([
        actions.loadUserStats(userId),
        actions.loadDailyProgress(userId),
        store.settings.useFSRS ? actions.loadFSRSStats(userId) : Promise.resolve(null)
      ])

      lastUpdateRef.current = now

      // Notify about updates
      const updatedStats = {
        userStats: userStats.status === 'fulfilled' ? userStats.value : null,
        dailyProgress: dailyProgress.status === 'fulfilled' ? dailyProgress.value : null,
        fsrsStats: fsrsStats.status === 'fulfilled' ? fsrsStats.value : null,
        timestamp: now
      }

      throttledUpdate(updatedStats)
    } catch (error) {
      console.error('Error refreshing real-time statistics:', error)
    }
  }, 500)

  // Manual refresh function
  const manualRefresh = useCallback(async () => {
    await debouncedRefresh()
  }, [debouncedRefresh])

  // Setup auto-refresh interval
  useEffect(() => {
    if (!enableAutoRefresh || !userId) return

    intervalRef.current = window.setInterval(() => {
      debouncedRefresh()
    }, refreshInterval)

    // Initial load
    debouncedRefresh()

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [userId, refreshInterval, enableAutoRefresh, debouncedRefresh])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return {
    manualRefresh,
    isAutoRefreshEnabled: enableAutoRefresh,
    lastUpdate: lastUpdateRef.current
  }
}

/**
 * Statistics events hook (from realTimeStatistics.ts)
 */
export const useStatisticsEvents = (
  userId: string,
  eventTypes: StatisticsEventType[],
  onEvent: (event: StatisticsEvent) => void
) => {
  useEffect(() => {
    const unsubscribeFunctions = eventTypes.map(eventType =>
      statisticsEventEmitter.subscribe(eventType, (event) => {
        if (event.userId === userId) {
          onEvent(event)
        }
      })
    )

    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe())
    }
  }, [userId, eventTypes, onEvent])
}

/**
 * Optimistic statistics updates hook (from realTimeStatistics.ts)
 */
export const useOptimisticStatistics = (userId: string) => {
  const actions = useUnifiedActions()
  const store = useUnifiedStore()

  const updateStatsOptimistically = useCallback((
    correctAnswers: number,
    totalAnswers: number,
    sessionData?: any
  ) => {
    // Update local state immediately for better UX
    const currentStats = store.userStats
    const currentProgress = store.dailyProgress

    if (currentStats) {
      // Temporarily update the store with optimistic values
      const optimisticStats = {
        ...currentStats,
        answered: currentStats.answered + totalAnswers,
        correct: currentStats.correct + correctAnswers
      }

      // This would need to be implemented in the unified store
      // store.setOptimisticUserStats(optimisticStats)
    }

    if (currentProgress) {
      const optimisticProgress = {
        ...currentProgress,
        questions_mastered_today: currentProgress.questions_mastered_today + correctAnswers
      }

      // store.setOptimisticDailyProgress(optimisticProgress)
    }

    // Emit event for real-time updates
    statisticsEventEmitter.emit('answer_submitted', {
      correctAnswers,
      totalAnswers,
      sessionData
    }, userId)

    // Schedule actual data refresh
    setTimeout(() => {
      actions.loadUserStats(userId)
      actions.loadDailyProgress(userId)
    }, 1000)
  }, [userId, actions, store])

  const completeSession = useCallback((sessionResults: any) => {
    // Emit session completion event
    statisticsEventEmitter.emit('session_completed', sessionResults, userId)

    // Check for goal achievement
    const currentProgress = store.dailyProgress
    const dailyGoal = store.settings.manualDailyGoal || 20

    if (currentProgress && currentProgress.questions_mastered_today >= dailyGoal) {
      statisticsEventEmitter.emit('goal_achieved', {
        goal: dailyGoal,
        achieved: currentProgress.questions_mastered_today
      }, userId)
    }

    // Refresh all statistics after session
    setTimeout(() => {
      actions.loadUserStats(userId)
      actions.loadDailyProgress(userId)
      actions.loadStreakDays(userId)
      if (store.settings.useFSRS) {
        actions.loadFSRSStats(userId)
      }
    }, 500)
  }, [userId, actions, store])

  return {
    updateStatsOptimistically,
    completeSession
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const measureInteractionDelay = (callback: () => void): void => {
  const start = performance.now()
  
  requestAnimationFrame(() => {
    const delay = performance.now() - start
    getConsolidatedPerformanceMonitor().trackInteraction(delay)
    callback()
  })
}

export const measureScrollPerformance = (): () => void => {
  let frameCount = 0
  let lastTime = performance.now()
  let animationId: number

  const measureFrame = () => {
    frameCount++
    const currentTime = performance.now()
    
    if (currentTime - lastTime >= 1000) {
      const fps = Math.round((frameCount * 1000) / (currentTime - lastTime))
      getConsolidatedPerformanceMonitor().trackScrollPerformance(fps)
      
      frameCount = 0
      lastTime = currentTime
    }
    
    animationId = requestAnimationFrame(measureFrame)
  }

  animationId = requestAnimationFrame(measureFrame)

  return () => {
    cancelAnimationFrame(animationId)
  }
}

export const withPerformanceTiming = <T extends any[], R>(
  fn: (...args: T) => R,
  label: string
): ((...args: T) => R) => {
  return (...args: T): R => {
    const start = performance.now()
    const result = fn(...args)
    const end = performance.now()
    
    console.log(`[Performance] ${label}: ${(end - start).toFixed(2)}ms`)
    
    return result
  }
}

export const withAsyncPerformanceTiming = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  label: string
): ((...args: T) => Promise<R>) => {
  return async (...args: T): Promise<R> => {
    const start = performance.now()
    const result = await fn(...args)
    const end = performance.now()
    
    console.log(`[Performance] ${label}: ${(end - start).toFixed(2)}ms`)
    
    return result
  }
}

// ============================================================================
// COMPATIBILITY LAYER FOR EXISTING APIs
// ============================================================================

// Legacy performanceMonitor.ts compatibility
export const getPerformanceMonitor = () => {
  const monitor = getConsolidatedPerformanceMonitor()
  return {
    trackRouteChange: monitor.trackRouteChange.bind(monitor),
    trackInteraction: monitor.trackInteraction.bind(monitor),
    trackScrollPerformance: monitor.trackScrollPerformance.bind(monitor),
    getMetrics: monitor.getMetrics.bind(monitor),
    getInsights: monitor.getInsights.bind(monitor),
    subscribe: monitor.subscribe.bind(monitor),
    destroy: monitor.destroy.bind(monitor)
  }
}

// Legacy performanceBudgets.ts compatibility
export const initializePerformanceBudgets = (customBudgets?: Partial<PerformanceBudget>) => {
  const monitor = getConsolidatedPerformanceMonitor(customBudgets)
  return {
    getBudgets: monitor.getBudgets.bind(monitor),
    updateBudgets: monitor.updateBudgets.bind(monitor),
    getMetrics: monitor.getMetrics.bind(monitor),
    getViolations: monitor.getViolations.bind(monitor),
    clearViolations: monitor.clearViolations.bind(monitor),
    onViolation: monitor.onViolation.bind(monitor),
    onMetricsUpdate: monitor.onMetricsUpdate.bind(monitor),
    destroy: monitor.destroy.bind(monitor)
  }
}

export const getPerformanceBudgetMonitor = () => {
  return getConsolidatedPerformanceMonitor()
}

// Export consolidated default
export default {
  getConsolidatedPerformanceMonitor,
  getPerformanceMonitor,
  initializePerformanceBudgets,
  getPerformanceBudgetMonitor,
  usePerformanceMetrics,
  usePerformanceBudgets,
  useRealTimeStatistics,
  useStatisticsEvents,
  useOptimisticStatistics,
  useMemoizedStats,
  useDebouncedRefresh,
  useThrottledUpdates,
  useVirtualScroll,
  useProgressiveLoading,
  measureInteractionDelay,
  measureScrollPerformance,
  withPerformanceTiming,
  withAsyncPerformanceTiming,
  optimizeDataAggregation,
  optimizeChartData,
  statisticsEventEmitter,
  DEFAULT_BUDGETS
}