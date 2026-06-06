/**
 * Request logger + error handler middleware.
 * Logs method, path, status, duration for every request.
 */
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOG_DIR = join(__dirname, '..', 'logs');
const LOG_FILE = join(LOG_DIR, 'app.log');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function writeLog(level, msg, data) {
  const ts = new Date().toISOString();
  const entry = JSON.stringify({ ts, level, msg, ...(data || {}) }) + '\n';
  // Write to file (best-effort)
  try { fs.appendFileSync(LOG_FILE, entry); } catch {}
  // Also write to console with color
  const colors = { INFO: '\x1b[36m', WARN: '\x1b[33m', ERROR: '\x1b[31m', RESET: '\x1b[0m' };
  const c = colors[level] || '';
  console.log(`${c}[${ts}] [${level}] ${msg}${colors.RESET}`);
}

export function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, url } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'WARN' : 'INFO';
    writeLog(level, `${method} ${url} → ${res.statusCode}`, { duration: `${duration}ms` });
  });

  next();
}

export function errorHandler(err, req, res, next) {
  writeLog('ERROR', err.message, {
    stack: err.stack,
    method: req.method,
    url: req.url,
  });
  res.status(err.status || 500).json({
    error: true,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}

export function notFound(req, res) {
  writeLog('WARN', `404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ error: true, message: 'Not found' });
}
