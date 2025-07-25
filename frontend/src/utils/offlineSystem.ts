// Offline System Initialization and Management
// Main entry point for the comprehensive offline queue system

import { initializeOfflineQueue, cleanupOfflineQueue } from '../store/offlineQueue'
import { initializeOfflineSync, syncControl } from '../api/offlineSync'
import { conflictManager } from './conflictResolution'
import { queueManagement } from './queueManagement'

// ============================================================================
// System Configuration
// ============================================================================

export interface OfflineSystemConfig {
  // Queue settings
  maxRetries: number
  retryDelayMs: number
  maxRetryDelayMs: number
  batchSize: number
  syncIntervalMs: number
  networkCheckIntervalMs: number
  
  // Auto-sync settings
  enableAutoSync: boolean
  autoSyncIntervalMs: number
  
  // Conflict resolution
  enableConflictResolution: boolean
  defaultConflictStrategy: 'SERVER_WINS' | 'CLIENT_WINS' | 'MERGE' | 'TIMESTAMP_WINS'
  
  // UI settings
  showOfflineIndicator: boolean
  indicatorPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  
  // Debug settings
  enableDebugMode: boolean
  logLevel: 'error' | 'warn' | 'info' | 'debug'
}

const DEFAULT_CONFIG: OfflineSystemConfig = {
  // Queue settings
  maxRetries: 3,
  retryDelayMs: 1000,
  maxRetryDelayMs: 30000,
  batchSize: 5,
  syncIntervalMs: 30000,
  networkCheckIntervalMs: 10000,
  
  // Auto-sync settings
  enableAutoSync: true,
  autoSyncIntervalMs: 30000,
  
  // Conflict resolution
  enableConflictResolution: true,
  defaultConflictStrategy: 'TIMESTAMP_WINS',
  
  // UI settings
  showOfflineIndicator: true,
  indicatorPosition: 'top-right',
  
  // Debug settings
  enableDebugMode: false,
  logLevel: 'info'
}

// ============================================================================
// System State Management
// ============================================================================

class OfflineSystemManager {
  private config: OfflineSystemConfig
  private initialized = false
  private cleanupFunctions: Array<() => void> = []

  constructor(config: Partial<OfflineSystemConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('Offline system already initialized')
      return
    }

    try {
      console.log('🚀 Initializing offline system...')
      
      // Initialize queue system
      const queueCleanup = await initializeOfflineQueue()
      this.cleanupFunctions.push(queueCleanup)
      
      // Configure queue settings
      const { useOfflineQueue } = await import('../store/offlineQueue')
      useOfflineQueue.getState().updateConfig({
        maxRetries: this.config.maxRetries,
        retryDelayMs: this.config.retryDelayMs,
        maxRetryDelayMs: this.config.maxRetryDelayMs,
        batchSize: this.config.batchSize,
        syncIntervalMs: this.config.syncIntervalMs,
        networkCheckIntervalMs: this.config.networkCheckIntervalMs
      })
      
      // Initialize sync service
      const syncCleanup = initializeOfflineSync()
      this.cleanupFunctions.push(syncCleanup)
      
      // Start auto-sync if enabled
      if (this.config.enableAutoSync) {
        syncControl.start(this.config.autoSyncIntervalMs)
        this.cleanupFunctions.push(() => syncControl.stop())
      }
      
      // Set up debug mode
      if (this.config.enableDebugMode) {
        this.enableDebugMode()
      }
      
      // Set up periodic health checks
      this.setupHealthMonitoring()
      
      this.initialized = true
      console.log('✅ Offline system initialized successfully')
      
      // Log initial system status
      this.logSystemStatus()
      
    } catch (error) {
      console.error('❌ Failed to initialize offline system:', error)
      throw error
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return
    }

    console.log('🛑 Shutting down offline system...')
    
    // Run all cleanup functions
    this.cleanupFunctions.forEach(cleanup => {
      try {
        cleanup()
      } catch (error) {
        console.error('Error during cleanup:', error)
      }
    })
    
    this.cleanupFunctions = []
    
    // Final cleanup
    cleanupOfflineQueue()
    syncControl.stop()
    
    this.initialized = false
    console.log('✅ Offline system shut down successfully')
  }

  private enableDebugMode(): void {
    // Add global debug functions
    if (typeof window !== 'undefined') {
      (window as any).offlineDebug = {
        logQueue: () => queueManagement.debugger.logQueueState(),
        simulateOffline: (duration?: number) => queueManagement.debugger.simulateNetworkFailure(duration),
        createTestOps: (count?: number) => queueManagement.debugger.createTestOperations(count),
        clearTestOps: () => queueManagement.debugger.clearTestOperations(),
        exportQueue: () => queueManagement.exporter.downloadExport('json'),
        getAnalytics: () => queueManagement.analyzer.analyzeQueue(),
        getHealth: () => queueManagement.analyzer.assessQueueHealth(),
        forceSync: () => syncControl.forceSync(),
        clearQueue: async () => {
          const { useOfflineQueue } = await import('../store/offlineQueue')
          useOfflineQueue.getState().clearQueue()
        }
      }
      
      console.log('🐛 Debug mode enabled. Use window.offlineDebug for debugging tools.')
    }
  }

  private setupHealthMonitoring(): void {
    // Periodic health checks
    const healthCheckInterval = setInterval(() => {
      const health = queueManagement.analyzer.assessQueueHealth()
      
      if (health.status === 'CRITICAL') {
        console.warn('🚨 Queue health is CRITICAL:', health.issues)
        
        // Auto-recovery actions
        if (health.issues.some(issue => issue.includes('Large queue size'))) {
          // Increase batch size temporarily
          import('../store/offlineQueue').then(({ useOfflineQueue }) => {
            const currentConfig = useOfflineQueue.getState().config
            useOfflineQueue.getState().updateConfig({
              batchSize: Math.min(currentConfig.batchSize * 2, 20)
            })
            console.log('🔧 Auto-recovery: Increased batch size')
          })
        }
        
        if (health.issues.some(issue => issue.includes('High error count'))) {
          // Clear old errors
          import('../store/offlineQueue').then(({ useOfflineQueue }) => {
            const errors = useOfflineQueue.getState().errors
            if (errors.length > 20) {
              useOfflineQueue.getState().clearErrors()
              console.log('🔧 Auto-recovery: Cleared old errors')
            }
          })
        }
      }
      
      if (this.config.enableDebugMode && health.status !== 'HEALTHY') {
        console.log('📊 Queue Health Check:', health)
      }
      
    }, 60000) // Check every minute
    
    this.cleanupFunctions.push(() => clearInterval(healthCheckInterval))
  }

  private logSystemStatus(): void {
    const analytics = queueManagement.analyzer.analyzeQueue()
    const health = queueManagement.analyzer.assessQueueHealth()
    
    console.group('📊 Offline System Status')
    console.log('Config:', this.config)
    console.log('Queue Analytics:', analytics)
    console.log('System Health:', health)
    console.groupEnd()
  }

  // Public API methods
  getConfig(): OfflineSystemConfig {
    return { ...this.config }
  }

  updateConfig(updates: Partial<OfflineSystemConfig>): void {
    this.config = { ...this.config, ...updates }
    
    // Apply queue config updates
    if (this.initialized) {
      import('../store/offlineQueue').then(({ useOfflineQueue }) => {
        useOfflineQueue.getState().updateConfig({
          maxRetries: this.config.maxRetries,
          retryDelayMs: this.config.retryDelayMs,
          maxRetryDelayMs: this.config.maxRetryDelayMs,
          batchSize: this.config.batchSize,
          syncIntervalMs: this.config.syncIntervalMs,
          networkCheckIntervalMs: this.config.networkCheckIntervalMs
        })
      })
      
      // Update auto-sync if needed
      if (updates.enableAutoSync !== undefined || updates.autoSyncIntervalMs !== undefined) {
        syncControl.stop()
        if (this.config.enableAutoSync) {
          syncControl.start(this.config.autoSyncIntervalMs)
        }
      }
    }
  }

  isInitialized(): boolean {
    return this.initialized
  }

  async getSystemStatus() {
    if (!this.initialized) {
      return { status: 'NOT_INITIALIZED' }
    }

    const analytics = queueManagement.analyzer.analyzeQueue()
    const health = queueManagement.analyzer.assessQueueHealth()
    const { useOfflineQueue } = await import('../store/offlineQueue')
    const queueStatus = useOfflineQueue.getState()

    return {
      status: 'INITIALIZED',
      config: this.config,
      analytics,
      health,
      networkStatus: queueStatus.networkStatus,
      queueStatus: queueStatus.queueStatus,
      queueSize: queueStatus.queue.length,
      lastSync: queueStatus.lastSuccessfulSync
    }
  }
}

// ============================================================================
// Global System Instance
// ============================================================================

let systemInstance: OfflineSystemManager | null = null

export const initializeOfflineSystem = async (config?: Partial<OfflineSystemConfig>): Promise<OfflineSystemManager> => {
  if (systemInstance) {
    console.warn('Offline system already exists. Use getOfflineSystem() to access it.')
    return systemInstance
  }

  systemInstance = new OfflineSystemManager(config)
  await systemInstance.initialize()
  return systemInstance
}

export const getOfflineSystem = (): OfflineSystemManager | null => {
  return systemInstance
}

export const shutdownOfflineSystem = async (): Promise<void> => {
  if (systemInstance) {
    await systemInstance.shutdown()
    systemInstance = null
  }
}

// ============================================================================
// React Integration Hooks
// ============================================================================

export const useOfflineSystem = () => {
  const [systemStatus, setSystemStatus] = React.useState<any>(null)
  
  React.useEffect(() => {
    const updateStatus = async () => {
      if (systemInstance) {
        const status = await systemInstance.getSystemStatus()
        setSystemStatus(status)
      }
    }
    
    updateStatus()
    const interval = setInterval(updateStatus, 5000)
    
    return () => clearInterval(interval)
  }, [])
  
  return {
    system: systemInstance,
    status: systemStatus,
    isInitialized: systemInstance?.isInitialized() || false
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

export const offlineSystem = {
  // Core functions
  initialize: initializeOfflineSystem,
  get: getOfflineSystem,
  shutdown: shutdownOfflineSystem,
  
  // Quick access to subsystems
  get queue() {
    return queueManagement
  },
  
  get sync() {
    return syncControl
  },
  
  get conflicts() {
    return conflictManager
  },
  
  // Utility functions
  async forceSync() {
    await syncControl.forceSync()
  },
  
  async clearQueue() {
    const { useOfflineQueue } = await import('../store/offlineQueue')
    useOfflineQueue.getState().clearQueue()
  },
  
  async getStatus() {
    return systemInstance?.getSystemStatus() || { status: 'NOT_INITIALIZED' }
  },
  
  enableDebugMode() {
    if (systemInstance) {
      systemInstance.updateConfig({ enableDebugMode: true })
    }
  }
}

// Add React import for hooks
import React from 'react'

export default offlineSystem