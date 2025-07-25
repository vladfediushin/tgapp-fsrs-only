// Import Validation Test
// This file tests that all the restructured imports work correctly through compatibility exports

console.log('🧪 Starting import validation test...')

// Test core utilities
try {
  const { cacheMonitor, useCacheStatistics } = require('./cacheMonitor')
  const { getCacheManager } = require('./core/cache')
  console.log('✅ Core cache utilities imported successfully')
} catch (error) {
  console.error('❌ Core cache utilities import failed:', error)
}

try {
  const { useStoreMigration } = require('./storeMigration')
  const { createStorageManager } = require('./core/storage')
  console.log('✅ Core storage utilities imported successfully')
} catch (error) {
  console.error('❌ Core storage utilities import failed:', error)
}

// Test features utilities
try {
  const { calculateDailyGoal } = require('./dailyGoals')
  const { calculateCurrentStreak } = require('./streakUtils')
  console.log('✅ Features goal utilities imported successfully')
} catch (error) {
  console.error('❌ Features goal utilities import failed:', error)
}

try {
  const { loadStatsWithCache } = require('./statsSync')
  const { updateStatsOptimistically } = require('./statsSync')
  console.log('✅ Features sync utilities imported successfully')
} catch (error) {
  console.error('❌ Features sync utilities import failed:', error)
}

try {
  const { initializeOfflineSystem } = require('./offlineSystem')
  console.log('✅ Features offline utilities imported successfully')
} catch (error) {
  console.error('❌ Features offline utilities import failed:', error)
}

// Test UI utilities
try {
  const { getStreakText } = require('./pluralUtils')
  console.log('✅ UI formatting utilities imported successfully')
} catch (error) {
  console.error('❌ UI formatting utilities import failed:', error)
}

// Test optimization utilities
try {
  const { dynamicImport, createLazyComponent } = require('./dynamicImports')
  const { preloadCriticalDependencies } = require('./dynamicImports')
  console.log('✅ Optimization loading utilities imported successfully')
} catch (error) {
  console.error('❌ Optimization loading utilities import failed:', error)
}

try {
  const { optimizeAssets } = require('./assetOptimization')
  console.log('✅ Optimization asset utilities imported successfully')
} catch (error) {
  console.error('❌ Optimization asset utilities import failed:', error)
}

try {
  const { enableCompression } = require('./compressionOptimization')
  const { optimizeVendorBundles } = require('./vendorOptimization')
  console.log('✅ Optimization compression utilities imported successfully')
} catch (error) {
  console.error('❌ Optimization compression utilities import failed:', error)
}

// Test direct imports from new structure
try {
  const cacheUtils = require('./core/cache')
  const storageUtils = require('./core/storage')
  const fsrsUtils = require('./features/fsrs')
  const goalsUtils = require('./features/goals')
  const syncUtils = require('./features/sync')
  const offlineUtils = require('./features/offline')
  const statisticsUtils = require('./features/statistics')
  const formattingUtils = require('./ui/formatting')
  const responsiveUtils = require('./ui/responsive')
  const accessibilityUtils = require('./ui/accessibility')
  const assetsUtils = require('./optimization/assets')
  const loadingUtils = require('./optimization/loading')
  const compressionUtils = require('./optimization/compression')
  console.log('✅ Direct imports from new structure work correctly')
} catch (error) {
  console.error('❌ Direct imports from new structure failed:', error)
}

console.log('🏁 Import validation test completed')

export default {
  message: 'Import validation test completed - check console for results'
}