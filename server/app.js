import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import Database from 'better-sqlite3';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { portfolioSchema, messageSchema } from './validation.js';
import { createMailEngine, safeMailError } from './mail.js';
import { publicProject } from '../shared/projects.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COOKIE = 'hazem_studio';
const hash = value => createHash('sha256').update(value).digest('hex');
export function passwordHash(password) {
  const salt = randomBytes(24).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
export function passwordMatches(password, stored) {
  try {
    const [salt, digest] = stored.split(':');
    const a = Buffer.from(digest, 'hex');
    const b = scryptSync(password, salt, 64);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}
export function createApp(options = {}) {
  const dataDir = path.resolve(options.dataDir || process.env.DATA_DIR || path.join(ROOT, 'data'));
  const accessFile = options.accessFile || path.join(ROOT, 'private', 'ADMIN_ACCESS.md');
  fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true, mode: 0o700 });
  const db = new Database(path.join(dataDir, 'portfolio.sqlite'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS portfolio (id INTEGER PRIMARY KEY CHECK(id = 1), content TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY CHECK(id = 1), password_hash TEXT NOT NULL, must_change INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, opportunity TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0);
  `);
  fs.chmodSync(path.join(dataDir, 'portfolio.sqlite'), 0o600);
  if (!db.prepare('SELECT id FROM portfolio WHERE id=1').get()) {
    const seed = portfolioSchema.parse(JSON.parse(fs.readFileSync(path.join(ROOT, 'server', 'seed.json'), 'utf8')));
    db.prepare('INSERT INTO portfolio(id,content,version,updated_at) VALUES(1,?,1,?)').run(JSON.stringify(seed), new Date().toISOString());
  }
  if (!db.prepare('SELECT id FROM admin WHERE id=1').get()) {
    const password = options.initialPassword || process.env.ADMIN_PASSWORD || randomBytes(24).toString('base64url');
    if (password.length < 14) throw new Error('ADMIN_PASSWORD must be at least 14 characters.');
    db.prepare('INSERT INTO admin(id,password_hash,must_change) VALUES(1,?,1)').run(passwordHash(password));
    if (!options.initialPassword && !process.env.ADMIN_PASSWORD) {
      fs.mkdirSync(path.dirname(accessFile), { recursive: true, mode: 0o700 });
      fs.writeFileSync(accessFile, `# Private portfolio studio access\n\nOpen the running portfolio and append **/admin** to its address.\n\n- Username: **hazem**\n- Temporary password: \`${password}\`\n\nChange this password in **Settings → Security** after signing in. This file is not served by the website and is excluded from the source archive. Do not upload it to a repository.\n\nIf a browser blocks cookies inside the embedded preview, open the preview in a new tab.\n\nThe GitHub token previously shared in chat was never used and is not stored in this project. Revoke it in GitHub settings.\n`, { mode: 0o600 });
    }
  }
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({
    frameguard: false,
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"], imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
      connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: null, upgradeInsecureRequests: null
    }}
  }));
  app.use(express.json({ limit: '800kb' }));
  app.use(cookieParser());
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (origin) {
      let host;
      try { host = new URL(origin).host; } catch { return res.status(403).json({ error: 'Invalid request origin.' }); }
      const hosts = [req.get('host'), req.get('x-forwarded-host')?.split(',')[0].trim()].filter(Boolean);
      if (!hosts.includes(host)) return res.status(403).json({ error: 'Cross-site requests are not allowed.' });
    }
    next();
  });
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false, skipSuccessfulRequests: true, message: { error: 'Too many attempts. Try again in 15 minutes.' } });
  const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many messages. Please email me directly or try again later.' } });
  function cookieOptions(req) {
    const secure = req.secure;
    const preview = secure && /\.e2b\.app(?::\d+)?$/.test(req.get('x-forwarded-host') || req.get('host') || '');
    return { httpOnly: true, secure, sameSite: preview ? 'none' : 'lax', ...(preview ? { partitioned: true } : {}), path: '/', maxAge: 8 * 60 * 60 * 1000 };
  }
  function auth(req, res, next) {
    const token = req.cookies[COOKIE];
    if (typeof token !== 'string' || token.length > 200) return res.status(401).json({ error: 'Please sign in to your studio.' });
    const session = db.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires>?').get(hash(token), Date.now());
    if (!session) return res.status(401).json({ error: 'Your session expired. Please sign in again.' });
    req.session = session;
    if (!['GET', 'HEAD'].includes(req.method)) {
      const csrf = req.get('x-csrf-token') || '';
      const a = Buffer.from(csrf); const b = Buffer.from(session.csrf);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return res.status(403).json({ error: 'Security check failed. Refresh the page and try again.' });
    }
    next();
  }
  const readContent = () => {
    const row = db.prepare('SELECT * FROM portfolio WHERE id=1').get();
    return { content: JSON.parse(row.content), version: row.version, updatedAt: row.updated_at };
  };
  const mailer = createMailEngine({ db, dataDir, getProfile: () => readContent().content.profile, ...(options.mailOptions || {}) });
  const mailLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many email-setup attempts. Please try again in 10 minutes.' } });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/portfolio', (_req, res) => {
    const { content, updatedAt } = readContent();
    res.json({ profile: content.profile, projects: content.projects.filter(p => p.published).map(publicProject), certificates: content.certificates.filter(c => c.published), contactDelivery: mailer.configured() ? 'email' : 'studio', updatedAt });
  });
  app.post('/api/contact', contactLimiter, (req, res) => {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { name, email, opportunity, message, website } = parsed.data;
    if (website) return res.json({ ok: true });
    const emailEnabled = mailer.configured();
    db.prepare('INSERT INTO messages(id,name,email,opportunity,message,created_at,email_status) VALUES(?,?,?,?,?,?,?)').run(randomUUID(), name, email, opportunity, message, new Date().toISOString(), emailEnabled ? 'pending' : 'not_configured');
    if (emailEnabled) void mailer.flush();
    res.status(201).json({ ok: true, delivery: emailEnabled ? 'email_queued' : 'stored_in_studio' });
  });
  app.post('/api/auth/login', loginLimiter, (req, res) => {
    const input = z.object({ username: z.string().max(100), password: z.string().min(1).max(128) }).safeParse(req.body);
    const record = db.prepare('SELECT * FROM admin WHERE id=1').get();
    if (!input.success) return res.status(400).json({ error: 'Enter a username and password.' });
    const valid = passwordMatches(input.data.password, record.password_hash);
    if (input.data.username.toLowerCase() !== 'hazem' || !valid) return res.status(401).json({ error: 'Incorrect username or password.' });
    const token = randomBytes(32).toString('base64url');
    const csrf = randomBytes(32).toString('base64url');
    db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
    db.prepare('INSERT INTO sessions(token_hash,csrf,expires) VALUES(?,?,?)').run(hash(token), csrf, Date.now() + 8 * 60 * 60 * 1000);
    res.cookie(COOKIE, token, cookieOptions(req));
    res.json({ username: 'hazem', csrf, mustChangePassword: Boolean(record.must_change) });
  });
  app.get('/api/auth/me', auth, (req, res) => {
    const record = db.prepare('SELECT must_change FROM admin WHERE id=1').get();
    res.json({ username: 'hazem', csrf: req.session.csrf, mustChangePassword: Boolean(record.must_change) });
  });
  app.post('/api/auth/logout', auth, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(req.session.token_hash);
    const { maxAge, ...opts } = cookieOptions(req);
    res.clearCookie(COOKIE, opts).json({ ok: true });
  });
  app.use('/api/admin', auth);
  app.get('/api/admin/content', (_req, res) => res.json(readContent()));
  app.get('/api/admin/mail', (_req, res) => res.json(mailer.status()));
  app.put('/api/admin/mail', mailLimiter, async (req, res) => {
    const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(req.hostname);
    if (!req.secure && !local) return res.status(400).json({ error: 'Use an HTTPS connection before entering email credentials.' });
    const input = z.object({ username: z.email().max(200), appPassword: z.string().min(16).max(64).refine(v => /^[a-zA-Z0-9]{16}$/.test(v.replace(/\s/g, '')), 'Enter a 16-character Google App Password, not your account password.') }).safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: input.error.issues[0].message });
    try { res.json(await mailer.configure(input.data.username, input.data.appPassword)); }
    catch (error) { res.status(400).json({ error: error.publicMessage ? error.message : safeMailError(error) }); }
  });
  app.post('/api/admin/mail/test', mailLimiter, async (_req, res) => {
    try { await mailer.sendTest(); res.json({ ok: true, message: 'Gmail accepted the test email. Check the inbox and spam folder.' }); }
    catch (error) { res.status(400).json({ error: error.publicMessage ? error.message : safeMailError(error) }); }
  });
  app.post('/api/admin/mail/retry', (_req, res) => {
    try { mailer.retry(); res.status(202).json({ ok: true }); }
    catch (error) { res.status(400).json({ error: error.publicMessage ? error.message : safeMailError(error) }); }
  });
  app.delete('/api/admin/mail', (_req, res) => {
    try { res.json(mailer.disconnect()); }
    catch (error) { res.status(400).json({ error: error.publicMessage ? error.message : safeMailError(error) }); }
  });
  app.put('/api/admin/content', (req, res) => {
    const input = z.object({ content: portfolioSchema, version: z.number().int().positive() }).safeParse(req.body);
    if (!input.success) {
      const issue = input.error.issues[0];
      return res.status(400).json({ error: `${issue.path.join('.')}: ${issue.message}` });
    }
    const updatedAt = new Date().toISOString();
    const result = db.prepare('UPDATE portfolio SET content=?,version=version+1,updated_at=? WHERE id=1 AND version=?').run(JSON.stringify(input.data.content), updatedAt, input.data.version);
    if (!result.changes) return res.status(409).json({ error: 'This content was changed in another tab. Copy your edits, then reload before saving.' });
    res.json({ ok: true, version: input.data.version + 1, updatedAt });
  });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
  app.post('/api/admin/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Select a JPG, PNG, WebP, or PDF file.' });
    const type = await fileTypeFromBuffer(req.file.buffer);
    if (!type || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(type.mime)) return res.status(400).json({ error: 'Only genuine JPG, PNG, WebP, and PDF files are accepted.' });
    const filename = randomUUID() + '.' + type.ext;
    await fs.promises.writeFile(path.join(dataDir, 'uploads', filename), req.file.buffer, { mode: 0o600, flag: 'wx' });
    res.status(201).json({ url: '/media/' + filename, mime: type.mime });
  });
  app.get('/api/admin/messages', (_req, res) => res.json({ messages: db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 1000').all() }));
  app.patch('/api/admin/messages/:id', (req, res) => {
    if (typeof req.body.read !== 'boolean') return res.status(400).json({ error: 'A read status is required.' });
    const result = db.prepare('UPDATE messages SET is_read=? WHERE id=?').run(req.body.read ? 1 : 0, req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Message not found.' });
    res.json({ ok: true });
  });
  app.delete('/api/admin/messages/:id', (req, res) => {
    const result = db.prepare('DELETE FROM messages WHERE id=?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Message not found.' });
    res.json({ ok: true });
  });
  app.get('/api/admin/export', (_req, res) => {
    res.set('Content-Disposition', 'attachment; filename="hazem-portfolio-content.json"');
    res.json({ schemaVersion: 1, exportedAt: new Date().toISOString(), content: readContent().content });
  });
  app.post('/api/admin/password', loginLimiter, (req, res) => {
    const input = z.object({ currentPassword: z.string().max(128), newPassword: z.string().min(14, 'Use at least 14 characters.').max(128) }).safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: input.error.issues[0].message });
    const record = db.prepare('SELECT * FROM admin WHERE id=1').get();
    if (!passwordMatches(input.data.currentPassword, record.password_hash)) return res.status(400).json({ error: 'The current password is incorrect.' });
    if (input.data.currentPassword === input.data.newPassword) return res.status(400).json({ error: 'Choose a different password.' });
    db.transaction(() => {
      db.prepare('UPDATE admin SET password_hash=?,must_change=0 WHERE id=1').run(passwordHash(input.data.newPassword));
      db.prepare('DELETE FROM sessions').run();
    })();
    if (fs.existsSync(accessFile)) fs.writeFileSync(accessFile, '# Private studio access\n\nUsername: **hazem**\n\nThe temporary password has been replaced. Use the password you set. No plaintext copy is stored. To reset it, follow the owner guide.\n', { mode: 0o600 });
    const { maxAge, ...opts } = cookieOptions(req);
    res.clearCookie(COOKIE, opts).json({ ok: true });
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  app.use('/media', express.static(path.join(dataDir, 'uploads'), { dotfiles: 'deny', index: false, maxAge: '1d' }));
  // The reviewed third-party project demo is isolated from Studio cookies and APIs.
  // No same-origin privilege, top navigation, forms, or live AI endpoints are granted.
  app.use('/demos/zoomtech', (_req, res, next) => {
    res.set('Content-Security-Policy', "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src data: https:; connect-src https://cdn.jsdelivr.net; worker-src blob:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
  });
  app.use(express.static(path.join(ROOT, 'dist'), { index: false, maxAge: 0 }));
  app.get(['/', '/admin', '/admin/'], (_req, res) => res.sendFile(path.join(ROOT, 'dist', 'index.html')));
  app.use((_req, res) => res.status(404).type('text').send('Page not found. Return to / to view the portfolio.'));
  app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'The maximum file size is 10 MB.' : 'Upload one file at a time.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'This request is too large.' });
    if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ error: 'Invalid JSON.' });
    console.error('Request failed:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });
  return { app, db, dataDir, mailer };
}
