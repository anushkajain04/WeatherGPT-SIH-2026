const API_KEY = process.env.API_KEY;
const express = require("express");
const app = express();
app.get("/api/weather", async (req, res) => {
    const { lat, lon } = req.query;

    const url =
        `https://api.openweathermap.org/data/2.5/weather` +
        `?lat=${lat}` +
        `&lon=${lon}` +
        `&appid=${API_KEY}` +
        `&units=metric`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch weather" });
    }
});