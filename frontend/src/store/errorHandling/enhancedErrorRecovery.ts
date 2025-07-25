// Enhanced Error Recovery System - Integrates with existing error recovery
import React from 'react'
import { errorRecoveryManager, AppError, ErrorType, ErrorSeverity } from './errorRecovery'
import { useUnifiedStore } from '../unified'
import { useOfflineQueue } from '../offlineQueue'

// ============================================================================
// Enhanced Error Recovery Hook
// ============================================================================

export const useEnhancedErrorRecovery = () => {
  const unifiedStore = useUnifiedStore()
  const offlineQueue = useOfflineQueue()

  // Handle errors with automatic recovery attempts
  const handleErrorWithRecovery = React.useCallback((
    error: Error,
    context?: {
      operation?: string
      severity?: ErrorSeverity
      autoRetry?: boolean
      maxRetries?: number
    }
  ) => {
    const errorId = errorRecoveryManager.handleError(error, {
      operation: context?.operation || 'unknown',
      additionalData: context
    })

    // Attempt automatic recovery for certain error types
    if (context?.autoRetry !== false) {
      setTimeout(() => {
        errorRecoveryManager.attemptRecovery(errorId)
      }, 1000)
    }

    return errorId
  }, [])

  // Attempt recovery with user feedback
  const attemptRecovery = React.useCallback(async (errorId: string) => {
    try {
      const success = await errorRecoveryManager.attemptRecovery(errorId)
      
      if (success) {
        console.log('✅ Error recovery successful:', errorId)
      } else {
        console.warn('❌ Error recovery failed:', errorId)
      }
      
      return success
    } catch (recoveryError) {
      console.error('🚨 Recovery attempt failed:', recoveryError)
      return false
    }
  }, [])

  // Get user-friendly error title
  const getErrorTitle = (error: Error, operation?: string) => {
    if (operation) {
      switch (operation) {
        case 'api_call': return 'Ошибка загрузки данных'
        case 'save_data': return 'Ошибка сохранения'
        case 'sync': return 'Ошибка синхронизации'
        case 'cache': return 'Ошибка кэша'
        case 'validation': return 'Ошибка валидации'
        default: return 'Техническая ошибка'
      }
    }
    
    if (error.message.toLowerCase().includes('network')) {
      return 'Проблемы с сетью'
    }
    
    if (error.message.toLowerCase().includes('storage')) {
      return 'Проблемы с хранилищем'
    }
    
    return 'Техническая ошибка'
  }

  return {
    handleErrorWithRecovery,
    attemptRecovery,
    getErrorTitle
  }
}

// ============================================================================
// Error Recovery Strategies for Different Systems
// ============================================================================

export const useSystemErrorRecovery = () => {
  const { handleErrorWithRecovery, attemptRecovery } = useEnhancedErrorRecovery()
  const unifiedActions = useUnifiedStore()
  const offlineActions = useOfflineQueue()

  // Unified Store Error Recovery
  const handleUnifiedStoreError = React.useCallback(async (
    error: Error,
    operation: string,
    retryAction?: () => Promise<any>
  ) => {
    const errorId = handleErrorWithRecovery(error, {
      operation: `unified_store_${operation}`,
      severity: 'medium',
      autoRetry: !!retryAction
    })

    // Attempt automatic recovery
    if (retryAction) {
      try {
        await retryAction()
        return true
      } catch (retryError) {
        console.error('Retry failed:', retryError)
        return false
      }
    }

    return false
  }, [handleErrorWithRecovery])

  // Offline Queue Error Recovery
  const handleOfflineQueueError = React.useCallback(async (
    error: Error,
    operation: string
  ) => {
    const errorId = handleErrorWithRecovery(error, {
      operation: `offline_queue_${operation}`,
      severity: 'high',
      autoRetry: true
    })

    // Try to restart sync
    try {
      await offlineActions.startSync()
      return true
    } catch (syncError) {
      console.error('Sync restart failed:', syncError)
      return false
    }
  }, [handleErrorWithRecovery, offlineActions])

  // API Error Recovery
  const handleAPIError = React.useCallback(async (
    error: Error,
    endpoint: string,
    retryFunction?: () => Promise<any>
  ) => {
    const errorId = handleErrorWithRecovery(error, {
      operation: `api_${endpoint}`,
      severity: 'high',
      autoRetry: !!retryFunction
    })

    // Check if we should use cached data
    if (error.message.includes('network') || error.message.includes('fetch')) {
      // Switch to offline mode temporarily
      offlineActions.setNetworkStatus('OFFLINE')
      
      // Try to use cached data
      const cachedData = unifiedActions.getCachedData(endpoint)
      if (cachedData) {
        return cachedData
      }
    }

    // Attempt retry if provided
    if (retryFunction) {
      try {
        return await retryFunction()
      } catch (retryError) {
        console.error('API retry failed:', retryError)
        return null
      }
    }

    return null
  }, [handleErrorWithRecovery, offlineActions, unifiedActions])

  return {
    handleUnifiedStoreError,
    handleOfflineQueueError,
    handleAPIError,
    attemptRecovery
  }
}

// ============================================================================
// Graceful Degradation Strategies
// ============================================================================

export const useGracefulDegradation = () => {
  // Fallback to cached data
  const useCachedDataFallback = React.useCallback(<T>(
    cacheKey: string,
    fallbackData?: T,
    showNotification = true
  ): T | null => {
    const unifiedActions = useUnifiedStore.getState()
    const cachedData = unifiedActions.getCachedData<T>(cacheKey)
    
    if (cachedData) {
      if (showNotification) {
        console.warn('📦 Using cached data for:', cacheKey)
      }
      return cachedData
    }
    
    if (fallbackData) {
      if (showNotification) {
        console.warn('🔄 Using fallback data for:', cacheKey)
      }
      return fallbackData
    }
    
    return null
  }, [])

  // Fallback to offline mode
  const useOfflineModeFallback = React.useCallback((showNotification = true) => {
    const offlineActions = useOfflineQueue.getState()
    offlineActions.setNetworkStatus('OFFLINE')
    
    if (showNotification) {
      console.warn('📴 Switching to offline mode')
    }
  }, [])

  // Fallback to simplified UI
  const useSimplifiedUIFallback = React.useCallback((
    reason: string,
    showNotification = true
  ) => {
    if (showNotification) {
      console.warn('🎨 Using simplified UI:', reason)
    }
    
    // Return simplified UI state
    return {
      showAdvancedFeatures: false,
      showCharts: false,
      showAnimations: false,
      showComplexComponents: false
    }
  }, [])

  return {
    useCachedDataFallback,
    useOfflineModeFallback,
    useSimplifiedUIFallback
  }
}

// ============================================================================
// Error Recovery Wrapper for API Calls
// ============================================================================

export const withErrorRecovery = <T>(
  apiCall: () => Promise<T>,
  options?: {
    retries?: number
    fallbackData?: T
    cacheKey?: string
    operation?: string
  }
) => {
  return async (): Promise<T> => {
    const retries = options?.retries || 2
    let lastError: Error | null = null
    
    // Attempt the API call with retries
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await apiCall()
      } catch (error) {
        lastError = error as Error
        
        if (attempt < retries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
          continue
        }
      }
    }
    
    // All retries failed, handle error
    if (lastError) {
      errorRecoveryManager.handleError(lastError, {
        operation: options?.operation || 'api_call',
        additionalData: { retries: options?.retries }
      })
      
      // Try fallback strategies
      if (options?.cacheKey) {
        const unifiedActions = useUnifiedStore.getState()
        const cachedData = unifiedActions.getCachedData<T>(options.cacheKey)
        if (cachedData) return cachedData
      }
      
      if (options?.fallbackData) {
        return options.fallbackData
      }
    }
    
    throw lastError || new Error('API call failed after retries')
  }
}

// ============================================================================
// Error Recovery Context
// ============================================================================

interface ErrorRecoveryContextType {
  handleError: (error: Error, context?: any) => string
  attemptRecovery: (errorId: string) => Promise<boolean>
  getErrorStats: () => any
}

const ErrorRecoveryContext = React.createContext<ErrorRecoveryContextType | undefined>(undefined)

export const useErrorRecoveryContext = () => {
  const context = React.useContext(ErrorRecoveryContext)
  if (!context) {
    throw new Error('useErrorRecoveryContext must be used within ErrorRecoveryProvider')
  }
  return context
}

// ============================================================================
// Error Classification and Severity System
// ============================================================================

export const classifyError = (error: Error, context?: any): { type: ErrorType; severity: ErrorSeverity } => {
  const message = error.message.toLowerCase()
  const stack = error.stack?.toLowerCase() || ''
  
  // Network errors
  if (message.includes('fetch') || message.includes('network') || message.includes('connection')) {
    return { type: 'network', severity: 'high' }
  }
  
  // Storage errors
  if (message.includes('storage') || message.includes('quota') || message.includes('indexeddb')) {
    return { type: 'storage', severity: message.includes('quota') ? 'critical' : 'medium' }
  }
  
  // API errors
  if (message.includes('api') || message.includes('http') || message.includes('response')) {
    return { type: 'api', severity: 'high' }
  }
  
  // Validation errors
  if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
    return { type: 'validation', severity: 'medium' }
  }
  
  // Sync errors
  if (message.includes('sync') || message.includes('queue') || context?.operation?.includes('sync')) {
    return { type: 'sync', severity: 'high' }
  }
  
  // Cache errors
  if (message.includes('cache') || context?.operation?.includes('cache')) {
    return { type: 'cache', severity: 'low' }
  }
  
  // Render errors
  if (stack.includes('react') || stack.includes('render') || message.includes('component')) {
    return { type: 'render', severity: 'high' }
  }
  
  return { type: 'unknown', severity: 'medium' }
}

export default {
  useEnhancedErrorRecovery,
  useSystemErrorRecovery,
  useGracefulDegradation,
  withErrorRecovery,
  useErrorRecoveryContext,
  classifyError
}