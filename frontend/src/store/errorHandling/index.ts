// Error Handling System - Main Export File
// This file provides a centralized export for all error handling components

// ============================================================================
// Core Error Recovery System
// ============================================================================

export {
  errorRecoveryManager,
  handleError,
  recoverFromError,
  withErrorRecovery,
  useErrorRecovery
} from './errorRecovery'

export type {
  AppError,
  ErrorType,
  ErrorSeverity,
  ErrorContext,
  RecoveryAction,
  RecoveryType,
  ErrorRecoveryConfig
} from './errorRecovery'

// ============================================================================
// Enhanced Error Recovery
// ============================================================================

export {
  useEnhancedErrorRecovery,
  useSystemErrorRecovery,
  useGracefulDegradation,
  useErrorRecoveryContext,
  classifyError
} from './enhancedErrorRecovery'

// ============================================================================
// Error Boundaries
// ============================================================================

export {
  GlobalErrorBoundary,
  withErrorBoundary,
  useErrorBoundary
} from '../../components/ErrorBoundary/GlobalErrorBoundary'

export type {
  ErrorFallbackProps
} from '../../components/ErrorBoundary/GlobalErrorBoundary'

export {
  ErrorFallbackUI,
  CompactErrorFallback
} from '../../components/ErrorBoundary/ErrorFallbackUI'

export {
  PageErrorBoundary,
  ComponentErrorBoundary,
  NavigationErrorBoundary,
  FormErrorBoundary,
  DataDisplayErrorBoundary,
  ChartErrorBoundary,
  APIErrorBoundary,
  FSRSErrorBoundary,
  SettingsErrorBoundary,
  StatisticsErrorBoundary,
  withPageErrorBoundary,
  withComponentErrorBoundary,
  withFormErrorBoundary,
  withDataDisplayErrorBoundary,
  withChartErrorBoundary,
  withAPIErrorBoundary,
  withFSRSErrorBoundary
} from '../../components/ErrorBoundary/SectionErrorBoundaries'

// ============================================================================
// Toast Notifications
// ============================================================================

export {
  ToastProvider,
  useToast,
  useErrorToast,
  useSuccessToast,
  useWarningToast,
  useInfoToast
} from '../../components/Notifications/ToastNotification'

export type {
  Toast,
  ToastType,
  ToastPosition,
  ToastAction
} from '../../components/Notifications/ToastNotification'

// ============================================================================
// Error Reporting and Analytics
// ============================================================================

export {
  ErrorReportingService,
  useErrorReporting
} from '../../services/errorReporting'

export type {
  ErrorReport,
  ErrorAnalytics
} from '../../services/errorReporting'

// ============================================================================
// Error Logging and Debugging
// ============================================================================

export {
  errorLogger,
  useErrorLogger,
  createDebugPanel
} from '../../utils/errorLogging'

export type {
  ErrorLogEntry,
  DebugInfo
} from '../../utils/errorLogging'

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Initialize the complete error handling system
 * Call this once in your app's main entry point
 */
export const initializeErrorHandling = () => {
  console.log('🛡️ Initializing comprehensive error handling system...')
  
  // Error recovery manager is automatically initialized
  console.log('✅ Error recovery manager initialized')
  
  // Error reporting service is automatically initialized
  console.log('✅ Error reporting service initialized')
  
  // Error logger is automatically initialized
  console.log('✅ Error logger initialized')
  
  // Debug panel is automatically created in development
  if (import.meta.env?.MODE === 'development') {
    console.log('🐛 Debug panel available in development mode')
  }
  
  console.log('🎉 Error handling system fully initialized!')
}

/**
 * Get comprehensive error system status
 */
export const getErrorSystemStatus = () => {
  return {
    errorRecovery: {
      stats: errorRecoveryManager.getStats(),
      isActive: true
    },
    errorReporting: {
      analytics: ErrorReportingService.getAnalytics(),
      isActive: true
    },
    errorLogging: {
      recentLogs: errorLogger.getLogs({ limit: 10 }),
      debugInfo: errorLogger.getDebugInfo(),
      isActive: true
    }
  }
}

/**
 * Export debug information for support
 */
export const exportErrorSystemDebugInfo = () => {
  const status = getErrorSystemStatus()
  const debugData = {
    timestamp: Date.now(),
    systemStatus: status,
    errorLogs: errorLogger.exportLogs(),
    errorReports: ErrorReportingService.exportReports(),
    userAgent: navigator.userAgent,
    url: window.location.href
  }
  
  return JSON.stringify(debugData, null, 2)
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  // Core functions
  initializeErrorHandling,
  getErrorSystemStatus,
  exportErrorSystemDebugInfo,
  
  // Error recovery
  errorRecoveryManager,
  handleError,
  recoverFromError,
  withErrorRecovery,
  
  // Error boundaries
  GlobalErrorBoundary,
  PageErrorBoundary,
  ComponentErrorBoundary,
  
  // Toast notifications
  ToastProvider,
  useToast,
  useErrorToast,
  
  // Error reporting
  ErrorReportingService,
  
  // Error logging
  errorLogger,
  useErrorLogger,
  
  // Enhanced recovery
  useEnhancedErrorRecovery,
  useSystemErrorRecovery,
  useGracefulDegradation,
  
  // Classification
  classifyError
}