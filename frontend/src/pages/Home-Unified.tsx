// src/pages/Home-Unified.tsx - Updated Home component using Unified Store
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  useUnifiedStore, 
  useUnifiedActions, 
  useUnifiedUser,
  useUnifiedUserStats,
  useUnifiedDailyProgress,
  useUnifiedExamSettings,
  useUnifiedStreakDays,
  useUnifiedSettings,
  useUnifiedLoading,
  useUnifiedErrors
} from '../store/unified'
import { useStoreMigration } from '../utils/core/storage'
import { useTranslation } from 'react-i18next'
import { calculateDailyGoal } from '../utils/features/goals'
import { getLast7LocalDates, calculateCurrentStreak } from '../utils/features/goals'
import { getStreakText } from '../utils/ui/formatting'
import { Home as HomeIcon, User, BarChart3, Settings, Play, Flame, Calendar, ChevronRight, Sparkles, AlertCircle, Target } from 'lucide-react'
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar'
import 'react-circular-progressbar/dist/styles.css'
import i18n from 'i18next'
import BottomNavigation from '../components/BottomNavigation'

const HomeUnified = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const migration = useStoreMigration('Home')

  // Unified store hooks
  const user = useUnifiedUser()
  const userStats = useUnifiedUserStats()
  const dailyProgress = useUnifiedDailyProgress()
  const examSettings = useUnifiedExamSettings()
  const streakDays = useUnifiedStreakDays()
  const settings = useUnifiedSettings()
  const loading = useUnifiedLoading()
  const errors = useUnifiedErrors()
  const actions = useUnifiedActions()

  // Local state
  const [userName, setUserName] = useState<string | null>(null)
  const [dataInitialized, setDataInitialized] = useState(false)

  // Get progress message function
  const getProgressMessage = (questionsToday: number, dailyGoal: number) => {
    if (questionsToday === 0) {
      return t('home.progressMessage.start')
    } else if (questionsToday > 0 && questionsToday < dailyGoal) {
      return t('home.progressMessage.keepGoing')
    } else {
      return t('home.progressMessage.excellent')
    }
  }

  // Initialize data on component mount
  useEffect(() => {
    const initializeData = async () => {
      const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user
      setUserName(tgUser?.first_name || 'друг')

      if (!tgUser?.id) {
        console.warn('No Telegram user ID available')
        setDataInitialized(true)
        return
      }

      try {
        console.log('🏠 Home-Unified: Initializing with unified store')
        
        // Preload critical data using migration helper
        await migration.preloadData(tgUser.id.toString())
        
        // Update UI language if user data is available
        if (user?.ui_language) {
          actions.updateSettings({ uiLanguage: user.ui_language })
          i18n.changeLanguage(user.ui_language)
        }
        
        setDataInitialized(true)
        console.log('✅ Home-Unified: Data initialization complete')
        
      } catch (error) {
        console.error('❌ Home-Unified: Failed to initialize data:', error)
        setDataInitialized(true)
      }
    }

    initializeData()
  }, [])

  // Navigation handlers
  const handleStart = () => {
    navigate('/mode')
  }

  const handleNewQuestions = () => {
    const params = new URLSearchParams({
      mode: 'new_only',
      batchSize: '30',
    })
    navigate(`/repeat?${params.toString()}`)
  }

  const handleIncorrectQuestions = () => {
    const params = new URLSearchParams({
      mode: 'incorrect',
      batchSize: '30',
    })
    navigate(`/repeat?${params.toString()}`)
  }

  // Calculate daily goal and progress
  const dailyGoalData = userStats
    ? calculateDailyGoal(settings.examDate, userStats.total_questions, userStats.correct)
    : null

  const finalDailyGoal = settings.manualDailyGoal ?? dailyGoalData?.dailyGoal ?? null
  const todayQuestionsMastered = dailyProgress?.questions_mastered_today || 0
  const goalProgress = finalDailyGoal && finalDailyGoal > 0
    ? Math.min((todayQuestionsMastered / finalDailyGoal) * 100, 100)
    : 0

  // Calculate streak
  const streakProgress = streakDays?.map(day => day.correct_answers) || []
  const currentStreak = finalDailyGoal && finalDailyGoal > 0
    ? calculateCurrentStreak(streakProgress, finalDailyGoal)
    : 0

  const today = new Date().toISOString().split('T')[0]
  const isProgressCurrent = dailyProgress?.date === today

  // Loading states
  const isUserLoading = loading.user || !dataInitialized
  const isStatsLoading = loading.userStats
  const isProgressLoading = loading.dailyProgress
  const isStreakLoading = loading.streakDays

  return (
    <>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .cache-indicator {
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
          }
        `}
      </style>
      
      {/* Cache indicator for development */}
      <div className="cache-indicator">
        🗄️ Unified Store Active
      </div>

      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f8fafc', 
        paddingBottom: '80px' 
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: 'white',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          padding: '16px 24px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <h1 style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#111827',
                margin: 0
              }}>
                {userName ? t('home.greeting', { name: userName }) : 'Привет, друг!'}
              </h1>
              <p style={{
                color: '#6b7280',
                margin: '4px 0 0 0',
                fontSize: '14px'
              }}>
                {isUserLoading ? 'Загружаем ваши данные...' : 'Продолжаем подготовку к экзамену'}
              </p>
            </div>
            <div style={{ fontSize: '32px' }}>
              👨‍💼
            </div>
          </div>
        </div>

        <div style={{ padding: '24px', gap: '24px', display: 'flex', flexDirection: 'column' }}>
          {/* Progress Card */}
          <div style={{
            background: isProgressCurrent && finalDailyGoal !== null 
              ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
              : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
            borderRadius: '16px',
            padding: '24px',
            color: 'white',
            opacity: isUserLoading ? 0.7 : 1,
            transition: 'all 0.3s ease'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}>
              <div>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  margin: 0
                }}>
                  {isUserLoading ? 'Загрузка...' : 
                   (!settings.examCountry || !settings.examLanguage) ? 'Настройте экзамен' :
                   isProgressCurrent && finalDailyGoal !== null ? t('home.todayProgress') : 'Дневная цель не установлена'}
                </h2>
                <p style={{
                  color: 'rgba(255, 255, 255, 0.8)',
                  margin: '4px 0 0 0',
                  fontSize: '14px'
                }}>
                  {isUserLoading ? 'Подготавливаем данные...' :
                   (!settings.examCountry || !settings.examLanguage) ? 'Перейдите в настройки' :
                   isProgressCurrent && finalDailyGoal !== null ? getProgressMessage(todayQuestionsMastered, finalDailyGoal) : 'Установите дату экзамена'}
                </p>
              </div>
              <div style={{
                width: '80px',
                height: '80px',
                position: 'relative'
              }}>
                <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    cx="40"
                    cy="40"
                    r="30"
                    stroke="rgba(255, 255, 255, 0.3)"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="30"
                    stroke="white"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={
                      isUserLoading ? "0 188.5" :
                      isProgressCurrent && finalDailyGoal !== null ? `${(goalProgress / 100) * 188.5} 188.5` : "0 188.5"
                    }
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 1s ease-out' }}
                  />
                </svg>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 'bold',
                    color: 'white'
                  }}>
                    {isUserLoading ? '...' :
                     isProgressCurrent && finalDailyGoal !== null ? `${todayQuestionsMastered}/${finalDailyGoal}` : '0/0'}
                  </span>
                </div>
              </div>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              marginTop: '16px'
            }}>
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '12px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Flame size={20} style={{ color: '#fb923c' }} />
                  <span style={{ fontWeight: '600' }}>
                    {isUserLoading || isStreakLoading ? '...' : 
                     (!settings.examCountry || !settings.examLanguage || !finalDailyGoal) ? getStreakText(0, t) :
                     getStreakText(currentStreak, t)}
                  </span>
                </div>
                <p style={{
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  margin: '4px 0 0 0'
                }}>
                  Streak
                </p>
              </div>
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '12px',
                cursor: 'pointer'
              }}
              onClick={() => navigate('/exam-settings')}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Calendar size={20} style={{ color: '#60a5fa' }} />
                  <span style={{ fontWeight: '600' }}>
                    {isUserLoading ? '...' :
                     settings.examDate ? `${Math.ceil((new Date(settings.examDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} дней` : 'Не установлено'}
                  </span>
                  <ChevronRight size={16} style={{ color: 'rgba(255, 255, 255, 0.8)', marginLeft: 'auto' }} />
                </div>
                <p style={{
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  margin: '4px 0 0 0'
                }}>
                  До экзамена
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ gap: '12px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#111827',
              margin: 0
            }}>
              Быстрые действия
            </h3>
            
            <button 
              onClick={handleStart}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)',
                color: 'white',
                padding: '16px',
                borderRadius: '12px',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontSize: '16px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(234, 88, 12, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <Play size={24} />
                <span style={{ fontSize: '18px', fontWeight: '600' }}>
                  {t('home.startRevision')}
                </span>
              </div>
              <ChevronRight size={20} />
            </button>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px'
            }}>
              <button 
                onClick={handleNewQuestions}
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  padding: '16px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  <Sparkles size={20} style={{ color: '#059669' }} />
                  <span style={{ fontWeight: '500', color: '#111827' }}>Новые</span>
                </div>
                <p style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  margin: 0
                }}>
                  Неизученные вопросы
                </p>
              </button>
              
              <button 
                onClick={handleIncorrectQuestions}
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  padding: '16px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  <AlertCircle size={20} style={{ color: '#dc2626' }} />
                  <span style={{ fontWeight: '500', color: '#111827' }}>Ошибки</span>
                </div>
                <p style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  margin: 0
                }}>
                  Работа над ошибками
                </p>
              </button>
            </div>
          </div>

          {/* FSRS Settings */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            marginBottom: '16px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#111827',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Target size={18} style={{ color: '#3b82f6' }} />
                {t('fsrs.settings.enableFSRS')}
              </h3>
              <button
                onClick={() => actions.updateSettings({ useFSRS: !settings.useFSRS })}
                style={{
                  backgroundColor: settings.useFSRS ? '#3b82f6' : '#e5e7eb',
                  color: settings.useFSRS ? 'white' : '#6b7280',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '6px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {settings.useFSRS ? 'Включено' : 'Выключено'}
              </button>
            </div>
            <p style={{
              fontSize: '12px',
              color: '#6b7280',
              margin: 0
            }}>
              {t('fsrs.settings.description')}
            </p>
          </div>

          {/* Overall Progress */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            opacity: isStatsLoading ? 0.7 : 1,
            transition: 'all 0.3s ease'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#111827',
                margin: 0
              }}>
                Общий прогресс
              </h3>
              <span style={{
                fontSize: '14px',
                color: '#6b7280'
              }}>
                {isStatsLoading ? '.../..' : userStats ? `${userStats.correct}/${userStats.total_questions}` : '0/0'}
              </span>
            </div>
            
            <div style={{
              width: '100%',
              backgroundColor: '#e5e7eb',
              borderRadius: '9999px',
              height: '8px',
              marginBottom: '8px'
            }}>
              <div 
                style={{
                  backgroundColor: '#059669',
                  height: '8px',
                  borderRadius: '9999px',
                  transition: 'all 1s ease-out',
                  width: isStatsLoading ? '0%' : userStats ? 
                         `${userStats.total_questions > 0 ? Math.round((userStats.correct / userStats.total_questions) * 100) : 0}%` : '0%'
                }}
              />
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: 0
              }}>
                {isStatsLoading ? 'Загрузка...' : userStats ?
                 `${userStats.total_questions > 0 ? Math.round((userStats.correct / userStats.total_questions) * 100) : 0}% завершено` : '0% завершено'}
              </p>
              {isStatsLoading && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #e5e7eb',
                    borderTop: '2px solid #059669',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                </div>
              )}
            </div>
          </div>
        </div>

        <BottomNavigation />
      </div>
    </>
  )
}

export default HomeUnified