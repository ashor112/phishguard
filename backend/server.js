import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { limiter } from './src/middleware/rateLimiter.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { requestLogger } from './src/middleware/requestLogger.js';
import { writeLock, removeLock, logPath, lockPath } from './src/utils/activityLog.js';
import analyzeRouter from './src/routes/analyze.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', true);

const PORT = process.env.PORT || 4000;
const FRONTEND_DIST = path.resolve(__dirname, '../frontend/dist');

// CORS only needed when frontend is on a different origin (dev mode with Vite)
if (process.env.NODE_ENV !== 'production') {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  app.use(cors({
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  }));
}

app.use(express.json({ limit: '10kb' }));
app.use(requestLogger);
app.use(limiter);

// API routes
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', analyzeRouter);

// Serve the built React app for everything else
app.use(express.static(FRONTEND_DIST));
app.get('*', (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
});

app.use(errorHandler);

app.listen(PORT, () => {
  writeLock(PORT);
  console.log(`PhishGuard running on http://localhost:${PORT}`);
  console.log(`Serving frontend from: ${FRONTEND_DIST}`);
  console.log(`Activity log: ${logPath()}`);
  console.log(`Lock file:    ${lockPath()}`);
});

process.on('SIGINT',  () => { removeLock(); process.exit(0); });
process.on('SIGTERM', () => { removeLock(); process.exit(0); });
