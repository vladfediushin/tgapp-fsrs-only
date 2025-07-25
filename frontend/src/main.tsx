// src/main.tsx - Simplified with consolidated performance initialization
import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { useSession } from './store/session'
import { initializePerformanceSystems } from './utils/core/performanceInit'

// Lazy load i18n to reduce initial bundle size
// Use optimized dependency loader
import { loadI18n } from './utils/optimization/dependencyLoaders'

const Root: React.FC = () => {
  const uiLang = useSession(state => state.uiLanguage)

  useEffect(() => {
    // Load i18n dynamically and set language
    loadI18n().then((i18nModule) => {
      const i18n = i18nModule.default
      if (uiLang) {
        i18n.changeLanguage(uiLang)
      }
    }).catch(error => {
      console.error('Failed to load i18n:', error)
    })
  }, [uiLang])

  // Initialize consolidated performance systems
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('[App] Starting consolidated performance system initialization')
        
        // Single consolidated initialization call
        const result = await initializePerformanceSystems({
          enablePerformanceMonitor: true,
          enableServiceWorker: true,
          serviceWorkerConfig: {
            enableAutoUpdate: true,
            enableBackgroundSync: true,
            enableNotifications: true
          },
          enableOfflineQueue: true,
          enableDynamicImports: true,
          enableErrorRecovery: true
        })

        if (result.success) {
          console.log(`[App] ✓ Performance systems initialized successfully in ${result.initializationTime.toFixed(2)}ms`)
          console.log(`[App] ✓ Active systems: ${result.initializedSystems.join(', ')}`)
          
          if (result.failedSystems.length > 0) {
            console.warn(`[App] ⚠ Some systems failed: ${result.failedSystems.join(', ')}`)
          }
        } else {
          console.error('[App] ✗ Performance system initialization failed')
          result.errors.forEach(error => {
            console.error(`[App] ✗ ${error.system}: ${error.error}`)
          })
        }

      } catch (error) {
        console.error('[App] Critical initialization failure:', error)
      }
    }

    initializeApp()
  }, [])

  return <App key={uiLang} />
}

// Enhanced root rendering with performance optimizations
const renderApp = () => {
  const rootElement = document.getElementById('root')
  if (!rootElement) {
    throw new Error('Root element not found')
  }

  const root = ReactDOM.createRoot(rootElement)
  
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <Root />
      </BrowserRouter>
    </React.StrictMode>
  )
}

// Start the application
renderApp()