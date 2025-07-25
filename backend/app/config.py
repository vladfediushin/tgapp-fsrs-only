"""
Production Configuration for TG App FSRS Backend
Optimized for production deployment with security, performance, and monitoring
"""

import os
from typing import List, Optional
from pydantic import BaseSettings, validator
from functools import lru_cache

class Settings(BaseSettings):
    """Application settings with production optimizations"""
    
    # Application Info
    app_name: str = "TG App FSRS Backend"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # Database Configuration
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./test.db")
    database_pool_size: int = 20
    database_max_overflow: int = 30
    database_pool_timeout: int = 30
    database_pool_recycle: int = 3600  # 1 hour
    
    # Security Settings
    secret_key: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    access_token_expire_minutes: int = 30
    algorithm: str = "HS256"
    
    # CORS Configuration
    cors_origins: List[str] = [
        "https://tgapp-frontend.vercel.app",
        "https://tgapp-fsrs.vercel.app",
        "https://tgapp-fsrs-frontend.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
    ]
    cors_allow_credentials: bool = True
    cors_allow_methods: List[str] = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    cors_allow_headers: List[str] = ["*"]
    
    # API Configuration
    api_v1_prefix: str = "/api/v1"
    docs_url: Optional[str] = "/docs" if debug else None
    redoc_url: Optional[str] = "/redoc" if debug else None
    openapi_url: Optional[str] = "/openapi.json" if debug else None
    
    # Performance Settings
    request_timeout: int = 30
    max_request_size: int = 10 * 1024 * 1024  # 10MB
    worker_connections: int = 1000
    keepalive_timeout: int = 65
    
    # Logging Configuration
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    log_file: Optional[str] = os.getenv("LOG_FILE")
    
    # Redis Configuration (for caching and sessions)
    redis_url: Optional[str] = os.getenv("REDIS_URL")
    redis_ttl: int = 3600  # 1 hour default TTL
    
    # Rate Limiting
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 100
    rate_limit_window: int = 60  # seconds
    
    # Health Check Configuration
    health_check_interval: int = 30  # seconds
    health_check_timeout: int = 5   # seconds
    
    # Monitoring and Observability
    enable_metrics: bool = True
    metrics_port: int = 9090
    enable_tracing: bool = True
    jaeger_endpoint: Optional[str] = os.getenv("JAEGER_ENDPOINT")
    
    # Error Tracking
    sentry_dsn: Optional[str] = os.getenv("SENTRY_DSN")
    sentry_environment: str = os.getenv("ENVIRONMENT", "production")
    sentry_traces_sample_rate: float = 0.1
    
    # Feature Flags
    enable_fsrs: bool = True
    enable_offline_sync: bool = True
    enable_analytics: bool = True
    enable_caching: bool = True
    
    # FSRS Configuration
    fsrs_default_parameters: dict = {
        "w": [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61],
        "request_retention": 0.9,
        "maximum_interval": 36500,  # 100 years
        "enable_fuzz": True,
    }
    
    # Backup Configuration
    backup_enabled: bool = True
    backup_interval: int = 24  # hours
    backup_retention_days: int = 30
    backup_storage_path: str = os.getenv("BACKUP_STORAGE_PATH", "./backups")
    
    # Email Configuration (for notifications)
    smtp_server: Optional[str] = os.getenv("SMTP_SERVER")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_username: Optional[str] = os.getenv("SMTP_USERNAME")
    smtp_password: Optional[str] = os.getenv("SMTP_PASSWORD")
    smtp_use_tls: bool = True
    
    # Deployment Configuration
    environment: str = os.getenv("ENVIRONMENT", "production")
    deployment_version: str = os.getenv("DEPLOYMENT_VERSION", "1.0.0")
    deployment_timestamp: Optional[str] = os.getenv("DEPLOYMENT_TIMESTAMP")
    
    @validator("cors_origins", pre=True)
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            return [i.strip() for i in v.split(",")]
        return v
    
    @validator("database_url")
    def validate_database_url(cls, v):
        if v.startswith("sqlite"):
            # For development only
            if os.getenv("ENVIRONMENT") == "production":
                raise ValueError("SQLite not allowed in production")
        return v
    
    @validator("secret_key")
    def validate_secret_key(cls, v):
        if v == "your-secret-key-change-in-production" and os.getenv("ENVIRONMENT") == "production":
            raise ValueError("Must set SECRET_KEY in production")
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Production-specific database configuration
class DatabaseConfig:
    """Database configuration optimized for production"""
    
    @staticmethod
    def get_engine_config(settings: Settings) -> dict:
        """Get SQLAlchemy engine configuration for production"""
        config = {
            "pool_size": settings.database_pool_size,
            "max_overflow": settings.database_max_overflow,
            "pool_timeout": settings.database_pool_timeout,
            "pool_recycle": settings.database_pool_recycle,
            "pool_pre_ping": True,  # Validate connections before use
            "echo": settings.debug,
        }
        
        # PostgreSQL specific optimizations
        if "postgresql" in settings.database_url:
            config.update({
                "connect_args": {
                    "server_settings": {
                        "application_name": settings.app_name,
                        "jit": "off",  # Disable JIT for better predictability
                    },
                    "command_timeout": 60,
                    "options": "-c timezone=UTC",
                }
            })
        
        return config

# Logging configuration
class LoggingConfig:
    """Logging configuration for production"""
    
    @staticmethod
    def get_logging_config(settings: Settings) -> dict:
        """Get logging configuration"""
        return {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": settings.log_format,
                    "datefmt": "%Y-%m-%d %H:%M:%S",
                },
                "json": {
                    "format": '{"timestamp": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "message": "%(message)s"}',
                    "datefmt": "%Y-%m-%dT%H:%M:%S",
                },
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "json" if settings.environment == "production" else "default",
                    "level": settings.log_level,
                },
                "file": {
                    "class": "logging.handlers.RotatingFileHandler",
                    "filename": settings.log_file or "app.log",
                    "maxBytes": 10 * 1024 * 1024,  # 10MB
                    "backupCount": 5,
                    "formatter": "json",
                    "level": settings.log_level,
                } if settings.log_file else None,
            },
            "loggers": {
                "": {  # Root logger
                    "handlers": ["console"] + (["file"] if settings.log_file else []),
                    "level": settings.log_level,
                    "propagate": False,
                },
                "uvicorn": {
                    "handlers": ["console"],
                    "level": "INFO",
                    "propagate": False,
                },
                "sqlalchemy.engine": {
                    "handlers": ["console"],
                    "level": "WARNING",
                    "propagate": False,
                },
            },
        }

@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()

# Export commonly used settings
settings = get_settings()
database_config = DatabaseConfig()
logging_config = LoggingConfig()