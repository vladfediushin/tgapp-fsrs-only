#!/bin/bash

# TG App FSRS Production Deployment Script
# Comprehensive deployment automation for production environment

set -e  # Exit on any error
set -u  # Exit on undefined variables

# ============================================================================
# Configuration and Variables
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DEPLOYMENT_ID="deploy_${TIMESTAMP}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT=${ENVIRONMENT:-production}
SKIP_TESTS=${SKIP_TESTS:-false}
SKIP_BACKUP=${SKIP_BACKUP:-false}
DRY_RUN=${DRY_RUN:-false}
ROLLBACK_ON_FAILURE=${ROLLBACK_ON_FAILURE:-true}
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-300}

# Deployment targets
FRONTEND_TARGET=${FRONTEND_TARGET:-vercel}
BACKEND_TARGET=${BACKEND_TARGET:-render}

# ============================================================================
# Utility Functions
# ============================================================================

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

check_dependencies() {
    log "Checking deployment dependencies..."
    
    local deps=("node" "npm" "git" "curl" "jq")
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            error "$dep is required but not installed"
        fi
    done
    
    # Check for deployment tools
    if [[ "$FRONTEND_TARGET" == "vercel" ]] && ! command -v vercel &> /dev/null; then
        warning "Vercel CLI not found. Installing..."
        npm install -g vercel
    fi
    
    success "All dependencies are available"
}

validate_environment() {
    log "Validating environment configuration..."
    
    # Check required environment variables
    local required_vars=(
        "DATABASE_URL"
        "SECRET_KEY"
        "CORS_ORIGINS"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error "Required environment variable $var is not set"
        fi
    done
    
    # Validate environment-specific settings
    if [[ "$ENVIRONMENT" == "production" ]]; then
        if [[ "${SECRET_KEY}" == "your-secret-key-change-in-production" ]]; then
            error "Production SECRET_KEY must be changed from default"
        fi
        
        if [[ "${DATABASE_URL}" == *"sqlite"* ]]; then
            error "SQLite is not allowed in production"
        fi
    fi
    
    success "Environment validation passed"
}

# ============================================================================
# Pre-deployment Checks
# ============================================================================

run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        warning "Skipping tests as requested"
        return 0
    fi
    
    log "Running pre-deployment tests..."
    
    # Frontend tests
    log "Running frontend tests..."
    cd "$PROJECT_ROOT/frontend"
    npm test -- --run --reporter=verbose
    
    # Backend tests
    log "Running backend tests..."
    cd "$PROJECT_ROOT/backend"
    python -m pytest tests/ -v --tb=short
    
    # Integration tests
    log "Running integration tests..."
    cd "$PROJECT_ROOT"
    python -m pytest backend/test_fsrs_only.py -v
    
    success "All tests passed"
}

check_git_status() {
    log "Checking Git repository status..."
    
    cd "$PROJECT_ROOT"
    
    # Check if we're on the correct branch
    local current_branch=$(git branch --show-current)
    local target_branch=${TARGET_BRANCH:-main}
    
    if [[ "$current_branch" != "$target_branch" ]]; then
        error "Not on target branch. Current: $current_branch, Expected: $target_branch"
    fi
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        error "There are uncommitted changes. Please commit or stash them."
    fi
    
    # Check if we're up to date with remote
    git fetch origin
    local local_commit=$(git rev-parse HEAD)
    local remote_commit=$(git rev-parse origin/$target_branch)
    
    if [[ "$local_commit" != "$remote_commit" ]]; then
        error "Local branch is not up to date with remote. Please pull latest changes."
    fi
    
    success "Git repository is ready for deployment"
}

create_backup() {
    if [[ "$SKIP_BACKUP" == "true" ]]; then
        warning "Skipping backup as requested"
        return 0
    fi
    
    log "Creating pre-deployment backup..."
    
    # Create backup directory
    local backup_dir="$PROJECT_ROOT/backups/$DEPLOYMENT_ID"
    mkdir -p "$backup_dir"
    
    # Database backup (if applicable)
    if [[ "${DATABASE_URL}" == *"postgresql"* ]]; then
        log "Creating database backup..."
        pg_dump "$DATABASE_URL" > "$backup_dir/database_backup.sql"
        gzip "$backup_dir/database_backup.sql"
    fi
    
    # Application state backup
    log "Creating application state backup..."
    cat > "$backup_dir/deployment_info.json" << EOF
{
    "deployment_id": "$DEPLOYMENT_ID",
    "timestamp": "$TIMESTAMP",
    "environment": "$ENVIRONMENT",
    "git_commit": "$(git rev-parse HEAD)",
    "git_branch": "$(git branch --show-current)",
    "version": "$(cat package.json | jq -r '.version')"
}
EOF
    
    success "Backup created at $backup_dir"
}

# ============================================================================
# Build and Deployment Functions
# ============================================================================

build_frontend() {
    log "Building frontend for production..."
    
    cd "$PROJECT_ROOT/frontend"
    
    # Install dependencies
    log "Installing frontend dependencies..."
    npm ci --production=false
    
    # Run build
    log "Building frontend..."
    npm run build
    
    # Validate build
    if [[ ! -d "dist" ]]; then
        error "Frontend build failed - dist directory not found"
    fi
    
    # Check bundle size
    log "Checking bundle size..."
    npm run build:gzip-check || warning "Bundle size check failed"
    
    success "Frontend build completed"
}

build_backend() {
    log "Preparing backend for deployment..."
    
    cd "$PROJECT_ROOT/backend"
    
    # Validate Python dependencies
    log "Validating backend dependencies..."
    pip install -r requirements.txt --dry-run
    
    # Run database migrations (dry run)
    log "Validating database migrations..."
    if [[ "$DRY_RUN" != "true" ]]; then
        alembic check
    fi
    
    success "Backend preparation completed"
}

deploy_frontend() {
    log "Deploying frontend to $FRONTEND_TARGET..."
    
    cd "$PROJECT_ROOT/frontend"
    
    case "$FRONTEND_TARGET" in
        "vercel")
            if [[ "$DRY_RUN" == "true" ]]; then
                log "DRY RUN: Would deploy to Vercel"
                return 0
            fi
            
            # Deploy to Vercel
            if [[ "$ENVIRONMENT" == "production" ]]; then
                vercel --prod --yes
            else
                vercel --yes
            fi
            ;;
        "netlify")
            if [[ "$DRY_RUN" == "true" ]]; then
                log "DRY RUN: Would deploy to Netlify"
                return 0
            fi
            
            # Deploy to Netlify (requires netlify-cli)
            netlify deploy --prod --dir=dist
            ;;
        *)
            error "Unsupported frontend deployment target: $FRONTEND_TARGET"
            ;;
    esac
    
    success "Frontend deployed successfully"
}

deploy_backend() {
    log "Deploying backend to $BACKEND_TARGET..."
    
    cd "$PROJECT_ROOT/backend"
    
    case "$BACKEND_TARGET" in
        "render")
            if [[ "$DRY_RUN" == "true" ]]; then
                log "DRY RUN: Would deploy to Render"
                return 0
            fi
            
            # Render deployment is typically triggered by git push
            # We'll trigger a deployment via API if configured
            if [[ -n "${RENDER_API_KEY:-}" ]] && [[ -n "${RENDER_SERVICE_ID:-}" ]]; then
                log "Triggering Render deployment via API..."
                curl -X POST \
                    -H "Authorization: Bearer $RENDER_API_KEY" \
                    -H "Content-Type: application/json" \
                    "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys"
            else
                log "Render deployment will be triggered by git push"
            fi
            ;;
        "heroku")
            if [[ "$DRY_RUN" == "true" ]]; then
                log "DRY RUN: Would deploy to Heroku"
                return 0
            fi
            
            # Deploy to Heroku
            git subtree push --prefix=backend heroku main
            ;;
        *)
            error "Unsupported backend deployment target: $BACKEND_TARGET"
            ;;
    esac
    
    success "Backend deployment initiated"
}

run_migrations() {
    log "Running database migrations..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would run database migrations"
        return 0
    fi
    
    cd "$PROJECT_ROOT/backend"
    
    # Run migrations
    alembic upgrade head
    
    success "Database migrations completed"
}

# ============================================================================
# Post-deployment Validation
# ============================================================================

health_check() {
    log "Performing post-deployment health checks..."
    
    local backend_url="${BACKEND_URL:-https://tgapp-fsrs-backend.onrender.com}"
    local frontend_url="${FRONTEND_URL:-https://tgapp-fsrs.vercel.app}"
    
    # Backend health check
    log "Checking backend health..."
    local backend_healthy=false
    local attempts=0
    local max_attempts=$((HEALTH_CHECK_TIMEOUT / 10))
    
    while [[ $attempts -lt $max_attempts ]]; do
        if curl -f -s "$backend_url/health" > /dev/null; then
            backend_healthy=true
            break
        fi
        
        log "Backend not ready, waiting... (attempt $((attempts + 1))/$max_attempts)"
        sleep 10
        ((attempts++))
    done
    
    if [[ "$backend_healthy" != "true" ]]; then
        error "Backend health check failed after $HEALTH_CHECK_TIMEOUT seconds"
    fi
    
    # Frontend health check
    log "Checking frontend health..."
    if ! curl -f -s "$frontend_url" > /dev/null; then
        error "Frontend health check failed"
    fi
    
    # API integration test
    log "Testing API integration..."
    local api_response=$(curl -s "$backend_url/health" | jq -r '.status')
    if [[ "$api_response" != "healthy" ]]; then
        error "API integration test failed"
    fi
    
    success "All health checks passed"
}

smoke_tests() {
    log "Running smoke tests..."
    
    local backend_url="${BACKEND_URL:-https://tgapp-fsrs-backend.onrender.com}"
    
    # Test critical endpoints
    local endpoints=(
        "/health"
        "/health/simple"
        "/docs"
    )
    
    for endpoint in "${endpoints[@]}"; do
        log "Testing endpoint: $endpoint"
        if ! curl -f -s "$backend_url$endpoint" > /dev/null; then
            error "Smoke test failed for endpoint: $endpoint"
        fi
    done
    
    success "Smoke tests passed"
}

# ============================================================================
# Rollback Functions
# ============================================================================

rollback_deployment() {
    error_msg="$1"
    
    error "Deployment failed: $error_msg"
    
    if [[ "$ROLLBACK_ON_FAILURE" != "true" ]]; then
        warning "Rollback disabled, manual intervention required"
        exit 1
    fi
    
    log "Initiating automatic rollback..."
    
    # Restore from backup if available
    local backup_dir="$PROJECT_ROOT/backups/$DEPLOYMENT_ID"
    if [[ -d "$backup_dir" ]]; then
        log "Restoring from backup..."
        
        # Restore database if backup exists
        if [[ -f "$backup_dir/database_backup.sql.gz" ]]; then
            log "Restoring database..."
            gunzip -c "$backup_dir/database_backup.sql.gz" | psql "$DATABASE_URL"
        fi
    fi
    
    warning "Rollback completed. Please investigate the deployment failure."
    exit 1
}

# ============================================================================
# Main Deployment Flow
# ============================================================================

main() {
    log "Starting TG App FSRS deployment (ID: $DEPLOYMENT_ID)"
    log "Environment: $ENVIRONMENT"
    log "Dry Run: $DRY_RUN"
    
    # Trap errors for rollback
    trap 'rollback_deployment "Unexpected error occurred"' ERR
    
    # Pre-deployment phase
    log "=== PRE-DEPLOYMENT PHASE ==="
    check_dependencies
    validate_environment
    check_git_status
    create_backup
    run_tests
    
    # Build phase
    log "=== BUILD PHASE ==="
    build_frontend
    build_backend
    
    # Deployment phase
    log "=== DEPLOYMENT PHASE ==="
    deploy_frontend
    deploy_backend
    run_migrations
    
    # Post-deployment phase
    log "=== POST-DEPLOYMENT PHASE ==="
    health_check
    smoke_tests
    
    # Success
    success "Deployment completed successfully!"
    log "Deployment ID: $DEPLOYMENT_ID"
    log "Frontend URL: ${FRONTEND_URL:-https://tgapp-fsrs.vercel.app}"
    log "Backend URL: ${BACKEND_URL:-https://tgapp-fsrs-backend.onrender.com}"
    
    # Clean up old backups (keep last 5)
    log "Cleaning up old backups..."
    cd "$PROJECT_ROOT/backups"
    ls -t | tail -n +6 | xargs -r rm -rf
    
    success "Deployment process completed!"
}

# ============================================================================
# Script Entry Point
# ============================================================================

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment|-e)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --no-rollback)
            ROLLBACK_ON_FAILURE=false
            shift
            ;;
        --frontend-target)
            FRONTEND_TARGET="$2"
            shift 2
            ;;
        --backend-target)
            BACKEND_TARGET="$2"
            shift 2
            ;;
        --help|-h)
            cat << EOF
TG App FSRS Deployment Script

Usage: $0 [OPTIONS]

Options:
    -e, --environment ENV       Deployment environment (default: production)
    --skip-tests               Skip running tests
    --skip-backup              Skip creating backup
    --dry-run                  Perform dry run without actual deployment
    --no-rollback              Disable automatic rollback on failure
    --frontend-target TARGET   Frontend deployment target (vercel, netlify)
    --backend-target TARGET    Backend deployment target (render, heroku)
    -h, --help                 Show this help message

Environment Variables:
    DATABASE_URL               Database connection string
    SECRET_KEY                 Application secret key
    CORS_ORIGINS              Allowed CORS origins
    RENDER_API_KEY            Render API key (optional)
    RENDER_SERVICE_ID         Render service ID (optional)
    FRONTEND_URL              Frontend URL for health checks
    BACKEND_URL               Backend URL for health checks

Examples:
    $0                                    # Deploy to production
    $0 --environment staging             # Deploy to staging
    $0 --dry-run                         # Dry run deployment
    $0 --skip-tests --skip-backup        # Quick deployment
EOF
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Run main deployment function
main "$@"