// Statistics Dashboard Testing and Validation Utility
import { useUnifiedStore } from '../../store/unified'
import type { FSRSStats, FSRSDueQuestion } from '../../api/fsrs'
import type { UserStats, DailyProgress, AnswersByDay } from '../../api/api'

// ============================================================================
// Mock Data Generation for Testing
// ============================================================================

export const generateMockUserStats = (): UserStats => ({
  total_questions: 1000,
  answered: 750,
  correct: 600
})

export const generateMockDailyProgress = (): DailyProgress => ({
  questions_mastered_today: 15,
  date: new Date().toISOString().split('T')[0]
})

export const generateMockStreakDays = (days: number = 30): AnswersByDay[] => {
  const streakData: AnswersByDay[] = []
  const today = new Date()
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    
    const totalAnswers = Math.floor(Math.random() * 30) + 5
    const correctAnswers = Math.floor(Math.random() * 25) + 3
    
    streakData.push({
      date: date.toISOString().split('T')[0],
      total_answers: totalAnswers,
      correct_answers: correctAnswers,
      incorrect_answers: totalAnswers - correctAnswers
    })
  }
  
  return streakData
}

export const generateMockFSRSStats = (): FSRSStats => ({
  total_cards: 500,
  due_count: 25,
  avg_stability: 8.5,
  avg_difficulty: 6.2,
  state_distribution: {
    '0': 50,  // New
    '1': 100, // Learning
    '2': 300, // Review
    '3': 50   // Relearning
  },
  state_distribution_named: {
    'New': 50,
    'Learning': 100,
    'Review': 300,
    'Relearning': 50
  }
})

// ============================================================================
// Performance Testing
// ============================================================================

export const testChartPerformance = (dataSize: number) => {
  console.log(`🧪 Testing chart performance with ${dataSize} data points`)
  
  const startTime = performance.now()
  
  // Generate large dataset
  const largeDataset = Array.from({ length: dataSize }, (_, i) => ({
    name: `Day ${i + 1}`,
    value: Math.floor(Math.random() * 100)
  }))
  
  const generationTime = performance.now() - startTime
  
  // Test data processing
  const processStart = performance.now()
  const processedData = largeDataset.map(item => ({
    ...item,
    percentage: (item.value / 100) * 100
  }))
  const processTime = performance.now() - processStart
  
  console.log(`📊 Chart Performance Results:`)
  console.log(`  - Data generation: ${generationTime.toFixed(2)}ms`)
  console.log(`  - Data processing: ${processTime.toFixed(2)}ms`)
  console.log(`  - Total time: ${(generationTime + processTime).toFixed(2)}ms`)
  
  return {
    dataSize,
    generationTime,
    processTime,
    totalTime: generationTime + processTime,
    data: processedData
  }
}

export const testHeatmapPerformance = (weeks: number = 52) => {
  console.log(`🧪 Testing heatmap performance with ${weeks} weeks of data`)
  
  const startTime = performance.now()
  
  // Generate year-long heatmap data
  const heatmapData: Array<{ date: string; value: number }> = []
  const today = new Date()
  
  for (let week = 0; week < weeks; week++) {
    for (let day = 0; day < 7; day++) {
      const date = new Date(today)
      date.setDate(today.getDate() - (weeks * 7) + (week * 7) + day)
      
      if (date <= today) {
        heatmapData.push({
          date: date.toISOString().split('T')[0],
          value: Math.floor(Math.random() * 20)
        })
      }
    }
  }
  
  const totalTime = performance.now() - startTime
  
  console.log(`🗓️ Heatmap Performance Results:`)
  console.log(`  - Data points: ${heatmapData.length}`)
  console.log(`  - Generation time: ${totalTime.toFixed(2)}ms`)
  
  return {
    dataPoints: heatmapData.length,
    generationTime: totalTime,
    data: heatmapData
  }
}

// ============================================================================
// Mobile Responsiveness Testing
// ============================================================================

export const testMobileResponsiveness = () => {
  const viewports = [
    { name: 'Mobile Portrait', width: 375, height: 667 },
    { name: 'Mobile Landscape', width: 667, height: 375 },
    { name: 'Tablet Portrait', width: 768, height: 1024 },
    { name: 'Tablet Landscape', width: 1024, height: 768 },
    { name: 'Desktop', width: 1920, height: 1080 }
  ]
  
  console.log('📱 Testing mobile responsiveness across viewports:')
  
  viewports.forEach(viewport => {
    // Simulate viewport change
    const originalWidth = window.innerWidth
    const originalHeight = window.innerHeight
    
    // Mock viewport dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: viewport.width
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: viewport.height
    })
    
    // Test responsive breakpoints
    const isMobile = viewport.width < 768
    const isTablet = viewport.width >= 768 && viewport.width < 1024
    const isDesktop = viewport.width >= 1024
    
    console.log(`  ${viewport.name} (${viewport.width}x${viewport.height}):`)
    console.log(`    - Mobile: ${isMobile}`)
    console.log(`    - Tablet: ${isTablet}`)
    console.log(`    - Desktop: ${isDesktop}`)
    
    // Restore original dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalWidth
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalHeight
    })
  })
}

// ============================================================================
// Data Validation Testing
// ============================================================================

export const validateStatisticsData = (data: {
  userStats?: UserStats | null
  dailyProgress?: DailyProgress | null
  streakDays?: AnswersByDay[] | null
  fsrsStats?: FSRSStats | null
}) => {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Validate user stats
  if (data.userStats) {
    const { total_questions, answered, correct } = data.userStats
    
    if (answered > total_questions) {
      errors.push('Answered questions cannot exceed total questions')
    }
    
    if (correct > answered) {
      errors.push('Correct answers cannot exceed answered questions')
    }
    
    if (total_questions < 0 || answered < 0 || correct < 0) {
      errors.push('Statistics values cannot be negative')
    }
    
    const accuracy = answered > 0 ? (correct / answered) * 100 : 0
    if (accuracy > 100) {
      errors.push('Accuracy cannot exceed 100%')
    }
    
    if (accuracy < 50 && answered > 10) {
      warnings.push('Low accuracy detected - consider reviewing study materials')
    }
  }
  
  // Validate daily progress
  if (data.dailyProgress) {
    const { questions_mastered_today } = data.dailyProgress
    
    if (questions_mastered_today < 0) {
      errors.push('Daily progress cannot be negative')
    }
    
    if (questions_mastered_today > 100) {
      warnings.push('Very high daily progress - verify data accuracy')
    }
  }
  
  // Validate streak days
  if (data.streakDays) {
    data.streakDays.forEach((day, index) => {
      if (day.correct_answers > day.total_answers) {
        errors.push(`Day ${index + 1}: Correct answers exceed total answers`)
      }
      
      if (day.total_answers < 0 || day.correct_answers < 0) {
        errors.push(`Day ${index + 1}: Negative values detected`)
      }
    })
  }
  
  // Validate FSRS stats
  if (data.fsrsStats) {
    const { total_cards, due_count, avg_stability, avg_difficulty } = data.fsrsStats
    
    if (due_count > total_cards) {
      errors.push('Due cards cannot exceed total cards')
    }
    
    if (avg_stability < 0 || avg_difficulty < 0) {
      errors.push('FSRS metrics cannot be negative')
    }
    
    if (avg_difficulty > 10) {
      warnings.push('Very high average difficulty detected')
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: {
      errorCount: errors.length,
      warningCount: warnings.length,
      status: errors.length === 0 ? 'valid' : 'invalid'
    }
  }
}

// ============================================================================
// Integration Testing
// ============================================================================

export const testStatisticsIntegration = async () => {
  console.log('🔧 Running statistics integration tests...')
  
  const tests = [
    {
      name: 'Mock Data Generation',
      test: () => {
        const userStats = generateMockUserStats()
        const dailyProgress = generateMockDailyProgress()
        const streakDays = generateMockStreakDays(7)
        const fsrsStats = generateMockFSRSStats()
        
        return !!(userStats && dailyProgress && streakDays.length === 7 && fsrsStats)
      }
    },
    {
      name: 'Data Validation',
      test: () => {
        const mockData = {
          userStats: generateMockUserStats(),
          dailyProgress: generateMockDailyProgress(),
          streakDays: generateMockStreakDays(7),
          fsrsStats: generateMockFSRSStats()
        }
        
        const validation = validateStatisticsData(mockData)
        return validation.isValid
      }
    },
    {
      name: 'Chart Performance',
      test: () => {
        const result = testChartPerformance(1000)
        return result.totalTime < 100 // Should complete within 100ms
      }
    },
    {
      name: 'Heatmap Performance',
      test: () => {
        const result = testHeatmapPerformance(12)
        return result.generationTime < 50 // Should complete within 50ms
      }
    }
  ]
  
  const results = tests.map(({ name, test }) => {
    const startTime = performance.now()
    let passed = false
    let error = null
    
    try {
      passed = test()
    } catch (e) {
      error = e
    }
    
    const duration = performance.now() - startTime
    
    console.log(`  ${passed ? '✅' : '❌'} ${name} (${duration.toFixed(2)}ms)`)
    if (error) {
      console.error(`    Error: ${error}`)
    }
    
    return { name, passed, duration, error }
  })
  
  const passedTests = results.filter(r => r.passed).length
  const totalTests = results.length
  
  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} passed`)
  
  return {
    passed: passedTests,
    total: totalTests,
    success: passedTests === totalTests,
    results
  }
}

export default {
  generateMockUserStats,
  generateMockDailyProgress,
  generateMockStreakDays,
  generateMockFSRSStats,
  testChartPerformance,
  testHeatmapPerformance,
  testMobileResponsiveness,
  validateStatisticsData,
  testStatisticsIntegration
}