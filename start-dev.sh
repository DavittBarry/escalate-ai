#!/bin/bash

echo "🚀 Starting EscalateAI Development Environment..."

if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file. Please update it with your API keys."
fi

if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🔧 Starting services with Docker Compose..."
docker-compose up -d redis postgres

echo "⏳ Waiting for services to be ready..."
sleep 5

echo "🎯 Starting application..."
npm run dev
