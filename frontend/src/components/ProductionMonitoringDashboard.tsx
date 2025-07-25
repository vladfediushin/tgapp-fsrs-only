/**
 * Production Monitoring Dashboard
 * Lightweight monitoring dashboard optimized for production use
 */

import React, { useState, useEffect } from 'react'
import { productionMonitoringCoordinator } from '../services/productionMonitoringInit'
import { useProductionAnalytics } from '../services/productionAnalytics'
import { useProductionPerformanceMonitor } from '../services/productionPerformanceMonitor'
import { isProductionEnvironment, shouldEnableFeature } from '../config/monitoring.production'

// ============================================================================
// Types and Interfaces
// ============================================================================

interface DashboardProps {
  isVisible: boolean
  onClose: () => void
}

interface MonitoringStatus {
  initialized: boolean
  environment: string
  services: Record<string, boolean>
  config: any
}

interface MetricCardProps {
  title: string
  value: string | number
  unit?: string
  status: 'good' | 'warning' | 'error'
  description?: string
}

// ============================================================================
// Utility Functions
// ============================================================================

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

const formatTime = (ms: number): string => {
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const getStatusColor = (status: 'good' | 'warning' | 'error'): string => {
  switch (status) {
    case 'good': return '#10B981'
    case 'warning': return '#F59E0B'
    case 'error': return '#EF4444'
    default: return '#6B7280'
  }
}

// ============================================================================
// Components
// ============================================================================

const MetricCard = ({
  title,
  value,
  unit,
  status,
  description
}: MetricCardProps) => (
  <div className="metric-card">
    <div className="metric-header">
      <h3>{title}</h3>
      <div 
        className="status-indicator"
        style={{ backgroundColor: getStatusColor(status) }}
      />
    </div>
    <div className="metric-value">
      {value}{unit && <span className="unit">{unit}</span>}
    </div>
    {description && (
      <div className="metric-description">{description}</div>
    )}
  </div>
)

const ServiceStatus = ({ services }: { services: Record<string, boolean> }) => (
  <div className="service-status">
    <h3>Service Status</h3>
    <div className="services-grid">
      {Object.entries(services).map(([service, enabled]) => (
        <div key={service} className="service-item">
          <div 
            className="service-indicator"
            style={{ backgroundColor: enabled ? '#10B981' : '#EF4444' }}
          />
          <span className="service-name">{service.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
        </div>
      ))}
    </div>
  </div>
)

// ============================================================================
// Main Dashboard Component
// ============================================================================

const ProductionMonitoringDashboard = ({ isVisible, onClose }: DashboardProps) => {
  const [monitoringStatus, setMonitoringStatus] = useState(null as MonitoringStatus | null)
  const [performanceSummary, setPerformanceSummary] = useState(null as any)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null as string | null)

  const analytics = useProductionAnalytics()
  const performanceMonitor = useProductionPerformanceMonitor()

  // ============================================================================
  // Data Loading
  // ============================================================================

  useEffect(() => {
    if (isVisible) {
      loadMonitoringData()
      const interval = setInterval(loadMonitoringData, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
  }, [isVisible])

  const loadMonitoringData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get monitoring status
      const status = await productionMonitoringCoordinator.getStatus()
      setMonitoringStatus(status)

      // Get performance summary
      const summary = performanceMonitor.getCurrentSummary()
      setPerformanceSummary(summary)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monitoring data')
      console.error('Failed to load monitoring data:', err)
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleClearMetrics = () => {
    performanceMonitor.monitor.clearMetrics()
    analytics.trackUserAction('clear_metrics', 'monitoring_dashboard')
    loadMonitoringData()
  }

  const handleExportData = () => {
    const data = {
      timestamp: new Date().toISOString(),
      environment: monitoringStatus?.environment,
      performanceSummary,
      monitoringStatus
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `monitoring-data-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    
    analytics.trackUserAction('export_data', 'monitoring_dashboard')
  }

  // ============================================================================
  // Render
  // ============================================================================

  if (!isVisible) return null

  // Don't show dashboard in production unless explicitly enabled
  if (isProductionEnvironment() && !shouldEnableFeature('performanceDashboard')) {
    return (
      <div className="dashboard-overlay">
        <div className="dashboard-container">
          <div className="dashboard-header">
            <h2>Monitoring Dashboard</h2>
            <button onClick={onClose} className="close-button">×</button>
          </div>
          <div className="dashboard-content">
            <div className="production-notice">
              <h3>🔒 Production Environment</h3>
              <p>Monitoring dashboard is disabled in production for security and performance reasons.</p>
              <p>Monitoring services are running in the background and collecting essential metrics.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-overlay">
      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header">
          <h2>Production Monitoring Dashboard</h2>
          <div className="header-actions">
            <button onClick={handleExportData} className="action-button">
              Export Data
            </button>
            <button onClick={handleClearMetrics} className="action-button">
              Clear Metrics
            </button>
            <button onClick={onClose} className="close-button">×</button>
          </div>
        </div>

        {/* Content */}
        <div className="dashboard-content">
          {loading && (
            <div className="loading-state">
              <div className="spinner" />
              <p>Loading monitoring data...</p>
            </div>
          )}

          {error && (
            <div className="error-state">
              <h3>⚠️ Error Loading Data</h3>
              <p>{error}</p>
              <button onClick={loadMonitoringData} className="retry-button">
                Retry
              </button>
            </div>
          )}

          {!loading && !error && monitoringStatus && (
            <>
              {/* Environment Info */}
              <div className="environment-info">
                <h3>Environment: {monitoringStatus.environment}</h3>
                <p>Monitoring Status: {monitoringStatus.initialized ? '✅ Active' : '❌ Inactive'}</p>
              </div>

              {/* Service Status */}
              <ServiceStatus services={monitoringStatus.services} />

              {/* Performance Metrics */}
              {performanceSummary && (
                <div className="metrics-section">
                  <h3>Performance Metrics</h3>
                  <div className="metrics-grid">
                    <MetricCard
                      title="Total Metrics"
                      value={formatNumber(performanceSummary.totalMetrics)}
                      status="good"
                      description="Metrics collected in current session"
                    />
                    
                    <MetricCard
                      title="Average Response Time"
                      value={formatTime(performanceSummary.averageResponseTime)}
                      status={
                        performanceSummary.averageResponseTime < 1000 ? 'good' :
                        performanceSummary.averageResponseTime < 3000 ? 'warning' : 'error'
                      }
                      description="Average API response time"
                    />
                    
                    <MetricCard
                      title="Error Rate"
                      value={(performanceSummary.errorRate * 100).toFixed(1)}
                      unit="%"
                      status={
                        performanceSummary.errorRate < 0.01 ? 'good' :
                        performanceSummary.errorRate < 0.05 ? 'warning' : 'error'
                      }
                      description="Percentage of failed operations"
                    />
                    
                    <MetricCard
                      title="Slow Operations"
                      value={performanceSummary.slowOperations}
                      status={
                        performanceSummary.slowOperations === 0 ? 'good' :
                        performanceSummary.slowOperations < 5 ? 'warning' : 'error'
                      }
                      description="Operations exceeding thresholds"
                    />

                    {performanceSummary.memoryUsage && (
                      <MetricCard
                        title="Memory Usage"
                        value={`${(performanceSummary.memoryUsage / 1024 / 1024).toFixed(1)}`}
                        unit="MB"
                        status={
                          performanceSummary.memoryUsage < 50 * 1024 * 1024 ? 'good' :
                          performanceSummary.memoryUsage < 100 * 1024 * 1024 ? 'warning' : 'error'
                        }
                        description="Current memory usage"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Configuration Summary */}
              <div className="config-section">
                <h3>Configuration</h3>
                <div className="config-grid">
                  {Object.entries(monitoringStatus.config).map(([key, value]) => (
                    <div key={key} className="config-item">
                      <span className="config-key">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}:</span>
                      <span className="config-value">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Styles */}
        <style jsx>{`
          .dashboard-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .dashboard-container {
            background: white;
            border-radius: 8px;
            width: 90vw;
            height: 90vh;
            max-width: 1000px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .dashboard-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            border-bottom: 1px solid #e5e7eb;
            background: #f9fafb;
          }

          .header-actions {
            display: flex;
            gap: 0.5rem;
            align-items: center;
          }

          .action-button {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.875rem;
          }

          .close-button {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0.5rem;
          }

          .dashboard-content {
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
          }

          .loading-state, .error-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 200px;
            text-align: center;
          }

          .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid #f3f4f6;
            border-top: 3px solid #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 1rem;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          .retry-button {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 1rem;
          }

          .production-notice {
            text-align: center;
            padding: 2rem;
            background: #f9fafb;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
          }

          .environment-info {
            background: #f0f9ff;
            border: 1px solid #bae6fd;
            border-radius: 6px;
            padding: 1rem;
            margin-bottom: 1rem;
          }

          .service-status {
            margin-bottom: 2rem;
          }

          .services-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 0.5rem;
            margin-top: 0.5rem;
          }

          .service-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem;
            background: #f9fafb;
            border-radius: 4px;
          }

          .service-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
          }

          .service-name {
            text-transform: capitalize;
            font-size: 0.875rem;
          }

          .metrics-section {
            margin-bottom: 2rem;
          }

          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-top: 1rem;
          }

          .metric-card {
            background: #f9fafb;
            border-radius: 6px;
            padding: 1rem;
            border: 1px solid #e5e7eb;
          }

          .metric-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
          }

          .metric-header h3 {
            margin: 0;
            font-size: 0.875rem;
            color: #6b7280;
          }

          .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
          }

          .metric-value {
            font-size: 1.5rem;
            font-weight: bold;
            color: #111827;
          }

          .unit {
            font-size: 0.875rem;
            color: #6b7280;
            margin-left: 0.25rem;
          }

          .metric-description {
            font-size: 0.75rem;
            color: #6b7280;
            margin-top: 0.25rem;
          }

          .config-section {
            margin-bottom: 2rem;
          }

          .config-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 0.5rem;
            margin-top: 1rem;
          }

          .config-item {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem;
            background: #f9fafb;
            border-radius: 4px;
            font-size: 0.875rem;
          }

          .config-key {
            font-weight: 500;
            text-transform: capitalize;
          }

          .config-value {
            color: #3b82f6;
            font-weight: 500;
          }
        `}</style>
      </div>
    </div>
  )
}

export default ProductionMonitoringDashboard