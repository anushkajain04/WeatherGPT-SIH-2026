import React, { useEffect } from "react";
import { subscribeToNotifications } from "./utils/notification";

const App = () => {

    const getWeather = () => {

        navigator.geolocation.getCurrentPosition(
            async (position) => {

                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                console.log("Latitude:", latitude);
                console.log("Longitude:", longitude);

                const response = await fetch(
                    `http://localhost:3000/api/weather?lat=${latitude}&lon=${longitude}`
                );

                const data = await response.json();

                console.log("Weather:", data);
            },

            (error) => {
                console.log("Location error:", error);
            }
        );
    };


    useEffect(() => {
        getWeather();
    }, []);


    const handleEnableAlerts = async () => {

        const subscribed = await subscribeToNotifications();

        if (subscribed) {
            getWeather();
        }
    };


    return (
        <div>

            <button
                onClick={handleEnableAlerts}
                className="..."
            >
                Enable Weather Alerts
            </button>

        </div>
    );
};

export default App;