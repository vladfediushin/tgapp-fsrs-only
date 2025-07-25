// Offline System Management
// Consolidated from offlineSystem.ts and related offline utilities
// Provides comprehensive offline functionality, queue management, and sync coordination

import { initializeOfflineQueue, cleanupOfflineQueue } from '../../store/offlineQueue'
import { initializeOfflineSync, syncControl } from '../../api/offlineSync'
import { conflictManager } from '../conflictResolution'
import { queueManagement } from '../queueManagement'
import React from 'react'

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

export interface OfflineCapabilities {
  isOnline: boolean
  hasOfflineSupport: boolean
  canSync: boolean
  queueSize: number
  lastSyncTime: number | null
  syncInProgress: boolean
}

export interface OfflineMetrics {
  totalOperations: number
  successfulSyncs: number
  failedSyncs: number
  averageQueueTime: number
  networkDowntime: number
  dataUsageSaved: number
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
  private networkStatus: boolean = navigator.onLine
  private capabilities: OfflineCapabilities
  private metrics: OfflineMetrics

  constructor(config: Partial<OfflineSystemConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.capabilities = {
      isOnline: navigator.onLine,
      hasOfflineSupport: false,
      canSync: false,
      queueSize: 0,
      lastSyncTime: null,
      syncInProgress: false
    }
    this.metrics = {
      totalOperations: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      averageQueueTime: 0,
      networkDowntime: 0,
      dataUsageSaved: 0
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('Offline system already initialized')
      return
    }

    try {
      console.log('🚀 Initializing offline system...')
      
      // Initialize network monitoring
      this.setupNetworkMonitoring()
      
      // Initialize queue system
      const queueCleanup = await initializeOfflineQueue()
      this.cleanupFunctions.push(queueCleanup)
      
      // Configure queue settings
      const { useOfflineQueue } = await import('../../store/offlineQueue')
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
      
      // Update capabilities
      this.capabilities.hasOfflineSupport = true
      this.capabilities.canSync = this.networkStatus
      
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

  private setupNetworkMonitoring(): void {
    const updateNetworkStatus = (online: boolean) => {
      const wasOnline = this.networkStatus
      this.networkStatus = online
      this.capabilities.isOnline = online
      this.capabilities.canSync = online

      if (!wasOnline && online) {
        console.log('🌐 Network connection restored')
        this.onNetworkRestore()
      } else if (wasOnline && !online) {
        console.log('📴 Network connection lost')
        this.onNetworkLoss()
      }
    }

    // Listen for network events
    window.addEventListener('online', () => updateNetworkStatus(true))
    window.addEventListener('offline', () => updateNetworkStatus(false))

    // Periodic network check
    const networkCheckInterval = setInterval(() => {
      const currentStatus = navigator.onLine
      if (currentStatus !== this.networkStatus) {
        updateNetworkStatus(currentStatus)
      }
    }, this.config.networkCheckIntervalMs)

    this.cleanupFunctions.push(() => {
      window.removeEventListener('online', () => updateNetworkStatus(true))
      window.removeEventListener('offline', () => updateNetworkStatus(false))
      clearInterval(networkCheckInterval)
    })
  }

  private onNetworkRestore(): void {
    // Trigger sync when network is restored
    if (this.config.enableAutoSync) {
      syncControl.forceSync()
    }
    
    // Update metrics
    this.metrics.networkDowntime = 0
  }

  private onNetworkLoss(): void {
    // Start tracking downtime
    this.metrics.networkDowntime = Date.now()
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
          const { useOfflineQueue } = await import('../../store/offlineQueue')
          useOfflineQueue.getState().clearQueue()
        },
        getCapabilities: () => this.getCapabilities(),
        getMetrics: () => this.getMetrics(),
        getConfig: () => this.getConfig()
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
          import('../../store/offlineQueue').then(({ useOfflineQueue }) => {
            const currentConfig = useOfflineQueue.getState().config
            useOfflineQueue.getState().updateConfig({
              batchSize: Math.min(currentConfig.batchSize * 2, 20)
            })
            console.log('🔧 Auto-recovery: Increased batch size')
          })
        }
        
        if (health.issues.some(issue => issue.includes('High error count'))) {
          // Clear old errors
          import('../../store/offlineQueue').then(({ useOfflineQueue }) => {
            const errors = useOfflineQueue.getState().errors
            if (errors.length > 20) {
              useOfflineQueue.getState().clearErrors()
              console.log('🔧 Auto-recovery: Cleared old errors')
            }
          })
        }
      }
      
      // Update capabilities
      this.updateCapabilities()
      
      if (this.config.enableDebugMode && health.status !== 'HEALTHY') {
        console.log('📊 Queue Health Check:', health)
      }
      
    }, 60000) // Check every minute
    
    this.cleanupFunctions.push(() => clearInterval(healthCheckInterval))
  }

  private async updateCapabilities(): Promise<void> {
    try {
      const { useOfflineQueue } = await import('../../store/offlineQueue')
      const queueState = useOfflineQueue.getState()
      
      this.capabilities.queueSize = queueState.queue.length
      this.capabilities.lastSyncTime = queueState.lastSuccessfulSync
      this.capabilities.syncInProgress = queueState.queueStatus === 'SYNCING'
    } catch (error) {
      console.warn('Failed to update capabilities:', error)
    }
  }

  private logSystemStatus(): void {
    const analytics = queueManagement.analyzer.analyzeQueue()
    const health = queueManagement.analyzer.assessQueueHealth()
    
    console.group('📊 Offline System Status')
    console.log('Config:', this.config)
    console.log('Capabilities:', this.capabilities)
    console.log('Queue Analytics:', analytics)
    console.log('System Health:', health)
    console.log('Metrics:', this.metrics)
    console.groupEnd()
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  getConfig(): OfflineSystemConfig {
    return { ...this.config }
  }

  updateConfig(updates: Partial<OfflineSystemConfig>): void {
    this.config = { ...this.config, ...updates }
    
    // Apply queue config updates
    if (this.initialized) {
      import('../../store/offlineQueue').then(({ useOfflineQueue }) => {
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

  getCapabilities(): OfflineCapabilities {
    return { ...this.capabilities }
  }

  getMetrics(): OfflineMetrics {
    return { ...this.metrics }
  }

  async getSystemStatus() {
    if (!this.initialized) {
      return { status: 'NOT_INITIALIZED' }
    }

    const analytics = queueManagement.analyzer.analyzeQueue()
    const health = queueManagement.analyzer.assessQueueHealth()
    const { useOfflineQueue } = await import('../../store/offlineQueue')
    const queueStatus = useOfflineQueue.getState()

    return {
      status: 'INITIALIZED',
      config: this.config,
      capabilities: this.capabilities,
      metrics: this.metrics,
      analytics,
      health,
      networkStatus: queueStatus.networkStatus,
      queueStatus: queueStatus.queueStatus,
      queueSize: queueStatus.queue.length,
      lastSync: queueStatus.lastSuccessfulSync
    }
  }

  // ============================================================================
  // Offline Operations
  // ============================================================================

  async addToQueue(operation: {
    type: string
    data: any
    priority?: 'high' | 'medium' | 'low'
  }): Promise<string> {
    const { useOfflineQueue } = await import('../../store/offlineQueue')
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Use the correct method name from the store
    const queueState = useOfflineQueue.getState()
    if ('addToQueue' in queueState) {
      (queueState as any).addToQueue({
        id: operationId,
        ...operation,
        timestamp: Date.now(),
        retryCount: 0
      })
    } else {
      console.warn('addToQueue method not available in offline queue store')
    }

    this.metrics.totalOperations++
    
    return operationId
  }

  async forceSync(): Promise<void> {
    if (this.capabilities.canSync) {
      await syncControl.forceSync()
    } else {
      console.warn('Cannot sync: network is offline')
    }
  }

  async clearQueue(): Promise<void> {
    const { useOfflineQueue } = await import('../../store/offlineQueue')
    useOfflineQueue.getState().clearQueue()
  }

  // ============================================================================
  // Data Management
  // ============================================================================

  async saveOfflineData<T>(key: string, data: T): Promise<void> {
    try {
      // Save to IndexedDB for offline access
      const request = indexedDB.open('offline_data', 1)
      
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('data')) {
          db.createObjectStore('data', { keyPath: 'key' })
        }
      }
      
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['data'], 'readwrite')
        const store = transaction.objectStore('data')
        
        store.put({
          key,
          data,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      console.warn('Failed to save offline data:', error)
    }
  }

  async loadOfflineData<T>(key: string): Promise<T | null> {
    try {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('offline_data', 1)
        
        request.onsuccess = () => {
          const db = request.result
          const transaction = db.transaction(['data'], 'readonly')
          const store = transaction.objectStore('data')
          const getRequest = store.get(key)
          
          getRequest.onsuccess = () => {
            const result = getRequest.result
            resolve(result ? result.data : null)
          }
          
          getRequest.onerror = () => reject(getRequest.error)
        }
        
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.warn('Failed to load offline data:', error)
      return null
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
  const [capabilities, setCapabilities] = React.useState<OfflineCapabilities | null>(null)
  
  React.useEffect(() => {
    const updateStatus = async () => {
      if (systemInstance) {
        const status = await systemInstance.getSystemStatus()
        const caps = systemInstance.getCapabilities()
        setSystemStatus(status)
        setCapabilities(caps)
      }
    }
    
    updateStatus()
    const interval = setInterval(updateStatus, 5000)
    
    return () => clearInterval(interval)
  }, [])
  
  return {
    system: systemInstance,
    status: systemStatus,
    capabilities,
    isInitialized: systemInstance?.isInitialized() || false,
    isOnline: capabilities?.isOnline ?? navigator.onLine
  }
}

export const useOfflineCapabilities = () => {
  const [capabilities, setCapabilities] = React.useState<OfflineCapabilities>({
    isOnline: navigator.onLine,
    hasOfflineSupport: false,
    canSync: false,
    queueSize: 0,
    lastSyncTime: null,
    syncInProgress: false
  })

  React.useEffect(() => {
    const updateCapabilities = () => {
      if (systemInstance) {
        setCapabilities(systemInstance.getCapabilities())
      }
    }

    updateCapabilities()
    const interval = setInterval(updateCapabilities, 2000)

    return () => clearInterval(interval)
  }, [])

  return capabilities
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
    const system = getOfflineSystem()
    if (system) {
      await system.forceSync()
    }
  },
  
  async clearQueue() {
    const system = getOfflineSystem()
    if (system) {
      await system.clearQueue()
    }
  },
  
  async getStatus() {
    const system = getOfflineSystem()
    return system?.getSystemStatus() || { status: 'NOT_INITIALIZED' }
  },
  
  enableDebugMode() {
    const system = getOfflineSystem()
    if (system) {
      system.updateConfig({ enableDebugMode: true })
    }
  },

  async saveData<T>(key: string, data: T) {
    const system = getOfflineSystem()
    if (system) {
      await system.saveOfflineData(key, data)
    }
  },

  async loadData<T>(key: string): Promise<T | null> {
    const system = getOfflineSystem()
    return system ? await system.loadOfflineData<T>(key) : null
  }
}

export default offlineSystem