// Queue Management Utilities
// Provides debugging, monitoring, and management tools for the offline queue

import React from 'react'
import { useOfflineQueue, QueuedOperation, OperationType, OperationPriority } from '../store/offlineQueue'
import { conflictManager } from './conflictResolution'

// ============================================================================
// Queue Analytics and Monitoring
// ============================================================================

export interface QueueAnalytics {
  totalOperations: number
  operationsByType: Record<OperationType, number>
  operationsByPriority: Record<OperationPriority, number>
  operationsByUser: Record<string, number>
  averageRetryCount: number
  oldestOperation: QueuedOperation | null
  newestOperation: QueuedOperation | null
  estimatedSyncTime: number // in milliseconds
}

export interface QueueHealth {
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL'
  issues: string[]
  recommendations: string[]
  score: number // 0-100
}

export class QueueAnalyzer {
  static analyzeQueue(): QueueAnalytics {
    const queueState = useOfflineQueue.getState()
    const { queue } = queueState
    
    const analytics: QueueAnalytics = {
      totalOperations: queue.length,
      operationsByType: {} as Record<OperationType, number>,
      operationsByPriority: {} as Record<OperationPriority, number>,
      operationsByUser: {},
      averageRetryCount: 0,
      oldestOperation: null,
      newestOperation: null,
      estimatedSyncTime: 0
    }
    
    if (queue.length === 0) {
      return analytics
    }
    
    // Initialize counters
    const operationTypes: OperationType[] = ['SUBMIT_ANSWER', 'UPDATE_USER_SETTINGS', 'UPDATE_EXAM_SETTINGS', 'SYNC_PROGRESS', 'FSRS_RATING', 'CUSTOM_API_CALL']
    const priorities: OperationPriority[] = ['HIGH', 'MEDIUM', 'LOW']
    
    operationTypes.forEach(type => analytics.operationsByType[type] = 0)
    priorities.forEach(priority => analytics.operationsByPriority[priority] = 0)
    
    let totalRetries = 0
    let oldestTimestamp = Infinity
    let newestTimestamp = 0
    
    // Analyze each operation
    queue.forEach(operation => {
      // Count by type
      analytics.operationsByType[operation.type]++
      
      // Count by priority
      analytics.operationsByPriority[operation.priority]++
      
      // Count by user
      if (operation.userId) {
        analytics.operationsByUser[operation.userId] = (analytics.operationsByUser[operation.userId] || 0) + 1
      }
      
      // Track retries
      totalRetries += operation.retryCount
      
      // Track oldest/newest
      if (operation.timestamp < oldestTimestamp) {
        oldestTimestamp = operation.timestamp
        analytics.oldestOperation = operation
      }
      if (operation.timestamp > newestTimestamp) {
        newestTimestamp = operation.timestamp
        analytics.newestOperation = operation
      }
    })
    
    // Calculate averages
    analytics.averageRetryCount = totalRetries / queue.length
    
    // Estimate sync time (rough calculation)
    const avgOperationTime = 1000 // 1 second per operation
    const batchSize = queueState.config.batchSize
    const batches = Math.ceil(queue.length / batchSize)
    analytics.estimatedSyncTime = batches * avgOperationTime * batchSize
    
    return analytics
  }
  
  static assessQueueHealth(): QueueHealth {
    const queueState = useOfflineQueue.getState()
    const analytics = this.analyzeQueue()
    const errors = queueState.errors
    
    const health: QueueHealth = {
      status: 'HEALTHY',
      issues: [],
      recommendations: [],
      score: 100
    }
    
    // Check for critical issues
    if (errors.length > 10) {
      health.issues.push(`High error count: ${errors.length} recent errors`)
      health.score -= 30
    }
    
    if (analytics.totalOperations > 100) {
      health.issues.push(`Large queue size: ${analytics.totalOperations} operations`)
      health.score -= 20
    }
    
    if (analytics.averageRetryCount > 2) {
      health.issues.push(`High retry rate: ${analytics.averageRetryCount.toFixed(1)} average retries`)
      health.score -= 25
    }
    
    if (analytics.oldestOperation) {
      const age = Date.now() - analytics.oldestOperation.timestamp
      const hoursOld = age / (1000 * 60 * 60)
      if (hoursOld > 24) {
        health.issues.push(`Old operations: oldest is ${hoursOld.toFixed(1)} hours old`)
        health.score -= 15
      }
    }
    
    if (queueState.networkStatus === 'OFFLINE') {
      health.issues.push('Device is offline')
      health.score -= 10
    }
    
    // Generate recommendations
    if (analytics.totalOperations > 50) {
      health.recommendations.push('Consider increasing batch size for faster sync')
    }
    
    if (errors.length > 5) {
      health.recommendations.push('Review and clear recent errors')
    }
    
    if (analytics.averageRetryCount > 1.5) {
      health.recommendations.push('Check network connectivity and server status')
    }
    
    // Determine overall status
    if (health.score >= 80) {
      health.status = 'HEALTHY'
    } else if (health.score >= 60) {
      health.status = 'WARNING'
    } else {
      health.status = 'CRITICAL'
    }
    
    return health
  }
}

// ============================================================================
// Queue Management Operations
// ============================================================================

export class QueueManager {
  static async clearOldOperations(maxAgeHours: number = 24): Promise<number> {
    const queueState = useOfflineQueue.getState()
    const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000)
    
    const oldOperations = queueState.queue.filter(op => op.timestamp < cutoffTime)
    
    for (const operation of oldOperations) {
      queueState.dequeue(operation.id)
    }
    
    return oldOperations.length
  }
  
  static async clearFailedOperations(): Promise<number> {
    const queueState = useOfflineQueue.getState()
    const failedOperations = queueState.queue.filter(op => op.retryCount >= op.maxRetries)
    
    for (const operation of failedOperations) {
      queueState.dequeue(operation.id)
    }
    
    return failedOperations.length
  }
  
  static async prioritizeOperations(operationType: OperationType, newPriority: OperationPriority): Promise<number> {
    const queueState = useOfflineQueue.getState()
    let count = 0
    
    const updatedQueue = queueState.queue.map(operation => {
      if (operation.type === operationType) {
        count++
        return { ...operation, priority: newPriority }
      }
      return operation
    })
    
    useOfflineQueue.setState({ queue: updatedQueue })
    return count
  }
  
  static async retryOperation(operationId: string): Promise<boolean> {
    const queueState = useOfflineQueue.getState()
    const operation = queueState.queue.find(op => op.id === operationId)
    
    if (!operation) return false
    
    // Reset retry count and try to sync
    const updatedQueue = queueState.queue.map(op => 
      op.id === operationId ? { ...op, retryCount: 0 } : op
    )
    
    useOfflineQueue.setState({ queue: updatedQueue })
    
    // Trigger sync
    await queueState.startSync()
    return true
  }
  
  static async duplicateOperation(operationId: string): Promise<string | null> {
    const queueState = useOfflineQueue.getState()
    const operation = queueState.queue.find(op => op.id === operationId)
    
    if (!operation) return null
    
    // Create a duplicate with new ID and timestamp
    const duplicateId = queueState.enqueue({
      type: operation.type,
      payload: operation.payload,
      priority: operation.priority,
      maxRetries: operation.maxRetries,
      userId: operation.userId,
      metadata: { ...operation.metadata, duplicatedFrom: operationId },
      optimisticUpdate: operation.optimisticUpdate
    })
    
    return duplicateId
  }
  
  static getOperationDetails(operationId: string): QueuedOperation | null {
    const queueState = useOfflineQueue.getState()
    return queueState.queue.find(op => op.id === operationId) || null
  }
  
  static getOperationsByUser(userId: string): QueuedOperation[] {
    const queueState = useOfflineQueue.getState()
    return queueState.queue.filter(op => op.userId === userId)
  }
  
  static getOperationsByType(operationType: OperationType): QueuedOperation[] {
    const queueState = useOfflineQueue.getState()
    return queueState.queue.filter(op => op.type === operationType)
  }
}

// ============================================================================
// Queue Export/Import Utilities
// ============================================================================

export interface QueueExport {
  version: string
  timestamp: number
  queue: QueuedOperation[]
  stats: any
  errors: any[]
  analytics: QueueAnalytics
  health: QueueHealth
}

export class QueueExporter {
  static exportQueue(): QueueExport {
    const queueState = useOfflineQueue.getState()
    
    return {
      version: '1.0.0',
      timestamp: Date.now(),
      queue: queueState.queue,
      stats: queueState.stats,
      errors: queueState.errors,
      analytics: QueueAnalyzer.analyzeQueue(),
      health: QueueAnalyzer.assessQueueHealth()
    }
  }
  
  static exportAsJSON(): string {
    return JSON.stringify(this.exportQueue(), null, 2)
  }
  
  static exportAsCSV(): string {
    const queueState = useOfflineQueue.getState()
    const headers = ['ID', 'Type', 'Priority', 'Timestamp', 'Retry Count', 'Max Retries', 'User ID', 'Status']
    
    const rows = queueState.queue.map(op => [
      op.id,
      op.type,
      op.priority,
      new Date(op.timestamp).toISOString(),
      op.retryCount.toString(),
      op.maxRetries.toString(),
      op.userId || '',
      op.retryCount >= op.maxRetries ? 'FAILED' : 'PENDING'
    ])
    
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }
  
  static async downloadExport(format: 'json' | 'csv' = 'json'): Promise<void> {
    const content = format === 'json' ? this.exportAsJSON() : this.exportAsCSV()
    const mimeType = format === 'json' ? 'application/json' : 'text/csv'
    const filename = `queue-export-${Date.now()}.${format}`
    
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
  }
  
  static importQueue(exportData: QueueExport): boolean {
    try {
      const queueState = useOfflineQueue.getState()
      
      // Validate export data
      if (!exportData.version || !exportData.queue) {
        throw new Error('Invalid export data format')
      }
      
      // Clear current queue and import
      queueState.clearQueue()
      
      // Import operations
      exportData.queue.forEach(operation => {
        queueState.enqueue({
          type: operation.type,
          payload: operation.payload,
          priority: operation.priority,
          maxRetries: operation.maxRetries,
          userId: operation.userId,
          metadata: operation.metadata,
          optimisticUpdate: operation.optimisticUpdate
        })
      })
      
      return true
    } catch (error) {
      console.error('Failed to import queue:', error)
      return false
    }
  }
}

// ============================================================================
// Queue Debugging Tools
// ============================================================================

export class QueueDebugger {
  static logQueueState(): void {
    const queueState = useOfflineQueue.getState()
    const analytics = QueueAnalyzer.analyzeQueue()
    const health = QueueAnalyzer.assessQueueHealth()
    
    console.group('🔍 Queue Debug Information')
    console.log('Queue State:', queueState)
    console.log('Analytics:', analytics)
    console.log('Health:', health)
    console.log('Conflict History:', conflictManager.getResolutionHistory())
    console.groupEnd()
  }
  
  static simulateNetworkFailure(durationMs: number = 5000): void {
    const queueState = useOfflineQueue.getState()
    const originalStatus = queueState.networkStatus
    
    console.log(`🔌 Simulating network failure for ${durationMs}ms`)
    queueState.setNetworkStatus('OFFLINE')
    
    setTimeout(() => {
      queueState.setNetworkStatus(originalStatus)
      console.log('🔌 Network simulation ended')
    }, durationMs)
  }
  
  static createTestOperations(count: number = 5): string[] {
    const queueState = useOfflineQueue.getState()
    const operationIds: string[] = []
    
    for (let i = 0; i < count; i++) {
      const operationId = queueState.enqueue({
        type: 'CUSTOM_API_CALL',
        payload: {
          method: 'GET',
          url: `/test/operation/${i}`,
          data: { test: true, index: i }
        },
        priority: i % 2 === 0 ? 'HIGH' : 'MEDIUM',
        maxRetries: 3,
        metadata: { isTest: true, createdAt: Date.now() }
      })
      
      operationIds.push(operationId)
    }
    
    console.log(`🧪 Created ${count} test operations:`, operationIds)
    return operationIds
  }
  
  static clearTestOperations(): number {
    const queueState = useOfflineQueue.getState()
    const testOperations = queueState.queue.filter(op => op.metadata?.isTest)
    
    testOperations.forEach(op => queueState.dequeue(op.id))
    
    console.log(`🧹 Cleared ${testOperations.length} test operations`)
    return testOperations.length
  }
}

// ============================================================================
// React Hooks for Queue Management
// ============================================================================

export const useQueueAnalytics = () => {
  const [analytics, setAnalytics] = React.useState<QueueAnalytics>(() => QueueAnalyzer.analyzeQueue())
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      setAnalytics(QueueAnalyzer.analyzeQueue())
    }, 5000) // Update every 5 seconds
    
    return () => clearInterval(interval)
  }, [])
  
  return analytics
}

export const useQueueHealth = () => {
  const [health, setHealth] = React.useState<QueueHealth>(() => QueueAnalyzer.assessQueueHealth())
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      setHealth(QueueAnalyzer.assessQueueHealth())
    }, 10000) // Update every 10 seconds
    
    return () => clearInterval(interval)
  }, [])
  
  return health
}

// ============================================================================
// Global Queue Management Interface
// ============================================================================

export const queueManagement = {
  analyzer: QueueAnalyzer,
  manager: QueueManager,
  exporter: QueueExporter,
  debugger: QueueDebugger
}

export default queueManagement