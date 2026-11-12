import fs from 'fs';
import path from 'path';
import { ApiError } from '../utils/ApiError.js';

export const ALLOWED_NOTE_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.md']);
export const ALLOWED_NOTE_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream', // fallback when OS omits DOCX MIME type; verified via extension
]);
export const MAX_NOTE_FILE_BYTES = 10 * 1024 * 1024;

export const validateUploadedNoteFile = (file, maxBytes = MAX_NOTE_FILE_BYTES) => {
  if (!file) {
    throw new ApiError(400, 'No document file uploaded');
  }
  const ext = path.extname(file.originalname || file.path || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if (!ALLOWED_NOTE_EXTENSIONS.has(ext)) {
    throw new ApiError(400, 'Unsupported file format. Please upload a PDF, DOCX, or TXT file.');
  }
  if (mime && !ALLOWED_NOTE_MIME_TYPES.has(mime)) {
    throw new ApiError(400, `Unsupported file MIME type: ${mime}`);
  }
  if (typeof file.size === 'number' && file.size > maxBytes) {
    throw new ApiError(400, `File size exceeds maximum limit of ${Math.round(maxBytes / (1024 * 1024))}MB`);
  }
  if (typeof file.size === 'number' && file.size === 0) {
    throw new ApiError(400, 'Uploaded file is empty');
  }
};

export const extractTextFromBuffer = async (buffer, mimetype = '', originalName = '') => {
  const ext = path.extname(originalName || '').toLowerCase();
  const mime = (mimetype || '').toLowerCase();

  if (mime === 'text/plain' || mime === 'text/markdown' || ext === '.txt' || ext === '.md') {
    return buffer.toString('utf-8').trim();
  }

  if (mime === 'application/pdf' || ext === '.pdf') {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buffer);
      return (data?.text || '').trim();
    } catch {
      return '';
    }
  }

  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx'
  ) {
    try {
      const mammoth = await import('mammoth');
      const extractor = mammoth.extractRawText || mammoth.default?.extractRawText;
      if (!extractor) return '';
      const result = await extractor({ buffer });
      return (result?.value || '').trim();
    } catch {
      return '';
    }
  }

  return '';
};

export const extractText = async (filePath, mimetype) => {
  if (!filePath || !fs.existsSync(filePath)) return '';
  const buffer = fs.readFileSync(filePath);
  return extractTextFromBuffer(buffer, mimetype, filePath);
};

export const chunkText = (text, chunkSize = 1000) => {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
};
