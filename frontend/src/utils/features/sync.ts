// Synchronization Management System
// Consolidated from statsSync.ts, examSync.ts and other sync utilities
// Provides background sync, optimistic updates, and data synchronization

import { getUserStats, getDailyProgress } from '../../api/api'
import { useStatsStore } from '../../store/stats'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface SyncConfig {
  enableBackgroundSync: boolean
  syncInterval: number
  retryAttempts: number
  retryDelay: number
  batchSize: number
  enableOptimisticUpdates: boolean
  enableConflictResolution: boolean
}

export interface SyncOperation {
  id: string
  type: 'stats' | 'progress' | 'exam' | 'settings'
  data: any
  timestamp: number
  retryCount: number
  status: 'pending' | 'syncing' | 'completed' | 'failed'
  priority: 'high' | 'medium' | 'low'
}

export interface SyncResult {
  success: boolean
  error?: Error
  data?: any
  fromCache?: boolean
  syncTime?: number
}

export interface SyncMetrics {
  totalOperations: number
  successfulSyncs: number
  failedSyncs: number
  averageSyncTime: number
  lastSyncTime: number
  pendingOperations: number
}

// ============================================================================
// Background Stats Synchronization
// ============================================================================

/**
 * Background sync of user stats and daily progress
 * Used after completing tests/quizzes
 */
export const backgroundSyncStats = async (userId: string): Promise<SyncResult> => {
  const { setUserStats, setDailyProgress } = useStatsStore.getState()
  
  try {
    const startTime = Date.now()
    
    // Run both requests in parallel
    const [statsResponse, progressResponse] = await Promise.all([
      getUserStats(userId),
      getDailyProgress(userId)
    ])
    
    // Update Zustand store with fresh data
    setUserStats(statsResponse.data)
    setDailyProgress(progressResponse.data)
    
    const syncTime = Date.now() - startTime
    console.log('✅ Background stats sync completed')
    
    return { 
      success: true, 
      data: { stats: statsResponse.data, progress: progressResponse.data },
      syncTime
    }
  } catch (error) {
    console.error('❌ Background stats sync failed:', error)
    return { success: false, error: error as Error }
  }
}

/**
 * Load stats from Zustand or API if not fresh
 * Used on page load
 */
export const loadStatsWithCache = async (userId: string): Promise<SyncResult> => {
  const { 
    userStats, 
    dailyProgress, 
    isDataFresh, 
    setStatsLoading, 
    setProgressLoading,
    setUserStats,
    setDailyProgress
  } = useStatsStore.getState()
  
  // If data is fresh, return immediately
  if (userStats && dailyProgress && isDataFresh()) {
    console.log('📦 Using cached stats data')
    return { 
      success: true, 
      data: { userStats, dailyProgress }, 
      fromCache: true 
    }
  }
  
  // Otherwise load from API
  console.log('🔄 Loading fresh stats data')
  setStatsLoading(true)
  setProgressLoading(true)
  
  try {
    const startTime = Date.now()
    
    const [statsResponse, progressResponse] = await Promise.all([
      getUserStats(userId),
      getDailyProgress(userId)
    ])
    
    setUserStats(statsResponse.data)
    setDailyProgress(progressResponse.data)
    
    const syncTime = Date.now() - startTime
    
    return { 
      success: true,
      data: { 
        userStats: statsResponse.data, 
        dailyProgress: progressResponse.data
      }, 
      fromCache: false,
      syncTime
    }
  } catch (error) {
    setStatsLoading(false)
    setProgressLoading(false)
    return { success: false, error: error as Error }
  }
}

/**
 * Optimistic update for immediate UI feedback
 * Call this before API request in Repeat.tsx
 */
export const updateStatsOptimistically = (correctAnswers: number, totalAnswers: number): void => {
  const { updateStatsOptimistic, updateProgressOptimistic } = useStatsStore.getState()
  
  // Update stats
  updateStatsOptimistic(correctAnswers, totalAnswers)
  
  // Update daily progress (assume all answered questions are "mastered")
  updateProgressOptimistic(correctAnswers)
  
  console.log(`🚀 Optimistic update: +${correctAnswers}/${totalAnswers}`)
}

/**
 * Check if we need to refresh stats data
 */
export const shouldRefreshStats = (maxAgeMinutes = 10): boolean => {
  const { isDataFresh } = useStatsStore.getState()
  return !isDataFresh(maxAgeMinutes)
}

// ============================================================================
// Sync Queue Manager
// ============================================================================

export class SyncQueueManager {
  private queue: SyncOperation[] = []
  private isProcessing = false
  private config: SyncConfig
  private metrics: SyncMetrics
  private syncInterval?: number

  constructor(config: SyncConfig) {
    this.config = config
    this.metrics = {
      totalOperations: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      averageSyncTime: 0,
      lastSyncTime: 0,
      pendingOperations: 0
    }

    if (config.enableBackgroundSync) {
      this.startBackgroundSync()
    }
  }

  /**
   * Add operation to sync queue
   */
  enqueue(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>): string {
    const syncOp: SyncOperation = {
      ...operation,
      id: this.generateId(),
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    }

    // Insert based on priority
    if (operation.priority === 'high') {
      this.queue.unshift(syncOp)
    } else {
      this.queue.push(syncOp)
    }

    this.metrics.totalOperations++
    this.metrics.pendingOperations++

    console.log(`📤 Queued sync operation: ${syncOp.type} (${syncOp.priority} priority)`)

    // Process immediately if not already processing
    if (!this.isProcessing) {
      this.processQueue()
    }

    return syncOp.id
  }

  /**
   * Process sync queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return
    }

    this.isProcessing = true

    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.config.batchSize)
        await this.processBatch(batch)

        // Small delay between batches
        if (this.queue.length > 0) {
          await this.delay(100)
        }
      }
    } catch (error) {
      console.error('Sync queue processing error:', error)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Process a batch of sync operations
   */
  private async processBatch(operations: SyncOperation[]): Promise<void> {
    const promises = operations.map(op => this.processOperation(op))
    await Promise.allSettled(promises)
  }

  /**
   * Process individual sync operation
   */
  private async processOperation(operation: SyncOperation): Promise<void> {
    operation.status = 'syncing'
    const startTime = Date.now()

    try {
      let result: SyncResult

      switch (operation.type) {
        case 'stats':
          result = await this.syncStats(operation.data)
          break
        case 'progress':
          result = await this.syncProgress(operation.data)
          break
        case 'exam':
          result = await this.syncExamData(operation.data)
          break
        case 'settings':
          result = await this.syncSettings(operation.data)
          break
        default:
          throw new Error(`Unknown sync operation type: ${operation.type}`)
      }

      if (result.success) {
        operation.status = 'completed'
        this.metrics.successfulSyncs++
        this.metrics.pendingOperations--
        
        const syncTime = Date.now() - startTime
        this.updateAverageSyncTime(syncTime)
        this.metrics.lastSyncTime = Date.now()

        console.log(`✅ Sync completed: ${operation.type} (${syncTime}ms)`)
      } else {
        throw result.error || new Error('Sync failed')
      }
    } catch (error) {
      console.error(`❌ Sync failed: ${operation.type}`, error)
      
      operation.retryCount++
      
      if (operation.retryCount < this.config.retryAttempts) {
        operation.status = 'pending'
        // Re-queue with delay
        setTimeout(() => {
          this.queue.push(operation)
          if (!this.isProcessing) {
            this.processQueue()
          }
        }, this.config.retryDelay * operation.retryCount)
      } else {
        operation.status = 'failed'
        this.metrics.failedSyncs++
        this.metrics.pendingOperations--
      }
    }
  }

  /**
   * Sync stats data
   */
  private async syncStats(data: { userId: string }): Promise<SyncResult> {
    return await backgroundSyncStats(data.userId)
  }

  /**
   * Sync progress data
   */
  private async syncProgress(data: { userId: string }): Promise<SyncResult> {
    // Implementation would depend on specific progress sync requirements
    return await loadStatsWithCache(data.userId)
  }

  /**
   * Sync exam data
   */
  private async syncExamData(data: any): Promise<SyncResult> {
    // Placeholder for exam data sync
    // This would implement exam-specific synchronization logic
    try {
      // Simulate API call
      await this.delay(100)
      return { success: true, data }
    } catch (error) {
      return { success: false, error: error as Error }
    }
  }

  /**
   * Sync settings data
   */
  private async syncSettings(data: any): Promise<SyncResult> {
    // Placeholder for settings sync
    try {
      // Simulate API call
      await this.delay(50)
      return { success: true, data }
    } catch (error) {
      return { success: false, error: error as Error }
    }
  }

  /**
   * Start background sync interval
   */
  private startBackgroundSync(): void {
    this.syncInterval = window.setInterval(() => {
      if (this.queue.length > 0 && !this.isProcessing) {
        this.processQueue()
      }
    }, this.config.syncInterval)
  }

  /**
   * Stop background sync
   */
  stopBackgroundSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = undefined
    }
  }

  /**
   * Get sync metrics
   */
  getMetrics(): SyncMetrics {
    return { ...this.metrics }
  }

  /**
   * Clear completed operations from queue
   */
  clearCompleted(): number {
    const initialLength = this.queue.length
    this.queue = this.queue.filter(op => op.status !== 'completed')
    return initialLength - this.queue.length
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    total: number
    pending: number
    syncing: number
    completed: number
    failed: number
  } {
    const status = {
      total: this.queue.length,
      pending: 0,
      syncing: 0,
      completed: 0,
      failed: 0
    }

    this.queue.forEach(op => {
      status[op.status]++
    })

    return status
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private generateId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private updateAverageSyncTime(newTime: number): void {
    const totalSyncs = this.metrics.successfulSyncs
    this.metrics.averageSyncTime = 
      (this.metrics.averageSyncTime * (totalSyncs - 1) + newTime) / totalSyncs
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopBackgroundSync()
    this.queue = []
  }
}

// ============================================================================
// Conflict Resolution
// ============================================================================

export interface ConflictResolutionStrategy {
  resolveConflict<T>(localData: T, serverData: T, metadata?: any): T
}

export class TimestampConflictResolver implements ConflictResolutionStrategy {
  resolveConflict<T>(
    localData: T,
    serverData: T,
    metadata?: any
  ): T {
    // Type guard to check if data has timestamp
    const hasTimestamp = (data: any): data is { timestamp?: number } => {
      return data && typeof data === 'object' && ('timestamp' in data || metadata?.hasTimestamp)
    }

    if (hasTimestamp(localData) && hasTimestamp(serverData)) {
      const localTime = localData.timestamp || 0
      const serverTime = serverData.timestamp || 0
      return serverTime > localTime ? serverData : localData
    }
    
    // Fallback to server data if no timestamp info
    return serverData
  }
}

export class MergeConflictResolver implements ConflictResolutionStrategy {
  resolveConflict<T>(
    localData: T,
    serverData: T,
    metadata?: any
  ): T {
    // Type guard to check if data is mergeable object
    const isMergeable = (data: any): data is Record<string, any> => {
      return data && typeof data === 'object' && !Array.isArray(data)
    }

    if (isMergeable(localData) && isMergeable(serverData)) {
      return { ...localData, ...serverData } as T
    }
    
    // Fallback to server data if not mergeable
    return serverData
  }
}

// ============================================================================
// Global Sync Manager Instance
// ============================================================================

let syncManager: SyncQueueManager | null = null

export const initializeSyncManager = (config: SyncConfig): SyncQueueManager => {
  if (!syncManager) {
    syncManager = new SyncQueueManager(config)
  }
  return syncManager
}

export const getSyncManager = (): SyncQueueManager | null => syncManager

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Queue stats sync operation
 */
export const queueStatsSync = (userId: string, priority: 'high' | 'medium' | 'low' = 'medium'): string | null => {
  const manager = getSyncManager()
  if (!manager) return null

  return manager.enqueue({
    type: 'stats',
    data: { userId },
    priority
  })
}

/**
 * Queue progress sync operation
 */
export const queueProgressSync = (userId: string, priority: 'high' | 'medium' | 'low' = 'medium'): string | null => {
  const manager = getSyncManager()
  if (!manager) return null

  return manager.enqueue({
    type: 'progress',
    data: { userId },
    priority
  })
}

/**
 * Force immediate sync of all pending operations
 */
export const forceSyncAll = async (): Promise<void> => {
  const manager = getSyncManager()
  if (manager) {
    // This would trigger immediate processing
    console.log('🔄 Forcing sync of all pending operations')
  }
}

// ============================================================================
// Default Configuration
// ============================================================================

export const defaultSyncConfig: SyncConfig = {
  enableBackgroundSync: true,
  syncInterval: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
  batchSize: 5,
  enableOptimisticUpdates: true,
  enableConflictResolution: true
}

export default {
  backgroundSyncStats,
  loadStatsWithCache,
  updateStatsOptimistically,
  shouldRefreshStats,
  SyncQueueManager,
  TimestampConflictResolver,
  MergeConflictResolver,
  initializeSyncManager,
  getSyncManager,
  queueStatsSync,
  queueProgressSync,
  forceSyncAll,
  defaultSyncConfig
}