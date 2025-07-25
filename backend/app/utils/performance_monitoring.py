"""
Backend Performance Monitoring System
Comprehensive performance tracking, metrics collection, and alerting for FastAPI application
"""

import time
import asyncio
import psutil
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, asdict
from collections import defaultdict, deque
from contextlib import asynccontextmanager
import json
import os
from pathlib import Path

# Third-party imports (would need to be added to requirements.txt)
try:
    import prometheus_client
    from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False

# ============================================================================
# Types and Data Classes
# ============================================================================

@dataclass
class RequestMetrics:
    """Metrics for individual requests"""
    request_id: str
    endpoint: str
    method: str
    status_code: int
    duration: float
    timestamp: datetime
    user_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_size: int = 0
    response_size: int = 0
    database_queries: int = 0
    database_time: float = 0.0
    cache_hits: int = 0
    cache_misses: int = 0
    external_api_calls: int = 0
    external_api_time: float = 0.0
    memory_usage: float = 0.0
    cpu_usage: float = 0.0

@dataclass
class SystemMetrics:
    """System-level performance metrics"""
    timestamp: datetime
    cpu_percent: float
    memory_percent: float
    memory_used: int
    memory_available: int
    disk_usage_percent: float
    disk_free: int
    network_bytes_sent: int
    network_bytes_recv: int
    active_connections: int
    database_connections: int
    cache_hit_rate: float
    error_rate: float
    requests_per_second: float
    average_response_time: float
    p95_response_time: float
    p99_response_time: float

@dataclass
class PerformanceAlert:
    """Performance alert definition"""
    id: str
    name: str
    metric: str
    threshold: float
    comparison: str  # 'gt', 'lt', 'eq'
    duration: int  # seconds
    severity: str  # 'low', 'medium', 'high', 'critical'
    enabled: bool = True
    last_triggered: Optional[datetime] = None
    trigger_count: int = 0

# ============================================================================
# Performance Monitor Class
# ============================================================================

class PerformanceMonitor:
    """Production-grade performance monitoring system"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger('performance_monitor')
        
        # Metrics storage
        self.request_metrics: deque = deque(maxlen=10000)
        self.system_metrics: deque = deque(maxlen=1440)  # 24 hours of minute-level data
        self.response_times: deque = deque(maxlen=1000)
        self.error_counts: defaultdict = defaultdict(int)
        
        # Performance tracking
        self.active_requests: Dict[str, float] = {}
        self.endpoint_stats: defaultdict = defaultdict(lambda: {
            'count': 0, 'total_time': 0.0, 'errors': 0, 'min_time': float('inf'), 'max_time': 0.0
        })
        
        # Alerts
        self.alerts: List[PerformanceAlert] = []
        self.alert_states: Dict[str, Dict] = {}
        
        # Prometheus metrics
        if PROMETHEUS_AVAILABLE and config.get('enable_prometheus', False):
            self.setup_prometheus_metrics()
        
        # Background tasks
        self.monitoring_task: Optional[asyncio.Task] = None
        self.cleanup_task: Optional[asyncio.Task] = None
        
        # Initialize alerts
        self.setup_default_alerts()
    
    def setup_prometheus_metrics(self):
        """Setup Prometheus metrics"""
        self.registry = CollectorRegistry()
        
        # Request metrics
        self.request_duration = Histogram(
            'http_request_duration_seconds',
            'HTTP request duration in seconds',
            ['method', 'endpoint', 'status_code'],
            registry=self.registry
        )
        
        self.request_count = Counter(
            'http_requests_total',
            'Total HTTP requests',
            ['method', 'endpoint', 'status_code'],
            registry=self.registry
        )
        
        self.active_requests_gauge = Gauge(
            'http_requests_active',
            'Active HTTP requests',
            registry=self.registry
        )
        
        # System metrics
        self.cpu_usage = Gauge(
            'system_cpu_percent',
            'CPU usage percentage',
            registry=self.registry
        )
        
        self.memory_usage = Gauge(
            'system_memory_percent',
            'Memory usage percentage',
            registry=self.registry
        )
        
        self.database_connections = Gauge(
            'database_connections_active',
            'Active database connections',
            registry=self.registry
        )
        
        # Business metrics
        self.fsrs_calculations = Counter(
            'fsrs_calculations_total',
            'Total FSRS calculations performed',
            registry=self.registry
        )
        
        self.questions_answered = Counter(
            'questions_answered_total',
            'Total questions answered',
            ['user_id'],
            registry=self.registry
        )
    
    def setup_default_alerts(self):
        """Setup default performance alerts"""
        default_alerts = [
            PerformanceAlert(
                id='high_response_time',
                name='High Response Time',
                metric='avg_response_time',
                threshold=2.0,
                comparison='gt',
                duration=300,  # 5 minutes
                severity='high'
            ),
            PerformanceAlert(
                id='high_error_rate',
                name='High Error Rate',
                metric='error_rate',
                threshold=0.05,  # 5%
                comparison='gt',
                duration=180,  # 3 minutes
                severity='critical'
            ),
            PerformanceAlert(
                id='high_cpu_usage',
                name='High CPU Usage',
                metric='cpu_percent',
                threshold=80.0,
                comparison='gt',
                duration=600,  # 10 minutes
                severity='medium'
            ),
            PerformanceAlert(
                id='high_memory_usage',
                name='High Memory Usage',
                metric='memory_percent',
                threshold=85.0,
                comparison='gt',
                duration=300,  # 5 minutes
                severity='high'
            ),
            PerformanceAlert(
                id='low_disk_space',
                name='Low Disk Space',
                metric='disk_usage_percent',
                threshold=90.0,
                comparison='gt',
                duration=60,  # 1 minute
                severity='critical'
            )
        ]
        
        self.alerts.extend(default_alerts)
        
        # Initialize alert states
        for alert in self.alerts:
            self.alert_states[alert.id] = {
                'triggered': False,
                'trigger_start': None,
                'last_value': None
            }
    
    async def start_monitoring(self):
        """Start background monitoring tasks"""
        if self.monitoring_task is None:
            self.monitoring_task = asyncio.create_task(self._monitoring_loop())
        
        if self.cleanup_task is None:
            self.cleanup_task = asyncio.create_task(self._cleanup_loop())
    
    async def stop_monitoring(self):
        """Stop background monitoring tasks"""
        if self.monitoring_task:
            self.monitoring_task.cancel()
            try:
                await self.monitoring_task
            except asyncio.CancelledError:
                pass
        
        if self.cleanup_task:
            self.cleanup_task.cancel()
            try:
                await self.cleanup_task
            except asyncio.CancelledError:
                pass
    
    async def _monitoring_loop(self):
        """Background loop for collecting system metrics"""
        while True:
            try:
                await self.collect_system_metrics()
                await self.check_alerts()
                await asyncio.sleep(60)  # Collect every minute
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(60)
    
    async def _cleanup_loop(self):
        """Background loop for cleaning up old data"""
        while True:
            try:
                await self.cleanup_old_data()
                await asyncio.sleep(3600)  # Cleanup every hour
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Error in cleanup loop: {e}")
                await asyncio.sleep(3600)
    
    async def collect_system_metrics(self):
        """Collect system-level performance metrics"""
        try:
            # CPU and Memory
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            
            # Disk usage
            disk = psutil.disk_usage('/')
            
            # Network stats
            network = psutil.net_io_counters()
            
            # Calculate derived metrics
            recent_requests = [m for m in self.request_metrics 
                             if (datetime.now(timezone.utc) - m.timestamp).seconds < 60]
            
            requests_per_second = len(recent_requests) / 60.0 if recent_requests else 0.0
            
            error_requests = [m for m in recent_requests if m.status_code >= 400]
            error_rate = len(error_requests) / len(recent_requests) if recent_requests else 0.0
            
            response_times = [m.duration for m in recent_requests]
            avg_response_time = sum(response_times) / len(response_times) if response_times else 0.0
            
            # Calculate percentiles
            sorted_times = sorted(response_times) if response_times else [0.0]
            p95_index = int(0.95 * len(sorted_times))
            p99_index = int(0.99 * len(sorted_times))
            p95_response_time = sorted_times[p95_index] if p95_index < len(sorted_times) else 0.0
            p99_response_time = sorted_times[p99_index] if p99_index < len(sorted_times) else 0.0
            
            metrics = SystemMetrics(
                timestamp=datetime.now(timezone.utc),
                cpu_percent=cpu_percent,
                memory_percent=memory.percent,
                memory_used=memory.used,
                memory_available=memory.available,
                disk_usage_percent=disk.percent,
                disk_free=disk.free,
                network_bytes_sent=network.bytes_sent,
                network_bytes_recv=network.bytes_recv,
                active_connections=len(self.active_requests),
                database_connections=0,  # Would need database-specific implementation
                cache_hit_rate=0.0,  # Would need cache-specific implementation
                error_rate=error_rate,
                requests_per_second=requests_per_second,
                average_response_time=avg_response_time,
                p95_response_time=p95_response_time,
                p99_response_time=p99_response_time
            )
            
            self.system_metrics.append(metrics)
            
            # Update Prometheus metrics if available
            if hasattr(self, 'cpu_usage'):
                self.cpu_usage.set(cpu_percent)
                self.memory_usage.set(memory.percent)
                self.active_requests_gauge.set(len(self.active_requests))
            
            # Log metrics
            self.logger.info(f"System metrics: CPU={cpu_percent:.1f}%, "
                           f"Memory={memory.percent:.1f}%, "
                           f"RPS={requests_per_second:.2f}, "
                           f"Error Rate={error_rate:.3f}")
            
        except Exception as e:
            self.logger.error(f"Error collecting system metrics: {e}")
    
    async def check_alerts(self):
        """Check performance alerts and trigger notifications"""
        if not self.system_metrics:
            return
        
        latest_metrics = self.system_metrics[-1]
        current_time = datetime.now(timezone.utc)
        
        for alert in self.alerts:
            if not alert.enabled:
                continue
            
            # Get current value for the metric
            current_value = getattr(latest_metrics, alert.metric, None)
            if current_value is None:
                continue
            
            # Check threshold
            threshold_exceeded = False
            if alert.comparison == 'gt':
                threshold_exceeded = current_value > alert.threshold
            elif alert.comparison == 'lt':
                threshold_exceeded = current_value < alert.threshold
            elif alert.comparison == 'eq':
                threshold_exceeded = abs(current_value - alert.threshold) < 0.001
            
            alert_state = self.alert_states[alert.id]
            
            if threshold_exceeded:
                if not alert_state['triggered']:
                    # Start tracking this alert
                    alert_state['triggered'] = True
                    alert_state['trigger_start'] = current_time
                    alert_state['last_value'] = current_value
                else:
                    # Check if duration threshold is met
                    duration = (current_time - alert_state['trigger_start']).total_seconds()
                    if duration >= alert.duration:
                        # Trigger alert
                        await self.trigger_alert(alert, current_value, duration)
                        alert.last_triggered = current_time
                        alert.trigger_count += 1
                        
                        # Reset state to avoid spam
                        alert_state['triggered'] = False
                        alert_state['trigger_start'] = None
            else:
                # Reset alert state
                if alert_state['triggered']:
                    alert_state['triggered'] = False
                    alert_state['trigger_start'] = None
    
    async def trigger_alert(self, alert: PerformanceAlert, current_value: float, duration: float):
        """Trigger a performance alert"""
        alert_data = {
            'alert_id': alert.id,
            'alert_name': alert.name,
            'metric': alert.metric,
            'current_value': current_value,
            'threshold': alert.threshold,
            'duration': duration,
            'severity': alert.severity,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'system_info': await self.get_system_info()
        }
        
        # Log alert
        self.logger.warning(f"PERFORMANCE ALERT: {alert.name} - "
                          f"{alert.metric}={current_value:.2f} "
                          f"(threshold={alert.threshold}) "
                          f"for {duration:.0f}s")
        
        # Send to external alerting systems
        await self.send_alert_notification(alert_data)
    
    async def send_alert_notification(self, alert_data: Dict[str, Any]):
        """Send alert notification to configured channels"""
        
        # Webhook notification
        webhook_url = self.config.get('alert_webhook_url')
        if webhook_url:
            try:
                import httpx
                async with httpx.AsyncClient() as client:
                    await client.post(webhook_url, json=alert_data, timeout=5.0)
            except Exception as e:
                self.logger.error(f"Failed to send webhook alert: {e}")
        
        # Email notification
        email_config = self.config.get('alert_email')
        if email_config:
            await self.send_email_alert(alert_data, email_config)
        
        # Slack notification
        slack_webhook = self.config.get('alert_slack_webhook')
        if slack_webhook:
            await self.send_slack_alert(alert_data, slack_webhook)
    
    async def send_email_alert(self, alert_data: Dict[str, Any], email_config: Dict[str, Any]):
        """Send email alert notification"""
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            
            msg = MIMEMultipart()
            msg['From'] = email_config['from']
            msg['To'] = ', '.join(email_config['to'])
            msg['Subject'] = f"PERFORMANCE ALERT: {alert_data['alert_name']}"
            
            body = f"""
            Performance Alert Triggered
            
            Alert: {alert_data['alert_name']}
            Metric: {alert_data['metric']}
            Current Value: {alert_data['current_value']:.2f}
            Threshold: {alert_data['threshold']}
            Duration: {alert_data['duration']:.0f} seconds
            Severity: {alert_data['severity']}
            Time: {alert_data['timestamp']}
            
            System Information:
            {json.dumps(alert_data['system_info'], indent=2)}
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
            self.logger.error(f"Failed to send email alert: {e}")
    
    async def send_slack_alert(self, alert_data: Dict[str, Any], webhook_url: str):
        """Send Slack alert notification"""
        try:
            import httpx
            
            color = {
                'low': 'good',
                'medium': 'warning',
                'high': 'danger',
                'critical': 'danger'
            }.get(alert_data['severity'], 'warning')
            
            payload = {
                "text": f"🚨 Performance Alert: {alert_data['alert_name']}",
                "attachments": [
                    {
                        "color": color,
                        "fields": [
                            {"title": "Metric", "value": alert_data['metric'], "short": True},
                            {"title": "Current Value", "value": f"{alert_data['current_value']:.2f}", "short": True},
                            {"title": "Threshold", "value": str(alert_data['threshold']), "short": True},
                            {"title": "Duration", "value": f"{alert_data['duration']:.0f}s", "short": True},
                            {"title": "Severity", "value": alert_data['severity'].upper(), "short": True},
                        ],
                        "ts": datetime.now(timezone.utc).timestamp()
                    }
                ]
            }
            
            async with httpx.AsyncClient() as client:
                await client.post(webhook_url, json=payload, timeout=5.0)
                
        except Exception as e:
            self.logger.error(f"Failed to send Slack alert: {e}")
    
    async def get_system_info(self) -> Dict[str, Any]:
        """Get current system information for alerts"""
        try:
            return {
                'cpu_percent': psutil.cpu_percent(),
                'memory_percent': psutil.virtual_memory().percent,
                'disk_percent': psutil.disk_usage('/').percent,
                'active_requests': len(self.active_requests),
                'total_requests': len(self.request_metrics),
                'uptime': time.time() - psutil.boot_time()
            }
        except Exception as e:
            self.logger.error(f"Error getting system info: {e}")
            return {}
    
    async def cleanup_old_data(self):
        """Clean up old performance data"""
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=24)
        
        # Clean request metrics older than 24 hours
        self.request_metrics = deque(
            [m for m in self.request_metrics if m.timestamp > cutoff_time],
            maxlen=self.request_metrics.maxlen
        )
        
        # Clean system metrics older than 24 hours
        self.system_metrics = deque(
            [m for m in self.system_metrics if m.timestamp > cutoff_time],
            maxlen=self.system_metrics.maxlen
        )
        
        self.logger.info("Cleaned up old performance data")
    
    # Public methods for request tracking
    def start_request(self, request_id: str, endpoint: str, method: str) -> float:
        """Start tracking a request"""
        start_time = time.time()
        self.active_requests[request_id] = start_time
        
        if hasattr(self, 'active_requests_gauge'):
            self.active_requests_gauge.set(len(self.active_requests))
        
        return start_time
    
    def end_request(self, request_id: str, status_code: int, **kwargs) -> Optional[RequestMetrics]:
        """End tracking a request and record metrics"""
        if request_id not in self.active_requests:
            return None
        
        start_time = self.active_requests.pop(request_id)
        duration = time.time() - start_time
        
        # Extract endpoint and method from kwargs or request_id
        endpoint = kwargs.get('endpoint', 'unknown')
        method = kwargs.get('method', 'unknown')
        
        metrics = RequestMetrics(
            request_id=request_id,
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            duration=duration,
            timestamp=datetime.now(timezone.utc),
            **kwargs
        )
        
        self.request_metrics.append(metrics)
        self.response_times.append(duration)
        
        # Update endpoint stats
        stats = self.endpoint_stats[f"{method} {endpoint}"]
        stats['count'] += 1
        stats['total_time'] += duration
        stats['min_time'] = min(stats['min_time'], duration)
        stats['max_time'] = max(stats['max_time'], duration)
        if status_code >= 400:
            stats['errors'] += 1
        
        # Update Prometheus metrics
        if hasattr(self, 'request_duration'):
            self.request_duration.labels(
                method=method,
                endpoint=endpoint,
                status_code=str(status_code)
            ).observe(duration)
            
            self.request_count.labels(
                method=method,
                endpoint=endpoint,
                status_code=str(status_code)
            ).inc()
            
            self.active_requests_gauge.set(len(self.active_requests))
        
        return metrics
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get performance summary for dashboard"""
        if not self.request_metrics:
            return {"message": "No performance data available"}
        
        recent_requests = [m for m in self.request_metrics 
                         if (datetime.now(timezone.utc) - m.timestamp).seconds < 3600]
        
        if not recent_requests:
            return {"message": "No recent performance data"}
        
        response_times = [m.duration for m in recent_requests]
        error_requests = [m for m in recent_requests if m.status_code >= 400]
        
        # Calculate statistics
        avg_response_time = sum(response_times) / len(response_times)
        sorted_times = sorted(response_times)
        p50_index = int(0.5 * len(sorted_times))
        p95_index = int(0.95 * len(sorted_times))
        p99_index = int(0.99 * len(sorted_times))
        
        return {
            "requests_last_hour": len(recent_requests),
            "requests_per_minute": len(recent_requests) / 60.0,
            "error_rate": len(error_requests) / len(recent_requests),
            "average_response_time": avg_response_time,
            "p50_response_time": sorted_times[p50_index] if p50_index < len(sorted_times) else 0,
            "p95_response_time": sorted_times[p95_index] if p95_index < len(sorted_times) else 0,
            "p99_response_time": sorted_times[p99_index] if p99_index < len(sorted_times) else 0,
            "min_response_time": min(response_times),
            "max_response_time": max(response_times),
            "active_requests": len(self.active_requests),
            "endpoint_stats": dict(self.endpoint_stats),
            "system_metrics": asdict(self.system_metrics[-1]) if self.system_metrics else None
        }
    
    def get_prometheus_metrics(self) -> str:
        """Get Prometheus metrics in text format"""
        if not PROMETHEUS_AVAILABLE or not hasattr(self, 'registry'):
            return "# Prometheus not available\n"
        
        from prometheus_client import generate_latest
        return generate_latest(self.registry).decode('utf-8')

# ============================================================================
# Global Instance and Context Manager
# ============================================================================

_performance_monitor: Optional[PerformanceMonitor] = None

def initialize_performance_monitoring(config: Dict[str, Any]) -> PerformanceMonitor:
    """Initialize global performance monitoring"""
    global _performance_monitor
    _performance_monitor = PerformanceMonitor(config)
    return _performance_monitor

def get_performance_monitor() -> Optional[PerformanceMonitor]:
    """Get global performance monitor instance"""
    return _performance_monitor

@asynccontextmanager
async def track_request_performance(request_id: str, endpoint: str, method: str, **kwargs):
    """Context manager for tracking request performance"""
    monitor = get_performance_monitor()
    if not monitor:
        yield
        return
    
    start_time = monitor.start_request(request_id, endpoint, method)
    
    try:
        yield
        # Success case
        monitor.end_request(request_id, 200, endpoint=endpoint, method=method, **kwargs)
    except Exception as e:
        # Error case
        status_code = getattr(e, 'status_code', 500)
        monitor.end_request(request_id, status_code, endpoint=endpoint, method=method, **kwargs)
        raise

# Default configuration
DEFAULT_PERFORMANCE_CONFIG = {
    'enable_prometheus': os.getenv('ENABLE_PROMETHEUS', 'false').lower() == 'true',
    'alert_webhook_url': os.getenv('ALERT_WEBHOOK_URL'),
    'alert_slack_webhook': os.getenv('ALERT_SLACK_WEBHOOK'),
    'alert_email': {
        'smtp_server': os.getenv('SMTP_SERVER'),
        'smtp_port': int(os.getenv('SMTP_PORT', '587')),
        'username': os.getenv('SMTP_USERNAME'),
        'password': os.getenv('SMTP_PASSWORD'),
        'from': os.getenv('ALERT_EMAIL_FROM'),
        'to': os.getenv('ALERT_EMAIL_TO', '').split(',') if os.getenv('ALERT_EMAIL_TO') else [],
        'use_tls': os.getenv('SMTP_USE_TLS', 'true').lower() == 'true'
    } if os.getenv('SMTP_SERVER') else None
}