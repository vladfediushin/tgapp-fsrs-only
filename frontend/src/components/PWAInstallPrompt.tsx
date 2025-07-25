// PWA Installation Prompt Component
// Provides user-friendly installation prompts for different platforms

import React, { useState, useEffect } from 'react'
import { usePWAInstall } from '../utils/core/serviceWorker'

interface PWAInstallPromptProps {
  className?: string
  variant?: 'banner' | 'modal' | 'button' | 'card'
  position?: 'top' | 'bottom' | 'center'
  autoShow?: boolean
  showDelay?: number
  dismissible?: boolean
  onInstall?: () => void
  onDismiss?: () => void
}

// ============================================================================
// Installation Instructions by Platform
// ============================================================================

const InstallInstructions: React.FC<{ platform: string; onClose: () => void }> = ({ 
  platform, 
  onClose 
}) => {
  const getInstructions = () => {
    switch (platform) {
      case 'ios':
        return {
          title: 'Установить на iPhone/iPad',
          steps: [
            'Нажмите кнопку "Поделиться" в Safari',
            'Прокрутите вниз и выберите "На экран Домой"',
            'Нажмите "Добавить" для установки приложения'
          ],
          icon: '📱'
        }
      
      case 'android':
        return {
          title: 'Установить на Android',
          steps: [
            'Нажмите меню (⋮) в браузере',
            'Выберите "Добавить на главный экран"',
            'Нажмите "Добавить" для установки'
          ],
          icon: '🤖'
        }
      
      case 'desktop':
        return {
          title: 'Установить на компьютер',
          steps: [
            'Нажмите на иконку установки в адресной строке',
            'Или используйте меню браузера',
            'Выберите "Установить приложение"'
          ],
          icon: '💻'
        }
      
      default:
        return {
          title: 'Установить приложение',
          steps: [
            'Найдите опцию "Добавить на главный экран"',
            'Или "Установить приложение" в меню браузера',
            'Следуйте инструкциям браузера'
          ],
          icon: '📲'
        }
    }
  }

  const instructions = getInstructions()

  return (
    <div className="install-instructions">
      <div className="install-header">
        <span className="install-icon">{instructions.icon}</span>
        <h3>{instructions.title}</h3>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="install-steps">
        {instructions.steps.map((step, index) => (
          <div key={index} className="install-step">
            <span className="step-number">{index + 1}</span>
            <span className="step-text">{step}</span>
          </div>
        ))}
      </div>
      
      <div className="install-benefits">
        <h4>Преимущества установки:</h4>
        <ul>
          <li>Быстрый доступ с главного экрана</li>
          <li>Работа без интернета</li>
          <li>Полноэкранный режим</li>
          <li>Уведомления о прогрессе</li>
        </ul>
      </div>
    </div>
  )
}

// ============================================================================
// Install Button Component
// ============================================================================

const InstallButton: React.FC<{
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
}> = ({ onClick, disabled = false, variant = 'primary' }) => (
  <button
    className={`install-button install-button--${variant}`}
    onClick={onClick}
    disabled={disabled}
  >
    <span className="install-button-icon">📲</span>
    <span className="install-button-text">Установить приложение</span>
  </button>
)

// ============================================================================
// Main PWA Install Prompt Component
// ============================================================================

const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  className = '',
  variant = 'banner',
  position = 'bottom',
  autoShow = true,
  showDelay = 3000,
  dismissible = true,
  onInstall,
  onDismiss
}) => {
  const { canInstall, isInstalled, platform, install } = usePWAInstall()
  const [isVisible, setIsVisible] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  // Check if user has previously dismissed the prompt
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed) {
      const dismissedTime = parseInt(dismissed)
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24)
      
      // Show again after 7 days
      if (daysSinceDismissed < 7) {
        setIsDismissed(true)
      }
    }
  }, [])

  // Auto-show logic
  useEffect(() => {
    if (!autoShow || isDismissed || isInstalled || !canInstall) {
      return
    }

    const timer = setTimeout(() => {
      setIsVisible(true)
    }, showDelay)

    return () => clearTimeout(timer)
  }, [autoShow, showDelay, isDismissed, isInstalled, canInstall])

  const handleInstall = async () => {
    setIsInstalling(true)
    
    try {
      const success = await install()
      
      if (success) {
        setIsVisible(false)
        onInstall?.()
      } else {
        // Show manual instructions for platforms that don't support programmatic install
        if (platform === 'ios' || !canInstall) {
          setShowInstructions(true)
        }
      }
    } catch (error) {
      console.error('PWA installation failed:', error)
      setShowInstructions(true)
    } finally {
      setIsInstalling(false)
    }
  }

  const handleDismiss = () => {
    setIsVisible(false)
    setIsDismissed(true)
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
    onDismiss?.()
  }

  const handleShowInstructions = () => {
    setShowInstructions(true)
  }

  const handleCloseInstructions = () => {
    setShowInstructions(false)
  }

  // Don't render if already installed or dismissed
  if (isInstalled || isDismissed) {
    return null
  }

  // Don't render if can't install and not showing instructions
  if (!canInstall && !showInstructions && platform !== 'ios') {
    return null
  }

  // Render instructions modal
  if (showInstructions) {
    return (
      <div className="pwa-install-overlay">
        <div className="pwa-install-modal">
          <InstallInstructions 
            platform={platform} 
            onClose={handleCloseInstructions}
          />
        </div>
      </div>
    )
  }

  // Don't render banner/card if not visible
  if (!isVisible && variant !== 'button') {
    return null
  }

  const baseClasses = `pwa-install-prompt pwa-install-prompt--${variant} pwa-install-prompt--${position}`

  // Button variant
  if (variant === 'button') {
    return (
      <div className={`${baseClasses} ${className}`}>
        <InstallButton
          onClick={canInstall ? handleInstall : handleShowInstructions}
          disabled={isInstalling}
          variant="primary"
        />
      </div>
    )
  }

  // Banner variant
  if (variant === 'banner') {
    return (
      <div className={`${baseClasses} ${className}`}>
        <div className="pwa-banner-content">
          <div className="pwa-banner-icon">📲</div>
          <div className="pwa-banner-text">
            <div className="pwa-banner-title">Установить приложение</div>
            <div className="pwa-banner-subtitle">
              Быстрый доступ и работа без интернета
            </div>
          </div>
          <div className="pwa-banner-actions">
            <button
              className="pwa-banner-button pwa-banner-button--install"
              onClick={canInstall ? handleInstall : handleShowInstructions}
              disabled={isInstalling}
            >
              {isInstalling ? 'Установка...' : 'Установить'}
            </button>
            {dismissible && (
              <button
                className="pwa-banner-button pwa-banner-button--dismiss"
                onClick={handleDismiss}
              >
                Позже
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Card variant
  if (variant === 'card') {
    return (
      <div className={`${baseClasses} ${className}`}>
        <div className="pwa-card-header">
          <div className="pwa-card-icon">📱</div>
          <h3 className="pwa-card-title">Установить PDD Mini App</h3>
          {dismissible && (
            <button className="pwa-card-close" onClick={handleDismiss}>×</button>
          )}
        </div>
        
        <div className="pwa-card-content">
          <p className="pwa-card-description">
            Установите приложение для быстрого доступа и работы без интернета
          </p>
          
          <div className="pwa-card-features">
            <div className="pwa-feature">
              <span className="pwa-feature-icon">⚡</span>
              <span className="pwa-feature-text">Быстрый запуск</span>
            </div>
            <div className="pwa-feature">
              <span className="pwa-feature-icon">📴</span>
              <span className="pwa-feature-text">Работа офлайн</span>
            </div>
            <div className="pwa-feature">
              <span className="pwa-feature-icon">🔔</span>
              <span className="pwa-feature-text">Уведомления</span>
            </div>
          </div>
        </div>
        
        <div className="pwa-card-actions">
          <InstallButton
            onClick={canInstall ? handleInstall : handleShowInstructions}
            disabled={isInstalling}
            variant="primary"
          />
        </div>
      </div>
    )
  }

  // Modal variant
  if (variant === 'modal') {
    return (
      <div className="pwa-install-overlay">
        <div className="pwa-install-modal">
          <div className="pwa-modal-header">
            <h2>Установить приложение</h2>
            {dismissible && (
              <button className="pwa-modal-close" onClick={handleDismiss}>×</button>
            )}
          </div>
          
          <div className="pwa-modal-content">
            <div className="pwa-modal-icon">📱</div>
            <p>
              Установите PDD Mini App для лучшего опыта использования
            </p>
            
            <div className="pwa-modal-benefits">
              <div className="pwa-benefit">
                <span className="pwa-benefit-icon">⚡</span>
                <div>
                  <strong>Быстрый доступ</strong>
                  <p>Запуск с главного экрана</p>
                </div>
              </div>
              <div className="pwa-benefit">
                <span className="pwa-benefit-icon">📴</span>
                <div>
                  <strong>Работа офлайн</strong>
                  <p>Изучайте без интернета</p>
                </div>
              </div>
              <div className="pwa-benefit">
                <span className="pwa-benefit-icon">🎯</span>
                <div>
                  <strong>Полный экран</strong>
                  <p>Без отвлекающих элементов</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="pwa-modal-actions">
            <button
              className="pwa-modal-button pwa-modal-button--primary"
              onClick={canInstall ? handleInstall : handleShowInstructions}
              disabled={isInstalling}
            >
              {isInstalling ? 'Установка...' : 'Установить'}
            </button>
            {dismissible && (
              <button
                className="pwa-modal-button pwa-modal-button--secondary"
                onClick={handleDismiss}
              >
                Не сейчас
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}

// ============================================================================
// Styles
// ============================================================================

const styles = `
.pwa-install-prompt {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  z-index: 1000;
}

/* Banner Styles */
.pwa-install-prompt--banner {
  position: fixed;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  animation: slideIn 0.3s ease-out;
}

.pwa-install-prompt--banner.pwa-install-prompt--top {
  top: 0;
}

.pwa-install-prompt--banner.pwa-install-prompt--bottom {
  bottom: 0;
}

.pwa-banner-content {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 12px;
}

.pwa-banner-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.pwa-banner-text {
  flex: 1;
  min-width: 0;
}

.pwa-banner-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 2px;
}

.pwa-banner-subtitle {
  font-size: 12px;
  opacity: 0.9;
}

.pwa-banner-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.pwa-banner-button {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pwa-banner-button--install {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.pwa-banner-button--install:hover {
  background: rgba(255, 255, 255, 0.3);
}

.pwa-banner-button--dismiss {
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
}

.pwa-banner-button--dismiss:hover {
  color: white;
}

/* Card Styles */
.pwa-install-prompt--card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  max-width: 320px;
  margin: 16px;
}

.pwa-card-header {
  display: flex;
  align-items: center;
  padding: 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.pwa-card-icon {
  font-size: 24px;
  margin-right: 12px;
}

.pwa-card-title {
  flex: 1;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.pwa-card-close {
  background: none;
  border: none;
  font-size: 20px;
  color: #666;
  cursor: pointer;
  padding: 4px;
}

.pwa-card-content {
  padding: 16px;
}

.pwa-card-description {
  margin: 0 0 16px 0;
  color: #666;
  font-size: 14px;
  line-height: 1.4;
}

.pwa-card-features {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.pwa-feature {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  flex: 1;
}

.pwa-feature-icon {
  font-size: 20px;
  margin-bottom: 4px;
}

.pwa-feature-text {
  font-size: 11px;
  color: #666;
}

.pwa-card-actions {
  padding: 0 16px 16px 16px;
}

/* Button Styles */
.install-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  justify-content: center;
}

.install-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.install-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.install-button--secondary {
  background: #f8f9fa;
  color: #333;
  border: 1px solid #dee2e6;
}

.install-button--secondary:hover {
  background: #e9ecef;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Modal Styles */
.pwa-install-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.pwa-install-modal {
  background: white;
  border-radius: 12px;
  max-width: 400px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  animation: modalSlideIn 0.3s ease-out;
}

.pwa-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 0 20px;
}

.pwa-modal-header h2 {
  margin: 0;
  font-size: 20px;
  color: #333;
}

.pwa-modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #666;
  cursor: pointer;
  padding: 4px;
}

.pwa-modal-content {
  padding: 20px;
  text-align: center;
}

.pwa-modal-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.pwa-modal-content p {
  margin: 0 0 20px 0;
  color: #666;
  line-height: 1.5;
}

.pwa-modal-benefits {
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: left;
}

.pwa-benefit {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.pwa-benefit-icon {
  font-size: 20px;
  margin-top: 2px;
}

.pwa-benefit strong {
  display: block;
  margin-bottom: 4px;
  color: #333;
}

.pwa-benefit p {
  margin: 0;
  font-size: 14px;
  color: #666;
}

.pwa-modal-actions {
  display: flex;
  gap: 12px;
  padding: 0 20px 20px 20px;
}

.pwa-modal-button {
  flex: 1;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pwa-modal-button--primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.pwa-modal-button--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.pwa-modal-button--secondary {
  background: #f8f9fa;
  color: #666;
  border: 1px solid #dee2e6;
}

.pwa-modal-button--secondary:hover {
  background: #e9ecef;
}

/* Install Instructions */
.install-instructions {
  padding: 20px;
}

.install-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.install-icon {
  font-size: 24px;
  margin-right: 12px;
}

.install-header h3 {
  flex: 1;
  margin: 0;
  font-size: 18px;
  color: #333;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  color: #666;
  cursor: pointer;
  padding: 4px;
}

.install-steps {
  margin-bottom: 20px;
}

.install-step {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12px;
  gap: 12px;
}

.step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: #667eea;
  color: white;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.step-text {
  flex: 1;
  font-size: 14px;
  color: #333;
  line-height: 1.4;
  padding-top: 2px;
}

.install-benefits {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
}

.install-benefits h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #333;
}

.install-benefits ul {
  margin: 0;
  padding-left: 16px;
}

.install-benefits li {
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
}

/* Animations */
@keyframes slideIn {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Responsive */
@media (max-width: 480px) {
  .pwa-banner-content {
    padding: 10px 12px;
    gap: 8px;
  }
  
  .pwa-banner-title {
    font-size: 13px;
  }
  
  .pwa-banner-subtitle {
    font-size: 11px;
  }
  
  .pwa-banner-button {
    padding: 5px 10px;
    font-size: 11px;
  }
  
  .pwa-install-modal {
    margin: 10px;
  }
  
  .pwa-modal-actions {
    flex-direction: column;
  }
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .pwa-install-modal,
  .pwa-install-prompt--card {
    background: #1e1e1e;
    color: #e0e0e0;
  }
  
  .pwa-card-header {
    background: #2a2a2a;
    border-color: #404040;
  }
  
  .pwa-card-title,
  .pwa-modal-header h2 {
    color: #ffffff;
  }
  
  .pwa-card-description,
  .pwa-modal-content p {
    color: #b0b0b0;
  }
  
  .install-benefits {
    background: #2a2a2a;
  }
  
  .step-text,
  .install-benefits h4 {
    color: #e0e0e0;
  }
  
  .install-benefits li {
    color: #b0b0b0;
  }
}
`

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style')
  styleSheet.textContent = styles
  document.head.appendChild(styleSheet)
}

export default PWAInstallPrompt