const webpush = require("web-push");

webpush.setVapidDetails(
    "mailto:your@email.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

let subscription = null;

function saveSubscription(newSubscription) {
    subscription = newSubscription;

    console.log("Push subscription saved");
}

async function sendWeatherNotification(payload) {
    if (!subscription) {
        console.log("No push subscription found");
        return;
    }

    try {
        await webpush.sendNotification(
            subscription,
            JSON.stringify(payload)
        );

        console.log("Weather notification sent!");

    } catch (error) {
        console.error(
            "Weather notification failed:",
            error.message
        );
    }
}

module.exports = {
    saveSubscription,
    sendWeatherNotification
};