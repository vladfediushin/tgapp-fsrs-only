# Import Mapping for Phase 2.4 - Utils Directory Restructuring

## Current Import Patterns Found

Based on codebase analysis, the following imports need to be updated:

### Core Utilities
- `../utils/cacheMonitor` → `../utils/core/cache`
- `../utils/storeMigration` → `../utils/core/storage`
- `../utils/core/performance` → `../utils/core/performance` (already correct)
- `../utils/core/performanceInit` → `../utils/core/performanceInit` (already correct)
- `../utils/serviceWorker` → `../utils/core/serviceWorker`

### Features Utilities
- `../utils/dailyGoals` → `../utils/features/goals`
- `../utils/streakUtils` → `../utils/features/goals`
- `../utils/statsSync` → `../utils/features/sync`
- `../utils/offlineSystem` → `../utils/features/offline`

### UI Utilities
- `../utils/pluralUtils` → `../utils/ui/formatting`

### Optimization Utilities
- `../utils/dynamicImports` → `../utils/optimization/loading`
- `../utils/resourcePreloader` → `../utils/optimization/loading`

### Other Utilities
- `../utils/conflictResolution` → `../utils/features/offline` (consolidated into offline.ts)
- `../utils/queueManagement` → `../utils/features/offline` (consolidated into offline.ts)

## Files to Update

### Components Directory
- `src/components/PerformanceDashboard.tsx`
  - `usePerformanceMetrics, usePerformanceBudgets` from `../utils/core/performance` ✓ (already correct)
  - `getResourcePreloader` from `../utils/resourcePreloader` → `../utils/optimization/loading`
  - `getCacheStats` from `../utils/dynamicImports` → `../utils/optimization/loading`

- `src/components/PWAInstallPrompt.tsx`
  - `usePWAInstall` from `../utils/serviceWorker` → `../utils/core/serviceWorker`

### Pages Directory
- `src/pages/Home-Unified.tsx`
  - `useStoreMigration` from `../utils/storeMigration` → `../utils/core/storage`
  - `calculateDailyGoal` from `../utils/dailyGoals` → `../utils/features/goals`
  - `getLast7LocalDates, calculateCurrentStreak` from `../utils/streakUtils` → `../utils/features/goals`
  - `getStreakText` from `../utils/pluralUtils` → `../utils/ui/formatting`

- `src/pages/Profile.tsx`
  - `loadStatsWithCache` from `../utils/statsSync` → `../utils/features/sync`
  - `calculateDailyGoal` from `../utils/dailyGoals` → `../utils/features/goals`

- `src/pages/Results.tsx`
  - `backgroundSyncStats` from `../utils/statsSync` → `../utils/features/sync`

- `src/pages/Repeat(1).tsx`
  - `updateStatsOptimistically` from `../utils/statsSync` → `../utils/features/sync`

### Store Directory
- `src/store/stateCoordinator.ts`
  - `cacheMonitor` from `../utils/cacheMonitor` → `../utils/core/cache`
  - `storeMigration` from `../utils/storeMigration` → `../utils/core/storage`

### API Directory
- `src/api/offlineSync.ts`
  - `conflictManager` from `../utils/conflictResolution` → `../utils/features/offline`

### Main Application Files
- `src/App.tsx`
  - `createLazyComponent` from `./utils/dynamicImports` → `./utils/optimization/loading`
  - `useRoutePreloader` from `./utils/resourcePreloader` → `./utils/optimization/loading`
  - `usePerformanceMetrics` from `./utils/core/performance` ✓ (already correct)

- `src/main.tsx`
  - `initializePerformanceSystems` from `./utils/core/performanceInit` ✓ (already correct)

### Examples Directory
- `src/examples/OfflineIntegrationExample.tsx`
  - `initializeOfflineSystem, useOfflineSystem, offlineSystem` from `../utils/offlineSystem` → `../utils/features/offline`
  - `useQueueAnalytics, useQueueHealth` from `../utils/queueManagement` → `../utils/features/offline`

## Implementation Strategy

1. **Start with Core Utilities**: Update cache and storage imports first
2. **Update Features**: Goals, sync, and offline system imports
3. **Update UI Utilities**: Formatting imports
4. **Update Optimization**: Loading and dynamic import utilities
5. **Verify TypeScript compilation** after each major group
6. **Test functionality** to ensure no regressions

## Risk Mitigation

- Update imports systematically, one file at a time
- Verify TypeScript compilation after each update
- Test key functionality after major updates
- Keep compatibility exports until all imports are updated
- Have rollback plan ready if issues arise