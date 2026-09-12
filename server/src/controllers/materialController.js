import fs from 'fs';
import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { saveLocalFile } from '../services/storageService.js';
import { extractText, chunkText } from '../services/documentService.js';

export const createMaterial = asyncHandler(async (req, res) => {
  const { title, category } = req.body;
  if (!title) throw new ApiError(400, 'title is required');

  let fileUrl = null;
  let extractedText = null;

  if (req.file) {
    fileUrl = saveLocalFile(req.file);
    const tmpPath = `uploads${fileUrl.replace('/uploads', '')}`;
    extractedText = await extractText(tmpPath, req.file.mimetype);
  } else if (req.body.text) {
    extractedText = req.body.text;
  }

  const material = await prisma.material.create({
    data: { userId: req.user.id, title, category, fileUrl, extractedText },
  });

  if (extractedText) {
    const chunks = chunkText(extractedText);
    await prisma.materialChunk.createMany({
      data: chunks.map((content, i) => ({ materialId: material.id, chunkIndex: i, content })),
    });
  }

  ok(res, { material }, 201);
});

export const listMaterials = asyncHandler(async (req, res) => {
  const materials = await prisma.material.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, category: true, fileUrl: true, createdAt: true },
  });
  ok(res, { materials });
});

export const getMaterial = asyncHandler(async (req, res) => {
  const material = await prisma.material.findUnique({ where: { id: req.params.id } });
  if (!material || material.userId !== req.user.id) throw new ApiError(404, 'Material not found');
  ok(res, { material });
});

export const deleteMaterial = asyncHandler(async (req, res) => {
  const material = await prisma.material.findUnique({ where: { id: req.params.id } });
  if (!material || material.userId !== req.user.id) throw new ApiError(404, 'Material not found');
  await prisma.material.delete({ where: { id: req.params.id } });
  ok(res, { deleted: true });
});
