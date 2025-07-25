#!/bin/bash

# Docker Entrypoint Script for TG App FSRS Backend
# Handles initialization, migrations, and application startup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

# Wait for database to be ready
wait_for_db() {
    log "Waiting for database to be ready..."
    
    # Extract database connection details from DATABASE_URL
    if [[ -z "${DATABASE_URL:-}" ]]; then
        error "DATABASE_URL environment variable is not set"
    fi
    
    # Parse DATABASE_URL (format: postgresql+asyncpg://user:pass@host:port/db)
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    if [[ -z "$DB_HOST" ]] || [[ -z "$DB_PORT" ]]; then
        warning "Could not parse database connection details, skipping wait"
        return 0
    fi
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
            success "Database is ready"
            return 0
        fi
        
        log "Database not ready, waiting... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    error "Database failed to become ready after $max_attempts attempts"
}

# Wait for Redis to be ready
wait_for_redis() {
    if [[ -z "${REDIS_URL:-}" ]]; then
        log "Redis not configured, skipping wait"
        return 0
    fi
    
    log "Waiting for Redis to be ready..."
    
    # Extract Redis connection details
    REDIS_HOST=$(echo $REDIS_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    REDIS_PORT=$(echo $REDIS_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    if [[ -z "$REDIS_HOST" ]]; then
        REDIS_HOST="redis"
        REDIS_PORT="6379"
    fi
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping >/dev/null 2>&1; then
            success "Redis is ready"
            return 0
        fi
        
        log "Redis not ready, waiting... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    warning "Redis failed to become ready after $max_attempts attempts"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Check if alembic is available
    if ! command -v alembic &> /dev/null; then
        error "Alembic not found. Cannot run migrations."
    fi
    
    # Run migrations
    if alembic upgrade head; then
        success "Database migrations completed successfully"
    else
        error "Database migrations failed"
    fi
}

# Initialize application
initialize_app() {
    log "Initializing application..."
    
    # Create necessary directories
    mkdir -p /app/logs /app/backups /app/uploads
    
    # Set proper permissions
    chmod 755 /app/logs /app/backups /app/uploads
    
    # Initialize logging
    if [[ ! -f /app/logs/app.log ]]; then
        touch /app/logs/app.log
    fi
    
    success "Application initialized"
}

# Validate environment
validate_environment() {
    log "Validating environment configuration..."
    
    # Required environment variables
    local required_vars=(
        "DATABASE_URL"
        "SECRET_KEY"
        "ENVIRONMENT"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error "Required environment variable $var is not set"
        fi
    done
    
    # Production-specific validations
    if [[ "${ENVIRONMENT}" == "production" ]]; then
        if [[ "${SECRET_KEY}" == "your-secret-key-change-in-production" ]]; then
            error "Production SECRET_KEY must be changed from default"
        fi
        
        if [[ "${DATABASE_URL}" == *"sqlite"* ]]; then
            error "SQLite is not allowed in production"
        fi
        
        if [[ "${DEBUG:-false}" == "true" ]]; then
            warning "DEBUG is enabled in production environment"
        fi
    fi
    
    success "Environment validation passed"
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring..."
    
    # Initialize performance monitoring
    if [[ "${ENABLE_METRICS:-false}" == "true" ]]; then
        log "Performance metrics enabled"
    fi
    
    # Initialize error tracking
    if [[ -n "${SENTRY_DSN:-}" ]]; then
        log "Sentry error tracking enabled"
    fi
    
    success "Monitoring setup completed"
}

# Cleanup function
cleanup() {
    log "Performing cleanup..."
    
    # Clean up old log files (keep last 7 days)
    find /app/logs -name "*.log" -type f -mtime +7 -delete 2>/dev/null || true
    
    # Clean up old backup files (keep last 30 days)
    find /app/backups -name "*.sql*" -type f -mtime +30 -delete 2>/dev/null || true
    
    success "Cleanup completed"
}

# Health check function
health_check() {
    log "Performing initial health check..."
    
    # Check if the application can start
    python -c "
import sys
sys.path.insert(0, '/app')
try:
    from app.main import app
    print('Application imports successfully')
except Exception as e:
    print(f'Application import failed: {e}')
    sys.exit(1)
"
    
    if [[ $? -eq 0 ]]; then
        success "Initial health check passed"
    else
        error "Initial health check failed"
    fi
}

# Main execution
main() {
    log "Starting TG App FSRS Backend initialization..."
    log "Environment: ${ENVIRONMENT:-unknown}"
    log "Debug mode: ${DEBUG:-false}"
    
    # Perform initialization steps
    validate_environment
    initialize_app
    wait_for_db
    wait_for_redis
    run_migrations
    setup_monitoring
    cleanup
    health_check
    
    success "Initialization completed successfully"
    
    # Execute the main command
    log "Starting application with command: $*"
    exec "$@"
}

# Handle different commands
case "${1:-}" in
    "bash"|"sh")
        # Interactive shell
        exec "$@"
        ;;
    "python")
        # Python command
        validate_environment
        exec "$@"
        ;;
    "alembic")
        # Alembic command
        wait_for_db
        exec "$@"
        ;;
    "pytest"|"test")
        # Testing
        validate_environment
        wait_for_db
        exec python -m pytest "${@:2}"
        ;;
    "migrate")
        # Migration only
        validate_environment
        wait_for_db
        run_migrations
        exit 0
        ;;
    "health")
        # Health check only
        health_check
        exit 0
        ;;
    *)
        # Default: full initialization and start application
        main "$@"
        ;;
esac