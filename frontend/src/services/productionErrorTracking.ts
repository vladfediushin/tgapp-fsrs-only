/**
 * Production Error Tracking Service
 * Lightweight Sentry integration and error reporting for production
 */

import { productionMonitoringConfig, isProductionEnvironment } from '../config/monitoring.production'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ErrorTrackingService {
  initialize(): Promise<void>
  captureError(error: Error, context?: ErrorContext): string
  captureMessage(message: string, level?: ErrorLevel, context?: ErrorContext): string
  setUser(user: UserContext): void
  setTag(key: string, value: string): void
  setContext(key: string, context: Record<string, any>): void
  addBreadcrumb(breadcrumb: Breadcrumb): void
}

export interface ErrorContext {
  component?: string
  action?: string
  route?: string
  userId?: string
  sessionId?: string
  extra?: Record<string, any>
}

export interface UserContext {
  id?: string
  username?: string
  email?: string
}

export interface Breadcrumb {
  message: string
  category?: string
  level?: ErrorLevel
  timestamp?: number
  data?: Record<string, any>
}

export type ErrorLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal'

// ============================================================================
// Sentry Integration (Lazy Loaded)
// ============================================================================

let sentryInstance: any = null
let sentryLoaded = false

const loadSentry = async (): Promise<any> => {
  if (sentryLoaded) return sentryInstance

  try {
    // Dynamically import Sentry only when needed
    const Sentry = await import('@sentry/browser')
    const { Integrations } = await import('@sentry/tracing')

    const config = productionMonitoringConfig.errorTracking

    if (config.sentryDsn) {
      Sentry.init({
        dsn: config.sentryDsn,
        environment: productionMonitoringConfig.environment,
        release: productionMonitoringConfig.version,
        sampleRate: config.sampleRate,
        
        integrations: [
          new Integrations.BrowserTracing({
            // Disable automatic route change tracking in production
            routingInstrumentation: isProductionEnvironment() ? undefined : Sentry.browserTracingIntegration(),
          }),
        ],
        
        // Performance monitoring
        tracesSampleRate: isProductionEnvironment() ? 0.01 : 0.1,
        
        // Filter out noise
        beforeSend(event, hint) {
          // Filter out development-only errors
          if (event.exception?.values?.[0]?.value?.includes('ResizeObserver loop limit exceeded')) {
            return null
          }
          
          // Filter out network errors that are not actionable
          if (event.exception?.values?.[0]?.value?.includes('NetworkError')) {
            return null
          }
          
          return event
        },
        
        // Reduce noise in production
        ignoreErrors: [
          'ResizeObserver loop limit exceeded',
          'Non-Error promise rejection captured',
          'NetworkError when attempting to fetch resource',
          'The operation was aborted',
          'AbortError',
        ],
      })

      sentryInstance = Sentry
      sentryLoaded = true
      
      console.log(`Sentry initialized for ${productionMonitoringConfig.environment}`)
    }
  } catch (error) {
    console.warn('Failed to load Sentry:', error)
  }

  return sentryInstance
}

// ============================================================================
// Production Error Tracking Implementation
// ============================================================================

class ProductionErrorTrackingService implements ErrorTrackingService {
  private initialized = false
  private errorQueue: Array<{ error: Error; context?: ErrorContext }> = []
  private messageQueue: Array<{ message: string; level: ErrorLevel; context?: ErrorContext }> = []

  async initialize(): Promise<void> {
    if (this.initialized) return

    const config = productionMonitoringConfig.errorTracking
    
    if (config.enabled && config.sentryDsn) {
      await loadSentry()
    }

    this.initialized = true
    
    // Process queued errors
    this.processQueue()
  }

  captureError(error: Error, context?: ErrorContext): string {
    const errorId = this.generateErrorId()
    
    if (!this.initialized) {
      this.errorQueue.push({ error, context })
      return errorId
    }

    try {
      if (sentryInstance) {
        sentryInstance.withScope((scope: any) => {
          if (context) {
            scope.setTag('component', context.component || 'unknown')
            scope.setTag('action', context.action || 'unknown')
            scope.setContext('errorContext', context)
          }
          
          scope.setTag('errorId', errorId)
          sentryInstance.captureException(error)
        })
      }

      // Always log to console in non-production environments
      if (!isProductionEnvironment()) {
        console.error('Error captured:', error, context)
      }

    } catch (captureError) {
      console.warn('Failed to capture error:', captureError)
    }

    return errorId
  }

  captureMessage(message: string, level: ErrorLevel = 'info', context?: ErrorContext): string {
    const messageId = this.generateErrorId()
    
    if (!this.initialized) {
      this.messageQueue.push({ message, level, context })
      return messageId
    }

    try {
      if (sentryInstance) {
        sentryInstance.withScope((scope: any) => {
          if (context) {
            scope.setContext('messageContext', context)
          }
          
          scope.setTag('messageId', messageId)
          sentryInstance.captureMessage(message, level)
        })
      }

      // Always log to console in non-production environments
      if (!isProductionEnvironment()) {
        console.log(`Message captured [${level}]:`, message, context)
      }

    } catch (captureError) {
      console.warn('Failed to capture message:', captureError)
    }

    return messageId
  }

  setUser(user: UserContext): void {
    if (sentryInstance) {
      sentryInstance.setUser(user)
    }
  }

  setTag(key: string, value: string): void {
    if (sentryInstance) {
      sentryInstance.setTag(key, value)
    }
  }

  setContext(key: string, context: Record<string, any>): void {
    if (sentryInstance) {
      sentryInstance.setContext(key, context)
    }
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    if (sentryInstance) {
      sentryInstance.addBreadcrumb({
        message: breadcrumb.message,
        category: breadcrumb.category || 'custom',
        level: breadcrumb.level || 'info',
        timestamp: breadcrumb.timestamp || Date.now() / 1000,
        data: breadcrumb.data,
      })
    }
  }

  private processQueue(): void {
    // Process queued errors
    while (this.errorQueue.length > 0) {
      const { error, context } = this.errorQueue.shift()!
      this.captureError(error, context)
    }

    // Process queued messages
    while (this.messageQueue.length > 0) {
      const { message, level, context } = this.messageQueue.shift()!
      this.captureMessage(message, level, context)
    }
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// ============================================================================
// Global Error Handlers
// ============================================================================

const setupGlobalErrorHandlers = (errorTracker: ErrorTrackingService) => {
  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    errorTracker.captureError(
      new Error(event.reason || 'Unhandled promise rejection'),
      {
        component: 'global',
        action: 'unhandled_promise_rejection',
        extra: { reason: event.reason }
      }
    )
  })

  // Global JavaScript errors
  window.addEventListener('error', (event) => {
    errorTracker.captureError(
      event.error || new Error(event.message),
      {
        component: 'global',
        action: 'javascript_error',
        extra: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      }
    )
  })
}

// ============================================================================
// Service Instance
// ============================================================================

export const productionErrorTracker = new ProductionErrorTrackingService()

// Initialize global error handlers
setupGlobalErrorHandlers(productionErrorTracker)

// ============================================================================
// React Error Boundary Integration
// ============================================================================

export const captureReactError = (error: Error, errorInfo: { componentStack: string }) => {
  productionErrorTracker.captureError(error, {
    component: 'react_error_boundary',
    action: 'component_error',
    extra: {
      componentStack: errorInfo.componentStack
    }
  })
}

// ============================================================================
// Utility Functions
// ============================================================================

export const withErrorTracking = <T extends (...args: any[]) => any>(
  fn: T,
  context?: Omit<ErrorContext, 'extra'>
): T => {
  return ((...args: any[]) => {
    try {
      const result = fn(...args)
      
      // Handle async functions
      if (result instanceof Promise) {
        return result.catch((error) => {
          productionErrorTracker.captureError(error, {
            ...context,
            extra: { args }
          })
          throw error
        })
      }
      
      return result
    } catch (error) {
      productionErrorTracker.captureError(error as Error, {
        ...context,
        extra: { args }
      })
      throw error
    }
  }) as T
}

export const trackUserAction = (action: string, component: string, data?: Record<string, any>) => {
  productionErrorTracker.addBreadcrumb({
    message: `User action: ${action}`,
    category: 'user',
    level: 'info',
    data: {
      component,
      action,
      ...data
    }
  })
}

// ============================================================================
// Export Default Service
// ============================================================================

export default productionErrorTracker