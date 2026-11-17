// Çevrimdışı çalışma: önce ağdan dene, olmazsa önbellekten ver.
const ONBELLEK = 'envai-v13';
// AI kütüphanesi (jsdelivr, sürümü sabit) ayrı ve kalıcı önbellekte; model dosyalarını transformers.js kendisi saklar
const AI_ONBELLEK = 'ai-kutuphane-v1';
const DOSYALAR = ['./', 'index.html', 'style.css', 'app.js', 'store.js', 'hesap.js', 'bulut.js', 'ornek.js', 'rapor.js', 'ui.js', 'dosyadepo.js', 'tanitim.js', 'studyo.js', 'siparis.js', 'musteri.js', 'nakis.js', 'giderler.js', 'kilit.js', 'disari.js', 'bitenler.js', 'analiz.js', 'ai-etiketler.json', 'lib/mp4-muxer.min.js', 'lib/jspdf.umd.min.js', 'lib/html2canvas.min.js',
  'firebase-config.js', 'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'icons/icon-maskable-512.png', 'icons/favicon-32.png', 'icons/marka.png', 'icons/logo-tam.png', 'logo/envai-amblem.png',
  'icons/acilis-ipadmini-dikey.png', 'icons/acilis-ipadmini-yatay.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(ONBELLEK).then(c => c.addAll(DOSYALAR)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x.startsWith('envai-') && x !== ONBELLEK).map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('@')) {   // sürümlü adres: önce önbellek
    e.respondWith(caches.open(AI_ONBELLEK).then(c => c.match(e.request).then(r => r || fetch(e.request).then(y => {
      if (y.ok) c.put(e.request, y.clone());
      return y;
    }))));
    return;
  }
  if (u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const kopya = r.clone(); caches.open(ONBELLEK).then(c => c.put(e.request, kopya)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
