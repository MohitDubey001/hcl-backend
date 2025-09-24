import express from 'express';
import dotenv from 'dotenv'
import { uploadRouter } from './src/routes/uploadRoutes.js';
import { authRouter } from './src/routes/authRoutes.js';

import { pool } from './src/db/db.js';

dotenv.config();

const app = express();
app.use(express.json());

app.use('/auth', authRouter);
app.use('/uploads', uploadRouter);


const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    try {
        // confirm DB connection on startup
        await pool.query('SELECT 1');
        console.log(`Server running on http://localhost:${PORT}`);
    } catch (err) {
        console.error('Failed to connect to DB on startup', err);
        process.exit(1);
    }
});

// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });