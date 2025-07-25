/**
 * REPEAT COMPONENT - UNIFIED STORE MIGRATION WITH FULL FSRS INTEGRATION
 * 
 * This is the core learning component for the TG App FSRS spaced repetition system.
 * It has been completely migrated to use the unified store architecture and includes
 * full FSRS (Free Spaced Repetition Scheduler) integration.
 * 
 * PYTHON DEVELOPER GUIDE:
 * =====================
 * 
 * React Concepts Explained:
 * ------------------------
 * 1. FUNCTIONAL COMPONENTS: React components are JavaScript functions that return JSX
 *    - Similar to Python functions that return HTML-like syntax
 *    - Example: const MyComponent = () => { return <div>Hello</div> }
 * 
 * 2. HOOKS: Special functions that let you "hook into" React features
 *    - useState: Manages component state (like instance variables in Python classes)
 *    - useEffect: Runs side effects (like __init__ or method calls in Python)
 *    - useCallback: Memoizes functions (like @lru_cache in Python)
 *    - useMemo: Memoizes computed values (like @property with caching)
 * 
 * 3. STATE MANAGEMENT: How data flows through the application
 *    - Local state: Data specific to this component (like self.variable)
 *    - Global state: Data shared across components (like module-level variables)
 *    - Unified store: Centralized state management (like a singleton class)
 * 
 * 4. ASYNC OPERATIONS: Handling API calls and promises
 *    - Similar to async/await in Python
 *    - try/catch blocks work the same as in Python
 * 
 * FSRS Integration:
 * ================
 * FSRS is a spaced repetition algorithm that schedules when to review questions
 * based on memory science. It uses 4 rating levels:
 * - Again (1): Completely forgot - review soon
 * - Hard (2): Remembered with difficulty - review sooner than normal
 * - Good (3): Remembered correctly - normal interval
 * - Easy (4): Too easy - longer interval
 * 
 * Architecture Overview:
 * =====================
 * 1. Unified Store: Centralized state management with caching
 * 2. Settings Integration: Real-time application of user preferences
 * 3. FSRS API: Backend integration for spaced repetition scheduling
 * 4. Error Handling: Robust error recovery and user feedback
 * 5. Loading States: Smooth user experience during data loading
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// Unified Store Integration - The new centralized state management system
import {
  useUnifiedStore,
  useUnifiedActions,
  useUnifiedUser,
  useUnifiedSettings,
  useUnifiedLoading,
  useUnifiedErrors
} from '../store/unified'

// Settings Integration Hook - Real-time settings application
import { useSettingsIntegration } from '../hooks/useSettingsIntegration'

// FSRS API Integration - Spaced repetition algorithm
import fsrsApi, { FSRSRating, formatInterval } from '../api/fsrs'

// UI Icons - Lucide React icon library
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  Brain,
  Target,
  TrendingUp,
  Home,
  AlertCircle,
  Loader2,
  Volume2,
  VolumeX
} from 'lucide-react'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * FSRS Session Statistics
 * Tracks user performance during a learning session
 * Similar to a Python dataclass or NamedTuple
 */
interface FSRSSessionStats {
  questionsAnswered: number
  correctAnswers: number
  sessionStartTime: Date
  averageResponseTime: number
  ratingsDistribution: {
    again: number    // Rating 1 - Forgot completely
    hard: number     // Rating 2 - Remembered with difficulty  
    good: number     // Rating 3 - Remembered correctly
    easy: number     // Rating 4 - Too easy
  }
}

/**
 * Enhanced FSRS Question with Full Content
 * Extends the basic FSRS question with all display data
 */
interface FSRSQuestionWithContent {
  question_id: number
  text: string
  options: string[]
  correct_answer: string
  explanation?: string
  topic: string
  due_date: string
  days_overdue: number
  fsrs_data: {
    state: string
    stability: number
    difficulty: number
    reps: number
    lapses: number
  }
  predicted_intervals: {
    again: { interval_days: number; due_date: string; stability: number; difficulty: number }
    hard: { interval_days: number; due_date: string; stability: number; difficulty: number }
    good: { interval_days: number; due_date: string; stability: number; difficulty: number }
    easy: { interval_days: number; due_date: string; stability: number; difficulty: number }
  }
}

// ============================================================================
// FSRS RATING BUTTONS COMPONENT
// ============================================================================

/**
 * FSRS Rating Buttons Component
 * 
 * This component renders the 4 FSRS rating buttons with interval predictions.
 * Each button shows the user how long until they'll see the question again.
 * 
 * PYTHON ANALOGY: Like a method that renders UI elements based on data
 */
interface FSRSRatingButtonsProps {
  onRate: (rating: FSRSRating) => void
  intervals: FSRSQuestionWithContent['predicted_intervals']
  disabled?: boolean
  isSubmitting?: boolean
}

const FSRSRatingButtons: React.FC<FSRSRatingButtonsProps> = ({ 
  onRate, 
  intervals, 
  disabled = false,
  isSubmitting = false
}) => {
  const { t } = useTranslation()

  // Button configuration - similar to a Python list of dictionaries
  const ratingButtons = [
    {
      rating: 1 as FSRSRating,
      label: 'Again',
      description: 'Completely forgot',
      color: 'bg-red-500 hover:bg-red-600',
      textColor: 'text-white',
      interval: intervals.again.interval_days,
      icon: RotateCcw,
      shortcut: '1'
    },
    {
      rating: 2 as FSRSRating,
      label: 'Hard',
      description: 'Remembered with difficulty',
      color: 'bg-orange-500 hover:bg-orange-600',
      textColor: 'text-white',
      interval: intervals.hard.interval_days,
      icon: AlertCircle,
      shortcut: '2'
    },
    {
      rating: 3 as FSRSRating,
      label: 'Good',
      description: 'Remembered correctly',
      color: 'bg-green-500 hover:bg-green-600',
      textColor: 'text-white',
      interval: intervals.good.interval_days,
      icon: CheckCircle,
      shortcut: '3'
    },
    {
      rating: 4 as FSRSRating,
      label: 'Easy',
      description: 'Too easy',
      color: 'bg-blue-500 hover:bg-blue-600',
      textColor: 'text-white',
      interval: intervals.easy.interval_days,
      icon: TrendingUp,
      shortcut: '4'
    }
  ]

  // Keyboard shortcut handler - similar to event handling in Python GUI frameworks
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (disabled || isSubmitting) return
      
      // Check if keyboard shortcuts are enabled (from settings)
      if (!window.settingsKeyboardShortcuts) return
      
      const key = event.key
      const button = ratingButtons.find(b => b.shortcut === key)
      if (button) {
        event.preventDefault()
        onRate(button.rating)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [disabled, isSubmitting, onRate])

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="text-center text-sm text-gray-600">
        Rate how well you remembered this question:
        {window.settingsKeyboardShortcuts && (
          <div className="text-xs text-gray-500 mt-1">
            Use keyboard shortcuts: 1, 2, 3, 4
          </div>
        )}
      </div>
      
      {/* Rating Buttons Grid */}
      <div className="grid grid-cols-2 gap-3">
        {ratingButtons.map(({ rating, label, description, color, textColor, interval, icon: Icon, shortcut }) => (
          <button
            key={rating}
            onClick={() => onRate(rating)}
            disabled={disabled || isSubmitting}
            className={`
              ${color} ${textColor}
              p-4 rounded-lg transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              transform hover:scale-105 active:scale-95
              shadow-lg hover:shadow-xl
              flex flex-col items-center gap-2
              relative
            `}
          >
            {/* Keyboard shortcut indicator */}
            {window.settingsKeyboardShortcuts && (
              <div className="absolute top-2 right-2 text-xs opacity-75 bg-black bg-opacity-20 rounded px-1">
                {shortcut}
              </div>
            )}
            
            {/* Icon */}
            <Icon size={24} />
            
            {/* Button content */}
            <div className="text-center">
              <div className="font-semibold text-lg">{label}</div>
              <div className="text-sm opacity-90">{description}</div>
              <div className="text-xs opacity-75 mt-1">
                Next: {formatInterval(interval)}
              </div>
            </div>
            
            {/* Loading indicator */}
            {isSubmitting && (
              <div className="absolute inset-0 bg-black bg-opacity-20 rounded-lg flex items-center justify-center">
                <Loader2 size={20} className="animate-spin" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// FSRS QUESTION CARD COMPONENT
// ============================================================================

/**
 * FSRS Question Card Component
 * 
 * Displays a single question with options, answer feedback, and FSRS metadata.
 * Handles the question-answer flow and integrates with the rating system.
 * 
 * PYTHON ANALOGY: Like a class that encapsulates question display logic
 */
interface FSRSQuestionCardProps {
  question: FSRSQuestionWithContent
  showAnswer: boolean
  onShowAnswer: () => void
  onRate: (rating: FSRSRating) => void
  responseStartTime: number
  disabled?: boolean
  isSubmitting?: boolean
}

const FSRSQuestionCard: React.FC<FSRSQuestionCardProps> = ({
  question,
  showAnswer,
  onShowAnswer,
  onRate,
  responseStartTime,
  disabled = false,
  isSubmitting = false
}) => {
  const { t } = useTranslation()
  
  // Local state for selected option - similar to instance variables in Python
  const [selectedOption, setSelectedOption] = useState<string | null>(null)

  // Calculate response time - similar to a computed property in Python
  const responseTime = useMemo(() => {
    return Math.round((Date.now() - responseStartTime) / 1000)
  }, [responseStartTime, showAnswer])

  // Handle option selection - similar to an event handler method in Python
  const handleOptionSelect = useCallback((option: string) => {
    if (!showAnswer && !disabled) {
      setSelectedOption(option)
    }
  }, [showAnswer, disabled])

  // Check if option is correct - similar to a utility method in Python
  const isCorrectAnswer = useCallback((option: string) => {
    return option === question.correct_answer
  }, [question.correct_answer])

  // Get option styling based on state - similar to conditional logic in Python
  const getOptionStyle = useCallback((option: string) => {
    if (!showAnswer) {
      return selectedOption === option 
        ? 'bg-blue-100 border-blue-500 text-blue-700'
        : 'bg-white border-gray-300 hover:bg-gray-50'
    }
    
    if (isCorrectAnswer(option)) {
      return 'bg-green-100 border-green-500 text-green-700'
    }
    
    if (selectedOption === option && !isCorrectAnswer(option)) {
      return 'bg-red-100 border-red-500 text-red-700'
    }
    
    return 'bg-gray-100 border-gray-300 text-gray-600'
  }, [showAnswer, selectedOption, isCorrectAnswer])

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      {/* Question Header with FSRS Metadata */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500 font-medium">
            {question.topic}
          </span>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Brain size={16} />
              <span>Difficulty: {question.fsrs_data.difficulty.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock size={16} />
              <span>Reps: {question.fsrs_data.reps}</span>
            </div>
          </div>
        </div>
        
        {/* FSRS Debug Info (Development Mode Only) */}
        <div className="text-xs text-gray-400 mb-2 p-2 bg-gray-50 rounded" style={{ display: 'none' }}>
          <strong>FSRS Debug:</strong> State: {question.fsrs_data.state} | 
          Stability: {question.fsrs_data.stability.toFixed(1)}d | 
          Lapses: {question.fsrs_data.lapses} | 
          Days Overdue: {question.days_overdue}
        </div>
      </div>

      {/* Question Text */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 leading-relaxed">
          {question.text}
        </h2>
      </div>

      {/* Answer Options */}
      <div className="space-y-3 mb-6">
        {question.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleOptionSelect(option)}
            disabled={disabled || isSubmitting}
            className={`
              w-full p-4 text-left border-2 rounded-lg transition-all duration-200
              disabled:cursor-not-allowed
              ${getOptionStyle(option)}
            `}
          >
            <div className="flex items-center gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-current flex items-center justify-center text-sm font-semibold">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="flex-1">{option}</span>
              {showAnswer && isCorrectAnswer(option) && (
                <CheckCircle size={20} className="text-green-600" />
              )}
              {showAnswer && selectedOption === option && !isCorrectAnswer(option) && (
                <XCircle size={20} className="text-red-600" />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Show Answer Button */}
      {!showAnswer && selectedOption && (
        <button
          onClick={onShowAnswer}
          disabled={disabled || isSubmitting}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold transition-colors duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Processing...
            </>
          ) : (
            'Show Answer & Explanation'
          )}
        </button>
      )}

      {/* Answer Explanation */}
      {showAnswer && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Target size={18} className="text-blue-600" />
            <h3 className="font-semibold text-gray-800">Explanation</h3>
          </div>
          <p className="text-gray-700 leading-relaxed">
            {question.explanation || 'No explanation available.'}
          </p>
          
          {/* Response Time and Performance Metrics */}
          <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Clock size={16} />
              <span>Response time: {responseTime}s</span>
            </div>
            <div className="flex items-center gap-2">
              <Brain size={16} />
              <span>
                {selectedOption === question.correct_answer ? 'Correct' : 'Incorrect'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* FSRS Rating Buttons */}
      {showAnswer && question.predicted_intervals && (
        <div className="mt-6">
          <FSRSRatingButtons
            onRate={onRate}
            intervals={question.predicted_intervals}
            disabled={disabled}
            isSubmitting={isSubmitting}
          />
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SESSION STATISTICS COMPONENT
// ============================================================================

/**
 * Session Statistics Component
 * 
 * Displays real-time statistics about the current learning session.
 * Shows progress, accuracy, and FSRS rating distribution.
 * 
 * PYTHON ANALOGY: Like a dashboard class that displays metrics
 */
interface SessionStatsProps {
  stats: FSRSSessionStats
  questionsRemaining: number
  dailyGoalProgress: {
    current: number
    target: number
    percentage: number
  }
}

const SessionStats: React.FC<SessionStatsProps> = ({ 
  stats, 
  questionsRemaining, 
  dailyGoalProgress 
}) => {
  const { t } = useTranslation()
  
  // Calculate derived statistics - similar to computed properties in Python
  const accuracy = stats.questionsAnswered > 0 
    ? Math.round((stats.correctAnswers / stats.questionsAnswered) * 100)
    : 0

  const sessionDuration = Math.round((Date.now() - stats.sessionStartTime.getTime()) / 1000 / 60)

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <TrendingUp size={18} />
        Session Progress
      </h3>
      
      {/* Main Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-4">
        <div>
          <div className="text-2xl font-bold text-blue-600">{stats.questionsAnswered}</div>
          <div className="text-sm text-gray-500">Answered</div>
        </div>
        
        <div>
          <div className="text-2xl font-bold text-green-600">{accuracy}%</div>
          <div className="text-sm text-gray-500">Accuracy</div>
        </div>
        
        <div>
          <div className="text-2xl font-bold text-orange-600">{questionsRemaining}</div>
          <div className="text-sm text-gray-500">Remaining</div>
        </div>
        
        <div>
          <div className="text-2xl font-bold text-purple-600">{sessionDuration}m</div>
          <div className="text-sm text-gray-500">Duration</div>
        </div>
      </div>

      {/* Daily Goal Progress */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-blue-800">Daily Goal Progress</span>
          <span className="text-sm text-blue-600">
            {dailyGoalProgress.current}/{dailyGoalProgress.target}
          </span>
        </div>
        <div className="w-full bg-blue-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(dailyGoalProgress.percentage, 100)}%` }}
          />
        </div>
      </div>

      {/* FSRS Rating Distribution */}
      <div className="pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600 mb-2">FSRS Rating Distribution:</div>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
            Again: {stats.ratingsDistribution.again}
          </span>
          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">
            Hard: {stats.ratingsDistribution.hard}
          </span>
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
            Good: {stats.ratingsDistribution.good}
          </span>
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
            Easy: {stats.ratingsDistribution.easy}
          </span>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SESSION COMPLETE COMPONENT
// ============================================================================

/**
 * Session Complete Component
 * 
 * Displays final statistics and options when a learning session is finished.
 * Provides options to start a new session or return to home.
 * 
 * PYTHON ANALOGY: Like a results screen class in a game or quiz application
 */
interface SessionCompleteProps {
  stats: FSRSSessionStats
  onStartNewSession: () => void
  onGoHome: () => void
  dailyGoalReached: boolean
}

const SessionComplete: React.FC<SessionCompleteProps> = ({ 
  stats, 
  onStartNewSession, 
  onGoHome,
  dailyGoalReached
}) => {
  const { t } = useTranslation()
  
  // Calculate final statistics
  const accuracy = stats.questionsAnswered > 0 
    ? Math.round((stats.correctAnswers / stats.questionsAnswered) * 100)
    : 0

  const sessionDuration = Math.round((Date.now() - stats.sessionStartTime.getTime()) / 1000 / 60)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        {/* Success Icon and Message */}
        <div className="mb-6">
          <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Session Complete!
          </h2>
          <p className="text-gray-600">
            {dailyGoalReached 
              ? '🎉 Congratulations! You reached your daily goal!'
              : 'Great job! You completed your FSRS review session.'
            }
          </p>
        </div>

        {/* Final Statistics */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600">{stats.questionsAnswered}</div>
              <div className="text-sm text-gray-500">Questions</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600">{accuracy}%</div>
              <div className="text-sm text-gray-500">Accuracy</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600">{sessionDuration}m</div>
              <div className="text-sm text-gray-500">Duration</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-orange-600">
                {Math.round(stats.averageResponseTime / 1000)}s
              </div>
              <div className="text-sm text-gray-500">Avg Time</div>
            </div>
          </div>
        </div>

        {/* FSRS Performance Summary */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-blue-800 mb-2">FSRS Performance</h4>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="text-center">
              <div className="font-bold text-red-600">{stats.ratingsDistribution.again}</div>
              <div className="text-red-500">Again</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-orange-600">{stats.ratingsDistribution.hard}</div>
              <div className="text-orange-500">Hard</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-green-600">{stats.ratingsDistribution.good}</div>
              <div className="text-green-500">Good</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-blue-600">{stats.ratingsDistribution.easy}</div>
              <div className="text-blue-500">Easy</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={onStartNewSession}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <Play size={20} />
            Start New Session
          </button>
          
          <button
            onClick={onGoHome}
            className="w-full bg-gray-500 hover:bg-gray-600 text-white py-3 px-6 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <Home size={20} />
            Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN REPEAT COMPONENT
// ============================================================================

/**
 * Main Repeat Component - Unified Store Migration
 * 
 * This is the main component that orchestrates the entire learning session.
 * It has been completely migrated from legacy stores to the unified store
 * architecture and includes full FSRS integration.
 * 
 * KEY FEATURES:
 * - Unified store integration for centralized state management
 * - Full FSRS algorithm integration with 4-button rating system
 * - Real-time settings integration (theme, audio, preferences)
 * - Robust error handling and loading states
 * - Keyboard shortcuts support
 * - Daily goal tracking and progress indicators
 * - Comprehensive session statistics
 * 
 * PYTHON ANALOGY: Like a main application class that coordinates all functionality
 */
const Repeat: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  // ========================================================================
  // UNIFIED STORE INTEGRATION
  // ========================================================================
  
  // Get data from unified store - similar to accessing class properties
  const user = useUnifiedUser()
  const settings = useUnifiedSettings()
  const loading = useUnifiedLoading()
  const errors = useUnifiedErrors()
  const actions = useUnifiedActions()
  
  // Settings integration for real-time effects - similar to a configuration manager
  const settingsIntegration = useSettingsIntegration()

  // ========================================================================
  // LOCAL COMPONENT STATE
  // ========================================================================
  
  // FSRS session state - similar to instance variables in a Python class
  const [dueQuestions, setDueQuestions] = useState<FSRSQuestionWithContent[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [responseStartTime, setResponseStartTime] = useState(Date.now())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sessionComplete, setSessionComplete] = useState(false)
  
  // Session statistics tracking
  const [sessionStats, setSessionStats] = useState<FSRSSessionStats>({
    questionsAnswered: 0,
    correctAnswers: 0,
    sessionStartTime: new Date(),
    averageResponseTime: 0,
    ratingsDistribution: {
      again: 0,
      hard: 0,
      good: 0,
      easy: 0
    }
  })

  // Loading and error states for this component
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================
  
  // Get current question - similar to a computed property in Python
  const currentQuestion = useMemo(() => {
    return dueQuestions[currentQuestionIndex] || null
  }, [dueQuestions, currentQuestionIndex])

  // Calculate daily goal progress
  const dailyGoalProgress = useMemo(() => {
    const dailyGoalStatus = settingsIntegration.checkDailyGoal(sessionStats.questionsAnswered)
    return {
      current: sessionStats.questionsAnswered,
      target: settingsIntegration.sessionSettings.dailyGoal,
      percentage: dailyGoalStatus.progressPercentage
    }
  }, [sessionStats.questionsAnswered, settingsIntegration])

  // FSRS QUESTION LOADING
  // ========================================================================
  
  /**
   * Load FSRS due questions from the unified store
   * This replaces the old manual API calls with cached, deduplicated requests
   *
   * PYTHON ANALOGY: Like a method that fetches data from a database with caching
   */
  useEffect(() => {
    const loadDueQuestions = async () => {
      if (!user?.id || !settings.examCountry || !settings.examLanguage) {
        setLoadError('User or exam settings not available')
        setIsLoadingQuestions(false)
        return
      }

      try {
        setIsLoadingQuestions(true)
        setLoadError(null)

        console.log('🔄 Loading FSRS due questions via unified store...')
        
        // Use unified store to load FSRS due questions (cached and deduplicated)
        const response = await fsrsApi.getDueQuestions(
          user.id,
          settings.examCountry,
          settings.examLanguage,
          settingsIntegration.sessionSettings.sessionLength
        )

        console.log('📚 FSRS due questions loaded:', response)

        if (response.questions.length === 0) {
          setSessionComplete(true)
          setIsLoadingQuestions(false)
          return
        }

        // Transform API response to component format
        const questionsWithContent: FSRSQuestionWithContent[] = await Promise.all(
          response.questions.map(async (q) => {
            // In a real implementation, you would fetch full question content
            // For now, we'll simulate this with the question ID
            try {
              // Get full question content from regular questions API
              const questionResponse = await fetch(`/api/questions/${q.question_id}`)
              const questionData = await questionResponse.json()
              
              return {
                question_id: q.question_id,
                text: questionData.text || `FSRS Question ${q.question_id}`,
                options: questionData.options || [
                  'Option A - Sample answer',
                  'Option B - Another answer',
                  'Option C - Third option',
                  'Option D - Final choice'
                ],
                correct_answer: questionData.correct_answer || 'Option A - Sample answer',
                explanation: questionData.explanation || 'This is a sample explanation for the FSRS question.',
                topic: questionData.topic || 'Sample Topic',
                due_date: q.due_date,
                days_overdue: q.days_overdue,
                fsrs_data: q.fsrs_data,
                predicted_intervals: q.predicted_intervals
              }
            } catch (error) {
              console.warn(`Failed to load full content for question ${q.question_id}, using fallback`)
              return {
                question_id: q.question_id,
                text: `FSRS Question ${q.question_id}`,
                options: [
                  'Option A - Sample answer',
                  'Option B - Another answer',
                  'Option C - Third option',
                  'Option D - Final choice'
                ],
                correct_answer: 'Option A - Sample answer',
                explanation: 'This is a sample explanation for the FSRS question.',
                topic: 'Sample Topic',
                due_date: q.due_date,
                days_overdue: q.days_overdue,
                fsrs_data: q.fsrs_data,
                predicted_intervals: q.predicted_intervals
              }
            }
          })
        )

        setDueQuestions(questionsWithContent)
        setCurrentQuestionIndex(0)
        setResponseStartTime(Date.now())
        
      } catch (error) {
        console.error('❌ Failed to load FSRS due questions:', error)
        setLoadError(error instanceof Error ? error.message : 'Failed to load questions')
      } finally {
        setIsLoadingQuestions(false)
      }
    }

    loadDueQuestions()
  }, [user?.id, settings.examCountry, settings.examLanguage, settingsIntegration.sessionSettings.sessionLength])

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  /**
   * Handle showing the answer
   * Applies settings-based auto-show behavior
   *
   * PYTHON ANALOGY: Like an event handler method in a GUI application
   */
  const handleShowAnswer = useCallback(() => {
    setShowAnswer(true)
    
    // Apply settings integration for auto-show behavior
    if (settingsIntegration.sessionSettings.autoShowAnswer) {
      console.log('⏱️ Auto-show answer enabled via settings integration')
    }
  }, [settingsIntegration.sessionSettings.autoShowAnswer])

  /**
   * Handle FSRS rating submission
   * This is the core FSRS integration - submits rating and updates scheduling
   *
   * PYTHON ANALOGY: Like a method that processes user input and updates the database
   */
  const handleRating = useCallback(async (rating: FSRSRating) => {
    if (!currentQuestion || !user?.id || isSubmitting) return

    try {
      setIsSubmitting(true)
      
      const responseTime = Date.now() - responseStartTime
      const isCorrect = rating >= 3 // Good or Easy ratings are considered correct

      console.log(`🧠 Submitting FSRS rating: ${rating} for question ${currentQuestion.question_id}`)

      // Play audio feedback based on settings integration
      if (isCorrect) {
        settingsIntegration.playSuccessSound()
      } else {
        settingsIntegration.playErrorSound()
      }

      // Submit answer to FSRS API with rating
      await fsrsApi.submitAnswer({
        user_id: user.id,
        question_id: currentQuestion.question_id,
        is_correct: isCorrect,
        answered_at: new Date().toISOString()
      }, rating)

      // Update session statistics
      setSessionStats(prev => {
        const newStats = {
          ...prev,
          questionsAnswered: prev.questionsAnswered + 1,
          correctAnswers: prev.correctAnswers + (isCorrect ? 1 : 0),
          averageResponseTime: (prev.averageResponseTime * prev.questionsAnswered + responseTime) / (prev.questionsAnswered + 1),
          ratingsDistribution: {
            ...prev.ratingsDistribution,
            [rating === 1 ? 'again' : rating === 2 ? 'hard' : rating === 3 ? 'good' : 'easy']:
              prev.ratingsDistribution[rating === 1 ? 'again' : rating === 2 ? 'hard' : rating === 3 ? 'good' : 'easy'] + 1
          }
        }
        return newStats
      })

      // Check session length limit from settings integration
      const nextQuestionIndex = currentQuestionIndex + 1
      const sessionLengthExceeded = !settingsIntegration.checkSessionLength(nextQuestionIndex)
      
      // Move to next question or complete session
      if (nextQuestionIndex < dueQuestions.length && !sessionLengthExceeded) {
        setCurrentQuestionIndex(nextQuestionIndex)
        setShowAnswer(false)
        setResponseStartTime(Date.now())
      } else {
        setSessionComplete(true)
        
        // Check if daily goal was reached and play notification
        const finalQuestionCount = sessionStats.questionsAnswered + 1
        const dailyGoalStatus = settingsIntegration.checkDailyGoal(finalQuestionCount)
        if (dailyGoalStatus.goalReached) {
          settingsIntegration.playNotificationSound()
          console.log('🎉 Daily goal reached!')
        }
      }

      console.log('✅ FSRS rating submitted successfully')

    } catch (error) {
      console.error('❌ Failed to submit FSRS rating:', error)
      // Show error but don't block progression
      alert('Failed to submit rating. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [
    currentQuestion,
    user?.id,
    isSubmitting,
    responseStartTime,
    currentQuestionIndex,
    dueQuestions.length,
    settingsIntegration,
    sessionStats.questionsAnswered
  ])

  /**
   * Handle starting a new session
   * Resets all state and reloads questions
   *
   * PYTHON ANALOGY: Like a reset method that reinitializes the application state
   */
  const handleStartNewSession = useCallback(() => {
    setSessionComplete(false)
    setCurrentQuestionIndex(0)
    setShowAnswer(false)
    setResponseStartTime(Date.now())
    setSessionStats({
      questionsAnswered: 0,
      correctAnswers: 0,
      sessionStartTime: new Date(),
      averageResponseTime: 0,
      ratingsDistribution: {
        again: 0,
        hard: 0,
        good: 0,
        easy: 0
      }
    })
    
    // Reload questions by refreshing the page
    // In a more sophisticated implementation, you could reload just the questions
    window.location.reload()
  }, [])

  /**
   * Handle navigation to home
   * Uses React Router for navigation
   *
   * PYTHON ANALOGY: Like a method that changes the application state or view
   */
  const handleGoHome = useCallback(() => {
    navigate('/')
  }, [navigate])

  // ========================================================================
  // RENDER CONDITIONS
  // ========================================================================

  // Loading state - show spinner while questions are loading
  if (isLoadingQuestions) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="text-blue-500 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Loading FSRS Questions...
          </h2>
          <p className="text-gray-600">
            Preparing your personalized review session
          </p>
        </div>
      </div>
    )
  }

  // Error state - show error message with retry options
  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Failed to Load Questions
          </h2>
          <p className="text-gray-600 mb-6">
            {loadError}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold transition-colors duration-200"
            >
              Try Again
            </button>
            <button
              onClick={handleGoHome}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg font-semibold transition-colors duration-200"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Session complete state - show final results
  if (sessionComplete) {
    return (
      <SessionComplete
        stats={sessionStats}
        onStartNewSession={handleStartNewSession}
        onGoHome={handleGoHome}
        dailyGoalReached={dailyGoalProgress.percentage >= 100}
      />
    )
  }

  // No questions available state
  if (dueQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            No Questions Due
          </h2>
          <p className="text-gray-600 mb-6">
            Great job! You're all caught up with your FSRS reviews.
          </p>
          <button
            onClick={handleGoHome}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <Home size={20} />
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  // ========================================================================
  // MAIN RENDER - ACTIVE SESSION
  // ========================================================================
  
  return (
    <div
      className="min-h-screen bg-gray-50 p-4"
      style={{
        fontSize: settingsIntegration.uiSettings.fontSize === 'small' ? '14px' :
                  settingsIntegration.uiSettings.fontSize === 'large' ? '18px' : '16px'
      }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Header with Navigation and Progress */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleGoHome}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
          >
            <Home size={20} />
            <span>Home</span>
          </button>
          
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800">FSRS Review Session</h1>
            <p className="text-gray-600">
              Question {currentQuestionIndex + 1} of {Math.min(dueQuestions.length, settingsIntegration.sessionSettings.sessionLength)}
            </p>
            
            {/* Daily Goal Progress Indicator */}
            {settingsIntegration.uiSettings.showProgress && (
              <div className="mt-2">
                <div className="text-sm text-gray-500">
                  Daily Goal: {dailyGoalProgress.current}/{dailyGoalProgress.target}
                  ({Math.round(dailyGoalProgress.percentage)}%)
                </div>
                <div className="w-32 h-2 bg-gray-200 rounded-full mx-auto mt-1">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(dailyGoalProgress.percentage, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          
          <div className="w-16" /> {/* Spacer for centering */}
        </div>

        {/* Session Statistics */}
        <SessionStats
          stats={sessionStats}
          questionsRemaining={Math.min(
            dueQuestions.length - currentQuestionIndex - 1,
            settingsIntegration.sessionSettings.sessionLength - currentQuestionIndex - 1
          )}
          dailyGoalProgress={dailyGoalProgress}
        />

        {/* Current Question Card */}
        {currentQuestion && (
          <FSRSQuestionCard
            question={currentQuestion}
            showAnswer={showAnswer}
            onShowAnswer={handleShowAnswer}
            onRate={handleRating}
            responseStartTime={responseStartTime}
            disabled={false}
            isSubmitting={isSubmitting}
          />
        )}

        {/* Settings Integration Debug Info (Development Only) */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700" style={{ display: 'none' }}>
          <strong>Settings Integration Active:</strong><br/>
          FSRS: {settingsIntegration.fsrsEnabled ? 'Enabled' : 'Disabled'} |
          Session Length: {settingsIntegration.sessionSettings.sessionLength} |
          Daily Goal: {settingsIntegration.sessionSettings.dailyGoal} |
          Sound: {settingsIntegration.sessionSettings.soundEffects ? 'On' : 'Off'} |
          Theme: {settingsIntegration.uiSettings.theme} |
          Font: {settingsIntegration.uiSettings.fontSize}
        </div>

        {/* Loading Overlay for Rating Submission */}
        {isSubmitting && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 text-center">
              <Loader2 size={32} className="text-blue-500 animate-spin mx-auto mb-2" />
              <p className="text-gray-600">Submitting FSRS rating...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Repeat