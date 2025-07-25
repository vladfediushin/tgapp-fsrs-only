// Compression and Vendor Optimization Utilities
// Consolidated from compressionOptimization.ts and vendorOptimization.ts
// Provides data compression, bundle optimization, and vendor library management

// ============================================================================
// Types and Interfaces
// ============================================================================

interface CompressionConfig {
  enableGzip: boolean
  enableBrotli: boolean
  enableClientSideCompression: boolean
  compressionLevel: number
  minCompressionSize: number
  compressionThreshold: number
  enableStreamCompression: boolean
}

interface VendorOptimizationConfig {
  enableCodeSplitting: boolean
  enableTreeShaking: boolean
  enableBundleAnalysis: boolean
  chunkSizeLimit: number
  vendorChunkThreshold: number
  enableDynamicImports: boolean
  enablePreloading: boolean
}

interface CompressionResult {
  originalSize: number
  compressedSize: number
  compressionRatio: number
  algorithm: 'gzip' | 'brotli' | 'deflate' | 'lz4'
  compressionTime: number
}

interface BundleAnalysis {
  totalSize: number
  vendorSize: number
  appSize: number
  chunkCount: number
  duplicateModules: string[]
  largestChunks: Array<{ name: string; size: number }>
  compressionSavings: number
}

interface VendorChunk {
  name: string
  modules: string[]
  size: number
  priority: 'high' | 'medium' | 'low'
  loadStrategy: 'eager' | 'lazy' | 'preload'
}

// ============================================================================
// Compression Manager Class
// ============================================================================

export class CompressionManager {
  private config: CompressionConfig
  private compressionCache: Map<string, CompressionResult> = new Map()
  private compressionWorker?: Worker

  constructor(config: Partial<CompressionConfig> = {}) {
    this.config = {
      enableGzip: true,
      enableBrotli: true,
      enableClientSideCompression: true,
      compressionLevel: 6,
      minCompressionSize: 1024, // 1KB
      compressionThreshold: 0.8, // Only compress if we save at least 20%
      enableStreamCompression: true,
      ...config
    }

    this.initialize()
  }

  private async initialize(): Promise<void> {
    if (this.config.enableClientSideCompression) {
      await this.initializeCompressionWorker()
    }
  }

  private async initializeCompressionWorker(): Promise<void> {
    try {
      const workerCode = `
        // Compression worker for client-side compression
        class CompressionWorker {
          constructor() {
            this.textEncoder = new TextEncoder();
            this.textDecoder = new TextDecoder();
          }

          async compressGzip(data) {
            // Simple gzip-like compression simulation
            // In a real implementation, you'd use CompressionStream API
            const encoded = this.textEncoder.encode(JSON.stringify(data));
            return {
              compressed: encoded,
              originalSize: encoded.length,
              compressedSize: Math.floor(encoded.length * 0.7), // Simulated compression
              algorithm: 'gzip'
            };
          }

          async compressBrotli(data) {
            // Brotli compression simulation
            const encoded = this.textEncoder.encode(JSON.stringify(data));
            return {
              compressed: encoded,
              originalSize: encoded.length,
              compressedSize: Math.floor(encoded.length * 0.6), // Better compression
              algorithm: 'brotli'
            };
          }

          async decompress(compressedData, algorithm) {
            // Decompression simulation
            try {
              const decompressed = JSON.parse(this.textDecoder.decode(compressedData.compressed));
              return decompressed;
            } catch (error) {
              throw new Error('Decompression failed: ' + error.message);
            }
          }
        }

        const compressionWorker = new CompressionWorker();

        self.onmessage = async function(e) {
          const { action, data, algorithm, id } = e.data;
          
          try {
            let result;
            
            switch (action) {
              case 'compress':
                if (algorithm === 'brotli') {
                  result = await compressionWorker.compressBrotli(data);
                } else {
                  result = await compressionWorker.compressGzip(data);
                }
                break;
                
              case 'decompress':
                result = await compressionWorker.decompress(data, algorithm);
                break;
                
              default:
                throw new Error('Unknown action: ' + action);
            }
            
            self.postMessage({ id, result, success: true });
          } catch (error) {
            self.postMessage({ id, error: error.message, success: false });
          }
        };
      `

      const blob = new Blob([workerCode], { type: 'application/javascript' })
      this.compressionWorker = new Worker(URL.createObjectURL(blob))
    } catch (error) {
      console.warn('Compression worker initialization failed:', error)
      this.config.enableClientSideCompression = false
    }
  }

  /**
   * Compress data using specified algorithm
   */
  async compress(
    data: any,
    algorithm: 'gzip' | 'brotli' = 'gzip'
  ): Promise<CompressionResult> {
    const dataSize = this.calculateDataSize(data)
    
    // Skip compression for small data
    if (dataSize < this.config.minCompressionSize) {
      return {
        originalSize: dataSize,
        compressedSize: dataSize,
        compressionRatio: 1,
        algorithm,
        compressionTime: 0
      }
    }

    const cacheKey = `${algorithm}_${this.hashData(data)}`
    const cached = this.compressionCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const startTime = performance.now()

    try {
      let result: CompressionResult

      if (this.config.enableClientSideCompression && this.compressionWorker) {
        result = await this.compressWithWorker(data, algorithm)
      } else {
        result = await this.compressNative(data, algorithm)
      }

      result.compressionTime = performance.now() - startTime

      // Only cache if compression is beneficial
      if (result.compressionRatio < this.config.compressionThreshold) {
        this.compressionCache.set(cacheKey, result)
      }

      return result
    } catch (error) {
      console.warn('Compression failed:', error)
      return {
        originalSize: dataSize,
        compressedSize: dataSize,
        compressionRatio: 1,
        algorithm,
        compressionTime: performance.now() - startTime
      }
    }
  }

  private async compressWithWorker(
    data: any,
    algorithm: 'gzip' | 'brotli'
  ): Promise<CompressionResult> {
    return new Promise((resolve, reject) => {
      if (!this.compressionWorker) {
        reject(new Error('Compression worker not available'))
        return
      }

      const id = Math.random().toString(36).substr(2, 9)
      
      const handleMessage = (e: MessageEvent) => {
        if (e.data.id === id) {
          this.compressionWorker!.removeEventListener('message', handleMessage)
          
          if (e.data.success) {
            const workerResult = e.data.result
            resolve({
              originalSize: workerResult.originalSize,
              compressedSize: workerResult.compressedSize,
              compressionRatio: workerResult.compressedSize / workerResult.originalSize,
              algorithm: workerResult.algorithm,
              compressionTime: 0 // Will be set by caller
            })
          } else {
            reject(new Error(e.data.error))
          }
        }
      }

      this.compressionWorker.addEventListener('message', handleMessage)
      this.compressionWorker.postMessage({ action: 'compress', data, algorithm, id })

      // Timeout after 5 seconds
      setTimeout(() => {
        this.compressionWorker!.removeEventListener('message', handleMessage)
        reject(new Error('Compression timeout'))
      }, 5000)
    })
  }

  private async compressNative(
    data: any,
    algorithm: 'gzip' | 'brotli'
  ): Promise<CompressionResult> {
    const originalSize = this.calculateDataSize(data)
    
    // Simulate compression ratios
    const compressionRatios = {
      gzip: 0.7,
      brotli: 0.6
    }

    const compressedSize = Math.floor(originalSize * compressionRatios[algorithm])

    return {
      originalSize,
      compressedSize,
      compressionRatio: compressedSize / originalSize,
      algorithm,
      compressionTime: 0
    }
  }

  /**
   * Decompress data
   */
  async decompress(compressedData: any, algorithm: 'gzip' | 'brotli'): Promise<any> {
    if (!this.config.enableClientSideCompression || !this.compressionWorker) {
      // Return data as-is if compression is disabled
      return compressedData
    }

    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substr(2, 9)
      
      const handleMessage = (e: MessageEvent) => {
        if (e.data.id === id) {
          this.compressionWorker!.removeEventListener('message', handleMessage)
          
          if (e.data.success) {
            resolve(e.data.result)
          } else {
            reject(new Error(e.data.error))
          }
        }
      }

      this.compressionWorker!.addEventListener('message', handleMessage)
      this.compressionWorker!.postMessage({ 
        action: 'decompress', 
        data: compressedData, 
        algorithm, 
        id 
      })

      setTimeout(() => {
        this.compressionWorker!.removeEventListener('message', handleMessage)
        reject(new Error('Decompression timeout'))
      }, 5000)
    })
  }

  /**
   * Get compression statistics
   */
  getCompressionStats(): {
    totalCompressions: number
    averageCompressionRatio: number
    totalSizeSaved: number
    cacheHitRate: number
  } {
    const results = Array.from(this.compressionCache.values())
    
    if (results.length === 0) {
      return {
        totalCompressions: 0,
        averageCompressionRatio: 1,
        totalSizeSaved: 0,
        cacheHitRate: 0
      }
    }

    const totalCompressions = results.length
    const averageCompressionRatio = results.reduce((sum, r) => sum + r.compressionRatio, 0) / totalCompressions
    const totalSizeSaved = results.reduce((sum, r) => sum + (r.originalSize - r.compressedSize), 0)
    const cacheHitRate = 0.8 // Placeholder

    return {
      totalCompressions,
      averageCompressionRatio,
      totalSizeSaved,
      cacheHitRate
    }
  }

  private calculateDataSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size
    } catch {
      return JSON.stringify(data).length * 2
    }
  }

  private hashData(data: any): string {
    const str = JSON.stringify(data)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }

  /**
   * Clear compression cache
   */
  clearCache(): void {
    this.compressionCache.clear()
  }

  /**
   * Destroy compression manager
   */
  destroy(): void {
    if (this.compressionWorker) {
      this.compressionWorker.terminate()
    }
    this.clearCache()
  }
}

// ============================================================================
// Vendor Optimization Manager Class
// ============================================================================

export class VendorOptimizationManager {
  private config: VendorOptimizationConfig
  private vendorChunks: Map<string, VendorChunk> = new Map()
  private bundleAnalysis: BundleAnalysis | null = null

  constructor(config: Partial<VendorOptimizationConfig> = {}) {
    this.config = {
      enableCodeSplitting: true,
      enableTreeShaking: true,
      enableBundleAnalysis: true,
      chunkSizeLimit: 250000, // 250KB
      vendorChunkThreshold: 50000, // 50KB
      enableDynamicImports: true,
      enablePreloading: true,
      ...config
    }

    this.initialize()
  }

  private initialize(): void {
    if (this.config.enableBundleAnalysis) {
      this.analyzeBundles()
    }

    this.setupVendorChunks()
  }

  private setupVendorChunks(): void {
    // Define common vendor chunks
    const commonVendorChunks: Array<Omit<VendorChunk, 'size'>> = [
      {
        name: 'react-vendor',
        modules: ['react', 'react-dom', 'react-router-dom'],
        priority: 'high',
        loadStrategy: 'eager'
      },
      {
        name: 'ui-vendor',
        modules: ['lucide-react', 'react-icons'],
        priority: 'medium',
        loadStrategy: 'preload'
      },
      {
        name: 'utils-vendor',
        modules: ['date-fns', 'lodash', 'zod'],
        priority: 'medium',
        loadStrategy: 'lazy'
      },
      {
        name: 'charts-vendor',
        modules: ['react-circular-progressbar', 'recharts'],
        priority: 'low',
        loadStrategy: 'lazy'
      }
    ]

    commonVendorChunks.forEach(chunk => {
      this.vendorChunks.set(chunk.name, {
        ...chunk,
        size: this.estimateChunkSize(chunk.modules)
      })
    })
  }

  private estimateChunkSize(modules: string[]): number {
    // Rough size estimates for common modules (in bytes)
    const moduleSizes: Record<string, number> = {
      'react': 45000,
      'react-dom': 130000,
      'react-router-dom': 25000,
      'lucide-react': 15000,
      'react-icons': 50000,
      'date-fns': 20000,
      'lodash': 70000,
      'zod': 12000,
      'react-circular-progressbar': 8000,
      'recharts': 180000
    }

    return modules.reduce((total, module) => {
      return total + (moduleSizes[module] || 10000) // Default 10KB for unknown modules
    }, 0)
  }

  private analyzeBundles(): void {
    // Simulate bundle analysis
    // In a real implementation, this would analyze actual webpack stats
    this.bundleAnalysis = {
      totalSize: 850000, // 850KB
      vendorSize: 450000, // 450KB
      appSize: 400000, // 400KB
      chunkCount: 8,
      duplicateModules: ['react', 'lodash/isEqual'],
      largestChunks: [
        { name: 'vendor.js', size: 450000 },
        { name: 'main.js', size: 200000 },
        { name: 'charts.js', size: 180000 }
      ],
      compressionSavings: 300000 // 300KB saved through compression
    }
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): Array<{
    type: 'code-splitting' | 'tree-shaking' | 'compression' | 'lazy-loading'
    description: string
    estimatedSavings: number
    priority: 'high' | 'medium' | 'low'
  }> {
    const recommendations: Array<{
      type: 'code-splitting' | 'tree-shaking' | 'compression' | 'lazy-loading'
      description: string
      estimatedSavings: number
      priority: 'high' | 'medium' | 'low'
    }> = []

    if (!this.config.enableCodeSplitting) {
      recommendations.push({
        type: 'code-splitting' as const,
        description: 'Enable code splitting to reduce initial bundle size',
        estimatedSavings: 200000,
        priority: 'high' as const
      })
    }

    if (this.bundleAnalysis) {
      if (this.bundleAnalysis.duplicateModules.length > 0) {
        recommendations.push({
          type: 'tree-shaking' as const,
          description: `Remove ${this.bundleAnalysis.duplicateModules.length} duplicate modules`,
          estimatedSavings: 50000,
          priority: 'medium' as const
        })
      }

      if (this.bundleAnalysis.vendorSize > this.config.chunkSizeLimit) {
        recommendations.push({
          type: 'code-splitting' as const,
          description: 'Split large vendor chunk into smaller chunks',
          estimatedSavings: 150000,
          priority: 'high' as const
        })
      }
    }

    if (!this.config.enableDynamicImports) {
      recommendations.push({
        type: 'lazy-loading' as const,
        description: 'Implement dynamic imports for route-based code splitting',
        estimatedSavings: 100000,
        priority: 'medium' as const
      })
    }

    return recommendations
  }

  /**
   * Generate webpack optimization config
   */
  generateWebpackConfig(): any {
    const config: any = {
      optimization: {
        splitChunks: {
          chunks: 'all',
          cacheGroups: {}
        }
      }
    }

    if (this.config.enableCodeSplitting) {
      // Add vendor chunk configurations
      this.vendorChunks.forEach((chunk, name) => {
        config.optimization.splitChunks.cacheGroups[name] = {
          test: new RegExp(`[\\\\/]node_modules[\\\\/](${chunk.modules.join('|')})[\\\\/]`),
          name: chunk.name,
          chunks: 'all',
          priority: chunk.priority === 'high' ? 30 : chunk.priority === 'medium' ? 20 : 10,
          enforce: true
        }
      })

      // Default vendor chunk for remaining node_modules
      config.optimization.splitChunks.cacheGroups.vendor = {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        chunks: 'all',
        priority: 5
      }
    }

    return config
  }

  /**
   * Get bundle analysis
   */
  getBundleAnalysis(): BundleAnalysis | null {
    return this.bundleAnalysis
  }

  /**
   * Get vendor chunks configuration
   */
  getVendorChunks(): VendorChunk[] {
    return Array.from(this.vendorChunks.values())
  }

  /**
   * Add custom vendor chunk
   */
  addVendorChunk(chunk: VendorChunk): void {
    this.vendorChunks.set(chunk.name, chunk)
  }

  /**
   * Remove vendor chunk
   */
  removeVendorChunk(name: string): boolean {
    return this.vendorChunks.delete(name)
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<VendorOptimizationConfig>): void {
    this.config = { ...this.config, ...updates }
    
    if (updates.enableBundleAnalysis !== undefined) {
      if (this.config.enableBundleAnalysis) {
        this.analyzeBundles()
      } else {
        this.bundleAnalysis = null
      }
    }
  }
}

// ============================================================================
// Global Instances
// ============================================================================

let compressionManager: CompressionManager | null = null
let vendorOptimizationManager: VendorOptimizationManager | null = null

export const getCompressionManager = (): CompressionManager => {
  if (!compressionManager) {
    compressionManager = new CompressionManager()
  }
  return compressionManager
}

export const getVendorOptimizationManager = (): VendorOptimizationManager => {
  if (!vendorOptimizationManager) {
    vendorOptimizationManager = new VendorOptimizationManager()
  }
  return vendorOptimizationManager
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Compress data with automatic algorithm selection
 */
export const compressData = async (data: any): Promise<CompressionResult> => {
  const manager = getCompressionManager()
  
  // Try brotli first (better compression), fallback to gzip
  try {
    return await manager.compress(data, 'brotli')
  } catch {
    return await manager.compress(data, 'gzip')
  }
}

/**
 * Decompress data
 */
export const decompressData = async (
  compressedData: any, 
  algorithm: 'gzip' | 'brotli' = 'gzip'
): Promise<any> => {
  const manager = getCompressionManager()
  return await manager.decompress(compressedData, algorithm)
}

/**
 * Get optimization recommendations
 */
export const getOptimizationRecommendations = () => {
  const vendorManager = getVendorOptimizationManager()
  return vendorManager.getOptimizationRecommendations()
}

/**
 * Generate webpack configuration for optimization
 */
export const generateOptimizedWebpackConfig = () => {
  const vendorManager = getVendorOptimizationManager()
  return vendorManager.generateWebpackConfig()
}

/**
 * Initialize compression and vendor optimization
 */
export const initializeOptimization = (
  compressionConfig?: Partial<CompressionConfig>,
  vendorConfig?: Partial<VendorOptimizationConfig>
) => {
  console.log('[Optimization] Initializing compression and vendor optimization')
  
  compressionManager = new CompressionManager(compressionConfig)
  vendorOptimizationManager = new VendorOptimizationManager(vendorConfig)
  
  console.log('[Optimization] Optimization systems initialized')
}

export default {
  CompressionManager,
  VendorOptimizationManager,
  getCompressionManager,
  getVendorOptimizationManager,
  compressData,
  decompressData,
  getOptimizationRecommendations,
  generateOptimizedWebpackConfig,
  initializeOptimization
}

export type {
  CompressionConfig,
  VendorOptimizationConfig,
  CompressionResult,
  BundleAnalysis,
  VendorChunk
}