# Backend Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` - PostgreSQL connection string (will be provided by Railway)
- `GMAIL_USER` - Your Gmail address (adam@saahomes.com)
- `GMAIL_APP_PASSWORD` - Gmail app-specific password (see Gmail Setup below)
- `JWT_SECRET` - Random secret string for JWT tokens
- `ADMIN_EMAIL` - adam@saahomes.com
- `ADMIN_PASSWORD` - Your admin password (Vitzer0100!)

Optional (for Follow Up Boss integration):
- `FOLLOW_UP_BOSS_API_KEY` - Follow Up Boss API key
- `FOLLOW_UP_BOSS_WEBHOOK_URL` - Follow Up Boss webhook URL

### 3. Gmail App Password Setup

1. Go to your Google Account settings
2. Enable 2-Step Verification if not already enabled
3. Go to: https://myaccount.google.com/apppasswords
4. Generate an app password for "Mail"
5. Use this 16-character password (without spaces) as `GMAIL_APP_PASSWORD`

### 4. Run Database Migrations

```bash
npm run migrate
```

This will create the necessary tables in your PostgreSQL database.

### 5. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Testing the API

### Health Check
```bash
curl http://localhost:3000/health
```

### Submit Contact Form
```bash
curl -X POST http://localhost:3000/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "123-456-7890",
    "interest": "buying",
    "message": "Test message"
  }'
```

### Submit Market Report Request
```bash
curl -X POST http://localhost:3000/api/market-report \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "phone": "123-456-7890",
    "area": "Fort Collins"
  }'
```

### Admin Login
```bash
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "adam@saahomes.com",
    "password": "Vitzer0100!"
  }'
```

## Frontend Configuration

Add to your frontend `.env` file (or `.env.local`):

```
VITE_API_URL=http://localhost:3000
```

For production, set this to your Railway backend URL.

## Railway Deployment

1. Create a new Railway project
2. Add PostgreSQL database service
3. Add Node.js service and connect your backend folder
4. Set environment variables in Railway dashboard
5. Deploy!

The backend will automatically use the `DATABASE_URL` from Railway's PostgreSQL service.

