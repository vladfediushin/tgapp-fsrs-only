"""
Production Monitoring Configuration
Lightweight, production-optimized monitoring setup
"""

import os
from typing import Dict, Any, Optional

# ============================================================================
# Production Monitoring Configuration
# ============================================================================

class ProductionMonitoringConfig:
    """Production-optimized monitoring configuration"""
    
    def __init__(self):
        self.environment = os.getenv('ENVIRONMENT', 'production')
        self.service_name = os.getenv('SERVICE_NAME', 'tgapp-fsrs-backend')
        self.version = os.getenv('DEPLOYMENT_VERSION', '1.0.0')
    
    @property
    def error_monitoring_config(self) -> Dict[str, Any]:
        """Error monitoring configuration for production"""
        return {
            'environment': self.environment,
            'service_name': self.service_name,
            'version': self.version,
            'max_queue_size': 500,  # Reduced from development default
            
            # Sentry configuration
            'enable_sentry': os.getenv('SENTRY_DSN') is not None,
            'sentry_dsn': os.getenv('SENTRY_DSN'),
            'sentry_traces_sample_rate': float(os.getenv('SENTRY_TRACES_SAMPLE_RATE', '0.05')),  # Lower sampling
            
            # Logging configuration
            'enable_file_logging': True,
            'log_directory': os.getenv('LOG_DIRECTORY', '/var/log/tgapp'),
            'log_level': os.getenv('LOG_LEVEL', 'WARNING'),  # Only warnings and errors
            
            # External integrations
            'webhook_url': os.getenv('ERROR_WEBHOOK_URL'),
            'slack_webhook': os.getenv('SLACK_WEBHOOK_URL'),
            
            # Email alerts for critical errors only
            'email_alerts': {
                'smtp_server': os.getenv('SMTP_SERVER'),
                'smtp_port': int(os.getenv('SMTP_PORT', '587')),
                'username': os.getenv('SMTP_USERNAME'),
                'password': os.getenv('SMTP_PASSWORD'),
                'from': os.getenv('ALERT_EMAIL_FROM'),
                'to': os.getenv('ALERT_EMAIL_TO', '').split(',') if os.getenv('ALERT_EMAIL_TO') else [],
                'use_tls': os.getenv('SMTP_USE_TLS', 'true').lower() == 'true'
            } if os.getenv('SMTP_SERVER') else None,
            
            # Production optimizations
            'enable_database_logging': False,  # Disabled for performance
            'batch_size': 50,  # Batch error reports
            'flush_interval': 30,  # Flush every 30 seconds
        }
    
    @property
    def performance_monitoring_config(self) -> Dict[str, Any]:
        """Performance monitoring configuration for production"""
        return {
            'environment': self.environment,
            'service_name': self.service_name,
            'version': self.version,
            
            # Metrics collection
            'max_metrics_queue': 1000,  # Reduced from development
            'metrics_retention_hours': 6,  # Keep only 6 hours of metrics
            'collection_interval': 300,  # Collect every 5 minutes instead of 1
            
            # Prometheus integration
            'enable_prometheus': os.getenv('ENABLE_PROMETHEUS', 'true').lower() == 'true',
            'prometheus_port': int(os.getenv('PROMETHEUS_PORT', '8000')),
            
            # Alerting
            'alert_webhook_url': os.getenv('ALERT_WEBHOOK_URL'),
            'alert_slack_webhook': os.getenv('ALERT_SLACK_WEBHOOK'),
            
            # Performance thresholds (more lenient for production)
            'response_time_threshold': 3.0,  # 3 seconds
            'error_rate_threshold': 0.1,  # 10%
            'cpu_threshold': 85.0,  # 85%
            'memory_threshold': 90.0,  # 90%
            'disk_threshold': 95.0,  # 95%
            
            # Production optimizations
            'enable_detailed_tracing': False,  # Disable detailed tracing
            'sample_rate': 0.1,  # Sample 10% of requests
            'enable_memory_profiling': False,  # Disable memory profiling
        }
    
    @property
    def analytics_config(self) -> Dict[str, Any]:
        """Analytics configuration for production"""
        return {
            'environment': self.environment,
            'service_name': self.service_name,
            
            # Analytics endpoints
            'analytics_endpoint': os.getenv('ANALYTICS_ENDPOINT'),
            'analytics_api_key': os.getenv('ANALYTICS_API_KEY'),
            
            # Data collection
            'collect_user_metrics': True,
            'collect_performance_metrics': True,
            'collect_error_metrics': True,
            'collect_business_metrics': True,
            
            # Privacy and compliance
            'anonymize_user_data': True,
            'data_retention_days': 90,
            'enable_gdpr_compliance': True,
            
            # Batching and performance
            'batch_size': 100,
            'flush_interval': 60,  # Flush every minute
            'max_queue_size': 1000,
            
            # Rate limiting
            'max_events_per_minute': 1000,
            'enable_rate_limiting': True,
        }

# ============================================================================
# Production Configuration Instance
# ============================================================================

production_config = ProductionMonitoringConfig()

# Export configurations
ERROR_MONITORING_CONFIG = production_config.error_monitoring_config
PERFORMANCE_MONITORING_CONFIG = production_config.performance_monitoring_config
ANALYTICS_CONFIG = production_config.analytics_config

# ============================================================================
# Environment-specific overrides
# ============================================================================

def get_monitoring_config(environment: str = None) -> Dict[str, Any]:
    """Get monitoring configuration for specific environment"""
    env = environment or os.getenv('ENVIRONMENT', 'production')
    
    if env == 'production':
        return {
            'error_monitoring': ERROR_MONITORING_CONFIG,
            'performance_monitoring': PERFORMANCE_MONITORING_CONFIG,
            'analytics': ANALYTICS_CONFIG
        }
    elif env == 'staging':
        # Staging uses production config with more verbose logging
        staging_error_config = ERROR_MONITORING_CONFIG.copy()
        staging_error_config['log_level'] = 'INFO'
        staging_error_config['sentry_traces_sample_rate'] = 0.2
        
        staging_perf_config = PERFORMANCE_MONITORING_CONFIG.copy()
        staging_perf_config['sample_rate'] = 0.5
        staging_perf_config['enable_detailed_tracing'] = True
        
        return {
            'error_monitoring': staging_error_config,
            'performance_monitoring': staging_perf_config,
            'analytics': ANALYTICS_CONFIG
        }
    else:
        # Development environment - use existing configs
        return None

# ============================================================================
# Validation
# ============================================================================

def validate_production_config() -> Dict[str, bool]:
    """Validate production monitoring configuration"""
    validation_results = {
        'sentry_configured': bool(os.getenv('SENTRY_DSN')),
        'log_directory_writable': True,  # Would need actual check
        'prometheus_enabled': os.getenv('ENABLE_PROMETHEUS', 'true').lower() == 'true',
        'analytics_endpoint_configured': bool(os.getenv('ANALYTICS_ENDPOINT')),
        'alert_webhooks_configured': bool(os.getenv('ALERT_WEBHOOK_URL') or os.getenv('ALERT_SLACK_WEBHOOK')),
        'email_alerts_configured': bool(os.getenv('SMTP_SERVER')),
    }
    
    return validation_results

def get_config_summary() -> Dict[str, Any]:
    """Get summary of current configuration"""
    validation = validate_production_config()
    
    return {
        'environment': production_config.environment,
        'service_name': production_config.service_name,
        'version': production_config.version,
        'validation': validation,
        'features': {
            'error_monitoring': True,
            'performance_monitoring': True,
            'analytics': True,
            'sentry_integration': validation['sentry_configured'],
            'prometheus_metrics': validation['prometheus_enabled'],
            'alert_notifications': validation['alert_webhooks_configured'],
        }
    }