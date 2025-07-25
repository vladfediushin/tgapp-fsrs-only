// Compatibility export for streakUtils.ts
// This file maintains backward compatibility while redirecting to the new consolidated structure
// @deprecated - Use imports from './features/goals' instead

export {
  getLast7LocalDates,
  calculateCurrentStreak,
  calculateMaxStreak
} from './features/goals'

// Re-export everything as default for backward compatibility
import goalsUtils from './features/goals'
export default goalsUtils
