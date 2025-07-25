# Settings, Topics & Statistics: Component Modernization

## Overview
Complete the migration and modernization of Settings, Topics, and Statistics components to work with the unified store and FSRS integration. These components provide the user interface for managing learning preferences, organizing content, and tracking progress.

## Component Priority & Timeline

### Day 1: Settings-Unified.tsx Enhancement
- **Current State**: Partially migrated, needs FSRS integration
- **Priority**: HIGH - Controls FSRS behavior and user preferences
- **Complexity**: Medium - Existing foundation, needs enhancement

### Day 2: Topics Component Migration  
- **Current State**: Legacy implementation
- **Priority**: MEDIUM - Content organization and navigation
- **Complexity**: Medium - Straightforward unified store migration

### Day 3: Statistics Component Modernization
- **Current State**: Legacy implementation
- **Priority**: MEDIUM - Learning progress visualization
- **Complexity**: High - Complex FSRS statistics integration

## Phase 1: Settings-Unified.tsx Enhancement

### Current State Analysis
The [`Settings-Unified.tsx`](../frontend/src/pages/Settings-Unified.tsx) exists but needs complete FSRS integration and user preference management.

### Step 1: FSRS Settings Integration

#### Enhanced Settings Data Structure
```typescript
// frontend/src/types/settings.ts
export interface UserSettings {
  // FSRS Algorithm Settings
  fsrs: {
    requestRetention: number;        // Target retention rate (0.7-0.98)
    maximumInterval: number;         // Max days between reviews
    easyBonus: number;              // Easy button multiplier
    hardInterval: number;           // Hard button interval factor
    newInterval: number;            // New card interval
    graduatingInterval: number;     // Graduation interval
    easyInterval: number;           // Easy interval for new cards
    enableFuzz: boolean;            // Add randomness to intervals
  };
  
  // Learning Preferences
  learning: {
    dailyGoal: number;              // Target reviews per day
    sessionLength: number;          // Max questions per session
    autoShowAnswer: boolean;        // Auto-reveal answers
    keyboardShortcuts: boolean;     // Enable keyboard navigation
    soundEffects: boolean;          // Audio feedback
  };
  
  // UI Preferences
  ui: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    fontSize: 'small' | 'medium' | 'large';
    animations: boolean;
    compactMode: boolean;
  };
  
  // Notification Settings
  notifications: {
    enabled: boolean;
    reviewReminders: boolean;
    dailyGoalReminders: boolean;
    streakReminders: boolean;
    quietHours: {
      enabled: boolean;
      start: string;              // "22:00"
      end: string;                // "08:00"
    };
  };
}
```

#### Complete Settings Component Implementation
```typescript
// frontend/src/pages/Settings-Unified.tsx
import React, { useState, useCallback } from 'react';
import { useUnifiedStore } from '../store/unified';
import { UserSettings } from '../types/settings';

const SettingsUnified: React.FC = () => {
  const { 
    data: settings, 
    loading, 
    error, 
    actions 
  } = useUnifiedStore('settings');

  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Handle settings updates
  const updateSetting = useCallback((path: string, value: any) => {
    setLocalSettings(prev => {
      const updated = { ...prev };
      const keys = path.split('.');
      let current = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      setHasChanges(true);
      return updated;
    });
  }, []);

  // Save settings
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await actions.updateSettings(localSettings);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  }, [localSettings, actions]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, [settings]);

  if (loading) {
    return <LoadingSpinner message="Loading settings..." />;
  }

  return (
    <div className="settings-container">
      <header className="settings-header">
        <h1>Settings</h1>
        {hasChanges && (
          <div className="settings-actions">
            <button onClick={handleReset} className="btn-secondary">
              Reset
            </button>
            <button 
              onClick={handleSave} 
              className="btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </header>

      <div className="settings-content">
        {/* FSRS Algorithm Settings */}
        <FSRSSettingsSection 
          settings={localSettings.fsrs}
          onUpdate={(key, value) => updateSetting(`fsrs.${key}`, value)}
        />

        {/* Learning Preferences */}
        <LearningSettingsSection
          settings={localSettings.learning}
          onUpdate={(key, value) => updateSetting(`learning.${key}`, value)}
        />

        {/* UI Preferences */}
        <UISettingsSection
          settings={localSettings.ui}
          onUpdate={(key, value) => updateSetting(`ui.${key}`, value)}
        />

        {/* Notification Settings */}
        <NotificationSettingsSection
          settings={localSettings.notifications}
          onUpdate={(key, value) => updateSetting(`notifications.${key}`, value)}
        />
      </div>
    </div>
  );
};
```

#### FSRS Settings Section Component
```typescript
// frontend/src/components/settings/FSRSSettingsSection.tsx
interface FSRSSettingsSectionProps {
  settings: UserSettings['fsrs'];
  onUpdate: (key: string, value: any) => void;
}

const FSRSSettingsSection: React.FC<FSRSSettingsSectionProps> = ({
  settings,
  onUpdate
}) => {
  return (
    <div className="settings-section">
      <h2>FSRS Algorithm</h2>
      <p className="section-description">
        Fine-tune the spaced repetition algorithm for optimal learning.
      </p>

      {/* Target Retention Rate */}
      <div className="setting-item">
        <label className="setting-label">
          <span>Target Retention Rate</span>
          <span className="setting-value">{Math.round(settings.requestRetention * 100)}%</span>
        </label>
        <input
          type="range"
          min="0.70"
          max="0.98"
          step="0.01"
          value={settings.requestRetention}
          onChange={(e) => onUpdate('requestRetention', parseFloat(e.target.value))}
          className="setting-slider"
        />
        <div className="setting-help">
          <small>
            Higher values mean more frequent reviews but better retention. 
            Recommended: 85-90% for most learners.
          </small>
        </div>
      </div>

      {/* Maximum Interval */}
      <div className="setting-item">
        <label className="setting-label">
          <span>Maximum Interval</span>
          <span className="setting-value">{settings.maximumInterval} days</span>
        </label>
        <input
          type="range"
          min="30"
          max="365"
          step="1"
          value={Math.min(settings.maximumInterval, 365)}
          onChange={(e) => onUpdate('maximumInterval', parseInt(e.target.value))}
          className="setting-slider"
        />
        <div className="setting-help">
          <small>
            Maximum time between reviews. Longer intervals reduce workload but may hurt retention.
          </small>
        </div>
      </div>

      {/* Easy Bonus */}
      <div className="setting-item">
        <label className="setting-label">
          <span>Easy Bonus</span>
          <span className="setting-value">{settings.easyBonus.toFixed(1)}x</span>
        </label>
        <input
          type="range"
          min="1.0"
          max="2.0"
          step="0.1"
          value={settings.easyBonus}
          onChange={(e) => onUpdate('easyBonus', parseFloat(e.target.value))}
          className="setting-slider"
        />
        <div className="setting-help">
          <small>
            Multiplier for "Easy" button. Higher values create longer intervals for easy cards.
          </small>
        </div>
      </div>

      {/* Advanced Settings Toggle */}
      <details className="advanced-settings">
        <summary>Advanced FSRS Settings</summary>
        
        <div className="setting-item">
          <label className="setting-checkbox">
            <input
              type="checkbox"
              checked={settings.enableFuzz}
              onChange={(e) => onUpdate('enableFuzz', e.target.checked)}
            />
            <span>Enable Interval Fuzz</span>
          </label>
          <div className="setting-help">
            <small>Adds randomness to intervals to prevent review clustering.</small>
          </div>
        </div>

        <div className="setting-item">
          <label className="setting-label">
            <span>Hard Interval Factor</span>
            <span className="setting-value">{settings.hardInterval.toFixed(1)}</span>
          </label>
          <input
            type="range"
            min="1.0"
            max="1.5"
            step="0.1"
            value={settings.hardInterval}
            onChange={(e) => onUpdate('hardInterval', parseFloat(e.target.value))}
            className="setting-slider"
          />
        </div>
      </details>
    </div>
  );
};
```

## Phase 2: Topics Component Migration

### Step 1: Analyze Current Topics Implementation

#### Topics Data Structure
```typescript
// frontend/src/types/topics.ts
export interface Topic {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  questionCount: number;
  completedCount: number;
  averageDifficulty: number;
  lastStudied: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TopicProgress {
  topicId: string;
  totalQuestions: number;
  reviewedQuestions: number;
  masteredQuestions: number; // Stability > 21 days
  averageStability: number;
  retentionRate: number;
  nextReviewCount: number;
  estimatedStudyTime: number; // minutes
}
```

### Step 2: Create Topics-Unified Component

```typescript
// frontend/src/pages/Topics-Unified.tsx
import React, { useState, useMemo } from 'react';
import { useUnifiedStore } from '../store/unified';
import { Topic, TopicProgress } from '../types/topics';

const TopicsUnified: React.FC = () => {
  const { 
    data: topics, 
    loading, 
    error, 
    actions 
  } = useUnifiedStore('topics');

  const { 
    data: progress 
  } = useUnifiedStore('userProgress');

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'progress' | 'lastStudied'>('name');
  const [filterBy, setFilterBy] = useState<'all' | 'active' | 'completed'>('all');

  // Calculate topic progress from FSRS data
  const topicsWithProgress = useMemo(() => {
    if (!topics || !progress) return [];

    return topics.map(topic => {
      const topicProgress = progress.filter(p => p.topicId === topic.id);
      const masteredQuestions = topicProgress.filter(p => 
        p.fsrsData?.stability && p.fsrsData.stability > 21
      ).length;

      return {
        ...topic,
        progress: {
          totalQuestions: topic.questionCount,
          reviewedQuestions: topicProgress.length,
          masteredQuestions,
          averageStability: topicProgress.reduce((sum, p) => 
            sum + (p.fsrsData?.stability || 0), 0
          ) / topicProgress.length || 0,
          retentionRate: topicProgress.filter(p => 
            p.lastRating && p.lastRating >= 3
          ).length / topicProgress.length * 100 || 0,
          nextReviewCount: topicProgress.filter(p => 
            new Date(p.nextReview) <= new Date()
          ).length,
          estimatedStudyTime: topicProgress.filter(p => 
            new Date(p.nextReview) <= new Date()
          ).length * 2 // 2 minutes per question estimate
        }
      };
    });
  }, [topics, progress]);

  // Filter and sort topics
  const filteredTopics = useMemo(() => {
    let filtered = topicsWithProgress;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(topic =>
        topic.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        topic.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    switch (filterBy) {
      case 'active':
        filtered = filtered.filter(topic => topic.progress.nextReviewCount > 0);
        break;
      case 'completed':
        filtered = filtered.filter(topic => 
          topic.progress.masteredQuestions === topic.progress.totalQuestions
        );
        break;
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'progress':
          return (b.progress.masteredQuestions / b.progress.totalQuestions) - 
                 (a.progress.masteredQuestions / a.progress.totalQuestions);
        case 'lastStudied':
          return new Date(b.lastStudied || 0).getTime() - 
                 new Date(a.lastStudied || 0).getTime();
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [topicsWithProgress, searchTerm, sortBy, filterBy]);

  if (loading) {
    return <LoadingSpinner message="Loading topics..." />;
  }

  if (error) {
    return (
      <ErrorBoundary 
        error={error}
        onRetry={() => actions.loadTopics()}
        fallback="Failed to load topics. Please try again."
      />
    );
  }

  return (
    <div className="topics-container">
      <header className="topics-header">
        <h1>Topics</h1>
        
        {/* Search and Filters */}
        <div className="topics-controls">
          <input
            type="text"
            placeholder="Search topics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as any)}
            className="sort-select"
          >
            <option value="name">Sort by Name</option>
            <option value="progress">Sort by Progress</option>
            <option value="lastStudied">Sort by Last Studied</option>
          </select>
          
          <select 
            value={filterBy} 
            onChange={(e) => setFilterBy(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">All Topics</option>
            <option value="active">Active (Due for Review)</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </header>

      {/* Topics Grid */}
      <div className="topics-grid">
        {filteredTopics.map(topic => (
          <TopicCard 
            key={topic.id} 
            topic={topic}
            onSelect={() => actions.selectTopic(topic.id)}
            onStartReview={() => actions.startTopicReview(topic.id)}
          />
        ))}
      </div>

      {filteredTopics.length === 0 && (
        <div className="empty-state">
          <p>No topics found matching your criteria.</p>
        </div>
      )}
    </div>
  );
};
```

#### Topic Card Component
```typescript
// frontend/src/components/TopicCard.tsx
interface TopicCardProps {
  topic: Topic & { progress: TopicProgress };
  onSelect: () => void;
  onStartReview: () => void;
}

const TopicCard: React.FC<TopicCardProps> = ({ 
  topic, 
  onSelect, 
  onStartReview 
}) => {
  const progressPercentage = topic.progress.totalQuestions > 0 
    ? (topic.progress.masteredQuestions / topic.progress.totalQuestions) * 100 
    : 0;

  const isCompleted = progressPercentage === 100;
  const hasDueReviews = topic.progress.nextReviewCount > 0;

  return (
    <div 
      className={`topic-card ${isCompleted ? 'completed' : ''} ${hasDueReviews ? 'has-due' : ''}`}
      onClick={onSelect}
    >
      {/* Topic Header */}
      <div className="topic-header">
        <div 
          className="topic-icon"
          style={{ backgroundColor: topic.color }}
        >
          {topic.icon}
        </div>
        <div className="topic-info">
          <h3>{topic.name}</h3>
          <p>{topic.description}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="progress-stats">
          <span>{topic.progress.masteredQuestions}/{topic.progress.totalQuestions} mastered</span>
          <span>{progressPercentage.toFixed(0)}%</span>
        </div>
      </div>

      {/* Topic Stats */}
      <div className="topic-stats">
        <div className="stat">
          <span className="stat-label">Retention</span>
          <span className="stat-value">{topic.progress.retentionRate.toFixed(0)}%</span>
        </div>
        <div className="stat">
          <span className="stat-label">Avg Stability</span>
          <span className="stat-value">{topic.progress.averageStability.toFixed(1)}d</span>
        </div>
        <div className="stat">
          <span className="stat-label">Due Now</span>
          <span className="stat-value">{topic.progress.nextReviewCount}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="topic-actions">
        {hasDueReviews && (
          <button 
            className="btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              onStartReview();
            }}
          >
            Review ({topic.progress.nextReviewCount})
          </button>
        )}
        <button 
          className="btn-secondary"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          View Details
        </button>
      </div>

      {/* Due Indicator */}
      {hasDueReviews && (
        <div className="due-indicator">
          {topic.progress.nextReviewCount} due
        </div>
      )}
    </div>
  );
};
```

## Phase 3: Statistics Component Modernization

### Step 1: FSRS Statistics Integration

```typescript
// frontend/src/pages/Statistics-Unified.tsx
import React, { useState, useMemo } from 'react';
import { useUnifiedStore } from '../store/unified';

const StatisticsUnified: React.FC = () => {
  const { 
    data: stats, 
    loading, 
    error 
  } = useUnifiedStore('fsrsStats');

  const { data: progress } = useUnifiedStore('userProgress');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

  // Calculate comprehensive statistics
  const calculatedStats = useMemo(() => {
    if (!stats || !progress) return null;

    const now = new Date();
    const timeRangeMs = {
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000
    }[timeRange];

    const recentProgress = progress.filter(p => 
      new Date(p.lastReview).getTime() > now.getTime() - timeRangeMs
    );

    return {
      // Overall Statistics
      totalCards: progress.length,
      matureCards: progress.filter(p => p.fsrsData?.stability > 21).length,
      youngCards: progress.filter(p => p.fsrsData?.stability <= 21).length,
      newCards: progress.filter(p => p.fsrsData?.reps === 0).length,
      
      // Performance Metrics
      averageStability: progress.reduce((sum, p) => 
        sum + (p.fsrsData?.stability || 0), 0
      ) / progress.length,
      retentionRate: recentProgress.filter(p => p.lastRating >= 3).length / 
                     recentProgress.length * 100,
      
      // Study Patterns
      dailyReviews: recentProgress.length / (timeRangeMs / (24 * 60 * 60 * 1000)),
      studyStreak: calculateStudyStreak(progress),
      totalStudyTime: calculateTotalStudyTime(progress, timeRange),
      
      // Difficulty Analysis
      difficultCards: progress.filter(p => p.fsrsData?.difficulty > 7).length,
      easyCards: progress.filter(p => p.fsrsData?.difficulty < 3).length,
      
      // Projections
      upcomingReviews: calculateUpcomingReviews(progress),
      workloadDistribution: calculateWorkloadDistribution(progress)
    };
  }, [stats, progress, timeRange]);

  if (loading) {
    return <LoadingSpinner message="Loading statistics..." />;
  }

  if (error) {
    return <ErrorBoundary error={error} />;
  }

  if (!calculatedStats) {
    return <div>No statistics available</div>;
  }

  return (
    <div className="statistics-container">
      <header className="statistics-header">
        <h1>Learning Statistics</h1>
        
        {/* Time Range Selector */}
        <div className="time-range-selector">
          {(['week', 'month', 'year'] as const).map(range => (
            <button
              key={range}
              className={`time-range-btn ${timeRange === range ? 'active' : ''}`}
              onClick={() => setTimeRange(range)}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </header>

      <div className="statistics-content">
        {/* Key Metrics */}
        <section className="key-metrics">
          <h2>Key Metrics</h2>
          <div className="metrics-grid">
            <MetricCard
              title="Total Cards"
              value={calculatedStats.totalCards}
              subtitle="In your collection"
              icon="📚"
            />
            <MetricCard
              title="Retention Rate"
              value={`${calculatedStats.retentionRate.toFixed(1)}%`}
              subtitle="Questions remembered"
              icon="🎯"
              trend={calculatedStats.retentionRate > 85 ? 'positive' : 'neutral'}
            />
            <MetricCard
              title="Average Stability"
              value={`${calculatedStats.averageStability.toFixed(1)} days`}
              subtitle="Memory strength"
              icon="🧠"
            />
            <MetricCard
              title="Study Streak"
              value={`${calculatedStats.studyStreak} days`}
              subtitle="Consecutive days"
              icon="🔥"
              trend={calculatedStats.studyStreak > 7 ? 'positive' : 'neutral'}
            />
          </div>
        </section>

        {/* Card Distribution */}
        <section className="card-distribution">
          <h2>Card Distribution</h2>
          <div className="distribution-chart">
            <div className="distribution-bar">
              <div 
                className="segment new-cards"
                style={{ width: `${(calculatedStats.newCards / calculatedStats.totalCards) * 100}%` }}
                title={`${calculatedStats.newCards} new cards`}
              />
              <div 
                className="segment young-cards"
                style={{ width: `${(calculatedStats.youngCards / calculatedStats.totalCards) * 100}%` }}
                title={`${calculatedStats.youngCards} young cards`}
              />
              <div 
                className="segment mature-cards"
                style={{ width: `${(calculatedStats.matureCards / calculatedStats.totalCards) * 100}%` }}
                title={`${calculatedStats.matureCards} mature cards`}
              />
            </div>
            <div className="distribution-legend">
              <div className="legend-item">
                <span className="legend-color new-cards"></span>
                <span>New ({calculatedStats.newCards})</span>
              </div>
              <div className="legend-item">
                <span className="legend-color young-cards"></span>
                <span>Young ({calculatedStats.youngCards})</span>
              </div>
              <div className="legend-item">
                <span className="legend-color mature-cards"></span>
                <span>Mature ({calculatedStats.matureCards})</span>
              </div>
            </div>
          </div>
        </section>

        {/* Workload Projection */}
        <section className="workload-projection">
          <h2>Upcoming Workload</h2>
          <WorkloadChart data={calculatedStats.workloadDistribution} />
        </section>

        {/* Study Patterns */}
        <section className="study-patterns">
          <h2>Study Patterns</h2>
          <div className="patterns-grid">
            <div className="pattern-card">
              <h3>Daily Average</h3>
              <div className="pattern-value">
                {calculatedStats.dailyReviews.toFixed(1)} reviews
              </div>
            </div>
            <div className="pattern-card">
              <h3>Study Time</h3>
              <div className="pattern-value">
                {Math.round(calculatedStats.totalStudyTime)} minutes
              </div>
            </div>
            <div className="pattern-card">
              <h3>Difficult Cards</h3>
              <div className="pattern-value">
                {calculatedStats.difficultCards} cards
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
```

### Step 2: Statistics Helper Functions

```typescript
// frontend/src/utils/statisticsHelpers.ts
export const calculateStudyStreak = (progress: UserProgress[]): number => {
  const today = new Date();
  let streak = 0;
  
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    
    const hasStudied = progress.some(p => {
      const reviewDate = new Date(p.lastReview);
      return reviewDate.toDateString() === checkDate.toDateString();
    });
    
    if (hasStudied) {
      streak++;
    } else if (i > 0) {
      break; // Streak broken
    }
  }
  
  return streak;
};

export const calculateTotalStudyTime = (
  progress: UserProgress[], 
  timeRange: 'week' | 'month' | 'year'
): number => {
  const now = new Date();
  const timeRangeMs = {
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000
  }[timeRange];

  const recentProgress = progress.filter(p => 
    new Date(p.lastReview).getTime() > now.getTime() - timeRangeMs
  );

  // Estimate 2 minutes per review
  return recentProgress.length * 2;
};

export const calculateUpcomingReviews = (progress: UserProgress[]) => {
  const now = new Date();
  const periods = [
    { name: 'Today', days: 0 },
    { name: 'Tomorrow', days: 1 },
    { name: 'Next 7 days', days: 7 },
    { name: 'Next 30 days', days: 30 }
  ];

  return periods.map(period => {
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + period.days);
    
    const count = progress.filter(p => {
      const dueDate = new Date(p.nextReview);
      return period.days === 0 
        ? dueDate.toDateString() === now.toDateString()
        : dueDate <= targetDate;
    }).length;

    return { ...period, count };
  });
};
```

## Component Integration Testing

### Settings Testing
```typescript
// frontend/src/__tests__/Settings-Unified.test.tsx
describe('Settings-Unified', () => {
  it('updates FSRS settings correctly', async () => {
    const mockUpdateSettings = jest.fn();
    
    render(<SettingsUnified />);
    
    // Change retention rate
    const retentionSlider = screen.getByLabelText(/target retention rate/i);
    fireEvent.change(retentionSlider, { target: { value: '0.85' } });
    
    // Save settings
    fireEvent.click(screen.getByText('Save Changes'));
    
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          fsrs: expect.objectContaining({
            requestRetention: 0.85
          })
        })
      );
    });
  });
});
```

### Topics Testing
```typescript
// frontend/src/__tests__/Topics-Unified.test.tsx
describe('Topics-Unified', () => {
  it('displays topics with correct progress', async () => {
    const mockTopics = [