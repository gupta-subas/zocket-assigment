#!/bin/bash

# AI Coding Agent - Docker Setup Script
set -e

echo "🐳 AI Coding Agent Docker Setup"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    print_status "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker Desktop first."
        echo "Visit: https://www.docker.com/products/docker-desktop/"
        exit 1
    fi
    
    if ! command -v docker compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose."
        exit 1
    fi
    
    print_success "Docker and Docker Compose are installed"
}

# Setup environment file
setup_env() {
    print_status "Setting up environment file..."
    
    if [ -f ".env" ]; then
        print_warning ".env file already exists. Backing up to .env.backup"
        cp .env .env.backup
    fi
    
    if [ -f "docker.env.example" ]; then
        cp docker.env.example .env
        print_success "Created .env file from template"
    else
        print_error "docker.env.example not found!"
        exit 1
    fi
    
    print_warning "Please edit .env file with your actual API keys and credentials:"
    echo "  - GEMINI_API_KEY"
    echo "  - JWT_SECRET"
    echo "  - AWS credentials"
    echo "  - S3_BUCKET_NAME"
    echo ""
    read -p "Press Enter after you've updated the .env file..."
}

# Validate environment variables
validate_env() {
    print_status "Validating environment variables..."
    
    source .env
    
    missing_vars=()
    
    [ -z "$GEMINI_API_KEY" ] && missing_vars+=("GEMINI_API_KEY")
    [ -z "$JWT_SECRET" ] && missing_vars+=("JWT_SECRET")
    [ -z "$AWS_REGION" ] && missing_vars+=("AWS_REGION")
    [ -z "$AWS_ACCESS_KEY_ID" ] && missing_vars+=("AWS_ACCESS_KEY_ID")
    [ -z "$AWS_SECRET_ACCESS_KEY" ] && missing_vars+=("AWS_SECRET_ACCESS_KEY")
    [ -z "$S3_BUCKET_NAME" ] && missing_vars+=("S3_BUCKET_NAME")
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        print_warning "Please update your .env file and run this script again."
        exit 1
    fi
    
    print_success "All required environment variables are set"
}

# Build and start services
start_services() {
    print_status "Building and starting Docker containers..."
    
    echo "This may take a few minutes on first run..."
    
    if docker compose up --build -d; then
        print_success "Services started successfully!"
    else
        print_error "Failed to start services. Check logs with: docker compose logs"
        exit 1
    fi
}

# Check service health
check_health() {
    print_status "Checking service health..."
    
    # Wait for services to start
    sleep 10
    
    # Check backend health
    for i in {1..30}; do
        if curl -f http://localhost:5001/health &> /dev/null; then
            print_success "Backend is healthy"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Backend health check failed"
            echo "Check logs with: docker compose logs backend"
            exit 1
        fi
        sleep 2
    done
    
    # Check frontend
    for i in {1..30}; do
        if curl -f http://localhost:3000 &> /dev/null; then
            print_success "Frontend is healthy"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Frontend health check failed"
            echo "Check logs with: docker compose logs frontend"
            exit 1
        fi
        sleep 2
    done
}

# Show final information
show_info() {
    echo ""
    echo "🎉 Setup Complete!"
    echo "=================="
    echo ""
    echo "Your AI Coding Agent is now running:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend:  http://localhost:5001"
    echo "  Health:   http://localhost:5001/health"
    echo ""
    echo "Useful commands:"
    echo "  docker compose logs -f          # View logs"
    echo "  docker compose ps               # View status"
    echo "  docker compose stop             # Stop services"
    echo "  docker compose down             # Stop and remove"
    echo ""
    echo "For more information, see DOCKER_README.md"
}

# Main execution
main() {
    check_docker
    setup_env
    validate_env
    start_services
    check_health
    show_info
}

# Handle script arguments
case "${1:-}" in
    "dev")
        print_status "Starting in development mode..."
        docker compose -f docker-compose.dev.yml up --build -d
        print_success "Development environment started!"
        echo "Frontend: http://localhost:3000 (with hot reload)"
        echo "Backend:  http://localhost:5001 (with hot reload)"
        ;;
    "stop")
        print_status "Stopping services..."
        docker compose down
        print_success "Services stopped"
        ;;
    "clean")
        print_status "Cleaning up containers and volumes..."
        docker compose down -v
        docker volume prune -f
        print_success "Cleanup complete"
        ;;
    "logs")
        docker compose logs -f
        ;;
    *)
        main
        ;;
esac