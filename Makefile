# AI Coding Agent - Docker Management
.PHONY: help setup dev prod stop clean logs build status health shell-backend shell-frontend

# Default target
help:
	@echo "🐳 AI Coding Agent Docker Commands"
	@echo "=================================="
	@echo ""
	@echo "Setup & Start:"
	@echo "  make setup     - Full setup with environment configuration"
	@echo "  make prod      - Start production environment"
	@echo ""
	@echo "Management:"
	@echo "  make stop      - Stop all services"
	@echo "  make clean     - Stop services and remove volumes"
	@echo "  make build     - Rebuild containers"
	@echo "  make restart   - Restart all services"
	@echo ""
	@echo "Monitoring:"
	@echo "  make logs      - Follow logs from all services"
	@echo "  make status    - Show service status"
	@echo "  make health    - Check service health"
	@echo ""
	@echo "Development:"
	@echo "  make shell-backend   - Access backend container shell"
	@echo "  make shell-frontend  - Access frontend container shell"
	@echo "  make db-migrate      - Run database migrations"
	@echo "  make db-seed         - Seed database"
	@echo ""

# Setup with guided configuration
setup:
	@echo "🚀 Starting guided setup..."
	./docker-setup.sh


# Production environment
prod:
	@echo "🚀 Starting production environment..."
	docker compose up --build -d
	@echo "✅ Production environment started!"
	@echo "   Frontend: http://localhost:3000"
	@echo "   Backend:  http://localhost:5001"

# Stop services
stop:
	@echo "⏹️  Stopping services..."
	docker compose down
	docker compose -f docker-compose.dev.yml down
	@echo "✅ All services stopped"

# Clean up everything
clean:
	@echo "🧹 Cleaning up containers, networks, and volumes..."
	docker compose down -v
	docker compose -f docker-compose.dev.yml down -v
	docker volume prune -f
	@echo "✅ Cleanup complete"

# Build containers
build:
	@echo "🔨 Building containers..."
	docker compose build
	@echo "✅ Build complete"

# Restart services
restart:
	@echo "🔄 Restarting services..."
	docker compose restart
	@echo "✅ Services restarted"

# View logs
logs:
	@echo "📋 Following logs (Ctrl+C to exit)..."
	docker compose logs -f

# Show status
status:
	@echo "📊 Service Status:"
	@echo "=================="
	docker compose ps
	@echo ""
	@echo "📈 Resource Usage:"
	@echo "=================="
	docker stats --no-stream

# Health check
health:
	@echo "🏥 Checking service health..."
	@echo ""
	@echo "Backend Health:"
	@curl -f http://localhost:5001/health 2>/dev/null | jq . || echo "❌ Backend not responding"
	@echo ""
	@echo "Frontend Health:"
	@curl -f http://localhost:3000 >/dev/null 2>&1 && echo "✅ Frontend responding" || echo "❌ Frontend not responding"
	@echo ""
	@echo "Container Status:"
	@docker compose ps

# Backend shell access
shell-backend:
	@echo "🐚 Accessing backend container..."
	docker compose exec backend sh

# Frontend shell access
shell-frontend:
	@echo "🐚 Accessing frontend container..."
	docker compose exec frontend sh

# Database operations
db-migrate:
	@echo "🗃️  Running database migrations..."
	docker compose exec backend npx prisma db push

db-seed:
	@echo "🌱 Seeding database..."
	docker compose exec backend npx prisma db seed

# Quick development setup
quick-dev: 
	@if [ ! -f .env ]; then \
		echo "⚠️  .env file not found. Please run 'make setup' first."; \
		exit 1; \
	fi
	@echo "⚡ Quick development start..."
	docker compose -f docker-compose.dev.yml up -d
	@echo "✅ Development environment started!"

# Quick production setup
quick-prod:
	@if [ ! -f .env ]; then \
		echo "⚠️  .env file not found. Please run 'make setup' first."; \
		exit 1; \
	fi
	@echo "⚡ Quick production start..."
		docker compose up -d
	@echo "✅ Production environment started!"

# Environment file setup
env-setup:
	@if [ ! -f .env ]; then \
		echo "📄 Creating .env file from template..."; \
		cp docker.env.example .env; \
		echo "✅ .env file created. Please edit it with your values."; \
		echo "Required variables: GEMINI_API_KEY, JWT_SECRET, AWS_*, S3_BUCKET_NAME"; \
	else \
		echo "⚠️  .env file already exists"; \
	fi

# Show environment status
env-check:
	@echo "🔍 Environment Variables Status:"
	@echo "==============================="
	@if [ -f .env ]; then \
		echo "✅ .env file exists"; \
		grep -E "^[A-Z_]+=.+" .env | sed 's/=.*/=***/' | head -10; \
	else \
		echo "❌ .env file not found"; \
	fi

# Update containers (pull latest images and rebuild)
update:
	@echo "🔄 Updating containers..."
	docker compose pull
	docker compose up --build -d
	@echo "✅ Update complete"