// Unified Store Manager with Three-Tier Caching Strategy
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../api/api'
import fsrsApi from '../api/fsrs'
import type {
  UserOut,
  ExamSettingsResponse,
  UserStats,
  DailyProgress,
  AnswersByDay
} from '../api/api'
import type {
  FSRSStats,
  FSRSDueQuestion,
  FSRSCardInfo,
  FSRSDueQuestionsResponse
} from '../api/fsrs'

// ============================================================================
// Cache Types and Interfaces
// ============================================================================

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
  key: string
}

interface CacheMetrics {
  hits: number
  misses: number
  requests: number
  hitRate: number
}

interface RequestState {
  pending: boolean
  promise?: Promise<any>
  timestamp: number
}

// ============================================================================
// Unified Store State Interface
// ============================================================================

interface UnifiedStoreState {
  // Cache layers
  memoryCache: Map<string, CacheEntry<any>>
  indexedDBCache: Map<string, CacheEntry<any>>
  localStorageCache: Map<string, CacheEntry<any>>
  
  // Request deduplication
  pendingRequests: Map<string, RequestState>
  
  // Cache metrics
  metrics: CacheMetrics
  
  // Current data state
  user: UserOut | null
  examSettings: ExamSettingsResponse | null
  userStats: UserStats | null
  dailyProgress: DailyProgress | null
  streakDays: AnswersByDay[] | null
  topics: string[] | null
  remainingCount: number | null
  
  // FSRS data
  fsrsStats: FSRSStats | null
  fsrsDueQuestions: FSRSDueQuestion[] | null
  fsrsCardInfoCache: Map<string, FSRSCardInfo>
  
  // Settings
  settings: {
    useFSRS: boolean
    autoRating: boolean
    examCountry: string
    examLanguage: string
    uiLanguage: string
    examDate: string | null
    manualDailyGoal: number | null
  }
  
  // Loading states
  loading: {
    user: boolean
    examSettings: boolean
    userStats: boolean
    dailyProgress: boolean
    streakDays: boolean
    topics: boolean
    remainingCount: boolean
    fsrsStats: boolean
    fsrsDueQuestions: boolean
  }
  
  // Error states
  errors: {
    user: string | null
    examSettings: string | null
    userStats: string | null
    dailyProgress: string | null
    streakDays: string | null
    topics: string | null
    remainingCount: string | null
    fsrsStats: string | null
    fsrsDueQuestions: string | null
  }
}

interface UnifiedStoreActions {
  // Cache management
  getCachedData: <T>(key: string) => T | null
  setCachedData: <T>(key: string, data: T, ttl?: number) => void
  invalidateCache: (pattern?: string) => void
  clearCache: () => void
  getCacheMetrics: () => CacheMetrics
  
  // Request deduplication
  executeWithDeduplication: <T>(key: string, fn: () => Promise<T>) => Promise<T>
  
  // Data loading methods
  loadUser: (telegramId: number) => Promise<UserOut>
  loadExamSettings: (userId: string) => Promise<ExamSettingsResponse>
  loadUserStats: (userId: string) => Promise<UserStats>
  loadDailyProgress: (userId: string, targetDate?: string) => Promise<DailyProgress>
  loadStreakDays: (userId: string, days?: number) => Promise<AnswersByDay[]>
  loadTopics: (country: string, language: string) => Promise<string[]>
  loadRemainingCount: (userId: string, country: string, language: string) => Promise<number>
  
  // FSRS methods
  loadFSRSStats: (userId: string) => Promise<FSRSStats>
  loadFSRSDueQuestions: (userId: string, country: string, language: string) => Promise<FSRSDueQuestion[]>
  getFSRSCardInfo: (userId: string, questionId: number) => Promise<FSRSCardInfo>
  
  // Settings management
  updateSettings: (updates: Partial<UnifiedStoreState['settings']>) => void
  
  // Data updates
  updateUser: (userId: string, updates: any) => Promise<UserOut>
  updateExamSettings: (userId: string, settings: any) => Promise<ExamSettingsResponse>
  
  // Error handling
  clearError: (key: keyof UnifiedStoreState['errors']) => void
  clearAllErrors: () => void
  
  // Utility methods
  refreshAllData: (userId: string) => Promise<void>
  preloadCriticalData: (userId: string, country: string, language: string) => Promise<void>
}

type UnifiedStore = UnifiedStoreState & UnifiedStoreActions

// ============================================================================
// Cache Configuration
// ============================================================================

const CACHE_CONFIG = {
  // TTL in milliseconds
  USER: 10 * 60 * 1000,           // 10 minutes
  EXAM_SETTINGS: 30 * 60 * 1000,  // 30 minutes
  USER_STATS: 5 * 60 * 1000,      // 5 minutes
  DAILY_PROGRESS: 2 * 60 * 1000,  // 2 minutes
  STREAK_DAYS: 10 * 60 * 1000,    // 10 minutes
  TOPICS: 60 * 60 * 1000,         // 1 hour
  REMAINING_COUNT: 5 * 60 * 1000, // 5 minutes
  FSRS_STATS: 10 * 60 * 1000,     // 10 minutes
  FSRS_DUE_QUESTIONS: 5 * 60 * 1000, // 5 minutes
  FSRS_CARD_INFO: 30 * 60 * 1000, // 30 minutes
} as const

// ============================================================================
// Cache Utility Functions
// ============================================================================

const generateCacheKey = (prefix: string, ...params: (string | number)[]): string => {
  return `${prefix}:${params.join(':')}`
}

const isExpired = (entry: CacheEntry<any>): boolean => {
  return Date.now() - entry.timestamp > entry.ttl
}

const createCacheEntry = <T>(data: T, ttl: number, key: string): CacheEntry<T> => ({
  data,
  timestamp: Date.now(),
  ttl,
  key
})

// ============================================================================
// IndexedDB Cache Implementation
// ============================================================================

class IndexedDBCache {
  private dbName = 'unified-store-cache'
  private version = 1
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' })
        }
      }
    })
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readonly')
      const store = transaction.objectStore('cache')
      const request = store.get(key)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const result = request.result
        if (result && !isExpired(result)) {
          resolve(result)
        } else {
          if (result) this.delete(key) // Clean up expired entry
          resolve(null)
        }
      }
    })
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite')
      const store = transaction.objectStore('cache')
      const request = store.put(entry)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async delete(key: string): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite')
      const store = transaction.objectStore('cache')
      const request = store.delete(key)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async clear(): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite')
      const store = transaction.objectStore('cache')
      const request = store.clear()
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }
}

// ============================================================================
// Unified Store Implementation
// ============================================================================

const indexedDBCache = new IndexedDBCache()

export const useUnifiedStore = create<UnifiedStore>()(
  persist(
    (set, get) => ({
      // Initial state
      memoryCache: new Map(),
      indexedDBCache: new Map(),
      localStorageCache: new Map(),
      pendingRequests: new Map(),
      metrics: { hits: 0, misses: 0, requests: 0, hitRate: 0 },
      
      user: null,
      examSettings: null,
      userStats: null,
      dailyProgress: null,
      streakDays: null,
      topics: null,
      remainingCount: null,
      
      fsrsStats: null,
      fsrsDueQuestions: null,
      fsrsCardInfoCache: new Map(),
      
      settings: {
        useFSRS: false,
        autoRating: true,
        examCountry: 'am',
        examLanguage: 'ru',
        uiLanguage: 'ru',
        examDate: null,
        manualDailyGoal: null,
      },
      
      loading: {
        user: false,
        examSettings: false,
        userStats: false,
        dailyProgress: false,
        streakDays: false,
        topics: false,
        remainingCount: false,
        fsrsStats: false,
        fsrsDueQuestions: false,
      },
      
      errors: {
        user: null,
        examSettings: null,
        userStats: null,
        dailyProgress: null,
        streakDays: null,
        topics: null,
        remainingCount: null,
        fsrsStats: null,
        fsrsDueQuestions: null,
      },

      // Cache management methods
      getCachedData: <T>(key: string): T | null => {
        const state = get()
        
        // Check memory cache first (fastest)
        const memoryEntry = state.memoryCache.get(key)
        if (memoryEntry && !isExpired(memoryEntry)) {
          set(state => ({
            metrics: {
              ...state.metrics,
              hits: state.metrics.hits + 1,
              requests: state.metrics.requests + 1,
              hitRate: (state.metrics.hits + 1) / (state.metrics.requests + 1)
            }
          }))
          return memoryEntry.data
        }
        
        // Check localStorage cache (medium speed)
        const localEntry = state.localStorageCache.get(key)
        if (localEntry && !isExpired(localEntry)) {
          // Promote to memory cache
          set(state => ({
            memoryCache: new Map(state.memoryCache.set(key, localEntry)),
            metrics: {
              ...state.metrics,
              hits: state.metrics.hits + 1,
              requests: state.metrics.requests + 1,
              hitRate: (state.metrics.hits + 1) / (state.metrics.requests + 1)
            }
          }))
          return localEntry.data
        }
        
        // Check IndexedDB cache (slowest, but async - handled separately)
        set(state => ({
          metrics: {
            ...state.metrics,
            misses: state.metrics.misses + 1,
            requests: state.metrics.requests + 1,
            hitRate: state.metrics.hits / (state.metrics.requests + 1)
          }
        }))
        
        return null
      },

      setCachedData: <T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void => {
        const entry = createCacheEntry(data, ttl, key)
        
        set(state => ({
          memoryCache: new Map(state.memoryCache.set(key, entry)),
          localStorageCache: new Map(state.localStorageCache.set(key, entry))
        }))
        
        // Async IndexedDB storage
        indexedDBCache.set(key, entry).catch(console.error)
      },

      invalidateCache: (pattern?: string): void => {
        set(state => {
          const newMemoryCache = new Map(state.memoryCache)
          const newLocalCache = new Map(state.localStorageCache)
          
          if (pattern) {
            // Remove entries matching pattern
            for (const key of newMemoryCache.keys()) {
              if (key.includes(pattern)) {
                newMemoryCache.delete(key)
                newLocalCache.delete(key)
                indexedDBCache.delete(key).catch(console.error)
              }
            }
          } else {
            // Clear all caches
            newMemoryCache.clear()
            newLocalCache.clear()
            indexedDBCache.clear().catch(console.error)
          }
          
          return {
            memoryCache: newMemoryCache,
            localStorageCache: newLocalCache
          }
        })
      },

      clearCache: (): void => {
        get().invalidateCache()
      },

      getCacheMetrics: (): CacheMetrics => {
        return get().metrics
      },

      // Request deduplication
      executeWithDeduplication: async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
        const state = get()
        const existing = state.pendingRequests.get(key)
        
        if (existing && existing.pending && existing.promise) {
          console.log(`🔄 Deduplicating request: ${key}`)
          return existing.promise
        }
        
        const promise = fn()
        
        set(state => ({
          pendingRequests: new Map(state.pendingRequests.set(key, {
            pending: true,
            promise,
            timestamp: Date.now()
          }))
        }))
        
        try {
          const result = await promise
          
          set(state => ({
            pendingRequests: new Map(state.pendingRequests.set(key, {
              pending: false,
              promise: undefined,
              timestamp: Date.now()
            }))
          }))
          
          return result
        } catch (error) {
          set(state => {
            const newRequests = new Map(state.pendingRequests)
            newRequests.delete(key)
            return { pendingRequests: newRequests }
          })
          throw error
        }
      },

      // Data loading methods
      loadUser: async (telegramId: number): Promise<UserOut> => {
        const cacheKey = generateCacheKey('user', telegramId)
        const cached = get().getCachedData<UserOut>(cacheKey)
        
        if (cached) {
          set({ user: cached })
          return cached
        }
        
        return get().executeWithDeduplication(cacheKey, async () => {
          set(state => ({
            loading: { ...state.loading, user: true },
            errors: { ...state.errors, user: null }
          }))
          
          try {
            const response = await api.get<UserOut>(`/users/by-telegram-id/${telegramId}`)
            const userData = response.data
            
            get().setCachedData(cacheKey, userData, CACHE_CONFIG.USER)
            
            set(state => ({
              user: userData,
              loading: { ...state.loading, user: false }
            }))
            
            return userData
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load user'
            set(state => ({
              loading: { ...state.loading, user: false },
              errors: { ...state.errors, user: errorMessage }
            }))
            throw error
          }
        })
      },

      loadExamSettings: async (userId: string): Promise<ExamSettingsResponse> => {
        const cacheKey = generateCacheKey('examSettings', userId)
        const cached = get().getCachedData<ExamSettingsResponse>(cacheKey)
        
        if (cached) {
          set({ examSettings: cached })
          return cached
        }
        
        return get().executeWithDeduplication(cacheKey, async () => {
          set(state => ({
            loading: { ...state.loading, examSettings: true },
            errors: { ...state.errors, examSettings: null }
          }))
          
          try {
            const response = await api.get<ExamSettingsResponse>(`/users/${userId}/exam-settings`)
            const settingsData = response.data
            
            get().setCachedData(cacheKey, settingsData, CACHE_CONFIG.EXAM_SETTINGS)
            
            set(state => ({
              examSettings: settingsData,
              loading: { ...state.loading, examSettings: false }
            }))
            
            return settingsData
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load exam settings'
            set(state => ({
              loading: { ...state.loading, examSettings: false },
              errors: { ...state.errors, examSettings: errorMessage }
            }))
            throw error
          }
        })
      },

      loadUserStats: async (userId: string): Promise<UserStats> => {
        const cacheKey = generateCacheKey('userStats', userId)
        const cached = get().getCachedData<UserStats>(cacheKey)
        
        if (cached) {
          set({ userStats: cached })
          return cached
        }
        
        return get().executeWithDeduplication(cacheKey, async () => {
          set(state => ({
            loading: { ...state.loading, userStats: true },
            errors: { ...state.errors, userStats: null }
          }))
          
          try {
            const response = await api.get<UserStats>(`/users/${userId}/stats`)
            const statsData = response.data
            
            get().setCachedData(cacheKey, statsData, CACHE_CONFIG.USER_STATS)
            
            set(state => ({
              userStats: statsData,
              loading: { ...state.loading, userStats: false }
            }))
            
            return statsData
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load user stats'
            set(state => ({
              loading: { ...state.loading, userStats: false },
              errors: { ...state.errors, userStats: errorMessage }
            }))
            throw error
          }
        })
      },

      loadDailyProgress: async (userId: string, targetDate?: string): Promise<DailyProgress> => {
        const dateToUse = targetDate || new Date().toISOString().split('T')[0]
        const cacheKey = generateCacheKey('dailyProgress', userId, dateToUse)
        const cached = get().getCachedData<DailyProgress>(cacheKey)
        
        if (cached) {
          set({ dailyProgress: cached })
          return cached
        }
        
        return get().executeWithDeduplication(cacheKey, async () => {
          set(state => ({
            loading: { ...state.loading, dailyProgress: true },
            errors: { ...state.errors, dailyProgress: null }
          }))
          
          try {
            const response = await api.get<DailyProgress>(`/users/${userId}/daily-progress?target_date=${dateToUse}`)
            const progressData = response.data
            
            get().setCachedData(cacheKey, progressData, CACHE_CONFIG.DAILY_PROGRESS)
            
            set(state => ({
              dailyProgress: progressData,
              loading: { ...state.loading, dailyProgress: false }
            }))
            
            return progressData
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load daily progress'
            set(state => ({
              loading: { ...state.loading, dailyProgress: false },
              errors: { ...state.errors, dailyProgress: errorMessage }
            }))
            throw error
          }
        })
      },

      loadStreakDays: async (userId: string, days: number = 7): Promise<AnswersByDay[]> => {
        const cacheKey = generateCacheKey('streakDays', userId, days)
        const cached = get().getCachedData<AnswersByDay[]>(cacheKey)
        
        if (cached) {
          set({ streakDays: cached })
          return cached
        }
        
        return get().executeWithDeduplication(cacheKey, async () => {
          set(state => ({
            loading: { ...state.loading, streakDays: true },
            errors: { ...state.errors, streakDays: null }
          }))
          
          try {
            const response = await api.get<AnswersByDay[]>(`/users/${userId}/answers-by-day?days=${days}`)
            const streakData = response.data
            
            get().setCachedData(cacheKey, streakData, CACHE_CONFIG.STREAK_DAYS)
            
            set(state => ({
              streakDays: streakData,
              loading: { ...state.loading, streakDays: false }
            }))
            
            return streakData
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load streak days'
            set(state => ({
              loading: { ...state.loading, streakDays: false },
              errors: { ...state.errors, streakDays: errorMessage }
            }))
            throw error
          }
        })
      },

      loadTopics: async (country: string, language: string): Promise<string[]> => {
        const cacheKey = generateCacheKey('topics', country, language)
        const cached = get().getCachedData<string[]>(cacheKey)
        
        if (cached) {
          set({ topics: cached })
          return cached
        }
        
        return get().executeWithDeduplication(cacheKey, async () => {
          set(state => ({
            loading: { ...state.loading, topics: true },
            errors: { ...state.errors, topics: null }
          }))
          
          try {
            const response = await api.get<{ topics: string[] }>(`/topics?country=${country}&language=${language}`)
            const topicsData = response.data.topics
            
            get().setCachedData(cacheKey, topicsData, CACHE_CONFIG.TOPICS)
            
            set(state => ({
              topics: topicsData,
              loading: { ...state.loading, topics: false }
            }))
            
            return topicsData
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load topics'
            set(state => ({
              loading: { ...state.loading, topics: false },
              errors: { ...state.errors, topics: errorMessage }
            }))
            throw error
          }
        })
      },

      loadRemainingCount: async (userId: string, country: string, language: string): Promise<number> => {
        const cacheKey = generateCacheKey('remainingCount', userId, country, language)
        const cached = get().getCachedData<number>(cacheKey)
        
        if (cached !== null) {
          set({ remainingCount: cached })
          return cached
        }
        
        return get().executeWithDeduplication(cacheKey, async () => {
          set(state => ({
            loading: { ...state.loading, remainingCount: true },
            errors: { ...state.errors, remainingCount: null }
          }))
          
          try {
            const response = await api.get<{ remaining_count: number }>(`/questions/remaining-count`, {
              params: { user_id: userId, country, language }
            })
            const count = response.data.remaining_count
            
            get().setCachedData(cacheKey, count, CACHE_CONFIG.REMAINING_COUNT)
            
            set(state => ({
              remainingCount: count,
              loading: { ...state.loading, remainingCount: false }
            }))
            
            return count
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load remaining count'
            set(state => ({
              loading: { ...state.loading, remainingCount: false },
              errors: { ...state.errors, remainingCount: errorMessage }
            }))
            throw error
          }
        })
      },

      // FSRS methods
      loadFSRSStats: async (userId: string): Promise<FSRSStats> => {
        const cacheKey = generateCacheKey('fsrsStats', userId)
        const cached = get().getCachedData<FSRSStats>(cacheKey)
        
        if (cached) {
          set({ fsrsStats: cached })
          return cached
        }
        
        return get().executeWithDeduplication(cacheKey, async () => {
          set(state => ({
            loading: { ...state.loading, fsrsStats: true },
            errors: { ...state.errors, fsrsStats: null }
          }))
          
          try {
            const statsData = await fsrsApi.getStats(userId)
            
            get().setCachedData(cacheKey, statsData, CACHE_CONFIG.FSRS_STATS)
            
            set(state => ({
              fsrsStats: statsData,
              loading: { ...state.loading, fsrsStats: false }
            }))
            
            return statsData
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load FSRS stats'
            set(state => ({
              loading: { ...state.loading, fsrsStats: false },
              errors: { ...state.errors, fsrsStats: errorMessage }
            }))
            throw error
          }
        })
      },

      loadFSRSDueQuestions: async (userId: string, country: string, language: string): Promise<FSRSDueQuestion[]> => {
        const cacheKey = generateCacheKey('fsrsDueQuestions', userId, country, language)
        const cached = get().getCachedData<FSRSDueQuestion[]>(cacheKey)
        
        if (cached) {
          set({ fsrsDueQuestions: cached })
          return cached
        }
        
        return get().executeWithDeduplication(cacheKey, async () => {
          set(state => ({
            loading: { ...state.loading, fsrsDueQuestions: true },
            errors: { ...state.errors, fsrsDueQuestions: null }
          }))
          
          try {
            const response: FSRSDueQuestionsResponse = await fsrsApi.getDueQuestions(userId, country, language)
            const dueQuestions = response.questions
            
            get().setCachedData(cacheKey, dueQuestions, CACHE_CONFIG.FSRS_DUE_QUESTIONS)
            
            set(state => ({
              fsrsDueQuestions: dueQuestions,
              loading: { ...state.loading, fsrsDueQuestions: false }
            }))
            
            return dueQuestions
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load FSRS due questions'
            set(state => ({
              loading: { ...state.loading, fsrsDueQuestions: false },
              errors: { ...state.errors, fsrsDueQuestions: errorMessage }
            }))
            throw error
          }
        })
      },

      getFSRSCardInfo: async (userId: string, questionId: number): Promise<FSRSCardInfo> => {
        const cacheKey = generateCacheKey('fsrsCardInfo', userId, questionId)
        const cached = get().getCachedData<FSRSCardInfo>(cacheKey)
        
        if (cached) {
          // Also update the fsrsCardInfoCache Map
          set(state => ({
            fsrsCardInfoCache: new Map(state.fsrsCardInfoCache.set(cacheKey, cached))
          }))
          return cached
        }
        
        return get().executeWithDeduplication(cacheKey, async () => {
          try {
            const cardInfo = await fsrsApi.getCardInfo(userId, questionId)
            
            // Cache in both the unified cache and the Map
            get().setCachedData(cacheKey, cardInfo, CACHE_CONFIG.FSRS_CARD_INFO)
            
            set(state => ({
              fsrsCardInfoCache: new Map(state.fsrsCardInfoCache.set(cacheKey, cardInfo))
            }))
            
            return cardInfo
          } catch (error) {
            console.error('Failed to get FSRS card info:', error)
            throw error
          }
        })
      },

      // Settings management
      updateSettings: (updates: Partial<UnifiedStoreState['settings']>): void => {
        set(state => ({
          settings: { ...state.settings, ...updates }
        }))
        
        // Invalidate relevant caches when settings change
        if (updates.examCountry || updates.examLanguage) {
          get().invalidateCache('topics')
          get().invalidateCache('remainingCount')
          get().invalidateCache('fsrsDueQuestions')
        }
      },

      // Data update methods
      updateUser: async (userId: string, updates: any): Promise<UserOut> => {
        try {
          const response = await api.patch<UserOut>(`/users/${userId}`, updates)
          const updatedUser = response.data
          
          // Update cache and state
          const cacheKey = generateCacheKey('user', updatedUser.id)
          get().setCachedData(cacheKey, updatedUser, CACHE_CONFIG.USER)
          
          set({ user: updatedUser })
          
          // Invalidate related caches
          get().invalidateCache('examSettings')
          
          return updatedUser
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update user'
          set(state => ({
            errors: { ...state.errors, user: errorMessage }
          }))
          throw error
        }
      },

      updateExamSettings: async (userId: string, settings: any): Promise<ExamSettingsResponse> => {
        try {
          const response = await api.post<ExamSettingsResponse>(`/users/${userId}/exam-settings`, settings)
          const updatedSettings = response.data
          
          // Update cache and state
          const cacheKey = generateCacheKey('examSettings', userId)
          get().setCachedData(cacheKey, updatedSettings, CACHE_CONFIG.EXAM_SETTINGS)
          
          set({ examSettings: updatedSettings })
          
          return updatedSettings
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update exam settings'
          set(state => ({
            errors: { ...state.errors, examSettings: errorMessage }
          }))
          throw error
        }
      },

      // Error handling
      clearError: (key: keyof UnifiedStoreState['errors']): void => {
        set(state => ({
          errors: { ...state.errors, [key]: null }
        }))
      },

      clearAllErrors: (): void => {
        set(state => ({
          errors: Object.keys(state.errors).reduce((acc, key) => ({
            ...acc,
            [key]: null
          }), {} as UnifiedStoreState['errors'])
        }))
      },

      // Utility methods
      refreshAllData: async (userId: string): Promise<void> => {
        const { settings } = get()
        
        // Clear all caches to force fresh data
        get().clearCache()
        
        // Load all critical data in parallel
        const promises = [
          get().loadUser(parseInt(userId)),
          get().loadExamSettings(userId),
          get().loadUserStats(userId),
          get().loadDailyProgress(userId),
          get().loadStreakDays(userId),
          get().loadTopics(settings.examCountry, settings.examLanguage),
          get().loadRemainingCount(userId, settings.examCountry, settings.examLanguage),
        ]
        
        if (settings.useFSRS) {
          promises.push(
            get().loadFSRSStats(userId).catch(() => null) as Promise<any>,
            get().loadFSRSDueQuestions(userId, settings.examCountry, settings.examLanguage).catch(() => null) as Promise<any>
          )
        }
        
        await Promise.allSettled(promises)
      },

      preloadCriticalData: async (userId: string, country: string, language: string): Promise<void> => {
        // Load most critical data first for immediate UI response
        const criticalPromises = [
          get().loadUser(parseInt(userId)),
          get().loadUserStats(userId),
          get().loadDailyProgress(userId)
        ]
        
        await Promise.allSettled(criticalPromises)
        
        // Then load secondary data
        const secondaryPromises = [
          get().loadExamSettings(userId),
          get().loadTopics(country, language),
          get().loadRemainingCount(userId, country, language),
          get().loadStreakDays(userId)
        ]
        
        await Promise.allSettled(secondaryPromises)
      }
    }),
    {
      name: 'unified-store',
      // Only persist settings and non-sensitive cached data
      partialize: (state) => ({
        settings: state.settings,
        // Persist some cache entries to localStorage tier
        localStorageCache: state.localStorageCache,
        metrics: state.metrics
      })
    }
  )
)

// ============================================================================
// Unified Store Selectors and Hooks
// ============================================================================

// Settings selectors
export const useUnifiedSettings = () => useUnifiedStore((state) => state.settings)
export const useUnifiedUser = () => useUnifiedStore((state) => state.user)
export const useUnifiedUserStats = () => useUnifiedStore((state) => state.userStats)
export const useUnifiedDailyProgress = () => useUnifiedStore((state) => state.dailyProgress)
export const useUnifiedExamSettings = () => useUnifiedStore((state) => state.examSettings)
export const useUnifiedTopics = () => useUnifiedStore((state) => state.topics)
export const useUnifiedRemainingCount = () => useUnifiedStore((state) => state.remainingCount)
export const useUnifiedStreakDays = () => useUnifiedStore((state) => state.streakDays)

// Loading state selectors
export const useUnifiedLoading = () => useUnifiedStore((state) => state.loading)
export const useUnifiedErrors = () => useUnifiedStore((state) => state.errors)

// Cache metrics selector
export const useUnifiedCacheMetrics = () => useUnifiedStore((state) => state.getCacheMetrics())

// Action hooks
export const useUnifiedActions = () => {
  const store = useUnifiedStore()
  return {
    // Data loading
    loadUser: store.loadUser,
    loadExamSettings: store.loadExamSettings,
    loadUserStats: store.loadUserStats,
    loadDailyProgress: store.loadDailyProgress,
    loadStreakDays: store.loadStreakDays,
    loadTopics: store.loadTopics,
    loadRemainingCount: store.loadRemainingCount,
    
    // FSRS methods
    loadFSRSStats: store.loadFSRSStats,
    loadFSRSDueQuestions: store.loadFSRSDueQuestions,
    getFSRSCardInfo: store.getFSRSCardInfo,
    
    // Data updates
    updateUser: store.updateUser,
    updateExamSettings: store.updateExamSettings,
    updateSettings: store.updateSettings,
    
    // Cache management
    getCachedData: store.getCachedData,
    setCachedData: store.setCachedData,
    invalidateCache: store.invalidateCache,
    clearCache: store.clearCache,
    
    // Request deduplication
    executeWithDeduplication: store.executeWithDeduplication,
    
    // Error handling
    clearError: store.clearError,
    clearAllErrors: store.clearAllErrors,
    
    // Utility
    refreshAllData: store.refreshAllData,
    preloadCriticalData: store.preloadCriticalData
  }
}

// ============================================================================
// Backward Compatibility Layer
// ============================================================================

// Legacy session store compatibility
export const useSession = () => {
  const store = useUnifiedStore()
  const actions = useUnifiedActions()
  
  return {
    // User data
    userId: store.user?.id || null,
    cachedUser: store.user,
    
    // Settings
    examCountry: store.settings.examCountry,
    examLanguage: store.settings.examLanguage,
    uiLanguage: store.settings.uiLanguage,
    examDate: store.settings.examDate,
    manualDailyGoal: store.settings.manualDailyGoal,
    useFSRS: store.settings.useFSRS,
    autoRating: store.settings.autoRating,
    
    // Progress data
    dailyProgress: store.dailyProgress?.questions_mastered_today || null,
    dailyProgressDate: store.dailyProgress?.date || null,
    streakDays: store.streakDays || [],
    
    // Actions
    setUserId: (id: string) => {
      // This will be handled by loadUser instead
      console.warn('setUserId is deprecated, use loadUser instead')
    },
    setExamCountry: (country: string) => {
      actions.updateSettings({ examCountry: country })
    },
    setExamLanguage: (language: string) => {
      actions.updateSettings({ examLanguage: language })
    },
    setUiLanguage: (language: string) => {
      actions.updateSettings({ uiLanguage: language })
    },
    setExamDate: (date: string | null) => {
      actions.updateSettings({ examDate: date })
    },
    setManualDailyGoal: (goal: number | null) => {
      actions.updateSettings({ manualDailyGoal: goal })
    },
    setUseFSRS: (enabled: boolean) => {
      actions.updateSettings({ useFSRS: enabled })
    },
    setAutoRating: (enabled: boolean) => {
      actions.updateSettings({ autoRating: enabled })
    },
    setDailyProgress: (count: number, date: string) => {
      // This will be handled by loadDailyProgress instead
      console.warn('setDailyProgress is deprecated, use loadDailyProgress instead')
    },
    setStreakDays: (days: any[]) => {
      // This will be handled by loadStreakDays instead
      console.warn('setStreakDays is deprecated, use loadStreakDays instead')
    }
  }
}

// Legacy helper functions with unified store integration
export const loadUserWithCache = async (telegramId: number) => {
  const actions = useUnifiedActions()
  return actions.loadUser(telegramId)
}

export const loadExamSettingsWithCache = async (userId: string) => {
  const actions = useUnifiedActions()
  return actions.loadExamSettings(userId)
}

export const loadRemainingCountWithCache = async (userId: string, country: string, language: string) => {
  const actions = useUnifiedActions()
  return actions.loadRemainingCount(userId, country, language)
}

export const loadTopicsWithCache = async (country: string, language: string) => {
  const actions = useUnifiedActions()
  return actions.loadTopics(country, language)
}

export const updateUserAndCache = async (userId: string, updates: any) => {
  const actions = useUnifiedActions()
  return actions.updateUser(userId, updates)
}

export const setExamSettingsAndCache = async (userId: string, settings: any) => {
  const actions = useUnifiedActions()
  return actions.updateExamSettings(userId, settings)
}

export const invalidateRemainingCountCache = () => {
  const actions = useUnifiedActions()
  actions.invalidateCache('remainingCount')
}

export const refreshDailyProgress = async (userId: string) => {
  const actions = useUnifiedActions()
  return actions.loadDailyProgress(userId)
}