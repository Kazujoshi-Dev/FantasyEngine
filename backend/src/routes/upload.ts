
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../db.js';

const router = express.Router();

// Robust path resolution based on process CWD
const projectRoot = path.resolve(process.cwd(), '..'); // CWD is /app/backend, so '..' gives /app
const uploadDir = path.join(projectRoot, 'uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

router.post('/', authenticateToken as any, (async (req: any, res: any, next: any) => {
     // Basic admin check
    const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
    if (userRes.rows[0]?.username !== 'Kazujoshi') {
        return res.status(403).json({ message: 'Forbidden' });
    }
    next();
}) as any, upload.single('file') as any, (req: any, res: any) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    // Return the URL path with /api prefix to ensure it works through proxies
    const fileUrl = `/api/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
});

export default router;
