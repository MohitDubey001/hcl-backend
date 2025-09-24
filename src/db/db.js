import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
    // ssl: { rejectUnauthorized: false }, // enable for cloud providers if needed
});

pool.on('error', (err) => {
    console.error('Unexpected idle client error', err);
});

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();
export { pool }; // exported for graceful shutdown
