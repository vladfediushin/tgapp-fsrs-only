"""
Backend Caching System for Production
Comprehensive caching strategies for optimal performance
"""

import asyncio
import json
import time
import hashlib
import pickle
import gzip
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union, Callable, TypeVar, Generic
from dataclasses import dataclass, asdict
from collections import defaultdict
import logging
from contextlib import asynccontextmanager

# Third-party imports (would need to be added to requirements.txt)
try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

try:
    import memcache
    MEMCACHED_AVAILABLE = True
except ImportError:
    MEMCACHED_AVAILABLE = False

# ============================================================================
# Types and Configuration
# ============================================================================

T = TypeVar('T')

@dataclass
class CacheConfig:
    """Cache configuration"""
    enabled: bool = True
    default_ttl: int = 3600  # 1 hour
    max_memory_size: int = 100 * 1024 * 1024  # 100MB
    compression_enabled: bool = True
    compression_threshold: int = 1024  # 1KB
    serialization_format: str = 'pickle'  # 'pickle', 'json'
    
    # Redis configuration
    redis_enabled: bool = False
    redis_url: str = 'redis://localhost:6379'
    redis_db: int = 0
    redis_max_connections: int = 10
    
    # Memcached configuration
    memcached_enabled: bool = False
    memcached_servers: List[str] = None
    
    # Memory cache configuration
    memory_enabled: bool = True
    memory_max_entries: int = 10000

@dataclass
class CacheEntry(Generic[T]):
    """Cache entry with metadata"""
    key: str
    value: T
    created_at: datetime
    expires_at: datetime
    access_count: int = 0
    last_accessed: datetime = None
    size: int = 0
    compressed: bool = False
    tags: List[str] = None

@dataclass
class CacheStats:
    """Cache statistics"""
    hits: int = 0
    misses: int = 0
    sets: int = 0
    deletes: int = 0
    evictions: int = 0
    memory_usage: int = 0
    entry_count: int = 0
    hit_rate: float = 0.0
    compression_ratio: float = 0.0

# ============================================================================
# Cache Backends
# ============================================================================

class CacheBackend:
    """Abstract cache backend"""
    
    async def get(self, key: str) -> Optional[Any]:
        raise NotImplementedError
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        raise NotImplementedError
    
    async def delete(self, key: str) -> bool:
        raise NotImplementedError
    
    async def clear(self) -> bool:
        raise NotImplementedError
    
    async def exists(self, key: str) -> bool:
        raise NotImplementedError
    
    async def ttl(self, key: str) -> Optional[int]:
        raise NotImplementedError

class MemoryCache(CacheBackend):
    """In-memory cache backend"""
    
    def __init__(self, config: CacheConfig):
        self.config = config
        self.cache: Dict[str, CacheEntry] = {}
        self.stats = CacheStats()
        self.logger = logging.getLogger('memory_cache')
    
    async def get(self, key: str) -> Optional[Any]:
        entry = self.cache.get(key)
        
        if not entry:
            self.stats.misses += 1
            return None
        
        # Check expiration
        if entry.expires_at < datetime.utcnow():
            await self.delete(key)
            self.stats.misses += 1
            return None
        
        # Update access statistics
        entry.access_count += 1
        entry.last_accessed = datetime.utcnow()
        
        self.stats.hits += 1
        self._update_hit_rate()
        
        return entry.value
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        try:
            ttl = ttl or self.config.default_ttl
            expires_at = datetime.utcnow() + timedelta(seconds=ttl)
            
            # Calculate size
            size = len(pickle.dumps(value))
            
            # Check memory limits
            if len(self.cache) >= self.config.memory_max_entries:
                await self._evict_lru()
            
            entry = CacheEntry(
                key=key,
                value=value,
                created_at=datetime.utcnow(),
                expires_at=expires_at,
                size=size,
                tags=[]
            )
            
            self.cache[key] = entry
            self.stats.sets += 1
            self.stats.memory_usage += size
            self.stats.entry_count = len(self.cache)
            
            return True
        except Exception as e:
            self.logger.error(f"Failed to set cache key {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        entry = self.cache.pop(key, None)
        if entry:
            self.stats.deletes += 1
            self.stats.memory_usage -= entry.size
            self.stats.entry_count = len(self.cache)
            return True
        return False
    
    async def clear(self) -> bool:
        self.cache.clear()
        self.stats.memory_usage = 0
        self.stats.entry_count = 0
        return True
    
    async def exists(self, key: str) -> bool:
        entry = self.cache.get(key)
        if entry and entry.expires_at >= datetime.utcnow():
            return True
        return False
    
    async def ttl(self, key: str) -> Optional[int]:
        entry = self.cache.get(key)
        if entry:
            remaining = (entry.expires_at - datetime.utcnow()).total_seconds()
            return max(0, int(remaining))
        return None
    
    async def _evict_lru(self):
        """Evict least recently used entry"""
        if not self.cache:
            return
        
        # Find LRU entry
        lru_key = min(
            self.cache.keys(),
            key=lambda k: self.cache[k].last_accessed or self.cache[k].created_at
        )
        
        await self.delete(lru_key)
        self.stats.evictions += 1
    
    def _update_hit_rate(self):
        total_requests = self.stats.hits + self.stats.misses
        if total_requests > 0:
            self.stats.hit_rate = self.stats.hits / total_requests

class RedisCache(CacheBackend):
    """Redis cache backend"""
    
    def __init__(self, config: CacheConfig):
        self.config = config
        self.redis_pool = None
        self.stats = CacheStats()
        self.logger = logging.getLogger('redis_cache')
    
    async def initialize(self):
        """Initialize Redis connection pool"""
        if not REDIS_AVAILABLE:
            raise RuntimeError("Redis not available")
        
        self.redis_pool = redis.ConnectionPool.from_url(
            self.config.redis_url,
            db=self.config.redis_db,
            max_connections=self.config.redis_max_connections
        )
    
    async def get_redis(self):
        """Get Redis connection"""
        if not self.redis_pool:
            await self.initialize()
        return redis.Redis(connection_pool=self.redis_pool)
    
    async def get(self, key: str) -> Optional[Any]:
        try:
            r = await self.get_redis()
            data = await r.get(key)
            
            if data is None:
                self.stats.misses += 1
                return None
            
            # Deserialize
            value = self._deserialize(data)
            self.stats.hits += 1
            self._update_hit_rate()
            
            return value
        except Exception as e:
            self.logger.error(f"Redis get error for key {key}: {e}")
            self.stats.misses += 1
            return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        try:
            r = await self.get_redis()
            ttl = ttl or self.config.default_ttl
            
            # Serialize
            data = self._serialize(value)
            
            await r.setex(key, ttl, data)
            self.stats.sets += 1
            
            return True
        except Exception as e:
            self.logger.error(f"Redis set error for key {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        try:
            r = await self.get_redis()
            result = await r.delete(key)
            
            if result:
                self.stats.deletes += 1
                return True
            return False
        except Exception as e:
            self.logger.error(f"Redis delete error for key {key}: {e}")
            return False
    
    async def clear(self) -> bool:
        try:
            r = await self.get_redis()
            await r.flushdb()
            return True
        except Exception as e:
            self.logger.error(f"Redis clear error: {e}")
            return False
    
    async def exists(self, key: str) -> bool:
        try:
            r = await self.get_redis()
            return bool(await r.exists(key))
        except Exception as e:
            self.logger.error(f"Redis exists error for key {key}: {e}")
            return False
    
    async def ttl(self, key: str) -> Optional[int]:
        try:
            r = await self.get_redis()
            ttl_value = await r.ttl(key)
            return ttl_value if ttl_value > 0 else None
        except Exception as e:
            self.logger.error(f"Redis TTL error for key {key}: {e}")
            return None
    
    def _serialize(self, value: Any) -> bytes:
        """Serialize value for storage"""
        if self.config.serialization_format == 'json':
            data = json.dumps(value, default=str).encode('utf-8')
        else:
            data = pickle.dumps(value)
        
        # Compress if enabled and beneficial
        if (self.config.compression_enabled and 
            len(data) > self.config.compression_threshold):
            data = gzip.compress(data)
        
        return data
    
    def _deserialize(self, data: bytes) -> Any:
        """Deserialize value from storage"""
        # Try decompression first
        try:
            data = gzip.decompress(data)
        except:
            pass  # Not compressed
        
        if self.config.serialization_format == 'json':
            return json.loads(data.decode('utf-8'))
        else:
            return pickle.loads(data)
    
    def _update_hit_rate(self):
        total_requests = self.stats.hits + self.stats.misses
        if total_requests > 0:
            self.stats.hit_rate = self.stats.hits / total_requests

# ============================================================================
# Multi-Level Cache Manager
# ============================================================================

class CacheManager:
    """Multi-level cache manager with fallback support"""
    
    def __init__(self, config: CacheConfig):
        self.config = config
        self.backends: List[CacheBackend] = []
        self.stats = CacheStats()
        self.logger = logging.getLogger('cache_manager')
        
        # Initialize backends
        if config.memory_enabled:
            self.backends.append(MemoryCache(config))
        
        if config.redis_enabled and REDIS_AVAILABLE:
            redis_backend = RedisCache(config)
            asyncio.create_task(redis_backend.initialize())
            self.backends.append(redis_backend)
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache with fallback"""
        if not self.config.enabled:
            return None
        
        for i, backend in enumerate(self.backends):
            try:
                value = await backend.get(key)
                if value is not None:
                    # Populate higher-level caches
                    await self._populate_higher_levels(key, value, i)
                    self.stats.hits += 1
                    self._update_hit_rate()
                    return value
            except Exception as e:
                self.logger.warning(f"Backend {i} get error: {e}")
                continue
        
        self.stats.misses += 1
        self._update_hit_rate()
        return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None, tags: List[str] = None) -> bool:
        """Set value in all cache levels"""
        if not self.config.enabled:
            return False
        
        success = False
        for backend in self.backends:
            try:
                if await backend.set(key, value, ttl):
                    success = True
            except Exception as e:
                self.logger.warning(f"Backend set error: {e}")
                continue
        
        if success:
            self.stats.sets += 1
        
        return success
    
    async def delete(self, key: str) -> bool:
        """Delete from all cache levels"""
        if not self.config.enabled:
            return False
        
        success = False
        for backend in self.backends:
            try:
                if await backend.delete(key):
                    success = True
            except Exception as e:
                self.logger.warning(f"Backend delete error: {e}")
                continue
        
        if success:
            self.stats.deletes += 1
        
        return success
    
    async def clear(self) -> bool:
        """Clear all cache levels"""
        success = False
        for backend in self.backends:
            try:
                if await backend.clear():
                    success = True
            except Exception as e:
                self.logger.warning(f"Backend clear error: {e}")
                continue
        
        return success
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in any cache level"""
        for backend in self.backends:
            try:
                if await backend.exists(key):
                    return True
            except Exception as e:
                self.logger.warning(f"Backend exists error: {e}")
                continue
        
        return False
    
    async def _populate_higher_levels(self, key: str, value: Any, found_level: int):
        """Populate higher-level caches when value found in lower level"""
        for i in range(found_level):
            try:
                await self.backends[i].set(key, value)
            except Exception as e:
                self.logger.warning(f"Failed to populate cache level {i}: {e}")
    
    def _update_hit_rate(self):
        total_requests = self.stats.hits + self.stats.misses
        if total_requests > 0:
            self.stats.hit_rate = self.stats.hits / total_requests
    
    def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive cache statistics"""
        return {
            'manager_stats': asdict(self.stats),
            'backend_stats': [
                getattr(backend, 'stats', None) for backend in self.backends
            ]
        }

# ============================================================================
# Cache Decorators and Utilities
# ============================================================================

def cache_key(*args, **kwargs) -> str:
    """Generate cache key from function arguments"""
    key_parts = []
    
    # Add positional arguments
    for arg in args:
        if hasattr(arg, '__dict__'):
            key_parts.append(str(hash(frozenset(arg.__dict__.items()))))
        else:
            key_parts.append(str(arg))
    
    # Add keyword arguments
    for k, v in sorted(kwargs.items()):
        key_parts.append(f"{k}:{v}")
    
    key_string = ":".join(key_parts)
    return hashlib.md5(key_string.encode()).hexdigest()

def cached(
    ttl: Optional[int] = None,
    key_prefix: str = "",
    tags: List[str] = None,
    skip_cache: Callable = None
):
    """Decorator for caching function results"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Check if we should skip cache
            if skip_cache and skip_cache(*args, **kwargs):
                return await func(*args, **kwargs)
            
            # Generate cache key
            func_name = f"{func.__module__}.{func.__name__}"
            key = f"{key_prefix}{func_name}:{cache_key(*args, **kwargs)}"
            
            # Try to get from cache
            cache_manager = get_cache_manager()
            if cache_manager:
                cached_result = await cache_manager.get(key)
                if cached_result is not None:
                    return cached_result
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Store in cache
            if cache_manager and result is not None:
                await cache_manager.set(key, result, ttl, tags)
            
            return result
        
        return wrapper
    return decorator

# ============================================================================
# Context Managers
# ============================================================================

@asynccontextmanager
async def cache_context(key: str, ttl: Optional[int] = None):
    """Context manager for manual cache management"""
    cache_manager = get_cache_manager()
    
    if cache_manager:
        # Try to get existing value
        cached_value = await cache_manager.get(key)
        if cached_value is not None:
            yield cached_value
            return
    
    # Value not in cache, yield None and cache the result
    result = None
    
    def set_result(value):
        nonlocal result
        result = value
    
    yield set_result
    
    # Cache the result if provided
    if cache_manager and result is not None:
        await cache_manager.set(key, result, ttl)

# ============================================================================
# Global Cache Manager
# ============================================================================

_cache_manager: Optional[CacheManager] = None

def initialize_cache(config: CacheConfig) -> CacheManager:
    """Initialize global cache manager"""
    global _cache_manager
    _cache_manager = CacheManager(config)
    return _cache_manager

def get_cache_manager() -> Optional[CacheManager]:
    """Get global cache manager instance"""
    return _cache_manager

# ============================================================================
# Cache Warming and Preloading
# ============================================================================

class CacheWarmer:
    """Cache warming utility for preloading frequently accessed data"""
    
    def __init__(self, cache_manager: CacheManager):
        self.cache_manager = cache_manager
        self.logger = logging.getLogger('cache_warmer')
    
    async def warm_cache(self, warming_functions: List[Callable]):
        """Execute cache warming functions"""
        self.logger.info(f"Starting cache warming with {len(warming_functions)} functions")
        
        tasks = []
        for func in warming_functions:
            task = asyncio.create_task(self._safe_warm(func))
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        success_count = sum(1 for r in results if not isinstance(r, Exception))
        self.logger.info(f"Cache warming completed: {success_count}/{len(warming_functions)} successful")
    
    async def _safe_warm(self, func: Callable):
        """Safely execute warming function"""
        try:
            await func()
        except Exception as e:
            self.logger.error(f"Cache warming function failed: {e}")

# ============================================================================
# Default Configuration
# ============================================================================

DEFAULT_CACHE_CONFIG = CacheConfig(
    enabled=True,
    default_ttl=3600,  # 1 hour
    max_memory_size=100 * 1024 * 1024,  # 100MB
    compression_enabled=True,
    compression_threshold=1024,  # 1KB
    serialization_format='pickle',
    
    # Redis configuration from environment
    redis_enabled=REDIS_AVAILABLE,
    redis_url='redis://localhost:6379',
    redis_db=0,
    redis_max_connections=10,
    
    # Memory cache
    memory_enabled=True,
    memory_max_entries=10000
)

# ============================================================================
# Example Usage Functions
# ============================================================================

@cached(ttl=300, key_prefix="user:", tags=["users"])
async def get_user_data(user_id: str):
    """Example cached function"""
    # Simulate database query
    await asyncio.sleep(0.1)
    return {"id": user_id, "name": f"User {user_id}"}

@cached(ttl=600, key_prefix="fsrs:", tags=["fsrs", "questions"])
async def get_fsrs_questions(user_id: str, limit: int = 10):
    """Example FSRS questions cache"""
    # Simulate FSRS calculation
    await asyncio.sleep(0.2)
    return [{"id": i, "question": f"Question {i}"} for i in range(limit)]

async def warm_user_cache():
    """Example cache warming function"""
    cache_manager = get_cache_manager()
    if not cache_manager:
        return
    
    # Warm frequently accessed user data
    popular_users = ["user1", "user2", "user3"]
    for user_id in popular_users:
        await get_user_data(user_id)

async def warm_fsrs_cache():
    """Example FSRS cache warming function"""
    cache_manager = get_cache_manager()
    if not cache_manager:
        return
    
    # Warm FSRS data for active users
    active_users = ["user1", "user2"]
    for user_id in active_users:
        await get_fsrs_questions(user_id)