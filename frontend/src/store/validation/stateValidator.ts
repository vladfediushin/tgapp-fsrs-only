// State Validation and Consistency Checking System
import { useState, useCallback } from 'react'
import { useUnifiedStore } from '../unified'
import { useOfflineQueue } from '../offlineQueue'
import { useSession } from '../session'
import { useFSRSStore } from '../fsrs'
import { useStatsStore } from '../stats'
import { stateLogger } from '../logging/stateLogger'

// ============================================================================
// Validation Types and Interfaces
// ============================================================================

export interface ValidationRule {
  name: string
  description: string
  severity: 'error' | 'warning' | 'info'
  category: string
  validate: (context: ValidationContext) => ValidationResult
}

export interface ValidationContext {
  unified: ReturnType<typeof useUnifiedStore.getState>
  session: ReturnType<typeof useSession.getState>
  fsrs: ReturnType<typeof useFSRSStore.getState>
  stats: ReturnType<typeof useStatsStore.getState>
  offlineQueue: ReturnType<typeof useOfflineQueue.getState>
  timestamp: number
}

export interface ValidationResult {
  isValid: boolean
  message?: string
  details?: any
  suggestedFix?: string
}

export interface ValidationReport {
  timestamp: number
  overallValid: boolean
  totalRules: number
  passedRules: number
  failedRules: number
  results: Array<{
    rule: ValidationRule
    result: ValidationResult
  }>
  summary: {
    errors: number
    warnings: number
    info: number
  }
}

// ============================================================================
// Core Validation Rules
// ============================================================================

// User Data Consistency Rules
export const userDataRules: ValidationRule[] = [
  {
    name: 'user-id-consistency',
    description: 'User ID should be consistent across all stores',
    severity: 'error',
    category: 'user-data',
    validate: (context) => {
      const unifiedUserId = context.unified.user?.id
      const sessionUserId = context.session.userId
      
      if (unifiedUserId && sessionUserId && unifiedUserId !== sessionUserId) {
        return {
          isValid: false,
          message: 'User ID mismatch between unified and session stores',
          details: { unified: unifiedUserId, session: sessionUserId },
          suggestedFix: 'Sync user data between stores'
        }
      }
      
      return { isValid: true }
    }
  },
  
  {
    name: 'user-data-completeness',
    description: 'User data should be complete when loaded',
    severity: 'warning',
    category: 'user-data',
    validate: (context) => {
      const user = context.unified.user || context.session.cachedUser
      
      if (user && (!user.id || !(user as any).telegram_id)) {
        return {
          isValid: false,
          message: 'User data is incomplete',
          details: { user },
          suggestedFix: 'Reload user data from server'
        }
      }
      
      return { isValid: true }
    }
  }
]

// Settings Consistency Rules
export const settingsRules: ValidationRule[] = [
  {
    name: 'settings-sync',
    description: 'Settings should be synchronized between stores',
    severity: 'warning',
    category: 'settings',
    validate: (context) => {
      const unifiedSettings = context.unified.settings
      const sessionSettings = {
        examCountry: context.session.examCountry,
        examLanguage: context.session.examLanguage,
        uiLanguage: context.session.uiLanguage,
        useFSRS: context.session.useFSRS,
        autoRating: context.session.autoRating
      }
      
      const mismatches: string[] = []
      
      if (unifiedSettings.examCountry !== sessionSettings.examCountry) {
        mismatches.push('examCountry')
      }
      if (unifiedSettings.examLanguage !== sessionSettings.examLanguage) {
        mismatches.push('examLanguage')
      }
      if (unifiedSettings.uiLanguage !== sessionSettings.uiLanguage) {
        mismatches.push('uiLanguage')
      }
      if (unifiedSettings.useFSRS !== sessionSettings.useFSRS) {
        mismatches.push('useFSRS')
      }
      if (unifiedSettings.autoRating !== sessionSettings.autoRating) {
        mismatches.push('autoRating')
      }
      
      if (mismatches.length > 0) {
        return {
          isValid: false,
          message: 'Settings mismatch between stores',
          details: { mismatches, unified: unifiedSettings, session: sessionSettings },
          suggestedFix: 'Synchronize settings between stores'
        }
      }
      
      return { isValid: true }
    }
  },
  
  {
    name: 'settings-validity',
    description: 'Settings values should be valid',
    severity: 'error',
    category: 'settings',
    validate: (context) => {
      const settings = context.unified.settings
      const validCountries = ['am', 'ru', 'us', 'uk'] // Add more as needed
      const validLanguages = ['ru', 'en', 'hy'] // Add more as needed
      
      const issues: string[] = []
      
      if (!validCountries.includes(settings.examCountry)) {
        issues.push(`Invalid exam country: ${settings.examCountry}`)
      }
      
      if (!validLanguages.includes(settings.examLanguage)) {
        issues.push(`Invalid exam language: ${settings.examLanguage}`)
      }
      
      if (!validLanguages.includes(settings.uiLanguage)) {
        issues.push(`Invalid UI language: ${settings.uiLanguage}`)
      }
      
      if (settings.manualDailyGoal !== null && settings.manualDailyGoal < 1) {
        issues.push(`Invalid daily goal: ${settings.manualDailyGoal}`)
      }
      
      if (issues.length > 0) {
        return {
          isValid: false,
          message: 'Invalid settings detected',
          details: { issues },
          suggestedFix: 'Reset settings to valid defaults'
        }
      }
      
      return { isValid: true }
    }
  }
]

// Cache Consistency Rules
export const cacheRules: ValidationRule[] = [
  {
    name: 'cache-size-limits',
    description: 'Cache sizes should be within reasonable limits',
    severity: 'warning',
    category: 'cache',
    validate: (context) => {
      const memorySize = context.unified.memoryCache.size
      const localStorageSize = context.unified.localStorageCache.size
      
      const issues: string[] = []
      
      if (memorySize > 1000) {
        issues.push(`Memory cache too large: ${memorySize} entries`)
      }
      
      if (localStorageSize > 500) {
        issues.push(`LocalStorage cache too large: ${localStorageSize} entries`)
      }
      
      if (issues.length > 0) {
        return {
          isValid: false,
          message: 'Cache size limits exceeded',
          details: { issues, memorySize, localStorageSize },
          suggestedFix: 'Clear old cache entries or implement LRU eviction'
        }
      }
      
      return { isValid: true }
    }
  },
  
  {
    name: 'cache-hit-rate',
    description: 'Cache hit rate should be reasonable',
    severity: 'info',
    category: 'cache',
    validate: (context) => {
      const metrics = context.unified.metrics
      
      if (metrics.requests > 10 && metrics.hitRate < 0.3) {
        return {
          isValid: false,
          message: 'Low cache hit rate detected',
          details: { hitRate: metrics.hitRate, requests: metrics.requests },
          suggestedFix: 'Review cache TTL settings or preload critical data'
        }
      }
      
      return { isValid: true }
    }
  }
]

// FSRS Consistency Rules
export const fsrsRules: ValidationRule[] = [
  {
    name: 'fsrs-settings-consistency',
    description: 'FSRS settings should be consistent across stores',
    severity: 'warning',
    category: 'fsrs',
    validate: (context) => {
      const unifiedFSRS = context.unified.settings.useFSRS
      const sessionFSRS = context.session.useFSRS
      const fsrsEnabled = context.fsrs.settings.enabled
      
      if (unifiedFSRS !== sessionFSRS || unifiedFSRS !== fsrsEnabled) {
        return {
          isValid: false,
          message: 'FSRS settings inconsistent across stores',
          details: { unified: unifiedFSRS, session: sessionFSRS, fsrs: fsrsEnabled },
          suggestedFix: 'Synchronize FSRS settings'
        }
      }
      
      return { isValid: true }
    }
  },
  
  {
    name: 'fsrs-data-validity',
    description: 'FSRS data should be valid when enabled',
    severity: 'warning',
    category: 'fsrs',
    validate: (context) => {
      const fsrsEnabled = context.unified.settings.useFSRS
      const fsrsStats = context.unified.fsrsStats || context.fsrs.currentStats
      
      if (fsrsEnabled && !fsrsStats) {
        return {
          isValid: false,
          message: 'FSRS enabled but no stats available',
          details: { enabled: fsrsEnabled, stats: fsrsStats },
          suggestedFix: 'Load FSRS statistics'
        }
      }
      
      return { isValid: true }
    }
  }
]

// Offline Queue Rules
export const offlineQueueRules: ValidationRule[] = [
  {
    name: 'queue-size-check',
    description: 'Offline queue should not grow too large',
    severity: 'warning',
    category: 'offline',
    validate: (context) => {
      const queueSize = context.offlineQueue.queue.length
      
      if (queueSize > 100) {
        return {
          isValid: false,
          message: 'Offline queue is very large',
          details: { queueSize },
          suggestedFix: 'Check network connectivity and sync operations'
        }
      }
      
      return { isValid: true }
    }
  },
  
  {
    name: 'sync-status-check',
    description: 'Sync should not be stuck in error state',
    severity: 'error',
    category: 'offline',
    validate: (context) => {
      const queueStatus = context.offlineQueue.queueStatus
      const errors = context.offlineQueue.errors
      
      if (queueStatus === 'ERROR' && errors.length > 5) {
        return {
          isValid: false,
          message: 'Sync is stuck in error state with multiple failures',
          details: { status: queueStatus, errorCount: errors.length },
          suggestedFix: 'Clear queue errors and retry sync'
        }
      }
      
      return { isValid: true }
    }
  }
]

// Data Consistency Rules
export const dataConsistencyRules: ValidationRule[] = [
  {
    name: 'stats-consistency',
    description: 'Statistics should be consistent between stores',
    severity: 'warning',
    category: 'data',
    validate: (context) => {
      const unifiedStats = context.unified.userStats
      const legacyStats = context.stats.userStats
      
      if (unifiedStats && legacyStats) {
        const issues: string[] = []
        
        if (Math.abs(unifiedStats.total_questions - legacyStats.total_questions) > 0) {
          issues.push('total_questions mismatch')
        }
        
        if (Math.abs(unifiedStats.answered - legacyStats.answered) > 5) {
          issues.push('answered count significant difference')
        }
        
        if (issues.length > 0) {
          return {
            isValid: false,
            message: 'Statistics inconsistency detected',
            details: { issues, unified: unifiedStats, legacy: legacyStats },
            suggestedFix: 'Refresh statistics from server'
          }
        }
      }
      
      return { isValid: true }
    }
  },
  
  {
    name: 'progress-date-validity',
    description: 'Progress dates should be valid and recent',
    severity: 'warning',
    category: 'data',
    validate: (context) => {
      const dailyProgress = context.unified.dailyProgress
      const sessionProgress = context.session.dailyProgressDate
      
      const today = new Date().toISOString().split('T')[0]
      const issues: string[] = []
      
      if (dailyProgress && dailyProgress.date !== today) {
        issues.push(`Unified progress date is not today: ${dailyProgress.date}`)
      }
      
      if (sessionProgress && sessionProgress !== today) {
        issues.push(`Session progress date is not today: ${sessionProgress}`)
      }
      
      if (issues.length > 0) {
        return {
          isValid: false,
          message: 'Progress dates are not current',
          details: { issues, today },
          suggestedFix: 'Refresh daily progress data'
        }
      }
      
      return { isValid: true }
    }
  }
]

// ============================================================================
// State Validator Implementation
// ============================================================================

export class StateValidator {
  private rules: ValidationRule[] = []
  
  constructor() {
    this.loadDefaultRules()
  }
  
  private loadDefaultRules(): void {
    this.rules = [
      ...userDataRules,
      ...settingsRules,
      ...cacheRules,
      ...fsrsRules,
      ...offlineQueueRules,
      ...dataConsistencyRules
    ]
  }
  
  addRule(rule: ValidationRule): void {
    this.rules.push(rule)
  }
  
  removeRule(name: string): void {
    this.rules = this.rules.filter(rule => rule.name !== name)
  }
  
  getRules(category?: string): ValidationRule[] {
    if (category) {
      return this.rules.filter(rule => rule.category === category)
    }
    return [...this.rules]
  }
  
  async validate(context?: ValidationContext): Promise<ValidationReport> {
    const validationContext = context || this.createValidationContext()
    
    stateLogger.info('validation', 'Starting state validation', { 
      rulesCount: this.rules.length,
      timestamp: validationContext.timestamp 
    })
    
    const results: ValidationReport['results'] = []
    let errors = 0
    let warnings = 0
    let info = 0
    
    for (const rule of this.rules) {
      try {
        const result = rule.validate(validationContext)
        results.push({ rule, result })
        
        if (!result.isValid) {
          switch (rule.severity) {
            case 'error':
              errors++
              stateLogger.error('validation', `Validation error: ${rule.name}`, {
                rule: rule.name,
                message: result.message,
                details: result.details
              })
              break
            case 'warning':
              warnings++
              stateLogger.warn('validation', `Validation warning: ${rule.name}`, {
                rule: rule.name,
                message: result.message,
                details: result.details
              })
              break
            case 'info':
              info++
              stateLogger.info('validation', `Validation info: ${rule.name}`, {
                rule: rule.name,
                message: result.message,
                details: result.details
              })
              break
          }
        }
      } catch (error) {
        stateLogger.error('validation', `Rule execution failed: ${rule.name}`, { error })
        results.push({
          rule,
          result: {
            isValid: false,
            message: `Rule execution failed: ${(error as Error).message}`,
            details: { error }
          }
        })
        errors++
      }
    }
    
    const failedRules = results.filter(r => !r.result.isValid).length
    const passedRules = results.length - failedRules
    
    const report: ValidationReport = {
      timestamp: validationContext.timestamp,
      overallValid: errors === 0,
      totalRules: this.rules.length,
      passedRules,
      failedRules,
      results,
      summary: { errors, warnings, info }
    }
    
    stateLogger.info('validation', 'Validation completed', {
      overallValid: report.overallValid,
      totalRules: report.totalRules,
      passedRules: report.passedRules,
      failedRules: report.failedRules,
      summary: report.summary
    })
    
    return report
  }
  
  private createValidationContext(): ValidationContext {
    return {
      unified: useUnifiedStore.getState(),
      session: useSession.getState(),
      fsrs: useFSRSStore.getState(),
      stats: useStatsStore.getState(),
      offlineQueue: useOfflineQueue.getState(),
      timestamp: Date.now()
    }
  }
  
  async validateCategory(category: string): Promise<ValidationReport> {
    const categoryRules = this.getRules(category)
    const originalRules = this.rules
    
    try {
      this.rules = categoryRules
      return await this.validate()
    } finally {
      this.rules = originalRules
    }
  }
  
  async autoFix(report: ValidationReport): Promise<void> {
    stateLogger.info('validation', 'Starting auto-fix', { 
      fixableIssues: report.results.filter(r => !r.result.isValid && r.result.suggestedFix).length 
    })
    
    for (const { rule, result } of report.results) {
      if (!result.isValid && result.suggestedFix) {
        try {
          await this.applyFix(rule, result)
        } catch (error) {
          stateLogger.error('validation', `Auto-fix failed for ${rule.name}`, { error })
        }
      }
    }
  }
  
  private async applyFix(rule: ValidationRule, result: ValidationResult): Promise<void> {
    // This would implement specific fixes based on the rule and suggested fix
    // For now, just log the suggested fix
    stateLogger.info('validation', `Suggested fix for ${rule.name}: ${result.suggestedFix}`, {
      rule: rule.name,
      fix: result.suggestedFix,
      details: result.details
    })
  }
}

// ============================================================================
// Global Validator Instance
// ============================================================================

export const stateValidator = new StateValidator()

// ============================================================================
// React Hook for Validation
// ============================================================================

export const useStateValidation = () => {
  const [lastReport, setLastReport] = useState<ValidationReport | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  
  const validate = useCallback(async (category?: string) => {
    setIsValidating(true)
    try {
      const report = category ? 
        await stateValidator.validateCategory(category) : 
        await stateValidator.validate()
      setLastReport(report)
      return report
    } finally {
      setIsValidating(false)
    }
  }, [])
  
  const autoFix = useCallback(async (report?: ValidationReport) => {
    const reportToFix = report || lastReport
    if (reportToFix) {
      await stateValidator.autoFix(reportToFix)
    }
  }, [lastReport])
  
  return {
    validate,
    autoFix,
    lastReport,
    isValidating,
    validator: stateValidator
  }
}