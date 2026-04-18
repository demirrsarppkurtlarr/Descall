// Descall Service Worker - Offline Support
const CACHE_NAME = 'descall-v1'
const OFFLINE_URL = '/offline.html'

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
]

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET, websockets, API calls
  if (request.method !== 'GET' || url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return

  event.respondWith(
    caches.match(request).then(cached => {
      const fetchFresh = fetch(request).then(response => {
        // Cache successful HTML/JS/CSS responses
        if (response.ok && (
          request.destination === 'document' ||
          request.destination === 'script' ||
          request.destination === 'style'
        )) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
        }
        return response
      }).catch(() => cached || caches.match(OFFLINE_URL))

      // Serve cache first for assets, network first for pages
      if (request.destination === 'document') return fetchFresh
      return cached || fetchFresh
    })
  )
})

// Background sync for queued messages
self.addEventListener('sync', (event) => {
  if (event.tag === 'send-messages') {
    event.waitUntil(flushMessageQueue())
  }
})

async function flushMessageQueue() {
  // Implement background message queue flush here
  console.log('[SW] Flushing message queue...')
}

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title || 'Descall', {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-72.png',
      data: { url: data.url || '/' },
      vibrate: [100, 50, 100],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      const url = event.notification.data?.url || '/'
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
