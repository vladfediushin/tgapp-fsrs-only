// Telegram Web App initialization and debugging utilities

export interface TelegramWebAppUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramWebAppInitData {
  query_id?: string;
  user?: TelegramWebAppUser;
  receiver?: TelegramWebAppUser;
  chat?: any;
  chat_type?: string;
  chat_instance?: string;
  start_param?: string;
  can_send_after?: number;
  auth_date: number;
  hash: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: TelegramWebAppInitData;
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: any;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  ready(): void;
  expand(): void;
  close(): void;
  showAlert(message: string, callback?: () => void): void;
  showConfirm(message: string, callback?: (confirmed: boolean) => void): void;
  showPopup(params: any, callback?: (buttonId: string) => void): void;
  showScanQrPopup(params: any, callback?: (text: string) => boolean): void;
  closeScanQrPopup(): void;
  readTextFromClipboard(callback?: (text: string) => void): void;
  requestWriteAccess(callback?: (granted: boolean) => void): void;
  requestContact(callback?: (granted: boolean, contact?: any) => void): void;
  onEvent(eventType: string, eventHandler: () => void): void;
  offEvent(eventType: string, eventHandler: () => void): void;
  sendData(data: string): void;
  switchInlineQuery(query: string, choose_chat_types?: string[]): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  openInvoice(url: string, callback?: (status: string) => void): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  hapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export interface TelegramInitResult {
  success: boolean;
  webApp?: TelegramWebApp;
  user?: TelegramWebAppUser;
  error?: string;
  isInTelegram: boolean;
  debugInfo: {
    hasWindow: boolean;
    hasTelegram: boolean;
    hasWebApp: boolean;
    hasInitData: boolean;
    hasUser: boolean;
    userAgent: string;
    currentUrl: string;
  };
}

/**
 * Initialize Telegram Web App with comprehensive error handling and debugging
 */
export const initializeTelegramWebApp = (): TelegramInitResult => {
  console.log('=== Telegram Web App Initialization ===');
  
  const debugInfo = {
    hasWindow: typeof window !== 'undefined',
    hasTelegram: typeof window !== 'undefined' && !!window.Telegram,
    hasWebApp: typeof window !== 'undefined' && !!window.Telegram?.WebApp,
    hasInitData: false,
    hasUser: false,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    currentUrl: typeof window !== 'undefined' ? window.location.href : 'Unknown'
  };

  console.log('Debug Info:', debugInfo);

  // Check if we're in a browser environment
  if (!debugInfo.hasWindow) {
    const error = 'Not in browser environment';
    console.error('✗', error);
    return {
      success: false,
      error,
      isInTelegram: false,
      debugInfo
    };
  }

  // Check if Telegram object exists
  if (!debugInfo.hasTelegram) {
    const error = 'Telegram object not found - not running in Telegram Web App';
    console.warn('⚠', error);
    console.log('This is normal when testing outside Telegram');
    return {
      success: false,
      error,
      isInTelegram: false,
      debugInfo
    };
  }

  // Check if WebApp exists
  if (!debugInfo.hasWebApp) {
    const error = 'Telegram.WebApp not found';
    console.error('✗', error);
    return {
      success: false,
      error,
      isInTelegram: true,
      debugInfo
    };
  }

  const webApp = window.Telegram!.WebApp;
  
  // Update debug info
  debugInfo.hasInitData = !!webApp.initData;
  debugInfo.hasUser = !!webApp.initDataUnsafe?.user;

  console.log('WebApp found:', {
    version: webApp.version,
    platform: webApp.platform,
    colorScheme: webApp.colorScheme,
    isExpanded: webApp.isExpanded,
    viewportHeight: webApp.viewportHeight,
    hasInitData: debugInfo.hasInitData,
    hasUser: debugInfo.hasUser
  });

  // Initialize WebApp
  try {
    console.log('Calling webApp.ready()...');
    webApp.ready();
    console.log('✓ webApp.ready() called successfully');

    console.log('Calling webApp.expand()...');
    webApp.expand();
    console.log('✓ webApp.expand() called successfully');

    // Log user information if available
    if (webApp.initDataUnsafe?.user) {
      const user = webApp.initDataUnsafe.user;
      console.log('✓ User data found:', {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        language_code: user.language_code,
        is_premium: user.is_premium
      });

      console.log('=== Telegram Web App Initialization Complete ===');
      return {
        success: true,
        webApp,
        user,
        isInTelegram: true,
        debugInfo
      };
    } else {
      const error = 'No user data in initDataUnsafe';
      console.warn('⚠', error);
      console.log('WebApp initialized but no user data available');
      
      return {
        success: true, // Still successful initialization, just no user data
        webApp,
        error,
        isInTelegram: true,
        debugInfo
      };
    }
  } catch (initError: any) {
    const error = `WebApp initialization failed: ${initError.message}`;
    console.error('✗', error, initError);
    
    return {
      success: false,
      webApp,
      error,
      isInTelegram: true,
      debugInfo
    };
  }
};

/**
 * Get Telegram Web App instance with fallback for development
 */
export const getTelegramWebApp = (): TelegramWebApp | null => {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
};

/**
 * Get Telegram user data with fallback for development
 */
export const getTelegramUser = (): TelegramWebAppUser | null => {
  const webApp = getTelegramWebApp();
  return webApp?.initDataUnsafe?.user || null;
};

/**
 * Check if running inside Telegram Web App
 */
export const isInTelegramWebApp = (): boolean => {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp;
};

/**
 * Create mock Telegram data for development/testing
 */
export const createMockTelegramData = (): TelegramInitResult => {
  console.log('=== Creating Mock Telegram Data for Development ===');
  
  const mockUser: TelegramWebAppUser = {
    id: 123456789,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    language_code: 'en',
    is_premium: false
  };

  const mockWebApp = {
    initDataUnsafe: {
      user: mockUser,
      auth_date: Date.now(),
      hash: 'mock_hash'
    },
    version: '6.0',
    platform: 'web',
    ready: () => console.log('Mock WebApp ready'),
    expand: () => console.log('Mock WebApp expand')
  } as any;

  console.log('✓ Mock data created:', mockUser);
  console.log('=== Mock Telegram Data Ready ===');

  return {
    success: true,
    webApp: mockWebApp,
    user: mockUser,
    isInTelegram: false,
    debugInfo: {
      hasWindow: true,
      hasTelegram: false,
      hasWebApp: false,
      hasInitData: true,
      hasUser: true,
      userAgent: navigator.userAgent,
      currentUrl: window.location.href
    }
  };
};

/**
 * Initialize with fallback to mock data in development
 */
export const initializeTelegramWebAppWithFallback = (useMockInDev: boolean = true): TelegramInitResult => {
  const result = initializeTelegramWebApp();
  
  if (!result.success && !result.isInTelegram && useMockInDev) {
    console.log('Falling back to mock data for development...');
    return createMockTelegramData();
  }
  
  return result;
};