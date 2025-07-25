// Dependency Loaders - Split from loading.ts for better tree shaking
// Contains only dependency loading functions

import { dynamicImport } from './dynamicImports'

/**
 * Lazy load i18next and related dependencies
 */
export const loadI18n = () => dynamicImport(
  () => import('../../i18n'),
  'i18n',
  { priority: 'medium' }
)

/**
 * Lazy load chart components
 */
export const loadChartComponents = () => dynamicImport(
  () => import('react-circular-progressbar'),
  'charts',
  { priority: 'low' }
)

/**
 * Lazy load recharts
 */
export const loadRecharts = () => dynamicImport(
  () => import('recharts'),
  'recharts',
  { priority: 'low' }
)

/**
 * Lazy load date picker
 */
export const loadDatePicker = () => dynamicImport(
  () => import('react-datepicker'),
  'datepicker',
  { priority: 'low' }
)

/**
 * Lazy load icons
 */
export const loadIcons = () => dynamicImport(
  () => import('react-icons'),
  'react-icons',
  { priority: 'medium' }
)

export const loadLucideIcons = () => dynamicImport(
  () => import('lucide-react'),
  'lucide-react',
  { priority: 'medium' }
)

/**
 * Lazy load validation library
 */
export const loadValidation = () => dynamicImport(
  () => import('zod'),
  'zod',
  { priority: 'high' }
)

/**
 * Lazy load FSRS store
 */
export const loadFSRSStore = () => dynamicImport(
  () => import('../../store/fsrs'),
  'store-fsrs',
  { priority: 'high' }
)

/**
 * Lazy load stats store
 */
export const loadStatsStore = () => dynamicImport(
  () => import('../../store/stats'),
  'store-stats',
  { priority: 'medium' }
)

/**
 * Lazy load offline queue
 */
export const loadOfflineQueue = () => dynamicImport(
  () => import('../../store/offlineQueue'),
  'store-offline',
  { priority: 'high' }
)

/**
 * Preload critical dependencies
 */
export const preloadCriticalDependencies = () => {
  // Queue high-priority dependencies
  setTimeout(() => {
    loadFSRSStore().catch(() => {})
    loadOfflineQueue().catch(() => {})
    loadValidation().catch(() => {})
  }, 1000)
  
  // Queue medium-priority dependencies
  setTimeout(() => {
    loadI18n().catch(() => {})
    loadStatsStore().catch(() => {})
    loadLucideIcons().catch(() => {})
  }, 2000)
  
  // Queue low-priority dependencies
  setTimeout(() => {
    loadChartComponents().catch(() => {})
    loadRecharts().catch(() => {})
    loadDatePicker().catch(() => {})
    loadIcons().catch(() => {})
  }, 3000)
}