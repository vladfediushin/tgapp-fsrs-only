// Loading and Dynamic Import Optimization
// Consolidated from dynamicImports.ts, resourcePreloader.ts, and progressiveLoading.ts
// Provides lazy loading, resource preloading, and progressive loading utilities

import { ComponentType, lazy, LazyExoticComponent } from 'react'
import { useState, useEffect } from 'react'

// ============================================================================
// Dynamic Import Types
// ============================================================================

interface DynamicImportOptions {
  retries?: number
  retryDelay?: number
  preload?: boolean
  priority?: 'high' | 'medium' | 'low'
}

interface ImportCache {
  [key: string]: {
    promise: Promise<any>
    component?: ComponentType<any>
    error?: Error
    timestamp: number
  }
}

interface PreloadConfig {
  enablePreloading: boolean
  preloadDelay: number
  maxConcurrentPreloads: number
  preloadOnIdle: boolean
  preloadOnHover: boolean
  preloadThreshold: number
  enableIntersectionObserver: boolean
}

interface ProgressiveLoadingConfig {
  enableProgressiveLoading: boolean
  chunkSize: number
  loadingDelay: number
  priorityThreshold: number
  enableIntersectionObserver: boolean
  rootMargin: string
}

interface ResourcePreloadOptions {
  as: 'script' | 'style' | 'image' | 'font' | 'fetch' | 'document'
  crossOrigin?: 'anonymous' | 'use-credentials'
  type?: string
  media?: string
  priority?: 'high' | 'medium' | 'low'
}

// ============================================================================
// Import Cache and State Management
// ============================================================================

const importCache: ImportCache = {}
const preloadQueue: Array<() => Promise<any>> = []
let isPreloading = false

// ============================================================================
// Core Dynamic Import Functions
// ============================================================================

/**
 * Enhanced dynamic import with retry logic and caching
 */
export const dynamicImport = async <T = any>(
  importFn: () => Promise<T>,
  key: string,
  options: DynamicImportOptions = {}
): Promise<T> => {
  const { retries = 3, retryDelay = 1000 } = options

  // Check cache first
  if (importCache[key]) {
    if (importCache[key].component) {
      return importCache[key].component as T
    }
    if (importCache[key].error) {
      throw importCache[key].error
    }
    return importCache[key].promise
  }

  // Create new import with retry logic
  const importWithRetry = async (attempt = 1): Promise<T> => {
    try {
      console.log(`[DynamicImport] Loading ${key} (attempt ${attempt})`)
      const startTime = performance.now()
      
      const module = await importFn()
      
      const loadTime = performance.now() - startTime
      console.log(`[DynamicImport] Loaded ${key} in ${loadTime.toFixed(2)}ms`)
      
      // Cache successful import
      importCache[key] = {
        promise: Promise.resolve(module),
        component: module,
        timestamp: Date.now()
      }
      
      return module
    } catch (error) {
      console.error(`[DynamicImport] Failed to load ${key} (attempt ${attempt}):`, error)
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
        return importWithRetry(attempt + 1)
      }
      
      // Cache error
      importCache[key] = {
        promise: Promise.reject(error),
        error: error as Error,
        timestamp: Date.now()
      }
      
      throw error
    }
  }

  const promise = importWithRetry()
  
  // Cache promise immediately
  importCache[key] = {
    promise,
    timestamp: Date.now()
  }

  return promise
}

// ============================================================================
// React Component Lazy Loading
// ============================================================================

/**
 * Create lazy-loaded React component with enhanced error handling
 */
export const createLazyComponent = <T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName: string,
  options: DynamicImportOptions = {}
): LazyExoticComponent<T> => {
  return lazy(() => 
    dynamicImport(importFn, `component-${componentName}`, options)
      .then(module => {
        // Ensure we have a default export
        if (!module.default) {
          throw new Error(`Component ${componentName} does not have a default export`)
        }
        return module
      })
  )
}

// ============================================================================
// Heavy Dependencies Dynamic Loading
// ============================================================================

/**
 * Lazy load i18next and related dependencies
 */
export const loadI18n = () => dynamicImport(
  () => import('../../i18n'),
  'i18n',
  { priority: 'medium' }
)

/**
 * Lazy load chart components
 */
export const loadChartComponents = () => dynamicImport(
  () => import('react-circular-progressbar'),
  'charts',
  { priority: 'low' }
)

/**
 * Lazy load date picker
 */
export const loadDatePicker = () => dynamicImport(
  () => import('react-datepicker'),
  'datepicker',
  { priority: 'low' }
)

/**
 * Lazy load icons
 */
export const loadIcons = () => dynamicImport(
  () => import('react-icons'),
  'react-icons',
  { priority: 'medium' }
)

export const loadLucideIcons = () => dynamicImport(
  () => import('lucide-react'),
  'lucide-react',
  { priority: 'medium' }
)

/**
 * Lazy load validation library
 */
export const loadValidation = () => dynamicImport(
  () => import('zod'),
  'zod',
  { priority: 'high' }
)

// ============================================================================
// Store Modules Dynamic Loading
// ============================================================================

/**
 * Lazy load FSRS store
 */
export const loadFSRSStore = () => dynamicImport(
  () => import('../../store/fsrs'),
  'store-fsrs',
  { priority: 'high' }
)

/**
 * Lazy load stats store
 */
export const loadStatsStore = () => dynamicImport(
  () => import('../../store/stats'),
  'store-stats',
  { priority: 'medium' }
)

/**
 * Lazy load offline queue
 */
export const loadOfflineQueue = () => dynamicImport(
  () => import('../../store/offlineQueue'),
  'store-offline',
  { priority: 'high' }
)

// ============================================================================
// Resource Preloader Class
// ============================================================================

export class ResourcePreloader {
  private config: PreloadConfig
  private preloadedResources: Set<string> = new Set()
  private intersectionObserver?: IntersectionObserver
  private idleCallback?: number

  constructor(config: Partial<PreloadConfig> = {}) {
    this.config = {
      enablePreloading: true,
      preloadDelay: 2000,
      maxConcurrentPreloads: 3,
      preloadOnIdle: true,
      preloadOnHover: true,
      preloadThreshold: 0.1,
      enableIntersectionObserver: true,
      ...config
    }

    this.initialize()
  }

  private initialize(): void {
    if (!this.config.enablePreloading || typeof window === 'undefined') return

    // Setup intersection observer for viewport-based preloading
    if (this.config.enableIntersectionObserver && 'IntersectionObserver' in window) {
      this.setupIntersectionObserver()
    }

    // Setup idle preloading
    if (this.config.preloadOnIdle && 'requestIdleCallback' in window) {
      this.setupIdlePreloading()
    }

    // Setup hover preloading
    if (this.config.preloadOnHover) {
      this.setupHoverPreloading()
    }
  }

  private setupIntersectionObserver(): void {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement
            const preloadUrl = element.dataset.preload
            if (preloadUrl) {
              this.preloadResource(preloadUrl)
              this.intersectionObserver?.unobserve(element)
            }
          }
        })
      },
      { threshold: this.config.preloadThreshold }
    )
  }

  private setupIdlePreloading(): void {
    const scheduleIdlePreload = () => {
      this.idleCallback = (window as any).requestIdleCallback(() => {
        this.processPreloadQueue()
        scheduleIdlePreload() // Schedule next idle preload
      })
    }

    setTimeout(scheduleIdlePreload, this.config.preloadDelay)
  }

  private setupHoverPreloading(): void {
    document.addEventListener('mouseover', (event) => {
      const target = event.target as HTMLElement
      const preloadUrl = target.dataset.preload || target.getAttribute('href')
      
      if (preloadUrl && !this.preloadedResources.has(preloadUrl)) {
        // Delay preload slightly to avoid preloading on quick mouse movements
        setTimeout(() => {
          if (target.matches(':hover')) {
            this.preloadResource(preloadUrl)
          }
        }, 100)
      }
    })
  }

  /**
   * Preload a single resource
   */
  preloadResource(url: string, options: ResourcePreloadOptions = { as: 'fetch' }): Promise<void> {
    if (this.preloadedResources.has(url)) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.href = url
      link.as = options.as

      if (options.crossOrigin) {
        link.crossOrigin = options.crossOrigin
      }

      if (options.type) {
        link.type = options.type
      }

      if (options.media) {
        link.media = options.media
      }

      link.onload = () => {
        this.preloadedResources.add(url)
        console.log(`[ResourcePreloader] Preloaded: ${url}`)
        resolve()
      }

      link.onerror = () => {
        console.warn(`[ResourcePreloader] Failed to preload: ${url}`)
        reject(new Error(`Failed to preload ${url}`))
      }

      document.head.appendChild(link)
    })
  }

  /**
   * Preload multiple resources
   */
  async preloadResources(
    resources: Array<{ url: string; options?: ResourcePreloadOptions }>,
    maxConcurrent: number = this.config.maxConcurrentPreloads
  ): Promise<void> {
    const chunks = this.chunkArray(resources, maxConcurrent)
    
    for (const chunk of chunks) {
      await Promise.allSettled(
        chunk.map(({ url, options }) => this.preloadResource(url, options))
      )
    }
  }

  /**
   * Preload critical assets
   */
  preloadCriticalAssets(assets: string[]): void {
    assets.forEach(asset => {
      let options: ResourcePreloadOptions = { as: 'fetch' }

      if (asset.match(/\.(jpg|jpeg|png|webp|avif)$/i)) {
        options.as = 'image'
      } else if (asset.match(/\.(woff|woff2|ttf)$/i)) {
        options.as = 'font'
        options.crossOrigin = 'anonymous'
      } else if (asset.match(/\.css$/i)) {
        options.as = 'style'
      } else if (asset.match(/\.js$/i)) {
        options.as = 'script'
      }

      this.preloadResource(asset, options)
    })
  }

  /**
   * Observe element for preloading
   */
  observeElement(element: HTMLElement): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.observe(element)
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  private processPreloadQueue(): void {
    // Process any queued preload operations
    if (preloadQueue.length > 0) {
      const batch = preloadQueue.splice(0, this.config.maxConcurrentPreloads)
      Promise.allSettled(batch.map(fn => fn()))
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect()
    }

    if (this.idleCallback) {
      (window as any).cancelIdleCallback(this.idleCallback)
    }

    this.preloadedResources.clear()
  }
}

// ============================================================================
// Progressive Loading Manager
// ============================================================================

export class ProgressiveLoadingManager {
  private config: ProgressiveLoadingConfig
  private loadingQueue: Array<() => Promise<any>> = []
  private isLoading = false

  constructor(config: Partial<ProgressiveLoadingConfig> = {}) {
    this.config = {
      enableProgressiveLoading: true,
      chunkSize: 5,
      loadingDelay: 100,
      priorityThreshold: 3,
      enableIntersectionObserver: true,
      rootMargin: '50px',
      ...config
    }
  }

  /**
   * Add item to progressive loading queue
   */
  addToQueue(loadFn: () => Promise<any>, priority: number = 1): void {
    if (!this.config.enableProgressiveLoading) {
      loadFn() // Load immediately if progressive loading is disabled
      return
    }

    // Insert based on priority
    const insertIndex = this.loadingQueue.findIndex((_, index) => {
      return priority > this.config.priorityThreshold && index < this.config.priorityThreshold
    })

    if (insertIndex >= 0) {
      this.loadingQueue.splice(insertIndex, 0, loadFn)
    } else {
      this.loadingQueue.push(loadFn)
    }

    this.processQueue()
  }

  /**
   * Process loading queue progressively
   */
  private async processQueue(): Promise<void> {
    if (this.isLoading || this.loadingQueue.length === 0) return

    this.isLoading = true

    try {
      while (this.loadingQueue.length > 0) {
        const chunk = this.loadingQueue.splice(0, this.config.chunkSize)
        
        // Load chunk items in parallel
        await Promise.allSettled(chunk.map(fn => fn()))
        
        // Delay between chunks to prevent blocking
        if (this.loadingQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.config.loadingDelay))
        }
      }
    } finally {
      this.isLoading = false
    }
  }

  /**
   * Load content progressively based on viewport visibility
   */
  loadOnVisible(
    element: HTMLElement,
    loadFn: () => Promise<any>,
    options: { threshold?: number; rootMargin?: string } = {}
  ): () => void {
    if (!this.config.enableIntersectionObserver || !('IntersectionObserver' in window)) {
      loadFn() // Fallback to immediate loading
      return () => {}
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            loadFn()
            observer.unobserve(element)
          }
        })
      },
      {
        threshold: options.threshold || 0.1,
        rootMargin: options.rootMargin || this.config.rootMargin
      }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    queueLength: number
    isLoading: boolean
    chunkSize: number
  } {
    return {
      queueLength: this.loadingQueue.length,
      isLoading: this.isLoading,
      chunkSize: this.config.chunkSize
    }
  }
}

// ============================================================================
// Preloading System
// ============================================================================

/**
 * Add import to preload queue
 */
export const queuePreload = (
  importFn: () => Promise<any>,
  key: string,
  priority: 'high' | 'medium' | 'low' = 'medium'
) => {
  const preloadFn = () => dynamicImport(importFn, key, { priority, preload: true })
  
  // Insert based on priority
  if (priority === 'high') {
    preloadQueue.unshift(preloadFn)
  } else {
    preloadQueue.push(preloadFn)
  }
}

/**
 * Process preload queue
 */
export const processPreloadQueue = async (maxConcurrent = 3) => {
  if (isPreloading || preloadQueue.length === 0) return
  
  isPreloading = true
  console.log(`[DynamicImport] Processing preload queue (${preloadQueue.length} items)`)
  
  try {
    while (preloadQueue.length > 0) {
      const batch = preloadQueue.splice(0, maxConcurrent)
      await Promise.allSettled(batch.map(fn => fn()))
      
      // Small delay between batches to avoid overwhelming the browser
      if (preloadQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
  } catch (error) {
    console.error('[DynamicImport] Error processing preload queue:', error)
  } finally {
    isPreloading = false
    console.log('[DynamicImport] Preload queue processing complete')
  }
}

/**
 * Preload critical dependencies
 */
export const preloadCriticalDependencies = () => {
  // Queue high-priority dependencies
  queuePreload(() => import('../../store/fsrs'), 'store-fsrs', 'high')
  queuePreload(() => import('../../store/offlineQueue'), 'store-offline', 'high')
  queuePreload(() => import('../core/serviceWorker'), 'utils-service-worker', 'high')
  queuePreload(() => import('zod'), 'zod', 'high')
  
  // Queue medium-priority dependencies
  queuePreload(() => import('../../i18n'), 'i18n', 'medium')
  queuePreload(() => import('../../store/stats'), 'store-stats', 'medium')
  queuePreload(() => import('../core/performance'), 'utils-performance', 'medium')
  queuePreload(() => import('lucide-react'), 'lucide-react', 'medium')
  
  // Queue low-priority dependencies
  queuePreload(() => import('react-circular-progressbar'), 'charts', 'low')
  queuePreload(() => import('react-datepicker'), 'datepicker', 'low')
  queuePreload(() => import('react-icons'), 'react-icons', 'low')
  
  // Start processing after a delay
  setTimeout(() => processPreloadQueue(), 2000)
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Clear import cache
 */
export const clearImportCache = (olderThan?: number) => {
  const cutoff = olderThan ? Date.now() - olderThan : 0
  
  Object.keys(importCache).forEach(key => {
    if (importCache[key].timestamp < cutoff) {
      delete importCache[key]
    }
  })
}

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
  const stats = {
    totalEntries: Object.keys(importCache).length,
    successfulImports: 0,
    failedImports: 0,
    pendingImports: 0,
    cacheSize: 0
  }
  
  Object.values(importCache).forEach(entry => {
    if (entry.component) stats.successfulImports++
    else if (entry.error) stats.failedImports++
    else stats.pendingImports++
  })
  
  stats.cacheSize = JSON.stringify(importCache).length
  
  return stats
}

// ============================================================================
// React Hooks
// ============================================================================

/**
 * Hook for dynamic imports with loading state
 */
export const useDynamicImport = <T = any>(
  importFn: () => Promise<T>,
  key: string,
  options: DynamicImportOptions = {}
) => {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  useEffect(() => {
    let mounted = true
    
    dynamicImport(importFn, key, options)
      .then(result => {
        if (mounted) {
          setData(result)
          setLoading(false)
        }
      })
      .catch(err => {
        if (mounted) {
          setError(err)
          setLoading(false)
        }
      })
    
    return () => {
      mounted = false
    }
  }, [key])
  
  return { data, loading, error }
}

/**
 * Hook for progressive loading
 */
export const useProgressiveLoading = (
  items: Array<() => Promise<any>>,
  chunkSize: number = 3
) => {
  const [loadedCount, setLoadedCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const loadNext = async () => {
    if (loading || loadedCount >= items.length) return

    setLoading(true)
    setError(null)

    try {
      const chunk = items.slice(loadedCount, loadedCount + chunkSize)
      await Promise.allSettled(chunk.map(fn => fn()))
      setLoadedCount(prev => prev + chunk.length)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }

  return {
    loadedCount,
    totalCount: items.length,
    loading,
    error,
    loadNext,
    hasMore: loadedCount < items.length,
    progress: (loadedCount / items.length) * 100
  }
}

// ============================================================================
// Global Instances
// ============================================================================

let resourcePreloader: ResourcePreloader | null = null
let progressiveLoader: ProgressiveLoadingManager | null = null

export const getResourcePreloader = (): ResourcePreloader => {
  if (!resourcePreloader) {
    resourcePreloader = new ResourcePreloader()
  }
  return resourcePreloader
}

export const getProgressiveLoader = (): ProgressiveLoadingManager => {
  if (!progressiveLoader) {
    progressiveLoader = new ProgressiveLoadingManager()
  }
  return progressiveLoader
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize loading optimization system
 */
export const initializeLoadingOptimization = (
  preloadConfig?: Partial<PreloadConfig>,
  progressiveConfig?: Partial<ProgressiveLoadingConfig>
) => {
  console.log('[LoadingOptimization] Initializing loading optimization system')
  
  // Initialize preloader
  resourcePreloader = new ResourcePreloader(preloadConfig)
  
  // Initialize progressive loader
  progressiveLoader = new ProgressiveLoadingManager(progressiveConfig)
  
  // Clear old cache entries (older than 1 hour)
  clearImportCache(60 * 60 * 1000)
  
  // Start preloading critical dependencies
  preloadCriticalDependencies()
  
  // Set up periodic cache cleanup
  setInterval(() => {
    clearImportCache(60 * 60 * 1000) // Clear entries older than 1 hour
  }, 30 * 60 * 1000) // Every 30 minutes
  
  console.log('[LoadingOptimization] Loading optimization system initialized')
}

export default {
  dynamicImport,
  createLazyComponent,
  ResourcePreloader,
  ProgressiveLoadingManager,
  getResourcePreloader,
  getProgressiveLoader,
  loadI18n,
  loadChartComponents,
  loadDatePicker,
  loadIcons,
  loadLucideIcons,
  loadValidation,
  loadFSRSStore,
  loadStatsStore,
  loadOfflineQueue,
  preloadCriticalDependencies,
  processPreloadQueue,
  clearImportCache,
  getCacheStats,
  useDynamicImport,
  useProgressiveLoading,
  initializeLoadingOptimization
}