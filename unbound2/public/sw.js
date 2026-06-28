self.addEventListener("push", (event) => {
let data = {};

try {
data = event.data ? event.data.json() : {};
} catch {
data = {};
}

const title = data.title || "Unbound";
const options = {
body: data.body || "You have a new notification.",
icon: "/apple-touch-icon.png",
badge: "/apple-touch-icon.png",
data: {
url: data.url || "/feed",
},
};

event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
event.notification.close();

const url = event.notification?.data?.url || "/feed";

event.waitUntil(
clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
for (const client of clientList) {
if ("focus" in client) {
client.navigate(url);
return client.focus();
}
}

if (clients.openWindow) {
return clients.openWindow(url);
}
})
);
});