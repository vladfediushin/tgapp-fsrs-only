// Optimization utilities index - optimized for tree shaking
// Split exports by functionality to enable selective imports

// Core dynamic imports (most commonly used)
export {
  dynamicImport,
  clearImportCache,
  getCacheStats
} from './dynamicImports'

// React component lazy loading
export {
  createLazyComponent,
  createPreloadableLazyComponent,
  preloadComponents
} from './lazyComponents'

// Dependency loaders (lazy-loaded when needed)
export {
  loadI18n,
  loadChartComponents,
  loadRecharts,
  loadDatePicker,
  loadIcons,
  loadLucideIcons,
  loadValidation,
  loadFSRSStore,
  loadStatsStore,
  loadOfflineQueue,
  preloadCriticalDependencies
} from './dependencyLoaders'

// Resource preloading (from original loading.ts)
export {
  ResourcePreloader,
  getResourcePreloader
} from './loading'

// Progressive loading (from original loading.ts)
export {
  ProgressiveLoadingManager,
  getProgressiveLoader,
  useProgressiveLoading
} from './loading'

// React hooks (from original loading.ts)
export {
  useDynamicImport
} from './loading'

// Initialization (from original loading.ts)
export {
  initializeLoadingOptimization
} from './loading'