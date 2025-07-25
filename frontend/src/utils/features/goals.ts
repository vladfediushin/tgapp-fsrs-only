// Goals and Streak Management System
// Consolidated from dailyGoals.ts and streakUtils.ts
// Provides daily goal calculations, streak tracking, and progress monitoring

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface DailyGoalData {
  dailyGoal: number
  totalQuestions: number
  alreadyCorrect: number
  remainingQuestions: number
  daysUntilExam: number
  learningDays: number
  isCalculated: boolean
}

export interface TodayProgress {
  questionsMasteredToday: number
  goalProgress: number // 0-100%
  goalMet: boolean
}

export interface StreakData {
  currentStreak: number
  maxStreak: number
  streakDays: string[]
  lastStreakDate: string | null
  streakGoalMet: boolean
}

export interface GoalSettings {
  dailyGoalEnabled: boolean
  streakTrackingEnabled: boolean
  goalAdjustmentEnabled: boolean
  weekendGoalReduction: number // 0-1 (percentage reduction)
  adaptiveGoalEnabled: boolean
  minDailyGoal: number
  maxDailyGoal: number
}

// ============================================================================
// Daily Goal Calculations
// ============================================================================

/**
 * Main function for calculating daily goal
 * Uses data that has already been obtained from API
 */
export function calculateDailyGoal(
  examDate: string | null,
  totalQuestions: number,
  alreadyCorrectCount: number 
): DailyGoalData | null {
  
  if (!examDate) {
    return null
  }

  const today = new Date()
  const exam = new Date(examDate)
  const daysUntilExam = Math.max(0, Math.ceil((exam.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
  
  const remainingQuestions = Math.max(0, totalQuestions - alreadyCorrectCount)
  
  if (remainingQuestions === 0) {
    return {
      dailyGoal: 0,
      totalQuestions,
      alreadyCorrect: alreadyCorrectCount,
      remainingQuestions: 0,
      daysUntilExam,
      learningDays: 0,
      isCalculated: true
    }
  }

  // 80% of time for learning, 20% for review
  const learningDays = Math.max(1, Math.floor(daysUntilExam * 0.8))
  const dailyGoal = Math.max(1, Math.ceil(remainingQuestions / learningDays))

  return {
    dailyGoal,
    totalQuestions,
    alreadyCorrect: alreadyCorrectCount,
    remainingQuestions,
    daysUntilExam,
    learningDays,
    isCalculated: true
  }
}

/**
 * Calculate today's progress
 * Count only unique correctly answered questions for the day
 */
export function calculateTodayProgress(
  sessionsAnswers: Array<{ questionId: number; isCorrect: boolean }>, // From useSession
  dailyGoal: number
): TodayProgress {
  
  // Take only correct answers and make them unique by questionId
  const uniqueCorrectToday = new Set(
    sessionsAnswers
      .filter(a => a.isCorrect)
      .map(a => a.questionId)
  ).size

  const goalProgress = dailyGoal > 0 ? Math.min((uniqueCorrectToday / dailyGoal) * 100, 100) : 0
  const goalMet = uniqueCorrectToday >= dailyGoal

  return {
    questionsMasteredToday: uniqueCorrectToday,
    goalProgress,
    goalMet
  }
}

/**
 * Calculate adaptive daily goal based on performance history
 */
export function calculateAdaptiveDailyGoal(
  baseGoal: number,
  recentPerformance: number[], // Array of recent daily completion percentages
  settings: GoalSettings
): number {
  if (!settings.adaptiveGoalEnabled || recentPerformance.length === 0) {
    return baseGoal
  }

  // Calculate average performance over recent days
  const avgPerformance = recentPerformance.reduce((sum, perf) => sum + perf, 0) / recentPerformance.length

  let adjustedGoal = baseGoal

  // If consistently overperforming, increase goal slightly
  if (avgPerformance > 120) { // 120% of goal
    adjustedGoal = Math.min(baseGoal * 1.1, settings.maxDailyGoal)
  }
  // If consistently underperforming, decrease goal slightly
  else if (avgPerformance < 70) { // 70% of goal
    adjustedGoal = Math.max(baseGoal * 0.9, settings.minDailyGoal)
  }

  // Apply weekend reduction if it's weekend
  const today = new Date()
  const isWeekend = today.getDay() === 0 || today.getDay() === 6
  if (isWeekend && settings.weekendGoalReduction > 0) {
    adjustedGoal = Math.max(
      adjustedGoal * (1 - settings.weekendGoalReduction),
      settings.minDailyGoal
    )
  }

  return Math.round(adjustedGoal)
}

// ============================================================================
// Streak Utilities
// ============================================================================

/**
 * Function to get the last 7 dates in local format
 */
export function getLast7LocalDates(): string[] {
  const pad = (n: number) => n.toString().padStart(2, '0')
  const localDateString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  const dates: string[] = []
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dates.push(localDateString(d))
  }
  
  return dates
}

/**
 * Function to calculate current streak
 * @param dailyProgress - array of progress for the last 7 days
 * @param dailyGoal - daily goal
 * @returns number of consecutive days with completed goal (counting from the end)
 */
export function calculateCurrentStreak(dailyProgress: number[], dailyGoal: number): number {
  if (!dailyProgress || !dailyGoal || dailyGoal <= 0) return 0
  
  let streak = 0
  
  // Count from the end (today)
  for (let i = dailyProgress.length - 1; i >= 0; i--) {
    if (dailyProgress[i] >= dailyGoal) {
      streak++
    } else {
      break // As soon as we encounter a day without completed goal, break
    }
  }
  
  return streak
}

/**
 * Function to calculate maximum streak for the period
 * @param dailyProgress - array of progress for the last 7 days
 * @param dailyGoal - daily goal
 * @returns maximum streak for the period
 */
export function calculateMaxStreak(dailyProgress: number[], dailyGoal: number): number {
  if (!dailyProgress || !dailyGoal || dailyGoal <= 0) return 0
  
  let maxStreak = 0
  let currentStreak = 0
  
  for (const progress of dailyProgress) {
    if (progress >= dailyGoal) {
      currentStreak++
      maxStreak = Math.max(maxStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  }
  
  return maxStreak
}

/**
 * Calculate comprehensive streak data
 */
export function calculateStreakData(
  dailyProgress: number[],
  dailyGoal: number,
  dates: string[]
): StreakData {
  const currentStreak = calculateCurrentStreak(dailyProgress, dailyGoal)
  const maxStreak = calculateMaxStreak(dailyProgress, dailyGoal)
  
  // Find streak days (days where goal was met)
  const streakDays = dates.filter((date, index) => 
    dailyProgress[index] >= dailyGoal
  )
  
  // Find last streak date
  let lastStreakDate: string | null = null
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dailyProgress[i] >= dailyGoal) {
      lastStreakDate = dates[i]
      break
    }
  }
  
  // Check if today's goal is met (assuming last entry is today)
  const streakGoalMet = dailyProgress.length > 0 && 
    dailyProgress[dailyProgress.length - 1] >= dailyGoal

  return {
    currentStreak,
    maxStreak,
    streakDays,
    lastStreakDate,
    streakGoalMet
  }
}

/**
 * Calculate streak statistics for a longer period
 */
export function calculateExtendedStreakStats(
  dailyProgressHistory: Array<{ date: string; progress: number }>,
  dailyGoal: number
): {
  longestStreak: number
  totalStreakDays: number
  averageStreak: number
  streakFrequency: number // percentage of days with goals met
  streakBreaks: number
} {
  if (!dailyProgressHistory.length) {
    return {
      longestStreak: 0,
      totalStreakDays: 0,
      averageStreak: 0,
      streakFrequency: 0,
      streakBreaks: 0
    }
  }

  let longestStreak = 0
  let currentStreak = 0
  let totalStreakDays = 0
  let streakBreaks = 0
  let streakPeriods: number[] = []

  for (const day of dailyProgressHistory) {
    if (day.progress >= dailyGoal) {
      currentStreak++
      totalStreakDays++
    } else {
      if (currentStreak > 0) {
        streakPeriods.push(currentStreak)
        longestStreak = Math.max(longestStreak, currentStreak)
        streakBreaks++
        currentStreak = 0
      }
    }
  }

  // Don't forget the last streak if it's ongoing
  if (currentStreak > 0) {
    streakPeriods.push(currentStreak)
    longestStreak = Math.max(longestStreak, currentStreak)
  }

  const averageStreak = streakPeriods.length > 0 
    ? streakPeriods.reduce((sum, streak) => sum + streak, 0) / streakPeriods.length 
    : 0

  const streakFrequency = (totalStreakDays / dailyProgressHistory.length) * 100

  return {
    longestStreak,
    totalStreakDays,
    averageStreak,
    streakFrequency,
    streakBreaks
  }
}

// ============================================================================
// Goal Management System
// ============================================================================

export class GoalManager {
  private settings: GoalSettings
  private performanceHistory: number[] = []

  constructor(settings: GoalSettings) {
    this.settings = settings
  }

  updateSettings(newSettings: Partial<GoalSettings>): void {
    this.settings = { ...this.settings, ...newSettings }
  }

  addPerformanceData(percentage: number): void {
    this.performanceHistory.push(percentage)
    
    // Keep only last 14 days of performance data
    if (this.performanceHistory.length > 14) {
      this.performanceHistory = this.performanceHistory.slice(-14)
    }
  }

  calculateOptimalGoal(baseGoal: number): number {
    return calculateAdaptiveDailyGoal(baseGoal, this.performanceHistory, this.settings)
  }

  getGoalRecommendation(
    currentGoal: number,
    recentPerformance: number
  ): {
    recommendation: 'increase' | 'decrease' | 'maintain'
    suggestedGoal: number
    reason: string
  } {
    const optimalGoal = this.calculateOptimalGoal(currentGoal)
    
    if (optimalGoal > currentGoal) {
      return {
        recommendation: 'increase',
        suggestedGoal: optimalGoal,
        reason: 'You\'ve been consistently exceeding your goals. Time to challenge yourself!'
      }
    } else if (optimalGoal < currentGoal) {
      return {
        recommendation: 'decrease',
        suggestedGoal: optimalGoal,
        reason: 'Consider reducing your goal to maintain consistency and avoid burnout.'
      }
    } else {
      return {
        recommendation: 'maintain',
        suggestedGoal: currentGoal,
        reason: 'Your current goal seems well-balanced for your performance level.'
      }
    }
  }

  getMotivationalMessage(streakData: StreakData, todayProgress: TodayProgress): string {
    if (todayProgress.goalMet) {
      if (streakData.currentStreak >= 7) {
        return `🔥 Amazing! You're on a ${streakData.currentStreak}-day streak! Keep the momentum going!`
      } else if (streakData.currentStreak >= 3) {
        return `⭐ Great job! ${streakData.currentStreak} days in a row! You're building a strong habit!`
      } else {
        return `✅ Goal completed! Every day counts towards your success!`
      }
    } else {
      const remaining = Math.max(0, 100 - todayProgress.goalProgress)
      if (remaining <= 25) {
        return `💪 You're almost there! Just ${remaining.toFixed(0)}% more to reach today's goal!`
      } else if (remaining <= 50) {
        return `🎯 Halfway there! Keep going, you've got this!`
      } else {
        return `🚀 Every question counts! Start strong and build momentum!`
      }
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get text for streak display with proper pluralization
 */
export function getStreakText(count: number, t: (key: string, options?: any) => string): string {
  if (count === 1) {
    return t('home.streak.days_1', { count })
  }
  
  // For Russian language: special declension rules
  if (t('home.streak.days_2') !== 'home.streak.days_2') { // check if translation exists (Russian)
    if (count >= 2 && count <= 4) {
      return t('home.streak.days_2', { count })
    } else if (count === 0 || count >= 5) {
      return t('home.streak.days_5', { count })
    }
  }
  
  // For English language: simple rule
  if (count === 0 || count > 1) {
    return t('home.streak.days_other', { count }) || t('home.streak.days_0', { count })
  }
  
  return t('home.streak.days_1', { count })
}

/**
 * Format goal progress for display
 */
export function formatGoalProgress(progress: TodayProgress): string {
  const percentage = Math.round(progress.goalProgress)
  const completed = progress.questionsMasteredToday
  
  if (progress.goalMet) {
    return `✅ Goal completed! ${completed} questions mastered (${percentage}%)`
  } else {
    return `📊 Progress: ${completed} questions mastered (${percentage}%)`
  }
}

/**
 * Get goal status color for UI
 */
export function getGoalStatusColor(progress: TodayProgress): string {
  if (progress.goalMet) {
    return '#10B981' // green
  } else if (progress.goalProgress >= 75) {
    return '#F59E0B' // amber
  } else if (progress.goalProgress >= 50) {
    return '#EF4444' // red
  } else {
    return '#6B7280' // gray
  }
}

/**
 * Calculate time remaining to complete daily goal
 */
export function estimateTimeToCompleteGoal(
  remainingQuestions: number,
  averageTimePerQuestion: number = 30 // seconds
): {
  minutes: number
  hours: number
  formattedTime: string
} {
  const totalSeconds = remainingQuestions * averageTimePerQuestion
  const minutes = Math.ceil(totalSeconds / 60)
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  let formattedTime: string
  if (hours > 0) {
    formattedTime = `${hours}h ${remainingMinutes}m`
  } else {
    formattedTime = `${minutes}m`
  }

  return {
    minutes,
    hours,
    formattedTime
  }
}

// ============================================================================
// Default Settings
// ============================================================================

export const defaultGoalSettings: GoalSettings = {
  dailyGoalEnabled: true,
  streakTrackingEnabled: true,
  goalAdjustmentEnabled: true,
  weekendGoalReduction: 0.2, // 20% reduction on weekends
  adaptiveGoalEnabled: true,
  minDailyGoal: 5,
  maxDailyGoal: 100
}

export default {
  calculateDailyGoal,
  calculateTodayProgress,
  calculateAdaptiveDailyGoal,
  getLast7LocalDates,
  calculateCurrentStreak,
  calculateMaxStreak,
  calculateStreakData,
  calculateExtendedStreakStats,
  GoalManager,
  getStreakText,
  formatGoalProgress,
  getGoalStatusColor,
  estimateTimeToCompleteGoal,
  defaultGoalSettings
}