// Core utilities index - optimized for tree shaking
// Only export what's actually needed to enable better dead code elimination

// Performance utilities
export {
  getPerformanceMonitor,
  usePerformanceMetrics,
  usePerformanceBudgets,
  getConsolidatedPerformanceMonitor,
  type PerformanceMetrics,
  type PerformanceBudget,
  type BudgetViolation,
  type PerformanceInsights
} from './performance'

// Service worker utilities
export {
  initializeServiceWorker,
  getServiceWorkerManager,
  useServiceWorker,
  usePWAInstall,
  isServiceWorkerSupported,
  isPWAInstalled,
  canInstallPWA,
  type ServiceWorkerConfig,
  type ServiceWorkerState,
  type PWAInstallState
} from './serviceWorker'

// Cache utilities
export {
  getCacheManager,
  initializeCaching,
  useCacheStatistics,
  useCache,
  type CacheConfig,
  type CacheEntry,
  type CacheStats
} from './cache'

// Storage utilities
export {
  getStorageManager,
  initializeStorage,
  useStoreMigration,
  createCompatibilityLayer,
  type StorageConfig,
  type StorageEntry,
  type StorageMetrics
} from './storage'

// Performance initialization (consolidated)
export {
  initializePerformanceSystems,
  getInitializationStatus,
  reinitializeFailedSystems,
  type PerformanceInitConfig,
  type InitializationResult
} from './performanceInit'