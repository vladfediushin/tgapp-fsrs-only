// Dynamic Import Core - Split from loading.ts for better tree shaking
// Contains only the core dynamic import functionality

export interface DynamicImportOptions {
  retries?: number
  retryDelay?: number
  preload?: boolean
  priority?: 'high' | 'medium' | 'low'
}

interface ImportCache {
  [key: string]: {
    promise: Promise<any>
    component?: any
    error?: Error
    timestamp: number
  }
}

const importCache: ImportCache = {}

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