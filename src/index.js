import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

// Args + ENV config
const argv = process.argv.slice(2);
const readArg = (name) => {
  const p = argv.find((a) => a.startsWith(`--${name}=`));
  return p ? p.split('=')[1] : undefined;
};

const PORT = Number(process.env.PORT || 8080);
// Allow passing target as a CLI arg: --target=https://upstream
const TARGET_BASE = (readArg('target') || process.env.TARGET_BASE || '').trim();
const ALLOW_ORIGINS = (process.env.ALLOW_ORIGINS || '*').trim();
const PROXY_TOKEN = (process.env.PROXY_TOKEN || '').trim();
const INSECURE_TLS = String(process.env.INSECURE_TLS || '').toLowerCase() === '1';
const LOG_FORMAT = process.env.LOG_FORMAT || 'tiny';
const LOG_REQUESTS = String(process.env.LOG_REQUESTS || '').trim() === '1';
const START_VERBOSE = String(process.env.START_VERBOSE || '').trim() === '1';

if (!TARGET_BASE) {
  // keep it generic; do not reveal intent
  console.error('TARGET_BASE env is required');
  process.exit(1);
}

function isAllowedOrigin(origin) {
  if (!origin || ALLOW_ORIGINS === '*') return true;
  return ALLOW_ORIGINS.split(',').map((s) => s.trim()).some((pat) => pat && origin.includes(pat));
}

const app = express();

// Basic logging + CORS
if (LOG_REQUESTS) {
  app.use(morgan(LOG_FORMAT));
}
app.use(cors({
  origin: (origin, cb) => {
    if (isAllowedOrigin(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Health endpoint
app.get('/health', (_req, res) => res.status(200).send('ok'));

// Optional auth token to guard the proxy
app.use((req, res, next) => {
  if (!PROXY_TOKEN) return next();
  const got = req.header('x-proxy-token');
  if (got && got === PROXY_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

// Strip hop-by-hop headers for safety
app.use((req, _res, next) => {
  ['connection', 'proxy-connection', 'keep-alive', 'transfer-encoding', 'upgrade'].forEach((h) => {
    if (req.headers[h]) delete req.headers[h];
  });
  next();
});

// Proxy rule: /p/* -> TARGET_BASE/*
const proxy = createProxyMiddleware({
  target: TARGET_BASE,
  changeOrigin: true,
  secure: !INSECURE_TLS,
  ws: false,
  pathRewrite: {
    '^/p': '',
  },
  onProxyReq: (proxyReq, req) => {
    // Normalize headers; keep it generic
    proxyReq.setHeader('x-forwarded-host', req.headers['host'] || '');
  },
});

app.use('/p', proxy);

app.listen(PORT, () => {
  if (START_VERBOSE) {
    try {
      const u = new URL(TARGET_BASE);
      console.log(`relay :${PORT} -> ${u.protocol}//${u.hostname}`);
    } catch {
      console.log(`relay :${PORT}`);
    }
  } else {
    console.log(`relay :${PORT}`);
  }
});
