/**
 * Production Analytics Service
 * Lightweight analytics and metrics collection for production
 */

import { productionMonitoringConfig, isProductionEnvironment } from '../config/monitoring.production'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface AnalyticsEvent {
  name: string
  category: string
  properties?: Record<string, any>
  timestamp?: number
  userId?: string
  sessionId?: string
}

export interface UserProperties {
  userId?: string
  sessionId?: string
  userAgent?: string
  language?: string
  timezone?: string
  screenResolution?: string
  deviceType?: 'mobile' | 'tablet' | 'desktop'
  connectionType?: string
  downlink?: number
  [key: string]: any // Allow additional properties
}

export interface PerformanceMetric {
  name: string
  value: number
  unit: string
  category: string
  timestamp?: number
}

export interface BusinessMetric {
  name: string
  value: number | string
  category: string
  metadata?: Record<string, any>
  timestamp?: number
}

// ============================================================================
// Analytics Queue and Batching
// ============================================================================

class AnalyticsQueue {
  private queue: AnalyticsEvent[] = []
  private maxQueueSize: number
  private batchSize: number
  private flushInterval: number
  private flushTimer?: NodeJS.Timeout

  constructor(maxQueueSize: number, batchSize: number, flushInterval: number) {
    this.maxQueueSize = maxQueueSize
    this.batchSize = batchSize
    this.flushInterval = flushInterval
    this.startFlushTimer()
  }

  add(event: AnalyticsEvent): void {
    // Add timestamp if not provided
    if (!event.timestamp) {
      event.timestamp = Date.now()
    }

    this.queue.push(event)

    // Prevent queue overflow
    if (this.queue.length > this.maxQueueSize) {
      this.queue.shift() // Remove oldest event
    }

    // Flush if batch size reached
    if (this.queue.length >= this.batchSize) {
      this.flush()
    }
  }

  flush(): AnalyticsEvent[] {
    if (this.queue.length === 0) return []

    const events = this.queue.splice(0, this.batchSize)
    return events
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.queue.length > 0) {
        this.flush()
      }
    }, this.flushInterval)
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
  }
}

// ============================================================================
// Production Analytics Service
// ============================================================================

class ProductionAnalyticsService {
  private config = productionMonitoringConfig.analytics
  private queue: AnalyticsQueue
  private userProperties: UserProperties = {}
  private sessionId: string
  private initialized = false

  constructor() {
    this.sessionId = this.generateSessionId()
    this.queue = new AnalyticsQueue(
      this.config.maxQueueSize,
      this.config.batchSize,
      this.config.flushInterval
    )
    
    this.detectUserProperties()
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.initialized || !this.config.enabled) return

    try {
      // Set up user properties
      this.userProperties.sessionId = this.sessionId
      this.userProperties.userAgent = navigator.userAgent
      this.userProperties.language = navigator.language
      this.userProperties.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      this.userProperties.screenResolution = `${screen.width}x${screen.height}`
      this.userProperties.deviceType = this.detectDeviceType()

      this.initialized = true

      // Track session start
      this.trackEvent({
        name: 'session_start',
        category: 'session',
        properties: {
          ...this.userProperties,
          environment: productionMonitoringConfig.environment,
          version: productionMonitoringConfig.version
        }
      })

      console.log('Production analytics initialized')
    } catch (error) {
      console.warn('Failed to initialize analytics:', error)
    }
  }

  // ============================================================================
  // Event Tracking
  // ============================================================================

  trackEvent(event: Omit<AnalyticsEvent, 'timestamp' | 'sessionId'>): void {
    if (!this.config.enabled) return

    const fullEvent: AnalyticsEvent = {
      ...event,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userProperties.userId
    }

    // Anonymize data if required
    if (this.config.anonymizeData) {
      fullEvent.userId = this.hashUserId(fullEvent.userId)
      fullEvent.properties = this.anonymizeProperties(fullEvent.properties)
    }

    this.queue.add(fullEvent)

    // Log in development
    if (!isProductionEnvironment()) {
      console.log('Analytics event:', fullEvent)
    }
  }

  trackPageView(page: string, properties?: Record<string, any>): void {
    this.trackEvent({
      name: 'page_view',
      category: 'navigation',
      properties: {
        page,
        url: window.location.href,
        referrer: document.referrer,
        ...properties
      }
    })
  }

  trackUserAction(action: string, component: string, properties?: Record<string, any>): void {
    this.trackEvent({
      name: 'user_action',
      category: 'interaction',
      properties: {
        action,
        component,
        ...properties
      }
    })
  }

  trackPerformanceMetric(metric: PerformanceMetric): void {
    if (!this.config.enablePerformanceTracking) return

    this.trackEvent({
      name: 'performance_metric',
      category: 'performance',
      properties: {
        metricName: metric.name,
        value: metric.value,
        unit: metric.unit,
        category: metric.category
      }
    })
  }

  trackError(error: Error, context?: Record<string, any>): void {
    if (!this.config.enableErrorTracking) return

    this.trackEvent({
      name: 'error_occurred',
      category: 'error',
      properties: {
        errorMessage: error.message,
        errorName: error.name,
        stack: error.stack?.substring(0, 500), // Truncate stack trace
        ...context
      }
    })
  }

  trackBusinessMetric(metric: BusinessMetric): void {
    if (!this.config.enableBusinessMetrics) return

    this.trackEvent({
      name: 'business_metric',
      category: 'business',
      properties: {
        metricName: metric.name,
        value: metric.value,
        category: metric.category,
        ...metric.metadata
      }
    })
  }

  // ============================================================================
  // User Management
  // ============================================================================

  setUserId(userId: string): void {
    this.userProperties.userId = userId
  }

  setUserProperties(properties: Partial<UserProperties>): void {
    this.userProperties = { ...this.userProperties, ...properties }
  }

  // ============================================================================
  // FSRS-Specific Analytics
  // ============================================================================

  trackFSRSEvent(eventType: string, data: Record<string, any>): void {
    this.trackEvent({
      name: `fsrs_${eventType}`,
      category: 'fsrs',
      properties: {
        eventType,
        ...data
      }
    })
  }

  trackQuestionAnswered(questionId: string, difficulty: number, responseTime: number): void {
    this.trackFSRSEvent('question_answered', {
      questionId,
      difficulty,
      responseTime,
      timestamp: Date.now()
    })
  }

  trackStudySession(duration: number, questionsAnswered: number, accuracy: number): void {
    this.trackFSRSEvent('study_session_completed', {
      duration,
      questionsAnswered,
      accuracy,
      timestamp: Date.now()
    })
  }

  trackSettingsChanged(settingName: string, oldValue: any, newValue: any): void {
    this.trackEvent({
      name: 'settings_changed',
      category: 'configuration',
      properties: {
        settingName,
        oldValue: String(oldValue),
        newValue: String(newValue)
      }
    })
  }

  // ============================================================================
  // Data Processing and Privacy
  // ============================================================================

  private anonymizeProperties(properties?: Record<string, any>): Record<string, any> | undefined {
    if (!properties) return properties

    const anonymized = { ...properties }
    
    // Remove or hash sensitive data
    const sensitiveKeys = ['email', 'phone', 'address', 'ip', 'userId']
    sensitiveKeys.forEach(key => {
      if (anonymized[key]) {
        anonymized[key] = this.hashValue(String(anonymized[key]))
      }
    })

    return anonymized
  }

  private hashUserId(userId?: string): string | undefined {
    if (!userId) return userId
    return this.hashValue(userId)
  }

  private hashValue(value: string): string {
    // Simple hash function for anonymization
    let hash = 0
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return `hash_${Math.abs(hash).toString(36)}`
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const userAgent = navigator.userAgent.toLowerCase()
    
    if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
      return 'mobile'
    }
    
    if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
      return 'tablet'
    }
    
    return 'desktop'
  }

  private detectUserProperties(): void {
    // Detect additional user properties
    try {
      // Connection type (if available)
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
      if (connection) {
        this.userProperties = {
          ...this.userProperties,
          connectionType: connection.effectiveType,
          downlink: connection.downlink
        }
      }
    } catch (error) {
      // Ignore errors in property detection
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    this.queue.destroy()
    
    // Track session end
    if (this.initialized) {
      this.trackEvent({
        name: 'session_end',
        category: 'session',
        properties: {
          duration: Date.now() - parseInt(this.sessionId.split('_')[1])
        }
      })
    }
  }
}

// ============================================================================
// Service Instance
// ============================================================================

export const productionAnalytics = new ProductionAnalyticsService()

// Set up cleanup on page unload
window.addEventListener('beforeunload', () => {
  productionAnalytics.destroy()
})

// ============================================================================
// React Hook
// ============================================================================

export const useProductionAnalytics = () => {
  return {
    trackEvent: productionAnalytics.trackEvent.bind(productionAnalytics),
    trackPageView: productionAnalytics.trackPageView.bind(productionAnalytics),
    trackUserAction: productionAnalytics.trackUserAction.bind(productionAnalytics),
    trackPerformanceMetric: productionAnalytics.trackPerformanceMetric.bind(productionAnalytics),
    trackError: productionAnalytics.trackError.bind(productionAnalytics),
    trackBusinessMetric: productionAnalytics.trackBusinessMetric.bind(productionAnalytics),
    trackFSRSEvent: productionAnalytics.trackFSRSEvent.bind(productionAnalytics),
    trackQuestionAnswered: productionAnalytics.trackQuestionAnswered.bind(productionAnalytics),
    trackStudySession: productionAnalytics.trackStudySession.bind(productionAnalytics),
    trackSettingsChanged: productionAnalytics.trackSettingsChanged.bind(productionAnalytics),
    setUserId: productionAnalytics.setUserId.bind(productionAnalytics),
    setUserProperties: productionAnalytics.setUserProperties.bind(productionAnalytics),
  }
}

// ============================================================================
// Export Default Service
// ============================================================================

export default productionAnalytics