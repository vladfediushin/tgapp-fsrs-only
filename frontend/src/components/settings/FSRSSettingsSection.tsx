import React from 'react'
import { useTranslation } from 'react-i18next'
import { Brain, Info, Settings, ToggleLeft, ToggleRight } from 'lucide-react'
import type { FSRSSettings } from '../../types/settings'
import { validateFSRSSettings } from '../../types/settings'

interface FSRSSettingsSectionProps {
  settings: FSRSSettings
  onUpdate: (key: keyof FSRSSettings, value: any) => void
  disabled?: boolean
}

const FSRSSettingsSection: React.FC<FSRSSettingsSectionProps> = ({
  settings,
  onUpdate,
  disabled = false
}) => {
  const { t } = useTranslation()

  // Validation errors for current settings
  const validationErrors = validateFSRSSettings(settings)

  const handleSliderChange = (key: keyof FSRSSettings, value: string) => {
    const numValue = parseFloat(value)
    onUpdate(key, numValue)
  }

  const handleToggleChange = (key: keyof FSRSSettings, checked: boolean) => {
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
          backgroundColor: '#dbeafe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Brain size={20} color="#2563eb" />
        </div>
        <div>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#111827',
            margin: 0
          }}>
            FSRS Algorithm Settings
          </h2>
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            margin: '4px 0 0 0'
          }}>
            Fine-tune the spaced repetition algorithm for optimal learning
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
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px'
          }}>
            <Info size={16} color="#dc2626" />
            <span style={{
              fontSize: '14px',
              fontWeight: '500',
              color: '#dc2626'
            }}>
              Settings Validation Issues:
            </span>
          </div>
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
        {/* Target Retention Rate */}
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
              Target Retention Rate
            </label>
            <span style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#2563eb'
            }}>
              {Math.round(settings.requestRetention * 100)}%
            </span>
          </div>
          
          <input
            type="range"
            min="0.70"
            max="0.98"
            step="0.01"
            value={settings.requestRetention}
            onChange={(e) => handleSliderChange('requestRetention', e.target.value)}
            disabled={disabled}
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '3px',
              background: `linear-gradient(to right, #2563eb 0%, #2563eb ${((settings.requestRetention - 0.7) / (0.98 - 0.7)) * 100}%, #e5e7eb ${((settings.requestRetention - 0.7) / (0.98 - 0.7)) * 100}%, #e5e7eb 100%)`,
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
            Higher values mean more frequent reviews but better retention. 
            Recommended: 85-90% for most learners.
          </div>
        </div>

        {/* Maximum Interval */}
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
              Maximum Interval
            </label>
            <span style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#2563eb'
            }}>
              {settings.maximumInterval} days
            </span>
          </div>
          
          <input
            type="range"
            min="30"
            max="365"
            step="1"
            value={Math.min(settings.maximumInterval, 365)}
            onChange={(e) => handleSliderChange('maximumInterval', e.target.value)}
            disabled={disabled}
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '3px',
              background: `linear-gradient(to right, #2563eb 0%, #2563eb ${((settings.maximumInterval - 30) / (365 - 30)) * 100}%, #e5e7eb ${((settings.maximumInterval - 30) / (365 - 30)) * 100}%, #e5e7eb 100%)`,
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
            Maximum time between reviews. Longer intervals reduce workload but may hurt retention.
          </div>
        </div>

        {/* Easy Bonus */}
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
              Easy Bonus
            </label>
            <span style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#2563eb'
            }}>
              {settings.easyBonus.toFixed(1)}x
            </span>
          </div>
          
          <input
            type="range"
            min="1.0"
            max="2.0"
            step="0.1"
            value={settings.easyBonus}
            onChange={(e) => handleSliderChange('easyBonus', e.target.value)}
            disabled={disabled}
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '3px',
              background: `linear-gradient(to right, #2563eb 0%, #2563eb ${((settings.easyBonus - 1.0) / (2.0 - 1.0)) * 100}%, #e5e7eb ${((settings.easyBonus - 1.0) / (2.0 - 1.0)) * 100}%, #e5e7eb 100%)`,
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
            Multiplier for "Easy" button. Higher values create longer intervals for easy cards.
          </div>
        </div>

        {/* Advanced Settings Toggle */}
        <details style={{
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <summary style={{
            cursor: 'pointer',
            fontWeight: '500',
            color: '#111827',
            marginBottom: '16px'
          }}>
            Advanced FSRS Settings
          </summary>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Enable Fuzz */}
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
                    Enable Interval Fuzz
                  </label>
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    marginTop: '4px'
                  }}>
                    Adds randomness to intervals to prevent review clustering
                  </div>
                </div>
                <button
                  onClick={() => handleToggleChange('enableFuzz', !settings.enableFuzz)}
                  disabled={disabled}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.6 : 1
                  }}
                >
                  {settings.enableFuzz ? (
                    <ToggleRight size={32} color="#2563eb" />
                  ) : (
                    <ToggleLeft size={32} color="#9ca3af" />
                  )}
                </button>
              </div>
            </div>

            {/* Hard Interval Factor */}
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
                  Hard Interval Factor
                </label>
                <span style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#2563eb'
                }}>
                  {settings.hardInterval.toFixed(1)}
                </span>
              </div>
              
              <input
                type="range"
                min="1.0"
                max="1.5"
                step="0.1"
                value={settings.hardInterval}
                onChange={(e) => handleSliderChange('hardInterval', e.target.value)}
                disabled={disabled}
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  background: `linear-gradient(to right, #2563eb 0%, #2563eb ${((settings.hardInterval - 1.0) / (1.5 - 1.0)) * 100}%, #e5e7eb ${((settings.hardInterval - 1.0) / (1.5 - 1.0)) * 100}%, #e5e7eb 100%)`,
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
                Interval multiplier for "Hard" button responses.
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  )
}

export default FSRSSettingsSection