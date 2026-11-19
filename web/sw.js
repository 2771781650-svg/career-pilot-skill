/* 离线缓存：断网也能打开、也能算（数据与规则全在前端脚本里） */
const CACHE = 'careerpilot-v5';
const ASSETS = [
  './', './index.html', './app.js', './demo.js', './persona.js', './agent.js',
  './tpl.js', './plus.js', './manifest.json', './icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
      .then(() => self.clients.claim()))
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;               // 大模型接口走网络，不缓存
  // 联网时优先取最新（代码改动能立刻生效），断网时回退缓存
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
