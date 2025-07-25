// React Component Lazy Loading - Split from loading.ts for better tree shaking
// Contains only React-specific lazy loading functionality

import { ComponentType, lazy, LazyExoticComponent } from 'react'
import { dynamicImport, type DynamicImportOptions } from './dynamicImports'

/**
 * Create lazy-loaded React component with enhanced error handling
 */
export const createLazyComponent = <T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName: string,
  options: DynamicImportOptions = {}
): LazyExoticComponent<T> => {
  return lazy(() => 
    dynamicImport(importFn, `component-${componentName}`, options)
      .then(module => {
        // Ensure we have a default export
        if (!module.default) {
          throw new Error(`Component ${componentName} does not have a default export`)
        }
        return module
      })
  )
}

/**
 * Create lazy component with preloading capability
 */
export const createPreloadableLazyComponent = <T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName: string,
  options: DynamicImportOptions = {}
) => {
  const LazyComponent = createLazyComponent(importFn, componentName, options)
  
  // Add preload method to the component
  ;(LazyComponent as any).preload = () => {
    return dynamicImport(importFn, `component-${componentName}`, { ...options, preload: true })
  }
  
  return LazyComponent
}

/**
 * Preload multiple components
 */
export const preloadComponents = async (
  components: Array<{ importFn: () => Promise<any>; name: string }>
): Promise<void> => {
  const promises = components.map(({ importFn, name }) =>
    dynamicImport(importFn, `preload-${name}`, { priority: 'low', preload: true })
      .catch(error => {
        console.warn(`Failed to preload component ${name}:`, error)
        return null
      })
  )
  
  await Promise.allSettled(promises)
}