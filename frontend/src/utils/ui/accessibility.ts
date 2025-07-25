// Accessibility Utilities
// Provides comprehensive accessibility helpers, ARIA utilities, and inclusive design tools
// Ensures compliance with WCAG guidelines and improves user experience for all users

import { useEffect, useRef, useState, useCallback } from 'react'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface AccessibilityConfig {
  enableFocusManagement: boolean
  enableKeyboardNavigation: boolean
  enableScreenReaderSupport: boolean
  enableHighContrast: boolean
  enableReducedMotion: boolean
  announcePageChanges: boolean
  focusOutlineStyle: 'default' | 'enhanced' | 'custom'
  skipLinkTarget: string
}

export interface FocusableElement {
  element: HTMLElement
  tabIndex: number
  isVisible: boolean
  isEnabled: boolean
}

export interface AriaAttributes {
  role?: string
  label?: string
  labelledby?: string
  describedby?: string
  expanded?: boolean
  selected?: boolean
  checked?: boolean
  disabled?: boolean
  hidden?: boolean
  live?: 'off' | 'polite' | 'assertive'
  atomic?: boolean
  relevant?: 'additions' | 'removals' | 'text' | 'all'
}

export interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
  action: () => void
  description: string
  category?: string
}

export interface ColorContrastResult {
  ratio: number
  level: 'AA' | 'AAA' | 'fail'
  isValid: boolean
}

// ============================================================================
// Accessibility Manager Class
// ============================================================================

export class AccessibilityManager {
  private config: AccessibilityConfig
  private shortcuts: Map<string, KeyboardShortcut> = new Map()
  private announcer: HTMLElement | null = null
  private focusHistory: HTMLElement[] = []

  constructor(config: AccessibilityConfig) {
    this.config = config
    this.initialize()
  }

  private initialize(): void {
    if (typeof document === 'undefined') return

    // Create screen reader announcer
    if (this.config.enableScreenReaderSupport) {
      this.createAnnouncer()
    }

    // Setup keyboard navigation
    if (this.config.enableKeyboardNavigation) {
      this.setupKeyboardNavigation()
    }

    // Setup focus management
    if (this.config.enableFocusManagement) {
      this.setupFocusManagement()
    }

    // Setup reduced motion detection
    if (this.config.enableReducedMotion) {
      this.setupReducedMotionDetection()
    }

    // Setup high contrast detection
    if (this.config.enableHighContrast) {
      this.setupHighContrastDetection()
    }

    // Add skip link
    this.addSkipLink()
  }

  private createAnnouncer(): void {
    this.announcer = document.createElement('div')
    this.announcer.setAttribute('aria-live', 'polite')
    this.announcer.setAttribute('aria-atomic', 'true')
    this.announcer.setAttribute('class', 'sr-only')
    this.announcer.style.cssText = `
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    `
    document.body.appendChild(this.announcer)
  }

  private setupKeyboardNavigation(): void {
    document.addEventListener('keydown', this.handleGlobalKeydown.bind(this))
  }

  private setupFocusManagement(): void {
    document.addEventListener('focusin', this.handleFocusIn.bind(this))
    document.addEventListener('focusout', this.handleFocusOut.bind(this))
  }

  private setupReducedMotionDetection(): void {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.updateReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener('change', (e) => this.updateReducedMotion(e.matches))
  }

  private setupHighContrastDetection(): void {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)')
    this.updateHighContrast(mediaQuery.matches)
    mediaQuery.addEventListener('change', (e) => this.updateHighContrast(e.matches))
  }

  private addSkipLink(): void {
    const skipLink = document.createElement('a')
    skipLink.href = `#${this.config.skipLinkTarget}`
    skipLink.textContent = 'Skip to main content'
    skipLink.className = 'skip-link'
    skipLink.style.cssText = `
      position: absolute;
      top: -40px;
      left: 6px;
      background: #000;
      color: #fff;
      padding: 8px;
      text-decoration: none;
      z-index: 10000;
      border-radius: 4px;
      transition: top 0.3s;
    `
    
    skipLink.addEventListener('focus', () => {
      skipLink.style.top = '6px'
    })
    
    skipLink.addEventListener('blur', () => {
      skipLink.style.top = '-40px'
    })

    document.body.insertBefore(skipLink, document.body.firstChild)
  }

  private handleGlobalKeydown(event: KeyboardEvent): void {
    const shortcutKey = this.createShortcutKey(event)
    const shortcut = this.shortcuts.get(shortcutKey)
    
    if (shortcut) {
      event.preventDefault()
      shortcut.action()
    }

    // Handle escape key globally
    if (event.key === 'Escape') {
      this.handleEscapeKey()
    }
  }

  private handleFocusIn(event: FocusEvent): void {
    const target = event.target as HTMLElement
    if (target && this.focusHistory[this.focusHistory.length - 1] !== target) {
      this.focusHistory.push(target)
      // Keep only last 10 focus history items
      if (this.focusHistory.length > 10) {
        this.focusHistory.shift()
      }
    }
  }

  private handleFocusOut(event: FocusEvent): void {
    // Could be used for focus tracking if needed
  }

  private handleEscapeKey(): void {
    // Close modals, dropdowns, etc.
    const activeModal = document.querySelector('[role="dialog"][aria-modal="true"]')
    if (activeModal) {
      const closeButton = activeModal.querySelector('[aria-label*="close"], [aria-label*="Close"]')
      if (closeButton instanceof HTMLElement) {
        closeButton.click()
      }
    }
  }

  private updateReducedMotion(prefersReduced: boolean): void {
    document.documentElement.setAttribute('data-reduced-motion', prefersReduced.toString())
  }

  private updateHighContrast(prefersHigh: boolean): void {
    document.documentElement.setAttribute('data-high-contrast', prefersHigh.toString())
  }

  private createShortcutKey(event: KeyboardEvent): string {
    const parts: string[] = []
    if (event.ctrlKey) parts.push('ctrl')
    if (event.altKey) parts.push('alt')
    if (event.shiftKey) parts.push('shift')
    if (event.metaKey) parts.push('meta')
    parts.push(event.key.toLowerCase())
    return parts.join('+')
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Announce message to screen readers
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!this.announcer) return

    this.announcer.setAttribute('aria-live', priority)
    this.announcer.textContent = message

    // Clear after announcement
    setTimeout(() => {
      if (this.announcer) {
        this.announcer.textContent = ''
      }
    }, 1000)
  }

  /**
   * Register keyboard shortcut
   */
  registerShortcut(shortcut: KeyboardShortcut): void {
    const key = this.createShortcutKey({
      key: shortcut.key,
      ctrlKey: shortcut.ctrlKey || false,
      altKey: shortcut.altKey || false,
      shiftKey: shortcut.shiftKey || false,
      metaKey: shortcut.metaKey || false
    } as KeyboardEvent)

    this.shortcuts.set(key, shortcut)
  }

  /**
   * Unregister keyboard shortcut
   */
  unregisterShortcut(key: string): void {
    this.shortcuts.delete(key)
  }

  /**
   * Get all registered shortcuts
   */
  getShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values())
  }

  /**
   * Focus element with proper management
   */
  focusElement(element: HTMLElement, options: { preventScroll?: boolean } = {}): void {
    if (!element || !this.isElementFocusable(element)) return

    element.focus(options)
    
    // Add to focus history
    this.focusHistory.push(element)
  }

  /**
   * Focus first focusable element in container
   */
  focusFirst(container: HTMLElement = document.body): boolean {
    const focusable = this.getFocusableElements(container)
    if (focusable.length > 0) {
      this.focusElement(focusable[0].element)
      return true
    }
    return false
  }

  /**
   * Focus last focusable element in container
   */
  focusLast(container: HTMLElement = document.body): boolean {
    const focusable = this.getFocusableElements(container)
    if (focusable.length > 0) {
      this.focusElement(focusable[focusable.length - 1].element)
      return true
    }
    return false
  }

  /**
   * Return focus to previous element
   */
  returnFocus(): boolean {
    if (this.focusHistory.length > 1) {
      // Remove current focus from history
      this.focusHistory.pop()
      const previousElement = this.focusHistory[this.focusHistory.length - 1]
      
      if (previousElement && document.contains(previousElement)) {
        this.focusElement(previousElement)
        return true
      }
    }
    return false
  }

  /**
   * Trap focus within container
   */
  trapFocus(container: HTMLElement): () => void {
    const focusable = this.getFocusableElements(container)
    if (focusable.length === 0) return () => {}

    const firstElement = focusable[0].element
    const lastElement = focusable[focusable.length - 1].element

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    container.addEventListener('keydown', handleKeydown)
    
    // Focus first element
    firstElement.focus()

    // Return cleanup function
    return () => {
      container.removeEventListener('keydown', handleKeydown)
    }
  }

  /**
   * Get all focusable elements in container
   */
  getFocusableElements(container: HTMLElement = document.body): FocusableElement[] {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ')

    const elements = container.querySelectorAll(focusableSelectors)
    
    return Array.from(elements)
      .map(element => ({
        element: element as HTMLElement,
        tabIndex: parseInt(element.getAttribute('tabindex') || '0'),
        isVisible: this.isElementVisible(element as HTMLElement),
        isEnabled: !element.hasAttribute('disabled')
      }))
      .filter(item => item.isVisible && item.isEnabled)
      .sort((a, b) => {
        // Sort by tab index, then by DOM order
        if (a.tabIndex !== b.tabIndex) {
          return a.tabIndex - b.tabIndex
        }
        return 0
      })
  }

  /**
   * Check if element is focusable
   */
  isElementFocusable(element: HTMLElement): boolean {
    if (!element || element.hasAttribute('disabled')) return false
    if (!this.isElementVisible(element)) return false

    const tabIndex = element.getAttribute('tabindex')
    if (tabIndex === '-1') return false

    const focusableElements = [
      'A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'
    ]

    return (
      focusableElements.includes(element.tagName) ||
      element.hasAttribute('tabindex') ||
      element.contentEditable === 'true'
    )
  }

  /**
   * Check if element is visible
   */
  isElementVisible(element: HTMLElement): boolean {
    if (!element) return false

    const style = window.getComputedStyle(element)
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      element.offsetWidth > 0 &&
      element.offsetHeight > 0
    )
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AccessibilityConfig>): void {
    this.config = { ...this.config, ...updates }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.announcer) {
      document.body.removeChild(this.announcer)
      this.announcer = null
    }
    
    this.shortcuts.clear()
    this.focusHistory = []
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate ARIA attributes object
 */
export function createAriaAttributes(attributes: AriaAttributes): Record<string, string> {
  const result: Record<string, string> = {}

  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== undefined) {
      const ariaKey = key === 'role' ? 'role' : `aria-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`
      result[ariaKey] = value.toString()
    }
  })

  return result
}

/**
 * Calculate color contrast ratio
 */
export function calculateColorContrast(foreground: string, background: string): ColorContrastResult {
  const getLuminance = (color: string): number => {
    // Convert hex to RGB
    const hex = color.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16) / 255
    const g = parseInt(hex.substr(2, 2), 16) / 255
    const b = parseInt(hex.substr(4, 2), 16) / 255

    // Calculate relative luminance
    const sRGB = [r, g, b].map(c => {
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })

    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2]
  }

  const l1 = getLuminance(foreground)
  const l2 = getLuminance(background)
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)

  let level: 'AA' | 'AAA' | 'fail' = 'fail'
  if (ratio >= 7) level = 'AAA'
  else if (ratio >= 4.5) level = 'AA'

  return {
    ratio: Math.round(ratio * 100) / 100,
    level,
    isValid: level !== 'fail'
  }
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Check if user prefers high contrast
 */
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-contrast: high)').matches
}

/**
 * Check if user prefers dark theme
 */
export function prefersDarkTheme(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Generate unique ID for accessibility
 */
export function generateA11yId(prefix: string = 'a11y'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create screen reader only CSS class
 */
export function getScreenReaderOnlyStyles(): { [key: string]: string | number } {
  return {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0
  }
}

// ============================================================================
// React Hooks
// ============================================================================

/**
 * Hook for managing focus
 */
export const useFocusManagement = () => {
  const focusRef = useRef<HTMLElement>(null)

  const focusElement = useCallback(() => {
    if (focusRef.current) {
      focusRef.current.focus()
    }
  }, [])

  const blurElement = useCallback(() => {
    if (focusRef.current) {
      focusRef.current.blur()
    }
  }, [])

  return { focusRef, focusElement, blurElement }
}

/**
 * Hook for keyboard shortcuts
 */
export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[]) => {
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      shortcuts.forEach(shortcut => {
        const matches = (
          event.key.toLowerCase() === shortcut.key.toLowerCase() &&
          !!event.ctrlKey === !!shortcut.ctrlKey &&
          !!event.altKey === !!shortcut.altKey &&
          !!event.shiftKey === !!shortcut.shiftKey &&
          !!event.metaKey === !!shortcut.metaKey
        )

        if (matches) {
          event.preventDefault()
          shortcut.action()
        }
      })
    }

    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [shortcuts])
}

/**
 * Hook for screen reader announcements
 */
export const useAnnouncer = () => {
  const [announcer, setAnnouncer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const element = document.createElement('div')
    element.setAttribute('aria-live', 'polite')
    element.setAttribute('aria-atomic', 'true')
    element.style.cssText = `
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    `
    document.body.appendChild(element)
    setAnnouncer(element)

    return () => {
      if (document.body.contains(element)) {
        document.body.removeChild(element)
      }
    }
  }, [])

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announcer) {
      announcer.setAttribute('aria-live', priority)
      announcer.textContent = message
      
      setTimeout(() => {
        announcer.textContent = ''
      }, 1000)
    }
  }, [announcer])

  return announce
}

/**
 * Hook for focus trap
 */
export const useFocusTrap = (isActive: boolean) => {
  const containerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const container = containerRef.current
    const focusableElements = container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )

    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement?.focus()
        }
      }
    }

    container.addEventListener('keydown', handleKeydown)
    firstElement?.focus()

    return () => {
      container.removeEventListener('keydown', handleKeydown)
    }
  }, [isActive])

  return containerRef
}

/**
 * Hook for reduced motion preference
 */
export const useReducedMotion = () => {
  const [prefersReduced, setPrefersReduced] = useState(() => prefersReducedMotion())

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches)
    
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return prefersReduced
}

// ============================================================================
// Global Instance
// ============================================================================

let accessibilityManager: AccessibilityManager | null = null

export const getAccessibilityManager = (): AccessibilityManager => {
  if (!accessibilityManager) {
    accessibilityManager = new AccessibilityManager(defaultAccessibilityConfig)
  }
  return accessibilityManager
}

export const initializeAccessibilityManager = (config?: AccessibilityConfig): AccessibilityManager => {
  accessibilityManager = new AccessibilityManager(config || defaultAccessibilityConfig)
  return accessibilityManager
}

// ============================================================================
// Default Configuration
// ============================================================================

export const defaultAccessibilityConfig: AccessibilityConfig = {
  enableFocusManagement: true,
  enableKeyboardNavigation: true,
  enableScreenReaderSupport: true,
  enableHighContrast: true,
  enableReducedMotion: true,
  announcePageChanges: true,
  focusOutlineStyle: 'enhanced',
  skipLinkTarget: 'main-content'
}

export default {
  AccessibilityManager,
  getAccessibilityManager,
  initializeAccessibilityManager,
  createAriaAttributes,
  calculateColorContrast,
  prefersReducedMotion,
  prefersHighContrast,
  prefersDarkTheme,
  generateA11yId,
  getScreenReaderOnlyStyles,
  useFocusManagement,
  useKeyboardShortcuts,
  useAnnouncer,
  useFocusTrap,
  useReducedMotion,
  defaultAccessibilityConfig
}