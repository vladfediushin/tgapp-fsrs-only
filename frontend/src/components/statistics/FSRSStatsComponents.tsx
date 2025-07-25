import React from 'react'
import { ProgressRing, SimpleBarChart, SimpleLineChart, Heatmap } from './CustomCharts'
import { 
  Brain, 
  Target, 
  TrendingUp, 
  Calendar, 
  Clock,
  CheckCircle,
  XCircle,
  Award,
  Activity,
  BarChart3,
  Zap,
  Timer
} from 'lucide-react'
import type { FSRSStats, FSRSDueQuestion } from '../../api/fsrs'
import type { UserStats, DailyProgress, AnswersByDay } from '../../api/api'

// ============================================================================
// FSRS Overview Cards
// ============================================================================

interface FSRSOverviewProps {
  fsrsStats: FSRSStats | null
  userStats: UserStats | null
  loading?: boolean
}

export const FSRSOverview: React.FC<FSRSOverviewProps> = ({
  fsrsStats,
  userStats,
  loading = false
}) => {
  if (loading) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '16px'
      }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            textAlign: 'center',
            opacity: 0.6
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#f3f4f6',
              margin: '0 auto 12px',
              animation: 'pulse 2s infinite'
            }} />
            <div style={{
              height: '20px',
              backgroundColor: '#f3f4f6',
              borderRadius: '4px',
              marginBottom: '8px'
            }} />
            <div style={{
              height: '16px',
              backgroundColor: '#f3f4f6',
              borderRadius: '4px'
            }} />
          </div>
        ))}
      </div>
    )
  }

  const accuracy = userStats && userStats.answered > 0 
    ? Math.round((userStats.correct / userStats.answered) * 100) 
    : 0

  const avgStability = fsrsStats?.avg_stability || 0
  const avgDifficulty = fsrsStats?.avg_difficulty || 0
  const dueCount = fsrsStats?.due_count || 0

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '16px'
    }}>
      {/* Accuracy */}
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
          {accuracy}%
        </h3>
        <p style={{
          fontSize: '14px',
          color: '#6b7280',
          margin: 0
        }}>
          Точность
        </p>
      </div>

      {/* Average Stability */}
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
          backgroundColor: '#dbeafe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px'
        }}>
          <Brain size={24} color="#3b82f6" />
        </div>
        <h3 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#111827',
          margin: '0 0 4px 0'
        }}>
          {avgStability.toFixed(1)}
        </h3>
        <p style={{
          fontSize: '14px',
          color: '#6b7280',
          margin: 0
        }}>
          Стабильность
        </p>
      </div>

      {/* Average Difficulty */}
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
          <Zap size={24} color="#f59e0b" />
        </div>
        <h3 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#111827',
          margin: '0 0 4px 0'
        }}>
          {avgDifficulty.toFixed(1)}
        </h3>
        <p style={{
          fontSize: '14px',
          color: '#6b7280',
          margin: 0
        }}>
          Сложность
        </p>
      </div>

      {/* Due Cards */}
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
          backgroundColor: '#fecaca',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px'
        }}>
          <Timer size={24} color="#dc2626" />
        </div>
        <h3 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#111827',
          margin: '0 0 4px 0'
        }}>
          {dueCount}
        </h3>
        <p style={{
          fontSize: '14px',
          color: '#6b7280',
          margin: 0
        }}>
          К повторению
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// FSRS State Distribution Chart
// ============================================================================

interface FSRSStateDistributionProps {
  fsrsStats: FSRSStats | null
}

export const FSRSStateDistribution: React.FC<FSRSStateDistributionProps> = ({
  fsrsStats
}) => {
  if (!fsrsStats || !fsrsStats.state_distribution_named) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Нет данных о распределении состояний
        </p>
      </div>
    )
  }

  const stateData = Object.entries(fsrsStats.state_distribution_named).map(([name, value]) => ({
    name: name === 'New' ? 'Новые' : 
          name === 'Learning' ? 'Изучение' :
          name === 'Review' ? 'Повторение' :
          name === 'Relearning' ? 'Переизучение' : name,
    value: value as number,
    color: name === 'New' ? '#6b7280' :
           name === 'Learning' ? '#f59e0b' :
           name === 'Review' ? '#059669' :
           name === 'Relearning' ? '#dc2626' : '#3b82f6'
  }))

  return (
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
        <BarChart3 size={20} />
        Распределение карточек по состояниям
      </h3>
      
      <SimpleBarChart 
        data={stateData}
        height={200}
        showValues={true}
      />
    </div>
  )
}

// ============================================================================
// Progress Tracking Heatmap
// ============================================================================

interface ProgressHeatmapProps {
  streakDays: AnswersByDay[] | null
}

export const ProgressHeatmap: React.FC<ProgressHeatmapProps> = ({
  streakDays
}) => {
  if (!streakDays || streakDays.length === 0) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Нет данных об активности
        </p>
      </div>
    )
  }

  const heatmapData = streakDays.map(day => ({
    date: day.date,
    value: day.correct_answers
  }))

  return (
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
        <Calendar size={20} />
        Активность изучения
      </h3>
      
      <Heatmap 
        data={heatmapData}
        weeks={12}
        cellSize={12}
      />
      
      <div style={{
        marginTop: '16px',
        fontSize: '12px',
        color: '#6b7280',
        textAlign: 'center'
      }}>
        Последние 12 недель активности
      </div>
    </div>
  )
}

// ============================================================================
// Daily Progress Ring
// ============================================================================

interface DailyProgressRingProps {
  dailyProgress: DailyProgress | null
  dailyGoal?: number
}

export const DailyProgressRing: React.FC<DailyProgressRingProps> = ({
  dailyProgress,
  dailyGoal = 20
}) => {
  const progress = dailyProgress?.questions_mastered_today || 0
  const percentage = Math.min((progress / dailyGoal) * 100, 100)
  
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      textAlign: 'center'
    }}>
      <h3 style={{
        fontSize: '18px',
        fontWeight: '600',
        color: '#111827',
        margin: '0 0 16px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
      }}>
        <Target size={20} />
        Дневная цель
      </h3>
      
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '16px'
      }}>
        <ProgressRing
          value={progress}
          maxValue={dailyGoal}
          size={120}
          strokeWidth={8}
          color={percentage >= 100 ? '#059669' : '#f59e0b'}
          label={`${progress}`}
          sublabel={`из ${dailyGoal}`}
        />
      </div>
      
      <div style={{
        fontSize: '14px',
        color: '#6b7280'
      }}>
        {percentage >= 100 ? (
          <span style={{ color: '#059669', fontWeight: '600' }}>
            🎉 Цель достигнута!
          </span>
        ) : (
          `Осталось ${dailyGoal - progress} вопросов`
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Learning Streak Component
// ============================================================================

interface LearningStreakProps {
  streakDays: AnswersByDay[] | null
}

export const LearningStreak: React.FC<LearningStreakProps> = ({
  streakDays
}) => {
  if (!streakDays || streakDays.length === 0) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#111827',
          margin: '0 0 16px 0'
        }}>
          Серия изучения
        </h3>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Начните изучение для отслеживания серии
        </p>
      </div>
    )
  }

  // Calculate current streak
  let currentStreak = 0
  const today = new Date().toISOString().split('T')[0]
  const sortedDays = [...streakDays].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  
  for (const day of sortedDays) {
    if (day.correct_answers > 0) {
      currentStreak++
    } else {
      break
    }
  }

  // Calculate best streak
  let bestStreak = 0
  let tempStreak = 0
  
  for (const day of sortedDays.reverse()) {
    if (day.correct_answers > 0) {
      tempStreak++
      bestStreak = Math.max(bestStreak, tempStreak)
    } else {
      tempStreak = 0
    }
  }

  return (
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
        <Award size={20} />
        Серия изучения
      </h3>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: currentStreak > 0 ? '#059669' : '#6b7280',
            marginBottom: '4px'
          }}>
            {currentStreak}
          </div>
          <div style={{
            fontSize: '14px',
            color: '#6b7280'
          }}>
            Текущая серия
          </div>
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#f59e0b',
            marginBottom: '4px'
          }}>
            {bestStreak}
          </div>
          <div style={{
            fontSize: '14px',
            color: '#6b7280'
          }}>
            Лучшая серия
          </div>
        </div>
      </div>
    </div>
  )
}

export default {
  FSRSOverview,
  FSRSStateDistribution,
  ProgressHeatmap,
  DailyProgressRing,
  LearningStreak
}