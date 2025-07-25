// Error Logging and Debugging Tools
import React from 'react'
import { errorRecoveryManager } from '../store/errorHandling/errorRecovery'
import { ErrorReportingService } from '../services/errorReporting'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ErrorLogEntry {
  id: string
  timestamp: number
  level: 'error' | 'warn' | 'info' | 'debug'
  message: string
  error?: Error
  context?: any
  stack?: string
  userAgent: string
  url: string
  userId?: string
}

export interface DebugInfo {
  timestamp: number
  userAgent: string
  url: string
  viewport: { width: number; height: number }
  memory?: any
  connection?: any
  errors: ErrorLogEntry[]
  performance: any
}

// ============================================================================
// Error Logger Class
// ============================================================================

class ErrorLogger {
  private logs: ErrorLogEntry[] = []
  private maxLogs = 1000
  private isEnabled = true
  private debugMode = false

  constructor() {
    this.debugMode = import.meta.env?.MODE === 'development' || false
    this.setupConsoleInterception()
  }

  // ============================================================================
  // Logging Methods
  // ============================================================================

  log(level: 'error' | 'warn' | 'info' | 'debug', message: string, error?: Error, context?: any): string {
    if (!this.isEnabled) return ''

    const entry: ErrorLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level,
      message,
      error,
      context,
      stack: error?.stack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getUserId()
    }

    this.logs.push(entry)
    this.pruneLogs()

    // Console output in debug mode
    if (this.debugMode) {
      this.outputToConsole(entry)
    }

    // Send critical errors to error recovery system
    if (level === 'error' && error) {
      errorRecoveryManager.handleError(error, {
        operation: 'error_logger',
        additionalData: context
      })
    }

    return entry.id
  }

  error(message: string, error?: Error, context?: any): string {
    return this.log('error', message, error, context)
  }

  warn(message: string, context?: any): string {
    return this.log('warn', message, undefined, context)
  }

  info(message: string, context?: any): string {
    return this.log('info', message, undefined, context)
  }

  debug(message: string, context?: any): string {
    return this.log('debug', message, undefined, context)
  }

  // ============================================================================
  // Console Interception
  // ============================================================================

  private setupConsoleInterception(): void {
    if (typeof window === 'undefined') return

    const originalError = console.error
    const originalWarn = console.warn
    const originalLog = console.log

    console.error = (...args) => {
      this.interceptConsoleCall('error', args)
      originalError.apply(console, args)
    }

    console.warn = (...args) => {
      this.interceptConsoleCall('warn', args)
      originalWarn.apply(console, args)
    }

    console.log = (...args) => {
      if (this.debugMode) {
        this.interceptConsoleCall('info', args)
      }
      originalLog.apply(console, args)
    }
  }

  private interceptConsoleCall(level: 'error' | 'warn' | 'info', args: any[]): void {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')

    const error = args.find(arg => arg instanceof Error)
    const context = args.filter(arg => !(arg instanceof Error) && typeof arg === 'object')

    this.log(level, message, error, context.length > 0 ? context : undefined)
  }

  // ============================================================================
  // Debug Information
  // ============================================================================

  getDebugInfo(): DebugInfo {
    return {
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      memory: (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
      } : undefined,
      connection: (navigator as any).connection ? {
        effectiveType: (navigator as any).connection.effectiveType,
        downlink: (navigator as any).connection.downlink,
        rtt: (navigator as any).connection.rtt
      } : undefined,
      errors: this.logs.filter(log => log.level === 'error').slice(-10),
      performance: {
        navigation: performance.getEntriesByType('navigation')[0],
        timing: performance.timing
      }
    }
  }

  exportLogs(): string {
    return JSON.stringify({
      timestamp: Date.now(),
      debugInfo: this.getDebugInfo(),
      logs: this.logs,
      errorStats: errorRecoveryManager.getStats(),
      reportingStats: ErrorReportingService.getAnalytics()
    }, null, 2)
  }

  // ============================================================================
  // Log Management
  // ============================================================================

  getLogs(filter?: {
    level?: 'error' | 'warn' | 'info' | 'debug'
    since?: number
    limit?: number
  }): ErrorLogEntry[] {
    let filteredLogs = [...this.logs]

    if (filter) {
      if (filter.level) {
        filteredLogs = filteredLogs.filter(log => log.level === filter.level)
      }
      if (filter.since) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.since!)
      }
      if (filter.limit) {
        filteredLogs = filteredLogs.slice(-filter.limit)
      }
    }

    return filteredLogs.sort((a, b) => b.timestamp - a.timestamp)
  }

  clearLogs(): void {
    this.logs = []
    console.log('🧹 Error logs cleared')
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    console.log(`📝 Error logging ${enabled ? 'enabled' : 'disabled'}`)
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled
    console.log(`🐛 Debug mode ${enabled ? 'enabled' : 'disabled'}`)
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private outputToConsole(entry: ErrorLogEntry): void {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString()
    const prefix = `[${timestamp}] ${entry.level.toUpperCase()}`

    switch (entry.level) {
      case 'error':
        console.group(`🚨 ${prefix}: ${entry.message}`)
        if (entry.error) console.error('Error:', entry.error)
        if (entry.context) console.log('Context:', entry.context)
        console.groupEnd()
        break
      case 'warn':
        console.warn(`⚠️ ${prefix}: ${entry.message}`, entry.context || '')
        break
      case 'info':
        console.info(`ℹ️ ${prefix}: ${entry.message}`, entry.context || '')
        break
      case 'debug':
        console.debug(`🐛 ${prefix}: ${entry.message}`, entry.context || '')
        break
    }
  }

  private pruneLogs(): void {
    if (this.logs.length > this.maxLogs) {
      const toRemove = this.logs.length - this.maxLogs
      this.logs.splice(0, toRemove)
    }
  }

  private getUserId(): string | undefined {
    try {
      // Try to get user ID from various sources
      const unifiedStore = (window as any).__UNIFIED_STORE__
      if (unifiedStore?.user?.id) {
        return unifiedStore.user.id
      }

      const storedUser = localStorage.getItem('unified-store')
      if (storedUser) {
        const parsed = JSON.parse(storedUser)
        if (parsed.state?.user?.id) {
          return parsed.state.user.id
        }
      }
    } catch (error) {
      // Ignore errors when getting user ID
    }

    return undefined
  }
}

// ============================================================================
// Global Error Logger Instance
// ============================================================================

export const errorLogger = new ErrorLogger()

// ============================================================================
// React Hook for Error Logging
// ============================================================================

export const useErrorLogger = () => {
  const logError = React.useCallback((message: string, error?: Error, context?: any) => {
    return errorLogger.error(message, error, context)
  }, [])

  const logWarning = React.useCallback((message: string, context?: any) => {
    return errorLogger.warn(message, context)
  }, [])

  const logInfo = React.useCallback((message: string, context?: any) => {
    return errorLogger.info(message, context)
  }, [])

  const logDebug = React.useCallback((message: string, context?: any) => {
    return errorLogger.debug(message, context)
  }, [])

  return {
    logError,
    logWarning,
    logInfo,
    logDebug,
    getLogs: errorLogger.getLogs.bind(errorLogger),
    clearLogs: errorLogger.clearLogs.bind(errorLogger),
    exportLogs: errorLogger.exportLogs.bind(errorLogger),
    getDebugInfo: errorLogger.getDebugInfo.bind(errorLogger)
  }
}

// ============================================================================
// Debug Panel Component (for development)
// ============================================================================

export const createDebugPanel = () => {
  if (import.meta.env?.MODE !== 'development') return

  const panel = document.createElement('div')
  panel.id = 'error-debug-panel'
  panel.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    width: 300px;
    max-height: 400px;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    font-family: monospace;
    font-size: 12px;
    padding: 10px;
    border-radius: 5px;
    z-index: 10000;
    overflow-y: auto;
    display: none;
  `

  const toggle = document.createElement('button')
  toggle.textContent = '🐛'
  toggle.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    width: 30px;
    height: 30px;
    background: #ff4444;
    color: white;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    z-index: 10001;
    font-size: 16px;
  `

  let isVisible = false
  toggle.onclick = () => {
    isVisible = !isVisible
    panel.style.display = isVisible ? 'block' : 'none'
    if (isVisible) updatePanel()
  }

  const updatePanel = () => {
    const logs = errorLogger.getLogs({ limit: 20 })
    const debugInfo = errorLogger.getDebugInfo()
    
    panel.innerHTML = `
      <div style="margin-bottom: 10px;">
        <strong>Error Debug Panel</strong>
        <button onclick="errorLogger.clearLogs(); this.parentElement.parentElement.querySelector('.logs').innerHTML = 'Logs cleared'" 
                style="float: right; background: #666; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer;">
          Clear
        </button>
      </div>
      <div style="margin-bottom: 10px; font-size: 10px;">
        Memory: ${debugInfo.memory ? Math.round(debugInfo.memory.usedJSHeapSize / 1024 / 1024) + 'MB' : 'N/A'}<br>
        Errors: ${logs.filter(l => l.level === 'error').length}<br>
        Warnings: ${logs.filter(l => l.level === 'warn').length}
      </div>
      <div class="logs">
        ${logs.map(log => `
          <div style="margin-bottom: 5px; padding: 3px; background: rgba(255,255,255,0.1); border-radius: 3px;">
            <div style="color: ${log.level === 'error' ? '#ff6b6b' : log.level === 'warn' ? '#ffd93d' : '#6bcf7f'};">
              ${log.level.toUpperCase()}: ${log.message}
            </div>
            ${log.error ? `<div style="font-size: 10px; color: #ccc;">${log.error.message}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `
  }

  document.body.appendChild(toggle)
  document.body.appendChild(panel)

  // Update panel every 5 seconds if visible
  setInterval(() => {
    if (isVisible) updatePanel()
  }, 5000)
}

// ============================================================================
// Initialize Debug Panel in Development
// ============================================================================

if (import.meta.env?.MODE === 'development') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createDebugPanel)
  } else {
    createDebugPanel()
  }
}

export default errorLogger