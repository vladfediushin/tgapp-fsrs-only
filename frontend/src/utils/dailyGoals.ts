// Compatibility export for dailyGoals.ts
// This file maintains backward compatibility while redirecting to the new consolidated structure
// @deprecated - Use imports from './features/goals' instead

export {
  calculateDailyGoal,
  calculateTodayProgress,
  type DailyGoalData,
  type TodayProgress
} from './features/goals'

// Re-export everything as default for backward compatibility
import goalsUtils from './features/goals'
export default goalsUtils