# 🐳 Docker Setup for AI Coding Agent

This guide helps you containerize and run the entire AI Coding Agent application using Docker Compose.

## 📋 Prerequisites

- **Docker**: Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- **Git**: To clone the repository
- **API Keys**: Gemini API key and AWS credentials

## 🚀 Quick Start

### 1. **Setup Environment Variables**

```bash
# Copy the environment template
cp docker.env.example .env

# Edit the .env file with your actual values
nano .env  # or use your preferred editor
```

### 2. **Required Environment Variables**

Fill in these **required** values in your `.env` file:

```env
# Google Gemini API Key
GEMINI_API_KEY=your_actual_gemini_api_key

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your_secure_random_jwt_secret

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
S3_BUCKET_NAME=your_s3_bucket_name
```

### 3. **Start the Application**

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f frontend
docker-compose logs -f backend
```

### 4. **Access the Application**

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5001
- **Health Check**: http://localhost:5001/health

## 🛠️ Available Commands

### Basic Operations

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart services
docker-compose restart

# View status
docker-compose ps

# View logs
docker-compose logs -f
```

### Development & Debugging

```bash
# Rebuild containers (after code changes)
docker-compose up --build -d

# Access container shell
docker-compose exec backend sh
docker-compose exec frontend sh

# View service-specific logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Remove all containers and volumes
docker-compose down -v
```

### Database Operations

```bash
# Access backend container to run Prisma commands
docker-compose exec backend sh

# Inside container:
npx prisma generate
npx prisma db push
npx prisma db seed
```

## 📁 Docker Configuration

### Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │
│   (Next.js)     │◄──►│   (Node.js)     │
│   Port: 3000    │    │   Port: 5001    │
└─────────────────┘    └─────────────────┘
                              │
                       ┌─────────────────┐
                       │   SQLite DB     │
                       │   (File-based)  │
                       └─────────────────┘
```

### Volumes

- **`backend_data`**: SQLite database files
- **`backend_sandbox`**: Code bundling sandbox
- **`backend_exports`**: HTML exports
- **`backend_temp`**: Temporary project files
- **`backend_logs`**: Application logs

### Networks

- **`app-network`**: Bridge network for service communication

## 🔧 Configuration Details

### Frontend Configuration

- **Framework**: Next.js with standalone output
- **Port**: 3000
- **API URL**: Configured via `NEXT_PUBLIC_API_URL`
- **Health Check**: HTTP GET to `/`

### Backend Configuration

- **Framework**: Node.js/Express with TypeScript
- **Port**: 5001
- **Database**: SQLite (file-based)
- **Health Check**: HTTP GET to `/health`
- **Dependencies**: Prisma, AWS SDK, esbuild

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `GEMINI_API_KEY` | Google Gemini API key | ✅ | - |
| `JWT_SECRET` | JWT signing secret | ✅ | - |
| `AWS_REGION` | AWS region | ✅ | - |
| `AWS_ACCESS_KEY_ID` | AWS access key | ✅ | - |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | ✅ | - |
| `S3_BUCKET_NAME` | S3 bucket name | ✅ | - |
| `S3_CODE_PREFIX` | S3 key prefix | ❌ | `code-artifacts` |
| `S3_PRESIGNED_URL_EXPIRES` | URL expiry (seconds) | ❌ | `3600` |
| `CACHE_TTL` | Cache TTL (seconds) | ❌ | `300` |

## 🔍 Troubleshooting

### Common Issues

#### **Services Won't Start**

```bash
# Check logs
docker-compose logs

# Check if ports are in use
lsof -i :3000
lsof -i :5001

# Clean up and restart
docker-compose down -v
docker-compose up --build -d
```

#### **Environment Variables Not Loading**

```bash
# Verify .env file exists and has correct values
cat .env

# Restart with fresh environment
docker-compose down
docker-compose up -d
```

#### **Database Issues**

```bash
# Access backend container
docker-compose exec backend sh

# Reset database
npx prisma db push --force-reset
npx prisma db seed
```

#### **Permission Issues**

```bash
# Fix volume permissions (Linux/macOS)
sudo chown -R $(id -u):$(id -g) backend/

# Reset volumes
docker-compose down -v
docker volume prune
docker-compose up -d
```

### Health Checks

```bash
# Check backend health
curl http://localhost:5001/health

# Check frontend
curl http://localhost:3000

# View container health status
docker-compose ps
```

### Performance Monitoring

```bash
# Monitor resource usage
docker stats

# View container details
docker inspect ai-coding-agent-backend
docker inspect ai-coding-agent-frontend
```

## 🔄 Updates & Maintenance

### Updating Code

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose up --build -d
```

### Database Migrations

```bash
# After schema changes
docker-compose exec backend npx prisma db push
```

### Backup Data

```bash
# Backup database
docker-compose exec backend cp /app/dev.db /app/data/backup.db

# Export volume
docker run --rm -v ai-coding-agent_backend_data:/data -v $(pwd):/backup alpine tar czf /backup/data-backup.tar.gz -C /data .
```

## 📊 Production Considerations

### Security

- Use Docker secrets for sensitive variables
- Run containers as non-root users (already configured)
- Use reverse proxy (nginx) for SSL termination
- Implement proper firewall rules

### Scaling

```yaml
# docker-compose.override.yml for scaling
version: '3.8'
services:
  backend:
    deploy:
      replicas: 3
```

### Monitoring

- Add monitoring containers (Prometheus, Grafana)
- Implement log aggregation (ELK stack)
- Set up health check alerts

## 🆘 Support

If you encounter issues:

1. **Check logs**: `docker-compose logs -f`
2. **Verify environment**: Ensure all required variables are set
3. **Clean restart**: `docker-compose down -v && docker-compose up --build -d`
4. **Check documentation**: Review API endpoints and configuration

---

## 📝 Quick Reference

```bash
# Complete setup from scratch
cp docker.env.example .env
# Edit .env with your values
docker-compose up --build -d
docker-compose logs -f

# Stop everything
docker-compose down

# Nuclear option (complete cleanup)
docker-compose down -v
docker volume prune
docker-compose up --build -d
```

Your AI Coding Agent should now be running in Docker! 🎉