import React from 'react'
import { useTranslation } from 'react-i18next'
import { Target, Clock, Keyboard, Volume2, Bell, ToggleLeft, ToggleRight } from 'lucide-react'
import type { LearningPreferences } from '../../types/settings'
import { validateLearningPreferences } from '../../types/settings'

interface LearningPreferencesSectionProps {
  settings: LearningPreferences
  onUpdate: (key: keyof LearningPreferences, value: any) => void
  disabled?: boolean
}

const LearningPreferencesSection: React.FC<LearningPreferencesSectionProps> = ({
  settings,
  onUpdate,
  disabled = false
}) => {
  const { t } = useTranslation()

  // Validation errors for current settings
  const validationErrors = validateLearningPreferences(settings)

  const handleSliderChange = (key: keyof LearningPreferences, value: string) => {
    const numValue = parseInt(value)
    onUpdate(key, numValue)
  }

  const handleToggleChange = (key: keyof LearningPreferences, checked: boolean) => {
    onUpdate(key, checked)
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      marginBottom: '24px'
    }}>
      {/* Section Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          backgroundColor: '#dcfce7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Target size={20} color="#16a34a" />
        </div>
        <div>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#111827',
            margin: 0
          }}>
            Learning Preferences
          </h2>
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            margin: '4px 0 0 0'
          }}>
            Customize your learning experience and study habits
          </p>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '20px'
        }}>
          <ul style={{
            margin: 0,
            paddingLeft: '20px',
            fontSize: '14px',
            color: '#dc2626'
          }}>
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Daily Goal */}
        <div className="setting-item">
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <label style={{
              fontSize: '16px',
              fontWeight: '500',
              color: '#111827'
            }}>
              Daily Goal
            </label>
            <span style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#16a34a'
            }}>
              {settings.dailyGoal} reviews
            </span>
          </div>
          
          <input
            type="range"
            min="5"
            max="200"
            step="5"
            value={settings.dailyGoal}
            onChange={(e) => handleSliderChange('dailyGoal', e.target.value)}
            disabled={disabled}
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '3px',
              background: `linear-gradient(to right, #16a34a 0%, #16a34a ${((settings.dailyGoal - 5) / (200 - 5)) * 100}%, #e5e7eb ${((settings.dailyGoal - 5) / (200 - 5)) * 100}%, #e5e7eb 100%)`,
              outline: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1
            }}
          />
          
          <div style={{
            fontSize: '12px',
            color: '#6b7280',
            marginTop: '8px',
            lineHeight: '1.4'
          }}>
            Target number of questions to review each day. Affects session planning and reminders.
          </div>
        </div>

        {/* Session Length */}
        <div className="setting-item">
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <label style={{
              fontSize: '16px',
              fontWeight: '500',
              color: '#111827'
            }}>
              Session Length
            </label>
            <span style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#16a34a'
            }}>
              {settings.sessionLength} questions
            </span>
          </div>
          
          <input
            type="range"
            min="5"
            max="50"
            step="5"
            value={settings.sessionLength}
            onChange={(e) => handleSliderChange('sessionLength', e.target.value)}
            disabled={disabled}
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '3px',
              background: `linear-gradient(to right, #16a34a 0%, #16a34a ${((settings.sessionLength - 5) / (50 - 5)) * 100}%, #e5e7eb ${((settings.sessionLength - 5) / (50 - 5)) * 100}%, #e5e7eb 100%)`,
              outline: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1
            }}
          />
          
          <div style={{
            fontSize: '12px',
            color: '#6b7280',
            marginTop: '8px',
            lineHeight: '1.4'
          }}>
            Maximum number of questions per study session. Helps prevent fatigue.
          </div>
        </div>

        {/* Toggle Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Auto Show Answer */}
          <div className="setting-item">
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <label style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  color: '#111827',
                  display: 'block'
                }}>
                  Auto-Show Answer
                </label>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  marginTop: '4px'
                }}>
                  Automatically reveal answers after a timeout period
                </div>
              </div>
              <button
                onClick={() => handleToggleChange('autoShowAnswer', !settings.autoShowAnswer)}
                disabled={disabled}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.6 : 1
                }}
              >
                {settings.autoShowAnswer ? (
                  <ToggleRight size={32} color="#16a34a" />
                ) : (
                  <ToggleLeft size={32} color="#9ca3af" />
                )}
              </button>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="setting-item">
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <label style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  color: '#111827',
                  display: 'block'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Keyboard size={16} />
                    Keyboard Shortcuts
                  </div>
                </label>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  marginTop: '4px'
                }}>
                  Enable keyboard navigation (1-4 keys for rating, Space for answer)
                </div>
              </div>
              <button
                onClick={() => handleToggleChange('keyboardShortcuts', !settings.keyboardShortcuts)}
                disabled={disabled}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.6 : 1
                }}
              >
                {settings.keyboardShortcuts ? (
                  <ToggleRight size={32} color="#16a34a" />
                ) : (
                  <ToggleLeft size={32} color="#9ca3af" />
                )}
              </button>
            </div>
          </div>

          {/* Sound Effects */}
          <div className="setting-item">
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <label style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  color: '#111827',
                  display: 'block'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Volume2 size={16} />
                    Sound Effects
                  </div>
                </label>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  marginTop: '4px'
                }}>
                  Play audio feedback for correct/incorrect answers
                </div>
              </div>
              <button
                onClick={() => handleToggleChange('soundEffects', !settings.soundEffects)}
                disabled={disabled}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.6 : 1
                }}
              >
                {settings.soundEffects ? (
                  <ToggleRight size={32} color="#16a34a" />
                ) : (
                  <ToggleLeft size={32} color="#9ca3af" />
                )}
              </button>
            </div>
          </div>

          {/* Review Reminders */}
          <div className="setting-item">
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <label style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  color: '#111827',
                  display: 'block'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bell size={16} />
                    Review Reminders
                  </div>
                </label>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  marginTop: '4px'
                }}>
                  Get notified when reviews are due
                </div>
              </div>
              <button
                onClick={() => handleToggleChange('reviewReminders', !settings.reviewReminders)}
                disabled={disabled}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.6 : 1
                }}
              >
                {settings.reviewReminders ? (
                  <ToggleRight size={32} color="#16a34a" />
                ) : (
                  <ToggleLeft size={32} color="#9ca3af" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LearningPreferencesSection