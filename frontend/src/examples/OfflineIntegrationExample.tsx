import React, { useEffect, useState } from 'react'
import { initializeOfflineSystem, useOfflineSystem, offlineSystem } from '../utils/features/offline'
import { offlineApi } from '../api/offlineSync'
import { useQueueAnalytics, useQueueHealth } from '../utils/features/offline'
import OfflineIndicator, { NetworkStatusBadge, QueueProgressBar } from '../components/OfflineIndicator'

// Example component showing complete offline system integration
export const OfflineIntegrationExample: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  
  // System hooks
  const { system, status, isInitialized: systemReady } = useOfflineSystem()
  const analytics = useQueueAnalytics()
  const health = useQueueHealth()
  
  // Example state for demo
  const [questionId, setQuestionId] = useState('example-question-1')
  const [rating, setRating] = useState(3)
  const [userSettings, setUserSettings] = useState({
    theme: 'dark',
    language: 'en',
    notifications: true
  })

  // Initialize the offline system
  useEffect(() => {
    const initSystem = async () => {
      try {
        console.log('🚀 Initializing offline system...')
        
        await initializeOfflineSystem({
          // Enable debug mode for development
          enableDebugMode: true,
          
          // Show offline indicators
          showOfflineIndicator: true,
          indicatorPosition: 'top-right',
          
          // Configure retry behavior
          maxRetries: 5,
          retryDelayMs: 2000,
          maxRetryDelayMs: 60000,
          
          // Enable auto-sync
          enableAutoSync: true,
          autoSyncIntervalMs: 30000,
          
          // Conflict resolution
          enableConflictResolution: true,
          defaultConflictStrategy: 'TIMESTAMP_WINS'
        })
        
        setIsInitialized(true)
        console.log('✅ Offline system initialized successfully')
        
      } catch (error) {
        console.error('❌ Failed to initialize offline system:', error)
        setInitError(error instanceof Error ? error.message : 'Unknown error')
      }
    }

    initSystem()
  }, [])

  // Example: Submit FSRS answer (works offline)
  const handleSubmitAnswer = async () => {
    try {
      console.log('📝 Submitting answer...', { questionId, rating })
      
      // This will work offline - operation gets queued automatically
      await offlineApi.submitAnswer({
        user_id: 'demo-user',
        question_id: parseInt(questionId),
        is_correct: rating >= 3
      })
      
      console.log('✅ Answer submitted (or queued if offline)')
      
      // Update UI optimistically - this happens immediately
      alert('Answer submitted! Check the queue status to see if it was processed immediately or queued for later.')
      
    } catch (error) {
      console.error('❌ Failed to submit answer:', error)
      alert('Failed to submit answer: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  // Example: Update user settings (works offline)
  const handleUpdateSettings = async () => {
    try {
      console.log('⚙️ Updating user settings...', userSettings)
      
      // This will work offline - operation gets queued automatically
      await offlineApi.updateUserSettings('demo-user', userSettings)
      
      console.log('✅ Settings updated (or queued if offline)')
      alert('Settings updated! Check the queue status.')
      
    } catch (error) {
      console.error('❌ Failed to update settings:', error)
      alert('Failed to update settings: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  // Example: Force sync all queued operations
  const handleForceSync = async () => {
    try {
      console.log('🔄 Forcing synchronization...')
      
      await offlineSystem.forceSync()
      console.log('✅ Synchronization completed')
      alert('Synchronization completed! Check console for details.')
      
    } catch (error) {
      console.error('❌ Synchronization failed:', error)
      alert('Synchronization failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  // Example: Clear queue
  const handleClearQueue = async () => {
    try {
      console.log('🗑️ Clearing queue...')
      
      await offlineSystem.clearQueue()
      console.log('✅ Queue cleared')
      alert('Queue cleared!')
      
    } catch (error) {
      console.error('❌ Failed to clear queue:', error)
      alert('Failed to clear queue: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  // Example: Simulate network failure for testing
  const handleSimulateOffline = () => {
    if (typeof window !== 'undefined' && (window as any).offlineDebug) {
      console.log('📡 Simulating network failure for 10 seconds...')
      ;(window as any).offlineDebug.simulateOffline(10000)
      alert('Network failure simulated for 10 seconds. Try submitting operations now!')
    } else {
      alert('Debug mode not enabled. Enable debug mode to use this feature.')
    }
  }

  // Show initialization error
  if (initError) {
    return (
      <div style={{ padding: '20px', backgroundColor: '#fee', border: '1px solid #fcc' }}>
        <h2>❌ Offline System Initialization Failed</h2>
        <p>Error: {initError}</p>
        <button onClick={() => window.location.reload()}>Reload Page</button>
      </div>
    )
  }

  // Show loading state
  if (!isInitialized || !systemReady) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>🚀 Initializing Offline System...</h2>
        <p>Please wait while the offline queue system starts up.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      {/* Offline Indicators */}
      <OfflineIndicator position="top-right" />
      
      <h1>🔄 Offline Queue System - Integration Example</h1>
      
      {/* System Status */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <h3>📊 System Status</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <div>
            <strong>Status:</strong> {status?.status || 'Unknown'}
          </div>
          <div>
            <strong>Queue Size:</strong> {analytics?.totalOperations || 0}
          </div>
          <div>
            <strong>Health:</strong> {health?.status || 'Unknown'}
          </div>
          <div>
            <strong>Network:</strong> {status?.networkStatus || 'Unknown'}
          </div>
        </div>
        
        {/* Queue Status Badge */}
        <div style={{ marginTop: '10px' }}>
          <NetworkStatusBadge />
        </div>
        
        {/* Queue Progress Bar */}
        {analytics && analytics.totalOperations > 0 && (
          <div style={{ marginTop: '10px' }}>
            <QueueProgressBar />
          </div>
        )}
      </div>

      {/* Demo Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        
        {/* FSRS Answer Submission */}
        <div style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h3>📝 Submit FSRS Answer</h3>
          <div style={{ marginBottom: '10px' }}>
            <label>
              Question ID:
              <input
                type="text"
                value={questionId}
                onChange={(e) => setQuestionId(e.target.value)}
                style={{ marginLeft: '10px', padding: '5px' }}
              />
            </label>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>
              Rating (1-4):
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                style={{ marginLeft: '10px', padding: '5px' }}
              >
                <option value={1}>1 - Again</option>
                <option value={2}>2 - Hard</option>
                <option value={3}>3 - Good</option>
                <option value={4}>4 - Easy</option>
              </select>
            </label>
          </div>
          <button
            onClick={handleSubmitAnswer}
            style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Submit Answer
          </button>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
            This will work even when offline. The operation will be queued and processed when connectivity returns.
          </p>
        </div>

        {/* User Settings Update */}
        <div style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h3>⚙️ Update User Settings</h3>
          <div style={{ marginBottom: '10px' }}>
            <label>
              <input
                type="checkbox"
                checked={userSettings.notifications}
                onChange={(e) => setUserSettings(prev => ({ ...prev, notifications: e.target.checked }))}
              />
              Enable Notifications
            </label>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>
              Theme:
              <select
                value={userSettings.theme}
                onChange={(e) => setUserSettings(prev => ({ ...prev, theme: e.target.value }))}
                style={{ marginLeft: '10px', padding: '5px' }}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto</option>
              </select>
            </label>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>
              Language:
              <select
                value={userSettings.language}
                onChange={(e) => setUserSettings(prev => ({ ...prev, language: e.target.value }))}
                style={{ marginLeft: '10px', padding: '5px' }}
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
              </select>
            </label>
          </div>
          <button
            onClick={handleUpdateSettings}
            style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Update Settings
          </button>
        </div>

        {/* Queue Management */}
        <div style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h3>🔄 Queue Management</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={handleForceSync}
              style={{ padding: '10px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Force Sync Now
            </button>
            <button
              onClick={handleClearQueue}
              style={{ padding: '10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Clear Queue
            </button>
            <button
              onClick={handleSimulateOffline}
              style={{ padding: '10px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Simulate Offline (10s)
            </button>
          </div>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
            Use these controls to test offline functionality and queue management.
          </p>
        </div>

        {/* Debug Information */}
        <div style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h3>🐛 Debug Information</h3>
          <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
            <div><strong>Queue Operations:</strong> {analytics?.totalOperations || 0}</div>
            <div><strong>Pending:</strong> {analytics?.pendingOperations || 0}</div>
            <div><strong>Failed:</strong> {analytics?.failedOperations || 0}</div>
            <div><strong>Success Rate:</strong> {analytics?.successRate ? `${(analytics.successRate * 100).toFixed(1)}%` : 'N/A'}</div>
            <div><strong>Last Sync:</strong> {status?.lastSync ? new Date(status.lastSync).toLocaleTimeString() : 'Never'}</div>
          </div>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
            Open browser console and use <code>window.offlineDebug</code> for more debugging tools.
          </p>
        </div>
      </div>

      {/* Instructions */}
      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#e7f3ff', borderRadius: '8px' }}>
        <h3>📋 How to Test Offline Functionality</h3>
        <ol>
          <li><strong>Simulate Offline:</strong> Click "Simulate Offline" button to test offline behavior</li>
          <li><strong>Submit Operations:</strong> Try submitting answers or updating settings while "offline"</li>
          <li><strong>Check Queue:</strong> Watch the queue status badge show pending operations</li>
          <li><strong>Wait for Sync:</strong> Operations will automatically sync when "online" again</li>
          <li><strong>Use Browser DevTools:</strong> Disable network in DevTools for real offline testing</li>
          <li><strong>Debug Console:</strong> Use <code>window.offlineDebug</code> for advanced debugging</li>
        </ol>
        
        <h4>🔧 Debug Commands (available in console when debug mode is enabled):</h4>
        <ul style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          <li><code>window.offlineDebug.getQueueState()</code> - View current queue state</li>
          <li><code>window.offlineDebug.getHealth()</code> - Check system health</li>
          <li><code>window.offlineDebug.exportQueue()</code> - Export queue data</li>
          <li><code>window.offlineDebug.clearQueue()</code> - Clear all queued operations</li>
          <li><code>window.offlineDebug.forceSync()</code> - Force immediate synchronization</li>
        </ul>
      </div>
    </div>
  )
}

export default OfflineIntegrationExample