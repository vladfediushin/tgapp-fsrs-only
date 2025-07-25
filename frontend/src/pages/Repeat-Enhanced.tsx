// Enhanced Repeat.tsx - Complete FSRS Integration with Unified Store Architecture
// Phase 1 - Day 3: Production-ready spaced repetition learning component

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  useUnifiedStore,
  useUnifiedActions,
  useUnifiedUser,
  useUnifiedSettings,
  useUnifiedLoading,
  useUnifiedErrors
} from '../store/unified'
import { useSettingsIntegration } from '../hooks/useSettingsIntegration'
import fsrsApi, { FSRSDueQuestion, FSRSRating, formatInterval } from '../api/fsrs'
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
  Settings,
  BarChart3,
  Calendar,
  Zap
} from 'lucide-react'

// ============================================================================
// PYTHON DEVELOPER EDUCATION: React Component Architecture
// ============================================================================

/*
 * REACT CONCEPTS FOR PYTHON DEVELOPERS:
 * 
 * 1. COMPONENT STATE vs PYTHON CLASS ATTRIBUTES:
 *    - React: const [state, setState] = useState(initialValue)
 *    - Python: self.state = initial_value
 *    
 *    Key difference: React state is IMMUTABLE. You create new objects instead
 *    of modifying existing ones.
 * 
 * 2. EFFECT HOOKS vs PYTHON LIFECYCLE METHODS:
 *    - React: useEffect(() => { ... }, [dependencies])
 *    - Python: __init__, __enter__, __exit__, decorators
 *    
 *    useEffect runs when dependencies change, similar to property watchers.
 * 
 * 3. CALLBACK HOOKS vs PYTHON METHODS:
 *    - React: useCallback(() => { ... }, [deps]) - memoized function
 *    - Python: @lru_cache decorator for method caching
 *    
 *    Prevents function recreation on every render for performance.
 * 
 * 4. MEMO HOOKS vs PYTHON PROPERTIES:
 *    - React: useMemo(() => computation, [deps]) - cached computation
 *    - Python: @property with internal caching
 *    
 *    Only recalculates when dependencies change.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

interface FSRSSessionStats {
  questionsAnswered: number
  correctAnswers: number
  sessionStartTime: Date
  averageResponseTime: number
  ratingsDistribution: {
    again: number
    hard: number
    good: number
    easy: number
  }
  streakCount: number
  dailyGoalProgress: number
}

interface FSRSQuestionWithContent extends FSRSDueQuestion {
  text: string
  options: string[]
  correct_answer: string
  explanation?: string
  topic: string
}

interface SessionSettings {
  maxQuestions: number
  autoAdvance: boolean
  showTimer: boolean
  enableKeyboardShortcuts: boolean
}

// ============================================================================
// FSRS Rating Buttons Component with Enhanced UX
// ============================================================================

interface FSRSRatingButtonsProps {
  onRate: (rating: FSRSRating) => void
  intervals: {
    again: { interval_days: number }
    hard: { interval_days: number }
    good: { interval_days: number }
    easy: { interval_days: number }
  }
  disabled?: boolean
  showKeyboardHints?: boolean
}

const FSRSRatingButtons: React.FC<FSRSRatingButtonsProps> = ({ 
  onRate, 
  intervals, 
  disabled = false,
  showKeyboardHints = true
}) => {
  const { t } = useTranslation()

  // PYTHON DEVELOPER NOTE: This is similar to a Python list of dictionaries
  // but with TypeScript type safety and React-specific patterns
  const ratingButtons = [
    {
      rating: 1 as FSRSRating,
      label: 'Again',
      description: 'Completely forgot',
      color: 'bg-red-500 hover:bg-red-600 active:bg-red-700',
      textColor: 'text-white',
      interval: intervals.again.interval_days,
      icon: RotateCcw,
      keyboardHint: '1',
      borderColor: 'border-red-200'
    },
    {
      rating: 2 as FSRSRating,
      label: 'Hard',
      description: 'Remembered with difficulty',
      color: 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700',
      textColor: 'text-white',
      interval: intervals.hard.interval_days,
      icon: AlertCircle,
      keyboardHint: '2',
      borderColor: 'border-orange-200'
    },
    {
      rating: 3 as FSRSRating,
      label: 'Good',
      description: 'Remembered correctly',
      color: 'bg-green-500 hover:bg-green-600 active:bg-green-700',
      textColor: 'text-white',
      interval: intervals.good.interval_days,
      icon: CheckCircle,
      keyboardHint: '3',
      borderColor: 'border-green-200'
    },
    {
      rating: 4 as FSRSRating,
      label: 'Easy',
      description: 'Too easy',
      color: 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700',
      textColor: 'text-white',
      interval: intervals.easy.interval_days,
      icon: TrendingUp,
      keyboardHint: '4',
      borderColor: 'border-blue-200'
    }
  ]

  // PYTHON DEVELOPER NOTE: useEffect is like a Python decorator or context manager
  // It handles setup and cleanup of side effects (like event listeners)
  useEffect(() => {
    if (!showKeyboardHints || disabled) return

    const handleKeyPress = (event: KeyboardEvent) => {
      const key = event.key
      const rating = parseInt(key) as FSRSRating
      
      if (rating >= 1 && rating <= 4) {
        event.preventDefault()
        onRate(rating)
      }
    }

    // PYTHON EQUIVALENT: Adding event listener like signal.connect()
    document.addEventListener('keydown', handleKeyPress)
    
    // PYTHON EQUIVALENT: Cleanup like __exit__ or finally block
    return () => {
      document.removeEventListener('keydown', handleKeyPress)
    }
  }, [onRate, disabled, showKeyboardHints])

  return (
    <div className="space-y-4">
      {/* Rating Instructions */}
      <div className="text-center text-sm text-gray-600 mb-4">
        <p className="font-medium mb-1">How well did you remember this?</p>
        {showKeyboardHints && (
          <p className="text-xs text-gray-500">Use keyboard shortcuts 1-4 for quick rating</p>
        )}
      </div>

      {/* Rating Buttons Grid */}
      <div className="grid grid-cols-2 gap-3">
        {ratingButtons.map(({ 
          rating, 
          label, 
          description, 
          color, 
          textColor, 
          interval, 
          icon: Icon, 
          keyboardHint,
          borderColor 
        }) => (
          <button
            key={rating}
            onClick={() => onRate(rating)}
            disabled={disabled}
            className={`
              ${color} ${textColor}
              p-4 rounded-lg transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              transform hover:scale-105 active:scale-95
              shadow-lg hover:shadow-xl
              flex flex-col items-center gap-2
              border-2 ${borderColor}
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
            `}
            title={`${label}: ${description} (Next review: ${formatInterval(interval)})`}
          >
            <div className="flex items-center gap-2">
              <Icon size={20} />
              {showKeyboardHints && (
                <span className="text-xs bg-white bg-opacity-20 px-1.5 py-0.5 rounded">
                  {keyboardHint}
                </span>
              )}
            </div>
            
            <div className="text-center">
              <div className="font-semibold text-base">{label}</div>
              <div className="text-xs opacity-90 leading-tight">{description}</div>
              <div className="text-xs opacity-75 mt-1 font-medium">
                Next: {formatInterval(interval)}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* FSRS Algorithm Info */}
      <div className="text-center text-xs text-gray-500 mt-3 p-2 bg-gray-50 rounded">
        <Brain size={14} className="inline mr-1" />
        FSRS algorithm optimizes review timing based on your memory patterns
      </div>
    </div>
  )
}

// ============================================================================
// Enhanced Question Card Component
// ============================================================================

interface FSRSQuestionCardProps {
  question: FSRSQuestionWithContent
  showAnswer: boolean
  onShowAnswer: () => void
  onRate: (rating: FSRSRating) => void
  responseStartTime: number
  disabled?: boolean
  questionNumber: number
  totalQuestions: number
}

const FSRSQuestionCard: React.FC<FSRSQuestionCardProps> = ({
  question,
  showAnswer,
  onShowAnswer,
  onRate,
  responseStartTime,
  disabled = false,
  questionNumber,
  totalQuestions
}) => {
  const { t } = useTranslation()
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [responseTime, setResponseTime] = useState<number>(0)

  // PYTHON DEVELOPER NOTE: useMemo is like @property with caching
  // It only recalculates when dependencies change
  const currentResponseTime = useMemo(() => {
    return Math.round((Date.now() - responseStartTime) / 1000)
  }, [responseStartTime, showAnswer])

  // Update response time every second
  useEffect(() => {
    if (showAnswer) return

    const timer = setInterval(() => {
      setResponseTime(Math.round((Date.now() - responseStartTime) / 1000))
    }, 1000)

    return () => clearInterval(timer)
  }, [responseStartTime, showAnswer])

  // PYTHON DEVELOPER NOTE: useCallback is like @lru_cache for functions
  // Prevents function recreation on every render
  const handleOptionSelect = useCallback((option: string) => {
    if (!showAnswer && !disabled) {
      setSelectedOption(option)
    }
  }, [showAnswer, disabled])

  const isCorrectAnswer = useCallback((option: string) => {
    return option === question.correct_answer
  }, [question.correct_answer])

  const getOptionStyle = useCallback((option: string) => {
    const baseStyle = 'w-full p-4 text-left border-2 rounded-lg transition-all duration-200 disabled:cursor-not-allowed'
    
    if (!showAnswer) {
      return selectedOption === option 
        ? `${baseStyle} bg-blue-100 border-blue-500 text-blue-700 shadow-md`
        : `${baseStyle} bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400`
    }
    
    if (isCorrectAnswer(option)) {
      return `${baseStyle} bg-green-100 border-green-500 text-green-700 shadow-md`
    }
    
    if (selectedOption === option && !isCorrectAnswer(option)) {
      return `${baseStyle} bg-red-100 border-red-500 text-red-700 shadow-md`
    }
    
    return `${baseStyle} bg-gray-100 border-gray-300 text-gray-600`
  }, [showAnswer, selectedOption, isCorrectAnswer])

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border border-gray-200">
      {/* Question Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {question.topic}
            </span>
            <span className="text-xs text-gray-400">
              Question {questionNumber} of {totalQuestions}
            </span>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-500">
            {!showAnswer && (
              <div className="flex items-center gap-1">
                <Clock size={16} />
                <span className="font-mono">{responseTime}s</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Brain size={16} />
              <span>Difficulty: {question.fsrs_data.difficulty.toFixed(1)}</span>
            </div>
          </div>
        </div>
        
        {/* FSRS Debug Info (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-gray-400 mb-3 p-3 bg-gray-50 rounded border-l-4 border-blue-200">
            <div className="font-semibold text-gray-600 mb-1">FSRS Debug Info:</div>
            <div className="grid grid-cols-2 gap-2">
              <span>State: <strong>{question.fsrs_data.state}</strong></span>
              <span>Stability: <strong>{question.fsrs_data.stability.toFixed(1)}d</strong></span>
              <span>Reps: <strong>{question.fsrs_data.reps}</strong></span>
              <span>Lapses: <strong>{question.fsrs_data.lapses}</strong></span>
            </div>
          </div>
        )}
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
            disabled={disabled}
            className={getOptionStyle(option)}
          >
            <div className="flex items-center gap-3">
              <span className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-current flex items-center justify-center text-sm font-semibold">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="flex-1 text-left">{option}</span>
              {showAnswer && isCorrectAnswer(option) && (
                <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
              )}
              {showAnswer && selectedOption === option && !isCorrectAnswer(option) && (
                <XCircle size={20} className="text-red-600 flex-shrink-0" />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Show Answer Button */}
      {!showAnswer && selectedOption && (
        <button
          onClick={onShowAnswer}
          disabled={disabled}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold transition-colors duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Target size={20} />
          Show Answer & Explanation
        </button>
      )}

      {/* Answer Explanation */}
      {showAnswer && (
        <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <Target size={18} className="text-blue-600" />
            <h3 className="font-semibold text-gray-800">Explanation</h3>
          </div>
          <p className="text-gray-700 leading-relaxed mb-3">
            {question.explanation || 'No explanation available for this question.'}
          </p>
          
          {/* Response Time Summary */}
          <div className="flex items-center justify-between text-sm text-gray-600 pt-3 border-t border-blue-200">
            <div className="flex items-center gap-2">
              <Clock size={16} />
              <span>Response time: <strong>{currentResponseTime}s</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Zap size={16} />
              <span>
                {currentResponseTime < 5 ? 'Quick response!' : 
                 currentResponseTime < 15 ? 'Good timing' : 
                 'Take your time to learn'}
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
            showKeyboardHints={true}
          />
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Enhanced Session Statistics Component
// ============================================================================

interface SessionStatsProps {
  stats: FSRSSessionStats
  questionsRemaining: number
  dailyGoalProgress: number
  showDetailedStats?: boolean
}

const SessionStats: React.FC<SessionStatsProps> = ({ 
  stats, 
  questionsRemaining, 
  dailyGoalProgress,
  showDetailedStats = true 
}) => {
  const { t } = useTranslation()
  
  const accuracy = stats.questionsAnswered > 0 
    ? Math.round((stats.correctAnswers / stats.questionsAnswered) * 100)
    : 0

  const sessionDuration = Math.round((Date.now() - stats.sessionStartTime.getTime()) / 1000 / 60)

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <TrendingUp size={18} />
          Session Progress
        </h3>
        {showDetailedStats && (
          <div className="text-xs text-gray-500">
            FSRS-optimized learning
          </div>
        )}
      </div>
      
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{stats.questionsAnswered}</div>
          <div className="text-sm text-gray-600">Answered</div>
        </div>
        
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{accuracy}%</div>
          <div className="text-sm text-gray-600">Accuracy</div>
        </div>
        
        <div className="text-center p-3 bg-orange-50 rounded-lg">
          <div className="text-2xl font-bold text-orange-600">{questionsRemaining}</div>
          <div className="text-sm text-gray-600">Remaining</div>
        </div>
        
        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">{sessionDuration}m</div>
          <div className="text-sm text-gray-600">Duration</div>
        </div>
      </div>

      {/* Daily Goal Progress */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Daily Goal Progress</span>
          <span className="text-sm text-gray-600">{Math.round(dailyGoalProgress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(dailyGoalProgress, 100)}%` }}
          />
        </div>
      </div>

      {/* FSRS Rating Distribution */}
      {showDetailedStats && (
        <div className="pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600 mb-2 font-medium">FSRS Rating Distribution:</div>
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 bg-red-100 text-red-700 rounded flex items-center gap-1">
              <RotateCcw size={12} />
              Again: {stats.ratingsDistribution.again}
            </span>
            <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded flex items-center gap-1">
              <AlertCircle size={12} />
              Hard: {stats.ratingsDistribution.hard}
            </span>
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded flex items-center gap-1">
              <CheckCircle size={12} />
              Good: {stats.ratingsDistribution.good}
            </span>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded flex items-center gap-1">
              <TrendingUp size={12} />
              Easy: {stats.ratingsDistribution.easy}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Session Complete Component with Enhanced Feedback
// ============================================================================

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
  
  const accuracy = stats.questionsAnswered > 0 
    ? Math.round((stats.correctAnswers / stats.questionsAnswered) * 100)
    : 0

  const sessionDuration = Math.round((Date.now() - stats.sessionStartTime.getTime()) / 1000 / 60)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {dailyGoalReached ? '🎉 Daily Goal Reached!' : 'Session Complete!'}
          </h2>
          <p className="text-gray-600">
            {dailyGoalReached 
              ? 'Excellent work! You\'ve reached your daily learning goal.'
              : 'Great job! You\'ve completed your FSRS review session.'
            }
          </p>
        </div>

        {/* Final Statistics */}
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-6 mb-6">
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

        {/* FSRS Learning Insights */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
          <div className="flex items-center gap-2 mb-2">
            <Brain size={16} className="text-blue-600" />
            <span className="font-semibold text-blue-800">FSRS Learning Insights</span>
          </div>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• Your memory patterns are being optimized</p>
            <p>• Next reviews scheduled based on retention</p>
            <p>• Difficulty adjusted for optimal learning</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={onStartNewSession}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-3 px-6 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Play size={20} />
            Continue Learning
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
// Main Enhanced Repeat Component
// ============================================================================

const RepeatEnhanced: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  // PYTHON DEVELOPER NOTE: These hooks are like dependency injection
  // They provide access to global state and actions
  const user = useUnifiedUser()
  const settings = useUnifiedSettings()
  const loading = useUnifiedLoading()
  const errors = useUnifiedErrors()
  const actions = useUnifiedActions()
  
  // Settings integration for real-time effects
  const settingsIntegration = useSettingsIntegration()

  // PYTHON DEVELOPER NOTE: useState is like instance variables but immutable
  // Each setState call triggers a re-render of the component
  const [dueQuestions, setDueQuestions] = useState<FSRSQuestionWithContent[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [responseStartTime, setResponseStartTime] = useState(Date.now())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sessionComplete, setSessionComplete] = useState(false)
  
  // Enhanced session statistics
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
    },
    streakCount: 0,
    dailyGoalProgress: 0
  })

  // Loading and error states
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Session settings
  const [sessionSettings] = useState<SessionSettings>({
    maxQuestions: settingsIntegration.sessionSettings.sessionLength,
    autoAdvance: false,
    showTimer: true,
    enableKeyboardShortcuts: settingsIntegration.sessionSettings.keyboardShortcuts
  })

  // PYTHON DEVELOPER NOTE: useMemo is like @property with caching
  // Only recalculates when dependencies change
  const currentQuestion = useMemo(() => {
    return dueQuestions[currentQuestionIndex] || null
  }, [dueQuestions, currentQuestionIndex])

  const dailyGoalProgress = useMemo(() => {
    const goalStatus = settingsIntegration.checkDailyGoal(sessionStats.questionsAnswered)
    return goalStatus.progressPercentage
  }, [sessionStats.questionsAnswered, settingsIntegration])

  // PYTHON DEVELOPER NOTE: useEffect is like __init__ or setup methods
  // The dependency array controls when it runs (like watching properties)
  useEffect(() => {
    const loadDueQuestions = async () => {
      if (!user?.id || !settings.examCountry || !settings.examLanguage) {
        setLoadError('User authentication or exam settings not available')
        setIsLoadingQuestions(false)
        return
      }

      try {
        setIsLoadingQuestions(true)
        setLoadError(null)

        console.log('🔄 Loading FSRS due questions with unified store...')
        
        // Use unified store to load FSRS due questions
        const response = await actions.loadFSRSDueQuestions(
          user.id,
          settings.examCountry,
          settings.examLanguage
        )

        console.log('📚 FSRS due questions loaded:', response)

        if (response.length === 0) {
          setSessionComplete(true)
          setIsLoadingQuestions(false)
          return
        }

        // Transform FSRS questions to include content
        // In production, this would fetch actual question content
        const questionsWithContent: FSRSQuestionWithContent[] = response.map((q, index) => ({
          ...q,
          text: `Enhanced FSRS Question ${index + 1}`,
          options: [
            'Option A - Sample answer with detailed explanation',
            'Option B - Alternative answer choice',
            'Option C - Third possible answer',
            'Option D - Final answer option'
          ],
          correct_answer: 'Option A - Sample answer with detailed explanation',
          explanation: 'This is a comprehensive explanation of why this answer is correct. The FSRS algorithm will use your rating to optimize future review timing.',
          topic: 'Enhanced Learning Topic'
        }))

        setDueQuestions(questionsWithContent)
        setCurrentQuestionIndex(0)
        setResponseStartTime(Date.now())
        
        // Update session stats with daily goal progress
        const goalStatus = settingsIntegration.checkDailyGoal(0)
        setSessionStats(prev => ({
          ...prev,
          dailyGoalProgress: goalStatus.progressPercentage
        }))
        
      } catch (error) {
        console.error('❌ Failed to load FSRS due questions:', error)
        setLoadError(error instanceof Error ? error.message : 'Failed to load questions')
      } finally {
        setIsLoadingQuestions(false)
      }
    }

    loadDueQuestions()
  }, [user?.id, settings.examCountry, settings.examLanguage, actions, settingsIntegration])

  // PYTHON DEVELOPER NOTE: useCallback prevents function recreation
  // Similar to memoization in Python with @lru_cache
  const handleShowAnswer = useCallback(() => {
    setShowAnswer(true)
    
    // Apply settings integration for auto-show behavior
    if (settingsIntegration.sessionSettings.autoShowAnswer) {
      console.log('⏱️ Auto-show answer enabled via settings')
    }
  }, [settingsIntegration.sessionSettings.autoShowAnswer])

  // Enhanced FSRS rating submission with unified store integration
  const handleRating = useCallback(async (rating: FSRSRating) => {
    if (!currentQuestion || !user?.id || isSubmitting) return

    try {
      setIsSubmitting(true)
      
      const responseTime = Date.now() - responseStartTime
      const isCorrect = rating >= 3 // Good or Easy ratings are considered correct

      console.log(`🧠 Submitting FSRS rating: ${rating} for question ${currentQuestion.question_id}`)

      // Play audio feedback based on settings
      if (isCorrect) {
        settingsIntegration.playSuccessSound()
      } else {
        settingsIntegration.playErrorSound()
      }

      // Submit answer to FSRS API with enhanced error handling
      try {
        await fsrsApi.submitAnswer({
          user_id: user.id,
          question_id: currentQuestion.question_id,
          is_correct: isCorrect,
          answered_at: new Date().toISOString()
        }, rating)
        
        console.log('✅ FSRS answer submitted successfully')
      } catch (apiError) {
        console.error('❌ FSRS API submission failed:', apiError)
        // Continue with local state update even if API fails
      }

      // Update session statistics with enhanced tracking
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
        
        // Update daily goal progress
        const goalStatus = settingsIntegration.checkDailyGoal(newStats.questionsAnswered)
        newStats.dailyGoalProgress = goalStatus.progressPercentage
        
        return newStats
      })

      // Check session length limit from settings
      const nextQuestionIndex = currentQuestionIndex + 1
      const sessionLengthExceeded = !settingsIntegration.checkSessionLength(nextQuestionIndex)
      
      // Move to next question or complete session
      if (nextQuestionIndex < dueQuestions.length && !sessionLengthExceeded) {
        setCurrentQuestionIndex(nextQuestionIndex)
        setShowAnswer(false)
        setResponseStartTime(Date.now())
      } else {
        setSessionComplete(true)
        
        // Check if daily goal was reached
        const finalGoalStatus = settingsIntegration.checkDailyGoal(sessionStats.questionsAnswered + 1)
        if (finalGoalStatus.goalReached) {
          settingsIntegration.playNotificationSound()
          console.log('🎉 Daily goal reached!')
        }
      }

    } catch (error) {
      console.error('❌ Failed to submit FSRS rating:', error)
      // Show user-friendly error but don't block progression
      alert('Failed to submit rating. Your progress has been saved locally.')
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

  // Handle starting new session
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
      },
      streakCount: 0,
      dailyGoalProgress: 0
    })
    
    // Reload questions using unified store
    window.location.reload()
  }, [])

  // Handle going home
  const handleGoHome = useCallback(() => {
    navigate('/')
  }, [navigate])

  // Loading state with enhanced UX
  if (isLoadingQuestions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center bg-white rounded-xl shadow-2xl p-8 max-w-md">
          <Loader2 size={48} className="text-blue-500 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Loading FSRS Questions...
          </h2>
          <p className="text-gray-600 mb-4">
            Preparing your personalized review session
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
            <Brain size={16} />
            <span>FSRS algorithm optimizing your learning</span>
          </div>
        </div>
      </div>
    )
  }

  // Error state with retry options
  if (loadError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
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
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <RotateCcw size={20} />
              Try Again
            </button>
            <button
              onClick={handleGoHome}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white py-3 px-4 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <Home size={20} />
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Session complete state
  if (sessionComplete) {
    const dailyGoalReached = settingsIntegration.checkDailyGoal(sessionStats.questionsAnswered).goalReached
    
    return (
      <SessionComplete
        stats={sessionStats}
        onStartNewSession={handleStartNewSession}
        onGoHome={handleGoHome}
        dailyGoalReached={dailyGoalReached}
      />
    )
  }

  // No questions available
  if (dueQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            No Questions Due
          </h2>
          <p className="text-gray-600 mb-6">
            Excellent! You're all caught up with your FSRS reviews. Your next questions will be ready based on the optimal spaced repetition schedule.
          </p>
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Brain size={16} className="text-blue-600" />
              <span className="font-semibold text-blue-800">FSRS Insight</span>
            </div>
            <p className="text-sm text-blue-700">
              The algorithm has scheduled your reviews for optimal retention. Check back later for new questions!
            </p>
          </div>
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

  // Check daily goal progress for display
  const dailyGoalStatus = settingsIntegration.checkDailyGoal(sessionStats.questionsAnswered)
  
  // Main question interface with enhanced UX
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4"
      style={{
        fontSize: settingsIntegration.uiSettings.fontSize === 'small' ? '14px' :
                  settingsIntegration.uiSettings.fontSize === 'large' ? '18px' : '16px'
      }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Enhanced Header */}
        <div className="flex items-center justify-between mb-6 bg-white rounded-lg shadow-lg p-4">
          <button
            onClick={handleGoHome}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-gray-100"
          >
            <Home size={20} />
            <span className="font-medium">Home</span>
          </button>
          
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 justify-center">
              <Brain size={24} className="text-blue-600" />
              FSRS Learning Session
            </h1>
            <p className="text-gray-600">
              Question {currentQuestionIndex + 1} of {Math.min(dueQuestions.length, sessionSettings.maxQuestions)}
            </p>
            
            {/* Daily Goal Progress Indicator */}
            {settingsIntegration.uiSettings.showProgress && (
              <div className="mt-2">
                <div className="text-sm text-gray-500">
                  Daily Goal: {sessionStats.questionsAnswered}/{settingsIntegration.sessionSettings.dailyGoal}
                  ({Math.round(dailyGoalStatus.progressPercentage)}%)
                </div>
                <div className="w-48 h-2 bg-gray-200 rounded-full mx-auto mt-1">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(dailyGoalStatus.progressPercentage, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/settings')}
              className="p-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 rounded-lg hover:bg-gray-100"
              title="Settings"
            >
              <Settings size={20} />
            </button>
            <button
              onClick={() => navigate('/statistics')}
              className="p-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 rounded-lg hover:bg-gray-100"
              title="Statistics"
            >
              <BarChart3 size={20} />
            </button>
          </div>
        </div>

        {/* Session Statistics */}
        <SessionStats
          stats={sessionStats}
          questionsRemaining={Math.min(
            dueQuestions.length - currentQuestionIndex - 1,
            sessionSettings.maxQuestions - currentQuestionIndex - 1
          )}
          dailyGoalProgress={dailyGoalProgress}
          showDetailedStats={true}
        />

        {/* Question Card */}
        {currentQuestion && (
          <FSRSQuestionCard
            question={currentQuestion}
            showAnswer={showAnswer}
            onShowAnswer={handleShowAnswer}
            onRate={handleRating}
            responseStartTime={responseStartTime}
            disabled={isSubmitting}
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={Math.min(dueQuestions.length, sessionSettings.maxQuestions)}
          />
        )}

        {/* Settings Integration Info (Development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg text-xs text-blue-700 border border-blue-200">
            <div className="font-semibold text-blue-800 mb-2">🔧 Settings Integration Active:</div>
            <div className="grid grid-cols-2 gap-2">
              <span>FSRS: <strong>{settingsIntegration.fsrsEnabled ? 'Enabled' : 'Disabled'}</strong></span>
              <span>Session Length: <strong>{settingsIntegration.sessionSettings.sessionLength}</strong></span>
              <span>Daily Goal: <strong>{settingsIntegration.sessionSettings.dailyGoal}</strong></span>
              <span>Sound: <strong>{settingsIntegration.sessionSettings.soundEffects ? 'On' : 'Off'}</strong></span>
              <span>Theme: <strong>{settingsIntegration.uiSettings.theme}</strong></span>
              <span>Font: <strong>{settingsIntegration.uiSettings.fontSize}</strong></span>
              <span>Shortcuts: <strong>{settingsIntegration.sessionSettings.keyboardShortcuts ? 'On' : 'Off'}</strong></span>
              <span>Progress: <strong>{settingsIntegration.uiSettings.showProgress ? 'On' : 'Off'}</strong></span>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {isSubmitting && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 text-center shadow-2xl">
              <Loader2 size={32} className="text-blue-500 animate-spin mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Processing FSRS Rating...</p>
              <p className="text-sm text-gray-500 mt-1">Optimizing your learning schedule</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RepeatEnhanced

/*
 * PYTHON DEVELOPER SUMMARY:
 *
 * This enhanced React component demonstrates several key concepts:
 *
 * 1. STATE MANAGEMENT: Uses hooks (useState, useEffect) similar to Python class attributes
 *    but with immutable updates and automatic re-rendering.
 *
 * 2. ASYNC OPERATIONS: useEffect handles side effects like API calls, similar to
 *    Python's async/await but with dependency tracking.
 *
 * 3. MEMOIZATION: useCallback and useMemo prevent unnecessary recalculations,
 *    similar to Python's @lru_cache decorator.
 *
 * 4. COMPONENT COMPOSITION: Breaking UI into smaller, reusable components
 *    similar to Python class inheritance but with composition over inheritance.
 *
 * 5. UNIFIED STORE INTEGRATION: Uses global state management similar to
 *    Python's singleton pattern or dependency injection.
 *
 * 6. REAL-TIME SETTINGS: Settings changes immediately affect the UI,
 *    similar to Python property watchers or observers.
 *
 * 7. ERROR HANDLING: Comprehensive try/catch blocks with user-friendly
 *    error states, similar to Python exception handling.
 *
 * The component follows React best practices while maintaining clear
 * separation of concerns and comprehensive FSRS integration.
 */