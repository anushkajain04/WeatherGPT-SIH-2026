const express = require("express");

const checkWeatherAndNotify = require("../services/weatherAlert.service");

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const { lat, lon } = req.query;

        console.log("Latitude:", lat);
        console.log("Longitude:", lon);

        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${process.env.API_KEY}&units=metric`
        );

        const weather = await response.json();

        console.log("OpenWeather response:", weather);

        // Check weather conditions and send notification
        await checkWeatherAndNotify(
            weather.name,
            weather
        );

        res.json(weather);

    } catch (error) {
        console.error("Weather error:", error);

        res.status(500).json({
            message: "Failed to fetch weather",
            error: error.message
        });
    }
});

module.exports = router;