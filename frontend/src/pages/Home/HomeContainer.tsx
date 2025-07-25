// HomeContainer.tsx - Business Logic and Data Management
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'

// Unified Store Integration
import { 
  useUnifiedStore, 
  useUnifiedActions, 
  useUnifiedUser,
  useUnifiedUserStats,
  useUnifiedDailyProgress,
  useUnifiedExamSettings,
  useUnifiedStreakDays,
  useUnifiedSettings,
  useUnifiedLoading,
  useUnifiedErrors
} from '../../store/unified'
import { useStoreMigration } from '../../utils/storeMigration'

// Utilities
import { calculateDailyGoal } from '../../utils/dailyGoals'
import { calculateCurrentStreak } from '../../utils/streakUtils'
import { getStreakText } from '../../utils/pluralUtils'

// Types
import type { 
  HomeContainerState, 
  HomeContainerActions, 
  UseHomeContainerReturn,
  HOME_ROUTES 
} from './types'

// Components
import HomePresenter from './HomePresenter'
import HomeErrorBoundary from './HomeErrorBoundary'

// ============================================================================
// Custom Hooks
// ============================================================================

/**
 * Custom hook for managing Home container state and actions
 */
const useHomeContainer = (): UseHomeContainerReturn => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const migration = useStoreMigration('Home')

  // Unified store hooks
  const user = useUnifiedUser()
  const userStats = useUnifiedUserStats()
  const dailyProgress = useUnifiedDailyProgress()
  const examSettings = useUnifiedExamSettings()
  const streakDays = useUnifiedStreakDays()
  const settings = useUnifiedSettings()
  const loading = useUnifiedLoading()
  const errors = useUnifiedErrors()
  const actions = useUnifiedActions()

  // Local state
  const [userName, setUserName] = useState<string | null>(null)
  const [dataInitialized, setDataInitialized] = useState(false)
  const [initializationError, setInitializationError] = useState<string | null>(null)

  // ============================================================================
  // Data Initialization
  // ============================================================================

  const initializeData = useCallback(async (): Promise<void> => {
    try {
      setInitializationError(null)
      
      const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user
      setUserName(tgUser?.first_name || 'друг')

      if (!tgUser?.id) {
        console.warn('🏠 HomeContainer: No Telegram user ID available')
        setDataInitialized(true)
        return
      }

      console.log('🏠 HomeContainer: Initializing with unified store')
      
      // Preload critical data using migration helper
      await migration.preloadData(tgUser.id.toString())
      
      // Update UI language if user data is available
      if (user?.ui_language) {
        actions.updateSettings({ uiLanguage: user.ui_language })
        i18n.changeLanguage(user.ui_language)
      }
      
      setDataInitialized(true)
      console.log('✅ HomeContainer: Data initialization complete')
      
    } catch (error) {
      console.error('❌ HomeContainer: Failed to initialize data:', error)
      setInitializationError(error instanceof Error ? error.message : 'Initialization failed')
      setDataInitialized(true)
    }
  }, [user?.ui_language, actions, migration])

  // Initialize data on mount
  useEffect(() => {
    initializeData()
  }, [initializeData])

  // ============================================================================
  // Computed Values
  // ============================================================================

  const computedValues = useMemo(() => {
    // Calculate daily goal
    const dailyGoalData = userStats
      ? calculateDailyGoal(settings.examDate, userStats.total_questions, userStats.correct)
      : null

    const finalDailyGoal = settings.manualDailyGoal ?? dailyGoalData?.dailyGoal ?? null
    const todayQuestionsMastered = dailyProgress?.questions_mastered_today || 0
    const goalProgress = finalDailyGoal && finalDailyGoal > 0
      ? Math.min((todayQuestionsMastered / finalDailyGoal) * 100, 100)
      : 0

    // Calculate streak
    const streakProgress = streakDays?.map(day => day.correct_answers) || []
    const currentStreak = finalDailyGoal && finalDailyGoal > 0
      ? calculateCurrentStreak(streakProgress, finalDailyGoal)
      : 0

    // Check if progress is current
    const today = new Date().toISOString().split('T')[0]
    const isProgressCurrent = dailyProgress?.date === today

    return {
      dailyGoal: finalDailyGoal,
      todayQuestionsMastered,
      goalProgress,
      currentStreak,
      isProgressCurrent
    }
  }, [userStats, settings, dailyProgress, streakDays])

  // ============================================================================
  // Navigation Actions
  // ============================================================================

  const navigationActions = useMemo(() => ({
    navigateToMode: () => navigate('/mode'),
    
    navigateToNewQuestions: () => {
      const params = new URLSearchParams({
        mode: 'new_only',
        batchSize: '30',
      })
      navigate(`/repeat?${params.toString()}`)
    },
    
    navigateToIncorrectQuestions: () => {
      const params = new URLSearchParams({
        mode: 'incorrect',
        batchSize: '30',
      })
      navigate(`/repeat?${params.toString()}`)
    },
    
    navigateToExamSettings: () => navigate('/exam-settings')
  }), [navigate])

  // ============================================================================
  // Settings Actions
  // ============================================================================

  const settingsActions = useMemo(() => ({
    toggleFSRS: () => {
      actions.updateSettings({ useFSRS: !settings.useFSRS })
    },
    
    updateSettings: (updates: Partial<HomeContainerState['settings']>) => {
      actions.updateSettings(updates)
    }
  }), [actions, settings.useFSRS])

  // ============================================================================
  // Data Actions
  // ============================================================================

  const dataActions = useMemo(() => ({
    refreshData: async (): Promise<void> => {
      if (!user?.id) return
      
      try {
        await actions.refreshAllData(user.id)
      } catch (error) {
        console.error('Failed to refresh data:', error)
        throw error
      }
    },
    
    initializeData
  }), [user?.id, actions, initializeData])

  // ============================================================================
  // Error Handling
  // ============================================================================

  const errorActions = useMemo(() => ({
    clearError: (errorType: keyof HomeContainerState['errors']) => {
      if (errorType === 'general') {
        setInitializationError(null)
      } else {
        actions.clearError(errorType as any)
      }
    },
    
    clearAllErrors: () => {
      actions.clearAllErrors()
      setInitializationError(null)
    }
  }), [actions])

  // ============================================================================
  // Container State
  // ============================================================================

  const containerState: HomeContainerState = {
    // User data
    user,
    userName,
    
    // Statistics
    userStats,
    dailyProgress,
    streakDays: streakDays || [],
    
    // FSRS data
    fsrsStats: null, // TODO: Add FSRS stats when available
    
    // Computed values
    dailyGoal: computedValues.dailyGoal,
    currentStreak: computedValues.currentStreak,
    goalProgress: computedValues.goalProgress,
    isProgressCurrent: computedValues.isProgressCurrent,
    
    // Loading states
    loading: {
      user: loading.user || !dataInitialized,
      stats: loading.userStats,
      progress: loading.dailyProgress,
      streak: loading.streakDays,
      fsrs: loading.fsrsStats,
      initialization: !dataInitialized
    },
    
    // Error states
    errors: {
      user: errors.user,
      stats: errors.userStats,
      progress: errors.dailyProgress,
      streak: errors.streakDays,
      fsrs: errors.fsrsStats,
      general: initializationError
    },
    
    // Settings
    settings: {
      examCountry: settings.examCountry,
      examLanguage: settings.examLanguage,
      examDate: settings.examDate,
      manualDailyGoal: settings.manualDailyGoal,
      useFSRS: settings.useFSRS,
      uiLanguage: settings.uiLanguage
    }
  }

  const containerActions: HomeContainerActions = {
    ...navigationActions,
    ...settingsActions,
    ...dataActions,
    ...errorActions
  }

  return {
    state: containerState,
    actions: containerActions,
    isReady: dataInitialized
  }
}

// ============================================================================
// HomeContainer Component
// ============================================================================

const HomeContainer: React.FC = () => {
  const { t } = useTranslation()
  const { state, actions, isReady } = useHomeContainer()

  // Utility functions for presenter
  const getProgressMessage = useCallback((questionsToday: number, dailyGoal: number): string => {
    if (questionsToday === 0) {
      return t('home.progressMessage.start')
    } else if (questionsToday > 0 && questionsToday < dailyGoal) {
      return t('home.progressMessage.keepGoing')
    } else {
      return t('home.progressMessage.excellent')
    }
  }, [t])

  const getStreakTextFormatted = useCallback((streak: number): string => {
    return getStreakText(streak, t)
  }, [t])

  // Don't render until data is initialized
  if (!isReady) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid #e5e7eb',
            borderTop: '3px solid #059669',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            Загружаем ваши данные...
          </p>
        </div>
      </div>
    )
  }

  return (
    <HomeErrorBoundary
      onError={(error, errorInfo) => {
        console.error('HomeContainer Error:', error, errorInfo)
      }}
    >
      <HomePresenter
        state={state}
        actions={actions}
        getProgressMessage={getProgressMessage}
        getStreakText={getStreakTextFormatted}
        config={{
          showCacheIndicator: true,
          enableAnimations: true,
          theme: 'light'
        }}
      />
    </HomeErrorBoundary>
  )
}

export default HomeContainer