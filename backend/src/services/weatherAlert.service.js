const {
    sendWeatherNotification
} = require("../notification/push");

const checkWeatherAndNotify = async (city, weather) => {

    if (!weather) {
        return;
    }

    const temperature = weather.main.temp;

    console.log(`${city} temperature: ${temperature}°C`);

    if (temperature > 40) {

        await sendWeatherNotification({
            title: "Extreme Heat Alert 🔥",
            body: `Temperature in ${city} is ${temperature}°C. Stay hydrated and avoid unnecessary outdoor activity.`
        });
    }
    if(temperature < 0) {

        await sendWeatherNotification({
            title: "Extreme Cold Alert ❄️",
            body: `Temperature in ${city} is ${temperature}°C. Stay warm and avoid prolonged exposure to the cold.`
        });
    }
    if(temperature >= 0 && temperature <= 40) {

        await sendWeatherNotification({
            title: "Weather Update 🌤️",
            body: `Temperature in ${city} is ${temperature}°C. Have a great day!`
            });
    }
    if(weather.weather[0].main === "Rain") {

        await sendWeatherNotification({
            title: "Rain Alert 🌧️",
            body: `It's raining in ${city}. Don't forget your umbrella!`
        });
    }
    if(weather.weather[0].main === "Snow") {

        await sendWeatherNotification({
            title: "Snow Alert ❄️",
            body: `It's snowing in ${city}. Drive safely and stay warm!`
        });
    }
    if(weather.weather[0].main === "Thunderstorm") {

        await sendWeatherNotification({
            title: "Thunderstorm Alert ⛈️",
            body: `There's a thunderstorm in ${city}. Stay indoors and stay safe!`
        });
    }
    if(weather.wind.speed > 20) {

        await sendWeatherNotification({
            title: "High Wind Alert 🌬️",
            body: `Winds in ${city} are strong at ${weather.wind.speed} m/s. Secure loose objects and stay indoors if possible!`
        });
    }

           
    }
module.exports = checkWeatherAndNotify;