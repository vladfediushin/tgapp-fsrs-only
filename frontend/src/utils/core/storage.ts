// Core Storage Management System
// Consolidated from storeMigration.ts and other storage utilities
// Provides unified storage management, migration helpers, and persistence coordination

import { useUnifiedStore, useUnifiedActions } from '../../store/unified'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface StorageConfig {
  enableLocalStorage: boolean
  enableIndexedDB: boolean
  enableSessionStorage: boolean
  storageVersion: string
  migrationEnabled: boolean
  compressionEnabled: boolean
  encryptionEnabled: boolean
  maxStorageSize: number
  cleanupInterval: number
}

export interface StorageEntry<T = any> {
  key: string
  value: T
  timestamp: number
  expiry?: number
  version: string
  compressed: boolean
  encrypted: boolean
  metadata: Record<string, any>
}

export interface MigrationStatus {
  totalComponents: number
  migratedComponents: string[]
  pendingComponents: string[]
  migrationProgress: number
}

export interface StorageMetrics {
  localStorageUsage: number
  sessionStorageUsage: number
  indexedDBUsage: number
  totalEntries: number
  compressionRatio: number
  lastCleanup: number
}

// ============================================================================
// Store Migration Helper Class
// ============================================================================

export class StoreMigrationHelper {
  private static instance: StoreMigrationHelper
  private migrationFlags: Map<string, boolean> = new Map()

  static getInstance(): StoreMigrationHelper {
    if (!StoreMigrationHelper.instance) {
      StoreMigrationHelper.instance = new StoreMigrationHelper()
    }
    return StoreMigrationHelper.instance
  }

  // Enable unified store for specific component
  enableUnifiedStore(componentName: string): void {
    this.migrationFlags.set(componentName, true)
    console.log(`🔄 Unified store enabled for ${componentName}`)
  }

  // Check if component should use unified store
  shouldUseUnifiedStore(componentName: string): boolean {
    return this.migrationFlags.get(componentName) || false
  }

  // Preload critical data for a component
  async preloadComponentData(componentName: string, userId: string): Promise<void> {
    if (!this.shouldUseUnifiedStore(componentName)) return

    const actions = useUnifiedActions()
    const store = useUnifiedStore.getState()
    
    console.log(`📦 Preloading data for ${componentName}`)
    
    try {
      // Load critical data based on component needs
      switch (componentName) {
        case 'Home':
          await actions.preloadCriticalData(
            userId, 
            store.settings.examCountry, 
            store.settings.examLanguage
          )
          break
        
        case 'Statistics':
          await Promise.allSettled([
            actions.loadUserStats(userId),
            actions.loadDailyProgress(userId),
            actions.loadStreakDays(userId)
          ])
          break
          
        case 'Topics':
          await actions.loadTopics(store.settings.examCountry, store.settings.examLanguage)
          break
          
        default:
          console.warn(`No preload strategy defined for ${componentName}`)
      }
    } catch (error) {
      console.error(`Failed to preload data for ${componentName}:`, error)
    }
  }

  // Get migration status report
  getMigrationStatus(): MigrationStatus {
    const allComponents = ['Home', 'Statistics', 'Topics', 'Profile', 'Repeat', 'Settings']
    const migratedComponents = allComponents.filter(comp => this.shouldUseUnifiedStore(comp))
    const pendingComponents = allComponents.filter(comp => !this.shouldUseUnifiedStore(comp))
    
    return {
      totalComponents: allComponents.length,
      migratedComponents,
      pendingComponents,
      migrationProgress: (migratedComponents.length / allComponents.length) * 100
    }
  }
}

// ============================================================================
// Storage Manager Class
// ============================================================================

export class StorageManager {
  private config: StorageConfig
  private compressionWorker?: Worker
  private encryptionKey?: CryptoKey
  private cleanupInterval?: number

  constructor(config: StorageConfig) {
    this.config = config
    this.initialize()
  }

  private async initialize(): Promise<void> {
    // Initialize compression if enabled
    if (this.config.compressionEnabled) {
      await this.initializeCompression()
    }

    // Initialize encryption if enabled
    if (this.config.encryptionEnabled) {
      await this.initializeEncryption()
    }

    // Setup periodic cleanup
    if (this.config.cleanupInterval > 0) {
      this.cleanupInterval = window.setInterval(
        () => this.cleanup(),
        this.config.cleanupInterval
      )
    }

    // Migrate existing data if needed
    if (this.config.migrationEnabled) {
      await this.migrateExistingData()
    }
  }

  private async initializeCompression(): Promise<void> {
    try {
      const workerCode = `
        self.onmessage = function(e) {
          const { action, data, id } = e.data;
          
          if (action === 'compress') {
            try {
              // Simple compression - in production use CompressionStream
              const compressed = JSON.stringify(data);
              self.postMessage({ id, result: compressed, compressed: true });
            } catch (error) {
              self.postMessage({ id, error: error.message });
            }
          } else if (action === 'decompress') {
            try {
              const decompressed = JSON.parse(data);
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
      console.warn('Storage compression worker initialization failed:', error)
      this.config.compressionEnabled = false
    }
  }

  private async initializeEncryption(): Promise<void> {
    try {
      const keyData = localStorage.getItem('storage_encryption_key')
      
      if (keyData) {
        const keyBuffer = new Uint8Array(JSON.parse(keyData))
        this.encryptionKey = await crypto.subtle.importKey(
          'raw',
          keyBuffer,
          { name: 'AES-GCM' },
          false,
          ['encrypt', 'decrypt']
        )
      } else {
        this.encryptionKey = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        )
        
        const keyBuffer = await crypto.subtle.exportKey('raw', this.encryptionKey)
        localStorage.setItem('storage_encryption_key', JSON.stringify(Array.from(new Uint8Array(keyBuffer))))
      }
    } catch (error) {
      console.warn('Storage encryption initialization failed:', error)
      this.config.encryptionEnabled = false
    }
  }

  private async migrateExistingData(): Promise<void> {
    try {
      // Check for data from previous versions
      const currentVersion = this.config.storageVersion
      const storedVersion = localStorage.getItem('storage_version')
      
      if (storedVersion && storedVersion !== currentVersion) {
        console.log(`🔄 Migrating storage from version ${storedVersion} to ${currentVersion}`)
        
        // Perform version-specific migrations
        await this.performVersionMigration(storedVersion, currentVersion)
        
        // Update version
        localStorage.setItem('storage_version', currentVersion)
        console.log('✅ Storage migration completed')
      } else if (!storedVersion) {
        // First time setup
        localStorage.setItem('storage_version', currentVersion)
      }
    } catch (error) {
      console.error('Storage migration failed:', error)
    }
  }

  private async performVersionMigration(fromVersion: string, toVersion: string): Promise<void> {
    // Version-specific migration logic would go here
    // For now, we'll just log the migration
    console.log(`Migrating storage data from ${fromVersion} to ${toVersion}`)
    
    // Example: migrate old cache format to new format
    if (fromVersion === '1.0.0' && toVersion === '1.1.0') {
      // Migrate old cache entries
      const oldCacheData = localStorage.getItem('old_cache_format')
      if (oldCacheData) {
        try {
          const oldEntries = JSON.parse(oldCacheData)
          // Convert to new format and store
          for (const entry of oldEntries) {
            await this.set(`migrated_${entry.key}`, entry.value, {
              metadata: { migrated: true, originalVersion: fromVersion }
            })
          }
          localStorage.removeItem('old_cache_format')
        } catch (error) {
          console.warn('Failed to migrate old cache data:', error)
        }
      }
    }
  }

  // ============================================================================
  // Storage Operations
  // ============================================================================

  async get<T>(key: string, storageType: 'localStorage' | 'sessionStorage' | 'indexedDB' = 'localStorage'): Promise<T | null> {
    try {
      let rawData: string | null = null

      switch (storageType) {
        case 'localStorage':
          if (!this.config.enableLocalStorage) return null
          rawData = localStorage.getItem(this.getVersionedKey(key))
          break
        
        case 'sessionStorage':
          if (!this.config.enableSessionStorage) return null
          rawData = sessionStorage.getItem(this.getVersionedKey(key))
          break
        
        case 'indexedDB':
          if (!this.config.enableIndexedDB) return null
          return await this.getFromIndexedDB<T>(key)
      }

      if (!rawData) return null

      const entry: StorageEntry<T> = JSON.parse(rawData)
      
      // Check expiry
      if (entry.expiry && entry.expiry < Date.now()) {
        await this.delete(key, storageType)
        return null
      }

      let value = entry.value

      // Decrypt if needed
      if (entry.encrypted && this.encryptionKey) {
        value = await this.decrypt(value as any)
      }

      // Decompress if needed
      if (entry.compressed && this.compressionWorker) {
        value = await this.decompress(value)
      }

      return value
    } catch (error) {
      console.warn(`Storage get error for key ${key}:`, error)
      return null
    }
  }

  async set<T>(
    key: string, 
    value: T, 
    options: {
      storageType?: 'localStorage' | 'sessionStorage' | 'indexedDB'
      ttl?: number
      compress?: boolean
      encrypt?: boolean
      metadata?: Record<string, any>
    } = {}
  ): Promise<void> {
    try {
      const {
        storageType = 'localStorage',
        ttl,
        compress = this.config.compressionEnabled,
        encrypt = this.config.encryptionEnabled,
        metadata = {}
      } = options

      let processedValue = value
      let compressed = false
      let encrypted = false

      // Compress if enabled
      if (compress && this.compressionWorker) {
        try {
          processedValue = await this.compress(processedValue)
          compressed = true
        } catch (error) {
          console.warn('Compression failed:', error)
        }
      }

      // Encrypt if enabled
      if (encrypt && this.encryptionKey) {
        try {
          processedValue = await this.encrypt(processedValue) as T
          encrypted = true
        } catch (error) {
          console.warn('Encryption failed:', error)
        }
      }

      const entry: StorageEntry<T> = {
        key,
        value: processedValue,
        timestamp: Date.now(),
        expiry: ttl ? Date.now() + ttl : undefined,
        version: this.config.storageVersion,
        compressed,
        encrypted,
        metadata
      }

      const serializedEntry = JSON.stringify(entry)

      // Check storage quota
      if (this.config.maxStorageSize > 0) {
        const currentUsage = await this.getStorageUsage(storageType)
        const entrySize = new Blob([serializedEntry]).size
        
        if (currentUsage + entrySize > this.config.maxStorageSize) {
          await this.freeUpSpace(storageType, entrySize)
        }
      }

      switch (storageType) {
        case 'localStorage':
          if (!this.config.enableLocalStorage) return
          localStorage.setItem(this.getVersionedKey(key), serializedEntry)
          break
        
        case 'sessionStorage':
          if (!this.config.enableSessionStorage) return
          sessionStorage.setItem(this.getVersionedKey(key), serializedEntry)
          break
        
        case 'indexedDB':
          if (!this.config.enableIndexedDB) return
          await this.setToIndexedDB(key, entry)
          break
      }
    } catch (error) {
      console.warn(`Storage set error for key ${key}:`, error)
    }
  }

  async delete(key: string, storageType: 'localStorage' | 'sessionStorage' | 'indexedDB' = 'localStorage'): Promise<boolean> {
    try {
      switch (storageType) {
        case 'localStorage':
          if (!this.config.enableLocalStorage) return false
          localStorage.removeItem(this.getVersionedKey(key))
          return true
        
        case 'sessionStorage':
          if (!this.config.enableSessionStorage) return false
          sessionStorage.removeItem(this.getVersionedKey(key))
          return true
        
        case 'indexedDB':
          if (!this.config.enableIndexedDB) return false
          return await this.deleteFromIndexedDB(key)
      }
    } catch (error) {
      console.warn(`Storage delete error for key ${key}:`, error)
      return false
    }
  }

  async clear(storageType?: 'localStorage' | 'sessionStorage' | 'indexedDB'): Promise<void> {
    try {
      if (!storageType || storageType === 'localStorage') {
        if (this.config.enableLocalStorage) {
          // Clear only versioned keys
          const keysToRemove = Object.keys(localStorage).filter(key => 
            key.startsWith(`${this.config.storageVersion}_`)
          )
          keysToRemove.forEach(key => localStorage.removeItem(key))
        }
      }

      if (!storageType || storageType === 'sessionStorage') {
        if (this.config.enableSessionStorage) {
          const keysToRemove = Object.keys(sessionStorage).filter(key => 
            key.startsWith(`${this.config.storageVersion}_`)
          )
          keysToRemove.forEach(key => sessionStorage.removeItem(key))
        }
      }

      if (!storageType || storageType === 'indexedDB') {
        if (this.config.enableIndexedDB) {
          await this.clearIndexedDB()
        }
      }
    } catch (error) {
      console.warn('Storage clear error:', error)
    }
  }

  // ============================================================================
  // IndexedDB Operations
  // ============================================================================

  private async getFromIndexedDB<T>(key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(`storage_${this.config.storageVersion}`, 1)
      
      request.onerror = () => reject(request.error)
      
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['storage'], 'readonly')
        const store = transaction.objectStore('storage')
        const getRequest = store.get(key)
        
        getRequest.onsuccess = () => {
          const entry = getRequest.result
          resolve(entry ? entry.value : null)
        }
        
        getRequest.onerror = () => reject(getRequest.error)
      }
      
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('storage')) {
          db.createObjectStore('storage', { keyPath: 'key' })
        }
      }
    })
  }

  private async setToIndexedDB<T>(key: string, entry: StorageEntry<T>): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(`storage_${this.config.storageVersion}`, 1)
      
      request.onerror = () => reject(request.error)
      
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['storage'], 'readwrite')
        const store = transaction.objectStore('storage')
        
        const putRequest = store.put(entry)
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(putRequest.error)
      }
    })
  }

  private async deleteFromIndexedDB(key: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(`storage_${this.config.storageVersion}`, 1)
      
      request.onerror = () => reject(request.error)
      
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['storage'], 'readwrite')
        const store = transaction.objectStore('storage')
        
        const deleteRequest = store.delete(key)
        deleteRequest.onsuccess = () => resolve(true)
        deleteRequest.onerror = () => reject(deleteRequest.error)
      }
    })
  }

  private async clearIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(`storage_${this.config.storageVersion}`, 1)
      
      request.onerror = () => reject(request.error)
      
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['storage'], 'readwrite')
        const store = transaction.objectStore('storage')
        
        const clearRequest = store.clear()
        clearRequest.onsuccess = () => resolve()
        clearRequest.onerror = () => reject(clearRequest.error)
      }
    })
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private getVersionedKey(key: string): string {
    return `${this.config.storageVersion}_${key}`
  }

  private async compress(data: any): Promise<any> {
    if (!this.compressionWorker) return data

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
      
      setTimeout(() => {
        this.compressionWorker!.removeEventListener('message', handleMessage)
        reject(new Error('Compression timeout'))
      }, 5000)
    })
  }

  private async decompress(data: any): Promise<any> {
    if (!this.compressionWorker) return data

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

  private async getStorageUsage(storageType: 'localStorage' | 'sessionStorage' | 'indexedDB'): Promise<number> {
    try {
      switch (storageType) {
        case 'localStorage':
          return Object.keys(localStorage)
            .filter(key => key.startsWith(`${this.config.storageVersion}_`))
            .reduce((total, key) => total + (localStorage.getItem(key)?.length || 0), 0)
        
        case 'sessionStorage':
          return Object.keys(sessionStorage)
            .filter(key => key.startsWith(`${this.config.storageVersion}_`))
            .reduce((total, key) => total + (sessionStorage.getItem(key)?.length || 0), 0)
        
        case 'indexedDB':
          // Estimate IndexedDB usage (would need more complex implementation for exact size)
          return 0
        
        default:
          return 0
      }
    } catch (error) {
      console.warn('Failed to calculate storage usage:', error)
      return 0
    }
  }

  private async freeUpSpace(storageType: 'localStorage' | 'sessionStorage' | 'indexedDB', requiredSpace: number): Promise<void> {
    // Simple LRU eviction based on timestamp
    try {
      const storage = storageType === 'localStorage' ? localStorage : sessionStorage
      const versionPrefix = `${this.config.storageVersion}_`
      
      const entries = Object.keys(storage)
        .filter(key => key.startsWith(versionPrefix))
        .map(key => {
          try {
            const data = storage.getItem(key)
            if (data) {
              const entry = JSON.parse(data)
              return { key, timestamp: entry.timestamp, size: data.length }
            }
          } catch (error) {
            // Invalid entry, mark for removal
            return { key, timestamp: 0, size: 0 }
          }
          return null
        })
        .filter(Boolean)
        .sort((a, b) => a!.timestamp - b!.timestamp) // Oldest first

      let freedSpace = 0
      for (const entry of entries) {
        if (entry && freedSpace < requiredSpace) {
          storage.removeItem(entry.key)
          freedSpace += entry.size
        } else {
          break
        }
      }
    } catch (error) {
      console.warn('Failed to free up storage space:', error)
    }
  }

  private cleanup(): void {
    const now = Date.now()
    
    // Cleanup localStorage
    if (this.config.enableLocalStorage) {
      this.cleanupStorage(localStorage, now)
    }
    
    // Cleanup sessionStorage
    if (this.config.enableSessionStorage) {
      this.cleanupStorage(sessionStorage, now)
    }
    
    // IndexedDB cleanup would be more complex and is omitted for brevity
  }

  private cleanupStorage(storage: Storage, now: number): void {
    const versionPrefix = `${this.config.storageVersion}_`
    const keysToRemove: string[] = []
    
    Object.keys(storage).forEach(key => {
      if (key.startsWith(versionPrefix)) {
        try {
          const data = storage.getItem(key)
          if (data) {
            const entry = JSON.parse(data)
            if (entry.expiry && entry.expiry < now) {
              keysToRemove.push(key)
            }
          }
        } catch (error) {
          // Invalid entry, mark for removal
          keysToRemove.push(key)
        }
      }
    })
    
    keysToRemove.forEach(key => storage.removeItem(key))
    
    if (keysToRemove.length > 0) {
      console.log(`🧹 Cleaned up ${keysToRemove.length} expired storage entries`)
    }
  }

  // ============================================================================
  // Metrics and Monitoring
  // ============================================================================

  async getMetrics(): Promise<StorageMetrics> {
    const localStorageUsage = this.config.enableLocalStorage ? await this.getStorageUsage('localStorage') : 0
    const sessionStorageUsage = this.config.enableSessionStorage ? await this.getStorageUsage('sessionStorage') : 0
    const indexedDBUsage = this.config.enableIndexedDB ? await this.getStorageUsage('indexedDB') : 0
    
    const totalEntries = Object.keys(localStorage).filter(key => 
      key.startsWith(`${this.config.storageVersion}_`)
    ).length + Object.keys(sessionStorage).filter(key => 
      key.startsWith(`${this.config.storageVersion}_`)
    ).length

    return {
      localStorageUsage,
      sessionStorageUsage,
      indexedDBUsage,
      totalEntries,
      compressionRatio: 0.7, // Placeholder
      lastCleanup: Date.now()
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    
    if (this.compressionWorker) {
      this.compressionWorker.terminate()
    }
  }
}

// ============================================================================
// Global Instances
// ============================================================================

export const storeMigration = StoreMigrationHelper.getInstance()

let storageManager: StorageManager | null = null

// ============================================================================
// Public API Functions
// ============================================================================

export const initializeStorage = (config: StorageConfig): StorageManager => {
  if (!storageManager) {
    storageManager = new StorageManager(config)
  }
  return storageManager
}

export const getStorageManager = (): StorageManager | null => storageManager

// ============================================================================
// React Hooks
// ============================================================================

export const useStoreMigration = (componentName: string) => {
  const shouldUseUnified = storeMigration.shouldUseUnifiedStore(componentName)
  
  return {
    shouldUseUnified,
    enableUnified: () => storeMigration.enableUnifiedStore(componentName),
    preloadData: (userId: string) => storeMigration.preloadComponentData(componentName, userId)
  }
}

export const createCompatibilityLayer = (componentName: string) => {
  const migration = useStoreMigration(componentName)
  
  if (migration.shouldUseUnified) {
    return {
      useStore: useUnifiedStore,
      useActions: useUnifiedActions,
      isUnified: true
    }
  } else {
    return {
      useStore: null,
      useActions: null,
      isUnified: false
    }
  }
}

// ============================================================================
// Default Configuration
// ============================================================================

export const defaultStorageConfig: StorageConfig = {
  enableLocalStorage: true,
  enableIndexedDB: true,
  enableSessionStorage: true,
  storageVersion: '1.0.0',
  migrationEnabled: true,
  compressionEnabled: true,
  encryptionEnabled: false,
  maxStorageSize: 10 * 1024 * 1024, // 10MB
  cleanupInterval: 60 * 60 * 1000 // 1 hour
}

// Auto-enable unified store for specific components
const AUTO_MIGRATE_COMPONENTS = ['Home']
AUTO_MIGRATE_COMPONENTS.forEach(component => {
  storeMigration.enableUnifiedStore(component)
})

export default {
  StoreMigrationHelper,
  StorageManager,
  storeMigration,
  initializeStorage,
  getStorageManager,
  useStoreMigration,
  createCompatibilityLayer,
  defaultStorageConfig
}