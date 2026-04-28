self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "Мама звонит";
  const options = {
    body: data.body || "Вас зовут в звонок",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag || "mamazvonit-invite",
    renotify: true,
    data: {
      url: data.url || "/"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url === targetUrl && "focus" in client) {
        return client.focus();
      }
    }
    return clients.openWindow(targetUrl);
  })());
});
