import fs from 'fs';
import path from 'path';

// Abstraction so local disk storage can be swapped for Cloudinary/S3/Supabase
// later without touching controllers. Only `local` is implemented for the MVP.
const UPLOAD_DIR = path.resolve('uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const saveLocalFile = (file) => {
  const filename = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
  const dest = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(dest, file.buffer);
  return `/uploads/${filename}`;
};

export const provider = process.env.UPLOAD_PROVIDER || 'local';
