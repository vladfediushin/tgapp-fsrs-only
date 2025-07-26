// src/main.tsx - Enhanced with debugging and Telegram Web App initialization
import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { useSession } from './store/session'
import { initializePerformanceSystems } from './utils/core/performanceInit'
import { testConnectionWithRetry } from './api/api'
import { initializeTelegramWebAppWithFallback } from './utils/telegramWebApp'

// Lazy load i18n to reduce initial bundle size
// Use optimized dependency loader
import { loadI18n } from './utils/optimization/dependencyLoaders'

const Root = () => {
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

  // Initialize consolidated performance systems with debugging enhancements
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('[App] Starting enhanced initialization with debugging...')
        
        // 1. Initialize Telegram Web App first
        console.log('[App] Step 1: Initializing Telegram Web App...')
        const telegramResult = initializeTelegramWebAppWithFallback(true)
        
        if (telegramResult.success) {
          console.log('[App] ✓ Telegram Web App initialized successfully')
          if (telegramResult.user) {
            console.log(`[App] ✓ User: ${telegramResult.user.first_name} (ID: ${telegramResult.user.id})`)
          }
        } else {
          console.warn('[App] ⚠ Telegram Web App initialization failed:', telegramResult.error)
          console.log('[App] ⚠ Debug info:', telegramResult.debugInfo)
        }

        // 2. Test backend connectivity
        console.log('[App] Step 2: Testing backend connectivity...')
        const connectionResult = await testConnectionWithRetry(3)
        
        if (connectionResult.success) {
          console.log(`[App] ✓ Backend connection successful (${connectionResult.responseTime}ms)`)
        } else {
          console.error('[App] ✗ Backend connection failed:', connectionResult.error)
          console.error('[App] ✗ Connection details:', connectionResult.details)
        }

        // 3. Initialize performance systems
        console.log('[App] Step 3: Initializing performance systems...')
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

        console.log('[App] ✓ Enhanced initialization complete')

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
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  )
}

// Start the application
renderApp()