// 꿀복이 성장 일기 - Service Worker
// 캐싱 전략: 앱 셸은 캐시 우선, 동적 데이터는 네트워크 우선

const CACHE_VERSION = 'honeybok-v1.0.0';
const CACHE_NAME = `honeybok-${CACHE_VERSION}`;

// 앱 셸 (필수 파일들)
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png'
];

// 설치: 앱 셸 캐싱
self.addEventListener('install', (event) => {
  console.log('[SW] Install', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())  // 즉시 활성화
  );
});

// 활성화: 오래된 캐시 삭제
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('honeybok-') && key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Delete old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())  // 모든 클라이언트 즉시 제어
  );
});

// 페치 전략
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // GET 요청만 캐싱
  if (req.method !== 'GET') return;

  // Firebase, Cloudinary 등 외부 API는 네트워크만 (캐싱 안 함)
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('cloudinary.com') ||
    url.hostname.includes('youtube.com') ||
    url.hostname.includes('ytimg.com')
  ) {
    return;  // 브라우저 기본 동작 (네트워크)
  }

  // 같은 출처: 네트워크 우선, 실패 시 캐시
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          // 성공한 응답은 캐시에 저장
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => caches.match(req))  // 오프라인: 캐시에서 가져오기
    );
    return;
  }

  // CDN 폰트/스크립트 등: 캐시 우선
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      });
    })
  );
});

// 메시지 핸들러 (앱에서 SW 제어)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
