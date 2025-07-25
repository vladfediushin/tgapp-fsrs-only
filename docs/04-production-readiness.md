# Production Readiness: Deployment & Infrastructure

## Overview
Complete the final production deployment setup for Render (backend), Vercel (frontend), and Supabase (database). This includes offline functionality, performance monitoring, error tracking, and deployment automation for **1-week production launch**.

## Deployment Architecture

### Target Infrastructure
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Vercel        │    │   Render        │    │   Supabase      │
│   (Frontend)    │◄──►│   (Backend)     │◄──►│   (Database)    │
│                 │    │                 │    │                 │
│ • React/Vite    │    │ • FastAPI       │    │ • PostgreSQL    │
│ • Static Assets │    │ • FSRS Service  │    │ • Row Level     │
│ • CDN           │    │ • Auto-scaling  │    │   Security      │
│ • Edge Caching  │    │ • Health Checks │    │ • Backups       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Phase 1: Offline System Completion (Day 1)

### Current State Analysis
- **Service Worker**: [`frontend/public/sw.js`](../frontend/public/sw.js) exists but needs integration
- **Offline Queue**: [`frontend/src/store/offlineQueue.ts`](../frontend/src/store/offlineQueue.ts) implemented but not connected
- **Offline Indicator**: [`frontend/src/components/OfflineIndicator.tsx`](../frontend/src/components/OfflineIndicator.tsx) exists

### Step 1: Service Worker Integration

#### Enhanced Service Worker Implementation
```javascript
// frontend/public/sw.js
const CACHE_NAME = 'tgapp-fsrs-v1';
const STATIC_CACHE = 'tgapp-static-v1';
const API_CACHE = 'tgapp-api-v1';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  // Add critical CSS and JS files
];

// API endpoints to cache
const CACHEABLE_APIS = [
  '/api/fsrs/due-questions',
  '/api/topics',
  '/api/user/progress'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => 
        cache.addAll(STATIC_ASSETS)
      ),
      caches.open(API_CACHE)
    ]).then(() => {
      console.log('Service Worker: Static assets cached');
      self.skipWaiting();
    })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && 
              cacheName !== API_CACHE && 
              cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Old caches cleaned');
      self.clients.claim();
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets
  if (request.destination === 'document' || 
      request.destination === 'script' || 
      request.destination === 'style') {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // Default: network first
  event.respondWith(
    fetch(request).catch(() => 
      caches.match(request) || 
      caches.match('/offline.html')
    )
  );
});

// API request handler - cache first for GET, network only for POST
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  if (request.method === 'GET' && CACHEABLE_APIS.some(api => url.pathname.includes(api))) {
    // Cache first strategy for GET requests
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Return cached version and update in background
      fetch(request).then(response => {
        if (response.ok) {
          const cache = caches.open(API_CACHE);
          cache.then(c => c.put(request, response.clone()));
        }
      }).catch(() => {}); // Ignore background update errors
      
      return cachedResponse;
    }
    
    // Not in cache, fetch and cache
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(API_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      // Return offline fallback for critical endpoints
      if (url.pathname.includes('/due-questions')) {
        return new Response(JSON.stringify([]), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      throw error;
    }
  }
  
  // POST requests - network only, queue if offline
  if (request.method === 'POST') {
    try {
      return await fetch(request);
    } catch (error) {
      // Queue POST requests for later sync
      await queueOfflineRequest(request);
      return new Response(JSON.stringify({ queued: true }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  // Default network first
  return fetch(request);
}

// Static request handler - cache first
async function handleStaticRequest(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return caches.match('/offline.html');
  }
}

// Queue offline requests
async function queueOfflineRequest(request) {
  const requestData = {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: await request.text(),
    timestamp: Date.now()
  };
  
  // Store in IndexedDB for persistence
  const db = await openDB();
  const tx = db.transaction(['offline_queue'], 'readwrite');
  await tx.objectStore('offline_queue').add(requestData);
}

// Background sync for queued requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'offline-sync') {
    event.waitUntil(syncOfflineRequests());
  }
});

async function syncOfflineRequests() {
  const db = await openDB();
  const tx = db.transaction(['offline_queue'], 'readonly');
  const requests = await tx.objectStore('offline_queue').getAll();
  
  for (const requestData of requests) {
    try {
      const response = await fetch(requestData.url, {
        method: requestData.method,
        headers: requestData.headers,
        body: requestData.body
      });
      
      if (response.ok) {
        // Remove from queue
        const deleteTx = db.transaction(['offline_queue'], 'readwrite');
        await deleteTx.objectStore('offline_queue').delete(requestData.id);
      }
    } catch (error) {
      console.log('Sync failed for request:', requestData.url);
    }
  }
}

// IndexedDB helper
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('tgapp-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offline_queue')) {
        const store = db.createObjectStore('offline_queue', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        store.createIndex('timestamp', 'timestamp');
      }
    };
  });
}
```

### Step 2: Offline Queue Integration

#### Enhanced Offline Queue Manager
```typescript
// frontend/src/store/offlineQueue.ts - Enhance existing implementation
import { useUnifiedStore } from './unified';

interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

class OfflineQueueManager {
  private queue: QueuedRequest[] = [];
  private isOnline = navigator.onLine;
  private syncInProgress = false;

  constructor() {
    this.setupEventListeners();
    this.loadQueueFromStorage();
  }

  private setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Periodic sync attempt
    setInterval(() => {
      if (this.isOnline && this.queue.length > 0) {
        this.syncQueue();
      }
    }, 30000); // Every 30 seconds
  }

  async queueRequest(
    url: string, 
    method: string, 
    headers: Record<string, string>, 
    body: string
  ): Promise<string> {
    const request: QueuedRequest = {
      id: crypto.randomUUID(),
      url,
      method,
      headers,
      body,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3
    };

    this.queue.push(request);
    await this.saveQueueToStorage();

    // Try immediate sync if online
    if (this.isOnline) {
      this.syncQueue();
    }

    return request.id;
  }

  async syncQueue(): Promise<void> {
    if (this.syncInProgress || this.queue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    const failedRequests: QueuedRequest[] = [];

    for (const request of this.queue) {
      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body
        });

        if (response.ok) {
          // Success - remove from queue
          console.log('Synced offline request:', request.url);
          
          // Notify unified store of successful sync
          const store = useUnifiedStore.getState();
          store.actions.handleOfflineSync(request);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        request.retryCount++;
        
        if (request.retryCount < request.maxRetries) {
          failedRequests.push(request);
        } else {
          console.error('Max retries exceeded for request:', request.url);
          // Notify user of permanent failure
          this.notifyPermanentFailure(request);
        }
      }
    }

    this.queue = failedRequests;
    await this.saveQueueToStorage();
    this.syncInProgress = false;
  }

  private async saveQueueToStorage(): Promise<void> {
    try {
      localStorage.setItem('offline_queue', JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  private async loadQueueFromStorage(): Promise<void> {
    try {
      const stored = localStorage.getItem('offline_queue');
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
      this.queue = [];
    }
  }

  private notifyPermanentFailure(request: QueuedRequest): void {
    // Show user notification about failed sync
    const event = new CustomEvent('offline-sync-failed', {
      detail: { request }
    });
    window.dispatchEvent(event);
  }

  getQueueStatus() {
    return {
      isOnline: this.isOnline,
      queueLength: this.queue.length,
      syncInProgress: this.syncInProgress
    };
  }
}

export const offlineQueue = new OfflineQueueManager();
```

### Step 3: Offline Indicator Enhancement

```typescript
// frontend/src/components/OfflineIndicator.tsx - Enhance existing
import React, { useState, useEffect } from 'react';
import { offlineQueue } from '../store/offlineQueue';

const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueStatus, setQueueStatus] = useState(offlineQueue.getQueueStatus());
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    const handleSyncFailed = (event: CustomEvent) => {
      // Show persistent notification for failed syncs
      console.error('Sync failed permanently:', event.detail.request);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-sync-failed', handleSyncFailed as EventListener);

    // Update queue status periodically
    const interval = setInterval(() => {
      setQueueStatus(offlineQueue.getQueueStatus());
    }, 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-sync-failed', handleSyncFailed as EventListener);
      clearInterval(interval);
    };
  }, []);

  if (isOnline && queueStatus.queueLength === 0) {
    return null; // Don't show when online and no queue
  }

  return (
    <div className={`offline-indicator ${isOnline ? 'syncing' : 'offline'}`}>
      <div 
        className="offline-status"
        onClick={() => setShowDetails(!showDetails)}
      >
        <span className="status-icon">
          {isOnline ? '🔄' : '📡'}
        </span>
        <span className="status-text">
          {isOnline 
            ? queueStatus.syncInProgress 
              ? 'Syncing...' 
              : `${queueStatus.queueLength} pending`
            : 'Offline Mode'
          }
        </span>
      </div>

      {showDetails && (
        <div className="offline-details">
          <div className="detail-item">
            <strong>Connection:</strong> {isOnline ? 'Online' : 'Offline'}
          </div>
          <div className="detail-item">
            <strong>Queued Actions:</strong> {queueStatus.queueLength}
          </div>
          {queueStatus.syncInProgress && (
            <div className="detail-item">
              <strong>Status:</strong> Syncing data...
            </div>
          )}
          {!isOnline && (
            <div className="offline-message">
              Your progress is saved locally and will sync when you're back online.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OfflineIndicator;
```

## Phase 2: Performance Monitoring Deployment (Day 2)

### Step 1: Production Performance Monitoring

#### Real User Monitoring (RUM) Integration
```typescript
// frontend/src/utils/performanceMonitor.ts
interface PerformanceMetrics {
  lcp: number;  // Largest Contentful Paint
  fid: number;  // First Input Delay
  cls: number;  // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
  fcp: number;  // First Contentful Paint
}

class ProductionPerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private observer: PerformanceObserver | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      this.initializeObserver();
      this.measureCoreWebVitals();
    }
  }

  private initializeObserver() {
    this.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.processPerformanceEntry(entry);
      }
    });

    // Observe different types of performance entries
    try {
      this.observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] });
    } catch (error) {
      console.warn('Performance Observer not fully supported:', error);
    }
  }

  private processPerformanceEntry(entry: PerformanceEntry) {
    switch (entry.entryType) {
      case 'navigation':
        const navEntry = entry as PerformanceNavigationTiming;
        this.metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
        break;
        
      case 'paint':
        if (entry.name === 'first-contentful-paint') {
          this.metrics.fcp = entry.startTime;
        }
        break;
        
      case 'largest-contentful-paint':
        this.metrics.lcp = entry.startTime;
        break;
    }
  }

  private measureCoreWebVitals() {
    // Measure LCP
    if ('PerformanceObserver' in window) {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.metrics.lcp = lastEntry.startTime;
        this.reportMetrics();
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    }

    // Measure FID
    if ('PerformanceObserver' in window) {
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.metrics.fid = entry.processingStart - entry.startTime;
          this.reportMetrics();
        }
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
    }

    // Measure CLS
    if ('PerformanceObserver' in window) {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        this.metrics.cls = clsValue;
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    }
  }

  private async reportMetrics() {
    // Only report if we have meaningful data
    if (Object.keys(this.metrics).length < 3) return;

    try {
      // Send to analytics service (replace with your preferred service)
      await fetch('/api/analytics/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: this.metrics,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      });
    } catch (error) {
      console.warn('Failed to report performance metrics:', error);
    }
  }

  // Public method to get current metrics
  getMetrics(): Partial<PerformanceMetrics> {
    return { ...this.metrics };
  }

  // Method to manually report custom metrics
  reportCustomMetric(name: string, value: number, unit: string = 'ms') {
    fetch('/api/analytics/custom-metric', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        value,
        unit,
        timestamp: Date.now(),
        url: window.location.href
      })
    }).catch(error => {
      console.warn('Failed to report custom metric:', error);
    });
  }
}

// Initialize performance monitoring
export const performanceMonitor = new ProductionPerformanceMonitor();

// Helper function to measure FSRS operation performance
export const measureFSRSPerformance = async <T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> => {
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const duration = performance.now() - startTime;
    
    performanceMonitor.reportCustomMetric(
      `fsrs_${operationName}`,
      duration,
      'ms'
    );
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitor.reportCustomMetric(
      `fsrs_${operationName}_error`,
      duration,
      'ms'
    );
    throw error;
  }
};
```

### Step 2: Error Tracking Integration

#### Production Error Monitoring
```typescript
// frontend/src/utils/errorTracking.ts
interface ErrorReport {
  message: string;
  stack?: string;
  url: string;
  lineNumber?: number;
  columnNumber?: number;
  userAgent: string;
  timestamp: number;
  userId?: string;
  sessionId: string;
  additionalContext?: Record<string, any>;
}

class ProductionErrorTracker {
  private sessionId: string;
  private userId?: string;
  private errorQueue: ErrorReport[] = [];
  private maxQueueSize = 50;

  constructor() {
    this.sessionId = crypto.randomUUID();
    this.setupErrorHandlers();
    this.setupUnhandledRejectionHandler();
  }

  private setupErrorHandlers() {
    window.addEventListener('error', (event) => {
      this.captureError({
        message: event.message,
        stack: event.error?.stack,
        url: event.filename || window.location.href,
        lineNumber: event.lineno,
        columnNumber: event.colno,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        sessionId: this.sessionId,
        userId: this.userId
      });
    });
  }

  private setupUnhandledRejectionHandler() {
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        sessionId: this.sessionId,
        userId: this.userId,
        additionalContext: {
          type: 'unhandledrejection',
          reason: event.reason
        }
      });
    });
  }

  captureError(error: Partial<ErrorReport>) {
    const errorReport: ErrorReport = {
      message: error.message || 'Unknown error',
      stack: error.stack,
      url: error.url || window.location.href,
      lineNumber: error.lineNumber,
      columnNumber: error.columnNumber,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId,
      additionalContext: error.additionalContext
    };

    this.errorQueue.push(errorReport);

    // Limit queue size
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift();
    }

    // Send immediately for critical errors
    if (this.isCriticalError(errorReport)) {
      this.sendErrorReport(errorReport);
    } else {
      // Batch send non-critical errors
      this.scheduleBatchSend();
    }
  }

  private isCriticalError(error: ErrorReport): boolean {
    const criticalPatterns = [
      /fsrs/i,
      /unified.*store/i,
      /authentication/i,
      /database/i,
      /network.*error/i
    ];

    return criticalPatterns.some(pattern => 
      pattern.test(error.message) || 
      (error.stack && pattern.test(error.stack))
    );
  }

  private scheduleBatchSend() {
    // Debounce batch sending
    clearTimeout(this.batchTimeout);
    this.batchTimeout = setTimeout(() => {
      this.sendBatchErrors();
    }, 5000);
  }

  private batchTimeout?: number;

  private async sendErrorReport(error: ErrorReport) {
    try {
      await fetch('/api/errors/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(error)
      });
    } catch (sendError) {
      console.warn('Failed to send error report:', sendError);
    }
  }

  private async sendBatchErrors() {
    if (this.errorQueue.length === 0) return;

    try {
      await fetch('/api/errors/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errors: this.errorQueue,
          sessionId: this.sessionId
        })
      });

      // Clear queue after successful send
      this.errorQueue = [];
    } catch (error) {
      console.warn('Failed to send batch errors:', error);
    }
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  // Method for manual error reporting
  reportError(message: string, additionalContext?: Record<string, any>) {
    this.captureError({
      message,
      additionalContext: {
        ...additionalContext,
        type: 'manual'
      }
    });
  }

  // Method for FSRS-specific error reporting
  reportFSRSError(operation: string, error: Error, context?: Record<string, any>) {
    this.captureError({
      message: `FSRS Error in ${operation}: ${error.message}`,
      stack: error.stack,
      additionalContext: {
        ...context,
        type: 'fsrs_error',
        operation
      }
    });
  }
}

export const errorTracker = new ProductionErrorTracker();

// React Error Boundary integration
export class ProductionErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<{ error: Error }> },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    errorTracker.captureError({
      message: `React Error: ${error.message}`,
      stack: error.stack,
      additionalContext: {
        type: 'react_error',
        componentStack: errorInfo.componentStack,
        errorBoundary: true
      }
    });
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error!} />;
    }

    return this.props.children;
  }
}

const DefaultErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div className="error-fallback">
    <h2>Something went wrong</h2>
    <p>We've been notified of this error and are working to fix it.</p>
    <button onClick={() => window.location.reload()}>
      Reload Page
    </button>
  </div>
);
```

## Phase 3: Deployment Configuration (Day 3)

### Step 1: Vercel Frontend Deployment

#### Vercel Configuration
```json
// vercel.json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm ci",
  "env": {
    "VITE_API_URL": "@api-url",
    "VITE_SUPABASE_URL": "@supabase-url",
    "VITE_SUPABASE_ANON_KEY": "@supabase-anon-key",
    "VITE_ENVIRONMENT": "production"
  },
  "build": {
    "env": {
      "VITE_API_URL": "@api-url",
      "VITE_SUPABASE_URL": "@supabase-url", 
      "VITE_SUPABASE_ANON_KEY": "@supabase-anon-key",
      "VITE_ENVIRONMENT": "production"
    }
  },
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        },
        {
          "key": "Service-Worker-Allowed",
          "value": "/"
        }
      ]
    },
    {
      "source": "/static/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "$API_URL/api/$1"
    }
  ],
  "functions": {
    "app/api/analytics/performance.js": {
      "maxDuration": 10
    }
  }
}
```

#### Production Vite Configuration
```typescript
// vite.config.ts - Production optimizations
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 