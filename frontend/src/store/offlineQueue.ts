// Offline Queue System for Telegram Mini Web App
// Handles operations when users are offline or have poor connectivity

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface QueuedOperation {
  id: string
  type: OperationType
  payload: any
  timestamp: number
  retryCount: number
  maxRetries: number
  priority: OperationPriority
  userId?: string
  metadata?: Record<string, any>
  optimisticUpdate?: OptimisticUpdate
}

export type OperationType = 
  | 'SUBMIT_ANSWER'
  | 'UPDATE_USER_SETTINGS'
  | 'UPDATE_EXAM_SETTINGS'
  | 'SYNC_PROGRESS'
  | 'FSRS_RATING'
  | 'CUSTOM_API_CALL'

export type OperationPriority = 'HIGH' | 'MEDIUM' | 'LOW'

export type QueueStatus = 'IDLE' | 'SYNCING' | 'PAUSED' | 'ERROR'

export type NetworkStatus = 'ONLINE' | 'OFFLINE' | 'POOR'

export interface OptimisticUpdate {
  storeKey: string
  updateFn: (currentData: any) => any
  rollbackFn: (currentData: any) => any
}

export interface SyncResult {
  success: boolean
  operation: QueuedOperation
  error?: string
  serverResponse?: any
}

export interface ConflictResolution {
  strategy: 'SERVER_WINS' | 'CLIENT_WINS' | 'MERGE' | 'MANUAL'
  resolver?: (serverData: any, clientData: any) => any
}

// ============================================================================
// Queue Store State and Actions
// ============================================================================

interface OfflineQueueState {
  // Queue management
  queue: QueuedOperation[]
  processing: Map<string, boolean>
  
  // Network and sync status
  networkStatus: NetworkStatus
  queueStatus: QueueStatus
  lastSyncAttempt: number | null
  lastSuccessfulSync: number | null
  
  // Configuration
  config: {
    maxRetries: number
    retryDelayMs: number
    maxRetryDelayMs: number
    batchSize: number
    syncIntervalMs: number
    networkCheckIntervalMs: number
  }
  
  // Statistics
  stats: {
    totalOperations: number
    successfulOperations: number
    failedOperations: number
    averageRetryCount: number
  }
  
  // Error tracking
  errors: Array<{
    operationId: string
    error: string
    timestamp: number
  }>
}

interface OfflineQueueActions {
  // Queue operations
  enqueue: (operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount'>) => string
  dequeue: (operationId: string) => void
  clearQueue: () => void
  getQueueSize: () => number
  getQueueByPriority: (priority?: OperationPriority) => QueuedOperation[]
  
  // Network status
  setNetworkStatus: (status: NetworkStatus) => void
  checkNetworkStatus: () => Promise<NetworkStatus>
  
  // Sync operations
  startSync: () => Promise<void>
  stopSync: () => void
  syncOperation: (operation: QueuedOperation) => Promise<SyncResult>
  syncBatch: (operations: QueuedOperation[]) => Promise<SyncResult[]>
  
  // Optimistic updates
  applyOptimisticUpdate: (operation: QueuedOperation) => void
  rollbackOptimisticUpdate: (operation: QueuedOperation) => void
  
  // Configuration
  updateConfig: (config: Partial<OfflineQueueState['config']>) => void
  
  // Statistics and monitoring
  getStats: () => OfflineQueueState['stats']
  clearStats: () => void
  getErrors: () => OfflineQueueState['errors']
  clearErrors: () => void
  
  // Utility
  retryFailedOperations: () => Promise<void>
  exportQueue: () => string
  importQueue: (queueData: string) => void
}

type OfflineQueueStore = OfflineQueueState & OfflineQueueActions

// ============================================================================
// IndexedDB Queue Storage
// ============================================================================

class QueueStorage {
  private dbName = 'offline-queue-db'
  private version = 1
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // Create queue store
        if (!db.objectStoreNames.contains('queue')) {
          const queueStore = db.createObjectStore('queue', { keyPath: 'id' })
          queueStore.createIndex('timestamp', 'timestamp')
          queueStore.createIndex('priority', 'priority')
          queueStore.createIndex('type', 'type')
          queueStore.createIndex('userId', 'userId')
        }
        
        // Create sync log store
        if (!db.objectStoreNames.contains('syncLog')) {
          const syncStore = db.createObjectStore('syncLog', { keyPath: 'id', autoIncrement: true })
          syncStore.createIndex('timestamp', 'timestamp')
          syncStore.createIndex('operationId', 'operationId')
        }
      }
    })
  }

  async saveOperation(operation: QueuedOperation): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['queue'], 'readwrite')
      const store = transaction.objectStore('queue')
      const request = store.put(operation)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getOperation(id: string): Promise<QueuedOperation | null> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['queue'], 'readonly')
      const store = transaction.objectStore('queue')
      const request = store.get(id)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || null)
    })
  }

  async getAllOperations(): Promise<QueuedOperation[]> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['queue'], 'readonly')
      const store = transaction.objectStore('queue')
      const request = store.getAll()
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || [])
    })
  }

  async deleteOperation(id: string): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['queue'], 'readwrite')
      const store = transaction.objectStore('queue')
      const request = store.delete(id)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async clearQueue(): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['queue'], 'readwrite')
      const store = transaction.objectStore('queue')
      const request = store.clear()
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async logSync(operationId: string, result: SyncResult): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncLog'], 'readwrite')
      const store = transaction.objectStore('syncLog')
      const request = store.add({
        operationId,
        result,
        timestamp: Date.now()
      })
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }
}

// ============================================================================
// Network Status Detection
// ============================================================================

class NetworkMonitor {
  private callbacks: Array<(status: NetworkStatus) => void> = []
  private currentStatus: NetworkStatus = 'ONLINE'
  private checkInterval: number | null = null

  constructor() {
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.updateStatus('ONLINE'))
      window.addEventListener('offline', () => this.updateStatus('OFFLINE'))
    }
  }

  async checkConnection(): Promise<NetworkStatus> {
    if (!navigator.onLine) {
      return 'OFFLINE'
    }

    try {
      // Test connection with a lightweight request
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)
      
      const response = await fetch('/api/health', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        return 'ONLINE'
      } else {
        return 'POOR'
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return 'POOR'
      }
      return 'OFFLINE'
    }
  }

  private updateStatus(status: NetworkStatus): void {
    if (this.currentStatus !== status) {
      this.currentStatus = status
      this.callbacks.forEach(callback => callback(status))
    }
  }

  onStatusChange(callback: (status: NetworkStatus) => void): () => void {
    this.callbacks.push(callback)
    
    // Return unsubscribe function
    return () => {
      const index = this.callbacks.indexOf(callback)
      if (index > -1) {
        this.callbacks.splice(index, 1)
      }
    }
  }

  startMonitoring(intervalMs: number = 30000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }

    this.checkInterval = window.setInterval(async () => {
      const status = await this.checkConnection()
      this.updateStatus(status)
    }, intervalMs)
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  getCurrentStatus(): NetworkStatus {
    return this.currentStatus
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

const generateOperationId = (): string => {
  return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

const calculateRetryDelay = (retryCount: number, baseDelay: number, maxDelay: number): number => {
  const exponentialDelay = baseDelay * Math.pow(2, retryCount)
  const jitteredDelay = exponentialDelay * (0.5 + Math.random() * 0.5)
  return Math.min(jitteredDelay, maxDelay)
}

const sortOperationsByPriority = (operations: QueuedOperation[]): QueuedOperation[] => {
  const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 }
  return operations.sort((a, b) => {
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
    if (priorityDiff !== 0) return priorityDiff
    return a.timestamp - b.timestamp // FIFO for same priority
  })
}

// ============================================================================
// Store Implementation
// ============================================================================

const queueStorage = new QueueStorage()
const networkMonitor = new NetworkMonitor()

export const useOfflineQueue = create<OfflineQueueStore>()(
  persist(
    (set, get) => ({
      // Initial state
      queue: [],
      processing: new Map(),
      networkStatus: 'ONLINE',
      queueStatus: 'IDLE',
      lastSyncAttempt: null,
      lastSuccessfulSync: null,
      
      config: {
        maxRetries: 3,
        retryDelayMs: 1000,
        maxRetryDelayMs: 30000,
        batchSize: 5,
        syncIntervalMs: 30000,
        networkCheckIntervalMs: 10000,
      },
      
      stats: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageRetryCount: 0,
      },
      
      errors: [],

      // Queue operations
      enqueue: (operationData) => {
        const operation: QueuedOperation = {
          ...operationData,
          id: generateOperationId(),
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: operationData.maxRetries ?? get().config.maxRetries,
        }

        set(state => ({
          queue: [...state.queue, operation],
          stats: {
            ...state.stats,
            totalOperations: state.stats.totalOperations + 1,
          }
        }))

        // Save to IndexedDB
        queueStorage.saveOperation(operation).catch(console.error)

        // Apply optimistic update if provided
        if (operation.optimisticUpdate) {
          get().applyOptimisticUpdate(operation)
        }

        // Try to sync immediately if online
        if (get().networkStatus === 'ONLINE' && get().queueStatus === 'IDLE') {
          get().startSync().catch(console.error)
        }

        return operation.id
      },

      dequeue: (operationId) => {
        set(state => ({
          queue: state.queue.filter(op => op.id !== operationId),
          processing: new Map(Array.from(state.processing.entries()).filter(([id]) => id !== operationId))
        }))

        queueStorage.deleteOperation(operationId).catch(console.error)
      },

      clearQueue: () => {
        set(state => ({
          queue: [],
          processing: new Map(),
          errors: []
        }))

        queueStorage.clearQueue().catch(console.error)
      },

      getQueueSize: () => get().queue.length,

      getQueueByPriority: (priority) => {
        const { queue } = get()
        const filtered = priority ? queue.filter(op => op.priority === priority) : queue
        return sortOperationsByPriority(filtered)
      },

      // Network status
      setNetworkStatus: (status) => {
        const currentStatus = get().networkStatus
        set({ networkStatus: status })

        // Start sync when coming back online
        if (currentStatus !== 'ONLINE' && status === 'ONLINE' && get().queue.length > 0) {
          get().startSync().catch(console.error)
        }
      },

      checkNetworkStatus: async () => {
        const status = await networkMonitor.checkConnection()
        get().setNetworkStatus(status)
        return status
      },

      // Sync operations
      startSync: async () => {
        const state = get()
        
        if (state.queueStatus === 'SYNCING' || state.queue.length === 0) {
          return
        }

        if (state.networkStatus === 'OFFLINE') {
          console.log('Cannot sync: offline')
          return
        }

        set({ queueStatus: 'SYNCING', lastSyncAttempt: Date.now() })

        try {
          const operations = sortOperationsByPriority(state.queue)
          const batch = operations.slice(0, state.config.batchSize)
          
          const results = await get().syncBatch(batch)
          
          // Process results
          let successCount = 0
          let failCount = 0
          
          for (const result of results) {
            if (result.success) {
              successCount++
              get().dequeue(result.operation.id)
            } else {
              failCount++
              // Handle retry logic
              const operation = result.operation
              if (operation.retryCount < operation.maxRetries) {
                // Update retry count and re-queue
                const updatedOp = {
                  ...operation,
                  retryCount: operation.retryCount + 1
                }
                
                set(state => ({
                  queue: state.queue.map(op => 
                    op.id === operation.id ? updatedOp : op
                  )
                }))
                
                queueStorage.saveOperation(updatedOp).catch(console.error)
              } else {
                // Max retries reached, remove from queue and log error
                get().dequeue(operation.id)
                
                if (operation.optimisticUpdate) {
                  get().rollbackOptimisticUpdate(operation)
                }
                
                set(state => ({
                  errors: [...state.errors, {
                    operationId: operation.id,
                    error: result.error || 'Max retries exceeded',
                    timestamp: Date.now()
                  }]
                }))
              }
            }
            
            // Log sync result
            queueStorage.logSync(result.operation.id, result).catch(console.error)
          }

          // Update stats
          set(state => ({
            stats: {
              ...state.stats,
              successfulOperations: state.stats.successfulOperations + successCount,
              failedOperations: state.stats.failedOperations + failCount,
            },
            lastSuccessfulSync: successCount > 0 ? Date.now() : state.lastSuccessfulSync,
            queueStatus: 'IDLE'
          }))

          // Continue syncing if there are more operations
          if (get().queue.length > 0 && get().networkStatus === 'ONLINE') {
            setTimeout(() => get().startSync(), 1000)
          }

        } catch (error) {
          console.error('Sync failed:', error)
          set({ 
            queueStatus: 'ERROR',
            errors: [...get().errors, {
              operationId: 'sync_batch',
              error: error instanceof Error ? error.message : 'Sync failed',
              timestamp: Date.now()
            }]
          })
        }
      },

      stopSync: () => {
        set({ queueStatus: 'PAUSED' })
      },

      syncOperation: async (operation) => {
        // This will be implemented by the API integration layer
        // For now, return a placeholder
        return {
          success: false,
          operation,
          error: 'Sync operation not implemented'
        }
      },

      syncBatch: async (operations) => {
        const results: SyncResult[] = []
        
        for (const operation of operations) {
          if (get().processing.get(operation.id)) {
            continue // Skip if already processing
          }
          
          set(state => ({
            processing: new Map(state.processing.set(operation.id, true))
          }))
          
          try {
            const result = await get().syncOperation(operation)
            results.push(result)
          } catch (error) {
            results.push({
              success: false,
              operation,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          } finally {
            set(state => ({
              processing: new Map(Array.from(state.processing.entries()).filter(([id]) => id !== operation.id))
            }))
          }
          
          // Add delay between operations to avoid overwhelming the server
          if (operations.indexOf(operation) < operations.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }
        
        return results
      },

      // Optimistic updates
      applyOptimisticUpdate: (operation) => {
        if (!operation.optimisticUpdate) return
        
        // This will be implemented to integrate with the unified store
        console.log('Applying optimistic update for operation:', operation.id)
      },

      rollbackOptimisticUpdate: (operation) => {
        if (!operation.optimisticUpdate) return
        
        // This will be implemented to integrate with the unified store
        console.log('Rolling back optimistic update for operation:', operation.id)
      },

      // Configuration
      updateConfig: (configUpdates) => {
        set(state => ({
          config: { ...state.config, ...configUpdates }
        }))
      },

      // Statistics and monitoring
      getStats: () => get().stats,

      clearStats: () => {
        set({
          stats: {
            totalOperations: 0,
            successfulOperations: 0,
            failedOperations: 0,
            averageRetryCount: 0,
          }
        })
      },

      getErrors: () => get().errors,

      clearErrors: () => {
        set({ errors: [] })
      },

      // Utility
      retryFailedOperations: async () => {
        const { queue } = get()
        const failedOps = queue.filter(op => op.retryCount > 0)
        
        for (const op of failedOps) {
          if (op.retryCount < op.maxRetries) {
            // Reset retry count and try again
            set(state => ({
              queue: state.queue.map(queueOp => 
                queueOp.id === op.id 
                  ? { ...queueOp, retryCount: 0 }
                  : queueOp
              )
            }))
          }
        }
        
        if (failedOps.length > 0) {
          await get().startSync()
        }
      },

      exportQueue: () => {
        const { queue, stats, errors } = get()
        return JSON.stringify({ queue, stats, errors }, null, 2)
      },

      importQueue: (queueData) => {
        try {
          const data = JSON.parse(queueData)
          set({
            queue: data.queue || [],
            stats: data.stats || get().stats,
            errors: data.errors || []
          })
        } catch (error) {
          console.error('Failed to import queue data:', error)
        }
      },
    }),
    {
      name: 'offline-queue',
      partialize: (state) => ({
        config: state.config,
        stats: state.stats,
        // Don't persist queue and errors - they're stored in IndexedDB
      })
    }
  )
)

// ============================================================================
// Initialization and Cleanup
// ============================================================================

// Initialize the queue system
export const initializeOfflineQueue = async () => {
  try {
    await queueStorage.init()
    
    // Load persisted operations from IndexedDB
    const persistedOperations = await queueStorage.getAllOperations()
    if (persistedOperations.length > 0) {
      useOfflineQueue.setState(state => ({
        queue: persistedOperations
      }))
    }
    
    // Set up network monitoring
    const unsubscribe = networkMonitor.onStatusChange((status) => {
      useOfflineQueue.getState().setNetworkStatus(status)
    })
    
    networkMonitor.startMonitoring(useOfflineQueue.getState().config.networkCheckIntervalMs)
    
    // Initial network check
    const initialStatus = await networkMonitor.checkConnection()
    useOfflineQueue.getState().setNetworkStatus(initialStatus)
    
    console.log('Offline queue system initialized')
    
    return unsubscribe
  } catch (error) {
    console.error('Failed to initialize offline queue:', error)
    throw error
  }
}

// Cleanup function
export const cleanupOfflineQueue = () => {
  networkMonitor.stopMonitoring()
}

// ============================================================================
// Convenience Hooks and Selectors
// ============================================================================

export const useQueueStatus = () => useOfflineQueue(state => ({
  status: state.queueStatus,
  networkStatus: state.networkStatus,
  queueSize: state.queue.length,
  lastSync: state.lastSuccessfulSync
}))

export const useQueueStats = () => useOfflineQueue(state => state.stats)

export const useQueueErrors = () => useOfflineQueue(state => state.errors)

export const useQueueActions = () => {
  const store = useOfflineQueue()
  return {
    enqueue: store.enqueue,
    startSync: store.startSync,
    stopSync: store.stopSync,
    clearQueue: store.clearQueue,
    retryFailedOperations: store.retryFailedOperations,
    clearErrors: store.clearErrors,
    updateConfig: store.updateConfig
  }
}