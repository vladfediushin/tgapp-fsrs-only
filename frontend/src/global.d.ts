interface Window {
  Telegram: {
    WebApp: any;
  };
}

// Vite environment variables
interface ImportMetaEnv {
  readonly MODE: string
  readonly VITE_APP_VERSION?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_ANALYTICS_ENDPOINT?: string
  readonly VITE_ANALYTICS_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}