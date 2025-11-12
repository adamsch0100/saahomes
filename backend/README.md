# SAA Homes Backend API

Backend API for handling form submissions, email notifications, and CRM integration.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
   - `DATABASE_URL` - PostgreSQL connection string
   - `GMAIL_USER` - Your Gmail address
   - `GMAIL_APP_PASSWORD` - Gmail app-specific password
   - `JWT_SECRET` - Secret key for JWT tokens
   - `ADMIN_EMAIL` - Admin email (adam@saahomes.com)
   - `ADMIN_PASSWORD` - Admin password

4. Run database migrations:
```bash
npm run migrate
```

5. Start development server:
```bash
npm run dev
```

## API Endpoints

### Public Endpoints

- `POST /api/contact` - Submit contact form
- `POST /api/market-report` - Submit market report request

### Admin Endpoints (Protected)

- `POST /api/admin/login` - Admin authentication
- `GET /api/admin/submissions` - List all submissions
- `GET /api/admin/submissions/:type/:id` - Get single submission
- `GET /api/admin/stats` - Dashboard statistics

## Gmail Setup

To use Gmail SMTP, you need to:
1. Enable 2-Step Verification on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the app password (not your regular password) in `GMAIL_APP_PASSWORD`

## Follow Up Boss Integration

Configure `FOLLOW_UP_BOSS_API_KEY` and/or `FOLLOW_UP_BOSS_WEBHOOK_URL` in `.env` to enable CRM integration.

## Railway Deployment

The backend is configured for Railway deployment. Set up:
1. PostgreSQL database service
2. Environment variables
3. Deploy the backend service

