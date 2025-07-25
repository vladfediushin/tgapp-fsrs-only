# Production Monitoring Setup Guide

This document provides a comprehensive guide for setting up and configuring production monitoring for the TGAPP FSRS application.

## Overview

The production monitoring system has been designed to be lightweight, privacy-conscious, and optimized for production environments. It replaces the heavy development monitoring with efficient production-ready solutions.

## Architecture

### Components

1. **Backend Monitoring** (`backend/config/monitoring.production.py`)
   - Error tracking with Sentry integration
   - Performance monitoring with Prometheus support
   - Lightweight analytics collection

2. **Frontend Monitoring** (`frontend/src/config/monitoring.production.ts`)
   - Environment-aware configuration
   - Feature flags for production optimization
   - Automatic environment detection

3. **Error Tracking** (`frontend/src/services/productionErrorTracking.ts`)
   - Sentry integration with lazy loading
   - Global error handlers
   - React error boundary integration

4. **Analytics** (`frontend/src/services/productionAnalytics.ts`)
   - Privacy-compliant data collection
   - Batched reporting
   - FSRS-specific metrics

5. **Performance Monitoring** (`frontend/src/services/productionPerformanceMonitor.ts`)
   - Web Vitals integration
   - Lightweight metrics collection
   - Threshold monitoring

6. **Monitoring Coordinator** (`frontend/src/services/productionMonitoringInit.ts`)
   - Centralized initialization
   - Service integration
   - Cross-service coordination

## Configuration

### Environment Variables

#### Backend
```bash
# Error Monitoring
SENTRY_DSN=your_sentry_dsn_here
SENTRY_TRACES_SAMPLE_RATE=0.05
LOG_LEVEL=WARNING
LOG_DIRECTORY=/var/log/tgapp

# Performance Monitoring
ENABLE_PROMETHEUS=true
PROMETHEUS_PORT=8000

# Alerting
ALERT_WEBHOOK_URL=your_webhook_url
ALERT_SLACK_WEBHOOK=your_slack_webhook
ALERT_EMAIL_FROM=alerts@yourdomain.com
ALERT_EMAIL_TO=admin@yourdomain.com

# SMTP Configuration
SMTP_SERVER=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USERNAME=your_smtp_username
SMTP_PASSWORD=your_smtp_password
SMTP_USE_TLS=true
```

#### Frontend
```bash
# Build-time variables
VITE_APP_VERSION=1.0.0
VITE_SENTRY_DSN=your_frontend_sentry_dsn
VITE_ANALYTICS_ENDPOINT=https://analytics.yourdomain.com/api/events
VITE_ANALYTICS_API_KEY=your_analytics_api_key
```

### Production vs Development

The monitoring system automatically detects the environment and adjusts behavior:

#### Production Environment
- **Logging**: Only warnings and errors
- **Metrics**: Reduced collection (5% sampling)
- **Storage**: No local persistence for privacy
- **Dashboard**: Disabled by default
- **Testing**: Development tools disabled

#### Development Environment
- **Logging**: Full debug logging
- **Metrics**: Complete collection (100% sampling)
- **Storage**: Local persistence enabled
- **Dashboard**: Full featured
- **Testing**: All development tools available

## Features

### Error Tracking

#### Sentry Integration
- Automatic error capture
- Performance monitoring
- Release tracking
- User context

#### Configuration
```typescript
// Automatic configuration based on environment
const config = {
  dsn: process.env.VITE_SENTRY_DSN,
  environment: 'production',
  sampleRate: 0.1, // 10% in production
  tracesSampleRate: 0.01, // 1% in production
}
```

#### Usage
```typescript
import { productionErrorTracker } from '../services/productionErrorTracking'

// Capture errors
productionErrorTracker.captureError(error, {
  component: 'UserProfile',
  action: 'updateSettings'
})

// Add breadcrumbs
productionErrorTracker.addBreadcrumb({
  message: 'User clicked save button',
  category: 'user',
  level: 'info'
})
```

### Analytics

#### Privacy-First Design
- Data anonymization in production
- GDPR compliance features
- Configurable data retention
- User consent handling

#### FSRS-Specific Metrics
```typescript
// Track study sessions
analytics.trackStudySession(duration, questionsAnswered, accuracy)

// Track question responses
analytics.trackQuestionAnswered(questionId, difficulty, responseTime)

// Track settings changes
analytics.trackSettingsChanged('difficulty', 'easy', 'medium')
```

### Performance Monitoring

#### Web Vitals
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)

#### Custom Metrics
```typescript
// Measure API calls
performanceMonitor.measureApiCall('/api/questions', 'GET', 250, 200)

// Measure component renders
performanceMonitor.measureRender('QuestionCard', 45)

// Measure route changes
performanceMonitor.measureRouteChange('/study', 120)
```

#### Thresholds
- **Slow API Call**: 5 seconds
- **Slow Render**: 200ms
- **High Memory**: 100MB
- **Large Bundle**: 500KB

## Deployment

### Backend Setup

1. **Install Dependencies**
```bash
pip install sentry-sdk prometheus-client psutil httpx
```

2. **Initialize Monitoring**
```python
from app.utils.error_monitoring import initialize_error_monitoring, DEFAULT_CONFIG
from app.utils.performance_monitoring import initialize_performance_monitoring, DEFAULT_PERFORMANCE_CONFIG

# Initialize error monitoring
error_monitor = initialize_error_monitoring(DEFAULT_CONFIG)

# Initialize performance monitoring
perf_monitor = initialize_performance_monitoring(DEFAULT_PERFORMANCE_CONFIG)
await perf_monitor.start_monitoring()
```

3. **FastAPI Integration**
```python
from app.utils.error_monitoring import create_error_context_from_request

@app.middleware("http")
async def monitoring_middleware(request: Request, call_next):
    context = await create_error_context_from_request(request)
    
    async with error_context(**asdict(context)):
        response = await call_next(request)
        return response
```

### Frontend Setup

1. **Install Dependencies**
```bash
npm install @sentry/browser @sentry/tracing
```

2. **Initialize Monitoring**
```typescript
// In main.tsx or App.tsx
import { productionMonitoringCoordinator } from './services/productionMonitoringInit'

// Initialize monitoring
productionMonitoringCoordinator.initialize()
```

3. **React Integration**
```typescript
// Error boundary integration
import { captureReactError } from './services/productionErrorTracking'

class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    captureReactError(error, errorInfo)
  }
}
```

## Monitoring Dashboard

### Access Control
- **Production**: Disabled by default for security
- **Staging**: Enabled with full features
- **Development**: Enabled with all tools

### Features
- Service status monitoring
- Real-time performance metrics
- Error rate tracking
- Configuration overview
- Data export functionality

### Usage
```typescript
import ProductionMonitoringDashboard from './components/ProductionMonitoringDashboard'

function App() {
  const [showDashboard, setShowDashboard] = useState(false)
  
  return (
    <>
      {/* Your app content */}
      <ProductionMonitoringDashboard 
        isVisible={showDashboard}
        onClose={() => setShowDashboard(false)}
      />
    </>
  )
}
```

## Performance Optimizations

### Production Optimizations
1. **Reduced Sampling**: 5% of operations monitored
2. **Batched Reporting**: Events sent in batches
3. **Memory Limits**: Strict limits on stored metrics
4. **Lazy Loading**: Sentry loaded only when needed
5. **Feature Flags**: Development tools disabled

### Bundle Size Impact
- **Base monitoring**: ~15KB gzipped
- **With Sentry**: ~45KB gzipped (lazy loaded)
- **Development tools**: 0KB in production

## Troubleshooting

### Common Issues

#### Sentry Not Working
1. Check DSN configuration
2. Verify network connectivity
3. Check sample rates
4. Review console for errors

#### High Memory Usage
1. Check metric collection limits
2. Verify cleanup intervals
3. Review sampling rates
4. Monitor queue sizes

#### Missing Analytics
1. Verify endpoint configuration
2. Check API key validity
3. Review network requests
4. Check batching settings

### Debug Mode
```typescript
// Enable debug mode in development
if (!isProductionEnvironment()) {
  window.__MONITORING_DEBUG__ = true
  window.__MONITORING_SERVICES__ = productionMonitoringCoordinator.getServices()
}
```

### Health Checks
```typescript
// Check monitoring status
const status = await productionMonitoringCoordinator.getStatus()
console.log('Monitoring Status:', status)

// Validate configuration
const validation = validateConfiguration()
console.log('Config Validation:', validation)
```

## Security Considerations

### Data Privacy
- User data anonymization in production
- No sensitive data in logs
- Configurable data retention
- GDPR compliance features

### Network Security
- HTTPS-only endpoints
- API key authentication
- Rate limiting
- Request validation

### Access Control
- Dashboard disabled in production
- Environment-based feature flags
- Role-based access (future)
- Audit logging

## Maintenance

### Regular Tasks
1. **Monitor Error Rates**: Check Sentry dashboard weekly
2. **Review Performance**: Analyze metrics monthly
3. **Update Thresholds**: Adjust based on usage patterns
4. **Clean Logs**: Rotate logs regularly
5. **Update Dependencies**: Keep monitoring libraries current

### Scaling Considerations
- Increase sampling rates with traffic
- Implement metric aggregation
- Consider external monitoring services
- Plan for data retention policies

## Migration from Development Monitoring

### Automatic Migration
The production monitoring system automatically:
1. Detects environment
2. Disables development features
3. Reduces logging verbosity
4. Optimizes performance collection

### Manual Steps
1. Update environment variables
2. Configure external services (Sentry, analytics)
3. Set up alerting endpoints
4. Test in staging environment

## Support

### Documentation
- [Error Monitoring API](./error-monitoring-api.md)
- [Performance Monitoring API](./performance-monitoring-api.md)
- [Analytics API](./analytics-api.md)

### Monitoring
- Sentry Dashboard: [Your Sentry URL]
- Prometheus Metrics: `http://localhost:8000/metrics`
- Analytics Dashboard: [Your Analytics URL]

### Contacts
- **Technical Issues**: tech-support@yourdomain.com
- **Security Issues**: security@yourdomain.com
- **General Questions**: support@yourdomain.com

---

*Last Updated: 2025-01-24*
*Version: 1.0.0*