import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.resolve(__dirname, '../../logs');
const LOG_FILE = path.join(LOGS_DIR, 'activity.log');
const LOCK_FILE = path.join(LOGS_DIR, 'server.lock');

// Rotate when log exceeds 10 MB
const MAX_LOG_BYTES = 10 * 1024 * 1024;

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function rotateIfNeeded() {
  try {
    const stat = fs.statSync(LOG_FILE);
    if (stat.size > MAX_LOG_BYTES) {
      const bak = LOG_FILE.replace('.log', `.${Date.now()}.bak`);
      fs.renameSync(LOG_FILE, bak);
    }
  } catch {
    // File doesn't exist yet — nothing to rotate
  }
}

function writeEntry(entry) {
  ensureLogsDir();
  rotateIfNeeded();
  const line = JSON.stringify({ ...entry, ts: new Date().toISOString() }) + '\n';
  fs.appendFileSync(LOG_FILE, line, 'utf8');
}

// ── Public API ────────────────────────────────────────────────────────────────

export function writeLock(port) {
  ensureLogsDir();
  const payload = {
    pid: process.pid,
    port,
    startedAt: new Date().toISOString(),
    node: process.version,
  };
  fs.writeFileSync(LOCK_FILE, JSON.stringify(payload, null, 2), 'utf8');
  writeEntry({ type: 'SERVER_START', ...payload });
}

export function removeLock() {
  try {
    fs.unlinkSync(LOCK_FILE);
    writeEntry({ type: 'SERVER_STOP', pid: process.pid });
  } catch {
    // Already removed — ignore
  }
}

export function logRequest({ method, path, statusCode, durationMs, ip }) {
  writeEntry({ type: 'REQUEST', method, path, statusCode, durationMs, ip });
}

export function logAnalysis({ url, score, verdict, flags, durationMs, ip, unavailableChecks }) {
  writeEntry({ type: 'ANALYSIS', url, score, verdict, flags, durationMs, ip, unavailableChecks });
}

export function logError({ message, code, stack, method, path, ip }) {
  writeEntry({ type: 'ERROR', message, code, stack, method, path, ip });
}

export function logPath() { return LOG_FILE; }
export function lockPath() { return LOCK_FILE; }
