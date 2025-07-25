// Statistics Management System
// Consolidated statistics calculations, data processing, and analytics
// Provides comprehensive statistics utilities for user progress tracking

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface UserStats {
  totalQuestions: number
  correctAnswers: number
  incorrectAnswers: number
  accuracy: number
  averageTime: number
  totalTime: number
  sessionsCompleted: number
  streakDays: number
  lastActivity: string
}

export interface DailyProgress {
  date: string
  questionsAnswered: number
  correctAnswers: number
  accuracy: number
  timeSpent: number
  goalMet: boolean
}

export interface StatisticsConfig {
  enableDetailedTracking: boolean
  trackTimeSpent: boolean
  trackStreaks: boolean
  calculateTrends: boolean
  retentionPeriodDays: number
  aggregationInterval: 'daily' | 'weekly' | 'monthly'
}

export interface PerformanceMetrics {
  improvementRate: number
  consistencyScore: number
  difficultyProgression: number
  learningVelocity: number
  retentionRate: number
}

export interface StatsTrend {
  period: string
  value: number
  change: number
  changePercent: number
  trend: 'up' | 'down' | 'stable'
}

export interface TopicStatistics {
  topicId: string
  topicName: string
  totalQuestions: number
  correctAnswers: number
  accuracy: number
  averageTime: number
  difficulty: 'easy' | 'medium' | 'hard'
  masteryLevel: number
  lastPracticed: string
}

// ============================================================================
// Statistics Calculator Class
// ============================================================================

export class StatisticsCalculator {
  private config: StatisticsConfig

  constructor(config: StatisticsConfig) {
    this.config = config
  }

  /**
   * Calculate basic user statistics
   */
  calculateUserStats(sessions: Array<{
    questionsAnswered: number
    correctAnswers: number
    timeSpent: number
    date: string
  }>): UserStats {
    if (sessions.length === 0) {
      return {
        totalQuestions: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        accuracy: 0,
        averageTime: 0,
        totalTime: 0,
        sessionsCompleted: 0,
        streakDays: 0,
        lastActivity: ''
      }
    }

    const totalQuestions = sessions.reduce((sum, s) => sum + s.questionsAnswered, 0)
    const correctAnswers = sessions.reduce((sum, s) => sum + s.correctAnswers, 0)
    const incorrectAnswers = totalQuestions - correctAnswers
    const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0
    const totalTime = sessions.reduce((sum, s) => sum + s.timeSpent, 0)
    const averageTime = totalQuestions > 0 ? totalTime / totalQuestions : 0
    const sessionsCompleted = sessions.length
    const streakDays = this.calculateStreakDays(sessions)
    const lastActivity = sessions[sessions.length - 1]?.date || ''

    return {
      totalQuestions,
      correctAnswers,
      incorrectAnswers,
      accuracy,
      averageTime,
      totalTime,
      sessionsCompleted,
      streakDays,
      lastActivity
    }
  }

  /**
   * Calculate daily progress statistics
   */
  calculateDailyProgress(
    sessions: Array<{
      date: string
      questionsAnswered: number
      correctAnswers: number
      timeSpent: number
    }>,
    dailyGoal: number = 10
  ): DailyProgress[] {
    const dailyMap = new Map<string, DailyProgress>()

    sessions.forEach(session => {
      const existing = dailyMap.get(session.date)
      
      if (existing) {
        existing.questionsAnswered += session.questionsAnswered
        existing.correctAnswers += session.correctAnswers
        existing.timeSpent += session.timeSpent
        existing.accuracy = existing.questionsAnswered > 0 
          ? (existing.correctAnswers / existing.questionsAnswered) * 100 
          : 0
        existing.goalMet = existing.questionsAnswered >= dailyGoal
      } else {
        const accuracy = session.questionsAnswered > 0 
          ? (session.correctAnswers / session.questionsAnswered) * 100 
          : 0
        
        dailyMap.set(session.date, {
          date: session.date,
          questionsAnswered: session.questionsAnswered,
          correctAnswers: session.correctAnswers,
          accuracy,
          timeSpent: session.timeSpent,
          goalMet: session.questionsAnswered >= dailyGoal
        })
      }
    })

    return Array.from(dailyMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  }

  /**
   * Calculate performance metrics
   */
  calculatePerformanceMetrics(
    dailyProgress: DailyProgress[],
    timeWindow: number = 30
  ): PerformanceMetrics {
    if (dailyProgress.length < 2) {
      return {
        improvementRate: 0,
        consistencyScore: 0,
        difficultyProgression: 0,
        learningVelocity: 0,
        retentionRate: 0
      }
    }

    const recentData = dailyProgress.slice(-timeWindow)
    
    // Calculate improvement rate (accuracy trend)
    const improvementRate = this.calculateTrendSlope(
      recentData.map((d, i) => ({ x: i, y: d.accuracy }))
    )

    // Calculate consistency score (how consistent daily practice is)
    const consistencyScore = this.calculateConsistencyScore(recentData)

    // Calculate learning velocity (questions per day trend)
    const learningVelocity = this.calculateTrendSlope(
      recentData.map((d, i) => ({ x: i, y: d.questionsAnswered }))
    )

    // Placeholder calculations for other metrics
    const difficultyProgression = this.calculateDifficultyProgression(recentData)
    const retentionRate = this.calculateRetentionRate(recentData)

    return {
      improvementRate,
      consistencyScore,
      difficultyProgression,
      learningVelocity,
      retentionRate
    }
  }

  /**
   * Calculate statistics trends
   */
  calculateTrends(
    dailyProgress: DailyProgress[],
    metric: 'accuracy' | 'questionsAnswered' | 'timeSpent',
    periods: number = 7
  ): StatsTrend[] {
    if (dailyProgress.length < periods * 2) {
      return []
    }

    const trends: StatsTrend[] = []
    const data = dailyProgress.slice(-periods * 2)

    for (let i = periods; i < data.length; i++) {
      const currentPeriod = data.slice(i - periods + 1, i + 1)
      const previousPeriod = data.slice(i - periods * 2 + 1, i - periods + 1)

      const currentValue = this.calculatePeriodAverage(currentPeriod, metric)
      const previousValue = this.calculatePeriodAverage(previousPeriod, metric)

      const change = currentValue - previousValue
      const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0

      let trend: 'up' | 'down' | 'stable' = 'stable'
      if (Math.abs(changePercent) > 5) {
        trend = changePercent > 0 ? 'up' : 'down'
      }

      trends.push({
        period: data[i].date,
        value: currentValue,
        change,
        changePercent,
        trend
      })
    }

    return trends
  }

  /**
   * Calculate topic-specific statistics
   */
  calculateTopicStatistics(
    sessions: Array<{
      topicId: string
      topicName: string
      questionsAnswered: number
      correctAnswers: number
      timeSpent: number
      difficulty: 'easy' | 'medium' | 'hard'
      date: string
    }>
  ): TopicStatistics[] {
    const topicMap = new Map<string, TopicStatistics>()

    sessions.forEach(session => {
      const existing = topicMap.get(session.topicId)
      
      if (existing) {
        existing.totalQuestions += session.questionsAnswered
        existing.correctAnswers += session.correctAnswers
        existing.accuracy = existing.totalQuestions > 0 
          ? (existing.correctAnswers / existing.totalQuestions) * 100 
          : 0
        existing.averageTime = (existing.averageTime + (session.timeSpent / session.questionsAnswered)) / 2
        existing.lastPracticed = session.date > existing.lastPracticed ? session.date : existing.lastPracticed
      } else {
        const accuracy = session.questionsAnswered > 0 
          ? (session.correctAnswers / session.questionsAnswered) * 100 
          : 0
        const averageTime = session.questionsAnswered > 0 
          ? session.timeSpent / session.questionsAnswered 
          : 0

        topicMap.set(session.topicId, {
          topicId: session.topicId,
          topicName: session.topicName,
          totalQuestions: session.questionsAnswered,
          correctAnswers: session.correctAnswers,
          accuracy,
          averageTime,
          difficulty: session.difficulty,
          masteryLevel: this.calculateMasteryLevel(accuracy, session.questionsAnswered),
          lastPracticed: session.date
        })
      }
    })

    return Array.from(topicMap.values()).sort((a, b) => b.accuracy - a.accuracy)
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private calculateStreakDays(sessions: Array<{ date: string }>): number {
    if (sessions.length === 0) return 0

    const uniqueDates = [...new Set(sessions.map(s => s.date))].sort()
    let streak = 0
    let currentDate = new Date()

    // Start from today and count backwards
    for (let i = uniqueDates.length - 1; i >= 0; i--) {
      const sessionDate = new Date(uniqueDates[i])
      const daysDiff = Math.floor((currentDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysDiff === streak) {
        streak++
      } else {
        break
      }
    }

    return streak
  }

  private calculateTrendSlope(points: Array<{ x: number; y: number }>): number {
    if (points.length < 2) return 0

    const n = points.length
    const sumX = points.reduce((sum, p) => sum + p.x, 0)
    const sumY = points.reduce((sum, p) => sum + p.y, 0)
    const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0)
    const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    return isNaN(slope) ? 0 : slope
  }

  private calculateConsistencyScore(dailyProgress: DailyProgress[]): number {
    if (dailyProgress.length === 0) return 0

    const daysWithActivity = dailyProgress.filter(d => d.questionsAnswered > 0).length
    const totalDays = dailyProgress.length
    
    return (daysWithActivity / totalDays) * 100
  }

  private calculateDifficultyProgression(dailyProgress: DailyProgress[]): number {
    // Placeholder - would need difficulty data to implement properly
    return Math.random() * 100 // Temporary placeholder
  }

  private calculateRetentionRate(dailyProgress: DailyProgress[]): number {
    // Placeholder - would need retention test data to implement properly
    const avgAccuracy = dailyProgress.reduce((sum, d) => sum + d.accuracy, 0) / dailyProgress.length
    return avgAccuracy // Simplified approximation
  }

  private calculatePeriodAverage(
    period: DailyProgress[], 
    metric: 'accuracy' | 'questionsAnswered' | 'timeSpent'
  ): number {
    if (period.length === 0) return 0

    const sum = period.reduce((total, day) => total + day[metric], 0)
    return sum / period.length
  }

  private calculateMasteryLevel(accuracy: number, questionsAnswered: number): number {
    // Simple mastery calculation based on accuracy and volume
    const accuracyWeight = 0.7
    const volumeWeight = 0.3
    const maxVolume = 100 // Normalize volume to 100 questions

    const accuracyScore = Math.min(accuracy, 100)
    const volumeScore = Math.min((questionsAnswered / maxVolume) * 100, 100)

    return accuracyScore * accuracyWeight + volumeScore * volumeWeight
  }
}

// ============================================================================
// Statistics Aggregator
// ============================================================================

export class StatisticsAggregator {
  private calculator: StatisticsCalculator

  constructor(config: StatisticsConfig) {
    this.calculator = new StatisticsCalculator(config)
  }

  /**
   * Generate comprehensive statistics report
   */
  generateReport(rawData: {
    sessions: Array<{
      date: string
      questionsAnswered: number
      correctAnswers: number
      timeSpent: number
      topicId?: string
      topicName?: string
      difficulty?: 'easy' | 'medium' | 'hard'
    }>
    dailyGoal: number
  }) {
    const { sessions, dailyGoal } = rawData

    const userStats = this.calculator.calculateUserStats(sessions)
    const dailyProgress = this.calculator.calculateDailyProgress(sessions, dailyGoal)
    const performanceMetrics = this.calculator.calculatePerformanceMetrics(dailyProgress)
    const accuracyTrends = this.calculator.calculateTrends(dailyProgress, 'accuracy')
    const volumeTrends = this.calculator.calculateTrends(dailyProgress, 'questionsAnswered')

    // Topic statistics (if topic data is available)
    const topicSessions = sessions.filter(s => s.topicId && s.topicName && s.difficulty)
    const topicStatistics = topicSessions.length > 0 
      ? this.calculator.calculateTopicStatistics(topicSessions as any)
      : []

    return {
      userStats,
      dailyProgress,
      performanceMetrics,
      trends: {
        accuracy: accuracyTrends,
        volume: volumeTrends
      },
      topicStatistics,
      summary: this.generateSummary(userStats, performanceMetrics, dailyProgress)
    }
  }

  private generateSummary(
    userStats: UserStats, 
    metrics: PerformanceMetrics,
    dailyProgress: DailyProgress[]
  ) {
    const recentDays = dailyProgress.slice(-7)
    const avgDailyQuestions = recentDays.length > 0 
      ? recentDays.reduce((sum, d) => sum + d.questionsAnswered, 0) / recentDays.length
      : 0

    return {
      totalPracticeTime: this.formatTime(userStats.totalTime),
      averageAccuracy: `${userStats.accuracy.toFixed(1)}%`,
      currentStreak: `${userStats.streakDays} days`,
      weeklyAverage: `${avgDailyQuestions.toFixed(1)} questions/day`,
      improvementTrend: metrics.improvementRate > 0 ? 'Improving' : 
                       metrics.improvementRate < 0 ? 'Declining' : 'Stable',
      consistencyRating: this.getConsistencyRating(metrics.consistencyScore)
    }
  }

  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  private getConsistencyRating(score: number): string {
    if (score >= 80) return 'Excellent'
    if (score >= 60) return 'Good'
    if (score >= 40) return 'Fair'
    return 'Needs Improvement'
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format statistics for display
 */
export function formatStatistic(value: number, type: 'percentage' | 'time' | 'count' | 'decimal'): string {
  switch (type) {
    case 'percentage':
      return `${value.toFixed(1)}%`
    case 'time':
      return formatTime(value)
    case 'count':
      return value.toLocaleString()
    case 'decimal':
      return value.toFixed(2)
    default:
      return value.toString()
  }
}

/**
 * Format time duration
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  } else {
    return `${remainingSeconds}s`
  }
}

/**
 * Calculate percentage change
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

/**
 * Get trend indicator
 */
export function getTrendIndicator(change: number): '📈' | '📉' | '➡️' {
  if (Math.abs(change) < 1) return '➡️'
  return change > 0 ? '📈' : '📉'
}

/**
 * Calculate moving average
 */
export function calculateMovingAverage(values: number[], windowSize: number): number[] {
  const result: number[] = []
  
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1)
    const window = values.slice(start, i + 1)
    const average = window.reduce((sum, val) => sum + val, 0) / window.length
    result.push(average)
  }
  
  return result
}

// ============================================================================
// Default Configuration
// ============================================================================

export const defaultStatisticsConfig: StatisticsConfig = {
  enableDetailedTracking: true,
  trackTimeSpent: true,
  trackStreaks: true,
  calculateTrends: true,
  retentionPeriodDays: 90,
  aggregationInterval: 'daily'
}

export default {
  StatisticsCalculator,
  StatisticsAggregator,
  formatStatistic,
  formatTime,
  calculatePercentageChange,
  getTrendIndicator,
  calculateMovingAverage,
  defaultStatisticsConfig
}