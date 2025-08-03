#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🚀 Setting up AI Coding Agent Backend...\n');

// Check if .env exists
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file from .env.example...');
  
  if (fs.existsSync(envExamplePath)) {
    let envContent = fs.readFileSync(envExamplePath, 'utf8');
    
    // Generate a secure JWT secret
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    envContent = envContent.replace('your_jwt_secret_here', jwtSecret);
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file created with secure JWT secret');
  } else {
    console.log('❌ .env.example not found. Please create .env manually.');
    process.exit(1);
  }
} else {
  console.log('✅ .env file already exists');
}

// Install dependencies
console.log('\n📦 Installing dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed');
} catch (error) {
  console.log('❌ Failed to install dependencies');
  process.exit(1);
}

// Generate Prisma client
console.log('\n🗄️  Generating Prisma client...');
try {
  execSync('npm run db:generate', { stdio: 'inherit' });
  console.log('✅ Prisma client generated');
} catch (error) {
  console.log('❌ Failed to generate Prisma client');
  process.exit(1);
}

// Create database
console.log('\n📊 Setting up database...');
try {
  execSync('npm run db:push', { stdio: 'inherit' });
  console.log('✅ Database created');
} catch (error) {
  console.log('❌ Failed to create database');
  process.exit(1);
}

// Create logs directory
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
  console.log('✅ Logs directory created');
}

console.log('\n🎉 Setup completed successfully!');
console.log('\n📋 Next steps:');
console.log('1. Edit .env file with your API keys and configuration');
console.log('   - Add your Gemini API key');
console.log('   - Configure AWS S3 credentials');
console.log('2. Run: npm run db:seed (to add demo data)');
console.log('3. Run: npm run dev (to start development server)');
console.log('\n📖 See README.md for detailed configuration instructions.');