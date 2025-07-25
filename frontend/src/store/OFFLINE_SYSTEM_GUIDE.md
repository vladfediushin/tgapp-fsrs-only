# Offline Queue System - Complete Guide

## Overview

The Offline Queue System is a comprehensive solution for handling API operations when users are offline or have poor connectivity. It provides persistent storage, automatic retry logic, optimistic updates, conflict resolution, and seamless integration with the existing unified store.

## Architecture

### Core Components

1. **Offline Queue Store** (`offlineQueue.ts`)
   - Zustand-based state management with persistence
   - IndexedDB storage for persistent queue operations
   - Network connectivity monitoring
   - Exponential backoff retry logic

2. **Offline Sync Service** (`offlineSync.ts`)
   - Integration layer between queue and existing API
   - Operation handlers for different API call types
   - Optimistic update service
   - Background synchronization

3. **Conflict Resolution** (`conflictResolution.ts`)
   - Multiple resolution strategies
   - Priority-based resolver chain
   - Built-in resolvers for common data types

4. **Queue Management** (`queueManagement.ts`)
   - Analytics and health monitoring
   - Export/import utilities
   - Debugging tools and React hooks

5. **System Manager** (`offlineSystem.ts`)
   - Main initialization and configuration
   - System health monitoring
   - Auto-recovery mechanisms

6. **UI Components** (`OfflineIndicator.tsx`)
   - Visual indicators for offline status
   - Queue progress display
   - Interactive queue management

## Quick Start

### 1. Initialize the System

```typescript
import { initializeOfflineSystem } from '../utils/offlineSystem'

// Initialize with default configuration
const system = await initializeOfflineSystem()

// Or with custom configuration
const system = await initializeOfflineSystem({
  maxRetries: 5,
  enableDebugMode: true,
  showOfflineIndicator: true
})
```

### 2. Use Offline-Capable API Functions

```typescript
import { offlineCapableApi } from '../api/offlineSync'

// These functions automatically queue operations when offline
await offlineCapableApi.submitAnswer(questionId, rating, reviewTime)
await offlineCapableApi.updateUserSettings(settings)
await offlineCapableApi.updateExamSettings(examId, settings)
```

### 3. Add UI Indicators

```tsx
import { OfflineIndicator, QueueStatusBadge } from '../components/OfflineIndicator'

function App() {
  return (
    <div>
      <OfflineIndicator position="top-right" />
      <QueueStatusBadge />
      {/* Your app content */}
    </div>
  )
}
```

## Configuration Options

```typescript
interface OfflineSystemConfig {
  // Queue settings
  maxRetries: number                    // Default: 3
  retryDelayMs: number                 // Default: 1000
  maxRetryDelayMs: number              // Default: 30000
  batchSize: number                    // Default: 5
  syncIntervalMs: number               // Default: 30000
  networkCheckIntervalMs: number       // Default: 10000
  
  // Auto-sync settings
  enableAutoSync: boolean              // Default: true
  autoSyncIntervalMs: number           // Default: 30000
  
  // Conflict resolution
  enableConflictResolution: boolean    // Default: true
  defaultConflictStrategy: string      // Default: 'TIMESTAMP_WINS'
  
  // UI settings
  showOfflineIndicator: boolean        // Default: true
  indicatorPosition: string            // Default: 'top-right'
  
  // Debug settings
  enableDebugMode: boolean             // Default: false
  logLevel: string                     // Default: 'info'
}
```

## API Reference

### Core System

```typescript
import { offlineSystem } from '../utils/offlineSystem'

// Initialize system
await offlineSystem.initialize(config)

// Get system instance
const system = offlineSystem.get()

// Force synchronization
await offlineSystem.forceSync()

// Clear queue
await offlineSystem.clearQueue()

// Get system status
const status = await offlineSystem.getStatus()

// Enable debug mode
offlineSystem.enableDebugMode()

// Shutdown system
await offlineSystem.shutdown()
```

### Queue Management

```typescript
import { queueManagement } from '../utils/queueManagement'

// Analytics
const analytics = queueManagement.analyzer.analyzeQueue()
const health = queueManagement.analyzer.assessQueueHealth()

// Export/Import
await queueManagement.exporter.downloadExport('json')
await queueManagement.importer.importFromFile(file)

// Debugging
queueManagement.debugger.logQueueState()
queueManagement.debugger.simulateNetworkFailure(5000)
queueManagement.debugger.createTestOperations(10)
```

### React Hooks

```typescript
import { useOfflineSystem } from '../utils/offlineSystem'
import { useQueueManagement } from '../utils/queueManagement'

function MyComponent() {
  const { system, status, isInitialized } = useOfflineSystem()
  const { analytics, health, operations } = useQueueManagement()
  
  return (
    <div>
      <p>System Status: {status?.status}</p>
      <p>Queue Size: {analytics?.totalOperations}</p>
      <p>Health: {health?.status}</p>
    </div>
  )
}
```

## Operation Types

The system supports these operation types:

- `SUBMIT_ANSWER` - Submit FSRS rating for a question
- `UPDATE_USER_SETTINGS` - Update user preferences
- `UPDATE_EXAM_SETTINGS` - Update exam configuration
- `SYNC_PROGRESS` - Synchronize learning progress
- `CUSTOM` - Custom operations with user-defined handlers

## Conflict Resolution

### Built-in Strategies

1. **SERVER_WINS** - Server data takes precedence
2. **CLIENT_WINS** - Client data takes precedence
3. **MERGE** - Attempt to merge both datasets
4. **TIMESTAMP_WINS** - Most recent data wins

### Custom Resolvers

```typescript
import { conflictManager } from '../utils/conflictResolution'

// Register custom resolver
conflictManager.registerResolver('MY_DATA_TYPE', (serverData, clientData, context) => {
  // Custom resolution logic
  return resolvedData
})

// Set resolver priority
conflictManager.setResolverPriority('MY_DATA_TYPE', 1)
```

## Debugging

### Debug Mode

When debug mode is enabled, global debugging functions are available:

```javascript
// Available in browser console when debugMode is enabled
window.offlineDebug.getQueueState()
window.offlineDebug.clearQueue()
window.offlineDebug.retryAll()
window.offlineDebug.getHealth()
window.offlineDebug.exportQueue()
```

### Health Monitoring

The system continuously monitors queue health and provides:

- Queue size warnings
- Error rate monitoring
- Network connectivity status
- Auto-recovery mechanisms

## Best Practices

### 1. Initialize Early

Initialize the offline system as early as possible in your app lifecycle:

```typescript
// In your main App component or index file
useEffect(() => {
  initializeOfflineSystem({
    enableDebugMode: process.env.NODE_ENV === 'development'
  })
}, [])
```

### 2. Handle Optimistic Updates

Use optimistic updates for better user experience:

```typescript
// The system automatically handles optimistic updates
// Just call the offline-capable API functions normally
await offlineCapableApi.submitAnswer(questionId, rating, reviewTime)
// UI updates immediately, syncs when online
```

### 3. Monitor System Health

Use the provided hooks to monitor system health:

```typescript
function SystemMonitor() {
  const { analytics, health } = useQueueManagement()
  
  if (health?.status === 'CRITICAL') {
    return <Alert>System needs attention</Alert>
  }
  
  return <div>Queue: {analytics?.totalOperations} operations</div>
}
```

### 4. Handle Conflicts Gracefully

Register custom conflict resolvers for your data types:

```typescript
// Register early in app lifecycle
conflictManager.registerResolver('USER_PROGRESS', (server, client) => {
  // Merge progress data intelligently
  return {
    ...server,
    ...client,
    lastUpdated: Math.max(server.lastUpdated, client.lastUpdated)
  }
})
```

## Troubleshooting

### Common Issues

1. **Queue Not Processing**
   - Check network connectivity
   - Verify system initialization
   - Check for critical errors in health status

2. **High Memory Usage**
   - Monitor queue size
   - Enable auto-cleanup
   - Reduce batch size if needed

3. **Conflicts Not Resolving**
   - Verify conflict resolution is enabled
   - Check resolver registration
   - Review conflict resolution logs

### Debug Commands

```javascript
// Check system status
await window.offlineDebug.getHealth()

// View queue contents
window.offlineDebug.getQueueState()

// Force synchronization
await window.offlineDebug.forceSync()

// Export queue for analysis
await window.offlineDebug.exportQueue()
```

## Performance Considerations

- **IndexedDB Operations**: Asynchronous and non-blocking
- **Memory Usage**: Queue operations are persisted to disk
- **Network Efficiency**: Batched operations reduce API calls
- **Background Processing**: Sync happens in background threads

## Security Considerations

- **Data Encryption**: Consider encrypting sensitive queue data
- **Authentication**: Ensure tokens are refreshed during sync
- **Data Validation**: Validate all data before processing
- **Error Handling**: Don't expose sensitive information in errors

## Migration Guide

If upgrading from a previous version:

1. **Backup existing data** before upgrading
2. **Update imports** to use new API functions
3. **Review configuration** for new options
4. **Test offline functionality** thoroughly
5. **Update UI components** to use new indicators

## Support

For issues or questions:

1. Check the debug console for error messages
2. Export queue data for analysis
3. Review system health status
4. Check network connectivity
5. Verify system initialization

The offline queue system is designed to be robust and self-healing, but monitoring and proper configuration are key to optimal performance.