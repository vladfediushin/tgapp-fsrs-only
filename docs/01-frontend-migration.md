# Frontend Migration: Legacy Store → Unified Store

## Overview
Complete migration of all frontend components from legacy store system to the unified store architecture. This is the **critical path** for 1-week production readiness.

## Current State Analysis

### ✅ Already Migrated
- [`Home-Unified.tsx`](../frontend/src/pages/Home-Unified.tsx) - Complete migration with unified store patterns
- [`Settings-Unified.tsx`](../frontend/src/pages/Settings-Unified.tsx) - Partial migration, needs FSRS integration

### 🔄 Needs Migration (Priority Order)
1. **HIGH PRIORITY**: [`Repeat.tsx`](../frontend/src/pages/Repeat.tsx) - Main question answering component
2. **MEDIUM PRIORITY**: Topics component - Question category management
3. **MEDIUM PRIORITY**: Statistics component - Learning progress display
4. **LOW PRIORITY**: Minor utility components

## Migration Strategy

### Phase 1: Repeat.tsx Migration (Days 1-2)
This is the **most critical component** - the core learning experience.

#### Current State Analysis
```typescript
// Current Repeat.tsx likely uses:
import { useQuestionStore } from '../store/questionStore';
import { useProgressStore } from '../store/progressStore';

// Target: Unified store pattern
import { useUnifiedStore } from '../store/unified';
```

#### Step-by-Step Migration

**Step 1: Analyze Current Dependencies**
```bash
# Search for all store imports in Repeat.tsx
grep -n "import.*Store" frontend/src/pages/Repeat.tsx
grep -n "useStore\|useState\|useEffect" frontend/src/pages/Repeat.tsx
```

**Step 2: Create Migration Backup**
```bash
cp frontend/src/pages/Repeat.tsx frontend/src/pages/Repeat-Legacy.tsx
```

**Step 3: Replace Store Imports**
```typescript
// ❌ Remove legacy imports
// import { useQuestionStore } from '../store/questionStore';
// import { useProgressStore } from '../store/progressStore';

// ✅ Add unified store import
import { useUnifiedStore } from '../store/unified';
import { Question, UserProgress } from '../types';
```

**Step 4: Replace Store Usage Patterns**

```typescript
// ❌ Legacy pattern
const { questions, loading } = useQuestionStore();
const { updateProgress } = useProgressStore();

// ✅ Unified store pattern
const { 
  data: questions, 
  loading, 
  error, 
  actions 
} = useUnifiedStore('questions');

const { 
  data: progress, 
  actions: progressActions 
} = useUnifiedStore('userProgress');
```

**Step 5: Update State Management**
```typescript
// ❌ Legacy state updates
const handleAnswer = (questionId: string, answer: string) => {
  updateProgress(questionId, answer);
  // Direct state mutation
};

// ✅ Unified store actions
const handleAnswer = useCallback(async (questionId: string, rating: 1 | 2 | 3 | 4) => {
  try {
    await actions.submitAnswer(questionId, rating);
    // FSRS calculation happens automatically
    // Store updates via unified cache system
  } catch (error) {
    console.error('Failed to submit answer:', error);
    // Error handling via unified error system
  }
}, [actions]);
```

**Step 6: Add Loading and Error States**
```typescript
// ✅ Comprehensive state handling
if (loading) {
  return <LoadingSpinner message="Loading questions..." />;
}

if (error) {
  return (
    <ErrorBoundary 
      error={error} 
      onRetry={() => actions.retryLastAction()}
      fallback="Failed to load questions. Please try again."
    />
  );
}

if (!questions || questions.length === 0) {
  return <EmptyState message="No questions available for review." />;
}
```

**Step 7: Integrate FSRS Rating System**
```typescript
// ✅ FSRS-compliant rating interface
const FSRSRatingButtons = ({ onRate }: { onRate: (rating: number) => void }) => (
  <div className="rating-buttons">
    <button onClick={() => onRate(1)} className="rating-again">
      Again
      <span className="rating-description">Completely forgot</span>
    </button>
    <button onClick={() => onRate(2)} className="rating-hard">
      Hard
      <span className="rating-description">Remembered with difficulty</span>
    </button>
    <button onClick={() => onRate(3)} className="rating-good">
      Good
      <span className="rating-description">Remembered correctly</span>
    </button>
    <button onClick={() => onRate(4)} className="rating-easy">
      Easy
      <span className="rating-description">Too easy</span>
    </button>
  </div>
);
```

### Phase 2: Topics Component Migration (Day 3)

#### Migration Steps
1. **Locate Topics Component**: Find current topics implementation
2. **Analyze Data Flow**: Understand how topics relate to questions
3. **Unified Store Integration**: Connect to unified store's topics slice
4. **Update UI Patterns**: Match Home-Unified.tsx patterns

```typescript
// Target implementation pattern
const TopicsUnified: React.FC = () => {
  const { data: topics, loading, error, actions } = useUnifiedStore('topics');
  const { data: progress } = useUnifiedStore('userProgress');

  // Calculate topic progress using FSRS data
  const topicProgress = useMemo(() => {
    return topics?.map(topic => ({
      ...topic,
      completedQuestions: progress?.filter(p => 
        p.topicId === topic.id && p.fsrsData?.stability > 1
      ).length || 0,
      totalQuestions: topic.questionCount
    }));
  }, [topics, progress]);

  return (
    <div className="topics-container">
      {topicProgress?.map(topic => (
        <TopicCard 
          key={topic.id} 
          topic={topic}
          onSelect={() => actions.selectTopic(topic.id)}
        />
      ))}
    </div>
  );
};
```

### Phase 3: Statistics Component Migration (Day 4)

#### FSRS Statistics Integration
```typescript
const StatisticsUnified: React.FC = () => {
  const { data: stats, loading } = useUnifiedStore('fsrsStats');
  
  return (
    <div className="stats-container">
      <StatCard 
        title="Retention Rate" 
        value={`${stats?.retentionRate || 0}%`}
        description="Questions remembered correctly"
      />
      <StatCard 
        title="Average Stability" 
        value={stats?.averageStability?.toFixed(1) || '0'}
        description="Memory strength (days)"
      />
      <StatCard 
        title="Learning Streak" 
        value={stats?.currentStreak || 0}
        description="Consecutive days studied"
      />
    </div>
  );
};
```

## Migration Validation Checklist

### For Each Migrated Component

#### Functionality Tests
- [ ] Component renders without errors
- [ ] Data loads correctly from unified store
- [ ] User interactions work as expected
- [ ] Error states display properly
- [ ] Loading states show appropriate feedback

#### Performance Tests
- [ ] No unnecessary re-renders (use React DevTools)
- [ ] API calls are properly cached
- [ ] Component unmounts cleanly
- [ ] Memory usage is reasonable

#### FSRS Integration Tests
- [ ] FSRS data flows correctly
- [ ] Question scheduling respects FSRS timing
- [ ] User ratings are properly submitted
- [ ] Progress statistics are accurate

### Integration Tests
```typescript
// Test unified store integration
describe('Repeat Component Migration', () => {
  it('loads questions from unified store', async () => {
    render(<RepeatUnified />);
    
    await waitFor(() => {
      expect(screen.getByText('Question content')).toBeInTheDocument();
    });
  });

  it('submits FSRS ratings correctly', async () => {
    const mockSubmitAnswer = jest.fn();
    // Mock unified store
    
    render(<RepeatUnified />);
    
    fireEvent.click(screen.getByText('Good'));
    
    await waitFor(() => {
      expect(mockSubmitAnswer).toHaveBeenCalledWith(
        expect.any(String), 
        3 // FSRS rating for "Good"
      );
    });
  });
});
```

## Legacy Store Cleanup

### Phase 4: Remove Legacy Code (Day 5)

#### Safe Removal Process
1. **Verify All Components Migrated**: Ensure no imports of legacy stores
2. **Search for Legacy References**: 
   ```bash
   grep -r "useQuestionStore\|useProgressStore" frontend/src/
   ```
3. **Remove Legacy Store Files**:
   ```bash
   rm -rf frontend/src/store/questionStore.ts
   rm -rf frontend/src/store/progressStore.ts
   rm -rf frontend/src/store/legacy/
   ```
4. **Update Package Dependencies**: Remove unused state management libraries

#### Rollback Strategy
Keep legacy components as `-Legacy.tsx` files until migration is fully validated:
```bash
# Keep these until production deployment
frontend/src/pages/Repeat-Legacy.tsx
frontend/src/pages/Topics-Legacy.tsx
frontend/src/pages/Statistics-Legacy.tsx
```

## Common Migration Pitfalls (Python Developer Focus)

### React-Specific Issues
```typescript
// ❌ Python-style direct mutation
userData.score = newScore;
questions.push(newQuestion);

// ✅ React immutable updates
setUserData(prev => ({ ...prev, score: newScore }));
setQuestions(prev => [...prev, newQuestion]);
```

### Async State Management
```typescript
// ❌ Python-style synchronous thinking
const data = fetchData(); // This won't work in React
processData(data);

// ✅ React async patterns
useEffect(() => {
  fetchData().then(data => {
    processData(data);
  });
}, []);
```

### Component Lifecycle
```typescript
// ❌ Missing cleanup (memory leaks)
useEffect(() => {
  const interval = setInterval(updateData, 1000);
  // Missing cleanup
}, []);

// ✅ Proper cleanup
useEffect(() => {
  const interval = setInterval(updateData, 1000);
  return () => clearInterval(interval); // Cleanup
}, []);
```

## Performance Optimization During Migration

### Bundle Size Management
```typescript
// ✅ Lazy load migrated components
const RepeatUnified = lazy(() => import('./pages/Repeat-Unified'));
const TopicsUnified = lazy(() => import('./pages/Topics-Unified'));

// ✅ Code splitting by route
const router = createBrowserRouter([
  {
    path: "/repeat",
    element: <Suspense fallback={<Loading />}><RepeatUnified /></Suspense>
  }
]);
```

### Memory Management
```typescript
// ✅ Cleanup subscriptions
useEffect(() => {
  const unsubscribe = store.subscribe(handleStoreChange);
  return unsubscribe; // Cleanup subscription
}, []);

// ✅ Memoize expensive calculations
const expensiveValue = useMemo(() => {
  return calculateComplexStats(userData);
}, [userData]);
```

## Success Metrics

### Migration Complete When:
- [ ] All components use unified store exclusively
- [ ] No legacy store imports remain in codebase
- [ ] All FSRS functionality works correctly
- [ ] Performance metrics meet targets (see CLAUDE.md)
- [ ] Error handling is comprehensive
- [ ] Loading states provide good UX

### Performance Targets Post-Migration:
- **Bundle Size**: <500KB initial load
- **Time to Interactive**: <3 seconds
- **First Contentful Paint**: <1.5 seconds
- **Memory Usage**: <50MB for typical session

This migration is the foundation for all other features. Complete it thoroughly before moving to FSRS integration enhancements.