// Service Worker Wrapper - Maintains API Compatibility
// This file provides backward compatibility while using the new consolidated service worker

import {
  ServiceWorkerManager as CoreServiceWorkerManager,
  ServiceWorkerConfig,
  ServiceWorkerState,
  PWAInstallState,
  ServiceWorkerMessage,
  ServiceWorkerDebugInfo,
  ServiceWorkerMetrics,
  initializeServiceWorker,
  getServiceWorkerManager,
  useServiceWorker,
  usePWAInstall,
  useServiceWorkerDebug,
  isServiceWorkerSupported,
  isPWAInstalled,
  canInstallPWA,
  formatBytes,
  formatDuration,
  getHealthStatus
} from './core/serviceWorker'

// Re-export all types and interfaces for backward compatibility
export type {
  ServiceWorkerConfig,
  ServiceWorkerState,
  PWAInstallState,
  ServiceWorkerMessage,
  ServiceWorkerDebugInfo,
  ServiceWorkerMetrics
}

// Re-export the main class with original name for compatibility
export { CoreServiceWorkerManager as ServiceWorkerManager }

// Re-export all functions
export {
  initializeServiceWorker,
  getServiceWorkerManager,
  useServiceWorker,
  usePWAInstall,
  useServiceWorkerDebug,
  isServiceWorkerSupported,
  isPWAInstalled,
  canInstallPWA,
  formatBytes,
  formatDuration,
  getHealthStatus
}

// Default export for backward compatibility
export default CoreServiceWorkerManager

// BeforeInstallPromptEvent interface for backward compatibility
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}