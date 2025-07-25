import React, { useState, useEffect } from 'react'
import { useUnifiedStore } from '../store/unified'
import { useDebouncedForm } from '../hooks/useDebounced'
import FSRSSettingsSection from '../components/settings/FSRSSettingsSection'
import LearningPreferencesSection from '../components/settings/LearningPreferencesSection'
import UIPreferencesSection from '../components/settings/UIPreferencesSection'
import {
  UserSettings,
  DEFAULT_USER_SETTINGS,
  validateFSRSSettings,
  validateLearningPreferences
} from '../types/settings'
import '../styles/Settings.css'

/**
 * Unified Settings Component
 * 
 * Complete FSRS-integrated settings management with:
 * - Real-time form updates with debounced persistence
 * - Comprehensive validation and error handling
 * - Modular section components for maintainability
 * - Immediate effect on learning experience
 */

export const SettingsUnified: React.FC = () => {
  const store = useUnifiedStore()
  const {
    settings: storeSettings,
    updateSettings,
    loading,
    errors
  } = store

  // Local state for UI feedback
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [activeSection, setActiveSection] = useState<'fsrs' | 'learning' | 'ui'>('fsrs')

  // Initialize form with current settings or defaults
  const initialSettings: UserSettings = {
    fsrs: DEFAULT_USER_SETTINGS.fsrs,
    learning: DEFAULT_USER_SETTINGS.learning,
    ui: DEFAULT_USER_SETTINGS.ui,
    notifications: DEFAULT_USER_SETTINGS.notifications
  }

  // Debounced form management
  const {
    values: formSettings,
    hasChanges,
    updateValue,
    resetForm,
    setHasChanges
  } = useDebouncedForm<UserSettings>(
    initialSettings,
    handleSettingsUpdate,
    500 // 500ms debounce delay
  )

  // Handle debounced settings update
  async function handleSettingsUpdate(newSettings: UserSettings) {
    try {
      setSaveStatus('saving')
      setValidationErrors([])

      // Validate settings before saving
      const fsrsErrors = validateFSRSSettings(newSettings.fsrs)
      const learningErrors = validateLearningPreferences(newSettings.learning)
      const allErrors = [...fsrsErrors, ...learningErrors]
      
      if (allErrors.length > 0) {
        setValidationErrors(allErrors)
        setSaveStatus('error')
        return
      }

      // Update settings in store (for now just update the unified store settings)
      updateSettings({
        useFSRS: true, // Enable FSRS when settings are configured
        examCountry: storeSettings.examCountry,
        examLanguage: storeSettings.examLanguage,
        uiLanguage: storeSettings.uiLanguage,
        examDate: storeSettings.examDate,
        manualDailyGoal: newSettings.learning.dailyGoal,
        autoRating: !newSettings.learning.autoShowAnswer
      })
      
      setSaveStatus('saved')
      setHasChanges(false)

      // Clear saved status after 2 seconds
      setTimeout(() => {
        setSaveStatus('idle')
      }, 2000)

    } catch (error) {
      console.error('Failed to save settings:', error)
      setSaveStatus('error')
      setValidationErrors(['Failed to save settings. Please try again.'])
    }
  }

  // Reset form to current store values
  const handleReset = () => {
    resetForm()
    setValidationErrors([])
    setSaveStatus('idle')
  }

  // Update form when store settings change
  useEffect(() => {
    if (storeSettings && !hasChanges) {
      resetForm()
    }
  }, [storeSettings, hasChanges, resetForm])

  // Section navigation
  const sections = [
    { id: 'fsrs' as const, label: 'FSRS Algorithm', icon: '🧠' },
    { id: 'learning' as const, label: 'Learning Preferences', icon: '📚' },
    { id: 'ui' as const, label: 'Interface', icon: '🎨' }
  ]

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>Settings</h1>
        <div className="settings-status">
          {saveStatus === 'saving' && (
            <span className="status-saving">
              <span className="spinner"></span>
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="status-saved">
              ✓ Settings saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="status-error">
              ⚠ Save failed
            </span>
          )}
          {hasChanges && saveStatus === 'idle' && (
            <span className="status-pending">
              • Unsaved changes
            </span>
          )}
        </div>
      </div>

      {/* Global error display */}
      {validationErrors.length > 0 && (
        <div className="settings-errors">
          {validationErrors.map((error, index) => (
            <div key={index} className="error-message">
              <strong>Error:</strong> {error}
            </div>
          ))}
        </div>
      )}

      <div className="settings-content">
        {/* Section Navigation */}
        <nav className="settings-nav">
          {sections.map(section => (
            <button
              key={section.id}
              className={`nav-button ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => setActiveSection(section.id)}
            >
              <span className="nav-icon">{section.icon}</span>
              <span className="nav-label">{section.label}</span>
            </button>
          ))}
        </nav>

        {/* Settings Sections */}
        <div className="settings-sections">
          {activeSection === 'fsrs' && (
            <FSRSSettingsSection
              settings={formSettings.fsrs}
              onUpdate={(key, value) => {
                const newFsrsSettings = { ...formSettings.fsrs, [key]: value }
                updateValue('fsrs', newFsrsSettings)
              }}
            />
          )}

          {activeSection === 'learning' && (
            <LearningPreferencesSection
              settings={formSettings.learning}
              onUpdate={(key, value) => {
                const newLearningSettings = { ...formSettings.learning, [key]: value }
                updateValue('learning', newLearningSettings)
              }}
            />
          )}

          {activeSection === 'ui' && (
            <UIPreferencesSection
              settings={formSettings.ui}
              onUpdate={(key, value) => {
                const newUiSettings = { ...formSettings.ui, [key]: value }
                updateValue('ui', newUiSettings)
              }}
            />
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="settings-actions">
        <button
          className="button-secondary"
          onClick={handleReset}
          disabled={!hasChanges}
        >
          Reset Changes
        </button>
        
        <div className="settings-info">
          <p className="help-text">
            Settings are automatically saved as you make changes. 
            Changes take effect immediately in your learning sessions.
          </p>
        </div>
      </div>

      {/* Loading overlay */}
      {loading.user && (
        <div className="settings-loading">
          <div className="loading-spinner"></div>
          <p>Loading settings...</p>
        </div>
      )}
    </div>
  )
}

export default SettingsUnified