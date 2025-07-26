// src/pages/Authorize.tsx - Enhanced with debugging and connection status
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createUser, UserOut as ApiUserOut, testConnection } from '../api/api'
import { useSession, updateUserAndCache, loadTopicsWithCache, loadUserWithCache } from '../store/session'
import { AxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import LoadingSpinner from '../components/LoadingSpinner'
import CustomSelect from '../components/CustomSelect'
import ConnectionStatus from '../components/ConnectionStatus'
import { UserCheck, Globe, MapPin, Languages, AlertTriangle, Wifi } from 'lucide-react'
import { initializeTelegramWebAppWithFallback, TelegramInitResult } from '../utils/telegramWebApp'

// Список стран
const EXAM_COUNTRIES = [
  { value: 'am', label: '🇦🇲 Армения' },
  { value: 'kz', label: '🇰🇿 Казахстан' },
  { value: 'by', label: '🇧🇾 Беларусь' },
]

// Языки экзамена и интерфейса
const EXAM_LANGUAGES = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
]
const UI_LANGUAGES = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
]

const Authorize = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // Enhanced Telegram initialization with debugging
  const [telegramInit, setTelegramInit] = useState(null as TelegramInitResult | null)
  const [connectionStatus, setConnectionStatus] = useState('testing' as 'testing' | 'connected' | 'failed')
  const [debugMode, setDebugMode] = useState(false)

  // Initialize Telegram Web App with enhanced debugging
  useEffect(() => {
    console.log('[Authorize] Initializing Telegram Web App...')
    const result = initializeTelegramWebAppWithFallback(true)
    setTelegramInit(result)
    
    if (!result.success) {
      console.warn('[Authorize] Telegram initialization failed:', result.error)
    }
  }, [])

  // для этой страницы: подтягиваем языковой код из Telegram и ставим дефолт
  const tgUser = telegramInit?.user
  const rawLang = tgUser?.language_code?.split('-')[0] ?? ''
  const hasLang = UI_LANGUAGES.some(l => l.value === rawLang)
  const defaultUiLang = hasLang ? rawLang : 'en'

  // экшены стора
  const setInternalId        = useSession(state => state.setUserId)
  const setCachedUser        = useSession(state => state.setCachedUser)
  const setStoreExamCountry  = useSession(state => state.setExamCountry)
  const setStoreExamLanguage = useSession(state => state.setExamLanguage)
  const setStoreUiLanguage   = useSession(state => state.setUiLanguage)

  const [step, setStep]         = useState('checking')
  const [userName, setUserName] = useState('друг')

  // локальные стейты для формы
  const [examCountryInput, setExamCountryInput]   = useState('')
  const [examLanguageInput, setExamLanguageInput] = useState('')
  const [uiLanguageInput, setUiLanguageInput]     = useState(defaultUiLang)

  const [error, setError] = useState('')
  const [debugInfo, setDebugInfo] = useState('')

  // меняем язык i18next на тот, что из Telegram (или en), и затем при выборе в форме
  useEffect(() => {
    i18n.changeLanguage(uiLanguageInput)
  }, [uiLanguageInput])

  // Keyboard shortcut for debug mode (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault()
        setDebugMode(prev => !prev)
        console.log('[Authorize] Debug mode toggled:', !debugMode)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [debugMode])

  // Enhanced initialization with debugging and connection testing
  useEffect(() => {
    const init = async () => {
      console.log('[Authorize] Starting enhanced initialization...')
      
      // Wait for Telegram initialization if not ready
      if (!telegramInit) {
        console.log('[Authorize] Waiting for Telegram initialization...')
        return
      }

      console.log('[Authorize] Telegram init result:', telegramInit)

      // Test backend connection first
      console.log('[Authorize] Testing backend connection...')
      setConnectionStatus('testing')
      
      try {
        const connectionResult = await testConnection()
        if (connectionResult.success) {
          console.log('[Authorize] ✓ Backend connection successful')
          setConnectionStatus('connected')
        } else {
          console.error('[Authorize] ✗ Backend connection failed:', connectionResult.error)
          setConnectionStatus('failed')
          setError(t('authorize.error.connectionFailed'))
          setDebugInfo(`Connection failed: ${connectionResult.error}`)
          return
        }
      } catch (connError) {
        console.error('[Authorize] ✗ Connection test error:', connError)
        setConnectionStatus('failed')
        setError(t('authorize.error.connectionFailed'))
        setDebugInfo(`Connection test failed: ${connError}`)
        return
      }

      // Handle Telegram user data
      const tgUser = telegramInit.user
      if (!tgUser) {
        console.warn('[Authorize] No Telegram user data available')
        if (telegramInit.isInTelegram) {
          setError(t('authorize.error.telegramData'))
          setDebugInfo('Telegram Web App detected but no user data available')
        } else {
          console.log('[Authorize] Not in Telegram environment, proceeding with form')
          setDebugInfo('Running outside Telegram environment (development mode)')
        }
        setStep('form')
        return
      }

      console.log('[Authorize] Processing Telegram user:', tgUser)
      setUserName(tgUser.first_name || 'друг')

      try {
        console.log('[Authorize] Loading user from cache/API...')
        const user = await loadUserWithCache(tgUser.id)

        console.log('[Authorize] ✓ Existing user found:', user)
        
        // Данные уже кешированы в loadUserWithCache, просто обновляем локальные стейты
        setInternalId(user.id)
        setStoreExamCountry(user.exam_country  ?? '')
        setStoreExamLanguage(user.exam_language ?? '')
        setStoreUiLanguage(user.ui_language     ?? '')

        // загружаем темы с кешированием (уже сохраняется в кеш автоматически)
        console.log('[Authorize] Loading topics...')
        await loadTopicsWithCache(
          user.exam_country  ?? '',
          user.exam_language ?? ''
        )

        console.log('[Authorize] ✓ User initialization complete, navigating to home')
        // переходим на Home - existing user
        setStep('complete')
      } catch (err) {
        const axiosErr = err as AxiosError
        console.log('[Authorize] User lookup error:', axiosErr)
        
        if (axiosErr.response?.status === 404) {
          console.log('[Authorize] New user detected, showing form')
          // New user - show form
          setStep('form')
        } else {
          console.error('[Authorize] ✗ User check error:', axiosErr)
          setError(t('authorize.error.checkUser'))
          setDebugInfo(`User check failed: ${axiosErr.message}`)
          setStep('form')
        }
      }
    }
    
    init()
  }, [
    telegramInit,
    t,
    setInternalId,
    setStoreExamCountry,
    setStoreExamLanguage,
    setStoreUiLanguage,
  ])

  // Когда step становится complete — делаем navigate
  useEffect(() => {
    if (step === 'complete') {
      navigate('/home', { replace: true })
    }
  }, [step, navigate])

  const handleSubmit = async () => {
    console.log('[Authorize] Starting user creation...')
    
    if (!examCountryInput || !examLanguageInput || !uiLanguageInput) {
      setError(t('authorize.error.requiredFields'))
      return
    }
    setError('')
    setDebugInfo('')

    // Check connection status first
    if (connectionStatus !== 'connected') {
      console.error('[Authorize] Cannot create user - no backend connection')
      setError(t('authorize.error.connectionRequired'))
      setDebugInfo('Backend connection required for user creation')
      return
    }

    const tgUser = telegramInit?.user
    if (!tgUser) {
      console.warn('[Authorize] No Telegram user data for user creation')
      
      if (telegramInit?.isInTelegram) {
        setError(t('authorize.error.telegramData'))
        setDebugInfo('Telegram Web App detected but no user data available')
      } else {
        // Development mode - create user with mock data
        console.log('[Authorize] Development mode - using mock Telegram ID')
        setError(t('authorize.error.developmentMode'))
        setDebugInfo('Development mode: Telegram user data not available')
      }
      return
    }

    try {
      console.log('[Authorize] Creating user with data:', {
        telegram_id: tgUser.id,
        username: tgUser.username,
        first_name: tgUser.first_name,
        exam_country: examCountryInput,
        exam_language: examLanguageInput,
        ui_language: uiLanguageInput
      })

      const res = await createUser({
        telegram_id: tgUser.id,
        username: tgUser.username || undefined,
        first_name: tgUser.first_name || undefined,
        last_name: tgUser.last_name || undefined,
        exam_country: examCountryInput,
        exam_language: examLanguageInput,
        ui_language: uiLanguageInput,
        // exam_date and daily_goal are optional - will be set in next step
      })

      console.log('[Authorize] ✓ User created successfully:', res.data)

      setInternalId(res.data.id)
      setStoreExamCountry(res.data.exam_country  ?? '')
      setStoreExamLanguage(res.data.exam_language ?? '')
      setStoreUiLanguage(res.data.ui_language     ?? '')

      // подтягиваем темы с кешированием (уже сохраняется в кеш автоматически)
      console.log('[Authorize] Loading topics for new user...')
      await loadTopicsWithCache(
        res.data.exam_country  ?? '',
        res.data.exam_language ?? ''
      )

      console.log('[Authorize] ✓ New user setup complete, navigating to home')
      // Новый пользователь создан - переходим сразу на домашнюю страницу
      setStep('complete')
    } catch (createError: any) {
      console.error('[Authorize] ✗ User creation failed:', createError)
      setError(t('authorize.error.createUser'))
      setDebugInfo(`User creation failed: ${createError.message || 'Unknown error'}`)
    }
  }



  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Debug Panel - Toggle with Ctrl+Shift+D */}
      {debugMode && (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          background: 'white',
          border: '1px solid #ccc',
          borderRadius: '8px',
          padding: '12px',
          maxWidth: '300px',
          fontSize: '12px',
          zIndex: 1000,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Debug Info</div>
          {telegramInit && (
            <div style={{ marginBottom: '8px' }}>
              <div>Telegram: {telegramInit.isInTelegram ? '✓' : '✗'}</div>
              <div>User: {telegramInit.user ? `${telegramInit.user.first_name} (${telegramInit.user.id})` : '✗'}</div>
              <div>Connection: {connectionStatus}</div>
            </div>
          )}
          {debugInfo && (
            <div style={{ color: '#666', fontSize: '11px' }}>
              {debugInfo}
            </div>
          )}
        </div>
      )}

      {/* Connection Status Header */}
      <div style={{
        padding: '12px 24px',
        background: 'rgba(255, 255, 255, 0.9)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ConnectionStatus
            showDetails={false}
            autoTest={false}
            onStatusChange={(status) => {
              setConnectionStatus(status.success ? 'connected' : 'failed')
            }}
          />
          {telegramInit && !telegramInit.isInTelegram && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#92400e'
            }}>
              <AlertTriangle size={14} />
              Development Mode
            </div>
          )}
        </div>
        
        <button
          onClick={() => setDebugMode(!debugMode)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            color: '#6b7280'
          }}
          title="Toggle Debug Info (Ctrl+Shift+D)"
        >
          <Wifi size={16} />
        </button>
      </div>

      {step === 'checking' && (
        <LoadingSpinner
          size={80}
          text={t('authorize.checking')}
          fullScreen
        />
      )}

      {step === 'form' && (
        <div style={{
          flex: 1,
          padding: '24px',
          paddingBottom: '24px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            maxWidth: '352px', // 375 - 24*2 = 327, но 352px для чуть большего экрана
            width: '100%',
            margin: '0 auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            boxSizing: 'border-box',
          }}>
            {/* Welcome Header */}
            <div style={{
              textAlign: 'center',
              marginBottom: '32px'
            }}>
              <div style={{
                backgroundColor: 'white',
                borderRadius: '50%',
                padding: '12px',
                width: '56px',
                height: '56px',
                margin: '0 auto 24px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <UserCheck size={28} style={{ color: '#2563eb' }} />
              </div>
              <h1 style={{
                fontSize: '30px',
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: '8px'
              }}>
                {t('authorize.welcome', { userName })}
              </h1>
              <p style={{
                color: '#6b7280',
                lineHeight: '1.6'
              }}>
                {t('authorize.intro')}
              </p>
            </div>

            {/* Form */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }}>
              {/* Exam Country */}
              <div>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '12px'
                }}>
                  <MapPin size={16} style={{ color: '#2563eb' }} />
                  {t('authorize.label.examCountry')}
                </label>
                <CustomSelect
                  value={examCountryInput}
                  onChange={setExamCountryInput}
                  options={EXAM_COUNTRIES}
                  placeholder={t('authorize.placeholder.selectCountry')}
                  icon={<MapPin size={16} style={{ color: '#2563eb' }} />}
                />
              </div>

              {/* Exam Language */}
              <div>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '12px'
                }}>
                  <Languages size={16} style={{ color: '#2563eb' }} />
                  {t('authorize.label.examLanguage')}
                </label>
                <CustomSelect
                  value={examLanguageInput}
                  onChange={setExamLanguageInput}
                  options={EXAM_LANGUAGES}
                  placeholder={t('authorize.placeholder.selectLanguage')}
                  icon={<Languages size={16} style={{ color: '#2563eb' }} />}
                />
              </div>

              {/* UI Language */}
              <div>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '12px'
                }}>
                  <Globe size={16} style={{ color: '#2563eb' }} />
                  {t('authorize.label.uiLanguage')}
                </label>
                <CustomSelect
                  value={uiLanguageInput}
                  onChange={setUiLanguageInput}
                  options={UI_LANGUAGES}
                  placeholder={t('authorize.placeholder.selectLanguage')}
                  icon={<Globe size={16} style={{ color: '#2563eb' }} />}
                />
              </div>
            </div>

            {/* Button Container with fixed spacing */}
            <div style={{
              marginTop: '48px',
              position: 'relative'
            }}>
              {/* Error Message - positioned above button */}
              {error && (
                <div style={{
                  position: 'absolute',
                  top: debugInfo ? '-80px' : '-40px',
                  left: 0,
                  right: 0,
                  padding: '12px 16px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  zIndex: 10
                }}>
                  <p style={{
                    color: '#b91c1c',
                    fontSize: '14px',
                    margin: 0,
                    textAlign: 'center'
                  }}>{error}</p>
                  
                  {debugInfo && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px',
                      backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#6b7280',
                      textAlign: 'left'
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Debug Info:</div>
                      <div style={{ fontFamily: 'monospace' }}>{debugInfo}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                  color: 'white',
                  padding: '16px 24px',
                  borderRadius: '12px',
                  fontWeight: '600',
                  fontSize: '18px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                  e.target.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  e.target.style.transform = 'translateY(0)'
                }}
              >
                {t('authorize.button.next')}
              </button>
            </div>

            {/* Footer Info */}
            <p style={{
              marginTop: '24px',
              fontSize: '14px',
              color: '#9ca3af',
              textAlign: 'center',
              lineHeight: '1.6'
            }}>
              {t('authorize.footer.info')}
            </p>
          </div>
        </div>
      )}

      {step === 'complete' && (
        <LoadingSpinner 
          size={80} 
          text={t('authorize.checking')} 
          fullScreen 
        />
      )}
    </div>
  )
}

export default Authorize
