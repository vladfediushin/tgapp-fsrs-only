import React, { Suspense, useEffect, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { SuspenseFallback } from './components/PageLoader'
import { GlobalErrorBoundary } from './components/ErrorBoundary/GlobalErrorBoundary'
import { createLazyComponent } from './utils/optimization/lazyComponents'
import { useRoutePreloader } from './utils/optimization/loading'
import { usePerformanceMetrics } from './utils/core/performance'

// Lazy load performance dashboard to avoid impacting initial bundle
const PerformanceDashboard = createLazyComponent(
  () => import('./components/PerformanceDashboard'),
  'PerformanceDashboard',
  { priority: 'low' }
)

// Enhanced lazy loading with dynamic imports and error handling
const Authorize = createLazyComponent(
  () => import('./pages/Authorize'),
  'Authorize',
  { priority: 'high' }
)

const Home = createLazyComponent(
  () => import('./pages/Home'),
  'Home',
  { priority: 'medium' }
)

const HomeUnified = createLazyComponent(
  () => import('./pages/Home-Unified'),
  'HomeUnified',
  { priority: 'high' }
)

const ModeSelect = createLazyComponent(
  () => import('./pages/ModeSelect'),
  'ModeSelect',
  { priority: 'medium' }
)

const Repeat = createLazyComponent(
  () => import('./pages/Repeat(1)'),
  'Repeat',
  { priority: 'high' }
)

const Results = createLazyComponent(
  () => import('./pages/Results'),
  'Results',
  { priority: 'medium' }
)

const Profile = createLazyComponent(
  () => import('./pages/Profile'),
  'Profile',
  { priority: 'low' }
)

const Settings = createLazyComponent(
  () => import('./pages/Settings'),
  'Settings',
  { priority: 'medium' }
)

const SettingsUnified = createLazyComponent(
  () => import('./pages/Settings-Unified'),
  'SettingsUnified',
  { priority: 'high' }
)

const ExamSettings = createLazyComponent(
  () => import('./pages/ExamSettings'),
  'ExamSettings',
  { priority: 'medium' }
)

const Topics = createLazyComponent(
  () => import('./pages/Topics'),
  'Topics',
  { priority: 'medium' }
)

const Statistics = createLazyComponent(
  () => import('./pages/Statistics'),
  'Statistics',
  { priority: 'low' }
)

const FSRSTestPage = createLazyComponent(
  () => import('./pages/FSRSTestPage'),
  'FSRSTestPage',
  { priority: 'low' }
)

const App = () => {
  // Use route preloader for intelligent resource prefetching
  useRoutePreloader()
  
  // Performance monitoring integration
  const { trackRouteChange } = usePerformanceMetrics()
  const location = useLocation()
  
  // Performance dashboard state
  const [showPerformanceDashboard, setShowPerformanceDashboard] = useState(false)

  // Track route changes for performance monitoring
  useEffect(() => {
    trackRouteChange(location.pathname)
  }, [location.pathname, trackRouteChange])

  // Keyboard shortcut to toggle performance dashboard (Ctrl+Shift+P)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'P') {
        event.preventDefault()
        setShowPerformanceDashboard(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <GlobalErrorBoundary>
      <Suspense fallback={<SuspenseFallback pageName="приложения" />}>
        <Routes>
          <Route
            path="/"
            element={
              <Suspense fallback={<SuspenseFallback pageName="авторизации" />}>
                <Authorize />
              </Suspense>
            }
          />
          <Route
            path="/home"
            element={
              <Suspense fallback={<SuspenseFallback pageName="главной страницы" />}>
                <HomeUnified />
              </Suspense>
            }
          />
          <Route
            path="/mode"
            element={
              <Suspense fallback={<SuspenseFallback pageName="выбора режима" />}>
                <ModeSelect />
              </Suspense>
            }
          />
          <Route
            path="/repeat"
            element={
              <Suspense fallback={<SuspenseFallback pageName="повторения" />}>
                <Repeat />
              </Suspense>
            }
          />
          <Route
            path="/results"
            element={
              <Suspense fallback={<SuspenseFallback pageName="результатов" />}>
                <Results />
              </Suspense>
            }
          />
          <Route
            path="/profile"
            element={
              <Suspense fallback={<SuspenseFallback pageName="профиля" />}>
                <Profile />
              </Suspense>
            }
          />
          <Route
            path="/settings"
            element={
              <Suspense fallback={<SuspenseFallback pageName="настроек" />}>
                <SettingsUnified />
              </Suspense>
            }
          />
          <Route
            path="/exam-settings"
            element={
              <Suspense fallback={<SuspenseFallback pageName="настроек экзамена" />}>
                <ExamSettings />
              </Suspense>
            }
          />
          <Route
            path="/topics"
            element={
              <Suspense fallback={<SuspenseFallback pageName="тем" />}>
                <Topics />
              </Suspense>
            }
          />
          <Route
            path="/statistics"
            element={
              <Suspense fallback={<SuspenseFallback pageName="статистики" />}>
                <Statistics />
              </Suspense>
            }
          />
          <Route
            path="/fsrs"
            element={
              <Suspense fallback={<SuspenseFallback pageName="FSRS тестирования" />}>
                <FSRSTestPage />
              </Suspense>
            }
          />
        </Routes>
      </Suspense>
      
      {/* Performance Dashboard - only render when visible */}
      {showPerformanceDashboard && (
        <Suspense fallback={<div>Loading Performance Dashboard...</div>}>
          <PerformanceDashboard
            isVisible={showPerformanceDashboard}
            onClose={() => setShowPerformanceDashboard(false)}
          />
        </Suspense>
      )}
    </GlobalErrorBoundary>
  )
}

export default App