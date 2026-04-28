// ═══════════════════════════════════════════════════════════════
//  Service Worker  -  출장 보드 PWA
//  캐시 버전: v1.0
// ═══════════════════════════════════════════════════════════════
const CACHE_NAME = 'trip-board-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'
];

// ── Install: 정적 파일 캐시 ──
self.addEventListener('install', event => {
  console.log('[SW] 설치 중...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] 정적 파일 캐싱');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] 일부 파일 캐싱 실패 (정상):', err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate: 구 캐시 정리 ──
self.addEventListener('activate', event => {
  console.log('[SW] 활성화');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] 구 캐시 삭제:', k);
          return caches.delete(k);
        })
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: 네트워크 우선, 실패 시 캐시 ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // latest.json: 항상 네트워크 우선 (최신 데이터)
  if (url.pathname.endsWith('latest.json')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          console.log('[SW] latest.json 네트워크 실패 - 캐시 사용');
          return caches.match(event.request);
        })
    );
    return;
  }

  // 그 외: 캐시 우선, 없으면 네트워크
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // 오프라인 폴백 (HTML 요청 시 index.html)
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ── 백그라운드 최신 데이터 알림 ──
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
