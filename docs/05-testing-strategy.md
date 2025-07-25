# Testing Strategy: Solo Developer Approach

## Overview
Comprehensive testing strategy optimized for **solo development** and **1-week production timeline**. Focus on critical path testing, automated validation, and quick feedback loops for FSRS learning application.

## Testing Philosophy for Solo Developers

### Priority-Based Testing Approach
1. **Critical Path First**: Test core learning flow (question → answer → FSRS rating)
2. **Automated Where Possible**: Minimize manual testing overhead
3. **Fast Feedback**: Tests should run in <30 seconds
4. **Production-Like**: Test with real FSRS data and scenarios
5. **Error Prevention**: Focus on preventing data loss and algorithm errors

### Testing Pyramid for TG App FSRS

```
                    ┌─────────────────┐
                    │   E2E Tests     │ ← 5% (Critical user journeys)
                    │   (Playwright)  │
                ┌───┴─────────────────┴───┐
                │   Integration Tests     │ ← 25% (FSRS + Store + API)
                │   (React Testing Lib)  │
            ┌───┴─────────────────────────┴───┐
            │      Unit Tests                 │ ← 70% (Pure functions, utils)
            │   (Jest + React Testing Lib)   │
            └─────────────────────────────────┘
```

## Phase 1: Unit Testing Foundation (Day 1)

### Step 1: FSRS Algorithm Testing

#### FSRS Calculation Tests
```typescript
// frontend/src/__tests__/fsrs/fsrsCalculations.test.ts
import { calculateNextReview, updateFSRSParameters } from '../utils/fsrsHelpers';

describe('FSRS Calculations', () => {
  const mockCard = {
    stability: 5.0,
    difficulty: 6.0,
    elapsedDays: 5,
    scheduledDays: 5,
    reps: 3,
    lapses: 1,
    state: 'REVIEW' as const,
    lastReview: new Date('2024-01-01').toISOString()
  };

  describe('calculateNextReview', () => {
    it('calculates correct intervals for each rating', () => {
      const ratings = [1, 2, 3, 4] as const;
      const results = ratings.map(rating => 
        calculateNextReview(mockCard, rating)
      );

      // Again (1) should be shortest interval
      expect(results[0].scheduledDays).toBeLessThan(results[1].scheduledDays);
      
      // Good (3) should be close to current stability
      expect(results[2].scheduledDays).toBeCloseTo(mockCard.stability, 1);
      
      // Easy (4) should be longest interval
      expect(results[3].scheduledDays).toBeGreaterThan(results[2].scheduledDays);
    });

    it('handles new cards correctly', () => {
      const newCard = {
        ...mockCard,
        reps: 0,
        state: 'NEW' as const
      };

      const result = calculateNextReview(newCard, 3);
      
      expect(result.state).toBe('LEARNING');
      expect(result.reps).toBe(1);
      expect(result.scheduledDays).toBeGreaterThan(0);
    });

    it('handles lapses correctly', () => {
      const result = calculateNextReview(mockCard, 1); // Again rating
      
      expect(result.lapses).toBe(mockCard.lapses + 1);
      expect(result.state).toBe('RELEARNING');
      expect(result.scheduledDays).toBeLessThan(1); // Should be very short
    });

    it('maintains stability bounds', () => {
      const extremeCard = {
        ...mockCard,
        stability: 0.1 // Very low stability
      };

      const result = calculateNextReview(extremeCard, 4); // Easy rating
      
      expect(result.stability).toBeGreaterThan(0.1);
      expect(result.stability).toBeLessThan(36500); // Max interval
    });
  });

  describe('updateFSRSParameters', () => {
    it('updates difficulty based on rating', () => {
      const easyResult = updateFSRSParameters(mockCard, 4);
      const hardResult = updateFSRSParameters(mockCard, 2);
      
      expect(easyResult.difficulty).toBeLessThan(mockCard.difficulty);
      expect(hardResult.difficulty).toBeGreaterThan(mockCard.difficulty);
    });

    it('maintains difficulty bounds', () => {
      const extremeCard = {
        ...mockCard,
        difficulty: 9.5 // Very high difficulty
      };

      const result = updateFSRSParameters(extremeCard, 2); // Hard rating
      
      expect(result.difficulty).toBeLessThanOrEqual(10);
      expect(result.difficulty).toBeGreaterThanOrEqual(1);
    });
  });
});
```

#### Unified Store Unit Tests
```typescript
// frontend/src/__tests__/store/unifiedStore.test.ts
import { renderHook, act } from '@testing-library/react';
import { useUnifiedStore } from '../../store/unified';

// Mock API calls
jest.mock('../../api/fsrs', () => ({
  fsrsApi: {
    getDueQuestions: jest.fn(),
    submitAnswer: jest.fn(),
    getStats: jest.fn()
  }
}));

describe('Unified Store', () => {
  beforeEach(() => {
    // Reset store state
    useUnifiedStore.getState().actions.reset();
  });

  describe('FSRS Actions', () => {
    it('loads due questions correctly', async () => {
      const mockQuestions = [
        {
          id: '1',
          content: 'Test question',
          answer: 'Test answer',
          fsrsData: {
            stability: 5.0,
            difficulty: 6.0,
            dueDate: new Date().toISOString()
          }
        }
      ];

      const { fsrsApi } = require('../../api/fsrs');
      fsrsApi.getDueQuestions.mockResolvedValue(mockQuestions);

      const { result } = renderHook(() => useUnifiedStore('fsrs'));

      await act(async () => {
        await result.current.actions.loadDueQuestions();
      });

      expect(result.current.data.dueQuestions).toEqual(mockQuestions);
      expect(result.current.data.currentQuestion).toEqual(mockQuestions[0]);
      expect(result.current.loading).toBe(false);
    });

    it('handles API errors gracefully', async () => {
      const { fsrsApi } = require('../../api/fsrs');
      fsrsApi.getDueQuestions.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useUnifiedStore('fsrs'));

      await act(async () => {
        await result.current.actions.loadDueQuestions();
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.loading).toBe(false);
    });

    it('submits FSRS ratings correctly', async () => {
      const { fsrsApi } = require('../../api/fsrs');
      fsrsApi.submitAnswer.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useUnifiedStore('fsrs'));

      // Set up initial state
      act(() => {
        result.current.actions.setCurrentQuestion({
          id: '1',
          content: 'Test',
          answer: 'Test',
          fsrsData: { stability: 5.0, difficulty: 6.0 }
        });
      });

      await act(async () => {
        await result.current.actions.submitFSRSRating('1', 3);
      });

      expect(fsrsApi.submitAnswer).toHaveBeenCalledWith('1', 3);
      expect(result.current.data.sessionStats.questionsAnswered).toBe(1);
    });
  });

  describe('Caching Behavior', () => {
    it('caches API responses correctly', async () => {
      const mockQuestions = [{ id: '1', content: 'Test' }];
      const { fsrsApi } = require('../../api/fsrs');
      fsrsApi.getDueQuestions.mockResolvedValue(mockQuestions);

      const { result } = renderHook(() => useUnifiedStore('fsrs'));

      // First call
      await act(async () => {
        await result.current.actions.loadDueQuestions();
      });

      // Second call should use cache
      await act(async () => {
        await result.current.actions.loadDueQuestions();
      });

      // API should only be called once due to caching
      expect(fsrsApi.getDueQuestions).toHaveBeenCalledTimes(1);
    });

    it('invalidates cache when appropriate', async () => {
      const { result } = renderHook(() => useUnifiedStore('fsrs'));

      await act(async () => {
        result.current.actions.invalidateCache('dueQuestions');
      });

      // Cache should be cleared
      expect(result.current.data.dueQuestions).toEqual([]);
    });
  });
});
```

### Step 2: Component Unit Tests

#### Question Component Tests
```typescript
// frontend/src/__tests__/components/FSRSQuestionCard.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FSRSQuestionCard } from '../../components/FSRSQuestionCard';

const mockQuestion = {
  id: '1',
  content: 'What is the capital of France?',
  answer: 'Paris',
  topicId: 'geography',
  fsrsData: {
    stability: 5.0,
    difficulty: 6.0,
    elapsedDays: 3,
    scheduledDays: 5,
    reps: 2,
    lapses: 0,
    state: 'REVIEW' as const,
    lastReview: '2024-01-01T00:00:00Z',
    dueDate: '2024-01-06T00:00:00Z'
  }
};

describe('FSRSQuestionCard', () => {
  const mockOnRate = jest.fn();
  const mockOnShowAnswer = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders question content correctly', () => {
    render(
      <FSRSQuestionCard
        question={mockQuestion}
        onRate={mockOnRate}
        showAnswer={false}
        onShowAnswer={mockOnShowAnswer}
      />
    );

    expect(screen.getByText('What is the capital of France?')).toBeInTheDocument();
    expect(screen.getByText('Show Answer')).toBeInTheDocument();
  });

  it('shows answer when showAnswer is true', () => {
    render(
      <FSRSQuestionCard
        question={mockQuestion}
        onRate={mockOnRate}
        showAnswer={true}
        onShowAnswer={mockOnShowAnswer}
      />
    );

    expect(screen.getByText('Paris')).toBeInTheDocument();
    expect(screen.getByText('Again')).toBeInTheDocument();
    expect(screen.getByText('Hard')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    expect(screen.getByText('Easy')).toBeInTheDocument();
  });

  it('calls onShowAnswer when show answer button is clicked', () => {
    render(
      <FSRSQuestionCard
        question={mockQuestion}
        onRate={mockOnRate}
        showAnswer={false}
        onShowAnswer={mockOnShowAnswer}
      />
    );

    fireEvent.click(screen.getByText('Show Answer'));
    expect(mockOnShowAnswer).toHaveBeenCalledTimes(1);
  });

  it('calls onRate with correct rating when rating buttons are clicked', () => {
    render(
      <FSRSQuestionCard
        question={mockQuestion}
        onRate={mockOnRate}
        showAnswer={true}
        onShowAnswer={mockOnShowAnswer}
      />
    );

    fireEvent.click(screen.getByText('Again'));
    expect(mockOnRate).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByText('Hard'));
    expect(mockOnRate).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByText('Good'));
    expect(mockOnRate).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByText('Easy'));
    expect(mockOnRate).toHaveBeenCalledWith(4);
  });

  it('displays FSRS metadata correctly', () => {
    render(
      <FSRSQuestionCard
        question={mockQuestion}
        onRate={mockOnRate}
        showAnswer={false}
        onShowAnswer={mockOnShowAnswer}
      />
    );

    expect(screen.getByText(/Stability: 5.0 days/)).toBeInTheDocument();
    expect(screen.getByText(/Difficulty: 6.0/)).toBeInTheDocument();
    expect(screen.getByText(/Reviews: 2/)).toBeInTheDocument();
  });
});
```

## Phase 2: Integration Testing (Day 2)

### Step 1: FSRS Flow Integration Tests

#### Complete Learning Flow Test
```typescript
// frontend/src/__tests__/integration/fsrsFlow.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RepeatUnified } from '../../pages/Repeat-Unified';
import { UnifiedStoreProvider } from '../../store/UnifiedStoreProvider';

// Mock API
jest.mock('../../api/fsrs');

const renderWithStore = (component: React.ReactElement) => {
  return render(
    <UnifiedStoreProvider>
      {component}
    </UnifiedStoreProvider>
  );
};

describe('FSRS Learning Flow Integration', () => {
  const mockQuestions = [
    {
      id: '1',
      content: 'Question 1',
      answer: 'Answer 1',
      fsrsData: {
        stability: 5.0,
        difficulty: 6.0,
        dueDate: new Date().toISOString()
      }
    },
    {
      id: '2',
      content: 'Question 2',
      answer: 'Answer 2',
      fsrsData: {
        stability: 3.0,
        difficulty: 7.0,
        dueDate: new Date().toISOString()
      }
    }
  ];

  beforeEach(() => {
    const { fsrsApi } = require('../../api/fsrs');
    fsrsApi.getDueQuestions.mockResolvedValue(mockQuestions);
    fsrsApi.submitAnswer.mockResolvedValue({ success: true });
  });

  it('completes full learning session', async () => {
    renderWithStore(<RepeatUnified />);

    // Wait for questions to load
    await waitFor(() => {
      expect(screen.getByText('Question 1')).toBeInTheDocument();
    });

    // Show answer
    fireEvent.click(screen.getByText('Show Answer'));
    await waitFor(() => {
      expect(screen.getByText('Answer 1')).toBeInTheDocument();
    });

    // Rate as Good
    fireEvent.click(screen.getByText('Good'));

    // Should move to next question
    await waitFor(() => {
      expect(screen.getByText('Question 2')).toBeInTheDocument();
    });

    // Complete second question
    fireEvent.click(screen.getByText('Show Answer'));
    await waitFor(() => {
      expect(screen.getByText('Answer 2')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Good'));

    // Should show session complete
    await waitFor(() => {
      expect(screen.getByText('Session Complete')).toBeInTheDocument();
    });
  });

  it('handles different FSRS ratings correctly', async () => {
    const { fsrsApi } = require('../../api/fsrs');
    
    renderWithStore(<RepeatUnified />);

    await waitFor(() => {
      expect(screen.getByText('Question 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Show Answer'));
    fireEvent.click(screen.getByText('Again')); // Rating 1

    await waitFor(() => {
      expect(fsrsApi.submitAnswer).toHaveBeenCalledWith('1', 1);
    });
  });

  it('displays session statistics correctly', async () => {
    renderWithStore(<RepeatUnified />);

    await waitFor(() => {
      expect(screen.getByText(/Question 1 of 2/)).toBeInTheDocument();
      expect(screen.getByText(/Accuracy: 0%/)).toBeInTheDocument();
    });

    // Answer first question correctly
    fireEvent.click(screen.getByText('Show Answer'));
    fireEvent.click(screen.getByText('Good'));

    await waitFor(() => {
      expect(screen.getByText(/Question 2 of 2/)).toBeInTheDocument();
      expect(screen.getByText(/Accuracy: 100%/)).toBeInTheDocument();
    });
  });
});
```

### Step 2: Store Integration Tests

#### Unified Store Integration
```typescript
// frontend/src/__tests__/integration/storeIntegration.test.ts
import { renderHook, act } from '@testing-library/react';
import { useUnifiedStore } from '../../store/unified';

describe('Store Integration', () => {
  it('maintains data consistency across store slices', async () => {
    const { result } = renderHook(() => ({
      fsrs: useUnifiedStore('fsrs'),
      progress: useUnifiedStore('userProgress'),
      stats: useUnifiedStore('fsrsStats')
    }));

    // Submit an answer
    await act(async () => {
      await result.current.fsrs.actions.submitFSRSRating('question-1', 3);
    });

    // Check that progress and stats are updated
    expect(result.current.progress.data).toContainEqual(
      expect.objectContaining({
        questionId: 'question-1',
        lastRating: 3
      })
    );

    expect(result.current.stats.data.totalReviews).toBeGreaterThan(0);
  });

  it('handles offline queue integration', async () => {
    // Mock offline state
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });

    const { result } = renderHook(() => useUnifiedStore('fsrs'));

    await act(async () => {
      await result.current.actions.submitFSRSRating('question-1', 3);
    });

    // Should queue the request
    expect(result.current.data.offlineQueue).toHaveLength(1);

    // Mock back online
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });

    // Trigger sync
    await act(async () => {
      await result.current.actions.syncOfflineQueue();
    });

    // Queue should be empty
    expect(result.current.data.offlineQueue).toHaveLength(0);
  });
});
```

## Phase 3: End-to-End Testing (Day 3)

### Step 1: Critical User Journey Tests

#### Playwright E2E Setup
```typescript
// e2e/setup/global-setup.ts
import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Set up test user and data
  await page.goto(process.env.BASE_URL || 'http://localhost:3000');
  
  // Login or create test user
  await page.fill('[data-testid="email"]', 'test@example.com');
  await page.fill('[data-testid="password"]', 'testpassword');
  await page.click('[data-testid="login"]');

  // Save authentication state
  await context.storageState({ path: 'e2e/auth.json' });
  
  await browser.close();
}

export default globalSetup;
```

#### Core Learning Journey Test
```typescript
// e2e/tests/learning-journey.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Core Learning Journey', () => {
  test.use({ storageState: 'e2e/auth.json' });

  test('complete learning session with FSRS ratings', async ({ page }) => {
    await page.goto('/repeat');

    // Wait for questions to load
    await expect(page.locator('[data-testid="question-content"]')).toBeVisible();
    
    const questionText = await page.locator('[data-testid="question-content"]').textContent();
    expect(questionText).toBeTruthy();

    // Show answer
    await page.click('[data-testid="show-answer"]');
    await expect(page.locator('[data-testid="answer-content"]')).toBeVisible();

    // Rate as Good
    await page.click('[data-testid="rating-good"]');

    // Check that next question loads or session completes
    await page.waitForTimeout(1000); // Allow for API call
    
    const isSessionComplete = await page.locator('[data-testid="session-complete"]').isVisible();
    const isNextQuestion = await page.locator('[data-testid="question-content"]').isVisible();
    
    expect(isSessionComplete || isNextQuestion).toBeTruthy();
  });

  test('handles all FSRS rating options', async ({ page }) => {
    await page.goto('/repeat');
    
    await expect(page.locator('[data-testid="question-content"]')).toBeVisible();
    await page.click('[data-testid="show-answer"]');

    // Test each rating button
    const ratings = ['again', 'hard', 'good', 'easy'];
    
    for (const rating of ratings) {
      // Reload page for fresh question
      await page.reload();
      await expect(page.locator('[data-testid="question-content"]')).toBeVisible();
      await page.click('[data-testid="show-answer"]');
      
      // Click rating and verify response
      await page.click(`[data-testid="rating-${rating}"]`);
      
      // Should either show next question or complete session
      await page.waitForTimeout(1000);
      const hasProgressed = await page.locator('[data-testid="question-content"], [data-testid="session-complete"]').isVisible();
      expect(hasProgressed).toBeTruthy();
    }
  });

  test('displays accurate session statistics', async ({ page }) => {
    await page.goto('/repeat');
    
    // Check initial stats
    await expect(page.locator('[data-testid="session-progress"]')).toContainText('Question 1');
    await expect(page.locator('[data-testid="session-accuracy"]')).toContainText('0%');

    // Answer first question correctly
    await page.click('[data-testid="show-answer"]');
    await page.click('[data-testid="rating-good"]');

    // Check updated stats
    await page.waitForTimeout(1000);
    const progressText = await page.locator('[data-testid="session-progress"]').textContent();
    const accuracyText = await page.locator('[data-testid="session-accuracy"]').textContent();
    
    expect(progressText).toMatch(/Question [2-9]|Session Complete/);
    expect(accuracyText).toContain('100%');
  });
});
```

#### Offline Functionality Test
```typescript
// e2e/tests/offline-functionality.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Offline Functionality', () => {
  test.use({ storageState: 'e2e/auth.json' });

  test('works offline and syncs when back online', async ({ page, context }) => {
    await page.goto('/repeat');
    
    // Load initial questions while online
    await expect(page.locator('[data-testid="question-content"]')).toBeVisible();
    
    // Go offline
    await context.setOffline(true);
    
    // Verify offline indicator appears
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="offline-indicator"]')).toContainText('Offline');

    // Answer question while offline
    await page.click('[data-testid="show-answer"]');
    await page.click('[data-testid="rating-good"]');

    // Should queue the action
    await expect(page.locator('[data-testid="offline-indicator"]')).toContainText('pending');

    // Go back online
    await context.setOffline(false);
    
    // Wait for sync
    await page.waitForTimeout(2000);
    
    // Offline indicator should disappear or show synced state
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    const isHidden = await offlineIndicator.isHidden();
    const showsSynced = await offlineIndicator.textContent().then(text => 
      text?.includes('synced') || text?.includes('0 pending')
    );
    
    expect(isHidden || showsSynced).toBeTruthy();
  });
});
```

### Step 2: Performance Testing

#### Core Web Vitals Test
```typescript
// e2e/tests/performance.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('meets Core Web Vitals targets', async ({ page }) => {
    // Navigate to main page
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    // Measure LCP (Largest Contentful Paint)
    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry.startTime);
        }).observe({ entryTypes: ['largest-contentful-paint'] });
      });
    });

    expect(lcp).toBeLessThan(2500); // 2.5 seconds target

    // Measure FID by simulating user interaction
    await page.click('[data-testid="start-learning"]');
    
    const fidStart = Date.now();
    await page.waitForSelector('[data-testid="question-content"]');
    const fidEnd = Date.now();
    
    expect(fidEnd - fidStart).toBeLessThan(100); // 100ms target

    // Check bundle size
    const performanceEntries = await page.evaluate(() => {
      return performance.getEntriesByType('navigation')[0];
    });

    const transferSize = (performanceEntries as any).transferSize;
    expect(transferSize).toBeLessThan(500000); // 500KB target
  });

  test('loads quickly on slow network', async ({ page, context }) => {
    // Simulate slow 3G
    await context.route('**/*', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
      await route.continue();
    });

    const startTime = Date.now();
    await page.goto('/');
    await page.waitForSelector('[data-testid="main-content"]');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(5000); // 5 seconds on slow network
  });
});
```

## Phase 4: Testing Automation & CI/CD (Day 4)

### Step 1: GitHub Actions Test Pipeline

#### Test Workflow Configuration
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: frontend/package-lock.json
    
    - name: Install dependencies
      run: |
        cd frontend
        npm ci
    
    - name: Run unit tests
      run: |
        cd frontend
        npm run test:unit -- --coverage --watchAll=false
    
    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        directory: frontend/coverage
        flags: frontend
        name: frontend-coverage

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: testpassword
          POSTGRES_DB: tgapp_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
        cache: 'pip'
    
    - name: Install backend dependencies
      run: |
        cd backend
        pip install -r requirements.txt
    
    - name: Run backend tests
      env:
        DATABASE_URL: postgresql://postgres:testpassword@localhost:5432/tgapp_test
      run: |
        cd backend
        python -m pytest tests/ -v
    
    - name: Install frontend dependencies
      run: |
        cd frontend
        npm ci
    
    - name: Run integration tests
      run: |
        cd frontend
        npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        cd frontend
        npm ci
    
    - name: Install Playwright
      run: |
        cd frontend
        npx playwright install --with-deps
    
    - name: Build application
      run: |
        cd frontend
        npm run build
    
    - name: Start test server
      run: |
        cd frontend
        npm run preview &
        sleep 10
    
    - name: Run E2E tests
      run: |
        cd frontend
        npx playwright test
    
    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: failure()
      with:
        name: playwright-report
        path: frontend/playwright-report/
        retention-days: 30
```

### Step 2: Test Scripts Configuration

#### Package.json Test Scripts
```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "jest --config jest.config.js",
    "test:integration": "jest --config jest.integration.