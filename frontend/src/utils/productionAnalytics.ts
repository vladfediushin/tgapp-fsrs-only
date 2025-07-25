/**
 * Production Analytics and Performance Monitoring
 * Comprehensive user behavior tracking and performance analytics for production deployment
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface AnalyticsEvent {
  id: string
  timestamp: string
  type: 'page_view' | 'user_action' | 'performance' | 'error' | 'conversion' | 'engagement'
  category: string
  action: string
  label?: string
  value?: number
  userId?: string
  sessionId: string
  properties: Record<string, any>
  context: {
    url: string
    referrer: string
    userAgent: string
    viewport: { width: number; height: number }
    connection?: string
    language: string
    timezone: string
  }
}

export interface UserSession {
  id: string
  startTime: string
  endTime?: string
  userId?: string
  pageViews: number
  actions: number
  duration: number
  bounced: boolean
  converted: boolean
  source?: string
  medium?: string
  campaign?: string
}

export interface PerformanceMetrics {
  // Core Web Vitals
  fcp?: number // First Contentful Paint
  lcp?: number // Largest Contentful Paint
  fid?: number // First Input Delay
  cls?: number // Cumulative Layout Shift
  ttfb?: number // Time to First Byte
  
  // Custom Metrics
  pageLoadTime: number
  domInteractive: number
  domComplete: number
  resourceLoadTime: number
  
  // User Experience
  timeToInteractive: number
  firstInputDelay: number
  scrollDepth: number
  timeOnPage: number
  
  // Technical
  memoryUsage?: number
  connectionType?: string
  deviceType: 'mobile' | 'tablet' | 'desktop'
  browserName: string
  browserVersion: string
}

export interface ConversionGoal {
  id: string
  name: string
  type: 'page_view' | 'event' | 'duration' | 'sequence'
  conditions: {
    page?: string
    event?: string
    duration?: number
    sequence?: string[]
  }
  value?: number
}

export interface AnalyticsConfig {
  enabled: boolean
  trackingId?: string
  apiEndpoint?: string
  sampleRate: number
  enableUserTracking: boolean
  enablePerformanceTracking: boolean
  enableErrorTracking: boolean
  enableHeatmaps: boolean
  enableSessionRecording: boolean
  cookieConsent: boolean
  dataRetentionDays: number
  conversionGoals: ConversionGoal[]
}

// ============================================================================
// Analytics Engine
// ============================================================================

class ProductionAnalytics {
  private config: AnalyticsConfig
  private sessionId: string
  private userId?: string
  private session: UserSession
  private eventQueue: AnalyticsEvent[] = []
  private performanceObserver?: PerformanceObserver
  private isOnline: boolean = navigator.onLine
  private flushInterval?: NodeJS.Timeout
  private pageStartTime: number = performance.now()
  private scrollDepth: number = 0
  private maxScrollDepth: number = 0

  constructor(config: AnalyticsConfig) {
    this.config = config
    this.sessionId = this.generateSessionId()
    this.session = this.initializeSession()
    
    if (config.enabled) {
      this.initialize()
    }
  }

  private initialize(): void {
    // Setup performance monitoring
    if (this.config.enablePerformanceTracking) {
      this.setupPerformanceMonitoring()
    }
    
    // Setup user interaction tracking
    if (this.config.enableUserTracking) {
      this.setupUserTracking()
    }
    
    // Setup scroll tracking
    this.setupScrollTracking()
    
    // Setup page visibility tracking
    this.setupVisibilityTracking()
    
    // Setup online/offline handling
    this.setupConnectivityTracking()
    
    // Setup periodic flushing
    this.flushInterval = setInterval(() => this.flushEvents(), 30000) // Every 30 seconds
    
    // Setup beforeunload handler
    window.addEventListener('beforeunload', () => this.handlePageUnload())
    
    // Track initial page view
    this.trackPageView()
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private initializeSession(): UserSession {
    return {
      id: this.sessionId,
      startTime: new Date().toISOString(),
      pageViews: 0,
      actions: 0,
      duration: 0,
      bounced: true,
      converted: false,
      source: this.getTrafficSource(),
      medium: this.getTrafficMedium(),
      campaign: this.getCampaign(),
    }
  }

  private getTrafficSource(): string | undefined {
    const referrer = document.referrer
    if (!referrer) return 'direct'
    
    const url = new URL(referrer)
    const hostname = url.hostname.toLowerCase()
    
    // Social media sources
    if (hostname.includes('facebook')) return 'facebook'
    if (hostname.includes('twitter')) return 'twitter'
    if (hostname.includes('linkedin')) return 'linkedin'
    if (hostname.includes('instagram')) return 'instagram'
    
    // Search engines
    if (hostname.includes('google')) return 'google'
    if (hostname.includes('bing')) return 'bing'
    if (hostname.includes('yahoo')) return 'yahoo'
    
    return hostname
  }

  private getTrafficMedium(): string | undefined {
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get('utm_medium') || undefined
  }

  private getCampaign(): string | undefined {
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get('utm_campaign') || undefined
  }

  private setupPerformanceMonitoring(): void {
    // Core Web Vitals
    if ('PerformanceObserver' in window) {
      try {
        // LCP Observer
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as any
          if (lastEntry) {
            this.trackPerformanceMetric('lcp', lastEntry.startTime)
          }
        })
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

        // FCP Observer
        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          for (const entry of entries) {
            if (entry.name === 'first-contentful-paint') {
              this.trackPerformanceMetric('fcp', entry.startTime)
            }
          }
        })
        fcpObserver.observe({ entryTypes: ['paint'] })

        // FID Observer
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          for (const entry of entries) {
            this.trackPerformanceMetric('fid', (entry as any).processingStart - entry.startTime)
          }
        })
        fidObserver.observe({ entryTypes: ['first-input'] })

        // CLS Observer
        let clsValue = 0
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          for (const entry of entries) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value
            }
          }
          this.trackPerformanceMetric('cls', clsValue)
        })
        clsObserver.observe({ entryTypes: ['layout-shift'] })

      } catch (error) {
        console.warn('Performance observers not supported:', error)
      }
    }

    // Navigation timing
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        if (navigation) {
          this.trackEvent({
            type: 'performance',
            category: 'page_load',
            action: 'navigation_timing',
            properties: {
              ttfb: navigation.responseStart - navigation.requestStart,
              domInteractive: navigation.domInteractive - navigation.navigationStart,
              domComplete: navigation.domComplete - navigation.navigationStart,
              loadComplete: navigation.loadEventEnd - navigation.navigationStart,
            }
          })
        }
      }, 0)
    })
  }

  private setupUserTracking(): void {
    // Click tracking
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      if (target) {
        this.trackEvent({
          type: 'user_action',
          category: 'click',
          action: target.tagName.toLowerCase(),
          label: target.textContent?.slice(0, 100) || target.className || target.id,
          properties: {
            x: event.clientX,
            y: event.clientY,
            element: {
              tag: target.tagName,
              id: target.id,
              className: target.className,
              text: target.textContent?.slice(0, 100),
            }
          }
        })
      }
    })

    // Form interactions
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement
      if (form) {
        this.trackEvent({
          type: 'user_action',
          category: 'form',
          action: 'submit',
          label: form.id || form.className,
          properties: {
            formData: this.getFormData(form)
          }
        })
      }
    })

    // Input focus tracking
    document.addEventListener('focusin', (event) => {
      const target = event.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        this.trackEvent({
          type: 'engagement',
          category: 'form_interaction',
          action: 'focus',
          label: target.id || target.name || target.className,
        })
      }
    })
  }

  private setupScrollTracking(): void {
    let ticking = false
    
    const updateScrollDepth = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      
      this.scrollDepth = Math.round((scrollTop + windowHeight) / documentHeight * 100)
      this.maxScrollDepth = Math.max(this.maxScrollDepth, this.scrollDepth)
      
      // Track scroll milestones
      const milestones = [25, 50, 75, 90, 100]
      for (const milestone of milestones) {
        if (this.scrollDepth >= milestone && !this.hasTrackedScrollMilestone(milestone)) {
          this.trackEvent({
            type: 'engagement',
            category: 'scroll',
            action: 'depth',
            value: milestone,
            properties: { scrollDepth: this.scrollDepth }
          })
          this.markScrollMilestone(milestone)
        }
      }
      
      ticking = false
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollDepth)
        ticking = true
      }
    })
  }

  private scrollMilestones: Set<number> = new Set()

  private hasTrackedScrollMilestone(milestone: number): boolean {
    return this.scrollMilestones.has(milestone)
  }

  private markScrollMilestone(milestone: number): void {
    this.scrollMilestones.add(milestone)
  }

  private setupVisibilityTracking(): void {
    let visibilityStart = Date.now()
    
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        const visibleTime = Date.now() - visibilityStart
        this.trackEvent({
          type: 'engagement',
          category: 'page_visibility',
          action: 'hidden',
          value: visibleTime,
          properties: { timeVisible: visibleTime }
        })
      } else {
        visibilityStart = Date.now()
        this.trackEvent({
          type: 'engagement',
          category: 'page_visibility',
          action: 'visible'
        })
      }
    })
  }

  private setupConnectivityTracking(): void {
    window.addEventListener('online', () => {
      this.isOnline = true
      this.trackEvent({
        type: 'performance',
        category: 'connectivity',
        action: 'online'
      })
      this.flushEvents() // Flush queued events
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      this.trackEvent({
        type: 'performance',
        category: 'connectivity',
        action: 'offline'
      })
    })
  }

  private getFormData(form: HTMLFormElement): Record<string, any> {
    const formData = new FormData(form)
    const data: Record<string, any> = {}
    
    for (const [key, value] of formData.entries()) {
      // Don't track sensitive data
      if (key.toLowerCase().includes('password') || 
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('token')) {
        data[key] = '[REDACTED]'
      } else {
        data[key] = value
      }
    }
    
    return data
  }

  private trackPerformanceMetric(metric: string, value: number): void {
    this.trackEvent({
      type: 'performance',
      category: 'core_web_vitals',
      action: metric,
      value: Math.round(value),
      properties: { [metric]: value }
    })
  }

  private handlePageUnload(): void {
    const timeOnPage = performance.now() - this.pageStartTime
    
    this.trackEvent({
      type: 'engagement',
      category: 'page_unload',
      action: 'beforeunload',
      value: Math.round(timeOnPage),
      properties: {
        timeOnPage,
        maxScrollDepth: this.maxScrollDepth,
        actions: this.session.actions
      }
    })
    
    // Update session
    this.session.endTime = new Date().toISOString()
    this.session.duration = timeOnPage
    this.session.bounced = this.session.actions < 2 && timeOnPage < 30000 // Less than 30 seconds
    
    // Flush events synchronously
    this.flushEventsSync()
  }

  // Public methods
  public setUserId(userId: string): void {
    this.userId = userId
    this.session.userId = userId
    
    this.trackEvent({
      type: 'user_action',
      category: 'authentication',
      action: 'user_identified',
      properties: { userId }
    })
  }

  public trackPageView(page?: string): void {
    const url = page || window.location.pathname + window.location.search
    
    this.session.pageViews++
    this.pageStartTime = performance.now()
    this.scrollMilestones.clear()
    this.maxScrollDepth = 0
    
    this.trackEvent({
      type: 'page_view',
      category: 'navigation',
      action: 'page_view',
      label: url,
      properties: {
        page: url,
        title: document.title,
        referrer: document.referrer
      }
    })
  }

  public trackEvent(eventData: Partial<AnalyticsEvent>): void {
    if (!this.config.enabled) return
    
    // Sample rate check
    if (Math.random() > this.config.sampleRate) return
    
    const event: AnalyticsEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
      context: this.getContext(),
      type: 'user_action',
      category: 'unknown',
      action: 'unknown',
      properties: {},
      ...eventData
    }
    
    this.eventQueue.push(event)
    this.session.actions++
    
    // Check conversion goals
    this.checkConversionGoals(event)
    
    // Flush if queue is full
    if (this.eventQueue.length >= 50) {
      this.flushEvents()
    }
  }

  public trackConversion(goalId: string, value?: number): void {
    this.session.converted = true
    
    this.trackEvent({
      type: 'conversion',
      category: 'goal',
      action: 'conversion',
      label: goalId,
      value,
      properties: { goalId, conversionValue: value }
    })
  }

  private checkConversionGoals(event: AnalyticsEvent): void {
    for (const goal of this.config.conversionGoals) {
      let goalMet = false
      
      switch (goal.type) {
        case 'page_view':
          goalMet = event.type === 'page_view' && 
                   event.properties.page === goal.conditions.page
          break
        case 'event':
          goalMet = event.category === goal.conditions.event
          break
        case 'duration':
          goalMet = event.type === 'engagement' && 
                   (event.value || 0) >= (goal.conditions.duration || 0)
          break
      }
      
      if (goalMet) {
        this.trackConversion(goal.id, goal.value)
      }
    }
  }

  private getContext(): AnalyticsEvent['context'] {
    return {
      url: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      connection: (navigator as any).connection?.effectiveType,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0 || !this.isOnline) return
    
    const events = [...this.eventQueue]
    this.eventQueue = []
    
    try {
      if (this.config.apiEndpoint) {
        await fetch(this.config.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events, session: this.session })
        })
      }
      
      // Send to Google Analytics if configured
      if (this.config.trackingId && (window as any).gtag) {
        events.forEach(event => {
          (window as any).gtag('event', event.action, {
            event_category: event.category,
            event_label: event.label,
            value: event.value,
            custom_map: event.properties
          })
        })
      }
      
    } catch (error) {
      console.warn('Failed to send analytics events:', error)
      // Re-queue events for retry
      this.eventQueue.unshift(...events)
    }
  }

  private flushEventsSync(): void {
    if (this.eventQueue.length === 0) return
    
    const events = [...this.eventQueue]
    this.eventQueue = []
    
    if (this.config.apiEndpoint) {
      // Use sendBeacon for synchronous sending on page unload
      const data = JSON.stringify({ events, session: this.session })
      navigator.sendBeacon(this.config.apiEndpoint, data)
    }
  }

  public getSession(): UserSession {
    return { ...this.session }
  }

  public getEventQueue(): AnalyticsEvent[] {
    return [...this.eventQueue]
  }

  public destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    
    this.flushEventsSync()
  }
}

// ============================================================================
// Singleton Instance and Hooks
// ============================================================================

let analytics: ProductionAnalytics | null = null

export const initializeAnalytics = (config: AnalyticsConfig): ProductionAnalytics => {
  if (!analytics) {
    analytics = new ProductionAnalytics(config)
  }
  return analytics
}

export const getAnalytics = (): ProductionAnalytics | null => {
  return analytics
}

export const useAnalytics = () => {
  const [session, setSession] = useState<UserSession | null>(null)
  const [eventCount, setEventCount] = useState(0)

  useEffect(() => {
    const analyticsInstance = getAnalytics()
    if (!analyticsInstance) return

    const interval = setInterval(() => {
      setSession(analyticsInstance.getSession())
      setEventCount(analyticsInstance.getEventQueue().length)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const trackEvent = useCallback((eventData: Partial<AnalyticsEvent>) => {
    const analyticsInstance = getAnalytics()
    analyticsInstance?.trackEvent(eventData)
  }, [])

  const trackPageView = useCallback((page?: string) => {
    const analyticsInstance = getAnalytics()
    analyticsInstance?.trackPageView(page)
  }, [])

  const trackConversion = useCallback((goalId: string, value?: number) => {
    const analyticsInstance = getAnalytics()
    analyticsInstance?.trackConversion(goalId, value)
  }, [])

  const setUserId = useCallback((userId: string) => {
    const analyticsInstance = getAnalytics()
    analyticsInstance?.setUserId(userId)
  }, [])

  return {
    session,
    eventCount,
    trackEvent,
    trackPageView,
    trackConversion,
    setUserId
  }
}

// ============================================================================
// Default Configuration
// ============================================================================

export const defaultAnalyticsConfig: AnalyticsConfig = {
  enabled: import.meta.env.PROD || false,
  sampleRate: 1.0,
  enableUserTracking: true,
  enablePerformanceTracking: true,
  enableErrorTracking: true,
  enableHeatmaps: false,
  enableSessionRecording: false,
  cookieConsent: true,
  dataRetentionDays: 90,
  conversionGoals: [
    {
      id: 'question_answered',
      name: 'Question Answered',
      type: 'event',
      conditions: { event: 'question_interaction' }
    },
    {
      id: 'session_completed',
      name: 'Session Completed',
      type: 'duration',
      conditions: { duration: 300000 } // 5 minutes
    }
  ]
}