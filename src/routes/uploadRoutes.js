import express from 'express'
// const router = express.Router();
// const bcrypt = require('bcrypt');

export const uploadRouter = express.Router();

uploadRouter.get("/test", (req, res) => {
    res.status(200).json({ message: "Hi, I'm Test endpoint!!!" });
});
