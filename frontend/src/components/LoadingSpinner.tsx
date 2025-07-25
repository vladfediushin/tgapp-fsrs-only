// Enhanced Loading Spinner Component with different variants
import React from 'react'

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large'
  variant?: 'spinner' | 'dots' | 'pulse' | 'skeleton'
  color?: 'primary' | 'secondary' | 'accent'
  text?: string
  fullScreen?: boolean
  className?: string
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  variant = 'spinner',
  color = 'primary',
  text,
  fullScreen = false,
  className = ''
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  }

  const colorClasses = {
    primary: 'text-blue-500 border-blue-500',
    secondary: 'text-gray-500 border-gray-500',
    accent: 'text-purple-500 border-purple-500'
  }

  const renderSpinner = () => {
    switch (variant) {
      case 'spinner':
        return (
          <div
            className={`
              animate-spin rounded-full border-2 border-t-transparent
              ${sizeClasses[size]} ${colorClasses[color]}
            `}
          />
        )

      case 'dots':
        return (
          <div className="flex space-x-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`
                  rounded-full animate-pulse
                  ${size === 'small' ? 'w-2 h-2' : size === 'medium' ? 'w-3 h-3' : 'w-4 h-4'}
                  ${colorClasses[color].split(' ')[0]}
                `}
                style={{
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: '1.4s'
                }}
              />
            ))}
          </div>
        )

      case 'pulse':
        return (
          <div
            className={`
              animate-pulse rounded-full bg-current
              ${sizeClasses[size]} ${colorClasses[color].split(' ')[0]}
            `}
          />
        )

      case 'skeleton':
        return (
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2"></div>
            <div className="h-4 bg-gray-300 rounded w-5/6"></div>
          </div>
        )

      default:
        return null
    }
  }

  const content = (
    <div className={`flex flex-col items-center justify-center space-y-2 ${className}`}>
      {renderSpinner()}
      {text && (
        <p className={`text-sm ${colorClasses[color].split(' ')[0]} animate-pulse`}>
          {text}
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50">
        {content}
      </div>
    )
  }

  return content
}

export default LoadingSpinner