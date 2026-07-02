const express = require('express')
const mongoose = require('mongoose')

const router = express.Router()

router.get("/", (req,res) => {
    const states = ["disconnected", "connected", "connected", "disconnecting"];
    res.json({
        status: "ok",
        uptime: process.uptime(),
        db: states[mongoose.connection.readyState] || "unknown",
        timestamp: new Date().toString(),
    });
});

module.exports = router;