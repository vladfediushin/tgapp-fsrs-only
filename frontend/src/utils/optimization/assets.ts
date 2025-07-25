// Asset Optimization Utilities
// Consolidated from assetOptimization.ts and related optimization utilities
// Handles image, font, and icon optimization for maximum performance

// ============================================================================
// Types and Interfaces
// ============================================================================

interface ImageOptimizationConfig {
  enableWebP: boolean
  enableAVIF: boolean
  enableLazyLoading: boolean
  enableResponsiveImages: boolean
  quality: number
  maxWidth: number
  maxHeight: number
  compressionLevel: number
  placeholderStrategy: 'blur' | 'skeleton' | 'color' | 'none'
  loadingStrategy: 'eager' | 'lazy' | 'auto'
}

interface FontOptimizationConfig {
  enablePreload: boolean
  enableSubsetting: boolean
  enableWOFF2: boolean
  enableVariableFonts: boolean
  fontDisplay: 'auto' | 'block' | 'swap' | 'fallback' | 'optional'
  preloadCriticalFonts: string[]
  fallbackFonts: Record<string, string[]>
}

interface IconOptimizationConfig {
  enableSVGSprites: boolean
  enableIconFonts: boolean
  enableInlineSVG: boolean
  spriteStrategy: 'single' | 'multiple' | 'lazy'
  iconSize: 'small' | 'medium' | 'large' | 'responsive'
  compressionLevel: number
}

interface AssetMetrics {
  originalSize: number
  optimizedSize: number
  compressionRatio: number
  format: string
  loadTime: number
  cacheHit: boolean
}

interface ResponsiveImageConfig {
  breakpoints: number[]
  sizes: string[]
  formats: string[]
  quality: number[]
}

// ============================================================================
// Default Configurations
// ============================================================================

const DEFAULT_IMAGE_CONFIG: ImageOptimizationConfig = {
  enableWebP: true,
  enableAVIF: true,
  enableLazyLoading: true,
  enableResponsiveImages: true,
  quality: 85,
  maxWidth: 1920,
  maxHeight: 1080,
  compressionLevel: 6,
  placeholderStrategy: 'blur',
  loadingStrategy: 'lazy'
}

const DEFAULT_FONT_CONFIG: FontOptimizationConfig = {
  enablePreload: true,
  enableSubsetting: true,
  enableWOFF2: true,
  enableVariableFonts: true,
  fontDisplay: 'swap',
  preloadCriticalFonts: ['Inter-Regular', 'Inter-Medium', 'Inter-SemiBold'],
  fallbackFonts: {
    'Inter': ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
    'JetBrains Mono': ['Consolas', 'Monaco', 'Courier New', 'monospace']
  }
}

const DEFAULT_ICON_CONFIG: IconOptimizationConfig = {
  enableSVGSprites: true,
  enableIconFonts: false,
  enableInlineSVG: true,
  spriteStrategy: 'multiple',
  iconSize: 'responsive',
  compressionLevel: 9
}

// ============================================================================
// Asset Optimization Manager
// ============================================================================

export class AssetOptimizationManager {
  private imageConfig: ImageOptimizationConfig
  private fontConfig: FontOptimizationConfig
  private iconConfig: IconOptimizationConfig
  private assetCache: Map<string, AssetMetrics> = new Map()
  private imageFormats: string[] = ['avif', 'webp', 'jpg', 'png']
  private supportedFormats: Set<string> = new Set()

  constructor(
    imageConfig?: Partial<ImageOptimizationConfig>,
    fontConfig?: Partial<FontOptimizationConfig>,
    iconConfig?: Partial<IconOptimizationConfig>
  ) {
    this.imageConfig = { ...DEFAULT_IMAGE_CONFIG, ...imageConfig }
    this.fontConfig = { ...DEFAULT_FONT_CONFIG, ...fontConfig }
    this.iconConfig = { ...DEFAULT_ICON_CONFIG, ...iconConfig }
    
    this.detectSupportedFormats()
    this.initializeFontOptimization()
  }

  // ============================================================================
  // Format Detection
  // ============================================================================

  private detectSupportedFormats(): void {
    if (typeof window === 'undefined') return

    // Test WebP support
    const webpCanvas = document.createElement('canvas')
    webpCanvas.width = 1
    webpCanvas.height = 1
    const webpSupported = webpCanvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
    if (webpSupported) this.supportedFormats.add('webp')

    // Test AVIF support
    const avifImg = new Image()
    avifImg.onload = () => this.supportedFormats.add('avif')
    avifImg.onerror = () => {} // Silent fail
    avifImg.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A='

    // Always support JPEG and PNG
    this.supportedFormats.add('jpg')
    this.supportedFormats.add('jpeg')
    this.supportedFormats.add('png')
  }

  // ============================================================================
  // Image Optimization
  // ============================================================================

  optimizeImageUrl(originalUrl: string, options?: Partial<ImageOptimizationConfig>): string {
    const config = { ...this.imageConfig, ...options }
    
    // If it's already optimized or external, return as-is
    if (originalUrl.includes('?optimized') || originalUrl.startsWith('http')) {
      return originalUrl
    }

    const params = new URLSearchParams()
    
    // Add optimization parameters
    params.set('quality', config.quality.toString())
    params.set('maxWidth', config.maxWidth.toString())
    params.set('maxHeight', config.maxHeight.toString())
    
    // Add format preference based on browser support
    if (config.enableAVIF && this.supportedFormats.has('avif')) {
      params.set('format', 'avif')
    } else if (config.enableWebP && this.supportedFormats.has('webp')) {
      params.set('format', 'webp')
    }
    
    params.set('optimized', 'true')
    
    return `${originalUrl}?${params.toString()}`
  }

  generateResponsiveImageSet(
    baseUrl: string, 
    config?: ResponsiveImageConfig
  ): { srcSet: string; sizes: string } {
    const responsive = config || {
      breakpoints: [320, 640, 768, 1024, 1280, 1920],
      sizes: ['100vw', '(min-width: 640px) 50vw', '(min-width: 1024px) 33vw'],
      formats: ['avif', 'webp', 'jpg'],
      quality: [75, 80, 85, 90]
    }

    const srcSetEntries: string[] = []
    
    responsive.breakpoints.forEach((width, index) => {
      const quality = responsive.quality[index] || responsive.quality[responsive.quality.length - 1]
      const optimizedUrl = this.optimizeImageUrl(baseUrl, {
        ...this.imageConfig,
        maxWidth: width,
        quality
      })
      srcSetEntries.push(`${optimizedUrl} ${width}w`)
    })

    return {
      srcSet: srcSetEntries.join(', '),
      sizes: responsive.sizes.join(', ')
    }
  }

  createImagePlaceholder(
    width: number, 
    height: number, 
    strategy: 'blur' | 'skeleton' | 'color' | 'none' = 'blur'
  ): string {
    switch (strategy) {
      case 'blur':
        return this.createBlurPlaceholder(width, height)
      case 'skeleton':
        return this.createSkeletonPlaceholder(width, height)
      case 'color':
        return this.createColorPlaceholder(width, height)
      default:
        return ''
    }
  }

  private createBlurPlaceholder(width: number, height: number): string {
    if (typeof document === 'undefined') return ''
    
    const canvas = document.createElement('canvas')
    canvas.width = 10
    canvas.height = Math.round((height / width) * 10)
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    
    // Create a simple gradient placeholder
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, '#f3f4f6')
    gradient.addColorStop(1, '#e5e7eb')
    
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    return canvas.toDataURL('image/jpeg', 0.1)
  }

  private createSkeletonPlaceholder(width: number, height: number): string {
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#f3f4f6;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#e5e7eb;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f3f4f6;stop-opacity:1" />
            <animateTransform attributeName="gradientTransform" type="translate" 
              values="-100 0;100 0;-100 0" dur="1.5s" repeatCount="indefinite"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#shimmer)" />
      </svg>
    `
    return `data:image/svg+xml;base64,${btoa(svg)}`
  }

  private createColorPlaceholder(width: number, height: number): string {
    if (typeof document === 'undefined') return ''
    
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    
    ctx.fillStyle = '#f3f4f6'
    ctx.fillRect(0, 0, width, height)
    
    return canvas.toDataURL('image/png')
  }

  // ============================================================================
  // Font Optimization
  // ============================================================================

  private initializeFontOptimization(): void {
    if (typeof document === 'undefined') return

    this.preloadCriticalFonts()
    this.injectFontCSS()
  }

  private preloadCriticalFonts(): void {
    this.fontConfig.preloadCriticalFonts.forEach(fontName => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'font'
      link.type = 'font/woff2'
      link.crossOrigin = 'anonymous'
      link.href = `/fonts/${fontName}.woff2`
      document.head.appendChild(link)
    })
  }

  private injectFontCSS(): void {
    const fontCSS = this.generateFontCSS()
    const style = document.createElement('style')
    style.textContent = fontCSS
    document.head.appendChild(style)
  }

  private generateFontCSS(): string {
    let css = ''
    
    Object.entries(this.fontConfig.fallbackFonts).forEach(([fontFamily, fallbacks]) => {
      css += `
        @font-face {
          font-family: '${fontFamily}';
          font-display: ${this.fontConfig.fontDisplay};
          src: url('/fonts/${fontFamily}-Regular.woff2') format('woff2'),
               url('/fonts/${fontFamily}-Regular.woff') format('woff');
          font-weight: 400;
          font-style: normal;
        }
        
        .font-${fontFamily.toLowerCase().replace(/\s+/g, '-')} {
          font-family: '${fontFamily}', ${fallbacks.join(', ')};
        }
      `
    })
    
    return css
  }

  optimizeFontLoading(fontFamily: string, weights: number[] = [400]): void {
    if (typeof document === 'undefined') return
    
    weights.forEach(weight => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'font'
      link.type = 'font/woff2'
      link.crossOrigin = 'anonymous'
      link.href = `/fonts/${fontFamily}-${weight}.woff2`
      document.head.appendChild(link)
    })
  }

  // ============================================================================
  // Icon Optimization
  // ============================================================================

  createSVGSprite(icons: Record<string, string>): string {
    const symbols = Object.entries(icons)
      .map(([id, svg]) => {
        const cleanSvg = svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')
        return `<symbol id="${id}" viewBox="0 0 24 24">${cleanSvg}</symbol>`
      })
      .join('')

    return `
      <svg xmlns="http://www.w3.org/2000/svg" style="display: none;">
        <defs>${symbols}</defs>
      </svg>
    `
  }

  injectSVGSprite(icons: Record<string, string>): void {
    if (typeof document === 'undefined') return

    const existingSprite = document.getElementById('svg-sprite')
    if (existingSprite) {
      existingSprite.remove()
    }

    const spriteContainer = document.createElement('div')
    spriteContainer.id = 'svg-sprite'
    spriteContainer.innerHTML = this.createSVGSprite(icons)
    document.body.insertBefore(spriteContainer, document.body.firstChild)
  }

  optimizeSVGIcon(svgContent: string): string {
    return svgContent
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
      .replace(/\s*([<>])\s*/g, '$1') // Remove spaces around tags
      .replace(/\s*([\w-]+)="([^"]*)"/g, (match, attr, value) => {
        // Remove default values
        if (
          (attr === 'fill' && value === 'currentColor') ||
          (attr === 'stroke' && value === 'none') ||
          (attr === 'stroke-width' && value === '0')
        ) {
          return ''
        }
        return match
      })
      .trim()
  }

  // ============================================================================
  // Performance Monitoring
  // ============================================================================

  trackAssetLoad(url: string, startTime: number, endTime: number, size: number): void {
    const loadTime = endTime - startTime
    const metrics: AssetMetrics = {
      originalSize: size,
      optimizedSize: size, // Would be different in real optimization
      compressionRatio: 1,
      format: this.getFileExtension(url),
      loadTime,
      cacheHit: loadTime < 50 // Assume cache hit if very fast
    }

    this.assetCache.set(url, metrics)
    
    // Log performance metrics
    console.log(`[AssetOptimization] Loaded ${url}:`, {
      size: `${(size / 1024).toFixed(2)}KB`,
      loadTime: `${loadTime}ms`,
      cached: metrics.cacheHit
    })
  }

  private getFileExtension(url: string): string {
    const match = url.match(/\.([^.?]+)(?:\?|$)/)
    return match ? match[1].toLowerCase() : 'unknown'
  }

  getAssetMetrics(): Record<string, AssetMetrics> {
    return Object.fromEntries(this.assetCache)
  }

  getOptimizationReport(): {
    totalAssets: number
    totalSavings: number
    averageLoadTime: number
    cacheHitRate: number
    formatDistribution: Record<string, number>
  } {
    const metrics = Array.from(this.assetCache.values())
    
    if (metrics.length === 0) {
      return {
        totalAssets: 0,
        totalSavings: 0,
        averageLoadTime: 0,
        cacheHitRate: 0,
        formatDistribution: {}
      }
    }

    const totalSavings = metrics.reduce((sum, m) => sum + (m.originalSize - m.optimizedSize), 0)
    const averageLoadTime = metrics.reduce((sum, m) => sum + m.loadTime, 0) / metrics.length
    const cacheHits = metrics.filter(m => m.cacheHit).length
    const cacheHitRate = cacheHits / metrics.length

    const formatDistribution: Record<string, number> = {}
    metrics.forEach(m => {
      formatDistribution[m.format] = (formatDistribution[m.format] || 0) + 1
    })

    return {
      totalAssets: metrics.length,
      totalSavings,
      averageLoadTime,
      cacheHitRate,
      formatDistribution
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  updateImageConfig(config: Partial<ImageOptimizationConfig>): void {
    this.imageConfig = { ...this.imageConfig, ...config }
  }

  updateFontConfig(config: Partial<FontOptimizationConfig>): void {
    this.fontConfig = { ...this.fontConfig, ...config }
  }

  updateIconConfig(config: Partial<IconOptimizationConfig>): void {
    this.iconConfig = { ...this.iconConfig, ...config }
  }

  getConfigs(): {
    image: ImageOptimizationConfig
    font: FontOptimizationConfig
    icon: IconOptimizationConfig
  } {
    return {
      image: { ...this.imageConfig },
      font: { ...this.fontConfig },
      icon: { ...this.iconConfig }
    }
  }
}

// ============================================================================
// Global Instance
// ============================================================================

let assetOptimizer: AssetOptimizationManager | null = null

export const getAssetOptimizer = (): AssetOptimizationManager => {
  if (!assetOptimizer) {
    assetOptimizer = new AssetOptimizationManager()
  }
  return assetOptimizer
}

export const initializeAssetOptimization = (
  imageConfig?: Partial<ImageOptimizationConfig>,
  fontConfig?: Partial<FontOptimizationConfig>,
  iconConfig?: Partial<IconOptimizationConfig>
): AssetOptimizationManager => {
  assetOptimizer = new AssetOptimizationManager(imageConfig, fontConfig, iconConfig)
  console.log('[AssetOptimization] Asset optimization initialized')
  return assetOptimizer
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Optimize image URL with default settings
 */
export const optimizeImage = (url: string, options?: Partial<ImageOptimizationConfig>): string => {
  return getAssetOptimizer().optimizeImageUrl(url, options)
}

/**
 * Generate responsive image attributes
 */
export const getResponsiveImage = (
  url: string, 
  config?: ResponsiveImageConfig
): { src: string; srcSet: string; sizes: string } => {
  const optimizer = getAssetOptimizer()
  const responsive = optimizer.generateResponsiveImageSet(url, config)
  
  return {
    src: optimizer.optimizeImageUrl(url),
    srcSet: responsive.srcSet,
    sizes: responsive.sizes
  }
}

/**
 * Create optimized image placeholder
 */
export const createImagePlaceholder = (
  width: number,
  height: number,
  strategy?: 'blur' | 'skeleton' | 'color' | 'none'
): string => {
  return getAssetOptimizer().createImagePlaceholder(width, height, strategy)
}

/**
 * Preload critical fonts
 */
export const preloadFonts = (fonts: string[], weights?: number[]): void => {
  const optimizer = getAssetOptimizer()
  fonts.forEach(font => {
    optimizer.optimizeFontLoading(font, weights)
  })
}

/**
 * Create and inject SVG sprite
 */
export const createIconSprite = (icons: Record<string, string>): void => {
  getAssetOptimizer().injectSVGSprite(icons)
}

/**
 * Optimize SVG content
 */
export const optimizeSVG = (svgContent: string): string => {
  return getAssetOptimizer().optimizeSVGIcon(svgContent)
}

export default {
  AssetOptimizationManager,
  getAssetOptimizer,
  initializeAssetOptimization,
  optimizeImage,
  getResponsiveImage,
  createImagePlaceholder,
  preloadFonts,
  createIconSprite,
  optimizeSVG
}

export type {
  ImageOptimizationConfig,
  FontOptimizationConfig,
  IconOptimizationConfig,
  AssetMetrics,
  ResponsiveImageConfig
}