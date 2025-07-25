import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { 
  useUnifiedStore, 
  useUnifiedActions, 
  useUnifiedSettings,
  useUnifiedLoading,
  useUnifiedErrors
} from '../store/unified'
import { 
  FSRSOverview,
  FSRSStateDistribution,
  ProgressHeatmap,
  DailyProgressRing,
  LearningStreak
} from '../components/statistics/FSRSStatsComponents'
import { SimpleLineChart } from '../components/statistics/CustomCharts'
import HomeButton from '../components/HomeButton'
import BottomNavigation from '../components/BottomNavigation'
import LoadingSpinner from '../components/LoadingSpinner'
import { 
  BarChart3, 
  Target, 
  TrendingUp, 
  Calendar, 
  Clock,
  CheckCircle,
  XCircle,
  Award,
  Activity,
  RefreshCw,
  Settings,
  Download
} from 'lucide-react'

const StatisticsEnhanced = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  
  // Unified store data
  const store = useUnifiedStore()
  const actions = useUnifiedActions()
  const settings = useUnifiedSettings()
  const loading = useUnifiedLoading()
  const errors = useUnifiedErrors()
  
  // Local state
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedTimeRange, setSelectedTimeRange] = useState<'week' | 'month' | 'all'>('month')
  
  // Get user ID from store
  const userId = store.user?.id
  
  // Load data on mount
  useEffect(() => {
    if (!userId) return
    
    const loadAllData = async () => {
      try {
        await Promise.allSettled([
          actions.loadUserStats(userId),
          actions.loadDailyProgress(userId),
          actions.loadStreakDays(userId, selectedTimeRange === 'week' ? 7 : selectedTimeRange === 'month' ? 30 : 90),
          settings.useFSRS ? actions.loadFSRSStats(userId) : Promise.resolve(),
        ])
      } catch (error) {
        console.error('Error loading statistics:', error)
      }
    }
    
    loadAllData()
  }, [userId, selectedTimeRange, settings.useFSRS])
  
  // Refresh handler
  const handleRefresh = async () => {
    if (!userId || isRefreshing) return
    
    setIsRefreshing(true)
    try {
      // Clear cache and reload fresh data
      actions.invalidateCache('userStats')
      actions.invalidateCache('dailyProgress')
      actions.invalidateCache('streakDays')
      if (settings.useFSRS) {
        actions.invalidateCache('fsrsStats')
      }
      
      await Promise.allSettled([
        actions.loadUserStats(userId),
        actions.loadDailyProgress(userId),
        actions.loadStreakDays(userId, selectedTimeRange === 'week' ? 7 : selectedTimeRange === 'month' ? 30 : 90),
        settings.useFSRS ? actions.loadFSRSStats(userId) : Promise.resolve(),
      ])
    } catch (error) {
      console.error('Error refreshing statistics:', error)
    } finally {
      setIsRefreshing(false)
    }
  }
  
  // Calculate derived statistics
  const derivedStats = useMemo(() => {
    const userStats = store.userStats
    if (!userStats) return null
    
    const { total_questions, answered, correct } = userStats
    const incorrect = answered - correct
    const unanswered = total_questions - answered
    const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0
    const completionRate = total_questions > 0 ? Math.round((answered / total_questions) * 100) : 0
    
    return {
      accuracy,
      completionRate,
      incorrect,
      unanswered,
      totalQuestions: total_questions,
      answered,
      correct
    }
  }, [store.userStats])
  
  // Prepare trend data
  const trendData = useMemo(() => {
    if (!store.streakDays) return []
    
    return store.streakDays
      .slice(-7) // Last 7 days
      .map(day => ({
        name: new Date(day.date).toLocaleDateString('ru', { weekday: 'short' }),
        value: day.correct_answers
      }))
  }, [store.streakDays])
  
  // Loading state
  if (loading.userStats || loading.dailyProgress) {
    return <LoadingSpinner size={64} fullScreen />
  }
  
  // Error state
  if (errors.userStats || errors.dailyProgress) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}>
        <div style={{ 
          color: '#dc2626', 
          marginBottom: '16px',
          fontSize: '18px',
          fontWeight: '600',
          textAlign: 'center'
        }}>
          Ошибка загрузки статистики
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={handleRefresh}
            style={{
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <RefreshCw size={16} />
            Повторить
          </button>
          <button 
            onClick={() => navigate('/home')}
            style={{
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              cursor: 'pointer'
            }}
          >
            На главную
          </button>
        </div>
      </div>
    )
  }
  
  // No data state
  if (!derivedStats) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}>
        <div style={{ 
          marginBottom: '16px',
          fontSize: '18px',
          fontWeight: '600',
          textAlign: 'center'
        }}>
          Статистика недоступна
        </div>
        <p style={{
          color: '#6b7280',
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          Начните изучение для получения статистики
        </p>
        <button 
          onClick={() => navigate('/home')}
          style={{
            backgroundColor: '#059669',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 24px',
            cursor: 'pointer'
          }}
        >
          Начать изучение
        </button>
      </div>
    )
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f8fafc', 
      paddingBottom: '80px' 
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        padding: '16px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <HomeButton />
            <h1 style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#111827',
              margin: 0
            }}>
              Статистика обучения
            </h1>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                padding: '8px',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                opacity: isRefreshing ? 0.6 : 1
              }}
            >
              <RefreshCw 
                size={16} 
                color="#6b7280"
                style={{
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
                }}
              />
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '24px', gap: '24px', display: 'flex', flexDirection: 'column' }}>
        {/* Time Range Selector */}
        <div style={{
          display: 'flex',
          gap: '8px',
          backgroundColor: 'white',
          padding: '4px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          {(['week', 'month', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setSelectedTimeRange(range)}
              style={{
                flex: 1,
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: selectedTimeRange === range ? '#059669' : 'transparent',
                color: selectedTimeRange === range ? 'white' : '#6b7280',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {range === 'week' ? 'Неделя' : range === 'month' ? 'Месяц' : 'Все время'}
            </button>
          ))}
        </div>

        {/* FSRS Overview */}
        {settings.useFSRS ? (
          <FSRSOverview 
            fsrsStats={store.fsrsStats}
            userStats={store.userStats}
            loading={loading.fsrsStats}
          />
        ) : (
          /* Basic Overview for non-FSRS users */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '16px'
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              textAlign: 'center'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px'
              }}>
                <Target size={24} color="#059669" />
              </div>
              <h3 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#111827',
                margin: '0 0 4px 0'
              }}>
                {derivedStats.accuracy}%
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: 0
              }}>
                Точность ответов
              </p>
            </div>

            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              textAlign: 'center'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#fef3c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px'
              }}>
                <BarChart3 size={24} color="#f59e0b" />
              </div>
              <h3 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#111827',
                margin: '0 0 4px 0'
              }}>
                {derivedStats.completionRate}%
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: 0
              }}>
                Прогресс изучения
              </p>
            </div>

            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              textAlign: 'center'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px'
              }}>
                <CheckCircle size={24} color="#059669" />
              </div>
              <h3 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#111827',
                margin: '0 0 4px 0'
              }}>
                {derivedStats.correct}
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: 0
              }}>
                Правильных ответов
              </p>
            </div>

            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              textAlign: 'center'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px'
              }}>
                <Activity size={24} color="#6b7280" />
              </div>
              <h3 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#111827',
                margin: '0 0 4px 0'
              }}>
                {derivedStats.unanswered}
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: 0
              }}>
                Осталось изучить
              </p>
            </div>
          </div>
        )}

        {/* Daily Progress and Streak */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: window.innerWidth > 768 ? '1fr 1fr' : '1fr',
          gap: '16px'
        }}>
          <DailyProgressRing 
            dailyProgress={store.dailyProgress}
            dailyGoal={settings.manualDailyGoal || 20}
          />
          <LearningStreak streakDays={store.streakDays} />
        </div>

        {/* Progress Trend */}
        {trendData.length > 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#111827',
              margin: '0 0 16px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <TrendingUp size={20} />
              Динамика за неделю
            </h3>
            <SimpleLineChart 
              data={trendData}
              height={200}
              color="#059669"
              showDots={true}
            />
          </div>
        )}

        {/* FSRS State Distribution */}
        {settings.useFSRS && store.fsrsStats && (
          <FSRSStateDistribution fsrsStats={store.fsrsStats} />
        )}

        {/* Activity Heatmap */}
        <ProgressHeatmap streakDays={store.streakDays} />

        {/* Detailed Statistics */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#111827',
            margin: '0 0 16px 0'
          }}>
            Подробная статистика
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px'
            }}>
              <span style={{ color: '#6b7280', fontSize: '14px' }}>Всего вопросов</span>
              <span style={{ fontWeight: 'bold', color: '#111827' }}>{derivedStats.totalQuestions}</span>
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              backgroundColor: '#f0fdf4',
              borderRadius: '8px'
            }}>
              <span style={{ color: '#6b7280', fontSize: '14px' }}>Правильных ответов</span>
              <span style={{ fontWeight: 'bold', color: '#059669' }}>{derivedStats.correct}</span>
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              backgroundColor: '#fef2f2',
              borderRadius: '8px'
            }}>
              <span style={{ color: '#6b7280', fontSize: '14px' }}>Неправильных ответов</span>
              <span style={{ fontWeight: 'bold', color: '#dc2626' }}>{derivedStats.incorrect}</span>
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px'
            }}>
              <span style={{ color: '#6b7280', fontSize: '14px' }}>Не отвечено</span>
              <span style={{ fontWeight: 'bold', color: '#6b7280' }}>{derivedStats.unanswered}</span>
            </div>
          </div>
        </div>
      </div>

      <BottomNavigation />
      
      {/* Add CSS for animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

export default StatisticsEnhanced