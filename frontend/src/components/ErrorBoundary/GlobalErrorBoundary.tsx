// Global Error Boundary - Catches all unhandled React errors
import React, { Component, ReactNode, ErrorInfo } from 'react'
import { errorRecoveryManager } from '../../store/errorHandling/errorRecovery'
import { ErrorFallbackUI } from './ErrorFallbackUI'
import { ErrorReportingService } from '../../services/errorReporting'

// ============================================================================
// Types and Interfaces
// ============================================================================

interface Props {
  children: ReactNode
  fallback?: React.ComponentType<ErrorFallbackProps>
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  level?: 'global' | 'page' | 'component'
  context?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
  retryCount: number
}

export interface ErrorFallbackProps {
  error: Error
  errorInfo: ErrorInfo | null
  errorId: string | null
  onRetry: () => void
  onReport: () => void
  onReload: () => void
  retryCount: number
  level: 'global' | 'page' | 'component'
  context?: string
}

// ============================================================================
// Global Error Boundary Component
// ============================================================================

export class GlobalErrorBoundary extends React.Component<Props, State> {
  private retryTimeoutId: number | null = null
  private maxRetries = 3
  private retryDelay = 1000

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, level = 'global', context } = this.props

    // Generate error ID and handle with error recovery manager
    const errorId = errorRecoveryManager.handleError(error, {
      operation: 'react_error_boundary',
      store: level,
      additionalData: {
        componentStack: errorInfo.componentStack,
        errorBoundaryLevel: level,
        context,
        retryCount: this.state.retryCount
      }
    })

    // Update state with error details
    this.setState({
      errorInfo,
      errorId,
      hasError: true
    })

    // Report error to analytics/monitoring
    ErrorReportingService.reportError(error, {
      errorId,
      level,
      context,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount
    })

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo)
    }

    // Log error details
    console.group(`🚨 Error Boundary (${level})`)
    console.error('Error:', error)
    console.error('Error Info:', errorInfo)
    console.error('Error ID:', errorId)
    console.groupEnd()
  }

  handleRetry = () => {
    const { retryCount } = this.state

    if (retryCount >= this.maxRetries) {
      console.warn('Max retries reached, cannot retry')
      return
    }

    // Clear any existing timeout
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }

    // Increment retry count and clear error state after delay
    this.setState({ retryCount: retryCount + 1 })

    this.retryTimeoutId = window.setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null
      })
    }, this.retryDelay * (retryCount + 1)) // Exponential backoff
  }

  handleReport = () => {
    const { error, errorInfo, errorId } = this.state
    const { level = 'global', context } = this.props

    if (error && errorId) {
      ErrorReportingService.reportError(error, {
        errorId,
        level,
        context,
        componentStack: errorInfo?.componentStack,
        userReported: true,
        retryCount: this.state.retryCount
      })

      // Show confirmation to user
      console.log('Error reported successfully')
    }
  }

  handleReload = () => {
    // For global errors, reload the entire page
    if (this.props.level === 'global') {
      window.location.reload()
    } else {
      // For component-level errors, try to reset the component
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
        retryCount: 0
      })
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
  }

  render() {
    const { hasError, error, errorInfo, errorId, retryCount } = this.state
    const { children, fallback: CustomFallback, level = 'global', context } = this.props

    if (hasError && error) {
      const FallbackComponent = CustomFallback || ErrorFallbackUI

      return (
        <FallbackComponent
          error={error}
          errorInfo={errorInfo}
          errorId={errorId}
          onRetry={this.handleRetry}
          onReport={this.handleReport}
          onReload={this.handleReload}
          retryCount={retryCount}
          level={level}
          context={context}
        />
      )
    }

    return children
  }
}

// ============================================================================
// Convenience HOC for wrapping components
// ============================================================================

export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    fallback?: React.ComponentType<ErrorFallbackProps>
    level?: 'global' | 'page' | 'component'
    context?: string
    onError?: (error: Error, errorInfo: ErrorInfo) => void
  }
) => {
  const WrappedComponent = (props: P) => (
    <GlobalErrorBoundary
      fallback={options?.fallback}
      level={options?.level || 'component'}
      context={options?.context}
      onError={options?.onError}
    >
      <Component {...props} />
    </GlobalErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  return WrappedComponent
}

// ============================================================================
// Hook for error boundary context
// ============================================================================

export const useErrorBoundary = () => {
  const [error, setError] = React.useState<Error | null>(null)

  const resetError = React.useCallback(() => {
    setError(null)
  }, [])

  const captureError = React.useCallback((error: Error) => {
    setError(error)
  }, [])

  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])

  return {
    captureError,
    resetError
  }
}

export default GlobalErrorBoundary