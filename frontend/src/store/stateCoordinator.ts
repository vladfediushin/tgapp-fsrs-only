// State Coordinator - Central orchestrator for all store systems
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useUnifiedStore, useUnifiedActions } from './unified'
import { useOfflineQueue, initializeOfflineQueue, cleanupOfflineQueue } from './offlineQueue'
import { useSession } from './session'
import { useFSRSStore } from './fsrs'
import { useStatsStore } from './stats'
import { cacheMonitor } from '../utils/core/cache'
import { storeMigration } from '../utils/core/storage'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface StateCoordinatorConfig {
  enableLogging: boolean
  enableMetrics: boolean
  enableValidation: boolean
  enableAutoSync: boolean
  syncIntervalMs: number
  maxRetries: number
  debugMode: boolean
}

export interface StoreHealth {
  storeName: string
  status: 'healthy' | 'warning' | 'error'
  lastUpdate: number
  errorCount: number
  issues: string[]
}

export interface StateSnapshot {
  timestamp: number
  unified: any
  session: any
  fsrs: any
  stats: any
  offlineQueue: any
  metadata: {
    version: string
    environment: string
    userAgent: string
  }
}

export interface StateValidationResult {
  isValid: boolean
  errors: Array<{
    store: string
    field: string
    message: string
    severity: 'error' | 'warning'
  }>
  warnings: Array<{
    store: string
    field: string
    message: string
  }>
}

export interface StateMetrics {
  totalOperations: number
  successfulOperations: number
  failedOperations: number
  averageResponseTime: number
  cacheHitRate: number
  syncOperations: number
  validationErrors: number
  lastMetricsReset: number
}

// ============================================================================
// Middleware Types
// ============================================================================

export interface StateMiddleware {
  name: string
  priority: number
  beforeAction?: (action: string, payload: any, context: StateContext) => Promise<any> | any
  afterAction?: (action: string, payload: any, result: any, context: StateContext) => Promise<void> | void
  onError?: (error: Error, action: string, payload: any, context: StateContext) => Promise<void> | void
}

export interface StateContext {
  coordinator: StateCoordinator
  timestamp: number
  userId?: string
  metadata?: Record<string, any>
}

// ============================================================================
// State Coordinator Implementation
// ============================================================================

interface StateCoordinatorState {
  // Configuration
  config: StateCoordinatorConfig
  
  // Health monitoring
  storeHealth: Map<string, StoreHealth>
  
  // Middleware system
  middleware: StateMiddleware[]
  
  // Metrics and monitoring
  metrics: StateMetrics
  
  // Error tracking
  errors: Array<{
    timestamp: number
    store: string
    action: string
    error: string
    context?: any
  }>
  
  // Sync status
  syncStatus: {
    isActive: boolean
    lastSync: number | null
    nextSync: number | null
    failedAttempts: number
  }
  
  // Migration status
  migrationStatus: {
    inProgress: boolean
    completedStores: string[]
    pendingStores: string[]
    errors: string[]
  }
}

interface StateCoordinatorActions {
  // Configuration
  updateConfig: (config: Partial<StateCoordinatorConfig>) => void
  
  // Store coordination
  syncAllStores: (userId: string) => Promise<void>
  validateAllStores: () => Promise<StateValidationResult>
  getStoreHealth: () => Map<string, StoreHealth>
  
  // Middleware management
  addMiddleware: (middleware: StateMiddleware) => void
  removeMiddleware: (name: string) => void
  executeMiddleware: (phase: 'before' | 'after' | 'error', action: string, payload: any, result?: any, error?: Error) => Promise<void>
  
  // Data synchronization
  syncUserData: (userId: string) => Promise<void>
  syncSettings: () => Promise<void>
  syncOfflineOperations: () => Promise<void>
  
  // Error handling and recovery
  handleStoreError: (storeName: string, error: Error, context?: any) => Promise<void>
  recoverFromError: (storeName: string) => Promise<void>
  clearErrors: (storeName?: string) => void
  
  // State snapshots and debugging
  createSnapshot: () => StateSnapshot
  restoreSnapshot: (snapshot: StateSnapshot) => Promise<void>
  exportState: () => string
  importState: (stateData: string) => Promise<void>
  
  // Metrics and monitoring
  getMetrics: () => StateMetrics
  resetMetrics: () => void
  
  // Migration coordination
  startMigration: (fromStore: string, toStore: string) => Promise<void>
  getMigrationStatus: () => any
  
  // Lifecycle management
  initialize: () => Promise<void>
  cleanup: () => Promise<void>
}

type StateCoordinator = StateCoordinatorState & StateCoordinatorActions

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: StateCoordinatorConfig = {
  enableLogging: true,
  enableMetrics: true,
  enableValidation: true,
  enableAutoSync: true,
  syncIntervalMs: 30000, // 30 seconds
  maxRetries: 3,
  debugMode: false
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useStateCoordinator = create<StateCoordinator>()(
  persist(
    (set, get) => ({
      // Initial state
      config: DEFAULT_CONFIG,
      storeHealth: new Map(),
      middleware: [],
      metrics: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        syncOperations: 0,
        validationErrors: 0,
        lastMetricsReset: Date.now()
      },
      errors: [],
      syncStatus: {
        isActive: false,
        lastSync: null,
        nextSync: null,
        failedAttempts: 0
      },
      migrationStatus: {
        inProgress: false,
        completedStores: [],
        pendingStores: [],
        errors: []
      },

      // Configuration
      updateConfig: (configUpdates) => {
        set(state => ({
          config: { ...state.config, ...configUpdates }
        }))
        
        if (get().config.enableLogging) {
          console.log('🔧 StateCoordinator config updated:', configUpdates)
        }
      },

      // Store coordination
      syncAllStores: async (userId) => {
        const state = get()
        if (state.syncStatus.isActive) {
          console.log('🔄 Sync already in progress, skipping')
          return
        }

        set(state => ({
          syncStatus: { ...state.syncStatus, isActive: true },
          metrics: { ...state.metrics, syncOperations: state.metrics.syncOperations + 1 }
        }))

        try {
          await get().executeMiddleware('before', 'syncAllStores', { userId })
          
          // Sync unified store
          const unifiedActions = useUnifiedActions()
          await unifiedActions.refreshAllData(userId)
          
          // Sync offline queue
          const offlineQueue = useOfflineQueue.getState()
          if (offlineQueue.networkStatus === 'ONLINE') {
            await offlineQueue.startSync()
          }
          
          // Update sync status
          set(state => ({
            syncStatus: {
              ...state.syncStatus,
              isActive: false,
              lastSync: Date.now(),
              nextSync: Date.now() + state.config.syncIntervalMs,
              failedAttempts: 0
            },
            metrics: { ...state.metrics, successfulOperations: state.metrics.successfulOperations + 1 }
          }))
          
          await get().executeMiddleware('after', 'syncAllStores', { userId }, 'success')
          
          if (state.config.enableLogging) {
            console.log('✅ All stores synchronized successfully')
          }
          
        } catch (error) {
          set(state => ({
            syncStatus: {
              ...state.syncStatus,
              isActive: false,
              failedAttempts: state.syncStatus.failedAttempts + 1
            },
            metrics: { ...state.metrics, failedOperations: state.metrics.failedOperations + 1 }
          }))
          
          await get().handleStoreError('coordinator', error as Error, { action: 'syncAllStores', userId })
          await get().executeMiddleware('error', 'syncAllStores', { userId }, undefined, error as Error)
          throw error
        }
      },

      validateAllStores: async () => {
        const errors: StateValidationResult['errors'] = []
        const warnings: StateValidationResult['warnings'] = []
        
        try {
          await get().executeMiddleware('before', 'validateAllStores', {})
          
          // Validate unified store
          const unifiedStore = useUnifiedStore.getState()
          if (!unifiedStore.user && unifiedStore.loading.user === false) {
            warnings.push({
              store: 'unified',
              field: 'user',
              message: 'User data not loaded'
            })
          }
          
          // Validate session store
          const sessionStore = useSession.getState()
          if (!sessionStore.userId) {
            errors.push({
              store: 'session',
              field: 'userId',
              message: 'User ID not set',
              severity: 'error'
            })
          }
          
          // Validate FSRS store
          const fsrsStore = useFSRSStore.getState()
          if (fsrsStore.settings.enabled && !fsrsStore.currentStats) {
            warnings.push({
              store: 'fsrs',
              field: 'currentStats',
              message: 'FSRS stats not loaded'
            })
          }
          
          // Validate offline queue
          const offlineQueue = useOfflineQueue.getState()
          if (offlineQueue.queue.length > 100) {
            warnings.push({
              store: 'offlineQueue',
              field: 'queue',
              message: 'Large offline queue detected'
            })
          }
          
          const result: StateValidationResult = {
            isValid: errors.length === 0,
            errors,
            warnings
          }
          
          if (errors.length > 0) {
            set(state => ({
              metrics: { ...state.metrics, validationErrors: state.metrics.validationErrors + errors.length }
            }))
          }
          
          await get().executeMiddleware('after', 'validateAllStores', {}, result)
          
          return result
          
        } catch (error) {
          await get().executeMiddleware('error', 'validateAllStores', {}, undefined, error as Error)
          throw error
        }
      },

      getStoreHealth: () => {
        const health = new Map<string, StoreHealth>()
        
        // Check unified store health
        const unifiedStore = useUnifiedStore.getState()
        const unifiedErrors = Object.values(unifiedStore.errors).filter(e => e !== null)
        health.set('unified', {
          storeName: 'unified',
          status: unifiedErrors.length > 0 ? 'error' : 'healthy',
          lastUpdate: Date.now(),
          errorCount: unifiedErrors.length,
          issues: unifiedErrors
        })
        
        // Check offline queue health
        const offlineQueue = useOfflineQueue.getState()
        health.set('offlineQueue', {
          storeName: 'offlineQueue',
          status: offlineQueue.queueStatus === 'ERROR' ? 'error' : 
                  offlineQueue.queue.length > 50 ? 'warning' : 'healthy',
          lastUpdate: offlineQueue.lastSyncAttempt || 0,
          errorCount: offlineQueue.errors.length,
          issues: offlineQueue.errors.map(e => e.error)
        })
        
        // Check FSRS store health
        const fsrsStore = useFSRSStore.getState()
        health.set('fsrs', {
          storeName: 'fsrs',
          status: fsrsStore.lastError ? 'error' : 'healthy',
          lastUpdate: fsrsStore.lastStatsUpdate || 0,
          errorCount: fsrsStore.lastError ? 1 : 0,
          issues: fsrsStore.lastError ? [fsrsStore.lastError] : []
        })
        
        return health
      },

      // Middleware management
      addMiddleware: (middleware) => {
        set(state => ({
          middleware: [...state.middleware, middleware].sort((a, b) => b.priority - a.priority)
        }))
        
        if (get().config.enableLogging) {
          console.log(`🔌 Middleware added: ${middleware.name}`)
        }
      },

      removeMiddleware: (name) => {
        set(state => ({
          middleware: state.middleware.filter(m => m.name !== name)
        }))
        
        if (get().config.enableLogging) {
          console.log(`🔌 Middleware removed: ${name}`)
        }
      },

      executeMiddleware: async (phase, action, payload, result?, error?) => {
        const { middleware, config } = get()
        const context: StateContext = {
          coordinator: get(),
          timestamp: Date.now(),
          metadata: { phase, action }
        }
        
        for (const mw of middleware) {
          try {
            if (phase === 'before' && mw.beforeAction) {
              await mw.beforeAction(action, payload, context)
            } else if (phase === 'after' && mw.afterAction) {
              await mw.afterAction(action, payload, result, context)
            } else if (phase === 'error' && mw.onError) {
              await mw.onError(error!, action, payload, context)
            }
          } catch (middlewareError) {
            if (config.enableLogging) {
              console.error(`❌ Middleware error in ${mw.name}:`, middlewareError)
            }
          }
        }
      },

      // Data synchronization
      syncUserData: async (userId) => {
        const unifiedActions = useUnifiedActions()
        await Promise.allSettled([
          unifiedActions.loadUser(parseInt(userId)),
          unifiedActions.loadUserStats(userId),
          unifiedActions.loadDailyProgress(userId)
        ])
      },

      syncSettings: async () => {
        const unifiedStore = useUnifiedStore.getState()
        const sessionStore = useSession.getState()
        
        // Sync settings between stores
        if (unifiedStore.settings.examCountry !== sessionStore.examCountry) {
          sessionStore.setExamCountry(unifiedStore.settings.examCountry)
        }
        
        if (unifiedStore.settings.examLanguage !== sessionStore.examLanguage) {
          sessionStore.setExamLanguage(unifiedStore.settings.examLanguage)
        }
      },

      syncOfflineOperations: async () => {
        const offlineQueue = useOfflineQueue.getState()
        if (offlineQueue.networkStatus === 'ONLINE' && offlineQueue.queue.length > 0) {
          await offlineQueue.startSync()
        }
      },

      // Error handling and recovery
      handleStoreError: async (storeName, error, context?) => {
        const timestamp = Date.now()
        
        set(state => ({
          errors: [...state.errors, {
            timestamp,
            store: storeName,
            action: context?.action || 'unknown',
            error: error.message,
            context
          }].slice(-100) // Keep only last 100 errors
        }))
        
        if (get().config.enableLogging) {
          console.error(`❌ Store error in ${storeName}:`, error)
        }
        
        // Attempt recovery based on store type
        await get().recoverFromError(storeName)
      },

      recoverFromError: async (storeName) => {
        try {
          switch (storeName) {
            case 'unified':
              // Clear cache and reload critical data
              const unifiedActions = useUnifiedActions()
              unifiedActions.clearAllErrors()
              break
              
            case 'offlineQueue':
              // Restart sync process
              const offlineQueue = useOfflineQueue.getState()
              offlineQueue.clearErrors()
              break
              
            case 'fsrs':
              // Clear FSRS errors
              const fsrsStore = useFSRSStore.getState()
              fsrsStore.clearError()
              break
              
            default:
              console.warn(`No recovery strategy for store: ${storeName}`)
          }
          
          if (get().config.enableLogging) {
            console.log(`🔄 Recovery attempted for ${storeName}`)
          }
          
        } catch (recoveryError) {
          console.error(`❌ Recovery failed for ${storeName}:`, recoveryError)
        }
      },

      clearErrors: (storeName?) => {
        if (storeName) {
          set(state => ({
            errors: state.errors.filter(e => e.store !== storeName)
          }))
        } else {
          set({ errors: [] })
        }
      },

      // State snapshots and debugging
      createSnapshot: () => {
        const snapshot: StateSnapshot = {
          timestamp: Date.now(),
          unified: useUnifiedStore.getState(),
          session: useSession.getState(),
          fsrs: useFSRSStore.getState(),
          stats: useStatsStore.getState(),
          offlineQueue: useOfflineQueue.getState(),
          metadata: {
            version: '1.0.0',
            environment: 'production',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
          }
        }
        
        return snapshot
      },

      restoreSnapshot: async (snapshot) => {
        // This would require careful implementation to avoid breaking store subscriptions
        console.warn('Snapshot restoration not yet implemented')
      },

      exportState: () => {
        const snapshot = get().createSnapshot()
        return JSON.stringify(snapshot, null, 2)
      },

      importState: async (stateData) => {
        try {
          const snapshot = JSON.parse(stateData) as StateSnapshot
          await get().restoreSnapshot(snapshot)
        } catch (error) {
          throw new Error('Invalid state data format')
        }
      },

      // Metrics and monitoring
      getMetrics: () => get().metrics,

      resetMetrics: () => {
        set(state => ({
          metrics: {
            totalOperations: 0,
            successfulOperations: 0,
            failedOperations: 0,
            averageResponseTime: 0,
            cacheHitRate: 0,
            syncOperations: 0,
            validationErrors: 0,
            lastMetricsReset: Date.now()
          }
        }))
      },

      // Migration coordination
      startMigration: async (fromStore, toStore) => {
        set(state => ({
          migrationStatus: {
            ...state.migrationStatus,
            inProgress: true
          }
        }))
        
        try {
          // Use existing migration helper
          const migrationStatus = storeMigration.getMigrationStatus()
          
          set(state => ({
            migrationStatus: {
              inProgress: false,
              completedStores: migrationStatus.migratedComponents,
              pendingStores: migrationStatus.pendingComponents,
              errors: []
            }
          }))
          
        } catch (error) {
          set(state => ({
            migrationStatus: {
              ...state.migrationStatus,
              inProgress: false,
              errors: [...state.migrationStatus.errors, (error as Error).message]
            }
          }))
        }
      },

      getMigrationStatus: () => get().migrationStatus,

      // Lifecycle management
      initialize: async () => {
        try {
          // Initialize offline queue
          await initializeOfflineQueue()
          
          // Set up auto-sync if enabled
          const { config } = get()
          if (config.enableAutoSync) {
            setInterval(() => {
              const sessionStore = useSession.getState()
              if (sessionStore.userId) {
                get().syncAllStores(sessionStore.userId).catch(console.error)
              }
            }, config.syncIntervalMs)
          }
          
          if (config.enableLogging) {
            console.log('🚀 StateCoordinator initialized')
          }
          
        } catch (error) {
          console.error('❌ StateCoordinator initialization failed:', error)
          throw error
        }
      },

      cleanup: async () => {
        try {
          cleanupOfflineQueue()
          
          if (get().config.enableLogging) {
            console.log('🧹 StateCoordinator cleaned up')
          }
          
        } catch (error) {
          console.error('❌ StateCoordinator cleanup failed:', error)
        }
      }
    }),
    {
      name: 'state-coordinator',
      partialize: (state) => ({
        config: state.config,
        metrics: state.metrics,
        migrationStatus: state.migrationStatus
      })
    }
  )
)

// ============================================================================
// Convenience Hooks and Selectors
// ============================================================================

export const useStateCoordinatorConfig = () => useStateCoordinator(state => state.config)
export const useStateCoordinatorMetrics = () => useStateCoordinator(state => state.metrics)
export const useStateCoordinatorHealth = () => useStateCoordinator(state => state.getStoreHealth())
export const useStateCoordinatorErrors = () => useStateCoordinator(state => state.errors)

export const useStateCoordinatorActions = () => {
  const store = useStateCoordinator()
  return {
    syncAllStores: store.syncAllStores,
    validateAllStores: store.validateAllStores,
    updateConfig: store.updateConfig,
    addMiddleware: store.addMiddleware,
    removeMiddleware: store.removeMiddleware,
    handleStoreError: store.handleStoreError,
    clearErrors: store.clearErrors,
    createSnapshot: store.createSnapshot,
    exportState: store.exportState,
    importState: store.importState,
    getMetrics: store.getMetrics,
    resetMetrics: store.resetMetrics,
    initialize: store.initialize,
    cleanup: store.cleanup
  }
}

// ============================================================================
// Global State Coordinator Instance
// ============================================================================

// Initialize the coordinator when the module loads
if (typeof window !== 'undefined') {
  useStateCoordinator.getState().initialize().catch(console.error)
}