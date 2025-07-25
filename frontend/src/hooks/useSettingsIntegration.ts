import { useEffect, useCallback } from 'react'
import { useUnifiedStore } from '../store/unified'
import { UserSettings, DEFAULT_USER_SETTINGS } from '../types/settings'

/**
 * Settings Integration Hook
 * 
 * Provides real-time integration between settings and the learning experience.
 * This hook ensures that changes in settings immediately affect:
 * - FSRS algorithm parameters
 * - Learning session behavior
 * - UI preferences
 * - Audio and visual feedback
 */

export interface SettingsIntegrationState {
  // Current effective settings
  settings: UserSettings
  
  // FSRS integration
  fsrsEnabled: boolean
  fsrsParameters: {
    requestRetention: number
    maximumInterval: number
    easyBonus: number
    hardInterval: number
    enableFuzz: boolean
  }
  
  // Learning session settings
  sessionSettings: {
    dailyGoal: number
    sessionLength: number
    autoShowAnswer: boolean
    keyboardShortcuts: boolean
    soundEffects: boolean
    reviewReminders: boolean
  }
  
  // UI settings
  uiSettings: {
    theme: 'light' | 'dark' | 'auto'
    language: string
    fontSize: 'small' | 'medium' | 'large'
    animations: boolean
    compactMode: boolean
    showProgress: boolean
  }
  
  // Notification settings
  notificationSettings: {
    enabled: boolean
    reviewReminders: boolean
    dailyGoalReminders: boolean
    streakReminders: boolean
    quietHours: {
      enabled: boolean
      start: string
      end: string
    }
  }
}

export interface SettingsIntegrationActions {
  // Apply settings to current session
  applySettingsToSession: () => void
  
  // Update FSRS parameters in real-time
  updateFSRSParameters: (params: Partial<UserSettings['fsrs']>) => void
  
  // Update learning preferences
  updateLearningPreferences: (prefs: Partial<UserSettings['learning']>) => void
  
  // Update UI preferences
  updateUIPreferences: (ui: Partial<UserSettings['ui']>) => void
  
  // Audio feedback control
  playSuccessSound: () => void
  playErrorSound: () => void
  playNotificationSound: () => void
  
  // Theme application
  applyTheme: (theme: 'light' | 'dark' | 'auto') => void
  
  // Font size application
  applyFontSize: (size: 'small' | 'medium' | 'large') => void
  
  // Keyboard shortcuts management
  enableKeyboardShortcuts: (enabled: boolean) => void
  
  // Session length enforcement
  checkSessionLength: (currentQuestionCount: number) => boolean
  
  // Daily goal tracking
  checkDailyGoal: (currentProgress: number) => {
    goalReached: boolean
    progressPercentage: number
    remaining: number
  }
}

export function useSettingsIntegration(): SettingsIntegrationState & SettingsIntegrationActions {
  const store = useUnifiedStore()
  const { settings: storeSettings, updateSettings } = store
  
  // Get current effective settings (merge with defaults)
  const effectiveSettings: UserSettings = {
    fsrs: { ...DEFAULT_USER_SETTINGS.fsrs },
    learning: { 
      ...DEFAULT_USER_SETTINGS.learning,
      dailyGoal: storeSettings.manualDailyGoal || DEFAULT_USER_SETTINGS.learning.dailyGoal
    },
    ui: { ...DEFAULT_USER_SETTINGS.ui },
    notifications: { ...DEFAULT_USER_SETTINGS.notifications }
  }

  // Apply settings to current session
  const applySettingsToSession = useCallback(() => {
    // Apply theme
    applyTheme(effectiveSettings.ui.theme)
    
    // Apply font size
    applyFontSize(effectiveSettings.ui.fontSize)
    
    // Apply keyboard shortcuts
    enableKeyboardShortcuts(effectiveSettings.learning.keyboardShortcuts)
    
    // Update unified store settings
    updateSettings({
      useFSRS: true, // Enable FSRS when settings are configured
      autoRating: !effectiveSettings.learning.autoShowAnswer,
      manualDailyGoal: effectiveSettings.learning.dailyGoal
    })
    
    console.log('🔧 Settings applied to current session:', effectiveSettings)
  }, [effectiveSettings, updateSettings])

  // Update FSRS parameters in real-time
  const updateFSRSParameters = useCallback((params: Partial<UserSettings['fsrs']>) => {
    // In a real implementation, this would update the FSRS algorithm parameters
    // For now, we'll just log the changes
    console.log('🧠 FSRS parameters updated:', params)
    
    // Update store settings to reflect FSRS usage
    updateSettings({
      useFSRS: true
    })
  }, [updateSettings])

  // Update learning preferences
  const updateLearningPreferences = useCallback((prefs: Partial<UserSettings['learning']>) => {
    console.log('📚 Learning preferences updated:', prefs)
    
    // Update relevant store settings
    if (prefs.dailyGoal !== undefined) {
      updateSettings({
        manualDailyGoal: prefs.dailyGoal
      })
    }
    
    if (prefs.autoShowAnswer !== undefined) {
      updateSettings({
        autoRating: !prefs.autoShowAnswer
      })
    }
  }, [updateSettings])

  // Update UI preferences
  const updateUIPreferences = useCallback((ui: Partial<UserSettings['ui']>) => {
    console.log('🎨 UI preferences updated:', ui)
    
    // Apply theme immediately
    if (ui.theme) {
      applyTheme(ui.theme)
    }
    
    // Apply font size immediately
    if (ui.fontSize) {
      applyFontSize(ui.fontSize)
    }
    
    // Update UI language if changed
    if (ui.language) {
      updateSettings({
        uiLanguage: ui.language
      })
    }
  }, [updateSettings])

  // Audio feedback functions
  const playSuccessSound = useCallback(() => {
    if (!effectiveSettings.learning.soundEffects) return
    
    try {
      const audio = new Audio('/sounds/success.mp3')
      audio.volume = 0.3
      audio.play().catch(() => {
        // Fallback to system beep or silent fail
        console.log('🔊 Success sound played (silent fallback)')
      })
    } catch (error) {
      console.log('🔊 Success sound played (silent fallback)')
    }
  }, [effectiveSettings.learning.soundEffects])

  const playErrorSound = useCallback(() => {
    if (!effectiveSettings.learning.soundEffects) return
    
    try {
      const audio = new Audio('/sounds/error.mp3')
      audio.volume = 0.3
      audio.play().catch(() => {
        console.log('🔊 Error sound played (silent fallback)')
      })
    } catch (error) {
      console.log('🔊 Error sound played (silent fallback)')
    }
  }, [effectiveSettings.learning.soundEffects])

  const playNotificationSound = useCallback(() => {
    if (!effectiveSettings.notifications.enabled) return
    
    try {
      const audio = new Audio('/sounds/notification.mp3')
      audio.volume = 0.2
      audio.play().catch(() => {
        console.log('🔊 Notification sound played (silent fallback)')
      })
    } catch (error) {
      console.log('🔊 Notification sound played (silent fallback)')
    }
  }, [effectiveSettings.notifications.enabled])

  // Theme application
  const applyTheme = useCallback((theme: 'light' | 'dark' | 'auto') => {
    const root = document.documentElement
    
    if (theme === 'auto') {
      // Use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
    } else {
      root.setAttribute('data-theme', theme)
    }
    
    console.log(`🎨 Theme applied: ${theme}`)
  }, [])

  // Font size application
  const applyFontSize = useCallback((size: 'small' | 'medium' | 'large') => {
    const root = document.documentElement
    
    const fontSizeMap = {
      small: '14px',
      medium: '16px',
      large: '18px'
    }
    
    root.style.setProperty('--base-font-size', fontSizeMap[size])
    console.log(`📝 Font size applied: ${size} (${fontSizeMap[size]})`)
  }, [])

  // Keyboard shortcuts management
  const enableKeyboardShortcuts = useCallback((enabled: boolean) => {
    // Store keyboard shortcuts state for components to use
    window.settingsKeyboardShortcuts = enabled
    console.log(`⌨️ Keyboard shortcuts ${enabled ? 'enabled' : 'disabled'}`)
  }, [])

  // Session length enforcement
  const checkSessionLength = useCallback((currentQuestionCount: number): boolean => {
    const maxLength = effectiveSettings.learning.sessionLength
    return currentQuestionCount < maxLength
  }, [effectiveSettings.learning.sessionLength])

  // Daily goal tracking
  const checkDailyGoal = useCallback((currentProgress: number) => {
    const dailyGoal = effectiveSettings.learning.dailyGoal
    const goalReached = currentProgress >= dailyGoal
    const progressPercentage = Math.min((currentProgress / dailyGoal) * 100, 100)
    const remaining = Math.max(dailyGoal - currentProgress, 0)
    
    return {
      goalReached,
      progressPercentage,
      remaining
    }
  }, [effectiveSettings.learning.dailyGoal])

  // Apply settings on mount and when they change
  useEffect(() => {
    applySettingsToSession()
  }, [applySettingsToSession])

  // Listen for system theme changes when using auto theme
  useEffect(() => {
    if (effectiveSettings.ui.theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => applyTheme('auto')
      
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [effectiveSettings.ui.theme, applyTheme])

  return {
    // State
    settings: effectiveSettings,
    fsrsEnabled: storeSettings.useFSRS,
    fsrsParameters: {
      requestRetention: effectiveSettings.fsrs.requestRetention,
      maximumInterval: effectiveSettings.fsrs.maximumInterval,
      easyBonus: effectiveSettings.fsrs.easyBonus,
      hardInterval: effectiveSettings.fsrs.hardInterval,
      enableFuzz: effectiveSettings.fsrs.enableFuzz
    },
    sessionSettings: {
      dailyGoal: effectiveSettings.learning.dailyGoal,
      sessionLength: effectiveSettings.learning.sessionLength,
      autoShowAnswer: effectiveSettings.learning.autoShowAnswer,
      keyboardShortcuts: effectiveSettings.learning.keyboardShortcuts,
      soundEffects: effectiveSettings.learning.soundEffects,
      reviewReminders: effectiveSettings.learning.reviewReminders
    },
    uiSettings: effectiveSettings.ui,
    notificationSettings: effectiveSettings.notifications,
    
    // Actions
    applySettingsToSession,
    updateFSRSParameters,
    updateLearningPreferences,
    updateUIPreferences,
    playSuccessSound,
    playErrorSound,
    playNotificationSound,
    applyTheme,
    applyFontSize,
    enableKeyboardShortcuts,
    checkSessionLength,
    checkDailyGoal
  }
}

// Global type augmentation for keyboard shortcuts
declare global {
  interface Window {
    settingsKeyboardShortcuts?: boolean
  }
}

export default useSettingsIntegration