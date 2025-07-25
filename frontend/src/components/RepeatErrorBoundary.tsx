// src/components/RepeatErrorBoundary.tsx - Error Boundary for Repeat Component
import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
}

class RepeatErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `repeat-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('🚨 Repeat Component Error Boundary Caught:', error)
    console.error('📍 Error Info:', errorInfo)
    
    // Update state with error info
    this.setState({
      error,
      errorInfo
    })

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Report to error tracking service (if available)
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack
          }
        },
        tags: {
          component: 'Repeat',
          errorBoundary: true
        }
      })
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    })
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-lg w-full">
            {/* Error Icon */}
            <div className="text-center mb-6">
              <AlertTriangle size={64} className="text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                Something went wrong
              </h1>
              <p className="text-gray-600">
                The learning session encountered an unexpected error. Don't worry - your progress is saved.
              </p>
            </div>

            {/* Error Details (Development) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Bug size={16} className="text-red-600" />
                  <span className="font-semibold text-red-800">Development Error Details</span>
                </div>
                <div className="text-sm text-red-700 font-mono">
                  <div className="mb-2">
                    <strong>Error:</strong> {this.state.error.message}
                  </div>
                  <div className="mb-2">
                    <strong>Error ID:</strong> {this.state.errorId}
                  </div>
                  {this.state.error.stack && (
                    <details className="mt-2">
                      <summary className="cursor-pointer font-semibold">Stack Trace</summary>
                      <pre className="mt-2 text-xs overflow-auto max-h-32 bg-red-100 p-2 rounded">
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="cursor-pointer font-semibold">Component Stack</summary>
                      <pre className="mt-2 text-xs overflow-auto max-h-32 bg-red-100 p-2 rounded">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <RefreshCw size={20} />
                Try Again
              </button>
              
              <button
                onClick={this.handleReload}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-3 px-6 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <RefreshCw size={20} />
                Reload Page
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="w-full bg-gray-500 hover:bg-gray-600 text-white py-3 px-6 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <Home size={20} />
                Back to Home
              </button>
            </div>

            {/* Error ID for Support */}
            <div className="mt-6 pt-4 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-500">
                Error ID: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{this.state.errorId}</code>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Please include this ID when reporting the issue
              </p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default RepeatErrorBoundary

// Higher-order component for easy wrapping
export const withRepeatErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) => {
  const WrappedComponent = (props: P) => (
    <RepeatErrorBoundary fallback={fallback}>
      <Component {...props} />
    </RepeatErrorBoundary>
  )
  
  WrappedComponent.displayName = `withRepeatErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

// Hook for error reporting in functional components
export const useErrorHandler = () => {
  const handleError = React.useCallback((error: Error, errorInfo?: any) => {
    console.error('🚨 Manual Error Report:', error)
    
    // Report to error tracking service
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        extra: errorInfo,
        tags: {
          component: 'Repeat',
          manual: true
        }
      })
    }
  }, [])

  return handleError
}