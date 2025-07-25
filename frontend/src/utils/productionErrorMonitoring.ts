/**
 * Production Error Monitoring System
 * Comprehensive error tracking, reporting, and recovery for production deployment
 */

import { useState, useEffect, useCallback } from 'react'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ErrorReport {
  id: string
  timestamp: string
  type: 'javascript' | 'network' | 'chunk' | 'runtime' | 'unhandled'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  stack?: string
  url?: string
  lineNumber?: number
  columnNumber?: number
  userAgent: string
  userId?: string
  sessionId: string
  buildVersion: string
  environment: string
  context: {
    route: string
    component?: string
    action?: string
    props?: Record<string, any>
    state?: Record<string, any>
  }
  breadcrumbs: ErrorBreadcrumb[]
  performance: {
    memory?: number
    timing?: PerformanceTiming
    resources?: number
  }
  recovery?: {
    attempted: boolean
    successful: boolean
    method: string
  }
}

export interface ErrorBreadcrumb {
  timestamp: string
  category: 'navigation' | 'user' | 'http' | 'console' | 'dom'
  message: string
  level: 'info' | 'warning' | 'error'
  data?: Record<string, any>
}

export interface ErrorMonitorConfig {
  enabled: boolean
  apiEndpoint?: string
  maxBreadcrumbs: number
  maxReports: number
  sampleRate: number
  enableConsoleCapture: boolean
  enableNetworkCapture: boolean
  enablePerformanceCapture: boolean
  enableRecovery: boolean
  sentryDsn?: string
  environment: string
  buildVersion: string
}

// ============================================================================
// Error Monitor Class
// ============================================================================

class ProductionErrorMonitor {
  private config: ErrorMonitorConfig
  private breadcrumbs: ErrorBreadcrumb[] = []
  private errorQueue: ErrorReport[] = []
  private sessionId: string
  private isOnline: boolean = navigator.onLine
  private retryQueue: ErrorReport[] = []

  constructor(config: ErrorMonitorConfig) {
    this.config = config
    this.sessionId = this.generateSessionId()
    
    if (config.enabled) {
      this.initialize()
    }
  }

  private initialize(): void {
    // Global error handlers
    window.addEventListener('error', this.handleJavaScriptError.bind(this))
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this))
    
    // Network monitoring
    if (this.config.enableNetworkCapture) {
      this.setupNetworkMonitoring()
    }
    
    // Console capture
    if (this.config.enableConsoleCapture) {
      this.setupConsoleCapture()
    }
    
    // Performance monitoring
    if (this.config.enablePerformanceCapture) {
      this.setupPerformanceMonitoring()
    }
    
    // Online/offline handling
    window.addEventListener('online', () => {
      this.isOnline = true
      this.flushRetryQueue()
    })
    
    window.addEventListener('offline', () => {
      this.isOnline = false
    })
    
    // Chunk loading errors
    this.setupChunkErrorHandling()
    
    // Periodic cleanup
    setInterval(() => this.cleanup(), 60000) // Every minute
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private handleJavaScriptError(event: ErrorEvent): void {
    const error: ErrorReport = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      type: 'javascript',
      severity: this.determineSeverity(event.error),
      message: event.message,
      stack: event.error?.stack,
      url: event.filename,
      lineNumber: event.lineno,
      columnNumber: event.colno,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      buildVersion: this.config.buildVersion,
      environment: this.config.environment,
      context: this.getCurrentContext(),
      breadcrumbs: [...this.breadcrumbs],
      performance: this.getPerformanceData(),
    }

    this.reportError(error)
    
    // Attempt recovery if enabled
    if (this.config.enableRecovery) {
      this.attemptRecovery(error)
    }
  }

  private handleUnhandledRejection(event: PromiseRejectionEvent): void {
    const error: ErrorReport = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      type: 'unhandled',
      severity: 'high',
      message: `Unhandled Promise Rejection: ${event.reason}`,
      stack: event.reason?.stack,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      buildVersion: this.config.buildVersion,
      environment: this.config.environment,
      context: this.getCurrentContext(),
      breadcrumbs: [...this.breadcrumbs],
      performance: this.getPerformanceData(),
    }

    this.reportError(error)
  }

  private setupNetworkMonitoring(): void {
    // Intercept fetch requests
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const startTime = performance.now()
      
      try {
        const response = await originalFetch(...args)
        
        if (!response.ok) {
          this.addBreadcrumb({
            timestamp: new Date().toISOString(),
            category: 'http',
            message: `HTTP ${response.status}: ${args[0]}`,
            level: response.status >= 500 ? 'error' : 'warning',
            data: {
              url: args[0],
              status: response.status,
              duration: performance.now() - startTime,
            },
          })
          
          if (response.status >= 500) {
            this.reportError({
              id: this.generateErrorId(),
              timestamp: new Date().toISOString(),
              type: 'network',
              severity: 'medium',
              message: `Network error: ${response.status} ${response.statusText}`,
              url: args[0] as string,
              userAgent: navigator.userAgent,
              sessionId: this.sessionId,
              buildVersion: this.config.buildVersion,
              environment: this.config.environment,
              context: this.getCurrentContext(),
              breadcrumbs: [...this.breadcrumbs],
              performance: this.getPerformanceData(),
            })
          }
        }
        
        return response
      } catch (error) {
        this.addBreadcrumb({
          timestamp: new Date().toISOString(),
          category: 'http',
          message: `Network failure: ${args[0]}`,
          level: 'error',
          data: {
            url: args[0],
            error: error.message,
            duration: performance.now() - startTime,
          },
        })
        
        this.reportError({
          id: this.generateErrorId(),
          timestamp: new Date().toISOString(),
          type: 'network',
          severity: 'high',
          message: `Network failure: ${error.message}`,
          stack: error.stack,
          url: args[0] as string,
          userAgent: navigator.userAgent,
          sessionId: this.sessionId,
          buildVersion: this.config.buildVersion,
          environment: this.config.environment,
          context: this.getCurrentContext(),
          breadcrumbs: [...this.breadcrumbs],
          performance: this.getPerformanceData(),
        })
        
        throw error
      }
    }
  }

  private setupConsoleCapture(): void {
    const originalConsoleError = console.error
    console.error = (...args) => {
      this.addBreadcrumb({
        timestamp: new Date().toISOString(),
        category: 'console',
        message: args.join(' '),
        level: 'error',
      })
      
      originalConsoleError.apply(console, args)
    }
    
    const originalConsoleWarn = console.warn
    console.warn = (...args) => {
      this.addBreadcrumb({
        timestamp: new Date().toISOString(),
        category: 'console',
        message: args.join(' '),
        level: 'warning',
      })
      
      originalConsoleWarn.apply(console, args)
    }
  }

  private setupPerformanceMonitoring(): void {
    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry) => {
            if (entry.duration > 50) { // Long task threshold
              this.addBreadcrumb({
                timestamp: new Date().toISOString(),
                category: 'dom',
                message: `Long task detected: ${entry.duration.toFixed(2)}ms`,
                level: 'warning',
                data: {
                  duration: entry.duration,
                  startTime: entry.startTime,
                },
              })
            }
          })
        })
        
        observer.observe({ entryTypes: ['longtask'] })
      } catch (error) {
        console.warn('Performance monitoring not supported:', error)
      }
    }
  }

  private setupChunkErrorHandling(): void {
    // Handle dynamic import failures
    const originalImport = window.__webpack_require__ || window.import
    if (originalImport) {
      // This would need to be implemented based on the bundler used
      // For now, we'll catch chunk loading errors in the error boundary
    }
  }

  private determineSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    if (!error) return 'low'
    
    const message = error.message?.toLowerCase() || ''
    const stack = error.stack?.toLowerCase() || ''
    
    // Critical errors
    if (message.includes('chunk') || message.includes('loading')) {
      return 'critical'
    }
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'high'
    }
    
    if (stack.includes('react') || stack.includes('render')) {
      return 'medium'
    }
    
    return 'low'
  }

  private getCurrentContext(): ErrorReport['context'] {
    return {
      route: window.location.pathname,
      component: this.getCurrentComponent(),
      action: this.getLastUserAction(),
      props: this.getComponentProps(),
      state: this.getApplicationState(),
    }
  }

  private getCurrentComponent(): string | undefined {
    // This would need to be implemented based on your React setup
    // Could use React DevTools or custom tracking
    return undefined
  }

  private getLastUserAction(): string | undefined {
    const lastBreadcrumb = this.breadcrumbs
      .filter(b => b.category === 'user')
      .pop()
    
    return lastBreadcrumb?.message
  }

  private getComponentProps(): Record<string, any> | undefined {
    // This would need custom implementation
    return undefined
  }

  private getApplicationState(): Record<string, any> | undefined {
    // This could integrate with your state management
    return undefined
  }

  private getPerformanceData(): ErrorReport['performance'] {
    const data: ErrorReport['performance'] = {}
    
    if ('memory' in performance) {
      data.memory = (performance as any).memory?.usedJSHeapSize
    }
    
    if (performance.timing) {
      data.timing = performance.timing
    }
    
    data.resources = performance.getEntriesByType('resource').length
    
    return data
  }

  private generateErrorId(): string {
    return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private addBreadcrumb(breadcrumb: ErrorBreadcrumb): void {
    this.breadcrumbs.push(breadcrumb)
    
    if (this.breadcrumbs.length > this.config.maxBreadcrumbs) {
      this.breadcrumbs.shift()
    }
  }

  private reportError(error: ErrorReport): void {
    // Sample rate check
    if (Math.random() > this.config.sampleRate) {
      return
    }
    
    this.errorQueue.push(error)
    
    if (this.errorQueue.length > this.config.maxReports) {
      this.errorQueue.shift()
    }
    
    // Send immediately if online
    if (this.isOnline) {
      this.sendError(error)
    } else {
      this.retryQueue.push(error)
    }
  }

  private async sendError(error: ErrorReport): Promise<void> {
    if (!this.config.apiEndpoint) {
      console.warn('Error monitoring: No API endpoint configured')
      return
    }
    
    try {
      await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(error),
      })
    } catch (sendError) {
      console.warn('Failed to send error report:', sendError)
      this.retryQueue.push(error)
    }
  }

  private flushRetryQueue(): void {
    const queue = [...this.retryQueue]
    this.retryQueue = []
    
    queue.forEach(error => this.sendError(error))
  }

  private attemptRecovery(error: ErrorReport): void {
    let recovered = false
    let method = 'none'
    
    try {
      // Chunk loading error recovery
      if (error.type === 'chunk' || error.message.includes('Loading chunk')) {
        method = 'reload'
        window.location.reload()
        recovered = true
      }
      
      // Network error recovery
      else if (error.type === 'network') {
        method = 'retry'
        // Could implement automatic retry logic here
      }
      
      // React error recovery
      else if (error.stack?.includes('react')) {
        method = 'component-reset'
        // Could trigger error boundary recovery
      }
      
    } catch (recoveryError) {
      console.warn('Recovery attempt failed:', recoveryError)
    }
    
    error.recovery = {
      attempted: true,
      successful: recovered,
      method,
    }
  }

  private cleanup(): void {
    // Remove old breadcrumbs
    const cutoff = Date.now() - (5 * 60 * 1000) // 5 minutes
    this.breadcrumbs = this.breadcrumbs.filter(
      b => new Date(b.timestamp).getTime() > cutoff
    )
    
    // Remove old errors
    this.errorQueue = this.errorQueue.filter(
      e => new Date(e.timestamp).getTime() > cutoff
    )
  }

  // Public methods
  public trackUserAction(action: string, data?: Record<string, any>): void {
    this.addBreadcrumb({
      timestamp: new Date().toISOString(),
      category: 'user',
      message: action,
      level: 'info',
      data,
    })
  }

  public trackNavigation(route: string): void {
    this.addBreadcrumb({
      timestamp: new Date().toISOString(),
      category: 'navigation',
      message: `Navigated to ${route}`,
      level: 'info',
      data: { route },
    })
  }

  public getErrorReports(): ErrorReport[] {
    return [...this.errorQueue]
  }

  public getBreadcrumbs(): ErrorBreadcrumb[] {
    return [...this.breadcrumbs]
  }

  public clearErrors(): void {
    this.errorQueue = []
    this.breadcrumbs = []
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let errorMonitor: ProductionErrorMonitor | null = null

export const initializeErrorMonitoring = (config: ErrorMonitorConfig): ProductionErrorMonitor => {
  if (!errorMonitor) {
    errorMonitor = new ProductionErrorMonitor(config)
  }
  return errorMonitor
}

export const getErrorMonitor = (): ProductionErrorMonitor | null => {
  return errorMonitor
}

// ============================================================================
// React Hooks
// ============================================================================

export const useErrorMonitoring = () => {
  const [errors, setErrors] = useState<ErrorReport[]>([])
  const [breadcrumbs, setBreadcrumbs] = useState<ErrorBreadcrumb[]>([])

  useEffect(() => {
    const monitor = getErrorMonitor()
    if (!monitor) return

    const interval = setInterval(() => {
      setErrors(monitor.getErrorReports())
      setBreadcrumbs(monitor.getBreadcrumbs())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const trackUserAction = useCallback((action: string, data?: Record<string, any>) => {
    const monitor = getErrorMonitor()
    monitor?.trackUserAction(action, data)
  }, [])

  const trackNavigation = useCallback((route: string) => {
    const monitor = getErrorMonitor()
    monitor?.trackNavigation(route)
  }, [])

  const clearErrors = useCallback(() => {
    const monitor = getErrorMonitor()
    monitor?.clearErrors()
    setErrors([])
    setBreadcrumbs([])
  }, [])

  return {
    errors,
    breadcrumbs,
    trackUserAction,
    trackNavigation,
    clearErrors,
  }
}

// ============================================================================
// Default Configuration
// ============================================================================

export const defaultErrorMonitorConfig: ErrorMonitorConfig = {
  enabled: import.meta.env.PROD,
  maxBreadcrumbs: 50,
  maxReports: 100,
  sampleRate: 1.0, // 100% in production, could be reduced
  enableConsoleCapture: true,
  enableNetworkCapture: true,
  enablePerformanceCapture: true,
  enableRecovery: true,
  environment: import.meta.env.VITE_ENVIRONMENT || 'production',
  buildVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
}