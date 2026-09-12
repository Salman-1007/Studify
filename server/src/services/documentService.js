import fs from 'fs';

// MVP text extraction. PDFs: best-effort text extraction. Plain text: read directly.
// Chunking is simple fixed-size splitting so a future embeddings/RAG pipeline
// (see retrievalService.js) can replace this without changing the Material model.
export const extractText = async (filePath, mimetype) => {
  if (mimetype === 'text/plain') {
    return fs.readFileSync(filePath, 'utf-8');
  }
  if (mimetype === 'application/pdf') {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    } catch (err) {
      return '';
    }
  }
  return '';
};

export const chunkText = (text, chunkSize = 1000) => {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
};
