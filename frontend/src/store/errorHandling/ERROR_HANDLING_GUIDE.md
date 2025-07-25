# Comprehensive Error Handling System Guide

## Overview

This guide covers the comprehensive error handling and recovery system implemented across the Telegram mini web application. The system provides robust error management, user-friendly recovery mechanisms, and excellent user experience even during error conditions.

## Architecture

### Core Components

1. **Global Error Boundary System** - Catches all unhandled React errors
2. **Error Recovery Manager** - Handles automatic error recovery
3. **Error Reporting Service** - Analytics and error tracking
4. **Toast Notification System** - User-friendly error notifications
5. **Error Logging System** - Development and debugging tools
6. **Graceful Degradation** - Fallback strategies for different failure scenarios

## Error Boundary System

### Global Error Boundary

```typescript
import { GlobalErrorBoundary } from './components/ErrorBoundary/GlobalErrorBoundary'

// Wrap your entire app
<GlobalErrorBoundary level="global" context="App">
  <App />
</GlobalErrorBoundary>
```

### Page-Level Error Boundaries

```typescript
import { PageErrorBoundary } from './components/ErrorBoundary/SectionErrorBoundaries'

<PageErrorBoundary pageName="Home">
  <HomePage />
</PageErrorBoundary>
```

### Component-Level Error Boundaries

```typescript
import { ComponentErrorBoundary } from './components/ErrorBoundary/SectionErrorBoundaries'

<ComponentErrorBoundary componentName="UserProfile" compact>
  <UserProfile />
</ComponentErrorBoundary>
```

### HOC Usage

```typescript
import { withErrorBoundary } from './components/ErrorBoundary/GlobalErrorBoundary'

const SafeComponent = withErrorBoundary(MyComponent, {
  level: 'component',
  context: 'UserDashboard'
})
```

## Error Recovery System

### Basic Error Handling

```typescript
import { useEnhancedErrorRecovery } from './store/errorHandling/enhancedErrorRecovery'

const { handleErrorWithRecovery, attemptRecovery } = useEnhancedErrorRecovery()

try {
  await riskyOperation()
} catch (error) {
  const errorId = handleErrorWithRecovery(error, {
    operation: 'user_data_load',
    severity: 'high',
    autoRetry: true
  })
}
```

### System-Specific Error Recovery

```typescript
import { useSystemErrorRecovery } from './store/errorHandling/enhancedErrorRecovery'

const { handleAPIError, handleUnifiedStoreError } = useSystemErrorRecovery()

// API Error Recovery
const data = await handleAPIError(error, 'user-profile', () => api.getUser(userId))

// Store Error Recovery
await handleUnifiedStoreError(error, 'loadUser', () => store.loadUser(userId))
```

### Graceful Degradation

```typescript
import { useGracefulDegradation } from './store/errorHandling/enhancedErrorRecovery'

const { useCachedDataFallback, useOfflineModeFallback } = useGracefulDegradation()

// Use cached data when API fails
const userData = useCachedDataFallback('user-profile', defaultUserData)

// Switch to offline mode
useOfflineModeFallback()
```

## Toast Notification System

### Basic Usage

```typescript
import { useErrorToast, useSuccessToast } from './components/Notifications/ToastNotification'

const { showError, showRecoveryError } = useErrorToast()
const { showRecoverySuccess } = useSuccessToast()

// Show error with retry action
showRecoveryError('Failed to load data', errorId, () => retryOperation())

// Show success after recovery
showRecoverySuccess('Data loaded successfully')
```

### Toast Provider Setup

```typescript
import { ToastProvider } from './components/Notifications/ToastNotification'

<ToastProvider position="top-right" maxToasts={5}>
  <App />
</ToastProvider>
```

## Error Logging and Debugging

### Error Logger Usage

```typescript
import { useErrorLogger } from './utils/errorLogging'

const { logError, logWarning, exportLogs } = useErrorLogger()

// Log errors with context
logError('API call failed', error, { endpoint: '/api/users', userId })

// Export logs for debugging
const debugData = exportLogs()
```

### Debug Panel (Development Only)

The system automatically creates a debug panel in development mode:
- Click the 🐛 button in the top-right corner
- View recent errors and warnings
- Monitor memory usage
- Clear logs

## Error Classification

### Error Types

- **network** - Network connectivity issues
- **storage** - LocalStorage/IndexedDB problems
- **api** - API response errors
- **validation** - Data validation failures
- **sync** - Offline queue synchronization issues
- **cache** - Cache-related problems
- **render** - React rendering errors
- **unknown** - Unclassified errors

### Error Severity Levels

- **low** - Minor issues, app continues normally
- **medium** - Noticeable issues, some features affected
- **high** - Significant problems, major features affected
- **critical** - Severe issues, app functionality compromised

## Integration with Existing Systems

### Unified Store Integration

```typescript
// Error handling is automatically integrated with the unified store
const unifiedActions = useUnifiedActions()

try {
  await unifiedActions.loadUser(userId)
} catch (error) {
  // Error is automatically handled by the error recovery system
}
```

### Offline Queue Integration

```typescript
// Offline queue errors are automatically handled
const offlineQueue = useOfflineQueue()

// Errors during sync are caught and recovery is attempted
await offlineQueue.startSync()
```

## Error Recovery Strategies

### Network Errors
1. Retry with exponential backoff
2. Switch to offline mode
3. Use cached data
4. Show user-friendly message

### Storage Errors
1. Clear corrupted cache
2. Switch to memory-only storage
3. Reload application if critical

### API Errors
1. Retry failed requests
2. Use cached responses
3. Degrade to offline mode
4. Show fallback UI

### Validation Errors
1. Reset to default values
2. Show validation messages
3. Guide user to fix issues

## Best Practices

### 1. Error Boundary Placement

```typescript
// ✅ Good - Wrap major sections
<PageErrorBoundary pageName="Dashboard">
  <Dashboard />
</PageErrorBoundary>

// ✅ Good - Wrap complex components
<ComponentErrorBoundary componentName="DataChart" compact>
  <ComplexChart />
</ComponentErrorBoundary>

// ❌ Avoid - Too granular
<ComponentErrorBoundary>
  <button>Click me</button>
</ComponentErrorBoundary>
```

### 2. Error Context

```typescript
// ✅ Good - Provide meaningful context
handleErrorWithRecovery(error, {
  operation: 'user_profile_update',
  severity: 'high',
  autoRetry: true,
  maxRetries: 3
})

// ❌ Avoid - Generic context
handleErrorWithRecovery(error)
```

### 3. User Communication

```typescript
// ✅ Good - User-friendly messages
showError('Не удалось сохранить изменения', 'Проверьте подключение к интернету')

// ❌ Avoid - Technical messages
showError('HTTP 500 Internal Server Error')
```

### 4. Recovery Actions

```typescript
// ✅ Good - Provide recovery options
showRecoveryError('Ошибка загрузки', errorId, () => {
  // Clear cache and retry
  clearCache()
  retryOperation()
})

// ✅ Good - Automatic recovery
handleErrorWithRecovery(error, {
  autoRetry: true,
  maxRetries: 3
})
```

## Testing Error Handling

### Manual Testing

```typescript
// Trigger errors for testing
if (window.location.search.includes('test-error')) {
  throw new Error('Test error for debugging')
}

// Test network errors
if (window.location.search.includes('test-network')) {
  // Mock network failure
}
```

### Error Simulation

```typescript
// Simulate different error types
const simulateError = (type: 'network' | 'storage' | 'api') => {
  switch (type) {
    case 'network':
      throw new Error('Network request failed')
    case 'storage':
      throw new Error('Storage quota exceeded')
    case 'api':
      throw new Error('API response invalid')
  }
}
```

## Monitoring and Analytics

### Error Metrics

The system automatically tracks:
- Total error count
- Error types and frequencies
- Recovery success rates
- User impact metrics
- Performance impact

### Debug Information

```typescript
import { errorLogger } from './utils/errorLogging'

// Get comprehensive debug info
const debugInfo = errorLogger.getDebugInfo()

// Export for support
const supportData = errorLogger.exportLogs()
```

## Configuration

### Error Recovery Configuration

```typescript
// Configure error recovery behavior
const errorRecoveryManager = new ErrorRecoveryManager({
  maxErrors: 100,
  maxRetries: 3,
  retryDelay: 1000,
  autoRecovery: true,
  reportErrors: true
})
```

### Toast Configuration

```typescript
// Configure toast notifications
<ToastProvider 
  position="top-right" 
  maxToasts={5}
>
  <App />
</ToastProvider>
```

## Troubleshooting

### Common Issues

1. **Error boundaries not catching errors**
   - Ensure error boundaries are placed correctly
   - Check that errors occur during render phase

2. **Recovery not working**
   - Verify recovery strategies are configured
   - Check network connectivity
   - Ensure cache is not corrupted

3. **Toast notifications not showing**
   - Verify ToastProvider is wrapping the app
   - Check toast position and z-index

### Debug Steps

1. Open browser dev tools
2. Check console for error logs
3. Use the debug panel (development mode)
4. Export logs for analysis
5. Check network tab for failed requests

## Performance Considerations

### Error Handling Overhead

- Error boundaries have minimal performance impact
- Error logging is throttled to prevent spam
- Recovery attempts use exponential backoff
- Debug panel is only available in development

### Memory Management

- Error logs are automatically pruned
- Cache is cleared when storage limits are reached
- Old error reports are cleaned up periodically

## Security Considerations

### Error Information Exposure

- Stack traces are sanitized in production
- User data is not included in error reports
- Error IDs are used instead of sensitive data
- Debug information is only available in development

### Error Reporting

- Only essential error information is reported
- User consent is respected for analytics
- Error reports are anonymized
- Sensitive data is filtered out

## Migration Guide

### From Basic Error Handling

1. Wrap components with error boundaries
2. Replace try-catch blocks with error recovery hooks
3. Add toast notifications for user feedback
4. Configure error reporting and analytics

### Integration Steps

1. Install error boundary components
2. Set up toast provider
3. Configure error recovery strategies
4. Add error logging to critical paths
5. Test error scenarios thoroughly

## Conclusion

This comprehensive error handling system provides:

- **Robust Error Catching** - No unhandled errors reach users
- **Automatic Recovery** - Most errors are resolved automatically
- **User-Friendly Experience** - Clear messages and recovery options
- **Developer Tools** - Comprehensive debugging and monitoring
- **Performance Optimized** - Minimal impact on app performance
- **Security Conscious** - Safe error reporting and logging

The system ensures that users have a smooth experience even when errors occur, while providing developers with the tools needed to identify and fix issues quickly.