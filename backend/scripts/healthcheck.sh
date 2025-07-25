#!/bin/bash

# Health Check Script for TG App FSRS Backend
# Comprehensive health validation for Docker containers

set -e

# Configuration
HEALTH_CHECK_URL="http://localhost:8000/health"
TIMEOUT=10
MAX_RETRIES=3
RETRY_DELAY=2

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >&2
}

success() {
    echo -e "${GREEN}[HEALTHY] $1${NC}" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}" >&2
}

error() {
    echo -e "${RED}[UNHEALTHY] $1${NC}" >&2
    exit 1
}

# Check if application is responding
check_http_health() {
    local url="$1"
    local timeout="$2"
    
    # Use curl to check HTTP health endpoint
    if command -v curl >/dev/null 2>&1; then
        local response=$(curl -s -w "%{http_code}" -o /tmp/health_response --max-time "$timeout" "$url" 2>/dev/null)
        local http_code="${response: -3}"
        
        if [[ "$http_code" == "200" ]]; then
            # Check response content
            if [[ -f /tmp/health_response ]]; then
                local status=$(cat /tmp/health_response | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('status', 'unknown'))
except:
    print('invalid')
" 2>/dev/null)
                
                if [[ "$status" == "healthy" ]]; then
                    return 0
                else
                    log "Health endpoint returned status: $status"
                    return 1
                fi
            fi
        else
            log "HTTP health check failed with code: $http_code"
            return 1
        fi
    else
        log "curl not available, skipping HTTP health check"
        return 1
    fi
}

# Check database connectivity
check_database_health() {
    if [[ -z "${DATABASE_URL:-}" ]]; then
        log "DATABASE_URL not set, skipping database health check"
        return 0
    fi
    
    # Try to connect to database using Python
    python3 -c "
import sys
import os
import asyncio
import asyncpg
from urllib.parse import urlparse

async def check_db():
    try:
        db_url = os.environ.get('DATABASE_URL', '')
        if not db_url:
            return False
            
        # Parse asyncpg URL format
        if 'postgresql+asyncpg://' in db_url:
            db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
        
        # Connect with timeout
        conn = await asyncio.wait_for(
            asyncpg.connect(db_url),
            timeout=5.0
        )
        
        # Simple query
        result = await conn.fetchval('SELECT 1')
        await conn.close()
        
        return result == 1
    except Exception as e:
        print(f'Database health check failed: {e}', file=sys.stderr)
        return False

# Run the check
result = asyncio.run(check_db())
sys.exit(0 if result else 1)
" 2>/dev/null
    
    return $?
}

# Check Redis connectivity
check_redis_health() {
    if [[ -z "${REDIS_URL:-}" ]]; then
        log "REDIS_URL not set, skipping Redis health check"
        return 0
    fi
    
    # Extract Redis connection details
    local redis_host=$(echo $REDIS_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local redis_port=$(echo $REDIS_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    if [[ -z "$redis_host" ]]; then
        redis_host="redis"
        redis_port="6379"
    fi
    
    # Try to ping Redis
    if command -v redis-cli >/dev/null 2>&1; then
        if redis-cli -h "$redis_host" -p "$redis_port" ping >/dev/null 2>&1; then
            return 0
        else
            log "Redis ping failed"
            return 1
        fi
    else
        log "redis-cli not available, skipping Redis health check"
        return 0
    fi
}

# Check application process
check_process_health() {
    # Check if uvicorn process is running
    if pgrep -f "uvicorn" >/dev/null 2>&1; then
        return 0
    else
        log "Uvicorn process not found"
        return 1
    fi
}

# Check memory usage
check_memory_health() {
    # Get memory usage percentage
    local memory_usage=$(python3 -c "
import psutil
memory = psutil.virtual_memory()
print(int(memory.percent))
" 2>/dev/null)
    
    if [[ -n "$memory_usage" ]]; then
        if [[ "$memory_usage" -gt 90 ]]; then
            warning "High memory usage: ${memory_usage}%"
            return 1
        elif [[ "$memory_usage" -gt 80 ]]; then
            warning "Memory usage: ${memory_usage}%"
        fi
    fi
    
    return 0
}

# Check disk space
check_disk_health() {
    # Check disk usage for /app directory
    local disk_usage=$(df /app | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [[ -n "$disk_usage" ]]; then
        if [[ "$disk_usage" -gt 90 ]]; then
            warning "High disk usage: ${disk_usage}%"
            return 1
        elif [[ "$disk_usage" -gt 80 ]]; then
            warning "Disk usage: ${disk_usage}%"
        fi
    fi
    
    return 0
}

# Check log files
check_log_health() {
    local log_file="/app/logs/app.log"
    
    if [[ -f "$log_file" ]]; then
        # Check if log file is too large (>100MB)
        local log_size=$(stat -f%z "$log_file" 2>/dev/null || stat -c%s "$log_file" 2>/dev/null)
        local max_size=$((100 * 1024 * 1024))  # 100MB
        
        if [[ -n "$log_size" ]] && [[ "$log_size" -gt "$max_size" ]]; then
            warning "Log file is large: $(($log_size / 1024 / 1024))MB"
        fi
        
        # Check for recent errors in logs
        local error_count=$(tail -n 100 "$log_file" | grep -c "ERROR" 2>/dev/null || echo "0")
        if [[ "$error_count" -gt 10 ]]; then
            warning "High error count in recent logs: $error_count"
        fi
    fi
    
    return 0
}

# Comprehensive health check
run_health_checks() {
    local checks_passed=0
    local total_checks=0
    
    log "Starting comprehensive health check..."
    
    # HTTP Health Check (most important)
    ((total_checks++))
    if check_http_health "$HEALTH_CHECK_URL" "$TIMEOUT"; then
        success "HTTP health check passed"
        ((checks_passed++))
    else
        error "HTTP health check failed"
    fi
    
    # Process Health Check
    ((total_checks++))
    if check_process_health; then
        success "Process health check passed"
        ((checks_passed++))
    else
        warning "Process health check failed"
    fi
    
    # Database Health Check
    ((total_checks++))
    if check_database_health; then
        success "Database health check passed"
        ((checks_passed++))
    else
        warning "Database health check failed"
    fi
    
    # Redis Health Check
    ((total_checks++))
    if check_redis_health; then
        success "Redis health check passed"
        ((checks_passed++))
    else
        warning "Redis health check failed"
    fi
    
    # Memory Health Check
    ((total_checks++))
    if check_memory_health; then
        success "Memory health check passed"
        ((checks_passed++))
    else
        warning "Memory health check failed"
    fi
    
    # Disk Health Check
    ((total_checks++))
    if check_disk_health; then
        success "Disk health check passed"
        ((checks_passed++))
    else
        warning "Disk health check failed"
    fi
    
    # Log Health Check
    ((total_checks++))
    if check_log_health; then
        success "Log health check passed"
        ((checks_passed++))
    else
        warning "Log health check failed"
    fi
    
    # Determine overall health
    local health_percentage=$((checks_passed * 100 / total_checks))
    
    log "Health check results: $checks_passed/$total_checks checks passed ($health_percentage%)"
    
    # Require at least HTTP health check to pass
    if [[ "$checks_passed" -ge 1 ]] && check_http_health "$HEALTH_CHECK_URL" "$TIMEOUT"; then
        success "Overall health check: HEALTHY"
        return 0
    else
        error "Overall health check: UNHEALTHY"
        return 1
    fi
}

# Main execution with retries
main() {
    local attempt=1
    
    while [[ $attempt -le $MAX_RETRIES ]]; do
        log "Health check attempt $attempt/$MAX_RETRIES"
        
        if run_health_checks; then
            exit 0
        fi
        
        if [[ $attempt -lt $MAX_RETRIES ]]; then
            log "Health check failed, retrying in ${RETRY_DELAY}s..."
            sleep $RETRY_DELAY
        fi
        
        ((attempt++))
    done
    
    error "Health check failed after $MAX_RETRIES attempts"
}

# Cleanup function
cleanup() {
    rm -f /tmp/health_response 2>/dev/null || true
}

# Set trap for cleanup
trap cleanup EXIT

# Run main function
main "$@"