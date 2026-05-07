self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  let payload = {
    title: "ReCalc",
    body: "Tienes un nuevo mensaje.",
    url: "/unidep/inbox",
    tag: "inbox",
    threadId: null,
  };

  try {
    payload = { ...payload, ...(event.data.json() ?? {}) };
  } catch {
    payload.body = event.data.text();
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title, {
        body: payload.body,
        tag: payload.tag,
        data: {
          url: payload.url,
          threadId: payload.threadId,
        },
        icon: "/icons/icon128.png",
        badge: "/icons/icon128.png",
      }),
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clients) =>
          Promise.all(
            clients.map((client) =>
              client.postMessage({
                type: "push-received",
                payload,
              }),
            ),
          ),
        ),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.url || "/unidep/inbox",
    self.location.origin,
  ).toString();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      return self.clients.openWindow(targetUrl);
    }),
  );
});
