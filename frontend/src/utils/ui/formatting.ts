// UI Formatting Utilities
// Consolidated from pluralUtils.ts and other formatting utilities
// Provides text formatting, pluralization, number formatting, and display utilities

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface FormatConfig {
  locale: string
  currency: string
  timezone: string
  dateFormat: 'short' | 'medium' | 'long' | 'full'
  timeFormat: '12h' | '24h'
  numberFormat: 'standard' | 'compact' | 'scientific'
}

export interface PluralRules {
  zero?: string
  one: string
  two?: string
  few?: string
  many?: string
  other: string
}

export interface TextTruncateOptions {
  maxLength: number
  suffix: string
  preserveWords: boolean
}

// ============================================================================
// Pluralization Utilities
// ============================================================================

/**
 * Function to get correct declension/plural form for streak
 * @param count - number of days
 * @param t - translation function from react-i18next
 * @returns string with correct declension
 */
export function getStreakText(count: number, t: (key: string, options?: any) => string): string {
  if (count === 1) {
    return t('home.streak.days_1', { count })
  }
  
  // For Russian language: special declension rules
  if (t('home.streak.days_2') !== 'home.streak.days_2') { // check if translation exists (Russian)
    if (count >= 2 && count <= 4) {
      return t('home.streak.days_2', { count })
    } else if (count === 0 || count >= 5) {
      return t('home.streak.days_5', { count })
    }
  }
  
  // For English language: simple rule
  if (count === 0 || count > 1) {
    return t('home.streak.days_other', { count }) || t('home.streak.days_0', { count })
  }
  
  return t('home.streak.days_1', { count })
}

/**
 * Generic pluralization function
 */
export function pluralize(
  count: number, 
  rules: PluralRules, 
  locale: string = 'en'
): string {
  // Handle zero case
  if (count === 0 && rules.zero) {
    return rules.zero.replace('{count}', count.toString())
  }

  // Use Intl.PluralRules for proper pluralization
  const pluralRule = new Intl.PluralRules(locale).select(count)
  
  let selectedRule: string
  switch (pluralRule) {
    case 'zero':
      selectedRule = rules.zero || rules.other
      break
    case 'one':
      selectedRule = rules.one
      break
    case 'two':
      selectedRule = rules.two || rules.other
      break
    case 'few':
      selectedRule = rules.few || rules.other
      break
    case 'many':
      selectedRule = rules.many || rules.other
      break
    default:
      selectedRule = rules.other
  }

  return selectedRule.replace('{count}', count.toString())
}

/**
 * Simple English pluralization
 */
export function pluralizeSimple(count: number, singular: string, plural?: string): string {
  if (count === 1) {
    return `${count} ${singular}`
  }
  return `${count} ${plural || singular + 's'}`
}

// ============================================================================
// Number Formatting
// ============================================================================

/**
 * Format numbers with locale-specific formatting
 */
export function formatNumber(
  value: number, 
  options: {
    locale?: string
    style?: 'decimal' | 'currency' | 'percent' | 'unit'
    currency?: string
    minimumFractionDigits?: number
    maximumFractionDigits?: number
    notation?: 'standard' | 'scientific' | 'engineering' | 'compact'
  } = {}
): string {
  const {
    locale = 'en-US',
    style = 'decimal',
    currency = 'USD',
    minimumFractionDigits,
    maximumFractionDigits,
    notation = 'standard'
  } = options

  try {
    return new Intl.NumberFormat(locale, {
      style,
      currency: style === 'currency' ? currency : undefined,
      minimumFractionDigits,
      maximumFractionDigits,
      notation
    }).format(value)
  } catch (error) {
    console.warn('Number formatting failed:', error)
    return value.toString()
  }
}

/**
 * Format percentage values
 */
export function formatPercentage(
  value: number, 
  decimals: number = 1,
  locale: string = 'en-US'
): string {
  return formatNumber(value / 100, {
    locale,
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

/**
 * Format large numbers with compact notation
 */
export function formatCompactNumber(
  value: number, 
  locale: string = 'en-US'
): string {
  return formatNumber(value, {
    locale,
    notation: 'compact',
    maximumFractionDigits: 1
  })
}

/**
 * Format file sizes
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

// ============================================================================
// Time and Date Formatting
// ============================================================================

/**
 * Format duration in seconds to human-readable format
 */
export function formatDuration(
  seconds: number, 
  options: {
    format?: 'short' | 'long' | 'compact'
    showSeconds?: boolean
    maxUnits?: number
  } = {}
): string {
  const { format = 'short', showSeconds = true, maxUnits = 3 } = options

  if (seconds < 0) return '0s'

  const units = [
    { name: 'year', short: 'y', seconds: 31536000 },
    { name: 'month', short: 'mo', seconds: 2592000 },
    { name: 'day', short: 'd', seconds: 86400 },
    { name: 'hour', short: 'h', seconds: 3600 },
    { name: 'minute', short: 'm', seconds: 60 },
    { name: 'second', short: 's', seconds: 1 }
  ]

  const parts: string[] = []
  let remaining = Math.floor(seconds)

  for (const unit of units) {
    if (remaining >= unit.seconds && parts.length < maxUnits) {
      const count = Math.floor(remaining / unit.seconds)
      remaining %= unit.seconds

      if (unit.name === 'second' && !showSeconds && parts.length > 0) {
        break
      }

      switch (format) {
        case 'short':
          parts.push(`${count}${unit.short}`)
          break
        case 'compact':
          parts.push(`${count}${unit.short}`)
          break
        case 'long':
          parts.push(pluralizeSimple(count, unit.name))
          break
      }
    }
  }

  if (parts.length === 0) {
    return showSeconds ? (format === 'long' ? '0 seconds' : '0s') : '0m'
  }

  return format === 'compact' ? parts.join('') : parts.join(' ')
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(
  date: Date | string | number,
  locale: string = 'en-US'
): string {
  const targetDate = new Date(date)
  const now = new Date()
  const diffMs = targetDate.getTime() - now.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)

  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

    const units: Array<[string, number]> = [
      ['year', 31536000],
      ['month', 2592000],
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60],
      ['second', 1]
    ]

    for (const [unit, seconds] of units) {
      const value = Math.floor(Math.abs(diffSeconds) / seconds)
      if (value >= 1) {
        return rtf.format(diffSeconds < 0 ? -value : value, unit as Intl.RelativeTimeFormatUnit)
      }
    }

    return rtf.format(0, 'second')
  } catch (error) {
    console.warn('Relative time formatting failed:', error)
    return targetDate.toLocaleDateString()
  }
}

/**
 * Format date with locale-specific formatting
 */
export function formatDate(
  date: Date | string | number,
  options: {
    locale?: string
    dateStyle?: 'full' | 'long' | 'medium' | 'short'
    timeStyle?: 'full' | 'long' | 'medium' | 'short'
    includeTime?: boolean
  } = {}
): string {
  const {
    locale = 'en-US',
    dateStyle = 'medium',
    timeStyle = 'short',
    includeTime = false
  } = options

  const targetDate = new Date(date)

  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle,
      timeStyle: includeTime ? timeStyle : undefined
    }).format(targetDate)
  } catch (error) {
    console.warn('Date formatting failed:', error)
    return targetDate.toLocaleDateString()
  }
}

// ============================================================================
// Text Formatting
// ============================================================================

/**
 * Truncate text with options
 */
export function truncateText(
  text: string, 
  options: TextTruncateOptions
): string {
  const { maxLength, suffix = '...', preserveWords = true } = options

  if (text.length <= maxLength) {
    return text
  }

  let truncated = text.substring(0, maxLength - suffix.length)

  if (preserveWords) {
    const lastSpace = truncated.lastIndexOf(' ')
    if (lastSpace > 0) {
      truncated = truncated.substring(0, lastSpace)
    }
  }

  return truncated + suffix
}

/**
 * Capitalize first letter of each word
 */
export function titleCase(text: string): string {
  return text.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  )
}

/**
 * Convert to sentence case
 */
export function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

/**
 * Convert to kebab-case
 */
export function kebabCase(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
}

/**
 * Convert to camelCase
 */
export function camelCase(text: string): string {
  return text
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => 
      index === 0 ? word.toLowerCase() : word.toUpperCase()
    )
    .replace(/\s+/g, '')
}

/**
 * Remove HTML tags from text
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

/**
 * Escape HTML characters
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// ============================================================================
// Display Utilities
// ============================================================================

/**
 * Format user initials from name
 */
export function getInitials(name: string, maxLength: number = 2): string {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, maxLength)
    .join('')
}

/**
 * Generate color from string (for avatars, etc.)
 */
export function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 50%)`
}

/**
 * Format score or rating display
 */
export function formatScore(
  score: number, 
  maxScore: number = 100,
  options: {
    showMax?: boolean
    format?: 'percentage' | 'fraction' | 'decimal'
    decimals?: number
  } = {}
): string {
  const { showMax = false, format = 'percentage', decimals = 1 } = options

  switch (format) {
    case 'percentage':
      const percentage = (score / maxScore) * 100
      return `${percentage.toFixed(decimals)}%`
    
    case 'fraction':
      return showMax ? `${score}/${maxScore}` : score.toString()
    
    case 'decimal':
      return score.toFixed(decimals)
    
    default:
      return score.toString()
  }
}

/**
 * Format progress indicator text
 */
export function formatProgress(
  current: number, 
  total: number,
  options: {
    showPercentage?: boolean
    showFraction?: boolean
    template?: string
  } = {}
): string {
  const { showPercentage = true, showFraction = true, template } = options

  if (template) {
    return template
      .replace('{current}', current.toString())
      .replace('{total}', total.toString())
      .replace('{percentage}', Math.round((current / total) * 100).toString())
  }

  const parts: string[] = []
  
  if (showFraction) {
    parts.push(`${current}/${total}`)
  }
  
  if (showPercentage) {
    const percentage = Math.round((current / total) * 100)
    parts.push(`(${percentage}%)`)
  }

  return parts.join(' ')
}

// ============================================================================
// Validation and Sanitization
// ============================================================================

/**
 * Sanitize text for display
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/[<>]/g, '') // Remove potential HTML brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .trim()
}

/**
 * Validate and format phone number
 */
export function formatPhoneNumber(phone: string, locale: string = 'US'): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')
  
  // Basic US phone number formatting
  if (locale === 'US' && digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  
  return phone // Return original if can't format
}

// ============================================================================
// Formatter Class
// ============================================================================

export class TextFormatter {
  private config: FormatConfig

  constructor(config: Partial<FormatConfig> = {}) {
    this.config = {
      locale: 'en-US',
      currency: 'USD',
      timezone: 'UTC',
      dateFormat: 'medium',
      timeFormat: '12h',
      numberFormat: 'standard',
      ...config
    }
  }

  updateConfig(updates: Partial<FormatConfig>): void {
    this.config = { ...this.config, ...updates }
  }

  formatNumber(value: number, style?: 'decimal' | 'currency' | 'percent'): string {
    return formatNumber(value, {
      locale: this.config.locale,
      style,
      currency: this.config.currency,
      notation: this.config.numberFormat as any
    })
  }

  formatDate(date: Date | string | number, includeTime: boolean = false): string {
    return formatDate(date, {
      locale: this.config.locale,
      dateStyle: this.config.dateFormat,
      includeTime
    })
  }

  formatDuration(seconds: number): string {
    return formatDuration(seconds, { format: 'short' })
  }

  pluralize(count: number, rules: PluralRules): string {
    return pluralize(count, rules, this.config.locale)
  }
}

// ============================================================================
// Default Configuration
// ============================================================================

export const defaultFormatConfig: FormatConfig = {
  locale: 'en-US',
  currency: 'USD',
  timezone: 'UTC',
  dateFormat: 'medium',
  timeFormat: '12h',
  numberFormat: 'standard'
}

export default {
  getStreakText,
  pluralize,
  pluralizeSimple,
  formatNumber,
  formatPercentage,
  formatCompactNumber,
  formatFileSize,
  formatDuration,
  formatRelativeTime,
  formatDate,
  truncateText,
  titleCase,
  sentenceCase,
  kebabCase,
  camelCase,
  stripHtml,
  escapeHtml,
  getInitials,
  stringToColor,
  formatScore,
  formatProgress,
  sanitizeText,
  formatPhoneNumber,
  TextFormatter,
  defaultFormatConfig
}