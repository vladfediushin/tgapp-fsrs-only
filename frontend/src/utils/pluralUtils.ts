// Compatibility export for pluralUtils.ts
// This file maintains backward compatibility while redirecting to the new consolidated structure
// @deprecated - Use imports from './ui/formatting' instead

export {
  getStreakText
} from './ui/formatting'

// Re-export everything as default for backward compatibility
import formattingUtils from './ui/formatting'
export default formattingUtils
