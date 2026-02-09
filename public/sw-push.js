// Service Worker pour les notifications push
// Ce fichier sera importé par le SW généré par vite-plugin-pwa

// Gérer les notifications push entrantes
self.addEventListener('push', (event) => {
  console.log('[SW] Push reçu:', event);

  let data = {
    title: 'Nouvelle notification',
    body: 'Vous avez une nouvelle notification',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: { url: '/' }
  };

  // Essayer de parser les données du push
  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: data.badge,
        data: payload.data || data.data
      };
    } catch (e) {
      console.error('[SW] Erreur parsing push data:', e);
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [100, 50, 100],
    data: data.data,
    actions: [
      { action: 'open', title: 'Ouvrir' },
      { action: 'close', title: 'Fermer' }
    ],
    requireInteraction: true,
    tag: 'fa-coaching-notification'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Gérer le clic sur une notification
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification cliquée:', event);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // URL à ouvrir
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Chercher si une fenêtre est déjà ouverte
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(urlToOpen);
          return;
        }
      }
      // Sinon ouvrir une nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Gérer la fermeture d'une notification
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification fermée:', event);
});
