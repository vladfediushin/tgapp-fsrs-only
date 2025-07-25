// Progressive Loading Strategies
// Implements skeleton screens, lazy loading, and progressive enhancement

import React, { useState, useEffect, useRef, useCallback } from 'react'

// ============================================================================
// Types and Interfaces
// ============================================================================

interface ProgressiveLoadingConfig {
  enableSkeletonScreens: boolean
  enableLazyLoading: boolean
  enableProgressiveImages: boolean
  enableIncrementalLoading: boolean
  skeletonDuration: number
  lazyLoadingThreshold: number
  imageLoadingStrategy: 'eager' | 'lazy' | 'progressive'
  chunkLoadingStrategy: 'parallel' | 'sequential' | 'priority'
}

interface SkeletonConfig {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  animation?: 'pulse' | 'wave' | 'none'
  count?: number
  className?: string
}

interface LazyLoadConfig {
  threshold: number
  rootMargin: string
  triggerOnce: boolean
  placeholder?: React.ReactNode
  fallback?: React.ReactNode
}

interface ProgressiveImageConfig {
  lowQualitySrc?: string
  highQualitySrc: string
  alt: string
  className?: string
  blurAmount?: number
  transitionDuration?: number
}

interface IncrementalLoadingConfig {
  batchSize: number
  delay: number
  priority: 'high' | 'medium' | 'low'
  loadingIndicator?: React.ReactNode
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_PROGRESSIVE_CONFIG: ProgressiveLoadingConfig = {
  enableSkeletonScreens: true,
  enableLazyLoading: true,
  enableProgressiveImages: true,
  enableIncrementalLoading: true,
  skeletonDuration: 1500,
  lazyLoadingThreshold: 0.1,
  imageLoadingStrategy: 'progressive',
  chunkLoadingStrategy: 'priority'
}

// ============================================================================
// Progressive Loading Manager
// ============================================================================

class ProgressiveLoadingManager {
  private config: ProgressiveLoadingConfig
  private intersectionObserver: IntersectionObserver | null = null
  private loadingQueue: Array<() => Promise<void>> = []
  private isProcessingQueue = false

  constructor(config?: Partial<ProgressiveLoadingConfig>) {
    this.config = { ...DEFAULT_PROGRESSIVE_CONFIG, ...config }
    this.initializeIntersectionObserver()
  }

  // ============================================================================
  // Intersection Observer Setup
  // ============================================================================

  private initializeIntersectionObserver(): void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return
    }

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement
            this.handleElementIntersection(element)
          }
        })
      },
      {
        threshold: this.config.lazyLoadingThreshold,
        rootMargin: '50px 0px'
      }
    )
  }

  private handleElementIntersection(element: HTMLElement): void {
    const loadType = element.dataset.progressiveLoad
    
    switch (loadType) {
      case 'image':
        this.loadProgressiveImage(element as HTMLImageElement)
        break
      case 'component':
        this.loadLazyComponent(element)
        break
      case 'content':
        this.loadIncrementalContent(element)
        break
    }

    this.intersectionObserver?.unobserve(element)
  }

  // ============================================================================
  // Skeleton Screen Implementation
  // ============================================================================

  createSkeletonElement(config: SkeletonConfig): HTMLElement {
    const skeleton = document.createElement('div')
    skeleton.className = `skeleton ${config.className || ''}`
    
    // Apply skeleton styles
    const styles = {
      width: typeof config.width === 'number' ? `${config.width}px` : config.width || '100%',
      height: typeof config.height === 'number' ? `${config.height}px` : config.height || '20px',
      borderRadius: typeof config.borderRadius === 'number' ? `${config.borderRadius}px` : config.borderRadius || '4px',
      backgroundColor: '#e2e8f0',
      backgroundImage: config.animation === 'wave' 
        ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)'
        : 'none',
      backgroundSize: config.animation === 'wave' ? '200px 100%' : 'auto',
      animation: config.animation === 'pulse' 
        ? 'skeleton-pulse 1.5s ease-in-out infinite'
        : config.animation === 'wave'
        ? 'skeleton-wave 1.5s linear infinite'
        : 'none'
    }

    Object.assign(skeleton.style, styles)
    return skeleton
  }

  injectSkeletonStyles(): void {
    if (document.getElementById('skeleton-styles')) return

    const style = document.createElement('style')
    style.id = 'skeleton-styles'
    style.textContent = `
      @keyframes skeleton-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      
      @keyframes skeleton-wave {
        0% { background-position: -200px 0; }
        100% { background-position: calc(200px + 100%) 0; }
      }
      
      .skeleton {
        display: inline-block;
        position: relative;
        overflow: hidden;
      }
    `
    document.head.appendChild(style)
  }

  // ============================================================================
  // Progressive Image Loading
  // ============================================================================

  private loadProgressiveImage(img: HTMLImageElement): void {
    const highQualitySrc = img.dataset.src
    const lowQualitySrc = img.dataset.lowSrc
    
    if (!highQualitySrc) return

    // Show low quality image first if available
    if (lowQualitySrc && img.src !== lowQualitySrc) {
      img.src = lowQualitySrc
      img.style.filter = 'blur(5px)'
      img.style.transition = 'filter 0.3s ease'
    }

    // Load high quality image
    const highQualityImg = new Image()
    highQualityImg.onload = () => {
      img.src = highQualitySrc
      img.style.filter = 'none'
      img.classList.add('progressive-image-loaded')
    }
    highQualityImg.onerror = () => {
      console.warn(`[ProgressiveLoading] Failed to load high quality image: ${highQualitySrc}`)
    }
    highQualityImg.src = highQualitySrc
  }

  // ============================================================================
  // Lazy Component Loading
  // ============================================================================

  private async loadLazyComponent(element: HTMLElement): Promise<void> {
    const componentName = element.dataset.component
    if (!componentName) return

    try {
      // Show skeleton while loading
      const skeleton = this.createSkeletonElement({
        width: element.offsetWidth || '100%',
        height: element.offsetHeight || '200px',
        animation: 'pulse'
      })
      
      element.appendChild(skeleton)

      // Simulate component loading (in real app, this would be dynamic import)
      await this.simulateComponentLoad(componentName)
      
      // Remove skeleton and show content
      skeleton.remove()
      element.classList.add('lazy-component-loaded')
      
    } catch (error) {
      console.error(`[ProgressiveLoading] Failed to load component ${componentName}:`, error)
    }
  }

  private async simulateComponentLoad(componentName: string): Promise<void> {
    // Simulate network delay based on component complexity
    const loadTime = componentName.includes('Chart') ? 800 : 
                    componentName.includes('Table') ? 600 : 400
    
    await new Promise(resolve => setTimeout(resolve, loadTime))
  }

  // ============================================================================
  // Incremental Content Loading
  // ============================================================================

  private async loadIncrementalContent(element: HTMLElement): Promise<void> {
    const batchSize = parseInt(element.dataset.batchSize || '5')
    const items = element.querySelectorAll('[data-incremental-item]')
    
    if (items.length === 0) return

    // Hide all items initially
    items.forEach(item => {
      (item as HTMLElement).style.opacity = '0'
      ;(item as HTMLElement).style.transform = 'translateY(20px)'
      ;(item as HTMLElement).style.transition = 'opacity 0.3s ease, transform 0.3s ease'
    })

    // Load items in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = Array.from(items).slice(i, i + batchSize)
      
      await new Promise(resolve => setTimeout(resolve, 100)) // Small delay between batches
      
      batch.forEach((item, index) => {
        setTimeout(() => {
          (item as HTMLElement).style.opacity = '1'
          ;(item as HTMLElement).style.transform = 'translateY(0)'
        }, index * 50) // Stagger animation within batch
      })
    }
  }

  // ============================================================================
  // Queue Management
  // ============================================================================

  addToLoadingQueue(loadFn: () => Promise<void>, priority: 'high' | 'medium' | 'low' = 'medium'): void {
    if (priority === 'high') {
      this.loadingQueue.unshift(loadFn)
    } else {
      this.loadingQueue.push(loadFn)
    }

    if (!this.isProcessingQueue) {
      this.processLoadingQueue()
    }
  }

  private async processLoadingQueue(): Promise<void> {
    if (this.isProcessingQueue || this.loadingQueue.length === 0) return

    this.isProcessingQueue = true

    while (this.loadingQueue.length > 0) {
      const loadFn = this.loadingQueue.shift()
      if (loadFn) {
        try {
          await loadFn()
        } catch (error) {
          console.error('[ProgressiveLoading] Queue item failed:', error)
        }
      }
    }

    this.isProcessingQueue = false
  }

  // ============================================================================
  // Public API
  // ============================================================================

  observeElement(element: HTMLElement): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.observe(element)
    }
  }

  unobserveElement(element: HTMLElement): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.unobserve(element)
    }
  }

  getConfig(): ProgressiveLoadingConfig {
    return { ...this.config }
  }

  updateConfig(newConfig: Partial<ProgressiveLoadingConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  destroy(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect()
      this.intersectionObserver = null
    }
    this.loadingQueue = []
  }
}

// ============================================================================
// Global Instance
// ============================================================================

let progressiveLoader: ProgressiveLoadingManager | null = null

export const getProgressiveLoader = (): ProgressiveLoadingManager => {
  if (!progressiveLoader) {
    progressiveLoader = new ProgressiveLoadingManager()
  }
  return progressiveLoader
}

export const initializeProgressiveLoading = (
  config?: Partial<ProgressiveLoadingConfig>
): ProgressiveLoadingManager => {
  const loader = getProgressiveLoader()
  
  if (config) {
    loader.updateConfig(config)
  }

  // Inject skeleton styles
  loader.injectSkeletonStyles()

  console.log('[ProgressiveLoading] Progressive loading initialized')
  return loader
}

// ============================================================================
// React Components
// ============================================================================

/**
 * Skeleton component for loading states
 */
export const Skeleton: React.FC<SkeletonConfig> = ({
  width = '100%',
  height = '20px',
  borderRadius = '4px',
  animation = 'pulse',
  count = 1,
  className = ''
}) => {
  const skeletons = Array.from({ length: count }, (_, index) =>
    React.createElement('div', {
      key: index,
      className: `skeleton ${className}`,
      style: {
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
        backgroundColor: '#e2e8f0',
        backgroundImage: animation === 'wave'
          ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)'
          : 'none',
        backgroundSize: animation === 'wave' ? '200px 100%' : 'auto',
        animation: animation === 'pulse'
          ? 'skeleton-pulse 1.5s ease-in-out infinite'
          : animation === 'wave'
          ? 'skeleton-wave 1.5s linear infinite'
          : 'none',
        marginBottom: count > 1 ? '8px' : '0'
      }
    })
  )

  return React.createElement(React.Fragment, null, ...skeletons)
}

/**
 * Progressive Image component
 */
export const ProgressiveImage: React.FC<ProgressiveImageConfig> = ({
  lowQualitySrc,
  highQualitySrc,
  alt,
  className = '',
  blurAmount = 5,
  transitionDuration = 300
}) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(lowQualitySrc || '')
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      setCurrentSrc(highQualitySrc)
      setIsLoaded(true)
    }
    img.src = highQualitySrc
  }, [highQualitySrc])

  return React.createElement('img', {
    ref: imgRef,
    src: currentSrc,
    alt: alt,
    className: `progressive-image ${className} ${isLoaded ? 'loaded' : ''}`,
    style: {
      filter: isLoaded ? 'none' : `blur(${blurAmount}px)`,
      transition: `filter ${transitionDuration}ms ease`
    }
  })
}

/**
 * Lazy Load wrapper component
 */
export const LazyLoad: React.FC<{
  children: React.ReactNode
  config?: LazyLoadConfig
  placeholder?: React.ReactNode
}> = ({
  children,
  config = {
    threshold: 0.1,
    rootMargin: '50px 0px',
    triggerOnce: true
  },
  placeholder
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element || !('IntersectionObserver' in window)) {
      setIsVisible(true)
      setIsLoaded(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          setTimeout(() => setIsLoaded(true), 100)
          
          if (config.triggerOnce) {
            observer.unobserve(element)
          }
        }
      },
      {
        threshold: config.threshold,
        rootMargin: config.rootMargin
      }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [config])

  return React.createElement('div', {
    ref: elementRef,
    className: 'lazy-load-container'
  },
    isVisible ?
      React.createElement('div', {
        className: `lazy-load-content ${isLoaded ? 'loaded' : 'loading'}`,
        style: {
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.3s ease'
        }
      }, children) :
      (placeholder || React.createElement(Skeleton, { height: '200px' }))
  )
}

/**
 * Incremental List component
 */
export const IncrementalList: React.FC<{
  items: any[]
  renderItem: (item: any, index: number) => React.ReactNode
  config?: IncrementalLoadingConfig
}> = ({
  items,
  renderItem,
  config = {
    batchSize: 5,
    delay: 100,
    priority: 'medium' as const
  }
}) => {
  const [visibleCount, setVisibleCount] = useState(config.batchSize)
  const [isLoading, setIsLoading] = useState(false)

  const loadMore = useCallback(async () => {
    if (isLoading || visibleCount >= items.length) return

    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, config.delay))
    
    setVisibleCount(prev => Math.min(prev + config.batchSize, items.length))
    setIsLoading(false)
  }, [isLoading, visibleCount, items.length, config])

  useEffect(() => {
    if (visibleCount < items.length) {
      const timer = setTimeout(loadMore, config.delay)
      return () => clearTimeout(timer)
    }
  }, [visibleCount, items.length, loadMore, config.delay])

  const visibleItems = items.slice(0, visibleCount).map((item, index) =>
    React.createElement('div', {
      key: index,
      className: 'incremental-item',
      style: {
        opacity: 1,
        transform: 'translateY(0)',
        transition: 'opacity 0.3s ease, transform 0.3s ease'
      }
    }, renderItem(item, index))
  )

  const loadingIndicator = isLoading && (config as IncrementalLoadingConfig).loadingIndicator ?
    React.createElement('div', {
      className: 'incremental-loading'
    }, (config as IncrementalLoadingConfig).loadingIndicator) : null

  return React.createElement('div', {
    className: 'incremental-list'
  }, ...visibleItems, loadingIndicator)
}

// ============================================================================
// React Hooks
// ============================================================================

/**
 * Hook for progressive loading functionality
 */
export const useProgressiveLoading = () => {
  const loader = getProgressiveLoader()

  const observeElement = useCallback((element: HTMLElement) => {
    loader.observeElement(element)
  }, [loader])

  const unobserveElement = useCallback((element: HTMLElement) => {
    loader.unobserveElement(element)
  }, [loader])

  const addToQueue = useCallback((loadFn: () => Promise<void>, priority?: 'high' | 'medium' | 'low') => {
    loader.addToLoadingQueue(loadFn, priority)
  }, [loader])

  return {
    observeElement,
    unobserveElement,
    addToQueue,
    config: loader.getConfig()
  }
}

/**
 * Hook for lazy loading with intersection observer
 */
export const useLazyLoad = (config?: LazyLoadConfig) => {
  const [isVisible, setIsVisible] = useState(false)
  const elementRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element || !('IntersectionObserver' in window)) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (config?.triggerOnce !== false) {
            observer.unobserve(element)
          }
        }
      },
      {
        threshold: config?.threshold || 0.1,
        rootMargin: config?.rootMargin || '50px 0px'
      }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [config])

  return { isVisible, elementRef }
}

export default ProgressiveLoadingManager
export type { 
  ProgressiveLoadingConfig, 
  SkeletonConfig, 
  LazyLoadConfig, 
  ProgressiveImageConfig,
  IncrementalLoadingConfig 
}