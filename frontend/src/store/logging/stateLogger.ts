// Comprehensive State Management Logging System
import { StateSnapshot } from '../stateCoordinator'
import { isProductionEnvironment, shouldEnableFeature } from '../../config/monitoring.production'

// ============================================================================
// Logging Types and Interfaces
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  category: string
  message: string
  data?: any
  stack?: string
  userId?: string
  sessionId?: string
}

export interface LogFilter {
  level?: LogLevel
  category?: string
  startTime?: number
  endTime?: number
  userId?: string
  searchText?: string
}

export interface LoggerConfig {
  enabled: boolean
  level: LogLevel
  maxEntries: number
  persistToStorage: boolean
  sendToServer: boolean
  serverEndpoint?: string
  categories: string[]
  excludeCategories: string[]
}

// ============================================================================
// State Logger Implementation
// ============================================================================

class StateLogger {
  private logs: LogEntry[] = []
  private config: LoggerConfig
  private sessionId: string
  private logBuffer: LogEntry[] = []
  private flushTimer: number | null = null

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      enabled: true,
      level: 'info',
      maxEntries: 1000,
      persistToStorage: true,
      sendToServer: false,
      categories: [],
      excludeCategories: [],
      ...config
    }
    
    this.sessionId = this.generateSessionId()
    this.loadPersistedLogs()
    this.setupPeriodicFlush()
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private shouldLog(level: LogLevel, category: string): boolean {
    if (!this.config.enabled) return false
    
    const levelPriority = { debug: 0, info: 1, warn: 2, error: 3 }
    if (levelPriority[level] < levelPriority[this.config.level]) return false
    
    if (this.config.categories.length > 0 && !this.config.categories.includes(category)) {
      return false
    }
    
    if (this.config.excludeCategories.includes(category)) {
      return false
    }
    
    return true
  }

  private createLogEntry(
    level: LogLevel,
    category: string,
    message: string,
    data?: any,
    userId?: string
  ): LogEntry {
    return {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
      stack: level === 'error' ? new Error().stack : undefined,
      userId,
      sessionId: this.sessionId
    }
  }

  private addLogEntry(entry: LogEntry): void {
    this.logs.push(entry)
    this.logBuffer.push(entry)
    
    // Maintain max entries limit
    if (this.logs.length > this.config.maxEntries) {
      this.logs = this.logs.slice(-this.config.maxEntries)
    }
    
    // Console output - disabled in production unless it's an error
    if (typeof window !== 'undefined') {
      if (!isProductionEnvironment() || entry.level === 'error') {
        const consoleMethod = entry.level === 'error' ? 'error' :
                             entry.level === 'warn' ? 'warn' : 'log'
        console[consoleMethod](`[${entry.category}] ${entry.message}`, entry.data || '')
      }
    }
  }

  private setupPeriodicFlush(): void {
    if (this.config.persistToStorage || this.config.sendToServer) {
      this.flushTimer = window.setInterval(() => {
        this.flush()
      }, 5000) // Flush every 5 seconds
    }
  }

  private loadPersistedLogs(): void {
    if (!this.config.persistToStorage || typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem('state-logger-logs')
      if (stored) {
        const parsedLogs = JSON.parse(stored) as LogEntry[]
        this.logs = parsedLogs.slice(-this.config.maxEntries)
      }
    } catch (error) {
      console.error('Failed to load persisted logs:', error)
    }
  }

  private persistLogs(): void {
    if (!this.config.persistToStorage || typeof window === 'undefined') return
    
    try {
      localStorage.setItem('state-logger-logs', JSON.stringify(this.logs))
    } catch (error) {
      console.error('Failed to persist logs:', error)
    }
  }

  private async sendLogsToServer(logs: LogEntry[]): Promise<void> {
    if (!this.config.sendToServer || !this.config.serverEndpoint) return
    
    try {
      await fetch(this.config.serverEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          logs
        })
      })
    } catch (error) {
      console.error('Failed to send logs to server:', error)
    }
  }

  // Public API
  debug(category: string, message: string, data?: any, userId?: string): void {
    if (this.shouldLog('debug', category)) {
      this.addLogEntry(this.createLogEntry('debug', category, message, data, userId))
    }
  }

  info(category: string, message: string, data?: any, userId?: string): void {
    if (this.shouldLog('info', category)) {
      this.addLogEntry(this.createLogEntry('info', category, message, data, userId))
    }
  }

  warn(category: string, message: string, data?: any, userId?: string): void {
    if (this.shouldLog('warn', category)) {
      this.addLogEntry(this.createLogEntry('warn', category, message, data, userId))
    }
  }

  error(category: string, message: string, data?: any, userId?: string): void {
    if (this.shouldLog('error', category)) {
      this.addLogEntry(this.createLogEntry('error', category, message, data, userId))
    }
  }

  // Store-specific logging methods
  logStoreAction(storeName: string, action: string, payload?: any, userId?: string): void {
    this.info('store-action', `${storeName}.${action}`, payload, userId)
  }

  logStoreError(storeName: string, error: Error, context?: any, userId?: string): void {
    this.error('store-error', `${storeName}: ${error.message}`, { error, context }, userId)
  }

  logCacheOperation(operation: string, key: string, hit: boolean, userId?: string): void {
    this.debug('cache', `${operation} - ${key} (${hit ? 'HIT' : 'MISS'})`, { operation, key, hit }, userId)
  }

  logSyncOperation(operation: string, status: 'start' | 'success' | 'error', details?: any, userId?: string): void {
    const level = status === 'error' ? 'error' : 'info'
    this.addLogEntry(this.createLogEntry(level, 'sync', `${operation} - ${status}`, details, userId))
  }

  logPerformanceMetric(metric: string, value: number, unit: string, userId?: string): void {
    this.debug('performance', `${metric}: ${value}${unit}`, { metric, value, unit }, userId)
  }

  // Query and filtering
  getLogs(filter?: LogFilter): LogEntry[] {
    let filteredLogs = [...this.logs]
    
    if (filter) {
      if (filter.level) {
        const levelPriority = { debug: 0, info: 1, warn: 2, error: 3 }
        filteredLogs = filteredLogs.filter(log => 
          levelPriority[log.level] >= levelPriority[filter.level!]
        )
      }
      
      if (filter.category) {
        filteredLogs = filteredLogs.filter(log => log.category === filter.category)
      }
      
      if (filter.startTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.startTime!)
      }
      
      if (filter.endTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= filter.endTime!)
      }
      
      if (filter.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === filter.userId)
      }
      
      if (filter.searchText) {
        const searchLower = filter.searchText.toLowerCase()
        filteredLogs = filteredLogs.filter(log => 
          log.message.toLowerCase().includes(searchLower) ||
          (log.data && JSON.stringify(log.data).toLowerCase().includes(searchLower))
        )
      }
    }
    
    return filteredLogs.sort((a, b) => b.timestamp - a.timestamp)
  }

  getLogsByCategory(category: string): LogEntry[] {
    return this.getLogs({ category })
  }

  getErrorLogs(): LogEntry[] {
    return this.getLogs({ level: 'error' })
  }

  getRecentLogs(minutes: number = 10): LogEntry[] {
    const startTime = Date.now() - (minutes * 60 * 1000)
    return this.getLogs({ startTime })
  }

  // Statistics
  getLogStatistics(): {
    total: number
    byLevel: Record<LogLevel, number>
    byCategory: Record<string, number>
    errorRate: number
    recentActivity: number
  } {
    const stats = {
      total: this.logs.length,
      byLevel: { debug: 0, info: 0, warn: 0, error: 0 } as Record<LogLevel, number>,
      byCategory: {} as Record<string, number>,
      errorRate: 0,
      recentActivity: 0
    }
    
    const recentTime = Date.now() - (10 * 60 * 1000) // Last 10 minutes
    
    this.logs.forEach(log => {
      stats.byLevel[log.level]++
      stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1
      
      if (log.timestamp >= recentTime) {
        stats.recentActivity++
      }
    })
    
    stats.errorRate = stats.total > 0 ? (stats.byLevel.error / stats.total) * 100 : 0
    
    return stats
  }

  // Management
  flush(): void {
    if (this.logBuffer.length === 0) return
    
    const logsToFlush = [...this.logBuffer]
    this.logBuffer = []
    
    if (this.config.persistToStorage) {
      this.persistLogs()
    }
    
    if (this.config.sendToServer) {
      this.sendLogsToServer(logsToFlush).catch(console.error)
    }
  }

  clear(): void {
    this.logs = []
    this.logBuffer = []
    
    if (this.config.persistToStorage && typeof window !== 'undefined') {
      localStorage.removeItem('state-logger-logs')
    }
  }

  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    
    this.setupPeriodicFlush()
  }

  exportLogs(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      exportTime: Date.now(),
      logs: this.logs,
      config: this.config
    }, null, 2)
  }

  importLogs(data: string): void {
    try {
      const parsed = JSON.parse(data)
      if (parsed.logs && Array.isArray(parsed.logs)) {
        this.logs = parsed.logs.slice(-this.config.maxEntries)
        this.persistLogs()
      }
    } catch (error) {
      this.error('logger', 'Failed to import logs', { error })
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    this.flush()
  }
}

// ============================================================================
// Global Logger Instance
// ============================================================================

// Configure logger based on environment
const getLoggerConfig = (): Partial<LoggerConfig> => {
  if (isProductionEnvironment()) {
    return {
      enabled: true,
      level: 'warn', // Only warnings and errors in production
      maxEntries: 100, // Reduced for production
      persistToStorage: false, // Disabled in production for privacy
      sendToServer: false,
      categories: [],
      excludeCategories: ['debug', 'performance', 'cache'] // Exclude verbose categories
    }
  } else if (shouldEnableFeature('verboseLogging')) {
    return {
      enabled: true,
      level: 'debug',
      maxEntries: 2000,
      persistToStorage: true,
      sendToServer: false,
      categories: [],
      excludeCategories: []
    }
  } else {
    return {
      enabled: true,
      level: 'info',
      maxEntries: 500,
      persistToStorage: true,
      sendToServer: false,
      categories: [],
      excludeCategories: ['debug']
    }
  }
}

export const stateLogger = new StateLogger(getLoggerConfig())

// ============================================================================
// React Hooks for Logging
// ============================================================================

export const useStateLogger = () => {
  return {
    debug: stateLogger.debug.bind(stateLogger),
    info: stateLogger.info.bind(stateLogger),
    warn: stateLogger.warn.bind(stateLogger),
    error: stateLogger.error.bind(stateLogger),
    logStoreAction: stateLogger.logStoreAction.bind(stateLogger),
    logStoreError: stateLogger.logStoreError.bind(stateLogger),
    logCacheOperation: stateLogger.logCacheOperation.bind(stateLogger),
    logSyncOperation: stateLogger.logSyncOperation.bind(stateLogger),
    logPerformanceMetric: stateLogger.logPerformanceMetric.bind(stateLogger),
    getLogs: stateLogger.getLogs.bind(stateLogger),
    getLogStatistics: stateLogger.getLogStatistics.bind(stateLogger),
    clear: stateLogger.clear.bind(stateLogger),
    exportLogs: stateLogger.exportLogs.bind(stateLogger)
  }
}

// ============================================================================
// Development Tools Integration
// ============================================================================

if (typeof window !== 'undefined') {
  (window as any).__STATE_LOGGER__ = stateLogger
}