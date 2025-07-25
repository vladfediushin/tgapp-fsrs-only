// Offline Status Indicator Component
// Shows network connectivity status and offline queue information

import React, { useState, useEffect } from 'react'
import { useOfflineQueue, useQueueStatus, useQueueStats, useQueueErrors } from '../store/offlineQueue'

// ============================================================================
// Types and Interfaces
// ============================================================================

interface OfflineIndicatorProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  showDetails?: boolean
  className?: string
}

interface NetworkStatusIconProps {
  status: 'ONLINE' | 'OFFLINE' | 'POOR'
  size?: number
}

interface QueueStatusProps {
  queueSize: number
  status: 'IDLE' | 'SYNCING' | 'PAUSED' | 'ERROR'
  lastSync: number | null
}

// ============================================================================
// Network Status Icon Component
// ============================================================================

const NetworkStatusIcon: React.FC<NetworkStatusIconProps> = ({ status, size = 20 }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'ONLINE': return '#10B981' // green
      case 'POOR': return '#F59E0B'   // yellow
      case 'OFFLINE': return '#EF4444' // red
      default: return '#6B7280'       // gray
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'ONLINE':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
              fill={getStatusColor()}
            />
          </svg>
        )
      case 'POOR':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
              fill={getStatusColor()}
            />
          </svg>
        )
      case 'OFFLINE':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"
              fill={getStatusColor()}
            />
          </svg>
        )
      default:
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill={getStatusColor()} />
          </svg>
        )
    }
  }

  return (
    <div className="flex items-center justify-center" title={`Network: ${status}`}>
      {getStatusIcon()}
    </div>
  )
}

// ============================================================================
// Queue Status Component
// ============================================================================

const QueueStatus: React.FC<QueueStatusProps> = ({ queueSize, status, lastSync }) => {
  const getStatusText = () => {
    if (queueSize === 0) return 'All synced'
    
    switch (status) {
      case 'SYNCING': return `Syncing ${queueSize} items...`
      case 'PAUSED': return `${queueSize} items paused`
      case 'ERROR': return `${queueSize} items failed`
      case 'IDLE': return `${queueSize} items queued`
      default: return `${queueSize} items`
    }
  }

  const getStatusColor = () => {
    if (queueSize === 0) return 'text-green-600'
    
    switch (status) {
      case 'SYNCING': return 'text-blue-600'
      case 'PAUSED': return 'text-yellow-600'
      case 'ERROR': return 'text-red-600'
      case 'IDLE': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  const formatLastSync = () => {
    if (!lastSync) return 'Never synced'
    
    const now = Date.now()
    const diff = now - lastSync
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return `${Math.floor(diff / 86400000)}d ago`
  }

  return (
    <div className="text-xs">
      <div className={`font-medium ${getStatusColor()}`}>
        {getStatusText()}
      </div>
      {lastSync && (
        <div className="text-gray-500 mt-1">
          Last sync: {formatLastSync()}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Main Offline Indicator Component
// ============================================================================

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  position = 'top-right',
  showDetails = false,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  
  const queueStatus = useQueueStatus()
  const queueStats = useQueueStats()
  const queueErrors = useQueueErrors()

  // Auto-expand when there are errors or items in queue
  useEffect(() => {
    if (queueErrors.length > 0 || queueStatus.queueSize > 0) {
      setIsExpanded(true)
      
      // Auto-collapse after 5 seconds if no errors
      if (queueErrors.length === 0) {
        const timer = setTimeout(() => setIsExpanded(false), 5000)
        return () => clearTimeout(timer)
      }
    }
  }, [queueErrors.length, queueStatus.queueSize])

  const getPositionClasses = () => {
    const base = 'fixed z-50'
    switch (position) {
      case 'top-left': return `${base} top-4 left-4`
      case 'top-right': return `${base} top-4 right-4`
      case 'bottom-left': return `${base} bottom-4 left-4`
      case 'bottom-right': return `${base} bottom-4 right-4`
      default: return `${base} top-4 right-4`
    }
  }

  const handleRetryAll = async () => {
    const queueActions = useOfflineQueue.getState()
    await queueActions.retryFailedOperations()
  }

  const handleClearErrors = () => {
    const queueActions = useOfflineQueue.getState()
    queueActions.clearErrors()
  }

  const handleForceSync = async () => {
    const queueActions = useOfflineQueue.getState()
    await queueActions.startSync()
  }

  return (
    <div className={`${getPositionClasses()} ${className}`}>
      {/* Compact indicator */}
      <div
        className={`
          bg-white rounded-lg shadow-lg border transition-all duration-300 cursor-pointer
          ${isExpanded ? 'p-3' : 'p-2'}
          ${queueErrors.length > 0 ? 'border-red-200' : 'border-gray-200'}
        `}
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex items-center space-x-2">
          <NetworkStatusIcon status={queueStatus.networkStatus} />
          
          {queueStatus.queueSize > 0 && (
            <div className="flex items-center space-x-1">
              <div className={`
                w-2 h-2 rounded-full
                ${queueStatus.status === 'SYNCING' ? 'bg-blue-500 animate-pulse' : 
                  queueStatus.status === 'ERROR' ? 'bg-red-500' : 'bg-gray-400'}
              `} />
              <span className="text-xs font-medium text-gray-700">
                {queueStatus.queueSize}
              </span>
            </div>
          )}
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-3 space-y-3 min-w-[200px]">
            <QueueStatus
              queueSize={queueStatus.queueSize}
              status={queueStatus.status}
              lastSync={queueStatus.lastSync}
            />

            {/* Statistics */}
            {showDetails && (
              <div className="text-xs text-gray-500 space-y-1">
                <div>Total operations: {queueStats.totalOperations}</div>
                <div>Success rate: {
                  queueStats.totalOperations > 0 
                    ? Math.round((queueStats.successfulOperations / queueStats.totalOperations) * 100)
                    : 0
                }%</div>
              </div>
            )}

            {/* Error list */}
            {queueErrors.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-red-600">
                  Recent Errors ({queueErrors.length})
                </div>
                <div className="max-h-20 overflow-y-auto space-y-1">
                  {queueErrors.slice(-3).map((error, index) => (
                    <div key={index} className="text-xs text-red-500 bg-red-50 p-1 rounded">
                      {error.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex space-x-2">
              {queueStatus.queueSize > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleForceSync()
                  }}
                  className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition-colors"
                  disabled={queueStatus.status === 'SYNCING'}
                >
                  {queueStatus.status === 'SYNCING' ? 'Syncing...' : 'Sync Now'}
                </button>
              )}
              
              {queueErrors.length > 0 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRetryAll()
                    }}
                    className="text-xs bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600 transition-colors"
                  >
                    Retry All
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleClearErrors()
                    }}
                    className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600 transition-colors"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tooltip for compact mode */}
      {showTooltip && !isExpanded && (
        <div className="absolute top-full mt-2 right-0 bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap">
          {queueStatus.networkStatus} • {queueStatus.queueSize} queued
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Simple Network Status Badge
// ============================================================================

export const NetworkStatusBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { networkStatus } = useQueueStatus()
  
  const getStatusText = () => {
    switch (networkStatus) {
      case 'ONLINE': return 'Online'
      case 'POOR': return 'Poor Connection'
      case 'OFFLINE': return 'Offline'
      default: return 'Unknown'
    }
  }

  const getStatusClasses = () => {
    switch (networkStatus) {
      case 'ONLINE': return 'bg-green-100 text-green-800 border-green-200'
      case 'POOR': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'OFFLINE': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className={`
      inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border
      ${getStatusClasses()} ${className}
    `}>
      <NetworkStatusIcon status={networkStatus} size={12} />
      <span>{getStatusText()}</span>
    </div>
  )
}

// ============================================================================
// Queue Progress Bar
// ============================================================================

export const QueueProgressBar: React.FC<{ className?: string }> = ({ className = '' }) => {
  const queueStats = useQueueStats()
  const { queueSize, status } = useQueueStatus()
  
  if (queueSize === 0 && queueStats.totalOperations === 0) {
    return null
  }

  const progress = queueStats.totalOperations > 0 
    ? (queueStats.successfulOperations / queueStats.totalOperations) * 100 
    : 0

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex justify-between text-xs text-gray-600">
        <span>Sync Progress</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`
            h-2 rounded-full transition-all duration-300
            ${status === 'SYNCING' ? 'bg-blue-500' : 
              status === 'ERROR' ? 'bg-red-500' : 'bg-green-500'}
          `}
          style={{ width: `${progress}%` }}
        />
      </div>
      {queueSize > 0 && (
        <div className="text-xs text-gray-500">
          {queueSize} items remaining
        </div>
      )}
    </div>
  )
}

export default OfflineIndicator