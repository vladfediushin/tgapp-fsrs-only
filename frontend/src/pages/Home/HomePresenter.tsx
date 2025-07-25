// HomePresenter.tsx - UI Presentation Layer for Home Component
import React from 'react'
import { useTranslation } from 'react-i18next'
import { 
  Home as HomeIcon, 
  User, 
  BarChart3, 
  Settings, 
  Play, 
  Flame, 
  Calendar, 
  ChevronRight, 
  Sparkles, 
  AlertCircle, 
  Target 
} from 'lucide-react'
import BottomNavigation from '../../components/BottomNavigation'
import type { HomePresenterProps } from './types'

// ============================================================================
// Sub-Components
// ============================================================================

interface ProgressCardProps {
  isProgressCurrent: boolean
  finalDailyGoal: number | null
  todayQuestionsMastered: number
  goalProgress: number
  currentStreak: number
  examDate: string | null
  loading: {
    user: boolean
    streak: boolean
  }
  settings: {
    examCountry: string
    examLanguage: string
  }
  onExamSettingsClick: () => void
  getProgressMessage: (questionsToday: number, dailyGoal: number) => string
  getStreakText: (streak: number) => string
}

const ProgressCard: React.FC<ProgressCardProps> = ({
  isProgressCurrent,
  finalDailyGoal,
  todayQuestionsMastered,
  goalProgress,
  currentStreak,
  examDate,
  loading,
  settings,
  onExamSettingsClick,
  getProgressMessage,
  getStreakText
}) => {
  const { t } = useTranslation()

  return (
    <div style={{
      background: isProgressCurrent && finalDailyGoal !== null 
        ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
        : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
      borderRadius: '16px',
      padding: '24px',
      color: 'white',
      opacity: loading.user ? 0.7 : 1,
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
            {loading.user ? 'Загрузка...' : 
             (!settings.examCountry || !settings.examLanguage) ? 'Настройте экзамен' :
             isProgressCurrent && finalDailyGoal !== null ? t('home.todayProgress') : 'Дневная цель не установлена'}
          </h2>
          <p style={{
            color: 'rgba(255, 255, 255, 0.8)',
            margin: '4px 0 0 0',
            fontSize: '14px'
          }}>
            {loading.user ? 'Подготавливаем данные...' :
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
                loading.user ? "0 188.5" :
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
              {loading.user ? '...' :
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
              {loading.user || loading.streak ? '...' : 
               (!settings.examCountry || !settings.examLanguage || !finalDailyGoal) ? getStreakText(0) :
               getStreakText(currentStreak)}
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
        onClick={onExamSettingsClick}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Calendar size={20} style={{ color: '#60a5fa' }} />
            <span style={{ fontWeight: '600' }}>
              {loading.user ? '...' :
               examDate ? `${Math.ceil((new Date(examDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} дней` : 'Не установлено'}
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
  )
}

interface QuickActionsProps {
  onStartRevision: () => void
  onNewQuestions: () => void
  onIncorrectQuestions: () => void
}

const QuickActions: React.FC<QuickActionsProps> = ({
  onStartRevision,
  onNewQuestions,
  onIncorrectQuestions
}) => {
  const { t } = useTranslation()

  return (
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
        onClick={onStartRevision}
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
          onClick={onNewQuestions}
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
          onClick={onIncorrectQuestions}
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
  )
}

interface FSRSSettingsProps {
  useFSRS: boolean
  onToggleFSRS: () => void
}

const FSRSSettings: React.FC<FSRSSettingsProps> = ({ useFSRS, onToggleFSRS }) => {
  const { t } = useTranslation()

  return (
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
          onClick={onToggleFSRS}
          style={{
            backgroundColor: useFSRS ? '#3b82f6' : '#e5e7eb',
            color: useFSRS ? 'white' : '#6b7280',
            border: 'none',
            borderRadius: '20px',
            padding: '6px 16px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          {useFSRS ? 'Включено' : 'Выключено'}
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
  )
}

interface OverallProgressProps {
  userStats: any
  loading: boolean
}

const OverallProgress: React.FC<OverallProgressProps> = ({ userStats, loading }) => {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '16px',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      opacity: loading ? 0.7 : 1,
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
          {loading ? '.../..' : userStats ? `${userStats.correct}/${userStats.total_questions}` : '0/0'}
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
            width: loading ? '0%' : userStats ? 
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
          {loading ? 'Загрузка...' : userStats ?
           `${userStats.total_questions > 0 ? Math.round((userStats.correct / userStats.total_questions) * 100) : 0}% завершено` : '0% завершено'}
        </p>
        {loading && (
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
  )
}

// ============================================================================
// Main HomePresenter Component
// ============================================================================

const HomePresenter: React.FC<HomePresenterProps> = ({
  state,
  actions,
  getProgressMessage,
  getStreakText,
  config
}) => {
  const { t } = useTranslation()

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
      {config.showCacheIndicator && (
        <div className="cache-indicator">
          🏠 Container-Presenter Active
        </div>
      )}

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
                {state.userName ? t('home.greeting', { name: state.userName }) : 'Привет, друг!'}
              </h1>
              <p style={{
                color: '#6b7280',
                margin: '4px 0 0 0',
                fontSize: '14px'
              }}>
                {state.loading.initialization ? 'Загружаем ваши данные...' : 'Продолжаем подготовку к экзамену'}
              </p>
            </div>
            <div style={{ fontSize: '32px' }}>
              👨‍💼
            </div>
          </div>
        </div>

        <div style={{ padding: '24px', gap: '24px', display: 'flex', flexDirection: 'column' }}>
          {/* Progress Card */}
          <ProgressCard
            isProgressCurrent={state.isProgressCurrent}
            finalDailyGoal={state.dailyGoal}
            todayQuestionsMastered={state.dailyProgress?.questions_mastered_today || 0}
            goalProgress={state.goalProgress}
            currentStreak={state.currentStreak}
            examDate={state.settings.examDate}
            loading={{
              user: state.loading.user,
              streak: state.loading.streak
            }}
            settings={{
              examCountry: state.settings.examCountry,
              examLanguage: state.settings.examLanguage
            }}
            onExamSettingsClick={actions.navigateToExamSettings}
            getProgressMessage={getProgressMessage}
            getStreakText={getStreakText}
          />

          {/* Quick Actions */}
          <QuickActions
            onStartRevision={actions.navigateToMode}
            onNewQuestions={actions.navigateToNewQuestions}
            onIncorrectQuestions={actions.navigateToIncorrectQuestions}
          />

          {/* FSRS Settings */}
          <FSRSSettings
            useFSRS={state.settings.useFSRS}
            onToggleFSRS={actions.toggleFSRS}
          />

          {/* Overall Progress */}
          <OverallProgress
            userStats={state.userStats}
            loading={state.loading.stats}
          />
        </div>

        <BottomNavigation />
      </div>
    </>
  )
}

export default HomePresenter