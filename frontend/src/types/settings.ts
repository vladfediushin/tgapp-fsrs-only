// FSRS Settings Types for TG App FSRS Integration
// Based on docs/03-settings-topics-stats.md specifications

export interface FSRSSettings {
  // Core FSRS Algorithm Parameters
  requestRetention: number;        // Target retention rate (0.7-0.98)
  maximumInterval: number;         // Max days between reviews (30-365)
  easyBonus: number;              // Easy button multiplier (1.0-2.0)
  hardInterval: number;           // Hard button interval factor (1.0-1.5)
  newInterval: number;            // New card interval (1-10 minutes)
  graduatingInterval: number;     // Graduation interval (1-3 days)
  easyInterval: number;           // Easy interval for new cards (4-7 days)
  enableFuzz: boolean;            // Add randomness to intervals
}

export interface LearningPreferences {
  dailyGoal: number;              // Target reviews per day (10-200)
  sessionLength: number;          // Max questions per session (5-50)
  autoShowAnswer: boolean;        // Auto-reveal answers after timeout
  keyboardShortcuts: boolean;     // Enable keyboard navigation
  soundEffects: boolean;          // Audio feedback for answers
  reviewReminders: boolean;       // Push notifications for due reviews
}

export interface UIPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;               // UI language code
  fontSize: 'small' | 'medium' | 'large';
  animations: boolean;            // Enable UI animations
  compactMode: boolean;           // Compact layout for mobile
  showProgress: boolean;          // Show detailed progress indicators
}

export interface NotificationSettings {
  enabled: boolean;               // Master notification toggle
  reviewReminders: boolean;       // Remind when reviews are due
  dailyGoalReminders: boolean;    // Remind about daily goal progress
  streakReminders: boolean;       // Remind about streak maintenance
  quietHours: {
    enabled: boolean;
    start: string;                // "22:00" format
    end: string;                  // "08:00" format
  };
}

// Complete user settings interface
export interface UserSettings {
  fsrs: FSRSSettings;
  learning: LearningPreferences;
  ui: UIPreferences;
  notifications: NotificationSettings;
}

// Default settings values
export const DEFAULT_FSRS_SETTINGS: FSRSSettings = {
  requestRetention: 0.85,         // 85% retention rate
  maximumInterval: 180,           // 6 months max interval
  easyBonus: 1.3,                // 30% bonus for easy cards
  hardInterval: 1.2,             // 20% penalty for hard cards
  newInterval: 1,                // 1 minute for new cards
  graduatingInterval: 1,         // 1 day graduation
  easyInterval: 4,               // 4 days for easy new cards
  enableFuzz: true,              // Enable interval randomization
};

export const DEFAULT_LEARNING_PREFERENCES: LearningPreferences = {
  dailyGoal: 20,                 // 20 reviews per day
  sessionLength: 20,             // 20 questions per session
  autoShowAnswer: false,         // Manual answer reveal
  keyboardShortcuts: true,       // Enable shortcuts
  soundEffects: true,            // Enable audio feedback
  reviewReminders: true,         // Enable review reminders
};

export const DEFAULT_UI_PREFERENCES: UIPreferences = {
  theme: 'auto',                 // Follow system theme
  language: 'en',                // English by default
  fontSize: 'medium',            // Medium font size
  animations: true,              // Enable animations
  compactMode: false,            // Full layout
  showProgress: true,            // Show progress indicators
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,                 // Notifications enabled
  reviewReminders: true,         // Review reminders on
  dailyGoalReminders: true,      // Daily goal reminders on
  streakReminders: true,         // Streak reminders on
  quietHours: {
    enabled: true,
    start: '22:00',              // 10 PM
    end: '08:00',                // 8 AM
  },
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  fsrs: DEFAULT_FSRS_SETTINGS,
  learning: DEFAULT_LEARNING_PREFERENCES,
  ui: DEFAULT_UI_PREFERENCES,
  notifications: DEFAULT_NOTIFICATION_SETTINGS,
};

// Validation functions
export const validateFSRSSettings = (settings: Partial<FSRSSettings>): string[] => {
  const errors: string[] = [];
  
  if (settings.requestRetention !== undefined) {
    if (settings.requestRetention < 0.7 || settings.requestRetention > 0.98) {
      errors.push('Request retention must be between 70% and 98%');
    }
  }
  
  if (settings.maximumInterval !== undefined) {
    if (settings.maximumInterval < 30 || settings.maximumInterval > 365) {
      errors.push('Maximum interval must be between 30 and 365 days');
    }
  }
  
  if (settings.easyBonus !== undefined) {
    if (settings.easyBonus < 1.0 || settings.easyBonus > 2.0) {
      errors.push('Easy bonus must be between 1.0 and 2.0');
    }
  }
  
  if (settings.hardInterval !== undefined) {
    if (settings.hardInterval < 1.0 || settings.hardInterval > 1.5) {
      errors.push('Hard interval must be between 1.0 and 1.5');
    }
  }
  
  return errors;
};

export const validateLearningPreferences = (preferences: Partial<LearningPreferences>): string[] => {
  const errors: string[] = [];
  
  if (preferences.dailyGoal !== undefined) {
    if (preferences.dailyGoal < 5 || preferences.dailyGoal > 200) {
      errors.push('Daily goal must be between 5 and 200 reviews');
    }
  }
  
  if (preferences.sessionLength !== undefined) {
    if (preferences.sessionLength < 5 || preferences.sessionLength > 50) {
      errors.push('Session length must be between 5 and 50 questions');
    }
  }
  
  return errors;
};

// Settings update helpers
export const mergeSettings = (current: UserSettings, updates: Partial<UserSettings>): UserSettings => {
  return {
    fsrs: { ...current.fsrs, ...updates.fsrs },
    learning: { ...current.learning, ...updates.learning },
    ui: { ...current.ui, ...updates.ui },
    notifications: { ...current.notifications, ...updates.notifications },
  };
};

// Settings serialization for API
export const serializeSettingsForAPI = (settings: UserSettings) => {
  return {
    fsrs_settings: settings.fsrs,
    learning_preferences: settings.learning,
    ui_preferences: settings.ui,
    notification_settings: settings.notifications,
  };
};

export const deserializeSettingsFromAPI = (apiData: any): UserSettings => {
  return {
    fsrs: { ...DEFAULT_FSRS_SETTINGS, ...apiData.fsrs_settings },
    learning: { ...DEFAULT_LEARNING_PREFERENCES, ...apiData.learning_preferences },
    ui: { ...DEFAULT_UI_PREFERENCES, ...apiData.ui_preferences },
    notifications: { ...DEFAULT_NOTIFICATION_SETTINGS, ...apiData.notification_settings },
  };
};