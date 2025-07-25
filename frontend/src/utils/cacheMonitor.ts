// Compatibility export for cacheMonitor.ts
// This file maintains backward compatibility while redirecting to the new consolidated structure
// @deprecated - Use imports from './core/cache' instead

export {
  cacheMonitor,
  useCacheStatistics,
  checkCacheHealth,
  debugCache,
  type CacheStatistics,
  type CachePerformanceMetrics
} from './core/cache'

// Re-export everything as default for backward compatibility
import cacheUtils from './core/cache'
export default cacheUtils