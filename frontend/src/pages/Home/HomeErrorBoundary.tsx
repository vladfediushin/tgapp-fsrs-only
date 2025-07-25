// HomeErrorBoundary.tsx - Simple Error Boundary for Home Component
import React, { ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

// ============================================================================
// Error Fallback Component
// ============================================================================

interface ErrorFallbackProps {
  error: Error
  retry: () => void
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, retry }) => (
  <div style={{
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px'
  }}>
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '32px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      maxWidth: '400px',
      width: '100%',
      textAlign: 'center'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '16px'
      }}>
        <AlertCircle size={48} style={{ color: '#dc2626' }} />
      </div>
      
      <h2 style={{
        fontSize: '20px',
        fontWeight: '600',
        color: '#111827',
        margin: '0 0 8px 0'
      }}>
        Что-то пошло не так
      </h2>
      
      <p style={{
        color: '#6b7280',
        fontSize: '14px',
        margin: '0 0 24px 0',
        lineHeight: '1.5'
      }}>
        Произошла ошибка при загрузке главной страницы. Попробуйте обновить страницу или повторить попытку.
      </p>
      
      <details style={{
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '24px',
        textAlign: 'left'
      }}>
        <summary style={{
          cursor: 'pointer',
          fontWeight: '500',
          color: '#374151',
          marginBottom: '8px'
        }}>
          Детали ошибки
        </summary>
        <pre style={{
          fontSize: '12px',
          color: '#6b7280',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          margin: 0
        }}>
          {error.message}
        </pre>
      </details>
      
      <button
        onClick={retry}
        style={{
          backgroundColor: '#059669',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          padding: '12px 24px',
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          margin: '0 auto',
          transition: 'background-color 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#047857'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#059669'
        }}
      >
        <RefreshCw size={16} />
        Попробовать снова
      </button>
    </div>
  </div>
)

// ============================================================================
// Simple Error Boundary Wrapper (Functional Component)
// ============================================================================

interface HomeErrorBoundaryProps {
  children: ReactNode
  fallback?: React.ComponentType<ErrorFallbackProps>
  onError?: (error: Error, errorInfo: any) => void
}

const HomeErrorBoundary: React.FC<HomeErrorBoundaryProps> = ({ 
  children, 
  fallback: CustomFallback,
  onError 
}) => {
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('HomeErrorBoundary caught an error:', event.error)
      setError(event.error)
      if (onError) {
        onError(event.error, { componentStack: 'Unknown' })
      }
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('HomeErrorBoundary caught an unhandled promise rejection:', event.reason)
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
      setError(error)
      if (onError) {
        onError(error, { componentStack: 'Promise rejection' })
      }
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [onError])

  const handleRetry = () => {
    setError(null)
  }

  if (error) {
    const FallbackComponent = CustomFallback || ErrorFallback
    return <FallbackComponent error={error} retry={handleRetry} />
  }

  return <>{children}</>
}

export default HomeErrorBoundary