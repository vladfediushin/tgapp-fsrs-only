// Compatibility export for storeMigration.ts
// This file maintains backward compatibility while redirecting to the new consolidated structure
// @deprecated - Use imports from './core/storage' instead

export {
  StoreMigrationHelper,
  storeMigration,
  useStoreMigration,
  createCompatibilityLayer,
  type MigrationStatus
} from './core/storage'

// Re-export everything as default for backward compatibility
import storageUtils from './core/storage'
export default storageUtils