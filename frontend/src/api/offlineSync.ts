// Offline Synchronization Service
// Integrates the offline queue with the existing API layer

import api from './api'
import fsrsApi from './fsrs'
import { useOfflineQueue, QueuedOperation, SyncResult, OperationType } from '../store/offlineQueue'
import { useUnifiedStore } from '../store/unified'
import { conflictManager } from '../utils/features/offline'
import type { AnswerSubmit, UserSettingsUpdate, ExamSettingsUpdate } from './api'

// ============================================================================
// Operation Handlers
// ============================================================================

interface OperationHandler {
  sync: (operation: QueuedOperation) => Promise<any>
  rollback?: (operation: QueuedOperation) => void
  validate?: (operation: QueuedOperation) => boolean
}

const operationHandlers: Record<OperationType, OperationHandler> = {
  SUBMIT_ANSWER: {
    sync: async (operation) => {
      const payload = operation.payload as AnswerSubmit
      const response = await api.post('/user_progress/submit_answer', payload)
      return response.data
    },
    validate: (operation) => {
      const payload = operation.payload as AnswerSubmit
      return !!(payload.user_id && payload.question_id !== undefined && typeof payload.is_correct === 'boolean')
    }
  },

  UPDATE_USER_SETTINGS: {
    sync: async (operation) => {
      const { userId, updates } = operation.payload as { userId: string; updates: UserSettingsUpdate }
      const response = await api.patch(`/users/${userId}`, updates)
      return response.data
    },
    validate: (operation) => {
      const payload = operation.payload
      return !!(payload.userId && payload.updates)
    }
  },

  UPDATE_EXAM_SETTINGS: {
    sync: async (operation) => {
      const { userId, settings } = operation.payload as { userId: string; settings: ExamSettingsUpdate }
      const response = await api.post(`/users/${userId}/exam-settings`, settings)
      return response.data
    },
    validate: (operation) => {
      const payload = operation.payload
      return !!(payload.userId && payload.settings)
    }
  },

  SYNC_PROGRESS: {
    sync: async (operation) => {
      const { userId, targetDate } = operation.payload as { userId: string; targetDate?: string }
      const response = await api.get(`/users/${userId}/daily-progress`, {
        params: targetDate ? { target_date: targetDate } : {}
      })
      return response.data
    },
    validate: (operation) => {
      const payload = operation.payload
      return !!(payload.userId)
    }
  },

  FSRS_RATING: {
    sync: async (operation) => {
      const { userId, questionId, rating, isCorrect, answeredAt } = operation.payload as {
        userId: string;
        questionId: number;
        rating: number;
        isCorrect: boolean;
        answeredAt?: string;
      }
      const response = await fsrsApi.submitAnswer({
        user_id: userId,
        question_id: questionId,
        is_correct: isCorrect,
        answered_at: answeredAt
      }, rating)
      return response
    },
    validate: (operation) => {
      const payload = operation.payload
      return !!(payload.userId && payload.questionId && typeof payload.rating === 'number' && typeof payload.isCorrect === 'boolean')
    }
  },

  CUSTOM_API_CALL: {
    sync: async (operation) => {
      const { method, url, data, params } = operation.payload as {
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
        url: string
        data?: any
        params?: any
      }
      
      const response = await api.request({
        method,
        url,
        data,
        params
      })
      
      return response.data
    },
    validate: (operation) => {
      const payload = operation.payload
      return !!(payload.method && payload.url)
    }
  }
}

// ============================================================================
// Sync Service Implementation
// ============================================================================

class OfflineSyncService {
  private syncInProgress = false
  private syncInterval: number | null = null

  constructor() {
    this.setupQueueIntegration()
  }

  private setupQueueIntegration(): void {
    // Override the syncOperation method in the queue store
    const originalStore = useOfflineQueue.getState()
    
    useOfflineQueue.setState({
      syncOperation: this.syncOperation.bind(this)
    })
  }

  async syncOperation(operation: QueuedOperation): Promise<SyncResult> {
    const handler = operationHandlers[operation.type]
    
    if (!handler) {
      return {
        success: false,
        operation,
        error: `No handler found for operation type: ${operation.type}`
      }
    }

    // Validate operation before syncing
    if (handler.validate && !handler.validate(operation)) {
      return {
        success: false,
        operation,
        error: 'Operation validation failed'
      }
    }

    try {
      console.log(`🔄 Syncing operation: ${operation.type} (${operation.id})`)
      
      const result = await handler.sync(operation)
      
      // Handle potential conflicts and resolve them
      const resolvedResult = await conflictManager.detectAndResolveConflicts(operation, result)
      
      // Update unified store with resolved data after successful sync
      await this.updateUnifiedStoreAfterSync(operation, resolvedResult)
      
      console.log(`✅ Successfully synced operation: ${operation.type} (${operation.id})`)
      
      return {
        success: true,
        operation,
        serverResponse: resolvedResult
      }
    } catch (error) {
      console.error(`❌ Failed to sync operation: ${operation.type} (${operation.id})`, error)
      
      return {
        success: false,
        operation,
        error: error instanceof Error ? error.message : 'Unknown sync error'
      }
    }
  }

  private async updateUnifiedStoreAfterSync(operation: QueuedOperation, result: any): Promise<void> {
    const unifiedStore = useUnifiedStore.getState()
    
    try {
      switch (operation.type) {
        case 'SUBMIT_ANSWER':
          // Invalidate user stats and daily progress to force refresh
          unifiedStore.invalidateCache('userStats')
          unifiedStore.invalidateCache('dailyProgress')
          unifiedStore.invalidateCache('remainingCount')
          
          // Refresh critical data
          if (operation.userId) {
            await Promise.allSettled([
              unifiedStore.loadUserStats(operation.userId),
              unifiedStore.loadDailyProgress(operation.userId),
              unifiedStore.loadRemainingCount(
                operation.userId, 
                unifiedStore.settings.examCountry, 
                unifiedStore.settings.examLanguage
              )
            ])
          }
          break

        case 'UPDATE_USER_SETTINGS':
          // Update user data in store
          unifiedStore.invalidateCache('user')
          if (operation.userId) {
            await unifiedStore.loadUser(parseInt(operation.userId))
          }
          break

        case 'UPDATE_EXAM_SETTINGS':
          // Update exam settings in store
          unifiedStore.invalidateCache('examSettings')
          if (operation.userId) {
            await unifiedStore.loadExamSettings(operation.userId)
          }
          break

        case 'SYNC_PROGRESS':
          // Update daily progress
          unifiedStore.invalidateCache('dailyProgress')
          if (operation.userId) {
            await unifiedStore.loadDailyProgress(operation.userId, operation.payload.targetDate)
          }
          break

        case 'FSRS_RATING':
          // Invalidate FSRS-related caches
          unifiedStore.invalidateCache('fsrsStats')
          unifiedStore.invalidateCache('fsrsDueQuestions')
          unifiedStore.invalidateCache('fsrsCardInfo')
          
          if (operation.userId) {
            await Promise.allSettled([
              unifiedStore.loadFSRSStats(operation.userId),
              unifiedStore.loadFSRSDueQuestions(
                operation.userId,
                unifiedStore.settings.examCountry,
                unifiedStore.settings.examLanguage
              )
            ])
          }
          break
      }
    } catch (error) {
      console.warn('Failed to update unified store after sync:', error)
    }
  }

  startAutoSync(intervalMs: number = 30000): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }

    this.syncInterval = window.setInterval(() => {
      const queueState = useOfflineQueue.getState()
      
      if (queueState.networkStatus === 'ONLINE' && 
          queueState.queueStatus === 'IDLE' && 
          queueState.queue.length > 0) {
        queueState.startSync().catch(console.error)
      }
    }, intervalMs)
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  async forceSyncAll(): Promise<void> {
    const queueState = useOfflineQueue.getState()
    await queueState.startSync()
  }
}

// ============================================================================
// Optimistic Update Integration
// ============================================================================

class OptimisticUpdateService {
  private appliedUpdates = new Map<string, any>()

  applyOptimisticUpdate(operation: QueuedOperation): void {
    if (!operation.optimisticUpdate) return

    const unifiedStore = useUnifiedStore.getState()
    const { storeKey, updateFn } = operation.optimisticUpdate

    try {
      // Get current data from unified store
      const currentData = unifiedStore.getCachedData(storeKey)
      
      if (currentData !== null) {
        // Store original data for rollback
        this.appliedUpdates.set(operation.id, currentData)
        
        // Apply optimistic update
        const updatedData = updateFn(currentData)
        unifiedStore.setCachedData(storeKey, updatedData, 60000) // 1 minute TTL for optimistic updates
        
        console.log(`🔮 Applied optimistic update for operation: ${operation.id}`)
      }
    } catch (error) {
      console.error('Failed to apply optimistic update:', error)
    }
  }

  rollbackOptimisticUpdate(operation: QueuedOperation): void {
    if (!operation.optimisticUpdate) return

    const originalData = this.appliedUpdates.get(operation.id)
    if (originalData === undefined) return

    const unifiedStore = useUnifiedStore.getState()
    const { storeKey } = operation.optimisticUpdate

    try {
      // Restore original data
      unifiedStore.setCachedData(storeKey, originalData)
      this.appliedUpdates.delete(operation.id)
      
      console.log(`🔄 Rolled back optimistic update for operation: ${operation.id}`)
    } catch (error) {
      console.error('Failed to rollback optimistic update:', error)
    }
  }

  clearAllOptimisticUpdates(): void {
    this.appliedUpdates.clear()
  }
}

// ============================================================================
// Service Instances and Integration
// ============================================================================

const syncService = new OfflineSyncService()
const optimisticService = new OptimisticUpdateService()

// Integrate optimistic updates with the queue store
const originalQueueStore = useOfflineQueue.getState()

useOfflineQueue.setState({
  applyOptimisticUpdate: optimisticService.applyOptimisticUpdate.bind(optimisticService),
  rollbackOptimisticUpdate: optimisticService.rollbackOptimisticUpdate.bind(optimisticService)
})

// ============================================================================
// High-Level API Functions
// ============================================================================

export const offlineApi = {
  // Answer submission with offline support
  submitAnswer: (payload: AnswerSubmit, optimistic = true) => {
    const queueActions = useOfflineQueue.getState()
    
    const optimisticUpdate = optimistic ? {
      storeKey: `userStats:${payload.user_id}`,
      updateFn: (currentStats: any) => ({
        ...currentStats,
        answered: (currentStats?.answered || 0) + 1,
        correct: (currentStats?.correct || 0) + (payload.is_correct ? 1 : 0)
      }),
      rollbackFn: (currentStats: any) => ({
        ...currentStats,
        answered: Math.max(0, (currentStats?.answered || 0) - 1),
        correct: Math.max(0, (currentStats?.correct || 0) - (payload.is_correct ? 1 : 0))
      })
    } : undefined

    return queueActions.enqueue({
      type: 'SUBMIT_ANSWER',
      payload,
      priority: 'HIGH',
      maxRetries: 5,
      userId: payload.user_id,
      optimisticUpdate
    })
  },

  // User settings update with offline support
  updateUserSettings: (userId: string, updates: UserSettingsUpdate, optimistic = true) => {
    const queueActions = useOfflineQueue.getState()
    
    const optimisticUpdate = optimistic ? {
      storeKey: `user:${userId}`,
      updateFn: (currentUser: any) => ({
        ...currentUser,
        ...updates
      }),
      rollbackFn: (currentUser: any) => {
        const rollbackUser = { ...currentUser }
        Object.keys(updates).forEach(key => {
          delete rollbackUser[key]
        })
        return rollbackUser
      }
    } : undefined

    return queueActions.enqueue({
      type: 'UPDATE_USER_SETTINGS',
      payload: { userId, updates },
      priority: 'MEDIUM',
      maxRetries: 3,
      userId,
      optimisticUpdate
    })
  },

  // Exam settings update with offline support
  updateExamSettings: (userId: string, settings: ExamSettingsUpdate, optimistic = true) => {
    const queueActions = useOfflineQueue.getState()
    
    const optimisticUpdate = optimistic ? {
      storeKey: `examSettings:${userId}`,
      updateFn: (currentSettings: any) => ({
        ...currentSettings,
        ...settings
      }),
      rollbackFn: (currentSettings: any) => {
        const rollbackSettings = { ...currentSettings }
        Object.keys(settings).forEach(key => {
          delete rollbackSettings[key]
        })
        return rollbackSettings
      }
    } : undefined

    return queueActions.enqueue({
      type: 'UPDATE_EXAM_SETTINGS',
      payload: { userId, settings },
      priority: 'MEDIUM',
      maxRetries: 3,
      userId,
      optimisticUpdate
    })
  },

  // FSRS rating with offline support
  submitFSRSRating: (userId: string, questionId: number, rating: number, isCorrect: boolean, answeredAt?: string) => {
    const queueActions = useOfflineQueue.getState()

    return queueActions.enqueue({
      type: 'FSRS_RATING',
      payload: { userId, questionId, rating, isCorrect, answeredAt },
      priority: 'HIGH',
      maxRetries: 5,
      userId
    })
  },

  // Generic API call with offline support
  queueApiCall: (
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    data?: any,
    params?: any,
    priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM'
  ) => {
    const queueActions = useOfflineQueue.getState()

    return queueActions.enqueue({
      type: 'CUSTOM_API_CALL',
      payload: { method, url, data, params },
      priority,
      maxRetries: 3
    })
  }
}

// ============================================================================
// Service Control Functions
// ============================================================================

export const syncControl = {
  start: (intervalMs?: number) => syncService.startAutoSync(intervalMs),
  stop: () => syncService.stopAutoSync(),
  forceSync: () => syncService.forceSyncAll(),
  clearOptimisticUpdates: () => optimisticService.clearAllOptimisticUpdates()
}

// ============================================================================
// Initialization Function
// ============================================================================

export const initializeOfflineSync = () => {
  // Start auto-sync by default
  syncService.startAutoSync()
  
  console.log('Offline sync service initialized')
  
  return () => {
    syncService.stopAutoSync()
    optimisticService.clearAllOptimisticUpdates()
  }
}

export default offlineApi