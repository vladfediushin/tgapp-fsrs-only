/**
 * Telegram Mock for Development
 * Provides mock Telegram WebApp API for development and testing
 */

// Development environment check
// Development environment check
const isDevelopment = typeof window !== 'undefined' && window.location.hostname === 'localhost'
if (!isDevelopment) {
  console.warn('TelegramMock should only be used in development')
}

interface TelegramUser {
  id: number
  is_bot: boolean
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: TelegramUser
    chat?: any
    start_param?: string
    auth_date: number
    hash: string
  }
  version: string
  platform: string
  colorScheme: 'light' | 'dark'
  themeParams: {
    bg_color?: string
    text_color?: string
    hint_color?: string
    link_color?: string
    button_color?: string
    button_text_color?: string
  }
  isExpanded: boolean
  viewportHeight: number
  viewportStableHeight: number
  headerColor: string
  backgroundColor: string
  isClosingConfirmationEnabled: boolean
  
  // Methods
  ready(): void
  expand(): void
  close(): void
  MainButton: {
    text: string
    color: string
    textColor: string
    isVisible: boolean
    isActive: boolean
    isProgressVisible: boolean
    setText(text: string): void
    onClick(callback: () => void): void
    offClick(callback: () => void): void
    show(): void
    hide(): void
    enable(): void
    disable(): void
    showProgress(leaveActive?: boolean): void
    hideProgress(): void
    setParams(params: any): void
  }
  BackButton: {
    isVisible: boolean
    onClick(callback: () => void): void
    offClick(callback: () => void): void
    show(): void
    hide(): void
  }
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
    notificationOccurred(type: 'error' | 'success' | 'warning'): void
    selectionChanged(): void
  }
  showPopup(params: {
    title?: string
    message: string
    buttons?: Array<{
      id?: string
      type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'
      text: string
    }>
  }, callback?: (buttonId: string) => void): void
  showAlert(message: string, callback?: () => void): void
  showConfirm(message: string, callback?: (confirmed: boolean) => void): void
  showScanQrPopup(params: {
    text?: string
  }, callback?: (text: string) => void): void
  closeScanQrPopup(): void
  readTextFromClipboard(callback?: (text: string) => void): void
  requestWriteAccess(callback?: (granted: boolean) => void): void
  requestContact(callback?: (granted: boolean, contact?: any) => void): void
  onEvent(eventType: string, eventHandler: Function): void
  offEvent(eventType: string, eventHandler: Function): void
  sendData(data: string): void
  switchInlineQuery(query: string, choose_chat_types?: string[]): void
  openLink(url: string, options?: { try_instant_view?: boolean }): void
  openTelegramLink(url: string): void
  openInvoice(url: string, callback?: (status: string) => void): void
}

class TelegramMock implements TelegramWebApp {
  initData = 'user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Test%22%2C%22last_name%22%3A%22User%22%2C%22username%22%3A%22testuser%22%2C%22language_code%22%3A%22en%22%7D&auth_date=1640995200&hash=test_hash'
  
  initDataUnsafe = {
    user: {
      id: 123456789,
      is_bot: false,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
      language_code: 'en',
      is_premium: false
    },
    auth_date: 1640995200,
    hash: 'test_hash'
  }
  
  version = '6.9'
  platform = 'web'
  colorScheme: 'light' | 'dark' = 'light'
  
  themeParams = {
    bg_color: '#ffffff',
    text_color: '#000000',
    hint_color: '#999999',
    link_color: '#2481cc',
    button_color: '#2481cc',
    button_text_color: '#ffffff'
  }
  
  isExpanded = false
  viewportHeight = 600
  viewportStableHeight = 600
  headerColor = '#2481cc'
  backgroundColor = '#ffffff'
  isClosingConfirmationEnabled = false
  
  private eventHandlers: { [key: string]: Function[] } = {}
  
  MainButton = {
    text: '',
    color: '#2481cc',
    textColor: '#ffffff',
    isVisible: false,
    isActive: true,
    isProgressVisible: false,
    
    setText: (text: string) => {
      this.MainButton.text = text
      console.log('[TelegramMock] MainButton text set to:', text)
    },
    
    onClick: (callback: () => void) => {
      this.onEvent('mainButtonClicked', callback)
    },
    
    offClick: (callback: () => void) => {
      this.offEvent('mainButtonClicked', callback)
    },
    
    show: () => {
      this.MainButton.isVisible = true
      console.log('[TelegramMock] MainButton shown')
    },
    
    hide: () => {
      this.MainButton.isVisible = false
      console.log('[TelegramMock] MainButton hidden')
    },
    
    enable: () => {
      this.MainButton.isActive = true
      console.log('[TelegramMock] MainButton enabled')
    },
    
    disable: () => {
      this.MainButton.isActive = false
      console.log('[TelegramMock] MainButton disabled')
    },
    
    showProgress: (leaveActive = false) => {
      this.MainButton.isProgressVisible = true
      if (!leaveActive) {
        this.MainButton.isActive = false
      }
      console.log('[TelegramMock] MainButton progress shown')
    },
    
    hideProgress: () => {
      this.MainButton.isProgressVisible = false
      this.MainButton.isActive = true
      console.log('[TelegramMock] MainButton progress hidden')
    },
    
    setParams: (params: any) => {
      Object.assign(this.MainButton, params)
      console.log('[TelegramMock] MainButton params set:', params)
    }
  }
  
  BackButton = {
    isVisible: false,
    
    onClick: (callback: () => void) => {
      this.onEvent('backButtonClicked', callback)
    },
    
    offClick: (callback: () => void) => {
      this.offEvent('backButtonClicked', callback)
    },
    
    show: () => {
      this.BackButton.isVisible = true
      console.log('[TelegramMock] BackButton shown')
    },
    
    hide: () => {
      this.BackButton.isVisible = false
      console.log('[TelegramMock] BackButton hidden')
    }
  }
  
  HapticFeedback = {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => {
      console.log('[TelegramMock] Haptic feedback impact:', style)
    },
    
    notificationOccurred: (type: 'error' | 'success' | 'warning') => {
      console.log('[TelegramMock] Haptic feedback notification:', type)
    },
    
    selectionChanged: () => {
      console.log('[TelegramMock] Haptic feedback selection changed')
    }
  }
  
  ready(): void {
    console.log('[TelegramMock] WebApp ready')
    this.triggerEvent('ready')
  }
  
  expand(): void {
    this.isExpanded = true
    this.viewportHeight = 800
    console.log('[TelegramMock] WebApp expanded')
    this.triggerEvent('viewportChanged', { isStateStable: true })
  }
  
  close(): void {
    console.log('[TelegramMock] WebApp close requested')
    this.triggerEvent('close')
  }
  
  showPopup(params: {
    title?: string
    message: string
    buttons?: Array<{
      id?: string
      type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'
      text: string
    }>
  }, callback?: (buttonId: string) => void): void {
    console.log('[TelegramMock] Popup shown:', params)
    
    // Simulate user clicking the first button after a delay
    setTimeout(() => {
      const buttonId = params.buttons?.[0]?.id || 'ok'
      callback?.(buttonId)
    }, 1000)
  }
  
  showAlert(message: string, callback?: () => void): void {
    console.log('[TelegramMock] Alert shown:', message)
    setTimeout(() => callback?.(), 1000)
  }
  
  showConfirm(message: string, callback?: (confirmed: boolean) => void): void {
    console.log('[TelegramMock] Confirm shown:', message)
    // Simulate user confirming
    setTimeout(() => callback?.(true), 1000)
  }
  
  showScanQrPopup(params: { text?: string }, callback?: (text: string) => void): void {
    console.log('[TelegramMock] QR scan popup shown:', params)
    // Simulate QR code scan result
    setTimeout(() => callback?.('mock_qr_result'), 2000)
  }
  
  closeScanQrPopup(): void {
    console.log('[TelegramMock] QR scan popup closed')
  }
  
  readTextFromClipboard(callback?: (text: string) => void): void {
    console.log('[TelegramMock] Reading from clipboard')
    // Simulate clipboard content
    setTimeout(() => callback?.('mock clipboard content'), 500)
  }
  
  requestWriteAccess(callback?: (granted: boolean) => void): void {
    console.log('[TelegramMock] Write access requested')
    setTimeout(() => callback?.(true), 500)
  }
  
  requestContact(callback?: (granted: boolean, contact?: any) => void): void {
    console.log('[TelegramMock] Contact access requested')
    setTimeout(() => callback?.(true, {
      contact: {
        user_id: 123456789,
        phone_number: '+1234567890',
        first_name: 'Test',
        last_name: 'User'
      }
    }), 1000)
  }
  
  onEvent(eventType: string, eventHandler: Function): void {
    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = []
    }
    this.eventHandlers[eventType].push(eventHandler)
    console.log('[TelegramMock] Event handler added for:', eventType)
  }
  
  offEvent(eventType: string, eventHandler: Function): void {
    if (this.eventHandlers[eventType]) {
      const index = this.eventHandlers[eventType].indexOf(eventHandler)
      if (index > -1) {
        this.eventHandlers[eventType].splice(index, 1)
        console.log('[TelegramMock] Event handler removed for:', eventType)
      }
    }
  }
  
  sendData(data: string): void {
    console.log('[TelegramMock] Data sent to bot:', data)
    this.triggerEvent('dataSent', data)
  }
  
  switchInlineQuery(query: string, choose_chat_types?: string[]): void {
    console.log('[TelegramMock] Inline query switched:', query, choose_chat_types)
  }
  
  openLink(url: string, options?: { try_instant_view?: boolean }): void {
    console.log('[TelegramMock] Link opened:', url, options)
    // In a real browser, this would open the link
    if (typeof window !== 'undefined') {
      window.open(url, '_blank')
    }
  }
  
  openTelegramLink(url: string): void {
    console.log('[TelegramMock] Telegram link opened:', url)
  }
  
  openInvoice(url: string, callback?: (status: string) => void): void {
    console.log('[TelegramMock] Invoice opened:', url)
    // Simulate successful payment
    setTimeout(() => callback?.('paid'), 2000)
  }
  
  private triggerEvent(eventType: string, data?: any): void {
    if (this.eventHandlers[eventType]) {
      this.eventHandlers[eventType].forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          console.error('[TelegramMock] Error in event handler:', error)
        }
      })
    }
  }
  
  // Mock-specific methods for testing
  simulateMainButtonClick(): void {
    console.log('[TelegramMock] Simulating MainButton click')
    this.triggerEvent('mainButtonClicked')
  }
  
  simulateBackButtonClick(): void {
    console.log('[TelegramMock] Simulating BackButton click')
    this.triggerEvent('backButtonClicked')
  }
  
  simulateThemeChange(colorScheme: 'light' | 'dark'): void {
    this.colorScheme = colorScheme
    if (colorScheme === 'dark') {
      this.themeParams = {
        bg_color: '#1c1c1e',
        text_color: '#ffffff',
        hint_color: '#8e8e93',
        link_color: '#007aff',
        button_color: '#007aff',
        button_text_color: '#ffffff'
      }
      this.backgroundColor = '#1c1c1e'
    } else {
      this.themeParams = {
        bg_color: '#ffffff',
        text_color: '#000000',
        hint_color: '#999999',
        link_color: '#2481cc',
        button_color: '#2481cc',
        button_text_color: '#ffffff'
      }
      this.backgroundColor = '#ffffff'
    }
    console.log('[TelegramMock] Theme changed to:', colorScheme)
    this.triggerEvent('themeChanged')
  }
  
  simulateViewportChange(height: number): void {
    this.viewportHeight = height
    this.viewportStableHeight = height
    console.log('[TelegramMock] Viewport changed to:', height)
    this.triggerEvent('viewportChanged', { isStateStable: true })
  }
}

// Create global mock instance
const telegramMock = new TelegramMock()

// Initialize mock in development environment
export const initializeTelegramMock = (): void => {
  if (typeof window !== 'undefined' && !(window as any).Telegram) {
    (window as any).Telegram = {
      WebApp: telegramMock
    }
    
    console.log('[TelegramMock] Telegram WebApp mock initialized')
    console.log('Available methods:', Object.getOwnPropertyNames(telegramMock))
    
    // Auto-ready the WebApp
    setTimeout(() => {
      telegramMock.ready()
    }, 100)
  }
}

// Utility functions for testing
export const getTelegramMock = (): TelegramMock => telegramMock

export const mockTelegramUser = (user: Partial<TelegramUser>): void => {
  Object.assign(telegramMock.initDataUnsafe.user!, user)
  console.log('[TelegramMock] User data updated:', user)
}

export const mockTelegramTheme = (theme: 'light' | 'dark'): void => {
  telegramMock.simulateThemeChange(theme)
}

// Auto-initialize in development
if (isDevelopment) {
  initializeTelegramMock()
}

export default telegramMock
export type { TelegramWebApp, TelegramUser }