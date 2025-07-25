// React Hooks for State Management Integration
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStateCoordinator, useStateCoordinatorActions } from '../stateCoordinator'
import { useUnifiedStore, useUnifiedActions } from '../unified'
import { useOfflineQueue } from '../offlineQueue'
import { useSession } from '../session'
import { useFSRSStore } from '../fsrs'
import { useStatsStore } from '../stats'
import { stateLogger } from '../logging/stateLogger'
import { storeMigration } from '../../utils/storeMigration'

// ============================================================================
// Core State Management Hooks
// ============================================================================

/**
 * Main hook for accessing coordinated state management
 * Provides unified access to all stores with automatic coordination
 */
export const useCoordinatedState = (componentName?: string) => {
  const coordinator = useStateCoordinator()
  const coordinatorActions = useStateCoordinatorActions()
  const unifiedActions = useUnifiedActions()
  
  // Determine if component should use unified store
  const shouldUseUnified = componentName ? 
    storeMigration.shouldUseUnifiedStore(componentName) : true
  
  // Get current user ID from session
  const sessionStore = useSession()
  const userId = sessionStore.userId
  
  // Auto-sync on mount and user change
  useEffect(() => {
    if (userId && coordinator.config.enableAutoSync) {
      coordinatorActions.syncAllStores(userId).catch(error => {
        stateLogger.error('coordinated-state', 'Auto-sync failed', { error, userId, componentName })
      })
    }
  }, [userId, componentName])
  
  // Log component usage
  useEffect(() => {
    if (componentName) {
      stateLogger.info('component', `${componentName} mounted with coordinated state`, {
        shouldUseUnified,
        userId
      })
    }
  }, [componentName, shouldUseUnified, userId])
  
  return {
    // Store selection
    shouldUseUnified,
    
    // Current state
    userId,
    isOnline: useOfflineQueue(state => state.networkStatus === 'ONLINE'),
    isSyncing: coordinator.syncStatus.isActive,
    
    // Actions
    syncAllStores: coordinatorActions.syncAllStores,
    validateStores: coordinatorActions.validateAllStores,
    
    // Store health
    storeHealth: coordinator.getStoreHealth(),
    errors: coordinator.errors,
    
    // Metrics
    metrics: coordinator.getMetrics(),
    
    // Utilities
    createSnapshot: coordinatorActions.createSnapshot,
    exportState: coordinatorActions.exportState
  }
}

/**
 * Hook for user data management with automatic coordination
 */
export const useCoordinatedUser = () => {
  const { shouldUseUnified } = useCoordinatedState('user-data')
  const unifiedStore = useUnifiedStore()
  const unifiedActions = useUnifiedActions()
  const sessionStore = useSession()
  
  // Use unified store if available, fallback to session store
  const user = shouldUseUnified ? unifiedStore.user : sessionStore.cachedUser
  const loading = shouldUseUnified ? unifiedStore.loading.user : false
  const error = shouldUseUnified ? unifiedStore.errors.user : null
  
  const loadUser = useCallback(async (telegramId: number) => {
    try {
      stateLogger.info('user-data', 'Loading user', { telegramId, shouldUseUnified })
      
      if (shouldUseUnified) {
        return await unifiedActions.loadUser(telegramId)
      } else {
        // Fallback to session store method
        const { loadUserWithCache } = await import('../session')
        return await loadUserWithCache(telegramId)
      }
    } catch (error) {
      stateLogger.error('user-data', 'Failed to load user', { error, telegramId })
      throw error
    }
  }, [shouldUseUnified, unifiedActions])
  
  const updateUser = useCallback(async (userId: string, updates: any) => {
    try {
      stateLogger.info('user-data', 'Updating user', { userId, updates, shouldUseUnified })
      
      if (shouldUseUnified) {
        return await unifiedActions.updateUser(userId, updates)
      } else {
        // Fallback to session store method
        const { updateUserAndCache } = await import('../session')
        return await updateUserAndCache(userId, updates)
      }
    } catch (error) {
      stateLogger.error('user-data', 'Failed to update user', { error, userId, updates })
      throw error
    }
  }, [shouldUseUnified, unifiedActions])
  
  return {
    user,
    loading,
    error,
    loadUser,
    updateUser,
    isUnified: shouldUseUnified
  }
}

/**
 * Hook for settings management with automatic synchronization
 */
export const useCoordinatedSettings = () => {
  const { shouldUseUnified } = useCoordinatedState('settings')
  const unifiedStore = useUnifiedStore()
  const unifiedActions = useUnifiedActions()
  const sessionStore = useSession()
  const coordinatorActions = useStateCoordinatorActions()
  
  // Use unified store if available, fallback to session store
  const settings = shouldUseUnified ? unifiedStore.settings : {
    useFSRS: sessionStore.useFSRS,
    autoRating: sessionStore.autoRating,
    examCountry: sessionStore.examCountry,
    examLanguage: sessionStore.examLanguage,
    uiLanguage: sessionStore.uiLanguage,
    examDate: sessionStore.examDate,
    manualDailyGoal: sessionStore.manualDailyGoal
  }
  
  const updateSettings = useCallback(async (updates: Partial<typeof settings>) => {
    try {
      stateLogger.info('settings', 'Updating settings', { updates, shouldUseUnified })
      
      if (shouldUseUnified) {
        unifiedActions.updateSettings(updates)
      } else {
        // Update session store
        if (updates.examCountry !== undefined) sessionStore.setExamCountry(updates.examCountry)
        if (updates.examLanguage !== undefined) sessionStore.setExamLanguage(updates.examLanguage)
        if (updates.uiLanguage !== undefined) sessionStore.setUiLanguage(updates.uiLanguage)
        if (updates.examDate !== undefined) sessionStore.setExamDate(updates.examDate)
        if (updates.manualDailyGoal !== undefined) sessionStore.setManualDailyGoal(updates.manualDailyGoal)
        if (updates.useFSRS !== undefined) sessionStore.setUseFSRS(updates.useFSRS)
        if (updates.autoRating !== undefined) sessionStore.setAutoRating(updates.autoRating)
      }
      
      // Sync settings across stores
      await coordinatorActions.syncAllStores(sessionStore.userId || '')
      
    } catch (error) {
      stateLogger.error('settings', 'Failed to update settings', { error, updates })
      throw error
    }
  }, [shouldUseUnified, unifiedActions, sessionStore, coordinatorActions])
  
  return {
    settings,
    updateSettings,
    isUnified: shouldUseUnified
  }
}

/**
 * Hook for statistics and progress data
 */
export const useCoordinatedStats = () => {
  const { shouldUseUnified } = useCoordinatedState('stats')
  const unifiedStore = useUnifiedStore()
  const unifiedActions = useUnifiedActions()
  const statsStore = useStatsStore()
  const sessionStore = useSession()
  
  // Use unified store if available, fallback to legacy stores
  const userStats = shouldUseUnified ? unifiedStore.userStats : statsStore.userStats
  const dailyProgress = shouldUseUnified ? unifiedStore.dailyProgress : 
    (statsStore.dailyProgress || { 
      questions_mastered_today: sessionStore.dailyProgress || 0,
      date: sessionStore.dailyProgressDate || new Date().toISOString().split('T')[0]
    })
  const streakDays = shouldUseUnified ? unifiedStore.streakDays : sessionStore.streakDays
  
  const loading = shouldUseUnified ? {
    userStats: unifiedStore.loading.userStats,
    dailyProgress: unifiedStore.loading.dailyProgress,
    streakDays: unifiedStore.loading.streakDays
  } : {
    userStats: statsStore.isStatsLoading,
    dailyProgress: statsStore.isProgressLoading,
    streakDays: false
  }
  
  const loadStats = useCallback(async (userId: string) => {
    try {
      stateLogger.info('stats', 'Loading stats', { userId, shouldUseUnified })
      
      if (shouldUseUnified) {
        await Promise.allSettled([
          unifiedActions.loadUserStats(userId),
          unifiedActions.loadDailyProgress(userId),
          unifiedActions.loadStreakDays(userId)
        ])
      } else {
        // Load using legacy methods
        // This would need to be implemented based on existing API calls
        stateLogger.warn('stats', 'Legacy stats loading not fully implemented')
      }
    } catch (error) {
      stateLogger.error('stats', 'Failed to load stats', { error, userId })
      throw error
    }
  }, [shouldUseUnified, unifiedActions])
  
  return {
    userStats,
    dailyProgress,
    streakDays,
    loading,
    loadStats,
    isUnified: shouldUseUnified
  }
}

/**
 * Hook for FSRS integration
 */
export const useCoordinatedFSRS = () => {
  const { shouldUseUnified } = useCoordinatedState('fsrs')
  const unifiedStore = useUnifiedStore()
  const unifiedActions = useUnifiedActions()
  const fsrsStore = useFSRSStore()
  const sessionStore = useSession()
  
  // Use unified store if available, fallback to FSRS store
  const fsrsStats = shouldUseUnified ? unifiedStore.fsrsStats : fsrsStore.currentStats
  const dueQuestions = shouldUseUnified ? unifiedStore.fsrsDueQuestions : fsrsStore.dueQuestions
  const settings = shouldUseUnified ? {
    enabled: unifiedStore.settings.useFSRS,
    autoRating: unifiedStore.settings.autoRating
  } : {
    enabled: fsrsStore.settings.enabled,
    autoRating: fsrsStore.settings.autoRating
  }
  
  const loading = shouldUseUnified ? {
    stats: unifiedStore.loading.fsrsStats,
    dueQuestions: unifiedStore.loading.fsrsDueQuestions
  } : {
    stats: fsrsStore.isLoading,
    dueQuestions: fsrsStore.isLoading
  }
  
  const loadFSRSData = useCallback(async (userId: string, country: string, language: string) => {
    try {
      stateLogger.info('fsrs', 'Loading FSRS data', { userId, country, language, shouldUseUnified })
      
      if (shouldUseUnified) {
        await Promise.allSettled([
          unifiedActions.loadFSRSStats(userId),
          unifiedActions.loadFSRSDueQuestions(userId, country, language)
        ])
      } else {
        await Promise.allSettled([
          fsrsStore.loadStats(userId),
          fsrsStore.loadDueQuestions(userId, country, language)
        ])
      }
    } catch (error) {
      stateLogger.error('fsrs', 'Failed to load FSRS data', { error, userId, country, language })
      throw error
    }
  }, [shouldUseUnified, unifiedActions, fsrsStore])
  
  return {
    fsrsStats,
    dueQuestions,
    settings,
    loading,
    loadFSRSData,
    isUnified: shouldUseUnified
  }
}

/**
 * Hook for offline queue management
 */
export const useCoordinatedOffline = () => {
  const offlineQueue = useOfflineQueue()
  const coordinatorActions = useStateCoordinatorActions()
  
  const enqueueOperation = useCallback((operation: any) => {
    try {
      stateLogger.info('offline', 'Enqueuing operation', { operation })
      return offlineQueue.enqueue(operation)
    } catch (error) {
      stateLogger.error('offline', 'Failed to enqueue operation', { error, operation })
      throw error
    }
  }, [offlineQueue])
  
  const syncQueue = useCallback(async () => {
    try {
      stateLogger.info('offline', 'Starting queue sync')
      await offlineQueue.startSync()
    } catch (error) {
      stateLogger.error('offline', 'Queue sync failed', { error })
      throw error
    }
  }, [offlineQueue])
  
  return {
    queueSize: offlineQueue.queue.length,
    networkStatus: offlineQueue.networkStatus,
    queueStatus: offlineQueue.queueStatus,
    errors: offlineQueue.errors,
    stats: offlineQueue.stats,
    enqueueOperation,
    syncQueue,
    clearQueue: offlineQueue.clearQueue,
    retryFailedOperations: offlineQueue.retryFailedOperations
  }
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook for monitoring store health
 */
export const useStoreHealth = () => {
  const coordinator = useStateCoordinator()
  const [health, setHealth] = useState(coordinator.getStoreHealth())
  
  useEffect(() => {
    const interval = setInterval(() => {
      setHealth(coordinator.getStoreHealth())
    }, 5000) // Update every 5 seconds
    
    return () => clearInterval(interval)
  }, [coordinator])
  
  const healthSummary = useMemo(() => {
    const stores = Array.from(health.values())
    return {
      total: stores.length,
      healthy: stores.filter(s => s.status === 'healthy').length,
      warning: stores.filter(s => s.status === 'warning').length,
      error: stores.filter(s => s.status === 'error').length,
      overallStatus: stores.some(s => s.status === 'error') ? 'error' as const :
                    stores.some(s => s.status === 'warning') ? 'warning' as const : 'healthy' as const
    }
  }, [health])
  
  return {
    health,
    summary: healthSummary,
    refresh: () => setHealth(coordinator.getStoreHealth())
  }
}

/**
 * Hook for performance monitoring
 */
export const usePerformanceMonitoring = () => {
  const coordinator = useStateCoordinator()
  const [metrics, setMetrics] = useState(coordinator.getMetrics())
  
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(coordinator.getMetrics())
    }, 1000) // Update every second
    
    return () => clearInterval(interval)
  }, [coordinator])
  
  const performanceSummary = useMemo(() => {
    const successRate = metrics.totalOperations > 0 ? 
      (metrics.successfulOperations / metrics.totalOperations) * 100 : 100
    
    return {
      successRate,
      errorRate: 100 - successRate,
      averageResponseTime: metrics.averageResponseTime,
      cacheHitRate: metrics.cacheHitRate * 100,
      totalOperations: metrics.totalOperations,
      recentErrors: metrics.validationErrors
    }
  }, [metrics])
  
  return {
    metrics,
    summary: performanceSummary,
    reset: coordinator.resetMetrics
  }
}

/**
 * Hook for development tools integration
 */
export const useDevTools = () => {
  const coordinatorActions = useStateCoordinatorActions()
  const [isEnabled, setIsEnabled] = useState(false)
  
  useEffect(() => {
    // Check if dev tools should be enabled
    setIsEnabled(typeof window !== 'undefined' && 
                 (window as any).__STATE_COORDINATOR_DEVTOOLS__ !== undefined)
  }, [])
  
  return {
    isEnabled,
    exportState: coordinatorActions.exportState,
    importState: coordinatorActions.importState,
    createSnapshot: coordinatorActions.createSnapshot,
    clearErrors: coordinatorActions.clearErrors,
    validateStores: coordinatorActions.validateAllStores
  }
}

// ============================================================================
// Migration Helper Hook
// ============================================================================

/**
 * Hook to help with gradual migration from legacy stores
 */
export const useMigrationHelper = (componentName: string) => {
  const migrationStatus = storeMigration.getMigrationStatus()
  const shouldUseUnified = storeMigration.shouldUseUnifiedStore(componentName)
  
  const enableUnified = useCallback(() => {
    stateLogger.info('migration', `Enabling unified store for ${componentName}`)
    storeMigration.enableUnifiedStore(componentName)
  }, [componentName])
  
  const preloadData = useCallback(async (userId: string) => {
    try {
      await storeMigration.preloadComponentData(componentName, userId)
    } catch (error) {
      stateLogger.error('migration', `Failed to preload data for ${componentName}`, { error })
    }
  }, [componentName])
  
  return {
    shouldUseUnified,
    migrationStatus,
    enableUnified,
    preloadData,
    isFullyMigrated: migrationStatus.migrationProgress === 100
  }
}