// Service Worker Debugging and Monitoring Tools
// Provides comprehensive debugging capabilities for service worker and PWA functionality

import { getServiceWorkerManager } from '../serviceWorker'

export interface ServiceWorkerDebugInfo {
  registration: {
    scope: string
    updateViaCache: string
    installing: boolean
    waiting: boolean
    active: boolean
  } | null
  caches: {
    [cacheName: string]: {
      size: number
      entries: string[]
      totalSize?: number
    }
  }
  networkStatus: 'online' | 'offline'
  performance: {
    cacheHitRate: number
    averageResponseTime: number
    totalRequests: number
    failedRequests: number
  }
  backgroundSync: {
    registrations: string[]
    lastSync: number | null
  }
  errors: Array<{
    timestamp: number
    type: string
    message: string
    stack?: string
  }>
}

export interface ServiceWorkerMetrics {
  cacheStats: {
    hits: number
    misses: number
    requests: number
    hitRate: number
  }
  networkStats: {
    onlineTime: number
    offlineTime: number
    connectionChanges: number
  }
  performanceStats: {
    averageLoadTime: number
    cacheResponseTime: number
    networkResponseTime: number
  }
}

// ============================================================================
// Service Worker Debug Manager
// ============================================================================

class ServiceWorkerDebugManager {
  public metrics: ServiceWorkerMetrics
  private errors: Array<any> = []
  private performanceObserver: PerformanceObserver | null = null
  private networkChangeCount = 0
  private onlineStartTime = Date.now()
  private offlineStartTime = 0
  private totalOnlineTime = 0
  private totalOfflineTime = 0

  constructor() {
    this.metrics = {
      cacheStats: {
        hits: 0,
        misses: 0,
        requests: 0,
        hitRate: 0
      },
      networkStats: {
        onlineTime: 0,
        offlineTime: 0,
        connectionChanges: 0
      },
      performanceStats: {
        averageLoadTime: 0,
        cacheResponseTime: 0,
        networkResponseTime: 0
      }
    }

    this.setupEventListeners()
    this.setupPerformanceMonitoring()
  }

  // ============================================================================
  // Debug Information Collection
  // ============================================================================

  async getDebugInfo(): Promise<ServiceWorkerDebugInfo> {
    const swManager = getServiceWorkerManager()
    const registration = swManager?.getState().registration

    return {
      registration: registration ? {
        scope: registration.scope,
        updateViaCache: registration.updateViaCache,
        installing: !!registration.installing,
        waiting: !!registration.waiting,
        active: !!registration.active
      } : null,
      caches: await this.getCacheInfo(),
      networkStatus: navigator.onLine ? 'online' : 'offline',
      performance: {
        cacheHitRate: this.metrics.cacheStats.hitRate,
        averageResponseTime: this.metrics.performanceStats.averageLoadTime,
        totalRequests: this.metrics.cacheStats.requests,
        failedRequests: this.errors.filter(e => e.type === 'fetch').length
      },
      backgroundSync: await this.getBackgroundSyncInfo(),
      errors: this.errors.slice(-50) // Last 50 errors
    }
  }

  async getCacheInfo(): Promise<ServiceWorkerDebugInfo['caches']> {
    if (!('caches' in window)) {
      return {}
    }

    const cacheInfo: ServiceWorkerDebugInfo['caches'] = {}
    
    try {
      const cacheNames = await caches.keys()
      
      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName)
        const requests = await cache.keys()
        
        cacheInfo[cacheName] = {
          size: requests.length,
          entries: requests.map(req => req.url).slice(0, 20), // First 20 entries
          totalSize: await this.estimateCacheSize(cache, [...requests])
        }
      }
    } catch (error) {
      console.error('[SW Debug] Failed to get cache info:', error)
    }

    return cacheInfo
  }

  private async estimateCacheSize(cache: Cache, requests: Request[]): Promise<number> {
    let totalSize = 0
    
    try {
      // Sample a few responses to estimate total size
      const sampleSize = Math.min(5, requests.length)
      const sampleRequests = requests.slice(0, sampleSize)
      
      for (const request of sampleRequests) {
        const response = await cache.match(request)
        if (response && response.body) {
          const reader = response.body.getReader()
          let size = 0
          
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              size += value?.length || 0
            }
          } finally {
            reader.releaseLock()
          }
          
          totalSize += size
        }
      }
      
      // Estimate total size based on sample
      if (sampleSize > 0) {
        totalSize = (totalSize / sampleSize) * requests.length
      }
    } catch (error) {
      console.warn('[SW Debug] Failed to estimate cache size:', error)
    }

    return totalSize
  }

  private async getBackgroundSyncInfo(): Promise<ServiceWorkerDebugInfo['backgroundSync']> {
    const swManager = getServiceWorkerManager()
    const registration = swManager?.getState().registration

    if (!registration || !('sync' in registration)) {
      return {
        registrations: [],
        lastSync: null
      }
    }

    try {
      // Note: There's no standard way to get sync registrations
      // This is a placeholder for potential future API
      return {
        registrations: ['offline-queue-sync', 'periodic-background-sync'],
        lastSync: Date.now() - 300000 // 5 minutes ago (example)
      }
    } catch (error) {
      return {
        registrations: [],
        lastSync: null
      }
    }
  }

  // ============================================================================
  // Performance Monitoring
  // ============================================================================

  private setupPerformanceMonitoring(): void {
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        
        for (const entry of entries) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming
            this.updateLoadTimeMetrics(navEntry.loadEventEnd - navEntry.loadEventStart)
          }
          
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming
            this.updateResourceMetrics(resourceEntry)
          }
        }
      })

      try {
        this.performanceObserver.observe({ entryTypes: ['navigation', 'resource'] })
      } catch (error) {
        console.warn('[SW Debug] Performance observer not supported:', error)
      }
    }
  }

  private updateLoadTimeMetrics(loadTime: number): void {
    const current = this.metrics.performanceStats.averageLoadTime
    this.metrics.performanceStats.averageLoadTime = 
      current === 0 ? loadTime : (current + loadTime) / 2
  }

  private updateResourceMetrics(entry: PerformanceResourceTiming): void {
    const responseTime = entry.responseEnd - entry.responseStart
    
    // Estimate if response came from cache (very fast response)
    if (responseTime < 10) {
      const current = this.metrics.performanceStats.cacheResponseTime
      this.metrics.performanceStats.cacheResponseTime = 
        current === 0 ? responseTime : (current + responseTime) / 2
    } else {
      const current = this.metrics.performanceStats.networkResponseTime
      this.metrics.performanceStats.networkResponseTime = 
        current === 0 ? responseTime : (current + responseTime) / 2
    }
  }

  // ============================================================================
  // Event Listeners
  // ============================================================================

  private setupEventListeners(): void {
    // Network status changes
    window.addEventListener('online', () => {
      this.networkChangeCount++
      this.onlineStartTime = Date.now()
      
      if (this.offlineStartTime > 0) {
        this.totalOfflineTime += Date.now() - this.offlineStartTime
        this.offlineStartTime = 0
      }
      
      this.updateNetworkMetrics()
    })

    window.addEventListener('offline', () => {
      this.networkChangeCount++
      this.offlineStartTime = Date.now()
      
      if (this.onlineStartTime > 0) {
        this.totalOnlineTime += Date.now() - this.onlineStartTime
        this.onlineStartTime = 0
      }
      
      this.updateNetworkMetrics()
    })

    // Service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleServiceWorkerMessage(event.data)
      })
    }

    // Error handling
    window.addEventListener('error', (event) => {
      this.logError('javascript', event.message, event.error?.stack)
    })

    window.addEventListener('unhandledrejection', (event) => {
      this.logError('promise', event.reason?.message || 'Unhandled promise rejection')
    })
  }

  private updateNetworkMetrics(): void {
    this.metrics.networkStats = {
      onlineTime: this.totalOnlineTime + (this.onlineStartTime > 0 ? Date.now() - this.onlineStartTime : 0),
      offlineTime: this.totalOfflineTime + (this.offlineStartTime > 0 ? Date.now() - this.offlineStartTime : 0),
      connectionChanges: this.networkChangeCount
    }
  }

  private handleServiceWorkerMessage(data: any): void {
    switch (data.type) {
      case 'CACHE_STATS':
        this.metrics.cacheStats = data.stats
        break
        
      case 'SW_ERROR':
        this.logError('service-worker', data.message, data.stack)
        break
        
      default:
        // Log unknown messages for debugging
        console.log('[SW Debug] Unknown SW message:', data)
    }
  }

  private logError(type: string, message: string, stack?: string): void {
    this.errors.push({
      timestamp: Date.now(),
      type,
      message,
      stack
    })

    // Keep only last 100 errors
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-100)
    }
  }

  // ============================================================================
  // Debug Actions
  // ============================================================================

  async clearAllCaches(): Promise<void> {
    if (!('caches' in window)) {
      throw new Error('Cache API not supported')
    }

    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.map(name => caches.delete(name)))
    
    console.log('[SW Debug] All caches cleared')
  }

  async clearSpecificCache(cacheName: string): Promise<void> {
    if (!('caches' in window)) {
      throw new Error('Cache API not supported')
    }

    const deleted = await caches.delete(cacheName)
    
    if (deleted) {
      console.log(`[SW Debug] Cache '${cacheName}' cleared`)
    } else {
      console.warn(`[SW Debug] Cache '${cacheName}' not found`)
    }
  }

  async forceServiceWorkerUpdate(): Promise<void> {
    const swManager = getServiceWorkerManager()
    
    if (!swManager) {
      throw new Error('Service worker manager not available')
    }

    await swManager.update()
    console.log('[SW Debug] Service worker update forced')
  }

  async simulateOffline(duration: number = 10000): Promise<void> {
    console.log(`[SW Debug] Simulating offline for ${duration}ms`)
    
    // Override navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    })

    // Dispatch offline event
    window.dispatchEvent(new Event('offline'))

    setTimeout(() => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      })
      
      window.dispatchEvent(new Event('online'))
      console.log('[SW Debug] Offline simulation ended')
    }, duration)
  }

  async testCachePerformance(): Promise<{
    cacheTime: number
    networkTime: number
    improvement: number
  }> {
    const testUrl = '/api/health'
    
    // Test cache performance
    const cacheStart = performance.now()
    try {
      const cache = await caches.open('api-cache')
      await cache.match(testUrl)
    } catch (error) {
      console.warn('[SW Debug] Cache test failed:', error)
    }
    const cacheTime = performance.now() - cacheStart

    // Test network performance
    const networkStart = performance.now()
    try {
      await fetch(testUrl, { cache: 'no-cache' })
    } catch (error) {
      console.warn('[SW Debug] Network test failed:', error)
    }
    const networkTime = performance.now() - networkStart

    const improvement = networkTime > 0 ? ((networkTime - cacheTime) / networkTime) * 100 : 0

    return {
      cacheTime,
      networkTime,
      improvement
    }
  }

  // ============================================================================
  // Export/Import Debug Data
  // ============================================================================

  exportDebugData(): string {
    const debugData = {
      timestamp: Date.now(),
      metrics: this.metrics,
      errors: this.errors,
      userAgent: navigator.userAgent,
      url: window.location.href
    }

    return JSON.stringify(debugData, null, 2)
  }

  downloadDebugReport(): void {
    const data = this.exportDebugData()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `sw-debug-report-${new Date().toISOString().slice(0, 19)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    
    URL.revokeObjectURL(url)
  }

  // ============================================================================
  // Console Commands
  // ============================================================================

  setupConsoleCommands(): void {
    if (typeof window !== 'undefined') {
      (window as any).swDebug = {
        getInfo: () => this.getDebugInfo(),
        getMetrics: () => this.metrics,
        clearCache: (name?: string) => name ? this.clearSpecificCache(name) : this.clearAllCaches(),
        forceUpdate: () => this.forceServiceWorkerUpdate(),
        simulateOffline: (duration?: number) => this.simulateOffline(duration),
        testPerformance: () => this.testCachePerformance(),
        exportData: () => this.exportDebugData(),
        downloadReport: () => this.downloadDebugReport(),
        help: () => {
          console.log(`
Service Worker Debug Commands:
- swDebug.getInfo() - Get comprehensive debug information
- swDebug.getMetrics() - Get performance metrics
- swDebug.clearCache(name?) - Clear specific cache or all caches
- swDebug.forceUpdate() - Force service worker update
- swDebug.simulateOffline(duration?) - Simulate offline mode
- swDebug.testPerformance() - Test cache vs network performance
- swDebug.exportData() - Export debug data as JSON
- swDebug.downloadReport() - Download debug report
- swDebug.help() - Show this help
          `)
        }
      }

      console.log('🔧 Service Worker debug tools available at window.swDebug')
      console.log('Type swDebug.help() for available commands')
    }
  }
}

// ============================================================================
// Global Debug Manager Instance
// ============================================================================

let debugManager: ServiceWorkerDebugManager | null = null

export const initializeServiceWorkerDebug = (): ServiceWorkerDebugManager => {
  if (debugManager) {
    return debugManager
  }

  debugManager = new ServiceWorkerDebugManager()
  debugManager.setupConsoleCommands()
  
  return debugManager
}

export const getServiceWorkerDebugManager = (): ServiceWorkerDebugManager | null => {
  return debugManager
}

// ============================================================================
// React Hook for Debug Information
// ============================================================================

import { useState, useEffect } from 'react'

export const useServiceWorkerDebug = () => {
  const [debugInfo, setDebugInfo] = useState<ServiceWorkerDebugInfo | null>(null)
  const [metrics, setMetrics] = useState<ServiceWorkerMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const manager = initializeServiceWorkerDebug()
    
    const updateDebugInfo = async () => {
      try {
        const info = await manager.getDebugInfo()
        setDebugInfo(info)
        setMetrics(manager.metrics)
      } catch (error) {
        console.error('[SW Debug Hook] Failed to get debug info:', error)
      } finally {
        setIsLoading(false)
      }
    }

    updateDebugInfo()
    
    // Update every 5 seconds
    const interval = setInterval(updateDebugInfo, 5000)
    
    return () => clearInterval(interval)
  }, [])

  return {
    debugInfo,
    metrics,
    isLoading,
    manager: debugManager,
    refresh: async () => {
      if (debugManager) {
        const info = await debugManager.getDebugInfo()
        setDebugInfo(info)
        setMetrics(debugManager.metrics)
      }
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
  return `${(ms / 3600000).toFixed(1)}h`
}

export const getHealthStatus = (debugInfo: ServiceWorkerDebugInfo): 'healthy' | 'warning' | 'error' => {
  if (!debugInfo.registration) return 'error'
  if (debugInfo.errors.length > 10) return 'warning'
  if (debugInfo.performance.cacheHitRate < 0.5) return 'warning'
  return 'healthy'
}

export default ServiceWorkerDebugManager