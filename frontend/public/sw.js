// Service Worker for Telegram Mini Web App
// Provides advanced offline functionality and PWA capabilities

const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
const IMAGES_CACHE = `images-${CACHE_VERSION}`;

// Cache configuration
const CACHE_CONFIG = {
  static: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxEntries: 100
  },
  dynamic: {
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    maxEntries: 50
  },
  api: {
    maxAge: 5 * 60 * 1000, // 5 minutes
    maxEntries: 200
  },
  images: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxEntries: 100
  }
};

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/App.tsx',
  '/offline.html',
  '/manifest.json',
  'https://telegram.org/js/telegram-web-app.js?57'
];

// API endpoints that should be cached
const CACHEABLE_API_PATTERNS = [
  /\/api\/topics/,
  /\/api\/users\/\d+\/stats/,
  /\/api\/users\/\d+\/exam-settings/,
  /\/api\/questions\/remaining-count/,
  /\/api\/health/
];

// API endpoints that should never be cached
const NON_CACHEABLE_API_PATTERNS = [
  /\/api\/questions\/submit-answer/,
  /\/api\/fsrs\/rate/,
  /\/api\/users\/\d+\/daily-progress/
];

// Background sync tags
const SYNC_TAGS = {
  OFFLINE_QUEUE: 'offline-queue-sync',
  PERIODIC_SYNC: 'periodic-background-sync'
};

// ============================================================================
// Service Worker Installation
// ============================================================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    (async () => {
      try {
        // Cache static assets
        const staticCache = await caches.open(STATIC_CACHE);
        await staticCache.addAll(STATIC_ASSETS);
        
        // Initialize other caches
        await caches.open(DYNAMIC_CACHE);
        await caches.open(API_CACHE);
        await caches.open(IMAGES_CACHE);
        
        console.log('[SW] Static assets cached successfully');
        
        // Skip waiting to activate immediately
        self.skipWaiting();
      } catch (error) {
        console.error('[SW] Installation failed:', error);
      }
    })()
  );
});

// ============================================================================
// Service Worker Activation
// ============================================================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    (async () => {
      try {
        // Clean up old caches
        const cacheNames = await caches.keys();
        const oldCaches = cacheNames.filter(name => 
          !name.includes(CACHE_VERSION) && 
          (name.includes('static-') || name.includes('dynamic-') || 
           name.includes('api-') || name.includes('images-'))
        );
        
        await Promise.all(
          oldCaches.map(cacheName => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
        
        // Claim all clients
        await self.clients.claim();
        
        console.log('[SW] Service worker activated successfully');
        
        // Notify clients about activation
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: CACHE_VERSION
          });
        });
        
      } catch (error) {
        console.error('[SW] Activation failed:', error);
      }
    })()
  );
});

// ============================================================================
// Fetch Event Handler with Advanced Caching Strategies
// ============================================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests for caching
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  event.respondWith(handleFetchRequest(request));
});

async function handleFetchRequest(request) {
  const url = new URL(request.url);
  
  try {
    // API requests
    if (url.pathname.startsWith('/api/')) {
      return await handleApiRequest(request);
    }
    
    // Static assets (JS, CSS, fonts, etc.)
    if (isStaticAsset(url)) {
      return await handleStaticAsset(request);
    }
    
    // Images
    if (isImageRequest(url)) {
      return await handleImageRequest(request);
    }
    
    // HTML pages and other dynamic content
    return await handleDynamicContent(request);
    
  } catch (error) {
    console.error('[SW] Fetch error:', error);
    return await handleFetchError(request, error);
  }
}

// ============================================================================
// Caching Strategy Implementations
// ============================================================================

// Cache First strategy for static assets
async function handleStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Update cache in background if needed
    updateCacheInBackground(request, cache);
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return await getOfflineFallback(request);
  }
}

// Stale While Revalidate strategy for API requests
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  // Check if this API should not be cached
  if (NON_CACHEABLE_API_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return await fetch(request);
  }
  
  // Check if this API should be cached
  if (!CACHEABLE_API_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return await fetch(request);
  }
  
  const cache = await caches.open(API_CACHE);
  const cachedResponse = await cache.match(request);
  
  // Start network request
  const networkPromise = fetch(request).then(async (response) => {
    if (response.ok) {
      await cache.put(request, response.clone());
      await cleanupCache(cache, CACHE_CONFIG.api);
    }
    return response;
  }).catch(error => {
    console.warn('[SW] API network request failed:', error);
    return null;
  });
  
  // Return cached response immediately if available
  if (cachedResponse && !isExpired(cachedResponse, CACHE_CONFIG.api.maxAge)) {
    // Update in background
    networkPromise.catch(() => {}); // Ignore errors for background update
    return cachedResponse;
  }
  
  // Wait for network response
  const networkResponse = await networkPromise;
  return networkResponse || cachedResponse || await getOfflineFallback(request);
}

// Cache First with Network Fallback for images
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGES_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
      await cleanupCache(cache, CACHE_CONFIG.images);
    }
    return networkResponse;
  } catch (error) {
    // Return placeholder image for failed image requests
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f0f0f0"/><text x="100" y="100" text-anchor="middle" dy=".3em" fill="#999">Image unavailable</text></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
}

// Network First with Cache Fallback for dynamic content
async function handleDynamicContent(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      await cache.put(request, networkResponse.clone());
      await cleanupCache(cache, CACHE_CONFIG.dynamic);
    }
    
    return networkResponse;
  } catch (error) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return await getOfflineFallback(request);
  }
}

// ============================================================================
// Background Sync
// ============================================================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === SYNC_TAGS.OFFLINE_QUEUE) {
    event.waitUntil(syncOfflineQueue());
  } else if (event.tag === SYNC_TAGS.PERIODIC_SYNC) {
    event.waitUntil(performPeriodicSync());
  }
});

async function syncOfflineQueue() {
  try {
    console.log('[SW] Syncing offline queue...');
    
    // Notify the main thread to process the offline queue
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_OFFLINE_QUEUE'
      });
    });
    
    // Wait a bit for the main thread to process
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('[SW] Offline queue sync completed');
  } catch (error) {
    console.error('[SW] Offline queue sync failed:', error);
    throw error;
  }
}

async function performPeriodicSync() {
  try {
    console.log('[SW] Performing periodic sync...');
    
    // Update critical caches
    const criticalUrls = [
      '/api/health',
      '/api/topics?country=am&language=ru'
    ];
    
    for (const url of criticalUrls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const cache = await caches.open(API_CACHE);
          await cache.put(url, response);
        }
      } catch (error) {
        console.warn('[SW] Failed to update cache for:', url, error);
      }
    }
    
    console.log('[SW] Periodic sync completed');
  } catch (error) {
    console.error('[SW] Periodic sync failed:', error);
  }
}

// ============================================================================
// Message Handling
// ============================================================================

self.addEventListener('message', (event) => {
  const { data } = event;
  
  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_URLS':
      event.waitUntil(cacheUrls(data.urls));
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(clearSpecificCache(data.cacheName));
      break;
      
    case 'GET_CACHE_STATUS':
      event.waitUntil(sendCacheStatus(event.source));
      break;
      
    case 'REGISTER_BACKGROUND_SYNC':
      event.waitUntil(registerBackgroundSync(data.tag));
      break;
      
    default:
      console.log('[SW] Unknown message type:', data.type);
  }
});

async function cacheUrls(urls) {
  const cache = await caches.open(DYNAMIC_CACHE);
  
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
      }
    } catch (error) {
      console.warn('[SW] Failed to cache URL:', url, error);
    }
  }
}

async function clearSpecificCache(cacheName) {
  if (cacheName) {
    await caches.delete(cacheName);
  } else {
    // Clear all caches
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  }
}

async function sendCacheStatus(client) {
  const cacheNames = await caches.keys();
  const cacheStatus = {};
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    cacheStatus[cacheName] = keys.length;
  }
  
  client.postMessage({
    type: 'CACHE_STATUS',
    status: cacheStatus
  });
}

async function registerBackgroundSync(tag) {
  try {
    await self.registration.sync.register(tag);
    console.log('[SW] Background sync registered:', tag);
  } catch (error) {
    console.error('[SW] Failed to register background sync:', error);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.woff', '.woff2', '.ttf', '.eot'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext)) ||
         url.pathname === '/' ||
         url.pathname.endsWith('.html') ||
         url.pathname.includes('/src/');
}

function isImageRequest(url) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'];
  return imageExtensions.some(ext => url.pathname.toLowerCase().endsWith(ext));
}

function isExpired(response, maxAge) {
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return true;
  
  const responseTime = new Date(dateHeader).getTime();
  return Date.now() - responseTime > maxAge;
}

async function updateCacheInBackground(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response);
    }
  } catch (error) {
    // Ignore background update errors
  }
}

async function cleanupCache(cache, config) {
  const keys = await cache.keys();
  
  if (keys.length > config.maxEntries) {
    // Remove oldest entries
    const entriesToDelete = keys.length - config.maxEntries;
    for (let i = 0; i < entriesToDelete; i++) {
      await cache.delete(keys[i]);
    }
  }
}

async function getOfflineFallback(request) {
  const url = new URL(request.url);
  
  // For HTML requests, return offline page
  if (request.headers.get('accept')?.includes('text/html')) {
    const cache = await caches.open(STATIC_CACHE);
    const offlinePage = await cache.match('/offline.html');
    if (offlinePage) {
      return offlinePage;
    }
  }
  
  // For API requests, return offline response
  if (url.pathname.startsWith('/api/')) {
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'This request is not available offline',
        offline: true
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // Default offline response
  return new Response('Offline', { status: 503 });
}

async function handleFetchError(request, error) {
  console.error('[SW] Fetch error for:', request.url, error);
  return await getOfflineFallback(request);
}

// ============================================================================
// Performance Monitoring
// ============================================================================

// Track cache performance
let cacheStats = {
  hits: 0,
  misses: 0,
  requests: 0
};

function updateCacheStats(hit) {
  cacheStats.requests++;
  if (hit) {
    cacheStats.hits++;
  } else {
    cacheStats.misses++;
  }
  
  // Send stats to main thread periodically
  if (cacheStats.requests % 50 === 0) {
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'CACHE_STATS',
          stats: {
            ...cacheStats,
            hitRate: cacheStats.hits / cacheStats.requests
          }
        });
      });
    });
  }
}

console.log('[SW] Service worker script loaded');