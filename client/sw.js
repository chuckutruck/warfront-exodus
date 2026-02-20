/**
 * WARFRONT: EXODUS - Service Worker
 * Cache para funcionamiento offline básico
 */

const CACHE_NAME = 'warfront-exodus-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/src/main.js',
    '/src/firebase-config.js',
    '/src/core/Engine.js',
    '/src/core/InputManager.js',
    '/src/core/AudioSystem.js',
    '/src/entities/Player.js',
    '/src/entities/Weapon.js',
    '/src/entities/Projectile.js',
    '/src/network/NetworkManager.js',
    '/src/network/LobbySystem.js',
    '/src/gameplay/MatchManager.js',
    '/src/gameplay/DamageSystem.js',
    '/src/gameplay/AIController.js',
    '/src/ui/HUD.js',
    '/src/ui/MenuSystem.js',
    '/src/ui/MobileControls.js'
];

// Instalación
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activación
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch
self.addEventListener('fetch', (event) => {
    const { request } = event;
    
    // No cachear API de Firebase
    if (request.url.includes('googleapis.com') || 
        request.url.includes('firebase')) {
        return;
    }
    
    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) {
                return cached;
            }
            
            return fetch(request).then(response => {
                // Cachear recursos estáticos
                if (request.method === 'GET' && 
                    (request.url.endsWith('.js') || 
                     request.url.endsWith('.css'))) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, clone);
                    });
                }
                
                return response;
            }).catch(() => {
                // Fallback offline
                if (request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            });
        })
    );
});

// Mensajes desde cliente
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});