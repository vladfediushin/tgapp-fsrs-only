// Resource Preloading and Prefetching System
// Optimizes loading performance through intelligent resource hints

// ============================================================================
// Types and Interfaces
// ============================================================================

interface PreloadOptions {
  as?: 'script' | 'style' | 'font' | 'image' | 'fetch' | 'document'
  crossorigin?: 'anonymous' | 'use-credentials'
  type?: string
  media?: string
  priority?: 'high' | 'low'
  onload?: () => void
  onerror?: (error: Event) => void
}

interface PrefetchOptions {
  priority?: 'high' | 'low'
  crossorigin?: 'anonymous' | 'use-credentials'
  onload?: () => void
  onerror?: (error: Event) => void
}

interface ResourceHint {
  href: string
  type: 'preload' | 'prefetch' | 'preconnect' | 'dns-prefetch'
  options?: PreloadOptions | PrefetchOptions
  element?: HTMLLinkElement
  timestamp: number
  status: 'pending' | 'loaded' | 'error'
}

interface PreloadStrategy {
  critical: string[]
  important: string[]
  optional: string[]
  routes: { [key: string]: string[] }
}

// ============================================================================
// Resource Management
// ============================================================================

class ResourcePreloader {
  private hints: Map<string, ResourceHint> = new Map()
  private observer: IntersectionObserver | null = null
  private strategy: PreloadStrategy
  
  constructor() {
    this.strategy = {
      critical: [
        // Critical CSS and fonts
        '/assets/styles/critical.css',
        '/assets/fonts/main.woff2'
      ],
      important: [
        // Important JavaScript chunks
        '/assets/chunks/react-core.js',
        '/assets/chunks/state-management.js',
        '/assets/chunks/react-router.js'
      ],
      optional: [
        // Optional resources
        '/assets/chunks/charts.js',
        '/assets/chunks/icons.js',
        '/assets/chunks/datepicker.js'
      ],
      routes: {
        '/home': [
          '/assets/pages/Home-Unified.js',
          '/assets/chunks/store-unified.js'
        ],
        '/repeat': [
          '/assets/pages/Repeat.js',
          '/assets/chunks/store-fsrs.js'
        ],
        '/settings': [
          '/assets/pages/Settings-Unified.js',
          '/assets/chunks/i18n.js'
        ],
        '/statistics': [
          '/assets/pages/Statistics.js',
          '/assets/chunks/charts.js'
        ]
      }
    }
    
    this.initializeIntersectionObserver()
  }

  // ============================================================================
  // Core Preloading Functions
  // ============================================================================

  /**
   * Preload a resource with high priority
   */
  preload(href: string, options: PreloadOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      const key = `preload-${href}`
      
      // Check if already preloaded
      if (this.hints.has(key)) {
        const hint = this.hints.get(key)!
        if (hint.status === 'loaded') {
          resolve()
          return
        } else if (hint.status === 'error') {
          reject(new Error(`Failed to preload ${href}`))
          return
        }
      }

      const link = document.createElement('link')
      link.rel = 'preload'
      link.href = href
      
      if (options.as) link.as = options.as
      if (options.crossorigin) link.crossOrigin = options.crossorigin
      if (options.type) link.type = options.type
      if (options.media) link.media = options.media
      
      // Set fetchpriority for modern browsers
      if (options.priority && 'fetchPriority' in link) {
        (link as any).fetchPriority = options.priority
      }

      const hint: ResourceHint = {
        href,
        type: 'preload',
        options,
        element: link,
        timestamp: Date.now(),
        status: 'pending'
      }

      link.onload = () => {
        hint.status = 'loaded'
        console.log(`[ResourcePreloader] Preloaded: ${href}`)
        options.onload?.()
        resolve()
      }

      link.onerror = (error) => {
        hint.status = 'error'
        console.error(`[ResourcePreloader] Failed to preload: ${href}`, error)
        options.onerror?.(error as Event)
        reject(new Error(`Failed to preload ${href}`))
      }

      this.hints.set(key, hint)
      document.head.appendChild(link)
    })
  }

  /**
   * Prefetch a resource for future navigation
   */
  prefetch(href: string, options: PrefetchOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      const key = `prefetch-${href}`
      
      // Check if already prefetched
      if (this.hints.has(key)) {
        const hint = this.hints.get(key)!
        if (hint.status === 'loaded') {
          resolve()
          return
        }
      }

      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.href = href
      
      if (options.crossorigin) link.crossOrigin = options.crossorigin
      
      // Set fetchpriority for modern browsers
      if (options.priority && 'fetchPriority' in link) {
        (link as any).fetchPriority = options.priority
      }

      const hint: ResourceHint = {
        href,
        type: 'prefetch',
        options,
        element: link,
        timestamp: Date.now(),
        status: 'pending'
      }

      link.onload = () => {
        hint.status = 'loaded'
        console.log(`[ResourcePreloader] Prefetched: ${href}`)
        options.onload?.()
        resolve()
      }

      link.onerror = (error) => {
        hint.status = 'error'
        console.error(`[ResourcePreloader] Failed to prefetch: ${href}`, error)
        options.onerror?.(error as Event)
        reject(new Error(`Failed to prefetch ${href}`))
      }

      this.hints.set(key, hint)
      document.head.appendChild(link)
    })
  }

  /**
   * Preconnect to external domains
   */
  preconnect(href: string, crossorigin?: 'anonymous' | 'use-credentials'): void {
    const key = `preconnect-${href}`
    
    if (this.hints.has(key)) return

    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = href
    
    if (crossorigin) link.crossOrigin = crossorigin

    const hint: ResourceHint = {
      href,
      type: 'preconnect',
      element: link,
      timestamp: Date.now(),
      status: 'loaded' // Preconnect doesn't have load events
    }

    this.hints.set(key, hint)
    document.head.appendChild(link)
    
    console.log(`[ResourcePreloader] Preconnected to: ${href}`)
  }

  /**
   * DNS prefetch for external domains
   */
  dnsPrefetch(href: string): void {
    const key = `dns-prefetch-${href}`
    
    if (this.hints.has(key)) return

    const link = document.createElement('link')
    link.rel = 'dns-prefetch'
    link.href = href

    const hint: ResourceHint = {
      href,
      type: 'dns-prefetch',
      element: link,
      timestamp: Date.now(),
      status: 'loaded' // DNS prefetch doesn't have load events
    }

    this.hints.set(key, hint)
    document.head.appendChild(link)
    
    console.log(`[ResourcePreloader] DNS prefetched: ${href}`)
  }

  // ============================================================================
  // Strategic Preloading
  // ============================================================================

  /**
   * Preload critical resources immediately
   */
  async preloadCriticalResources(): Promise<void> {
    console.log('[ResourcePreloader] Preloading critical resources')
    
    const promises = this.strategy.critical.map(href => 
      this.preload(href, { 
        as: href.endsWith('.css') ? 'style' : 'script',
        priority: 'high'
      }).catch(error => {
        console.warn(`[ResourcePreloader] Failed to preload critical resource ${href}:`, error)
      })
    )
    
    await Promise.allSettled(promises)
  }

  /**
   * Preload important resources with delay
   */
  async preloadImportantResources(delay = 1000): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, delay))
    
    console.log('[ResourcePreloader] Preloading important resources')
    
    const promises = this.strategy.important.map(href => 
      this.preload(href, { 
        as: 'script',
        priority: 'high'
      }).catch(error => {
        console.warn(`[ResourcePreloader] Failed to preload important resource ${href}:`, error)
      })
    )
    
    await Promise.allSettled(promises)
  }

  /**
   * Prefetch optional resources when idle
   */
  prefetchOptionalResources(): void {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        this.prefetchOptionalResourcesInternal()
      }, { timeout: 5000 })
    } else {
      setTimeout(() => {
        this.prefetchOptionalResourcesInternal()
      }, 3000)
    }
  }

  private async prefetchOptionalResourcesInternal(): Promise<void> {
    console.log('[ResourcePreloader] Prefetching optional resources')
    
    const promises = this.strategy.optional.map(href => 
      this.prefetch(href, { priority: 'low' }).catch(error => {
        console.warn(`[ResourcePreloader] Failed to prefetch optional resource ${href}:`, error)
      })
    )
    
    await Promise.allSettled(promises)
  }

  /**
   * Preload resources for a specific route
   */
  async preloadRoute(routePath: string): Promise<void> {
    const resources = this.strategy.routes[routePath]
    if (!resources) return

    console.log(`[ResourcePreloader] Preloading resources for route: ${routePath}`)
    
    const promises = resources.map(href => 
      this.preload(href, { 
        as: 'script',
        priority: 'high'
      }).catch(error => {
        console.warn(`[ResourcePreloader] Failed to preload route resource ${href}:`, error)
      })
    )
    
    await Promise.allSettled(promises)
  }

  /**
   * Prefetch resources for likely next routes
   */
  prefetchLikelyRoutes(currentRoute: string): void {
    const likelyRoutes = this.getLikelyNextRoutes(currentRoute)
    
    likelyRoutes.forEach(route => {
      const resources = this.strategy.routes[route]
      if (resources) {
        resources.forEach(href => {
          this.prefetch(href, { priority: 'low' }).catch(error => {
            console.warn(`[ResourcePreloader] Failed to prefetch route resource ${href}:`, error)
          })
        })
      }
    })
  }

  private getLikelyNextRoutes(currentRoute: string): string[] {
    // Define route transition probabilities
    const routeTransitions: { [key: string]: string[] } = {
      '/home': ['/repeat', '/settings', '/statistics'],
      '/repeat': ['/home', '/results'],
      '/settings': ['/home'],
      '/statistics': ['/home'],
      '/results': ['/home', '/repeat']
    }
    
    return routeTransitions[currentRoute] || []
  }

  // ============================================================================
  // Intersection Observer for Lazy Preloading
  // ============================================================================

  private initializeIntersectionObserver(): void {
    if (!('IntersectionObserver' in window)) return

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement
            const preloadHref = element.dataset.preload
            const prefetchHref = element.dataset.prefetch
            
            if (preloadHref) {
              this.preload(preloadHref, { as: 'script' })
              delete element.dataset.preload
            }
            
            if (prefetchHref) {
              this.prefetch(prefetchHref)
              delete element.dataset.prefetch
            }
            
            this.observer?.unobserve(element)
          }
        })
      },
      {
        rootMargin: '50px 0px',
        threshold: 0.1
      }
    )
  }

  /**
   * Observe element for lazy preloading
   */
  observeElement(element: HTMLElement): void {
    if (this.observer && (element.dataset.preload || element.dataset.prefetch)) {
      this.observer.observe(element)
    }
  }

  // ============================================================================
  // External Domain Optimization
  // ============================================================================

  /**
   * Setup preconnections for external domains
   */
  setupExternalDomainOptimizations(): void {
    // Telegram Web App API
    this.preconnect('https://telegram.org')
    
    // CDN connections
    this.dnsPrefetch('https://cdn.jsdelivr.net')
    this.dnsPrefetch('https://unpkg.com')
    
    // API endpoints
    if (window.location.hostname !== 'localhost') {
      this.preconnect(window.location.origin)
    }
  }

  // ============================================================================
  // Font Optimization
  // ============================================================================

  /**
   * Preload critical fonts
   */
  preloadFonts(): void {
    const fonts = [
      '/assets/fonts/inter-var.woff2',
      '/assets/fonts/inter-var-latin.woff2'
    ]
    
    fonts.forEach(font => {
      this.preload(font, {
        as: 'font',
        type: 'font/woff2',
        crossorigin: 'anonymous'
      }).catch(error => {
        console.warn(`[ResourcePreloader] Failed to preload font ${font}:`, error)
      })
    })
  }

  // ============================================================================
  // Cache and Cleanup
  // ============================================================================

  /**
   * Clean up old resource hints
   */
  cleanup(olderThan = 30 * 60 * 1000): void { // 30 minutes
    const cutoff = Date.now() - olderThan
    
    this.hints.forEach((hint, key) => {
      if (hint.timestamp < cutoff) {
        if (hint.element && hint.element.parentNode) {
          hint.element.parentNode.removeChild(hint.element)
        }
        this.hints.delete(key)
      }
    })
  }

  /**
   * Get preloader statistics
   */
  getStats() {
    const stats = {
      totalHints: this.hints.size,
      byType: { preload: 0, prefetch: 0, preconnect: 0, 'dns-prefetch': 0 },
      byStatus: { pending: 0, loaded: 0, error: 0 },
      memoryUsage: 0
    }
    
    this.hints.forEach(hint => {
      stats.byType[hint.type]++
      stats.byStatus[hint.status]++
    })
    
    stats.memoryUsage = JSON.stringify(Array.from(this.hints.values())).length
    
    return stats
  }

  /**
   * Destroy the preloader
   */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    
    this.hints.forEach(hint => {
      if (hint.element && hint.element.parentNode) {
        hint.element.parentNode.removeChild(hint.element)
      }
    })
    
    this.hints.clear()
  }
}

// ============================================================================
// Global Instance and Utilities
// ============================================================================

let resourcePreloader: ResourcePreloader | null = null

export const getResourcePreloader = (): ResourcePreloader => {
  if (!resourcePreloader) {
    resourcePreloader = new ResourcePreloader()
  }
  return resourcePreloader
}

export const initializeResourcePreloader = async (): Promise<ResourcePreloader> => {
  const preloader = getResourcePreloader()
  
  console.log('[ResourcePreloader] Initializing resource preloader')
  
  // Setup external domain optimizations
  preloader.setupExternalDomainOptimizations()
  
  // Preload fonts
  preloader.preloadFonts()
  
  // Preload critical resources immediately
  await preloader.preloadCriticalResources()
  
  // Preload important resources with delay
  preloader.preloadImportantResources()
  
  // Prefetch optional resources when idle
  preloader.prefetchOptionalResources()
  
  // Setup periodic cleanup
  setInterval(() => {
    preloader.cleanup()
  }, 10 * 60 * 1000) // Every 10 minutes
  
  console.log('[ResourcePreloader] Resource preloader initialized')
  return preloader
}

// ============================================================================
// React Hooks
// ============================================================================

import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Hook to preload resources for current route
 */
export const useRoutePreloader = () => {
  const location = useLocation()
  
  useEffect(() => {
    const preloader = getResourcePreloader()
    
    // Preload current route resources
    preloader.preloadRoute(location.pathname)
    
    // Prefetch likely next routes
    preloader.prefetchLikelyRoutes(location.pathname)
  }, [location.pathname])
}

/**
 * Hook to observe elements for lazy preloading
 */
export const useLazyPreload = (ref: React.RefObject<HTMLElement>) => {
  useEffect(() => {
    if (ref.current) {
      const preloader = getResourcePreloader()
      preloader.observeElement(ref.current)
    }
  }, [ref])
}

export default ResourcePreloader