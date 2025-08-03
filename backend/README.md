# AI Coding Agent Backend

A Claude-style AI Coding Agent backend built with Node.js, Express, Prisma, and Google Gemini 2.5 API. This backend provides streaming chat responses, code artifact management with S3 storage, and React code compilation with live preview capabilities.

## 🚀 Features

- **Streaming AI Chat**: Real-time streaming responses using Google Gemini 2.5 API
- **Code Artifact Management**: Automatic code detection, S3 storage, and artifact management
- **Single-File Focus**: Optimized for single-file code processing and consolidation
- **React Code Compilation**: Built-in esbuild integration for React/TypeScript compilation and preview
- **Code Building**: Build single-file React/TypeScript code with esbuild integration
- **Conversation Memory**: LangChain-powered conversation memory management
- **Authentication**: JWT-based user authentication with secure password hashing
- **Database Management**: Prisma ORM with SQLite (easily configurable to other databases)
- **S3 Integration**: AWS S3 for scalable code artifact storage
- **Live Preview**: Generate HTML previews for React components and JavaScript code
- **Export Functionality**: Export conversations in JSON or Markdown format

## 🛠️ Tech Stack

- **Backend Framework**: Express.js with TypeScript
- **Database**: Prisma ORM with SQLite
- **AI Integration**: Google Gemini 2.5 API
- **Memory Management**: LangChain
- **File Storage**: AWS S3
- **Code Compilation**: esbuild
- **Authentication**: JWT with bcryptjs
- **Logging**: Winston
- **Validation**: Zod
- **Development**: tsx for hot reloading

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Google Gemini API key (free tier available)
- AWS S3 bucket and credentials

## 🚧 Setup Instructions

### 1. Clone and Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL="file:./dev.db"

# Google Gemini API
GEMINI_API_KEY="your_gemini_api_key_here"

# JWT Secret (generate a secure 32+ character string)
JWT_SECRET="your_secure_jwt_secret_here"

# Server Configuration
PORT=3001
NODE_ENV="development"

# CORS Origins (comma-separated)
CORS_ORIGINS="http://localhost:3000,http://localhost:5173"

# AWS S3 Configuration
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your_aws_access_key_id"
AWS_SECRET_ACCESS_KEY="your_aws_secret_access_key"
S3_BUCKET_NAME="your_s3_bucket_name"
S3_CODE_PREFIX="code-artifacts/"
```

### 3. Database Setup

Generate Prisma client and create the database:

```bash
npm run db:generate
npm run db:push
```

Seed the database with demo data:

```bash
npm run db:seed
```

### 4. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3001` (or your configured PORT).

## 🏗️ Production Setup

### 1. Build the Application

```bash
npm run build
```

### 2. Run Type Checking

```bash
npm run type-check
```

### 3. Start Production Server

```bash
npm start
```

### 4. Database Migration (Production)

```bash
npm run db:migrate
```

## 📚 API Documentation

### Authentication Endpoints

#### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "password123"
}
```

#### POST /api/auth/login
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### GET /api/auth/me
Get current user profile (requires authentication).

### Chat Endpoints

#### POST /api/chat/send
Send a message to the AI and receive streaming response.

**Request Body:**
```json
{
  "message": "Create a React button component",
  "conversationId": "optional-conversation-id",
  "stream": true
}
```

**Response (Streaming):**
Server-Sent Events with chunks of AI response and final completion data.

### Conversation Endpoints

#### GET /api/conversations
Get user's conversations with pagination.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 50)
- `search`: Search term (optional)

#### GET /api/conversations/:id
Get specific conversation with all messages and artifacts.

#### PUT /api/conversations/:id
Update conversation title.

#### DELETE /api/conversations/:id
Delete conversation and all associated data.

#### GET /api/conversations/:id/export
Export conversation in JSON or Markdown format.

**Query Parameters:**
- `format`: 'json' or 'markdown' (default: 'json')

### Artifact Endpoints

#### GET /api/artifacts/:id
Get artifact metadata and refreshed S3 URL.

#### GET /api/artifacts/:id/code
Get the actual code content from S3.

#### GET /api/artifacts/:id/download
Download the code file.

#### POST /api/artifacts/:id/build
Build/compile React or JavaScript code.

#### GET /api/artifacts/:id/preview
Get HTML preview of the code (for iframe embedding).

#### GET /api/artifacts/:id/project
Get project structure and files (for project artifacts).

#### POST /api/artifacts/:id/build-project
Build multi-file project structure.

#### GET /api/artifacts/:id/project-preview
Get HTML preview of built project (for iframe embedding).

#### DELETE /api/artifacts/:id
Delete artifact and associated S3 files.

## 🗄️ Database Schema

### Users
- `id`: UUID primary key
- `email`: Unique email address
- `username`: Unique username
- `passwordHash`: Bcrypt hashed password
- `createdAt`, `updatedAt`: Timestamps

### Conversations
- `id`: UUID primary key
- `title`: Conversation title
- `userId`: Foreign key to Users
- `createdAt`, `updatedAt`: Timestamps

### Messages
- `id`: UUID primary key
- `conversationId`: Foreign key to Conversations
- `role`: USER | ASSISTANT | SYSTEM
- `content`: Message content
- `createdAt`: Timestamp

### CodeArtifacts
- `id`: UUID primary key
- `messageId`: Foreign key to Messages
- `title`: Artifact title
- `language`: Programming language
- `type`: CODE | HTML | REACT | JAVASCRIPT | PYTHON | OTHER
- `s3Key`: S3 object key
- `s3Url`: S3 presigned URL
- `fileSize`: File size in bytes
- `createdAt`, `updatedAt`: Timestamps

## 🏗️ Single-File Processing

The backend is optimized for single-file code processing with intelligent consolidation features:

### Code Consolidation
- **Multi-Block Detection**: Automatically detects and combines multiple code blocks from AI responses
- **Language-Specific Merging**: Smart consolidation for JavaScript/TypeScript, Python, HTML/CSS/JS
- **Import Organization**: Automatically organizes imports and dependencies
- **Structure Optimization**: Creates well-organized single files with clear sections

### Build System
- **Direct Compilation**: Immediate esbuild compilation for supported languages
- **Error Resolution**: Intelligent error detection and resolution
- **Preview Generation**: Automatic HTML preview generation for React and web code
- **Optimization**: Code minification and bundling options

### Storage Architecture
- **Single File Storage**: Each artifact stored as one optimized file in S3
- **Built Artifacts**: Compiled bundles cached for performance
- **Presigned URLs**: Secure, time-limited access to files
- **Smart Caching**: Intelligent caching with deduplication

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | Database connection string | Yes | - |
| `GEMINI_API_KEY` | Google Gemini API key | Yes | - |
| `JWT_SECRET` | Secret for JWT token signing | Yes | - |
| `PORT` | Server port | No | 3001 |
| `NODE_ENV` | Environment mode | No | development |
| `CORS_ORIGINS` | Allowed CORS origins | No | http://localhost:3000 |
| `AWS_REGION` | AWS region | Yes | - |
| `AWS_ACCESS_KEY_ID` | AWS access key | Yes | - |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Yes | - |
| `S3_BUCKET_NAME` | S3 bucket name | Yes | - |
| `S3_CODE_PREFIX` | S3 object key prefix | No | code-artifacts/ |

### Gemini API Configuration

The application uses Google Gemini 2.5 Flash Experimental model with the following configuration:
- Temperature: 0.7
- Top K: 40
- Top P: 0.95
- Max Output Tokens: 8192

### S3 Configuration

Code artifacts are stored in S3 with:
- Presigned URLs with 1-hour expiration
- Automatic file type detection
- Built code caching for React components
- Automatic cleanup on deletion

## 📁 Project Structure

```
backend/
├── src/
│   ├── middleware/          # Express middleware
│   │   └── auth.ts         # Authentication middleware
│   ├── routes/             # API route handlers
│   │   ├── auth.ts         # Authentication routes
│   │   ├── chat.ts         # Chat and messaging routes
│   │   ├── conversations.ts # Conversation management
│   │   └── artifacts.ts    # Code artifact routes
│   ├── services/           # Business logic services
│   │   ├── gemini.ts       # Gemini AI integration
│   │   ├── memory.ts       # LangChain memory management
│   │   ├── s3.ts          # AWS S3 service
│   │   └── esbuild.ts     # Code compilation service
│   ├── utils/              # Utility functions
│   │   ├── auth.ts         # Authentication utilities
│   │   ├── env.ts          # Environment validation
│   │   └── logger.ts       # Logging configuration
│   ├── seed.ts             # Database seeding script
│   └── server.ts           # Main server file
├── prisma/
│   └── schema.prisma       # Database schema
├── logs/                   # Application logs
├── package.json
├── tsconfig.json
└── README.md
```

## 🧪 Testing

### Demo Users

After running the seed script, you can use these demo accounts:

- **Email**: demo@example.com, **Password**: demo123
- **Email**: test@example.com, **Password**: test123

### API Testing

You can test the API using tools like:
- Postman
- curl
- Thunder Client (VS Code extension)

Example curl request:
```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"demo123"}'

# Send chat message (replace TOKEN with JWT from login)
curl -X POST http://localhost:3001/api/chat/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"message":"Create a React button component","stream":false}'
```

## 🚨 Error Handling

The application includes comprehensive error handling:

- **Validation Errors**: Zod schema validation with detailed error messages
- **Authentication Errors**: JWT token validation and user verification
- **Database Errors**: Prisma error handling with user-friendly messages
- **AI Service Errors**: Gemini API error handling with fallbacks
- **S3 Errors**: AWS S3 error handling with retry logic
- **Build Errors**: esbuild compilation error reporting

## 📊 Logging

Winston logger configuration:
- **Development**: Console output with colors and timestamps
- **Production**: File-based logging with rotation
- **Log Levels**: Error, warn, info, debug
- **Log Files**: `logs/error.log`, `logs/combined.log`

## 🔒 Security Features

- **Password Hashing**: bcryptjs with salt rounds of 12
- **JWT Tokens**: Secure token generation with expiration
- **Input Validation**: Zod schema validation on all inputs
- **CORS Configuration**: Configurable allowed origins
- **Helmet**: Security headers middleware
- **Rate Limiting**: Can be added for production use
- **S3 Security**: Presigned URLs with expiration

## 🚀 Deployment

### Environment Setup

1. Set `NODE_ENV=production`
2. Use a production database (PostgreSQL recommended)
3. Configure proper JWT secrets
4. Set up AWS S3 bucket with proper permissions
5. Configure CORS origins for your frontend domain

### Recommended Hosting

- **Backend**: Railway, Render, or AWS ECS
- **Database**: Railway PostgreSQL, AWS RDS, or PlanetScale
- **Storage**: AWS S3 or compatible service

### Database Migration

For production deployment, use migrations instead of db:push:

```bash
npm run db:migrate
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check DATABASE_URL format
   - Ensure database file permissions (for SQLite)

2. **Gemini API Errors**
   - Verify API key is correct
   - Check API quota limits
   - Ensure internet connectivity

3. **S3 Connection Issues**
   - Verify AWS credentials
   - Check bucket permissions
   - Ensure bucket exists in specified region

4. **Build Failures**
   - Check esbuild dependencies
   - Verify TypeScript/React code syntax
   - Review compilation error logs

### Getting Help

- Check the logs in `logs/` directory
- Review error messages in API responses
- Ensure all environment variables are set correctly
- Verify database schema is up to date with `npm run db:generate`

---

Built with ❤️ using Node.js, Express, Prisma, and Google Gemini 2.5 API.

## 🚀 **Performance Improvements & Optimizations**

### Database Optimizations
- **Strategic Indexing**: Added indexes on frequently queried fields (`userId`, `createdAt`, `language`, etc.)
- **Query Optimization**: Optimized conversation and message retrieval patterns
- **Connection Management**: Environment-specific database configurations

### Enhanced Configuration Management
- **Type-Safe Config**: Centralized configuration with Zod validation
- **Environment Separation**: Development, production, and test-specific settings
- **Security**: Validates JWT secrets, API keys, and other sensitive data

### Performance Monitoring
- **Real-time Metrics**: Track request times, error rates, memory usage
- **Health Checks**: `/health` endpoint for monitoring system status
- **Alerting**: Automatic detection of performance issues and high error rates

### Enhanced Error Handling
- **Structured Errors**: Custom error classes with proper HTTP status codes
- **Error Recovery**: Graceful error handling and retry mechanisms
- **Security**: Sanitized error responses to prevent information leakage

## 📈 **Scaling Recommendations**

### 1. **Database Scaling**
```bash
# For production, consider PostgreSQL
npm install pg @types/pg
```
- Replace SQLite with PostgreSQL for better concurrency
- Add connection pooling with PgBouncer
- Consider read replicas for heavy read workloads

### 2. **Caching Layer**
```bash
# Add Redis for caching
npm install redis @types/redis
```
- Cache frequent database queries
- Store session data in Redis
- Cache build results and AI responses

### 3. **Queue System**
```bash
# Add Bull for background jobs
npm install bull @types/bull
```
- Move build operations to background queues
- Process S3 uploads asynchronously
- Handle email notifications and exports

### 4. **Load Balancing**
- Use nginx for reverse proxy
- Implement horizontal scaling with PM2 cluster mode
- Session management across multiple instances

## 🔒 **Security Enhancements**

### Already Implemented
- ✅ JWT authentication with secure token handling
- ✅ Rate limiting on API endpoints
- ✅ Input validation with Zod schemas
- ✅ CORS configuration
- ✅ Helmet for security headers

### Recommended Additions
- **CSRF Protection**: Add `csurf` middleware
- **API Key Management**: For external service integrations
- **Input Sanitization**: Sanitize code execution for security
- **Audit Logging**: Track all user actions and code executions

## ⚡ **Performance Optimization Checklist**

### Backend Optimizations
- [x] Database indexing and query optimization
- [x] Centralized configuration management
- [x] Performance monitoring and metrics
- [x] Enhanced error handling and recovery
- [ ] Redis caching layer
- [ ] Background job processing
- [ ] Database migration to PostgreSQL
- [ ] API response compression

### Code Quality
- [x] TypeScript with strict configuration
- [x] Structured error handling
- [x] Comprehensive logging
- [ ] Unit and integration tests
- [ ] API documentation with Swagger
- [ ] Code coverage reporting

### Infrastructure
- [ ] Docker containerization
- [ ] CI/CD pipeline setup
- [ ] Production monitoring (APM)
- [ ] Automated backups
- [ ] CDN for static assets

## 🛠️ **Development Workflow Improvements**

### Testing Strategy
```bash
# Add testing dependencies
npm install --save-dev jest @types/jest supertest @types/supertest
npm install --save-dev ts-jest jest-environment-node
```

### API Documentation
```bash
# Add Swagger documentation
npm install swagger-jsdoc swagger-ui-express @types/swagger-jsdoc @types/swagger-ui-express
```

### Code Quality Tools
```bash
# Add ESLint and Prettier
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install --save-dev prettier eslint-config-prettier eslint-plugin-prettier
```