// State Persistence Coordination System
import { stateLogger } from '../logging/stateLogger'
import { performanceMonitor } from '../monitoring/performanceMonitor'

// ============================================================================
// Persistence Types and Interfaces
// ============================================================================

export interface PersistenceLayer {
  name: string
  priority: number
  available: boolean
  capacity: number
  used: number
  read: (key: string) => Promise<any>
  write: (key: string, value: any) => Promise<void>
  delete: (key: string) => Promise<void>
  clear: () => Promise<void>
  keys: () => Promise<string[]>
  getUsage: () => Promise<{ used: number; capacity: number }>
}

export interface PersistenceConfig {
  layers: PersistenceLayer[]
  fallbackStrategy: 'next_layer' | 'memory_only' | 'fail'
  syncStrategy: 'write_through' | 'write_back' | 'write_around'
  compressionEnabled: boolean
  encryptionEnabled: boolean
  maxRetries: number
  retryDelay: number
}

export interface PersistenceOperation {
  id: string
  type: 'read' | 'write' | 'delete' | 'clear'
  key: string
  value?: any
  timestamp: number
  layer: string
  success: boolean
  error?: string
  duration: number
}

export interface SyncStatus {
  inProgress: boolean
  lastSync: number
  pendingOperations: number
  errors: string[]
}

// ============================================================================
// Storage Layer Implementations
// ============================================================================

class MemoryStorageLayer implements PersistenceLayer {
  name = 'memory'
  priority = 1
  available = true
  capacity = 50 * 1024 * 1024 // 50MB
  used = 0
  private storage = new Map<string, any>()

  async read(key: string): Promise<any> {
    return this.storage.get(key)
  }

  async write(key: string, value: any): Promise<void> {
    const serialized = JSON.stringify(value)
    this.used += serialized.length
    this.storage.set(key, value)
  }

  async delete(key: string): Promise<void> {
    const existing = this.storage.get(key)
    if (existing) {
      this.used -= JSON.stringify(existing).length
      this.storage.delete(key)
    }
  }

  async clear(): Promise<void> {
    this.storage.clear()
    this.used = 0
  }

  async keys(): Promise<string[]> {
    return Array.from(this.storage.keys())
  }

  async getUsage(): Promise<{ used: number; capacity: number }> {
    return { used: this.used, capacity: this.capacity }
  }
}

class LocalStorageLayer implements PersistenceLayer {
  name = 'localStorage'
  priority = 2
  available = typeof localStorage !== 'undefined'
  capacity = 5 * 1024 * 1024 // 5MB typical limit
  used = 0

  constructor() {
    this.updateUsage()
  }

  private updateUsage(): void {
    if (!this.available) return
    
    let total = 0
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length + key.length
      }
    }
    this.used = total
  }

  async read(key: string): Promise<any> {
    if (!this.available) throw new Error('localStorage not available')
    
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : undefined
    } catch (error) {
      throw new Error(`Failed to read from localStorage: ${(error as Error).message}`)
    }
  }

  async write(key: string, value: any): Promise<void> {
    if (!this.available) throw new Error('localStorage not available')
    
    try {
      const serialized = JSON.stringify(value)
      
      // Check if we have enough space
      if (this.used + serialized.length > this.capacity) {
        throw new Error('localStorage quota exceeded')
      }
      
      localStorage.setItem(key, serialized)
      this.updateUsage()
    } catch (error) {
      throw new Error(`Failed to write to localStorage: ${(error as Error).message}`)
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.available) throw new Error('localStorage not available')
    
    localStorage.removeItem(key)
    this.updateUsage()
  }

  async clear(): Promise<void> {
    if (!this.available) throw new Error('localStorage not available')
    
    localStorage.clear()
    this.used = 0
  }

  async keys(): Promise<string[]> {
    if (!this.available) return []
    
    return Object.keys(localStorage)
  }

  async getUsage(): Promise<{ used: number; capacity: number }> {
    this.updateUsage()
    return { used: this.used, capacity: this.capacity }
  }
}

class IndexedDBLayer implements PersistenceLayer {
  name = 'indexedDB'
  priority = 3
  available = typeof indexedDB !== 'undefined'
  capacity = 50 * 1024 * 1024 // 50MB typical limit
  used = 0
  private db: IDBDatabase | null = null
  private dbName = 'app-persistence'
  private version = 1

  async init(): Promise<void> {
    if (!this.available) return

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        this.updateUsage()
        resolve()
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        if (!db.objectStoreNames.contains('persistence')) {
          db.createObjectStore('persistence', { keyPath: 'key' })
        }
      }
    })
  }

  private async updateUsage(): Promise<void> {
    if (!this.db) return
    
    try {
      const keys = await this.keys()
      let total = 0
      
      for (const key of keys) {
        const value = await this.read(key)
        total += JSON.stringify(value).length + key.length
      }
      
      this.used = total
    } catch (error) {
      stateLogger.warn('persistence', 'Failed to update IndexedDB usage', { error })
    }
  }

  async read(key: string): Promise<any> {
    if (!this.db) await this.init()
    if (!this.db) throw new Error('IndexedDB not available')
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['persistence'], 'readonly')
      const store = transaction.objectStore('persistence')
      const request = store.get(key)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const result = request.result
        resolve(result ? result.value : undefined)
      }
    })
  }

  async write(key: string, value: any): Promise<void> {
    if (!this.db) await this.init()
    if (!this.db) throw new Error('IndexedDB not available')
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['persistence'], 'readwrite')
      const store = transaction.objectStore('persistence')
      const request = store.put({ key, value, timestamp: Date.now() })
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.updateUsage()
        resolve()
      }
    })
  }

  async delete(key: string): Promise<void> {
    if (!this.db) await this.init()
    if (!this.db) throw new Error('IndexedDB not available')
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['persistence'], 'readwrite')
      const store = transaction.objectStore('persistence')
      const request = store.delete(key)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.updateUsage()
        resolve()
      }
    })
  }

  async clear(): Promise<void> {
    if (!this.db) await this.init()
    if (!this.db) throw new Error('IndexedDB not available')
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['persistence'], 'readwrite')
      const store = transaction.objectStore('persistence')
      const request = store.clear()
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.used = 0
        resolve()
      }
    })
  }

  async keys(): Promise<string[]> {
    if (!this.db) await this.init()
    if (!this.db) return []
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['persistence'], 'readonly')
      const store = transaction.objectStore('persistence')
      const request = store.getAllKeys()
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result as string[])
    })
  }

  async getUsage(): Promise<{ used: number; capacity: number }> {
    await this.updateUsage()
    return { used: this.used, capacity: this.capacity }
  }
}

// ============================================================================
// Persistence Coordinator Implementation
// ============================================================================

export class PersistenceCoordinator {
  private config: PersistenceConfig
  private operations: PersistenceOperation[] = []
  private syncStatus: SyncStatus = {
    inProgress: false,
    lastSync: 0,
    pendingOperations: 0,
    errors: []
  }
  private writeBackQueue: Map<string, { value: any; timestamp: number }> = new Map()

  constructor(config?: Partial<PersistenceConfig>) {
    this.config = {
      layers: [
        new MemoryStorageLayer(),
        new LocalStorageLayer(),
        new IndexedDBLayer()
      ],
      fallbackStrategy: 'next_layer',
      syncStrategy: 'write_through',
      compressionEnabled: false,
      encryptionEnabled: false,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    }

    this.initializeLayers()
    this.startSyncProcess()
  }

  private async initializeLayers(): Promise<void> {
    for (const layer of this.config.layers) {
      try {
        if ('init' in layer && typeof layer.init === 'function') {
          await (layer as any).init()
        }
        stateLogger.info('persistence', `Initialized ${layer.name} layer`, {
          available: layer.available,
          capacity: layer.capacity
        })
      } catch (error) {
        stateLogger.error('persistence', `Failed to initialize ${layer.name} layer`, { error })
        layer.available = false
      }
    }
  }

  private startSyncProcess(): void {
    if (this.config.syncStrategy === 'write_back') {
      setInterval(() => {
        this.syncWriteBackQueue()
      }, 5000) // Sync every 5 seconds
    }
  }

  // ============================================================================
  // Core Operations
  // ============================================================================

  async read(key: string): Promise<any> {
    const timer = performanceMonitor.startTimer(`persistence.read.${key}`, 'persistence')
    
    try {
      const availableLayers = this.getAvailableLayers()
      
      for (const layer of availableLayers) {
        try {
          const value = await layer.read(key)
          
          this.recordOperation({
            id: this.generateOperationId(),
            type: 'read',
            key,
            timestamp: Date.now(),
            layer: layer.name,
            success: true,
            duration: timer.getDuration()
          })
          
          if (value !== undefined) {
            // Cache in higher priority layers if found in lower priority layer
            await this.cacheInHigherLayers(key, value, layer)
            timer.stop()
            return value
          }
        } catch (error) {
          this.recordOperation({
            id: this.generateOperationId(),
            type: 'read',
            key,
            timestamp: Date.now(),
            layer: layer.name,
            success: false,
            error: (error as Error).message,
            duration: timer.getDuration()
          })
          
          stateLogger.warn('persistence', `Read failed on ${layer.name}`, { key, error })
          
          if (this.config.fallbackStrategy === 'fail') {
            timer.stop()
            throw error
          }
          // Continue to next layer
        }
      }
      
      timer.stop()
      return undefined
    } catch (error) {
      timer.stop()
      throw error
    }
  }

  async write(key: string, value: any): Promise<void> {
    const timer = performanceMonitor.startTimer(`persistence.write.${key}`, 'persistence')
    
    try {
      switch (this.config.syncStrategy) {
        case 'write_through':
          await this.writeThrough(key, value)
          break
        case 'write_back':
          await this.writeBack(key, value)
          break
        case 'write_around':
          await this.writeAround(key, value)
          break
      }
      
      timer.stop()
    } catch (error) {
      timer.stop()
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    const timer = performanceMonitor.startTimer(`persistence.delete.${key}`, 'persistence')
    
    try {
      const availableLayers = this.getAvailableLayers()
      const errors: Error[] = []
      
      for (const layer of availableLayers) {
        try {
          await layer.delete(key)
          
          this.recordOperation({
            id: this.generateOperationId(),
            type: 'delete',
            key,
            timestamp: Date.now(),
            layer: layer.name,
            success: true,
            duration: timer.getDuration()
          })
        } catch (error) {
          errors.push(error as Error)
          
          this.recordOperation({
            id: this.generateOperationId(),
            type: 'delete',
            key,
            timestamp: Date.now(),
            layer: layer.name,
            success: false,
            error: (error as Error).message,
            duration: timer.getDuration()
          })
        }
      }
      
      // Remove from write-back queue if present
      this.writeBackQueue.delete(key)
      
      timer.stop()
      
      if (errors.length === availableLayers.length) {
        throw new Error(`Delete failed on all layers: ${errors.map(e => e.message).join(', ')}`)
      }
    } catch (error) {
      timer.stop()
      throw error
    }
  }

  async clear(): Promise<void> {
    const timer = performanceMonitor.startTimer('persistence.clear', 'persistence')
    
    try {
      const availableLayers = this.getAvailableLayers()
      const errors: Error[] = []
      
      for (const layer of availableLayers) {
        try {
          await layer.clear()
          
          this.recordOperation({
            id: this.generateOperationId(),
            type: 'clear',
            key: '*',
            timestamp: Date.now(),
            layer: layer.name,
            success: true,
            duration: timer.getDuration()
          })
        } catch (error) {
          errors.push(error as Error)
          
          this.recordOperation({
            id: this.generateOperationId(),
            type: 'clear',
            key: '*',
            timestamp: Date.now(),
            layer: layer.name,
            success: false,
            error: (error as Error).message,
            duration: timer.getDuration()
          })
        }
      }
      
      // Clear write-back queue
      this.writeBackQueue.clear()
      
      timer.stop()
      
      if (errors.length === availableLayers.length) {
        throw new Error(`Clear failed on all layers: ${errors.map(e => e.message).join(', ')}`)
      }
    } catch (error) {
      timer.stop()
      throw error
    }
  }

  // ============================================================================
  // Write Strategies
  // ============================================================================

  private async writeThrough(key: string, value: any): Promise<void> {
    const availableLayers = this.getAvailableLayers()
    const errors: Error[] = []
    let successCount = 0
    
    for (const layer of availableLayers) {
      try {
        await layer.write(key, value)
        successCount++
        
        this.recordOperation({
          id: this.generateOperationId(),
          type: 'write',
          key,
          value,
          timestamp: Date.now(),
          layer: layer.name,
          success: true,
          duration: 0
        })
      } catch (error) {
        errors.push(error as Error)
        
        this.recordOperation({
          id: this.generateOperationId(),
          type: 'write',
          key,
          value,
          timestamp: Date.now(),
          layer: layer.name,
          success: false,
          error: (error as Error).message,
          duration: 0
        })
        
        stateLogger.warn('persistence', `Write failed on ${layer.name}`, { key, error })
        
        if (this.config.fallbackStrategy === 'fail') {
          throw error
        }
      }
    }
    
    if (successCount === 0) {
      throw new Error(`Write failed on all layers: ${errors.map(e => e.message).join(', ')}`)
    }
  }

  private async writeBack(key: string, value: any): Promise<void> {
    // Write to memory layer immediately
    const memoryLayer = this.config.layers.find(l => l.name === 'memory')
    if (memoryLayer && memoryLayer.available) {
      await memoryLayer.write(key, value)
    }
    
    // Queue for later write to persistent layers
    this.writeBackQueue.set(key, { value, timestamp: Date.now() })
    this.syncStatus.pendingOperations = this.writeBackQueue.size
  }

  private async writeAround(key: string, value: any): Promise<void> {
    // Skip cache layers and write directly to persistent storage
    const persistentLayers = this.config.layers.filter(l => l.name !== 'memory')
    const errors: Error[] = []
    let successCount = 0
    
    for (const layer of persistentLayers) {
      if (!layer.available) continue
      
      try {
        await layer.write(key, value)
        successCount++
        
        this.recordOperation({
          id: this.generateOperationId(),
          type: 'write',
          key,
          value,
          timestamp: Date.now(),
          layer: layer.name,
          success: true,
          duration: 0
        })
      } catch (error) {
        errors.push(error as Error)
        
        this.recordOperation({
          id: this.generateOperationId(),
          type: 'write',
          key,
          value,
          timestamp: Date.now(),
          layer: layer.name,
          success: false,
          error: (error as Error).message,
          duration: 0
        })
      }
    }
    
    if (successCount === 0) {
      throw new Error(`Write-around failed on all persistent layers: ${errors.map(e => e.message).join(', ')}`)
    }
  }

  // ============================================================================
  // Sync Operations
  // ============================================================================

  private async syncWriteBackQueue(): Promise<void> {
    if (this.syncStatus.inProgress || this.writeBackQueue.size === 0) {
      return
    }
    
    this.syncStatus.inProgress = true
    this.syncStatus.errors = []
    
    try {
      const persistentLayers = this.config.layers.filter(l => l.name !== 'memory' && l.available)
      
      for (const [key, { value }] of this.writeBackQueue.entries()) {
        let synced = false
        
        for (const layer of persistentLayers) {
          try {
            await layer.write(key, value)
            synced = true
            break
          } catch (error) {
            this.syncStatus.errors.push(`${layer.name}: ${(error as Error).message}`)
          }
        }
        
        if (synced) {
          this.writeBackQueue.delete(key)
        }
      }
      
      this.syncStatus.lastSync = Date.now()
      this.syncStatus.pendingOperations = this.writeBackQueue.size
      
      stateLogger.info('persistence', 'Write-back sync completed', {
        synced: this.writeBackQueue.size,
        pending: this.syncStatus.pendingOperations,
        errors: this.syncStatus.errors.length
      })
    } catch (error) {
      stateLogger.error('persistence', 'Write-back sync failed', { error })
    } finally {
      this.syncStatus.inProgress = false
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private getAvailableLayers(): PersistenceLayer[] {
    return this.config.layers
      .filter(layer => layer.available)
      .sort((a, b) => a.priority - b.priority)
  }

  private async cacheInHigherLayers(key: string, value: any, sourceLayer: PersistenceLayer): Promise<void> {
    const higherLayers = this.config.layers
      .filter(layer => layer.available && layer.priority < sourceLayer.priority)
    
    for (const layer of higherLayers) {
      try {
        await layer.write(key, value)
      } catch (error) {
        stateLogger.warn('persistence', `Failed to cache in ${layer.name}`, { key, error })
      }
    }
  }

  private recordOperation(operation: PersistenceOperation): void {
    this.operations.push(operation)
    
    // Keep only last 1000 operations
    if (this.operations.length > 1000) {
      this.operations.shift()
    }
    
    performanceMonitor.recordTiming(
      `persistence.${operation.type}.${operation.layer}`,
      operation.duration,
      'persistence',
      {
        key: operation.key,
        success: operation.success.toString(),
        layer: operation.layer
      }
    )
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // ============================================================================
  // Public API
  // ============================================================================

  getStats(): {
    layers: Array<{
      name: string
      available: boolean
      usage: { used: number; capacity: number }
    }>
    operations: {
      total: number
      successful: number
      failed: number
      byType: Record<string, number>
      byLayer: Record<string, number>
    }
    syncStatus: SyncStatus
  } {
    const operationsByType: Record<string, number> = {}
    const operationsByLayer: Record<string, number> = {}
    let successful = 0
    let failed = 0
    
    for (const op of this.operations) {
      operationsByType[op.type] = (operationsByType[op.type] || 0) + 1
      operationsByLayer[op.layer] = (operationsByLayer[op.layer] || 0) + 1
      
      if (op.success) {
        successful++
      } else {
        failed++
      }
    }
    
    return {
      layers: this.config.layers.map(layer => ({
        name: layer.name,
        available: layer.available,
        usage: { used: layer.used, capacity: layer.capacity }
      })),
      operations: {
        total: this.operations.length,
        successful,
        failed,
        byType: operationsByType,
        byLayer: operationsByLayer
      },
      syncStatus: { ...this.syncStatus }
    }
  }

  getOperations(limit?: number): PersistenceOperation[] {
    const ops = [...this.operations].reverse()
    return limit ? ops.slice(0, limit) : ops
  }

  updateConfig(updates: Partial<PersistenceConfig>): void {
    this.config = { ...this.config, ...updates }
  }

  async forcSync(): Promise<void> {
    if (this.config.syncStrategy === 'write_back') {
      await this.syncWriteBackQueue()
    }
  }

  clearOperationHistory(): void {
    this.operations = []
  }
}

// ============================================================================
// Global Persistence Coordinator Instance
// ============================================================================

export const persistenceCoordinator = new PersistenceCoordinator()

// ============================================================================
// Convenience Functions
// ============================================================================

export const persistentRead = (key: string): Promise<any> => {
  return persistenceCoordinator.read(key)
}

export const persistentWrite = (key: string, value: any): Promise<void> => {
  return persistenceCoordinator.write(key, value)
}

export const persistentDelete = (key: string): Promise<void> => {
  return persistenceCoordinator.delete(key)
}

export const persistentClear = (): Promise<void> => {
  return persistenceCoordinator.clear()
}

// ============================================================================
// React Hook for Persistence
// ============================================================================

export const usePersistence = () => {
  return {
    read: persistentRead,
    write: persistentWrite,
    delete: persistentDelete,
    clear: persistentClear,
    coordinator: persistenceCoordinator,
    stats: persistenceCoordinator.getStats()
  }
}