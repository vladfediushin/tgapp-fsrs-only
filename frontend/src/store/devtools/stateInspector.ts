// State Inspector and Development Tools
import { useState, useEffect, useCallback } from 'react'
import { useUnifiedStore } from '../unified'
import { useOfflineQueue } from '../offlineQueue'
import { useSession } from '../session'
import { useFSRSStore } from '../fsrs'
import { useStatsStore } from '../stats'
import { stateLogger } from '../logging/stateLogger'
import { performanceMonitor } from '../monitoring/performanceMonitor'
import { stateValidator } from '../validation/stateValidator'

// ============================================================================
// Development Tools Types
// ============================================================================

export interface StateSnapshot {
  timestamp: number
  stores: {
    unified: any
    session: any
    fsrs: any
    stats: any
    offlineQueue: any
  }
  metadata: {
    version: string
    environment: string
    userAgent: string
    url: string
  }
}

export interface StateChange {
  timestamp: number
  store: string
  action: string
  previousState: any
  newState: any
  diff: any
}

export interface DebugSession {
  id: string
  startTime: number
  endTime?: number
  snapshots: StateSnapshot[]
  changes: StateChange[]
  logs: any[]
  performance: any[]
  validation: any[]
}

export interface DevToolsConfig {
  enabled: boolean
  maxSnapshots: number
  maxChanges: number
  maxLogs: number
  autoSnapshot: boolean
  snapshotInterval: number
  trackChanges: boolean
  trackPerformance: boolean
  trackValidation: boolean
}

// ============================================================================
// State Inspector Implementation
// ============================================================================

export class StateInspector {
  private config: DevToolsConfig
  private currentSession: DebugSession | null = null
  private snapshots: StateSnapshot[] = []
  private changes: StateChange[] = []
  private subscribers: Set<(event: any) => void> = new Set()

  constructor(config: Partial<DevToolsConfig> = {}) {
    this.config = {
      enabled: true,
      maxSnapshots: 100,
      maxChanges: 1000,
      maxLogs: 1000,
      autoSnapshot: true,
      snapshotInterval: 30000, // 30 seconds
      trackChanges: true,
      trackPerformance: true,
      trackValidation: true,
      ...config
    }

    if (this.config.enabled) {
      this.initialize()
    }
  }

  private initialize(): void {
    // Start auto-snapshots if enabled
    if (this.config.autoSnapshot) {
      setInterval(() => {
        this.takeSnapshot()
      }, this.config.snapshotInterval)
    }

    // Set up store change tracking
    if (this.config.trackChanges) {
      this.setupChangeTracking()
    }

    stateLogger.info('devtools', 'State inspector initialized', { config: this.config })
  }

  // ============================================================================
  // Snapshot Management
  // ============================================================================

  takeSnapshot(label?: string): StateSnapshot {
    const snapshot: StateSnapshot = {
      timestamp: Date.now(),
      stores: {
        unified: this.serializeStore(useUnifiedStore.getState()),
        session: this.serializeStore(useSession.getState()),
        fsrs: this.serializeStore(useFSRSStore.getState()),
        stats: this.serializeStore(useStatsStore.getState()),
        offlineQueue: this.serializeStore(useOfflineQueue.getState())
      },
      metadata: {
        version: '1.0.0',
        environment: 'development',
        userAgent: navigator.userAgent,
        url: window.location.href
      }
    }

    this.snapshots.push(snapshot)
    this.pruneSnapshots()

    if (this.currentSession) {
      this.currentSession.snapshots.push(snapshot)
    }

    this.notifySubscribers({
      type: 'snapshot',
      snapshot,
      label
    })

    stateLogger.debug('devtools', 'State snapshot taken', { 
      timestamp: snapshot.timestamp,
      label,
      storeKeys: Object.keys(snapshot.stores)
    })

    return snapshot
  }

  getSnapshots(limit?: number): StateSnapshot[] {
    const snapshots = [...this.snapshots]
    return limit ? snapshots.slice(-limit) : snapshots
  }

  compareSnapshots(snapshot1: StateSnapshot, snapshot2: StateSnapshot): any {
    const diff: any = {}

    for (const [storeName, state1] of Object.entries(snapshot1.stores)) {
      const state2 = snapshot2.stores[storeName as keyof typeof snapshot2.stores]
      const storeDiff = this.deepDiff(state1, state2)
      if (Object.keys(storeDiff).length > 0) {
        diff[storeName] = storeDiff
      }
    }

    return diff
  }

  // ============================================================================
  // Change Tracking
  // ============================================================================

  private setupChangeTracking(): void {
    // This would ideally hook into Zustand's middleware system
    // For now, we'll implement a polling-based approach
    let previousStates: any = {}

    const trackChanges = () => {
      const currentStates = {
        unified: useUnifiedStore.getState(),
        session: useSession.getState(),
        fsrs: useFSRSStore.getState(),
        stats: useStatsStore.getState(),
        offlineQueue: useOfflineQueue.getState()
      }

      for (const [storeName, currentState] of Object.entries(currentStates)) {
        const previousState = previousStates[storeName]
        if (previousState) {
          const diff = this.deepDiff(previousState, currentState)
          if (Object.keys(diff).length > 0) {
            this.recordChange(storeName, 'state_change', previousState, currentState, diff)
          }
        }
      }

      previousStates = this.deepClone(currentStates)
    }

    // Poll for changes every 100ms
    setInterval(trackChanges, 100)
  }

  private recordChange(store: string, action: string, previousState: any, newState: any, diff: any): void {
    const change: StateChange = {
      timestamp: Date.now(),
      store,
      action,
      previousState: this.serializeStore(previousState),
      newState: this.serializeStore(newState),
      diff
    }

    this.changes.push(change)
    this.pruneChanges()

    if (this.currentSession) {
      this.currentSession.changes.push(change)
    }

    this.notifySubscribers({
      type: 'change',
      change
    })

    stateLogger.debug('devtools', 'State change recorded', {
      store,
      action,
      timestamp: change.timestamp,
      diffKeys: Object.keys(diff)
    })
  }

  getChanges(store?: string, limit?: number): StateChange[] {
    let changes = [...this.changes]
    
    if (store) {
      changes = changes.filter(c => c.store === store)
    }
    
    return limit ? changes.slice(-limit) : changes
  }

  // ============================================================================
  // Debug Sessions
  // ============================================================================

  startDebugSession(id?: string): DebugSession {
    const sessionId = id || `session_${Date.now()}`
    
    this.currentSession = {
      id: sessionId,
      startTime: Date.now(),
      snapshots: [],
      changes: [],
      logs: [],
      performance: [],
      validation: []
    }

    // Take initial snapshot
    this.takeSnapshot('session_start')

    stateLogger.info('devtools', 'Debug session started', { sessionId })

    return this.currentSession
  }

  endDebugSession(): DebugSession | null {
    if (!this.currentSession) {
      return null
    }

    this.currentSession.endTime = Date.now()
    
    // Take final snapshot
    this.takeSnapshot('session_end')

    const session = this.currentSession
    this.currentSession = null

    stateLogger.info('devtools', 'Debug session ended', {
      sessionId: session.id,
      duration: (session.endTime || Date.now()) - session.startTime,
      snapshots: session.snapshots.length,
      changes: session.changes.length
    })

    return session
  }

  getCurrentSession(): DebugSession | null {
    return this.currentSession
  }

  // ============================================================================
  // State Analysis
  // ============================================================================

  analyzeState(): {
    summary: any
    issues: any[]
    recommendations: string[]
  } {
    const currentStates = {
      unified: useUnifiedStore.getState(),
      session: useSession.getState(),
      fsrs: useFSRSStore.getState(),
      stats: useStatsStore.getState(),
      offlineQueue: useOfflineQueue.getState()
    }

    const summary = {
      totalStores: Object.keys(currentStates).length,
      memoryUsage: this.calculateMemoryUsage(currentStates),
      cacheStats: this.analyzeCacheUsage(currentStates.unified),
      queueStats: this.analyzeQueueStatus(currentStates.offlineQueue),
      lastUpdate: Math.max(...Object.values(currentStates).map(state => 
        (state as any).lastUpdated || 0
      ))
    }

    const issues: any[] = []
    const recommendations: string[] = []

    // Analyze cache usage
    if (summary.cacheStats.memorySize > 1000) {
      issues.push({
        type: 'performance',
        severity: 'warning',
        message: 'Memory cache is very large',
        details: summary.cacheStats
      })
      recommendations.push('Consider implementing cache eviction policies')
    }

    // Analyze queue status
    if (summary.queueStats.size > 50) {
      issues.push({
        type: 'sync',
        severity: 'warning',
        message: 'Offline queue is growing large',
        details: summary.queueStats
      })
      recommendations.push('Check network connectivity and sync performance')
    }

    // Analyze data freshness
    const dataAge = Date.now() - summary.lastUpdate
    if (dataAge > 300000) { // 5 minutes
      issues.push({
        type: 'data',
        severity: 'info',
        message: 'Some data may be stale',
        details: { ageMs: dataAge }
      })
      recommendations.push('Consider refreshing data from server')
    }

    return { summary, issues, recommendations }
  }

  // ============================================================================
  // Export and Import
  // ============================================================================

  exportState(includeSnapshots: boolean = true, includeChanges: boolean = true): any {
    const exportData: any = {
      timestamp: Date.now(),
      version: '1.0.0',
      config: this.config,
      currentState: {
        unified: this.serializeStore(useUnifiedStore.getState()),
        session: this.serializeStore(useSession.getState()),
        fsrs: this.serializeStore(useFSRSStore.getState()),
        stats: this.serializeStore(useStatsStore.getState()),
        offlineQueue: this.serializeStore(useOfflineQueue.getState())
      }
    }

    if (includeSnapshots) {
      exportData.snapshots = this.snapshots
    }

    if (includeChanges) {
      exportData.changes = this.changes
    }

    if (this.currentSession) {
      exportData.currentSession = this.currentSession
    }

    return exportData
  }

  importState(data: any): void {
    if (data.snapshots) {
      this.snapshots = data.snapshots
    }

    if (data.changes) {
      this.changes = data.changes
    }

    if (data.currentSession) {
      this.currentSession = data.currentSession
    }

    stateLogger.info('devtools', 'State imported', {
      snapshots: this.snapshots.length,
      changes: this.changes.length,
      hasSession: !!this.currentSession
    })
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private serializeStore(state: any): any {
    try {
      // Remove functions and non-serializable objects
      return JSON.parse(JSON.stringify(state, (key, value) => {
        if (typeof value === 'function') {
          return '[Function]'
        }
        if (value instanceof Map) {
          return Object.fromEntries(value)
        }
        if (value instanceof Set) {
          return Array.from(value)
        }
        return value
      }))
    } catch (error) {
      stateLogger.warn('devtools', 'Failed to serialize store state', { error })
      return { error: 'Serialization failed' }
    }
  }

  private deepDiff(obj1: any, obj2: any): any {
    const diff: any = {}

    const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})])

    for (const key of allKeys) {
      const val1 = obj1?.[key]
      const val2 = obj2?.[key]

      if (val1 !== val2) {
        if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
          const nestedDiff = this.deepDiff(val1, val2)
          if (Object.keys(nestedDiff).length > 0) {
            diff[key] = nestedDiff
          }
        } else {
          diff[key] = { from: val1, to: val2 }
        }
      }
    }

    return diff
  }

  private deepClone(obj: any): any {
    return JSON.parse(JSON.stringify(obj))
  }

  private calculateMemoryUsage(states: any): number {
    try {
      return JSON.stringify(states).length
    } catch {
      return 0
    }
  }

  private analyzeCacheUsage(unifiedState: any): any {
    return {
      memorySize: unifiedState.memoryCache?.size || 0,
      localStorageSize: unifiedState.localStorageCache?.size || 0,
      hitRate: unifiedState.metrics?.hitRate || 0,
      requests: unifiedState.metrics?.requests || 0
    }
  }

  private analyzeQueueStatus(queueState: any): any {
    return {
      size: queueState.queue?.length || 0,
      status: queueState.queueStatus || 'unknown',
      errors: queueState.errors?.length || 0,
      lastSync: queueState.lastSyncTime || 0
    }
  }

  private pruneSnapshots(): void {
    if (this.snapshots.length > this.config.maxSnapshots) {
      const excess = this.snapshots.length - this.config.maxSnapshots
      this.snapshots.splice(0, excess)
    }
  }

  private pruneChanges(): void {
    if (this.changes.length > this.config.maxChanges) {
      const excess = this.changes.length - this.config.maxChanges
      this.changes.splice(0, excess)
    }
  }

  private notifySubscribers(event: any): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event)
      } catch (error) {
        stateLogger.warn('devtools', 'Subscriber notification failed', { error })
      }
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  subscribe(callback: (event: any) => void): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  enable(): void {
    this.config.enabled = true
    this.initialize()
  }

  disable(): void {
    this.config.enabled = false
  }

  isEnabled(): boolean {
    return this.config.enabled
  }

  getConfig(): DevToolsConfig {
    return { ...this.config }
  }

  updateConfig(updates: Partial<DevToolsConfig>): void {
    this.config = { ...this.config, ...updates }
  }

  clear(): void {
    this.snapshots = []
    this.changes = []
    this.currentSession = null
    stateLogger.info('devtools', 'State inspector cleared')
  }
}

// ============================================================================
// Global State Inspector Instance
// ============================================================================

export const stateInspector = new StateInspector({
  enabled: typeof window !== 'undefined' && window.location.hostname === 'localhost'
})

// ============================================================================
// React Hook for State Inspector
// ============================================================================

export const useStateInspector = () => {
  const [snapshots, setSnapshots] = useState<StateSnapshot[]>([])
  const [changes, setChanges] = useState<StateChange[]>([])
  const [currentSession, setCurrentSession] = useState<DebugSession | null>(null)

  useEffect(() => {
    const unsubscribe = stateInspector.subscribe((event) => {
      switch (event.type) {
        case 'snapshot':
          setSnapshots(stateInspector.getSnapshots())
          break
        case 'change':
          setChanges(stateInspector.getChanges())
          break
        case 'session':
          setCurrentSession(stateInspector.getCurrentSession())
          break
      }
    })

    // Initial load
    setSnapshots(stateInspector.getSnapshots())
    setChanges(stateInspector.getChanges())
    setCurrentSession(stateInspector.getCurrentSession())

    return unsubscribe
  }, [])

  const takeSnapshot = useCallback((label?: string) => {
    return stateInspector.takeSnapshot(label)
  }, [])

  const startSession = useCallback((id?: string) => {
    return stateInspector.startDebugSession(id)
  }, [])

  const endSession = useCallback(() => {
    return stateInspector.endDebugSession()
  }, [])

  const analyzeState = useCallback(() => {
    return stateInspector.analyzeState()
  }, [])

  const exportState = useCallback((includeSnapshots = true, includeChanges = true) => {
    return stateInspector.exportState(includeSnapshots, includeChanges)
  }, [])

  return {
    inspector: stateInspector,
    snapshots,
    changes,
    currentSession,
    takeSnapshot,
    startSession,
    endSession,
    analyzeState,
    exportState,
    isEnabled: stateInspector.isEnabled()
  }
}

// ============================================================================
// Development Console Commands
// ============================================================================

if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  ;(window as any).__STATE_INSPECTOR__ = stateInspector
  ;(window as any).__PERFORMANCE_MONITOR__ = performanceMonitor
  ;(window as any).__STATE_VALIDATOR__ = stateValidator
  ;(window as any).__STATE_LOGGER__ = stateLogger

  console.log('🔧 Development tools available:')
  console.log('  __STATE_INSPECTOR__ - State inspection and debugging')
  console.log('  __PERFORMANCE_MONITOR__ - Performance monitoring')
  console.log('  __STATE_VALIDATOR__ - State validation')
  console.log('  __STATE_LOGGER__ - Logging system')
}