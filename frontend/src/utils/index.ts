// Main utils index - optimized for tree shaking
// Provides selective exports to enable better dead code elimination

// Core utilities (most commonly used)
export {
  getPerformanceMonitor,
  usePerformanceMetrics,
  initializeServiceWorker,
  useServiceWorker,
  type PerformanceMetrics,
  type ServiceWorkerConfig
} from './core'

// Core optimization utilities (most commonly used)
export {
  dynamicImport,
  createLazyComponent
} from './optimization'

// Dependency loaders (lazy-loaded when needed)
export {
  loadI18n,
  loadChartComponents,
  preloadCriticalDependencies
} from './optimization'

// Specific utility exports for better tree shaking
export { conflictManager, createCustomResolver, registerConflictResolver } from './conflictResolution'
export { QueueAnalyzer, QueueManager, QueueExporter } from './queueManagement'
export { initializeOfflineSystem, useOfflineSystem, offlineSystem } from './offlineSystem'

// Re-export compatibility layer
export { default as dynamicImports } from './dynamicImports'