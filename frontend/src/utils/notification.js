export async function subscribeToNotifications() {
    if (!("serviceWorker" in navigator)) {
        console.log("Service workers not supported");
        return;
    }

    if (!("PushManager" in window)) {
        console.log("Push notifications not supported");
        return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
        console.log("Notification permission denied");
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.register("/sw.js");

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(
                import.meta.env.VITE_VAPID_PUBLIC_KEY
            )
        });

        const response = await fetch(
            "http://localhost:3000/api/notifications/subscribe",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(subscription)
            }
        );

        if (!response.ok) {
            const error = await response.text();

            console.error(
                "Subscription failed:",
                response.status,
                error
            );

            return;
        }

        const data = await response.json();

        console.log("Backend response:", data);
        console.log("Notification subscription successful");
        
        return true;
    } catch (error) {
        console.error("Notification error:", error);
        return false;
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat(
        (4 - (base64String.length % 4)) % 4
    );

    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData = window.atob(base64);

    return Uint8Array.from(
        [...rawData].map((char) => char.charCodeAt(0))
    );
}