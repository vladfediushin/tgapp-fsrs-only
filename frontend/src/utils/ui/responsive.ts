// Responsive Design Utilities
// Provides responsive breakpoints, media queries, and adaptive UI helpers
// Handles screen size detection, orientation changes, and responsive behavior

import { useState, useEffect, useCallback } from 'react'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface Breakpoints {
  xs: number
  sm: number
  md: number
  lg: number
  xl: number
  xxl: number
}

export interface ScreenInfo {
  width: number
  height: number
  breakpoint: keyof Breakpoints
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isLandscape: boolean
  isPortrait: boolean
  devicePixelRatio: number
  touchSupported: boolean
}

export interface ResponsiveConfig {
  breakpoints: Breakpoints
  mobileBreakpoint: keyof Breakpoints
  tabletBreakpoint: keyof Breakpoints
  desktopBreakpoint: keyof Breakpoints
  enableTouchDetection: boolean
  enableOrientationDetection: boolean
  debounceMs: number
}

export interface MediaQueryResult {
  matches: boolean
  media: string
}

export interface ViewportDimensions {
  width: number
  height: number
  scrollWidth: number
  scrollHeight: number
  availableWidth: number
  availableHeight: number
}

// ============================================================================
// Default Configuration
// ============================================================================

export const defaultBreakpoints: Breakpoints = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1400
}

export const defaultResponsiveConfig: ResponsiveConfig = {
  breakpoints: defaultBreakpoints,
  mobileBreakpoint: 'md',
  tabletBreakpoint: 'lg',
  desktopBreakpoint: 'xl',
  enableTouchDetection: true,
  enableOrientationDetection: true,
  debounceMs: 150
}

// ============================================================================
// Responsive Manager Class
// ============================================================================

export class ResponsiveManager {
  private config: ResponsiveConfig
  private listeners: Set<(screenInfo: ScreenInfo) => void> = new Set()
  private currentScreenInfo: ScreenInfo
  private resizeTimeout: number | null = null

  constructor(config: ResponsiveConfig = defaultResponsiveConfig) {
    this.config = config
    this.currentScreenInfo = this.calculateScreenInfo()
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    if (typeof window === 'undefined') return

    const handleResize = () => {
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout)
      }

      this.resizeTimeout = window.setTimeout(() => {
        const newScreenInfo = this.calculateScreenInfo()
        if (this.hasScreenInfoChanged(this.currentScreenInfo, newScreenInfo)) {
          this.currentScreenInfo = newScreenInfo
          this.notifyListeners(newScreenInfo)
        }
      }, this.config.debounceMs)
    }

    const handleOrientationChange = () => {
      // Delay to allow browser to update dimensions
      setTimeout(() => {
        const newScreenInfo = this.calculateScreenInfo()
        this.currentScreenInfo = newScreenInfo
        this.notifyListeners(newScreenInfo)
      }, 100)
    }

    window.addEventListener('resize', handleResize)
    
    if (this.config.enableOrientationDetection) {
      window.addEventListener('orientationchange', handleOrientationChange)
      // Also listen for screen orientation API if available
      if (screen.orientation) {
        screen.orientation.addEventListener('change', handleOrientationChange)
      }
    }
  }

  private calculateScreenInfo(): ScreenInfo {
    if (typeof window === 'undefined') {
      return {
        width: 0,
        height: 0,
        breakpoint: 'xs',
        isMobile: false,
        isTablet: false,
        isDesktop: false,
        isLandscape: false,
        isPortrait: true,
        devicePixelRatio: 1,
        touchSupported: false
      }
    }

    const width = window.innerWidth
    const height = window.innerHeight
    const breakpoint = this.getBreakpoint(width)
    const isLandscape = width > height
    const isPortrait = !isLandscape
    const devicePixelRatio = window.devicePixelRatio || 1

    // Determine device type based on breakpoints
    const isMobile = this.isBreakpointOrBelow(breakpoint, this.config.mobileBreakpoint)
    const isTablet = !isMobile && this.isBreakpointOrBelow(breakpoint, this.config.tabletBreakpoint)
    const isDesktop = !isMobile && !isTablet

    // Touch support detection
    const touchSupported = this.config.enableTouchDetection && (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0
    )

    return {
      width,
      height,
      breakpoint,
      isMobile,
      isTablet,
      isDesktop,
      isLandscape,
      isPortrait,
      devicePixelRatio,
      touchSupported
    }
  }

  private getBreakpoint(width: number): keyof Breakpoints {
    const breakpoints = Object.entries(this.config.breakpoints)
      .sort(([, a], [, b]) => b - a) // Sort descending

    for (const [name, minWidth] of breakpoints) {
      if (width >= minWidth) {
        return name as keyof Breakpoints
      }
    }

    return 'xs'
  }

  private isBreakpointOrBelow(current: keyof Breakpoints, target: keyof Breakpoints): boolean {
    return this.config.breakpoints[current] <= this.config.breakpoints[target]
  }

  private hasScreenInfoChanged(old: ScreenInfo, current: ScreenInfo): boolean {
    return (
      old.width !== current.width ||
      old.height !== current.height ||
      old.breakpoint !== current.breakpoint ||
      old.isLandscape !== current.isLandscape
    )
  }

  private notifyListeners(screenInfo: ScreenInfo): void {
    this.listeners.forEach(listener => {
      try {
        listener(screenInfo)
      } catch (error) {
        console.error('Error in responsive listener:', error)
      }
    })
  }

  // ============================================================================
  // Public API
  // ============================================================================

  getScreenInfo(): ScreenInfo {
    return { ...this.currentScreenInfo }
  }

  subscribe(listener: (screenInfo: ScreenInfo) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  updateConfig(updates: Partial<ResponsiveConfig>): void {
    this.config = { ...this.config, ...updates }
    // Recalculate screen info with new config
    this.currentScreenInfo = this.calculateScreenInfo()
    this.notifyListeners(this.currentScreenInfo)
  }

  getBreakpointValue(breakpoint: keyof Breakpoints): number {
    return this.config.breakpoints[breakpoint]
  }

  isBreakpoint(breakpoint: keyof Breakpoints): boolean {
    return this.currentScreenInfo.breakpoint === breakpoint
  }

  isBreakpointUp(breakpoint: keyof Breakpoints): boolean {
    return this.currentScreenInfo.width >= this.config.breakpoints[breakpoint]
  }

  isBreakpointDown(breakpoint: keyof Breakpoints): boolean {
    return this.currentScreenInfo.width < this.config.breakpoints[breakpoint]
  }

  isBetweenBreakpoints(min: keyof Breakpoints, max: keyof Breakpoints): boolean {
    const width = this.currentScreenInfo.width
    return width >= this.config.breakpoints[min] && width < this.config.breakpoints[max]
  }

  destroy(): void {
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout)
    }
    this.listeners.clear()
  }
}

// ============================================================================
// Global Instance
// ============================================================================

let responsiveManager: ResponsiveManager | null = null

export const getResponsiveManager = (): ResponsiveManager => {
  if (!responsiveManager) {
    responsiveManager = new ResponsiveManager()
  }
  return responsiveManager
}

export const initializeResponsiveManager = (config?: ResponsiveConfig): ResponsiveManager => {
  responsiveManager = new ResponsiveManager(config)
  return responsiveManager
}

// ============================================================================
// React Hooks
// ============================================================================

/**
 * Hook to get current screen information
 */
export const useScreenInfo = (): ScreenInfo => {
  const manager = getResponsiveManager()
  const [screenInfo, setScreenInfo] = useState<ScreenInfo>(manager.getScreenInfo())

  useEffect(() => {
    const unsubscribe = manager.subscribe(setScreenInfo)
    return unsubscribe
  }, [manager])

  return screenInfo
}

/**
 * Hook to check if current breakpoint matches
 */
export const useBreakpoint = (breakpoint: keyof Breakpoints): boolean => {
  const screenInfo = useScreenInfo()
  return screenInfo.breakpoint === breakpoint
}

/**
 * Hook to check if screen is at or above breakpoint
 */
export const useBreakpointUp = (breakpoint: keyof Breakpoints): boolean => {
  const screenInfo = useScreenInfo()
  const manager = getResponsiveManager()
  return screenInfo.width >= manager.getBreakpointValue(breakpoint)
}

/**
 * Hook to check if screen is below breakpoint
 */
export const useBreakpointDown = (breakpoint: keyof Breakpoints): boolean => {
  const screenInfo = useScreenInfo()
  const manager = getResponsiveManager()
  return screenInfo.width < manager.getBreakpointValue(breakpoint)
}

/**
 * Hook for media query matching
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia(query)
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches)

    mediaQuery.addEventListener('change', handler)
    setMatches(mediaQuery.matches)

    return () => mediaQuery.removeEventListener('change', handler)
  }, [query])

  return matches
}

/**
 * Hook to detect mobile devices
 */
export const useIsMobile = (): boolean => {
  const screenInfo = useScreenInfo()
  return screenInfo.isMobile
}

/**
 * Hook to detect tablet devices
 */
export const useIsTablet = (): boolean => {
  const screenInfo = useScreenInfo()
  return screenInfo.isTablet
}

/**
 * Hook to detect desktop devices
 */
export const useIsDesktop = (): boolean => {
  const screenInfo = useScreenInfo()
  return screenInfo.isDesktop
}

/**
 * Hook to detect touch support
 */
export const useIsTouchDevice = (): boolean => {
  const screenInfo = useScreenInfo()
  return screenInfo.touchSupported
}

/**
 * Hook to detect orientation
 */
export const useOrientation = (): 'portrait' | 'landscape' => {
  const screenInfo = useScreenInfo()
  return screenInfo.isLandscape ? 'landscape' : 'portrait'
}

/**
 * Hook to get viewport dimensions
 */
export const useViewportDimensions = (): ViewportDimensions => {
  const [dimensions, setDimensions] = useState<ViewportDimensions>(() => {
    if (typeof window === 'undefined') {
      return {
        width: 0,
        height: 0,
        scrollWidth: 0,
        scrollHeight: 0,
        availableWidth: 0,
        availableHeight: 0
      }
    }

    return {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      availableWidth: screen.availWidth,
      availableHeight: screen.availHeight
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        availableWidth: screen.availWidth,
        availableHeight: screen.availHeight
      })
    }

    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  return dimensions
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate CSS media query string
 */
export function createMediaQuery(
  breakpoint: keyof Breakpoints,
  direction: 'up' | 'down' | 'only' = 'up',
  breakpoints: Breakpoints = defaultBreakpoints
): string {
  const value = breakpoints[breakpoint]
  
  switch (direction) {
    case 'up':
      return `(min-width: ${value}px)`
    case 'down':
      return `(max-width: ${value - 1}px)`
    case 'only':
      const nextBreakpoint = getNextBreakpoint(breakpoint, breakpoints)
      if (nextBreakpoint) {
        return `(min-width: ${value}px) and (max-width: ${breakpoints[nextBreakpoint] - 1}px)`
      }
      return `(min-width: ${value}px)`
    default:
      return `(min-width: ${value}px)`
  }
}

/**
 * Get the next breakpoint in the sequence
 */
export function getNextBreakpoint(
  current: keyof Breakpoints,
  breakpoints: Breakpoints = defaultBreakpoints
): keyof Breakpoints | null {
  const entries = Object.entries(breakpoints).sort(([, a], [, b]) => a - b)
  const currentIndex = entries.findIndex(([name]) => name === current)
  
  if (currentIndex >= 0 && currentIndex < entries.length - 1) {
    return entries[currentIndex + 1][0] as keyof Breakpoints
  }
  
  return null
}

/**
 * Get responsive value based on current breakpoint
 */
export function getResponsiveValue<T>(
  values: Partial<Record<keyof Breakpoints, T>>,
  currentBreakpoint: keyof Breakpoints,
  breakpoints: Breakpoints = defaultBreakpoints
): T | undefined {
  // Try exact match first
  if (values[currentBreakpoint] !== undefined) {
    return values[currentBreakpoint]
  }

  // Find the closest smaller breakpoint with a value
  const sortedBreakpoints = Object.keys(breakpoints)
    .sort((a, b) => breakpoints[a as keyof Breakpoints] - breakpoints[b as keyof Breakpoints])

  const currentIndex = sortedBreakpoints.indexOf(currentBreakpoint)
  
  for (let i = currentIndex; i >= 0; i--) {
    const bp = sortedBreakpoints[i] as keyof Breakpoints
    if (values[bp] !== undefined) {
      return values[bp]
    }
  }

  return undefined
}

/**
 * Create responsive CSS classes
 */
export function createResponsiveClasses(
  baseClass: string,
  breakpoints: (keyof Breakpoints)[] = ['xs', 'sm', 'md', 'lg', 'xl']
): Record<keyof Breakpoints, string> {
  const classes = {} as Record<keyof Breakpoints, string>
  
  breakpoints.forEach(bp => {
    classes[bp] = bp === 'xs' ? baseClass : `${baseClass}-${bp}`
  })
  
  return classes
}

/**
 * Check if device is likely mobile based on user agent
 */
export function isMobileUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false
  
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

/**
 * Get device type string
 */
export function getDeviceType(screenInfo?: ScreenInfo): 'mobile' | 'tablet' | 'desktop' {
  const info = screenInfo || getResponsiveManager().getScreenInfo()
  
  if (info.isMobile) return 'mobile'
  if (info.isTablet) return 'tablet'
  return 'desktop'
}

/**
 * Calculate optimal font size based on screen size
 */
export function getResponsiveFontSize(
  baseSize: number,
  screenWidth: number,
  minSize: number = baseSize * 0.8,
  maxSize: number = baseSize * 1.2
): number {
  const minWidth = 320
  const maxWidth = 1200
  
  const ratio = (screenWidth - minWidth) / (maxWidth - minWidth)
  const clampedRatio = Math.max(0, Math.min(1, ratio))
  
  return minSize + (maxSize - minSize) * clampedRatio
}

export default {
  ResponsiveManager,
  getResponsiveManager,
  initializeResponsiveManager,
  useScreenInfo,
  useBreakpoint,
  useBreakpointUp,
  useBreakpointDown,
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useIsTouchDevice,
  useOrientation,
  useViewportDimensions,
  createMediaQuery,
  getNextBreakpoint,
  getResponsiveValue,
  createResponsiveClasses,
  isMobileUserAgent,
  getDeviceType,
  getResponsiveFontSize,
  defaultBreakpoints,
  defaultResponsiveConfig
}