#!/bin/bash

# Secrets Management Script for TG App FSRS
# Secure handling of environment variables and secrets

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SECRETS_DIR="$PROJECT_ROOT/.secrets"
ENCRYPTED_SECRETS_FILE="$SECRETS_DIR/secrets.enc"
SECRETS_KEY_FILE="$SECRETS_DIR/key"

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

# Check dependencies
check_dependencies() {
    local deps=("openssl" "base64")
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            error "$dep is required but not installed"
        fi
    done
}

# Generate encryption key
generate_key() {
    log "Generating new encryption key..."
    
    mkdir -p "$SECRETS_DIR"
    chmod 700 "$SECRETS_DIR"
    
    # Generate 256-bit key
    openssl rand -base64 32 > "$SECRETS_KEY_FILE"
    chmod 600 "$SECRETS_KEY_FILE"
    
    success "Encryption key generated at $SECRETS_KEY_FILE"
    warning "IMPORTANT: Back up this key securely and never commit it to version control!"
}

# Encrypt secrets file
encrypt_secrets() {
    local input_file="$1"
    
    if [[ -z "$input_file" ]]; then
        input_file="$PROJECT_ROOT/.env"
    fi
    
    if [[ ! -f "$input_file" ]]; then
        error "Input file not found: $input_file"
    fi
    
    if [[ ! -f "$SECRETS_KEY_FILE" ]]; then
        log "Encryption key not found, generating new key..."
        generate_key
    fi
    
    log "Encrypting secrets from $input_file..."
    
    # Read the key
    local key=$(cat "$SECRETS_KEY_FILE")
    
    # Encrypt the file
    openssl enc -aes-256-cbc -salt -in "$input_file" -out "$ENCRYPTED_SECRETS_FILE" -pass pass:"$key"
    chmod 600 "$ENCRYPTED_SECRETS_FILE"
    
    success "Secrets encrypted to $ENCRYPTED_SECRETS_FILE"
}

# Decrypt secrets file
decrypt_secrets() {
    local output_file="$1"
    
    if [[ -z "$output_file" ]]; then
        output_file="$PROJECT_ROOT/.env"
    fi
    
    if [[ ! -f "$ENCRYPTED_SECRETS_FILE" ]]; then
        error "Encrypted secrets file not found: $ENCRYPTED_SECRETS_FILE"
    fi
    
    if [[ ! -f "$SECRETS_KEY_FILE" ]]; then
        error "Encryption key not found: $SECRETS_KEY_FILE"
    fi
    
    log "Decrypting secrets to $output_file..."
    
    # Read the key
    local key=$(cat "$SECRETS_KEY_FILE")
    
    # Decrypt the file
    if openssl enc -aes-256-cbc -d -salt -in "$ENCRYPTED_SECRETS_FILE" -out "$output_file" -pass pass:"$key"; then
        chmod 600 "$output_file"
        success "Secrets decrypted to $output_file"
    else
        error "Failed to decrypt secrets. Check if the key is correct."
    fi
}

# Validate environment variables
validate_secrets() {
    local env_file="$1"
    
    if [[ -z "$env_file" ]]; then
        env_file="$PROJECT_ROOT/.env"
    fi
    
    if [[ ! -f "$env_file" ]]; then
        error "Environment file not found: $env_file"
    fi
    
    log "Validating secrets in $env_file..."
    
    # Source the environment file
    set -a
    source "$env_file"
    set +a
    
    local validation_errors=0
    
    # Check required variables
    local required_vars=(
        "SECRET_KEY"
        "DATABASE_URL"
        "ENVIRONMENT"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error "Required variable $var is not set"
            ((validation_errors++))
        fi
    done
    
    # Check for default/insecure values
    if [[ "${SECRET_KEY:-}" == "your-production-secret-key-change-this-immediately" ]]; then
        error "SECRET_KEY is still set to default value"
        ((validation_errors++))
    fi
    
    if [[ "${SECRET_KEY:-}" == "your-secret-key-change-in-production" ]]; then
        error "SECRET_KEY is still set to default value"
        ((validation_errors++))
    fi
    
    # Check SECRET_KEY strength
    if [[ ${#SECRET_KEY} -lt 32 ]]; then
        warning "SECRET_KEY should be at least 32 characters long"
    fi
    
    # Check database URL format
    if [[ "${ENVIRONMENT}" == "production" ]] && [[ "${DATABASE_URL}" == *"sqlite"* ]]; then
        error "SQLite is not allowed in production"
        ((validation_errors++))
    fi
    
    # Check CORS origins
    if [[ -z "${CORS_ORIGINS:-}" ]]; then
        warning "CORS_ORIGINS is not set"
    fi
    
    # Check for localhost in production
    if [[ "${ENVIRONMENT}" == "production" ]]; then
        if [[ "${CORS_ORIGINS:-}" == *"localhost"* ]]; then
            warning "CORS_ORIGINS contains localhost in production"
        fi
        
        if [[ "${DATABASE_URL:-}" == *"localhost"* ]]; then
            warning "DATABASE_URL contains localhost in production"
        fi
    fi
    
    if [[ $validation_errors -eq 0 ]]; then
        success "All secrets validation checks passed"
    else
        error "$validation_errors validation errors found"
    fi
}

# Generate secure random values
generate_secret() {
    local type="$1"
    local length="${2:-32}"
    
    case "$type" in
        "key"|"secret")
            # Generate base64 encoded random key
            openssl rand -base64 "$length"
            ;;
        "password")
            # Generate alphanumeric password
            openssl rand -base64 "$length" | tr -d "=+/" | cut -c1-"$length"
            ;;
        "hex")
            # Generate hex string
            openssl rand -hex "$length"
            ;;
        "uuid")
            # Generate UUID
            python3 -c "import uuid; print(uuid.uuid4())"
            ;;
        *)
            error "Unknown secret type: $type. Use: key, password, hex, uuid"
            ;;
    esac
}

# Setup secrets for different environments
setup_environment() {
    local env="$1"
    
    if [[ -z "$env" ]]; then
        error "Environment not specified. Use: development, staging, production"
    fi
    
    log "Setting up secrets for $env environment..."
    
    local env_file="$PROJECT_ROOT/.env.$env"
    
    # Copy template if env file doesn't exist
    if [[ ! -f "$env_file" ]]; then
        if [[ -f "$PROJECT_ROOT/.env.template" ]]; then
            cp "$PROJECT_ROOT/.env.template" "$env_file"
            log "Created $env_file from template"
        else
            error "Template file not found: $PROJECT_ROOT/.env.template"
        fi
    fi
    
    # Generate secure values for production
    if [[ "$env" == "production" ]]; then
        log "Generating secure values for production..."
        
        # Generate SECRET_KEY
        local secret_key=$(generate_secret "key" 64)
        sed -i.bak "s/SECRET_KEY=.*/SECRET_KEY=$secret_key/" "$env_file"
        
        # Generate database password
        local db_password=$(generate_secret "password" 32)
        log "Generated database password (update DATABASE_URL manually): $db_password"
        
        # Generate Redis password
        local redis_password=$(generate_secret "password" 32)
        log "Generated Redis password (update REDIS_URL manually): $redis_password"
        
        # Set environment
        sed -i.bak "s/ENVIRONMENT=.*/ENVIRONMENT=production/" "$env_file"
        sed -i.bak "s/DEBUG=.*/DEBUG=false/" "$env_file"
        
        # Remove backup file
        rm -f "$env_file.bak"
        
        success "Production secrets generated in $env_file"
        warning "Please update DATABASE_URL and REDIS_URL with the generated passwords"
    fi
    
    success "Environment setup completed for $env"
}

# Rotate secrets
rotate_secrets() {
    local env_file="$1"
    
    if [[ -z "$env_file" ]]; then
        env_file="$PROJECT_ROOT/.env"
    fi
    
    if [[ ! -f "$env_file" ]]; then
        error "Environment file not found: $env_file"
    fi
    
    log "Rotating secrets in $env_file..."
    
    # Backup current file
    local backup_file="$env_file.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$env_file" "$backup_file"
    log "Backup created: $backup_file"
    
    # Generate new SECRET_KEY
    local new_secret_key=$(generate_secret "key" 64)
    sed -i.tmp "s/SECRET_KEY=.*/SECRET_KEY=$new_secret_key/" "$env_file"
    
    # Generate new encryption key for secrets
    if [[ -f "$SECRETS_KEY_FILE" ]]; then
        local old_key_backup="$SECRETS_KEY_FILE.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$SECRETS_KEY_FILE" "$old_key_backup"
        generate_key
        log "Old encryption key backed up to: $old_key_backup"
    fi
    
    # Clean up temp file
    rm -f "$env_file.tmp"
    
    success "Secrets rotated successfully"
    warning "Remember to update your deployment with the new secrets"
}

# Clean up sensitive files
cleanup() {
    log "Cleaning up sensitive files..."
    
    # Remove decrypted .env files (keep .env.template)
    find "$PROJECT_ROOT" -name ".env" -not -name ".env.template" -delete 2>/dev/null || true
    find "$PROJECT_ROOT" -name ".env.*" -not -name ".env.template" -delete 2>/dev/null || true
    
    # Remove backup files
    find "$PROJECT_ROOT" -name "*.backup.*" -delete 2>/dev/null || true
    find "$PROJECT_ROOT" -name "*.bak" -delete 2>/dev/null || true
    
    success "Cleanup completed"
}

# Show help
show_help() {
    cat << EOF
TG App FSRS Secrets Manager

Usage: $0 <command> [options]

Commands:
    generate-key                    Generate new encryption key
    encrypt [input_file]           Encrypt secrets file (default: .env)
    decrypt [output_file]          Decrypt secrets file (default: .env)
    validate [env_file]            Validate environment variables
    generate <type> [length]       Generate secure random value
    setup <environment>            Setup secrets for environment
    rotate [env_file]              Rotate secrets
    cleanup                        Clean up sensitive files
    help                          Show this help message

Secret Types (for generate command):
    key                           Base64 encoded key (default length: 32)
    password                      Alphanumeric password
    hex                          Hexadecimal string
    uuid                         UUID v4

Environments (for setup command):
    development                   Development environment
    staging                      Staging environment
    production                   Production environment

Examples:
    $0 generate-key                     # Generate encryption key
    $0 encrypt .env.production          # Encrypt production secrets
    $0 decrypt .env                     # Decrypt to .env file
    $0 validate .env.production         # Validate production secrets
    $0 generate key 64                  # Generate 64-byte key
    $0 setup production                 # Setup production environment
    $0 rotate .env.production           # Rotate production secrets
    $0 cleanup                          # Clean up sensitive files

Security Notes:
    - Never commit .env files or encryption keys to version control
    - Store encryption keys securely and separately from encrypted files
    - Regularly rotate secrets, especially after team member changes
    - Use different secrets for each environment
    - Monitor for exposed secrets in logs and error messages
EOF
}

# Main execution
main() {
    check_dependencies
    
    case "${1:-}" in
        "generate-key")
            generate_key
            ;;
        "encrypt")
            encrypt_secrets "$2"
            ;;
        "decrypt")
            decrypt_secrets "$2"
            ;;
        "validate")
            validate_secrets "$2"
            ;;
        "generate")
            if [[ -z "$2" ]]; then
                error "Secret type required. Use: key, password, hex, uuid"
            fi
            generate_secret "$2" "$3"
            ;;
        "setup")
            if [[ -z "$2" ]]; then
                error "Environment required. Use: development, staging, production"
            fi
            setup_environment "$2"
            ;;
        "rotate")
            rotate_secrets "$2"
            ;;
        "cleanup")
            cleanup
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        "")
            error "Command required. Use '$0 help' for usage information."
            ;;
        *)
            error "Unknown command: $1. Use '$0 help' for usage information."
            ;;
    esac
}

# Run main function
main "$@"