// Consolidated Service Worker Manager
// Production-ready PWA functionality with conditional debug features

export interface ServiceWorkerConfig {
  swUrl?: string
  scope?: string
  updateViaCache?: 'imports' | 'all' | 'none'
  enableAutoUpdate?: boolean
  updateCheckInterval?: number
  enableNotifications?: boolean
  enableBackgroundSync?: boolean
  enableDebug?: boolean
}

export interface ServiceWorkerState {
  isSupported: boolean
  isRegistered: boolean
  isInstalling: boolean
  isWaiting: boolean
  isActive: boolean
  hasUpdate: boolean
  registration: ServiceWorkerRegistration | null
  error: string | null
}

export interface PWAInstallState {
  canInstall: boolean
  isInstalled: boolean
  isStandalone: boolean
  installPrompt: BeforeInstallPromptEvent | null
  platform: 'ios' | 'android' | 'desktop' | 'unknown'
}

export interface ServiceWorkerMessage {
  type: string
  payload?: any
  timestamp?: number
}

// Debug interfaces (only available in development)
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
// Production Service Worker Manager
// ============================================================================

class ProductionServiceWorkerManager {
  private config: ServiceWorkerConfig
  private state: ServiceWorkerState
  private installState: PWAInstallState
  private listeners: Map<string, Array<(data: any) => void>> = new Map()
  private updateCheckTimer: number | null = null

  // Debug-only properties (conditionally initialized)
  private debugMetrics?: ServiceWorkerMetrics
  private debugErrors?: Array<any>
  private performanceObserver?: PerformanceObserver | null
  private networkChangeCount = 0
  private onlineStartTime = Date.now()
  private offlineStartTime = 0
  private totalOnlineTime = 0
  private totalOfflineTime = 0

  constructor(config: ServiceWorkerConfig = {}) {
    this.config = {
      swUrl: '/sw.js',
      scope: '/',
      updateViaCache: 'none',
      enableAutoUpdate: true,
      updateCheckInterval: 60000, // 1 minute
      enableNotifications: true,
      enableBackgroundSync: true,
      enableDebug: process.env.NODE_ENV === 'development',
      ...config
    }

    this.state = {
      isSupported: 'serviceWorker' in navigator,
      isRegistered: false,
      isInstalling: false,
      isWaiting: false,
      isActive: false,
      hasUpdate: false,
      registration: null,
      error: null
    }

    this.installState = {
      canInstall: false,
      isInstalled: false,
      isStandalone: this.isStandalone(),
      installPrompt: null,
      platform: this.detectPlatform()
    }

    this.setupEventListeners()

    // Initialize debug features only in development
    if (this.config.enableDebug) {
      this.initializeDebugFeatures()
    }
  }

  // ============================================================================
  // Core PWA API
  // ============================================================================

  async register(): Promise<ServiceWorkerRegistration | null> {
    if (!this.state.isSupported) {
      const error = 'Service Worker is not supported in this browser'
      this.setState({ error })
      throw new Error(error)
    }

    try {
      console.log('[SW Manager] Registering service worker...')
      
      const registration = await navigator.serviceWorker.register(
        this.config.swUrl!,
        {
          scope: this.config.scope,
          updateViaCache: this.config.updateViaCache
        }
      )

      this.setState({
        isRegistered: true,
        registration,
        error: null
      })

      this.setupRegistrationListeners(registration)
      
      if (this.config.enableAutoUpdate) {
        this.startUpdateCheck()
      }

      console.log('[SW Manager] Service worker registered successfully')
      this.emit('registered', registration)

      return registration

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed'
      this.setState({ error: errorMessage })
      console.error('[SW Manager] Service worker registration failed:', error)
      this.emit('error', error)
      
      // Log error for debug mode
      if (this.config.enableDebug) {
        this.logError('registration', errorMessage)
      }
      
      throw error
    }
  }

  async unregister(): Promise<boolean> {
    if (!this.state.registration) {
      return false
    }

    try {
      const result = await this.state.registration.unregister()
      
      if (result) {
        this.setState({
          isRegistered: false,
          isInstalling: false,
          isWaiting: false,
          isActive: false,
          hasUpdate: false,
          registration: null
        })
        
        this.stopUpdateCheck()
        console.log('[SW Manager] Service worker unregistered')
        this.emit('unregistered')
      }

      return result
    } catch (error) {
      console.error('[SW Manager] Failed to unregister service worker:', error)
      return false
    }
  }

  async update(): Promise<void> {
    if (!this.state.registration) {
      throw new Error('No service worker registration found')
    }

    try {
      console.log('[SW Manager] Checking for updates...')
      await this.state.registration.update()
      this.emit('updateCheck')
    } catch (error) {
      console.error('[SW Manager] Update check failed:', error)
      throw error
    }
  }

  async skipWaiting(): Promise<void> {
    if (!this.state.registration?.waiting) {
      return
    }

    try {
      this.postMessage({ type: 'SKIP_WAITING' })
      console.log('[SW Manager] Skip waiting requested')
    } catch (error) {
      console.error('[SW Manager] Skip waiting failed:', error)
      throw error
    }
  }

  // ============================================================================
  // PWA Installation
  // ============================================================================

  async installPWA(): Promise<boolean> {
    if (!this.installState.canInstall || !this.installState.installPrompt) {
      return false
    }

    try {
      console.log('[SW Manager] Showing install prompt...')
      
      const result = await this.installState.installPrompt.prompt()
      const { outcome } = await this.installState.installPrompt.userChoice

      console.log('[SW Manager] Install prompt result:', outcome)

      if (outcome === 'accepted') {
        this.setInstallState({
          canInstall: false,
          isInstalled: true,
          installPrompt: null
        })
        
        this.emit('installed')
        return true
      }

      return false
    } catch (error) {
      console.error('[SW Manager] PWA installation failed:', error)
      this.emit('installError', error)
      return false
    }
  }

  canInstallPWA(): boolean {
    return this.installState.canInstall && !this.installState.isInstalled
  }

  isInstalledPWA(): boolean {
    return this.installState.isInstalled || this.installState.isStandalone
  }

  // ============================================================================
  // Communication & Background Sync
  // ============================================================================

  postMessage(message: ServiceWorkerMessage): void {
    if (!this.state.registration?.active) {
      console.warn('[SW Manager] No active service worker to send message to')
      return
    }

    const messageWithTimestamp = {
      ...message,
      timestamp: Date.now()
    }

    this.state.registration.active.postMessage(messageWithTimestamp)
  }

  async registerBackgroundSync(tag: string): Promise<void> {
    if (!this.config.enableBackgroundSync) {
      console.warn('[SW Manager] Background sync is disabled')
      return
    }

    this.postMessage({
      type: 'REGISTER_BACKGROUND_SYNC',
      payload: { tag }
    })
  }

  // Cache management
  async clearCache(cacheName?: string): Promise<void> {
    this.postMessage({
      type: 'CLEAR_CACHE',
      payload: { cacheName }
    })
  }

  async cacheUrls(urls: string[]): Promise<void> {
    this.postMessage({
      type: 'CACHE_URLS',
      payload: { urls }
    })
  }

  async getCacheStatus(): Promise<void> {
    this.postMessage({ type: 'GET_CACHE_STATUS' })
  }

  // ============================================================================
  // Event System
  // ============================================================================

  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    
    this.listeners.get(event)!.push(callback)
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event)
      if (callbacks) {
        const index = callbacks.indexOf(callback)
        if (index > -1) {
          callbacks.splice(index, 1)
        }
      }
    }
  }

  off(event: string, callback?: (data: any) => void): void {
    if (!callback) {
      this.listeners.delete(event)
      return
    }

    const callbacks = this.listeners.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`[SW Manager] Error in event callback for ${event}:`, error)
        }
      })
    }
  }

  // ============================================================================
  // State Management
  // ============================================================================

  getState(): ServiceWorkerState {
    return { ...this.state }
  }

  getInstallState(): PWAInstallState {
    return { ...this.installState }
  }

  private setState(updates: Partial<ServiceWorkerState>): void {
    const prevState = { ...this.state }
    this.state = { ...this.state, ...updates }
    
    // Emit state change events
    if (prevState.isActive !== this.state.isActive && this.state.isActive) {
      this.emit('activated')
    }
    
    if (prevState.hasUpdate !== this.state.hasUpdate && this.state.hasUpdate) {
      this.emit('updateAvailable')
    }
    
    this.emit('stateChange', this.state)
  }

  private setInstallState(updates: Partial<PWAInstallState>): void {
    this.installState = { ...this.installState, ...updates }
    this.emit('installStateChange', this.installState)
  }

  // ============================================================================
  // Debug Features (Development Only)
  // ============================================================================

  private initializeDebugFeatures(): void {
    this.debugMetrics = {
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

    this.debugErrors = []
    this.setupPerformanceMonitoring()
    this.setupDebugConsoleCommands()
  }

  async getDebugInfo(): Promise<ServiceWorkerDebugInfo | null> {
    if (!this.config.enableDebug) {
      console.warn('[SW Manager] Debug features are disabled')
      return null
    }

    const registration = this.state.registration

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
        cacheHitRate: this.debugMetrics?.cacheStats.hitRate || 0,
        averageResponseTime: this.debugMetrics?.performanceStats.averageLoadTime || 0,
        totalRequests: this.debugMetrics?.cacheStats.requests || 0,
        failedRequests: this.debugErrors?.filter(e => e.type === 'fetch').length || 0
      },
      backgroundSync: await this.getBackgroundSyncInfo(),
      errors: this.debugErrors?.slice(-50) || [] // Last 50 errors
    }
  }

  getDebugMetrics(): ServiceWorkerMetrics | null {
    if (!this.config.enableDebug || !this.debugMetrics) {
      return null
    }
    return { ...this.debugMetrics }
  }

  private async getCacheInfo(): Promise<ServiceWorkerDebugInfo['caches']> {
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
    const registration = this.state.registration

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

  private setupPerformanceMonitoring(): void {
    if (!this.config.enableDebug || !('PerformanceObserver' in window)) {
      return
    }

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

  private updateLoadTimeMetrics(loadTime: number): void {
    if (!this.debugMetrics) return
    
    const current = this.debugMetrics.performanceStats.averageLoadTime
    this.debugMetrics.performanceStats.averageLoadTime = 
      current === 0 ? loadTime : (current + loadTime) / 2
  }

  private updateResourceMetrics(entry: PerformanceResourceTiming): void {
    if (!this.debugMetrics) return
    
    const responseTime = entry.responseEnd - entry.responseStart
    
    // Estimate if response came from cache (very fast response)
    if (responseTime < 10) {
      const current = this.debugMetrics.performanceStats.cacheResponseTime
      this.debugMetrics.performanceStats.cacheResponseTime = 
        current === 0 ? responseTime : (current + responseTime) / 2
    } else {
      const current = this.debugMetrics.performanceStats.networkResponseTime
      this.debugMetrics.performanceStats.networkResponseTime = 
        current === 0 ? responseTime : (current + responseTime) / 2
    }
  }

  private logError(type: string, message: string, stack?: string): void {
    if (!this.config.enableDebug || !this.debugErrors) return

    this.debugErrors.push({
      timestamp: Date.now(),
      type,
      message,
      stack
    })

    // Keep only last 100 errors
    if (this.debugErrors.length > 100) {
      this.debugErrors = this.debugErrors.slice(-100)
    }
  }

  private setupDebugConsoleCommands(): void {
    if (!this.config.enableDebug || typeof window === 'undefined') {
      return
    }

    (window as any).swDebug = {
      getInfo: () => this.getDebugInfo(),
      getMetrics: () => this.getDebugMetrics(),
      clearCache: (name?: string) => name ? this.clearSpecificCache(name) : this.clearAllCaches(),
      forceUpdate: () => this.update(),
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

  // Debug utility methods
  private async clearAllCaches(): Promise<void> {
    if (!('caches' in window)) {
      throw new Error('Cache API not supported')
    }

    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.map(name => caches.delete(name)))
    
    console.log('[SW Debug] All caches cleared')
  }

  private async clearSpecificCache(cacheName: string): Promise<void> {
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

  private async simulateOffline(duration: number = 10000): Promise<void> {
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

  private async testCachePerformance(): Promise<{
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

  private exportDebugData(): string {
    if (!this.config.enableDebug) {
      return JSON.stringify({ error: 'Debug mode disabled' })
    }

    const debugData = {
      timestamp: Date.now(),
      metrics: this.debugMetrics,
      errors: this.debugErrors,
      userAgent: navigator.userAgent,
      url: window.location.href
    }

    return JSON.stringify(debugData, null, 2)
  }

  private downloadDebugReport(): void {
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
  // Private Methods
  // ============================================================================

  private setupEventListeners(): void {
    // PWA install prompt
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault()
      
      this.setInstallState({
        canInstall: true,
        installPrompt: event as BeforeInstallPromptEvent
      })
      
      console.log('[SW Manager] PWA install prompt available')
      this.emit('installPromptAvailable')
    })

    // App installed
    window.addEventListener('appinstalled', () => {
      this.setInstallState({
        canInstall: false,
        isInstalled: true,
        installPrompt: null
      })
      
      console.log('[SW Manager] PWA installed')
      this.emit('installed')
    })

    // Service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleServiceWorkerMessage(event.data)
      })
    }

    // Debug-only event listeners
    if (this.config.enableDebug) {
      this.setupDebugEventListeners()
    }
  }

  private setupDebugEventListeners(): void {
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

    // Error handling
    window.addEventListener('error', (event) => {
      this.logError('javascript', event.message, event.error?.stack)
    })

    window.addEventListener('unhandledrejection', (event) => {
      this.logError('promise', event.reason?.message || 'Unhandled promise rejection')
    })
  }

  private updateNetworkMetrics(): void {
    if (!this.debugMetrics) return

    this.debugMetrics.networkStats = {
      onlineTime: this.totalOnlineTime + (this.onlineStartTime > 0 ? Date.now() - this.onlineStartTime : 0),
      offlineTime: this.totalOfflineTime + (this.offlineStartTime > 0 ? Date.now() - this.offlineStartTime : 0),
      connectionChanges: this.networkChangeCount
    }
  }

  private setupRegistrationListeners(registration: ServiceWorkerRegistration): void {
    // Installing
    if (registration.installing) {
      this.setState({ isInstalling: true })
      this.trackWorkerState(registration.installing, 'installing')
    }

    // Waiting
    if (registration.waiting) {
      this.setState({ isWaiting: true, hasUpdate: true })
    }

    // Active
    if (registration.active) {
      this.setState({ isActive: true })
    }

    // Update found
    registration.addEventListener('updatefound', () => {
      console.log('[SW Manager] Update found')
      const newWorker = registration.installing
      
      if (newWorker) {
        this.setState({ isInstalling: true })
        this.trackWorkerState(newWorker, 'installing')
        this.emit('updateFound')
      }
    })
  }

  private trackWorkerState(worker: ServiceWorker, initialState: string): void {
    worker.addEventListener('statechange', () => {
      console.log(`[SW Manager] Worker state changed: ${worker.state}`)
      
      switch (worker.state) {
        case 'installed':
          if (navigator.serviceWorker.controller) {
            // New update available
            this.setState({ 
              isInstalling: false, 
              isWaiting: true, 
              hasUpdate: true 
            })
            this.emit('updateAvailable')
          } else {
            // First install
            this.setState({ isInstalling: false })
            this.emit('installed')
          }
          break
          
        case 'activated':
          this.setState({ 
            isWaiting: false, 
            isActive: true, 
            hasUpdate: false 
          })
          this.emit('activated')
          break
          
        case 'redundant':
          this.emit('redundant')
          break
      }
    })
  }

  private handleServiceWorkerMessage(data: ServiceWorkerMessage): void {
    console.log('[SW Manager] Received message from SW:', data)
    
    switch (data.type) {
      case 'SW_ACTIVATED':
        this.emit('swActivated', data.payload)
        break
        
      case 'SYNC_OFFLINE_QUEUE':
        this.emit('syncOfflineQueue')
        break
        
      case 'CACHE_STATUS':
        this.emit('cacheStatus', data.payload)
        break
        
      case 'CACHE_STATS':
        if (this.config.enableDebug && this.debugMetrics) {
          this.debugMetrics.cacheStats = data.payload
        }
        this.emit('cacheStats', data.payload)
        break

      case 'SW_ERROR':
        if (this.config.enableDebug) {
          this.logError('service-worker', data.payload?.message, data.payload?.stack)
        }
        break
        
      default:
        this.emit('message', data)
    }
  }

  private startUpdateCheck(): void {
    if (this.updateCheckTimer) {
      return
    }

    this.updateCheckTimer = window.setInterval(() => {
      if (this.state.registration) {
        this.update().catch(console.error)
      }
    }, this.config.updateCheckInterval!)
  }

  private stopUpdateCheck(): void {
    if (this.updateCheckTimer) {
      clearInterval(this.updateCheckTimer)
      this.updateCheckTimer = null
    }
  }

  private isStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    )
  }

  private detectPlatform(): PWAInstallState['platform'] {
    const userAgent = navigator.userAgent.toLowerCase()
    
    if (/iphone|ipad|ipod/.test(userAgent)) {
      return 'ios'
    }
    
    if (/android/.test(userAgent)) {
      return 'android'
    }
    
    if (/windows|macintosh|linux/.test(userAgent)) {
      return 'desktop'
    }
    
    return 'unknown'
  }
}

// ============================================================================
// Global Service Worker Manager Instance
// ============================================================================

let swManager: ProductionServiceWorkerManager | null = null

export const initializeServiceWorker = (config?: ServiceWorkerConfig): ProductionServiceWorkerManager => {
  if (swManager) {
    console.warn('[SW Manager] Service worker manager already initialized')
    return swManager
  }

  swManager = new ProductionServiceWorkerManager(config)
  return swManager
}

export const getServiceWorkerManager = (): ProductionServiceWorkerManager | null => {
  return swManager
}

// ============================================================================
// React Hooks
// ============================================================================

import { useState, useEffect } from 'react'

export const useServiceWorker = (config?: ServiceWorkerConfig) => {
  const [manager] = useState(() => initializeServiceWorker(config))
  const [state, setState] = useState(manager.getState())
  const [installState, setInstallState] = useState(manager.getInstallState())

  useEffect(() => {
    const unsubscribeState = manager.on('stateChange', setState)
    const unsubscribeInstall = manager.on('installStateChange', setInstallState)

    // Auto-register on mount
    if (!state.isRegistered) {
      manager.register().catch(console.error)
    }

    return () => {
      unsubscribeState()
      unsubscribeInstall()
    }
  }, [manager])

  return {
    manager,
    state,
    installState,
    register: () => manager.register(),
    unregister: () => manager.unregister(),
    update: () => manager.update(),
    skipWaiting: () => manager.skipWaiting(),
    installPWA: () => manager.installPWA(),
    canInstall: manager.canInstallPWA(),
    isInstalled: manager.isInstalledPWA()
  }
}

export const usePWAInstall = () => {
  const manager = getServiceWorkerManager()
  const [installState, setInstallState] = useState(
    manager?.getInstallState() || {
      canInstall: false,
      isInstalled: false,
      isStandalone: false,
      installPrompt: null,
      platform: 'unknown' as const
    }
  )

  useEffect(() => {
    if (!manager) return

    const unsubscribe = manager.on('installStateChange', setInstallState)
    return unsubscribe
  }, [manager])

  return {
    ...installState,
    install: () => manager?.installPWA() || Promise.resolve(false)
  }
}

// Debug hook (only available in development)
export const useServiceWorkerDebug = () => {
  const [debugInfo, setDebugInfo] = useState<ServiceWorkerDebugInfo | null>(null)
  const [metrics, setMetrics] = useState<ServiceWorkerMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const manager = getServiceWorkerManager()
    
    if (!manager || process.env.NODE_ENV !== 'development') {
      setIsLoading(false)
      return
    }
    
    const updateDebugInfo = async () => {
      try {
        const info = await manager.getDebugInfo()
        const metricsData = manager.getDebugMetrics()
        setDebugInfo(info)
        setMetrics(metricsData)
      } catch (error) {
        console.error('[SW Debug Hook] Failed to get debug info:', error)
      } finally {
        setIsLoading(false)
      }
    }

    updateDebugInfo()
    
    // Update every 5 seconds in development
    const interval = setInterval(updateDebugInfo, 5000)
    
    return () => clearInterval(interval)
  }, [])

  return {
    debugInfo,
    metrics,
    isLoading,
    manager: getServiceWorkerManager(),
    refresh: async () => {
      const manager = getServiceWorkerManager()
      if (manager && process.env.NODE_ENV === 'development') {
        const info = await manager.getDebugInfo()
        const metricsData = manager.getDebugMetrics()
        setDebugInfo(info)
        setMetrics(metricsData)
      }
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export const isServiceWorkerSupported = (): boolean => {
  return 'serviceWorker' in navigator
}

export const isPWAInstalled = (): boolean => {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  )
}

export const canInstallPWA = (): boolean => {
  const manager = getServiceWorkerManager()
  return manager?.canInstallPWA() || false
}

// Debug utility functions (development only)
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

// BeforeInstallPromptEvent interface
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Backward compatibility exports
export { ProductionServiceWorkerManager as ServiceWorkerManager }
export default ProductionServiceWorkerManager