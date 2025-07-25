// Compatibility export for compressionOptimization.ts
// This file maintains backward compatibility while redirecting to the new consolidated structure
// @deprecated - Use imports from './optimization/compression' instead

export {
  getCompressionManager,
  getVendorOptimizationManager,
  compressData,
  decompressData,
  getOptimizationRecommendations,
  generateOptimizedWebpackConfig,
  initializeOptimization,
  type CompressionConfig,
  type VendorOptimizationConfig,
  type CompressionResult,
  type BundleAnalysis,
  type VendorChunk
} from './optimization/compression'

// Re-export everything as default for backward compatibility
import compressionUtils from './optimization/compression'
export default compressionUtils