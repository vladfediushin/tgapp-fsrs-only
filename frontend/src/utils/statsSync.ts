// Compatibility export for statsSync.ts
// This file maintains backward compatibility while redirecting to the new consolidated structure
// @deprecated - Use imports from './features/sync' instead

export {
  backgroundSyncStats,
  loadStatsWithCache,
  updateStatsOptimistically,
  shouldRefreshStats
} from './features/sync'

// Re-export everything as default for backward compatibility
import syncUtils from './features/sync'
export default syncUtils
