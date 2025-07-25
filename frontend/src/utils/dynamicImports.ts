// Compatibility export for dynamicImports.ts
// This file maintains backward compatibility while redirecting to the new consolidated structure
// @deprecated - Use imports from './optimization/loading' instead

export {
  dynamicImport,
  createLazyComponent,
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
  initializeLoadingOptimization
} from './optimization/loading'

// Alias for backward compatibility
export { initializeLoadingOptimization as initializeDynamicImports } from './optimization/loading'

// Re-export everything as default for backward compatibility
import loadingUtils from './optimization/loading'
export default loadingUtils