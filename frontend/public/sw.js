self.addEventListener("push", (event) => {
    const data = event.data.json();

    const options = {
        body: data.body,
        icon: "/weather-icon.png",
        badge: "/weather-icon.png",
        data: {
            url: "/"
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});


self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});