# TG App FSRS Project: AI Development Philosophy & Guidelines

## Project Overview
A React/TypeScript + Python spaced repetition learning app implementing FSRS-6 algorithm, targeting **1-week production deployment** on Render (backend), Vercel (frontend), and Supabase (database).

**Developer Profile:** Python expert, React newcomer  
**Timeline:** 7 days to production  
**Current State:** 70% complete, backend done, frontend migration needed

---

## A. Project Philosophy

### Core Principles for FSRS-6 Implementation
1. **Scientific Learning First**: FSRS-6 algorithm drives all scheduling decisions - no shortcuts or approximations
2. **Data Integrity**: User progress data is sacred - implement robust validation and backup strategies
3. **Performance Over Perfection**: Optimize for Core Web Vitals and learning flow, not code elegance
4. **Offline-First Mindset**: Users learn anywhere - ensure graceful offline functionality
5. **Progressive Enhancement**: Start with core functionality, add features incrementally

### User Experience Priorities
1. **Instant Feedback**: Question → Answer → Rating → Next Question flow must be <200ms
2. **Learning Continuity**: Never lose user progress, even during crashes or network issues
3. **Cognitive Load Reduction**: Minimize UI complexity during learning sessions
4. **Progress Transparency**: Users should understand their learning progress and next review times
5. **Accessibility**: Support keyboard navigation and screen readers

### Technical Debt Management (1-Week Strategy)
- **Accept**: Minor code duplication if it speeds development
- **Fix Immediately**: Any bugs that break FSRS algorithm or data persistence
- **Defer**: Perfect TypeScript types, comprehensive error messages, advanced animations
- **Document**: All shortcuts taken for post-launch cleanup

---

## B. Code Standards & Architecture

### React/TypeScript for Python Developers

#### Key Concept Translations
```typescript
// Python Class → React Component
class UserProgress:           →  const UserProgress: React.FC = () => {
    def __init__(self):       →    const [state, setState] = useState();
    def update(self):         →    const updateState = useCallback(() => {
    def render(self):         →    return <div>...</div>;

// Python Dictionary → React State
user_data = {                 →  const [userData, setUserData] = useState({
    "name": "John",           →    name: "John",
    "score": 100              →    score: 100
}                             →  });

// Python Function → React Hook
def get_user_data():          →  const useUserData = () => {
    return fetch_data()       →    return useQuery('userData', fetchData);
```

#### State Management Patterns
```typescript
// ❌ Python-style direct mutation
userData.score = newScore;

// ✅ React immutable updates
setUserData(prev => ({ ...prev, score: newScore }));

// ❌ Python-style synchronous operations
result = api_call()
process(result)

// ✅ React async patterns
useEffect(() => {
  apiCall().then(result => process(result));
}, [dependency]);
```

### Unified Store Pattern Rules

#### Migration Guidelines
1. **One Component at a Time**: Never migrate multiple components simultaneously
2. **Backward Compatibility**: Keep legacy store interfaces during transition
3. **Data Validation**: Validate all data when moving between store systems
4. **Rollback Strategy**: Always maintain ability to revert to legacy store

#### Usage Patterns
```typescript
// ✅ Correct unified store usage
const { data, loading, error, actions } = useUnifiedStore('questions');

// ❌ Direct store access
import { store } from './store/unified';
store.getState().questions; // Don't do this

// ✅ Action dispatching
actions.updateQuestion(questionId, updates);

// ❌ Direct state mutation
data.questions[0].difficulty = 'hard'; // Don't do this
```

### Component Architecture Standards

#### File Organization
```
src/
├── components/           # Reusable UI components
│   ├── ui/              # Basic UI elements (Button, Input)
│   └── features/        # Feature-specific components
├── pages/               # Route components
│   ├── Home-Unified.tsx # ✅ Migrated to unified store
│   └── Repeat.tsx       # 🔄 Needs migration
├── store/               # State management
│   ├── unified.ts       # Main store
│   └── legacy/          # Old stores (to be removed)
└── utils/               # Helper functions
```

#### Component Naming Conventions
- **Pages**: `PascalCase-Unified.tsx` (e.g., `Settings-Unified.tsx`)
- **Components**: `PascalCase.tsx` (e.g., `QuestionCard.tsx`)
- **Hooks**: `use + PascalCase` (e.g., `useQuestionData`)
- **Utils**: `camelCase.ts` (e.g., `storeMigration.ts`)

### Error Handling Patterns

#### API Error Handling
```typescript
// ✅ Comprehensive error handling
const { data, error, retry } = useUnifiedStore('questions');

if (error) {
  return <ErrorBoundary error={error} onRetry={retry} />;
}

// ✅ User-friendly error messages
const getErrorMessage = (error: ApiError) => {
  switch (error.code) {
    case 'NETWORK_ERROR': return 'Check your internet connection';
    case 'SERVER_ERROR': return 'Server is temporarily unavailable';
    default: return 'Something went wrong. Please try again.';
  }
};
```

---

## C. FSRS Integration Principles

### Algorithm Exposure in UI
1. **Hide Complexity**: Users see "Easy/Good/Hard/Again", not FSRS parameters
2. **Show Progress**: Display next review time and retention probability
3. **Respect Timing**: Never show questions before their scheduled time
4. **Batch Operations**: Group FSRS calculations to avoid UI blocking

### Data Flow Patterns
```typescript
// Backend FSRS Service → Frontend Flow
1. GET /fsrs/due-questions     → Load questions ready for review
2. POST /fsrs/submit-answer    → Submit user rating (1-4 scale)
3. Backend calculates new FSRS parameters
4. Frontend updates local cache
5. GET /fsrs/stats            → Update learning statistics
```

### User Feedback Loops
- **Immediate**: Show next review time after each answer
- **Session**: Display session progress and questions remaining
- **Daily**: Show daily learning streak and goals
- **Weekly**: Provide retention statistics and learning insights

---

## D. Performance & Production Constraints

### Bundle Size Limits
- **Initial Bundle**: <500KB gzipped
- **Route Chunks**: <200KB each
- **Vendor Chunks**: <300KB total
- **Assets**: Optimize images to <100KB each

### Core Web Vitals Targets
- **LCP (Largest Contentful Paint)**: <2.5s
- **FID (First Input Delay)**: <100ms
- **CLS (Cumulative Layout Shift)**: <0.1
- **TTFB (Time to First Byte)**: <600ms

### Deployment Pipeline Requirements

#### Render (Backend)
```yaml
# render.yaml
services:
  - type: web
    name: tgapp-backend
    env: python
    buildCommand: "pip install -r requirements.txt"
    startCommand: "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: tgapp-db
          property: connectionString
```

#### Vercel (Frontend)
```json
// vercel.json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "env": {
    "VITE_API_URL": "@api-url"
  }
}
```

#### Supabase (Database)
- Enable Row Level Security (RLS)
- Set up automated backups
- Configure connection pooling
- Monitor query performance

---

## E. AI Collaboration Rules

### Breaking Down React Component Work

#### For Complex Components (like Repeat.tsx)
1. **State Analysis**: "Analyze current state management and identify all useState/useEffect hooks"
2. **Store Integration**: "Replace legacy store calls with unified store patterns"
3. **FSRS Integration**: "Connect FSRS rating system to question flow"
4. **UI Updates**: "Update UI to reflect new data flow"
5. **Testing**: "Add basic functionality tests"

#### For Simple Components
1. **Direct Migration**: "Migrate [Component] to unified store following [Pattern]"
2. **Validation**: "Test component renders correctly with new store"

### Code Review Checklist for AI-Generated React Code

#### Functionality
- [ ] Component renders without errors
- [ ] All props are properly typed
- [ ] State updates are immutable
- [ ] Effects have proper dependencies
- [ ] Event handlers are memoized with useCallback

#### Performance
- [ ] No unnecessary re-renders
- [ ] Heavy computations are memoized
- [ ] API calls are properly cached
- [ ] Images are optimized and lazy-loaded

#### FSRS Integration
- [ ] FSRS data flows correctly from backend
- [ ] User ratings are properly submitted
- [ ] Question scheduling respects FSRS timing
- [ ] Progress data is accurately displayed

#### Store Integration
- [ ] Uses unified store patterns
- [ ] No direct store mutations
- [ ] Proper error handling
- [ ] Loading states are handled

### Testing Requirements

#### Unit Tests (Minimum Viable)
```typescript
// Test unified store integration
describe('Component with Unified Store', () => {
  it('loads data correctly', () => {
    render(<Component />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
  
  it('handles errors gracefully', () => {
    // Mock error state
    render(<Component />);
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });
});
```

#### Integration Tests (Critical Path)
- Question loading and display
- Answer submission and FSRS calculation
- Progress tracking and statistics
- Offline functionality

#### Manual Testing Checklist
- [ ] Can load questions
- [ ] Can submit answers
- [ ] FSRS scheduling works
- [ ] Offline mode functions
- [ ] Data persists across sessions

### Validation Steps

#### Before Deployment
1. **Functionality**: All critical user flows work
2. **Performance**: Core Web Vitals meet targets
3. **Data Integrity**: No data loss during operations
4. **Error Handling**: Graceful degradation for all error states
5. **Cross-browser**: Works in Chrome, Firefox, Safari, Edge

#### Post-Deployment Monitoring
1. **Error Tracking**: Set up Sentry or similar
2. **Performance Monitoring**: Real User Monitoring (RUM)
3. **User Analytics**: Track learning session completion rates
4. **Server Monitoring**: API response times and error rates

---

## Quick Reference for AI Agents

### Common React Patterns for Python Developers
```typescript
// State management
const [state, setState] = useState(initialValue);

// Side effects (like Python decorators)
useEffect(() => {
  // Effect logic
  return () => {
    // Cleanup logic
  };
}, [dependencies]);

// Memoization (like Python @lru_cache)
const memoizedValue = useMemo(() => computeValue(), [deps]);
const memoizedCallback = useCallback(() => doSomething(), [deps]);

// Conditional rendering
return condition ? <ComponentA /> : <ComponentB />;

// List rendering (like Python list comprehension)
return items.map(item => <Item key={item.id} data={item} />);
```

### Unified Store Usage
```typescript
// Get data and actions
const { data, loading, error, actions } = useUnifiedStore('storeName');

// Update data
actions.updateItem(id, updates);

// Handle loading states
if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
```

### FSRS Integration
```typescript
// Submit answer with FSRS rating
const handleAnswer = async (rating: 1 | 2 | 3 | 4) => {
  await actions.submitAnswer(questionId, rating);
  // FSRS calculation happens on backend
  // Frontend updates with new schedule
};
```

This document serves as the single source of truth for all development decisions and AI collaboration on the TG App FSRS project.