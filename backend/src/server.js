import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import apiRoutes from './routes/api.js';
import adminRoutes from './routes/admin.js';
import { runMigrations } from './config/migrate.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const distPath = join(__dirname, '../../dist');

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      'https://saahomes.com',
      'https://www.saahomes.com',
      process.env.FRONTEND_URL,
      process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null,
    ].filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'saahomes-api',
  });
});

app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);

if (process.env.NODE_ENV === 'production' && existsSync(distPath)) {
  app.use(express.static(distPath, { index: false }));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();

    const normalized = req.path.replace(/\/$/, '') || '/';
    const prerenderedPath = normalized === '/'
      ? join(distPath, 'index.html')
      : join(distPath, normalized.slice(1), 'index.html');

    if (existsSync(prerenderedPath)) {
      return res.sendFile(prerenderedPath);
    }

    return res.sendFile(join(distPath, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const startServer = async () => {
  app.listen(PORT, HOST, () => {
    console.log(`Server running on ${HOST}:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    if (existsSync(distPath)) {
      console.log('Serving frontend from dist/');
    }
  });

  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL not set — API forms will not persist submissions');
    return;
  }

  try {
    await runMigrations();
  } catch (error) {
    console.error('Migration error on startup (API will still run):', error.message);
  }
};

startServer();

export default app;
