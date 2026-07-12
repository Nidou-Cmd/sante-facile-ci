/* Santé Facile — Service worker léger (P1).
 * Stratégie réseau d'abord + cache de secours, UNIQUEMENT pour les
 * ressources statiques de la même origine (jamais l'API Supabase).
 * Objectif : tolérer les coupures 3G/4G (app shell disponible hors ligne). */
const CACHE = 'sante-facile-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // Ne jamais intercepter les appels API (Supabase, Jitsi…)
  if (url.origin !== self.location.origin) return

  const isStatic =
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/' ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webmanifest') ||
    request.mode === 'navigate'

  if (!isStatic) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      try {
        const fresh = await fetch(request)
        if (fresh.ok) cache.put(request, fresh.clone())
        return fresh
      } catch {
        const cached = await cache.match(request)
        if (cached) return cached
        if (request.mode === 'navigate') {
          const shell = await cache.match('/')
          if (shell) return shell
        }
        return Response.error()
      }
    })(),
  )
})
