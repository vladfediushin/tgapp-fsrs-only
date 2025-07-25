// Core Cache Management System
// Consolidated from cacheMonitor.ts and productionCaching.ts
// Provides comprehensive caching with monitoring, statistics, and optimization

import { useUnifiedStore } from '../../store/unified'
import { useState, useEffect, useCallback } from 'react'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface CacheStatistics {
  totalRequests: number
  cacheHits: number
  cacheMisses: number
  hitRate: number
  memorySize: number
  localStorageSize: number
  indexedDBSize: number
  topCachedKeys: Array<{ key: string; hits: number }>
}

export interface CachePerformanceMetrics {
  averageResponseTime: number
  cacheResponseTime: number
  apiResponseTime: number
  deduplicationSavings: number
}

export interface CacheConfig {
  enabled: boolean
  version: string
  maxAge: number
  maxSize: number
  compressionEnabled: boolean
  encryptionEnabled: boolean
  strategies: {
    memory: boolean
    localStorage: boolean
    indexedDB: boolean
    serviceWorker: boolean
  }
}

export interface CacheEntry<T = any> {
  key: string
  data: T
  timestamp: number
  expiry: number
  size: number
  compressed: boolean
  encrypted: boolean
  accessCount: number
  lastAccessed: number
  tags: string[]
  metadata: Record<string, any>
}

export interface CacheStats {
  totalEntries: number
  totalSize: number
  hitRate: number
  missRate: number
  evictionCount: number
  compressionRatio: number
  averageAccessTime: number
  memoryUsage: number
  storageUsage: number
}

// ============================================================================
// Cache Monitor Class
// ============================================================================

class CacheMonitor {
  private requestTimes: Map<string, number> = new Map()
  private keyHitCounts: Map<string, number> = new Map()
  private deduplicationCount: number = 0

  recordRequestStart(key: string): void {
    this.requestTimes.set(key, Date.now())
  }

  recordRequestEnd(key: string, fromCache: boolean): void {
    const startTime = this.requestTimes.get(key)
    if (startTime) {
      const duration = Date.now() - startTime
      this.requestTimes.delete(key)
      
      if (fromCache) {
        this.keyHitCounts.set(key, (this.keyHitCounts.get(key) || 0) + 1)
      }
    }
  }

  recordDeduplication(): void {
    this.deduplicationCount++
  }

  getStatistics(): CacheStatistics {
    const store = useUnifiedStore.getState()
    const metrics = store.getCacheMetrics()
    
    return {
      totalRequests: metrics.requests,
      cacheHits: metrics.hits,
      cacheMisses: metrics.misses,
      hitRate: metrics.hitRate,
      memorySize: store.memoryCache.size,
      localStorageSize: store.localStorageCache.size,
      indexedDBSize: store.indexedDBCache.size,
      topCachedKeys: Array.from(this.keyHitCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([key, hits]) => ({ key, hits }))
    }
  }

  getPerformanceMetrics(): CachePerformanceMetrics {
    // Calculate average response times
    const allTimes = Array.from(this.requestTimes.values())
    const averageResponseTime = allTimes.length > 0 
      ? allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length 
      : 0

    return {
      averageResponseTime,
      cacheResponseTime: 5, // Estimated cache response time in ms
      apiResponseTime: 200, // Estimated API response time in ms
      deduplicationSavings: this.deduplicationCount
    }
  }

  reset(): void {
    this.requestTimes.clear()
    this.keyHitCounts.clear()
    this.deduplicationCount = 0
  }
}

// ============================================================================
// Production Cache Manager Class
// ============================================================================

class ProductionCacheManager {
  private config: CacheConfig
  private memoryCache: Map<string, CacheEntry> = new Map()
  private stats: CacheStats
  private compressionWorker?: Worker
  private encryptionKey?: CryptoKey
  private observers: Set<(stats: CacheStats) => void> = new Set()

  constructor(config: CacheConfig) {
    this.config = config
    this.stats = this.initializeStats()
    
    if (config.enabled) {
      this.initialize()
    }
  }

  private initializeStats(): CacheStats {
    return {
      totalEntries: 0,
      totalSize: 0,
      hitRate: 0,
      missRate: 0,
      evictionCount: 0,
      compressionRatio: 0,
      averageAccessTime: 0,
      memoryUsage: 0,
      storageUsage: 0
    }
  }

  private async initialize(): Promise<void> {
    // Initialize compression worker
    if (this.config.compressionEnabled) {
      await this.initializeCompression()
    }

    // Initialize encryption
    if (this.config.encryptionEnabled) {
      await this.initializeEncryption()
    }

    // Load existing cache from persistent storage
    await this.loadFromPersistentStorage()

    // Setup periodic cleanup
    setInterval(() => this.cleanup(), 60000) // Every minute

    // Setup stats update
    setInterval(() => this.updateStats(), 5000) // Every 5 seconds
  }

  private async initializeCompression(): Promise<void> {
    try {
      // Create compression worker
      const workerCode = `
        self.onmessage = function(e) {
          const { action, data, id } = e.data;
          
          if (action === 'compress') {
            try {
              const compressed = new TextEncoder().encode(JSON.stringify(data));
              // Simple compression simulation - in real implementation use CompressionStream
              self.postMessage({ id, result: compressed, compressed: true });
            } catch (error) {
              self.postMessage({ id, error: error.message });
            }
          } else if (action === 'decompress') {
            try {
              const decompressed = JSON.parse(new TextDecoder().decode(data));
              self.postMessage({ id, result: decompressed });
            } catch (error) {
              self.postMessage({ id, error: error.message });
            }
          }
        };
      `

      const blob = new Blob([workerCode], { type: 'application/javascript' })
      this.compressionWorker = new Worker(URL.createObjectURL(blob))
    } catch (error) {
      console.warn('Compression worker initialization failed:', error)
    }
  }

  private async initializeEncryption(): Promise<void> {
    try {
      // Generate or retrieve encryption key
      const keyData = localStorage.getItem('cache_encryption_key')
      
      if (keyData) {
        // Import existing key
        const keyBuffer = new Uint8Array(JSON.parse(keyData))
        this.encryptionKey = await crypto.subtle.importKey(
          'raw',
          keyBuffer,
          { name: 'AES-GCM' },
          false,
          ['encrypt', 'decrypt']
        )
      } else {
        // Generate new key
        this.encryptionKey = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        )
        
        // Store key for future use
        const keyBuffer = await crypto.subtle.exportKey('raw', this.encryptionKey)
        localStorage.setItem('cache_encryption_key', JSON.stringify(Array.from(new Uint8Array(keyBuffer))))
      }
    } catch (error) {
      console.warn('Encryption initialization failed:', error)
      this.config.encryptionEnabled = false
    }
  }

  private async loadFromPersistentStorage(): Promise<void> {
    if (!this.config.strategies.localStorage && !this.config.strategies.indexedDB) {
      return
    }

    try {
      // Load from localStorage
      if (this.config.strategies.localStorage) {
        const cacheData = localStorage.getItem(`cache_${this.config.version}`)
        if (cacheData) {
          const entries = JSON.parse(cacheData)
          for (const entry of entries) {
            if (entry.expiry > Date.now()) {
              this.memoryCache.set(entry.key, entry)
            }
          }
        }
      }

      // Load from IndexedDB
      if (this.config.strategies.indexedDB) {
        await this.loadFromIndexedDB()
      }
    } catch (error) {
      console.warn('Failed to load cache from persistent storage:', error)
    }
  }

  private async loadFromIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(`cache_${this.config.version}`, 1)
      
      request.onerror = () => reject(request.error)
      
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['cache'], 'readonly')
        const store = transaction.objectStore('cache')
        const getAllRequest = store.getAll()
        
        getAllRequest.onsuccess = () => {
          const entries = getAllRequest.result
          for (const entry of entries) {
            if (entry.expiry > Date.now()) {
              this.memoryCache.set(entry.key, entry)
            }
          }
          resolve()
        }
        
        getAllRequest.onerror = () => reject(getAllRequest.error)
      }
      
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' })
        }
      }
    })
  }

  public async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now()
    
    try {
      const entry = this.memoryCache.get(key)
      
      if (!entry) {
        this.stats.missRate++
        return null
      }

      // Check expiry
      if (entry.expiry < Date.now()) {
        this.memoryCache.delete(key)
        this.stats.missRate++
        return null
      }

      // Update access statistics
      entry.accessCount++
      entry.lastAccessed = Date.now()
      
      // Decrypt if needed
      let data = entry.data
      if (entry.encrypted && this.encryptionKey) {
        data = await this.decrypt(data)
      }

      // Decompress if needed
      if (entry.compressed && this.compressionWorker) {
        data = await this.decompress(data)
      }

      this.stats.hitRate++
      this.stats.averageAccessTime = (this.stats.averageAccessTime + (performance.now() - startTime)) / 2

      return data as T
    } catch (error) {
      console.warn('Cache get error:', error)
      this.stats.missRate++
      return null
    }
  }

  public async set<T>(
    key: string, 
    data: T, 
    options: {
      ttl?: number
      tags?: string[]
      compress?: boolean
      encrypt?: boolean
      metadata?: Record<string, any>
    } = {}
  ): Promise<void> {
    try {
      const now = Date.now()
      const ttl = options.ttl || this.config.maxAge
      const expiry = now + ttl

      let processedData = data
      let compressed = false
      let encrypted = false
      let size = this.calculateSize(data)

      // Compress if enabled and beneficial
      if ((options.compress ?? this.config.compressionEnabled) && size > 1024) {
        try {
          processedData = await this.compress(processedData)
          compressed = true
          size = this.calculateSize(processedData)
        } catch (error) {
          console.warn('Compression failed:', error)
        }
      }

      // Encrypt if enabled
      if ((options.encrypt ?? this.config.encryptionEnabled) && this.encryptionKey) {
        try {
          processedData = await this.encrypt(processedData) as T
          encrypted = true
        } catch (error) {
          console.warn('Encryption failed:', error)
        }
      }

      const entry: CacheEntry<T> = {
        key,
        data: processedData,
        timestamp: now,
        expiry,
        size,
        compressed,
        encrypted,
        accessCount: 0,
        lastAccessed: now,
        tags: options.tags || [],
        metadata: options.metadata || {}
      }

      // Check cache size limits
      await this.ensureCacheSize(size)

      // Store in memory cache
      this.memoryCache.set(key, entry)

      // Store in persistent storage
      await this.saveToPersistentStorage(entry)

      this.updateStats()
    } catch (error) {
      console.warn('Cache set error:', error)
    }
  }

  public async delete(key: string): Promise<boolean> {
    try {
      const deleted = this.memoryCache.delete(key)
      
      // Remove from persistent storage
      if (this.config.strategies.localStorage) {
        await this.removeFromLocalStorage(key)
      }
      
      if (this.config.strategies.indexedDB) {
        await this.removeFromIndexedDB(key)
      }

      this.updateStats()
      return deleted
    } catch (error) {
      console.warn('Cache delete error:', error)
      return false
    }
  }

  public async clear(): Promise<void> {
    try {
      this.memoryCache.clear()
      
      if (this.config.strategies.localStorage) {
        localStorage.removeItem(`cache_${this.config.version}`)
      }
      
      if (this.config.strategies.indexedDB) {
        await this.clearIndexedDB()
      }

      this.stats = this.initializeStats()
      this.notifyObservers()
    } catch (error) {
      console.warn('Cache clear error:', error)
    }
  }

  public async invalidateByTag(tag: string): Promise<number> {
    let invalidated = 0
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.tags.includes(tag)) {
        await this.delete(key)
        invalidated++
      }
    }
    
    return invalidated
  }

  private async ensureCacheSize(newEntrySize: number): Promise<void> {
    let currentSize = this.getCurrentSize()
    
    if (currentSize + newEntrySize <= this.config.maxSize) {
      return
    }

    // Evict entries using LRU strategy
    const entries = Array.from(this.memoryCache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)

    for (const [key, entry] of entries) {
      if (currentSize + newEntrySize <= this.config.maxSize) {
        break
      }
      
      await this.delete(key)
      currentSize -= entry.size
      this.stats.evictionCount++
    }
  }

  private getCurrentSize(): number {
    return Array.from(this.memoryCache.values())
      .reduce((total, entry) => total + entry.size, 0)
  }

  private calculateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size
    } catch {
      return JSON.stringify(data).length * 2 // Rough estimate
    }
  }

  private async compress(data: any): Promise<any> {
    if (!this.compressionWorker) {
      return data
    }

    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substr(2, 9)
      
      const handleMessage = (e: MessageEvent) => {
        if (e.data.id === id) {
          this.compressionWorker!.removeEventListener('message', handleMessage)
          
          if (e.data.error) {
            reject(new Error(e.data.error))
          } else {
            resolve(e.data.result)
          }
        }
      }
      
      this.compressionWorker!.addEventListener('message', handleMessage)
      this.compressionWorker!.postMessage({ action: 'compress', data, id })
      
      // Timeout after 5 seconds
      setTimeout(() => {
        this.compressionWorker!.removeEventListener('message', handleMessage)
        reject(new Error('Compression timeout'))
      }, 5000)
    })
  }

  private async decompress(data: any): Promise<any> {
    if (!this.compressionWorker) {
      return data
    }

    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substr(2, 9)
      
      const handleMessage = (e: MessageEvent) => {
        if (e.data.id === id) {
          this.compressionWorker!.removeEventListener('message', handleMessage)
          
          if (e.data.error) {
            reject(new Error(e.data.error))
          } else {
            resolve(e.data.result)
          }
        }
      }
      
      this.compressionWorker!.addEventListener('message', handleMessage)
      this.compressionWorker!.postMessage({ action: 'decompress', data, id })
      
      // Timeout after 5 seconds
      setTimeout(() => {
        this.compressionWorker!.removeEventListener('message', handleMessage)
        reject(new Error('Decompression timeout'))
      }, 5000)
    })
  }

  private async encrypt(data: any): Promise<ArrayBuffer> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available')
    }

    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(JSON.stringify(data))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      dataBuffer
    )

    // Combine IV and encrypted data
    const result = new Uint8Array(iv.length + encrypted.byteLength)
    result.set(iv)
    result.set(new Uint8Array(encrypted), iv.length)
    
    return result.buffer
  }

  private async decrypt(encryptedData: ArrayBuffer): Promise<any> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available')
    }

    const data = new Uint8Array(encryptedData)
    const iv = data.slice(0, 12)
    const encrypted = data.slice(12)
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      encrypted
    )

    const decoder = new TextDecoder()
    return JSON.parse(decoder.decode(decrypted))
  }

  private async saveToPersistentStorage(entry: CacheEntry): Promise<void> {
    try {
      if (this.config.strategies.localStorage) {
        await this.saveToLocalStorage(entry)
      }
      
      if (this.config.strategies.indexedDB) {
        await this.saveToIndexedDB(entry)
      }
    } catch (error) {
      console.warn('Failed to save to persistent storage:', error)
    }
  }

  private async saveToLocalStorage(entry: CacheEntry): Promise<void> {
    try {
      const existingData = localStorage.getItem(`cache_${this.config.version}`)
      const entries = existingData ? JSON.parse(existingData) : []
      
      // Remove existing entry with same key
      const filteredEntries = entries.filter((e: CacheEntry) => e.key !== entry.key)
      filteredEntries.push(entry)
      
      // Keep only recent entries to avoid localStorage quota issues
      const recentEntries = filteredEntries
        .sort((a: CacheEntry, b: CacheEntry) => b.timestamp - a.timestamp)
        .slice(0, 100)
      
      localStorage.setItem(`cache_${this.config.version}`, JSON.stringify(recentEntries))
    } catch (error) {
      console.warn('LocalStorage save failed:', error)
    }
  }

  private async saveToIndexedDB(entry: CacheEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(`cache_${this.config.version}`, 1)
      
      request.onerror = () => reject(request.error)
      
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['cache'], 'readwrite')
        const store = transaction.objectStore('cache')
        
        const putRequest = store.put(entry)
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(putRequest.error)
      }
    })
  }

  private async removeFromLocalStorage(key: string): Promise<void> {
    try {
      const existingData = localStorage.getItem(`cache_${this.config.version}`)
      if (existingData) {
        const entries = JSON.parse(existingData)
        const filteredEntries = entries.filter((e: CacheEntry) => e.key !== key)
        localStorage.setItem(`cache_${this.config.version}`, JSON.stringify(filteredEntries))
      }
    } catch (error) {
      console.warn('LocalStorage remove failed:', error)
    }
  }

  private async removeFromIndexedDB(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(`cache_${this.config.version}`, 1)
      
      request.onerror = () => reject(request.error)
      
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['cache'], 'readwrite')
        const store = transaction.objectStore('cache')
        
        const deleteRequest = store.delete(key)
        deleteRequest.onsuccess = () => resolve()
        deleteRequest.onerror = () => reject(deleteRequest.error)
      }
    })
  }

  private async clearIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(`cache_${this.config.version}`, 1)
      
      request.onerror = () => reject(request.error)
      
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['cache'], 'readwrite')
        const store = transaction.objectStore('cache')
        
        const clearRequest = store.clear()
        clearRequest.onsuccess = () => resolve()
        clearRequest.onerror = () => reject(clearRequest.error)
      }
    })
  }

  private cleanup(): void {
    const now = Date.now()
    const expiredKeys: string[] = []
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiry < now) {
        expiredKeys.push(key)
      }
    }
    
    for (const key of expiredKeys) {
      this.delete(key)
    }
    
    if (expiredKeys.length > 0) {
      this.updateStats()
    }
  }

  private updateStats(): void {
    const entries = Array.from(this.memoryCache.values())
    
    this.stats.totalEntries = entries.length
    this.stats.totalSize = entries.reduce((sum, entry) => sum + entry.size, 0)
    this.stats.memoryUsage = this.stats.totalSize
    
    // Calculate compression ratio
    const compressedEntries = entries.filter(e => e.compressed)
    if (compressedEntries.length > 0) {
      // This would need actual before/after size tracking
      this.stats.compressionRatio = 0.7 // Placeholder
    }
    
    this.notifyObservers()
  }

  private notifyObservers(): void {
    this.observers.forEach(observer => observer(this.stats))
  }

  // Public methods
  public getStats(): CacheStats {
    return { ...this.stats }
  }

  public subscribe(observer: (stats: CacheStats) => void): () => void {
    this.observers.add(observer)
    return () => this.observers.delete(observer)
  }

  public async preload(keys: string[], loader: (key: string) => Promise<any>): Promise<void> {
    const promises = keys.map(async (key) => {
      const cached = await this.get(key)
      if (!cached) {
        try {
          const data = await loader(key)
          await this.set(key, data, { tags: ['preloaded'] })
        } catch (error) {
          console.warn(`Failed to preload ${key}:`, error)
        }
      }
    })
    
    await Promise.allSettled(promises)
  }

  public destroy(): void {
    if (this.compressionWorker) {
      this.compressionWorker.terminate()
    }
    
    this.memoryCache.clear()
    this.observers.clear()
  }
}

// ============================================================================
// Global Instances
// ============================================================================

export const cacheMonitor = new CacheMonitor()

let cacheManager: ProductionCacheManager | null = null

// ============================================================================
// Public API Functions
// ============================================================================

export const initializeCaching = (config: CacheConfig): ProductionCacheManager => {
  if (!cacheManager) {
    cacheManager = new ProductionCacheManager(config)
  }
  return cacheManager
}

export const getCacheManager = (): ProductionCacheManager | null => cacheManager

// ============================================================================
// React Hooks
// ============================================================================

// React hook for cache statistics
export const useCacheStatistics = () => {
  const store = useUnifiedStore()
  
  return {
    statistics: cacheMonitor.getStatistics(),
    performance: cacheMonitor.getPerformanceMetrics(),
    clearCache: store.clearCache,
    invalidateCache: store.invalidateCache,
    reset: cacheMonitor.reset
  }
}

export const useCache = <T>() => {
  const [stats, setStats] = useState<CacheStats | null>(null)

  useEffect(() => {
    const manager = getCacheManager()
    if (!manager) return

    const unsubscribe = manager.subscribe(setStats)
    setStats(manager.getStats())

    return unsubscribe
  }, [])

  const get = useCallback(async (key: string): Promise<T | null> => {
    const manager = getCacheManager()
    return manager ? await manager.get<T>(key) : null
  }, [])

  const set = useCallback(async (key: string, data: T, options?: any): Promise<void> => {
    const manager = getCacheManager()
    if (manager) {
      await manager.set(key, data, options)
    }
  }, [])

  const del = useCallback(async (key: string): Promise<boolean> => {
    const manager = getCacheManager()
    return manager ? await manager.delete(key) : false
  }, [])

  const clear = useCallback(async (): Promise<void> => {
    const manager = getCacheManager()
    if (manager) {
      await manager.clear()
    }
  }, [])

  return { get, set, delete: del, clear, stats }
}

// ============================================================================
// Cache Health Checker
// ============================================================================

export const checkCacheHealth = (): {
  status: 'healthy' | 'warning' | 'critical'
  issues: string[]
  recommendations: string[]
} => {
  const stats = cacheMonitor.getStatistics()
  const issues: string[] = []
  const recommendations: string[] = []
  
  // Check hit rate
  if (stats.hitRate < 0.3) {
    issues.push('Low cache hit rate')
    recommendations.push('Consider increasing cache TTL or preloading critical data')
  }
  
  // Check memory usage
  if (stats.memorySize > 1000) {
    issues.push('High memory cache usage')
    recommendations.push('Consider implementing cache size limits or LRU eviction')
  }
  
  // Check for cache imbalance
  const totalCacheSize = stats.memorySize + stats.localStorageSize + stats.indexedDBSize
  if (totalCacheSize === 0 && stats.totalRequests > 10) {
    issues.push('Cache not being utilized effectively')
    recommendations.push('Verify cache implementation and TTL settings')
  }
  
  let status: 'healthy' | 'warning' | 'critical' = 'healthy'
  if (issues.length > 2) {
    status = 'critical'
  } else if (issues.length > 0) {
    status = 'warning'
  }
  
  return { status, issues, recommendations }
}

// ============================================================================
// Development Debug Functions
// ============================================================================

export const debugCache = () => {
  const store = useUnifiedStore.getState()
  const stats = cacheMonitor.getStatistics()
  const performance = cacheMonitor.getPerformanceMetrics()
  const health = checkCacheHealth()
  
  console.group('🗄️ Cache Debug Information')
  console.log('Statistics:', stats)
  console.log('Performance:', performance)
  console.log('Health:', health)
  console.log('Memory Cache:', Array.from(store.memoryCache.keys()))
  console.log('LocalStorage Cache:', Array.from(store.localStorageCache.keys()))
  console.log('Pending Requests:', Array.from(store.pendingRequests.keys()))
  console.groupEnd()
}

// ============================================================================
// Default Configuration
// ============================================================================

export const defaultCacheConfig: CacheConfig = {
  enabled: true,
  version: '1.0.0',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  maxSize: 50 * 1024 * 1024, // 50MB
  compressionEnabled: true,
  encryptionEnabled: false,
  strategies: {
    memory: true,
    localStorage: true,
    indexedDB: true,
    serviceWorker: false
  }
}

export default {
  cacheMonitor,
  initializeCaching,
  getCacheManager,
  useCacheStatistics,
  useCache,
  checkCacheHealth,
  debugCache,
  defaultCacheConfig
}