/**
 * Production Monitoring Configuration
 * Lightweight, production-optimized monitoring setup for frontend
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ProductionMonitoringConfig {
  environment: string
  serviceName: string
  version: string
  errorTracking: ErrorTrackingConfig
  performance: PerformanceConfig
  analytics: AnalyticsConfig
  features: FeatureFlags
}

export interface ErrorTrackingConfig {
  enabled: boolean
  sentryDsn?: string
  sampleRate: number
  maxReports: number
  enableConsoleLogging: boolean
  enableUserReporting: boolean
  batchSize: number
  flushInterval: number
}

export interface PerformanceConfig {
  enabled: boolean
  maxMetrics: number
  reportInterval: number
  enableDetailedTracing: boolean
  enableMemoryMonitoring: boolean
  enableStorageMonitoring: boolean
  sampleRate: number
  thresholds: PerformanceThresholds
}

export interface PerformanceThresholds {
  slowApiCall: number
  slowRender: number
  highMemoryUsage: number
  largeBundle: number
}

export interface AnalyticsConfig {
  enabled: boolean
  endpoint?: string
  apiKey?: string
  batchSize: number
  flushInterval: number
  maxQueueSize: number
  enableUserTracking: boolean
  enablePerformanceTracking: boolean
  enableErrorTracking: boolean
  enableBusinessMetrics: boolean
  anonymizeData: boolean
}

export interface FeatureFlags {
  performanceDashboard: boolean
  developmentTesting: boolean
  verboseLogging: boolean
  detailedMetrics: boolean
  realTimeMonitoring: boolean
}

// ============================================================================
// Environment Detection
// ============================================================================

const getEnvironment = (): string => {
  // Check various environment indicators
  if (typeof window !== 'undefined') {
    // Browser environment
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'development'
    }
    if (window.location.hostname.includes('staging') || window.location.hostname.includes('test')) {
      return 'staging'
    }
  }
  
  // Check build-time environment variables
  if (import.meta.env?.MODE === 'production') {
    return 'production'
  }
  if (import.meta.env?.MODE === 'staging') {
    return 'staging'
  }
  
  // Check runtime environment variables
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return 'production'
  }
  
  return 'development'
}

const getVersion = (): string => {
  return import.meta.env?.VITE_APP_VERSION || 
         (typeof process !== 'undefined' ? process.env?.VITE_APP_VERSION : undefined) || 
         '1.0.0'
}

// ============================================================================
// Configuration Factory
// ============================================================================

class ProductionMonitoringConfigFactory {
  private environment: string
  private version: string

  constructor() {
    this.environment = getEnvironment()
    this.version = getVersion()
  }

  createConfig(): ProductionMonitoringConfig {
    switch (this.environment) {
      case 'production':
        return this.createProductionConfig()
      case 'staging':
        return this.createStagingConfig()
      default:
        return this.createDevelopmentConfig()
    }
  }

  private createProductionConfig(): ProductionMonitoringConfig {
    return {
      environment: 'production',
      serviceName: 'tgapp-fsrs-frontend',
      version: this.version,
      
      errorTracking: {
        enabled: true,
        sentryDsn: import.meta.env?.VITE_SENTRY_DSN,
        sampleRate: 0.1, // Sample 10% of errors
        maxReports: 100, // Reduced from development
        enableConsoleLogging: false, // Disabled in production
        enableUserReporting: true,
        batchSize: 10,
        flushInterval: 30000, // 30 seconds
      },

      performance: {
        enabled: true,
        maxMetrics: 500, // Reduced from development
        reportInterval: 300000, // 5 minutes
        enableDetailedTracing: false, // Disabled for performance
        enableMemoryMonitoring: false, // Disabled for performance
        enableStorageMonitoring: false, // Disabled for performance
        sampleRate: 0.05, // Sample 5% of operations
        thresholds: {
          slowApiCall: 5000, // 5 seconds
          slowRender: 200, // 200ms
          highMemoryUsage: 100 * 1024 * 1024, // 100MB
          largeBundle: 500 * 1024, // 500KB
        },
      },

      analytics: {
        enabled: true,
        endpoint: import.meta.env?.VITE_ANALYTICS_ENDPOINT,
        apiKey: import.meta.env?.VITE_ANALYTICS_API_KEY,
        batchSize: 50,
        flushInterval: 60000, // 1 minute
        maxQueueSize: 500,
        enableUserTracking: true,
        enablePerformanceTracking: true,
        enableErrorTracking: true,
        enableBusinessMetrics: true,
        anonymizeData: true, // Always anonymize in production
      },

      features: {
        performanceDashboard: false, // Disabled in production
        developmentTesting: false, // Disabled in production
        verboseLogging: false, // Disabled in production
        detailedMetrics: false, // Disabled in production
        realTimeMonitoring: false, // Disabled for performance
      },
    }
  }

  private createStagingConfig(): ProductionMonitoringConfig {
    const productionConfig = this.createProductionConfig()
    
    return {
      ...productionConfig,
      environment: 'staging',
      
      errorTracking: {
        ...productionConfig.errorTracking,
        sampleRate: 0.5, // Higher sampling in staging
        enableConsoleLogging: true, // Enable for debugging
      },

      performance: {
        ...productionConfig.performance,
        enableDetailedTracing: true, // Enable for debugging
        sampleRate: 0.2, // Higher sampling in staging
      },

      analytics: {
        ...productionConfig.analytics,
        anonymizeData: false, // Don't anonymize in staging
      },

      features: {
        ...productionConfig.features,
        performanceDashboard: true, // Enable in staging
        verboseLogging: true, // Enable for debugging
      },
    }
  }

  private createDevelopmentConfig(): ProductionMonitoringConfig {
    return {
      environment: 'development',
      serviceName: 'tgapp-fsrs-frontend',
      version: this.version,
      
      errorTracking: {
        enabled: true,
        sampleRate: 1.0, // Sample all errors in development
        maxReports: 1000,
        enableConsoleLogging: true,
        enableUserReporting: true,
        batchSize: 1, // Immediate reporting
        flushInterval: 1000, // 1 second
      },

      performance: {
        enabled: true,
        maxMetrics: 10000,
        reportInterval: 60000, // 1 minute
        enableDetailedTracing: true,
        enableMemoryMonitoring: true,
        enableStorageMonitoring: true,
        sampleRate: 1.0, // Sample all operations
        thresholds: {
          slowApiCall: 2000, // 2 seconds
          slowRender: 100, // 100ms
          highMemoryUsage: 50 * 1024 * 1024, // 50MB
          largeBundle: 200 * 1024, // 200KB
        },
      },

      analytics: {
        enabled: false, // Disabled in development
        batchSize: 1,
        flushInterval: 1000,
        maxQueueSize: 100,
        enableUserTracking: false,
        enablePerformanceTracking: true,
        enableErrorTracking: true,
        enableBusinessMetrics: true,
        anonymizeData: false,
      },

      features: {
        performanceDashboard: true,
        developmentTesting: true,
        verboseLogging: true,
        detailedMetrics: true,
        realTimeMonitoring: true,
      },
    }
  }
}

// ============================================================================
// Configuration Instance
// ============================================================================

const configFactory = new ProductionMonitoringConfigFactory()
export const productionMonitoringConfig = configFactory.createConfig()

// ============================================================================
// Utility Functions
// ============================================================================

export const isProductionEnvironment = (): boolean => {
  return productionMonitoringConfig.environment === 'production'
}

export const isStagingEnvironment = (): boolean => {
  return productionMonitoringConfig.environment === 'staging'
}

export const isDevelopmentEnvironment = (): boolean => {
  return productionMonitoringConfig.environment === 'development'
}

export const shouldEnableFeature = (feature: keyof FeatureFlags): boolean => {
  return productionMonitoringConfig.features[feature]
}

export const getMonitoringConfig = (): ProductionMonitoringConfig => {
  return productionMonitoringConfig
}

export const validateConfiguration = (): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} => {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check Sentry configuration
  if (productionMonitoringConfig.errorTracking.enabled && !productionMonitoringConfig.errorTracking.sentryDsn) {
    if (isProductionEnvironment()) {
      errors.push('Sentry DSN is required for production error tracking')
    } else {
      warnings.push('Sentry DSN not configured - error tracking will use console only')
    }
  }
  
  // Check analytics configuration
  if (productionMonitoringConfig.analytics.enabled && !productionMonitoringConfig.analytics.endpoint) {
    if (isProductionEnvironment()) {
      warnings.push('Analytics endpoint not configured - analytics will be disabled')
    }
  }
  
  // Check performance thresholds
  const thresholds = productionMonitoringConfig.performance.thresholds
  if (thresholds.slowApiCall < 1000) {
    warnings.push('API call threshold may be too aggressive for production')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

// ============================================================================
// Configuration Summary
// ============================================================================

export const getConfigurationSummary = (): Record<string, any> => {
  const config = productionMonitoringConfig
  const validation = validateConfiguration()
  
  return {
    environment: config.environment,
    serviceName: config.serviceName,
    version: config.version,
    features: {
      errorTracking: config.errorTracking.enabled,
      performanceMonitoring: config.performance.enabled,
      analytics: config.analytics.enabled,
      dashboard: config.features.performanceDashboard,
      verboseLogging: config.features.verboseLogging,
    },
    validation: {
      isValid: validation.isValid,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
    },
    optimizations: {
      reducedMetrics: config.performance.maxMetrics < 1000,
      sampledOperations: config.performance.sampleRate < 1.0,
      batchedReporting: config.errorTracking.batchSize > 1,
      disabledDetailedTracing: !config.performance.enableDetailedTracing,
    }
  }
}

// ============================================================================
// Export Default Configuration
// ============================================================================

export default productionMonitoringConfig