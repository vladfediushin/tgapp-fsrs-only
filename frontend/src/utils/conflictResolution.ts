// Conflict Resolution System
// Handles data conflicts when local and server data diverge

import { useUnifiedStore } from '../store/unified'
import type { QueuedOperation } from '../store/offlineQueue'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ConflictData {
  operationId: string
  operationType: string
  localData: any
  serverData: any
  timestamp: number
  userId?: string
}

export interface ConflictResolution {
  strategy: ConflictStrategy
  resolvedData: any
  metadata?: Record<string, any>
}

export type ConflictStrategy = 
  | 'SERVER_WINS'     // Use server data, discard local changes
  | 'CLIENT_WINS'     // Use local data, overwrite server
  | 'MERGE'           // Attempt to merge both datasets
  | 'MANUAL'          // Require user intervention
  | 'TIMESTAMP_WINS'  // Use data with latest timestamp

export interface ConflictResolver {
  canResolve: (conflict: ConflictData) => boolean
  resolve: (conflict: ConflictData) => Promise<ConflictResolution>
  priority: number // Higher priority resolvers are tried first
}

// ============================================================================
// Built-in Conflict Resolvers
// ============================================================================

class ServerWinsResolver implements ConflictResolver {
  priority = 1
  
  canResolve(conflict: ConflictData): boolean {
    return true // Can always resolve by using server data
  }
  
  async resolve(conflict: ConflictData): Promise<ConflictResolution> {
    return {
      strategy: 'SERVER_WINS',
      resolvedData: conflict.serverData,
      metadata: {
        reason: 'Default server wins strategy',
        discardedLocalChanges: conflict.localData
      }
    }
  }
}

class TimestampWinsResolver implements ConflictResolver {
  priority = 5
  
  canResolve(conflict: ConflictData): boolean {
    return !!(
      conflict.localData?.updated_at && 
      conflict.serverData?.updated_at
    )
  }
  
  async resolve(conflict: ConflictData): Promise<ConflictResolution> {
    const localTime = new Date(conflict.localData.updated_at).getTime()
    const serverTime = new Date(conflict.serverData.updated_at).getTime()
    
    const useServer = serverTime >= localTime
    
    return {
      strategy: 'TIMESTAMP_WINS',
      resolvedData: useServer ? conflict.serverData : conflict.localData,
      metadata: {
        reason: `${useServer ? 'Server' : 'Client'} data is newer`,
        localTimestamp: localTime,
        serverTimestamp: serverTime
      }
    }
  }
}

class UserSettingsMergeResolver implements ConflictResolver {
  priority = 8
  
  canResolve(conflict: ConflictData): boolean {
    return conflict.operationType === 'UPDATE_USER_SETTINGS'
  }
  
  async resolve(conflict: ConflictData): Promise<ConflictResolution> {
    // Merge user settings, preferring local changes for user preferences
    const merged = {
      ...conflict.serverData,
      ...conflict.localData,
      // Always keep server-managed fields
      id: conflict.serverData.id,
      created_at: conflict.serverData.created_at,
      updated_at: conflict.serverData.updated_at || new Date().toISOString()
    }
    
    return {
      strategy: 'MERGE',
      resolvedData: merged,
      metadata: {
        reason: 'Merged user settings with local preferences taking priority',
        mergedFields: Object.keys(conflict.localData)
      }
    }
  }
}

class ExamSettingsMergeResolver implements ConflictResolver {
  priority = 8
  
  canResolve(conflict: ConflictData): boolean {
    return conflict.operationType === 'UPDATE_EXAM_SETTINGS'
  }
  
  async resolve(conflict: ConflictData): Promise<ConflictResolution> {
    // For exam settings, prefer local changes as they represent user intent
    const merged = {
      ...conflict.serverData,
      ...conflict.localData
    }
    
    return {
      strategy: 'MERGE',
      resolvedData: merged,
      metadata: {
        reason: 'Merged exam settings with local changes taking priority'
      }
    }
  }
}

class ProgressDataResolver implements ConflictResolver {
  priority = 7
  
  canResolve(conflict: ConflictData): boolean {
    return conflict.operationType === 'SUBMIT_ANSWER' || 
           conflict.operationType === 'SYNC_PROGRESS'
  }
  
  async resolve(conflict: ConflictData): Promise<ConflictResolution> {
    // For progress data, we typically want to use server data as it's authoritative
    // But we can merge statistics if both have valid data
    
    if (conflict.operationType === 'SUBMIT_ANSWER') {
      // Server data is authoritative for answer submissions
      return {
        strategy: 'SERVER_WINS',
        resolvedData: conflict.serverData,
        metadata: {
          reason: 'Server data is authoritative for answer submissions'
        }
      }
    }
    
    // For progress sync, try to merge statistics
    const merged = {
      ...conflict.serverData,
      // Keep higher values for cumulative stats
      answered: Math.max(
        conflict.localData?.answered || 0,
        conflict.serverData?.answered || 0
      ),
      correct: Math.max(
        conflict.localData?.correct || 0,
        conflict.serverData?.correct || 0
      )
    }
    
    return {
      strategy: 'MERGE',
      resolvedData: merged,
      metadata: {
        reason: 'Merged progress data using maximum values for statistics'
      }
    }
  }
}

// ============================================================================
// Conflict Resolution Manager
// ============================================================================

class ConflictResolutionManager {
  private resolvers: ConflictResolver[] = []
  private pendingConflicts: Map<string, ConflictData> = new Map()
  private resolutionHistory: Array<{
    conflict: ConflictData
    resolution: ConflictResolution
    timestamp: number
  }> = []

  constructor() {
    this.registerDefaultResolvers()
  }

  private registerDefaultResolvers(): void {
    this.addResolver(new TimestampWinsResolver())
    this.addResolver(new UserSettingsMergeResolver())
    this.addResolver(new ExamSettingsMergeResolver())
    this.addResolver(new ProgressDataResolver())
    this.addResolver(new ServerWinsResolver()) // Fallback resolver
  }

  addResolver(resolver: ConflictResolver): void {
    this.resolvers.push(resolver)
    this.resolvers.sort((a, b) => b.priority - a.priority)
  }

  async resolveConflict(conflict: ConflictData): Promise<ConflictResolution> {
    console.log(`🔄 Resolving conflict for operation: ${conflict.operationType}`)
    
    // Find the first resolver that can handle this conflict
    for (const resolver of this.resolvers) {
      if (resolver.canResolve(conflict)) {
        try {
          const resolution = await resolver.resolve(conflict)
          
          // Store resolution in history
          this.resolutionHistory.push({
            conflict,
            resolution,
            timestamp: Date.now()
          })
          
          // Keep only last 100 resolutions
          if (this.resolutionHistory.length > 100) {
            this.resolutionHistory.shift()
          }
          
          console.log(`✅ Conflict resolved using ${resolution.strategy} strategy`)
          return resolution
          
        } catch (error) {
          console.warn(`Resolver failed:`, error)
          continue
        }
      }
    }
    
    // This should never happen due to ServerWinsResolver fallback
    throw new Error('No resolver could handle the conflict')
  }

  async detectAndResolveConflicts(
    operation: QueuedOperation,
    serverResponse: any
  ): Promise<any> {
    const unifiedStore = useUnifiedStore.getState()
    
    // Get current local data for comparison
    const localData = this.getLocalDataForOperation(operation)
    
    if (!localData || !serverResponse) {
      return serverResponse // No conflict if no local data
    }
    
    // Check if there's actually a conflict
    if (this.hasConflict(localData, serverResponse)) {
      const conflict: ConflictData = {
        operationId: operation.id,
        operationType: operation.type,
        localData,
        serverData: serverResponse,
        timestamp: Date.now(),
        userId: operation.userId
      }
      
      const resolution = await this.resolveConflict(conflict)
      
      // Apply the resolved data to the unified store
      await this.applyResolution(operation, resolution)
      
      return resolution.resolvedData
    }
    
    return serverResponse
  }

  private getLocalDataForOperation(operation: QueuedOperation): any {
    const unifiedStore = useUnifiedStore.getState()
    
    switch (operation.type) {
      case 'UPDATE_USER_SETTINGS':
        return unifiedStore.user
      case 'UPDATE_EXAM_SETTINGS':
        return unifiedStore.examSettings
      case 'SUBMIT_ANSWER':
        return unifiedStore.userStats
      case 'SYNC_PROGRESS':
        return unifiedStore.dailyProgress
      default:
        return null
    }
  }

  private hasConflict(localData: any, serverData: any): boolean {
    // Simple conflict detection based on data differences
    if (!localData || !serverData) return false
    
    // Check for timestamp conflicts
    if (localData.updated_at && serverData.updated_at) {
      return localData.updated_at !== serverData.updated_at
    }
    
    // Check for value differences in key fields
    const keyFields = ['exam_country', 'exam_language', 'exam_date', 'daily_goal', 'answered', 'correct']
    
    for (const field of keyFields) {
      if (localData[field] !== undefined && 
          serverData[field] !== undefined && 
          localData[field] !== serverData[field]) {
        return true
      }
    }
    
    return false
  }

  private async applyResolution(
    operation: QueuedOperation,
    resolution: ConflictResolution
  ): Promise<void> {
    const unifiedStore = useUnifiedStore.getState()
    
    // Update the appropriate cache with resolved data
    switch (operation.type) {
      case 'UPDATE_USER_SETTINGS':
        if (operation.userId) {
          const cacheKey = `user:${operation.userId}`
          unifiedStore.setCachedData(cacheKey, resolution.resolvedData)
          useUnifiedStore.setState({ user: resolution.resolvedData })
        }
        break
        
      case 'UPDATE_EXAM_SETTINGS':
        if (operation.userId) {
          const cacheKey = `examSettings:${operation.userId}`
          unifiedStore.setCachedData(cacheKey, resolution.resolvedData)
          useUnifiedStore.setState({ examSettings: resolution.resolvedData })
        }
        break
        
      case 'SUBMIT_ANSWER':
        if (operation.userId) {
          const cacheKey = `userStats:${operation.userId}`
          unifiedStore.setCachedData(cacheKey, resolution.resolvedData)
          useUnifiedStore.setState({ userStats: resolution.resolvedData })
        }
        break
        
      case 'SYNC_PROGRESS':
        if (operation.userId) {
          const cacheKey = `dailyProgress:${operation.userId}`
          unifiedStore.setCachedData(cacheKey, resolution.resolvedData)
          useUnifiedStore.setState({ dailyProgress: resolution.resolvedData })
        }
        break
    }
  }

  getPendingConflicts(): ConflictData[] {
    return Array.from(this.pendingConflicts.values())
  }

  getResolutionHistory(): typeof this.resolutionHistory {
    return this.resolutionHistory
  }

  clearHistory(): void {
    this.resolutionHistory = []
  }
}

// ============================================================================
// Export and Utilities
// ============================================================================

export const conflictManager = new ConflictResolutionManager()

// Helper function to create custom resolvers
export const createCustomResolver = (
  operationType: string,
  resolveFn: (conflict: ConflictData) => Promise<ConflictResolution>,
  priority: number = 5
): ConflictResolver => ({
  priority,
  canResolve: (conflict) => conflict.operationType === operationType,
  resolve: resolveFn
})

// Helper function to register a custom resolver
export const registerConflictResolver = (resolver: ConflictResolver): void => {
  conflictManager.addResolver(resolver)
}

export default conflictManager