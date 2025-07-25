// State Management Middleware System
import { StateMiddleware, StateContext } from '../stateCoordinator'

// ============================================================================
// Built-in Middleware
// ============================================================================

// Logging Middleware
export const loggingMiddleware: StateMiddleware = {
  name: 'logging',
  priority: 100,
  
  beforeAction: async (action, payload, context) => {
    if (context.coordinator.config.enableLogging) {
      console.group(`🔄 ${action}`)
      console.log('Payload:', payload)
      console.log('Context:', context)
      console.time(`${action}-duration`)
    }
  },
  
  afterAction: async (action, payload, result, context) => {
    if (context.coordinator.config.enableLogging) {
      console.log('Result:', result)
      console.timeEnd(`${action}-duration`)
      console.groupEnd()
    }
  },
  
  onError: async (error, action, payload, context) => {
    if (context.coordinator.config.enableLogging) {
      console.error(`❌ Error in ${action}:`, error)
      console.log('Payload:', payload)
      console.groupEnd()
    }
  }
}

// Performance Monitoring Middleware
export const performanceMiddleware: StateMiddleware = {
  name: 'performance',
  priority: 90,
  
  beforeAction: async (action, payload, context) => {
    if (context.coordinator.config.enableMetrics) {
      context.metadata = {
        ...context.metadata,
        startTime: performance.now()
      }
    }
  },
  
  afterAction: async (action, payload, result, context) => {
    if (context.coordinator.config.enableMetrics && context.metadata?.startTime) {
      const duration = performance.now() - context.metadata.startTime
      
      // Update metrics
      const currentMetrics = context.coordinator.metrics
      const newTotalOps = currentMetrics.totalOperations + 1
      const newAvgTime = (currentMetrics.averageResponseTime * currentMetrics.totalOperations + duration) / newTotalOps
      
      context.coordinator.updateConfig({
        // This would need to be implemented to update metrics
      })
      
      if (context.coordinator.config.debugMode) {
        console.log(`⏱️ ${action} took ${duration.toFixed(2)}ms`)
      }
    }
  }
}

// Validation Middleware
export const validationMiddleware: StateMiddleware = {
  name: 'validation',
  priority: 80,
  
  beforeAction: async (action, payload, context) => {
    if (!context.coordinator.config.enableValidation) return
    
    // Validate common payload requirements
    if (action.includes('User') && !payload.userId) {
      throw new Error(`${action} requires userId in payload`)
    }
    
    if (action.includes('sync') && !context.coordinator.syncStatus.isActive) {
      // Allow sync to proceed
    }
  },
  
  afterAction: async (action, payload, result, context) => {
    if (!context.coordinator.config.enableValidation) return
    
    // Validate result structure for critical actions
    if (action === 'syncAllStores' && !result) {
      console.warn(`⚠️ ${action} completed without result`)
    }
  }
}

// Error Recovery Middleware
export const errorRecoveryMiddleware: StateMiddleware = {
  name: 'errorRecovery',
  priority: 70,
  
  onError: async (error, action, payload, context) => {
    // Attempt automatic recovery for known error types
    if (error.message.includes('network') || error.message.includes('fetch')) {
      console.log('🔄 Network error detected, scheduling retry...')
      
      // Schedule retry after delay
      setTimeout(async () => {
        try {
          if (action === 'syncAllStores' && payload.userId) {
            await context.coordinator.syncAllStores(payload.userId)
          }
        } catch (retryError) {
          console.error('❌ Retry failed:', retryError)
        }
      }, 5000)
    }
    
    // Log error for monitoring
    await context.coordinator.handleStoreError('middleware', error, {
      action,
      payload,
      middleware: 'errorRecovery'
    })
  }
}

// Cache Optimization Middleware
export const cacheOptimizationMiddleware: StateMiddleware = {
  name: 'cacheOptimization',
  priority: 60,
  
  beforeAction: async (action, payload, context) => {
    // Preload related data for certain actions
    if (action === 'loadUser' && payload.userId) {
      // Preload user stats and daily progress
      const coordinator = context.coordinator
      setTimeout(() => {
        coordinator.syncUserData(payload.userId).catch(console.error)
      }, 100)
    }
  },
  
  afterAction: async (action, payload, result, context) => {
    // Invalidate related caches when data changes
    if (action.includes('update') || action.includes('submit')) {
      // Trigger cache invalidation
      if (context.coordinator.config.debugMode) {
        console.log('🗑️ Invalidating related caches after', action)
      }
    }
  }
}

// State Synchronization Middleware
export const stateSyncMiddleware: StateMiddleware = {
  name: 'stateSync',
  priority: 50,
  
  afterAction: async (action, payload, result, context) => {
    // Sync settings between stores after certain actions
    if (action.includes('Settings') || action.includes('Config')) {
      await context.coordinator.syncSettings()
    }
    
    // Trigger offline queue sync after data updates
    if (action.includes('submit') || action.includes('update')) {
      await context.coordinator.syncOfflineOperations()
    }
  }
}

// Development Tools Middleware
export const devToolsMiddleware: StateMiddleware = {
  name: 'devTools',
  priority: 10,
  
  beforeAction: async (action, payload, context) => {
    if (!context.coordinator.config.debugMode) return
    
    // Store action in development history
    if (typeof window !== 'undefined' && (window as any).__STATE_COORDINATOR_DEVTOOLS__) {
      (window as any).__STATE_COORDINATOR_DEVTOOLS__.addAction({
        type: action,
        payload,
        timestamp: context.timestamp,
        phase: 'before'
      })
    }
  },
  
  afterAction: async (action, payload, result, context) => {
    if (!context.coordinator.config.debugMode) return
    
    // Update development history
    if (typeof window !== 'undefined' && (window as any).__STATE_COORDINATOR_DEVTOOLS__) {
      (window as any).__STATE_COORDINATOR_DEVTOOLS__.addAction({
        type: action,
        payload,
        result,
        timestamp: context.timestamp,
        phase: 'after'
      })
    }
  },
  
  onError: async (error, action, payload, context) => {
    if (!context.coordinator.config.debugMode) return
    
    // Log error in development tools
    if (typeof window !== 'undefined' && (window as any).__STATE_COORDINATOR_DEVTOOLS__) {
      (window as any).__STATE_COORDINATOR_DEVTOOLS__.addError({
        action,
        payload,
        error: error.message,
        timestamp: context.timestamp
      })
    }
  }
}

// ============================================================================
// Middleware Registry
// ============================================================================

export const defaultMiddleware: StateMiddleware[] = [
  loggingMiddleware,
  performanceMiddleware,
  validationMiddleware,
  errorRecoveryMiddleware,
  cacheOptimizationMiddleware,
  stateSyncMiddleware,
  devToolsMiddleware
]

// ============================================================================
// Middleware Utilities
// ============================================================================

export const createCustomMiddleware = (
  name: string,
  priority: number,
  handlers: Partial<Pick<StateMiddleware, 'beforeAction' | 'afterAction' | 'onError'>>
): StateMiddleware => {
  return {
    name,
    priority,
    ...handlers
  }
}

export const createConditionalMiddleware = (
  baseMiddleware: StateMiddleware,
  condition: (action: string, payload: any, context: StateContext) => boolean
): StateMiddleware => {
  return {
    ...baseMiddleware,
    name: `${baseMiddleware.name}-conditional`,
    
    beforeAction: baseMiddleware.beforeAction ? async (action, payload, context) => {
      if (condition(action, payload, context)) {
        return baseMiddleware.beforeAction!(action, payload, context)
      }
    } : undefined,
    
    afterAction: baseMiddleware.afterAction ? async (action, payload, result, context) => {
      if (condition(action, payload, context)) {
        return baseMiddleware.afterAction!(action, payload, result, context)
      }
    } : undefined,
    
    onError: baseMiddleware.onError ? async (error, action, payload, context) => {
      if (condition(action, payload, context)) {
        return baseMiddleware.onError!(error, action, payload, context)
      }
    } : undefined
  }
}

// ============================================================================
// Middleware Manager
// ============================================================================

export class MiddlewareManager {
  private middleware: StateMiddleware[] = []
  
  add(middleware: StateMiddleware): void {
    this.middleware.push(middleware)
    this.middleware.sort((a, b) => b.priority - a.priority)
  }
  
  remove(name: string): void {
    this.middleware = this.middleware.filter(m => m.name !== name)
  }
  
  get(name: string): StateMiddleware | undefined {
    return this.middleware.find(m => m.name === name)
  }
  
  getAll(): StateMiddleware[] {
    return [...this.middleware]
  }
  
  clear(): void {
    this.middleware = []
  }
  
  loadDefaults(): void {
    this.clear()
    defaultMiddleware.forEach(mw => this.add(mw))
  }
}

export const middlewareManager = new MiddlewareManager()

// Load default middleware
middlewareManager.loadDefaults()