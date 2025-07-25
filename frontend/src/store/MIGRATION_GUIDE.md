# Migration Guide: Legacy Stores → Unified Store

## Overview

This guide provides step-by-step instructions for migrating components from the legacy store system (session.ts, fsrs.ts, stats.ts) to the new unified store architecture.

## Migration Strategy

### Phase 1: Gradual Migration (Recommended)
- Use the migration helper to enable unified store per component
- Maintain backward compatibility during transition
- Test each component individually before full rollout

### Phase 2: Complete Migration
- Replace all legacy store imports with unified store hooks
- Remove legacy store files
- Update all components to use unified patterns

## Component Migration Steps

### Step 1: Import Migration Helper

```typescript
// Add to component imports
import { useStoreMigration } from '../utils/storeMigration'
```

### Step 2: Enable Unified Store

```typescript
const MyComponent = () => {
  const migration = useStoreMigration('MyComponent')
  
  useEffect(() => {
    migration.enableUnified()
  }, [])
  
  // Component logic...
}
```

### Step 3: Replace Legacy Hooks

#### Before (Legacy Session Store):
```typescript
import { useSession } from '../store/session'

const MyComponent = () => {
  const { 
    userId, 
    examCountry, 
    examLanguage, 
    setExamCountry,
    setExamLanguage 
  } = useSession()
}
```

#### After (Unified Store):
```typescript
import { 
  useUnifiedUser, 
  useUnifiedSettings, 
  useUnifiedActions 
} from '../store/unified'

const MyComponent = () => {
  const user = useUnifiedUser()
  const settings = useUnifiedSettings()
  const actions = useUnifiedActions()
  
  // Access data
  const userId = user?.id
  const examCountry = settings.examCountry
  const examLanguage = settings.examLanguage
  
  // Update data
  const handleCountryChange = (country: string) => {
    actions.updateSettings({ examCountry: country })
  }
}
```

### Step 4: Replace FSRS Store Usage

#### Before (Legacy FSRS Store):
```typescript
import { useFSRS } from '../store/fsrs'

const MyComponent = () => {
  const { 
    userStats, 
    loadUserStats,
    updateCardState 
  } = useFSRS()
  
  useEffect(() => {
    loadUserStats(userId)
  }, [userId])
}
```

#### After (Unified Store):
```typescript
import { 
  useUnifiedFSRSStats, 
  useUnifiedActions,
  useUnifiedLoading 
} from '../store/unified'

const MyComponent = () => {
  const fsrsStats = useUnifiedFSRSStats()
  const actions = useUnifiedActions()
  const loading = useUnifiedLoading()
  
  useEffect(() => {
    // Automatically cached and deduplicated
    actions.loadFSRSStats(userId)
  }, [userId])
  
  // Handle loading state
  if (loading.fsrsStats) return <LoadingSpinner />
}
```

### Step 5: Replace Stats Store Usage

#### Before (Legacy Stats Store):
```typescript
import { useStats } from '../store/stats'

const MyComponent = () => {
  const { 
    dailyProgress, 
    loadDailyProgress,
    remainingCount,
    loadRemainingCount 
  } = useStats()
}
```

#### After (Unified Store):
```typescript
import { 
  useUnifiedDailyProgress, 
  useUnifiedRemainingCount,
  useUnifiedActions 
} from '../store/unified'

const MyComponent = () => {
  const dailyProgress = useUnifiedDailyProgress()
  const remainingCount = useUnifiedRemainingCount()
  const actions = useUnifiedActions()
  
  useEffect(() => {
    // Both calls are cached and deduplicated
    actions.loadDailyProgress(userId, country, language)
    actions.loadRemainingCount(userId, country, language)
  }, [userId, country, language])
}
```

## Component-Specific Migration Examples

### Home.tsx Migration

#### Key Changes:
1. Replace multiple store hooks with unified hooks
2. Use single `loadCriticalData` call instead of multiple API calls
3. Implement proper loading and error states
4. Leverage automatic cache invalidation

```typescript
// Before: Multiple uncoordinated API calls
useEffect(() => {
  loadUser(userId)
  loadDailyProgress(userId, country, language)
  loadRemainingCount(userId, country, language)
  loadUserStats(userId)
}, [userId, country, language])

// After: Single coordinated call with caching
useEffect(() => {
  actions.loadCriticalData(userId, country, language)
}, [userId, country, language])
```

### Settings.tsx Migration

#### Key Changes:
1. Use unified settings management
2. Automatic cache invalidation on settings change
3. Optimistic updates with rollback on error

```typescript
// Before: Manual state management
const handleCountryChange = async (country: string) => {
  setLoading(true)
  try {
    await updateUserSettings({ examCountry: country })
    setExamCountry(country)
    // Manual cache clearing
    clearTopicsCache()
    clearRemainingCountCache()
  } catch (error) {
    setError(error)
  } finally {
    setLoading(false)
  }
}

// After: Unified with automatic cache management
const handleCountryChange = (country: string) => {
  actions.updateSettings({ examCountry: country })
  // Automatic cache invalidation and error handling
}
```

### Statistics.tsx Migration

#### Key Changes:
1. Use unified FSRS statistics
2. Automatic data preloading
3. Consistent loading states

```typescript
// Before: Manual data loading
useEffect(() => {
  if (userId) {
    loadUserStats(userId)
    loadDailyProgress(userId, country, language)
  }
}, [userId, country, language])

// After: Unified data loading
useEffect(() => {
  actions.preloadStatisticsData(userId, country, language)
}, [userId, country, language])
```

## Migration Checklist

### Per Component:
- [ ] Add migration helper import
- [ ] Enable unified store in useEffect
- [ ] Replace legacy store hooks with unified hooks
- [ ] Update data access patterns
- [ ] Update data mutation patterns
- [ ] Test loading states
- [ ] Test error handling
- [ ] Verify cache behavior

### Global:
- [ ] Update all components to use unified store
- [ ] Remove legacy store imports
- [ ] Delete legacy store files
- [ ] Update type definitions
- [ ] Run comprehensive tests
- [ ] Performance validation

## Testing Migration

### 1. Component-Level Testing
```typescript
// Test unified store integration
import { renderWithUnifiedStore } from '../utils/testUtils'

test('component uses unified store correctly', () => {
  const { getByText } = renderWithUnifiedStore(<MyComponent />)
  // Test component behavior
})
```

### 2. Cache Behavior Testing
```typescript
// Verify cache hits and API call reduction
const apiCallsBefore = mockApi.callCount
render(<MyComponent />)
render(<MyComponent />) // Should use cache
expect(mockApi.callCount).toBe(apiCallsBefore + 1) // Only one API call
```

### 3. Performance Testing
```typescript
// Measure performance improvements
const startTime = performance.now()
await actions.loadCriticalData(userId, country, language)
const loadTime = performance.now() - startTime
expect(loadTime).toBeLessThan(100) // Should be fast with cache
```

## Common Migration Issues

### Issue 1: Missing Loading States
**Problem**: Component doesn't show loading indicators
**Solution**: Use `useUnifiedLoading()` hook

```typescript
const loading = useUnifiedLoading()
if (loading.user || loading.settings) return <LoadingSpinner />
```

### Issue 2: Stale Data
**Problem**: Component shows outdated information
**Solution**: Check cache TTL and invalidation rules

```typescript
// Force fresh data if needed
actions.invalidateCache('user')
actions.loadUser(userId, { force: true })
```

### Issue 3: Type Errors
**Problem**: TypeScript errors with unified store types
**Solution**: Update type imports and usage

```typescript
import type { UnifiedStoreState } from '../store/unified'
```

### Issue 4: Performance Regression
**Problem**: Component is slower after migration
**Solution**: Check for unnecessary re-renders and optimize selectors

```typescript
// Use specific selectors instead of entire state
const userName = useUnifiedStore(state => state.user?.name)
```

## Rollback Strategy

If issues arise during migration:

### 1. Component-Level Rollback
```typescript
// Disable unified store for specific component
const migration = useStoreMigration('MyComponent')
migration.disableUnified()
```

### 2. Feature Flag Rollback
```typescript
// Global feature flag
const USE_UNIFIED_STORE = false

if (USE_UNIFIED_STORE) {
  // Use unified store
} else {
  // Use legacy stores
}
```

### 3. Gradual Rollback
- Revert components one by one
- Monitor for issues
- Keep unified store infrastructure for future migration

## Performance Expectations

### Before Migration:
- Home page: 4+ API calls on every load
- No request deduplication
- Inconsistent caching
- Manual state synchronization

### After Migration:
- Home page: 0-1 API calls (cached data)
- 100% request deduplication
- 60%+ reduction in API calls
- Automatic state synchronization
- Sub-5ms cache access times

## Support and Troubleshooting

### Debug Tools:
```typescript
// Check cache state
import { debugCache } from '../utils/cacheMonitor'
debugCache()

// Monitor performance
import { useCacheStatistics } from '../utils/cacheMonitor'
const { statistics } = useCacheStatistics()
console.log('Cache hit rate:', statistics.hitRate)
```

### Common Commands:
```typescript
// Clear all caches
actions.clearAllCaches()

// Refresh all data
actions.refreshAllData(userId)

// Check cache health
import { checkCacheHealth } from '../utils/cacheMonitor'
const health = checkCacheHealth()
```

## Next Steps

1. Start with low-risk components (Settings, Profile)
2. Migrate high-traffic components (Home, Statistics)
3. Update complex components (Repeat, Topics)
4. Remove legacy store files
5. Optimize performance based on metrics
6. Document lessons learned

## Migration Timeline

### Week 1: Foundation
- [ ] Set up migration helper
- [ ] Migrate Settings component
- [ ] Test and validate

### Week 2: Core Components
- [ ] Migrate Home component
- [ ] Migrate Statistics component
- [ ] Performance testing

### Week 3: Complex Components
- [ ] Migrate Repeat component
- [ ] Migrate Topics component
- [ ] Integration testing

### Week 4: Cleanup
- [ ] Remove legacy stores
- [ ] Final performance validation
- [ ] Documentation updates