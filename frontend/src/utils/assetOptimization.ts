// Compatibility export for assetOptimization.ts
// This file maintains backward compatibility while redirecting to the new consolidated structure
// @deprecated - Use imports from './optimization/assets' instead

export {
  getAssetOptimizer,
  initializeAssetOptimization,
  optimizeImage,
  getResponsiveImage,
  createImagePlaceholder,
  preloadFonts,
  createIconSprite,
  optimizeSVG,
  type ImageOptimizationConfig,
  type FontOptimizationConfig,
  type IconOptimizationConfig,
  type AssetMetrics,
  type ResponsiveImageConfig
} from './optimization/assets'

// Re-export everything as default for backward compatibility
import assetsUtils from './optimization/assets'
export default assetsUtils