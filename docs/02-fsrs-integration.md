# FSRS Integration: Complete Learning Algorithm Implementation

## Overview
Integrate FSRS-6 (Free Spaced Repetition Scheduler) algorithm throughout the frontend to create a scientifically-optimized learning experience. This builds on the unified store migration and is **critical for production readiness**.

## FSRS-6 Algorithm Fundamentals

### Core Concepts for Python Developers
```python
# FSRS-6 Parameters (Python-style explanation)
class FSRSCard:
    stability: float      # Memory strength (days until 90% retention)
    difficulty: float     # Inherent card difficulty (0-10 scale)
    elapsed_days: int     # Days since last review
    scheduled_days: int   # Days until next review
    reps: int            # Total number of reviews
    lapses: int          # Number of times forgotten
    state: str           # NEW, LEARNING, REVIEW, RELEARNING
    last_review: datetime # When last reviewed
```

### Rating System Translation
```typescript
// FSRS Rating Scale (1-4)
enum FSRSRating {
  AGAIN = 1,  // "Completely forgot" - triggers relearning
  HARD = 2,   // "Remembered with difficulty" - reduces stability
  GOOD = 3,   // "Remembered correctly" - normal progression
  EASY = 4    // "Too easy" - increases stability significantly
}
```

## Current Backend Integration Status

### ✅ Already Implemented
- **FSRS Service**: [`backend/app/services/fsrs_service.py`](../backend/app/services/fsrs_service.py)
- **API Endpoints**: Complete FSRS endpoints in [`backend/app/routers.py`](../backend/app/routers.py)
- **Database Models**: FSRS-only fields in [`backend/app/models.py`](../backend/app/models.py)

### 🔄 Frontend Integration Needed
- **Question Flow**: Connect FSRS scheduling to question display
- **Rating Interface**: Implement FSRS-compliant rating buttons
- **Progress Tracking**: Show FSRS-based learning statistics
- **Scheduling Logic**: Respect FSRS timing for question availability

## Phase 1: Repeat.tsx FSRS Integration (Days 1-2)

### Current State Analysis
The [`Repeat.tsx`](../frontend/src/pages/Repeat.tsx) component needs complete FSRS integration.

### Step 1: FSRS Data Flow Setup

#### Backend API Integration
```typescript
// frontend/src/api/fsrs.ts - Enhance existing FSRS API client
export interface FSRSQuestionData {
  id: string;
  content: string;
  answer: string;
  topicId: string;
  fsrsData: {
    stability: number;
    difficulty: number;
    elapsedDays: number;
    scheduledDays: number;
    reps: number;
    lapses: number;
    state: 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING';
    lastReview: string;
    dueDate: string;
  };
}

export const fsrsApi = {
  // Get questions due for review (respects FSRS scheduling)
  getDueQuestions: async (): Promise<FSRSQuestionData[]> => {
    const response = await fetch('/api/fsrs/due-questions');
    return response.json();
  },

  // Submit answer with FSRS rating
  submitAnswer: async (questionId: string, rating: 1 | 2 | 3 | 4) => {
    const response = await fetch('/api/fsrs/submit-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, rating })
    });
    return response.json();
  },

  // Get FSRS statistics
  getStats: async () => {
    const response = await fetch('/api/fsrs/stats');
    return response.json();
  }
};
```

### Step 2: Unified Store FSRS Integration

#### Enhance Unified Store with FSRS Actions
```typescript
// Add to frontend/src/store/unified.ts
interface FSRSStoreSlice {
  dueQuestions: FSRSQuestionData[];
  currentQuestion: FSRSQuestionData | null;
  sessionStats: {
    questionsAnswered: number;
    correctAnswers: number;
    sessionStartTime: Date;
    averageResponseTime: number;
  };
  isLoading: boolean;
  error: string | null;
}

const fsrsActions = {
  // Load questions due for review
  loadDueQuestions: async () => {
    set(state => ({ ...state, isLoading: true }));
    try {
      const questions = await fsrsApi.getDueQuestions();
      set(state => ({
        ...state,
        dueQuestions: questions,
        currentQuestion: questions[0] || null,
        isLoading: false
      }));
    } catch (error) {
      set(state => ({
        ...state,
        error: error.message,
        isLoading: false
      }));
    }
  },

  // Submit FSRS rating and get next question
  submitFSRSRating: async (questionId: string, rating: 1 | 2 | 3 | 4) => {
    try {
      // Submit to backend for FSRS calculation
      await fsrsApi.submitAnswer(questionId, rating);
      
      // Update session stats
      set(state => ({
        ...state,
        sessionStats: {
          ...state.sessionStats,
          questionsAnswered: state.sessionStats.questionsAnswered + 1,
          correctAnswers: state.sessionStats.correctAnswers + (rating >= 3 ? 1 : 0)
        }
      }));

      // Load next question
      await fsrsActions.loadDueQuestions();
    } catch (error) {
      set(state => ({ ...state, error: error.message }));
    }
  }
};
```

### Step 3: FSRS-Compliant Question Interface

#### Create FSRSQuestionCard Component
```typescript
// frontend/src/components/FSRSQuestionCard.tsx
interface FSRSQuestionCardProps {
  question: FSRSQuestionData;
  onRate: (rating: 1 | 2 | 3 | 4) => void;
  showAnswer: boolean;
  onShowAnswer: () => void;
}

const FSRSQuestionCard: React.FC<FSRSQuestionCardProps> = ({
  question,
  onRate,
  showAnswer,
  onShowAnswer
}) => {
  const [responseStartTime] = useState(Date.now());

  const handleRating = (rating: 1 | 2 | 3 | 4) => {
    const responseTime = Date.now() - responseStartTime;
    // Track response time for analytics
    onRate(rating);
  };

  return (
    <div className="fsrs-question-card">
      {/* Question Display */}
      <div className="question-content">
        <h2>{question.content}</h2>
        
        {/* FSRS Metadata (for debugging/development) */}
        <div className="fsrs-debug-info">
          <small>
            Stability: {question.fsrsData.stability.toFixed(1)} days | 
            Difficulty: {question.fsrsData.difficulty.toFixed(1)} | 
            Reviews: {question.fsrsData.reps}
          </small>
        </div>
      </div>

      {/* Show Answer Button */}
      {!showAnswer && (
        <button 
          className="show-answer-btn"
          onClick={onShowAnswer}
        >
          Show Answer
        </button>
      )}

      {/* Answer and Rating Interface */}
      {showAnswer && (
        <>
          <div className="answer-content">
            <h3>Answer:</h3>
            <p>{question.answer}</p>
          </div>

          <FSRSRatingButtons onRate={handleRating} />
        </>
      )}
    </div>
  );
};
```

#### FSRS Rating Buttons Component
```typescript
// frontend/src/components/FSRSRatingButtons.tsx
interface FSRSRatingButtonsProps {
  onRate: (rating: 1 | 2 | 3 | 4) => void;
}

const FSRSRatingButtons: React.FC<FSRSRatingButtonsProps> = ({ onRate }) => {
  return (
    <div className="fsrs-rating-buttons">
      <button 
        className="rating-btn rating-again"
        onClick={() => onRate(1)}
      >
        <span className="rating-label">Again</span>
        <span className="rating-description">Completely forgot</span>
        <span className="rating-consequence">Will review soon</span>
      </button>

      <button 
        className="rating-btn rating-hard"
        onClick={() => onRate(2)}
      >
        <span className="rating-label">Hard</span>
        <span className="rating-description">Remembered with difficulty</span>
        <span className="rating-consequence">Shorter interval</span>
      </button>

      <button 
        className="rating-btn rating-good"
        onClick={() => onRate(3)}
      >
        <span className="rating-label">Good</span>
        <span className="rating-description">Remembered correctly</span>
        <span className="rating-consequence">Normal interval</span>
      </button>

      <button 
        className="rating-btn rating-easy"
        onClick={() => onRate(4)}
      >
        <span className="rating-label">Easy</span>
        <span className="rating-description">Too easy</span>
        <span className="rating-consequence">Much longer interval</span>
      </button>
    </div>
  );
};
```

### Step 4: Complete Repeat.tsx Integration

```typescript
// frontend/src/pages/Repeat-Unified.tsx
const RepeatUnified: React.FC = () => {
  const { 
    data: fsrsData, 
    loading, 
    error, 
    actions 
  } = useUnifiedStore('fsrs');

  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);

  // Load due questions on component mount
  useEffect(() => {
    actions.loadDueQuestions();
  }, [actions]);

  // Handle FSRS rating submission
  const handleRating = useCallback(async (rating: 1 | 2 | 3 | 4) => {
    if (!fsrsData.currentQuestion) return;

    await actions.submitFSRSRating(fsrsData.currentQuestion.id, rating);
    
    // Reset for next question
    setShowAnswer(false);
    
    // Check if session is complete
    if (fsrsData.dueQuestions.length === 0) {
      setSessionComplete(true);
    }
  }, [fsrsData.currentQuestion, actions]);

  // Loading state
  if (loading) {
    return <LoadingSpinner message="Loading your review session..." />;
  }

  // Error state
  if (error) {
    return (
      <ErrorBoundary 
        error={error}
        onRetry={() => actions.loadDueQuestions()}
        fallback="Failed to load questions. Please try again."
      />
    );
  }

  // Session complete
  if (sessionComplete || !fsrsData.currentQuestion) {
    return (
      <SessionComplete 
        stats={fsrsData.sessionStats}
        onStartNewSession={() => {
          setSessionComplete(false);
          actions.loadDueQuestions();
        }}
      />
    );
  }

  // Main question interface
  return (
    <div className="repeat-container">
      {/* Session Progress */}
      <div className="session-progress">
        <span>
          Question {fsrsData.sessionStats.questionsAnswered + 1} of {fsrsData.dueQuestions.length}
        </span>
        <span>
          Accuracy: {
            fsrsData.sessionStats.questionsAnswered > 0 
              ? Math.round((fsrsData.sessionStats.correctAnswers / fsrsData.sessionStats.questionsAnswered) * 100)
              : 0
          }%
        </span>
      </div>

      {/* FSRS Question Card */}
      <FSRSQuestionCard
        question={fsrsData.currentQuestion}
        onRate={handleRating}
        showAnswer={showAnswer}
        onShowAnswer={() => setShowAnswer(true)}
      />

      {/* Next Review Preview */}
      {showAnswer && (
        <div className="next-review-preview">
          <h4>Next Review Times:</h4>
          <div className="review-intervals">
            <span>Again: ~10 minutes</span>
            <span>Hard: ~1 day</span>
            <span>Good: ~{Math.round(fsrsData.currentQuestion.fsrsData.stability)} days</span>
            <span>Easy: ~{Math.round(fsrsData.currentQuestion.fsrsData.stability * 1.5)} days</span>
          </div>
        </div>
      )}
    </div>
  );
};
```

## Phase 2: FSRS Statistics Dashboard (Day 3)

### Learning Analytics Integration

#### FSRS Statistics Component
```typescript
// frontend/src/components/FSRSStatistics.tsx
interface FSRSStats {
  totalCards: number;
  matureCards: number; // Cards with stability > 21 days
  averageStability: number;
  retentionRate: number;
  dailyReviews: number;
  streakDays: number;
  timeSpentToday: number; // minutes
  projectedWorkload: {
    tomorrow: number;
    nextWeek: number;
    nextMonth: number;
  };
}

const FSRSStatistics: React.FC = () => {
  const { data: stats, loading } = useUnifiedStore('fsrsStats');

  if (loading) return <LoadingSpinner />;

  return (
    <div className="fsrs-statistics">
      <h2>Learning Progress</h2>
      
      {/* Key Metrics */}
      <div className="stats-grid">
        <StatCard
          title="Retention Rate"
          value={`${stats.retentionRate}%`}
          description="Questions remembered correctly"
          trend={stats.retentionRate > 85 ? 'positive' : 'neutral'}
        />
        
        <StatCard
          title="Average Stability"
          value={`${stats.averageStability.toFixed(1)} days`}
          description="Memory strength"
          trend="positive"
        />
        
        <StatCard
          title="Mature Cards"
          value={`${stats.matureCards}/${stats.totalCards}`}
          description="Well-learned questions"
          progress={stats.matureCards / stats.totalCards}
        />
        
        <StatCard
          title="Study Streak"
          value={`${stats.streakDays} days`}
          description="Consecutive days studied"
          trend={stats.streakDays > 7 ? 'positive' : 'neutral'}
        />
      </div>

      {/* Workload Projection */}
      <div className="workload-projection">
        <h3>Upcoming Reviews</h3>
        <div className="projection-bars">
          <div className="projection-item">
            <span>Tomorrow</span>
            <div className="bar">
              <div 
                className="fill" 
                style={{ width: `${Math.min(stats.projectedWorkload.tomorrow / 50 * 100, 100)}%` }}
              />
            </div>
            <span>{stats.projectedWorkload.tomorrow} cards</span>
          </div>
          
          <div className="projection-item">
            <span>Next Week</span>
            <div className="bar">
              <div 
                className="fill" 
                style={{ width: `${Math.min(stats.projectedWorkload.nextWeek / 200 * 100, 100)}%` }}
              />
            </div>
            <span>{stats.projectedWorkload.nextWeek} cards</span>
          </div>
        </div>
      </div>
    </div>
  );
};
```

## Phase 3: FSRS Settings Integration (Day 4)

### FSRS Parameter Configuration

#### Settings Component Enhancement
```typescript
// Enhance frontend/src/pages/Settings-Unified.tsx
const FSRSSettings: React.FC = () => {
  const { data: settings, actions } = useUnifiedStore('settings');

  const [fsrsParams, setFsrsParams] = useState({
    requestRetention: settings.fsrs?.requestRetention || 0.9,
    maximumInterval: settings.fsrs?.maximumInterval || 36500,
    easyBonus: settings.fsrs?.easyBonus || 1.3,
    hardInterval: settings.fsrs?.hardInterval || 1.2,
    newInterval: settings.fsrs?.newInterval || 1.0,
    graduatingInterval: settings.fsrs?.graduatingInterval || 1.0,
    easyInterval: settings.fsrs?.easyInterval || 4.0
  });

  const handleSaveFSRSSettings = async () => {
    await actions.updateSettings({
      fsrs: fsrsParams
    });
  };

  return (
    <div className="fsrs-settings">
      <h3>FSRS Algorithm Settings</h3>
      
      <div className="setting-group">
        <label>
          Target Retention Rate
          <input
            type="range"
            min="0.7"
            max="0.98"
            step="0.01"
            value={fsrsParams.requestRetention}
            onChange={(e) => setFsrsParams(prev => ({
              ...prev,
              requestRetention: parseFloat(e.target.value)
            }))}
          />
          <span>{Math.round(fsrsParams.requestRetention * 100)}%</span>
        </label>
        <small>Higher values = more frequent reviews, better retention</small>
      </div>

      <div className="setting-group">
        <label>
          Maximum Interval (days)
          <input
            type="number"
            min="30"
            max="36500"
            value={fsrsParams.maximumInterval}
            onChange={(e) => setFsrsParams(prev => ({
              ...prev,
              maximumInterval: parseInt(e.target.value)
            }))}
          />
        </label>
        <small>Maximum time between reviews</small>
      </div>

      <button onClick={handleSaveFSRSSettings}>
        Save FSRS Settings
      </button>
    </div>
  );
};
```

## Phase 4: Advanced FSRS Features (Day 5)

### Learning Analytics and Insights

#### FSRS Learning Insights
```typescript
// frontend/src/components/FSRSInsights.tsx
const FSRSInsights: React.FC = () => {
  const { data: insights } = useUnifiedStore('fsrsInsights');

  return (
    <div className="fsrs-insights">
      <h3>Learning Insights</h3>
      
      {/* Difficulty Analysis */}
      <div className="insight-card">
        <h4>Most Challenging Topics</h4>
        {insights.difficultTopics?.map(topic => (
          <div key={topic.id} className="topic-difficulty">
            <span>{topic.name}</span>
            <div className="difficulty-bar">
              <div 
                className="fill difficulty-high" 
                style={{ width: `${topic.averageDifficulty * 10}%` }}
              />
            </div>
            <span>{topic.averageDifficulty.toFixed(1)}/10</span>
          </div>
        ))}
      </div>

      {/* Optimal Study Times */}
      <div className="insight-card">
        <h4>Best Study Times</h4>
        <p>Based on your performance data:</p>
        <ul>
          {insights.optimalStudyTimes?.map(time => (
            <li key={time.hour}>
              {time.hour}:00 - {time.hour + 1}:00 
              ({time.successRate}% success rate)
            </li>
          ))}
        </ul>
      </div>

      {/* Memory Strength Distribution */}
      <div className="insight-card">
        <h4>Memory Strength Distribution</h4>
        <div className="stability-histogram">
          {insights.stabilityDistribution?.map(bucket => (
            <div 
              key={bucket.range}
              className="histogram-bar"
              style={{ height: `${bucket.percentage}%` }}
              title={`${bucket.count} cards with ${bucket.range} days stability`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
```

## Testing FSRS Integration

### Unit Tests
```typescript
// frontend/src/__tests__/fsrs-integration.test.tsx
describe('FSRS Integration', () => {
  it('loads due questions correctly', async () => {
    const mockQuestions = [
      { id: '1', content: 'Test question', fsrsData: { dueDate: new Date().toISOString() } }
    ];
    
    jest.spyOn(fsrsApi, 'getDueQuestions').mockResolvedValue(mockQuestions);
    
    render(<RepeatUnified />);
    
    await waitFor(() => {
      expect(screen.getByText('Test question')).toBeInTheDocument();
    });
  });

  it('submits FSRS ratings correctly', async () => {
    const mockSubmit = jest.spyOn(fsrsApi, 'submitAnswer').mockResolvedValue({});
    
    render(<RepeatUnified />);
    
    // Wait for question to load, show answer, then rate
    await waitFor(() => screen.getByText('Show Answer'));
    fireEvent.click(screen.getByText('Show Answer'));
    
    await waitFor(() => screen.getByText('Good'));
    fireEvent.click(screen.getByText('Good'));
    
    expect(mockSubmit).toHaveBeenCalledWith(expect.any(String), 3);
  });
});
```

### Integration Tests
```typescript
// Test complete FSRS learning flow
describe('FSRS Learning Flow', () => {
  it('completes full learning session', async () => {
    // Mock API responses
    const mockQuestions = generateMockFSRSQuestions(5);
    jest.spyOn(fsrsApi, 'getDueQuestions').mockResolvedValue(mockQuestions);
    
    render(<RepeatUnified />);
    
    // Answer all questions
    for (let i = 0; i < mockQuestions.length; i++) {
      await waitFor(() => screen.getByText('Show Answer'));
      fireEvent.click(screen.getByText('Show Answer'));
      
      await waitFor(() => screen.getByText('Good'));
      fireEvent.click(screen.getByText('Good'));
    }
    
    // Verify session completion
    await waitFor(() => {
      expect(screen.getByText('Session Complete')).toBeInTheDocument();
    });
  });
});
```

## Performance Considerations

### FSRS Calculation Optimization
- **Backend Processing**: All FSRS calculations happen on backend
- **Caching**: Cache FSRS parameters and due dates
- **Batch Operations**: Group multiple rating submissions
- **Preloading**: Preload next questions during current question display

### Memory Management
```typescript
// Cleanup FSRS data when component unmounts
useEffect(() => {
  return () => {
    actions.clearFSRSSession();
  };
}, []);
```

## Success Metrics

### FSRS Integration Complete When:
- [ ] Questions are scheduled according to FSRS algorithm
- [ ] All four rating buttons work correctly (Again/Hard/Good/Easy)
- [ ] FSRS statistics display accurate learning metrics
- [ ] Settings allow FSRS parameter customization
- [ ] Performance meets targets (<200ms response time)
- [ ] Error handling covers all FSRS edge cases

This FSRS integration transforms the app from a simple flashcard system into a scientifically-optimized learning platform.