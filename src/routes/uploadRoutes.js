import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import { query, getClient } from '../db/db.js';

export const uploadRouter = express.Router();

// Multer config
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        if (allowedTypes.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
    }
});

// Upload endpoint
uploadRouter.post('/upload-excel', upload.single('excelFile'), async (req, res) => {
    const client = await getClient();

    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No file uploaded',
                message: 'Please upload an Excel file'
            });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(worksheet, {
            raw: false,
            defval: null
        });

        if (jsonData.length === 0) {
            return res.status(400).json({
                error: 'Empty file',
                message: 'The Excel file contains no data'
            });
        }

        // Ensure table exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS uploads (
                id SERIAL PRIMARY KEY,
                file_blob BYTEA NOT NULL,
                json_object JSONB NOT NULL,
                uploaded_by TEXT,
                file_name TEXT,
                time_stamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const uploadedBy = req.body.uploadedBy || 'anonymous';

        const insertQuery = `
            INSERT INTO uploads (file_blob, json_object, uploaded_by, file_name)
            VALUES ($1, $2, $3, $4)
            RETURNING id, time_stamp
        `;

        const result = await client.query(insertQuery, [
            req.file.buffer,
            JSON.stringify(jsonData),
            uploadedBy,
            req.file.originalname
        ]);

        res.json({
            success: true,
            message: 'File uploaded successfully',
            data: {
                id: result.rows[0].id,
                uploadedBy,
                fileName: req.file.originalname,
                rowCount: jsonData.length,
                timeStamp: result.rows[0].time_stamp
            }
        });

    } catch (error) {
        console.error('Excel upload error:', error);
        res.status(500).json({ error: 'Upload failed', message: error.message });
    } finally {
        client.release();
    }
});

// Download original Excel file
uploadRouter.get('/:id/download', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(
            'SELECT file_blob, file_name FROM uploads WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Not found', message: 'No file found' });
        }

        const fileBuffer = result.rows[0].file_blob;
        const fileName = result.rows[0].file_name || `upload_${id}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(fileBuffer);

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Failed to download file', message: error.message });
    }
});

// Get stored JSON object
uploadRouter.get('/:id/json', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(
            'SELECT json_object FROM uploads WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Not found', message: 'No JSON found' });
        }

        res.json({
            id,
            json: result.rows[0].json_object
        });

    } catch (error) {
        console.error('JSON fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch JSON', message: error.message });
    }
});


// List recent uploads by user with pagination
uploadRouter.get('/user/:uploadedBy', async (req, res) => {
    try {
        const { uploadedBy } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const offset = (page - 1) * limit;

        // Get paginated results
        const result = await query(
            `SELECT id, file_name, uploaded_by, time_stamp
             FROM uploads
             WHERE uploaded_by = $1
             ORDER BY time_stamp DESC
             LIMIT $2 OFFSET $3`,
            [uploadedBy, limit, offset]
        );

        // Get total count for pagination
        const countResult = await query(
            `SELECT COUNT(*)::int AS total
             FROM uploads
             WHERE uploaded_by = $1`,
            [uploadedBy]
        );

        const total = countResult.rows[0].total;
        const totalPages = Math.ceil(total / limit);

        res.json({
            uploadedBy,
            page,
            total,
            totalPages,
            pageSize: limit,
            uploads: result.rows
        });

    } catch (error) {
        console.error('List uploads error:', error);
        res.status(500).json({
            error: 'Failed to fetch uploads',
            message: error.message
        });
    }
});
