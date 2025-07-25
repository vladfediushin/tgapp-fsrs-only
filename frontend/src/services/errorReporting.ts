// Error Reporting Service - Handles error analytics and reporting
import React from 'react'
import { errorRecoveryManager } from '../store/errorHandling/errorRecovery'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ErrorReport {
  errorId: string
  level: 'global' | 'page' | 'component'
  context?: string
  componentStack?: string
  retryCount: number
  userReported?: boolean
  timestamp: number
  userAgent: string
  url: string
  userId?: string
  sessionId?: string
}

export interface ErrorAnalytics {
  totalErrors: number
  errorsByType: Record<string, number>
  errorsByLevel: Record<string, number>
  recoveryRate: number
  averageRetryCount: number
}

// ============================================================================
// Error Reporting Service
// ============================================================================

class ErrorReportingServiceClass {
  private reports: ErrorReport[] = []
  private maxReports = 1000
  private sessionId: string
  private isEnabled = true

  constructor() {
    this.sessionId = this.generateSessionId()
    this.setupGlobalErrorReporting()
  }

  // ============================================================================
  // Core Reporting Methods
  // ============================================================================

  reportError(error: Error, context: Partial<ErrorReport> = {}): string {
    if (!this.isEnabled) return ''

    const report: ErrorReport = {
      errorId: context.errorId || this.generateErrorId(),
      level: context.level || 'component',
      context: context.context,
      componentStack: context.componentStack,
      retryCount: context.retryCount || 0,
      userReported: context.userReported || false,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getUserId(),
      sessionId: this.sessionId,
      ...context
    }

    // Store report locally
    this.reports.push(report)
    this.pruneReports()

    // Log to console in development
    if (import.meta.env?.MODE === 'development') {
      console.group(`📊 Error Report: ${report.errorId}`)
      console.log('Error:', error)
      console.log('Report:', report)
      console.groupEnd()
    }

    // Send to analytics service (mock implementation)
    this.sendToAnalytics(report, error)

    return report.errorId
  }

  reportRecovery(errorId: string, successful: boolean, recoveryType: string): void {
    if (!this.isEnabled) return

    const report = this.reports.find(r => r.errorId === errorId)
    if (report) {
      // Update report with recovery information
      ;(report as any).recovered = successful
      ;(report as any).recoveryType = recoveryType
      ;(report as any).recoveryTimestamp = Date.now()
    }

    // Log recovery attempt
    console.log(`🔄 Recovery ${successful ? 'successful' : 'failed'}: ${errorId} (${recoveryType})`)
  }

  // ============================================================================
  // Analytics and Insights
  // ============================================================================

  getAnalytics(): ErrorAnalytics {
    const totalErrors = this.reports.length
    const errorsByType: Record<string, number> = {}
    const errorsByLevel: Record<string, number> = {}
    let totalRecovered = 0
    let totalRetries = 0

    for (const report of this.reports) {
      // Count by level
      errorsByLevel[report.level] = (errorsByLevel[report.level] || 0) + 1

      // Count by context/type
      const type = report.context || 'unknown'
      errorsByType[type] = (errorsByType[type] || 0) + 1

      // Count recoveries
      if ((report as any).recovered) {
        totalRecovered++
      }

      // Sum retries
      totalRetries += report.retryCount
    }

    return {
      totalErrors,
      errorsByType,
      errorsByLevel,
      recoveryRate: totalErrors > 0 ? totalRecovered / totalErrors : 0,
      averageRetryCount: totalErrors > 0 ? totalRetries / totalErrors : 0
    }
  }

  getRecentErrors(limit = 10): ErrorReport[] {
    return this.reports
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
  }

  getErrorsByLevel(level: 'global' | 'page' | 'component'): ErrorReport[] {
    return this.reports.filter(report => report.level === level)
  }

  // ============================================================================
  // Configuration and Management
  // ============================================================================

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    console.log(`Error reporting ${enabled ? 'enabled' : 'disabled'}`)
  }

  clearReports(): void {
    this.reports = []
    console.log('Error reports cleared')
  }

  exportReports(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      timestamp: Date.now(),
      reports: this.reports,
      analytics: this.getAnalytics()
    }, null, 2)
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getUserId(): string | undefined {
    // Try to get user ID from various sources
    try {
      // From unified store
      const unifiedStore = (window as any).__UNIFIED_STORE__
      if (unifiedStore?.user?.id) {
        return unifiedStore.user.id
      }

      // From localStorage
      const storedUser = localStorage.getItem('unified-store')
      if (storedUser) {
        const parsed = JSON.parse(storedUser)
        if (parsed.state?.user?.id) {
          return parsed.state.user.id
        }
      }
    } catch (error) {
      console.warn('Could not retrieve user ID for error reporting:', error)
    }

    return undefined
  }

  private pruneReports(): void {
    if (this.reports.length > this.maxReports) {
      const toRemove = this.reports.length - this.maxReports
      this.reports.splice(0, toRemove)
    }
  }

  private setupGlobalErrorReporting(): void {
    // Report unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError(new Error(event.reason), {
        level: 'global',
        context: 'unhandled_promise_rejection'
      })
    })

    // Report global JavaScript errors
    window.addEventListener('error', (event) => {
      this.reportError(event.error || new Error(event.message), {
        level: 'global',
        context: 'javascript_error'
      })
    })
  }

  private async sendToAnalytics(report: ErrorReport, error: Error): Promise<void> {
    try {
      // Mock analytics service - replace with real implementation
      if (import.meta.env?.MODE === 'development') {
        console.log('📈 Would send to analytics:', { report, error: error.message })
        return
      }

      // Example: Send to external service
      // await fetch('/api/analytics/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ report, error: error.message })
      // })
    } catch (analyticsError) {
      console.warn('Failed to send error to analytics:', analyticsError)
    }
  }
}

// ============================================================================
// Export Singleton Instance
// ============================================================================

export const ErrorReportingService = new ErrorReportingServiceClass()

// ============================================================================
// React Hook for Error Reporting
// ============================================================================

export const useErrorReporting = () => {
  const reportError = React.useCallback((error: Error, context?: Partial<ErrorReport>) => {
    return ErrorReportingService.reportError(error, context)
  }, [])

  const reportRecovery = React.useCallback((errorId: string, successful: boolean, recoveryType: string) => {
    ErrorReportingService.reportRecovery(errorId, successful, recoveryType)
  }, [])

  const getAnalytics = React.useCallback(() => {
    return ErrorReportingService.getAnalytics()
  }, [])

  return {
    reportError,
    reportRecovery,
    getAnalytics,
    getRecentErrors: ErrorReportingService.getRecentErrors.bind(ErrorReportingService),
    clearReports: ErrorReportingService.clearReports.bind(ErrorReportingService),
    exportReports: ErrorReportingService.exportReports.bind(ErrorReportingService)
  }
}

export default ErrorReportingService