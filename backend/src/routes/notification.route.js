const express = require("express");

const {
    saveSubscription
} = require("../notification/push");

const router = express.Router();

router.post("/subscribe", (req, res) => {

    saveSubscription(req.body);

    res.status(201).json({
        message: "Subscribed successfully"
    });
});

module.exports = router;