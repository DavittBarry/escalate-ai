@echo off
echo Starting EscalateAI Development Environment...

if not exist .env (
    echo .env file not found. Creating from .env.example...
    copy .env.example .env
    echo Created .env file. Please update it with your API keys.
)

if not exist node_modules (
    echo Installing dependencies...
    call npm install
)

echo Starting services with Docker Compose...
docker-compose up -d redis postgres

echo Waiting for services to be ready...
timeout /t 5 /nobreak > nul

echo Starting application...
npm run dev
