// Comprehensive Error Fallback UI Components
import React, { useState } from 'react'
import { AlertTriangle, RefreshCw, Bug, Home, ArrowLeft, Copy, Send, ChevronDown, ChevronUp } from 'lucide-react'
import { ErrorFallbackProps } from './GlobalErrorBoundary'

// ============================================================================
// Error Severity Styles
// ============================================================================

const getSeverityStyles = (level: 'global' | 'page' | 'component') => {
  switch (level) {
    case 'global':
      return {
        containerBg: 'bg-red-50',
        borderColor: 'border-red-200',
        iconColor: 'text-red-600',
        titleColor: 'text-red-800',
        buttonColor: 'bg-red-600 hover:bg-red-700'
      }
    case 'page':
      return {
        containerBg: 'bg-orange-50',
        borderColor: 'border-orange-200',
        iconColor: 'text-orange-600',
        titleColor: 'text-orange-800',
        buttonColor: 'bg-orange-600 hover:bg-orange-700'
      }
    case 'component':
      return {
        containerBg: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        iconColor: 'text-yellow-600',
        titleColor: 'text-yellow-800',
        buttonColor: 'bg-yellow-600 hover:bg-yellow-700'
      }
  }
}

// ============================================================================
// Error Messages by Level
// ============================================================================

const getErrorMessages = (level: 'global' | 'page' | 'component', context?: string) => {
  const messages = {
    global: {
      title: 'Критическая ошибка приложения',
      description: 'Произошла серьезная ошибка, которая нарушила работу всего приложения. Мы автоматически сообщили об этой проблеме разработчикам.',
      suggestion: 'Попробуйте перезагрузить страницу или обратитесь в поддержку, если проблема повторяется.'
    },
    page: {
      title: 'Ошибка загрузки страницы',
      description: 'Не удалось загрузить эту страницу из-за технической ошибки. Данные могли быть повреждены или недоступны.',
      suggestion: 'Попробуйте обновить страницу или вернуться на главную.'
    },
    component: {
      title: 'Ошибка компонента',
      description: 'Один из элементов страницы работает некорректно, но остальная часть приложения должна функционировать нормально.',
      suggestion: 'Попробуйте повторить действие или обновить страницу.'
    }
  }

  const base = messages[level]
  
  if (context) {
    return {
      ...base,
      title: `${base.title} (${context})`
    }
  }

  return base
}

// ============================================================================
// Main Error Fallback UI Component
// ============================================================================

export const ErrorFallbackUI: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  errorId,
  onRetry,
  onReport,
  onReload,
  retryCount,
  level,
  context
}) => {
  const [showDetails, setShowDetails] = useState(false)
  const [copied, setCopied] = useState(false)
  const [reported, setReported] = useState(false)

  const styles = getSeverityStyles(level)
  const messages = getErrorMessages(level, context)

  const handleCopyError = async () => {
    const errorDetails = {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      level,
      context,
      retryCount,
      timestamp: new Date().toISOString(),
      url: window.location.href
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy error details:', err)
    }
  }

  const handleReport = () => {
    onReport()
    setReported(true)
    setTimeout(() => setReported(false), 3000)
  }

  const canRetry = retryCount < 3
  const isGlobalError = level === 'global'

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${styles.containerBg}`}>
      <div className={`max-w-2xl w-full bg-white rounded-lg shadow-lg border-2 ${styles.borderColor} overflow-hidden`}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start space-x-4">
            <div className={`flex-shrink-0 ${styles.iconColor}`}>
              <AlertTriangle size={48} />
            </div>
            <div className="flex-1">
              <h1 className={`text-xl font-bold ${styles.titleColor} mb-2`}>
                {messages.title}
              </h1>
              <p className="text-gray-600 mb-4">
                {messages.description}
              </p>
              <p className="text-sm text-gray-500">
                {messages.suggestion}
              </p>
            </div>
          </div>
        </div>

        {/* Error Details */}
        <div className="p-6 border-b border-gray-200">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            <span>Технические детали</span>
          </button>

          {showDetails && (
            <div className="mt-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-2">ID ошибки</div>
                <div className="font-mono text-sm text-gray-800">{errorId}</div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-2">Сообщение об ошибке</div>
                <div className="font-mono text-sm text-gray-800 break-words">
                  {error.message}
                </div>
              </div>

              {error.stack && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-2">Stack Trace</div>
                  <pre className="font-mono text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">
                    {error.stack}
                  </pre>
                </div>
              )}

              {errorInfo?.componentStack && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-2">Component Stack</div>
                  <pre className="font-mono text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">
                    {errorInfo.componentStack}
                  </pre>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-2">Дополнительная информация</div>
                <div className="space-y-1 text-sm text-gray-700">
                  <div>Уровень: {level}</div>
                  {context && <div>Контекст: {context}</div>}
                  <div>Попыток восстановления: {retryCount}</div>
                  <div>URL: {window.location.href}</div>
                  <div>Время: {new Date().toLocaleString('ru-RU')}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 bg-gray-50">
          <div className="flex flex-wrap gap-3">
            {/* Primary Actions */}
            {canRetry && (
              <button
                onClick={onRetry}
                className={`
                  flex items-center space-x-2 px-4 py-2 rounded-lg text-white font-medium
                  transition-colors ${styles.buttonColor}
                `}
              >
                <RefreshCw size={16} />
                <span>Попробовать снова</span>
              </button>
            )}

            {isGlobalError ? (
              <button
                onClick={onReload}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <RefreshCw size={16} />
                <span>Перезагрузить страницу</span>
              </button>
            ) : (
              <button
                onClick={() => window.history.back()}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                <ArrowLeft size={16} />
                <span>Назад</span>
              </button>
            )}

            <button
              onClick={() => window.location.href = '/home'}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              <Home size={16} />
              <span>На главную</span>
            </button>

            {/* Secondary Actions */}
            <button
              onClick={handleCopyError}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
            >
              <Copy size={16} />
              <span>{copied ? 'Скопировано!' : 'Копировать детали'}</span>
            </button>

            <button
              onClick={handleReport}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
            >
              <Send size={16} />
              <span>{reported ? 'Отправлено!' : 'Сообщить об ошибке'}</span>
            </button>
          </div>

          {/* Retry Information */}
          {retryCount > 0 && (
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-200 rounded-lg">
              <div className="flex items-center space-x-2 text-yellow-800">
                <Bug size={16} />
                <span className="text-sm">
                  Попыток восстановления: {retryCount}/3
                  {!canRetry && ' (достигнут лимит)'}
                </span>
              </div>
            </div>
          )}

          {/* Help Text */}
          <div className="mt-4 text-xs text-gray-500">
            Если проблема повторяется, попробуйте очистить кэш браузера или обратитесь в поддержку с ID ошибки: {errorId}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Compact Error Fallback for Components
// ============================================================================

export const CompactErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorId,
  onRetry,
  retryCount,
  level,
  context
}) => {
  const styles = getSeverityStyles(level)
  const canRetry = retryCount < 3

  return (
    <div className={`p-4 rounded-lg border-2 ${styles.containerBg} ${styles.borderColor}`}>
      <div className="flex items-start space-x-3">
        <div className={`flex-shrink-0 ${styles.iconColor}`}>
          <AlertTriangle size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-medium ${styles.titleColor}`}>
            Ошибка {context && `в ${context}`}
          </h3>
          <p className="text-xs text-gray-600 mt-1 truncate">
            {error.message}
          </p>
          <div className="flex items-center space-x-2 mt-2">
            {canRetry && (
              <button
                onClick={onRetry}
                className={`
                  text-xs px-2 py-1 rounded text-white font-medium
                  transition-colors ${styles.buttonColor}
                `}
              >
                Повторить
              </button>
            )}
            <span className="text-xs text-gray-500">ID: {errorId}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ErrorFallbackUI