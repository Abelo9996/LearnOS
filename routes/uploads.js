/**
 * File upload route (§3.3).
 * Accepts image uploads, stores them locally in ./uploads/, serves statically.
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

const uploadsPath = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });

const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsPath),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Validate extension matches allowed types
    const extMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
    if (!ALLOWED_MIMES.includes(extMap[ext])) {
      return cb(new Error('Invalid file type'));
    }
    const name = `${req.userId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPEG, WebP, and GIF images are allowed'));
    }
  },
});

router.post('/', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      const msg = err.message || 'Upload failed';
      return res.status(400).json({ error: true, message: msg });
    }
    if (!req.file) return res.status(400).json({ error: true, message: 'No file provided' });

    // S-08: Magic-byte sniff — the multer mime is client-asserted. Read the
    // first bytes and verify the real format matches the allowlist. If
    // mismatched (e.g. a JS file renamed to .png), delete and 400.
    try {
      const fd = fs.openSync(req.file.path, 'r');
      const buf = Buffer.alloc(4100);
      const n = fs.readSync(fd, buf, 0, 4100, 0);
      fs.closeSync(fd);
      const sniff = await fileTypeFromBuffer(buf.slice(0, n));
      if (!sniff || !ALLOWED_MIMES.includes(sniff.mime)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          error: true,
          code: 'INVALID_FILE_CONTENT',
          message: `File content does not match an allowed image format (detected: ${sniff?.mime || 'unknown'})`,
        });
      }
    } catch (e) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ error: true, message: 'Could not verify file contents' });
    }

    const url = `/uploads/${req.file.filename}`;
    res.json({ url, kind: 'image' });
  });
});

export default router;
