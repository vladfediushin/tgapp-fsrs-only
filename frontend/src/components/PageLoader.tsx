// Page Loading Component with Progressive Enhancement
import React, { useState, useEffect } from 'react'
import LoadingSpinner from './LoadingSpinner'

interface PageLoaderProps {
  isLoading?: boolean
  error?: Error | string | null
  retry?: () => void
  pageName?: string
  showProgress?: boolean
  timeout?: number
}

const PageLoader: React.FC<PageLoaderProps> = ({
  isLoading = true,
  error = null,
  retry,
  pageName = 'страницы',
  showProgress = true,
  timeout = 10000
}) => {
  const [progress, setProgress] = useState(0)
  const [hasTimedOut, setHasTimedOut] = useState(false)

  useEffect(() => {
    if (!isLoading) return

    let progressInterval: number
    let timeoutId: number

    if (showProgress) {
      // Simulate loading progress
      progressInterval = window.setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev
          return prev + Math.random() * 15
        })
      }, 200)
    }

    // Set timeout
    timeoutId = window.setTimeout(() => {
      setHasTimedOut(true)
    }, timeout)

    return () => {
      if (progressInterval) clearInterval(progressInterval)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [isLoading, showProgress, timeout])

  useEffect(() => {
    if (!isLoading) {
      setProgress(100)
      setHasTimedOut(false)
    }
  }, [isLoading])

  if (error || hasTimedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 max-w-md mx-auto">
          <div className="text-6xl mb-4">
            {hasTimedOut ? '⏱️' : '❌'}
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            {hasTimedOut ? 'Превышено время ожидания' : 'Ошибка загрузки'}
          </h2>
          <p className="text-gray-600 mb-6">
            {hasTimedOut 
              ? `Загрузка ${pageName} занимает слишком много времени`
              : `Не удалось загрузить ${pageName}`
            }
          </p>
          {error && (
            <details className="text-left bg-red-50 p-3 rounded mb-4">
              <summary className="cursor-pointer text-red-700 font-medium">
                Подробности ошибки
              </summary>
              <pre className="text-xs text-red-600 mt-2 overflow-auto">
                {typeof error === 'string'
                  ? error
                  : (error as Error).message || 'Неизвестная ошибка'
                }
              </pre>
            </details>
          )}
          {retry && (
            <button
              onClick={() => {
                setHasTimedOut(false)
                setProgress(0)
                retry()
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Попробовать снова
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!isLoading) return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 max-w-md mx-auto">
        {/* Main loading animation */}
        <div className="mb-6">
          <LoadingSpinner 
            size="large" 
            variant="spinner" 
            color="primary"
          />
        </div>

        {/* Loading text */}
        <h2 className="text-lg font-medium text-gray-800 mb-2">
          Загрузка {pageName}...
        </h2>

        {/* Progress bar */}
        {showProgress && (
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}

        {/* Loading tips */}
        <div className="text-sm text-gray-500 space-y-1">
          <p>Подготавливаем интерфейс...</p>
          {progress > 30 && <p>Загружаем компоненты...</p>}
          {progress > 60 && <p>Инициализируем данные...</p>}
          {progress > 80 && <p>Почти готово...</p>}
        </div>

        {/* Offline indicator */}
        {!navigator.onLine && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center text-yellow-800">
              <span className="text-lg mr-2">📴</span>
              <span className="text-sm">
                Вы находитесь в автономном режиме. Загрузка может занять больше времени.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Suspense fallback component
export const SuspenseFallback: React.FC<{ pageName?: string }> = ({ 
  pageName = 'компонента' 
}) => (
  <PageLoader 
    isLoading={true} 
    pageName={pageName}
    showProgress={true}
  />
)

// Error boundary fallback
export const ErrorFallback: React.FC<{
  error: Error
  resetErrorBoundary: () => void
  pageName?: string
}> = ({ error, resetErrorBoundary, pageName = 'страницы' }) => (
  <PageLoader 
    isLoading={false}
    error={error}
    retry={resetErrorBoundary}
    pageName={pageName}
  />
)

export default PageLoader