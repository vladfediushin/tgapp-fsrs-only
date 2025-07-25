// Performance Monitoring Dashboard Component
// Real-time performance metrics and optimization insights

import React, { useState, useEffect, useRef } from 'react'
import { usePerformanceMetrics, usePerformanceBudgets } from '../utils/core/performance'
import { getResourcePreloader } from '../utils/optimization/loading'
import { getCacheStats } from '../utils/optimization/loading'
import { shouldEnableFeature, isProductionEnvironment } from '../config/monitoring.production'

// Conditionally import development-only features
let runPerformanceTests: any = null
if (shouldEnableFeature('developmentTesting')) {
  try {
    runPerformanceTests = require('../utils/dev/performanceTesting').runPerformanceTests
  } catch (error) {
    console.warn('Development testing utilities not available')
  }
}

// ============================================================================
// Types and Interfaces
// ============================================================================

interface DashboardProps {
  isVisible: boolean
  onClose: () => void
}

interface MetricCardProps {
  title: string
  value: string | number
  unit?: string
  status: 'good' | 'warning' | 'error'
  description?: string
}

interface ChartData {
  labels: string[]
  values: number[]
}

// ============================================================================
// Utility Functions
// ============================================================================

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
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

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  unit, 
  status, 
  description 
}) => (
  <div className="performance-metric-card">
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

const SimpleChart: React.FC<{ data: ChartData; title: string }> = ({ data, title }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !data.values.length) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Simple bar chart implementation
    const width = canvas.width
    const height = canvas.height
    const padding = 40
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2
    
    ctx.clearRect(0, 0, width, height)
    
    const maxValue = Math.max(...data.values)
    const barWidth = chartWidth / data.values.length
    
    // Draw bars
    data.values.forEach((value, index) => {
      const barHeight = (value / maxValue) * chartHeight
      const x = padding + index * barWidth
      const y = height - padding - barHeight
      
      ctx.fillStyle = '#3B82F6'
      ctx.fillRect(x + 2, y, barWidth - 4, barHeight)
      
      // Draw labels
      ctx.fillStyle = '#374151'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(
        data.labels[index] || `${index + 1}`,
        x + barWidth / 2,
        height - padding + 15
      )
    })
    
    // Draw title
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(title, width / 2, 20)
    
  }, [data, title])
  
  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={200}
      className="performance-chart"
    />
  )
}

// ============================================================================
// Main Dashboard Component
// ============================================================================

const PerformanceDashboard: React.FC<DashboardProps> = ({ isVisible, onClose }) => {
  const { metrics, insights } = usePerformanceMetrics()
  const { metrics: budgetMetrics, violations, budgets } = usePerformanceBudgets()
  const [testResults, setTestResults] = useState<any>(null)
  const [isRunningTests, setIsRunningTests] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'budgets' | 'testing' | 'optimization'>('overview')

  // Run performance tests (only in development)
  const handleRunTests = async () => {
    if (!shouldEnableFeature('developmentTesting') || !runPerformanceTests) {
      console.warn('Performance testing is not available in this environment')
      return
    }
    
    setIsRunningTests(true)
    try {
      const results = await runPerformanceTests()
      setTestResults(results)
    } catch (error) {
      console.error('Performance tests failed:', error)
    } finally {
      setIsRunningTests(false)
    }
  }

  // Get additional stats
  const [resourceStats, setResourceStats] = useState<any>(null)
  const [cacheStats, setCacheStats] = useState<any>(null)

  useEffect(() => {
    if (isVisible) {
      const preloader = getResourcePreloader()
      if (preloader) {
        setResourceStats(preloader.getStats())
      }
      setCacheStats(getCacheStats())
    }
  }, [isVisible])

  if (!isVisible) return null

  return (
    <div className="performance-dashboard-overlay">
      <div className="performance-dashboard">
        {/* Header */}
        <div className="dashboard-header">
          <h2>Performance Dashboard</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        {/* Tabs */}
        <div className="dashboard-tabs">
          {(['overview', 'budgets', 'testing', 'optimization'] as const).map(tab => (
            <button
              key={tab}
              className={`tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="dashboard-content">
          {activeTab === 'overview' && (
            <div className="overview-tab">
              <div className="metrics-grid">
                <MetricCard
                  title="Performance Score"
                  value={budgetMetrics?.performanceScore || 0}
                  unit="/100"
                  status={
                    (budgetMetrics?.performanceScore || 0) >= 85 ? 'good' :
                    (budgetMetrics?.performanceScore || 0) >= 70 ? 'warning' : 'error'
                  }
                  description="Overall performance rating"
                />
                
                <MetricCard
                  title="Bundle Size"
                  value={formatBytes(budgetMetrics?.bundleSize || 0)}
                  status={
                    (budgetMetrics?.bundleSize || 0) <= 150 * 1024 ? 'good' :
                    (budgetMetrics?.bundleSize || 0) <= 200 * 1024 ? 'warning' : 'error'
                  }
                  description="Total JavaScript bundle size"
                />
                
                <MetricCard
                  title="Initial Load Time"
                  value={formatTime(metrics?.initialLoadTime || 0)}
                  status={
                    (metrics?.initialLoadTime || 0) <= 1200 ? 'good' :
                    (metrics?.initialLoadTime || 0) <= 2000 ? 'warning' : 'error'
                  }
                  description="Time to load initial page"
                />
                
                <MetricCard
                  title="First Contentful Paint"
                  value={formatTime(budgetMetrics?.fcp || 0)}
                  status={
                    (budgetMetrics?.fcp || 0) <= 1800 ? 'good' :
                    (budgetMetrics?.fcp || 0) <= 3000 ? 'warning' : 'error'
                  }
                  description="Time to first content render"
                />
                
                <MetricCard
                  title="Largest Contentful Paint"
                  value={formatTime(budgetMetrics?.lcp || 0)}
                  status={
                    (budgetMetrics?.lcp || 0) <= 2000 ? 'good' :
                    (budgetMetrics?.lcp || 0) <= 4000 ? 'warning' : 'error'
                  }
                  description="Time to largest content render"
                />
                
                <MetricCard
                  title="Cache Hit Rate"
                  value={resourceStats ? `${((resourceStats.byStatus?.loaded || 0) / (resourceStats.totalHints || 1) * 100).toFixed(1)}` : '0'}
                  unit="%"
                  status={
                    resourceStats && (resourceStats.byStatus?.loaded || 0) / (resourceStats.totalHints || 1) >= 0.8 ? 'good' :
                    resourceStats && (resourceStats.byStatus?.loaded || 0) / (resourceStats.totalHints || 1) >= 0.6 ? 'warning' : 'error'
                  }
                  description="Resource cache effectiveness"
                />
              </div>

              {/* Charts */}
              <div className="charts-section">
                <div className="chart-container">
                  <SimpleChart
                    title="Route Load Times"
                    data={{
                      labels: Object.keys(metrics?.routeLoadTimes || {}),
                      values: Object.values(metrics?.routeLoadTimes || {})
                    }}
                  />
                </div>
                
                <div className="chart-container">
                  <SimpleChart
                    title="Chunk Sizes"
                    data={{
                      labels: Object.keys(budgetMetrics?.chunkSizes || {}).map(path => 
                        path.split('/').pop()?.replace('.js', '') || 'chunk'
                      ),
                      values: Object.values(budgetMetrics?.chunkSizes || {})
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'budgets' && (
            <div className="budgets-tab">
              <div className="budget-summary">
                <h3>Performance Budgets</h3>
                <div className="budget-score">
                  Budget Compliance: {budgetMetrics?.budgetScore || 0}/100
                </div>
              </div>

              <div className="budget-items">
                {budgets && Object.entries(budgets).map(([key, value]) => (
                  <div key={key} className="budget-item">
                    <div className="budget-name">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</div>
                    <div className="budget-value">
                      {typeof value === 'number' ? 
                        (key.includes('Size') ? formatBytes(value) : 
                         key.includes('Time') ? formatTime(value) : value) 
                        : value}
                    </div>
                  </div>
                ))}
              </div>

              {violations && violations.length > 0 && (
                <div className="violations-section">
                  <h3>Recent Violations</h3>
                  {violations.slice(-5).map((violation, index) => (
                    <div key={index} className={`violation ${violation.severity}`}>
                      <div className="violation-metric">{violation.metric}</div>
                      <div className="violation-details">
                        Actual: {violation.actual} | Budget: {violation.budget}
                      </div>
                      <div className="violation-time">
                        {new Date(violation.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'testing' && (
            <div className="testing-tab">
              <div className="testing-controls">
                <button 
                  onClick={handleRunTests}
                  disabled={isRunningTests}
                  className="run-tests-button"
                >
                  {isRunningTests ? 'Running Tests...' : 'Run Performance Tests'}
                </button>
              </div>

              {testResults && (
                <div className="test-results">
                  <div className="test-summary">
                    <h3>Test Results</h3>
                    <div className="summary-stats">
                      {testResults.testResults.map((suite: any) => (
                        <div key={suite.suiteName} className="suite-summary">
                          <div className="suite-name">{suite.suiteName}</div>
                          <div className="suite-stats">
                            {suite.passedTests}/{suite.passedTests + suite.failedTests} passed
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bundle-analysis">
                    <h3>Bundle Analysis</h3>
                    <div className="analysis-metrics">
                      <div>Total Size: {formatBytes(testResults.bundleAnalysis.totalSize)}</div>
                      <div>Compression Ratio: {(testResults.bundleAnalysis.compressionRatio * 100).toFixed(1)}%</div>
                      <div>Tree Shaking: {(testResults.bundleAnalysis.treeShakingEffectiveness * 100).toFixed(1)}%</div>
                    </div>
                  </div>

                  {testResults.recommendations.length > 0 && (
                    <div className="recommendations">
                      <h3>Recommendations</h3>
                      {testResults.recommendations.map((rec: string, index: number) => (
                        <div key={index} className="recommendation">
                          {rec}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'optimization' && (
            <div className="optimization-tab">
              <div className="optimization-insights">
                <h3>Optimization Insights</h3>
                {insights && (
                  <div className="insights-grid">
                    <div className="insight-card">
                      <h4>Load Time</h4>
                      <div className={`status ${insights.metrics.loadTime}`}>
                        {insights.metrics.loadTime}
                      </div>
                    </div>
                    
                    <div className="insight-card">
                      <h4>Bundle Size</h4>
                      <div className={`status ${insights.metrics.bundleSize}`}>
                        {insights.metrics.bundleSize}
                      </div>
                    </div>
                    
                    <div className="insight-card">
                      <h4>Code Splitting</h4>
                      <div className={`status ${insights.metrics.codeSplitting}`}>
                        {insights.metrics.codeSplitting}
                      </div>
                    </div>
                    
                    <div className="insight-card">
                      <h4>Caching</h4>
                      <div className={`status ${insights.metrics.caching}`}>
                        {insights.metrics.caching}
                      </div>
                    </div>
                  </div>
                )}

                {insights?.recommendations && insights.recommendations.length > 0 && (
                  <div className="recommendations">
                    <h4>Recommendations</h4>
                    {insights.recommendations.map((rec, index) => (
                      <div key={index} className="recommendation">
                        {rec}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="cache-stats">
                <h3>Dynamic Import Cache</h3>
                {cacheStats && (
                  <div className="cache-metrics">
                    <div>Total Entries: {cacheStats.totalEntries}</div>
                    <div>Successful: {cacheStats.successfulImports}</div>
                    <div>Failed: {cacheStats.failedImports}</div>
                    <div>Pending: {cacheStats.pendingImports}</div>
                    <div>Cache Size: {formatBytes(cacheStats.cacheSize)}</div>
                  </div>
                )}
              </div>

              <div className="resource-preloader-stats">
                <h3>Resource Preloader</h3>
                {resourceStats && (
                  <div className="preloader-metrics">
                    <div>Total Hints: {resourceStats.totalHints}</div>
                    <div>Preloads: {resourceStats.byType?.preload || 0}</div>
                    <div>Prefetches: {resourceStats.byType?.prefetch || 0}</div>
                    <div>Preconnects: {resourceStats.byType?.preconnect || 0}</div>
                    <div>Memory Usage: {formatBytes(resourceStats.memoryUsage)}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .performance-dashboard-overlay {
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

        .performance-dashboard {
          background: white;
          border-radius: 8px;
          width: 90vw;
          height: 90vh;
          max-width: 1200px;
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
        }

        .close-button {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.5rem;
        }

        .dashboard-tabs {
          display: flex;
          border-bottom: 1px solid #e5e7eb;
        }

        .tab {
          padding: 0.75rem 1rem;
          border: none;
          background: none;
          cursor: pointer;
          border-bottom: 2px solid transparent;
        }

        .tab.active {
          border-bottom-color: #3b82f6;
          color: #3b82f6;
        }

        .dashboard-content {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .performance-metric-card {
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

        .charts-section {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
        }

        .chart-container {
          background: #f9fafb;
          border-radius: 6px;
          padding: 1rem;
          border: 1px solid #e5e7eb;
        }

        .performance-chart {
          width: 100%;
          height: auto;
        }

        .budget-summary {
          margin-bottom: 2rem;
        }

        .budget-score {
          font-size: 1.25rem;
          font-weight: bold;
          color: #3b82f6;
        }

        .budget-items {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .budget-item {
          background: #f9fafb;
          border-radius: 6px;
          padding: 1rem;
          border: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .budget-name {
          font-weight: 500;
          text-transform: capitalize;
        }

        .budget-value {
          font-weight: bold;
          color: #3b82f6;
        }

        .violations-section {
          margin-top: 2rem;
        }

        .violation {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          padding: 1rem;
          margin-bottom: 0.5rem;
        }

        .violation.warning {
          background: #fffbeb;
          border-color: #fed7aa;
        }

        .violation.critical {
          background: #fef2f2;
          border-color: #fca5a5;
        }

        .testing-controls {
          margin-bottom: 2rem;
        }

        .run-tests-button {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
        }

        .run-tests-button:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .test-results {
          space-y: 2rem;
        }

        .test-summary, .bundle-analysis, .recommendations {
          background: #f9fafb;
          border-radius: 6px;
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .insights-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .insight-card {
          background: #f9fafb;
          border-radius: 6px;
          padding: 1rem;
          text-align: center;
        }

        .status.good { color: #10b981; }
        .status.needs-improvement { color: #f59e0b; }
        .status.poor { color: #ef4444; }

        .cache-stats, .resource-preloader-stats {
          background: #f9fafb;
          border-radius: 6px;
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .cache-metrics, .preloader-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 0.5rem;
        }
      `}</style>
    </div>
  )
}

export default PerformanceDashboard