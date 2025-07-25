"""
Production Error Monitoring System for Backend
Comprehensive error tracking, logging, and alerting for FastAPI application
"""

import logging
import traceback
import json
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from enum import Enum
from dataclasses import dataclass, asdict
from contextlib import asynccontextmanager
import sys
import os
from pathlib import Path

# Third-party imports (would need to be added to requirements.txt)
try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    SENTRY_AVAILABLE = True
except ImportError:
    SENTRY_AVAILABLE = False

# ============================================================================
# Types and Enums
# ============================================================================

class ErrorSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ErrorCategory(Enum):
    DATABASE = "database"
    NETWORK = "network"
    VALIDATION = "validation"
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    BUSINESS_LOGIC = "business_logic"
    EXTERNAL_API = "external_api"
    SYSTEM = "system"
    UNKNOWN = "unknown"

@dataclass
class ErrorContext:
    """Context information for error reporting"""
    request_id: Optional[str] = None
    user_id: Optional[str] = None
    endpoint: Optional[str] = None
    method: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_body: Optional[Dict[str, Any]] = None
    query_params: Optional[Dict[str, Any]] = None
    headers: Optional[Dict[str, str]] = None
    session_data: Optional[Dict[str, Any]] = None

@dataclass
class ErrorReport:
    """Structured error report"""
    id: str
    timestamp: datetime
    severity: ErrorSeverity
    category: ErrorCategory
    message: str
    exception_type: str
    stack_trace: str
    context: ErrorContext
    environment: str
    service_name: str
    version: str
    additional_data: Optional[Dict[str, Any]] = None
    resolved: bool = False
    resolution_notes: Optional[str] = None

# ============================================================================
# Error Monitor Class
# ============================================================================

class ProductionErrorMonitor:
    """Production-grade error monitoring system"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = self._setup_logger()
        self.error_queue: List[ErrorReport] = []
        self.max_queue_size = config.get('max_queue_size', 1000)
        self.enable_sentry = config.get('enable_sentry', False)
        self.enable_file_logging = config.get('enable_file_logging', True)
        self.enable_database_logging = config.get('enable_database_logging', False)
        
        if self.enable_sentry and SENTRY_AVAILABLE:
            self._setup_sentry()
    
    def _setup_logger(self) -> logging.Logger:
        """Setup structured logging"""
        logger = logging.getLogger('error_monitor')
        logger.setLevel(logging.INFO)
        
        # Remove existing handlers
        for handler in logger.handlers[:]:
            logger.removeHandler(handler)
        
        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        console_handler.setFormatter(console_formatter)
        logger.addHandler(console_handler)
        
        # File handler for errors
        if self.enable_file_logging:
            log_dir = Path(self.config.get('log_directory', './logs'))
            log_dir.mkdir(exist_ok=True)
            
            file_handler = logging.FileHandler(log_dir / 'errors.log')
            file_formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            file_handler.setFormatter(file_formatter)
            logger.addHandler(file_handler)
        
        return logger
    
    def _setup_sentry(self):
        """Setup Sentry error tracking"""
        sentry_dsn = self.config.get('sentry_dsn')
        if not sentry_dsn:
            self.logger.warning("Sentry enabled but no DSN provided")
            return
        
        sentry_sdk.init(
            dsn=sentry_dsn,
            integrations=[
                FastApiIntegration(auto_enable=True),
                SqlalchemyIntegration(),
            ],
            traces_sample_rate=self.config.get('sentry_traces_sample_rate', 0.1),
            environment=self.config.get('environment', 'production'),
            release=self.config.get('version', '1.0.0'),
        )
        
        self.logger.info("Sentry error tracking initialized")
    
    def categorize_error(self, exception: Exception, context: ErrorContext) -> ErrorCategory:
        """Automatically categorize errors based on type and context"""
        exception_name = type(exception).__name__.lower()
        
        # Database errors
        if any(db_term in exception_name for db_term in ['sql', 'database', 'connection', 'integrity']):
            return ErrorCategory.DATABASE
        
        # Network errors
        if any(net_term in exception_name for net_term in ['connection', 'timeout', 'network', 'http']):
            return ErrorCategory.NETWORK
        
        # Validation errors
        if any(val_term in exception_name for val_term in ['validation', 'value', 'type', 'schema']):
            return ErrorCategory.VALIDATION
        
        # Authentication/Authorization
        if any(auth_term in exception_name for auth_term in ['auth', 'permission', 'forbidden', 'unauthorized']):
            if 'unauthorized' in exception_name or '401' in str(exception):
                return ErrorCategory.AUTHENTICATION
            else:
                return ErrorCategory.AUTHORIZATION
        
        # Check endpoint for business logic
        if context.endpoint and any(biz_endpoint in context.endpoint for biz_endpoint in ['/fsrs/', '/questions/', '/users/']):
            return ErrorCategory.BUSINESS_LOGIC
        
        return ErrorCategory.UNKNOWN
    
    def determine_severity(self, exception: Exception, context: ErrorContext) -> ErrorSeverity:
        """Determine error severity based on exception type and context"""
        exception_name = type(exception).__name__.lower()
        
        # Critical errors
        critical_indicators = ['system', 'memory', 'disk', 'database', 'connection']
        if any(indicator in exception_name for indicator in critical_indicators):
            return ErrorSeverity.CRITICAL
        
        # High severity errors
        high_indicators = ['timeout', 'integrity', 'constraint', 'foreign']
        if any(indicator in exception_name for indicator in high_indicators):
            return ErrorSeverity.HIGH
        
        # Authentication/Authorization are typically high
        if context.endpoint and any(auth_endpoint in context.endpoint for auth_endpoint in ['/auth/', '/login']):
            return ErrorSeverity.HIGH
        
        # Validation errors are typically medium
        if 'validation' in exception_name or 'value' in exception_name:
            return ErrorSeverity.MEDIUM
        
        return ErrorSeverity.LOW
    
    async def report_error(
        self,
        exception: Exception,
        context: ErrorContext,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> str:
        """Report an error with full context"""
        
        error_id = self._generate_error_id()
        category = self.categorize_error(exception, context)
        severity = self.determine_severity(exception, context)
        
        error_report = ErrorReport(
            id=error_id,
            timestamp=datetime.now(timezone.utc),
            severity=severity,
            category=category,
            message=str(exception),
            exception_type=type(exception).__name__,
            stack_trace=traceback.format_exc(),
            context=context,
            environment=self.config.get('environment', 'production'),
            service_name=self.config.get('service_name', 'tgapp-fsrs-backend'),
            version=self.config.get('version', '1.0.0'),
            additional_data=additional_data
        )
        
        # Add to queue
        self.error_queue.append(error_report)
        if len(self.error_queue) > self.max_queue_size:
            self.error_queue.pop(0)
        
        # Log the error
        await self._log_error(error_report)
        
        # Send to external services
        await self._send_to_external_services(error_report)
        
        # Send alerts for critical errors
        if severity == ErrorSeverity.CRITICAL:
            await self._send_alert(error_report)
        
        return error_id
    
    async def _log_error(self, error_report: ErrorReport):
        """Log error to configured destinations"""
        
        # Structure the log message
        log_data = {
            'error_id': error_report.id,
            'timestamp': error_report.timestamp.isoformat(),
            'severity': error_report.severity.value,
            'category': error_report.category.value,
            'message': error_report.message,
            'exception_type': error_report.exception_type,
            'endpoint': error_report.context.endpoint,
            'user_id': error_report.context.user_id,
            'request_id': error_report.context.request_id,
        }
        
        log_message = f"ERROR_REPORT: {json.dumps(log_data, default=str)}"
        
        if error_report.severity == ErrorSeverity.CRITICAL:
            self.logger.critical(log_message)
        elif error_report.severity == ErrorSeverity.HIGH:
            self.logger.error(log_message)
        elif error_report.severity == ErrorSeverity.MEDIUM:
            self.logger.warning(log_message)
        else:
            self.logger.info(log_message)
        
        # Also log the full stack trace
        self.logger.debug(f"Stack trace for {error_report.id}:\n{error_report.stack_trace}")
    
    async def _send_to_external_services(self, error_report: ErrorReport):
        """Send error to external monitoring services"""
        
        # Send to Sentry if enabled
        if self.enable_sentry and SENTRY_AVAILABLE:
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("error_id", error_report.id)
                scope.set_tag("category", error_report.category.value)
                scope.set_tag("severity", error_report.severity.value)
                scope.set_context("error_context", asdict(error_report.context))
                
                if error_report.additional_data:
                    scope.set_context("additional_data", error_report.additional_data)
                
                sentry_sdk.capture_message(
                    error_report.message,
                    level=self._sentry_level_from_severity(error_report.severity)
                )
        
        # Send to custom webhook if configured
        webhook_url = self.config.get('webhook_url')
        if webhook_url:
            await self._send_webhook(webhook_url, error_report)
    
    def _sentry_level_from_severity(self, severity: ErrorSeverity) -> str:
        """Convert our severity to Sentry level"""
        mapping = {
            ErrorSeverity.LOW: 'info',
            ErrorSeverity.MEDIUM: 'warning',
            ErrorSeverity.HIGH: 'error',
            ErrorSeverity.CRITICAL: 'fatal'
        }
        return mapping.get(severity, 'error')
    
    async def _send_webhook(self, webhook_url: str, error_report: ErrorReport):
        """Send error report to webhook"""
        try:
            import httpx
            
            payload = {
                'error_id': error_report.id,
                'timestamp': error_report.timestamp.isoformat(),
                'severity': error_report.severity.value,
                'category': error_report.category.value,
                'message': error_report.message,
                'service': error_report.service_name,
                'environment': error_report.environment,
                'context': asdict(error_report.context)
            }
            
            async with httpx.AsyncClient() as client:
                await client.post(webhook_url, json=payload, timeout=5.0)
                
        except Exception as e:
            self.logger.warning(f"Failed to send webhook: {e}")
    
    async def _send_alert(self, error_report: ErrorReport):
        """Send alert for critical errors"""
        
        # Email alert if configured
        email_config = self.config.get('email_alerts')
        if email_config:
            await self._send_email_alert(error_report, email_config)
        
        # Slack alert if configured
        slack_webhook = self.config.get('slack_webhook')
        if slack_webhook:
            await self._send_slack_alert(error_report, slack_webhook)
    
    async def _send_email_alert(self, error_report: ErrorReport, email_config: Dict[str, Any]):
        """Send email alert for critical errors"""
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            
            msg = MIMEMultipart()
            msg['From'] = email_config['from']
            msg['To'] = ', '.join(email_config['to'])
            msg['Subject'] = f"CRITICAL ERROR: {error_report.service_name}"
            
            body = f"""
            Critical Error Detected
            
            Error ID: {error_report.id}
            Time: {error_report.timestamp}
            Service: {error_report.service_name}
            Environment: {error_report.environment}
            
            Message: {error_report.message}
            Category: {error_report.category.value}
            
            Endpoint: {error_report.context.endpoint}
            User ID: {error_report.context.user_id}
            
            Stack Trace:
            {error_report.stack_trace}
            """
            
            msg.attach(MIMEText(body, 'plain'))
            
            server = smtplib.SMTP(email_config['smtp_server'], email_config['smtp_port'])
            if email_config.get('use_tls'):
                server.starttls()
            if email_config.get('username'):
                server.login(email_config['username'], email_config['password'])
            
            server.send_message(msg)
            server.quit()
            
        except Exception as e:
            self.logger.warning(f"Failed to send email alert: {e}")
    
    async def _send_slack_alert(self, error_report: ErrorReport, webhook_url: str):
        """Send Slack alert for critical errors"""
        try:
            import httpx
            
            payload = {
                "text": f"🚨 CRITICAL ERROR in {error_report.service_name}",
                "attachments": [
                    {
                        "color": "danger",
                        "fields": [
                            {"title": "Error ID", "value": error_report.id, "short": True},
                            {"title": "Environment", "value": error_report.environment, "short": True},
                            {"title": "Category", "value": error_report.category.value, "short": True},
                            {"title": "Endpoint", "value": error_report.context.endpoint or "N/A", "short": True},
                            {"title": "Message", "value": error_report.message, "short": False},
                        ],
                        "ts": error_report.timestamp.timestamp()
                    }
                ]
            }
            
            async with httpx.AsyncClient() as client:
                await client.post(webhook_url, json=payload, timeout=5.0)
                
        except Exception as e:
            self.logger.warning(f"Failed to send Slack alert: {e}")
    
    def _generate_error_id(self) -> str:
        """Generate unique error ID"""
        import uuid
        return f"err_{uuid.uuid4().hex[:12]}"
    
    def get_error_stats(self) -> Dict[str, Any]:
        """Get error statistics"""
        if not self.error_queue:
            return {"total_errors": 0}
        
        stats = {
            "total_errors": len(self.error_queue),
            "by_severity": {},
            "by_category": {},
            "recent_errors": len([e for e in self.error_queue 
                                if (datetime.now(timezone.utc) - e.timestamp).seconds < 3600])
        }
        
        for error in self.error_queue:
            # Count by severity
            severity = error.severity.value
            stats["by_severity"][severity] = stats["by_severity"].get(severity, 0) + 1
            
            # Count by category
            category = error.category.value
            stats["by_category"][category] = stats["by_category"].get(category, 0) + 1
        
        return stats
    
    def get_recent_errors(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent errors for dashboard"""
        recent = sorted(self.error_queue, key=lambda x: x.timestamp, reverse=True)[:limit]
        
        return [
            {
                "id": error.id,
                "timestamp": error.timestamp.isoformat(),
                "severity": error.severity.value,
                "category": error.category.value,
                "message": error.message,
                "endpoint": error.context.endpoint,
                "user_id": error.context.user_id,
            }
            for error in recent
        ]

# ============================================================================
# Global Instance and Utilities
# ============================================================================

_error_monitor: Optional[ProductionErrorMonitor] = None

def initialize_error_monitoring(config: Dict[str, Any]) -> ProductionErrorMonitor:
    """Initialize global error monitoring"""
    global _error_monitor
    _error_monitor = ProductionErrorMonitor(config)
    return _error_monitor

def get_error_monitor() -> Optional[ProductionErrorMonitor]:
    """Get global error monitor instance"""
    return _error_monitor

@asynccontextmanager
async def error_context(
    request_id: Optional[str] = None,
    user_id: Optional[str] = None,
    endpoint: Optional[str] = None,
    **kwargs
):
    """Context manager for error monitoring"""
    context = ErrorContext(
        request_id=request_id,
        user_id=user_id,
        endpoint=endpoint,
        **kwargs
    )
    
    try:
        yield context
    except Exception as e:
        if _error_monitor:
            await _error_monitor.report_error(e, context)
        raise

# ============================================================================
# FastAPI Integration
# ============================================================================

async def create_error_context_from_request(request) -> ErrorContext:
    """Create error context from FastAPI request"""
    return ErrorContext(
        request_id=getattr(request.state, 'request_id', None),
        user_id=getattr(request.state, 'user_id', None),
        endpoint=str(request.url.path),
        method=request.method,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get('user-agent'),
        query_params=dict(request.query_params),
        headers=dict(request.headers),
    )

# Default configuration
DEFAULT_CONFIG = {
    'environment': os.getenv('ENVIRONMENT', 'production'),
    'service_name': 'tgapp-fsrs-backend',
    'version': os.getenv('DEPLOYMENT_VERSION', '1.0.0'),
    'max_queue_size': 1000,
    'enable_sentry': os.getenv('SENTRY_DSN') is not None,
    'sentry_dsn': os.getenv('SENTRY_DSN'),
    'sentry_traces_sample_rate': float(os.getenv('SENTRY_TRACES_SAMPLE_RATE', '0.1')),
    'enable_file_logging': True,
    'log_directory': os.getenv('LOG_DIRECTORY', './logs'),
    'webhook_url': os.getenv('ERROR_WEBHOOK_URL'),
    'slack_webhook': os.getenv('SLACK_WEBHOOK_URL'),
}