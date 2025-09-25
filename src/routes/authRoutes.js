import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { query } from "../db/db.js"; // your ES6 db wrapper

export const authRouter = express.Router();

// /login
authRouter.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    }

    try {
        //  Find user by username
        const { rows } = await query(
            "SELECT username, password FROM users WHERE username = $1 AND password = $2",
            [username, password]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        const user = rows[0];

        return res.status(200).json({ message: "Login successful", user: { username: user.username } });

    } catch (err) {
        console.error("Login error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
