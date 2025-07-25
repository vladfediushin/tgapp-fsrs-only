// Global Error Handling and Recovery System
import { useState, useEffect, useCallback } from 'react'
import { stateLogger } from '../logging/stateLogger'
import { performanceMonitor } from '../monitoring/performanceMonitor'
import { useUnifiedStore } from '../unified'
import { useOfflineQueue } from '../offlineQueue'
import { useSession } from '../session'

// ============================================================================
// Error Types and Interfaces
// ============================================================================

export interface AppError {
  id: string
  timestamp: number
  type: ErrorType
  severity: ErrorSeverity
  message: string
  stack?: string
  context: ErrorContext
  recovery?: RecoveryAction
  resolved: boolean
  attempts: number
}

export type ErrorType = 
  | 'network'
  | 'storage'
  | 'validation'
  | 'sync'
  | 'cache'
  | 'api'
  | 'render'
  | 'unknown'

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface ErrorContext {
  store?: string
  operation?: string
  userId?: string
  url?: string
  userAgent?: string
  timestamp: number
  additionalData?: any
}

export interface RecoveryAction {
  type: RecoveryType
  description: string
  automatic: boolean
  maxAttempts: number
  delay: number
  action: () => Promise<boolean>
}

export type RecoveryType = 
  | 'retry'
  | 'fallback'
  | 'reset'
  | 'reload'
  | 'clear_cache'
  | 'sync_data'
  | 'manual'

export interface ErrorRecoveryConfig {
  maxErrors: number
  maxRetries: number
  retryDelay: number
  autoRecovery: boolean
  reportErrors: boolean
  fallbackStrategies: Map<ErrorType, RecoveryAction[]>
}

// ============================================================================
// Error Recovery Implementation
// ============================================================================

export class ErrorRecoveryManager {
  private errors: Map<string, AppError> = new Map()
  private config: ErrorRecoveryConfig
  private recoveryInProgress: Set<string> = new Set()
  private subscribers: Set<(error: AppError) => void> = new Set()

  constructor(config: Partial<ErrorRecoveryConfig> = {}) {
    this.config = {
      maxErrors: 100,
      maxRetries: 3,
      retryDelay: 1000,
      autoRecovery: true,
      reportErrors: true,
      fallbackStrategies: new Map(),
      ...config
    }

    this.setupDefaultRecoveryStrategies()
    this.setupGlobalErrorHandlers()
  }

  // ============================================================================
  // Error Handling
  // ============================================================================

  handleError(error: Error | AppError, context: Partial<ErrorContext> = {}): string {
    const appError = this.createAppError(error, context)
    
    this.errors.set(appError.id, appError)
    this.pruneErrors()

    // Log the error
    stateLogger.error('error-recovery', `Error handled: ${appError.type}`, {
      errorId: appError.id,
      type: appError.type,
      severity: appError.severity,
      message: appError.message,
      context: appError.context
    })

    // Record performance metric
    performanceMonitor.incrementCounter('errors.total', 'error', 1, {
      type: appError.type,
      severity: appError.severity
    })

    // Notify subscribers
    this.notifySubscribers(appError)

    // Attempt automatic recovery if enabled
    if (this.config.autoRecovery && appError.recovery) {
      this.attemptRecovery(appError.id)
    }

    return appError.id
  }

  private createAppError(error: Error | AppError, context: Partial<ErrorContext>): AppError {
    if ('id' in error && 'type' in error) {
      // Already an AppError
      return error as AppError
    }

    const baseError = error as Error
    const errorType = this.classifyError(baseError, context)
    const severity = this.determineSeverity(errorType, baseError, context)

    return {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: errorType,
      severity,
      message: baseError.message || 'Unknown error',
      stack: baseError.stack,
      context: {
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        ...context
      },
      recovery: this.getRecoveryAction(errorType, severity),
      resolved: false,
      attempts: 0
    }
  }

  private classifyError(error: Error, context: Partial<ErrorContext>): ErrorType {
    const message = error.message.toLowerCase()
    const stack = error.stack?.toLowerCase() || ''

    // Network errors
    if (message.includes('fetch') || message.includes('network') || 
        message.includes('connection') || error.name === 'NetworkError') {
      return 'network'
    }

    // Storage errors
    if (message.includes('storage') || message.includes('quota') ||
        message.includes('indexeddb') || message.includes('localstorage')) {
      return 'storage'
    }

    // API errors
    if (context.operation?.includes('api') || message.includes('api') ||
        message.includes('http') || message.includes('response')) {
      return 'api'
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid') ||
        message.includes('required') || message.includes('format')) {
      return 'validation'
    }

    // Sync errors
    if (message.includes('sync') || message.includes('queue') ||
        context.store === 'offlineQueue') {
      return 'sync'
    }

    // Cache errors
    if (message.includes('cache') || context.operation?.includes('cache')) {
      return 'cache'
    }

    // Render errors
    if (stack.includes('react') || stack.includes('render') ||
        message.includes('component')) {
      return 'render'
    }

    return 'unknown'
  }

  private determineSeverity(type: ErrorType, error: Error, context: Partial<ErrorContext>): ErrorSeverity {
    // Critical errors that break core functionality
    if (type === 'storage' && error.message.includes('quota')) {
      return 'critical'
    }

    if (type === 'render' && error.message.includes('Cannot read property')) {
      return 'critical'
    }

    // High severity errors
    if (type === 'network' || type === 'api') {
      return 'high'
    }

    if (type === 'sync' && context.operation?.includes('critical')) {
      return 'high'
    }

    // Medium severity errors
    if (type === 'validation' || type === 'cache') {
      return 'medium'
    }

    // Low severity errors
    return 'low'
  }

  // ============================================================================
  // Recovery Strategies
  // ============================================================================

  private setupDefaultRecoveryStrategies(): void {
    // Network error recovery
    this.config.fallbackStrategies.set('network', [
      {
        type: 'retry',
        description: 'Retry network request',
        automatic: true,
        maxAttempts: 3,
        delay: 2000,
        action: async () => {
          // Retry the failed network operation
          return true
        }
      },
      {
        type: 'fallback',
        description: 'Use cached data',
        automatic: true,
        maxAttempts: 1,
        delay: 0,
        action: async () => {
          // Switch to offline mode and use cached data
          useOfflineQueue.getState().setNetworkStatus('OFFLINE')
          return true
        }
      }
    ])

    // Storage error recovery
    this.config.fallbackStrategies.set('storage', [
      {
        type: 'clear_cache',
        description: 'Clear storage cache',
        automatic: true,
        maxAttempts: 1,
        delay: 0,
        action: async () => {
          try {
            localStorage.clear()
            sessionStorage.clear()
            return true
          } catch {
            return false
          }
        }
      },
      {
        type: 'fallback',
        description: 'Use memory-only storage',
        automatic: true,
        maxAttempts: 1,
        delay: 0,
        action: async () => {
          // Switch to memory-only mode
          return true
        }
      }
    ])

    // API error recovery
    this.config.fallbackStrategies.set('api', [
      {
        type: 'retry',
        description: 'Retry API call',
        automatic: true,
        maxAttempts: 2,
        delay: 1000,
        action: async () => {
          return true
        }
      },
      {
        type: 'fallback',
        description: 'Use cached response',
        automatic: true,
        maxAttempts: 1,
        delay: 0,
        action: async () => {
          return true
        }
      }
    ])

    // Sync error recovery
    this.config.fallbackStrategies.set('sync', [
      {
        type: 'retry',
        description: 'Retry sync operation',
        automatic: true,
        maxAttempts: 5,
        delay: 5000,
        action: async () => {
          const offlineQueue = useOfflineQueue.getState()
          await offlineQueue.startSync()
          return true
        }
      },
      {
        type: 'reset',
        description: 'Reset sync queue',
        automatic: false,
        maxAttempts: 1,
        delay: 0,
        action: async () => {
          const offlineQueue = useOfflineQueue.getState()
          offlineQueue.clearQueue()
          return true
        }
      }
    ])

    // Cache error recovery
    this.config.fallbackStrategies.set('cache', [
      {
        type: 'clear_cache',
        description: 'Clear cache',
        automatic: true,
        maxAttempts: 1,
        delay: 0,
        action: async () => {
          const unified = useUnifiedStore.getState()
          unified.clearCache()
          return true
        }
      }
    ])

    // Validation error recovery
    this.config.fallbackStrategies.set('validation', [
      {
        type: 'reset',
        description: 'Reset to default values',
        automatic: false,
        maxAttempts: 1,
        delay: 0,
        action: async () => {
          return true
        }
      }
    ])

    // Render error recovery
    this.config.fallbackStrategies.set('render', [
      {
        type: 'reload',
        description: 'Reload page',
        automatic: false,
        maxAttempts: 1,
        delay: 0,
        action: async () => {
          window.location.reload()
          return true
        }
      }
    ])
  }

  private getRecoveryAction(type: ErrorType, severity: ErrorSeverity): RecoveryAction | undefined {
    const strategies = this.config.fallbackStrategies.get(type)
    if (!strategies || strategies.length === 0) {
      return undefined
    }

    // For critical errors, prefer automatic recovery
    if (severity === 'critical') {
      return strategies.find(s => s.automatic) || strategies[0]
    }

    // For other errors, use the first strategy
    return strategies[0]
  }

  // ============================================================================
  // Recovery Execution
  // ============================================================================

  async attemptRecovery(errorId: string): Promise<boolean> {
    const error = this.errors.get(errorId)
    if (!error || !error.recovery || this.recoveryInProgress.has(errorId)) {
      return false
    }

    if (error.attempts >= error.recovery.maxAttempts) {
      stateLogger.warn('error-recovery', `Max recovery attempts reached for error ${errorId}`)
      return false
    }

    this.recoveryInProgress.add(errorId)
    error.attempts++

    try {
      stateLogger.info('error-recovery', `Attempting recovery for error ${errorId}`, {
        type: error.recovery.type,
        attempt: error.attempts,
        maxAttempts: error.recovery.maxAttempts
      })

      // Add delay if specified
      if (error.recovery.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, error.recovery!.delay))
      }

      const success = await error.recovery.action()

      if (success) {
        error.resolved = true
        stateLogger.info('error-recovery', `Recovery successful for error ${errorId}`)
        
        performanceMonitor.incrementCounter('errors.recovered', 'error', 1, {
          type: error.type,
          recoveryType: error.recovery.type
        })
      } else {
        stateLogger.warn('error-recovery', `Recovery failed for error ${errorId}`)
        
        // Try next recovery strategy if available
        const strategies = this.config.fallbackStrategies.get(error.type)
        if (strategies && strategies.length > 1) {
          const currentIndex = strategies.indexOf(error.recovery)
          if (currentIndex >= 0 && currentIndex < strategies.length - 1) {
            error.recovery = strategies[currentIndex + 1]
            error.attempts = 0 // Reset attempts for new strategy
          }
        }
      }

      return success
    } catch (recoveryError) {
      stateLogger.error('error-recovery', `Recovery action failed for error ${errorId}`, {
        recoveryError: (recoveryError as Error).message
      })
      return false
    } finally {
      this.recoveryInProgress.delete(errorId)
    }
  }

  async recoverAll(): Promise<number> {
    const unresolvedErrors = Array.from(this.errors.values()).filter(e => !e.resolved)
    let recoveredCount = 0

    for (const error of unresolvedErrors) {
      if (await this.attemptRecovery(error.id)) {
        recoveredCount++
      }
    }

    return recoveredCount
  }

  // ============================================================================
  // Global Error Handlers
  // ============================================================================

  private setupGlobalErrorHandlers(): void {
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(new Error(event.reason), {
        operation: 'unhandled_promise_rejection'
      })
    })

    // JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error || new Error(event.message), {
        operation: 'javascript_error',
        additionalData: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      })
    })

    // Resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target && event.target !== window) {
        this.handleError(new Error(`Resource failed to load: ${(event.target as any).src || (event.target as any).href}`), {
          operation: 'resource_load_error'
        })
      }
    }, true)
  }

  // ============================================================================
  // Error Management
  // ============================================================================

  getError(errorId: string): AppError | undefined {
    return this.errors.get(errorId)
  }

  getErrors(filter?: {
    type?: ErrorType
    severity?: ErrorSeverity
    resolved?: boolean
    limit?: number
  }): AppError[] {
    let errors = Array.from(this.errors.values())

    if (filter) {
      if (filter.type) {
        errors = errors.filter(e => e.type === filter.type)
      }
      if (filter.severity) {
        errors = errors.filter(e => e.severity === filter.severity)
      }
      if (filter.resolved !== undefined) {
        errors = errors.filter(e => e.resolved === filter.resolved)
      }
      if (filter.limit) {
        errors = errors.slice(-filter.limit)
      }
    }

    return errors.sort((a, b) => b.timestamp - a.timestamp)
  }

  resolveError(errorId: string): boolean {
    const error = this.errors.get(errorId)
    if (error) {
      error.resolved = true
      return true
    }
    return false
  }

  clearErrors(filter?: { type?: ErrorType; resolved?: boolean }): number {
    let cleared = 0
    
    for (const [id, error] of this.errors.entries()) {
      let shouldClear = true
      
      if (filter) {
        if (filter.type && error.type !== filter.type) {
          shouldClear = false
        }
        if (filter.resolved !== undefined && error.resolved !== filter.resolved) {
          shouldClear = false
        }
      }
      
      if (shouldClear) {
        this.errors.delete(id)
        cleared++
      }
    }
    
    return cleared
  }

  private pruneErrors(): void {
    if (this.errors.size > this.config.maxErrors) {
      const sortedErrors = Array.from(this.errors.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)
      
      const toRemove = this.errors.size - this.config.maxErrors
      for (let i = 0; i < toRemove; i++) {
        this.errors.delete(sortedErrors[i][0])
      }
    }
  }

  // ============================================================================
  // Subscription and Reporting
  // ============================================================================

  subscribe(callback: (error: AppError) => void): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  private notifySubscribers(error: AppError): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(error)
      } catch (err) {
        console.error('Error in error recovery subscriber:', err)
      }
    }
  }

  getStats(): {
    totalErrors: number
    resolvedErrors: number
    errorsByType: Record<ErrorType, number>
    errorsBySeverity: Record<ErrorSeverity, number>
    recoveryRate: number
  } {
    const errors = Array.from(this.errors.values())
    const resolved = errors.filter(e => e.resolved)
    
    const errorsByType: Record<ErrorType, number> = {} as any
    const errorsBySeverity: Record<ErrorSeverity, number> = {} as any
    
    for (const error of errors) {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1
    }
    
    return {
      totalErrors: errors.length,
      resolvedErrors: resolved.length,
      errorsByType,
      errorsBySeverity,
      recoveryRate: errors.length > 0 ? resolved.length / errors.length : 0
    }
  }
}

// ============================================================================
// Global Error Recovery Instance
// ============================================================================

export const errorRecoveryManager = new ErrorRecoveryManager()

// ============================================================================
// Convenience Functions
// ============================================================================

export const handleError = (error: Error, context?: Partial<ErrorContext>): string => {
  return errorRecoveryManager.handleError(error, context)
}

export const recoverFromError = async (errorId: string): Promise<boolean> => {
  return errorRecoveryManager.attemptRecovery(errorId)
}

export const withErrorRecovery = async <T>(
  operation: () => Promise<T>,
  context?: Partial<ErrorContext>
): Promise<T> => {
  try {
    return await operation()
  } catch (error) {
    const errorId = handleError(error as Error, context)
    
    // Attempt automatic recovery
    const recovered = await recoverFromError(errorId)
    
    if (recovered) {
      // Retry the operation once after recovery
      try {
        return await operation()
      } catch (retryError) {
        handleError(retryError as Error, { ...context, operation: 'retry_after_recovery' })
        throw retryError
      }
    }
    
    throw error
  }
}

// ============================================================================
// React Hook for Error Recovery
// ============================================================================

export const useErrorRecovery = () => {
  const [errors, setErrors] = useState<AppError[]>([])

  useEffect(() => {
    const unsubscribe = errorRecoveryManager.subscribe((error) => {
      setErrors(errorRecoveryManager.getErrors({ limit: 50 }))
    })

    // Initial load
    setErrors(errorRecoveryManager.getErrors({ limit: 50 }))

    return unsubscribe
  }, [])

  const handleError = useCallback((error: Error, context?: Partial<ErrorContext>) => {
    return errorRecoveryManager.handleError(error, context)
  }, [])

  const recoverError = useCallback(async (errorId: string) => {
    return errorRecoveryManager.attemptRecovery(errorId)
  }, [])

  const clearErrors = useCallback((filter?: { type?: ErrorType; resolved?: boolean }) => {
    return errorRecoveryManager.clearErrors(filter)
  }, [])

  return {
    errors,
    handleError,
    recoverError,
    clearErrors,
    stats: errorRecoveryManager.getStats(),
    manager: errorRecoveryManager
  }
}