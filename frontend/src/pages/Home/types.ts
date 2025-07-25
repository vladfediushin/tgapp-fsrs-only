// Home Component Types and Interfaces
import React from 'react'
import type { UserOut, UserStats, DailyProgress, AnswersByDay } from '../../api/api'
import type { FSRSStats } from '../../api/fsrs'

// ============================================================================
// Container Props and State Interfaces
// ============================================================================

export interface HomeContainerState {
  // User data
  user: UserOut | null
  userName: string | null
  
  // Statistics
  userStats: UserStats | null
  dailyProgress: DailyProgress | null
  streakDays: AnswersByDay[]
  
  // FSRS data
  fsrsStats: FSRSStats | null
  
  // Computed values
  dailyGoal: number | null
  currentStreak: number
  goalProgress: number
  isProgressCurrent: boolean
  
  // Loading states
  loading: {
    user: boolean
    stats: boolean
    progress: boolean
    streak: boolean
    fsrs: boolean
    initialization: boolean
  }
  
  // Error states
  errors: {
    user: string | null
    stats: string | null
    progress: string | null
    streak: string | null
    fsrs: string | null
    general: string | null
  }
  
  // Settings
  settings: {
    examCountry: string
    examLanguage: string
    examDate: string | null
    manualDailyGoal: number | null
    useFSRS: boolean
    uiLanguage: string
  }
}

export interface HomeContainerActions {
  // Navigation actions
  navigateToMode: () => void
  navigateToNewQuestions: () => void
  navigateToIncorrectQuestions: () => void
  navigateToExamSettings: () => void
  
  // Settings actions
  toggleFSRS: () => void
  updateSettings: (updates: Partial<HomeContainerState['settings']>) => void
  
  // Data actions
  refreshData: () => Promise<void>
  initializeData: () => Promise<void>
  
  // Error handling
  clearError: (errorType: keyof HomeContainerState['errors']) => void
  clearAllErrors: () => void
}

// ============================================================================
// Presenter Props Interface
// ============================================================================

export interface HomePresenterProps {
  // State data
  state: HomeContainerState
  
  // Action handlers
  actions: HomeContainerActions
  
  // Utility functions
  getProgressMessage: (questionsToday: number, dailyGoal: number) => string
  getStreakText: (streak: number) => string
  
  // Component configuration
  config: {
    showCacheIndicator?: boolean
    enableAnimations?: boolean
    theme?: 'light' | 'dark'
  }
}

// ============================================================================
// Component-specific Types
// ============================================================================

export interface ProgressCardProps {
  isProgressCurrent: boolean
  finalDailyGoal: number | null
  todayQuestionsMastered: number
  goalProgress: number
  currentStreak: number
  examDate: string | null
  loading: {
    user: boolean
    streak: boolean
  }
  settings: {
    examCountry: string
    examLanguage: string
  }
  onExamSettingsClick: () => void
  getProgressMessage: (questionsToday: number, dailyGoal: number) => string
  getStreakText: (streak: number) => string
}

export interface QuickActionsProps {
  onStartRevision: () => void
  onNewQuestions: () => void
  onIncorrectQuestions: () => void
}

export interface FSRSSettingsProps {
  useFSRS: boolean
  onToggleFSRS: () => void
}

export interface OverallProgressProps {
  userStats: UserStats | null
  loading: boolean
}

export interface FSRSStatsProps {
  fsrsStats: FSRSStats | null
  loading: boolean
}

// ============================================================================
// Error Boundary Types
// ============================================================================

export interface HomeErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: any
}

export interface HomeErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>
  onError?: (error: Error, errorInfo: any) => void
}

// ============================================================================
// Hook Return Types
// ============================================================================

export interface UseHomeContainerReturn {
  state: HomeContainerState
  actions: HomeContainerActions
  isReady: boolean
}

export interface UseHomeDataReturn {
  data: {
    user: UserOut | null
    userStats: UserStats | null
    dailyProgress: DailyProgress | null
    streakDays: AnswersByDay[]
    fsrsStats: FSRSStats | null
  }
  loading: HomeContainerState['loading']
  errors: HomeContainerState['errors']
  refresh: () => Promise<void>
}

// ============================================================================
// Utility Types
// ============================================================================

export type HomeLoadingKey = keyof HomeContainerState['loading']
export type HomeErrorKey = keyof HomeContainerState['errors']
export type HomeSettingsKey = keyof HomeContainerState['settings']

export interface HomeMetrics {
  loadTime: number
  apiCalls: number
  cacheHits: number
  errors: number
}

// ============================================================================
// Constants
// ============================================================================

export const HOME_CONSTANTS = {
  DEFAULT_BATCH_SIZE: 30,
  STREAK_DAYS_COUNT: 7,
  PROGRESS_ANIMATION_DURATION: 1000,
  ERROR_DISPLAY_DURATION: 5000,
  REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes
} as const

export const HOME_ROUTES = {
  MODE_SELECT: '/mode',
  EXAM_SETTINGS: '/exam-settings',
  REPEAT_NEW: '/repeat?mode=new_only&batchSize=30',
  REPEAT_INCORRECT: '/repeat?mode=incorrect&batchSize=30',
} as const