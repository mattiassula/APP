// Web app MS Coaching (Matti 26/11): si installa sulla schermata Home, si apre anche senza rete e si aggiorna da sola.
// - pagine (index, coach, check...): prima la rete, cosi' arriva sempre l'ultima versione; senza rete la copia salvata
// - file con l'impronta nel nome (assets/...): una volta scaricati restano, non cambiano mai
// - tutto il resto dello stesso sito: la copia salvata subito, aggiornata in sottofondo
// Le chiamate al server (Supabase, altri siti) non passano di qui: i dati del cliente non finiscono nella cache.
const CACHE = 'msc-v1';
const PAGINE = ['./', './coach/', './manifest.webmanifest', './icona-192.png', './icona-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PAGINE)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin) return;
  if (r.mode === 'navigate' || r.destination === 'document') {
    e.respondWith(fetch(r).then((res) => { const copia = res.clone(); if (res.ok) caches.open(CACHE).then((c) => c.put(r, copia)); return res; })
      .catch(() => caches.match(r).then((x) => x || caches.match(u.pathname.includes('/coach') ? './coach/' : './'))));
    return;
  }
  if (u.pathname.includes('/assets/')) {
    e.respondWith(caches.match(r).then((x) => x || fetch(r).then((res) => { const copia = res.clone(); if (res.ok) caches.open(CACHE).then((c) => c.put(r, copia)); return res; })));
    return;
  }
  e.respondWith(caches.match(r).then((x) => {
    const rete = fetch(r).then((res) => { const copia = res.clone(); if (res.ok) caches.open(CACHE).then((c) => c.put(r, copia)); return res; }).catch(() => x);
    return x || rete;
  }));
});
// notifiche dal sito (web push): il messaggio arriva dal server, toccandolo si apre l'app nella scheda giusta
self.addEventListener('push', (e) => {
  // messaggio di Firebase: { notification: {title, body}, data: {tab}, fcmOptions: {link} }
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { notification: { body: e.data ? e.data.text() : '' } }; }
  const n = d.notification || d, tab = (d.data && d.data.tab) || '';
  const url = (d.fcmOptions && d.fcmOptions.link) || (tab ? './?tab=' + encodeURIComponent(tab) : './');
  e.waitUntil(self.registration.showNotification(n.title || 'MS Coaching', { body: n.body || '', icon: './icona-192.png', badge: './icona-192.png', tag: tab || undefined, data: { url } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.location.href).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((l) => {
    const c = l.find((x) => x.url.startsWith(self.location.origin));
    if (c) { c.focus(); c.postMessage({ msc: 'notifica', url }); return; }
    return self.clients.openWindow(url);
  }));
});
