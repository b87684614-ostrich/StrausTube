'use strict';

/**
 * StrausTube — минимальный статический сервер.
 *
 * Задача сервера: раздавать статические файлы из ./public и отдавать
 * аккуратные заголовки безопасности. Приложение полностью клиентское:
 * никакие пользовательские данные на сервер не отправляются и не хранятся,
 * поэтому базы данных здесь нет вообще (и бесплатный тариф Render подходит).
 */

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(compression());

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        // 'unsafe-inline' нужен только для атрибутов style="" (размеры аватаров,
        // отступы), которые генерирует интерфейс. Скрипты по-прежнему могут
        // загружаться исключительно со своего источника.
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'media-src': ["'self'", 'data:', 'blob:', 'https:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-src': ["'none'"],
        // 'frame-ancestors' намеренно не задаётся: приложение — витрина,
        // и его встраивают превью-песочницы. Чувствительных данных тут нет.
      },
    },
    // Разрешаем встраивание в iframe (превью в IDE/панелях разработчика).
    frameguard: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: { maxAge: 15552000, includeSubDomains: false },
  })
);

app.get('/healthz', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, service: 'straustube', storage: 'browser-localStorage' });
});

app.use(
  express.static(PUBLIC_DIR, {
    etag: true,
    lastModified: true,
    maxAge: '1h',
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

app.use((req, res) => {
  res.status(404);
  if (req.accepts('html')) {
    res.sendFile(path.join(PUBLIC_DIR, '404.html'));
    return;
  }
  res.type('text/plain').send('404 Not Found');
});

app.use((err, _req, res, _next) => {
  console.error('[straustube]', err && err.message);
  res.status(500).type('text/plain').send('500 Internal Server Error');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`StrausTube запущен: http://localhost:${PORT}`);
});
