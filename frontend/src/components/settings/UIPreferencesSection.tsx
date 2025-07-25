import React from 'react'
import { useTranslation } from 'react-i18next'
import { Palette, Type, Zap, Smartphone, Eye, ToggleLeft, ToggleRight, ChevronDown } from 'lucide-react'
import type { UIPreferences } from '../../types/settings'

interface UIPreferencesSectionProps {
  settings: UIPreferences
  onUpdate: (key: keyof UIPreferences, value: any) => void
  disabled?: boolean
}

const UIPreferencesSection: React.FC<UIPreferencesSectionProps> = ({
  settings,
  onUpdate,
  disabled = false
}) => {
  const { t } = useTranslation()

  const handleSelectChange = (key: keyof UIPreferences, value: string) => {
    onUpdate(key, value)
  }

  const handleToggleChange = (key: keyof UIPreferences, checked: boolean) => {
    onUpdate(key, checked)
  }

  const themeOptions = [
    { value: 'light', label: '☀️ Light Theme', description: 'Always use light mode' },
    { value: 'dark', label: '🌙 Dark Theme', description: 'Always use dark mode' },
    { value: 'auto', label: '🔄 Auto Theme', description: 'Follow system preference' }
  ]

  const fontSizeOptions = [
    { value: 'small', label: 'Small', description: 'Compact text for more content' },
    { value: 'medium', label: 'Medium', description: 'Standard readable size' },
    { value: 'large', label: 'Large', description: 'Larger text for better readability' }
  ]

  const languageOptions = [
    { value: 'en', label: '🇺🇸 English' },
    { value: 'ru', label: '🇷🇺 Русский' }
  ]

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
          backgroundColor: '#fef3c7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Palette size={20} color="#d97706" />
        </div>
        <div>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#111827',
            margin: 0
          }}>
            UI Preferences
          </h2>
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            margin: '4px 0 0 0'
          }}>
            Customize the app appearance and interface
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Theme Selection */}
        <div className="setting-item">
          <label style={{
            fontSize: '16px',
            fontWeight: '500',
            color: '#111827',
            display: 'block',
            marginBottom: '8px'
          }}>
            Theme
          </label>
          
          <div style={{ position: 'relative' }}>
            <select
              value={settings.theme}
              onChange={(e) => handleSelectChange('theme', e.target.value)}
              disabled={disabled}
              style={{
                width: '100%',
                padding: '12px 16px',
                paddingRight: '40px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: disabled ? '#f9fafb' : 'white',
                appearance: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                outline: 'none',
                opacity: disabled ? 0.6 : 1
              }}
            >
              {themeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown 
              size={16} 
              color="#6b7280" 
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none'
              }}
            />
          </div>
          
          <div style={{
            fontSize: '12px',
            color: '#6b7280',
            marginTop: '8px',
            lineHeight: '1.4'
          }}>
            {themeOptions.find(opt => opt.value === settings.theme)?.description}
          </div>
        </div>

        {/* Language Selection */}
        <div className="setting-item">
          <label style={{
            fontSize: '16px',
            fontWeight: '500',
            color: '#111827',
            display: 'block',
            marginBottom: '8px'
          }}>
            Interface Language
          </label>
          
          <div style={{ position: 'relative' }}>
            <select
              value={settings.language}
              onChange={(e) => handleSelectChange('language', e.target.value)}
              disabled={disabled}
              style={{
                width: '100%',
                padding: '12px 16px',
                paddingRight: '40px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: disabled ? '#f9fafb' : 'white',
                appearance: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                outline: 'none',
                opacity: disabled ? 0.6 : 1
              }}
            >
              {languageOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown 
              size={16} 
              color="#6b7280" 
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none'
              }}
            />
          </div>
          
          <div style={{
            fontSize: '12px',
            color: '#6b7280',
            marginTop: '8px',
            lineHeight: '1.4'
          }}>
            Language for app interface and menus
          </div>
        </div>

        {/* Font Size Selection */}
        <div className="setting-item">
          <label style={{
            fontSize: '16px',
            fontWeight: '500',
            color: '#111827',
            display: 'block',
            marginBottom: '8px'
          }}>
            Font Size
          </label>
          
          <div style={{ position: 'relative' }}>
            <select
              value={settings.fontSize}
              onChange={(e) => handleSelectChange('fontSize', e.target.value)}
              disabled={disabled}
              style={{
                width: '100%',
                padding: '12px 16px',
                paddingRight: '40px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: disabled ? '#f9fafb' : 'white',
                appearance: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                outline: 'none',
                opacity: disabled ? 0.6 : 1
              }}
            >
              {fontSizeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown 
              size={16} 
              color="#6b7280" 
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none'
              }}
            />
          </div>
          
          <div style={{
            fontSize: '12px',
            color: '#6b7280',
            marginTop: '8px',
            lineHeight: '1.4'
          }}>
            {fontSizeOptions.find(opt => opt.value === settings.fontSize)?.description}
          </div>
        </div>

        {/* Toggle Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Animations */}
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
                    <Zap size={16} />
                    Animations
                  </div>
                </label>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  marginTop: '4px'
                }}>
                  Enable smooth transitions and animations
                </div>
              </div>
              <button
                onClick={() => handleToggleChange('animations', !settings.animations)}
                disabled={disabled}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.6 : 1
                }}
              >
                {settings.animations ? (
                  <ToggleRight size={32} color="#d97706" />
                ) : (
                  <ToggleLeft size={32} color="#9ca3af" />
                )}
              </button>
            </div>
          </div>

          {/* Compact Mode */}
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
                    <Smartphone size={16} />
                    Compact Mode
                  </div>
                </label>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  marginTop: '4px'
                }}>
                  Use a more compact layout to fit more content
                </div>
              </div>
              <button
                onClick={() => handleToggleChange('compactMode', !settings.compactMode)}
                disabled={disabled}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.6 : 1
                }}
              >
                {settings.compactMode ? (
                  <ToggleRight size={32} color="#d97706" />
                ) : (
                  <ToggleLeft size={32} color="#9ca3af" />
                )}
              </button>
            </div>
          </div>

          {/* Show Progress */}
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
                    <Eye size={16} />
                    Show Progress Indicators
                  </div>
                </label>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  marginTop: '4px'
                }}>
                  Display detailed progress bars and statistics
                </div>
              </div>
              <button
                onClick={() => handleToggleChange('showProgress', !settings.showProgress)}
                disabled={disabled}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.6 : 1
                }}
              >
                {settings.showProgress ? (
                  <ToggleRight size={32} color="#d97706" />
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

export default UIPreferencesSection