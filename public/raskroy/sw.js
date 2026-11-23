// Офлайн-режим: файлы программы кешируются при первом открытии, дальше она работает без интернета.
const CACHE = 'raskroy-v28';
const CORE = ['./', 'index.html', 'css/app.css', 'manifest.webmanifest', 'icons/icon.svg',
  'src/app.js', 'src/core/index.js', 'src/core/project.js', 'src/core/xml.js', 'src/core/optimizer.js',
  'src/core/edges.js', 'src/core/cost.js', 'src/core/cnc.js', 'src/core/operations.js', 'src/core/linear.js', 'src/core/xlsx.js', 'src/core/library.js', 'src/core/manual.js', 'src/core/drill.js', 'src/core/estimate.js', 'src/core/stockops.js', 'src/core/release.js', 'src/core/ptx.js', 'icons/artisan-logo.png', 'src/labels.js', 'vendor/qrcode.min.js', 'src/pdf.js', 'src/site.js', 'src/machines.js', 'vendor/jspdf.umd.min.js', 'vendor/fonts/DejaVuSansCondensed.ttf', 'vendor/fonts/DejaVuSansCondensed-Bold.ttf'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

// Сначала сеть (чтобы обновления приходили сразу), при отсутствии сети — кеш.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Заявки, прайс и вход с сайта не кешируем: на рабочем компьютере всегда только свежие данные.
  if (new URL(e.request.url).pathname.includes('/api/')) return;
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
